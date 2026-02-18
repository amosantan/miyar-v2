/**
 * MIYAR ROI Narrative Engine
 * Deterministic ROI computation based on project inputs, scores, and admin-configurable coefficients.
 */

export interface RoiCoefficients {
  hourlyRate: number;
  reworkCostPct: number;
  tenderIterationCost: number;
  designCycleCost: number;
  budgetVarianceMultiplier: number;
  timeAccelerationWeeks: number;
  conservativeMultiplier: number;
  aggressiveMultiplier: number;
}

export interface RoiInputs {
  compositeScore: number;
  riskScore: number;
  confidenceScore: number;
  budgetCap: number;
  gfa: number;
  complexity: number;       // 1-5
  materialLevel: number;    // 1-5
  tier: string;
  horizon: string;
}

export interface RoiDriver {
  name: string;
  description: string;
  hoursSaved: { conservative: number; mid: number; aggressive: number };
  costAvoided: { conservative: number; mid: number; aggressive: number };
  assumptions: string[];
}

export interface RoiOutput {
  totalHoursSaved: { conservative: number; mid: number; aggressive: number };
  totalCostAvoided: { conservative: number; mid: number; aggressive: number };
  budgetAccuracyGain: { fromPct: number; toPct: number };
  decisionConfidenceIndex: number;
  drivers: RoiDriver[];
  assumptions: string[];
  timeToBreifWeeks: { before: number; after: number };
}

const DEFAULT_COEFFICIENTS: RoiCoefficients = {
  hourlyRate: 350,
  reworkCostPct: 0.12,
  tenderIterationCost: 25000,
  designCycleCost: 45000,
  budgetVarianceMultiplier: 0.08,
  timeAccelerationWeeks: 6,
  conservativeMultiplier: 0.60,
  aggressiveMultiplier: 1.40,
};

function tierMultiplier(tier: string): number {
  switch (tier) {
    case "Ultra-luxury": return 2.0;
    case "Luxury": return 1.5;
    case "Upper-mid": return 1.2;
    default: return 1.0;
  }
}

function horizonWeeks(horizon: string): number {
  switch (horizon) {
    case "0-12m": return 26;
    case "12-24m": return 52;
    case "24-36m": return 78;
    case "36m+": return 104;
    default: return 52;
  }
}

export function computeRoi(inputs: RoiInputs, coefficients?: Partial<RoiCoefficients>): RoiOutput {
  const c = { ...DEFAULT_COEFFICIENTS, ...coefficients };
  const tm = tierMultiplier(inputs.tier);
  const scoreNorm = inputs.compositeScore / 100;
  const riskNorm = inputs.riskScore / 100;
  const confNorm = inputs.confidenceScore / 100;
  const complexityNorm = inputs.complexity / 5;

  // Driver 1: Design Cycles Avoided
  const baseDesignCycles = Math.max(1, Math.round(3 + (complexityNorm * 2) - (scoreNorm * 2)));
  const cyclesAvoided = Math.max(1, baseDesignCycles - 1);
  const designHours = cyclesAvoided * 120 * tm;
  const designCost = cyclesAvoided * c.designCycleCost * tm;

  // Driver 2: Tender Iterations Reduced
  const baseTenderIterations = Math.max(1, Math.round(2 + (complexityNorm * 2)));
  const tenderReduced = Math.max(1, Math.round(baseTenderIterations * scoreNorm * 0.6));
  const tenderHours = tenderReduced * 40;
  const tenderCost = tenderReduced * c.tenderIterationCost;

  // Driver 3: Rework Probability Reduction
  const baseReworkPct = c.reworkCostPct * (1 + riskNorm);
  const reducedReworkPct = baseReworkPct * (1 - scoreNorm * 0.5);
  const reworkSaving = inputs.budgetCap * (baseReworkPct - reducedReworkPct);
  const reworkHours = reworkSaving / c.hourlyRate;

  // Driver 4: Budget Variance Risk Reduction
  const baseVariance = c.budgetVarianceMultiplier * (1 + complexityNorm * 0.5);
  const reducedVariance = baseVariance * (1 - confNorm * 0.4);
  const varianceSaving = inputs.budgetCap * (baseVariance - reducedVariance);
  const varianceHours = varianceSaving / c.hourlyRate;

  // Driver 5: Time-to-Brief Acceleration
  const baseWeeks = horizonWeeks(inputs.horizon);
  const accelerationWeeks = Math.round(c.timeAccelerationWeeks * scoreNorm * tm * 0.5);
  const timeHours = accelerationWeeks * 40;
  const timeCost = accelerationWeeks * 40 * c.hourlyRate * 0.3; // opportunity cost

  const drivers: RoiDriver[] = [
    {
      name: "Design Cycles Avoided",
      description: `Reduced from ${baseDesignCycles} to ${baseDesignCycles - cyclesAvoided} design iterations through validated direction`,
      hoursSaved: {
        conservative: Math.round(designHours * c.conservativeMultiplier),
        mid: Math.round(designHours),
        aggressive: Math.round(designHours * c.aggressiveMultiplier),
      },
      costAvoided: {
        conservative: Math.round(designCost * c.conservativeMultiplier),
        mid: Math.round(designCost),
        aggressive: Math.round(designCost * c.aggressiveMultiplier),
      },
      assumptions: [
        `${cyclesAvoided} design cycle(s) eliminated`,
        `${Math.round(120 * tm)} hours per cycle at ${inputs.tier} tier`,
        `AED ${c.designCycleCost.toLocaleString()} per cycle base cost`,
      ],
    },
    {
      name: "Tender Iterations Reduced",
      description: `Reduced from ${baseTenderIterations} to ${baseTenderIterations - tenderReduced} tender rounds`,
      hoursSaved: {
        conservative: Math.round(tenderHours * c.conservativeMultiplier),
        mid: Math.round(tenderHours),
        aggressive: Math.round(tenderHours * c.aggressiveMultiplier),
      },
      costAvoided: {
        conservative: Math.round(tenderCost * c.conservativeMultiplier),
        mid: Math.round(tenderCost),
        aggressive: Math.round(tenderCost * c.aggressiveMultiplier),
      },
      assumptions: [
        `${tenderReduced} tender iteration(s) eliminated`,
        `AED ${c.tenderIterationCost.toLocaleString()} per iteration`,
        `40 hours per tender round`,
      ],
    },
    {
      name: "Rework Probability Reduction",
      description: `Rework risk reduced from ${(baseReworkPct * 100).toFixed(1)}% to ${(reducedReworkPct * 100).toFixed(1)}%`,
      hoursSaved: {
        conservative: Math.round(reworkHours * c.conservativeMultiplier),
        mid: Math.round(reworkHours),
        aggressive: Math.round(reworkHours * c.aggressiveMultiplier),
      },
      costAvoided: {
        conservative: Math.round(reworkSaving * c.conservativeMultiplier),
        mid: Math.round(reworkSaving),
        aggressive: Math.round(reworkSaving * c.aggressiveMultiplier),
      },
      assumptions: [
        `Budget cap: AED ${inputs.budgetCap.toLocaleString()}`,
        `Base rework rate: ${(baseReworkPct * 100).toFixed(1)}%`,
        `MIYAR-validated rate: ${(reducedReworkPct * 100).toFixed(1)}%`,
      ],
    },
    {
      name: "Budget Variance Risk Reduction",
      description: `Budget variance band narrowed from ±${(baseVariance * 100).toFixed(1)}% to ±${(reducedVariance * 100).toFixed(1)}%`,
      hoursSaved: {
        conservative: Math.round(varianceHours * c.conservativeMultiplier),
        mid: Math.round(varianceHours),
        aggressive: Math.round(varianceHours * c.aggressiveMultiplier),
      },
      costAvoided: {
        conservative: Math.round(varianceSaving * c.conservativeMultiplier),
        mid: Math.round(varianceSaving),
        aggressive: Math.round(varianceSaving * c.aggressiveMultiplier),
      },
      assumptions: [
        `Budget cap: AED ${inputs.budgetCap.toLocaleString()}`,
        `Variance reduced by ${((baseVariance - reducedVariance) * 100).toFixed(1)} percentage points`,
      ],
    },
    {
      name: "Time-to-Brief Acceleration",
      description: `Project timeline accelerated by ${accelerationWeeks} weeks`,
      hoursSaved: {
        conservative: Math.round(timeHours * c.conservativeMultiplier),
        mid: Math.round(timeHours),
        aggressive: Math.round(timeHours * c.aggressiveMultiplier),
      },
      costAvoided: {
        conservative: Math.round(timeCost * c.conservativeMultiplier),
        mid: Math.round(timeCost),
        aggressive: Math.round(timeCost * c.aggressiveMultiplier),
      },
      assumptions: [
        `${accelerationWeeks} weeks saved from ${baseWeeks}-week baseline`,
        `Opportunity cost at 30% of hourly rate`,
      ],
    },
  ];

  const totalHoursMid = drivers.reduce((s, d) => s + d.hoursSaved.mid, 0);
  const totalCostMid = drivers.reduce((s, d) => s + d.costAvoided.mid, 0);

  return {
    totalHoursSaved: {
      conservative: drivers.reduce((s, d) => s + d.hoursSaved.conservative, 0),
      mid: totalHoursMid,
      aggressive: drivers.reduce((s, d) => s + d.hoursSaved.aggressive, 0),
    },
    totalCostAvoided: {
      conservative: drivers.reduce((s, d) => s + d.costAvoided.conservative, 0),
      mid: totalCostMid,
      aggressive: drivers.reduce((s, d) => s + d.costAvoided.aggressive, 0),
    },
    budgetAccuracyGain: {
      fromPct: Math.round(baseVariance * 100 * 10) / 10,
      toPct: Math.round(reducedVariance * 100 * 10) / 10,
    },
    decisionConfidenceIndex: Math.round(confNorm * scoreNorm * 100),
    drivers,
    assumptions: [
      `Hourly rate: AED ${c.hourlyRate}`,
      `Market tier: ${inputs.tier} (multiplier: ${tm}x)`,
      `Project horizon: ${inputs.horizon}`,
      `Composite score: ${inputs.compositeScore}/100`,
      `Risk score: ${inputs.riskScore}/100`,
      `Conservative scenario: ${(c.conservativeMultiplier * 100).toFixed(0)}% of mid estimate`,
      `Aggressive scenario: ${(c.aggressiveMultiplier * 100).toFixed(0)}% of mid estimate`,
    ],
    timeToBreifWeeks: {
      before: baseWeeks,
      after: Math.max(1, baseWeeks - accelerationWeeks),
    },
  };
}
