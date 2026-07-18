import { describe, expect, it } from "vitest";
import { TR10_FIXTURES, TR10_PAIRWISE_MATRIX } from "../../tests/fixtures/reports/tr10-report-fixtures";

describe("TR-10 synthetic report fixture catalog", () => {
  it("contains every required synthetic stress fixture", () => {
    expect(Object.keys(TR10_FIXTURES).sort()).toEqual([
      "arabic_bidi", "board_heavy", "complete", "empty", "hostile", "large_number", "long_content", "missing_assets", "partial",
    ]);
  });

  it("pairwise matrix covers every issued report/export surface", () => {
    const surfaces = new Set(TR10_PAIRWISE_MATRIX.map(([surface]) => surface));
    expect([...surfaces].sort()).toEqual([
      "autonomous_design_brief", "board", "design_brief", "docx", "full_report", "investor", "portfolio", "scenario", "validation_summary",
    ]);
    expect(new Set(TR10_PAIRWISE_MATRIX.map(([, fixture]) => fixture))).toEqual(new Set(Object.keys(TR10_FIXTURES)));
  });

  it("uses the canonical score-result string and conditional-action shapes", () => {
    const score = TR10_FIXTURES.hostile.report.scoreResult;

    expect(score.riskFlags).toEqual([
      expect.stringContaining("<img src=x onerror=alert(1)>")
    ]);
    expect(score.conditionalActions).toEqual([
      expect.objectContaining({
        trigger: expect.stringContaining("<img src=x onerror=alert(1)>"),
        recommendation: expect.stringContaining("preserve evidence"),
        variables: ["fin01BudgetCap", "des03Complexity"],
      }),
    ]);
  });
});
