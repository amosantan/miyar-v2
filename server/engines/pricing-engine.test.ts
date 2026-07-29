/**
 * ADR-0009 coverage for the pricing engine: deterministic unit-collision
 * resolution in getBrowseOnlyCategoryEstimates and tier→finish delegation to the
 * versioned tier policy in syncBrowseOnlyCatalogEstimates.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  listBenchmarkProposals: vi.fn(),
  getAllMaterials: vi.fn(),
  updateMaterial: vi.fn(async () => undefined),
}));

import * as db from "../db";
import { getBrowseOnlyCategoryEstimates, syncBrowseOnlyCatalogEstimates } from "./pricing-engine";

function proposal(benchmarkKey: string, weightedMean: number) {
  return {
    benchmarkKey,
    proposedP25: String(weightedMean - 20),
    proposedP50: String(weightedMean),
    proposedP75: String(weightedMean + 20),
    weightedMean: String(weightedMean),
  };
}

beforeEach(() => {
  vi.mocked(db.listBenchmarkProposals).mockReset();
  vi.mocked(db.getAllMaterials).mockReset();
  vi.mocked(db.updateMaterial).mockClear();
});

describe("getBrowseOnlyCategoryEstimates", () => {
  it("filters to the requested finish level", async () => {
    vi.mocked(db.listBenchmarkProposals).mockResolvedValue([
      proposal("floors:premium:sqm", 300),
      proposal("floors:standard:sqm", 100),
    ] as never);

    const pricing = await getBrowseOnlyCategoryEstimates("premium");

    expect(Object.keys(pricing)).toEqual(["floors"]);
    expect(pricing.floors.weightedMean).toBe(300);
  });

  it("resolves unit collisions deterministically (sqm > sqft > lexicographic)", async () => {
    const rows = [
      proposal("floors:premium:lot", 999),
      proposal("floors:premium:sqft", 200),
      proposal("floors:premium:sqm", 100),
    ];
    for (const order of [rows, [...rows].reverse()]) {
      vi.mocked(db.listBenchmarkProposals).mockResolvedValue(order as never);
      const pricing = await getBrowseOnlyCategoryEstimates("premium");
      expect(pricing.floors.unit).toBe("sqm");
      expect(pricing.floors.weightedMean).toBe(100);
    }
  });

  it("prefers sqft over other non-sqm units regardless of order", async () => {
    vi.mocked(db.listBenchmarkProposals).mockResolvedValue([
      proposal("walls:luxury:nr", 900),
      proposal("walls:luxury:sqft", 400),
    ] as never);

    const pricing = await getBrowseOnlyCategoryEstimates("luxury");
    expect(pricing.walls.unit).toBe("sqft");
  });
});

describe("syncBrowseOnlyCatalogEstimates", () => {
  it("maps catalog tiers through the versioned tier policy", async () => {
    vi.mocked(db.listBenchmarkProposals).mockResolvedValue([
      proposal("floors:basic:sqm", 60),
    ] as never);
    vi.mocked(db.getAllMaterials).mockResolvedValue([
      {
        id: 11,
        category: "tile",
        tier: "economy", // → finish "basic" via catalogTierToFinish
        typicalCostLow: "0.00",
        typicalCostHigh: "0.00",
      },
    ] as never);

    const result = await syncBrowseOnlyCatalogEstimates();

    expect(result.matchedCount).toBe(1);
    expect(db.updateMaterial).toHaveBeenCalledWith(11, {
      typicalCostLow: "40.00",
      typicalCostHigh: "80.00",
    });
  });

  it("skips materials with no matching benchmark prefix", async () => {
    vi.mocked(db.listBenchmarkProposals).mockResolvedValue([
      proposal("floors:ultra_luxury:sqm", 900),
    ] as never);
    vi.mocked(db.getAllMaterials).mockResolvedValue([
      { id: 12, category: "tile", tier: "economy", typicalCostLow: null, typicalCostHigh: null },
    ] as never);

    const result = await syncBrowseOnlyCatalogEstimates();

    expect(result.matchedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(db.updateMaterial).not.toHaveBeenCalled();
  });
});
