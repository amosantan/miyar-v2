import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { WorkflowSpaceMqiReconciliation } from "../engines/report-reconciliation";
import {
  isGovernedBoardPricingCompleteForScoring,
  isIssuedFullReportMaterialCoverageComplete,
} from "./project";

function reconciliation(input: {
  state: "complete" | "partial" | "insufficient";
  total: number;
  priced: number;
  insufficient: number;
  totalsAvailable?: boolean;
}): WorkflowSpaceMqiReconciliation {
  const totalsAvailable = input.totalsAvailable ?? input.state === "complete";
  return {
    spaceProgram: {
      reconciles: input.total > 0,
    },
    allocations: {
      rowCount: input.total,
      groupCount: input.total,
      groups: Array.from({ length: input.total }, (_, index) => ({
        roomId: `ROOM-${index}`,
        roomName: `Room ${index}`,
        element: "floor",
        allocationPct: 100,
        surfaceAreaM2: 10,
        expectedSurfaceAreaM2: 10,
        surfaceDeltaM2: 0,
        percentageReconciles: true,
        surfaceReconciles: true,
      })),
      allGroupsPass100Pct: input.total > 0,
      allGroupsSurfaceReconcile: input.total > 0,
    },
    materialCosts: {
      pricedAllocationCount: input.priced,
      unpricedAllocationCount: input.insufficient,
      allAllocationsPriced:
        input.total > 0 &&
        input.priced === input.total &&
        input.insufficient === 0,
      min: totalsAvailable ? 100 : null,
      mid: totalsAvailable ? 125 : null,
      max: totalsAvailable ? 150 : null,
      coverage: {
        state: input.state,
        totalItemCount: input.total,
        pricedItemCount: input.priced,
        insufficientItemCount: input.insufficient,
      },
    },
  } as WorkflowSpaceMqiReconciliation;
}

describe("issued full-report material coverage gate", () => {
  it("rejects empty coverage", () => {
    expect(
      isIssuedFullReportMaterialCoverageComplete(
        reconciliation({
          state: "insufficient",
          total: 0,
          priced: 0,
          insufficient: 0,
        })
      )
    ).toBe(false);
  });

  it("rejects partial coverage", () => {
    expect(
      isIssuedFullReportMaterialCoverageComplete(
        reconciliation({
          state: "partial",
          total: 2,
          priced: 1,
          insufficient: 1,
        })
      )
    ).toBe(false);
  });

  it("rejects insufficient coverage", () => {
    expect(
      isIssuedFullReportMaterialCoverageComplete(
        reconciliation({
          state: "insufficient",
          total: 2,
          priced: 0,
          insufficient: 2,
        })
      )
    ).toBe(false);
  });

  it("accepts complete, non-empty, reconciled coverage", () => {
    expect(
      isIssuedFullReportMaterialCoverageComplete(
        reconciliation({
          state: "complete",
          total: 2,
          priced: 2,
          insufficient: 0,
        })
      )
    ).toBe(true);
  });

  it("rejects percentage, surface, and space reconciliation failures", () => {
    const base = reconciliation({
      state: "complete",
      total: 2,
      priced: 2,
      insufficient: 0,
    });
    expect(
      isIssuedFullReportMaterialCoverageComplete({
        ...base,
        allocations: { ...base.allocations, allGroupsPass100Pct: false },
      })
    ).toBe(false);
    expect(
      isIssuedFullReportMaterialCoverageComplete({
        ...base,
        allocations: {
          ...base.allocations,
          allGroupsSurfaceReconcile: false,
        },
      })
    ).toBe(false);
    expect(
      isIssuedFullReportMaterialCoverageComplete({
        ...base,
        spaceProgram: { ...base.spaceProgram, reconciles: false },
      })
    ).toBe(false);
  });

  it("rejects a complete-looking allocation set that omits a fit-out room", () => {
    const base = reconciliation({
      state: "complete",
      total: 3,
      priced: 3,
      insufficient: 0,
    });
    const groups = ["floor", "walls", "ceiling"].map(element => ({
      roomId: "LVG",
      roomName: "Living",
      element,
      allocationPct: 100,
      surfaceAreaM2: 10,
      expectedSurfaceAreaM2: 10,
      surfaceDeltaM2: 0,
      percentageReconciles: true,
      surfaceReconciles: true,
    }));
    const incomplete = {
      ...base,
      allocations: {
        ...base.allocations,
        rowCount: 3,
        groupCount: 3,
        groups,
      },
    } as WorkflowSpaceMqiReconciliation;
    expect(
      isIssuedFullReportMaterialCoverageComplete(incomplete, [
        { roomCode: "LVG", isFitOut: true },
        { roomCode: "MBR", isFitOut: true },
      ])
    ).toBe(false);
  });

  it("rejects zero and inverted issued totals", () => {
    const base = reconciliation({
      state: "complete",
      total: 1,
      priced: 1,
      insufficient: 0,
    });
    expect(
      isIssuedFullReportMaterialCoverageComplete({
        ...base,
        materialCosts: { ...base.materialCosts, min: 0, mid: 0, max: 0 },
      })
    ).toBe(false);
    expect(
      isIssuedFullReportMaterialCoverageComplete({
        ...base,
        materialCosts: { ...base.materialCosts, min: 150, mid: 125, max: 100 },
      })
    ).toBe(false);
  });

  it("runs the full-report gate before upload and persistence", () => {
    const source = readFileSync(
      new URL("./project.ts", import.meta.url),
      "utf8"
    );
    const gate = source.indexOf(
      "!isIssuedFullReportMaterialCoverageComplete("
    );
    const upload = source.indexOf("const result = await storagePut(", gate);
    const persistence = source.indexOf(
      "persistence = await db.createReportArtifactsForOrg(",
      gate
    );

    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(upload);
    expect(upload).toBeLessThan(persistence);
    expect(source.slice(gate, upload)).toContain(
      "REPORT_MATERIAL_PRICING_INSUFFICIENT"
    );
  });

  it("builds and persists the governed RFQ artifact contract for full reports", () => {
    const source = readFileSync(
      new URL("./project.ts", import.meta.url),
      "utf8"
    );
    const artifactBranch = source.indexOf(
      'input.reportType === "design_brief" ||\n        input.reportType === "full_report"'
    );
    const rfqBuild = source.indexOf(
      "const rfqPack = buildRFQPackFromAllocations(",
      artifactBranch
    );
    const artifactAssignment = source.indexOf("designArtifacts = {", rfqBuild);
    const fullReportPayload = source.indexOf(
      ": generateFullReport(",
      artifactAssignment
    );
    const persistence = source.indexOf(
      "persistence = await db.createReportArtifactsForOrg(",
      fullReportPayload
    );
    const persistenceBlock = source.slice(persistence, persistence + 1400);

    expect(artifactBranch).toBeGreaterThan(-1);
    expect(rfqBuild).toBeGreaterThan(artifactBranch);
    expect(artifactAssignment).toBeGreaterThan(rfqBuild);
    expect(fullReportPayload).toBeGreaterThan(artifactAssignment);
    expect(persistence).toBeGreaterThan(fullReportPayload);
    expect(persistenceBlock).toContain("designArtifacts,");
    expect(persistenceBlock).toContain("expectedMaterialPricingRevision:");
  });

  it("uses one resolver clock and one authorized stored room set per report", () => {
    const source = readFileSync(
      new URL("./project.ts", import.meta.url),
      "utf8"
    );
    expect(source.match(/const reportMaterialAsOf = new Date\(\)/g)).toHaveLength(
      1
    );
    expect(source.match(/asOf: reportMaterialAsOf/g)).toHaveLength(2);
    expect(source).not.toContain("rfqResolverAsOf");
    expect(source).toContain(
      "[reportStoredRooms, reportStoredAllocations] = await Promise.all(["
    );
    expect(source).toContain(
      "db.getSpaceProgramRooms(input.projectId, ctx.orgId)"
    );
    expect(source).toContain("reportStoredRooms ??");
  });
});

describe("governed board scoring gate", () => {
  function boardSummary(input: {
    state: "complete" | "partial" | "insufficient";
    total: number;
    priced: number;
    insufficient: number;
    mid?: number | null;
  }) {
    return {
      coverage: {
        state: input.state,
        totalItemCount: input.total,
        pricedItemCount: input.priced,
        insufficientItemCount: input.insufficient,
        reasons: {},
      },
      totalAedMin: input.mid === null ? null : 100,
      totalAedMid: input.mid === undefined ? 125 : input.mid,
      totalAedMax: input.mid === null ? null : 150,
    } as Parameters<typeof isGovernedBoardPricingCompleteForScoring>[0];
  }

  it("accepts only non-empty complete governed totals", () => {
    expect(
      isGovernedBoardPricingCompleteForScoring(
        boardSummary({
          state: "complete",
          total: 2,
          priced: 2,
          insufficient: 0,
        })
      )
    ).toBe(true);
    expect(
      isGovernedBoardPricingCompleteForScoring(
        boardSummary({
          state: "partial",
          total: 2,
          priced: 1,
          insufficient: 1,
          mid: null,
        })
      )
    ).toBe(false);
    expect(
      isGovernedBoardPricingCompleteForScoring(
        boardSummary({
          state: "insufficient",
          total: 0,
          priced: 0,
          insufficient: 0,
          mid: null,
        })
      )
    ).toBe(false);
  });

  it("applies governed board pricing before project and scenario scoring", () => {
    const source = readFileSync(
      new URL("./project.ts", import.meta.url),
      "utf8"
    );
    const projectGate = source.indexOf(
      "await applyGovernedBoardCostForScoring({",
      source.indexOf("evaluate: orgHeavyMutationProcedure")
    );
    const projectEvaluation = source.indexOf(
      "const scoreResult = evaluate(inputs, config)",
      projectGate
    );
    const scenarioStart = source.indexOf(
      "applyScenarioTemplate: orgHeavyMutationProcedure"
    );
    const scenarioGate = source.indexOf(
      "await applyGovernedBoardCostForScoring({",
      scenarioStart
    );
    const scenarioEvaluation = source.indexOf(
      "const scoreResult = evaluate(scenarioInputs as ProjectInputs, config)",
      scenarioGate
    );

    expect(projectGate).toBeGreaterThan(-1);
    expect(projectGate).toBeLessThan(projectEvaluation);
    expect(scenarioGate).toBeGreaterThan(scenarioStart);
    expect(scenarioGate).toBeLessThan(scenarioEvaluation);
  });
});
