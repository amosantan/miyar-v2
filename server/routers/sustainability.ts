/**
 * Sustainability Router (Phase H)
 * Endpoints for digital twin computation and retrieval.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { digitalTwinModels } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { computeDigitalTwin, type MaterialType } from "../engines/sustainability/digital-twin";

const materialEnum = z.enum([
    "concrete", "steel", "glass", "aluminum",
    "timber", "stone", "gypsum", "insulation", "ceramic",
]);

export const sustainabilityRouter = router({
    computeTwin: protectedProcedure
        .input(z.object({
            projectId: z.number(),
            floors: z.number().min(1).max(200).default(5),
            specLevel: z.enum(["economy", "standard", "premium", "luxury"]).default("standard"),
            glazingRatio: z.number().min(0).max(1).default(0.35),
            materials: z.array(z.object({
                material: materialEnum,
                percentage: z.number().min(0).max(100),
            })).optional(),
            location: z.enum(["dubai", "abu_dhabi", "sharjah", "other_gcc", "temperate"]).default("dubai"),
            includeRenewables: z.boolean().default(false),
            waterRecycling: z.boolean().default(false),
        }))
        .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");

            const gfa = Number(project.siteArea || 500);
            const sustainabilityRating = Number(project.des05Sustainability || 2);

            // Default material mix if not specified
            const materials = input.materials && input.materials.length > 0
                ? input.materials
                : [
                    { material: "concrete" as MaterialType, percentage: 45 },
                    { material: "steel" as MaterialType, percentage: 20 },
                    { material: "glass" as MaterialType, percentage: 12 },
                    { material: "gypsum" as MaterialType, percentage: 10 },
                    { material: "ceramic" as MaterialType, percentage: 8 },
                    { material: "insulation" as MaterialType, percentage: 5 },
                ];

            const result = computeDigitalTwin({
                gfa,
                floors: input.floors,
                specLevel: input.specLevel,
                glazingRatio: input.glazingRatio,
                materials,
                location: input.location,
                sustainabilityRating,
                includeRenewables: input.includeRenewables,
                waterRecycling: input.waterRecycling,
            });

            // Persist
            const d = await getDb();
            if (d) {
                await d.insert(digitalTwinModels).values({
                    projectId: input.projectId,
                    userId: ctx.user.id,
                    orgId: ctx.user.orgId || null,
                    sustainabilityScore: result.sustainabilityScore,
                    sustainabilityGrade: result.sustainabilityGrade,
                    embodiedCarbon: String(result.totalEmbodiedCarbon),
                    carbonPerSqm: String(result.carbonPerSqm),
                    operationalEnergy: String(result.operationalEnergy),
                    energyPerSqm: String(result.energyPerSqm),
                    lifecycleCost30yr: String(result.lifecycleCost30yr),
                    carbonBreakdown: result.carbonBreakdown,
                    lifecycle: result.lifecycle,
                    config: result.config,
                });
            }

            return result;
        }),

    getTwinModels: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input }: { input: any }) => {
            const d = await getDb();
            if (!d) return [];
            return d.select().from(digitalTwinModels)
                .where(eq(digitalTwinModels.projectId, input.projectId))
                .orderBy(desc(digitalTwinModels.createdAt))
                .limit(10);
        }),

    getLatestTwin: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input }: { input: any }) => {
            const d = await getDb();
            if (!d) return null;
            const rows = await d.select().from(digitalTwinModels)
                .where(eq(digitalTwinModels.projectId, input.projectId))
                .orderBy(desc(digitalTwinModels.createdAt))
                .limit(1);
            return rows[0] || null;
        }),
});
