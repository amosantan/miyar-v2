import { describe, expect, it } from "vitest";
import type { MaterialAllocation } from "../../../drizzle/schema";
import type { MaterialPriceSnapshot } from "../../../shared/material-calculations";
import { evaluateProjectClaimHealth } from "./project-claim-health";
import {
  buildProjectClaimHealthAuthorityBinding,
  buildProjectMaterialClaimHealthFacts,
  createClaimHealthGovernedSourceRevision,
  resolveProjectClaimHealthIncidentSourceIdentity,
} from "./project-claim-health-loader";

const allocation = {
  id: 41,
  projectId: 7,
  organizationId: 5,
  materialLibraryId: 12,
  resolvedUnitBasis: "per_sqm",
} as MaterialAllocation;

function snapshot(
  sourceLadderRung:
    | "assumption"
    | "market_observation"
    | "supplier_quote" = "assumption"
): MaterialPriceSnapshot {
  return {
    state: "resolved",
    policyVersion: "ev03-material-resolution-v1",
    reference: { source: "material_library", legacyId: 12 },
    productId: 20,
    specificationId: 30,
    benchmarkProposalId: 50,
    benchmarkVersionId: 2,
    resolverAsOf: "2026-07-30T12:00:00.000Z",
    requestedGeography: "dubai",
    resolvedGeography: "dubai",
    usedUaeFallback: false,
    requestedPriceScope: "supply_only",
    resolvedPriceScope: "supply_only",
    currency: "AED",
    unitBasis: "per_sqm",
    priceMin: "100.00",
    priceMid: "110.00",
    priceMax: "120.00",
    weightedMean: "110.00",
    provenance: {
      sourceLadderRung,
      sourceLabel: "Safe governed source",
      provenancePolicyVersion: "ev01-provenance-v1",
      benchmarkVersion: "benchmark-v2",
      compatibilityFallback: false,
    },
  };
}

function benchmarkFact(
  sourceLadderRung:
    | "assumption"
    | "market_observation"
    | "supplier_quote" = "assumption",
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 50,
    specId: 30,
    proposalScope:
      sourceLadderRung === "supplier_quote"
        ? ("organization" as const)
        : ("platform_public" as const),
    priceScope: "supply_only",
    sourceKind: sourceLadderRung === "assumption" ? "assumption" : "observed",
    sourceLadderRung,
    benchmarkVersionId: 2,
    benchmarkVersion: "benchmark-v2",
    supplierQuoteId: sourceLadderRung === "supplier_quote" ? 70 : null,
    proposalSupersedesId: null,
    supersededByApprovedProposalId: null,
    sourceLabel: "Safe governed source",
    priceConfidence:
      sourceLadderRung === "assumption" ? "assumption" : "indicative",
    provenancePolicyVersion: "ev01-provenance-v1",
    keyPolicyVersion: "benchmark-key-v2",
    proposedP25: "100.00",
    proposedP50: "110.00",
    proposedP75: "120.00",
    weightedMean: "110.00",
    specification: {
      category: "floors",
      finishLevel: "premium",
      unitBasis: "per_sqm",
      geography: "dubai",
    },
    recommendation: "publish",
    status: "approved",
    humanApprovalComplete: true,
    reviewedAt: new Date("2026-07-01T00:00:00.000Z"),
    proposalCreatedAt: new Date("2026-06-30T00:00:00.000Z"),
    observationAt:
      sourceLadderRung === "market_observation"
        ? null
        : new Date("2026-06-30T00:00:00.000Z"),
    supplierQuote:
      sourceLadderRung === "supplier_quote"
        ? {
            id: 70,
            receivedAt: new Date("2026-06-30T00:00:00.000Z"),
            validUntil: new Date("2026-08-30T00:00:00.000Z"),
            supersedesId: null,
            supersededByQuoteId: null,
          }
        : null,
    ...overrides,
  };
}

function evaluate(
  sourceLadderRung: "assumption" | "market_observation" | "supplier_quote",
  overrides: Record<string, unknown> = {}
) {
  const resolved = snapshot(sourceLadderRung);
  const materials = buildProjectMaterialClaimHealthFacts({
    projectId: 7,
    organizationId: 5,
    requestedGeography: "dubai",
    allocations: [allocation],
    snapshotsByAllocationId: new Map([[41, resolved]]),
    benchmarkFacts: [benchmarkFact(sourceLadderRung, overrides)] as never,
    sourceEligibilityByBenchmarkProposalId: new Map([
      [
        50,
        {
          termsApproved: true,
          sourceActive: true,
          sourceWhitelisted: true,
          consumerAuthorized: true,
          confidentialityEligible: true,
          tenantEligible: true,
          sourcePolicyVersionMatches: true,
          governedSourceIdentityKnown: true,
          governedSourceIdentity: "registry-source:50",
          governedSourceRegistryId: 50,
          governedSourceSlug: "registry-source-50",
          governedSourcePolicyVersion: "source-policy-v1",
          governedSourceRevision: `sha256:${"a".repeat(64)}`,
        },
      ],
    ]),
    incidentStateByBenchmarkProposalId: new Map([[50, "none"]]),
  });
  return evaluateProjectClaimHealth({
    consumer: "project_workspace",
    evaluatedAt: new Date("2026-07-30T12:00:00.000Z"),
    materials,
  }).safeProjection;
}

describe("project claim-health governed fact loader", () => {
  it("canonicalizes governed registry revisions for transaction revalidation", () => {
    const input = {
      sourceRegistryId: 50,
      sourceSlug: "trusted-50",
      termsDecision: "approved" as const,
      sourceActive: true,
      sourceWhitelisted: true,
      sourcePolicyVersion: "source-policy-v1",
      updatedAt: new Date("2026-07-30T12:00:00.000Z"),
    };
    expect(createClaimHealthGovernedSourceRevision(input)).toBe(
      createClaimHealthGovernedSourceRevision({
        ...input,
        updatedAt: "2026-07-30T12:00:00.000Z",
      })
    );
    expect(createClaimHealthGovernedSourceRevision(input)).not.toBe(
      createClaimHealthGovernedSourceRevision({
        ...input,
        termsDecision: "rejected",
      })
    );
  });

  it("creates a deterministic drift-sensitive authority binding", () => {
    const resolved = snapshot("market_observation");
    const fact = benchmarkFact("market_observation", {
      observationAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    const sourceEligibility = {
      termsApproved: true,
      sourceActive: true,
      sourceWhitelisted: true,
      consumerAuthorized: true,
      confidentialityEligible: true,
      tenantEligible: true,
      sourcePolicyVersionMatches: true,
      governedSourceIdentityKnown: true,
      governedSourceIdentity: "registry:trusted-50",
      governedSourceRegistryId: 50,
      governedSourceSlug: "trusted-50",
      governedSourcePolicyVersion: "source-policy-v1",
      governedSourceRevision: `sha256:${"a".repeat(64)}`,
    } as const;
    const base = {
      organizationId: 5,
      projectId: 7,
      evaluationClock: new Date("2026-07-30T12:00:00.000Z"),
      allocations: [allocation],
      snapshotsByAllocationId: new Map([[41, resolved]]),
      benchmarkFacts: [fact] as never,
      sourceEligibilityByBenchmarkProposalId: new Map([
        [50, sourceEligibility],
      ]),
      incidentStateByBenchmarkProposalId: new Map([[50, "none" as const]]),
      incidentAuthorityRevisionByBenchmarkProposalId: new Map([
        [50, `sha256:${"a".repeat(64)}`],
      ]),
    };
    const first = buildProjectClaimHealthAuthorityBinding(base);
    const repeated = buildProjectClaimHealthAuthorityBinding(base);
    expect(first).toEqual(repeated);
    expect(first.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.entries[0]).toMatchObject({
      allocationId: 41,
      benchmarkProposalId: 50,
      benchmarkVersionId: 2,
      supplierQuoteId: null,
      governedSourceIdentity: "registry:trusted-50",
      sourcePolicyVersion: "source-policy-v1",
      incidentState: "none",
    });

    const incidentChanged = buildProjectClaimHealthAuthorityBinding({
      ...base,
      incidentStateByBenchmarkProposalId: new Map([[50, "advisory" as const]]),
    });
    expect(incidentChanged.digest).not.toBe(first.digest);
    const registryChanged = buildProjectClaimHealthAuthorityBinding({
      ...base,
      sourceEligibilityByBenchmarkProposalId: new Map([
        [
          50,
          {
            ...sourceEligibility,
            governedSourceRevision: `sha256:${"b".repeat(64)}`,
          },
        ],
      ]),
    });
    expect(registryChanged.digest).not.toBe(first.digest);
    const sourcePolicyChanged = buildProjectClaimHealthAuthorityBinding({
      ...base,
      sourceEligibilityByBenchmarkProposalId: new Map([
        [
          50,
          {
            ...sourceEligibility,
            governedSourcePolicyVersion: "source-policy-v2",
          },
        ],
      ]),
    });
    expect(sourcePolicyChanged.digest).not.toBe(first.digest);
  });

  it("uses governed identities and never a display source label", () => {
    expect(
      resolveProjectClaimHealthIncidentSourceIdentity(
        benchmarkFact("assumption") as never,
        undefined
      )
    ).toBe("assumption:ev01-provenance-v1:benchmark-v2");
    expect(
      resolveProjectClaimHealthIncidentSourceIdentity(
        benchmarkFact("supplier_quote") as never,
        undefined
      )
    ).toBe("supplier_quote:70");
    expect(
      resolveProjectClaimHealthIncidentSourceIdentity(
        {
          ...benchmarkFact("market_observation"),
          sourceLabel: "Untrusted display label",
        } as never,
        {
          termsApproved: true,
          sourceActive: true,
          sourceWhitelisted: true,
          consumerAuthorized: true,
          confidentialityEligible: true,
          tenantEligible: true,
          sourcePolicyVersionMatches: true,
          governedSourceIdentityKnown: true,
          governedSourceIdentity: "registry:trusted-50",
          governedSourceRegistryId: 50,
          governedSourceSlug: "trusted-50",
          governedSourcePolicyVersion: "source-policy-v1",
          governedSourceRevision: `sha256:${"a".repeat(64)}`,
        }
      )
    ).toBe("registry:trusted-50");
  });

  it("fans one resolved reference out to repeated allocations", () => {
    const resolved = snapshot("assumption");
    const repeatedAllocation = {
      ...allocation,
      id: 42,
    } as MaterialAllocation;
    const materials = buildProjectMaterialClaimHealthFacts({
      projectId: 7,
      organizationId: 5,
      requestedGeography: "dubai",
      allocations: [allocation, repeatedAllocation],
      snapshotsByAllocationId: new Map([
        [41, resolved],
        [42, resolved],
      ]),
      benchmarkFacts: [benchmarkFact("assumption")] as never,
    });

    expect(materials).toHaveLength(2);
    expect(materials.map(material => material.snapshot?.reference)).toEqual([
      resolved.reference,
      resolved.reference,
    ]);
  });

  it("keeps approved assumptions visibly qualified", () => {
    expect(evaluate("assumption").claimState).toBe("qualified");
  });

  it("does not substitute proposal approval time for an observation date", () => {
    const result = evaluate("market_observation");
    expect(result.claimState).toBe("insufficient");
    expect(result.reasonCodes).toContain("missing_observation_date");
  });

  it("rejects superseded proposals and quotes", () => {
    expect(
      evaluate("assumption", { supersededByApprovedProposalId: 51 }).claimState
    ).toBe("insufficient");
    expect(
      evaluate("supplier_quote", {
        supplierQuote: {
          ...benchmarkFact("supplier_quote").supplierQuote,
          supersededByQuoteId: 71,
        },
      }).claimState
    ).toBe("insufficient");
  });

  it("requires governed external-source eligibility instead of trusting a label", () => {
    const resolved = snapshot("market_observation");
    const materials = buildProjectMaterialClaimHealthFacts({
      projectId: 7,
      organizationId: 5,
      requestedGeography: "dubai",
      allocations: [allocation],
      snapshotsByAllocationId: new Map([[41, resolved]]),
      benchmarkFacts: [
        benchmarkFact("market_observation", {
          observationAt: new Date("2026-07-01T00:00:00.000Z"),
        }),
      ] as never,
      incidentStateByBenchmarkProposalId: new Map([[50, "none"]]),
    });
    const projection = evaluateProjectClaimHealth({
      consumer: "project_workspace",
      evaluatedAt: new Date("2026-07-30T12:00:00.000Z"),
      materials,
    }).safeProjection;
    expect(projection.claimState).toBe("insufficient");
    expect(projection.reasonCodes).toContain("ineligible_evidence");
  });

  it("projects injected effective incidents without exposing history", () => {
    const resolved = snapshot("assumption");
    const materials = buildProjectMaterialClaimHealthFacts({
      projectId: 7,
      organizationId: 5,
      requestedGeography: "dubai",
      allocations: [allocation],
      snapshotsByAllocationId: new Map([[41, resolved]]),
      benchmarkFacts: [benchmarkFact("assumption")] as never,
      incidentStateByBenchmarkProposalId: new Map([[50, "blocking"]]),
    });
    expect(
      evaluateProjectClaimHealth({
        consumer: "project_workspace",
        evaluatedAt: new Date("2026-07-30T12:00:00.000Z"),
        materials,
      }).safeProjection.claimState
    ).toBe("incident");
  });
});
