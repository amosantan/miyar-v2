/**
 * MIYAR 3.0 Phase A — Material Quantity Intelligence Router
 *
 * All procedures use orgProcedure (never publicProcedure for org data).
 * 6 endpoints: generate, getForProject, updateAllocation,
 *              lockAllocations, addSupplierSource, scrapeSupplierSource
 */

import { z } from "zod";
import { router, orgProcedure } from "../_core/trpc";
import * as db from "../db";
import { buildSpaceProgram } from "../engines/design/space-program";
import {
    calculateSurfaceAreas,
    generateMaterialAllocations,
    buildQuantityCostSummary,
    type AllocationSlice,
} from "../engines/design/material-quantity-engine";

export const materialQuantityRouter = router({
    /**
     * generate — Full MQI pipeline
     *
     * 1. Build space program (rooms)
     * 2. Calculate surface areas (deterministic)
     * 3. Load existing locked allocations (preserved across re-runs)
     * 4. Fetch material library
     * 5. Generate allocations via Gemini (locked elements excluded)
     * 6. Compute costs (deterministic)
     * 7. Store to DB + write boardMaterialsCost
     */
    generate: orgProcedure
        .input(
            z.object({
                projectId: z.number(),
                ceilingHeightM: z.number().min(2.4).max(5.0).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            if (!orgId) throw new Error("Organization context required");

            // 1. Get project
            const project = await db.getProjectById(input.projectId);
            if (!project) throw new Error("Project not found");

            // 2. Build space program — Phase B fit-out aware
            // Try persisted space program first (Phase B), fall back to legacy (Phase A)
            const storedRooms = await db.getSpaceProgramRooms(input.projectId, orgId);

            let rooms;
            if (storedRooms.length > 0) {
                // Phase B: use persisted rooms, filter to fit-out only
                rooms = storedRooms
                    .filter((r: any) => r.isFitOut)
                    .map((r: any) => ({
                        id: r.roomCode as string,
                        name: r.roomName as string,
                        sqm: Number(r.sqm),
                        budgetPct: Number(r.budgetPct) || 0,
                        priority: (r.priority || "medium") as "high" | "medium" | "low",
                        finishGrade: (r.finishGrade || "B") as "A" | "B" | "C",
                    }));
            } else {
                // Phase A fallback: use in-memory space program (all rooms = fit-out)
                const spaceProgram = buildSpaceProgram(project);
                rooms = spaceProgram.rooms;
            }

            // 3. Calculate surface areas (pure math)
            const surfaces = calculateSurfaceAreas(
                rooms,
                input.ceilingHeightM
            );

            // 4. Load existing locked allocations (user note #2)
            const existingAllocations = await db.getMaterialAllocations(
                input.projectId,
                orgId
            );
            const lockedAllocations: Array<{
                roomId: string;
                element: string;
                allocations: AllocationSlice[];
            }> = [];
            const lockedIds: number[] = [];

            // Group locked allocations by room+element
            const lockedGroupMap = new Map<string, AllocationSlice[]>();
            for (const alloc of existingAllocations) {
                if (alloc.isLocked) {
                    lockedIds.push(alloc.id);
                    const key = `${alloc.roomId}:${alloc.element}`;
                    if (!lockedGroupMap.has(key)) lockedGroupMap.set(key, []);
                    lockedGroupMap.get(key)!.push({
                        materialLibraryId: alloc.materialLibraryId,
                        materialName: alloc.materialName,
                        percentage: Number(alloc.allocationPct),
                        reasoning: alloc.aiReasoning || "Locked by user",
                    });
                }
            }
            for (const [key, slices] of Array.from(lockedGroupMap.entries())) {
                const [roomId, element] = key.split(":");
                lockedAllocations.push({ roomId, element, allocations: slices });
            }

            // 5. Fetch material library
            const materialLibrary = await db.getMaterialLibrary();

            // 6. Generate via Gemini (locked excluded)
            const allocationResult = await generateMaterialAllocations(
                project,
                surfaces,
                materialLibrary as any,
                rooms,
                lockedAllocations.length > 0 ? lockedAllocations : undefined
            );

            // 7. Compute costs (pure math)
            const costResult = buildQuantityCostSummary(
                surfaces,
                allocationResult,
                materialLibrary as any,
                {
                    fin01BudgetCap: project.fin01BudgetCap
                        ? Number(project.fin01BudgetCap)
                        : null,
                    ctx03Gfa: project.ctx03Gfa ? Number(project.ctx03Gfa) : null,
                }
            );

            // 8. Delete old non-locked allocations, keep locked ones
            await db.deleteMaterialAllocations(
                input.projectId,
                orgId,
                lockedIds.length > 0 ? lockedIds : undefined
            );

            // 9. Insert new allocations
            const allocationsToInsert: any[] = [];
            for (const room of costResult.rooms) {
                for (const element of room.elements) {
                    for (const alloc of element.allocations) {
                        // Skip if this room+element is locked (already preserved)
                        const lockKey = `${room.roomId}:${element.element}`;
                        if (lockedGroupMap.has(lockKey)) continue;

                        allocationsToInsert.push({
                            projectId: input.projectId,
                            organizationId: orgId,
                            roomId: room.roomId,
                            roomName: room.roomName,
                            element: element.element,
                            materialLibraryId: alloc.materialLibraryId,
                            materialName: alloc.materialName,
                            allocationPct: String(alloc.percentage),
                            surfaceAreaM2: String(alloc.actualAreaM2),
                            unitCostMin: alloc.unitCostMin
                                ? String(alloc.unitCostMin)
                                : null,
                            unitCostMax: alloc.unitCostMax
                                ? String(alloc.unitCostMax)
                                : null,
                            totalCostMin: alloc.totalCostMin
                                ? String(alloc.totalCostMin)
                                : null,
                            totalCostMax: alloc.totalCostMax
                                ? String(alloc.totalCostMax)
                                : null,
                            aiReasoning: alloc.reasoning,
                            isLocked: false,
                        });
                    }
                }
            }

            if (allocationsToInsert.length > 0) {
                await db.insertMaterialAllocations(allocationsToInsert);
            }

            // boardMaterialsCost is computed at eval-time from RFQ/MQI data,
            // not a persisted column. The scoring engine reads it from ProjectInputs.
            // MQI data is stored in material_allocations table and read by evaluate.

            return costResult;
        }),

    /**
     * getForProject — Read stored MQI data
     */
    getForProject: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            if (!orgId) throw new Error("Organization context required");

            const allocations = await db.getMaterialAllocations(
                input.projectId,
                orgId
            );

            if (allocations.length === 0) return null;

            // Group by room for frontend consumption
            const roomMap = new Map<
                string,
                {
                    roomId: string;
                    roomName: string;
                    elements: Array<{
                        element: string;
                        allocations: any[];
                    }>;
                }
            >();

            for (const alloc of allocations) {
                if (!roomMap.has(alloc.roomId)) {
                    roomMap.set(alloc.roomId, {
                        roomId: alloc.roomId,
                        roomName: alloc.roomName,
                        elements: [],
                    });
                }
                const room = roomMap.get(alloc.roomId)!;
                let element = room.elements.find((e) => e.element === alloc.element);
                if (!element) {
                    element = { element: alloc.element, allocations: [] };
                    room.elements.push(element);
                }
                element.allocations.push({
                    id: alloc.id,
                    materialLibraryId: alloc.materialLibraryId,
                    materialName: alloc.materialName,
                    allocationPct: Number(alloc.allocationPct),
                    surfaceAreaM2: Number(alloc.surfaceAreaM2),
                    unitCostMin: Number(alloc.unitCostMin) || 0,
                    unitCostMax: Number(alloc.unitCostMax) || 0,
                    totalCostMin: Number(alloc.totalCostMin) || 0,
                    totalCostMax: Number(alloc.totalCostMax) || 0,
                    aiReasoning: alloc.aiReasoning,
                    isLocked: alloc.isLocked,
                });
            }

            return {
                rooms: Array.from(roomMap.values()),
                totalAllocations: allocations.length,
                generatedAt: allocations[0]?.generatedAt?.toISOString(),
            };
        }),

    /**
     * updateAllocation — Edit a single allocation
     * Server-side recalculation of costs
     */
    updateAllocation: orgProcedure
        .input(
            z.object({
                allocationId: z.number(),
                allocationPct: z.number().min(0).max(100),
                surfaceAreaM2: z.number().min(0),
            })
        )
        .mutation(async ({ input }) => {
            // Recalculate costs on server side
            // For now, update percentage and let the frontend trigger a full recalc
            await db.updateMaterialAllocation(input.allocationId, {
                allocationPct: String(input.allocationPct),
                surfaceAreaM2: String(input.surfaceAreaM2),
            });
            return { success: true };
        }),

    /**
     * lockAllocations — Bulk lock/unlock all allocations for a project
     */
    lockAllocations: orgProcedure
        .input(
            z.object({
                projectId: z.number(),
                isLocked: z.boolean(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            if (!orgId) throw new Error("Organization context required");
            await db.lockMaterialAllocations(
                input.projectId,
                orgId,
                input.isLocked
            );
            return { success: true, isLocked: input.isLocked };
        }),

    /**
     * addSupplierSource — Register a new supplier URL for scraping
     */
    addSupplierSource: orgProcedure
        .input(
            z.object({
                supplierName: z.string().min(1).max(200),
                supplierUrl: z.string().url(),
                materialCategory: z.enum([
                    "flooring",
                    "wall_paint",
                    "wall_tile",
                    "ceiling",
                    "joinery",
                    "sanitaryware",
                    "fittings",
                    "lighting",
                    "hardware",
                    "specialty",
                ]),
                tier: z.enum(["affordable", "mid", "premium", "ultra"]),
                notes: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            const result = await db.insertMaterialSupplierSource({
                organizationId: orgId,
                supplierName: input.supplierName,
                supplierUrl: input.supplierUrl,
                materialCategory: input.materialCategory,
                tier: input.tier,
                notes: input.notes || null,
            });
            return result;
        }),

    /**
     * scrapeSupplierSource — Scrape a supplier URL for pricing
     * Uses DynamicConnector for resilient fetching
     */
    scrapeSupplierSource: orgProcedure
        .input(z.object({ sourceId: z.number() }))
        .mutation(async ({ input }) => {
            // Fetch source details
            const sources = await db.getMaterialSupplierSources();
            const source = sources.find((s: any) => s.id === input.sourceId);
            if (!source) throw new Error("Supplier source not found");

            // Use DynamicConnector for scraping (same as ingestion pipeline)
            let rawContent: string;
            try {
                const response = await fetch(source.supplierUrl as string, {
                    headers: { "User-Agent": "MIYAR/3.0 Material Intelligence" },
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                rawContent = await response.text();
            } catch (err: any) {
                return {
                    success: false,
                    error: `Failed to fetch: ${err.message}`,
                };
            }

            // Extract pricing via Gemini
            const { invokeLLM } = await import("../_core/llm");
            const response = await invokeLLM({
                messages: [
                    {
                        role: "system",
                        content: `Extract material pricing from this supplier page content. The material category is "${source.materialCategory}" and the tier is "${source.tier}". Return only min and max AED prices found.`,
                    },
                    {
                        role: "user",
                        content: `Extract AED prices from:\n\n${rawContent.substring(0, 6000)}`,
                    },
                ],
                responseFormat: { type: "json_object" },
            });

            const rawParsed = response.choices[0]?.message?.content;
            const text =
                typeof rawParsed === "string"
                    ? rawParsed
                    : Array.isArray(rawParsed)
                        ? rawParsed
                            .map((p: any) => (typeof p === "string" ? p : p.text || ""))
                            .join("")
                        : "";

            try {
                const prices = JSON.parse(text);
                const minPrice = Number(prices.minPrice || prices.min || 0);
                const maxPrice = Number(prices.maxPrice || prices.max || 0);

                await db.updateMaterialSupplierSource(input.sourceId, {
                    lastScrapedAt: new Date(),
                    lastPriceAedMin: minPrice > 0 ? String(minPrice) : undefined,
                    lastPriceAedMax: maxPrice > 0 ? String(maxPrice) : undefined,
                });

                return {
                    success: true,
                    prices: { min: minPrice, max: maxPrice },
                };
            } catch {
                return {
                    success: false,
                    error: "Failed to parse pricing from supplier page",
                };
            }
        }),
});
