import type {
  SpaceEfficiencyEvidence,
  SpaceEfficiencyEvidenceState,
} from "../../shared/miyar-types";

export const NEUTRAL_SPACE_EFFICIENCY_LABEL =
  "Neutral fallback — no rooms measured";

/**
 * Resolve only immutable snapshot evidence. Absence is deliberately reported
 * as legacy_unknown; callers must never infer provenance from mutable project
 * state.
 */
export function resolveSpaceEfficiencyEvidence(
  snapshot: Record<string, unknown> | null | undefined,
): SpaceEfficiencyEvidenceState {
  const candidate = snapshot?.spaceEfficiencyEvidence;
  if (!candidate || typeof candidate !== "object") {
    return { status: "legacy_unknown" };
  }

  const evidence = candidate as Partial<SpaceEfficiencyEvidence> & Record<string, unknown>;
  if (
    evidence.status === "neutral_fallback" &&
    evidence.reason === "no_rooms_detected" &&
    evidence.roomCount === 0 &&
    evidence.benchmarkBasis === "not_applied" &&
    evidence.transactionCount === 0
  ) {
    return evidence as SpaceEfficiencyEvidence;
  }

  if (
    evidence.status === "measured" &&
    typeof evidence.roomCount === "number" &&
    Number.isInteger(evidence.roomCount) &&
    evidence.roomCount > 0 &&
    (evidence.benchmarkBasis === "dld_area" || evidence.benchmarkBasis === "miyar_uae") &&
    typeof evidence.transactionCount === "number" &&
    Number.isInteger(evidence.transactionCount) &&
    evidence.transactionCount >= 0 &&
    (evidence.benchmarkBasis !== "dld_area" || evidence.transactionCount > 0)
  ) {
    return evidence as SpaceEfficiencyEvidence;
  }

  return { status: "legacy_unknown" };
}

export function isMeasuredSpaceEfficiencyEvidence(
  evidence: SpaceEfficiencyEvidenceState | null | undefined,
): evidence is Extract<SpaceEfficiencyEvidence, { status: "measured" }> {
  return evidence?.status === "measured";
}

export function spaceBenchmarkLabel(evidence: SpaceEfficiencyEvidenceState): string {
  if (evidence.status === "neutral_fallback") {
    return NEUTRAL_SPACE_EFFICIENCY_LABEL;
  }
  if (evidence.status === "legacy_unknown") {
    return "Legacy score — measurement provenance unavailable";
  }
  return evidence.benchmarkBasis === "dld_area" && evidence.transactionCount > 0
    ? `DLD area benchmark · ${evidence.transactionCount} transactions`
    : "MIYAR UAE benchmark";
}
