/**
 * MIYAR Portfolio Router — Phase C
 * Full CRUD for named portfolios with aggregation analytics.
 */
import { z } from "zod";
import { router, orgProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
    portfolios,
    portfolioProjects,
    projects,
    scoreMatrices,
    projectIntelligence,
    platformAlerts,
} from "../../drizzle/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { deliverAlert } from "../engines/autonomous/alert-delivery";
import {
    computeDistributions,
    computeComplianceHeatmap,
    detectFailurePatterns,
    computeImprovementLevers,
    type PortfolioProject,
} from "../engines/portfolio";
import {
    generatePortfolioReportHTML,
    type PortfolioPDFInput,
} from "../engines/pdf-report";

export const portfolioRouter = router({
    // ─── List all portfolios for current org ──────────────────────────
    list: orgProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];

        const rows = await db
            .select()
            .from(portfolios)
            .where(eq(portfolios.organizationId, ctx.orgId))
            .orderBy(desc(portfolios.updatedAt));

        // Enrich with project count + avg score
        const result = [];
        for (const p of rows) {
            const links = await db
                .select({ projectId: portfolioProjects.projectId })
                .from(portfolioProjects)
                .where(eq(portfolioProjects.portfolioId, p.id));

            let avgComposite = 0;
            let avgRisk = 0;
            let scoredCount = 0;

            if (links.length > 0) {
                const projectIds = links.map((l: any) => l.projectId);
                const scores = await db
                    .select()
                    .from(scoreMatrices)
                    .where(inArray(scoreMatrices.projectId, projectIds))
                    .orderBy(desc(scoreMatrices.computedAt));

                // Get latest score per project
                const latestByProject = new Map<number, (typeof scores)[0]>();
                for (const s of scores) {
                    if (!latestByProject.has(s.projectId)) {
                        latestByProject.set(s.projectId, s);
                    }
                }

                for (const s of Array.from(latestByProject.values())) {
                    avgComposite += Number(s.compositeScore);
                    avgRisk += Number(s.riskScore);
                    scoredCount++;
                }

                if (scoredCount > 0) {
                    avgComposite = Math.round((avgComposite / scoredCount) * 10) / 10;
                    avgRisk = Math.round((avgRisk / scoredCount) * 10) / 10;
                }
            }

            result.push({
                ...p,
                projectCount: links.length,
                scoredCount,
                avgComposite,
                avgRisk,
            });
        }

        return result;
    }),

    // ─── Get portfolio by ID with full details ────────────────────────
    getById: orgProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) return null;

            const [portfolio] = await db
                .select()
                .from(portfolios)
                .where(
                    and(
                        eq(portfolios.id, input.id),
                        eq(portfolios.organizationId, ctx.orgId)
                    )
                );

            if (!portfolio) return null;

            // Get linked projects
            const links = await db
                .select()
                .from(portfolioProjects)
                .where(eq(portfolioProjects.portfolioId, input.id));

            if (links.length === 0) {
                return {
                    ...portfolio,
                    projects: [],
                    analytics: null,
                };
            }

            const projectIds = links.map((l: any) => l.projectId);
            const projectList = await db
                .select()
                .from(projects)
                .where(inArray(projects.id, projectIds));

            // Get scores
            const allScores = await db
                .select()
                .from(scoreMatrices)
                .where(inArray(scoreMatrices.projectId, projectIds))
                .orderBy(desc(scoreMatrices.computedAt));

            // Get intelligence
            const allIntel = await db
                .select()
                .from(projectIntelligence)
                .where(inArray(projectIntelligence.projectId, projectIds))
                .orderBy(desc(projectIntelligence.computedAt));

            // Build portfolio items
            const latestScoreByProject = new Map<
                number,
                (typeof allScores)[0]
            >();
            for (const s of allScores) {
                if (!latestScoreByProject.has(s.projectId)) {
                    latestScoreByProject.set(s.projectId, s);
                }
            }

            const intelByProject = new Map<number, (typeof allIntel)[0]>();
            for (const intel of allIntel) {
                if (!intelByProject.has(intel.projectId)) {
                    intelByProject.set(intel.projectId, intel);
                }
            }

            const portfolioItems: PortfolioProject[] = [];
            const projectDetails = [];

            for (const p of projectList) {
                const score = latestScoreByProject.get(p.id);
                const intel = intelByProject.get(p.id);
                const link = links.find((l: { projectId: number; addedAt: Date; note: string | null }) => l.projectId === p.id);

                projectDetails.push({
                    id: p.id,
                    name: p.name,
                    tier: p.mkt01Tier,
                    style: p.des01Style,
                    status: p.status,
                    compositeScore: score ? Number(score.compositeScore) : null,
                    riskScore: score ? Number(score.riskScore) : null,
                    decisionStatus: score?.decisionStatus ?? null,
                    costBand: intel?.costBand ?? null,
                    addedAt: link?.addedAt,
                    note: link?.note,
                });

                if (score) {
                    portfolioItems.push({
                        project: p,
                        scoreMatrix: score,
                        intelligence: intel
                            ? ({
                                costDeltaVsBenchmark: Number(intel.costDeltaVsBenchmark),
                                uniquenessIndex: Number(intel.uniquenessIndex),
                                feasibilityFlags: (intel.feasibilityFlags || []) as any,
                                reworkRiskIndex: Number(intel.reworkRiskIndex),
                                procurementComplexity: Number(intel.procurementComplexity),
                                tierPercentile: Number(intel.tierPercentile),
                                styleFamily: intel.styleFamily || "custom",
                                costBand: intel.costBand || "market_mid",
                            } as any)
                            : undefined,
                    });
                }
            }

            // Compute analytics
            const analytics =
                portfolioItems.length > 0
                    ? {
                        totalProjects: projectList.length,
                        scoredProjects: portfolioItems.length,
                        avgComposite:
                            Math.round(
                                (portfolioItems.reduce(
                                    (sum, p) => sum + Number(p.scoreMatrix.compositeScore),
                                    0
                                ) /
                                    portfolioItems.length) *
                                10
                            ) / 10,
                        avgRisk:
                            Math.round(
                                (portfolioItems.reduce(
                                    (sum, p) => sum + Number(p.scoreMatrix.riskScore),
                                    0
                                ) /
                                    portfolioItems.length) *
                                10
                            ) / 10,
                        distributions: computeDistributions(portfolioItems),
                        complianceHeatmap: computeComplianceHeatmap(portfolioItems),
                        failurePatterns: detectFailurePatterns(portfolioItems),
                        improvementLevers: computeImprovementLevers(portfolioItems),
                    }
                    : null;

            return {
                ...portfolio,
                projects: projectDetails,
                analytics,
            };
        }),

    // ─── Create portfolio ─────────────────────────────────────────────
    create: orgProcedure
        .input(
            z.object({
                name: z.string().min(1).max(255),
                description: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database error");

            const [result] = await db.insert(portfolios).values({
                name: input.name,
                description: input.description ?? null,
                organizationId: ctx.orgId,
                createdBy: ctx.user.id,
            });

            return { id: Number(result.insertId), name: input.name };
        }),

    // ─── Update portfolio ─────────────────────────────────────────────
    update: orgProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().min(1).max(255).optional(),
                description: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database error");

            const [existing] = await db
                .select()
                .from(portfolios)
                .where(
                    and(
                        eq(portfolios.id, input.id),
                        eq(portfolios.organizationId, ctx.orgId)
                    )
                );

            if (!existing) throw new Error("Portfolio not found");

            const updates: Partial<{ name: string; description: string | null }> = {};
            if (input.name !== undefined) updates.name = input.name;
            if (input.description !== undefined)
                updates.description = input.description;

            await db
                .update(portfolios)
                .set(updates)
                .where(eq(portfolios.id, input.id));

            return { success: true };
        }),

    // ─── Delete portfolio ─────────────────────────────────────────────
    delete: orgProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database error");

            const [existing] = await db
                .select()
                .from(portfolios)
                .where(
                    and(
                        eq(portfolios.id, input.id),
                        eq(portfolios.organizationId, ctx.orgId)
                    )
                );

            if (!existing) throw new Error("Portfolio not found");

            // Remove all project links first
            await db
                .delete(portfolioProjects)
                .where(eq(portfolioProjects.portfolioId, input.id));

            // Delete portfolio
            await db.delete(portfolios).where(eq(portfolios.id, input.id));

            return { success: true };
        }),

    // ─── Add project to portfolio ─────────────────────────────────────
    addProject: orgProcedure
        .input(
            z.object({
                portfolioId: z.number(),
                projectId: z.number(),
                note: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database error");

            // Verify portfolio belongs to org
            const [portfolio] = await db
                .select()
                .from(portfolios)
                .where(
                    and(
                        eq(portfolios.id, input.portfolioId),
                        eq(portfolios.organizationId, ctx.orgId)
                    )
                );
            if (!portfolio) throw new Error("Portfolio not found");

            // Verify project belongs to org
            const [project] = await db
                .select()
                .from(projects)
                .where(eq(projects.id, input.projectId));
            if (!project || project.orgId !== ctx.orgId) {
                throw new Error("Project not found");
            }

            // Check if already linked
            const existing = await db
                .select()
                .from(portfolioProjects)
                .where(
                    and(
                        eq(portfolioProjects.portfolioId, input.portfolioId),
                        eq(portfolioProjects.projectId, input.projectId)
                    )
                );

            if (existing.length > 0) {
                return { success: true, message: "Project already in portfolio" };
            }

            await db.insert(portfolioProjects).values({
                portfolioId: input.portfolioId,
                projectId: input.projectId,
                note: input.note ?? null,
            });

            return { success: true };
        }),

    // ─── Remove project from portfolio ────────────────────────────────
    removeProject: orgProcedure
        .input(
            z.object({
                portfolioId: z.number(),
                projectId: z.number(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database error");

            // Verify portfolio belongs to org
            const [portfolio] = await db
                .select()
                .from(portfolios)
                .where(
                    and(
                        eq(portfolios.id, input.portfolioId),
                        eq(portfolios.organizationId, ctx.orgId)
                    )
                );
            if (!portfolio) throw new Error("Portfolio not found");

            await db
                .delete(portfolioProjects)
                .where(
                    and(
                        eq(portfolioProjects.portfolioId, input.portfolioId),
                        eq(portfolioProjects.projectId, input.projectId)
                    )
                );

            return { success: true };
        }),

    // ─── Available projects (not in this portfolio) ───────────────────
    availableProjects: orgProcedure
        .input(z.object({ portfolioId: z.number() }))
        .query(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) return [];

            // Get all org projects
            const allProjects = await db
                .select()
                .from(projects)
                .where(eq(projects.orgId, ctx.orgId));

            // Get linked project IDs
            const linked = await db
                .select({ projectId: portfolioProjects.projectId })
                .from(portfolioProjects)
                .where(eq(portfolioProjects.portfolioId, input.portfolioId));

            const linkedIds = new Set(linked.map((l: { projectId: number }) => l.projectId));

            return allProjects
                .filter((p: any) => !linkedIds.has(p.id))
                .map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    tier: p.mkt01Tier,
                    style: p.des01Style,
                    status: p.status,
                }));
        }),

    // ─── Generate PDF Report ────────────────────────────────────
    generateReport: orgProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database unavailable");

            // Fetch portfolio
            const [portfolio] = await db
                .select()
                .from(portfolios)
                .where(
                    and(
                        eq(portfolios.id, input.id),
                        eq(portfolios.organizationId, ctx.orgId)
                    )
                );
            if (!portfolio) throw new Error("Portfolio not found");

            // Fetch linked projects
            const links = await db
                .select()
                .from(portfolioProjects)
                .where(eq(portfolioProjects.portfolioId, input.id));

            if (links.length === 0) {
                throw new Error("Portfolio has no projects — add projects before generating a report.");
            }

            const pIds = links.map((l: any) => l.projectId);

            const projectList = await db
                .select()
                .from(projects)
                .where(inArray(projects.id, pIds));

            // Fetch latest scores
            const allScores = await db
                .select()
                .from(scoreMatrices)
                .where(inArray(scoreMatrices.projectId, pIds))
                .orderBy(desc(scoreMatrices.computedAt));

            // Fetch intelligence
            const allIntel = await db
                .select()
                .from(projectIntelligence)
                .where(inArray(projectIntelligence.projectId, pIds))
                .orderBy(desc(projectIntelligence.computedAt));

            // Build maps
            const latestScoreByProject = new Map<number, (typeof allScores)[0]>();
            for (const s of allScores) {
                if (!latestScoreByProject.has(s.projectId)) {
                    latestScoreByProject.set(s.projectId, s);
                }
            }
            const intelByProject = new Map<number, (typeof allIntel)[0]>();
            for (const intel of allIntel) {
                if (!intelByProject.has(intel.projectId)) {
                    intelByProject.set(intel.projectId, intel);
                }
            }

            // Build PortfolioProject[] for analytics engine
            const portfolioItems: PortfolioProject[] = [];
            const projectDetails: Array<{
                name: string;
                tier?: string;
                style?: string;
                compositeScore: number | null;
                riskScore: number | null;
                decisionStatus: string | null;
            }> = [];

            for (const p of projectList) {
                const score = latestScoreByProject.get(p.id);
                const intel = intelByProject.get(p.id);

                projectDetails.push({
                    name: p.name,
                    tier: p.mkt01Tier || undefined,
                    style: p.des01Style || undefined,
                    compositeScore: score ? Number(score.compositeScore) : null,
                    riskScore: score ? Number(score.riskScore) : null,
                    decisionStatus: score?.decisionStatus ?? null,
                });

                if (score) {
                    portfolioItems.push({
                        project: p,
                        scoreMatrix: score,
                        intelligence: intel
                            ? ({
                                costDeltaVsBenchmark: Number(intel.costDeltaVsBenchmark),
                                uniquenessIndex: Number(intel.uniquenessIndex),
                                feasibilityFlags: (intel.feasibilityFlags || []) as any,
                                reworkRiskIndex: Number(intel.reworkRiskIndex),
                                procurementComplexity: Number(intel.procurementComplexity),
                                tierPercentile: Number(intel.tierPercentile),
                                styleFamily: intel.styleFamily || "custom",
                                costBand: intel.costBand || "market_mid",
                            } as any)
                            : undefined,
                    });
                }
            }

            // Compute analytics
            const distributions = computeDistributions(portfolioItems);
            const rawHeatmap = computeComplianceHeatmap(portfolioItems);
            const failurePatterns = detectFailurePatterns(portfolioItems);
            const improvementLevers = computeImprovementLevers(portfolioItems);

            // Convert ComplianceCell[] to heatmap format for PDF
            const heatmapByTier = new Map<string, Record<string, { avg: number; count: number }>>();
            for (const cell of rawHeatmap) {
                if (!heatmapByTier.has(cell.row)) {
                    heatmapByTier.set(cell.row, {});
                }
                heatmapByTier.get(cell.row)![cell.col] = {
                    avg: Math.round(cell.score * 10) / 10,
                    count: cell.projectCount,
                };
            }
            const complianceHeatmap = Array.from(heatmapByTier.entries()).map(
                ([tier, dimensions]) => ({ tier, dimensions })
            );

            const scored = portfolioItems;
            const avgComposite = scored.length > 0
                ? Math.round(
                    scored.reduce((s, p) => s + Number(p.scoreMatrix.compositeScore), 0) / scored.length
                )
                : 0;
            const avgRisk = scored.length > 0
                ? Math.round(
                    scored.reduce((s, p) => s + Number(p.scoreMatrix.riskScore), 0) / scored.length
                )
                : 0;

            const pdfInput: PortfolioPDFInput = {
                portfolioName: portfolio.name,
                portfolioId: portfolio.id,
                description: portfolio.description || undefined,
                totalProjects: projectList.length,
                scoredCount: scored.length,
                avgComposite,
                avgRisk,
                projects: projectDetails,
                distributions,
                failurePatterns,
                improvementLevers,
                complianceHeatmap,
            };

            const html = generatePortfolioReportHTML(pdfInput);
            return { html, portfolioName: portfolio.name };
        }),

    // ─── Check Portfolio Alerts ──────────────────────────────────
    checkAlerts: orgProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database unavailable");

            // Fetch portfolio
            const [portfolio] = await db
                .select()
                .from(portfolios)
                .where(
                    and(
                        eq(portfolios.id, input.id),
                        eq(portfolios.organizationId, ctx.orgId)
                    )
                );
            if (!portfolio) throw new Error("Portfolio not found");

            // Fetch linked projects
            const links = await db
                .select()
                .from(portfolioProjects)
                .where(eq(portfolioProjects.portfolioId, input.id));

            if (links.length === 0) return { alerts: [], message: "No projects in portfolio" };

            const pIds = links.map((l: any) => l.projectId);
            const projectList = await db
                .select()
                .from(projects)
                .where(inArray(projects.id, pIds));

            // Fetch latest scores
            const allScores = await db
                .select()
                .from(scoreMatrices)
                .where(inArray(scoreMatrices.projectId, pIds))
                .orderBy(desc(scoreMatrices.computedAt));

            const latestScoreByProject = new Map<number, (typeof allScores)[0]>();
            for (const s of allScores) {
                if (!latestScoreByProject.has(s.projectId)) {
                    latestScoreByProject.set(s.projectId, s);
                }
            }

            // Fetch intelligence for analytics
            const allIntel = await db
                .select()
                .from(projectIntelligence)
                .where(inArray(projectIntelligence.projectId, pIds))
                .orderBy(desc(projectIntelligence.computedAt));

            const intelByProject = new Map<number, (typeof allIntel)[0]>();
            for (const intel of allIntel) {
                if (!intelByProject.has(intel.projectId)) {
                    intelByProject.set(intel.projectId, intel);
                }
            }

            // Build PortfolioProject[] for analytics
            const portfolioItems: PortfolioProject[] = [];
            for (const p of projectList) {
                const score = latestScoreByProject.get(p.id);
                const intel = intelByProject.get(p.id);
                if (score) {
                    portfolioItems.push({
                        project: p,
                        scoreMatrix: score,
                        intelligence: intel
                            ? ({
                                costDeltaVsBenchmark: Number(intel.costDeltaVsBenchmark),
                                uniquenessIndex: Number(intel.uniquenessIndex),
                                feasibilityFlags: (intel.feasibilityFlags || []) as any,
                                reworkRiskIndex: Number(intel.reworkRiskIndex),
                                procurementComplexity: Number(intel.procurementComplexity),
                                tierPercentile: Number(intel.tierPercentile),
                                styleFamily: intel.styleFamily || "custom",
                                costBand: intel.costBand || "market_mid",
                            } as any)
                            : undefined,
                    });
                }
            }

            if (portfolioItems.length === 0) return { alerts: [], message: "No scored projects" };

            // Compute metrics
            const avgComposite = Math.round(
                portfolioItems.reduce((s, p) => s + Number(p.scoreMatrix.compositeScore), 0) / portfolioItems.length
            );
            const avgRisk = Math.round(
                portfolioItems.reduce((s, p) => s + Number(p.scoreMatrix.riskScore), 0) / portfolioItems.length
            );
            const noGoCount = portfolioItems.filter(
                (p) => p.scoreMatrix.decisionStatus === "not_validated"
            ).length;
            const failurePatterns = detectFailurePatterns(portfolioItems);

            // Build alert candidates
            type AlertCandidate = typeof platformAlerts.$inferInsert;
            const candidates: AlertCandidate[] = [];

            // Rule 1: Portfolio avg composite < 55 → high severity risk alert
            if (avgComposite < 55) {
                candidates.push({
                    alertType: "portfolio_risk",
                    severity: avgComposite < 40 ? "critical" : "high",
                    title: `Portfolio "${portfolio.name}" — Low Average Score`,
                    body: `Portfolio average composite score is ${avgComposite}/100 across ${portfolioItems.length} projects. This indicates systemic design feasibility concerns.`,
                    affectedProjectIds: pIds,
                    affectedCategories: [],
                    triggerData: { portfolioId: portfolio.id, avgComposite, avgRisk } as any,
                    suggestedAction: "Review underperforming projects and consider replacing or redesigning low-scoring components.",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                });
            }

            // Rule 2: Portfolio avg risk > 65 → high severity risk alert
            if (avgRisk > 65) {
                candidates.push({
                    alertType: "portfolio_risk",
                    severity: avgRisk > 80 ? "critical" : "high",
                    title: `Portfolio "${portfolio.name}" — Elevated Risk`,
                    body: `Portfolio average risk score is ${avgRisk}/100. ${noGoCount} project(s) have NO_GO decisions.`,
                    affectedProjectIds: pIds,
                    affectedCategories: [],
                    triggerData: { portfolioId: portfolio.id, avgRisk, noGoCount } as any,
                    suggestedAction: "Prioritize risk mitigation for the highest-risk projects. Consider portfolio rebalancing.",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                });
            }

            // Rule 3: >50% of projects are NO_GO → critical alert
            if (noGoCount > portfolioItems.length / 2) {
                candidates.push({
                    alertType: "portfolio_risk",
                    severity: "critical",
                    title: `Portfolio "${portfolio.name}" — Majority NO_GO`,
                    body: `${noGoCount} out of ${portfolioItems.length} scored projects have NO_GO decisions. Portfolio viability is severely compromised.`,
                    affectedProjectIds: pIds,
                    affectedCategories: [],
                    triggerData: { portfolioId: portfolio.id, noGoCount, total: portfolioItems.length } as any,
                    suggestedAction: "Conduct an emergency portfolio review. Consider replacing failing projects or fundamentally redesigning the approach.",
                    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                });
            }

            // Rule 4: High-severity failure patterns → individual alerts
            for (const fp of failurePatterns.filter((f) => f.severity === "high")) {
                candidates.push({
                    alertType: "portfolio_failure_pattern",
                    severity: "high",
                    title: `Portfolio "${portfolio.name}" — ${fp.pattern}`,
                    body: `${fp.description} (affects ${fp.frequency} project(s))`,
                    affectedProjectIds: pIds,
                    affectedCategories: [],
                    triggerData: { portfolioId: portfolio.id, pattern: fp } as any,
                    suggestedAction: "Address the root cause of this recurring failure pattern across the portfolio.",
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                });
            }

            // Deduplicate + insert
            const inserted: Array<AlertCandidate & { id?: number }> = [];
            for (const alert of candidates) {
                const existing = await db
                    .select()
                    .from(platformAlerts)
                    .where(
                        and(
                            eq(platformAlerts.alertType, alert.alertType!),
                            eq(platformAlerts.status, "active")
                        )
                    );

                const isDuplicate = existing.some(
                    (e: any) =>
                        e.title === alert.title &&
                        JSON.stringify(e.affectedProjectIds) === JSON.stringify(alert.affectedProjectIds)
                );

                if (!isDuplicate) {
                    const [result] = await db.insert(platformAlerts).values(alert);
                    const alertWithId = { ...alert, id: (result as any).insertId };
                    inserted.push(alertWithId);

                    // Attempt delivery for high/critical
                    deliverAlert(alertWithId as any).catch((e) =>
                        console.error("[PortfolioAlerts] Delivery failed:", alert.title, e)
                    );
                }
            }

            return {
                alerts: inserted.map((a) => ({
                    id: a.id,
                    type: a.alertType,
                    severity: a.severity,
                    title: a.title,
                    body: a.body,
                })),
                message: inserted.length > 0
                    ? `${inserted.length} new alert(s) generated`
                    : "Portfolio health is within acceptable thresholds — no new alerts.",
            };
        }),
});
