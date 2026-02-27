/**
 * V11: Cognitive Bias Detector Engine
 * Pure deterministic functions that detect 7 cognitive biases from project inputs.
 * No LLM required — all rules are mathematically defined.
 */

import type { ProjectInputs, ScoreResult } from "../../../shared/miyar-types";
import type {
    BiasAlert,
    BiasType,
    BiasSeverity,
    EvidencePoint,
    DetectorContext,
} from "./bias-types";
import { TIER_BUDGET_BENCHMARKS, BIAS_LABELS } from "./bias-types";
import { getPricingArea } from "../area-utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function severity(confidence: number): BiasSeverity {
    if (confidence >= 85) return "critical";
    if (confidence >= 70) return "high";
    if (confidence >= 50) return "medium";
    return "low";
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

// ─── 1. Optimism Bias ───────────────────────────────────────────────────────
// Ultra-luxury/Luxury tier + insufficient budget OR low flexibility

function detectOptimismBias(
    inputs: ProjectInputs,
    scoreResult: ScoreResult
): BiasAlert | null {
    const tier = inputs.mkt01Tier;
    if (tier !== "Luxury" && tier !== "Ultra-luxury") return null;

    const benchmark = TIER_BUDGET_BENCHMARKS[tier];
    if (!benchmark) return null;

    const gfa = getPricingArea(inputs); // V4: uses fitout area
    const budget = inputs.fin01BudgetCap || 0;
    const expectedBudget = benchmark.median * gfa;
    const budgetRatio = expectedBudget > 0 ? budget / expectedBudget : 1;

    const evidence: EvidencePoint[] = [];
    let rawConfidence = 0;

    // Budget significantly below tier median
    if (budget > 0 && budgetRatio < 0.7) {
        const shortfall = ((1 - budgetRatio) * 100).toFixed(0);
        rawConfidence += 40 + (1 - budgetRatio) * 40; // 40-80 points
        evidence.push({
            variable: "fin01BudgetCap",
            label: "Budget Cap",
            value: `AED ${budget.toLocaleString()}`,
            expected: `AED ${expectedBudget.toLocaleString()} (median for ${tier})`,
            deviation: `${shortfall}% below ${tier} market median`,
        });
    }

    // Low financial flexibility
    if (inputs.fin02Flexibility <= 2) {
        rawConfidence += 20;
        evidence.push({
            variable: "fin02Flexibility",
            label: "Budget Flexibility",
            value: inputs.fin02Flexibility,
            expected: "≥ 3 for high-tier projects",
            deviation: "Rigid budget with premium ambitions",
        });
    }

    // Low shock tolerance + luxury
    if (inputs.fin03ShockTolerance <= 2) {
        rawConfidence += 15;
        evidence.push({
            variable: "fin03ShockTolerance",
            label: "Shock Tolerance",
            value: inputs.fin03ShockTolerance,
            expected: "≥ 3 for luxury market exposure",
            deviation: "Low resilience to cost overruns in premium segment",
        });
    }

    // High design complexity with tight timeline
    if (inputs.des03Complexity >= 4 && (inputs.ctx05Horizon === "0-12m" || inputs.ctx05Horizon === "12-24m")) {
        rawConfidence += 15;
        evidence.push({
            variable: "des03Complexity",
            label: "Design Complexity",
            value: inputs.des03Complexity,
            expected: "Lower complexity or longer horizon for Complexity ≥ 4",
        });
    }

    if (evidence.length === 0) return null;

    const confidence = clamp(rawConfidence, 20, 98);

    return {
        biasType: "optimism_bias",
        severity: severity(confidence),
        confidence,
        title: "Optimism Bias Detected",
        description: `This ${tier} project has ${evidence.length} indicator(s) suggesting unrealistic expectations. ` +
            `The selected tier implies market-rate costs that significantly exceed the configured budget and flexibility parameters.`,
        intervention: `Review budget allocation against ${tier} benchmarks. Consider either increasing the budget cap ` +
            `to at least AED ${(TIER_BUDGET_BENCHMARKS[tier].low * (inputs.ctx03Gfa || 500)).toLocaleString()} or adjusting the market tier downward.`,
        evidencePoints: evidence,
        mathExplanation: `Budget ratio = actual / (${tier} median × GFA) = ${budgetRatio.toFixed(2)}. ` +
            `Threshold: < 0.70 triggers flag. Flexibility: ${inputs.fin02Flexibility}/5, ShockTolerance: ${inputs.fin03ShockTolerance}/5.`,
    };
}

// ─── 2. Anchoring Bias ──────────────────────────────────────────────────────
// Budget barely changes across 3+ evaluations despite score penalties

function detectAnchoringBias(
    inputs: ProjectInputs,
    scoreResult: ScoreResult,
    ctx: DetectorContext
): BiasAlert | null {
    if (ctx.evaluationCount < 3) return null;
    if (ctx.previousBudgets.length < 3) return null;

    const currentBudget = inputs.fin01BudgetCap || 0;
    if (currentBudget <= 0) return null;

    // Check if budget stayed within ±5% across evaluations
    const budgetVariance = ctx.previousBudgets.map(b =>
        Math.abs(b - currentBudget) / currentBudget
    );
    const maxVariance = Math.max(...budgetVariance);
    const avgVariance = budgetVariance.reduce((a, b) => a + b, 0) / budgetVariance.length;

    if (maxVariance > 0.05) return null; // Budget changed significantly

    // Check if scores have been declining or low
    const hasFinancialPenalties = scoreResult.penalties.some(
        p => p.id.includes("budget") || p.id.includes("fin") || p.trigger.toLowerCase().includes("budget")
    );

    const evidence: EvidencePoint[] = [
        {
            variable: "fin01BudgetCap",
            label: "Budget Cap (History)",
            value: `AED ${currentBudget.toLocaleString()}`,
            expected: "Adjustment based on evaluation feedback",
            deviation: `Budget unchanged (±${(maxVariance * 100).toFixed(1)}%) across ${ctx.evaluationCount} evaluations`,
        },
    ];

    if (hasFinancialPenalties) {
        evidence.push({
            variable: "penalties",
            label: "Active Financial Penalties",
            value: scoreResult.penalties.filter(p =>
                p.id.includes("budget") || p.id.includes("fin")
            ).length,
            deviation: "Budget-related penalties persist but budget unchanged",
        });
    }

    let rawConfidence = 50 + (ctx.evaluationCount - 3) * 10 + (avgVariance < 0.02 ? 15 : 0);
    if (hasFinancialPenalties) rawConfidence += 20;

    const confidence = clamp(rawConfidence, 40, 95);

    return {
        biasType: "anchoring_bias",
        severity: severity(confidence),
        confidence,
        title: "Anchoring Bias — Budget Fixed Despite Feedback",
        description: `The budget has remained at AED ${currentBudget.toLocaleString()} (±${(maxVariance * 100).toFixed(1)}%) ` +
            `across ${ctx.evaluationCount} evaluations. The system has flagged financial penalties, but the budget has not been adjusted.`,
        intervention: `Consider whether the initial budget was set based on objective data or an arbitrary anchor. ` +
            `Re-evaluate using the market benchmarks and sensitivity analysis to determine the optimal budget range.`,
        evidencePoints: evidence,
        mathExplanation: `Max budget variance = ${(maxVariance * 100).toFixed(2)}% (threshold: 5%). ` +
            `Evaluations: ${ctx.evaluationCount}. Financial penalties active: ${hasFinancialPenalties}.`,
    };
}

// ─── 3. Confirmation Bias ───────────────────────────────────────────────────
// Multiple manual overrides all inflating scores on a weak project

function detectConfirmationBias(
    inputs: ProjectInputs,
    scoreResult: ScoreResult,
    ctx: DetectorContext
): BiasAlert | null {
    if (ctx.overrideCount < 2) return null;

    // Overrides net positive (inflating) AND composite score is still weak
    if (ctx.overrideNetEffect <= 0) return null;
    if (scoreResult.compositeScore >= 65) return null; // Not weak enough to flag

    const evidence: EvidencePoint[] = [
        {
            variable: "overrideCount",
            label: "Manual Overrides",
            value: ctx.overrideCount,
            expected: "Balanced overrides (both up and down)",
            deviation: `${ctx.overrideCount} overrides applied, all increasing scores by net +${ctx.overrideNetEffect.toFixed(1)}`,
        },
        {
            variable: "compositeScore",
            label: "Composite Score",
            value: scoreResult.compositeScore.toFixed(1),
            expected: "≥ 65 for a validated project",
            deviation: `Score remains ${scoreResult.compositeScore.toFixed(1)} despite positive overrides`,
        },
    ];

    let rawConfidence = 45 + ctx.overrideCount * 10 + (65 - scoreResult.compositeScore);
    const confidence = clamp(rawConfidence, 40, 95);

    return {
        biasType: "confirmation_bias",
        severity: severity(confidence),
        confidence,
        title: "Confirmation Bias — Cherry-Picking Overrides",
        description: `${ctx.overrideCount} manual overrides have been applied, all increasing the score by a net +${ctx.overrideNetEffect.toFixed(1)} points. ` +
            `Despite this, the composite score remains at ${scoreResult.compositeScore.toFixed(1)}, below the validation threshold.`,
        intervention: `Review each override for objective justification. Consider whether the project fundamentals support the ` +
            `desired direction, or whether the overrides are being used to validate a predetermined conclusion.`,
        evidencePoints: evidence,
        mathExplanation: `Overrides: ${ctx.overrideCount}, net effect: +${ctx.overrideNetEffect.toFixed(1)}. ` +
            `Post-override composite: ${scoreResult.compositeScore.toFixed(1)} (threshold: 65). ` +
            `All overrides positive → confirmation bias pattern.`,
    };
}

// ─── 4. Overconfidence ──────────────────────────────────────────────────────
// Max self-assessment scores + ignoring competitive pressure

function detectOverconfidence(
    inputs: ProjectInputs,
    scoreResult: ScoreResult
): BiasAlert | null {
    const evidence: EvidencePoint[] = [];
    let rawConfidence = 0;

    // High brand + differentiation self-assessment
    if (inputs.str01BrandClarity >= 5 && inputs.str02Differentiation >= 5) {
        rawConfidence += 40;
        evidence.push({
            variable: "str01BrandClarity + str02Differentiation",
            label: "Self-Assessed Brand + Differentiation",
            value: "5/5 + 5/5",
            expected: "Rare to have perfect scores in both",
            deviation: "Maximum self-assessment on both strategic dimensions",
        });
    } else if (inputs.str01BrandClarity >= 4 && inputs.str02Differentiation >= 4) {
        rawConfidence += 20;
    } else {
        return null;
    }

    // Ignoring competitive landscape
    if (inputs.mkt02Competitor <= 2) {
        rawConfidence += 30;
        evidence.push({
            variable: "mkt02Competitor",
            label: "Competitive Awareness",
            value: inputs.mkt02Competitor,
            expected: "≥ 3 in active UAE real estate market",
            deviation: "Low competitor rating despite high brand confidence",
        });
    }

    // Buyer maturity overestimate
    if (inputs.str03BuyerMaturity >= 5) {
        rawConfidence += 15;
        evidence.push({
            variable: "str03BuyerMaturity",
            label: "Buyer Maturity",
            value: inputs.str03BuyerMaturity,
            expected: "Evidence-based assessment",
            deviation: "Maximum buyer maturity rating — verify with market data",
        });
    }

    if (evidence.length < 2) return null;

    const confidence = clamp(rawConfidence, 35, 95);

    return {
        biasType: "overconfidence",
        severity: severity(confidence),
        confidence,
        title: "Overconfidence Detected",
        description: `Strategic self-assessment scores are at maximum levels (Brand: ${inputs.str01BrandClarity}/5, ` +
            `Differentiation: ${inputs.str02Differentiation}/5) while competitive awareness is rated at only ${inputs.mkt02Competitor}/5.`,
        intervention: `Validate brand and differentiation claims against objective competitor data. ` +
            `Consider commissioning a market study or reviewing the competitor entity database before proceeding.`,
        evidencePoints: evidence,
        mathExplanation: `Brand: ${inputs.str01BrandClarity}/5, Differentiation: ${inputs.str02Differentiation}/5, ` +
            `Competitor: ${inputs.mkt02Competitor}/5. Pattern: max self-assessment + low competitor awareness.`,
    };
}

// ─── 5. Scope Creep Risk ────────────────────────────────────────────────────
// High complexity + high experience + tight timeline + weak supply chain

function detectScopeCreep(
    inputs: ProjectInputs,
    scoreResult: ScoreResult
): BiasAlert | null {
    const evidence: EvidencePoint[] = [];
    let rawConfidence = 0;

    const isComplexDesign = inputs.des03Complexity >= 4;
    const isHighExperience = inputs.des04Experience >= 4;
    const isTightTimeline = inputs.ctx05Horizon === "0-12m" || inputs.ctx05Horizon === "12-24m";
    const isWeakSupplyChain = inputs.exe01SupplyChain <= 2;
    const isWeakContractor = inputs.exe02Contractor <= 2;

    if (!isComplexDesign) return null;

    if (isComplexDesign) {
        rawConfidence += 25;
        evidence.push({
            variable: "des03Complexity",
            label: "Design Complexity",
            value: inputs.des03Complexity,
            deviation: "High complexity increases scope change probability",
        });
    }

    if (isHighExperience) {
        rawConfidence += 15;
        evidence.push({
            variable: "des04Experience",
            label: "Experience Intensity",
            value: inputs.des04Experience,
            deviation: "Experiential design elements compound scope risks",
        });
    }

    if (isTightTimeline) {
        rawConfidence += 25;
        evidence.push({
            variable: "ctx05Horizon",
            label: "Delivery Horizon",
            value: inputs.ctx05Horizon,
            expected: "24-36m+ for Complexity ≥ 4",
            deviation: "Tight timeline with complex scope",
        });
    }

    if (isWeakSupplyChain) {
        rawConfidence += 20;
        evidence.push({
            variable: "exe01SupplyChain",
            label: "Supply Chain Readiness",
            value: inputs.exe01SupplyChain,
            expected: "≥ 3 for complex designs",
            deviation: "Weak supply chain cannot support scope ambitions",
        });
    }

    if (isWeakContractor) {
        rawConfidence += 15;
        evidence.push({
            variable: "exe02Contractor",
            label: "Contractor Capability",
            value: inputs.exe02Contractor,
            deviation: "Low contractor rating compounds delivery risk",
        });
    }

    if (evidence.length < 3) return null;

    const confidence = clamp(rawConfidence, 35, 95);

    return {
        biasType: "scope_creep",
        severity: severity(confidence),
        confidence,
        title: "Scope Creep Risk — Ambition Exceeds Delivery Capacity",
        description: `This project combines high design complexity (${inputs.des03Complexity}/5) ` +
            `with ${isTightTimeline ? `a tight ${inputs.ctx05Horizon} horizon` : ""}` +
            `${isWeakSupplyChain ? ` and weak supply chain (${inputs.exe01SupplyChain}/5)` : ""}. ` +
            `This combination significantly increases the probability of uncontrolled scope expansion.`,
        intervention: `Either extend the delivery horizon to 24-36m+, simplify design complexity to ≤ 3, ` +
            `or strengthen the execution pipeline (supply chain ≥ 3, contractor ≥ 3) before proceeding.`,
        evidencePoints: evidence,
        mathExplanation: `Complexity: ${inputs.des03Complexity}/5, Experience: ${inputs.des04Experience}/5, ` +
            `Horizon: ${inputs.ctx05Horizon}, SupplyChain: ${inputs.exe01SupplyChain}/5, Contractor: ${inputs.exe02Contractor}/5.`,
    };
}

// ─── 6. Sunk Cost Fallacy ───────────────────────────────────────────────────
// Re-evaluating a declining project multiple times without abandoning

function detectSunkCost(
    inputs: ProjectInputs,
    scoreResult: ScoreResult,
    ctx: DetectorContext
): BiasAlert | null {
    if (ctx.evaluationCount < 3) return null;
    if (ctx.previousScores.length < 2) return null;

    // Check for a declining trend
    const scores = [...ctx.previousScores, scoreResult.compositeScore];
    let decliningCount = 0;
    for (let i = 1; i < scores.length; i++) {
        if (scores[i] < scores[i - 1]) decliningCount++;
    }

    const isDeclining = decliningCount >= Math.floor(scores.length * 0.6);
    const latestScore = scoreResult.compositeScore;
    const peakScore = Math.max(...ctx.previousScores);

    if (!isDeclining || latestScore >= 60) return null;

    const evidence: EvidencePoint[] = [
        {
            variable: "evaluationHistory",
            label: "Evaluation Count",
            value: ctx.evaluationCount,
            deviation: `${ctx.evaluationCount} evaluations with declining trend`,
        },
        {
            variable: "scoreTrajectory",
            label: "Score Trajectory",
            value: `Peak: ${peakScore.toFixed(1)} → Current: ${latestScore.toFixed(1)}`,
            deviation: `Score declined ${(peakScore - latestScore).toFixed(1)} points from peak`,
        },
    ];

    if (scoreResult.decisionStatus === "not_validated") {
        evidence.push({
            variable: "decisionStatus",
            label: "Validation Status",
            value: "Not Validated",
            deviation: "Project has not achieved validation despite multiple attempts",
        });
    }

    let rawConfidence = 40 + (ctx.evaluationCount - 3) * 10 + (peakScore - latestScore);
    if (scoreResult.decisionStatus === "not_validated") rawConfidence += 15;

    const confidence = clamp(rawConfidence, 40, 95);

    return {
        biasType: "sunk_cost",
        severity: severity(confidence),
        confidence,
        title: "Sunk Cost Fallacy — Declining Project Persists",
        description: `This project has been evaluated ${ctx.evaluationCount} times with a declining score trajectory ` +
            `(peak: ${peakScore.toFixed(1)} → current: ${latestScore.toFixed(1)}). ` +
            `Continued investment may be driven by prior commitment rather than objective viability.`,
        intervention: `Perform a zero-base assessment: evaluate this project as if starting fresh today. ` +
            `Would you invest given the current score of ${latestScore.toFixed(1)}? Consider pivoting or shelving.`,
        evidencePoints: evidence,
        mathExplanation: `Evaluations: ${ctx.evaluationCount}. Declining in ${decliningCount}/${scores.length - 1} intervals. ` +
            `Peak: ${peakScore.toFixed(1)}, Current: ${latestScore.toFixed(1)}, Delta: -${(peakScore - latestScore).toFixed(1)}.`,
    };
}

// ─── 7. Clustering Illusion ─────────────────────────────────────────────────
// Overrating trend alignment vs actual market evidence

function detectClusteringIllusion(
    inputs: ProjectInputs,
    scoreResult: ScoreResult,
    ctx: DetectorContext
): BiasAlert | null {
    if (inputs.mkt03Trend < 4) return null;

    // If we have actual market trend data and it contradicts user's assessment
    if (ctx.marketTrendActual !== null && ctx.marketTrendActual !== undefined) {
        const gap = inputs.mkt03Trend - ctx.marketTrendActual;
        if (gap < 2) return null; // Not a significant discrepancy

        const evidence: EvidencePoint[] = [
            {
                variable: "mkt03Trend",
                label: "User Trend Assessment",
                value: `${inputs.mkt03Trend}/5`,
                expected: `${ctx.marketTrendActual.toFixed(1)}/5 (evidence-based)`,
                deviation: `User rates trends +${gap.toFixed(1)} above evidence data`,
            },
        ];

        const confidence = clamp(40 + gap * 20, 45, 95);

        return {
            biasType: "clustering_illusion",
            severity: severity(confidence),
            confidence,
            title: "Clustering Illusion — Trend Overestimation",
            description: `The user-assessed market trend (${inputs.mkt03Trend}/5) significantly exceeds ` +
                `the evidence-based trend metric (${ctx.marketTrendActual.toFixed(1)}/5). ` +
                `This may reflect seeing patterns in noise — interpreting random market movements as meaningful trends.`,
            intervention: `Cross-reference trend assessment with the Evidence Vault and market analytics. ` +
                `Review actual price movement data, absorption rates, and competitive supply before confirming trend score.`,
            evidencePoints: evidence,
            mathExplanation: `User trend: ${inputs.mkt03Trend}/5, Evidence trend: ${ctx.marketTrendActual.toFixed(1)}/5. ` +
                `Gap: ${gap.toFixed(1)} (threshold: ≥ 2).`,
        };
    }

    // Fallback: if trend is max and market tier doesn't support it
    if (inputs.mkt03Trend >= 5 && inputs.ctx04Location === "Emerging") {
        return {
            biasType: "clustering_illusion",
            severity: "medium",
            confidence: 55,
            title: "Clustering Illusion — Verify Trend Assessment",
            description: `Maximum trend alignment (5/5) claimed for an Emerging location, which typically has ` +
                `less predictable market trends. This may reflect optimistic trend interpretation.`,
            intervention: `Verify trend data with the Data Freshness Engine. Emerging markets often show ` +
                `volatile patterns that can be misread as consistent trends.`,
            evidencePoints: [
                {
                    variable: "mkt03Trend",
                    label: "Market Trend",
                    value: 5,
                    expected: "Evidence-backed assessment",
                    deviation: "Max trend score in an Emerging location",
                },
                {
                    variable: "ctx04Location",
                    label: "Location Category",
                    value: "Emerging",
                    deviation: "Emerging markets have higher trend volatility",
                },
            ],
            mathExplanation: `Trend: ${inputs.mkt03Trend}/5, Location: Emerging. Max trend + high-volatility ` +
                `location = potential pattern overread.`,
        };
    }

    return null;
}

// ─── Main Detection Function ────────────────────────────────────────────────

export function detectBiases(
    inputs: ProjectInputs,
    scoreResult: ScoreResult,
    ctx: DetectorContext
): BiasAlert[] {
    const alerts: BiasAlert[] = [];

    const detectors: Array<() => BiasAlert | null> = [
        () => detectOptimismBias(inputs, scoreResult),
        () => detectAnchoringBias(inputs, scoreResult, ctx),
        () => detectConfirmationBias(inputs, scoreResult, ctx),
        () => detectOverconfidence(inputs, scoreResult),
        () => detectScopeCreep(inputs, scoreResult),
        () => detectSunkCost(inputs, scoreResult, ctx),
        () => detectClusteringIllusion(inputs, scoreResult, ctx),
    ];

    for (const detector of detectors) {
        try {
            const alert = detector();
            if (alert) alerts.push(alert);
        } catch (e) {
            // Individual detector failures should not break the entire analysis
            console.warn("[BiasDetector] Detector failed:", e);
        }
    }

    // Sort by severity (critical first), then confidence
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) =>
        (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4) ||
        b.confidence - a.confidence
    );

    return alerts;
}

// Re-export for convenience
export { BIAS_LABELS };
