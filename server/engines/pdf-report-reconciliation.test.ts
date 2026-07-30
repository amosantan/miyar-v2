import { describe, expect, it } from "vitest";
import { TR10_FIXTURES } from "../../tests/fixtures/reports/tr10-report-fixtures";
import {
  createPdfReportRenderContext,
  generateReportHTML,
  type PDFReportInput,
} from "./pdf-report";
import type { WorkflowSpaceMqiReconciliation } from "./report-reconciliation";
import { MATERIAL_RESOLUTION_POLICY_VERSION } from "../../shared/material-calculations";
import type { ClaimHealthSafeProjection } from "../../shared/claim-health";

const claimHealth: ClaimHealthSafeProjection = {
  claimState: "current_with_fallback",
  evaluatedAt: "2026-07-30T12:00:00.000Z",
  policyVersion: "ev04-claim-health-v1",
  policyManifestDigest: "sha256:ev04-policy-manifest",
  requiredCellSchemaVersion: "ev04-required-cell-v1",
  counts: { required: 2, eligible: 2, exact: 1, fallback: 1, optional: 0 },
  reasonCodes: ["approved_fallback"],
  cells: [],
};

const reconciliation: WorkflowSpaceMqiReconciliation = {
  version: "workflow-space-mqi-reconciliation-v1",
  sourceTables: [
    "projects",
    "space_program_rooms",
    "material_allocations",
    "governed_material_values",
  ],
  spaceProgram: {
    storedRoomCount: 3,
    fitOutRoomCount: 2,
    manualRoomCount: 1,
    projectFitOutAreaM2: 30,
    fitOutRoomAreaM2: 30,
    varianceM2: 0,
    reconciles: true,
  },
  surfaces: {
    formulaVersion: "mqi-surface-area-v1",
    ceilingHeightM: 2.8,
    floorM2: 30,
    wallsM2: 73.86,
    ceilingM2: 28.5,
    totalM2: 132.36,
  },
  allocations: {
    rowCount: 3,
    groupCount: 2,
    lockedRowCount: 2,
    lockedGroupCount: 1,
    allGroupsPass100Pct: true,
    allGroupsSurfaceReconcile: true,
    groups: [
      {
        roomId: "LVG",
        roomName: "Living",
        element: "floor",
        allocationPctTotal: 100,
        passes100Pct: true,
        surfaceAreaM2Total: 30,
        expectedSurfaceAreaM2: 30,
        surfaceVarianceM2: 0,
        surfaceReconciles: true,
      },
    ],
  },
  materialCosts: {
    currency: "AED",
    source: "EV-02 governed material-price resolver",
    pricedAllocationCount: 3,
    unpricedAllocationCount: 0,
    allAllocationsPriced: true,
    min: 2600,
    mid: 4400,
    max: 6200,
    coverage: {
      state: "complete",
      totalItemCount: 3,
      pricedItemCount: 3,
      insufficientItemCount: 0,
      reasons: {},
    },
    basis: {
      policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
      label: "Legacy scope-unknown assumption",
      assumptionRowCount: 2,
      observedRowCount: 0,
    },
  },
};

const identity = {
  documentId: "MYR-RECONCILIATION-TEST",
  generatedAt: "2026-07-18T08:00:00.000Z",
  artifactVersion: "artifact-v1",
  rendererVersion: "renderer-v1",
  modelVersion: "model-v1",
  benchmarkVersion: "benchmark-v1",
  logicVersion: "logic-v1",
};

describe("full-report workflow reconciliation", () => {
  it("renders the optional contract only in the full report", () => {
    const report = {
      ...TR10_FIXTURES.complete.report,
      workflowReconciliation: reconciliation,
    } satisfies PDFReportInput;

    const html = generateReportHTML("full_report", report);
    expect(html).toContain("Workflow, Space & MQI Reconciliation");
    expect(html).toContain("30.00 m²");
    expect(html).toContain("100.00%");
    expect(html).toContain("AED 4,400.00");
    expect(html).toContain("EV-02 governed material-price resolver");
    expect(html).toContain(
      "projects, space_program_rooms, material_allocations, governed_material_values"
    );
    // EV-03: the compatibility label itself renders without a duplicate note and
    // never uses the TR-11 forbidden claim wording.
    expect(html).toContain("Cost basis:");
    expect(html.toLowerCase()).toContain("legacy scope-unknown assumption");
    expect(html).not.toContain("(Market-Verified)");
    expect(html).not.toContain("DLD-Backed Recommendations");
    expect(generateReportHTML("validation_summary", report)).not.toContain(
      "sec-workflow-reconciliation"
    );
  });

  it("renders legacy reconciliation payloads without a basis field intact", () => {
    const legacyReconciliation = {
      ...reconciliation,
      materialCosts: (({ basis: _basis, ...rest }) => rest)(
        reconciliation.materialCosts
      ),
    } as unknown as WorkflowSpaceMqiReconciliation;
    const html = generateReportHTML("full_report", {
      ...TR10_FIXTURES.complete.report,
      workflowReconciliation: legacyReconciliation,
    } satisfies PDFReportInput);
    expect(html).toContain("Workflow, Space & MQI Reconciliation");
    expect(html).not.toContain("Cost basis:");
  });

  it("renders and fingerprints the frozen safe claim-health projection", () => {
    const report = {
      ...TR10_FIXTURES.complete.report,
      claimHealth,
    } satisfies PDFReportInput;
    const html = generateReportHTML("full_report", report);
    expect(html).toContain('id="sec-claim-health"');
    expect(html).toContain("Current with approved fallback");
    expect(html).toContain("2/2");
    expect(html).toContain("not a live recomputation");
    expect(html).not.toContain("sourceName");
    expect(html).not.toContain("runId");

    const first = createPdfReportRenderContext("full_report", report, identity);
    const changed = createPdfReportRenderContext(
      "full_report",
      {
        ...report,
        claimHealth: { ...claimHealth, claimState: "stale" },
      },
      identity
    );
    expect(changed.renderInputFingerprint).not.toBe(
      first.renderInputFingerprint
    );
  });

  it("renders explicit English and Arabic legacy, current, and fallback states", () => {
    const currentHealth: ClaimHealthSafeProjection = {
      ...claimHealth,
      claimState: "current",
      counts: { ...claimHealth.counts, exact: 2, fallback: 0 },
      reasonCodes: [],
    };
    const render = (
      locale: "en" | "ar",
      health?: ClaimHealthSafeProjection
    ) =>
      generateReportHTML("full_report", {
        ...TR10_FIXTURES.complete.report,
        locale,
        claimHealth: health,
      });

    const englishLegacy = render("en");
    const arabicLegacy = render("ar");
    const englishCurrent = render("en", currentHealth);
    const arabicCurrent = render("ar", currentHealth);
    const englishFallback = render("en", claimHealth);
    const arabicFallback = render("ar", claimHealth);

    expect(englishLegacy).toContain("Legacy — health snapshot unavailable");
    expect(englishLegacy).toContain(
      "Evidence health is unavailable and was not recomputed."
    );
    expect(arabicLegacy).toContain("قديم — لقطة صحة الأدلة غير متاحة");
    expect(arabicLegacy).toContain(
      "حالة الأدلة غير متاحة ولم تتم إعادة تقييمها."
    );
    expect(arabicLegacy).not.toContain(
      "Legacy — health snapshot unavailable"
    );

    expect(englishCurrent).toContain("Claim state:</strong> Current");
    expect(arabicCurrent).toContain("الحالة:</strong> حالي");
    expect(englishFallback).toContain("Current with approved fallback");
    expect(arabicFallback).toContain("حالي مع بديل معتمد");
    for (const arabicLabel of [
      "الخلايا المطلوبة",
      "المطابقات الدقيقة",
      "البدائل المعتمدة",
      "إصدار السياسة",
      "إصدار مخطط الخلايا",
      "ليست إعادة تقييم مباشرة",
    ]) {
      expect(arabicFallback).toContain(arabicLabel);
    }
    for (const html of [
      englishLegacy,
      arabicLegacy,
      englishCurrent,
      arabicCurrent,
      englishFallback,
      arabicFallback,
    ]) {
      expect(html).toContain('id="sec-claim-health"');
      expect(html).not.toContain("runId");
      expect(html).not.toContain("rawError");
      expect(html).not.toContain("sourceName");
    }
  });

  it("includes rendered reconciliation values in the full-report fingerprint only", () => {
    const report = TR10_FIXTURES.complete.report;
    const full = createPdfReportRenderContext(
      "full_report",
      {
        ...report,
        workflowReconciliation: reconciliation,
      },
      identity
    );
    const fullChanged = createPdfReportRenderContext(
      "full_report",
      {
        ...report,
        workflowReconciliation: {
          ...reconciliation,
          materialCosts: { ...reconciliation.materialCosts, mid: 4401 },
        },
      },
      identity
    );
    const validation = createPdfReportRenderContext(
      "validation_summary",
      {
        ...report,
        workflowReconciliation: reconciliation,
      },
      identity
    );
    const validationChanged = createPdfReportRenderContext(
      "validation_summary",
      {
        ...report,
        workflowReconciliation: {
          ...reconciliation,
          materialCosts: { ...reconciliation.materialCosts, mid: 4401 },
        },
      },
      identity
    );

    expect(fullChanged.renderInputFingerprint).not.toBe(
      full.renderInputFingerprint
    );
    expect(validationChanged.renderInputFingerprint).toBe(
      validation.renderInputFingerprint
    );
  });
});
