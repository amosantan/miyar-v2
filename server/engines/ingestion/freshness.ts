/**
 * MIYAR V2-09 — Evidence Freshness Module
 *
 * Computes freshness status for evidence records based on capture date.
 * Used for:
 *   - UI badge coloring (green/amber/red)
 *   - Weight multiplier in proposal generation
 *
 * Freshness tiers:
 *   - FRESH:  ≤ 3 months old  → weight 1.00 (green badge)
 *   - AGING:  3-12 months old → weight 0.75 (amber badge)
 *   - STALE:  > 12 months old → weight 0.50 (red badge)
 */

// ─── Named Constants ─────────────────────────────────────────────

/** Maximum age in days for "fresh" status */
export const FRESHNESS_FRESH_DAYS = 90;

/** Maximum age in days for "aging" status (beyond this = stale) */
export const FRESHNESS_AGING_DAYS = 365;

/** Weight multiplier for fresh evidence (≤ 3 months) */
export const FRESHNESS_WEIGHT_FRESH = 1.0;

/** Weight multiplier for aging evidence (3-12 months) */
export const FRESHNESS_WEIGHT_AGING = 0.75;

/** Weight multiplier for stale evidence (> 12 months) */
export const FRESHNESS_WEIGHT_STALE = 0.50;

// ─── Types ───────────────────────────────────────────────────────

export type FreshnessStatus = "fresh" | "aging" | "stale";

export interface FreshnessInfo {
  status: FreshnessStatus;
  weight: number;
  ageDays: number;
  badgeColor: "green" | "amber" | "red";
}

// ─── Computation ─────────────────────────────────────────────────

/**
 * Compute freshness status for a given capture date.
 *
 * @param captureDate - The date the evidence was captured
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns FreshnessInfo with status, weight, age, and badge color
 */
export function computeFreshness(
  captureDate: Date | string,
  referenceDate?: Date
): FreshnessInfo {
  const capture = captureDate instanceof Date ? captureDate : new Date(captureDate);
  const ref = referenceDate ?? new Date();
  const ageDays = Math.max(0, Math.floor((ref.getTime() - capture.getTime()) / (24 * 60 * 60 * 1000)));

  if (ageDays <= FRESHNESS_FRESH_DAYS) {
    return {
      status: "fresh",
      weight: FRESHNESS_WEIGHT_FRESH,
      ageDays,
      badgeColor: "green",
    };
  }

  if (ageDays <= FRESHNESS_AGING_DAYS) {
    return {
      status: "aging",
      weight: FRESHNESS_WEIGHT_AGING,
      ageDays,
      badgeColor: "amber",
    };
  }

  return {
    status: "stale",
    weight: FRESHNESS_WEIGHT_STALE,
    ageDays,
    badgeColor: "red",
  };
}

/**
 * Get the freshness weight multiplier for a given capture date.
 * Convenience function for use in proposal generation.
 */
export function getFreshnessWeight(captureDate: Date | string, referenceDate?: Date): number {
  return computeFreshness(captureDate, referenceDate).weight;
}
