import { describe, expect, it } from "vitest";

import {
  CLAIM_HEALTH_POLICY_VERSION,
  CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
  CLAIM_HEALTH_V1_CATALOGUE,
  CLAIM_HEALTH_V1_POLICY_MANIFEST,
  type ClaimHealthEvaluationInput,
  type ClaimHealthRequiredCellInput,
  type CustomerClaimHealthState,
} from "../../../shared/claim-health";
import {
  canonicalizeClaimHealth,
  CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON,
  CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
  createClaimHealthValueDigest,
  createClaimHealthDigests,
  createClaimHealthInputDigest,
  composeClaimHealthIncidentStates,
  evaluateClaimHealth,
  evaluateGovernedSourceEligibility,
  evaluateMarketObservationFreshness,
  evaluateSupplierQuoteValidity,
  evaluateWeeklyRequiredSourceCadence,
  resolveClaimHealthIncidentSeverity,
  resolveClaimHealthIncidentTransition,
} from "./claim-health";
import {
  computeFreshness,
  FRESHNESS_AGING_DAYS,
  FRESHNESS_FRESH_DAYS,
  FRESHNESS_WEIGHT_AGING,
  FRESHNESS_WEIGHT_FRESH,
  FRESHNESS_WEIGHT_STALE,
  getFreshnessWeight,
} from "./freshness";

const CLOCK = new Date("2026-07-30T12:00:00.000Z");

function requiredCell(
  overrides: Partial<ClaimHealthRequiredCellInput> & {
    key?: Partial<ClaimHealthRequiredCellInput["key"]>;
  } = {}
): ClaimHealthRequiredCellInput {
  const { key: keyOverrides, ...cellOverrides } = overrides;
  const key: ClaimHealthRequiredCellInput["key"] = {
    consumer: "project_workspace",
    domain: "material_price",
    category: "floors",
    geography: "dubai",
    finishTier: "premium",
    unitBasis: "per_sqm",
    priceScope: "supply_only",
    requiredAuthorityClass: "governed_benchmark",
    ...keyOverrides,
  };
  return {
    cellId: "allocation-1",
    catalogueId: "material-project-v1",
    requirement: "required",
    match: "exact",
    authority: "governed_benchmark",
    eligibility: "eligible",
    freshness: "current",
    cadence: "not_applicable",
    quality: "pass",
    confidence: "known",
    incident: "none",
    observationDateStatus: "valid",
    quoteValidity: "not_applicable",
    successfulRun: "not_applicable",
    slaConfigured: true,
    provenanceIdentityKnown: true,
    fallbackCode: null,
    observedThrough: "2026-07-01T00:00:00.000Z",
    ...cellOverrides,
    key,
  };
}

function evaluationInput(
  cells: readonly ClaimHealthRequiredCellInput[] = [requiredCell()],
  overrides: Partial<ClaimHealthEvaluationInput> = {}
): ClaimHealthEvaluationInput {
  return {
    policyVersion: CLAIM_HEALTH_POLICY_VERSION,
    policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
    requiredCellSchemaVersion: CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
    evaluatedAt: CLOCK,
    artifactSnapshot: "not_applicable",
    cells,
    ...overrides,
  };
}

function stateFor(
  overrides: Partial<ClaimHealthRequiredCellInput> & {
    key?: Partial<ClaimHealthRequiredCellInput["key"]>;
  }
): CustomerClaimHealthState {
  return evaluateClaimHealth(evaluationInput([requiredCell(overrides)]))
    .safeProjection.claimState;
}

describe("EV-04 total projection matrix", () => {
  it.each<{
    name: string;
    cells: ClaimHealthRequiredCellInput[];
    input?: Partial<ClaimHealthEvaluationInput>;
    expected: CustomerClaimHealthState;
  }>([
    {
      name: "unsupported policy is legacy",
      cells: [requiredCell({ incident: "blocking" })],
      input: { policyVersion: "ev04-claim-health-v0" },
      expected: "legacy",
    },
    {
      name: "matching version with a different manifest digest is legacy",
      cells: [requiredCell()],
      input: { policyManifestDigest: "sha256:deadbeef" },
      expected: "legacy",
    },
    {
      name: "a legacy artifact without a snapshot is legacy",
      cells: [requiredCell()],
      input: { artifactSnapshot: "missing" },
      expected: "legacy",
    },
    {
      name: "blocking incident precedes insufficiency",
      cells: [requiredCell({ incident: "blocking", match: "missing" })],
      expected: "incident",
    },
    {
      name: "missing match is insufficient",
      cells: [requiredCell({ match: "missing" })],
      expected: "insufficient",
    },
    {
      name: "stale observation precedes aging cadence",
      cells: [
        requiredCell({
          freshness: "stale",
          cadence: "due",
          successfulRun: "valid",
        }),
      ],
      expected: "stale",
    },
    {
      name: "aging observation precedes unknown quality",
      cells: [requiredCell({ freshness: "aging", quality: "unknown" })],
      expected: "aging",
    },
    {
      name: "unconfigured SLA precedes qualification",
      cells: [
        requiredCell({
          slaConfigured: false,
          authority: "approved_assumption",
          key: { requiredAuthorityClass: "approved_assumption" },
          freshness: "not_applicable",
          observationDateStatus: "not_applicable",
        }),
      ],
      expected: "unknown",
    },
    {
      name: "warning qualifies exact evidence",
      cells: [requiredCell({ quality: "warning" })],
      expected: "qualified",
    },
    {
      name: "approved fallback remains labelled",
      cells: [
        requiredCell({
          match: "approved_fallback",
          fallbackCode: "emirate_to_uae",
        }),
      ],
      expected: "current_with_fallback",
    },
    {
      name: "all exact gates produce current",
      cells: [requiredCell()],
      expected: "current",
    },
  ])("$name", ({ cells, input, expected }) => {
    const result = evaluateClaimHealth(evaluationInput(cells, input));
    expect(result.safeProjection.claimState).toBe(expected);
  });

  it("never treats an empty required set as current by vacuous truth", () => {
    const empty = evaluateClaimHealth(evaluationInput([])).safeProjection;
    expect(empty.claimState).toBe("insufficient");
    expect(empty.counts.required).toBe(0);
    expect(empty.reasonCodes).toContain("empty_required_set");

    const optionalOnly = evaluateClaimHealth(
      evaluationInput([requiredCell({ requirement: "optional" })])
    ).safeProjection;
    expect(optionalOnly.claimState).toBe("insufficient");
    expect(optionalOnly.counts).toMatchObject({ required: 0, optional: 1 });
  });

  it("ignores optional failures when projecting the required denominator", () => {
    const projection = evaluateClaimHealth(
      evaluationInput([
        requiredCell(),
        requiredCell({
          cellId: "optional-bad",
          requirement: "optional",
          match: "missing",
          incident: "blocking",
        }),
      ])
    ).safeProjection;
    expect(projection.claimState).toBe("current");
    expect(projection.counts).toEqual({
      required: 1,
      eligible: 1,
      exact: 1,
      fallback: 0,
      optional: 1,
    });
  });

  it("fails closed on duplicate cell identities and catalogue mismatches", () => {
    const duplicate = evaluateClaimHealth(
      evaluationInput([requiredCell(), requiredCell()])
    ).safeProjection;
    expect(duplicate.claimState).toBe("insufficient");
    expect(duplicate.reasonCodes).toContain("duplicate_cell_id");

    expect(
      stateFor({
        catalogueId: "dld-indexed-transactions-v1",
      })
    ).toBe("insufficient");
  });

  it("does not permit a fallback not named by the catalogue", () => {
    expect(
      stateFor({
        catalogueId: "dld-indexed-transactions-v1",
        key: {
          consumer: "market_evidence",
          domain: "market_transaction",
        },
        match: "approved_fallback",
        fallbackCode: "emirate_to_uae",
      })
    ).toBe("insufficient");
  });

  it("maps every fail-closed insufficiency boundary", () => {
    const cases: Array<Partial<ClaimHealthRequiredCellInput>> = [
      { match: "invalid" },
      { eligibility: "ineligible" },
      { authority: "raw_observation" },
      { observationDateStatus: "missing" },
      { observationDateStatus: "invalid" },
      { observationDateStatus: "future" },
      { quality: "blocking" },
      { provenanceIdentityKnown: false },
      { successfulRun: "missing", cadence: "unknown" },
      { successfulRun: "invalid", cadence: "unknown" },
      { successfulRun: "future", cadence: "unknown" },
    ];
    for (const cell of cases) {
      expect(stateFor(cell)).toBe("insufficient");
    }
  });

  it("maps unknown states only when no more severe condition applies", () => {
    expect(
      stateFor({
        freshness: "unknown",
        cadence: "unknown",
        quality: "unknown",
        confidence: "unknown",
        incident: "unknown",
        observationDateStatus: "valid",
        successfulRun: "valid",
      })
    ).toBe("unknown");
    expect(
      stateFor({
        freshness: "unknown",
        observationDateStatus: "missing",
      })
    ).toBe("insufficient");
  });

  it("qualifies an explicitly permitted assumption", () => {
    expect(
      stateFor({
        authority: "approved_assumption",
        key: { requiredAuthorityClass: "approved_assumption" },
        freshness: "not_applicable",
        observationDateStatus: "not_applicable",
      })
    ).toBe("qualified");
  });

  it("fails the reviewer authority-confusion reproduction closed", () => {
    const mismatched = evaluateClaimHealth(
      evaluationInput([
        requiredCell({
          authority: "approved_assumption",
          freshness: "not_applicable",
          observationDateStatus: "not_applicable",
        }),
      ])
    ).safeProjection;
    expect(mismatched.claimState).toBe("insufficient");
    expect(mismatched.reasonCodes).toContain("authority_mismatch");

    const synthetic = evaluateClaimHealth(
      evaluationInput([
        requiredCell({
          authority: "approved_synthetic",
          key: { requiredAuthorityClass: "approved_synthetic" },
          freshness: "not_applicable",
          observationDateStatus: "not_applicable",
        }),
      ])
    ).safeProjection;
    expect(synthetic.claimState).toBe("insufficient");
    expect(synthetic.reasonCodes).toContain("authority_not_permitted");
  });

  it("projects injected advisory incidents as qualified", () => {
    const projection = evaluateClaimHealth(
      evaluationInput([requiredCell({ incident: "advisory" })])
    ).safeProjection;
    expect(projection.claimState).toBe("qualified");
    expect(projection.reasonCodes).toContain("advisory_incident");
  });

  it("makes the approved policy and catalogue identities exact and closed", () => {
    expect(CLAIM_HEALTH_POLICY_VERSION).toBe("ev04-claim-health-v1");
    expect(CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION).toBe(
      "ev04-required-cell-v1"
    );
    expect(CLAIM_HEALTH_V1_CATALOGUE.map(entry => entry.id)).toEqual([
      "material-project-v1",
      "project-report-material-v1",
      "report-public-share-v1",
      "dld-indexed-transactions-v1",
      "dld-indexed-rents-v1",
      "dld-indexed-projects-v1",
      "required-source-operations-v1",
    ]);
    expect(Object.isFrozen(CLAIM_HEALTH_V1_CATALOGUE)).toBe(true);
    expect(
      CLAIM_HEALTH_V1_CATALOGUE.every(
        entry =>
          Object.isFrozen(entry) &&
          Object.isFrozen(entry.consumers) &&
          Object.isFrozen(entry.fallbackCodes)
      )
    ).toBe(true);
    expect(CLAIM_HEALTH_V1_POLICY_MANIFEST).toMatchObject({
      policyVersion: "ev04-claim-health-v1",
      requiredCellSchemaVersion: "ev04-required-cell-v1",
      freshness: {
        marketObservation: {
          currentThroughDays: 90,
          agingThroughDays: 365,
        },
      },
      cadence: {
        weeklyRequiredSource: {
          onTimeThroughDays: 7,
          dueThroughDays: 8,
        },
      },
    });
    expect(
      CLAIM_HEALTH_V1_POLICY_MANIFEST.projectionPriority.map(row => row.state)
    ).toEqual([
      "legacy",
      "incident",
      "insufficient",
      "stale",
      "aging",
      "unknown",
      "qualified",
      "current_with_fallback",
      "current",
    ]);
  });

  it("binds the policy identity to every semantic manifest field", () => {
    expect(createClaimHealthValueDigest(CLAIM_HEALTH_V1_POLICY_MANIFEST)).toBe(
      CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST
    );
    expect(CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON).toBe(
      canonicalizeClaimHealth(CLAIM_HEALTH_V1_POLICY_MANIFEST)
    );
    expect(CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST).toBe(
      "sha256:6da6e3982c97b8ce645945fc3af3cdc2b22d02ccf4ae6140fc0eaac63adb1c9b"
    );
    const changedThreshold = {
      ...CLAIM_HEALTH_V1_POLICY_MANIFEST,
      freshness: {
        ...CLAIM_HEALTH_V1_POLICY_MANIFEST.freshness,
        marketObservation: {
          ...CLAIM_HEALTH_V1_POLICY_MANIFEST.freshness.marketObservation,
          currentThroughDays: 91,
        },
      },
    };
    expect(createClaimHealthValueDigest(changedThreshold)).not.toBe(
      CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST
    );
  });

  it("changes the digest when any manifest leaf changes", () => {
    const collectLeafPaths = (
      value: unknown,
      path: Array<string | number> = []
    ): Array<Array<string | number>> => {
      if (value === null || typeof value !== "object") return [path];
      return Object.entries(value).flatMap(([key, child]) =>
        collectLeafPaths(
          child,
          path.concat(Array.isArray(value) ? Number(key) : key)
        )
      );
    };
    const paths = collectLeafPaths(CLAIM_HEALTH_V1_POLICY_MANIFEST);
    expect(paths.length).toBeGreaterThan(100);
    for (const path of paths) {
      const mutated = structuredClone(CLAIM_HEALTH_V1_POLICY_MANIFEST) as any;
      let parent = mutated;
      for (const key of path.slice(0, -1)) parent = parent[key];
      const key = path[path.length - 1];
      const current = parent[key];
      parent[key] =
        typeof current === "boolean"
          ? !current
          : typeof current === "number"
            ? current + 1
            : `${current}:mutated`;
      expect(
        createClaimHealthValueDigest(mutated),
        `manifest leaf ${path.join(".")} must affect the digest`
      ).not.toBe(CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST);
    }
  });

  it("derives incident authority semantics from the manifest", () => {
    expect(
      resolveClaimHealthIncidentSeverity("tenant_boundary_concern", "advisory")
    ).toBe("blocking");
    expect(
      resolveClaimHealthIncidentSeverity("repeated_source_failure", "advisory")
    ).toBe("advisory");
    expect(resolveClaimHealthIncidentTransition("absent", "opened")).toBe(
      "open"
    );
    expect(
      resolveClaimHealthIncidentTransition("acknowledged", "resolved")
    ).toBe("resolved");
    expect(
      resolveClaimHealthIncidentTransition("resolved", "acknowledged")
    ).toBeNull();
    expect(
      composeClaimHealthIncidentStates(["advisory", "blocking", undefined])
    ).toBe("blocking");
    expect(composeClaimHealthIncidentStates(["advisory", undefined])).toBe(
      "unknown"
    );
    expect(composeClaimHealthIncidentStates(["none", "advisory"])).toBe(
      "advisory"
    );
  });

  it("derives registry eligibility from the manifest-required facts", () => {
    const eligible = {
      termsApproved: true,
      sourceActive: true,
      sourceWhitelisted: true,
      consumerAuthorized: true,
      confidentialityEligible: true,
      tenantEligible: true,
      sourcePolicyVersionMatches: true,
      governedSourceIdentityKnown: true,
      governedSourceIdentity: "registry:source-1",
      governedSourceRegistryId: 1,
      governedSourceSlug: "source-1",
      governedSourcePolicyVersion: "source-policy-v1",
      governedSourceRevision: `sha256:${"a".repeat(64)}`,
    } as const;
    expect(evaluateGovernedSourceEligibility(eligible)).toBe("eligible");
    for (const key of CLAIM_HEALTH_V1_POLICY_MANIFEST.eligibilityRules
      .registryBackedRequiredBooleanFacts) {
      expect(
        evaluateGovernedSourceEligibility({ ...eligible, [key]: false })
      ).toBe("ineligible");
    }
    expect(
      evaluateGovernedSourceEligibility({
        ...eligible,
        governedSourceRevision: null,
      })
    ).toBe("ineligible");
  });
});

describe("EV-04 freshness and cadence boundary clocks", () => {
  it("uses exact 90/365 day market-observation boundaries", () => {
    const before = (days: number, extraMillis = 0) =>
      new Date(CLOCK.getTime() - days * 86_400_000 - extraMillis);

    expect(
      evaluateMarketObservationFreshness({
        observedAt: before(90),
        evaluatedAt: CLOCK,
      }).freshness
    ).toBe("current");
    expect(
      evaluateMarketObservationFreshness({
        observedAt: before(90, 1),
        evaluatedAt: CLOCK,
      }).freshness
    ).toBe("aging");
    expect(
      evaluateMarketObservationFreshness({
        observedAt: before(365),
        evaluatedAt: CLOCK,
      }).freshness
    ).toBe("aging");
    expect(
      evaluateMarketObservationFreshness({
        observedAt: before(365, 1),
        evaluatedAt: CLOCK,
      }).freshness
    ).toBe("stale");
  });

  it("rejects missing, invalid, and future observation dates", () => {
    expect(
      evaluateMarketObservationFreshness({
        observedAt: null,
        evaluatedAt: CLOCK,
      })
    ).toMatchObject({
      freshness: "unknown",
      observationDateStatus: "missing",
    });
    expect(
      evaluateMarketObservationFreshness({
        observedAt: "2026-02-30",
        evaluatedAt: CLOCK,
      })
    ).toMatchObject({
      freshness: "unknown",
      observationDateStatus: "invalid",
    });
    expect(
      evaluateMarketObservationFreshness({
        observedAt: "2026-07-31T00:00:00Z",
        evaluatedAt: CLOCK,
      })
    ).toMatchObject({
      freshness: "unknown",
      observationDateStatus: "future",
    });
  });

  it("keeps unconfigured official/dataset freshness unknown", () => {
    expect(
      evaluateMarketObservationFreshness({
        observedAt: "2026-07-01",
        evaluatedAt: CLOCK,
        slaConfigured: false,
      })
    ).toMatchObject({
      freshness: "unknown",
      observationDateStatus: "valid",
    });
  });

  it("treats quotes as valid through the exact valid-until instant", () => {
    expect(
      evaluateSupplierQuoteValidity({
        validUntil: CLOCK,
        evaluatedAt: CLOCK,
      }).quoteValidity
    ).toBe("valid");
    expect(
      evaluateSupplierQuoteValidity({
        validUntil: new Date(CLOCK.getTime() - 1),
        evaluatedAt: CLOCK,
      }).quoteValidity
    ).toBe("expired");
    expect(
      evaluateSupplierQuoteValidity({
        validUntil: null,
        evaluatedAt: CLOCK,
      }).quoteValidity
    ).toBe("missing");
    expect(
      evaluateSupplierQuoteValidity({
        validUntil: "not-a-date",
        evaluatedAt: CLOCK,
      }).quoteValidity
    ).toBe("invalid");
  });

  it("projects quote validity without treating quote age as observation age", () => {
    const quote = {
      authority: "current_supplier_quote" as const,
      key: { requiredAuthorityClass: "current_supplier_quote" as const },
      freshness: "not_applicable" as const,
      observationDateStatus: "not_applicable" as const,
    };
    expect(stateFor({ ...quote, quoteValidity: "valid" })).toBe("current");
    expect(stateFor({ ...quote, quoteValidity: "expired" })).toBe("stale");
    expect(stateFor({ ...quote, quoteValidity: "missing" })).toBe(
      "insufficient"
    );
    expect(stateFor({ ...quote, quoteValidity: "not_applicable" })).toBe(
      "insufficient"
    );
  });

  it("uses exact day 7/day 8 successful-run cadence boundaries", () => {
    const runAt = (days: number, extraMillis = 0) =>
      new Date(CLOCK.getTime() - days * 86_400_000 - extraMillis);
    expect(
      evaluateWeeklyRequiredSourceCadence({
        lastSuccessfulRunAt: runAt(7),
        evaluatedAt: CLOCK,
      }).cadence
    ).toBe("on_time");
    expect(
      evaluateWeeklyRequiredSourceCadence({
        lastSuccessfulRunAt: runAt(7, 1),
        evaluatedAt: CLOCK,
      }).cadence
    ).toBe("due");
    expect(
      evaluateWeeklyRequiredSourceCadence({
        lastSuccessfulRunAt: runAt(8),
        evaluatedAt: CLOCK,
      }).cadence
    ).toBe("due");
    expect(
      evaluateWeeklyRequiredSourceCadence({
        lastSuccessfulRunAt: runAt(8, 1),
        evaluatedAt: CLOCK,
      }).cadence
    ).toBe("breached");
  });

  it("does not invent a successful run", () => {
    expect(
      evaluateWeeklyRequiredSourceCadence({
        lastSuccessfulRunAt: null,
        evaluatedAt: CLOCK,
      })
    ).toMatchObject({ cadence: "unknown", successfulRun: "missing" });
    expect(
      evaluateWeeklyRequiredSourceCadence({
        lastSuccessfulRunAt: new Date(CLOCK.getTime() + 1),
        evaluatedAt: CLOCK,
      })
    ).toMatchObject({ cadence: "unknown", successfulRun: "future" });
    expect(
      stateFor({
        cadence: "on_time",
        successfulRun: "not_applicable",
      })
    ).toBe("insufficient");
  });
});

describe("EV-04 canonical projections and digests", () => {
  it("never exposes the internal cell identifier in the safe DTO", () => {
    const projection = evaluateClaimHealth(
      evaluationInput([
        requiredCell({
          cellId: "org-77/project-88/private-allocation-99",
          observedThrough: "2027-01-01T00:00:00Z",
        }),
      ])
    ).safeProjection;
    const encoded = JSON.stringify(projection);
    expect(encoded).not.toContain("org-77");
    expect(encoded).not.toContain("project-88");
    expect(encoded).not.toContain("private-allocation-99");
    expect(projection.cells[0].cellRef).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(projection.cells[0].observedThrough).toBeNull();
  });

  it("canonicalizes object keys, equivalent clocks, and required-cell order", () => {
    const first = evaluationInput([
      requiredCell({ cellId: "b" }),
      requiredCell({ cellId: "a" }),
    ]);
    const second = {
      cells: [requiredCell({ cellId: "a" }), requiredCell({ cellId: "b" })],
      artifactSnapshot: "not_applicable",
      evaluatedAt: CLOCK.toISOString(),
      requiredCellSchemaVersion: CLAIM_HEALTH_REQUIRED_CELL_SCHEMA_VERSION,
      policyVersion: CLAIM_HEALTH_POLICY_VERSION,
      policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
    } satisfies ClaimHealthEvaluationInput;

    expect(createClaimHealthInputDigest(first)).toBe(
      createClaimHealthInputDigest(second)
    );
    expect(canonicalizeClaimHealth({ z: 1, a: 2 })).toBe(
      canonicalizeClaimHealth({ a: 2, z: 1 })
    );
  });

  it("changes input and content digests when a required fact changes", () => {
    const currentInput = evaluationInput([requiredCell()]);
    const staleInput = evaluationInput([requiredCell({ freshness: "stale" })]);
    const changedKeyInput = evaluationInput([
      requiredCell({ key: { category: "walls" } }),
    ]);
    const currentEvaluation = evaluateClaimHealth(currentInput);
    const staleEvaluation = evaluateClaimHealth(staleInput);
    const currentDigests = createClaimHealthDigests(
      currentInput,
      currentEvaluation
    );
    const repeatedDigests = createClaimHealthDigests(
      currentInput,
      evaluateClaimHealth(currentInput)
    );
    const staleDigests = createClaimHealthDigests(staleInput, staleEvaluation);
    const changedKeyDigests = createClaimHealthDigests(
      changedKeyInput,
      evaluateClaimHealth(changedKeyInput)
    );

    expect(currentDigests).toEqual(repeatedDigests);
    expect(currentDigests.inputDigest).not.toBe(staleDigests.inputDigest);
    expect(currentDigests.contentDigest).not.toBe(staleDigests.contentDigest);
    expect(currentDigests.inputDigest).not.toBe(changedKeyDigests.inputDigest);
    expect(currentDigests.contentDigest).not.toBe(
      changedKeyDigests.contentDigest
    );
    expect(currentDigests.inputDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects non-canonical undefined and non-finite inputs", () => {
    expect(() => canonicalizeClaimHealth({ bad: undefined })).toThrow(
      "Undefined value"
    );
    expect(() => canonicalizeClaimHealth({ bad: Number.NaN })).toThrow(
      "Non-finite number"
    );
  });
});

describe("EV-04 compatibility non-regression", () => {
  it("does not change legacy proposal/scheduler freshness numerics", () => {
    expect(FRESHNESS_FRESH_DAYS).toBe(90);
    expect(FRESHNESS_AGING_DAYS).toBe(365);
    expect(FRESHNESS_WEIGHT_FRESH).toBe(1);
    expect(FRESHNESS_WEIGHT_AGING).toBe(0.75);
    expect(FRESHNESS_WEIGHT_STALE).toBe(0.5);

    const at90 = new Date(CLOCK.getTime() - 90 * 86_400_000);
    const at365 = new Date(CLOCK.getTime() - 365 * 86_400_000);
    const after365 = new Date(CLOCK.getTime() - 366 * 86_400_000);
    expect(computeFreshness(at90, CLOCK)).toMatchObject({
      status: "fresh",
      weight: 1,
    });
    expect(computeFreshness(at365, CLOCK)).toMatchObject({
      status: "aging",
      weight: 0.75,
    });
    expect(computeFreshness(after365, CLOCK)).toMatchObject({
      status: "stale",
      weight: 0.5,
    });
    expect(getFreshnessWeight(at365, CLOCK)).toBe(0.75);
  });
});
