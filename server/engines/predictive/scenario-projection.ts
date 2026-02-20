/**
 * Scenario Cost Projection Engine (V4-10)
 *
 * Projects future cost using compounding formula:
 *   projectedCost = baseCost × (1 + monthlyRate)^months × marketFactor
 *
 * Produces projections at months 3, 6, 12, and horizon (user-defined).
 */

export interface ProjectionInput {
  baseCostPerSqm: number; // current P50 or budget per sqm
  gfa: number; // gross floor area in sqm
  trendPercentChange: number; // annualized trend % (e.g., +5.2)
  trendDirection: "rising" | "falling" | "stable" | "insufficient_data";
  marketCondition: "tight" | "balanced" | "soft"; // affects market factor
  horizonMonths: number; // e.g., 18
  currency?: string;
}

export interface ProjectionPoint {
  month: number;
  costPerSqm: number;
  totalCost: number;
  cumulativeChange: number; // % change from base
}

export interface ScenarioProjection {
  baseCostPerSqm: number;
  baseTotalCost: number;
  projections: ProjectionPoint[];
  lowScenario: ProjectionPoint[]; // P15 scenario
  midScenario: ProjectionPoint[]; // P50 scenario
  highScenario: ProjectionPoint[]; // P85 scenario
  currency: string;
  horizonMonths: number;
  monthlyRate: number;
  marketFactor: number;
  annualizedTrend: number;
}

/**
 * Market condition factor:
 * - tight: 1.05 (5% premium — supply constrained)
 * - balanced: 1.00
 * - soft: 0.95 (5% discount — buyer's market)
 */
function marketFactor(condition: string): number {
  switch (condition) {
    case "tight": return 1.05;
    case "soft": return 0.95;
    default: return 1.00;
  }
}

/**
 * Convert annualized trend % to monthly compounding rate.
 * monthlyRate = (1 + annualRate)^(1/12) - 1
 */
function annualToMonthlyRate(annualPct: number): number {
  const annualRate = annualPct / 100;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function projectScenarioCost(input: ProjectionInput): ScenarioProjection {
  const {
    baseCostPerSqm,
    gfa,
    trendPercentChange,
    trendDirection,
    marketCondition,
    horizonMonths,
    currency = "AED",
  } = input;

  // Guard against invalid inputs
  const safeCost = baseCostPerSqm || 0;
  const safeGfa = gfa || 0;
  const safeTrend = trendDirection === "insufficient_data" ? 0 : trendPercentChange;
  const safeHorizon = Math.max(1, Math.min(horizonMonths || 18, 120)); // cap at 10 years

  const mFactor = marketFactor(marketCondition);
  const monthlyRate = annualToMonthlyRate(safeTrend);

  // Standard projection milestones
  const milestones = [3, 6, 12, safeHorizon].filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => a - b);

  function computeProjections(baseCost: number): ProjectionPoint[] {
    return milestones.map(month => {
      const compounded = baseCost * Math.pow(1 + monthlyRate, month) * mFactor;
      const totalCost = compounded * safeGfa;
      const cumulativeChange = baseCost > 0
        ? ((compounded - baseCost) / baseCost) * 100
        : 0;
      return {
        month,
        costPerSqm: Math.round(compounded * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        cumulativeChange: Math.round(cumulativeChange * 100) / 100,
      };
    });
  }

  // Three scenarios: low (0.85x trend), mid (1.0x), high (1.15x)
  const midProjections = computeProjections(safeCost);

  // Low scenario: base cost * 0.9 (P15-like)
  const lowProjections = computeProjections(safeCost * 0.9);

  // High scenario: base cost * 1.15 (P85-like)
  const highProjections = computeProjections(safeCost * 1.15);

  return {
    baseCostPerSqm: safeCost,
    baseTotalCost: Math.round(safeCost * safeGfa * 100) / 100,
    projections: midProjections,
    lowScenario: lowProjections,
    midScenario: midProjections,
    highScenario: highProjections,
    currency,
    horizonMonths: safeHorizon,
    monthlyRate: Math.round(monthlyRate * 1000000) / 1000000,
    marketFactor: mFactor,
    annualizedTrend: safeTrend,
  };
}
