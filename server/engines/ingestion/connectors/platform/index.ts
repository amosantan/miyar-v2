/**
 * EV-01b — Platform connector factory.
 *
 * Resolves a `source_registry` row to a deterministic storefront connector.
 * Returns null when the row is not platform-backed, so callers fall through to
 * the existing acquisition path unchanged.
 */

import type { ReliabilityGrade } from "../../confidence-policy";
import { MagentoPlatformConnector } from "./magento";
import { ShopifyPlatformConnector } from "./shopify";
import { WooCommercePlatformConnector } from "./woocommerce";
import { PlatformConnector } from "./base";
import type {
    PlatformConnectorConfig,
    PriceClass,
    SourcePlatform,
    TermsDecision,
} from "./types";

export { PlatformConnector, mapPlatformCategory, PLATFORM_USER_AGENT } from "./base";
export { parsePriceBasis, basisToUnit, PRICE_BASIS_POLICY_VERSION } from "./basis";
export { detectPlatform } from "./detect";
export { decodeMinorUnitPrice } from "./woocommerce";
export { ShopifyPlatformConnector, WooCommercePlatformConnector, MagentoPlatformConnector };
export * from "./types";

const FAMILIES = {
    shopify: ShopifyPlatformConnector,
    woocommerce: WooCommercePlatformConnector,
    magento: MagentoPlatformConnector,
} as const;

/** A registry row as the platform factory needs to see it. */
export interface PlatformSourceRow {
    id: number | string;
    name: string;
    url: string;
    platform?: string | null;
    scrapeMethod?: string | null;
    termsDecision?: string | null;
    priceClass?: string | null;
    reliabilityDefault?: ReliabilityGrade | null;
    requestDelayMs?: number | null;
    scrapeConfig?: { platform?: { pageBudget?: number; itemBudget?: number } } | null;
}

function isSupportedPlatform(value: unknown): value is keyof typeof FAMILIES {
    return typeof value === "string" && value in FAMILIES;
}

/**
 * True when this row should be acquired by the deterministic platform path.
 * Requires BOTH the json_api method and a supported platform, so flipping one
 * field alone never silently changes how a source is read.
 */
export function isPlatformSource(row: PlatformSourceRow): boolean {
    return row.scrapeMethod === "json_api" && isSupportedPlatform(row.platform);
}

export function createPlatformConnector(
    row: PlatformSourceRow
): PlatformConnector | null {
    if (!isPlatformSource(row)) return null;

    const platform = row.platform as keyof typeof FAMILIES;
    const Family = FAMILIES[platform];

    const config: PlatformConnectorConfig = {
        sourceId: String(row.id),
        sourceName: row.name,
        sourceUrl: row.url,
        platform: platform as SourcePlatform,
        // Absent means undecided, never approved. Defaulting the other way
        // would let a row that predates the column acquire without a decision.
        termsDecision: (row.termsDecision as TermsDecision) ?? "pending",
        priceClass: (row.priceClass as PriceClass) ?? "unknown",
        requestDelayMs: row.requestDelayMs ?? undefined,
        pageBudget: row.scrapeConfig?.platform?.pageBudget,
        itemBudget: row.scrapeConfig?.platform?.itemBudget,
    };

    const connector = new Family(config, row.reliabilityDefault ?? undefined);
    if (typeof row.id === "number") connector.sourceRegistryId = row.id;
    return connector;
}
