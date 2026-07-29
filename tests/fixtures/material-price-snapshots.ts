import {
  MATERIAL_RESOLUTION_POLICY_VERSION,
  type GovernedMaterialPriceSnapshot,
} from "../../shared/material-calculations";

export function governedMaterialLibrarySnapshot(input: {
  legacyId: number;
  priceMin: number;
  priceMax: number;
  sourceLadderRung?: "assumption" | "market_observation";
}): GovernedMaterialPriceSnapshot {
  const sourceLadderRung = input.sourceLadderRung ?? "assumption";
  const priceMid = (input.priceMin + input.priceMax) / 2;
  return {
    state: "resolved",
    policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
    reference: { source: "material_library", legacyId: input.legacyId },
    productId: input.legacyId * 10,
    specificationId: input.legacyId * 100,
    benchmarkProposalId: input.legacyId * 1000,
    benchmarkVersionId: null,
    resolverAsOf: "2026-07-29T00:00:00.000Z",
    requestedGeography: "uae",
    resolvedGeography: "uae",
    usedUaeFallback: false,
    requestedPriceScope: "supply_only",
    resolvedPriceScope: "legacy_unknown",
    currency: "AED",
    unitBasis: "per_sqm",
    priceMin: input.priceMin.toFixed(2),
    priceMid: priceMid.toFixed(2),
    priceMax: input.priceMax.toFixed(2),
    weightedMean: priceMid.toFixed(2),
    provenance: {
      sourceLadderRung,
      sourceLabel: sourceLadderRung === "assumption"
        ? "Legacy scope-unknown assumption"
        : "Governed market observation",
      provenancePolicyVersion: "test-provenance-v1",
      benchmarkVersion: "test-v1",
      compatibilityFallback: sourceLadderRung === "assumption",
    },
  };
}
