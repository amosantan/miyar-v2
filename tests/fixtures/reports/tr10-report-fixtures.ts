import type { ReportLocale } from "../../../shared/report-locale";
import type { PDFReportInput, PortfolioPDFInput, ScenarioComparisonPDFInput } from "../../../server/engines/pdf-report";
import type { BoardPdfInput, BoardPdfItem } from "../../../server/engines/board-pdf";
import type { InvestorPdfInput } from "../../../server/engines/investor-pdf";
import type { DesignBriefData } from "../../../server/engines/docx-brief";
import type { ProjectInputs, ROIResult, ScoreResult } from "../../../shared/miyar-types";
import { buildBoardAnnexData } from "../../../server/engines/board-annex";
import { computeBoardSummary, generateRfqLines, type BoardItem } from "../../../server/engines/board-composer";

export type Tr10FixtureId = "complete" | "partial" | "empty" | "large_number" | "arabic_bidi" | "long_content" | "board_heavy" | "missing_assets" | "hostile";

export interface Tr10ReportFixture {
  id: Tr10FixtureId;
  locale: ReportLocale;
  expected: { requiredText: string[]; exactTotals: Record<string, number> };
  report: PDFReportInput;
  board: BoardPdfInput;
  investor: InvestorPdfInput;
  scenario: ScenarioComparisonPDFInput;
  portfolio: PortfolioPDFInput;
  docx: DesignBriefData;
}

const BASE_BOARD_ITEMS: BoardItem[] = [{
  materialId: 1, name: "Calacatta Gold Marble", category: "stone", tier: "luxury", costLow: 450, costHigh: 800,
  costUnit: "AED/sqm", leadTimeDays: 90, leadTimeBand: "critical", supplierName: "Synthetic Supplier", quantity: 120, unitOfMeasure: "sqm", notes: "Synthetic fixture only",
}];

function projectInputs(): ProjectInputs {
  return {
    ctx01Typology: "Residential", ctx02Scale: "Medium", ctx03Gfa: 12000, totalFitoutArea: null, ctx04Location: "Prime", ctx05Horizon: "12-24m", city: "Dubai", sustainCertTarget: "none",
    str01BrandClarity: 4, str02Differentiation: 4, str03BuyerMaturity: 3, mkt01Tier: "Luxury", mkt02Competitor: 3, mkt03Trend: 4,
    fin01BudgetCap: 2500000, fin02Flexibility: 3, fin03ShockTolerance: 3, fin04SalesPremium: 3,
    des01Style: "Modern", des02MaterialLevel: 4, des03Complexity: 3, des04Experience: 4, des05Sustainability: 3,
    exe01SupplyChain: 3, exe02Contractor: 3, exe03Approvals: 3, exe04QaMaturity: 3, add01SampleKit: false, add02PortfolioMode: false, add03DashboardExport: true,
  };
}

function fixtureScoreResult(inputSnapshot: ProjectInputs, stressText: string): ScoreResult {
  return {
    dimensions: { sa: 78, ff: 72, mp: 81, ds: 76, er: 68 },
    dimensionWeights: { sa: .25, ff: .2, mp: .2, ds: .2, er: .15 },
    compositeScore: 75.4, riskScore: 28, rasScore: 72, confidenceScore: 86, decisionStatus: "conditional",
    penalties: [],
    riskFlags: [`Synthetic risk flag: ${stressText}`],
    conditionalActions: [{
      trigger: `Synthetic trigger: ${stressText}`,
      recommendation: `Synthetic recommendation: preserve evidence for ${stressText}`,
      variables: ["fin01BudgetCap", "des03Complexity"],
    }],
    variableContributions: { sa: { str01BrandClarity: 0.8 }, ff: { fin01BudgetCap: -0.4 } },
    inputSnapshot,
  };
}

function makeFixture(id: Tr10FixtureId, locale: ReportLocale, name: string, extra = ""): Tr10ReportFixture {
  const boardItems: BoardItem[] = id === "empty" ? [] : id === "board_heavy" ? Array.from({ length: 14 }, (_, index) => ({ ...BASE_BOARD_ITEMS[0], materialId: index + 1, name: `Synthetic Material ${index + 1}`, leadTimeDays: 30 + index })) : BASE_BOARD_ITEMS;
  const items: BoardPdfItem[] = boardItems.map(item => ({ ...item, quantity: item.quantity === undefined ? undefined : String(item.quantity) }));
  const hostile = id === "hostile" ? `<img src=x onerror=alert(1)> [unsafe](javascript:alert(1))` : "";
  const arabic = id === "arabic_bidi" ? "مشروع دبي 2026 AED 1,250,000 اتجاه مختلط" : "";
  const long = id === "long_content" ? "Long synthetic report content. ".repeat(500) : "";
  const projectName = `${name} ${arabic} ${hostile}`.trim();
  const inputs = projectInputs();
  const stressText = [extra, arabic, hostile, long.slice(0, 160)].filter(Boolean).join(" ") || "normal synthetic conditions";
  const scoreResult = fixtureScoreResult(inputs, stressText);
  const boardAnnex = buildBoardAnnexData(id === "missing_assets" ? [{ boardName: "Missing asset board", linkedItemCount: 2, resolvedItems: [] }] : [{ boardName: "Synthetic Board", linkedItemCount: boardItems.length, resolvedItems: boardItems }]);
  const roi: ROIResult = { totalValue: 1250000, reworkAvoided: 250000, procurementSavings: 125000, timeValueGain: 50000, specEfficiency: 75000, positioningPremium: 750000, fee: 50000, netROI: 1200000, roiMultiple: 24 };
  const report: PDFReportInput = {
    projectName, projectId: 101, inputs, scoreResult, sensitivity: [], roi,
    benchmarkVersion: "synthetic-benchmark-v1", logicVersion: "synthetic-logic-v1", modelVersion: "synthetic-model-v1", locale,
    evidenceRefs: [{ title: `Synthetic evidence ${hostile}`, sourceUrl: id === "hostile" ? "javascript:alert(1)" : "https://example.invalid/synthetic", category: "synthetic", reliabilityGrade: "A", captureDate: "2026-01-01", confidenceStatus: "computed", confidencePolicyVersion: "synthetic-v1" }],
    boardAnnex, designBrief: { designNarrative: { positioningStatement: `${long} ${hostile}` }, materialSpecifications: {}, boqFramework: { coreAllocations: [] }, detailedBudget: {}, designerInstructions: { phasedDeliverables: {} } }, autonomousContent: `# Synthetic brief\n\n${long} ${hostile}`,
  };
  const summary = computeBoardSummary(boardItems);
  const board: BoardPdfInput = { boardName: "Synthetic Board", projectName, items, summary, rfqLines: generateRfqLines(boardItems), locale };
  const investor: InvestorPdfInput = {
    projectName, typology: "Residential", location: "Dubai", tier: "Luxury", style: "Modern", gfaSqm: id === "large_number" ? 9_999_999_999 : 12_000,
    execSummary: `${long} ${hostile}`, designDirection: { direction: arabic || "Contemporary", content: long }, spaces: id === "empty" ? [] : [{ name: "Living Room", budgetAed: 1_250_000, sqm: 200, pct: 42 }],
    materials: items.map(item => ({ name: item.name, brand: "Synthetic", room: "Living", price: "AED 450-800" })), materialConstants: [{ materialType: "stone", costPerM2: 450, carbonIntensity: 25, sustainabilityGrade: "B" }],
    totalFitoutBudget: id === "large_number" ? 9_999_999_999 : 1_250_000, costPerSqm: 6250, sustainabilityGrade: "B", salePremiumPct: 18, estimatedSalesPremiumAed: 4_500_000, locale,
  };
  const scenario: ScenarioComparisonPDFInput = { projectName, projectId: 101, locale, benchmarkVersion: "synthetic-benchmark-v1", logicVersion: "synthetic-logic-v1", modelVersion: "synthetic-model-v1", baselineScenario: { id: 1, name: "Baseline", scores: { sa: 70, ff: 70, mp: 70, ds: 70, er: 70, compositeScore: 70 }, roi: { totalValue: 1000000 } }, comparedScenarios: [{ id: 2, name: hostile || "Alternative", scores: { sa: 75, ff: 69, mp: 74, ds: 74, er: 68, compositeScore: 72 }, roi: { totalValue: 1200000 }, deltas: { sa: 5, ff: -1, mp: 4, ds: 4, er: -2 } }], decisionNote: long || hostile || "Synthetic comparison" };
  const portfolio: PortfolioPDFInput = { portfolioName: `Synthetic Portfolio ${arabic}`, portfolioId: 501, locale, benchmarkVersion: "synthetic-benchmark-v1", logicVersion: "synthetic-logic-v1", modelVersion: "synthetic-model-v1", totalProjects: id === "empty" ? 0 : 2, scoredCount: id === "empty" ? 0 : 2, avgComposite: 75, avgRisk: 28, projects: id === "empty" ? [] : [{ name: projectName, tier: "Luxury", style: "Modern", compositeScore: 75, riskScore: 28, decisionStatus: "conditional" }], distributions: [], failurePatterns: [], improvementLevers: [], complianceHeatmap: [] };
  const docx: DesignBriefData = { projectIdentity: { projectName, typology: "Residential", location: "Dubai" }, designNarrative: { positioningStatement: `${long} ${hostile}`, primaryStyle: "Modern", moodKeywords: [arabic || "Synthetic"] }, materialSpecifications: { approvedMaterials: items.map(item => item.name) }, boqFramework: { totalEstimatedSqm: 12000, coreAllocations: [{ category: "Finishes", percentage: 100, estimatedCostLabel: "AED 1,250,000", notes: hostile || "Synthetic" }] }, detailedBudget: { totalBudgetCap: "AED 1,250,000" }, designerInstructions: { phasedDeliverables: {}, authorityApprovals: [], coordinationRequirements: [], procurementAndLogistics: {} }, version: 1, projectName, locale };
  return { id, locale, expected: { requiredText: ["MIYAR"], exactTotals: { fitoutBudget: investor.totalFitoutBudget, boardCostLow: summary.estimatedCostLow } }, report, board, investor, scenario, portfolio, docx };
}

export const TR10_FIXTURES: Record<Tr10FixtureId, Tr10ReportFixture> = {
  complete: makeFixture("complete", "en", "Complete Synthetic Project"), partial: makeFixture("partial", "en", "Partial Synthetic Project"), empty: makeFixture("empty", "en", "Empty Synthetic Project"), large_number: makeFixture("large_number", "en", "Large Number Synthetic Project"), arabic_bidi: makeFixture("arabic_bidi", "ar", "Arabic Synthetic Project"), long_content: makeFixture("long_content", "en", "Long Content Synthetic Project"), board_heavy: makeFixture("board_heavy", "en", "Board Heavy Synthetic Project"), missing_assets: makeFixture("missing_assets", "en", "Missing Assets Synthetic Project"), hostile: makeFixture("hostile", "en", "Hostile Synthetic Project"),
};

export const TR10_PAIRWISE_MATRIX = [
  ["validation_summary", "complete"], ["design_brief", "board_heavy"], ["full_report", "arabic_bidi"], ["autonomous_design_brief", "long_content"],
  ["board", "missing_assets"], ["investor", "large_number"], ["scenario", "partial"], ["portfolio", "empty"], ["docx", "arabic_bidi"],
  ["validation_summary", "hostile"], ["design_brief", "partial"], ["full_report", "long_content"], ["board", "hostile"], ["investor", "arabic_bidi"], ["scenario", "large_number"], ["portfolio", "board_heavy"], ["docx", "hostile"],
] as const satisfies readonly (readonly [string, Tr10FixtureId])[];
