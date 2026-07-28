export const MATERIAL_CATEGORIES = [
  "floors",
  "walls",
  "ceilings",
  "joinery",
  "lighting",
  "sanitary",
  "kitchen",
  "hardware",
  "ffe",
  "other",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_FINISH_LEVELS = [
  "basic",
  "standard",
  "premium",
  "luxury",
  "ultra_luxury",
] as const;
export type MaterialFinishLevel = (typeof MATERIAL_FINISH_LEVELS)[number];

export const PRICE_UNIT_BASES = [
  "per_piece",
  "per_pack",
  "per_sqm",
  "per_lm",
  "per_litre",
] as const;
export type PriceUnitBasis = (typeof PRICE_UNIT_BASES)[number];

export const UAE_PRICE_GEOGRAPHIES = [
  "dubai",
  "abu_dhabi",
  "sharjah",
  "ajman",
  "umm_al_quwain",
  "ras_al_khaimah",
  "fujairah",
  "uae",
] as const;
export type UaePriceGeography = (typeof UAE_PRICE_GEOGRAPHIES)[number];

export type PriceScope = "supply_only" | "supply_and_install";
export type GovernedValueSourceKind = "observed" | "assumption";
export type SourceLadderRung =
  | "supplier_quote"
  | "official_statistic"
  | "consultancy_benchmark"
  | "market_observation"
  | "retail_sanity"
  | "assumption";

export type GovernedValueResolutionInput = {
  specId: number;
  productId?: number;
  organizationId?: number;
  priceScope: PriceScope;
  asOf: Date;
  allowLegacyUnknownScope?: boolean;
};

export type ResolvedGovernedMaterialValue = {
  status: "resolved";
  value: {
    benchmarkProposalId: number;
    benchmarkVersionId: number | null;
    benchmarkVersion: string;
    specificationId: number;
    productId: number | null;
    organizationId: number | null;
    p25: string;
    p50: string;
    p75: string;
    weightedMean: string;
    currency: "AED";
    unitBasis: PriceUnitBasis;
    geography: UaePriceGeography;
    priceScope: PriceScope | "legacy_unknown";
    sourceKind: GovernedValueSourceKind;
    sourceLadderRung: Exclude<SourceLadderRung, "retail_sanity">;
    sourceLabel: string | null;
    provenancePolicyVersion: string | null;
    isLegacyScopeFallback: boolean;
  };
  retailSanityBand?: {
    p25: string;
    p50: string;
    p75: string;
  };
};

export type GovernedMaterialValueInsufficiency = {
  status: "insufficient";
  reason:
    | "no_governed_value"
    | "ambiguous_governed_value"
    | "only_retail_sanity"
    | "legacy_scope_unknown";
  retailSanityBand?: {
    p25: string;
    p50: string;
    p75: string;
  };
};

export type GovernedMaterialValueResolution =
  | ResolvedGovernedMaterialValue
  | GovernedMaterialValueInsufficiency;
