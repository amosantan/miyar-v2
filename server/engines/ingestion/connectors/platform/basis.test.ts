/**
 * EV-01b — Price-basis parser coverage.
 *
 * The central property under test is that `unknown` stays `unknown`. A tile
 * listing carrying only dimensions does not state what its price is per, and
 * inventing one would corrupt every benchmark computed from it.
 */
import { describe, expect, it } from "vitest";
import { basisToUnit, parsePriceBasis, PRICE_BASIS_POLICY_VERSION } from "./basis";

describe("parsePriceBasis", () => {
    it.each([
        // Real Tile King titles observed live on 2026-07-23. Dimensions alone
        // are NOT a basis — these must stay unknown.
        ["Acquarella Acqua Subway Tile, Matt, 7.5x30 cm, 8 mm", "unknown"],
        ["Marmol Perla Porcelain, Polished, 60x120 cm, 9 mm", "unknown"],
        ["Engineered Oak 14mm Natural", "unknown"],
        // Explicit rates.
        ["Porcelain Floor Tile — AED 90 per sqm", "per_sqm"],
        ["Travertine Slab, price per m2", "per_sqm"],
        ["Skirting Board Oak, per linear metre", "per_lm"],
        ["Cornice Moulding AED 45 / lm", "per_lm"],
        // Packs. Real Hardware Stop / Amazon.ae style titles.
        ["Gypsum Ceiling Tile 600x600x7mm (Pack of 8 Pieces)", "per_pack"],
        ["RACO Decorative Gypsum False Ceiling Tile, Pack of 8 Pcs", "per_pack"],
        ["Ceramic Wall Tile Box of 12", "per_pack"],
        // Volumes.
        ["Specialist Crafts Premium Readymixed Paints - 500ml", "per_litre"],
        ["Jotun Fenomastic Mighty Walls 3.6L", "per_litre"],
        ["National Paints Ambiance 18 Litres", "per_litre"],
        // Explicit unit rates.
        ["Basin Mixer, price per piece", "per_piece"],
        ["Cabinet Handle — each", "per_piece"],
    ])("resolves %j to %s", (title, expected) => {
        expect(parsePriceBasis(title).basis).toBe(expected);
    });

    it("reports the pack quantity it actually read", () => {
        const result = parsePriceBasis("Gypsum Ceiling Tile 600x600x7mm (Pack of 8 Pieces)");
        expect(result.basis).toBe("per_pack");
        expect(result.packQuantity).toBe(8);
        expect(result.evidence).toContain("Pack of 8");
    });

    it("converts millilitres to litres rather than recording a raw 500", () => {
        const result = parsePriceBasis("Readymixed Paint 500ml");
        expect(result.basis).toBe("per_litre");
        expect(result.packQuantity).toBe(0.5);
    });

    it("prefers an explicit area rate over a pack count in the same title", () => {
        // "AED 90 per sqm (box of 6)" is a per-square-metre price. Reading the
        // pack count here would divide a rate by a quantity.
        const result = parsePriceBasis("Porcelain Tile AED 90 per sqm (box of 6)");
        expect(result.basis).toBe("per_sqm");
    });

    it("returns unknown for empty, null, and whitespace input", () => {
        for (const input of ["", "   ", null, undefined]) {
            const result = parsePriceBasis(input);
            expect(result.basis).toBe("unknown");
            expect(result.packQuantity).toBeNull();
            expect(result.evidence).toBeNull();
        }
    });

    it("sees through the HTML entities storefront JSON carries", () => {
        expect(parsePriceBasis("Tile&nbsp;Pack&nbsp;of&nbsp;4").basis).toBe("per_pack");
    });

    it("refuses a zero or negative pack count rather than recording it", () => {
        expect(parsePriceBasis("Tile Pack of 0").basis).toBe("unknown");
    });

    it("stamps the policy version on every verdict", () => {
        expect(parsePriceBasis("anything").policyVersion).toBe(PRICE_BASIS_POLICY_VERSION);
        expect(parsePriceBasis("Pack of 3").policyVersion).toBe(PRICE_BASIS_POLICY_VERSION);
    });
});

describe("basisToUnit", () => {
    it("maps each basis to the evidence unit string", () => {
        expect(basisToUnit("per_sqm")).toBe("sqm");
        expect(basisToUnit("per_lm")).toBe("lm");
        expect(basisToUnit("per_litre")).toBe("L");
        expect(basisToUnit("per_pack")).toBe("pack");
        expect(basisToUnit("per_piece")).toBe("piece");
    });

    it("does not disguise an unknown basis as a real unit", () => {
        expect(basisToUnit("unknown")).toBe("unit");
    });
});
