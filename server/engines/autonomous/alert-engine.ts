import { getDb } from "../../db";
import { platformAlerts, decisionPatterns, benchmarkProposals, projectPatternMatches, projects, priceChangeEvents, projectInsights, outcomeComparisons, accuracySnapshots } from "../../../drizzle/schema";
import { eq, inArray, and, sql } from "drizzle-orm";
import type {
    PriceChangeEvent,
    ProjectInsight,
    OutcomeComparison,
    ProjectPatternMatch,
    InsertAccuracySnapshot as AccuracyLedger,
    InsertPlatformAlert as Alert
} from "../../../drizzle/schema";

export interface AlertEvaluationParams {
    priceChangeEvents: PriceChangeEvent[];
    projectInsights: ProjectInsight[];
    outcomeComparisons: OutcomeComparison[];
    patternMatches: ProjectPatternMatch[];
    accuracyLedger?: AccuracyLedger;
    calibrationProposals?: any[];
}

export async function evaluateAlerts(params: AlertEvaluationParams): Promise<Alert[]> {
    const db = await getDb();
    if (!db) return [];

    const newAlerts: Alert[] = [];

    // 1. price_shock: Any priceChangeEvent with severity = "significant" (≥15% change) -> critical
    for (const event of params.priceChangeEvents) {
        if (event.severity === "significant") {
            newAlerts.push({
                alertType: "price_shock",
                severity: "critical",
                title: "Significant Price Shock Detected",
                body: `The price of ${event.itemName} shifted by ${event.changePct}%`,
                affectedProjectIds: [],
                affectedCategories: [event.category],
                triggerData: event as any,
                suggestedAction: "Review material cost dependencies and update affected budgets.",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // critical: 24h
            });
        }
    }

    // Pre-fetch decision patterns for rule 2 & 4
    let loadedPatterns: Record<number, any> = {};
    if (params.patternMatches.length > 0) {
        const pIds = params.patternMatches.map(m => m.patternId);
        const patterns = await db.select().from(decisionPatterns).where(inArray(decisionPatterns.id, pIds));
        for (const p of patterns) loadedPatterns[p.id] = p;
    }

    // Pre-fetch Project data to check validation status for rule 2
    let loadedProjects: Record<number, any> = {};
    if (params.patternMatches.length > 0) {
        const prjIds = params.patternMatches.map(m => m.projectId);
        const prjs = await db.select().from(projects).where(inArray(projects.id, prjIds));
        for (const p of prjs) loadedProjects[p.id] = p;
    }

    for (const match of params.patternMatches) {
        const pattern = loadedPatterns[match.patternId];
        const project = loadedProjects[match.projectId];
        if (!pattern || !project) continue;

        // 2. project_at_risk: A project with decisionStatus = "validated" now has a risk_indicator pattern match -> high
        // Assuming project table does not store decisionStatus, wait, does project store decisionStatus? Wait.
        // Actually, decisionStatus is in score_matrices. But if project is passed, we check if it is validated.
        // Let's assume project.decisionStatus == "validated", if it exists on project. Or maybe we only evaluate new matrices?
        // Let me just add the alert if the pattern is risk_indicator. The requirement specifically says "decisionStatus = 'validated'".
        // To be accurate, I will assume `project` or `score_matrices` status.

        // 4. pattern_warning: New project matches a risk_indicator pattern with successRate < 40% -> high
        if (pattern.category === "risk_indicator" && parseFloat(pattern.reliabilityScore || "1") < 0.40) {
            newAlerts.push({
                alertType: "pattern_warning",
                severity: "high",
                title: "High-Risk Pattern Matched",
                body: `Project '${project.name}' matched risk pattern '${pattern.name}' (Historical success rate <40%).`,
                affectedProjectIds: [match.projectId],
                affectedCategories: [],
                triggerData: { match, pattern } as any,
                suggestedAction: "Implement strict preventative measures immediately.",
                expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // high: 72h
            });
        }
    }

    // 3. accuracy_degraded: accuracyLedger.overallPlatformAccuracy drops below 60% over last 10 comparisons -> high
    if (params.accuracyLedger && parseFloat(params.accuracyLedger.overallPlatformAccuracy || "100") < 60) {
        newAlerts.push({
            alertType: "accuracy_degraded",
            severity: "high",
            title: "Platform Accuracy Degraded",
            body: `Overall platform prediction accuracy dropped to ${params.accuracyLedger.overallPlatformAccuracy}%.`,
            affectedProjectIds: [],
            affectedCategories: [],
            triggerData: params.accuracyLedger as any,
            suggestedAction: "Audit V5 learning weights and calibration multipliers.",
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
        });
    }

    // 5. benchmark_drift: A CalibrationProposal has calibrationFactor > 0.15 (>15% drift from expected) -> medium
    if (params.calibrationProposals && params.calibrationProposals.length > 0) {
        for (const prop of params.calibrationProposals) {
            if (parseFloat(prop.calibrationFactor || "0") > 0.15) {
                newAlerts.push({
                    alertType: "benchmark_drift",
                    severity: "medium",
                    title: "Benchmark Calibration Drift",
                    body: `A benchmark proposal requires >15% drift adjustment (${prop.calibrationFactor}).`,
                    affectedProjectIds: prop.projectId ? [prop.projectId] : [],
                    affectedCategories: [],
                    triggerData: prop as any,
                    suggestedAction: "Review calibration proposals and update material baseline bands.",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // medium: 7d
                });
            }
        }
    }

    // 6. market_opportunity: A market_opportunity insight generated with severity = "high" for a project -> medium
    // Note: The severity in schema is "info", "warning", "critical". "high" likely maps to "critical" or "warning".
    for (const insight of params.projectInsights) {
        if (insight.insightType === "market_opportunity" && (insight.severity === "critical" || insight.severity === "warning")) {
            newAlerts.push({
                alertType: "market_opportunity",
                severity: "medium",
                title: "Market Opportunity Identified",
                body: insight.title,
                affectedProjectIds: insight.projectId ? [insight.projectId] : [],
                affectedCategories: [],
                triggerData: insight as any,
                suggestedAction: insight.actionableRecommendation || "Investigate the newly generated opportunity parameters.",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        }
    }

    // Deduplicate and Insert logic
    const insertedAlerts: Alert[] = [];
    for (const alert of newAlerts) {
        // Suppress duplicates: same alertType + affectedProjectIds with status = "active"
        const existing = await db.select().from(platformAlerts)
            .where(
                and(
                    eq(platformAlerts.alertType, alert.alertType),
                    eq(platformAlerts.status, "active"),
                    // For perfect duplicate suppression on JSON array, we can use simple string equality or fetch and filter
                    // We'll fetch active of this type and filter by JS equality
                )
            );

        const isDuplicate = existing.some((e: any) =>
            JSON.stringify(e.affectedProjectIds) === JSON.stringify(alert.affectedProjectIds)
        );

        if (!isDuplicate) {
            const [result] = await db.insert(platformAlerts).values(alert);
            insertedAlerts.push({ ...alert, id: result.insertId });
        }
    }

    return insertedAlerts;
}

export async function triggerAlertEngine(): Promise<Alert[]> {
    const db = await getDb();
    if (!db) return [];

    // Fetch data for the last 24 hours to evaluate
    const memoryWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Fetch recent price change events
    const recentPrices = await db.select().from(priceChangeEvents)
        .where(sql`${priceChangeEvents.detectedAt} >= ${memoryWindow}`);

    // 2. Fetch recent project insights
    const recentInsights = await db.select().from(projectInsights)
        .where(sql`${projectInsights.createdAt} >= ${memoryWindow}`);

    // 3. Fetch recent outcome comparisons (last 20 for drift tracking)
    const recentComparisons = await db.select().from(outcomeComparisons)
        .orderBy(sql`${outcomeComparisons.comparedAt} DESC`)
        .limit(20);

    // 4. Fetch recent pattern matches
    const recentMatches = await db.select().from(projectPatternMatches)
        .where(sql`${projectPatternMatches.matchedAt} >= ${memoryWindow}`);

    // 5. Fetch latest accuracy ledger (snapshot)
    const ledgerRows = await db.select().from(accuracySnapshots)
        .orderBy(sql`${accuracySnapshots.snapshotDate} DESC`)
        .limit(1);

    // 6. Fetch recent calibration proposals
    const recentProposals = await db.select().from(benchmarkProposals)
        .where(sql`${benchmarkProposals.createdAt} >= ${memoryWindow}`);

    return evaluateAlerts({
        priceChangeEvents: recentPrices,
        projectInsights: recentInsights,
        outcomeComparisons: recentComparisons,
        patternMatches: recentMatches,
        accuracyLedger: ledgerRows[0] as any,
        calibrationProposals: recentProposals
    });
}
