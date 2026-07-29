import { createHash } from "node:crypto";

import type {
  MaterialCategory,
  MaterialFinishLevel,
  PriceUnitBasis,
  SourceLadderRung,
  UaePriceGeography,
} from "../../../shared/material-pricing";

export const EV02_SPEC_POLICY_VERSION = "ev02-spec-key-v1" as const;
export const EV02_BACKFILL_VERSION = "ev02-backfill-v1" as const;

const LIBRARY_CATEGORY_MAP: Readonly<Record<string, MaterialCategory>> = {
  flooring: "floors",
  wall_paint: "walls",
  wall_tile: "walls",
  ceiling: "ceilings",
  joinery: "joinery",
  sanitaryware: "sanitary",
  fittings: "hardware",
  lighting: "lighting",
  hardware: "hardware",
  specialty: "other",
};

const CATALOG_CATEGORY_MAP: Readonly<Record<string, MaterialCategory>> = {
  tile: "floors",
  stone: "floors",
  wood: "floors",
  paint: "walls",
  wallpaper: "walls",
  lighting: "lighting",
  furniture: "ffe",
  fixture: "sanitary",
  accessory: "hardware",
  metal: "other",
  fabric: "ffe",
  glass: "other",
  other: "other",
};

const LIBRARY_TIER_MAP: Readonly<Record<string, MaterialFinishLevel>> = {
  affordable: "basic",
  mid: "standard",
  premium: "premium",
  ultra: "ultra_luxury",
};

const CATALOG_TIER_MAP: Readonly<Record<string, MaterialFinishLevel>> = {
  economy: "basic",
  mid: "standard",
  premium: "premium",
  luxury: "luxury",
  ultra_luxury: "ultra_luxury",
};

const LADDER_PRIORITY: Readonly<Record<SourceLadderRung, number>> = {
  supplier_quote: 0,
  official_statistic: 1,
  consultancy_benchmark: 2,
  market_observation: 3,
  retail_sanity: 4,
  assumption: 5,
};

export function materialLibraryCategoryToCanonical(
  category: string
): MaterialCategory {
  return LIBRARY_CATEGORY_MAP[category] ?? "other";
}

export function materialCatalogCategoryToCanonical(
  category: string
): MaterialCategory {
  return CATALOG_CATEGORY_MAP[category] ?? "other";
}

export function materialLibraryTierToFinish(
  tier: string
): MaterialFinishLevel | null {
  return LIBRARY_TIER_MAP[tier] ?? null;
}

export function materialCatalogTierToFinish(
  tier: string
): MaterialFinishLevel | null {
  return CATALOG_TIER_MAP[tier] ?? null;
}

export function normalizeUnitBasis(
  unit: string | null | undefined
): PriceUnitBasis | null {
  const normalized = (unit ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (
    ["sqm", "m²", "m2", "aed/sqm", "per_sqm", "sq_m"].includes(normalized)
  ) {
    return "per_sqm";
  }
  if (["lm", "linear_metre", "linear_meter", "per_lm"].includes(normalized)) {
    return "per_lm";
  }
  if (["l", "litre", "liter", "per_litre"].includes(normalized)) {
    return "per_litre";
  }
  if (["piece", "pc", "unit", "set", "point", "per_piece"].includes(normalized)) {
    return "per_piece";
  }
  if (["pack", "box", "per_pack"].includes(normalized)) {
    return "per_pack";
  }
  return null;
}

export function normalizeGeography(
  geography: string | null | undefined
): UaePriceGeography {
  const normalized = (geography ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Readonly<Record<string, UaePriceGeography>> = {
    dubai: "dubai",
    abu_dhabi: "abu_dhabi",
    abudhabi: "abu_dhabi",
    sharjah: "sharjah",
    ajman: "ajman",
    umm_al_quwain: "umm_al_quwain",
    umm_al_quwain_uaq: "umm_al_quwain",
    ras_al_khaimah: "ras_al_khaimah",
    rak: "ras_al_khaimah",
    fujairah: "fujairah",
    uae: "uae",
    united_arab_emirates: "uae",
  };
  return aliases[normalized] ?? "uae";
}

export function buildSpecificationKey(input: {
  category: MaterialCategory;
  finishLevel: MaterialFinishLevel;
  unitBasis: PriceUnitBasis;
  geography: UaePriceGeography;
}): string {
  return [
    input.category,
    input.finishLevel,
    input.unitBasis,
    input.geography,
  ].join(":");
}

export function buildProductIdentityKey(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function sourceLadderPriority(rung: SourceLadderRung): number {
  return LADDER_PRIORITY[rung];
}

function toMinorUnits(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`Expected a non-negative decimal with at most 2 places: ${value}`);
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function exactDecimalMidpoint(min: string, max: string): string {
  const a = toMinorUnits(min);
  const b = toMinorUnits(max);
  if (a > b) throw new Error("Minimum price cannot exceed maximum price");
  // Positive AED values: round a half-fils midpoint up to the stored 2dp
  // contract instead of delegating rounding to JS floating point or MySQL.
  const midpoint = (a + b + BigInt(1)) / BigInt(2);
  const hundred = BigInt(100);
  return `${midpoint / hundred}.${String(midpoint % hundred).padStart(2, "0")}`;
}
