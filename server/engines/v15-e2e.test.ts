/**
 * V1.5-08: Full Evaluation Pipeline E2E Test
 * Uses exact UAE project inputs specified in the V1.5 execution authorization.
 *
 * Project: Residential Apartment, Medium, 1800 sqm, Dubai, 18 months
 * Brand clarity: 4, Differentiation: 3, Buyer maturity: 4
 * Market tier: Premium (Upper-mid), Competitor intensity: 3, Trend sensitivity: 3
 * Budget cap: 650 AED/sqm, Flexibility: 3, Shock tolerance: 3, Sales premium: 4
 * Style: Contemporary, Material level: 4, Complexity: 3, Experience: 4, Sustainability: 3
 * Supply chain readiness: 4, Contractor: 3, Approvals: 4, QA: 3
 */
import { describe, it, expect } from "vitest";
import { normalizeInputs } from "./normalization";
import { evaluate, computeROI, type EvaluationConfig } from "./scoring";
import { runSensitivityAnalysis } from "./sensitivity";
import { generateExplainabilityReport } from "./explainability";
import type { ProjectInputs } from "../../shared/miyar-types";

// ─── Test Inputs (exact values from V1.5 execution authorization) ────────────

const UAE_PROJECT_INPUTS: ProjectInputs = {
  ctx01Typology: "Residential",
  ctx02Scale: "Medium",
  ctx03Gfa: 1800,
  ctx04Location: "Prime", // Dubai = Prime
  ctx05Horizon: "12-24m" as any, // 18 months
  str01BrandClarity: 4,
  str02Differentiation: 3,
  str03BuyerMaturity: 4,
  mkt01Tier: "Upper-mid", // "Premium" maps to Upper-mid in MIYAR taxonomy
  mkt02Competitor: 3,
  mkt03Trend: 3,
  fin01BudgetCap: 650,
  fin02Flexibility: 3,
  fin03ShockTolerance: 3,
  fin04SalesPremium: 4,
  des01Style: "Contemporary",
  des02MaterialLevel: 4,
  des03Complexity: 3,
  des04Experience: 4,
  des05Sustainability: 3,
  exe01SupplyChain: 4,
  exe02Contractor: 3,
  exe03Approvals: 4,
  exe04QaMaturity: 3,
  add01SampleKit: false,
  add02PortfolioMode: false,
  add03DashboardExport: false,
};

// ─── Evaluation Config (matches published logic version weights) ─────────────

const EVAL_CONFIG: EvaluationConfig = {
  dimensionWeights: {
    sa: 0.25,
    ff: 0.20,
    mp: 0.20,
    ds: 0.20,
    er: 0.15,
  },
  variableWeights: {
    sa: { str01: 0.35, str03: 0.25, compatVisionMarket: 0.25, compatVisionDesign: 0.15 },
    ff: { budgetFit: 0.45, fin02: 0.20, executionResilience: 0.20, costStability: 0.15 },
    mp: { marketFit: 0.35, differentiationPressure: 0.25, mkt03: 0.20, buyerAlignmentIndex: 0.20 },
    ds: { des02: 0.30, des04: 0.25, des05: 0.20, str02: 0.15, des03: 0.10 },
    er: { exe01: 0.30, exe02: 0.25, exe03: 0.20, exe04: 0.15, costVolatility: 0.10 },
  },
  penaltyConfig: {},
  expectedCost: 650,
  benchmarkCount: 5,
  overrideRate: 0,
};

// ─── E2E Tests ──────────────────────────────────────────────────────────────

describe("V1.5-08: Full Evaluation Pipeline E2E Test", () => {
  // Step 1: Normalization
  describe("Step 1: Normalization", () => {
    const n = normalizeInputs(UAE_PROJECT_INPUTS, 650);

    it("normalizes all 25 variables without errors", () => {
      expect(n).toBeDefined();
      expect(typeof n.str01_n).toBe("number");
      expect(typeof n.str02_n).toBe("number");
      expect(typeof n.str03_n).toBe("number");
      expect(typeof n.budgetFit).toBe("number");
      expect(typeof n.costVolatility).toBe("number");
      expect(typeof n.marketFit).toBe("number");
      expect(typeof n.executionResilience).toBe("number");
    });

    it("costVolatility is in [0, 1] and logically consistent (high readiness → lower volatility)", () => {
      expect(n.costVolatility).toBeGreaterThanOrEqual(0);
      expect(n.costVolatility).toBeLessThanOrEqual(1);
      // exe01=4 (high readiness), fin03=3 (moderate tolerance)
      // costVolatility = (1 - 0.75) * 0.5 + (1 - 0.5) * 0.5 = 0.125 + 0.25 = 0.375
      expect(n.costVolatility).toBeLessThan(0.5); // High readiness should keep volatility below 0.5
    });

    it("all normalized values are in [0, 1] range", () => {
      for (const [key, val] of Object.entries(n)) {
        if (typeof val === "number") {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  // Step 2: Full Evaluation
  describe("Step 2: Full Evaluation (scoring)", () => {
    const result = evaluate(UAE_PROJECT_INPUTS, EVAL_CONFIG);

    it("returns a composite score as a number", () => {
      expect(typeof result.compositeScore).toBe("number");
      expect(result.compositeScore).toBeGreaterThan(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
    });

    it("returns all 5 dimension scores with non-zero values", () => {
      expect(result.dimensions.sa).toBeGreaterThan(0);
      expect(result.dimensions.ff).toBeGreaterThan(0);
      expect(result.dimensions.mp).toBeGreaterThan(0);
      expect(result.dimensions.ds).toBeGreaterThan(0);
      expect(result.dimensions.er).toBeGreaterThan(0);
      // All should be <= 100
      expect(result.dimensions.sa).toBeLessThanOrEqual(100);
      expect(result.dimensions.ff).toBeLessThanOrEqual(100);
      expect(result.dimensions.mp).toBeLessThanOrEqual(100);
      expect(result.dimensions.ds).toBeLessThanOrEqual(100);
      expect(result.dimensions.er).toBeLessThanOrEqual(100);
    });

    it("returns a valid decision status (validated, conditional, or not_validated)", () => {
      expect(["validated", "conditional", "not_validated"]).toContain(result.decisionStatus);
    });

    it("returns risk score in valid range", () => {
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it("returns RAS score in valid range", () => {
      expect(result.rasScore).toBeGreaterThanOrEqual(0);
      expect(result.rasScore).toBeLessThanOrEqual(100);
    });

    it("returns confidence score in valid range", () => {
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    });

    it("returns inputSnapshot with all 25 raw variables", () => {
      const snap = result.inputSnapshot;
      expect(snap.str01BrandClarity).toBe(4);
      expect(snap.str02Differentiation).toBe(3);
      expect(snap.str03BuyerMaturity).toBe(4);
      expect(snap.mkt01Tier).toBe("Upper-mid");
      expect(snap.fin01BudgetCap).toBe(650);
      expect(snap.des01Style).toBe("Contemporary");
      expect(snap.exe01SupplyChain).toBe(4);
    });

    it("returns variableContributions as nested Record<string, Record<string, number>>", () => {
      expect(result.variableContributions).toBeDefined();
      expect(typeof result.variableContributions.sa).toBe("object");
      expect(typeof result.variableContributions.ff).toBe("object");
      expect(typeof result.variableContributions.mp).toBe("object");
      expect(typeof result.variableContributions.ds).toBe("object");
      expect(typeof result.variableContributions.er).toBe("object");
    });

    it("logs actual output values for the Phase Reality Report", () => {
      console.log("\n=== V1.5-08 E2E Test Output Values ===");
      console.log(`Composite Score: ${result.compositeScore}`);
      console.log(`SA: ${result.dimensions.sa}`);
      console.log(`FF: ${result.dimensions.ff}`);
      console.log(`MP: ${result.dimensions.mp}`);
      console.log(`DS: ${result.dimensions.ds}`);
      console.log(`ER: ${result.dimensions.er}`);
      console.log(`Risk Score: ${result.riskScore}`);
      console.log(`RAS Score: ${result.rasScore}`);
      console.log(`Confidence: ${result.confidenceScore}`);
      console.log(`Decision: ${result.decisionStatus}`);
      const n = normalizeInputs(UAE_PROJECT_INPUTS, 650);
      console.log(`costVolatility: ${n.costVolatility}`);
      console.log("=== End E2E Output ===\n");
    });
  });

  // Step 3: ROI Estimate
  describe("Step 3: ROI Estimate", () => {
    const result = evaluate(UAE_PROJECT_INPUTS, EVAL_CONFIG);
    const roi = computeROI(UAE_PROJECT_INPUTS, result.compositeScore, 15000);

    it("generates ROI with positive total value", () => {
      expect(roi.totalValue).toBeGreaterThan(0);
    });

    it("generates positive ROI multiple", () => {
      expect(roi.roiMultiple).toBeGreaterThan(0);
    });

    it("all ROI components are non-negative", () => {
      expect(roi.reworkAvoided).toBeGreaterThanOrEqual(0);
      expect(roi.procurementSavings).toBeGreaterThanOrEqual(0);
      expect(roi.timeValueGain).toBeGreaterThanOrEqual(0);
      expect(roi.specEfficiency).toBeGreaterThanOrEqual(0);
      expect(roi.positioningPremium).toBeGreaterThanOrEqual(0);
    });

    it("logs ROI values for the Phase Reality Report", () => {
      console.log("\n=== V1.5-08 ROI Output ===");
      console.log(`Total Value: ${roi.totalValue} AED`);
      console.log(`ROI Multiple: ${roi.roiMultiple}x`);
      console.log(`Net ROI: ${roi.netROI}`);
      console.log("=== End ROI Output ===\n");
    });
  });

  // Step 4: Sensitivity Analysis
  describe("Step 4: Sensitivity Analysis", () => {
    it("runs sensitivity analysis without errors", () => {
      const entries = runSensitivityAnalysis(UAE_PROJECT_INPUTS, EVAL_CONFIG);
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it("each entry has variable, sensitivity, scoreUp, scoreDown", () => {
      const entries = runSensitivityAnalysis(UAE_PROJECT_INPUTS, EVAL_CONFIG);
      for (const entry of entries) {
        expect(entry).toHaveProperty("variable");
        expect(entry).toHaveProperty("sensitivity");
        expect(entry).toHaveProperty("scoreUp");
        expect(entry).toHaveProperty("scoreDown");
        expect(typeof entry.sensitivity).toBe("number");
        expect(typeof entry.scoreUp).toBe("number");
        expect(typeof entry.scoreDown).toBe("number");
      }
    });
  });

  // Step 5: Explainability
  describe("Step 5: Explainability Report", () => {
    const result = evaluate(UAE_PROJECT_INPUTS, EVAL_CONFIG);

    it("generates explainability report with zero undefined values", () => {
      const report = generateExplainabilityReport(
        1, // projectId
        result.inputSnapshot as unknown as Record<string, unknown>,
        {
          saScore: result.dimensions.sa,
          ffScore: result.dimensions.ff,
          mpScore: result.dimensions.mp,
          dsScore: result.dimensions.ds,
          erScore: result.dimensions.er,
          compositeScore: result.compositeScore,
          riskScore: result.riskScore,
          confidenceScore: result.confidenceScore,
          decisionStatus: result.decisionStatus,
          dimensionWeights: result.dimensionWeights as Record<string, number>,
          variableContributions: result.variableContributions,
          penalties: result.penalties,
          riskFlags: result.riskFlags,
        },
        "v1.0-baseline",
        "MIYAR Logic v1.0 — Baseline"
      );

      expect(report).toBeDefined();
      expect(report.dimensions).toBeDefined();
      expect(Object.keys(report.dimensions).length).toBe(5);

      // Check every dimension has drivers with non-undefined values
      for (const [dimKey, dimExplain] of Object.entries(report.dimensions)) {
        expect(dimExplain.score).toBeGreaterThan(0);
        expect(dimExplain.drivers.length).toBeGreaterThan(0);

        for (const driver of dimExplain.drivers) {
          expect(driver.rawValue).not.toBeUndefined();
          expect(driver.rawValue).not.toBe("undefined");
          // normalizedValue is number | null (null for non-ordinal like mkt01Tier, des01Style)
          if (driver.normalizedValue !== null) {
            expect(typeof driver.normalizedValue).toBe("number");
          }
          expect(driver.contribution).not.toBeUndefined();
          expect(typeof driver.contribution).toBe("number");
          expect(driver.direction).toBeDefined();
          expect(["positive", "negative", "neutral"]).toContain(driver.direction);
        }
      }
    });

    it("explainability summary contains decision and composite score", () => {
      const report = generateExplainabilityReport(
        1,
        result.inputSnapshot as unknown as Record<string, unknown>,
        {
          saScore: result.dimensions.sa,
          ffScore: result.dimensions.ff,
          mpScore: result.dimensions.mp,
          dsScore: result.dimensions.ds,
          erScore: result.dimensions.er,
          compositeScore: result.compositeScore,
          riskScore: result.riskScore,
          confidenceScore: result.confidenceScore,
          decisionStatus: result.decisionStatus,
          dimensionWeights: result.dimensionWeights as Record<string, number>,
          variableContributions: result.variableContributions,
          penalties: result.penalties,
          riskFlags: result.riskFlags,
        },
        "v1.0-baseline",
        "MIYAR Logic v1.0 — Baseline"
      );

      // ExplainabilityReport has compositeScore and decisionStatus at top level, not under summary
      expect(report.compositeScore).toBe(result.compositeScore);
      expect(report.decisionStatus).toBe(result.decisionStatus);
    });
  });
});
