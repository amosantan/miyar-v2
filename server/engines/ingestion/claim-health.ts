import { createHash } from "node:crypto";

import {
  CLAIM_HEALTH_DIGEST_ALGORITHM,
  CLAIM_HEALTH_POLICY_VERSION,
  CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
  CLAIM_HEALTH_V1_CATALOGUE,
  CLAIM_HEALTH_V1_POLICY_MANIFEST,
  type ClaimHealthCadenceState,
  type ClaimHealthDigests,
  type ClaimHealthEvaluation,
  type ClaimHealthEvaluationInput,
  type ClaimHealthEvidenceDateStatus,
  type ClaimHealthFreshnessState,
  type ClaimHealthGovernedSourceEligibilityFacts,
  type ClaimHealthIncidentEventType,
  type ClaimHealthIncidentLifecycleState,
  type ClaimHealthIncidentSeverity,
  type ClaimHealthIncidentState,
  type ClaimHealthIncidentType,
  type ClaimHealthQuoteValidityState,
  type ClaimHealthReasonCode,
  type ClaimHealthRequiredCellInput,
  type ClaimHealthSafeCell,
  type ClaimHealthSafeProjection,
  type ClaimHealthSuccessfulRunState,
  type CustomerClaimHealthState,
  type ClaimHealthProjectionCondition,
} from "../../../shared/claim-health";

const MILLIS_PER_DAY = 86_400_000;
export const CLAIM_HEALTH_MARKET_CURRENT_DAYS =
  CLAIM_HEALTH_V1_POLICY_MANIFEST.freshness.marketObservation
    .currentThroughDays;
export const CLAIM_HEALTH_MARKET_AGING_DAYS =
  CLAIM_HEALTH_V1_POLICY_MANIFEST.freshness.marketObservation.agingThroughDays;
export const CLAIM_HEALTH_WEEKLY_ON_TIME_DAYS =
  CLAIM_HEALTH_V1_POLICY_MANIFEST.cadence.weeklyRequiredSource
    .onTimeThroughDays;
export const CLAIM_HEALTH_WEEKLY_BREACH_DAYS =
  CLAIM_HEALTH_V1_POLICY_MANIFEST.cadence.weeklyRequiredSource.dueThroughDays;

export function evaluateGovernedSourceEligibility(
  facts: ClaimHealthGovernedSourceEligibilityFacts | undefined
): "eligible" | "ineligible" {
  if (!facts) return "ineligible";
  const required =
    CLAIM_HEALTH_V1_POLICY_MANIFEST.eligibilityRules
      .registryBackedRequiredBooleanFacts;
  if (required.some(key => facts[key] !== true)) return "ineligible";
  if (
    CLAIM_HEALTH_V1_POLICY_MANIFEST.eligibilityRules
      .registryBackedIdentityMustBeNonEmpty &&
    !facts.governedSourceIdentity?.trim()
  ) {
    return "ineligible";
  }
  if (
    CLAIM_HEALTH_V1_POLICY_MANIFEST.eligibilityRules
      .registryBackedBindingRequiresExactRegistryIdSlugAndRevision &&
    (!Number.isInteger(facts.governedSourceRegistryId) ||
      Number(facts.governedSourceRegistryId) <= 0 ||
      !facts.governedSourceSlug?.trim() ||
      !facts.governedSourcePolicyVersion?.trim() ||
      !facts.governedSourceRevision?.trim() ||
      !/^sha256:[0-9a-f]{64}$/.test(facts.governedSourceRevision))
  ) {
    return "ineligible";
  }
  return "eligible";
}

export function resolveClaimHealthIncidentSeverity(
  incidentType: ClaimHealthIncidentType,
  requestedSeverity: ClaimHealthIncidentSeverity
): ClaimHealthIncidentSeverity {
  const rule = CLAIM_HEALTH_V1_POLICY_MANIFEST.incidentPolicy.catalogue.find(
    candidate => candidate.type === incidentType
  );
  if (!rule) {
    throw new TypeError(`Unsupported EV-04 incident type: ${incidentType}`);
  }
  return rule.alwaysBlocking ? "blocking" : requestedSeverity;
}

export function resolveClaimHealthIncidentTransition(
  prior: ClaimHealthIncidentLifecycleState,
  event: ClaimHealthIncidentEventType
): Exclude<ClaimHealthIncidentLifecycleState, "absent"> | null {
  return (
    CLAIM_HEALTH_V1_POLICY_MANIFEST.incidentPolicy.lifecycleTransitions.find(
      transition => transition.prior === prior && transition.event === event
    )?.result ?? null
  );
}

export function composeClaimHealthIncidentStates(
  states: readonly (Exclude<ClaimHealthIncidentState, "unknown"> | undefined)[]
): ClaimHealthIncidentState {
  if (states.includes("blocking")) return "blocking";
  if (
    states.some(state => state === undefined) &&
    CLAIM_HEALTH_V1_POLICY_MANIFEST.incidentPolicy.composition
      .missingEffectiveState === "unknown"
  ) {
    return "unknown";
  }
  if (states.includes("advisory")) return "advisory";
  return "none";
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const REASON_ORDER: readonly ClaimHealthReasonCode[] = [
  "unsupported_policy_version",
  "unsupported_policy_manifest_digest",
  "unsupported_required_cell_schema_version",
  "legacy_artifact_without_snapshot",
  "invalid_evaluation_clock",
  "empty_required_set",
  "duplicate_cell_id",
  "catalogue_mismatch",
  "authority_mismatch",
  "authority_not_permitted",
  "fallback_not_permitted",
  "blocking_incident",
  "missing_match",
  "invalid_match",
  "ineligible_evidence",
  "raw_observation",
  "missing_observation_date",
  "invalid_observation_date",
  "future_observation_date",
  "missing_quote_validity",
  "invalid_quote_validity",
  "future_quote_validity",
  "expired_quote",
  "missing_successful_run",
  "invalid_successful_run",
  "future_successful_run",
  "missing_provenance",
  "blocking_quality",
  "stale_observation",
  "breached_cadence",
  "aging_observation",
  "due_cadence",
  "unconfigured_sla",
  "unknown_freshness",
  "unknown_cadence",
  "unknown_quality",
  "unknown_confidence",
  "unknown_incident",
  "approved_assumption",
  "approved_synthetic",
  "quality_warning",
  "advisory_incident",
  "approved_fallback",
] as const;

const INCIDENT_REASONS = new Set<ClaimHealthReasonCode>(
  CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionReasonGroups.incident
);
const INSUFFICIENT_REASONS = new Set<ClaimHealthReasonCode>(
  CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionReasonGroups.insufficient
);
const STALE_REASONS = new Set<ClaimHealthReasonCode>(
  CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionReasonGroups.stale
);
const AGING_REASONS = new Set<ClaimHealthReasonCode>(
  CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionReasonGroups.aging
);
const UNKNOWN_REASONS = new Set<ClaimHealthReasonCode>(
  CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionReasonGroups.unknown
);
const QUALIFIED_REASONS = new Set<ClaimHealthReasonCode>(
  CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionReasonGroups.qualified
);

function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}

function parsePolicyInstant(
  value: Date | string | null | undefined
): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  }

  const raw = value.trim();
  const dateOnlyMatch = raw.match(DATE_ONLY_PATTERN);
  const instantMatch = raw.match(ISO_INSTANT_PATTERN);
  const match = dateOnlyMatch ?? instantMatch;
  if (
    !match ||
    !isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
  ) {
    return null;
  }

  if (dateOnlyMatch) {
    const parsed = new Date(0);
    parsed.setUTCFullYear(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3])
    );
    parsed.setUTCHours(0, 0, 0, 0);
    return parsed;
  }

  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function classifyDate(
  value: Date | string | null | undefined,
  evaluatedAt: Date
): { status: ClaimHealthEvidenceDateStatus; instant: Date | null } {
  if (value === null || value === undefined || value === "") {
    return { status: "missing", instant: null };
  }
  const instant = parsePolicyInstant(value);
  if (!instant) return { status: "invalid", instant: null };
  if (instant.getTime() > evaluatedAt.getTime()) {
    return { status: "future", instant };
  }
  return { status: "valid", instant };
}

export interface ObservationFreshnessEvaluation {
  freshness: ClaimHealthFreshnessState;
  observationDateStatus: ClaimHealthEvidenceDateStatus;
  observedThrough: string | null;
  ageDays: number | null;
}

/**
 * Evaluate the approved 90/365 market-observation boundaries. Callers must
 * supply the clock; this helper never reads the wall clock.
 */
export function evaluateMarketObservationFreshness(input: {
  observedAt: Date | string | null | undefined;
  evaluatedAt: Date;
  slaConfigured?: boolean;
}): ObservationFreshnessEvaluation {
  const clock = parsePolicyInstant(input.evaluatedAt);
  if (!clock) {
    return {
      freshness: "unknown",
      observationDateStatus: "invalid",
      observedThrough: null,
      ageDays: null,
    };
  }
  const date = classifyDate(input.observedAt, clock);
  if (date.status !== "valid" || !date.instant) {
    return {
      freshness: "unknown",
      observationDateStatus: date.status,
      observedThrough: null,
      ageDays: null,
    };
  }
  if (input.slaConfigured === false) {
    return {
      freshness: "unknown",
      observationDateStatus: "valid",
      observedThrough: date.instant.toISOString(),
      ageDays: Math.floor(
        (clock.getTime() - date.instant.getTime()) / MILLIS_PER_DAY
      ),
    };
  }

  const ageDays = (clock.getTime() - date.instant.getTime()) / MILLIS_PER_DAY;
  const freshness =
    ageDays <= CLAIM_HEALTH_MARKET_CURRENT_DAYS
      ? "current"
      : ageDays <= CLAIM_HEALTH_MARKET_AGING_DAYS
        ? "aging"
        : CLAIM_HEALTH_V1_POLICY_MANIFEST.freshness.marketObservation
            .afterAging;
  return {
    freshness,
    observationDateStatus: "valid",
    observedThrough: date.instant.toISOString(),
    ageDays: Math.floor(ageDays),
  };
}

export interface QuoteValidityEvaluation {
  quoteValidity: ClaimHealthQuoteValidityState;
  validUntil: string | null;
}

/** A quote is current through (and including) its exact valid-until instant. */
export function evaluateSupplierQuoteValidity(input: {
  validUntil: Date | string | null | undefined;
  evaluatedAt: Date;
}): QuoteValidityEvaluation {
  const clock = parsePolicyInstant(input.evaluatedAt);
  if (!clock) return { quoteValidity: "invalid", validUntil: null };
  if (
    input.validUntil === null ||
    input.validUntil === undefined ||
    input.validUntil === ""
  ) {
    return { quoteValidity: "missing", validUntil: null };
  }
  const validUntil = parsePolicyInstant(input.validUntil);
  if (!validUntil) return { quoteValidity: "invalid", validUntil: null };
  return {
    quoteValidity: (
      CLAIM_HEALTH_V1_POLICY_MANIFEST.freshness.supplierQuote
        .currentThroughValidUntilInclusive
        ? clock.getTime() <= validUntil.getTime()
        : clock.getTime() < validUntil.getTime()
    )
      ? "valid"
      : CLAIM_HEALTH_V1_POLICY_MANIFEST.freshness.supplierQuote
          .expiredValidityState,
    validUntil: validUntil.toISOString(),
  };
}

export interface WeeklyCadenceEvaluation {
  cadence: ClaimHealthCadenceState;
  successfulRun: ClaimHealthSuccessfulRunState;
  lastSuccessfulRunAt: string | null;
  ageDays: number | null;
}

/**
 * Evaluate cadence from the last successful required run only. Callers must
 * not pass failed or partial attempt timestamps.
 */
export function evaluateWeeklyRequiredSourceCadence(input: {
  lastSuccessfulRunAt: Date | string | null | undefined;
  evaluatedAt: Date;
}): WeeklyCadenceEvaluation {
  const clock = parsePolicyInstant(input.evaluatedAt);
  if (!clock) {
    return {
      cadence: "unknown",
      successfulRun: "invalid",
      lastSuccessfulRunAt: null,
      ageDays: null,
    };
  }
  if (
    input.lastSuccessfulRunAt === null ||
    input.lastSuccessfulRunAt === undefined ||
    input.lastSuccessfulRunAt === ""
  ) {
    return {
      cadence: "unknown",
      successfulRun: "missing",
      lastSuccessfulRunAt: null,
      ageDays: null,
    };
  }
  const run = parsePolicyInstant(input.lastSuccessfulRunAt);
  if (!run) {
    return {
      cadence: "unknown",
      successfulRun: "invalid",
      lastSuccessfulRunAt: null,
      ageDays: null,
    };
  }
  if (run.getTime() > clock.getTime()) {
    return {
      cadence: "unknown",
      successfulRun: "future",
      lastSuccessfulRunAt: null,
      ageDays: null,
    };
  }

  const ageDays = (clock.getTime() - run.getTime()) / MILLIS_PER_DAY;
  const cadence =
    ageDays <= CLAIM_HEALTH_WEEKLY_ON_TIME_DAYS
      ? "on_time"
      : ageDays <= CLAIM_HEALTH_WEEKLY_BREACH_DAYS
        ? "due"
        : CLAIM_HEALTH_V1_POLICY_MANIFEST.cadence.weeklyRequiredSource.afterDue;
  return {
    cadence,
    successfulRun: "valid",
    lastSuccessfulRunAt: run.toISOString(),
    ageDays: Math.floor(ageDays),
  };
}

function addReason(
  reasons: Set<ClaimHealthReasonCode>,
  condition: boolean,
  reason: ClaimHealthReasonCode
): void {
  if (condition) reasons.add(reason);
}

function orderedReasons(
  reasons: ReadonlySet<ClaimHealthReasonCode>
): ClaimHealthReasonCode[] {
  return REASON_ORDER.filter(reason => reasons.has(reason));
}

function catalogueMatches(cell: ClaimHealthRequiredCellInput): boolean {
  const entry = CLAIM_HEALTH_V1_CATALOGUE.find(
    candidate => candidate.id === cell.catalogueId
  );
  if (!entry || !entry.consumers.includes(cell.key.consumer as never))
    return false;
  if (
    entry.domain !== "bound_report_domains" &&
    entry.domain !== cell.key.domain
  ) {
    return false;
  }
  const dimensionMatches = (
    rule: "applicable" | "not_applicable" | "inherited" | string,
    value: string
  ) =>
    rule === "inherited" ||
    (rule === "applicable" ? value !== "not_applicable" : value === rule);
  return (
    dimensionMatches(entry.dimensionRules.category, cell.key.category) &&
    dimensionMatches(entry.dimensionRules.geography, cell.key.geography) &&
    dimensionMatches(entry.dimensionRules.finishTier, cell.key.finishTier) &&
    dimensionMatches(entry.dimensionRules.unitBasis, cell.key.unitBasis) &&
    dimensionMatches(entry.dimensionRules.priceScope, cell.key.priceScope)
  );
}

function cataloguePermitsFallback(cell: ClaimHealthRequiredCellInput): boolean {
  const entry = CLAIM_HEALTH_V1_CATALOGUE.find(
    candidate => candidate.id === cell.catalogueId
  );
  return (
    (entry?.fallbackCodes as readonly string[] | undefined)?.includes(
      cell.fallbackCode ?? ""
    ) ?? false
  );
}

function cataloguePermitsAuthority(
  cell: ClaimHealthRequiredCellInput
): boolean {
  const entry = CLAIM_HEALTH_V1_CATALOGUE.find(
    candidate => candidate.id === cell.catalogueId
  );
  return (
    (entry?.allowedAuthorities as readonly string[] | undefined)?.includes(
      cell.authority
    ) ?? false
  );
}

function authorityMatchesRequiredClass(
  cell: ClaimHealthRequiredCellInput
): boolean {
  return (
    !CLAIM_HEALTH_V1_POLICY_MANIFEST.authorityRules
      .actualAuthorityMustMatchRequiredClass ||
    cell.authority === cell.key.requiredAuthorityClass
  );
}

function deriveCellReasons(
  cell: ClaimHealthRequiredCellInput
): ClaimHealthReasonCode[] {
  const reasons = new Set<ClaimHealthReasonCode>();
  const requiresObservationDate =
    (cell.authority === "governed_benchmark" ||
      cell.authority === "official_observation") &&
    cell.freshness !== "not_applicable";
  const requiresQuoteValidity = cell.authority === "current_supplier_quote";
  const requiresSuccessfulRun = cell.cadence !== "not_applicable";
  addReason(reasons, !catalogueMatches(cell), "catalogue_mismatch");
  addReason(
    reasons,
    !authorityMatchesRequiredClass(cell),
    "authority_mismatch"
  );
  addReason(
    reasons,
    !cataloguePermitsAuthority(cell),
    "authority_not_permitted"
  );
  addReason(
    reasons,
    cell.match === "approved_fallback" && !cataloguePermitsFallback(cell),
    "fallback_not_permitted"
  );
  addReason(reasons, cell.incident === "blocking", "blocking_incident");
  addReason(reasons, cell.match === "missing", "missing_match");
  addReason(
    reasons,
    cell.match === "invalid" ||
      (cell.match === "approved_fallback" && cell.fallbackCode === null) ||
      (cell.match === "approved_fallback" && !cataloguePermitsFallback(cell)) ||
      (cell.match !== "approved_fallback" && cell.fallbackCode !== null),
    "invalid_match"
  );
  addReason(
    reasons,
    cell.eligibility === "ineligible" || cell.authority === "ineligible",
    "ineligible_evidence"
  );
  addReason(
    reasons,
    cell.authority === "raw_observation" &&
      !CLAIM_HEALTH_V1_POLICY_MANIFEST.authorityRules
        .rawObservationAuthoritative,
    "raw_observation"
  );
  addReason(
    reasons,
    cell.observationDateStatus === "missing" ||
      (requiresObservationDate &&
        cell.observationDateStatus === "not_applicable"),
    "missing_observation_date"
  );
  addReason(
    reasons,
    cell.observationDateStatus === "invalid",
    "invalid_observation_date"
  );
  addReason(
    reasons,
    cell.observationDateStatus === "future",
    "future_observation_date"
  );
  addReason(
    reasons,
    cell.quoteValidity === "missing" ||
      (requiresQuoteValidity && cell.quoteValidity === "not_applicable"),
    "missing_quote_validity"
  );
  addReason(
    reasons,
    cell.quoteValidity === "invalid",
    "invalid_quote_validity"
  );
  addReason(reasons, cell.quoteValidity === "future", "future_quote_validity");
  addReason(reasons, cell.quoteValidity === "expired", "expired_quote");
  addReason(
    reasons,
    cell.successfulRun === "missing" ||
      (requiresSuccessfulRun && cell.successfulRun === "not_applicable"),
    "missing_successful_run"
  );
  addReason(
    reasons,
    cell.successfulRun === "invalid",
    "invalid_successful_run"
  );
  addReason(reasons, cell.successfulRun === "future", "future_successful_run");
  addReason(reasons, !cell.provenanceIdentityKnown, "missing_provenance");
  addReason(reasons, cell.quality === "blocking", "blocking_quality");
  addReason(reasons, cell.freshness === "stale", "stale_observation");
  addReason(reasons, cell.cadence === "breached", "breached_cadence");
  addReason(reasons, cell.freshness === "aging", "aging_observation");
  addReason(reasons, cell.cadence === "due", "due_cadence");
  addReason(reasons, !cell.slaConfigured, "unconfigured_sla");
  addReason(reasons, cell.freshness === "unknown", "unknown_freshness");
  addReason(reasons, cell.cadence === "unknown", "unknown_cadence");
  addReason(reasons, cell.quality === "unknown", "unknown_quality");
  addReason(reasons, cell.confidence === "unknown", "unknown_confidence");
  addReason(reasons, cell.incident === "unknown", "unknown_incident");
  addReason(
    reasons,
    cell.authority === "approved_assumption" &&
      CLAIM_HEALTH_V1_POLICY_MANIFEST.authorityRules.assumptionAlwaysQualified,
    "approved_assumption"
  );
  addReason(
    reasons,
    cell.authority === "approved_synthetic" &&
      CLAIM_HEALTH_V1_POLICY_MANIFEST.authorityRules.syntheticAlwaysQualified,
    "approved_synthetic"
  );
  addReason(reasons, cell.quality === "warning", "quality_warning");
  addReason(reasons, cell.incident === "advisory", "advisory_incident");
  addReason(reasons, cell.match === "approved_fallback", "approved_fallback");
  return orderedReasons(reasons);
}

function hasAny(
  reasons: readonly ClaimHealthReasonCode[],
  candidates: ReadonlySet<ClaimHealthReasonCode>
): boolean {
  return reasons.some(reason => candidates.has(reason));
}

function deriveClaimState(input: {
  legacy: boolean;
  reasons: readonly ClaimHealthReasonCode[];
  hasFallback: boolean;
}): CustomerClaimHealthState {
  const matches = (condition: ClaimHealthProjectionCondition): boolean => {
    switch (condition) {
      case "legacy_or_unsupported_policy":
        return input.legacy;
      case "blocking_incident":
        return hasAny(input.reasons, INCIDENT_REASONS);
      case "insufficient_required_evidence":
        return hasAny(input.reasons, INSUFFICIENT_REASONS);
      case "stale_or_breached":
        return hasAny(input.reasons, STALE_REASONS);
      case "aging_or_due":
        return hasAny(input.reasons, AGING_REASONS);
      case "unknown_required_state":
        return hasAny(input.reasons, UNKNOWN_REASONS);
      case "qualified_evidence":
        return hasAny(input.reasons, QUALIFIED_REASONS);
      case "approved_fallback":
        return input.hasFallback;
      case "all_exact_current":
        return true;
    }
  };
  for (const row of CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionPriority) {
    if (matches(row.condition)) return row.state;
  }
  throw new Error("EV-04 projection manifest is not total");
}

function safeObservedThrough(
  value: string | null,
  evaluatedAt: Date | null
): string | null {
  if (!evaluatedAt || value === null) return null;
  const parsed = parsePolicyInstant(value);
  if (!parsed || parsed.getTime() > evaluatedAt.getTime()) return null;
  return parsed.toISOString();
}

/**
 * Apply the approved total projection matrix. The evaluator is pure: all
 * cells, policy versions, and the clock are explicit inputs.
 */
export function evaluateClaimHealth(
  input: ClaimHealthEvaluationInput
): ClaimHealthEvaluation {
  const clock = parsePolicyInstant(input.evaluatedAt);
  const policySupported = input.policyVersion === CLAIM_HEALTH_POLICY_VERSION;
  const policyManifestSupported =
    input.policyManifestDigest === CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST;
  const requiredCellSchemaSupported =
    input.requiredCellSchemaVersion ===
    CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION;
  const globalReasons = new Set<ClaimHealthReasonCode>();
  addReason(globalReasons, !policySupported, "unsupported_policy_version");
  addReason(
    globalReasons,
    !policyManifestSupported,
    "unsupported_policy_manifest_digest"
  );
  addReason(
    globalReasons,
    !requiredCellSchemaSupported,
    "unsupported_required_cell_schema_version"
  );
  addReason(
    globalReasons,
    input.artifactSnapshot === "missing",
    "legacy_artifact_without_snapshot"
  );
  addReason(globalReasons, clock === null, "invalid_evaluation_clock");

  const requiredCells = input.cells.filter(
    cell => cell.requirement === "required"
  );
  addReason(globalReasons, requiredCells.length === 0, "empty_required_set");

  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const cell of input.cells) {
    if (seenIds.has(cell.cellId)) duplicateIds.add(cell.cellId);
    seenIds.add(cell.cellId);
  }
  addReason(globalReasons, duplicateIds.size > 0, "duplicate_cell_id");

  const cellResults = [...input.cells]
    .sort((left, right) => left.cellId.localeCompare(right.cellId))
    .map<ClaimHealthSafeCell>(cell => {
      const reasonCodes = deriveCellReasons(cell);
      if (cell.requirement === "required") {
        for (const reason of reasonCodes) globalReasons.add(reason);
      }
      return {
        cellRef: createClaimHealthValueDigest({
          catalogueId: cell.catalogueId,
          cellId: cell.cellId,
        }),
        catalogueId: cell.catalogueId,
        requirement: cell.requirement,
        match: cell.match,
        authority: cell.authority,
        freshness: cell.freshness,
        cadence: cell.cadence,
        quality: cell.quality,
        confidence: cell.confidence,
        incident: cell.incident,
        fallbackCode: cell.fallbackCode,
        observedThrough: safeObservedThrough(cell.observedThrough, clock),
        reasonCodes,
      };
    });

  const reasons = orderedReasons(globalReasons);
  const legacy =
    !policySupported ||
    !policyManifestSupported ||
    !requiredCellSchemaSupported ||
    input.artifactSnapshot === "missing";
  const hasFallback = requiredCells.some(
    cell => cell.match === "approved_fallback"
  );
  const eligibleRequired = requiredCells.filter(
    cell =>
      cell.eligibility === "eligible" &&
      cell.authority !== "ineligible" &&
      cell.authority !== "raw_observation" &&
      authorityMatchesRequiredClass(cell) &&
      cataloguePermitsAuthority(cell) &&
      (cell.match !== "approved_fallback" || cataloguePermitsFallback(cell))
  );

  const safeProjection: ClaimHealthSafeProjection = {
    claimState: deriveClaimState({ legacy, reasons, hasFallback }),
    evaluatedAt: clock?.toISOString() ?? null,
    policyVersion: input.policyVersion,
    policyManifestDigest: input.policyManifestDigest ?? null,
    requiredCellSchemaVersion: input.requiredCellSchemaVersion,
    counts: {
      required: requiredCells.length,
      eligible: eligibleRequired.length,
      exact: eligibleRequired.filter(cell => cell.match === "exact").length,
      fallback: eligibleRequired.filter(
        cell => cell.match === "approved_fallback"
      ).length,
      optional: input.cells.length - requiredCells.length,
    },
    reasonCodes: reasons,
    cells: cellResults,
  };

  return {
    policySupported,
    policyManifestSupported,
    requiredCellSchemaSupported,
    safeProjection,
  };
}

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

function normalizeCanonicalValue(value: unknown, path: string): CanonicalValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Non-finite number at ${path}`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new TypeError(`Invalid Date at ${path}`);
    }
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      normalizeCanonicalValue(item, `${path}[${index}]`)
    );
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Unsupported object at ${path}`);
    }
    const record = value as Record<string, unknown>;
    const normalized: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] === undefined) {
        throw new TypeError(`Undefined value at ${path}.${key}`);
      }
      normalized[key] = normalizeCanonicalValue(record[key], `${path}.${key}`);
    }
    return normalized;
  }
  throw new TypeError(`Unsupported canonical value at ${path}`);
}

export function canonicalizeClaimHealthValue(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value, "$"));
}

export function createClaimHealthValueDigest(
  value: unknown
): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalizeClaimHealthValue(value), "utf8")
    .digest("hex")}`;
}

/** Backward-compatible alias; persistence should import the value canonicalizer. */
export const canonicalizeClaimHealth = canonicalizeClaimHealthValue;

export const CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST =
  createClaimHealthValueDigest(CLAIM_HEALTH_V1_POLICY_MANIFEST);
export const CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON =
  canonicalizeClaimHealthValue(CLAIM_HEALTH_V1_POLICY_MANIFEST);

export function createClaimHealthInputDigest(
  input: ClaimHealthEvaluationInput
): `sha256:${string}` {
  const evaluatedAt = parsePolicyInstant(input.evaluatedAt);
  return createClaimHealthValueDigest({
    ...input,
    evaluatedAt: evaluatedAt?.toISOString() ?? String(input.evaluatedAt),
    cells: [...input.cells].sort(
      (left, right) =>
        left.cellId.localeCompare(right.cellId) ||
        canonicalizeClaimHealthValue(left).localeCompare(
          canonicalizeClaimHealthValue(right)
        )
    ),
  });
}

export function createClaimHealthContentDigest(
  input: ClaimHealthEvaluationInput,
  evaluation: ClaimHealthEvaluation
): `sha256:${string}` {
  return createClaimHealthValueDigest({
    inputDigest: createClaimHealthInputDigest(input),
    evaluation,
  });
}

export function createClaimHealthDigests(
  input: ClaimHealthEvaluationInput,
  evaluation: ClaimHealthEvaluation
): ClaimHealthDigests {
  return {
    algorithm: CLAIM_HEALTH_DIGEST_ALGORITHM,
    inputDigest: createClaimHealthInputDigest(input),
    contentDigest: createClaimHealthContentDigest(input, evaluation),
  };
}
