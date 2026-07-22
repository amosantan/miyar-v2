import { describe, expect, it } from "vitest";
import {
  MATERIAL_TIER_POLICY_VERSION,
  catalogTierToFinish,
  classifyCatalogTier,
  classifyFinishLevel,
  libraryTiersForMkt01Tier,
  mkt01TierToFinish,
} from "./tier-policy";

describe("tier-policy v1", () => {
  it("exposes the v1 policy version", () => {
    expect(MATERIAL_TIER_POLICY_VERSION).toBe("material-tier-policy-v1");
  });

  describe("classifyCatalogTier per-area ladder (sqm/m²/sqft/L)", () => {
    const cases: Array<[number, string]> = [
      [0, "economy"],
      [39.99, "economy"],
      [40, "mid"],
      [149.99, "mid"],
      [150, "premium"],
      [399.99, "premium"],
      [400, "luxury"],
      [799.99, "luxury"],
      [800, "ultra_luxury"],
      [12_000, "ultra_luxury"],
    ];
    for (const [price, tier] of cases) {
      it(`classifies AED ${price}/sqm as ${tier}`, () => {
        expect(classifyCatalogTier(null, price, "sqm")).toBe(tier);
      });
    }

    it("treats m², sqft, and L as per-area units", () => {
      expect(classifyCatalogTier(null, 100, "m²")).toBe("mid");
      expect(classifyCatalogTier(null, 100, "sqft")).toBe("mid");
      expect(classifyCatalogTier(null, 100, "L")).toBe("mid");
    });
  });

  describe("classifyCatalogTier per-unit ladder", () => {
    const cases: Array<[number, string]> = [
      [0, "economy"],
      [299.99, "economy"],
      [300, "mid"],
      [1_499.99, "mid"],
      [1_500, "premium"],
      [4_999.99, "premium"],
      [5_000, "luxury"],
      [14_999.99, "luxury"],
      [15_000, "ultra_luxury"],
    ];
    for (const [price, tier] of cases) {
      it(`classifies AED ${price}/unit as ${tier}`, () => {
        expect(classifyCatalogTier(null, price, "unit")).toBe(tier);
      });
    }

    it("uses the per-unit ladder for unrecognized units", () => {
      expect(classifyCatalogTier(null, 100, "lot")).toBe("economy");
      expect(classifyCatalogTier(null, 2_000, "nr")).toBe("premium");
    });
  });

  describe("classifyCatalogTier price precedence (v1 contract)", () => {
    it("prefers priceMax over priceMin", () => {
      expect(classifyCatalogTier(10, 500, "sqm")).toBe("luxury");
    });
    it("falls back to priceMin when priceMax is null or zero", () => {
      expect(classifyCatalogTier(500, null, "sqm")).toBe("luxury");
      expect(classifyCatalogTier(500, 0, "sqm")).toBe("luxury");
    });
    it("classifies missing prices as economy (price 0)", () => {
      expect(classifyCatalogTier(null, null, "sqm")).toBe("economy");
      expect(classifyCatalogTier(0, 0, "unit")).toBe("economy");
    });
  });

  describe("catalogTierToFinish", () => {
    it("matches the v1 table exactly", () => {
      expect(catalogTierToFinish("economy")).toBe("basic");
      expect(catalogTierToFinish("mid")).toBe("standard");
      expect(catalogTierToFinish("premium")).toBe("premium");
      expect(catalogTierToFinish("luxury")).toBe("luxury");
      expect(catalogTierToFinish("ultra_luxury")).toBe("ultra_luxury");
    });
    it("defaults unknown tiers to standard (legacy call-site behavior)", () => {
      expect(catalogTierToFinish("")).toBe("standard");
      expect(catalogTierToFinish("bespoke")).toBe("standard");
    });
  });

  describe("classifyFinishLevel", () => {
    it("composes the ladder and the finish map", () => {
      expect(classifyFinishLevel(null, 30, "sqm")).toBe("basic");
      expect(classifyFinishLevel(null, 100, "sqm")).toBe("standard");
      expect(classifyFinishLevel(null, 200, "sqm")).toBe("premium");
      expect(classifyFinishLevel(null, 500, "sqm")).toBe("luxury");
      expect(classifyFinishLevel(null, 900, "sqm")).toBe("ultra_luxury");
      expect(classifyFinishLevel(null, 2_000, "unit")).toBe("premium");
    });
  });

  describe("mkt01TierToFinish", () => {
    it("matches the v1 table exactly", () => {
      expect(mkt01TierToFinish("Mid")).toBe("standard");
      expect(mkt01TierToFinish("Upper-mid")).toBe("premium");
      expect(mkt01TierToFinish("Luxury")).toBe("luxury");
      expect(mkt01TierToFinish("Ultra-luxury")).toBe("ultra_luxury");
    });
    it("defaults unknown or missing tiers to standard", () => {
      expect(mkt01TierToFinish(null)).toBe("standard");
      expect(mkt01TierToFinish(undefined)).toBe("standard");
      expect(mkt01TierToFinish("")).toBe("standard");
      expect(mkt01TierToFinish("mid")).toBe("standard");
    });
  });

  describe("libraryTiersForMkt01Tier (v1 behavior-preserving)", () => {
    it("reproduces the legacy filter for every project tier", () => {
      expect(libraryTiersForMkt01Tier("Mid")).toEqual(["mid", "affordable"]);
      expect(libraryTiersForMkt01Tier("Upper-mid")).toEqual(["mid"]);
      expect(libraryTiersForMkt01Tier("Luxury")).toEqual(["mid"]);
      expect(libraryTiersForMkt01Tier("Ultra-luxury")).toEqual(["mid"]);
    });
    it("defaults missing tiers to the legacy mid behavior", () => {
      expect(libraryTiersForMkt01Tier(null)).toEqual(["mid", "affordable"]);
      expect(libraryTiersForMkt01Tier(undefined)).toEqual(["mid", "affordable"]);
      expect(libraryTiersForMkt01Tier("")).toEqual(["mid", "affordable"]);
    });
    it("reproduces the legacy adjacency for literal library tiers", () => {
      expect(libraryTiersForMkt01Tier("ultra")).toEqual(["ultra", "premium"]);
      expect(libraryTiersForMkt01Tier("premium")).toEqual(["premium", "mid"]);
      expect(libraryTiersForMkt01Tier("affordable")).toEqual(["affordable", "mid"]);
    });
  });
});
