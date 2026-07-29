import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAINT_COVERAGE_PROFILE,
  resolveQuantityForUnitBasis,
  roundUpToPaintPacks,
  validateApprovedPaintCoverageProfile,
} from "./quantity-policy";

const AS_OF = new Date("2026-07-29T12:00:00.000Z");

describe("EV-03 deterministic material quantity policy", () => {
  it("uses the approved paint fallback without inventing a gallon", () => {
    const result = resolveQuantityForUnitBasis({
      unitBasis: "per_litre",
      surfaceAreaM2: 100,
      asOf: AS_OF,
    });
    expect(result).toMatchObject({
      state: "resolved",
      quantity: 22,
      quantityUnit: "litre",
    });
  });

  it("prefers a valid approved coverage profile", () => {
    const result = resolveQuantityForUnitBasis({
      unitBasis: "per_litre",
      surfaceAreaM2: 120,
      asOf: AS_OF,
      paintCoverageProfile: {
        ...DEFAULT_PAINT_COVERAGE_PROFILE,
        coverageM2PerLitrePerCoat: "12.000",
        wastePct: "5.000",
        policyVersion: "approved-tds-v1",
        sourceDocumentDigest: "sha256:technical-data-sheet",
      },
    });
    expect(result).toMatchObject({
      state: "resolved",
      quantity: 21,
      policyVersion: "approved-tds-v1",
    });
  });

  it("rejects unapproved clocks and extreme coverage", () => {
    expect(
      validateApprovedPaintCoverageProfile(
        {
          ...DEFAULT_PAINT_COVERAGE_PROFILE,
          coverageM2PerLitrePerCoat: "1000",
        },
        AS_OF
      )
    ).toBe(false);
    expect(
      validateApprovedPaintCoverageProfile(
        {
          ...DEFAULT_PAINT_COVERAGE_PROFILE,
          effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        AS_OF
      )
    ).toBe(false);
  });

  it("fails closed for incompatible and missing quantities", () => {
    expect(
      resolveQuantityForUnitBasis({
        unitBasis: "per_lm",
        explicitQuantity: 10,
        explicitQuantityUnit: "sqm",
        asOf: AS_OF,
      })
    ).toEqual({
      state: "insufficient",
      reason: "incompatible_quantity_unit",
    });
    expect(
      resolveQuantityForUnitBasis({
        unitBasis: "per_piece",
        asOf: AS_OF,
      })
    ).toEqual({ state: "insufficient", reason: "incompatible_quantity_unit" });
    for (const [unitBasis, explicitQuantityUnit] of [
      ["per_piece", "piece"],
      ["per_pack", "pack"],
    ] as const) {
      expect(
        resolveQuantityForUnitBasis({
          unitBasis,
          explicitQuantity: 1.5,
          explicitQuantityUnit,
          asOf: AS_OF,
        })
      ).toEqual({ state: "insufficient", reason: "quantity_required" });
    }
  });

  it("rounds only to actual supplier pack sizes", () => {
    expect(roundUpToPaintPacks(22, ["18", "4", "1"])).toEqual({
      purchasedLitres: 22,
      packCounts: { "18": 1, "4": 1 },
    });
    expect(roundUpToPaintPacks(22.1, ["18", "4", "1"])).toEqual({
      purchasedLitres: 23,
      packCounts: { "18": 1, "4": 1, "1": 1 },
    });
  });

  it("rejects huge, sub-millilitre, and resource-exhausting pack inputs", () => {
    for (const packSizesLitres of [["1000000000"], ["0.0001"]]) {
      expect(
        validateApprovedPaintCoverageProfile(
          { ...DEFAULT_PAINT_COVERAGE_PROFILE, packSizesLitres },
          AS_OF
        )
      ).toBe(false);
      expect(roundUpToPaintPacks(10, packSizesLitres)).toBeNull();
    }
    expect(roundUpToPaintPacks(600, ["18", "4", "1"])).toMatchObject({
      purchasedLitres: 600,
    });
  });
});
