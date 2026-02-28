/**
 * MIYAR Normalization Engine
 * Transforms raw project inputs into normalized [0,1] computational variables.
 * All normalization is deterministic: identical inputs → identical outputs.
 */
import type {
  ProjectInputs,
  NormalizedInputs,
  ProjectScale,
  MarketTier,
  DesignStyle,
} from "../../shared/miyar-types";
import { getCertMultiplier } from "./sustainability/sustainability-multipliers";
import { getPricingArea, computeFitoutRatio } from "./area-utils";

/** Normalize ordinal (1-5) to [0,1] */
export function normalizeOrdinal(value: number): number {
  return Math.max(0, Math.min(1, (value - 1) / 4));
}

/** Normalize bounded numeric to [0,1] */
export function normalizeBounded(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** Derive scale band from pricing area (V4: prefers totalFitoutArea over GFA) */
export function deriveScaleBand(gfa: number | null, totalFitoutArea?: number | null): ProjectScale {
  // V4: use fitout area if available, otherwise fall back to GFA
  const area = totalFitoutArea ?? gfa;
  if (!area || area < 500) return "Small";
  if (area <= 5000) return "Medium";
  return "Large";
}

/** Derive budget class from FIN_01 */
export function deriveBudgetClass(budgetCap: number | null): "Low" | "Mid" | "High" | "Premium" {
  if (!budgetCap || budgetCap < 200) return "Low";
  if (budgetCap <= 450) return "Mid";
  if (budgetCap <= 800) return "High";
  return "Premium";
}

/** Compute budget fit against benchmark expected cost */
export function computeBudgetFit(budgetCap: number | null, expectedCost: number): number {
  if (!budgetCap || expectedCost <= 0) return 0.5;
  return Math.max(0, Math.min(1, 1 - Math.abs(budgetCap - expectedCost) / expectedCost));
}

/** Vision-Market compatibility */
export function computeCompatVisionMarket(
  str01: number,
  mkt01Tier: MarketTier
): number {
  const tierMap: Record<MarketTier, number> = {
    Mid: 2,
    "Upper-mid": 3,
    Luxury: 4,
    "Ultra-luxury": 5,
  };
  const expectedTier = tierMap[mkt01Tier] || 3;
  const diff = Math.abs(str01 - expectedTier);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.6;
  return 0.2;
}

/** Vision-Design compatibility */
export function computeCompatVisionDesign(
  str02: number,
  des01Style: DesignStyle
): number {
  // Higher differentiation ambition aligns with more distinctive styles
  const styleAmbition: Record<DesignStyle, number> = {
    Modern: 3,
    Contemporary: 3,
    Minimal: 2,
    Classic: 2,
    Fusion: 5,
    Other: 1,
  };
  const styleLevel = styleAmbition[des01Style] || 3;
  const diff = Math.abs(str02 - styleLevel);
  if (diff <= 1) return 1.0;
  if (diff <= 2) return 0.5;
  return 0.1;
}

/** Market fit based on location, tier, and material level benchmarks */
export function computeMarketFit(
  ctx04Location: string,
  mkt01Tier: MarketTier,
  des02MaterialLevel: number
): number {
  const tierExpectedMaterial: Record<MarketTier, number> = {
    Mid: 2,
    "Upper-mid": 3,
    Luxury: 4,
    "Ultra-luxury": 5,
  };
  const expected = tierExpectedMaterial[mkt01Tier] || 3;
  const diff = Math.abs(des02MaterialLevel - expected);
  const locationBonus =
    ctx04Location === "Prime" ? 0.1 : ctx04Location === "Secondary" ? 0.0 : -0.05;
  return Math.max(0, Math.min(1, 1 - diff * 0.2 + locationBonus));
}

/** Trend fit based on style and trend sensitivity */
export function computeTrendFit(des01Style: DesignStyle, mkt03Trend: number): number {
  const trendAlignment: Record<DesignStyle, number> = {
    Modern: 0.8,
    Contemporary: 0.9,
    Minimal: 0.7,
    Classic: 0.4,
    Fusion: 0.85,
    Other: 0.3,
  };
  const baseAlignment = trendAlignment[des01Style] || 0.5;
  const trendSensitivity = normalizeOrdinal(mkt03Trend);
  return Math.max(0, Math.min(1, baseAlignment * (0.5 + 0.5 * trendSensitivity)));
}

/** Full normalization pipeline */
export function normalizeInputs(
  inputs: ProjectInputs,
  expectedCost: number
): NormalizedInputs {
  const str01_n = normalizeOrdinal(inputs.str01BrandClarity);
  const str02_n = normalizeOrdinal(inputs.str02Differentiation);
  const str03_n = normalizeOrdinal(inputs.str03BuyerMaturity);
  const mkt02_n = normalizeOrdinal(inputs.mkt02Competitor);
  const mkt03_n = normalizeOrdinal(inputs.mkt03Trend);
  const fin02_n = normalizeOrdinal(inputs.fin02Flexibility);
  const fin03_n = normalizeOrdinal(inputs.fin03ShockTolerance);
  const fin04_n = normalizeOrdinal(inputs.fin04SalesPremium);
  const des02_n = normalizeOrdinal(inputs.des02MaterialLevel);
  const des03_n = normalizeOrdinal(inputs.des03Complexity);
  const des04_n = normalizeOrdinal(inputs.des04Experience);
  const des05_n = normalizeOrdinal(inputs.des05Sustainability);
  const exe01_n = normalizeOrdinal(inputs.exe01SupplyChain);
  const exe02_n = normalizeOrdinal(inputs.exe02Contractor);
  const exe03_n = normalizeOrdinal(inputs.exe03Approvals);
  const exe04_n = normalizeOrdinal(inputs.exe04QaMaturity);

  const executionResilience = (exe02_n + exe04_n) / 2;
  const differentiationPressure = (mkt02_n + str02_n) / 2;
  const budgetFit = computeBudgetFit(inputs.fin01BudgetCap, expectedCost);
  const costVolatility = ((1 - exe01_n) * 0.5 + (1 - fin03_n) * 0.5);
  const sustainCertMultiplier = getCertMultiplier(inputs.sustainCertTarget || "silver");

  // Adjust expected cost by sustainability certification premium
  const adjustedExpectedCost = expectedCost * sustainCertMultiplier;

  return {
    str01_n,
    str02_n,
    str03_n,
    mkt02_n,
    mkt03_n,
    fin02_n,
    fin03_n,
    fin04_n,
    des02_n,
    des03_n,
    des04_n,
    des05_n,
    exe01_n,
    exe02_n,
    exe03_n,
    exe04_n,
    scaleBand: deriveScaleBand(inputs.ctx03Gfa, inputs.totalFitoutArea),
    budgetClass: deriveBudgetClass(inputs.fin01BudgetCap),
    differentiationPressure,
    executionResilience,
    budgetFit: computeBudgetFit(inputs.fin01BudgetCap, adjustedExpectedCost),
    marketFit: computeMarketFit(inputs.ctx04Location, inputs.mkt01Tier, inputs.des02MaterialLevel),
    trendFit: computeTrendFit(inputs.des01Style, inputs.mkt03Trend),
    compatVisionMarket: computeCompatVisionMarket(inputs.str01BrandClarity, inputs.mkt01Tier),
    compatVisionDesign: computeCompatVisionDesign(inputs.str02Differentiation, inputs.des01Style),
    costVolatility,
    sustainCertMultiplier,
    fitoutRatio: computeFitoutRatio(inputs.totalFitoutArea, inputs.ctx03Gfa),
    procurementRiskMultiplier: inputs.procurementStrategy === 'Turnkey' ? 1.05 : inputs.procurementStrategy === 'Construction Management' ? 0.95 : 1.0,
    materialSourcingRiskMultiplier: inputs.materialSourcing === 'Local' ? 1.05 : (inputs.materialSourcing === 'Global Mix' || inputs.materialSourcing === 'Asian') ? 0.95 : inputs.materialSourcing === 'European' ? 0.98 : 1.0,
  };
}
