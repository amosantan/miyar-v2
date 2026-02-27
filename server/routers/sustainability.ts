/**
 * Sustainability Router (Phase H)
 * Endpoints for digital twin computation and retrieval.
 */

import { z } from "zod";
import { protectedProcedure, heavyProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import * as db from "../db";
import { digitalTwinModels, sustainabilitySnapshots } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { computeDigitalTwin, type MaterialType } from "../engines/sustainability/digital-twin";
import { evaluateCompliance } from "../engines/sustainability/compliance-checklists";

const materialEnum = z.enum([
    "concrete", "steel", "glass", "aluminum",
    "timber", "stone", "gypsum", "insulation", "ceramic",
]);

export const sustainabilityRouter = router({
    computeTwin: heavyProcedure
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
        .mutation(async ({ ctx, input }) => {
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

            // Persist to digital_twin_models
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

                // Also persist to sustainability_snapshots for historical tracking (P2-5)
                await d.insert(sustainabilitySnapshots).values({
                    projectId: input.projectId,
                    userId: ctx.user.id,
                    compositeScore: result.sustainabilityScore,
                    grade: result.sustainabilityGrade,
                    embodiedCarbon: String(result.totalEmbodiedCarbon),
                    operationalEnergy: String(result.operationalEnergy),
                    lifecycleCost: String(result.lifecycleCost30yr),
                    carbonPerSqm: String(result.carbonPerSqm),
                    energyRating: result.energyRating || null,
                    renewablesEnabled: input.includeRenewables,
                    waterRecycling: input.waterRecycling,
                    configSnapshot: result.config,
                });
            }

            return result;
        }),

    getTwinModels: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input }) => {
            const d = await getDb();
            if (!d) return [];
            return d.select().from(digitalTwinModels)
                .where(eq(digitalTwinModels.projectId, input.projectId))
                .orderBy(desc(digitalTwinModels.createdAt))
                .limit(10);
        }),

    getLatestTwin: protectedProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input }) => {
            const d = await getDb();
            if (!d) return null;
            const rows = await d.select().from(digitalTwinModels)
                .where(eq(digitalTwinModels.projectId, input.projectId))
                .orderBy(desc(digitalTwinModels.createdAt))
                .limit(1);
            return rows[0] || null;
        }),

    evaluateCompliance: protectedProcedure
        .input(z.object({
            projectId: z.number(),
        }))
        .query(async ({ input }) => {
            const d = await getDb();
            if (!d) throw new Error("Database unavailable");

            // Get project to determine city
            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");
            const city = (project as any).city || "Dubai";

            // Get latest digital twin model for this project
            const rows = await d.select().from(digitalTwinModels)
                .where(eq(digitalTwinModels.projectId, input.projectId))
                .orderBy(desc(digitalTwinModels.createdAt))
                .limit(1);

            const twin = rows[0];
            if (!twin) throw new Error("No digital twin computed yet. Run 'Compute Twin' first.");

            const config = twin.config as any || {};

            const result = evaluateCompliance({
                carbonPerSqm: Number(twin.carbonPerSqm),
                energyPerSqm: Number(twin.energyPerSqm),
                coolingLoad: 0,
                operationalEnergy: Number(twin.operationalEnergy),
                sustainabilityScore: twin.sustainabilityScore ?? 0,
                carbonEfficiency: 0,
                energyRating: 0,
                materialCircularity: 0,
                waterEfficiency: 0,
                gfa: config.gfa ?? 500,
                specLevel: config.specLevel ?? "standard",
                location: config.location ?? "dubai",
                includeRenewables: config.includeRenewables ?? false,
                waterRecycling: config.waterRecycling ?? false,
                glazingRatio: config.glazingRatio ?? 0.35,
            });

            // Auto-filter: only return the relevant certification for the project's city
            return {
                ...result,
                city,
                certSystem: city === "Abu Dhabi" ? "Estidama Pearl" : "Al Sa'fat",
                sustainCertTarget: (project as any).sustainCertTarget || (city === "Abu Dhabi" ? "pearl_1" : "silver"),
            };
        }),
});
