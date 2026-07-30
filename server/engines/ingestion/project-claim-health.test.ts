import { describe, expect, it } from "vitest";

import type {
  GovernedMaterialPriceSnapshot,
  MaterialPriceSnapshot,
} from "../../../shared/material-calculations";
import type { ClaimHealthEvaluation } from "../../../shared/claim-health";
import {
  buildProjectClaimHealthEvaluationInput,
  evaluateProjectClaimHealth,
  type GovernedProjectMaterialEvidenceFact,
  type ProjectMaterialClaimHealthFact,
} from "./project-claim-health";

const CLOCK = new Date("2026-07-30T12:00:00.000Z");

function snapshot(
  overrides: Partial<GovernedMaterialPriceSnapshot> = {}
): GovernedMaterialPriceSnapshot {
  return {
    state: "resolved",
    policyVersion: "ev03-material-resolution-v1",
    reference: { source: "material_library", legacyId: 7 },
    productId: 17,
    specificationId: 27,
    benchmarkProposalId: 37,
    benchmarkVersionId: 47,
    resolverAsOf: CLOCK.toISOString(),
    requestedGeography: "dubai",
    resolvedGeography: "dubai",
    usedUaeFallback: false,
    requestedPriceScope: "supply_only",
    resolvedPriceScope: "supply_only",
    currency: "AED",
    unitBasis: "per_sqm",
    priceMin: "100.00",
    priceMid: "120.00",
    priceMax: "140.00",
    weightedMean: "121.00",
    provenance: {
      sourceLadderRung: "market_observation",
      sourceLabel: "Governed market-observation benchmark",
      provenancePolicyVersion: "evidence-provenance-v1",
      benchmarkVersion: "benchmark-v7",
      compatibilityFallback: false,
    },
    ...overrides,
  };
}

function evidence(
  overrides: Partial<GovernedProjectMaterialEvidenceFact> = {}
): GovernedProjectMaterialEvidenceFact {
  return {
    sourceClass: "market_observation",
    eligibility: "eligible",
    sourceIdentityKnown: true,
    observationAt: "2026-07-01T00:00:00.000Z",
    quoteValidUntil: null,
    slaConfigured: true,
    quality: "pass",
    confidence: "known",
    incident: "none",
    resolvedCategory: "floors",
    resolvedFinishTier: "premium",
    ...overrides,
  };
}

function material(
  overrides: {
    allocation?: Partial<ProjectMaterialClaimHealthFact["allocation"]>;
    snapshot?: MaterialPriceSnapshot | null;
    evidence?: GovernedProjectMaterialEvidenceFact | null;
  } = {}
): ProjectMaterialClaimHealthFact {
  return {
    allocation: {
      allocationKey: "allocation-7",
      requirement: "required",
      reference: { source: "material_library", legacyId: 7 },
      category: "floors",
      finishTier: "premium",
      unitBasis: "per_sqm",
      priceScope: "supply_only",
      requestedGeography: "dubai",
      ...overrides.allocation,
    },
    snapshot:
      overrides.snapshot === undefined ? snapshot() : overrides.snapshot,
    evidence:
      overrides.evidence === undefined ? evidence() : overrides.evidence,
  };
}

function evaluate(
  fact: ProjectMaterialClaimHealthFact,
  consumer: Parameters<
    typeof evaluateProjectClaimHealth
  >[0]["consumer"] = "project_workspace"
): ClaimHealthEvaluation {
  return evaluateProjectClaimHealth({
    consumer,
    evaluatedAt: CLOCK,
    materials: [fact],
  });
}

describe("project material claim-health adapter", () => {
  it("normalizes an exact governed market observation to Current", () => {
    const result = evaluate(material()).safeProjection;
    expect(result.claimState).toBe("current");
    expect(result.counts).toMatchObject({
      required: 1,
      eligible: 1,
      exact: 1,
      fallback: 0,
    });
    expect(result.cells[0]).toMatchObject({
      catalogueId: "material-project-v1",
      match: "exact",
      authority: "governed_benchmark",
      freshness: "current",
      observedThrough: "2026-07-01T00:00:00.000Z",
    });
  });

  it("uses the report catalogue without changing material facts", () => {
    const input = buildProjectClaimHealthEvaluationInput({
      consumer: "stored_project_report",
      evaluatedAt: CLOCK,
      materials: [material()],
    });
    expect(input.artifactSnapshot).toBe("present");
    expect(input.cells[0].catalogueId).toBe("project-report-material-v1");
    expect(
      evaluateProjectClaimHealth({
        consumer: "stored_project_report",
        evaluatedAt: CLOCK,
        materials: [material()],
      }).safeProjection.claimState
    ).toBe("current");
  });

  it("permits only the resolver's explicit emirate-to-UAE fallback", () => {
    const fallback = material({
      snapshot: snapshot({
        resolvedGeography: "uae",
        usedUaeFallback: true,
      }),
    });
    expect(evaluate(fallback).safeProjection).toMatchObject({
      claimState: "current_with_fallback",
      counts: { fallback: 1 },
    });
    expect(evaluate(fallback).safeProjection.cells[0]).toMatchObject({
      match: "approved_fallback",
      fallbackCode: "emirate_to_uae",
    });

    const crossEmirate = material({
      snapshot: snapshot({
        resolvedGeography: "abu_dhabi",
        usedUaeFallback: false,
      }),
    });
    expect(evaluate(crossEmirate).safeProjection.claimState).toBe(
      "insufficient"
    );
  });

  it.each([
    ["missing snapshot", material({ snapshot: null })],
    [
      "unresolved snapshot",
      material({
        snapshot: {
          state: "insufficient",
          policyVersion: "ev03-material-resolution-v1",
          reference: { source: "material_library", legacyId: 7 },
          resolverAsOf: CLOCK.toISOString(),
          requestedGeography: "dubai",
          requestedPriceScope: "supply_only",
          reason: "specification_not_found",
        },
      }),
    ],
    ["missing category", material({ allocation: { category: null } })],
    ["missing finish tier", material({ allocation: { finishTier: null } })],
    ["missing unit basis", material({ allocation: { unitBasis: null } })],
    [
      "non-supply-only scope",
      material({
        allocation: { priceScope: "supply_and_install" },
        snapshot: snapshot({
          requestedPriceScope: "supply_and_install",
          resolvedPriceScope: "supply_and_install",
        }),
      }),
    ],
    [
      "legacy provenance",
      material({
        snapshot: snapshot({
          provenance: {
            ...snapshot().provenance,
            provenancePolicyVersion: "legacy_unknown",
            compatibilityFallback: true,
          },
        }),
      }),
    ],
    [
      "future resolver clock",
      material({
        snapshot: snapshot({ resolverAsOf: "2026-07-31T00:00:00.000Z" }),
      }),
    ],
    [
      "source mismatch",
      material({
        evidence: evidence({ sourceClass: "official_statistic" }),
      }),
    ],
  ])("fails closed for %s", (_name, fact) => {
    expect(evaluate(fact).safeProjection.claimState).toBe("insufficient");
  });

  it("keeps assumptions qualified with freshness not applicable", () => {
    const assumption = material({
      snapshot: snapshot({
        provenance: {
          ...snapshot().provenance,
          sourceLadderRung: "assumption",
          sourceLabel: "MIYAR assumption",
        },
      }),
      evidence: evidence({
        sourceClass: "assumption",
        observationAt: null,
      }),
    });
    expect(evaluate(assumption).safeProjection).toMatchObject({
      claimState: "qualified",
      cells: [
        {
          authority: "approved_assumption",
          freshness: "not_applicable",
          observedThrough: null,
        },
      ],
    });
  });

  it("requires explicit supplier-quote validity", () => {
    const quoteSnapshot = snapshot({
      provenance: {
        ...snapshot().provenance,
        sourceLadderRung: "supplier_quote",
        sourceLabel: "Organization supplier quote",
      },
    });
    const quoteFact = (quoteValidUntil: Date | string | null) =>
      material({
        snapshot: quoteSnapshot,
        evidence: evidence({
          sourceClass: "supplier_quote",
          observationAt: null,
          quoteValidUntil,
        }),
      });

    expect(
      evaluate(quoteFact("2026-07-30T12:00:00.000Z")).safeProjection.claimState
    ).toBe("current");
    expect(
      evaluate(quoteFact("2026-07-30T11:59:59.999Z")).safeProjection.claimState
    ).toBe("stale");
    expect(evaluate(quoteFact(null)).safeProjection.claimState).toBe(
      "insufficient"
    );
  });

  it("keeps official and consultancy publication SLAs unknown until configured", () => {
    for (const sourceClass of [
      "official_statistic",
      "consultancy_benchmark",
    ] as const) {
      const fact = material({
        snapshot: snapshot({
          provenance: {
            ...snapshot().provenance,
            sourceLadderRung: sourceClass,
          },
        }),
        evidence: evidence({
          sourceClass,
          slaConfigured: false,
        }),
      });
      expect(evaluate(fact).safeProjection.claimState).toBe("unknown");
    }
  });

  it("fails closed on missing observation dates and eligibility/provenance", () => {
    expect(
      evaluate(material({ evidence: evidence({ observationAt: null }) }))
        .safeProjection.claimState
    ).toBe("insufficient");
    expect(
      evaluate(material({ evidence: evidence({ eligibility: "ineligible" }) }))
        .safeProjection.claimState
    ).toBe("insufficient");
    expect(
      evaluate(material({ evidence: evidence({ sourceIdentityKnown: false }) }))
        .safeProjection.claimState
    ).toBe("insufficient");
  });

  it("returns insufficient for an empty project allocation denominator", () => {
    expect(
      evaluateProjectClaimHealth({
        consumer: "project_workspace",
        evaluatedAt: CLOCK,
        materials: [],
      }).safeProjection.claimState
    ).toBe("insufficient");
  });
});
