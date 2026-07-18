import { describe, expect, it } from "vitest";
import { TR10_FIXTURES } from "../../tests/fixtures/reports/tr10-report-fixtures";
import {
  createPdfReportRenderContext,
  generateReportHTML,
  type PDFReportInput,
} from "./pdf-report";
import type { WorkflowSpaceMqiReconciliation } from "./report-reconciliation";

const reconciliation: WorkflowSpaceMqiReconciliation = {
  version: "workflow-space-mqi-reconciliation-v1",
  sourceTables: ["projects", "space_program_rooms", "material_allocations", "material_library"],
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
    groups: [{
      roomId: "LVG",
      roomName: "Living",
      element: "floor",
      allocationPctTotal: 100,
      passes100Pct: true,
      surfaceAreaM2Total: 30,
      expectedSurfaceAreaM2: 30,
      surfaceVarianceM2: 0,
      surfaceReconciles: true,
    }],
  },
  materialCosts: {
    currency: "AED",
    source: "material_library.priceAedMin/priceAedMax",
    pricedAllocationCount: 3,
    unpricedAllocationCount: 0,
    allAllocationsPriced: true,
    min: 2600,
    mid: 4400,
    max: 6200,
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
    expect(html).toContain("material_library.priceAedMin/priceAedMax");
    expect(html).toContain("projects, space_program_rooms, material_allocations, material_library");
    expect(generateReportHTML("validation_summary", report)).not.toContain("sec-workflow-reconciliation");
  });

  it("includes rendered reconciliation values in the full-report fingerprint only", () => {
    const report = TR10_FIXTURES.complete.report;
    const full = createPdfReportRenderContext("full_report", {
      ...report,
      workflowReconciliation: reconciliation,
    }, identity);
    const fullChanged = createPdfReportRenderContext("full_report", {
      ...report,
      workflowReconciliation: {
        ...reconciliation,
        materialCosts: { ...reconciliation.materialCosts, mid: 4401 },
      },
    }, identity);
    const validation = createPdfReportRenderContext("validation_summary", {
      ...report,
      workflowReconciliation: reconciliation,
    }, identity);
    const validationChanged = createPdfReportRenderContext("validation_summary", {
      ...report,
      workflowReconciliation: {
        ...reconciliation,
        materialCosts: { ...reconciliation.materialCosts, mid: 4401 },
      },
    }, identity);

    expect(fullChanged.renderInputFingerprint).not.toBe(full.renderInputFingerprint);
    expect(validationChanged.renderInputFingerprint).toBe(validation.renderInputFingerprint);
  });
});
