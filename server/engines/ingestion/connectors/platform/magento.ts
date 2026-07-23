/**
 * EV-01b — Magento storefront connector.
 *
 * Magento renders prices into markup rather than exposing a public JSON
 * catalogue, so this family reads the machine-readable attributes Magento
 * itself emits — `data-price-amount`, `data-product-sku`, `data-price-box` —
 * with deterministic rules. It is rule-based HTML parsing, not model
 * extraction: no LLM touches the numeric path.
 *
 * Markup shape verified live 2026-07-23 against
 * `onlineshop.rakceramics.com/ae_en/tiles.html`.
 */

import { parsePriceBasis } from "./basis";
import { PlatformConnector, type PlatformPageResult } from "./base";
import type { PlatformProduct } from "./types";

/** One rendered product card, sliced on Magento's own item boundary. */
const ITEM_SPLIT = /<div[^>]+class="[^"]*product-item-info[^"]*"/i;

const PRODUCT_ID = /data-price-box="product-id-(\d+)"/i;
const PRICE_AMOUNT = /data-price-amount="([0-9]+(?:\.[0-9]+)?)"/i;
const PRICE_TYPE = /data-price-type="([a-zA-Z]+)"/i;
const PRODUCT_SKU = /data-product-sku="([^"]+)"/i;
const PRODUCT_LINK = /<a[^>]+class="[^"]*product-item-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
const SHORT_DESC = /<div[^>]+class="[^"]*short-desc[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
/** Magento's label for a range floor; the number is a "from", not a point. */
const AS_LOW_AS = /class="price-label"[^>]*>\s*As low as/i;

function decodeEntities(value: string): string {
    return value
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"');
}

function plainText(value: string | undefined): string {
    if (!value) return "";
    return decodeEntities(value.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

export class MagentoPlatformConnector extends PlatformConnector {
    private readonly base: URL;

    constructor(...args: ConstructorParameters<typeof PlatformConnector>) {
        super(...args);
        this.base = new URL(this.sourceUrl);
    }

    protected buildPageUrl(page: number): string {
        const url = new URL(this.base.toString());
        if (page > 1) url.searchParams.set("p", String(page));
        // Magento's catalogue page size selector; capped by the site itself.
        url.searchParams.set("product_list_limit", "36");
        return url.toString();
    }

    protected parsePage(body: string, _headers: Headers, pageUrl: string): PlatformPageResult {
        const chunks = body.split(ITEM_SPLIT).slice(1);
        const products: PlatformProduct[] = [];

        // The listing page's own breadcrumb/category name is the only category
        // signal Magento gives here; per-item taxonomy is not rendered.
        const categoryHint = plainText(
            body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        );

        for (const chunk of chunks) {
            const priceMatch = chunk.match(PRICE_AMOUNT);
            if (!priceMatch) continue;

            const priceAed = Number.parseFloat(priceMatch[1]);
            if (!Number.isFinite(priceAed) || priceAed <= 0) continue;

            // Only a final price is a price. A "regular"/"old" price shown
            // alongside a discount is not what the item currently sells for.
            const priceType = chunk.match(PRICE_TYPE)?.[1]?.toLowerCase();
            if (priceType && priceType !== "finalprice") continue;

            const linkMatch = chunk.match(PRODUCT_LINK);
            const title = plainText(linkMatch?.[2]);
            if (!title) continue;

            const sku = chunk.match(PRODUCT_SKU)?.[1]?.trim();
            const productId = chunk.match(PRODUCT_ID)?.[1];
            const productKey = sku || (productId ? `product:${productId}` : "");
            if (!productKey) continue;

            const shortDesc = plainText(chunk.match(SHORT_DESC)?.[1]);
            const isFromPrice = AS_LOW_AS.test(chunk);
            const basis = parsePriceBasis(`${title} ${shortDesc}`);

            products.push({
                productKey,
                title,
                // Magento rounds display but keeps full float precision in the
                // attribute (e.g. 103.950001); two decimals is the real money.
                priceAed: Math.round(priceAed * 100) / 100,
                priceAedMax: null,
                categoryPath: [shortDesc, categoryHint].filter(Boolean),
                observedPublishedAt: null,
                basis: basis.basis,
                packQuantity: basis.packQuantity,
                vatIncluded: null,
                productUrl: linkMatch?.[1] ?? pageUrl,
                brand: null,
                // Retained verbatim so a reviewer can see that a "from" price
                // is a range floor, not the typical selling price.
                rawText: [
                    shortDesc,
                    isFromPrice ? "[Magento label: As low as — range floor, not a point price]" : "",
                ]
                    .filter(Boolean)
                    .join(" ") || title,
            });
        }

        return {
            products,
            reportedTotal: null,
            // Magento exposes the next page through rel="next"; absence ends it.
            hasMore: /rel="next"/i.test(body) && products.length > 0,
        };
    }
}
