/**
 * Deterministic material tier and finish-level policy.
 *
 * This module is deliberately pure: it must not read the wall clock, database,
 * environment, or provider output. It is the single authority for
 *   1. mapping observed prices to materials-catalog tiers,
 *   2. mapping catalog tiers to evidence finish levels,
 *   3. classifying an evidence record's finish level from its price and unit,
 *   4. mapping a project's market tier (`mkt01Tier`) to a benchmark finish level,
 *   5. selecting which material_library tiers a project tier may draw from.
 *
 * The v1 values below are copied UNCHANGED from the previously ungoverned
 * in-line ladders and maps (`evidence-to-materials.ts` detectTier,
 * `pricing-engine.ts` TIER_TO_FINISH, `design-briefs.ts` tierToFinish, and the
 * material-quantity-engine tier filter). Consolidating them here changes no
 * number. Changing any threshold or mapping VALUE is a numerical-policy change
 * under `AGENTS.md` and requires cost-consultant approval plus a new policy
 * version (see ADR-0009).
 */

export const MATERIAL_TIER_POLICY_VERSION = "material-tier-policy-v1" as const;

/** materials_catalog tier enum. */
export type CatalogTier = "economy" | "mid" | "premium" | "luxury" | "ultra_luxury";

/** evidence_records / benchmark finish-level vocabulary. */
export type FinishLevel = "basic" | "standard" | "premium" | "luxury" | "ultra_luxury";

/** material_library tier enum. */
export type MaterialLibraryTier = "affordable" | "mid" | "premium" | "ultra";

// ─── 1. Price → catalog tier (v1 AED ladders, verbatim) ─────────────────────

/** Units priced per area (or per litre for paints) under the v1 ladder. */
const PER_AREA_UNITS: ReadonlySet<string> = new Set(["sqm", "m²", "sqft", "L"]);

/**
 * Classify a price observation into a materials-catalog tier.
 *
 * v1 thresholds (AED), verbatim from the previously ungoverned detectTier():
 *   per-area (sqm | m² | sqft | L): <40 economy, <150 mid, <400 premium,
 *   <800 luxury, else ultra_luxury.
 *   per-unit (everything else):     <300 economy, <1500 mid, <5000 premium,
 *   <15000 luxury, else ultra_luxury.
 * The `priceMax || priceMin || 0` precedence is part of the v1 contract.
 */
export function classifyCatalogTier(
  priceMin: number | null,
  priceMax: number | null,
  unit: string,
): CatalogTier {
  const price = priceMax || priceMin || 0;

  if (PER_AREA_UNITS.has(unit)) {
    if (price < 40) return "economy";
    if (price < 150) return "mid";
    if (price < 400) return "premium";
    if (price < 800) return "luxury";
    return "ultra_luxury";
  }

  if (price < 300) return "economy";
  if (price < 1500) return "mid";
  if (price < 5000) return "premium";
  if (price < 15000) return "luxury";
  return "ultra_luxury";
}

// ─── 2. Catalog tier → finish level (v1 map, verbatim) ──────────────────────

const CATALOG_TIER_TO_FINISH: Readonly<Record<CatalogTier, FinishLevel>> = {
  economy: "basic",
  mid: "standard",
  premium: "premium",
  luxury: "luxury",
  ultra_luxury: "ultra_luxury",
};

/**
 * Map a materials-catalog tier to an evidence finish level. Unknown inputs
 * resolve to "standard", preserving the pre-policy call-site behavior
 * (`TIER_TO_FINISH[tier] || "standard"`).
 */
export function catalogTierToFinish(tier: string): FinishLevel {
  return CATALOG_TIER_TO_FINISH[tier as CatalogTier] ?? "standard";
}

// ─── 3. Price → finish level ────────────────────────────────────────────────

/**
 * Deterministically classify an evidence observation's finish level from its
 * price and unit. This is the composition of the two v1 tables above and is
 * the only permitted authority for `evidence_records.finishLevel`; model
 * output may be retained as metadata but never keys a benchmark.
 */
export function classifyFinishLevel(
  priceMin: number | null,
  priceMax: number | null,
  unit: string,
): FinishLevel {
  return catalogTierToFinish(classifyCatalogTier(priceMin, priceMax, unit));
}

// ─── 4. Project market tier → finish level (v1 map, verbatim) ───────────────

const MKT01_TIER_TO_FINISH: Readonly<Record<string, FinishLevel>> = {
  Mid: "standard",
  "Upper-mid": "premium",
  Luxury: "luxury",
  "Ultra-luxury": "ultra_luxury",
};

/**
 * Map a project `mkt01Tier` value to the benchmark finish level it prices
 * against. Unknown or missing inputs resolve to "standard", preserving the
 * pre-policy call-site behavior (`tierToFinish[tier] || "standard"`).
 */
export function mkt01TierToFinish(mkt01Tier: string | null | undefined): FinishLevel {
  return (mkt01Tier ? MKT01_TIER_TO_FINISH[mkt01Tier] : undefined) ?? "standard";
}

// ─── 5. Project market tier → material_library tiers ────────────────────────

const LIBRARY_TIERS: ReadonlySet<string> = new Set([
  "affordable",
  "mid",
  "premium",
  "ultra",
]);

/**
 * v1 adjacency, verbatim from the legacy material-quantity-engine helper:
 * ultra→premium, premium→mid, mid→affordable, anything else→mid.
 */
function legacyAdjacentTier(tier: string): MaterialLibraryTier {
  if (tier === "ultra") return "premium";
  if (tier === "premium") return "mid";
  if (tier === "mid") return "affordable";
  return "mid";
}

/**
 * Which material_library tiers a project market tier may draw from.
 *
 * v1 is a behavior-preserving reproduction of the legacy filter
 * (`m.tier === mkt01Tier.toLowerCase() || m.tier === adjacentTier(...)`).
 * Because `mkt01Tier` values ("Mid", "Upper-mid", "Luxury", "Ultra-luxury")
 * lowercase into strings that — except for "mid" — match no library tier,
 * the legacy behavior is: Mid → [mid, affordable]; every other tier → [mid].
 * That defect is preserved deliberately in v1.
 *
 * PENDING cost-consultant approval (ADR-0009): the proposed v2 mapping that
 * would let higher-tier projects see higher-tier library materials is
 *   Mid → [mid, affordable]; Upper-mid → [premium, mid];
 *   Luxury → [ultra, premium]; Ultra-luxury → [ultra, premium].
 * Do not enable it without a recorded approval and a new policy version.
 */
export function libraryTiersForMkt01Tier(
  mkt01Tier: string | null | undefined,
): MaterialLibraryTier[] {
  const normalized = (mkt01Tier ?? "").toLowerCase() || "mid";
  const tiers: MaterialLibraryTier[] = [];
  if (LIBRARY_TIERS.has(normalized)) {
    tiers.push(normalized as MaterialLibraryTier);
  }
  const adjacent = legacyAdjacentTier(normalized);
  if (!tiers.includes(adjacent)) {
    tiers.push(adjacent);
  }
  return tiers;
}
