import type {
  PriceScope,
  PriceUnitBasis,
  SourceLadderRung,
  UaePriceGeography,
} from "./material-pricing";

export const MATERIAL_RESOLUTION_POLICY_VERSION =
  "ev03-material-resolution-v1" as const;
export const PAINT_QUANTITY_POLICY_VERSION =
  "ev03-paint-quantity-v1" as const;

export type MaterialResolutionSource =
  | "material_library"
  | "materials_catalog";

export type MaterialIdentityReference = {
  source: MaterialResolutionSource;
  legacyId: number;
};

export type MaterialPriceInsufficiencyReason =
  | "identity_not_found"
  | "foreign_private_product"
  | "unknown_category"
  | "unknown_finish_level"
  | "unknown_unit_basis"
  | "specification_not_found"
  | "no_governed_value"
  | "ambiguous_governed_value"
  | "only_retail_sanity"
  | "legacy_scope_unknown"
  | "incompatible_quantity_unit"
  | "quantity_required"
  | "paint_coverage_invalid";

/**
 * Public/report-safe provenance. Restricted commercial and tenant fields are
 * unrepresentable here instead of relying only on a runtime redactor.
 */
export type SafeMaterialPriceProvenance = {
  sourceLadderRung: Exclude<SourceLadderRung, "retail_sanity">;
  sourceLabel: string;
  provenancePolicyVersion: string;
  benchmarkVersion: string;
  compatibilityFallback: boolean;
  organizationId?: never;
  supplierQuoteId?: never;
  quoteRef?: never;
  contactRef?: never;
};

export type GovernedPaintCoverageSnapshot = {
  profileId: number;
  policyVersion: string;
  coverageM2PerLitrePerCoat: string;
  coatCount: number;
  wastePct: string;
  effectiveAt: string;
  sourceDocumentDigest: string;
  packSizesLitres: readonly string[];
};

export type GovernedMaterialPriceSnapshot = {
  state: "resolved";
  policyVersion: typeof MATERIAL_RESOLUTION_POLICY_VERSION;
  reference: MaterialIdentityReference;
  productId: number;
  specificationId: number;
  benchmarkProposalId: number;
  benchmarkVersionId: number | null;
  resolverAsOf: string;
  requestedGeography: UaePriceGeography;
  resolvedGeography: UaePriceGeography;
  usedUaeFallback: boolean;
  requestedPriceScope: PriceScope;
  resolvedPriceScope: PriceScope | "legacy_unknown";
  currency: "AED";
  unitBasis: PriceUnitBasis;
  priceMin: string;
  priceMid: string;
  priceMax: string;
  weightedMean: string;
  provenance: SafeMaterialPriceProvenance;
  paintCoverageState?: "fallback" | "approved" | "invalid";
  paintCoverageProfile?: GovernedPaintCoverageSnapshot;
};

export type InsufficientMaterialPriceSnapshot = {
  state: "insufficient";
  policyVersion: typeof MATERIAL_RESOLUTION_POLICY_VERSION;
  reference: MaterialIdentityReference;
  resolverAsOf: string;
  requestedGeography: UaePriceGeography;
  requestedPriceScope: PriceScope;
  reason: MaterialPriceInsufficiencyReason;
  productId?: number;
  specificationId?: number;
};

export type MaterialPriceSnapshot =
  | GovernedMaterialPriceSnapshot
  | InsufficientMaterialPriceSnapshot;

export type MaterialAggregateState = "complete" | "partial" | "insufficient";

export type MaterialAggregateCoverage = {
  state: MaterialAggregateState;
  totalItemCount: number;
  pricedItemCount: number;
  insufficientItemCount: number;
  reasons: Partial<Record<MaterialPriceInsufficiencyReason, number>>;
};

export function buildMaterialAggregateCoverage(
  snapshots: readonly MaterialPriceSnapshot[]
): MaterialAggregateCoverage {
  const reasons: MaterialAggregateCoverage["reasons"] = {};
  let pricedItemCount = 0;
  for (const snapshot of snapshots) {
    if (snapshot.state === "resolved") {
      pricedItemCount += 1;
      continue;
    }
    reasons[snapshot.reason] = (reasons[snapshot.reason] ?? 0) + 1;
  }
  const insufficientItemCount = snapshots.length - pricedItemCount;
  return {
    state:
      snapshots.length === 0 || pricedItemCount === 0
        ? "insufficient"
        : pricedItemCount === snapshots.length
          ? "complete"
          : "partial",
    totalItemCount: snapshots.length,
    pricedItemCount,
    insufficientItemCount,
    reasons,
  };
}
