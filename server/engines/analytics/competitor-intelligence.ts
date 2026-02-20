/**
 * MIYAR V3-07 — Competitor Intelligence Analytics Engine
 *
 * Deterministic competitor landscape analysis:
 *   - Herfindahl-Hirschman Index (HHI) for market concentration
 *   - Developer market share computation
 *   - Competitive threat scoring per developer
 *   - Price positioning relative to competitors
 *
 * HHI interpretation:
 *   - Fragmented:   HHI < 0.15  (many small players)
 *   - Moderate:     0.15 ≤ HHI ≤ 0.25
 *   - Concentrated: HHI > 0.25  (few dominant players)
 *
 * LLM is used ONLY for narrative generation (optional).
 * All numeric computations are deterministic.
 */

import { invokeLLM } from "../../_core/llm";

// ─── Types ───────────────────────────────────────────────────────

export interface CompetitorProject {
  developerId: string;
  developerName: string;
  projectName: string;
  totalUnits: number;
  pricePerSqft?: number;
  completionDate?: Date;
  location?: string;
  grade: "A" | "B" | "C";
  sourceId: string;
}

export interface DeveloperShare {
  developerId: string;
  developerName: string;
  projectCount: number;
  totalUnits: number;
  marketShareByUnits: number; // 0-1
  marketShareByProjects: number; // 0-1
  avgPricePerSqft: number | null;
  priceRange: { min: number; max: number } | null;
  threatLevel: "high" | "medium" | "low";
}

export type MarketConcentration = "fragmented" | "moderate" | "concentrated";

export interface CompetitorLandscapeResult {
  totalProjects: number;
  totalUnits: number;
  totalDevelopers: number;
  hhi: number; // 0-1
  concentration: MarketConcentration;
  concentrationLabel: string;
  developers: DeveloperShare[];
  topDevelopers: DeveloperShare[]; // top 5 by market share
  priceDistribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
  } | null;
  confidence: "high" | "medium" | "low" | "insufficient";
  narrative: string | null;
}

// ─── Named Constants ─────────────────────────────────────────────

const HHI_FRAGMENTED_THRESHOLD = 0.15;
const HHI_CONCENTRATED_THRESHOLD = 0.25;

const CONCENTRATION_LABELS: Record<MarketConcentration, string> = {
  fragmented: "Fragmented Market",
  moderate: "Moderately Concentrated",
  concentrated: "Highly Concentrated",
};

// Threat level thresholds (by unit market share)
const THREAT_HIGH_SHARE = 0.15; // >15% market share
const THREAT_MEDIUM_SHARE = 0.08; // >8% market share

// Confidence thresholds
const CONFIDENCE_HIGH_MIN_PROJECTS = 15;
const CONFIDENCE_HIGH_MIN_DEVELOPERS = 5;
const CONFIDENCE_MEDIUM_MIN_PROJECTS = 8;
const CONFIDENCE_LOW_MIN_PROJECTS = 3;

// ─── HHI Computation ─────────────────────────────────────────────

/**
 * Compute the Herfindahl-Hirschman Index from market shares.
 * HHI = sum of squared market shares (each as 0-1).
 * Range: 1/N (perfect competition) to 1.0 (monopoly).
 */
export function computeHHI(marketShares: number[]): number {
  if (marketShares.length === 0) return 0;
  const hhi = marketShares.reduce((sum, share) => sum + share * share, 0);
  return Math.round(hhi * 10000) / 10000;
}

/**
 * Classify market concentration from HHI value.
 */
export function classifyConcentration(hhi: number): MarketConcentration {
  if (hhi < HHI_FRAGMENTED_THRESHOLD) return "fragmented";
  if (hhi <= HHI_CONCENTRATED_THRESHOLD) return "moderate";
  return "concentrated";
}

// ─── Developer Analysis ──────────────────────────────────────────

function computeDeveloperShares(projects: CompetitorProject[]): DeveloperShare[] {
  const totalUnits = projects.reduce((sum, p) => sum + p.totalUnits, 0);
  const totalProjects = projects.length;

  // Group by developer
  const devMap = new Map<string, CompetitorProject[]>();
  for (const p of projects) {
    const key = p.developerId;
    if (!devMap.has(key)) devMap.set(key, []);
    devMap.get(key)!.push(p);
  }

  const developers: DeveloperShare[] = [];
  for (const [devId, devProjects] of Array.from(devMap.entries())) {
    const devUnits = devProjects.reduce((sum, p) => sum + p.totalUnits, 0);
    const unitShare = totalUnits > 0 ? devUnits / totalUnits : 0;
    const projectShare = totalProjects > 0 ? devProjects.length / totalProjects : 0;

    const prices = devProjects
      .filter((p) => p.pricePerSqft !== undefined && p.pricePerSqft > 0)
      .map((p) => p.pricePerSqft!);

    const avgPrice = prices.length > 0
      ? Math.round((prices.reduce((s, v) => s + v, 0) / prices.length) * 100) / 100
      : null;

    const priceRange = prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;

    // Threat level based on unit market share
    let threatLevel: "high" | "medium" | "low" = "low";
    if (unitShare >= THREAT_HIGH_SHARE) threatLevel = "high";
    else if (unitShare >= THREAT_MEDIUM_SHARE) threatLevel = "medium";

    developers.push({
      developerId: devId,
      developerName: devProjects[0].developerName,
      projectCount: devProjects.length,
      totalUnits: devUnits,
      marketShareByUnits: Math.round(unitShare * 10000) / 10000,
      marketShareByProjects: Math.round(projectShare * 10000) / 10000,
      avgPricePerSqft: avgPrice,
      priceRange,
      threatLevel,
    });
  }

  // Sort by market share descending
  developers.sort((a, b) => b.marketShareByUnits - a.marketShareByUnits);
  return developers;
}

// ─── Confidence Assessment ───────────────────────────────────────

function assessConfidence(
  totalProjects: number,
  totalDevelopers: number
): "high" | "medium" | "low" | "insufficient" {
  if (totalProjects >= CONFIDENCE_HIGH_MIN_PROJECTS && totalDevelopers >= CONFIDENCE_HIGH_MIN_DEVELOPERS) {
    return "high";
  }
  if (totalProjects >= CONFIDENCE_MEDIUM_MIN_PROJECTS) {
    return "medium";
  }
  if (totalProjects >= CONFIDENCE_LOW_MIN_PROJECTS) {
    return "low";
  }
  return "insufficient";
}

// ─── Price Distribution ──────────────────────────────────────────

function computePriceDistribution(projects: CompetitorProject[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
} | null {
  const prices = projects
    .filter((p) => p.pricePerSqft !== undefined && p.pricePerSqft > 0)
    .map((p) => p.pricePerSqft!)
    .sort((a, b) => a - b);

  if (prices.length === 0) return null;

  const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid];

  return {
    min: Math.round(prices[0] * 100) / 100,
    max: Math.round(prices[prices.length - 1] * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
  };
}

// ─── Narrative Generation ────────────────────────────────────────

async function generateNarrative(result: Omit<CompetitorLandscapeResult, "narrative">): Promise<string | null> {
  if (result.totalProjects < 3) return null;

  const topDevNames = result.topDevelopers.map((d) => d.developerName).join(", ");
  const prompt = `You are a UAE real estate market analyst. Generate a 3-sentence competitive landscape summary.

Data:
- Total projects: ${result.totalProjects}
- Total developers: ${result.totalDevelopers}
- Total units: ${result.totalUnits}
- HHI: ${result.hhi} (${result.concentrationLabel})
- Top developers: ${topDevNames}
- Top developer market shares: ${result.topDevelopers.map((d) => `${d.developerName}: ${(d.marketShareByUnits * 100).toFixed(1)}%`).join(", ")}
${result.priceDistribution ? `- Price range: AED ${result.priceDistribution.min} - ${result.priceDistribution.max}/sqft (median: AED ${result.priceDistribution.median}/sqft)` : ""}

Rules:
1. First sentence: overall market concentration assessment
2. Second sentence: identify the dominant players and their positioning
3. Third sentence: strategic implication for new market entrants
4. Use specific numbers from the data
5. Maximum 3 sentences total`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a concise UAE real estate market analyst. Output exactly 3 sentences." },
        { role: "user", content: prompt },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch {
    return null;
  }
}

// ─── Main Entry Point ────────────────────────────────────────────

export interface AnalyseOptions {
  generateNarrative?: boolean;
}

/**
 * Analyse the competitive landscape from competitor project data.
 */
export async function analyseCompetitorLandscape(
  projects: CompetitorProject[],
  options: AnalyseOptions = {}
): Promise<CompetitorLandscapeResult> {
  const { generateNarrative: shouldNarrate = true } = options;

  const developers = computeDeveloperShares(projects);
  const marketShares = developers.map((d) => d.marketShareByUnits);
  const hhi = computeHHI(marketShares);
  const concentration = classifyConcentration(hhi);
  const totalUnits = projects.reduce((sum, p) => sum + p.totalUnits, 0);
  const priceDistribution = computePriceDistribution(projects);
  const confidence = assessConfidence(projects.length, developers.length);
  const topDevelopers = developers.slice(0, 5);

  const baseResult = {
    totalProjects: projects.length,
    totalUnits,
    totalDevelopers: developers.length,
    hhi,
    concentration,
    concentrationLabel: CONCENTRATION_LABELS[concentration],
    developers,
    topDevelopers,
    priceDistribution,
    confidence,
  };

  let narrative: string | null = null;
  if (shouldNarrate && projects.length >= 3) {
    narrative = await generateNarrative(baseResult);
  }

  return { ...baseResult, narrative };
}
