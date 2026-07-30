import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MATERIAL_RESOLUTION_POLICY_VERSION,
  type GovernedMaterialPriceSnapshot,
  type MaterialPriceSnapshot,
} from "../../../shared/material-calculations";
import type {
  PriceUnitBasis,
  SourceLadderRung,
} from "../../../shared/material-pricing";
import type { DesignBriefData } from "../design-brief";
import {
  allocateScheduledWallAreas,
  buildRFQFromBrief,
  buildRFQPack,
  buildRFQPackFromAllocations,
  expectedCanonicalRfqMaterialLineCount,
  RFQ_NON_MATERIAL_POLICY,
} from "./rfq-generator";

const AS_OF = "2026-07-29T12:00:00.000Z";
const FLOORING_SECTION = "Civil & MEP Works (Flooring, Ceilings, Partitions)";

function brief(
  category = FLOORING_SECTION,
  materialLibraryId = 1
): DesignBriefData {
  return {
    boqFramework: {
      totalEstimatedSqm: 100,
      coreAllocations: [
        {
          category,
          percentage: 100,
          materialLibraryId,
          explicitQuantity: 100,
          explicitQuantityUnit: "sqm",
          estimatedCostLabel:
            "AED 999,999 market-verified from Confidential Supplier Q-123",
          notes:
            "Do not use descriptive text as numerical or provenance evidence.",
        },
      ],
    },
    materialSpecifications: {
      tierRequirement: "Upper-mid",
      approvedMaterials: [],
      prohibitedMaterials: [],
      finishesAndTextures: [],
      sustainabilityMandate: "",
      qualityBenchmark: "",
    },
    detailedBudget: {
      costPerSqmTarget: "Not specified",
      totalBudgetCap: "AED 1,000,000",
      costBand: "Standard (Fit-out)",
      costBasis: "static_default",
      flexibilityLevel: "Moderate",
      contingencyRecommendation: "Allocate 10% Contractor Contingency",
      valueEngineeringMandates: [],
    },
  } as unknown as DesignBriefData;
}

function resolved(
  legacyId: number,
  unitBasis: PriceUnitBasis,
  prices: { min: string; mid?: string; max: string },
  sourceLadderRung: Exclude<
    SourceLadderRung,
    "retail_sanity"
  > = "supplier_quote"
): GovernedMaterialPriceSnapshot {
  return {
    state: "resolved",
    policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
    reference: { source: "material_library", legacyId },
    productId: legacyId * 10,
    specificationId: legacyId * 100,
    benchmarkProposalId: legacyId * 1000,
    benchmarkVersionId: 9,
    resolverAsOf: AS_OF,
    requestedGeography: "dubai",
    resolvedGeography: "uae",
    usedUaeFallback: true,
    requestedPriceScope: "supply_and_install",
    resolvedPriceScope: "supply_and_install",
    currency: "AED",
    unitBasis,
    priceMin: prices.min,
    priceMid: prices.mid ?? prices.min,
    priceMax: prices.max,
    weightedMean: prices.mid ?? prices.min,
    provenance: {
      sourceLadderRung,
      sourceLabel:
        sourceLadderRung === "supplier_quote"
          ? "Organization supplier quote"
          : "MIYAR assumption",
      provenancePolicyVersion: "safe-presentation-v1",
      benchmarkVersion: "benchmark-v9",
      compatibilityFallback: false,
    },
  };
}

describe("EV-03 governed RFQ generation", () => {
  it("keeps both authorized RFQ call sites on the supply-and-install facade", () => {
    const briefRouter = readFileSync(
      new URL("../../routers/design-briefs.ts", import.meta.url),
      "utf8"
    );
    const projectRouter = readFileSync(
      new URL("../../routers/project.ts", import.meta.url),
      "utf8"
    );
    const briefBlock = briefRouter.slice(
      briefRouter.indexOf("generateRfqFromBrief:"),
      briefRouter.indexOf("exportBriefDocx:")
    );
    const reportClock = projectRouter.indexOf(
      "const reportMaterialAsOf = new Date("
    );
    const reportBlock = projectRouter.slice(
      reportClock,
      projectRouter.indexOf("designArtifacts = {", reportClock)
    );

    for (const block of [briefBlock, reportBlock]) {
      expect(block).toContain("resolveMaterialPriceSnapshots({");
      expect(block).toContain('priceScope: "supply_and_install"');
      expect(block).toContain("organizationId: ctx.orgId");
      expect(block).toContain("asOf:");
      expect(block).not.toMatch(/priceAed(?:Min|Max)/);
    }
  });

  it("contains no legacy or hard-coded material unit-rate path", () => {
    const source = readFileSync(
      new URL("./rfq-generator.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/priceAed(?:Min|Max)/);
    expect(source).not.toContain("parseCostLabel");
    expect(source).not.toMatch(/let rateMin = (?:90|1200|2000)/);
    expect(source).not.toMatch(/rateMax = (?:120|1800|3500)/);
  });

  it("uses only supply-and-install snapshots and safe presentation provenance", () => {
    const result = buildRFQFromBrief(
      7,
      5,
      brief(),
      11,
      [{ id: 1, name: "Observed Marble", category: "flooring" }],
      [resolved(1, "per_sqm", { min: "201.25", max: "260.75" })]
    );

    const line = result.items.find(item => item.itemCode === "01-01");
    expect(line).toMatchObject({
      organizationId: 5,
      unitRateAedMin: 201.25,
      unitRateAedMax: 260.75,
      totalAedMin: 20125,
      totalAedMax: 26075,
      resolutionState: "resolved",
      resolvedPriceScope: "supply_and_install",
      requestedGeography: "dubai",
      resolvedGeography: "uae",
      resolvedUnitBasis: "per_sqm",
      resolutionAsOf: new Date(AS_OF),
      resolverPolicyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
      benchmarkProposalId: 1000,
      benchmarkVersionId: 9,
      benchmarkVersion: "benchmark-v9",
      provenancePolicyVersion: "safe-presentation-v1",
      quantityPolicyVersion: expect.any(String),
      quantityConversionInputs: expect.objectContaining({
        surfaceAreaM2: 100,
      }),
      lineKind: "material",
      supplierName: "TBD",
      pricingSource: "market-verified",
      presentationProvenance: {
        sourceLabel: "Organization supplier quote",
      },
    });
    expect(line?.description).not.toContain("Confidential Supplier");
    expect(line?.description).not.toContain("market-verified");
    expect(result.summary.resolutionState).toBe("complete");
  });

  it("requires explicit canonical material identity and quantity for brief allocations", () => {
    const missingIdentity = brief();
    delete (missingIdentity.boqFramework.coreAllocations[0] as any)
      .materialLibraryId;
    const noIdentity = buildRFQFromBrief(
      7,
      5,
      missingIdentity,
      11,
      [{ id: 1, name: "Observed Marble", category: "flooring" }],
      [resolved(1, "per_sqm", { min: "201.25", max: "260.75" })]
    );
    expect(noIdentity.items[0]).toMatchObject({
      itemCode: "01-TBD",
      resolutionState: "insufficient",
      resolutionReason: "identity_not_found",
    });

    const missingQuantity = brief();
    delete (missingQuantity.boqFramework.coreAllocations[0] as any)
      .explicitQuantity;
    delete (missingQuantity.boqFramework.coreAllocations[0] as any)
      .explicitQuantityUnit;
    const noQuantity = buildRFQFromBrief(
      7,
      5,
      missingQuantity,
      11,
      [{ id: 1, name: "Observed Marble", category: "flooring" }],
      [resolved(1, "per_sqm", { min: "201.25", max: "260.75" })]
    );
    expect(noQuantity.items[0]).toMatchObject({
      itemCode: "01-01",
      quantity: 0,
      resolutionState: "insufficient",
      resolutionReason: "quantity_required",
    });
  });

  it("requires persisted canonical identity and explicit quantity for non-surface RFQ lines", () => {
    const material = {
      id: 4,
      productName: "Canonical Joinery",
      category: "joinery",
    };
    const snapshot = resolved(4, "per_lm", { min: "200", max: "300" });
    const missingIdentity = buildRFQPackFromAllocations(
      1,
      5,
      [
        {
          roomId: "MBR",
          roomName: "Bedroom",
          element: "joinery",
          materialLibraryId: null,
          surfaceAreaM2: 0,
          explicitQuantity: 2,
          explicitQuantityUnit: "lm",
        },
      ],
      [material],
      [snapshot]
    );
    expect(missingIdentity[0]).toMatchObject({
      resolutionState: "insufficient",
      resolutionReason: "identity_not_found",
    });
    expect(
      missingIdentity.filter(line => line.lineKind === "material")
    ).toHaveLength(
      expectedCanonicalRfqMaterialLineCount(
        [
          {
            roomId: "MBR",
            roomName: "Bedroom",
            element: "joinery",
            materialLibraryId: null,
            surfaceAreaM2: 0,
            explicitQuantity: 2,
            explicitQuantityUnit: "lm",
          },
        ],
        []
      )
    );

    const missingQuantity = buildRFQPackFromAllocations(
      1,
      5,
      [
        {
          roomId: "MBR",
          roomName: "Bedroom",
          element: "joinery",
          materialLibraryId: 4,
          surfaceAreaM2: 0,
        },
      ],
      [material],
      [snapshot]
    );
    expect(missingQuantity[0]).toMatchObject({
      unit: "unknown",
      quantity: 0,
      resolutionState: "insufficient",
      resolutionReason: "incompatible_quantity_unit",
    });

    const resolvedJoinery = buildRFQPackFromAllocations(
      1,
      5,
      [
        {
          roomId: "MBR",
          roomName: "Bedroom",
          element: "joinery",
          materialLibraryId: 4,
          surfaceAreaM2: 0,
          explicitQuantity: 2,
          explicitQuantityUnit: "lm",
        },
      ],
      [material],
      [snapshot]
    );
    expect(resolvedJoinery[0]).toMatchObject({
      unit: "lm",
      quantity: 2,
      productId: 40,
      specId: 400,
      totalAedMin: 400,
      totalAedMax: 600,
      resolutionState: "resolved",
    });

    const sanitary = {
      id: 5,
      productName: "Canonical Sanitary Suite",
      category: "sanitaryware",
    };
    const resolvedSanitary = buildRFQPackFromAllocations(
      1,
      5,
      [
        {
          roomId: "BTH",
          roomName: "Bathroom",
          element: "sanitaryware",
          materialLibraryId: 5,
          surfaceAreaM2: 0,
          explicitQuantity: 2,
          explicitQuantityUnit: "piece",
        },
      ],
      [sanitary],
      [resolved(5, "per_piece", { min: "700", max: "900" })],
      [{ id: "BTH", name: "Bathroom" }]
    );
    expect(resolvedSanitary.filter(line => line.lineKind === "material")).toEqual([
      expect.objectContaining({
        unit: "piece",
        quantity: 2,
        productId: 50,
        specId: 500,
        totalAedMin: 1400,
        totalAedMax: 1800,
        resolutionState: "resolved",
      }),
    ]);
  });

  it("fails unresolved and incompatible material lines closed without zero totals", () => {
    const unresolved: MaterialPriceSnapshot = {
      state: "insufficient",
      policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
      reference: { source: "material_library", legacyId: 1 },
      resolverAsOf: AS_OF,
      requestedGeography: "uae",
      requestedPriceScope: "supply_and_install",
      reason: "legacy_scope_unknown",
    };
    const unresolvedResult = buildRFQFromBrief(
      7,
      5,
      brief(),
      11,
      [{ id: 1, name: "Unresolved Marble", category: "flooring" }],
      [unresolved]
    );
    const unresolvedLine = unresolvedResult.items.find(
      item => item.itemCode === "01-01"
    );
    expect(unresolvedLine).toMatchObject({
      resolutionState: "insufficient",
      resolutionReason: "legacy_scope_unknown",
      unitRateAedMin: null,
      unitRateAedMax: null,
      totalAedMin: null,
      totalAedMax: null,
    });
    expect(unresolvedResult.summary).toMatchObject({
      subtotalMin: null,
      subtotalMax: null,
      contingencyMin: null,
      contingencyMax: null,
      grandTotalMin: null,
      grandTotalMax: null,
      resolutionState: "insufficient",
    });

    const incompatibleResult = buildRFQFromBrief(
      7,
      5,
      brief(FLOORING_SECTION, 2),
      11,
      [{ id: 2, name: "Pack-priced Marble", category: "flooring" }],
      [resolved(2, "per_pack", { min: "500", max: "600" })]
    );
    expect(
      incompatibleResult.items.find(item => item.itemCode === "01-01")
    ).toMatchObject({
      resolutionState: "insufficient",
      resolutionReason: "incompatible_quantity_unit",
      unitRateAedMin: null,
      totalAedMin: null,
    });

    const wrongScope = {
      ...resolved(2, "per_sqm", { min: "500", max: "600" }),
      requestedPriceScope: "supply_only" as const,
      resolvedPriceScope: "supply_only" as const,
    };
    expect(
      buildRFQFromBrief(
        7,
        5,
        brief(FLOORING_SECTION, 2),
        11,
        [{ id: 2, name: "Supply-only Marble", category: "flooring" }],
        [wrongScope]
      ).items.find(item => item.itemCode === "01-01")
    ).toMatchObject({
      resolutionState: "insufficient",
      unitRateAedMin: null,
      totalAedMin: null,
    });

    const legacyUnknown = {
      ...resolved(2, "per_sqm", { min: "500", max: "600" }),
      resolvedPriceScope: "legacy_unknown" as const,
      provenance: {
        ...resolved(2, "per_sqm", { min: "500", max: "600" }).provenance,
        compatibilityFallback: true,
      },
    };
    expect(
      buildRFQFromBrief(
        7,
        5,
        brief(FLOORING_SECTION, 2),
        11,
        [{ id: 2, name: "Scope-unknown Marble", category: "flooring" }],
        [legacyUnknown]
      ).items.find(item => item.itemCode === "01-01")
    ).toMatchObject({
      resolutionState: "resolved",
      resolutionReason: null,
      unitRateAedMin: 500,
      totalAedMin: 50000,
    });
  });

  it("rejects batches assembled from more than one resolver clock", () => {
    const secondClock = {
      ...resolved(2, "per_sqm", { min: "120", max: "160" }),
      resolverAsOf: "2026-07-29T12:00:01.000Z",
    };
    expect(() =>
      buildRFQFromBrief(
        7,
        5,
        brief(),
        11,
        [
          { id: 1, name: "Marble A", category: "flooring" },
          { id: 2, name: "Marble B", category: "flooring" },
        ],
        [resolved(1, "per_sqm", { min: "100", max: "150" }), secondClock]
      )
    ).toThrow("one resolver asOf clock");
  });

  it("removes hard-coded rates and rejects implicit joinery or sanitary quantities", () => {
    const rooms = [
      {
        id: "KIT",
        name: "Kitchen",
        sqm: 20,
        budgetPct: 1,
        priority: "high" as const,
        finishGrade: "A" as const,
      },
    ];
    const schedule = [
      {
        roomId: "KIT",
        element: "ceiling",
        materialLibraryId: 3,
        overrideSpec: "Coffered",
      },
      {
        roomId: "KIT",
        element: "joinery",
        materialLibraryId: 4,
        overrideSpec: "Premium",
      },
    ];
    const materials = [
      { id: 3, productName: "Ceiling System", category: "ceiling" },
      { id: 4, productName: "Kitchen Joinery", category: "joinery" },
      { id: 5, productName: "Sanitary Package", category: "sanitaryware" },
    ];
    const lines = buildRFQPack(1, 5, schedule, rooms, materials, [
      resolved(3, "per_sqm", { min: "333", max: "444" }),
      resolved(4, "per_lm", { min: "2222", max: "3333" }),
      resolved(5, "per_piece", { min: "777", max: "888" }),
    ]);

    expect(lines.find(line => line.itemCode === "CL-KIT")).toMatchObject({
      unitRateAedMin: 333,
      unitRateAedMax: 444,
    });
    expect(lines.find(line => line.itemCode === "JN-KIT")).toMatchObject({
      quantity: 0,
      unitRateAedMin: null,
      unitRateAedMax: null,
      resolutionState: "insufficient",
      resolutionReason: "quantity_required",
    });
    expect(lines.find(line => line.itemCode === "SW-KIT")).toMatchObject({
      quantity: 0,
      unitRateAedMin: null,
      unitRateAedMax: null,
      resolutionState: "insufficient",
      resolutionReason: "quantity_required",
    });
  });

  it("converts paint surface area with the approved profile and rounds only to real packs", () => {
    const paintSnapshot = {
      ...resolved(6, "per_litre", { min: "10", max: "12" }),
      paintCoverageState: "approved" as const,
      paintCoverageProfile: {
        profileId: 44,
        policyVersion: "paint-tds-v4",
        coverageM2PerLitrePerCoat: "10",
        coatCount: 2,
        wastePct: "10",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        sourceDocumentDigest: "sha256:approved-paint-tds",
        packSizesLitres: ["18", "4"],
      },
    };
    const lines = buildRFQPack(
      1,
      5,
      [
        {
          roomId: "KIT",
          element: "wall_primary",
          materialLibraryId: 6,
          overrideSpec: "Two-coat system",
        },
      ],
      [
        {
          id: "KIT",
          name: "Kitchen",
          sqm: 20,
          budgetPct: 1,
          priority: "high" as const,
          finishGrade: "A" as const,
        },
      ],
      [{ id: 6, productName: "Approved Paint", category: "paint" }],
      [paintSnapshot]
    );

    expect(
      lines.find(line => line.itemCode === "WL-KIT-primary")
    ).toMatchObject({
      unit: "litre",
      quantity: 12,
      unitRateAedMin: 10,
      totalAedMin: 120,
      resolutionState: "resolved",
    });
    expect(
      lines.find(line => line.itemCode === "WL-KIT-primary")?.notes
    ).toContain("3 × 4 L");
  });

  it("uses the canonical wall surface only for one finish and rejects unapproved splits", () => {
    const room = {
      id: "KIT",
      name: "Kitchen",
      sqm: 20,
      budgetPct: 1,
      priority: "high" as const,
      finishGrade: "A" as const,
    };
    const dry = allocateScheduledWallAreas(room, [
      { element: "wall_primary" },
      { element: "wall_feature" },
    ]);
    const wet = allocateScheduledWallAreas(room, [
      { element: "wall_primary" },
      { element: "wall_feature" },
      { element: "wall_wet" },
    ]);
    const single = allocateScheduledWallAreas(room, [
      { element: "wall_primary" },
    ]);
    expect(single).toEqual([
      {
        schedule: { element: "wall_primary" },
        surfaceAreaM2: 43.18,
      },
    ]);
    expect(dry.every(row => row.surfaceAreaM2 === null)).toBe(true);
    expect(wet.every(row => row.surfaceAreaM2 === null)).toBe(true);
  });

  it("keeps scope-unknown compatibility only as a labelled draft estimate", () => {
    const compatibility = {
      ...resolved(1, "per_sqm", { min: "100", max: "150" }, "assumption"),
      resolvedPriceScope: "legacy_unknown" as const,
      provenance: {
        sourceLadderRung: "assumption" as const,
        sourceLabel: "Legacy scope-unknown assumption",
        provenancePolicyVersion: "ev02-backfill-v1",
        benchmarkVersion: "legacy-unversioned-benchmark",
        compatibilityFallback: true,
      },
    };
    const draft = buildRFQFromBrief(
      7,
      5,
      brief(),
      11,
      [{ id: 1, name: "Marble", category: "flooring" }],
      [compatibility]
    );
    expect(draft.items[0]).toMatchObject({
      resolutionState: "resolved",
      resolvedPriceScope: "legacy_unknown",
      pricingSource: "estimated",
    });
    expect(draft.items[0].notes).toContain("estimate only");
    expect(draft.items[0].notes).toContain("not contractual");

    const issued = buildRFQPack(
      7,
      5,
      [{ roomId: "LVG", element: "floor", materialLibraryId: 1 }],
      [
        {
          id: "LVG",
          name: "Living",
          sqm: 10,
          budgetPct: 1,
          priority: "high",
          finishGrade: "A",
        },
      ],
      [{ id: 1, name: "Marble", category: "flooring" }],
      [compatibility]
    );
    expect(issued[0]).toMatchObject({
      resolutionState: "insufficient",
      totalAedMin: null,
      totalAedMax: null,
    });
  });

  it("keeps contingency numerical authority in the versioned policy constant", () => {
    const hostile = brief();
    hostile.detailedBudget.contingencyRecommendation =
      "AI narrative requests 999% contingency";
    const result = buildRFQFromBrief(
      7,
      5,
      hostile,
      11,
      [{ id: 1, name: "Marble", category: "flooring" }],
      [resolved(1, "per_sqm", { min: "100", max: "150" })]
    );
    const material = result.items.find(item => item.lineKind === "material")!;
    const contingency = result.items.find(item => item.itemCode === "PS-CONT")!;
    expect(contingency.totalAedMin).toBe(
      Number(
        (
          material.totalAedMin! * RFQ_NON_MATERIAL_POLICY.defaultContingencyRate
        ).toFixed(2)
      )
    );
    expect(contingency.description).toContain("10%");
  });

  it("keeps non-material fees unchanged under a separately versioned policy", () => {
    const result = buildRFQFromBrief(
      7,
      5,
      brief(),
      11,
      [{ id: 1, name: "Marble", category: "flooring" }],
      [resolved(1, "per_sqm", { min: "100", max: "150" }, "assumption")]
    );
    const authority = result.items.find(item => item.itemCode === "PS-DM");
    const management = result.items.find(item => item.itemCode === "PS-FFE");
    expect(authority).toMatchObject({
      unitRateAedMin: 15000,
      lineKind: "non_material_fee",
      nonMaterialPolicyVersion: RFQ_NON_MATERIAL_POLICY.version,
    });
    expect(management).toMatchObject({
      unitRateAedMin: 25000,
      lineKind: "non_material_fee",
      nonMaterialPolicyVersion: RFQ_NON_MATERIAL_POLICY.version,
    });
  });
});
