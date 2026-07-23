/**
 * EV-01b — WooCommerce Store API connector.
 *
 * Reads `/wp-json/wc/store/v1/products`, the public read-only Store API. Prices
 * arrive as minor-unit integers with the scale published alongside them in
 * `prices.currency_minor_unit`; the scale is always read from the payload and
 * never assumed, because getting it wrong is a 100x error.
 *
 * Verified live 2026-07-23 against thehardwarestop.com (5,234 priced products,
 * AED, `currency_minor_unit: 2`).
 */

import { parsePriceBasis } from "./basis";
import { PlatformConnector, type PlatformPageResult } from "./base";
import type { PlatformProduct } from "./types";

const WOO_PAGE_SIZE = 100;

interface WooPrices {
    price?: string | null;
    regular_price?: string | null;
    currency_code?: string | null;
    currency_minor_unit?: number | null;
    price_range?: { min_amount?: string | null; max_amount?: string | null } | null;
}

interface WooProduct {
    id?: number;
    name?: string | null;
    sku?: string | null;
    permalink?: string | null;
    short_description?: string | null;
    description?: string | null;
    prices?: WooPrices | null;
    categories?: Array<{ name?: string | null }> | null;
    /** Present on variable products; absent on simple ones. */
    date_modified?: string | null;
}

function stripHtml(value: string | null | undefined): string {
    if (!value) return "";
    return value
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Convert a Store API minor-unit integer to major units using the scale the
 * payload itself published. Returns null when either part is unusable — a
 * price we cannot decode with certainty is not a price we may record.
 */
export function decodeMinorUnitPrice(
    raw: string | null | undefined,
    minorUnit: number | null | undefined
): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    if (minorUnit === null || minorUnit === undefined) return null;
    if (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 6) return null;

    const amount = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    return amount / Math.pow(10, minorUnit);
}

export class WooCommercePlatformConnector extends PlatformConnector {
    private readonly base: URL;

    constructor(...args: ConstructorParameters<typeof PlatformConnector>) {
        super(...args);
        this.base = new URL(this.sourceUrl);
    }

    protected buildPageUrl(page: number): string {
        const url = new URL("/wp-json/wc/store/v1/products", this.base.origin);
        url.searchParams.set("per_page", String(WOO_PAGE_SIZE));
        url.searchParams.set("page", String(page));
        return url.toString();
    }

    protected parsePage(body: string, headers: Headers, pageUrl: string): PlatformPageResult {
        let payload: WooProduct[];
        try {
            payload = JSON.parse(body);
        } catch {
            throw new Error(`WooCommerce endpoint returned non-JSON for ${pageUrl}`);
        }
        if (!Array.isArray(payload)) {
            throw new Error(`WooCommerce endpoint returned a non-array body for ${pageUrl}`);
        }

        const totalHeader = headers.get("x-wp-total");
        const totalPagesHeader = headers.get("x-wp-totalpages");
        const reportedTotal = totalHeader ? Number.parseInt(totalHeader, 10) : null;
        const totalPages = totalPagesHeader ? Number.parseInt(totalPagesHeader, 10) : null;

        const products: PlatformProduct[] = [];

        for (const item of payload) {
            const prices = item.prices;
            if (!prices) continue;

            // Currency must be stated and must be AED. A GBP-priced item in a
            // UAE store is a real thing and must not be recorded as dirhams.
            if ((prices.currency_code ?? "").toUpperCase() !== "AED") continue;

            const minorUnit = prices.currency_minor_unit;
            const priceAed = decodeMinorUnitPrice(prices.price, minorUnit);
            if (priceAed === null) continue;

            const rangeMax = decodeMinorUnitPrice(prices.price_range?.max_amount, minorUnit);

            const title = stripHtml(item.name);
            if (!title) continue;

            const productKey =
                item.sku?.trim() || (item.id != null ? `product:${item.id}` : "");
            if (!productKey) continue;

            const categoryPath = (item.categories ?? [])
                .map(c => stripHtml(c?.name))
                .filter(Boolean);

            const shortDescription = stripHtml(item.short_description);
            const basis = parsePriceBasis(`${title} ${shortDescription}`);

            products.push({
                productKey,
                title,
                priceAed,
                priceAedMax: rangeMax !== null && rangeMax > priceAed ? rangeMax : null,
                categoryPath,
                observedPublishedAt: null,
                basis: basis.basis,
                packQuantity: basis.packQuantity,
                // The Store API exposes tax status elsewhere and inconsistently
                // across store configurations; it is not stated here.
                vatIncluded: null,
                productUrl: item.permalink ?? pageUrl,
                brand: null,
                rawText: shortDescription || title,
            });
        }

        const currentPage = Number.parseInt(
            new URL(pageUrl).searchParams.get("page") ?? "1",
            10
        );

        return {
            products,
            reportedTotal: Number.isFinite(reportedTotal as number) ? reportedTotal : null,
            hasMore:
                totalPages !== null && Number.isFinite(totalPages)
                    ? currentPage < totalPages
                    : payload.length === WOO_PAGE_SIZE,
        };
    }
}
