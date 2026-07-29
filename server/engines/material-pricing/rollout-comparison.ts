import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import type {
  MaterialIdentityReference,
  MaterialPriceSnapshot,
} from "../../../shared/material-calculations";
import type {
  PriceScope,
  UaePriceGeography,
} from "../../../shared/material-pricing";
import {
  evaluateDatabaseAccess,
  type DatabaseTarget,
} from "../../_core/database-safety";
import {
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_DATABASE_TARGET,
  EV03_PRODUCTION_TARGET,
  normalizeEv03ConnectionUrlForInspection,
} from "./ev03-identity-backfill";
import { exactDecimalMidpoint } from "./policy";

export const EV03_ROLLOUT_EVIDENCE_VERSION =
  "ev03-rollout-comparison-v2" as const;
export const EV03_ELIGIBILITY_QUERY_VERSION =
  "ev02-linked-legacy-assumptions-v1" as const;
export const EV03_MAX_ROLLOUT_EVIDENCE_COMPRESSED_BYTES = 1024 * 1024;
export const EV03_MAX_ROLLOUT_EVIDENCE_DECOMPRESSED_BYTES = 8 * 1024 * 1024;

export type MaterialPricingRolloutMode = "legacy" | "compare" | "governed";

export type Ev03RolloutComparisonExecutionTarget = {
  production: boolean;
  evidenceTarget: string;
  safetyDatabaseUrl: string;
  databaseApproval?: string;
};

export function assertEv03ComparisonConnectionTargetStable(input: {
  initialDatabaseUrl: string | undefined;
  currentDatabaseUrl: string | undefined;
}): string {
  const initialDatabaseUrl = normalizeEv03ConnectionUrlForInspection(
    input.initialDatabaseUrl
  );
  const currentDatabaseUrl = normalizeEv03ConnectionUrlForInspection(
    input.currentDatabaseUrl
  );
  if (
    !initialDatabaseUrl ||
    !currentDatabaseUrl ||
    currentDatabaseUrl !== initialDatabaseUrl
  ) {
    throw new Error("EV-03 comparison database target changed after bootstrap");
  }
  return currentDatabaseUrl;
}

export function resolveEv03RolloutComparisonExecutionTarget(input: {
  connectionTarget: DatabaseTarget;
  productionTarget?: string;
  expectedMigrationSha256?: string;
  providerAttestation?: string;
  environmentAttestation?: string;
  databaseApproval?: string;
}): Ev03RolloutComparisonExecutionTarget {
  const target = input.connectionTarget;
  if (!input.productionTarget) {
    if (
      target.class !== "safe-loopback" ||
      !target.canonical ||
      !target.database ||
      !/^(miyar_auth_test|miyar_test_)/.test(target.database)
    ) {
      throw new Error(
        "EV-03 rollout comparison accepts only a disposable loopback test database by default"
      );
    }
    return {
      production: false,
      evidenceTarget: target.canonical,
      safetyDatabaseUrl: `mysql://${target.canonical}`,
    };
  }
  if (input.productionTarget !== EV03_PRODUCTION_TARGET) {
    throw new Error(
      `Production EV-03 comparison target must be exactly ${EV03_PRODUCTION_TARGET}`
    );
  }
  if (input.expectedMigrationSha256 !== EV03_MIGRATION_SHA256) {
    throw new Error("Production EV-03 comparison migration digest mismatch");
  }
  if (
    !input.providerAttestation ||
    !/^[a-f0-9]{64}$/.test(input.providerAttestation) ||
    input.providerAttestation !== input.environmentAttestation
  ) {
    throw new Error(
      "Production EV-03 comparison must be launched by the governed PlanetScale wrapper"
    );
  }
  if (
    target.class !== "safe-loopback" ||
    target.database !== "miyar-v2" ||
    !target.canonical
  ) {
    throw new Error(
      "Production EV-03 comparison must use the wrapper-owned loopback PlanetScale proxy for miyar-v2"
    );
  }
  const safetyDatabaseUrl = `mysql://${EV03_PRODUCTION_DATABASE_TARGET}`;
  const decision = evaluateDatabaseAccess({
    operation: "migrate",
    databaseUrl: safetyDatabaseUrl,
    runtimeProfile: "local",
    nodeEnv: "production",
    approval: input.databaseApproval,
  });
  if (!decision.allowed || decision.reasonCode !== "REMOTE_APPROVAL_ALLOWED") {
    throw new Error(
      `Production EV-03 comparison database approval rejected: ${decision.reasonCode}`
    );
  }
  return {
    production: true,
    evidenceTarget: EV03_PRODUCTION_DATABASE_TARGET,
    safetyDatabaseUrl,
    databaseApproval: input.databaseApproval,
  };
}

export type LegacyPriceRange = {
  reference: MaterialIdentityReference;
  priceMin: string;
  priceMax: string;
};

export type MaterialPriceComparison = {
  reference: MaterialIdentityReference;
  state: "equal" | "different" | "insufficient";
  legacy: { min: string; mid: string; max: string };
  governed: {
    productId: number;
    specificationId: number;
    benchmarkProposalId: number;
    benchmarkVersionId: number | null;
    benchmarkVersion: string;
    resolvedPriceScope: PriceScope | "legacy_unknown";
    unitBasis: string;
    resolvedGeography: UaePriceGeography;
    resolverPolicyVersion: string;
    provenancePolicyVersion: string;
    min: string;
    mid: string;
    max: string;
  } | null;
  differences: Array<"min" | "mid" | "max">;
  insufficiencyReason?: string;
};

export type MaterialPricingComparisonEvidence = {
  version: typeof EV03_ROLLOUT_EVIDENCE_VERSION;
  eligibilityQueryVersion: typeof EV03_ELIGIBILITY_QUERY_VERSION;
  digestAlgorithm: "sha256";
  generatedAt: string;
  eligibleRowCount: number;
  comparisonRowCount: number;
  equalRowCount: number;
  differentRowCount: number;
  insufficientRowCount: number;
  eligibleSetDigest: string;
  comparisonsDigest: string;
  comparisons: MaterialPriceComparison[];
  evidenceDigest: string;
};

export type MaterialPricingRuntimeComparisonEvidence = {
  version: "ev03-runtime-comparison-v1";
  digestAlgorithm: "sha256";
  baselineEvidenceDigest: string;
  requestedPriceScope: PriceScope;
  requestedGeography: UaePriceGeography;
  resolverAsOf: string;
  comparisonRowCount: number;
  equalRowCount: number;
  differentRowCount: number;
  insufficientRowCount: number;
  comparisons: Array<{
    reference: MaterialIdentityReference;
    state: MaterialPriceComparison["state"];
    differences: MaterialPriceComparison["differences"];
    insufficiencyReason?: string;
  }>;
  comparisonDigest: string;
};

export type MaterialPricingRolloutGate =
  | { mode: "legacy" }
  | {
      mode: "compare";
      evidence: MaterialPricingComparisonEvidence;
    }
  | {
      mode: "governed";
      evidence: MaterialPricingComparisonEvidence;
      cutoverApproval: {
        reference: string;
        approvedEvidenceDigest: string;
      };
    };

function canonicalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Rollout evidence cannot contain non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  throw new Error(`Unsupported rollout evidence value: ${typeof value}`);
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function referenceKey(reference: MaterialIdentityReference): string {
  return `${reference.source}:${reference.legacyId}`;
}

function governedFingerprint(
  snapshot: Extract<MaterialPriceSnapshot, { state: "resolved" }>
): NonNullable<MaterialPriceComparison["governed"]> {
  return {
    productId: snapshot.productId,
    specificationId: snapshot.specificationId,
    benchmarkProposalId: snapshot.benchmarkProposalId,
    benchmarkVersionId: snapshot.benchmarkVersionId,
    benchmarkVersion: snapshot.provenance.benchmarkVersion,
    resolvedPriceScope: snapshot.resolvedPriceScope,
    unitBasis: snapshot.unitBasis,
    resolvedGeography: snapshot.resolvedGeography,
    resolverPolicyVersion: snapshot.policyVersion,
    provenancePolicyVersion: snapshot.provenance.provenancePolicyVersion,
    min: snapshot.priceMin,
    mid: snapshot.priceMid,
    max: snapshot.priceMax,
  };
}

function assertUniqueReferences(
  label: string,
  references: readonly MaterialIdentityReference[]
): void {
  const seen = new Set<string>();
  for (const reference of references) {
    if (!Number.isInteger(reference.legacyId) || reference.legacyId <= 0) {
      throw new Error(`${label} contains an invalid legacy identity`);
    }
    const key = referenceKey(reference);
    if (seen.has(key)) throw new Error(`${label} contains duplicate ${key}`);
    seen.add(key);
  }
}

/**
 * Produces comparison rows without carrying tenant IDs, quote references,
 * contacts, source labels, or other commercial metadata.
 */
export function compareLegacyAndGovernedMaterialPrices(input: {
  legacyRanges: readonly LegacyPriceRange[];
  snapshots: readonly MaterialPriceSnapshot[];
}): MaterialPriceComparison[] {
  assertUniqueReferences(
    "Eligible legacy set",
    input.legacyRanges.map(range => range.reference)
  );
  assertUniqueReferences(
    "Governed snapshot set",
    input.snapshots.map(snapshot => snapshot.reference)
  );
  const eligibleKeys = new Set(
    input.legacyRanges.map(range => referenceKey(range.reference))
  );
  const unexpectedSnapshot = input.snapshots.find(
    snapshot => !eligibleKeys.has(referenceKey(snapshot.reference))
  );
  if (unexpectedSnapshot) {
    throw new Error(
      `Governed snapshot set contains ineligible ${referenceKey(unexpectedSnapshot.reference)}`
    );
  }

  const snapshots = new Map(
    input.snapshots.map(snapshot => [
      referenceKey(snapshot.reference),
      snapshot,
    ])
  );
  return input.legacyRanges.map(legacy => {
    const expected = {
      min: legacy.priceMin,
      mid: exactDecimalMidpoint(legacy.priceMin, legacy.priceMax),
      max: legacy.priceMax,
    };
    const snapshot = snapshots.get(referenceKey(legacy.reference));
    if (!snapshot || snapshot.state === "insufficient") {
      return {
        reference: legacy.reference,
        state: "insufficient",
        legacy: expected,
        governed: null,
        differences: [],
        insufficiencyReason:
          snapshot?.state === "insufficient"
            ? snapshot.reason
            : "identity_not_found",
      };
    }
    const governed = governedFingerprint(snapshot);
    const differences: MaterialPriceComparison["differences"] = [];
    if (expected.min !== governed.min) differences.push("min");
    if (expected.mid !== governed.mid) differences.push("mid");
    if (expected.max !== governed.max) differences.push("max");
    return {
      reference: legacy.reference,
      state: differences.length === 0 ? "equal" : "different",
      legacy: expected,
      governed,
      differences,
    };
  });
}

const FORBIDDEN_EVIDENCE_KEYS =
  /^(organizationId|orgId|supplierQuoteId|quoteRef|contactRef|sourceLabel|supplierName|supplierContact|supplierUrl|provenance|presentationProvenance|internalProvenance|description)$/i;

function assertNoConfidentialFields(value: unknown, path = "evidence"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoConfidentialFields(item, `${path}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_EVIDENCE_KEYS.test(key)) {
      throw new Error(
        `Confidential field is forbidden in rollout evidence: ${path}.${key}`
      );
    }
    assertNoConfidentialFields(item, `${path}.${key}`);
  }
}

function evidenceUnsigned(
  evidence: Omit<MaterialPricingComparisonEvidence, "evidenceDigest">
) {
  return evidence;
}

export function buildMaterialPricingComparisonEvidence(input: {
  legacyRanges: readonly LegacyPriceRange[];
  snapshots: readonly MaterialPriceSnapshot[];
  generatedAt: Date;
}): MaterialPricingComparisonEvidence {
  if (!Number.isFinite(input.generatedAt.getTime())) {
    throw new Error("Rollout evidence requires a valid explicit clock");
  }
  const comparisons = compareLegacyAndGovernedMaterialPrices(input);
  const eligibleSet = input.legacyRanges
    .map(range => ({
      reference: range.reference,
      priceMin: range.priceMin,
      priceMax: range.priceMax,
    }))
    .sort((a, b) =>
      referenceKey(a.reference).localeCompare(referenceKey(b.reference))
    );
  const sortedComparisons = [...comparisons].sort((a, b) =>
    referenceKey(a.reference).localeCompare(referenceKey(b.reference))
  );
  assertNoConfidentialFields(sortedComparisons);
  const unsigned = evidenceUnsigned({
    version: EV03_ROLLOUT_EVIDENCE_VERSION,
    eligibilityQueryVersion: EV03_ELIGIBILITY_QUERY_VERSION,
    digestAlgorithm: "sha256",
    generatedAt: input.generatedAt.toISOString(),
    eligibleRowCount: eligibleSet.length,
    comparisonRowCount: sortedComparisons.length,
    equalRowCount: sortedComparisons.filter(row => row.state === "equal")
      .length,
    differentRowCount: sortedComparisons.filter(
      row => row.state === "different"
    ).length,
    insufficientRowCount: sortedComparisons.filter(
      row => row.state === "insufficient"
    ).length,
    eligibleSetDigest: sha256(eligibleSet),
    comparisonsDigest: sha256(sortedComparisons),
    comparisons: sortedComparisons,
  });
  return { ...unsigned, evidenceDigest: sha256(unsigned) };
}

export function assertMaterialPricingComparisonEvidence(
  evidence: MaterialPricingComparisonEvidence
): void {
  if (
    evidence.version !== EV03_ROLLOUT_EVIDENCE_VERSION ||
    evidence.eligibilityQueryVersion !== EV03_ELIGIBILITY_QUERY_VERSION ||
    evidence.digestAlgorithm !== "sha256"
  ) {
    throw new Error("Unsupported EV-03 rollout evidence contract");
  }
  if (
    !Number.isInteger(evidence.eligibleRowCount) ||
    evidence.eligibleRowCount <= 0 ||
    evidence.comparisonRowCount !== evidence.eligibleRowCount ||
    evidence.comparisons.length !== evidence.eligibleRowCount
  ) {
    throw new Error("Rollout evidence does not cover every eligible EV-02 row");
  }
  assertUniqueReferences(
    "Rollout comparisons",
    evidence.comparisons.map(row => row.reference)
  );
  assertNoConfidentialFields(evidence);
  const counts = {
    equal: evidence.comparisons.filter(row => row.state === "equal").length,
    different: evidence.comparisons.filter(row => row.state === "different")
      .length,
    insufficient: evidence.comparisons.filter(
      row => row.state === "insufficient"
    ).length,
  };
  if (
    evidence.equalRowCount !== counts.equal ||
    evidence.differentRowCount !== counts.different ||
    evidence.insufficientRowCount !== counts.insufficient ||
    counts.equal + counts.different + counts.insufficient !==
      evidence.eligibleRowCount
  ) {
    throw new Error("Rollout evidence summary counts diverge");
  }
  const eligibleSet = evidence.comparisons
    .map(comparison => ({
      reference: comparison.reference,
      priceMin: comparison.legacy.min,
      priceMax: comparison.legacy.max,
    }))
    .sort((a, b) =>
      referenceKey(a.reference).localeCompare(referenceKey(b.reference))
    );
  const sortedComparisons = [...evidence.comparisons].sort((a, b) =>
    referenceKey(a.reference).localeCompare(referenceKey(b.reference))
  );
  if (
    !/^[a-f0-9]{64}$/.test(evidence.eligibleSetDigest) ||
    evidence.eligibleSetDigest !== sha256(eligibleSet) ||
    !/^[a-f0-9]{64}$/.test(evidence.comparisonsDigest) ||
    evidence.comparisonsDigest !== sha256(sortedComparisons)
  ) {
    throw new Error("Rollout evidence content digest mismatch");
  }
  const { evidenceDigest, ...unsigned } = evidence;
  if (
    !/^[a-f0-9]{64}$/.test(evidenceDigest) ||
    evidenceDigest !== sha256(unsigned)
  ) {
    throw new Error("Rollout evidence SHA-256 mismatch");
  }
}

export function assertMaterialPricingCompletionSummaryBindsEvidence(
  summary: {
    target: string;
    eligibleRowCount: number;
    equalRowCount: number;
    differentRowCount: number;
    insufficientRowCount: number;
    evidenceDigest: string;
  },
  evidence: MaterialPricingComparisonEvidence
): void {
  assertMaterialPricingComparisonEvidence(evidence);
  if (
    summary.target !== EV03_PRODUCTION_DATABASE_TARGET ||
    summary.eligibleRowCount !== evidence.eligibleRowCount ||
    summary.equalRowCount !== evidence.equalRowCount ||
    summary.differentRowCount !== evidence.differentRowCount ||
    summary.insufficientRowCount !== evidence.insufficientRowCount ||
    summary.evidenceDigest !== evidence.evidenceDigest
  ) {
    throw new Error(
      "EV-03 completion summary does not bind the produced comparison evidence"
    );
  }
}

/**
 * Rebinds an approved comparison envelope to the current database population.
 * This prevents a once-valid approval from enabling compare/governed mode after
 * eligible EV-02 rows are added, removed, relinked, or repriced.
 */
export function assertMaterialPricingEvidenceMatchesLiveEligibleSet(
  evidence: MaterialPricingComparisonEvidence,
  liveRanges: readonly LegacyPriceRange[]
): void {
  assertMaterialPricingComparisonEvidence(evidence);
  assertUniqueReferences(
    "Live eligible legacy set",
    liveRanges.map(range => range.reference)
  );
  const liveEligibleSet = liveRanges
    .map(range => ({
      reference: range.reference,
      priceMin: range.priceMin,
      priceMax: range.priceMax,
    }))
    .sort((a, b) =>
      referenceKey(a.reference).localeCompare(referenceKey(b.reference))
    );
  if (
    liveEligibleSet.length !== evidence.eligibleRowCount ||
    sha256(liveEligibleSet) !== evidence.eligibleSetDigest
  ) {
    throw new Error(
      "EV-03 rollout evidence does not match the complete live eligible set"
    );
  }
}

/**
 * Prevents an approved governed cutover from serving a value whose safe
 * identity, policy, scope, geography, unit, version, or prices have drifted
 * since the evidence was approved.
 */
export function assertGovernedSnapshotsMatchApprovedEvidence(
  evidence: MaterialPricingComparisonEvidence,
  snapshots: readonly MaterialPriceSnapshot[]
): void {
  assertMaterialPricingComparisonEvidence(evidence);
  assertUniqueReferences(
    "Live governed snapshot set",
    snapshots.map(snapshot => snapshot.reference)
  );
  const approved = new Map(
    evidence.comparisons.map(comparison => [
      referenceKey(comparison.reference),
      comparison.governed,
    ])
  );
  for (const snapshot of snapshots) {
    const expected = approved.get(referenceKey(snapshot.reference));
    // Governed-only identities are outside the legacy cutover envelope.
    if (expected === undefined) continue;
    // Supply-and-install values have their own approved proposal contract and
    // were never part of the legacy supply-only equality envelope.
    if (
      snapshot.state === "resolved" &&
      snapshot.requestedPriceScope === "supply_and_install" &&
      snapshot.resolvedPriceScope === "supply_and_install"
    ) {
      continue;
    }
    if (
      expected === null ||
      snapshot.state !== "resolved" ||
      sha256(governedFingerprint(snapshot)) !== sha256(expected)
    ) {
      throw new Error(
        `EV-03 governed snapshot drifted from approved evidence for ${referenceKey(snapshot.reference)}`
      );
    }
  }
}

export function buildMaterialPricingRuntimeComparisonEvidence(input: {
  baselineEvidence: MaterialPricingComparisonEvidence;
  references: readonly MaterialIdentityReference[];
  governedSnapshots: readonly MaterialPriceSnapshot[];
  requestedPriceScope: PriceScope;
  requestedGeography: UaePriceGeography;
  resolverAsOf: Date;
}): MaterialPricingRuntimeComparisonEvidence {
  assertMaterialPricingComparisonEvidence(input.baselineEvidence);
  if (!Number.isFinite(input.resolverAsOf.getTime())) {
    throw new Error("Runtime comparison requires a valid explicit clock");
  }
  assertUniqueReferences("Runtime comparison request", input.references);
  const baselineByReference = new Map(
    input.baselineEvidence.comparisons.map(comparison => [
      referenceKey(comparison.reference),
      comparison,
    ])
  );
  // Only exact EV-02-eligible material_library identities have a legacy
  // baseline. Governed-only catalog references remain usable in compare mode
  // but are intentionally absent from the legacy equality observation.
  const legacyRanges = input.references.flatMap(reference => {
    const baseline = baselineByReference.get(referenceKey(reference));
    return baseline
      ? [
          {
            reference,
            priceMin: baseline.legacy.min,
            priceMax: baseline.legacy.max,
          },
        ]
      : [];
  });
  const legacyKeys = new Set(
    legacyRanges.map(range => referenceKey(range.reference))
  );
  const comparisons = compareLegacyAndGovernedMaterialPrices({
    legacyRanges,
    snapshots: input.governedSnapshots.filter(snapshot =>
      legacyKeys.has(referenceKey(snapshot.reference))
    ),
  }).map(comparison => ({
    reference: comparison.reference,
    state: comparison.state,
    differences: comparison.differences,
    ...(comparison.insufficiencyReason === undefined
      ? {}
      : { insufficiencyReason: comparison.insufficiencyReason }),
  }));
  const unsigned = {
    version: "ev03-runtime-comparison-v1" as const,
    digestAlgorithm: "sha256" as const,
    baselineEvidenceDigest: input.baselineEvidence.evidenceDigest,
    requestedPriceScope: input.requestedPriceScope,
    requestedGeography: input.requestedGeography,
    resolverAsOf: input.resolverAsOf.toISOString(),
    comparisonRowCount: comparisons.length,
    equalRowCount: comparisons.filter(row => row.state === "equal").length,
    differentRowCount: comparisons.filter(row => row.state === "different")
      .length,
    insufficientRowCount: comparisons.filter(
      row => row.state === "insufficient"
    ).length,
    comparisons,
  };
  assertNoConfidentialFields(unsigned);
  return { ...unsigned, comparisonDigest: sha256(unsigned) };
}

export function assertMaterialPricingRuntimeComparisonEvidence(
  evidence: MaterialPricingRuntimeComparisonEvidence
): void {
  if (
    evidence.version !== "ev03-runtime-comparison-v1" ||
    evidence.digestAlgorithm !== "sha256" ||
    !/^[a-f0-9]{64}$/.test(evidence.baselineEvidenceDigest) ||
    evidence.comparisonRowCount !== evidence.comparisons.length
  ) {
    throw new Error("Invalid EV-03 runtime comparison contract");
  }
  assertUniqueReferences(
    "Runtime comparisons",
    evidence.comparisons.map(comparison => comparison.reference)
  );
  assertNoConfidentialFields(evidence);
  const equal = evidence.comparisons.filter(
    row => row.state === "equal"
  ).length;
  const different = evidence.comparisons.filter(
    row => row.state === "different"
  ).length;
  const insufficient = evidence.comparisons.filter(
    row => row.state === "insufficient"
  ).length;
  if (
    evidence.equalRowCount !== equal ||
    evidence.differentRowCount !== different ||
    evidence.insufficientRowCount !== insufficient ||
    equal + different + insufficient !== evidence.comparisonRowCount
  ) {
    throw new Error("Runtime comparison summary counts diverge");
  }
  const { comparisonDigest, ...unsigned } = evidence;
  if (
    !/^[a-f0-9]{64}$/.test(comparisonDigest) ||
    comparisonDigest !== sha256(unsigned)
  ) {
    throw new Error("Runtime comparison SHA-256 mismatch");
  }
}

export function assertGoldenMaterialPriceEquality(
  comparisons: readonly MaterialPriceComparison[]
): void {
  const failures = comparisons.filter(
    comparison => comparison.state !== "equal"
  );
  if (failures.length > 0) {
    throw new Error(
      `Governed material-price equality failed for ${failures.length}/${comparisons.length} eligible rows`
    );
  }
}

export function assertMaterialPricingRolloutGate(
  gate: MaterialPricingRolloutGate | undefined
): MaterialPricingRolloutMode {
  const effective = gate ?? { mode: "legacy" as const };
  if (effective.mode === "legacy") return "legacy";
  assertMaterialPricingComparisonEvidence(effective.evidence);
  if (effective.mode === "compare") return "compare";

  assertGoldenMaterialPriceEquality(effective.evidence.comparisons);
  if (
    !/^user-approved:\d{4}-\d{2}-\d{2}:ev03-governed-cutover$/.test(
      effective.cutoverApproval.reference
    )
  ) {
    throw new Error(
      "Governed material pricing requires explicit EV-03 cutover approval"
    );
  }
  if (
    effective.cutoverApproval.approvedEvidenceDigest !==
    effective.evidence.evidenceDigest
  ) {
    throw new Error(
      "Governed cutover approval does not bind the evidence SHA-256"
    );
  }
  return "governed";
}

/**
 * Server-owned runtime switch. Client input never selects a pricing mode.
 * Legacy is the fail-safe default; compare/governed require a complete
 * integrity-checked evidence envelope supplied by deployment configuration.
 */
export function loadMaterialPricingRolloutGate(
  environment: NodeJS.ProcessEnv = process.env
): MaterialPricingRolloutGate {
  const mode = environment.MIYAR_EV03_PRICING_MODE ?? "legacy";
  if (mode === "legacy") return { mode: "legacy" };
  if (mode !== "compare" && mode !== "governed") {
    throw new Error(`Unsupported MIYAR_EV03_PRICING_MODE: ${mode}`);
  }
  const inline = environment.MIYAR_EV03_ROLLOUT_EVIDENCE_JSON;
  const evidencePath = environment.MIYAR_EV03_ROLLOUT_EVIDENCE_PATH;
  const gzipBase64 = environment.MIYAR_EV03_ROLLOUT_EVIDENCE_GZIP_BASE64;
  if ((inline ? 1 : 0) + (evidencePath ? 1 : 0) + (gzipBase64 ? 1 : 0) !== 1) {
    throw new Error(
      "EV-03 compare/governed mode requires exactly one rollout evidence source"
    );
  }
  let serialized: string;
  if (gzipBase64) {
    const maxEncodedBytes =
      Math.ceil(EV03_MAX_ROLLOUT_EVIDENCE_COMPRESSED_BYTES / 3) * 4 + 4;
    if (
      Buffer.byteLength(gzipBase64, "utf8") > maxEncodedBytes ||
      gzipBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(gzipBase64)
    ) {
      throw new Error(
        "EV-03 compressed rollout evidence is not canonical bounded base64"
      );
    }
    const compressed = Buffer.from(gzipBase64, "base64");
    if (
      compressed.length === 0 ||
      compressed.length > EV03_MAX_ROLLOUT_EVIDENCE_COMPRESSED_BYTES ||
      compressed.toString("base64") !== gzipBase64
    ) {
      throw new Error(
        "EV-03 compressed rollout evidence exceeds the compressed size limit"
      );
    }
    let decompressed: Buffer;
    try {
      decompressed = gunzipSync(compressed, {
        maxOutputLength: EV03_MAX_ROLLOUT_EVIDENCE_DECOMPRESSED_BYTES,
      });
    } catch {
      throw new Error(
        "EV-03 compressed rollout evidence is invalid or exceeds the decompressed size limit"
      );
    }
    if (
      decompressed.length === 0 ||
      decompressed.length > EV03_MAX_ROLLOUT_EVIDENCE_DECOMPRESSED_BYTES
    ) {
      throw new Error(
        "EV-03 compressed rollout evidence exceeds the decompressed size limit"
      );
    }
    try {
      serialized = new TextDecoder("utf-8", { fatal: true }).decode(
        decompressed
      );
    } catch {
      throw new Error("EV-03 compressed rollout evidence is not valid UTF-8");
    }
  } else {
    serialized =
      inline ?? readFileSync(evidencePath!, { encoding: "utf8", flag: "r" });
  }
  let evidence: MaterialPricingComparisonEvidence;
  try {
    evidence = JSON.parse(serialized) as MaterialPricingComparisonEvidence;
  } catch {
    throw new Error("EV-03 rollout evidence is not valid JSON");
  }
  assertMaterialPricingComparisonEvidence(evidence);
  if (mode === "compare") return { mode, evidence };
  return {
    mode,
    evidence,
    cutoverApproval: {
      reference: environment.MIYAR_EV03_GOVERNED_CUTOVER_APPROVAL_REF ?? "",
      approvedEvidenceDigest:
        environment.MIYAR_EV03_GOVERNED_EVIDENCE_SHA256 ?? "",
    },
  };
}
