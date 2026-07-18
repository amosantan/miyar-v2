import { describe, expect, it } from "vitest";
import { createBoardPdfRenderContext } from "./board-pdf";
import { createDesignBriefDocxRenderContext } from "./docx-brief";
import { createInvestorPdfRenderContext } from "./investor-pdf";
import { createPdfReportRenderContext } from "./pdf-report";
import { TR10_FIXTURES } from "../../tests/fixtures/reports/tr10-report-fixtures";

const identity = {
  documentId: "MYR-FINGERPRINT-TEST",
  generatedAt: "2026-07-18T08:00:00.000Z",
  artifactVersion: "artifact-v1",
  rendererVersion: "renderer-v1",
  modelVersion: "model-v1",
  benchmarkVersion: "benchmark-v1",
  logicVersion: "logic-v1",
};

describe("TR-10 per-surface render-input fingerprint payloads", () => {
  it("uses only validation-summary values that are actually rendered", () => {
    const fixture = TR10_FIXTURES.complete;
    const first = createPdfReportRenderContext("validation_summary", fixture.report, identity);
    const reordered = createPdfReportRenderContext("validation_summary", { ...fixture.report }, identity);
    const unrenderedChange = createPdfReportRenderContext("validation_summary", { ...fixture.report, autonomousContent: "not rendered by validation" }, identity);
    const renderedChange = createPdfReportRenderContext("validation_summary", {
      ...fixture.report,
      scoreResult: { ...fixture.report.scoreResult, compositeScore: fixture.report.scoreResult.compositeScore + 1 },
    }, identity);
    const labelChange = createPdfReportRenderContext("validation_summary", fixture.report, { ...identity, modelVersion: "model-v2" });

    expect(reordered.renderInputFingerprint).toBe(first.renderInputFingerprint);
    expect(unrenderedChange.renderInputFingerprint).toBe(first.renderInputFingerprint);
    expect(renderedChange.renderInputFingerprint).not.toBe(first.renderInputFingerprint);
    expect(labelChange.renderInputFingerprint).not.toBe(first.renderInputFingerprint);
  });

  it("is deterministic and input-sensitive for standalone HTML and DOCX builders", () => {
    const fixture = TR10_FIXTURES.complete;
    const board = createBoardPdfRenderContext({ ...fixture.board, ...identity });
    const boardRepeat = createBoardPdfRenderContext({ ...fixture.board, ...identity });
    const boardChanged = createBoardPdfRenderContext({ ...fixture.board, ...identity, boardName: "Changed board" });
    expect(boardRepeat.renderInputFingerprint).toBe(board.renderInputFingerprint);
    expect(boardChanged.renderInputFingerprint).not.toBe(board.renderInputFingerprint);

    const investor = createInvestorPdfRenderContext({ ...fixture.investor, ...identity });
    const investorIgnoredToken = createInvestorPdfRenderContext({ ...fixture.investor, ...identity, shareToken: "not-rendered" });
    const investorChanged = createInvestorPdfRenderContext({ ...fixture.investor, ...identity, totalFitoutBudget: fixture.investor.totalFitoutBudget + 1 });
    expect(investorIgnoredToken.renderInputFingerprint).toBe(investor.renderInputFingerprint);
    expect(investorChanged.renderInputFingerprint).not.toBe(investor.renderInputFingerprint);

    const docx = createDesignBriefDocxRenderContext(fixture.docx, identity);
    const docxRepeat = createDesignBriefDocxRenderContext({ ...fixture.docx }, identity);
    const docxChanged = createDesignBriefDocxRenderContext({ ...fixture.docx, projectName: "Changed brief" }, identity);
    expect(docxRepeat.renderInputFingerprint).toBe(docx.renderInputFingerprint);
    expect(docxChanged.renderInputFingerprint).not.toBe(docx.renderInputFingerprint);
  });
});
