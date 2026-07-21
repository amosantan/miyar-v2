export type RegulatoryVersionState = {
  versionKey: string;
  contentFingerprint: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  status: "candidate" | "asserted" | "stale" | "withdrawn" | "archived";
  requiredAssertionsCurrent: boolean;
  latestCaptureResult?: "captured" | "unchanged" | "changed_candidate" | "disappeared_candidate" | "denied" | "failed";
};

export type RegulatoryTemporalRelation = {
  sourceVersionFingerprint: string;
  targetVersionFingerprint: string;
  relationType: "amends" | "supersedes" | "suspends" | "revokes" | "clarifies";
  clauseScope: readonly string[];
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type RegulatoryResolution =
  | { usable: true; mode: "current" | "historical_replay"; version: RegulatoryVersionState }
  | { usable: false; mode: "current" | "historical_replay"; reason: "unknown_version" | "not_asserted" | "not_effective" | "stale_source" | "amended" | "suspended" | "revoked" | "superseded" };

const instant = (value: string | undefined, fallback: number) => value ? Date.parse(value) : fallback;
const inInterval = (at: number, from?: string, to?: string) => at >= instant(from, Number.NEGATIVE_INFINITY) && at < instant(to, Number.POSITIVE_INFINITY);
const scopeMatches = (scope: readonly string[], locator: string) => scope.includes("*") || scope.some(item => locator === item || locator.startsWith(`${item}.`));
const assertedAt = (version: RegulatoryVersionState, at: number) => version.status === "asserted" && version.requiredAssertionsCurrent && inInterval(at, version.effectiveFrom, version.effectiveTo) && version.latestCaptureResult !== "changed_candidate" && version.latestCaptureResult !== "disappeared_candidate";

/**
 * Resolves an exact content reference. It never treats a missing page or changed
 * bytes as repeal. Current use fails closed; historical replay preserves the
 * exact old reference but cannot authorize a new issue.
 */
export function resolveRegulatoryReference(input: {
  contentFingerprint: string;
  clauseLocator: string;
  basisAt: string;
  mode: "current" | "historical_replay";
  versions: readonly RegulatoryVersionState[];
  relations: readonly RegulatoryTemporalRelation[];
}): RegulatoryResolution {
  const version = input.versions.find(item => item.contentFingerprint === input.contentFingerprint);
  if (!version) return { usable: false, mode: input.mode, reason: "unknown_version" };
  if (input.mode === "historical_replay") return { usable: true, mode: input.mode, version };

  const at = Date.parse(input.basisAt);
  if (!Number.isFinite(at) || !inInterval(at, version.effectiveFrom, version.effectiveTo)) return { usable: false, mode: input.mode, reason: "not_effective" };
  if (version.status !== "asserted" || !version.requiredAssertionsCurrent) return { usable: false, mode: input.mode, reason: "not_asserted" };
  if (version.latestCaptureResult === "changed_candidate" || version.latestCaptureResult === "disappeared_candidate") {
    return { usable: false, mode: input.mode, reason: "stale_source" };
  }

  const blocking = input.relations
    .filter(relation => relation.targetVersionFingerprint === version.contentFingerprint)
    .filter(relation => scopeMatches(relation.clauseScope, input.clauseLocator))
    .filter(relation => inInterval(at, relation.effectiveFrom, relation.effectiveTo))
    .filter(relation => input.versions.some(candidate => candidate.contentFingerprint === relation.sourceVersionFingerprint && assertedAt(candidate, at)));
  if (blocking.some(relation => relation.relationType === "revokes")) return { usable: false, mode: input.mode, reason: "revoked" };
  if (blocking.some(relation => relation.relationType === "supersedes")) return { usable: false, mode: input.mode, reason: "superseded" };
  if (blocking.some(relation => relation.relationType === "suspends")) return { usable: false, mode: input.mode, reason: "suspended" };
  if (blocking.some(relation => relation.relationType === "amends")) return { usable: false, mode: input.mode, reason: "amended" };
  return { usable: true, mode: input.mode, version };
}
