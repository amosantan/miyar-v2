import {
  MATERIAL_RESOLUTION_POLICY_VERSION,
  type MaterialIdentityReference,
  type MaterialPriceSnapshot,
} from "../../../shared/material-calculations";
import type {
  PriceScope,
  PriceUnitBasis,
  SourceLadderRung,
  UaePriceGeography,
} from "../../../shared/material-pricing";
import {
  CLAIM_HEALTH_POLICY_VERSION,
  CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
  type ClaimHealthAuthorityState,
  type ClaimHealthConfidenceState,
  type ClaimHealthEligibilityState,
  type ClaimHealthEvaluation,
  type ClaimHealthEvaluationInput,
  type ClaimHealthFreshnessState,
  type ClaimHealthIncidentState,
  type ClaimHealthQualityState,
  type ClaimHealthRequiredCellInput,
  type ClaimHealthConsumer,
} from "../../../shared/claim-health";
import {
  CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
  evaluateClaimHealth,
  evaluateMarketObservationFreshness,
  evaluateSupplierQuoteValidity,
} from "./claim-health";

export type ProjectClaimHealthConsumer =
  | "project_workspace"
  | "material_cost"
  | "design_brief"
  | "investor_summary"
  | "stored_project_report";

export interface CanonicalMaterialAllocationFact {
  allocationKey: string;
  requirement: "required" | "optional";
  reference: MaterialIdentityReference;
  category: string | null;
  finishTier: string | null;
  unitBasis: PriceUnitBasis | null;
  priceScope: PriceScope | null;
  requestedGeography: UaePriceGeography | null;
}

/**
 * Facts the established resolver/authorization boundary must capture alongside
 * a resolved snapshot. IDs, quote references, URLs, and commercial terms are
 * deliberately absent.
 */
export interface GovernedProjectMaterialEvidenceFact {
  sourceClass: Exclude<SourceLadderRung, "retail_sanity">;
  eligibility: ClaimHealthEligibilityState;
  sourceIdentityKnown: boolean;
  observationAt: Date | string | null;
  quoteValidUntil: Date | string | null;
  /**
   * Official/consultancy SLAs remain unconfigured in v1. A later policy may
   * supply both `slaConfigured` and a deterministic configured state.
   */
  slaConfigured: boolean;
  configuredFreshness?: Exclude<ClaimHealthFreshnessState, "not_applicable">;
  quality: ClaimHealthQualityState;
  confidence: ClaimHealthConfidenceState;
  incident: ClaimHealthIncidentState;
  resolvedCategory: string | null;
  resolvedFinishTier: string | null;
}

export interface ProjectMaterialClaimHealthFact {
  allocation: CanonicalMaterialAllocationFact;
  snapshot: MaterialPriceSnapshot | null;
  evidence: GovernedProjectMaterialEvidenceFact | null;
}

export interface BuildProjectClaimHealthInput {
  consumer: ProjectClaimHealthConsumer;
  evaluatedAt: Date;
  artifactSnapshot?: "not_applicable" | "present";
  materials: readonly ProjectMaterialClaimHealthFact[];
}

function nonEmpty(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function sameReference(
  left: MaterialIdentityReference,
  right: MaterialIdentityReference
): boolean {
  return left.source === right.source && left.legacyId === right.legacyId;
}

function authorityFor(
  sourceClass: GovernedProjectMaterialEvidenceFact["sourceClass"]
): ClaimHealthAuthorityState {
  switch (sourceClass) {
    case "supplier_quote":
      return "current_supplier_quote";
    case "official_statistic":
      return "official_observation";
    case "consultancy_benchmark":
    case "market_observation":
      return "governed_benchmark";
    case "assumption":
      return "approved_assumption";
  }
}

function isStructurallyResolved(
  input: ProjectMaterialClaimHealthFact,
  evaluatedAt: Date
): boolean {
  const { allocation, snapshot, evidence } = input;
  if (snapshot?.state !== "resolved" || evidence === null) return false;
  const resolverAsOf = new Date(snapshot.resolverAsOf);
  return (
    nonEmpty(allocation.allocationKey) &&
    Number.isInteger(allocation.reference.legacyId) &&
    allocation.reference.legacyId > 0 &&
    snapshot.policyVersion === MATERIAL_RESOLUTION_POLICY_VERSION &&
    Number.isFinite(evaluatedAt.getTime()) &&
    Number.isFinite(resolverAsOf.getTime()) &&
    resolverAsOf.getTime() <= evaluatedAt.getTime() &&
    Number.isInteger(snapshot.productId) &&
    snapshot.productId > 0 &&
    Number.isInteger(snapshot.specificationId) &&
    snapshot.specificationId > 0 &&
    snapshot.requestedPriceScope === allocation.priceScope &&
    snapshot.requestedGeography === allocation.requestedGeography &&
    snapshot.requestedPriceScope === "supply_only" &&
    snapshot.resolvedPriceScope === "supply_only" &&
    snapshot.unitBasis === allocation.unitBasis &&
    nonEmpty(allocation.category) &&
    nonEmpty(allocation.finishTier) &&
    allocation.unitBasis !== null &&
    allocation.requestedGeography !== null &&
    evidence.resolvedCategory === allocation.category &&
    evidence.resolvedFinishTier === allocation.finishTier &&
    sameReference(snapshot.reference, allocation.reference) &&
    evidence.sourceClass === snapshot.provenance.sourceLadderRung &&
    snapshot.provenance.compatibilityFallback === false
  );
}

function hasKnownProvenance(
  snapshot: Extract<MaterialPriceSnapshot, { state: "resolved" }>,
  evidence: GovernedProjectMaterialEvidenceFact
): boolean {
  return (
    evidence.sourceIdentityKnown &&
    snapshot.provenance.provenancePolicyVersion.trim().length > 0 &&
    snapshot.provenance.provenancePolicyVersion !== "legacy_unknown" &&
    snapshot.provenance.benchmarkVersion.trim().length > 0
  );
}

function invalidCell(
  input: ProjectMaterialClaimHealthFact,
  consumer: ClaimHealthConsumer
): ClaimHealthRequiredCellInput {
  const allocation = input.allocation;
  return {
    cellId: allocation.allocationKey,
    catalogueId:
      consumer === "stored_project_report"
        ? "project-report-material-v1"
        : "material-project-v1",
    requirement: allocation.requirement,
    key: {
      consumer,
      domain: "material_price",
      category: nonEmpty(allocation.category) ? allocation.category : "invalid",
      geography: allocation.requestedGeography ?? "invalid",
      finishTier: nonEmpty(allocation.finishTier)
        ? allocation.finishTier
        : "invalid",
      unitBasis: allocation.unitBasis ?? "invalid",
      priceScope: allocation.priceScope ?? "invalid",
      requiredAuthorityClass: "ineligible",
    },
    match: input.snapshot?.state === "insufficient" ? "missing" : "invalid",
    authority: "ineligible",
    eligibility: "ineligible",
    freshness: "not_applicable",
    cadence: "not_applicable",
    quality: input.evidence?.quality ?? "unknown",
    confidence: input.evidence?.confidence ?? "unknown",
    incident: input.evidence?.incident ?? "unknown",
    observationDateStatus: "not_applicable",
    quoteValidity: "not_applicable",
    successfulRun: "not_applicable",
    slaConfigured: true,
    provenanceIdentityKnown: false,
    fallbackCode: null,
    observedThrough: null,
  };
}

function resolvedCell(
  input: ProjectMaterialClaimHealthFact,
  consumer: ClaimHealthConsumer,
  evaluatedAt: Date
): ClaimHealthRequiredCellInput {
  const snapshot = input.snapshot as Extract<
    MaterialPriceSnapshot,
    { state: "resolved" }
  >;
  const evidence = input.evidence!;
  const allocation = input.allocation;
  const authority = authorityFor(evidence.sourceClass);
  const exactGeography =
    snapshot.resolvedGeography === allocation.requestedGeography &&
    snapshot.usedUaeFallback === false;
  const approvedFallback =
    allocation.requestedGeography !== "uae" &&
    snapshot.resolvedGeography === "uae" &&
    snapshot.usedUaeFallback === true;
  const match = exactGeography
    ? "exact"
    : approvedFallback
      ? "approved_fallback"
      : "invalid";

  let freshness: ClaimHealthFreshnessState = "not_applicable";
  let observationDateStatus: ClaimHealthRequiredCellInput["observationDateStatus"] =
    "not_applicable";
  let quoteValidity: ClaimHealthRequiredCellInput["quoteValidity"] =
    "not_applicable";
  let slaConfigured = true;
  let observedThrough: string | null = null;

  if (evidence.sourceClass === "market_observation") {
    const observation = evaluateMarketObservationFreshness({
      observedAt: evidence.observationAt,
      evaluatedAt,
    });
    freshness = observation.freshness;
    observationDateStatus = observation.observationDateStatus;
    observedThrough = observation.observedThrough;
  } else if (
    evidence.sourceClass === "official_statistic" ||
    evidence.sourceClass === "consultancy_benchmark"
  ) {
    const observation = evaluateMarketObservationFreshness({
      observedAt: evidence.observationAt,
      evaluatedAt,
      slaConfigured: false,
    });
    freshness = evidence.configuredFreshness ?? "unknown";
    observationDateStatus = observation.observationDateStatus;
    observedThrough = observation.observedThrough;
    slaConfigured =
      evidence.slaConfigured && evidence.configuredFreshness !== undefined;
  } else if (evidence.sourceClass === "supplier_quote") {
    const quote = evaluateSupplierQuoteValidity({
      validUntil: evidence.quoteValidUntil,
      evaluatedAt,
    });
    quoteValidity = quote.quoteValidity;
  }

  return {
    cellId: allocation.allocationKey,
    catalogueId:
      consumer === "stored_project_report"
        ? "project-report-material-v1"
        : "material-project-v1",
    requirement: allocation.requirement,
    key: {
      consumer,
      domain: "material_price",
      category: allocation.category!,
      geography: allocation.requestedGeography!,
      finishTier: allocation.finishTier!,
      unitBasis: allocation.unitBasis!,
      priceScope: allocation.priceScope!,
      requiredAuthorityClass: authority,
    },
    match,
    authority,
    eligibility: evidence.eligibility,
    freshness,
    cadence: "not_applicable",
    quality: evidence.quality,
    confidence: evidence.confidence,
    incident: evidence.incident,
    observationDateStatus,
    quoteValidity,
    successfulRun: "not_applicable",
    slaConfigured,
    provenanceIdentityKnown: hasKnownProvenance(snapshot, evidence),
    fallbackCode: approvedFallback ? "emirate_to_uae" : null,
    observedThrough,
  };
}

/**
 * Convert canonical project allocations plus already-governed EV-03 resolver
 * facts into the closed EV-04 material required-cell catalogue. No DB access,
 * tenant lookup, resolver call, or wall-clock read occurs here.
 */
export function buildProjectClaimHealthEvaluationInput(
  input: BuildProjectClaimHealthInput
): ClaimHealthEvaluationInput {
  return {
    policyVersion: CLAIM_HEALTH_POLICY_VERSION,
    policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
    requiredCellSchemaVersion: CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
    evaluatedAt: input.evaluatedAt,
    artifactSnapshot:
      input.artifactSnapshot ??
      (input.consumer === "stored_project_report"
        ? "present"
        : "not_applicable"),
    cells: input.materials.map(material =>
      isStructurallyResolved(material, input.evaluatedAt)
        ? resolvedCell(material, input.consumer, input.evaluatedAt)
        : invalidCell(material, input.consumer)
    ),
  };
}

export function evaluateProjectClaimHealth(
  input: BuildProjectClaimHealthInput
): ClaimHealthEvaluation {
  return evaluateClaimHealth(buildProjectClaimHealthEvaluationInput(input));
}
