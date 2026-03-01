/**
 * MIYAR V3-08 — Insight Generation Engine
 *
 * Deterministic insight triggers with LLM narrative enrichment:
 *
 * 5 Insight Types:
 *   1. cost_pressure      — material cost rising >10% (30-day MA)
 *   2. market_opportunity  — market segment with <3 competitors + rising demand
 *   3. competitor_alert    — new competitor project in same segment
 *   4. trend_signal        — significant trend direction change detected
 *   5. positioning_gap     — project fitout rate outside P25-P75 range
 *
 * Each insight fires ONLY on a deterministic condition.
 * LLM is used ONLY for body + actionableRecommendation text.
 * confidenceScore = weighted average of contributing evidence confidence.
 */

import { invokeLLM } from "../../_core/llm";

// ─── Types ───────────────────────────────────────────────────────

export type InsightType =
  | "cost_pressure"
  | "market_opportunity"
  | "competitor_alert"
  | "trend_signal"
  | "positioning_gap"
  | "style_shift"
  | "brand_dominance"
  | "spec_inflation"
  | "space_optimization";

export type InsightSeverity = "critical" | "warning" | "info";

export interface InsightInput {
  // Trend data
  trends?: Array<{
    metric: string;
    category: string;
    direction: string;
    percentChange: number | null;
    confidence: string;
    currentMA: number | null;
    previousMA: number | null;
    anomalyCount: number;
  }>;

  // Market position data
  marketPosition?: {
    targetValue: number;
    tier: string;
    percentile: number;
    percentiles: { p25: number; p50: number; p75: number; p90: number };
    competitiveIndex: number;
  };

  // Competitor data
  competitorLandscape?: {
    totalProjects: number;
    totalDevelopers: number;
    hhi: number;
    concentration: string;
    topDevelopers: Array<{
      developerName: string;
      marketShareByUnits: number;
      threatLevel: string;
    }>;
  };

  // Evidence stats
  evidenceStats?: {
    totalRecords: number;
    categoryBreakdown: Record<string, number>;
    avgConfidence: number;
  };

  // Project context
  projectContext?: {
    projectId: number;
    projectName: string;
    segment?: string;
    geography?: string;
  };

  // Design Intelligence
  designIntelligence?: {
    styleMentions?: Array<{ style: string; currentPeriod: number; previousPeriod: number; percentChange: number }>;
    brandShare?: Array<{ brand: string; category: string; sharePercentage: number }>;
    finishLevelInflation?: Array<{ finishLevel: string; category: string; percentChange: number; categoryAvgChange: number }>;
  };

  // Phase 9: Space analysis data
  spaceAnalysis?: {
    efficiencyScore: number;           // 0-100
    criticalCount: number;             // rooms with critical deviations
    advisoryCount: number;             // rooms with advisory deviations
    circulationWastePercent: number;   // % wasted on circulation
    recommendations: Array<{ roomName: string; severity: string; action: string }>;
  };
}

export interface GeneratedInsight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  body: string | null;
  actionableRecommendation: string | null;
  confidenceScore: number; // 0-1
  triggerCondition: string; // human-readable trigger description
  dataPoints: Record<string, any>; // supporting data
}

// ─── Named Constants ─────────────────────────────────────────────

const COST_PRESSURE_THRESHOLD = 10; // >10% increase triggers
const MARKET_OPPORTUNITY_MIN_COMPETITORS = 3; // <3 competitors = opportunity
const POSITIONING_GAP_PERCENTILE_LOW = 25;
const POSITIONING_GAP_PERCENTILE_HIGH = 75;
const TREND_SIGNAL_MIN_CHANGE = 5; // >5% change triggers

// Confidence weights by evidence grade
const CONFIDENCE_WEIGHTS: Record<string, number> = {
  high: 0.90,
  medium: 0.65,
  low: 0.40,
  insufficient: 0.20,
};

// ─── Deterministic Trigger Functions ─────────────────────────────

function checkCostPressure(input: InsightInput): GeneratedInsight | null {
  if (!input.trends) return null;

  const risingCosts = input.trends.filter(
    (t) =>
      t.direction === "rising" &&
      t.percentChange !== null &&
      t.percentChange > COST_PRESSURE_THRESHOLD &&
      (t.category === "material_cost" || t.category === "floors" || t.category === "walls" || t.category === "fixtures")
  );

  if (risingCosts.length === 0) return null;

  const worst = risingCosts.reduce((max, t) =>
    (t.percentChange ?? 0) > (max.percentChange ?? 0) ? t : max
  );

  const confidenceScore = CONFIDENCE_WEIGHTS[worst.confidence] ?? 0.40;

  return {
    type: "cost_pressure",
    severity: (worst.percentChange ?? 0) > 20 ? "critical" : "warning",
    title: `Material cost pressure: ${worst.metric} up ${(worst.percentChange ?? 0).toFixed(1)}%`,
    body: null, // LLM fills
    actionableRecommendation: null, // LLM fills
    confidenceScore,
    triggerCondition: `30-day MA increase > ${COST_PRESSURE_THRESHOLD}% for material cost category`,
    dataPoints: {
      metric: worst.metric,
      category: worst.category,
      percentChange: worst.percentChange,
      currentMA: worst.currentMA,
      previousMA: worst.previousMA,
      risingCategories: risingCosts.map((t) => t.metric),
    },
  };
}

function checkMarketOpportunity(input: InsightInput): GeneratedInsight | null {
  if (!input.competitorLandscape) return null;

  const { totalDevelopers, hhi, concentration } = input.competitorLandscape;

  if (totalDevelopers >= MARKET_OPPORTUNITY_MIN_COMPETITORS && concentration !== "fragmented") {
    return null;
  }

  // Also check if there's a rising trend in the market
  const risingTrends = input.trends?.filter((t) => t.direction === "rising") ?? [];

  if (totalDevelopers >= MARKET_OPPORTUNITY_MIN_COMPETITORS && risingTrends.length === 0) {
    return null;
  }

  const confidenceScore = input.competitorLandscape
    ? Math.min(0.85, 0.50 + (MARKET_OPPORTUNITY_MIN_COMPETITORS - totalDevelopers) * 0.15)
    : 0.40;

  return {
    type: "market_opportunity",
    severity: "info",
    title: `Market opportunity: ${totalDevelopers < MARKET_OPPORTUNITY_MIN_COMPETITORS ? "low competition" : "fragmented market"} detected`,
    body: null,
    actionableRecommendation: null,
    confidenceScore: Math.max(0.20, confidenceScore),
    triggerCondition: `<${MARKET_OPPORTUNITY_MIN_COMPETITORS} competitors in segment OR fragmented market (HHI < 0.15)`,
    dataPoints: {
      totalDevelopers,
      hhi,
      concentration,
      risingTrends: risingTrends.map((t) => t.metric),
    },
  };
}

function checkCompetitorAlert(input: InsightInput): GeneratedInsight | null {
  if (!input.competitorLandscape) return null;

  const highThreats = input.competitorLandscape.topDevelopers.filter(
    (d) => d.threatLevel === "high"
  );

  if (highThreats.length === 0) return null;

  const topThreat = highThreats[0];
  const confidenceScore = 0.75; // competitor data is typically reliable

  return {
    type: "competitor_alert",
    severity: highThreats.length >= 3 ? "critical" : "warning",
    title: `Competitor alert: ${topThreat.developerName} holds ${(topThreat.marketShareByUnits * 100).toFixed(1)}% market share`,
    body: null,
    actionableRecommendation: null,
    confidenceScore,
    triggerCondition: `Developer with >15% market share detected`,
    dataPoints: {
      topThreat: topThreat.developerName,
      marketShare: topThreat.marketShareByUnits,
      highThreatCount: highThreats.length,
      allHighThreats: highThreats.map((d) => ({
        name: d.developerName,
        share: d.marketShareByUnits,
      })),
    },
  };
}

function checkTrendSignal(input: InsightInput): GeneratedInsight | null {
  if (!input.trends) return null;

  const significantTrends = input.trends.filter(
    (t) =>
      t.direction !== "stable" &&
      t.direction !== "insufficient_data" &&
      t.percentChange !== null &&
      Math.abs(t.percentChange) > TREND_SIGNAL_MIN_CHANGE
  );

  if (significantTrends.length === 0) return null;

  // Pick the most significant
  const most = significantTrends.reduce((max, t) =>
    Math.abs(t.percentChange ?? 0) > Math.abs(max.percentChange ?? 0) ? t : max
  );

  const confidenceScore = CONFIDENCE_WEIGHTS[most.confidence] ?? 0.40;

  return {
    type: "trend_signal",
    severity: Math.abs(most.percentChange ?? 0) > 15 ? "warning" : "info",
    title: `Trend signal: ${most.metric} ${most.direction} by ${Math.abs(most.percentChange ?? 0).toFixed(1)}%`,
    body: null,
    actionableRecommendation: null,
    confidenceScore,
    triggerCondition: `Trend direction change > ${TREND_SIGNAL_MIN_CHANGE}% detected`,
    dataPoints: {
      metric: most.metric,
      direction: most.direction,
      percentChange: most.percentChange,
      anomalyCount: most.anomalyCount,
      totalSignificantTrends: significantTrends.length,
    },
  };
}

function checkPositioningGap(input: InsightInput): GeneratedInsight | null {
  if (!input.marketPosition) return null;

  const { percentile, targetValue, percentiles, tier } = input.marketPosition;

  // Outside P25-P75 range
  if (percentile >= POSITIONING_GAP_PERCENTILE_LOW && percentile <= POSITIONING_GAP_PERCENTILE_HIGH) {
    return null;
  }

  const isBelow = percentile < POSITIONING_GAP_PERCENTILE_LOW;
  const confidenceScore = 0.70;

  return {
    type: "positioning_gap",
    severity: isBelow ? "info" : "warning",
    title: `Positioning gap: project at P${Math.round(percentile)} (${isBelow ? "below" : "above"} market range)`,
    body: null,
    actionableRecommendation: null,
    confidenceScore,
    triggerCondition: `Project percentile outside P${POSITIONING_GAP_PERCENTILE_LOW}-P${POSITIONING_GAP_PERCENTILE_HIGH} range`,
    dataPoints: {
      targetValue,
      percentile,
      tier,
      p25: percentiles.p25,
      p50: percentiles.p50,
      p75: percentiles.p75,
      gapToP25: targetValue - percentiles.p25,
      gapToP75: targetValue - percentiles.p75,
    },
  };
}

function checkStyleShift(input: InsightInput): GeneratedInsight | null {
  if (!input.designIntelligence?.styleMentions) return null;

  const shiftingStyles = input.designIntelligence.styleMentions.filter(
    (s) => s.percentChange > 20 && s.currentPeriod >= 3 // Meaningful volume
  );

  if (shiftingStyles.length === 0) return null;

  const topShift = shiftingStyles.reduce((max, s) => s.percentChange > max.percentChange ? s : max);

  return {
    type: "style_shift",
    severity: topShift.percentChange > 50 ? "warning" : "info",
    title: `Style momentum: ${topShift.style} mentions increased by ${topShift.percentChange.toFixed(0)}%`,
    body: null,
    actionableRecommendation: null,
    confidenceScore: 0.75,
    triggerCondition: `Design style mentions increased by >20% period-over-period`,
    dataPoints: {
      style: topShift.style,
      percentChange: topShift.percentChange,
      currentMentions: topShift.currentPeriod,
      previousMentions: topShift.previousPeriod,
    },
  };
}

function checkBrandDominance(input: InsightInput): GeneratedInsight | null {
  if (!input.designIntelligence?.brandShare) return null;

  const dominantBrands = input.designIntelligence.brandShare.filter(
    (b) => b.sharePercentage > 50
  );

  if (dominantBrands.length === 0) return null;

  const topBrand = dominantBrands.reduce((max, b) => b.sharePercentage > max.sharePercentage ? b : max);

  return {
    type: "brand_dominance",
    severity: topBrand.sharePercentage > 70 ? "warning" : "info",
    title: `Brand dominance: ${topBrand.brand} captures ${topBrand.sharePercentage.toFixed(0)}% share in ${topBrand.category}`,
    body: null,
    actionableRecommendation: null,
    confidenceScore: 0.80,
    triggerCondition: `Brand holds >50% mention share within a category`,
    dataPoints: {
      brand: topBrand.brand,
      category: topBrand.category,
      sharePercentage: topBrand.sharePercentage,
    },
  };
}

function checkSpecInflation(input: InsightInput): GeneratedInsight | null {
  if (!input.designIntelligence?.finishLevelInflation) return null;

  const inflatedSpecs = input.designIntelligence.finishLevelInflation.filter(
    (f) => f.percentChange > 10 && (f.percentChange - f.categoryAvgChange) > 5
  );

  if (inflatedSpecs.length === 0) return null;

  const topInflation = inflatedSpecs.reduce((max, f) => f.percentChange > max.percentChange ? f : max);

  return {
    type: "spec_inflation",
    severity: topInflation.percentChange > 20 ? "warning" : "info",
    title: `Spec inflation: ${topInflation.finishLevel} ${topInflation.category} costs rising disproportionately (+${topInflation.percentChange.toFixed(0)}%)`,
    body: null,
    actionableRecommendation: null,
    confidenceScore: 0.70,
    triggerCondition: `Finish level price increasing >10% AND >5% faster than category average`,
    dataPoints: {
      finishLevel: topInflation.finishLevel,
      category: topInflation.category,
      specChange: topInflation.percentChange,
      categoryChange: topInflation.categoryAvgChange,
      delta: topInflation.percentChange - topInflation.categoryAvgChange
    },
  };
}

function checkSpaceOptimization(input: InsightInput): GeneratedInsight | null {
  if (!input.spaceAnalysis) return null;

  const { efficiencyScore, criticalCount, advisoryCount, circulationWastePercent, recommendations } = input.spaceAnalysis;

  // Trigger on low efficiency or critical deviations
  if (efficiencyScore >= 75 && criticalCount === 0) return null;

  const severity: InsightSeverity = criticalCount >= 2 ? "critical" : criticalCount >= 1 || efficiencyScore < 50 ? "warning" : "info";

  const topRecs = recommendations.filter(r => r.severity === "critical").slice(0, 3);
  const roomNames = topRecs.map(r => r.roomName).join(", ");

  return {
    type: "space_optimization",
    severity,
    title: `Space optimization: efficiency score ${efficiencyScore}/100 with ${criticalCount} critical room deviations`,
    body: null,
    actionableRecommendation: null,
    confidenceScore: 0.85, // floor plan analysis is high-confidence
    triggerCondition: `Space efficiency <75 OR critical room count >= 1`,
    dataPoints: {
      efficiencyScore,
      criticalCount,
      advisoryCount,
      circulationWastePercent,
      flaggedRooms: roomNames,
      topRecommendations: topRecs,
    },
  };
}

// ─── LLM Narrative Enrichment ────────────────────────────────────

async function enrichWithLLM(insight: GeneratedInsight): Promise<GeneratedInsight> {
  const prompt = `You are a UAE real estate analytics advisor. Generate a brief insight body and actionable recommendation.

Insight Type: ${insight.type}
Title: ${insight.title}
Severity: ${insight.severity}
Trigger: ${insight.triggerCondition}
Data: ${JSON.stringify(insight.dataPoints)}

Output JSON:
{
  "body": "2-3 sentence analysis explaining the insight and its implications",
  "recommendation": "1-2 sentence specific actionable recommendation"
}

Rules:
- Be specific, use numbers from the data
- Body should explain WHY this matters for the project
- Recommendation should be concrete and actionable
- Keep total under 100 words`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a concise UAE real estate analytics advisor. Output valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "insight_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              body: { type: "string", description: "2-3 sentence analysis" },
              recommendation: { type: "string", description: "1-2 sentence recommendation" },
            },
            required: ["body", "recommendation"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      insight.body = parsed.body || null;
      insight.actionableRecommendation = parsed.recommendation || null;
    }
  } catch {
    // Fallback: generate deterministic body
    insight.body = `${insight.title}. This was detected based on: ${insight.triggerCondition}.`;
    insight.actionableRecommendation = "Review the underlying data and adjust project parameters accordingly.";
  }

  return insight;
}

// ─── Main Entry Point ────────────────────────────────────────────

export interface GenerateInsightsOptions {
  enrichWithLLM?: boolean;
}

/**
 * Generate all applicable insights from the input data.
 * Each insight fires only on its deterministic condition.
 */
export async function generateInsights(
  input: InsightInput,
  options: GenerateInsightsOptions = {}
): Promise<GeneratedInsight[]> {
  const { enrichWithLLM: shouldEnrich = true } = options;

  // Run all deterministic checks
  const checks = [
    checkCostPressure(input),
    checkMarketOpportunity(input),
    checkCompetitorAlert(input),
    checkTrendSignal(input),
    checkPositioningGap(input),
    checkStyleShift(input),
    checkBrandDominance(input),
    checkSpecInflation(input),
    checkSpaceOptimization(input),
  ];

  const insights = checks.filter((i): i is GeneratedInsight => i !== null);

  // Enrich with LLM narratives if requested
  if (shouldEnrich) {
    for (let i = 0; i < insights.length; i++) {
      insights[i] = await enrichWithLLM(insights[i]);
    }
  }

  // Sort by severity: critical > warning > info
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}
