/**
 * EV-01b — Shopify storefront connector.
 *
 * Reads the public `products.json` catalogue endpoint. Every number comes from
 * a field Shopify published: `variants[].price` for the price, `variants[].sku`
 * for identity, `product_type` for category, `updated_at` for the observation
 * date. Nothing is inferred by a model.
 *
 * Verified live 2026-07-23 against tileking.ae and homesmiths.ae.
 */

import { parsePriceBasis } from "./basis";
import { PlatformConnector, type PlatformPageResult } from "./base";
import type { PlatformProduct } from "./types";

/** Shopify's own hard ceiling for this endpoint. */
const SHOPIFY_PAGE_SIZE = 250;

interface ShopifyVariant {
    id?: number;
    sku?: string | null;
    price?: string | null;
    title?: string | null;
    updated_at?: string | null;
    /** Shopify sets this per variant; null/absent means the store did not say. */
    taxable?: boolean | null;
}

interface ShopifyProduct {
    id?: number;
    title?: string | null;
    handle?: string | null;
    product_type?: string | null;
    vendor?: string | null;
    tags?: string[] | string | null;
    body_html?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    variants?: ShopifyVariant[] | null;
}

function parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stripHtml(value: string | null | undefined): string {
    if (!value) return "";
    return value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeTags(tags: ShopifyProduct["tags"]): string[] {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === "string");
    return tags.split(",").map(t => t.trim()).filter(Boolean);
}

export class ShopifyPlatformConnector extends PlatformConnector {
    /** Origin the collection path hangs off, derived from the registry URL. */
    private readonly base: URL;

    constructor(...args: ConstructorParameters<typeof PlatformConnector>) {
        super(...args);
        this.base = new URL(this.sourceUrl);
    }

    protected buildPageUrl(page: number): string {
        // Preserve a `/collections/<handle>` path when the registry row points
        // at one; otherwise read the whole catalogue.
        const collection = this.base.pathname.match(/\/collections\/[^/]+/)?.[0];
        const path = `${collection ?? "/collections/all"}/products.json`;
        const url = new URL(path, this.base.origin);
        url.searchParams.set("limit", String(SHOPIFY_PAGE_SIZE));
        url.searchParams.set("page", String(page));
        return url.toString();
    }

    protected parsePage(body: string, _headers: Headers, pageUrl: string): PlatformPageResult {
        let payload: { products?: ShopifyProduct[] };
        try {
            payload = JSON.parse(body);
        } catch {
            throw new Error(`Shopify endpoint returned non-JSON for ${pageUrl}`);
        }

        const raw = Array.isArray(payload.products) ? payload.products : [];
        const products: PlatformProduct[] = [];

        for (const item of raw) {
            const variants = (item.variants ?? []).filter(Boolean);
            const prices = variants
                .map(v => Number.parseFloat(String(v.price ?? "")))
                .filter(p => Number.isFinite(p) && p > 0);

            // A product with no positive price is not evidence of a price.
            if (prices.length === 0) continue;

            const priceAed = Math.min(...prices);
            const priceMax = Math.max(...prices);
            const primary = variants.find(
                v => Number.parseFloat(String(v.price ?? "")) === priceAed
            );

            const title = (item.title ?? "").trim();
            if (!title) continue;

            const descriptor = [title, primary?.title ?? "", item.product_type ?? ""]
                .filter(Boolean)
                .join(" ");
            const basis = parsePriceBasis(descriptor);

            const productKey =
                primary?.sku?.trim() ||
                (primary?.id != null ? `variant:${primary.id}` : "") ||
                (item.id != null ? `product:${item.id}` : "");
            if (!productKey) continue;

            const categoryPath = [
                item.product_type ?? "",
                ...normalizeTags(item.tags),
            ].filter(Boolean);

            const productUrl = item.handle
                ? new URL(`/products/${item.handle}`, this.base.origin).toString()
                : pageUrl;

            products.push({
                productKey,
                title,
                priceAed,
                priceAedMax: priceMax > priceAed ? priceMax : null,
                categoryPath,
                observedPublishedAt:
                    parseDate(primary?.updated_at) ??
                    parseDate(item.updated_at) ??
                    parseDate(item.published_at),
                basis: basis.basis,
                packQuantity: basis.packQuantity,
                // Shopify's `taxable` flag says whether tax applies, not whether
                // the listed price already includes it. That is not the same
                // question, so we decline to answer it.
                vatIncluded: null,
                productUrl,
                brand: item.vendor?.trim() || null,
                rawText: stripHtml(item.body_html) || descriptor,
            });
        }

        return {
            products,
            reportedTotal: null,
            // Shopify signals exhaustion with a short/empty page.
            hasMore: raw.length === SHOPIFY_PAGE_SIZE,
        };
    }
}
