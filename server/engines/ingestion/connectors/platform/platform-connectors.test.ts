/**
 * EV-01b — Deterministic platform connector coverage.
 *
 * Fixtures only: no test in this file touches the network. The payload shapes
 * are copied from live responses observed on 2026-07-23 (tileking.ae,
 * thehardwarestop.com, onlineshop.rakceramics.com).
 *
 * The gates are the point of these tests. A connector that quietly skips the
 * robots check or the terms decision is the failure mode that matters.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above the imports, so the spy has to be created inside
// the factory and reached through `vi.mocked` afterwards.
vi.mock("../../robots-policy", async () => {
    const actual = await vi.importActual<typeof import("../../robots-policy")>(
        "../../robots-policy"
    );
    return { ...actual, assertUrlAllowedByRobots: vi.fn() };
});

import * as robotsPolicy from "../../robots-policy";
import { RobotsPolicyError } from "../../robots-policy";

const assertUrlAllowedByRobots = vi.mocked(robotsPolicy.assertUrlAllowedByRobots);
import { ShopifyPlatformConnector } from "./shopify";
import { WooCommercePlatformConnector, decodeMinorUnitPrice } from "./woocommerce";
import { MagentoPlatformConnector } from "./magento";
import { mapPlatformCategory, type PlatformConnector } from "./base";
import { createPlatformConnector, isPlatformSource } from "./index";
import { TermsNotApprovedError, type PlatformConnectorConfig } from "./types";

function config(overrides: Partial<PlatformConnectorConfig> = {}): PlatformConnectorConfig {
    return {
        sourceId: "test-source",
        sourceName: "Test Source",
        sourceUrl: "https://shop.example/collections/floor-tiles",
        platform: "shopify",
        termsDecision: "approved",
        priceClass: "retail_listed",
        requestDelayMs: 0,
        ...overrides,
    };
}

/** Drive the pagination loop from a scripted list of page bodies. */
function stubPages(
    connector: PlatformConnector,
    pages: Array<{ body: string; headers?: Record<string, string>; status?: number }>
) {
    const calls: string[] = [];
    let index = 0;
    (connector as any).fetchPage = async (url: string) => {
        calls.push(url);
        const page = pages[index++] ?? { body: "[]", status: 200 };
        return {
            body: page.body,
            headers: new Headers(page.headers ?? {}),
            status: page.status ?? 200,
        };
    };
    return calls;
}

function shopifyPage(products: unknown[]): string {
    return JSON.stringify({ products });
}

const SHOPIFY_PRODUCT = {
    id: 9538014675242,
    title: "Acquarella Acqua Subway Tile, Matt, 7.5x30 cm, 8 mm",
    handle: "acquarella-acqua-subway-tile-matt-7-5x30-cm",
    product_type: "Wall Tiles",
    vendor: "Acquarella",
    tags: ["subway", "matt"],
    body_html: "<p>Homage to Clay</p>",
    published_at: "2025-11-02T09:00:00+04:00",
    updated_at: "2026-07-20T11:15:00+04:00",
    variants: [
        { id: 1, sku: "AQ-SUB-075030", price: "39.00", updated_at: "2026-07-20T11:15:00+04:00" },
        { id: 2, sku: "AQ-SUB-075030-B", price: "221.40", updated_at: "2026-07-20T11:15:00+04:00" },
    ],
};

beforeEach(() => {
    assertUrlAllowedByRobots.mockReset().mockResolvedValue(undefined);
});

describe("terms gate (BR-06)", () => {
    it.each(["pending", "rejected"] as const)(
        "issues zero requests when the terms decision is %s",
        async decision => {
            const connector = new ShopifyPlatformConnector(config({ termsDecision: decision }));
            const calls = stubPages(connector, [{ body: shopifyPage([SHOPIFY_PRODUCT]) }]);

            await expect(connector.fetch()).rejects.toBeInstanceOf(TermsNotApprovedError);

            expect(calls).toHaveLength(0);
            // The robots gate is downstream of the terms gate — an undecided
            // source must not even be probed.
            expect(assertUrlAllowedByRobots).not.toHaveBeenCalled();
        }
    );

    it("treats an absent decision as pending, never as approved", () => {
        const connector = createPlatformConnector({
            id: 7,
            name: "Legacy row predating the column",
            url: "https://shop.example/",
            platform: "shopify",
            scrapeMethod: "json_api",
            termsDecision: null,
        });
        expect(connector).not.toBeNull();
        expect(connector!.termsDecision).toBe("pending");
    });
});

describe("robots gate (ADR-0010)", () => {
    it("asserts robots for every page, not only the first", async () => {
        const connector = new ShopifyPlatformConnector(
            config({ pageBudget: 3, itemBudget: 10_000 })
        );
        const full = Array.from({ length: 250 }, (_, i) => ({
            ...SHOPIFY_PRODUCT,
            id: 1000 + i,
            variants: [{ id: 1000 + i, sku: `SKU-${i}`, price: "50.00" }],
        }));
        stubPages(connector, [
            { body: shopifyPage(full) },
            { body: shopifyPage(full.map(p => ({ ...p, id: p.id + 10_000 }))) },
            { body: shopifyPage([]) },
        ]);

        await connector.fetch();

        expect(assertUrlAllowedByRobots.mock.calls.length).toBeGreaterThanOrEqual(3);
        const probed = assertUrlAllowedByRobots.mock.calls.map(c => c[0] as string);
        expect(probed[0]).toContain("page=1");
        expect(probed[1]).toContain("page=2");
        expect(probed[2]).toContain("page=3");
    });

    it("stops the whole run when a later page is disallowed", async () => {
        const connector = new ShopifyPlatformConnector(
            config({ pageBudget: 3, itemBudget: 10_000 })
        );
        const full = Array.from({ length: 250 }, (_, i) => ({
            ...SHOPIFY_PRODUCT,
            id: 2000 + i,
            variants: [{ id: 2000 + i, sku: `S-${i}`, price: "50.00" }],
        }));
        const calls = stubPages(connector, [
            { body: shopifyPage(full) },
            { body: shopifyPage(full) },
        ]);
        assertUrlAllowedByRobots
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(
                new RobotsPolicyError("ROBOTS_DENIED", "https://shop.example/", "disallowed")
            );

        await expect(connector.fetch()).rejects.toBeInstanceOf(RobotsPolicyError);
        expect(calls).toHaveLength(1);
    });
});

describe("ShopifyPlatformConnector", () => {
    it("reads price, identity, category and observation date from published fields", async () => {
        const connector = new ShopifyPlatformConnector(config());
        stubPages(connector, [{ body: shopifyPage([SHOPIFY_PRODUCT]) }]);

        const raw = await connector.fetch();
        const evidence = await connector.extract(raw);
        expect(evidence).toHaveLength(1);

        const normalized = await connector.normalize(evidence[0]);
        expect(normalized.value).toBe(39);
        expect(normalized.valueMax).toBe(221.4);
        expect(normalized.platformProductKey).toBe("AQ-SUB-075030");
        expect(normalized.priceClass).toBe("retail_listed");
        // Dimensions in the title are not a basis.
        expect(normalized.priceBasis).toBe("unknown");
        expect(normalized.unit).toBe("unit");
        expect(evidence[0].category).toBe("walls");
    });

    it("drops products with no positive price rather than recording zero", async () => {
        const connector = new ShopifyPlatformConnector(config());
        stubPages(connector, [
            {
                body: shopifyPage([
                    { ...SHOPIFY_PRODUCT, variants: [{ id: 5, sku: "Z", price: "0.00" }] },
                    { ...SHOPIFY_PRODUCT, id: 6, variants: [{ id: 6, sku: "Y", price: null }] },
                ]),
            },
        ]);

        const raw = await connector.fetch();
        expect(await connector.extract(raw)).toHaveLength(0);
    });

    it("preserves a collection path from the registry URL", async () => {
        const connector = new ShopifyPlatformConnector(config());
        const calls = stubPages(connector, [{ body: shopifyPage([]) }]);
        await connector.fetch();
        expect(calls[0]).toContain("/collections/floor-tiles/products.json");
    });

    it("throws rather than guessing when the endpoint returns HTML", async () => {
        const connector = new ShopifyPlatformConnector(config());
        stubPages(connector, [{ body: "<!doctype html><html>404</html>" }]);
        await expect(connector.fetch()).rejects.toThrow(/non-JSON/);
    });
});

describe("WooCommercePlatformConnector", () => {
    const WOO_PRODUCT = {
        id: 59683,
        name: "Jotun Jotafloor Topcoat 3.6L",
        sku: "JOT-JF-TC-36",
        permalink: "https://hardware.example/product/jotafloor-topcoat/",
        short_description: "<p>Two component epoxy topcoat</p>",
        prices: {
            price: "40000",
            regular_price: "40000",
            currency_code: "AED",
            currency_minor_unit: 2,
        },
        categories: [{ name: "Paints" }, { name: "Painting &amp; Decorating" }],
    };

    function wooConfig() {
        return config({
            platform: "woocommerce",
            sourceUrl: "https://hardware.example/",
        });
    }

    it("decodes minor units using the scale the payload published", async () => {
        const connector = new WooCommercePlatformConnector(wooConfig());
        stubPages(connector, [
            { body: JSON.stringify([WOO_PRODUCT]), headers: { "x-wp-total": "5234", "x-wp-totalpages": "53" } },
        ]);

        const raw = await connector.fetch();
        const evidence = await connector.extract(raw);
        const normalized = await connector.normalize(evidence[0]);

        // 40000 minor units at scale 2 is AED 400.00 — not 40,000.
        expect(normalized.value).toBe(400);
        expect(normalized.priceBasis).toBe("per_litre");
        expect(normalized.packQuantity).toBe(3.6);
        expect(evidence[0].category).toBe("walls");
    });

    it("skips a product whose currency is not AED", async () => {
        const connector = new WooCommercePlatformConnector(wooConfig());
        stubPages(connector, [
            {
                body: JSON.stringify([
                    { ...WOO_PRODUCT, prices: { ...WOO_PRODUCT.prices, currency_code: "GBP" } },
                ]),
            },
        ]);
        const raw = await connector.fetch();
        expect(await connector.extract(raw)).toHaveLength(0);
    });

    it("skips a product whose minor unit is missing rather than assuming 2", async () => {
        const connector = new WooCommercePlatformConnector(wooConfig());
        stubPages(connector, [
            {
                body: JSON.stringify([
                    { ...WOO_PRODUCT, prices: { price: "40000", currency_code: "AED" } },
                ]),
            },
        ]);
        const raw = await connector.fetch();
        expect(await connector.extract(raw)).toHaveLength(0);
    });

    it("paginates against x-wp-totalpages", async () => {
        const connector = new WooCommercePlatformConnector(wooConfig());
        const calls = stubPages(connector, [
            { body: JSON.stringify([WOO_PRODUCT]), headers: { "x-wp-totalpages": "2" } },
            {
                body: JSON.stringify([{ ...WOO_PRODUCT, id: 2, sku: "SECOND" }]),
                headers: { "x-wp-totalpages": "2" },
            },
        ]);

        const raw = await connector.fetch();
        expect(calls).toHaveLength(2);
        expect(await connector.extract(raw)).toHaveLength(2);
    });

    it("reports the source's own total and flags a truncated read", async () => {
        const connector = new WooCommercePlatformConnector(
            config({ platform: "woocommerce", sourceUrl: "https://hardware.example/", pageBudget: 1 })
        );
        stubPages(connector, [
            { body: JSON.stringify([WOO_PRODUCT]), headers: { "x-wp-total": "5234", "x-wp-totalpages": "53" } },
        ]);

        await connector.fetch();
        const outcome = connector.getLastOutcome();
        expect(outcome?.reportedTotal).toBe(5234);
        expect(outcome?.truncated).toBe(true);
    });
});

describe("decodeMinorUnitPrice", () => {
    it("refuses values it cannot decode with certainty", () => {
        expect(decodeMinorUnitPrice("40000", 2)).toBe(400);
        expect(decodeMinorUnitPrice("40000", 0)).toBe(40000);
        expect(decodeMinorUnitPrice("40000", null)).toBeNull();
        expect(decodeMinorUnitPrice("40000", 2.5)).toBeNull();
        expect(decodeMinorUnitPrice("40000", 99)).toBeNull();
        expect(decodeMinorUnitPrice("0", 2)).toBeNull();
        expect(decodeMinorUnitPrice("", 2)).toBeNull();
        expect(decodeMinorUnitPrice(null, 2)).toBeNull();
    });
});

describe("MagentoPlatformConnector", () => {
    // Markup shape copied from onlineshop.rakceramics.com/ae_en/tiles.html.
    const MAGENTO_PAGE = `
    <h1>Tiles</h1>
    <div class="product-item-info">
      <a class="product-name product-item-link" href="https://shop.example/creative-concrete.html"> Creative Concrete P </a>
      <div class="short-desc prodmaterial">Concrete Gres Porcelain Tile</div>
      <div class="price-box price-final_price" data-role="priceBox" data-product-id="31929">
        <span class="price-label">As low as</span>
        <span id="product-price-31929" data-price-amount="103.950001" data-price-type="finalPrice" class="price-wrapper"><span class="price">103.95</span></span>
      </div>
      <form data-role="tocart-form" data-product-sku="A06GCTVP-WHE.A6X0R" method="post"></form>
    </div>`;

    function magentoConfig() {
        return config({
            platform: "magento",
            sourceUrl: "https://shop.example/ae_en/tiles.html",
        });
    }

    it("pairs the price attribute with the SKU and title on the same card", async () => {
        const connector = new MagentoPlatformConnector(magentoConfig());
        stubPages(connector, [{ body: MAGENTO_PAGE }]);

        const raw = await connector.fetch();
        const evidence = await connector.extract(raw);
        expect(evidence).toHaveLength(1);

        const normalized = await connector.normalize(evidence[0]);
        // Magento's float artefact is rounded to real money, not carried through.
        expect(normalized.value).toBe(103.95);
        expect(normalized.platformProductKey).toBe("A06GCTVP-WHE.A6X0R");
        expect(normalized.metric).toBe("Creative Concrete P");
        expect(evidence[0].category).toBe("floors");
    });

    it("records that an 'As low as' figure is a range floor", async () => {
        const connector = new MagentoPlatformConnector(magentoConfig());
        stubPages(connector, [{ body: MAGENTO_PAGE }]);
        const raw = await connector.fetch();
        const evidence = await connector.extract(raw);
        expect(evidence[0].rawText).toContain("As low as");
    });

    it("ignores a struck-through regular price shown beside a discount", async () => {
        const page = MAGENTO_PAGE.replace('data-price-type="finalPrice"', 'data-price-type="oldPrice"');
        const connector = new MagentoPlatformConnector(magentoConfig());
        stubPages(connector, [{ body: page }]);
        const raw = await connector.fetch();
        expect(await connector.extract(raw)).toHaveLength(0);
    });
});

describe("mapPlatformCategory", () => {
    it.each([
        [["Floor Tiles"], "floors"],
        [["Paints", "Painting & Decorating"], "walls"],
        [["Plumbing & Sanitary"], "sanitary"],
        [["Lights & Switches"], "lighting"],
        [["Sheets & Boards"], "joinery"],
        [["Fasteners"], "hardware"],
        [["Gypsum Board"], "ceilings"],
        [["Kitchen Cabinets"], "kitchen"],
        [["Tableware"], "ffe"],
    ])("maps %j to %s", (path, expected) => {
        expect(mapPlatformCategory(path)).toBe(expected);
    });

    it("falls back to other rather than forcing an unrecognised taxonomy", () => {
        expect(mapPlatformCategory(["Car Care", "Automotive"])).toBe("other");
        expect(mapPlatformCategory([])).toBe("other");
    });
});

describe("createPlatformConnector", () => {
    it("requires BOTH json_api and a supported platform", () => {
        expect(isPlatformSource({ id: 1, name: "n", url: "https://a.example/", scrapeMethod: "json_api", platform: "shopify" })).toBe(true);
        // One field alone must never silently change how a source is read.
        expect(isPlatformSource({ id: 1, name: "n", url: "https://a.example/", scrapeMethod: "html_llm", platform: "shopify" })).toBe(false);
        expect(isPlatformSource({ id: 1, name: "n", url: "https://a.example/", scrapeMethod: "json_api", platform: "none" })).toBe(false);
        expect(isPlatformSource({ id: 1, name: "n", url: "https://a.example/", scrapeMethod: "json_api", platform: null })).toBe(false);
    });

    it("returns null for a non-platform row so callers fall through unchanged", () => {
        expect(
            createPlatformConnector({ id: 1, name: "n", url: "https://a.example/", scrapeMethod: "html_llm" })
        ).toBeNull();
    });

    it("carries the registry row id onto the connector for evidence linkage", () => {
        const connector = createPlatformConnector({
            id: 42,
            name: "Tile King",
            url: "https://shop.example/collections/floor-tiles",
            scrapeMethod: "json_api",
            platform: "shopify",
            termsDecision: "approved",
            priceClass: "retail_listed",
        });
        expect(connector?.sourceRegistryId).toBe(42);
    });
});
