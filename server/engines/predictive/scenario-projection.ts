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
  salesStrategy?: string | null;
  targetYield?: string | null;
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

  // Adjust scenario spread based on strategy and target yield
  let highMultiplier = 1.15;
  let lowMultiplier = 0.9;

  if (input.targetYield === 'aggressive_yield') {
    // Higher risk = wider variance
    highMultiplier = 1.25;
    lowMultiplier = 0.85;
  } else if (input.targetYield === 'stable_long_term' || input.targetYield === 'capital_preservation') {
    // Conservative = tighter variance, more predictable
    highMultiplier = 1.10;
    lowMultiplier = 0.95;
  }

  if (input.salesStrategy === 'build_to_rent') {
    // BTR typically has more standard specs, tighter variance
    highMultiplier = Math.max(1.05, highMultiplier - 0.05);
  } else if (input.salesStrategy === 'build_to_sell') {
    // BTS has higher market spec volatility
    highMultiplier += 0.05;
  }

  // Three scenarios: low, mid, high
  const midProjections = computeProjections(safeCost);
  const lowProjections = computeProjections(safeCost * lowMultiplier);
  const highProjections = computeProjections(safeCost * highMultiplier);

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
