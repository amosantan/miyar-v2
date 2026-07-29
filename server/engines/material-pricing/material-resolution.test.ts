import { describe, expect, it } from "vitest";

import type {
  ApprovedPaintCoverageProfileRow,
  GovernedValueCandidate,
  MaterialResolutionIdentityRow,
  MaterialResolutionSpecificationRow,
} from "../../db/material-pricing";
import {
  buildMaterialAggregateCoverage,
  type MaterialPriceSnapshot,
} from "../../../shared/material-calculations";
import { governedMaterialLibrarySnapshot } from "../../../tests/fixtures/material-price-snapshots";
import {
  attachPaintCoverageProfiles,
  resolveGovernedMaterialPriceSnapshotsForRolloutEvidence,
  resolveMaterialPriceSnapshots,
  resolveMaterialPriceSnapshotsFromRows,
  resolveProjectMaterialPriceGeography,
  selectMaterialPricingRolloutSnapshots,
} from "./material-resolution";
import {
  assertMaterialPricingRuntimeComparisonEvidence,
  buildMaterialPricingComparisonEvidence,
  type MaterialPricingRuntimeComparisonEvidence,
} from "./rollout-comparison";

const AS_OF = new Date("2026-07-29T12:00:00.000Z");

describe("material aggregate coverage", () => {
  it("treats an empty material set as insufficient rather than vacuously complete", () => {
    expect(buildMaterialAggregateCoverage([])).toEqual({
      state: "insufficient",
      totalItemCount: 0,
      pricedItemCount: 0,
      insufficientItemCount: 0,
      reasons: {},
    });
  });
});

const IDENTITY: MaterialResolutionIdentityRow = {
  source: "material_library",
  legacyId: 7,
  productId: 70,
  productOrgId: null,
  productCanonicalCategory: "floors",
  category: "flooring",
  tier: "premium",
  unit: "sqm",
};

const UAE_SPEC: MaterialResolutionSpecificationRow = {
  id: 1,
  category: "floors",
  finishLevel: "premium",
  unitBasis: "per_sqm",
  geography: "uae",
};

function candidate(
  overrides: Partial<GovernedValueCandidate> = {}
): GovernedValueCandidate {
  return {
    id: 11,
    specId: 1,
    productId: 70,
    orgId: null,
    priceScope: null,
    sourceKind: "assumption",
    sourceLadderRung: "assumption",
    benchmarkVersionId: null,
    benchmarkVersion: "ev02-backfill-v1",
    effectiveAt: new Date("2026-07-28T00:00:00.000Z"),
    supplierQuoteId: null,
    supersedesId: null,
    p25: "100.00",
    p50: "120.00",
    p75: "140.00",
    weightedMean: "120.00",
    sourceLabel: "secret source text must not escape",
    provenancePolicyVersion: "ev02-backfill-v1",
    unitBasis: "per_sqm",
    geography: "uae",
    quoteValidUntil: null,
    quoteReceivedAt: null,
    quoteOrgId: null,
    quoteSupersededAt: null,
    ...overrides,
  };
}

function resolve(
  overrides: {
    identities?: MaterialResolutionIdentityRow[];
    specifications?: MaterialResolutionSpecificationRow[];
    candidates?: GovernedValueCandidate[];
    requestedGeography?: "dubai" | "uae";
    allowLegacyUnknownScope?: boolean;
  } = {}
) {
  return resolveMaterialPriceSnapshotsFromRows({
    references: [{ source: "material_library", legacyId: 7 }],
    identities: overrides.identities ?? [IDENTITY],
    specifications: overrides.specifications ?? [UAE_SPEC],
    candidates: overrides.candidates ?? [candidate()],
    organizationId: 5,
    priceScope: "supply_only",
    requestedGeography: overrides.requestedGeography ?? "uae",
    asOf: AS_OF,
    allowLegacyUnknownScope: overrides.allowLegacyUnknownScope ?? true,
  })[0];
}

describe("EV-03 material resolution facade", () => {
  it("uses the explicitly supplied reader data source for rollout evidence", async () => {
    const calls: string[] = [];
    const snapshots =
      await resolveGovernedMaterialPriceSnapshotsForRolloutEvidence(
        {
          references: [{ source: "material_library", legacyId: 7 }],
          organizationId: 0,
          priceScope: "supply_only",
          requestedGeography: "uae",
          asOf: AS_OF,
          allowLegacyUnknownScope: true,
          evidencePurpose: "ev03-full-eligible-comparison",
        },
        {
          async listIdentities() {
            calls.push("identities");
            return [IDENTITY];
          },
          async listSpecifications() {
            calls.push("specifications");
            return [UAE_SPEC];
          },
          async listCandidates() {
            calls.push("candidates");
            return [candidate()];
          },
          async listCoverageProfiles() {
            calls.push("coverage");
            return [];
          },
        }
      );
    expect(calls).toEqual([
      "identities",
      "specifications",
      "candidates",
      "coverage",
    ]);
    expect(snapshots[0]).toMatchObject({
      state: "resolved",
      productId: 70,
      priceMin: "100.00",
      priceMid: "120.00",
      priceMax: "140.00",
    });
  });

  it("serves legacy in legacy/compare and governed only after cutover selection", () => {
    const governed = resolve({
      candidates: [
        candidate({
          priceScope: "supply_only",
          p25: "101.00",
          p50: "121.00",
          p75: "141.00",
          weightedMean: "121.00",
        }),
      ],
    });
    const legacyRows = [
      {
        legacyId: 7,
        productId: 70,
        specId: 1,
        benchmarkProposalId: 11,
        benchmarkVersionId: null,
        benchmarkVersion: "ev02-backfill-v1",
        provenancePolicyVersion: "ev02-backfill-v1",
        unitBasis: "per_sqm" as const,
        geography: "uae" as const,
        priceMin: "100.00",
        priceMax: "140.00",
      },
    ];
    const common = {
      requested: [{ source: "material_library" as const, legacyId: 7 }],
      governed: [governed],
      legacyRows,
      requestedGeography: "uae" as const,
      priceScope: "supply_only" as const,
      asOf: AS_OF,
    };
    expect(
      selectMaterialPricingRolloutSnapshots({ ...common, mode: "legacy" })[0]
    ).toMatchObject({
      state: "resolved",
      resolvedPriceScope: "legacy_unknown",
      priceMin: "100.00",
      priceMid: "120.00",
      priceMax: "140.00",
      provenance: {
        sourceLabel: "Legacy scope-unknown assumption",
        compatibilityFallback: true,
      },
    });
    const evidence = buildMaterialPricingComparisonEvidence({
      legacyRanges: legacyRows.map(row => ({
        reference: { source: "material_library", legacyId: row.legacyId },
        priceMin: row.priceMin,
        priceMax: row.priceMax,
      })),
      snapshots: [
        governedMaterialLibrarySnapshot({
          legacyId: 7,
          priceMin: 100,
          priceMax: 140,
        }),
      ],
      generatedAt: AS_OF,
    });
    let recorded: MaterialPricingRuntimeComparisonEvidence | undefined;
    expect(
      selectMaterialPricingRolloutSnapshots({
        ...common,
        governed: [
          {
            ...governed,
            requestedGeography: "dubai",
            resolvedGeography: "dubai",
            requestedPriceScope: "supply_and_install",
            resolvedPriceScope: "supply_and_install",
          },
        ],
        requestedGeography: "dubai",
        priceScope: "supply_and_install",
        mode: "compare",
        gate: { mode: "compare", evidence },
        recordComparison: comparison => {
          recorded = comparison;
        },
      })[0]
    ).toMatchObject({ resolvedPriceScope: "legacy_unknown" });
    expect(recorded).toMatchObject({
      requestedPriceScope: "supply_and_install",
      requestedGeography: "dubai",
      equalRowCount: 0,
      differentRowCount: 1,
      insufficientRowCount: 0,
      comparisons: [
        {
          reference: { source: "material_library", legacyId: 7 },
          state: "different",
          differences: ["min", "mid", "max"],
        },
      ],
    });
    expect(() =>
      assertMaterialPricingRuntimeComparisonEvidence(recorded!)
    ).not.toThrow();
    expect(JSON.stringify(recorded)).not.toMatch(
      /organizationId|orgId|supplierQuoteId|quoteRef|contactRef|sourceLabel|supplierName|supplierContact|provenance|description/
    );
    expect(JSON.stringify(recorded)).not.toContain('"governed"');
    expect(JSON.stringify(recorded)).not.toContain('"legacy"');
    expect(
      selectMaterialPricingRolloutSnapshots({ ...common, mode: "governed" })[0]
    ).toMatchObject({
      resolvedPriceScope: "supply_only",
      priceMin: "101.00",
      priceMid: "121.00",
      priceMax: "141.00",
    });
  });

  it("keeps governed-only catalog references out of legacy compare rows", () => {
    const legacyRow = {
      legacyId: 7,
      productId: 70,
      specId: 1,
      benchmarkProposalId: 11,
      benchmarkVersionId: null,
      benchmarkVersion: "ev02-backfill-v1",
      provenancePolicyVersion: "ev02-backfill-v1",
      unitBasis: "per_sqm" as const,
      geography: "uae" as const,
      priceMin: "100.00",
      priceMax: "140.00",
    };
    const evidence = buildMaterialPricingComparisonEvidence({
      legacyRanges: [
        {
          reference: { source: "material_library", legacyId: 7 },
          priceMin: "100.00",
          priceMax: "140.00",
        },
      ],
      snapshots: [
        governedMaterialLibrarySnapshot({
          legacyId: 7,
          priceMin: 100,
          priceMax: 140,
        }),
      ],
      generatedAt: AS_OF,
    });
    const governedCatalog = {
      ...governedMaterialLibrarySnapshot({
        legacyId: 99,
        priceMin: 200,
        priceMax: 240,
      }),
      reference: { source: "materials_catalog" as const, legacyId: 99 },
    };
    let recorded: MaterialPricingRuntimeComparisonEvidence | undefined;
    const selected = selectMaterialPricingRolloutSnapshots({
      mode: "compare",
      gate: { mode: "compare", evidence },
      requested: [
        { source: "material_library", legacyId: 7 },
        { source: "materials_catalog", legacyId: 99 },
      ],
      governed: [resolve(), governedCatalog],
      legacyRows: [legacyRow],
      requestedGeography: "uae",
      priceScope: "supply_only",
      asOf: AS_OF,
      recordComparison: value => {
        recorded = value;
      },
    });
    expect(selected[1]).toEqual(governedCatalog);
    expect(recorded).toMatchObject({
      comparisonRowCount: 1,
      comparisons: [{ reference: { source: "material_library", legacyId: 7 } }],
    });
  });

  it("fails governed mode at the central facade before any database access", async () => {
    const evidence = buildMaterialPricingComparisonEvidence({
      legacyRanges: [
        {
          reference: { source: "material_library", legacyId: 7 },
          priceMin: "100.00",
          priceMax: "140.00",
        },
      ],
      snapshots: [resolve()],
      generatedAt: AS_OF,
    });
    await expect(
      resolveMaterialPriceSnapshots({
        references: [{ source: "material_library", legacyId: 7 }],
        organizationId: 5,
        priceScope: "supply_only",
        requestedGeography: "uae",
        asOf: AS_OF,
        rollout: {
          mode: "governed",
          evidence,
          cutoverApproval: {
            reference: "unapproved",
            approvedEvidenceDigest: evidence.evidenceDigest,
          },
        },
      })
    ).rejects.toThrow("explicit EV-03 cutover approval");
  });

  it("preserves legacy AED values only through labelled compatibility", () => {
    expect(resolve()).toMatchObject({
      state: "resolved",
      productId: 70,
      specificationId: 1,
      priceMin: "100.00",
      priceMid: "120.00",
      priceMax: "140.00",
      resolvedPriceScope: "legacy_unknown",
      provenance: {
        sourceLabel: "Legacy scope-unknown assumption",
        compatibilityFallback: true,
      },
    });
  });

  it("fails closed when compatibility is not explicit", () => {
    expect(resolve({ allowLegacyUnknownScope: false })).toMatchObject({
      state: "insufficient",
      reason: "legacy_scope_unknown",
    });
  });

  it("uses explicit emirate then UAE fallback without inference", () => {
    expect(resolve({ requestedGeography: "dubai" })).toMatchObject({
      state: "resolved",
      requestedGeography: "dubai",
      resolvedGeography: "uae",
      usedUaeFallback: true,
    });
    expect(resolveProjectMaterialPriceGeography("Prime")).toBe("uae");
    expect(resolveProjectMaterialPriceGeography("dubai")).toBe("dubai");
  });

  it("rejects foreign private products before candidate resolution", () => {
    const result = resolve({
      identities: [{ ...IDENTITY, productOrgId: 99 }],
    });
    expect(result).toMatchObject({
      state: "insufficient",
      reason: "identity_not_found",
      reference: { source: "material_library", legacyId: 7 },
    });
    expect(result).not.toHaveProperty("productId");
    expect(result).not.toHaveProperty("specificationId");
    expect(JSON.stringify(result)).not.toContain('"productId"');
    expect(JSON.stringify(result)).not.toContain("70");
  });

  it("rejects orphan and category-inconsistent canonical product links", () => {
    expect(
      resolve({
        identities: [
          {
            ...IDENTITY,
            productId: null,
            productCanonicalCategory: null,
          },
        ],
      })
    ).toMatchObject({
      state: "insufficient",
      reason: "identity_not_found",
    });
    expect(
      resolve({
        identities: [
          {
            ...IDENTITY,
            productCanonicalCategory: "walls",
          },
        ],
      })
    ).toMatchObject({
      state: "insufficient",
      reason: "identity_not_found",
    });
  });

  it("never resurrects a concealed foreign identity through legacy compatibility", () => {
    const concealed = resolve({
      identities: [{ ...IDENTITY, productOrgId: 99 }],
    });
    const selected = selectMaterialPricingRolloutSnapshots({
      mode: "legacy",
      requested: [{ source: "material_library", legacyId: 7 }],
      governed: [concealed],
      legacyRows: [
        {
          legacyId: 7,
          productId: 70,
          specId: 1,
          benchmarkProposalId: 11,
          benchmarkVersionId: null,
          benchmarkVersion: "ev02-backfill-v1",
          provenancePolicyVersion: "ev02-backfill-v1",
          unitBasis: "per_sqm",
          geography: "uae",
          priceMin: "100.00",
          priceMax: "140.00",
        },
      ],
      requestedGeography: "uae",
      priceScope: "supply_only",
      asOf: AS_OF,
    });
    expect(selected).toEqual([concealed]);
    expect(JSON.stringify(selected)).not.toContain("70");
    expect(JSON.stringify(selected)).not.toContain('"productId"');
  });

  it("does not hide an ambiguous emirate behind UAE fallback", () => {
    const dubaiSpec = { ...UAE_SPEC, id: 2, geography: "dubai" as const };
    expect(
      resolve({
        requestedGeography: "dubai",
        specifications: [dubaiSpec, UAE_SPEC],
        candidates: [
          candidate({ id: 21, specId: 2, priceScope: "supply_only" }),
          candidate({ id: 22, specId: 2, priceScope: "supply_only" }),
          candidate(),
        ],
      })
    ).toMatchObject({
      state: "insufficient",
      reason: "ambiguous_governed_value",
      specificationId: 2,
    });
  });

  it("selects the one duplicate canonical specification governed for the product", () => {
    const unrelatedSpec = { ...UAE_SPEC, id: 2 };
    expect(
      resolve({
        specifications: [UAE_SPEC, unrelatedSpec],
        candidates: [
          candidate(),
          candidate({
            id: 21,
            specId: 2,
            productId: 999,
            priceScope: "supply_only",
          }),
        ],
      })
    ).toMatchObject({
      state: "resolved",
      productId: 70,
      specificationId: 1,
      benchmarkProposalId: 11,
    });
  });

  it("fails closed when duplicate canonical specifications both resolve", () => {
    const duplicateSpec = { ...UAE_SPEC, id: 2 };
    const result = resolve({
      specifications: [UAE_SPEC, duplicateSpec],
      candidates: [
        candidate({ priceScope: "supply_only" }),
        candidate({ id: 21, specId: 2, priceScope: "supply_only" }),
      ],
    });
    expect(result).toMatchObject({
      state: "insufficient",
      reason: "ambiguous_governed_value",
      productId: 70,
    });
    expect(result).not.toHaveProperty("specificationId");
  });

  it("keeps confidential source labels out of presentation provenance", () => {
    const snapshot = resolve({
      candidates: [
        candidate({
          id: 30,
          orgId: 5,
          priceScope: "supply_only",
          sourceKind: "observed",
          sourceLadderRung: "supplier_quote",
          supplierQuoteId: 400,
          quoteOrgId: 5,
          quoteReceivedAt: new Date("2026-07-01T00:00:00.000Z"),
          quoteValidUntil: new Date("2026-08-01T00:00:00.000Z"),
          sourceLabel: "Supplier X quote Q-123 contact secret@example.com",
        }),
      ],
    });
    expect(snapshot).toMatchObject({
      state: "resolved",
      provenance: { sourceLabel: "Organization supplier quote" },
    });
    expect(JSON.stringify(snapshot)).not.toContain("Q-123");
    expect(JSON.stringify(snapshot)).not.toContain("secret@example.com");
  });

  it("attaches one approved effective paint profile and flags ambiguity", () => {
    const base = resolve();
    expect(base.state).toBe("resolved");
    if (base.state !== "resolved") return;
    const litreSnapshot: MaterialPriceSnapshot = {
      ...base,
      unitBasis: "per_litre",
    };
    const profile: ApprovedPaintCoverageProfileRow = {
      id: 91,
      productId: base.productId,
      specId: base.specificationId,
      coverageM2PerLitrePerCoat: "12.000",
      coatCount: 2,
      wastePct: "5.000",
      packSizesLitres: ["18", "4", "1"],
      effectiveAt: new Date("2026-07-01T00:00:00.000Z"),
      policyVersion: "approved-tds-v1",
      sourceDocumentDigest:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      reviewedBy: 7,
      reviewedAt: new Date("2026-07-02T00:00:00.000Z"),
      supersedesId: null,
    };
    expect(
      attachPaintCoverageProfiles([litreSnapshot], [profile])[0]
    ).toMatchObject({
      state: "resolved",
      paintCoverageState: "approved",
      paintCoverageProfile: {
        profileId: 91,
        packSizesLitres: ["18", "4", "1"],
      },
    });
    expect(
      attachPaintCoverageProfiles(
        [litreSnapshot],
        [profile, { ...profile, id: 92 }]
      )[0]
    ).toMatchObject({
      state: "resolved",
      paintCoverageState: "invalid",
    });

    for (const invalidProfile of [
      { ...profile, reviewedBy: 0 },
      { ...profile, reviewedAt: new Date("2026-07-30T00:00:00.000Z") },
      { ...profile, sourceDocumentDigest: "not-a-sha256-digest" },
      { ...profile, reviewedBy: null, reviewedAt: null },
      { ...profile, coverageM2PerLitrePerCoat: "0" },
      { ...profile, coatCount: 0 },
      { ...profile, wastePct: "-1" },
      { ...profile, packSizesLitres: [] },
      { ...profile, lineageValid: false },
    ]) {
      expect(
        attachPaintCoverageProfiles(
          [litreSnapshot],
          [invalidProfile as unknown as ApprovedPaintCoverageProfileRow]
        )[0]
      ).toMatchObject({
        state: "resolved",
        paintCoverageState: "invalid",
      });
    }
  });
});
