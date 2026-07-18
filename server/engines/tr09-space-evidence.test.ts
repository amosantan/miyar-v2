import { describe, expect, it } from "vitest";
import type { ProjectInputs } from "../../shared/miyar-types";
import { benchmarkSpaceRatios } from "./design/space-benchmarking";
import type { FloorPlanAnalysis } from "./design/floor-plan-analyzer";
import { generateExplainabilityReport } from "./explainability";
import { computeFiveLens } from "./five-lens";
import { computeRoi, type RoiInputs } from "./roi";
import { computeConfidence, evaluate, type EvaluationConfig } from "./scoring";
import { runSensitivityAnalysis } from "./sensitivity";

const INPUTS: ProjectInputs = {
  ctx01Typology: "Residential",
  ctx02Scale: "Medium",
  ctx03Gfa: 1_000,
  totalFitoutArea: 800,
  ctx04Location: "Prime",
  ctx05Horizon: "12-24m",
  city: "Dubai",
  sustainCertTarget: "silver",
  str01BrandClarity: 3,
  str02Differentiation: 3,
  str03BuyerMaturity: 3,
  mkt01Tier: "Upper-mid",
  mkt02Competitor: 3,
  mkt03Trend: 3,
  fin01BudgetCap: 500,
  fin02Flexibility: 3,
  fin03ShockTolerance: 3,
  fin04SalesPremium: 3,
  des01Style: "Modern",
  des02MaterialLevel: 3,
  des03Complexity: 3,
  des04Experience: 3,
  des05Sustainability: 3,
  exe01SupplyChain: 3,
  exe02Contractor: 3,
  exe03Approvals: 3,
  exe04QaMaturity: 3,
  add01SampleKit: false,
  add02PortfolioMode: false,
  add03DashboardExport: false,
  spaceEfficiencyScore: 50,
  spaceCriticalCount: 0,
};

const CONFIG: EvaluationConfig = {
  dimensionWeights: { sa: 0.25, ff: 0.2, mp: 0.2, ds: 0.15, er: 0.2 },
  variableWeights: {},
  penaltyConfig: {},
  expectedCost: 500,
  benchmarkCount: 3,
  overrideRate: 0,
};

const EMPTY_PLAN: FloorPlanAnalysis = {
  totalEstimatedSqm: 100,
  bedroomCount: 0,
  bathroomCount: 0,
  balconyPercentage: 0,
  circulationPercentage: 0,
  unitType: "Studio",
  analysisConfidence: "low",
  rawNotes: "No rooms detected",
  rooms: [],
};

const MEASURED_PLAN: FloorPlanAnalysis = {
  ...EMPTY_PLAN,
  bedroomCount: 1,
  unitType: "1BR",
  analysisConfidence: "high",
  rooms: [
    { name: "Living", type: "living", estimatedSqm: 40, percentOfTotal: 40, finishGrade: "A" },
  ],
};

const ROI_INPUTS: RoiInputs = {
  compositeScore: 75,
  riskScore: 35,
  confidenceScore: 80,
  budgetCap: 500,
  gfa: 1_000,
  complexity: 3,
  materialLevel: 3,
  tier: "Upper-mid",
  horizon: "12-24m",
  spaceEfficiencyScore: 50,
};

describe("TR-09 space evidence", () => {
  it("keeps the approved neutral 50 while recording that no benchmark was applied", () => {
    const result = benchmarkSpaceRatios(EMPTY_PLAN, "Dubai Marina", 412, 25_000);

    expect(result.overallEfficiencyScore).toBe(50);
    expect(result.evidence).toEqual({
      status: "neutral_fallback",
      reason: "no_rooms_detected",
      roomCount: 0,
      benchmarkBasis: "not_applied",
      transactionCount: 0,
    });
  });

  it("labels measured evidence DLD-backed only when transactions exist", () => {
    expect(benchmarkSpaceRatios(MEASURED_PLAN, "Dubai Marina", 412, 25_000).evidence).toEqual({
      status: "measured",
      roomCount: 1,
      benchmarkBasis: "dld_area",
      transactionCount: 412,
    });
    expect(benchmarkSpaceRatios(MEASURED_PLAN, "Dubai Marina", 0, null).evidence).toEqual({
      status: "measured",
      roomCount: 1,
      benchmarkBasis: "miyar_uae",
      transactionCount: 0,
    });
  });

  it("stores provenance beside the score without changing any numerical result", () => {
    const withoutEvidence = evaluate(INPUTS, CONFIG);
    const withEvidence = evaluate({
      ...INPUTS,
      spaceEfficiencyEvidence: {
        status: "neutral_fallback",
        reason: "no_rooms_detected",
        roomCount: 0,
        benchmarkBasis: "not_applied",
        transactionCount: 0,
      },
    }, CONFIG);

    expect(withEvidence.inputSnapshot.spaceEfficiencyEvidence?.status).toBe("neutral_fallback");
    expect(withEvidence.dimensions).toEqual(withoutEvidence.dimensions);
    expect(withEvidence.compositeScore).toBe(withoutEvidence.compositeScore);
    expect(withEvidence.riskScore).toBe(withoutEvidence.riskScore);
    expect(withEvidence.rasScore).toBe(withoutEvidence.rasScore);
    expect(withEvidence.confidenceScore).toBe(withoutEvidence.confidenceScore);
    expect(computeConfidence(withEvidence.inputSnapshot, 3, 0)).toBe(
      computeConfidence(withoutEvidence.inputSnapshot, 3, 0),
    );
  });

  it("skips space perturbation unless the snapshot says rooms were measured", () => {
    const absent = runSensitivityAnalysis(INPUTS, CONFIG);
    const fallback = runSensitivityAnalysis({
      ...INPUTS,
      spaceEfficiencyEvidence: {
        status: "neutral_fallback",
        reason: "no_rooms_detected",
        roomCount: 0,
        benchmarkBasis: "not_applied",
        transactionCount: 0,
      },
    }, CONFIG);
    const measured = runSensitivityAnalysis({
      ...INPUTS,
      spaceEfficiencyEvidence: {
        status: "measured",
        roomCount: 5,
        benchmarkBasis: "miyar_uae",
        transactionCount: 0,
      },
    }, CONFIG);

    expect(absent.some((entry) => entry.variable === "spaceEfficiencyScore")).toBe(false);
    expect(fallback.some((entry) => entry.variable === "spaceEfficiencyScore")).toBe(false);
    expect(measured.some((entry) => entry.variable === "spaceEfficiencyScore")).toBe(true);
  });

  it("creates a space-saving ROI driver only for measured snapshot evidence", () => {
    const legacy = computeRoi(ROI_INPUTS);
    const fallback = computeRoi({
      ...ROI_INPUTS,
      spaceEfficiencyEvidence: {
        status: "neutral_fallback",
        reason: "no_rooms_detected",
        roomCount: 0,
        benchmarkBasis: "not_applied",
        transactionCount: 0,
      },
    });
    const measured = computeRoi({
      ...ROI_INPUTS,
      spaceEfficiencyEvidence: {
        status: "measured",
        roomCount: 5,
        benchmarkBasis: "miyar_uae",
        transactionCount: 0,
      },
    });

    expect(legacy.drivers).toHaveLength(5);
    expect(fallback.drivers).toHaveLength(5);
    expect(measured.drivers.map((driver) => driver.name)).toContain("Space Efficiency Optimization");
  });

  it("uses the matching score snapshot for five-lens wording", () => {
    const matrix = {
      saScore: "70",
      ffScore: "70",
      mpScore: "70",
      dsScore: "70",
      erScore: "70",
      compositeScore: "70",
      variableContributions: { ds: { spaceEfficiency: 0.075 } },
      penalties: [],
      inputSnapshot: {
        ...INPUTS,
        spaceEfficiencyEvidence: {
          status: "neutral_fallback",
          reason: "no_rooms_detected",
          roomCount: 0,
          benchmarkBasis: "not_applied",
          transactionCount: 0,
        },
      },
    };
    const result = computeFiveLens(
      { ...INPUTS, spaceEfficiencyScore: 99 } as any,
      matrix as any,
      [],
    );
    const evidence = result.lenses[4].evidence.find((item) => item.variable === "spaceEfficiency");

    expect(evidence?.value).toBe("Neutral fallback — no rooms measured");
    expect(evidence?.benchmarkRef).toBe("No benchmark applied");
  });

  it("labels explainability fallback and excludes its metadata from completeness", () => {
    const scoreData = {
      saScore: 70,
      ffScore: 70,
      mpScore: 70,
      dsScore: 70,
      erScore: 70,
      compositeScore: 70,
      riskScore: 30,
      confidenceScore: 80,
      decisionStatus: "conditional",
      dimensionWeights: CONFIG.dimensionWeights,
      variableContributions: { ds: { spaceEfficiency: 0.075 } },
      penalties: [],
      riskFlags: [],
    };
    const base = generateExplainabilityReport(1, INPUTS, scoreData, "v1", "v1");
    const fallback = generateExplainabilityReport(1, {
      ...INPUTS,
      spaceEfficiencyEvidence: {
        status: "neutral_fallback",
        reason: "no_rooms_detected",
        roomCount: 0,
        benchmarkBasis: "not_applied",
        transactionCount: 0,
      },
    }, scoreData, "v1", "v1");
    const driver = fallback.dimensions[3].drivers.find(
      (item) => item.variable === "spaceEfficiencyScore",
    );

    expect(driver?.rawValue).toBe("Neutral fallback — no rooms measured");
    expect(fallback.confidenceExplanation).toBe(base.confidenceExplanation);
  });
});
