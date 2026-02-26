/**
 * Customer Health Score Engine (Phase G)
 *
 * Computes a composite 0-100 health score from 4 dimensions:
 *   - Engagement (30%): login frequency, actions/week, recency
 *   - Adoption (25%): features used across the platform
 *   - Quality (25%): project scores, bias remediation, evaluation %
 *   - Velocity (20%): project creation rate, growth trend
 *
 * Health Tiers:
 *   85-100: Thriving  |  65-84: Healthy  |  40-64: At Risk  |  0-39: Churning
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HealthMetrics {
    // Engagement inputs
    totalActions: number;          // audit log count (last 30 days)
    daysSinceLastAction: number;
    uniqueActiveDays: number;      // unique days with activity (last 30 days)

    // Adoption inputs
    totalProjects: number;
    evaluatedProjects: number;
    scenariosCreated: number;
    simulationsRun: number;
    biasScansRun: number;
    portfoliosCreated: number;
    reportsGenerated: number;

    // Quality inputs
    avgProjectScore: number;       // average composite score across evaluated projects
    biasAlertsTotal: number;
    biasAlertsDismissed: number;   // dismissed = acknowledged/remediated

    // Velocity inputs
    projectsThisMonth: number;
    projectsLastMonth: number;
    evaluationsThisMonth: number;
    evaluationsLastMonth: number;
}

export interface DimensionScore {
    score: number;     // 0-100
    weight: number;    // fraction
    weighted: number;  // score * weight
    label: string;
    factors: string[];
}

export type HealthTier = "Thriving" | "Healthy" | "At Risk" | "Churning";

export interface HealthScoreResult {
    compositeScore: number;
    tier: HealthTier;
    engagement: DimensionScore;
    adoption: DimensionScore;
    quality: DimensionScore;
    velocity: DimensionScore;
    recommendations: string[];
    metrics: HealthMetrics;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, v));
}

function tierFromScore(score: number): HealthTier {
    if (score >= 85) return "Thriving";
    if (score >= 65) return "Healthy";
    if (score >= 40) return "At Risk";
    return "Churning";
}

// ─── Dimension Scorers ──────────────────────────────────────────────────────

function scoreEngagement(m: HealthMetrics): DimensionScore {
    const factors: string[] = [];

    // Recency: 0 days = 100, 30 days = 0
    const recency = clamp(100 - (m.daysSinceLastAction / 30) * 100);
    factors.push(`Recency: ${Math.round(recency)}/100 (${m.daysSinceLastAction}d ago)`);

    // Active days: 20+ days = 100, 0 = 0
    const activeDays = clamp((m.uniqueActiveDays / 20) * 100);
    factors.push(`Active days: ${Math.round(activeDays)}/100 (${m.uniqueActiveDays}/30d)`);

    // Actions per week (total/4): 50+ = 100
    const actionsPerWeek = m.totalActions / 4;
    const actionScore = clamp((actionsPerWeek / 50) * 100);
    factors.push(`Actions/week: ${Math.round(actionScore)}/100 (${actionsPerWeek.toFixed(0)}/wk)`);

    const score = Math.round(recency * 0.4 + activeDays * 0.35 + actionScore * 0.25);

    return { score, weight: 0.30, weighted: Math.round(score * 0.30), label: "Engagement", factors };
}

function scoreAdoption(m: HealthMetrics): DimensionScore {
    const factors: string[] = [];

    // Feature usage breadth (7 features max)
    const features = [
        m.totalProjects > 0,
        m.evaluatedProjects > 0,
        m.scenariosCreated > 0,
        m.simulationsRun > 0,
        m.biasScansRun > 0,
        m.portfoliosCreated > 0,
        m.reportsGenerated > 0,
    ];
    const usedCount = features.filter(Boolean).length;
    const breadth = clamp((usedCount / 7) * 100);
    factors.push(`Features used: ${usedCount}/7`);

    // Depth: evaluated % of projects
    const evalRate = m.totalProjects > 0
        ? clamp((m.evaluatedProjects / m.totalProjects) * 100)
        : 0;
    factors.push(`Evaluation rate: ${Math.round(evalRate)}%`);

    // Advanced feature usage (simulations + bias scans)
    const advancedScore = clamp(Math.min((m.simulationsRun + m.biasScansRun) * 20, 100));
    factors.push(`Advanced features: ${Math.round(advancedScore)}/100`);

    const score = Math.round(breadth * 0.4 + evalRate * 0.35 + advancedScore * 0.25);

    return { score, weight: 0.25, weighted: Math.round(score * 0.25), label: "Adoption", factors };
}

function scoreQuality(m: HealthMetrics): DimensionScore {
    const factors: string[] = [];

    // Average project score (0-100 already)
    const projScore = clamp(m.avgProjectScore);
    factors.push(`Avg project score: ${Math.round(projScore)}/100`);

    // Bias remediation rate (dismissed / total)
    const biasRate = m.biasAlertsTotal > 0
        ? clamp((m.biasAlertsDismissed / m.biasAlertsTotal) * 100)
        : 100; // no biases = clean
    factors.push(`Bias remediation: ${Math.round(biasRate)}%`);

    // Evaluation coverage
    const coverage = m.totalProjects > 0
        ? clamp((m.evaluatedProjects / m.totalProjects) * 100)
        : 0;
    factors.push(`Evaluation coverage: ${Math.round(coverage)}%`);

    const score = Math.round(projScore * 0.4 + biasRate * 0.3 + coverage * 0.3);

    return { score, weight: 0.25, weighted: Math.round(score * 0.25), label: "Quality", factors };
}

function scoreVelocity(m: HealthMetrics): DimensionScore {
    const factors: string[] = [];

    // Projects this month (5+ = 100)
    const projRate = clamp((m.projectsThisMonth / 5) * 100);
    factors.push(`Projects this month: ${m.projectsThisMonth}`);

    // Growth trend: compare this vs last month
    let growthScore = 50; // neutral if no history
    if (m.projectsLastMonth > 0) {
        const growthRatio = m.projectsThisMonth / m.projectsLastMonth;
        growthScore = clamp(growthRatio * 50); // 2x = 100, 1x = 50, 0x = 0
    } else if (m.projectsThisMonth > 0) {
        growthScore = 80; // new activity from zero
    }
    factors.push(`Growth trend: ${Math.round(growthScore)}/100`);

    // Evaluation velocity
    const evalRate = clamp((m.evaluationsThisMonth / 5) * 100);
    factors.push(`Evaluations this month: ${m.evaluationsThisMonth}`);

    const score = Math.round(projRate * 0.35 + growthScore * 0.35 + evalRate * 0.3);

    return { score, weight: 0.20, weighted: Math.round(score * 0.20), label: "Velocity", factors };
}

// ─── Recommendations ────────────────────────────────────────────────────────

function generateRecommendations(
    m: HealthMetrics,
    eng: DimensionScore,
    adp: DimensionScore,
    qua: DimensionScore,
    vel: DimensionScore,
): string[] {
    const recs: string[] = [];

    if (eng.score < 50) {
        recs.push("📅 Try to use the platform at least 3 times per week to build evaluation habits.");
    }
    if (m.daysSinceLastAction > 14) {
        recs.push("⚠️ You haven't been active for over 2 weeks. Re-engage to keep project data fresh.");
    }
    if (adp.score < 50) {
        if (m.simulationsRun === 0) recs.push("🎲 Run Monte Carlo simulations to understand cost risk distributions.");
        if (m.biasScansRun === 0) recs.push("🧠 Use Bias Insights to detect cognitive biases in your evaluations.");
        if (m.portfoliosCreated === 0) recs.push("📊 Create a portfolio to monitor multiple projects together.");
        if (m.scenariosCreated === 0) recs.push("🔀 Create scenarios to compare design alternatives.");
    }
    if (qua.score < 50) {
        if (m.avgProjectScore < 50) recs.push("📈 Review low-scoring projects and address flagged weaknesses.");
        if (m.biasAlertsTotal > m.biasAlertsDismissed * 2) recs.push("🔍 Address outstanding bias alerts to improve decision quality.");
    }
    if (vel.score < 40) {
        recs.push("🚀 Aim to evaluate at least 2 projects per month to maintain momentum.");
    }
    if (m.totalProjects > 0 && m.evaluatedProjects === 0) {
        recs.push("✅ You have projects but none evaluated. Run your first evaluation to unlock insights.");
    }

    if (recs.length === 0) {
        recs.push("🌟 Great work — keep up the momentum!");
    }

    return recs.slice(0, 5);
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export function calculateHealthScore(metrics: HealthMetrics): HealthScoreResult {
    const engagement = scoreEngagement(metrics);
    const adoption = scoreAdoption(metrics);
    const quality = scoreQuality(metrics);
    const velocity = scoreVelocity(metrics);

    const compositeScore = Math.round(
        engagement.weighted + adoption.weighted + quality.weighted + velocity.weighted
    );

    const tier = tierFromScore(compositeScore);
    const recommendations = generateRecommendations(metrics, engagement, adoption, quality, velocity);

    return {
        compositeScore,
        tier,
        engagement,
        adoption,
        quality,
        velocity,
        recommendations,
        metrics,
    };
}
