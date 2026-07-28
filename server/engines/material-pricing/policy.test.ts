import { describe, expect, it } from "vitest";

import {
  buildSpecificationKey,
  buildProductIdentityKey,
  exactDecimalMidpoint,
  materialLibraryCategoryToCanonical,
  materialLibraryTierToFinish,
  normalizeGeography,
  normalizeUnitBasis,
  sourceLadderPriority,
} from "./policy";

describe("EV-02 deterministic material pricing policy", () => {
  it("builds stable specification keys and preserves the approved tier mapping", () => {
    expect(buildProductIdentityKey(["global", "brand", "A", "code", "1"]))
      .toBe(buildProductIdentityKey(["global", "brand", "A", "code", "1"]));
    expect(buildProductIdentityKey(["org", 2, "brand", "A", "code", "1"]))
      .not.toBe(buildProductIdentityKey(["org", 3, "brand", "A", "code", "1"]));
    expect(
      buildSpecificationKey({
        category: "floors",
        finishLevel: "standard",
        unitBasis: "per_sqm",
        geography: "dubai",
      })
    ).toBe("floors:standard:per_sqm:dubai");
    expect(["affordable", "mid", "premium", "ultra"].map(materialLibraryTierToFinish))
      .toEqual(["basic", "standard", "premium", "ultra_luxury"]);
    expect(materialLibraryCategoryToCanonical("sanitaryware")).toBe("sanitary");
  });

  it("normalizes only recognized unit and UAE geography aliases", () => {
    expect(normalizeUnitBasis("AED/sqm")).toBe("per_sqm");
    expect(normalizeUnitBasis("box")).toBe("per_pack");
    expect(normalizeUnitBasis("mystery")).toBeNull();
    expect(normalizeGeography("Abu Dhabi")).toBe("abu_dhabi");
    expect(normalizeGeography("not recorded")).toBe("uae");
  });

  it("computes exact two-decimal midpoints without floating-point drift", () => {
    expect(exactDecimalMidpoint("10.00", "10.01")).toBe("10.01");
    expect(exactDecimalMidpoint("99999999.98", "99999999.99")).toBe("99999999.99");
    expect(() => exactDecimalMidpoint("2.00", "1.00")).toThrow();
  });

  it("keeps the approved source ladder order explicit", () => {
    expect(
      [
        "supplier_quote",
        "official_statistic",
        "consultancy_benchmark",
        "market_observation",
        "assumption",
      ].map(rung => sourceLadderPriority(rung as Parameters<typeof sourceLadderPriority>[0]))
    ).toEqual([0, 1, 2, 3, 5]);
  });
});
