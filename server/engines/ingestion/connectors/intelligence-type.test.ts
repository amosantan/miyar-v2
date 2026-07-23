/**
 * EV-01b — every static connector must declare what it publishes.
 *
 * The defect this covers: `HTMLSourceConnector.normalize()` never set
 * `intelligenceType`, and the orchestrator defaulted the missing value to
 * `material_price`. Bayut and PropertyFinder property listings, Emaar/DAMAC/
 * Aldar brochures, and CBRE/JLL/Knight Frank/Savills research were therefore
 * all labelled material prices and pooled into material-price benchmark
 * statistics.
 */
import { describe, expect, it } from "vitest";
import { ALL_CONNECTORS, intelligenceTypeForSourceFocus } from "./index";

describe("intelligenceTypeForSourceFocus", () => {
    it.each([
        ["material_cost", "material_price"],
        ["competitor_project", "competitor_positioning"],
        ["market_trend", "market_statistic"],
        ["property_price", "market_statistic"],
    ])("maps the %s source focus to %s", (focus, expected) => {
        expect(intelligenceTypeForSourceFocus(focus)).toBe(expected);
    });

    it("never turns an unrecognised focus into a material price", () => {
        // An unclassified source must not silently become a price authority.
        for (const focus of ["", "something_new", "unknown"]) {
            expect(intelligenceTypeForSourceFocus(focus)).not.toBe("material_price");
        }
    });
});

describe("static connector intelligence types", () => {
    /** The connectors whose numbers are genuinely material unit prices. */
    const MATERIAL_PRICE_SOURCES = new Set([
        "rak-ceramics-uae",
        "graniti-uae",
        "dragon-mart-dubai",
        "porcelanosa-uae",
        "hafele-uae",
        "dubai-pulse-materials",
        "scad-abu-dhabi",
        "scad-pdf-materials",
    ]);

    it("labels property listings and research as statistics, not material prices", () => {
        const misclassified: string[] = [];

        for (const [sourceId, factory] of Object.entries(ALL_CONNECTORS)) {
            const connector = factory() as { category?: string };
            if (typeof connector.category !== "string") continue;

            const resolved = intelligenceTypeForSourceFocus(connector.category);
            const shouldBeMaterialPrice = MATERIAL_PRICE_SOURCES.has(sourceId);

            if ((resolved === "material_price") !== shouldBeMaterialPrice) {
                misclassified.push(`${sourceId} → ${resolved}`);
            }
        }

        expect(misclassified).toEqual([]);
    });

    it("keeps Bayut and PropertyFinder out of the material-price population", () => {
        for (const sourceId of ["bayut-listings", "propertyfinder-listings"]) {
            const connector = ALL_CONNECTORS[sourceId]() as { category: string };
            expect(intelligenceTypeForSourceFocus(connector.category)).toBe("market_statistic");
        }
    });

    it("keeps developer brochures out of the material-price population", () => {
        for (const sourceId of [
            "emaar-properties",
            "damac-properties",
            "nakheel-properties",
            "aldar-properties",
        ]) {
            const connector = ALL_CONNECTORS[sourceId]() as { category: string };
            expect(intelligenceTypeForSourceFocus(connector.category)).toBe(
                "competitor_positioning"
            );
        }
    });
});
