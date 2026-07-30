/**
 * EV-04 claim-health contracts.
 *
 * This module is intentionally data-only so the same safe projection can be
 * consumed by the server, customer UI, stored reports, and public shares.
 * Authoritative evaluation remains in deterministic server TypeScript.
 */

export const CLAIM_HEALTH_POLICY_VERSION = "ev04-claim-health-v1" as const;
export const CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION =
  "ev04-required-cell-v1" as const;
export const CLAIM_HEALTH_DIGEST_ALGORITHM = "sha256" as const;

export const SUPPORTED_CLAIM_HEALTH_POLICY_VERSIONS = Object.freeze([
  CLAIM_HEALTH_POLICY_VERSION,
] as const);
export const SUPPORTED_CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSIONS =
  Object.freeze([CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION] as const);

export type ClaimHealthPolicyVersion =
  (typeof SUPPORTED_CLAIM_HEALTH_POLICY_VERSIONS)[number];
export type ClaimHealthRequiredCellSchemaVersion =
  (typeof SUPPORTED_CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSIONS)[number];

export type ClaimHealthConsumer =
  | "project_workspace"
  | "material_cost"
  | "design_brief"
  | "investor_summary"
  | "stored_project_report"
  | "public_share"
  | "market_evidence"
  | "admin_operations";

export type ClaimHealthDomain =
  | "material_price"
  | "market_transaction"
  | "market_rent"
  | "project_pipeline"
  | "regulatory_evidence"
  | "source_operations";

export type ClaimHealthCatalogueId =
  | "material-project-v1"
  | "project-report-material-v1"
  | "report-public-share-v1"
  | "dld-indexed-transactions-v1"
  | "dld-indexed-rents-v1"
  | "dld-indexed-projects-v1"
  | "required-source-operations-v1";

export type ClaimHealthAuthorityState =
  | "governed_benchmark"
  | "approved_assumption"
  | "official_observation"
  | "current_supplier_quote"
  | "approved_synthetic"
  | "raw_observation"
  | "ineligible";

export type ClaimHealthMatchState =
  | "exact"
  | "approved_fallback"
  | "missing"
  | "invalid";
export type ClaimHealthFreshnessState =
  | "current"
  | "aging"
  | "stale"
  | "unknown"
  | "not_applicable";
export type ClaimHealthCadenceState =
  | "on_time"
  | "due"
  | "breached"
  | "unknown"
  | "not_applicable";
export type ClaimHealthQualityState =
  | "pass"
  | "warning"
  | "blocking"
  | "unknown";
export type ClaimHealthConfidenceState = "known" | "unknown" | "not_applicable";
export type ClaimHealthIncidentState =
  | "none"
  | "advisory"
  | "blocking"
  | "unknown";
export type ClaimHealthIncidentType =
  | "required_run_missed"
  | "repeated_source_failure"
  | "source_authorization_revoked"
  | "unexpected_zero"
  | "anomalous_extraction"
  | "corrupted_source_content"
  | "provenance_digest_mismatch"
  | "quality_quarantine_backlog"
  | "confidentiality_concern"
  | "tenant_boundary_concern"
  | "stale_mandatory_evidence";
export type ClaimHealthIncidentSeverity = "advisory" | "blocking";
export type ClaimHealthIncidentLifecycleState =
  | "absent"
  | "open"
  | "acknowledged"
  | "resolved";
export type ClaimHealthIncidentEventType =
  | "opened"
  | "acknowledged"
  | "resolved"
  | "reopened";
export type ClaimHealthIncidentScope =
  | "platform"
  | "organization"
  | "project"
  | "supplier_quote";
export type ClaimHealthEligibilityState = "eligible" | "ineligible";

export interface ClaimHealthGovernedSourceEligibilityFacts {
  termsApproved: boolean;
  sourceActive: boolean;
  sourceWhitelisted: boolean;
  consumerAuthorized: boolean;
  confidentialityEligible: boolean;
  tenantEligible: boolean;
  sourcePolicyVersionMatches: boolean;
  governedSourceIdentityKnown: boolean;
  governedSourceIdentity: string | null;
  governedSourceRegistryId: number | null;
  governedSourceSlug: string | null;
  governedSourcePolicyVersion: string | null;
  /** Opaque terms/status/update revision supplied by the governed registry. */
  governedSourceRevision: string | null;
}
export type ClaimHealthEvidenceDateStatus =
  | "valid"
  | "missing"
  | "invalid"
  | "future"
  | "not_applicable";
export type ClaimHealthQuoteValidityState =
  | "valid"
  | "expired"
  | "missing"
  | "invalid"
  | "future"
  | "not_applicable";
export type ClaimHealthSuccessfulRunState =
  | "valid"
  | "missing"
  | "invalid"
  | "future"
  | "not_applicable";

export type CustomerClaimHealthState =
  | "current"
  | "current_with_fallback"
  | "qualified"
  | "aging"
  | "stale"
  | "incident"
  | "insufficient"
  | "unknown"
  | "legacy";

export type ClaimHealthFallbackCode = "emirate_to_uae";

export type ClaimHealthReasonCode =
  | "unsupported_policy_version"
  | "unsupported_policy_manifest_digest"
  | "unsupported_required_cell_schema_version"
  | "legacy_artifact_without_snapshot"
  | "invalid_evaluation_clock"
  | "empty_required_set"
  | "duplicate_cell_id"
  | "catalogue_mismatch"
  | "authority_mismatch"
  | "authority_not_permitted"
  | "fallback_not_permitted"
  | "blocking_incident"
  | "missing_match"
  | "invalid_match"
  | "ineligible_evidence"
  | "raw_observation"
  | "missing_observation_date"
  | "invalid_observation_date"
  | "future_observation_date"
  | "missing_quote_validity"
  | "invalid_quote_validity"
  | "future_quote_validity"
  | "expired_quote"
  | "missing_successful_run"
  | "invalid_successful_run"
  | "future_successful_run"
  | "missing_provenance"
  | "blocking_quality"
  | "stale_observation"
  | "breached_cadence"
  | "aging_observation"
  | "due_cadence"
  | "unconfigured_sla"
  | "unknown_freshness"
  | "unknown_cadence"
  | "unknown_quality"
  | "unknown_confidence"
  | "unknown_incident"
  | "approved_assumption"
  | "approved_synthetic"
  | "quality_warning"
  | "advisory_incident"
  | "approved_fallback";

export interface ClaimHealthCellKey {
  consumer: ClaimHealthConsumer;
  domain: ClaimHealthDomain;
  category: string | "not_applicable";
  geography: string | "not_applicable";
  finishTier: string | "not_applicable";
  unitBasis: string | "not_applicable";
  priceScope: string | "not_applicable";
  requiredAuthorityClass: ClaimHealthAuthorityState;
}

export interface ClaimHealthRequiredCellInput {
  cellId: string;
  catalogueId: ClaimHealthCatalogueId;
  requirement: "required" | "optional";
  key: ClaimHealthCellKey;
  match: ClaimHealthMatchState;
  authority: ClaimHealthAuthorityState;
  eligibility: ClaimHealthEligibilityState;
  freshness: ClaimHealthFreshnessState;
  cadence: ClaimHealthCadenceState;
  quality: ClaimHealthQualityState;
  confidence: ClaimHealthConfidenceState;
  incident: ClaimHealthIncidentState;
  observationDateStatus: ClaimHealthEvidenceDateStatus;
  quoteValidity: ClaimHealthQuoteValidityState;
  successfulRun: ClaimHealthSuccessfulRunState;
  slaConfigured: boolean;
  provenanceIdentityKnown: boolean;
  fallbackCode: ClaimHealthFallbackCode | null;
  /** Safe observation/effective date only; never an HTTP-attempt timestamp. */
  observedThrough: string | null;
}

export interface ClaimHealthEvaluationInput {
  policyVersion: string;
  /**
   * Digest of the complete machine-readable policy manifest. Missing or
   * mismatched digests are unsupported, even if the display version matches.
   */
  policyManifestDigest?: string;
  requiredCellSchemaVersion: string;
  evaluatedAt: Date | string;
  /**
   * `missing` is only for persisted artifacts created before EV-04. Live
   * evaluations and newly bound snapshots use `not_applicable` or `present`.
   */
  artifactSnapshot: "not_applicable" | "present" | "missing";
  cells: readonly ClaimHealthRequiredCellInput[];
}

export interface ClaimHealthCatalogueEntry {
  id: ClaimHealthCatalogueId;
  consumers: readonly ClaimHealthConsumer[];
  domain: ClaimHealthDomain | "bound_report_domains";
  denominator:
    | "project_required_allocations"
    | "bound_project_material_cells"
    | "bound_report_safe_cells"
    | "single_static_cell"
    | "approved_required_sources";
  fallbackCodes: readonly ClaimHealthFallbackCode[];
  allowedAuthorities: readonly ClaimHealthAuthorityState[];
  dimensionRules: {
    category: "applicable" | "not_applicable" | "inherited";
    geography: "applicable" | "not_applicable" | "inherited" | "dubai";
    finishTier: "applicable" | "not_applicable" | "inherited";
    unitBasis: "applicable" | "not_applicable" | "inherited";
    priceScope: "applicable" | "not_applicable" | "inherited" | "supply_only";
  };
  initialSla: "configured" | "unconfigured" | "inherited";
}

/**
 * The approved v1 catalogue is closed. This represents its finite templates;
 * project and source-operation instances are expanded only from their approved
 * project/source inputs and never from an enum cartesian product.
 */
export const CLAIM_HEALTH_V1_CATALOGUE = (() => {
  const entries = [
    {
      id: "material-project-v1",
      consumers: [
        "project_workspace",
        "material_cost",
        "design_brief",
        "investor_summary",
      ],
      domain: "material_price",
      denominator: "project_required_allocations",
      fallbackCodes: ["emirate_to_uae"],
      allowedAuthorities: [
        "governed_benchmark",
        "approved_assumption",
        "official_observation",
        "current_supplier_quote",
      ],
      dimensionRules: {
        category: "applicable",
        geography: "applicable",
        finishTier: "applicable",
        unitBasis: "applicable",
        priceScope: "supply_only",
      },
      initialSla: "configured",
    },
    {
      id: "project-report-material-v1",
      consumers: ["stored_project_report"],
      domain: "material_price",
      denominator: "bound_project_material_cells",
      fallbackCodes: ["emirate_to_uae"],
      allowedAuthorities: [
        "governed_benchmark",
        "approved_assumption",
        "official_observation",
        "current_supplier_quote",
      ],
      dimensionRules: {
        category: "applicable",
        geography: "applicable",
        finishTier: "applicable",
        unitBasis: "applicable",
        priceScope: "supply_only",
      },
      initialSla: "inherited",
    },
    {
      id: "report-public-share-v1",
      consumers: ["public_share"],
      domain: "bound_report_domains",
      denominator: "bound_report_safe_cells",
      fallbackCodes: ["emirate_to_uae"],
      allowedAuthorities: [
        "governed_benchmark",
        "approved_assumption",
        "official_observation",
        "current_supplier_quote",
      ],
      dimensionRules: {
        category: "inherited",
        geography: "inherited",
        finishTier: "inherited",
        unitBasis: "inherited",
        priceScope: "inherited",
      },
      initialSla: "inherited",
    },
    {
      id: "dld-indexed-transactions-v1",
      consumers: ["market_evidence"],
      domain: "market_transaction",
      denominator: "single_static_cell",
      fallbackCodes: [],
      allowedAuthorities: ["official_observation"],
      dimensionRules: {
        category: "not_applicable",
        geography: "dubai",
        finishTier: "not_applicable",
        unitBasis: "not_applicable",
        priceScope: "not_applicable",
      },
      initialSla: "unconfigured",
    },
    {
      id: "dld-indexed-rents-v1",
      consumers: ["market_evidence"],
      domain: "market_rent",
      denominator: "single_static_cell",
      fallbackCodes: [],
      allowedAuthorities: ["official_observation"],
      dimensionRules: {
        category: "not_applicable",
        geography: "dubai",
        finishTier: "not_applicable",
        unitBasis: "not_applicable",
        priceScope: "not_applicable",
      },
      initialSla: "unconfigured",
    },
    {
      id: "dld-indexed-projects-v1",
      consumers: ["market_evidence"],
      domain: "project_pipeline",
      denominator: "single_static_cell",
      fallbackCodes: [],
      allowedAuthorities: ["official_observation"],
      dimensionRules: {
        category: "not_applicable",
        geography: "dubai",
        finishTier: "not_applicable",
        unitBasis: "not_applicable",
        priceScope: "not_applicable",
      },
      initialSla: "unconfigured",
    },
    {
      id: "required-source-operations-v1",
      consumers: ["admin_operations"],
      domain: "source_operations",
      denominator: "approved_required_sources",
      fallbackCodes: [],
      allowedAuthorities: ["official_observation"],
      dimensionRules: {
        category: "not_applicable",
        geography: "not_applicable",
        finishTier: "not_applicable",
        unitBasis: "not_applicable",
        priceScope: "not_applicable",
      },
      initialSla: "configured",
    },
  ] as const satisfies readonly ClaimHealthCatalogueEntry[];
  for (const entry of entries) {
    Object.freeze(entry.consumers);
    Object.freeze(entry.fallbackCodes);
    Object.freeze(entry.allowedAuthorities);
    Object.freeze(entry.dimensionRules);
    Object.freeze(entry);
  }
  return Object.freeze(entries);
})();

export type ClaimHealthProjectionCondition =
  | "legacy_or_unsupported_policy"
  | "blocking_incident"
  | "insufficient_required_evidence"
  | "stale_or_breached"
  | "aging_or_due"
  | "unknown_required_state"
  | "qualified_evidence"
  | "approved_fallback"
  | "all_exact_current";

function deepFreezePolicyValue<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreezePolicyValue(child);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Complete semantic v1 policy. Its canonical digest is part of every live
 * evaluation/snapshot identity, so changing a threshold, permission,
 * catalogue entry, or projection order changes the accepted contract even if
 * a developer accidentally forgets to rename the display version.
 */
export const CLAIM_HEALTH_V1_POLICY_MANIFEST = (() => {
  const projectionPriority = [
    {
      priority: 1,
      condition: "legacy_or_unsupported_policy",
      state: "legacy",
    },
    { priority: 2, condition: "blocking_incident", state: "incident" },
    {
      priority: 3,
      condition: "insufficient_required_evidence",
      state: "insufficient",
    },
    { priority: 4, condition: "stale_or_breached", state: "stale" },
    { priority: 5, condition: "aging_or_due", state: "aging" },
    { priority: 6, condition: "unknown_required_state", state: "unknown" },
    { priority: 7, condition: "qualified_evidence", state: "qualified" },
    {
      priority: 8,
      condition: "approved_fallback",
      state: "current_with_fallback",
    },
    { priority: 9, condition: "all_exact_current", state: "current" },
  ] as const satisfies readonly {
    priority: number;
    condition: ClaimHealthProjectionCondition;
    state: CustomerClaimHealthState;
  }[];
  const authorityRules = deepFreezePolicyValue({
    rawObservationAuthoritative: false,
    assumptionAlwaysQualified: true,
    syntheticAlwaysQualified: true,
    syntheticRequiresExplicitCataloguePermission: true,
    actualAuthorityMustMatchRequiredClass: true,
    governedIdentity: Object.freeze({
      approvedAssumption: Object.freeze({
        format: "assumption:<provenancePolicyVersion>:<benchmarkVersion>",
        prefix: "assumption",
      }),
      supplierQuote: Object.freeze({
        format: "supplier_quote:<sameOrganizationQuoteId>",
        prefix: "supplier_quote",
      }),
      registryBackedEvidence: "exact_governed_registry_identity_required",
      displayLabelIsIdentity: false,
    }),
    sourceLadderIdentityClass: Object.freeze({
      assumption: "governed_assumption_identity",
      supplier_quote: "same_organization_quote_identity",
      official_statistic: "registry_backed",
      consultancy_benchmark: "registry_backed",
      market_observation: "registry_backed",
      retail_sanity: "ineligible",
    }),
  });
  const projectionReasonGroups = Object.freeze({
    incident: Object.freeze(["blocking_incident"] as const),
    insufficient: Object.freeze([
      "invalid_evaluation_clock",
      "empty_required_set",
      "duplicate_cell_id",
      "catalogue_mismatch",
      "authority_mismatch",
      "authority_not_permitted",
      "fallback_not_permitted",
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
      "missing_successful_run",
      "invalid_successful_run",
      "future_successful_run",
      "missing_provenance",
      "blocking_quality",
    ] as const satisfies readonly ClaimHealthReasonCode[]),
    stale: Object.freeze([
      "expired_quote",
      "stale_observation",
      "breached_cadence",
    ] as const satisfies readonly ClaimHealthReasonCode[]),
    aging: Object.freeze([
      "aging_observation",
      "due_cadence",
    ] as const satisfies readonly ClaimHealthReasonCode[]),
    unknown: Object.freeze([
      "unconfigured_sla",
      "unknown_freshness",
      "unknown_cadence",
      "unknown_quality",
      "unknown_confidence",
      "unknown_incident",
    ] as const satisfies readonly ClaimHealthReasonCode[]),
    qualified: Object.freeze([
      "approved_assumption",
      "approved_synthetic",
      "quality_warning",
      "advisory_incident",
    ] as const satisfies readonly ClaimHealthReasonCode[]),
  });
  const freshness = Object.freeze({
    marketObservation: Object.freeze({
      currentThroughDays: 90,
      agingThroughDays: 365,
      afterAging: "stale",
    }),
    supplierQuote: Object.freeze({
      currentThroughValidUntilInclusive: true,
      missingValidity: "insufficient",
      expiredValidityState: "expired",
      expiredClaimState: "stale",
    }),
    assumption: "not_applicable",
    officialAndConsultancy: "source_specific_unconfigured",
  });
  const cadence = Object.freeze({
    weeklyRequiredSource: Object.freeze({
      onTimeThroughDays: 7,
      dueThroughDays: 8,
      afterDue: "breached",
      clock: "last_successful_required_run_only",
    }),
  });
  const incidentPolicy = deepFreezePolicyValue({
    catalogue: [
      { type: "required_run_missed", alwaysBlocking: false },
      { type: "repeated_source_failure", alwaysBlocking: false },
      { type: "source_authorization_revoked", alwaysBlocking: false },
      { type: "unexpected_zero", alwaysBlocking: false },
      { type: "anomalous_extraction", alwaysBlocking: false },
      { type: "corrupted_source_content", alwaysBlocking: true },
      { type: "provenance_digest_mismatch", alwaysBlocking: true },
      { type: "quality_quarantine_backlog", alwaysBlocking: false },
      { type: "confidentiality_concern", alwaysBlocking: true },
      { type: "tenant_boundary_concern", alwaysBlocking: true },
      { type: "stale_mandatory_evidence", alwaysBlocking: false },
    ] as const satisfies readonly {
      type: ClaimHealthIncidentType;
      alwaysBlocking: boolean;
    }[],
    severity: {
      allowed: ["advisory", "blocking"] as const,
      strongestOrder: ["none", "advisory", "blocking"] as const,
      onlyExplicitBlockingOrAlwaysBlockingTypeForcesIncident: true,
    },
    composition: {
      applicableScopes: [
        "platform",
        "organization",
        "project",
        "supplier_quote",
      ] as const satisfies readonly ClaimHealthIncidentScope[],
      platformAppliesOnlyToNamedPlatformPublicSource: true,
      tenantScopesRequireExactOrganization: true,
      projectScopeRequiresExactProject: true,
      supplierQuoteScopeRequiresExactQuote: true,
      activeLifecycleStates: ["open", "acknowledged"] as const,
      resolvedContributes: "none",
      aggregate: "strongest_applicable_state",
      missingEffectiveState: "unknown",
    },
    lifecycleTransitions: [
      {
        prior: "absent",
        event: "opened",
        result: "open",
      },
      {
        prior: "open",
        event: "acknowledged",
        result: "acknowledged",
      },
      { prior: "open", event: "resolved", result: "resolved" },
      {
        prior: "acknowledged",
        event: "resolved",
        result: "resolved",
      },
      { prior: "resolved", event: "reopened", result: "open" },
    ] as const satisfies readonly {
      prior: ClaimHealthIncidentLifecycleState;
      event: ClaimHealthIncidentEventType;
      result: Exclude<ClaimHealthIncidentLifecycleState, "absent">;
    }[],
    actors: {
      systemDetector: {
        scopes: ["platform"] as const,
        events: ["opened", "reopened"] as const,
        identity: "system:<detectorPolicyVersion>",
      },
      platformAdministrator: {
        scopes: ["platform"] as const,
        events: ["opened", "acknowledged", "resolved", "reopened"] as const,
      },
      organizationAdministrator: {
        scopes: ["organization", "project", "supplier_quote"] as const,
        events: ["opened", "acknowledged", "resolved", "reopened"] as const,
        exactResourceAuthorizationRequired: true,
      },
    },
    events: {
      appendOnly: true,
      actorBoundIdempotencyPayloadMustMatch: true,
      effectiveAtOrBeforeEvaluationClock: true,
    },
  });
  const eligibilityRules = deepFreezePolicyValue({
    organizationEvaluationCorpus: [
      "same_organization",
      "platform_public",
    ] as const,
    forbiddenCorpus: ["foreign_organization", "legacy_unscoped"] as const,
    registryBackedRequiredBooleanFacts: [
      "termsApproved",
      "sourceActive",
      "sourceWhitelisted",
      "consumerAuthorized",
      "confidentialityEligible",
      "tenantEligible",
      "sourcePolicyVersionMatches",
      "governedSourceIdentityKnown",
    ] as const satisfies readonly (keyof ClaimHealthGovernedSourceEligibilityFacts)[],
    registryBackedIdentityMustBeNonEmpty: true,
    registryBackedBindingRequiresExactRegistryIdSlugAndRevision: true,
    registryBackedBindingRequiresSourcePolicyVersion: true,
    registryBackedRevisionFormat: "sha256",
    missingFactFailsClosed: true,
    rawObservationAuthoritative: false,
    governedProposalRequiredFacts: [
      "proposalIdentityMatches",
      "specificationIdentityMatches",
      "humanApprovalComplete",
      "notSuperseded",
      "priceScopeMatches",
      "sourceLadderMatches",
      "provenancePolicyMatches",
      "benchmarkVersionMatches",
      "tenantOrPlatformPublicScopeEligible",
    ] as const,
    quote: {
      requiredFacts: ["organizationScoped", "notSuperseded"] as const,
      sameOrganizationRequired: true,
      unsupersededRequired: true,
      knownUnexpiredValidityRequired: true,
      exactSpecificationAndPriceScopeRequired: true,
      consumerConfidentialityRequired: true,
    },
  });
  const artifactBinding = deepFreezePolicyValue({
    storedProjectReport: {
      bindExactlyOnce: "report_persistence_transaction",
      evaluationClock: "same_report_operation_clock",
      denominator: "frozen_project_material_cells",
      existingStricterCompletenessGatePreserved: true,
      grantsIssueOrApprovalAuthority: false,
    },
    reportBackedPublicShare: {
      inheritsFrozenSafeProjection: true,
      liveRecomputation: false,
    },
    legacyArtifactWithoutSnapshot: "legacy",
    renderInputFingerprintIsIssuanceSnapshot: false,
    snapshotMutation: "append_only",
  });
  const retention = deepFreezePolicyValue({
    healthSnapshot: {
      lifecycle: "bound_artifact_lifecycle",
      deletionRequiresApprovedArtifactRetentionOperation: true,
    },
    incidentHistory: {
      decisionStatus: "sc06_pdpl_not_approved",
      persistenceOutsideDisposableDevelopmentTests: false,
      disposableDatabaseNamePrefixes: [
        "miyar_auth_test",
        "miyar_test_tr13_",
      ] as const,
      appendOnlyUntilApprovedRetentionOperation: true,
      deletionRequiresApprovedSc06PdplRetentionOperation: true,
    },
  });
  for (const row of projectionPriority) Object.freeze(row);
  Object.freeze(projectionPriority);
  return deepFreezePolicyValue({
    policyVersion: CLAIM_HEALTH_POLICY_VERSION,
    requiredCellSchemaVersion: CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
    emptyRequiredSet: "insufficient",
    exactRequiredCoveragePercentForCurrent: 100,
    freshness,
    cadence,
    projectionPriority,
    projectionReasonGroups,
    authorityRules,
    eligibilityRules,
    incidentPolicy,
    artifactBinding,
    retention,
    catalogue: CLAIM_HEALTH_V1_CATALOGUE,
  });
})();

export interface ClaimHealthSafeCell {
  /** Deterministic opaque reference; the internal cell/allocation ID is never exposed. */
  cellRef: `sha256:${string}`;
  catalogueId: ClaimHealthCatalogueId;
  requirement: "required" | "optional";
  match: ClaimHealthMatchState;
  authority: ClaimHealthAuthorityState;
  freshness: ClaimHealthFreshnessState;
  cadence: ClaimHealthCadenceState;
  quality: ClaimHealthQualityState;
  confidence: ClaimHealthConfidenceState;
  incident: ClaimHealthIncidentState;
  fallbackCode: ClaimHealthFallbackCode | null;
  observedThrough: string | null;
  reasonCodes: readonly ClaimHealthReasonCode[];
}

export interface ClaimHealthSafeProjection {
  claimState: CustomerClaimHealthState;
  evaluatedAt: string | null;
  policyVersion: string;
  policyManifestDigest: string | null;
  requiredCellSchemaVersion: string;
  counts: {
    required: number;
    eligible: number;
    exact: number;
    fallback: number;
    optional: number;
  };
  reasonCodes: readonly ClaimHealthReasonCode[];
  cells: readonly ClaimHealthSafeCell[];
}

export interface ClaimHealthEvaluation {
  policySupported: boolean;
  policyManifestSupported: boolean;
  requiredCellSchemaSupported: boolean;
  safeProjection: ClaimHealthSafeProjection;
}

export interface ClaimHealthDigests {
  algorithm: typeof CLAIM_HEALTH_DIGEST_ALGORITHM;
  inputDigest: `sha256:${string}`;
  contentDigest: `sha256:${string}`;
}
