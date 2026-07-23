/**
 * EV-01b — Shared contracts for the deterministic platform connector family.
 *
 * These connectors read structured storefront endpoints (Shopify, WooCommerce,
 * Magento) rather than asking a model to read a page. Nothing here may put an
 * LLM on the numeric path: price, currency, unit basis, and category all come
 * from fields the source itself published.
 */

import type { PriceBasis } from "./basis";

export type SourcePlatform = "shopify" | "woocommerce" | "magento" | "none";

export type PriceClass =
    | "retail_listed"
    | "trade_quoted"
    | "official_statistic"
    | "consultancy_benchmark"
    | "unknown";

export type TermsDecision = "pending" | "approved" | "rejected";

/** One priced product as the storefront published it. */
export interface PlatformProduct {
    /** Stable per-source identity: SKU when present, else platform product id. */
    productKey: string;
    title: string;
    /** Price in AED major units. Never a minor-unit integer. */
    priceAed: number;
    /** Highest variant price when the product has a range; else null. */
    priceAedMax: number | null;
    /** Category text as the source published it, most specific first. */
    categoryPath: string[];
    /** Source-published update or publish timestamp; null when absent. */
    observedPublishedAt: Date | null;
    basis: PriceBasis;
    packQuantity: number | null;
    /** Null when the source did not state VAT treatment — never assumed. */
    vatIncluded: boolean | null;
    productUrl: string;
    brand: string | null;
    /** Raw text the basis verdict was derived from, retained for audit. */
    rawText: string;
}

export interface PlatformFetchOutcome {
    products: PlatformProduct[];
    pagesFetched: number;
    /** Total the source reported, when it reports one (e.g. `X-WP-Total`). */
    reportedTotal: number | null;
    /** True when a page budget or item cap stopped an otherwise-complete read. */
    truncated: boolean;
}

export interface PlatformConnectorConfig {
    sourceId: string;
    sourceName: string;
    /** Storefront origin or collection URL from the registry row. */
    sourceUrl: string;
    platform: SourcePlatform;
    termsDecision: TermsDecision;
    priceClass: PriceClass;
    /** Maximum pages per run. Bounded per AGENTS.md loop control. */
    pageBudget?: number;
    /** Maximum products persisted per run. */
    itemBudget?: number;
    requestDelayMs?: number;
    /** Whole-run wall clock ceiling in milliseconds. */
    runTimeoutMs?: number;
}

export const DEFAULT_PLATFORM_LIMITS = {
    pageBudget: 20,
    itemBudget: 2000,
    requestDelayMs: 2000,
    runTimeoutMs: 5 * 60 * 1000,
    requestTimeoutMs: 20_000,
} as const;

/**
 * A source whose terms decision is not `approved` is not a failure — it is
 * awaiting a human decision. The distinction matters: a failure increments
 * `consecutiveFailures` and eventually deactivates a source that was never
 * broken.
 */
export class TermsNotApprovedError extends Error {
    readonly sourceId: string;
    readonly decision: TermsDecision;

    constructor(sourceId: string, decision: TermsDecision) {
        super(
            `Source ${sourceId} has terms decision "${decision}"; acquisition requires "approved" (BR-06)`
        );
        this.name = "TermsNotApprovedError";
        this.sourceId = sourceId;
        this.decision = decision;
    }
}
