import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateIssuedRfqArtifacts } from "./db";

function artifacts(
  overrides: {
    detailedBudget?: Record<string, unknown>;
    rfqItems?: Array<Record<string, unknown>>;
  } = {}
) {
  return {
    brief: {
      projectId: 11,
      createdBy: 1,
      projectIdentity: {},
      designNarrative: {},
      materialSpecifications: {},
      boqFramework: {},
      detailedBudget: overrides.detailedBudget ?? {
        rfqMin: 11_500,
        rfqMax: 17_000,
      },
      designerInstructions: {},
    },
    rfqItems: overrides.rfqItems ?? [
      {
        projectId: 11,
        organizationId: 101,
        sectionNo: 1,
        itemCode: "MAT-1",
        description: "Governed material",
        unit: "sqm",
        lineKind: "material",
        resolutionState: "resolved",
        quantity: "100.00",
        unitRateAedMin: "100.00",
        unitRateAedMax: "150.00",
        totalAedMin: "10000.00",
        totalAedMax: "15000.00",
        productId: 10,
        specId: 20,
        benchmarkProposalId: 30,
        benchmarkVersionId: 40,
        resolvedPriceScope: "supply_and_install",
        resolutionAsOf: new Date("2026-07-29T12:00:00.000Z"),
        resolverPolicyVersion: "ev03-material-resolution-v1",
        benchmarkVersion: "benchmark-v1",
        provenancePolicyVersion: "safe-provenance-v1",
        presentationProvenance: {
          sourceLadderRung: "assumption",
          sourceLabel: "MIYAR assumption",
          provenancePolicyVersion: "safe-provenance-v1",
          benchmarkVersion: "benchmark-v1",
          compatibilityFallback: false,
        },
        quantityPolicyVersion: "ev03-direct-unit-v1",
        quantityConversionInputs: { surfaceAreaM2: 100 },
      },
      {
        projectId: 11,
        organizationId: 101,
        sectionNo: 2,
        itemCode: "FEE-1",
        description: "Versioned non-material fee",
        unit: "sum",
        lineKind: "non_material_fee",
        resolutionState: "resolved",
        quantity: "1.00",
        unitRateAedMin: "1500.00",
        unitRateAedMax: "2000.00",
        totalAedMin: "1500.00",
        totalAedMax: "2000.00",
        nonMaterialPolicyVersion: "ev03-rfq-non-material-v1",
      },
    ],
  } as any;
}

describe("EV-03 issued RFQ report persistence", () => {
  it("accepts only complete resolved RFQs whose compatibility totals reconcile", () => {
    expect(validateIssuedRfqArtifacts(artifacts())).toEqual({
      valid: true,
      totalMin: 11_500,
      totalMax: 17_000,
    });
  });

  it("rejects insufficient/null material totals", () => {
    const input = artifacts();
    input.rfqItems[0] = {
      ...input.rfqItems[0],
      resolutionState: "insufficient",
      totalAedMin: null,
      totalAedMax: null,
    };
    expect(validateIssuedRfqArtifacts(input)).toEqual({
      valid: false,
      reason: "incomplete_lines",
    });
  });

  it("rejects fabricated zero or otherwise mismatched persisted totals", () => {
    expect(
      validateIssuedRfqArtifacts(
        artifacts({
          detailedBudget: { rfqMin: 0, rfqMax: 0 },
        })
      )
    ).toEqual({
      valid: false,
      reason: "totals_mismatch",
    });
  });

  it("rejects fee-only batches that contain no governed material line", () => {
    const input = artifacts();
    input.rfqItems = input.rfqItems.filter(
      (line: any) => line.lineKind !== "material"
    );
    expect(validateIssuedRfqArtifacts(input)).toEqual({
      valid: false,
      reason: "incomplete_lines",
    });
  });

  it("rejects forged scope, identity, provenance, clocks, and arithmetic", () => {
    for (const mutation of [
      { resolvedPriceScope: "legacy_unknown" },
      { productId: null },
      { specId: null },
      { benchmarkProposalId: null },
      { resolverPolicyVersion: null },
      { presentationProvenance: { supplierQuoteId: 99 } },
      { totalAedMin: "9999.99" },
    ]) {
      const input = artifacts();
      input.rfqItems[0] = { ...input.rfqItems[0], ...mutation };
      expect(validateIssuedRfqArtifacts(input)).toEqual({
        valid: false,
        reason: "incomplete_lines",
      });
    }

    const mixedClock = artifacts();
    mixedClock.rfqItems.splice(1, 0, {
      ...mixedClock.rfqItems[0],
      itemCode: "MAT-2",
      resolutionAsOf: new Date("2026-07-29T12:00:01.000Z"),
    });
    mixedClock.brief.detailedBudget = {
      rfqMin: 21_500,
      rfqMax: 32_000,
    };
    expect(validateIssuedRfqArtifacts(mixedClock)).toEqual({
      valid: false,
      reason: "incomplete_lines",
    });
  });

  it("rejects unversioned or arithmetically forged non-material policy lines", () => {
    for (const mutation of [
      { nonMaterialPolicyVersion: null },
      { quantity: "2.00" },
      { unitRateAedMin: null },
      { totalAedMax: "1999.99" },
    ]) {
      const input = artifacts();
      input.rfqItems[1] = { ...input.rfqItems[1], ...mutation };
      expect(validateIssuedRfqArtifacts(input)).toEqual({
        valid: false,
        reason: "incomplete_lines",
      });
    }
  });

  it("fails the report before storage and persists calculated totals, never zero", () => {
    const source = readFileSync(
      new URL("./routers/project.ts", import.meta.url),
      "utf8"
    );
    const start = source.indexOf("const materialRfqLines = rfqPack.filter(");
    const storage = source.indexOf("const result = await storagePut(", start);
    const persistence = source.indexOf(
      "persistence = await db.createReportArtifactsForOrg(",
      start
    );
    const block = source.slice(start, persistence);

    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(storage);
    expect(storage).toBeLessThan(persistence);
    expect(block).toContain("REPORT_RFQ_PRICING_INSUFFICIENT");
    expect(block).toContain(
      "detailedBudget: { totalFitoutBudgetAed, rfqMin, rfqMax }"
    );
    expect(block).not.toMatch(/rfqMin:\s*0|rfqMax:\s*0/);
  });

  it("marks only report-embedded RFQ rows issued", () => {
    const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const reportStart = source.indexOf(
      "export async function createReportArtifactsForOrg"
    );
    const reportEnd = source.indexOf(
      "export async function getReportsByProject",
      reportStart
    );
    const standaloneStart = source.indexOf(
      "export async function insertRfqLineItemsForOrg"
    );
    const standaloneEnd = source.indexOf(
      "export async function insertDmComplianceChecklist",
      standaloneStart
    );

    expect(source.slice(reportStart, reportEnd)).toContain(
      'artifactState: "issued"'
    );
    expect(source.slice(standaloneStart, standaloneEnd)).toContain(
      'artifactState: "draft"'
    );
    expect(source.slice(standaloneStart, standaloneEnd)).toContain(
      'eq(rfqLineItems.artifactState, "draft")'
    );
  });

  it("compares the captured material-pricing revision under both project locks", () => {
    const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const reportStart = source.indexOf(
      "export async function createReportArtifactsForOrg"
    );
    const reportEnd = source.indexOf(
      "export async function getReportsByProject",
      reportStart
    );
    const standaloneStart = source.indexOf(
      "export async function insertRfqLineItemsForOrg"
    );
    const standaloneEnd = source.indexOf(
      "export async function insertDmComplianceChecklist",
      standaloneStart
    );
    const reportBlock = source.slice(reportStart, reportEnd);
    const standaloneBlock = source.slice(standaloneStart, standaloneEnd);

    expect(reportBlock).toContain("projects.materialPricingRevision");
    expect(reportBlock).toContain("expectedMaterialPricingRevision");
    expect(reportBlock.indexOf("expectedMaterialPricingRevision")).toBeLessThan(
      reportBlock.indexOf("tx.insert(finishScheduleItems)")
    );
    expect(standaloneBlock).toContain("projects.materialPricingRevision");
    expect(standaloneBlock).toContain("expected.materialPricingRevision");
    expect(standaloneBlock.indexOf("expected.materialPricingRevision")).toBeLessThan(
      standaloneBlock.indexOf(".delete(rfqLineItems)")
    );
  });
});
