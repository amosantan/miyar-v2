import { describe, expect, it } from "vitest";

import {
  MATERIAL_RESOLUTION_POLICY_VERSION,
  type GovernedMaterialPriceSnapshot,
} from "../../shared/material-calculations";
import { buildGovernedBoardSummary } from "./design-boards";

function snapshot(
  legacyId: number,
  overrides: Partial<GovernedMaterialPriceSnapshot> = {}
): GovernedMaterialPriceSnapshot {
  return {
    state: "resolved",
    policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
    reference: { source: "materials_catalog", legacyId },
    productId: legacyId * 10,
    specificationId: legacyId * 100,
    benchmarkProposalId: legacyId * 1000,
    benchmarkVersionId: null,
    resolverAsOf: "2026-07-29T12:00:00.000Z",
    requestedGeography: "dubai",
    resolvedGeography: "uae",
    usedUaeFallback: true,
    requestedPriceScope: "supply_only",
    resolvedPriceScope: "supply_only",
    currency: "AED",
    unitBasis: "per_sqm",
    priceMin: "100.00",
    priceMid: "120.00",
    priceMax: "140.00",
    weightedMean: "120.00",
    provenance: {
      sourceLadderRung: "market_observation",
      sourceLabel: "Governed market-observation benchmark",
      provenancePolicyVersion: "test-v1",
      benchmarkVersion: "test-v1",
      compatibilityFallback: false,
    },
    ...overrides,
  };
}

describe("governed material-board summary", () => {
  it("uses one supply-only resolver batch and returns complete nullable totals", () => {
    const result = buildGovernedBoardSummary({
      rows: [
        { id: 1, materialId: 11, quantity: "10", unitOfMeasure: "sqm" },
        { id: 2, materialId: 12, quantity: "2", unitOfMeasure: "piece" },
      ],
      snapshots: [
        snapshot(11),
        snapshot(12, {
          unitBasis: "per_piece",
          priceMin: "50.00",
          priceMid: "60.00",
          priceMax: "70.00",
        }),
      ],
    });

    expect(result.priceScope).toBe("supply_only");
    expect(result.coverage).toEqual({
      state: "complete",
      totalItemCount: 2,
      pricedItemCount: 2,
      insufficientItemCount: 0,
      reasons: {},
    });
    expect(result).toMatchObject({
      totalAedMin: 1100,
      totalAedMid: 1320,
      totalAedMax: 1540,
    });
    expect(result.lines[0].presentationProvenance).not.toHaveProperty(
      "organizationId"
    );
  });

  it("returns partial/null totals for incompatible or missing quantities", () => {
    const result = buildGovernedBoardSummary({
      rows: [
        { id: 1, materialId: 11, quantity: "10", unitOfMeasure: "sqm" },
        { id: 2, materialId: 12, quantity: null, unitOfMeasure: null },
      ],
      snapshots: [snapshot(11), snapshot(12)],
    });

    expect(result.coverage).toMatchObject({
      state: "partial",
      pricedItemCount: 1,
      insufficientItemCount: 1,
      reasons: { quantity_required: 1 },
    });
    expect(result.totalAedMin).toBeNull();
    expect(result.totalAedMid).toBeNull();
    expect(result.totalAedMax).toBeNull();
  });

  it("treats an empty board as insufficient instead of vacuously complete", () => {
    expect(
      buildGovernedBoardSummary({ rows: [], snapshots: [] }).coverage
    ).toEqual({
      state: "insufficient",
      totalItemCount: 0,
      pricedItemCount: 0,
      insufficientItemCount: 0,
      reasons: {},
    });
  });
});
