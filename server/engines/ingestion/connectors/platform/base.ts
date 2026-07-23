/**
 * EV-01b — Base class for deterministic platform connectors.
 *
 * Responsibilities kept here so no storefront family can skip them:
 *   1. BR-06 terms gate — refuse to issue a single request until a human has
 *      recorded `termsDecision = "approved"` for the registry row.
 *   2. ADR-0010 strict robots gate before EVERY request, pagination included.
 *   3. Bounded pagination: page budget, item budget, per-request timeout, and
 *      a whole-run wall clock, per AGENTS.md loop control.
 *   4. Polite pacing between pages.
 *
 * Subclasses only implement `buildPageUrl` and `parsePage`. They never fetch
 * directly, so the gates cannot be bypassed by a new family.
 */

import {
    BaseSourceConnector,
    type ExtractedEvidence,
    type NormalizedEvidenceInput,
    type RawSourcePayload,
    type ConfidenceEvaluationContext,
    resolveGradePolicy,
    evaluateEvidenceConfidence,
    publicationDateFields,
} from "../../connector";
import type { GradePolicyMetadata, ReliabilityGrade } from "../../confidence-policy";
import { assertUrlAllowedByRobots } from "../../robots-policy";
import { classifyFinishLevelForObservation } from "../../../tier-policy";
import { basisToUnit, PRICE_BASIS_POLICY_VERSION } from "./basis";
import {
    DEFAULT_PLATFORM_LIMITS,
    TermsNotApprovedError,
    type PlatformConnectorConfig,
    type PlatformFetchOutcome,
    type PlatformProduct,
    type PriceClass,
    type SourcePlatform,
    type TermsDecision,
} from "./types";

/**
 * A single honest identifier. The storefront families read public catalogue
 * endpoints under an explicit robots check; they do not rotate browser user
 * agents. The robots verdict is evaluated for THIS exact agent, so the gate
 * answers the question we actually ask of the site.
 */
export const PLATFORM_USER_AGENT =
    "Mozilla/5.0 (compatible; MiyarIngest/1.0; +https://miyar.ae/ingestion)";

/** Evidence carrying the deterministic platform fields through normalize(). */
export interface PlatformExtractedEvidence extends ExtractedEvidence {
    product: PlatformProduct;
}

export interface PlatformNormalizedInput extends NormalizedEvidenceInput {
    priceClass: PriceClass;
    priceBasis: PlatformProduct["basis"];
    packQuantity: number | null;
    vatIncluded: boolean | null;
    platformProductKey: string;
    priceBasisPolicyVersion: typeof PRICE_BASIS_POLICY_VERSION;
}

export interface PlatformPageResult {
    products: PlatformProduct[];
    /** Total the source reports, when it reports one. */
    reportedTotal: number | null;
    /** False when this page proves there is nothing further to read. */
    hasMore: boolean;
}

/**
 * Evidence categories the platform families may assign. Anything a storefront
 * taxonomy does not map to confidently becomes "other" rather than being
 * forced into a material bucket it does not belong in.
 */
const EVIDENCE_CATEGORIES = [
    "floors",
    "walls",
    "ceilings",
    "joinery",
    "lighting",
    "sanitary",
    "kitchen",
    "hardware",
    "ffe",
    "other",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

/**
 * Deterministic storefront-taxonomy mapping. Ordered: the first rule whose
 * pattern matches any segment of the published category path wins, so more
 * specific categories are listed first.
 */
const CATEGORY_RULES: ReadonlyArray<{ pattern: RegExp; category: EvidenceCategory }> = [
    { pattern: /\b(?:false ceilings?|ceiling tiles?|ceiling boards?|gypsum boards?|plasterboards?|coffer)\b/i, category: "ceilings" },
    { pattern: /\b(?:sanitary|sanitaryware|basins?|washbasins?|toilets?|wc suites?|bidets?|showers?|bathtubs?|faucets?|taps?|mixers?|plumbing)\b/i, category: "sanitary" },
    { pattern: /\b(?:kitchens?|cabinetry|worktops?|countertops?|splashbacks?|hobs?|cooker hoods?)\b/i, category: "kitchen" },
    { pattern: /\b(?:lights?|lighting|luminaires?|lamps?|led|chandeliers?|downlights?|switch(?:es)?|sockets?)\b/i, category: "lighting" },
    // Qualified wall surfaces before the generic tile rule, so "wall tile"
    // does not fall through to floors.
    { pattern: /\b(?:wall tiles?|wallpapers?|paints?|primers?|emulsions?|coatings?|render|cladding|walls?)\b/i, category: "walls" },
    { pattern: /\b(?:floor tiles?|flooring|floors?|parquet|vinyl planks?|laminate|skirtings?|screed)\b/i, category: "floors" },
    { pattern: /\b(?:joinery|carpentry|timber|plywood|mdf|dowels?|sheets? (?:&|and) boards?|veneers?)\b/i, category: "joinery" },
    { pattern: /\b(?:hardware|fasteners?|fastenings?|fixings?|screws?|anchors?|hinges?|handles?|ironmongery|tools?)\b/i, category: "hardware" },
    { pattern: /\b(?:furniture|furnishings?|sofas?|chairs?|tables?|rugs?|curtains?|decor|homeware|tableware|accessor)\b/i, category: "ffe" },
    // An unqualified "tile" is ambiguous. It resolves to floors to match the
    // existing evidence→catalog convention in `evidence-to-materials.ts`,
    // and only after every qualified rule above has had its chance.
    { pattern: /\b(?:tiles?|porcelain|ceramic|marble|granite|travertine)\b/i, category: "floors" },
];

/**
 * Map a storefront category path to an evidence category. Most specific
 * published segment first; "other" when nothing matches confidently.
 */
export function mapPlatformCategory(categoryPath: readonly string[]): EvidenceCategory {
    for (const segment of categoryPath) {
        for (const rule of CATEGORY_RULES) {
            if (rule.pattern.test(segment)) return rule.category;
        }
    }
    return "other";
}

export abstract class PlatformConnector extends BaseSourceConnector {
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    geography = "UAE";

    readonly platform: SourcePlatform;
    readonly termsDecision: TermsDecision;
    readonly priceClass: PriceClass;
    /** Grade provenance, exposed even when normalization rejects an item. */
    gradePolicy: GradePolicyMetadata;

    protected readonly pageBudget: number;
    protected readonly itemBudget: number;
    protected readonly runTimeoutMs: number;

    private products: PlatformProduct[] = [];
    private lastOutcome: PlatformFetchOutcome | null = null;

    constructor(config: PlatformConnectorConfig, registryGrade?: ReliabilityGrade) {
        super();
        this.sourceId = config.sourceId;
        this.sourceName = config.sourceName;
        this.sourceUrl = config.sourceUrl;
        this.platform = config.platform;
        this.termsDecision = config.termsDecision;
        this.priceClass = config.priceClass;
        this.pageBudget = config.pageBudget ?? DEFAULT_PLATFORM_LIMITS.pageBudget;
        this.itemBudget = config.itemBudget ?? DEFAULT_PLATFORM_LIMITS.itemBudget;
        this.runTimeoutMs = config.runTimeoutMs ?? DEFAULT_PLATFORM_LIMITS.runTimeoutMs;
        this.requestDelayMs = config.requestDelayMs ?? DEFAULT_PLATFORM_LIMITS.requestDelayMs;
        this.gradePolicy = resolveGradePolicy(config.sourceId, registryGrade);
    }

    /** Page numbers are 1-based; subclasses translate to their own paging. */
    protected abstract buildPageUrl(page: number): string;

    protected abstract parsePage(
        body: string,
        headers: Headers,
        pageUrl: string
    ): PlatformPageResult;

    /** Accept overrides so tests can drive the loop without real network. */
    protected async fetchPage(url: string): Promise<{ body: string; headers: Headers; status: number }> {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            DEFAULT_PLATFORM_LIMITS.requestTimeoutMs
        );
        try {
            const response = await globalThis.fetch(url, {
                signal: controller.signal,
                headers: {
                    Accept: "application/json, text/html;q=0.9",
                    "User-Agent": PLATFORM_USER_AGENT,
                },
            });
            const body = await response.text();
            return { body, headers: response.headers, status: response.status };
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Paginate the storefront under every gate and budget. The result payload
     * carries counts only — the products live on the instance and are mapped
     * by extract(), mirroring how DynamicConnector accumulates crawled pages.
     */
    async fetch(): Promise<RawSourcePayload> {
        const startedAt = new Date();
        this.products = [];
        this.lastOutcome = null;

        // Gate 1 — BR-06 terms. Checked before anything touches the network.
        if (this.termsDecision !== "approved") {
            throw new TermsNotApprovedError(this.sourceId, this.termsDecision);
        }

        const collected: PlatformProduct[] = [];
        const seenKeys = new Set<string>();
        let reportedTotal: number | null = null;
        let pagesFetched = 0;
        let truncated = false;

        for (let page = 1; page <= this.pageBudget; page++) {
            if (Date.now() - startedAt.getTime() > this.runTimeoutMs) {
                truncated = true;
                console.warn(
                    `[Platform] ${this.sourceId}: run timeout after ${pagesFetched} page(s)`
                );
                break;
            }

            const pageUrl = this.buildPageUrl(page);

            // Gate 2 — ADR-0010 strict robots, re-asserted for EVERY page and
            // for the exact agent we send. A collection URL being allowed says
            // nothing about page 7, or about a different path prefix.
            await assertUrlAllowedByRobots(pageUrl, PLATFORM_USER_AGENT);

            const pacingMs = this.requestDelayMs ?? DEFAULT_PLATFORM_LIMITS.requestDelayMs;
            if (page > 1 && pacingMs > 0) {
                await new Promise(resolve => setTimeout(resolve, pacingMs));
            }

            const { body, headers, status } = await this.fetchPage(pageUrl);
            pagesFetched++;

            if (status === 404 || status === 410) break;
            if (status >= 400) {
                throw new Error(`HTTP ${status} for ${pageUrl}`);
            }

            const result = this.parsePage(body, headers, pageUrl);
            if (result.reportedTotal !== null) reportedTotal = result.reportedTotal;

            for (const product of result.products) {
                if (seenKeys.has(product.productKey)) continue;
                seenKeys.add(product.productKey);
                collected.push(product);
            }

            if (collected.length >= this.itemBudget) {
                collected.length = this.itemBudget;
                truncated = true;
                break;
            }
            if (!result.hasMore || result.products.length === 0) break;
            if (page === this.pageBudget) truncated = true;
        }

        this.products = collected;
        this.lastOutcome = {
            products: collected,
            pagesFetched,
            reportedTotal,
            truncated,
        };

        // AGENTS.md: a bounded read must say what it left behind. Silent
        // truncation reads as complete coverage when it is not.
        if (truncated) {
            console.warn(
                `[Platform] ${this.sourceId}: bounded read stopped at ${collected.length} product(s) ` +
                `over ${pagesFetched} page(s)` +
                (reportedTotal !== null ? ` of ${reportedTotal} reported` : "")
            );
        }

        return {
            url: this.sourceUrl,
            fetchedAt: startedAt,
            rawJson: {
                platform: this.platform,
                productCount: collected.length,
                pagesFetched,
                reportedTotal,
                truncated,
            },
            statusCode: 200,
        };
    }

    /** Outcome of the last fetch, for run reporting. Null before any fetch. */
    getLastOutcome(): PlatformFetchOutcome | null {
        return this.lastOutcome;
    }

    async extract(raw: RawSourcePayload): Promise<PlatformExtractedEvidence[]> {
        return this.products.map(product => ({
            title: `${this.sourceName} - ${product.title}`,
            rawText: product.rawText,
            ...publicationDateFields(
                product.observedPublishedAt ? product.observedPublishedAt.toISOString() : undefined,
                raw.fetchedAt
            ),
            observedAt: raw.fetchedAt,
            category: mapPlatformCategory(product.categoryPath),
            geography: this.geography,
            sourceUrl: product.productUrl,
            product,
        }));
    }

    async normalize(
        evidence: ExtractedEvidence,
        context?: ConfidenceEvaluationContext
    ): Promise<PlatformNormalizedInput> {
        const product = (evidence as PlatformExtractedEvidence).product;
        const gradePolicy = this.gradePolicy;
        const confidencePolicy = evaluateEvidenceConfidence(
            evidence,
            gradePolicy.grade,
            context
        );

        const unit = basisToUnit(product.basis);

        return {
            metric: product.title,
            value: product.priceAed,
            valueMax: product.priceAedMax,
            unit,
            confidence: confidencePolicy.initial.score,
            grade: gradePolicy.grade,
            confidencePolicy,
            gradePolicy,
            summary: product.rawText.slice(0, 500),
            tags: [this.platform, this.priceClass, ...product.categoryPath.slice(0, 3)],
            brand: product.brand,
            // ADR-0009: the deterministic tier policy owns finishLevel. There is
            // no model suggestion on this path to demote.
            finishLevel: classifyFinishLevelForObservation(
                product.priceAed,
                product.priceAedMax,
                unit
            ),
            // These connectors read storefront catalogues, which are material
            // prices by construction. Nothing here infers a market statistic.
            intelligenceType: "material_price",
            priceClass: this.priceClass,
            priceBasis: product.basis,
            packQuantity: product.packQuantity,
            vatIncluded: product.vatIncluded,
            platformProductKey: product.productKey,
            priceBasisPolicyVersion: PRICE_BASIS_POLICY_VERSION,
        };
    }
}
