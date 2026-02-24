/**
 * Design Advisor Router — TRPC endpoints for AI-powered design recommendations
 */

import { z } from "zod";
import { router, orgProcedure } from "../_core/trpc";
import * as db from "../db";
import { generateDesignRecommendations, generateAIDesignBrief } from "../engines/design/ai-design-advisor";
import { buildSpaceProgram } from "../engines/design/space-program";

function projectToInputs(p: any) {
    return {
        ctx01Typology: p.ctx01Typology || "Residential",
        ctx02Scale: p.ctx02Scale || "Medium",
        ctx03Gfa: Number(p.ctx03Gfa || 0),
        ctx04Location: p.ctx04Location || "Secondary",
        ctx05Horizon: p.ctx05Horizon || "12-24m",
        str01BrandClarity: Number(p.str01BrandClarity || 3),
        str02Differentiation: Number(p.str02Differentiation || 3),
        str03BuyerMaturity: Number(p.str03BuyerMaturity || 3),
        mkt01Tier: p.mkt01Tier || "Upper-mid",
        mkt02Competitor: Number(p.mkt02Competitor || 3),
        mkt03Trend: Number(p.mkt03Trend || 3),
        fin01BudgetCap: Number(p.fin01BudgetCap || 0),
        fin02Flexibility: Number(p.fin02Flexibility || 3),
        fin03ShockTolerance: Number(p.fin03ShockTolerance || 3),
        fin04SalesPremium: Number(p.fin04SalesPremium || 3),
        des01Style: p.des01Style || "Modern",
        des02MaterialLevel: Number(p.des02MaterialLevel || 3),
        des03Complexity: Number(p.des03Complexity || 3),
        des04Experience: Number(p.des04Experience || 3),
        des05Sustainability: Number(p.des05Sustainability || 2),
        exe01SupplyChain: Number(p.exe01SupplyChain || 3),
        exe02Contractor: Number(p.exe02Contractor || 3),
        exe03Approvals: Number(p.exe03Approvals || 2),
        exe04QaMaturity: Number(p.exe04QaMaturity || 3),
        add01SampleKit: !!p.add01SampleKit,
        add02PortfolioMode: !!p.add02PortfolioMode,
        add03DashboardExport: !!p.add03DashboardExport,
    };
}

export const designAdvisorRouter = router({

    // ─── Generate AI Recommendations for All Spaces ─────────────────────────

    generateRecommendations: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project || project.orgId !== ctx.orgId) throw new Error("Project not found");

            const inputs = projectToInputs(project);
            const materials = await db.getMaterialLibrary();

            const recommendations = await generateDesignRecommendations(project, inputs, materials);

            // Persist recommendations
            for (const rec of recommendations) {
                await db.createSpaceRecommendation({
                    projectId: input.projectId,
                    orgId: ctx.orgId,
                    roomId: rec.roomId,
                    roomName: rec.roomName,
                    sqm: String(rec.sqm) as any,
                    styleDirection: rec.styleDirection,
                    colorScheme: rec.colorScheme,
                    materialPackage: rec.materialPackage,
                    budgetAllocation: String(rec.budgetAllocation) as any,
                    budgetBreakdown: rec.budgetBreakdown,
                    aiRationale: rec.aiRationale,
                    specialNotes: rec.specialNotes,
                    kitchenSpec: rec.kitchenSpec || null,
                    bathroomSpec: rec.bathroomSpec || null,
                    alternatives: rec.alternatives,
                });
            }

            return { recommendations, count: recommendations.length };
        }),

    // ─── Get Space Recommendations ──────────────────────────────────────────

    getRecommendations: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            return db.getSpaceRecommendations(input.projectId, ctx.orgId);
        }),

    // ─── Get Single Space ───────────────────────────────────────────────────

    getSpaceRecommendation: orgProcedure
        .input(z.object({ projectId: z.number(), roomId: z.string() }))
        .query(async ({ ctx, input }) => {
            const recs = await db.getSpaceRecommendations(input.projectId, ctx.orgId);
            return recs.find((r: any) => r.roomId === input.roomId) || null;
        }),

    // ─── Get Space Program (Room Breakdown) ─────────────────────────────────

    getSpaceProgram: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project || project.orgId !== ctx.orgId) throw new Error("Project not found");
            return buildSpaceProgram(project);
        }),

    // ─── Generate AI Design Brief ───────────────────────────────────────────

    generateDesignBrief: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project || project.orgId !== ctx.orgId) throw new Error("Project not found");

            const inputs = projectToInputs(project);
            const recs = await db.getSpaceRecommendations(input.projectId, ctx.orgId);

            if (!recs || recs.length === 0) {
                throw new Error("Generate design recommendations first before creating a brief.");
            }

            // Map DB rows back to SpaceRecommendation type
            const recommendations = recs.map((r: any) => ({
                roomId: r.roomId,
                roomName: r.roomName,
                sqm: Number(r.sqm),
                styleDirection: r.styleDirection || "",
                colorScheme: r.colorScheme || "",
                materialPackage: r.materialPackage || [],
                budgetAllocation: Number(r.budgetAllocation),
                budgetBreakdown: r.budgetBreakdown || [],
                aiRationale: r.aiRationale || "",
                specialNotes: r.specialNotes || [],
                alternatives: r.alternatives || [],
                kitchenSpec: r.kitchenSpec || undefined,
                bathroomSpec: r.bathroomSpec || undefined,
            }));

            const brief = await generateAIDesignBrief(project, inputs, recommendations);

            // Persist brief
            await db.createAiDesignBrief({
                projectId: input.projectId,
                orgId: ctx.orgId,
                briefData: brief,
            });

            return brief;
        }),

    // ─── Get Latest Design Brief ────────────────────────────────────────────

    getDesignBrief: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ ctx, input }) => {
            return db.getLatestAiDesignBrief(input.projectId, ctx.orgId);
        }),

    // ─── Standard Design Packages ───────────────────────────────────────────

    getStandardPackages: orgProcedure
        .input(z.object({
            typology: z.string().optional(),
            tier: z.string().optional(),
        }))
        .query(async ({ input }) => {
            return db.getDesignPackages(input.typology, input.tier);
        }),

    // ─── Save as Template ───────────────────────────────────────────────────

    saveAsPackage: orgProcedure
        .input(z.object({
            projectId: z.number(),
            name: z.string(),
            description: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project || project.orgId !== ctx.orgId) throw new Error("Project not found");

            const recs = await db.getSpaceRecommendations(input.projectId, ctx.orgId);

            return db.createDesignPackage({
                orgId: ctx.orgId,
                name: input.name,
                typology: project.ctx01Typology || "Residential",
                tier: project.mkt01Tier || "Upper-mid",
                style: project.des01Style || "Modern",
                description: input.description || null,
                targetBudgetPerSqm: String(Math.round(Number(project.fin01BudgetCap) || 0)) as any,
                rooms: recs,
                isTemplate: true,
            });
        }),
});
