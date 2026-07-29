/**
 * MIYAR 3.0 Phase A — Material Quantity Intelligence Router
 *
 * All procedures use orgProcedure (never publicProcedure for org data).
 * 6 endpoints: generate, getForProject, updateAllocation,
 *              lockAllocations, addSupplierSource, scrapeSupplierSource
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
    orgHeavyMutationProcedure,
    orgMutationProcedure,
    orgProcedure,
    router,
} from "../_core/trpc";
import * as db from "../db";
import { requireProjectForOrg } from "../_core/project-access";
import {
    requireOrgResourceForOrg,
    requireProjectOrgResourceForOrg,
} from "../_core/resource-access";
import { buildSpaceProgram } from "../engines/design/space-program";
import {
    calculateSurfaceAreas,
    generateMaterialAllocations,
    buildQuantityCostSummary,
    type AllocationSlice,
} from "../engines/design/material-quantity-engine";
import {
    resolveMaterialPriceSnapshots,
    resolveProjectMaterialPriceGeography,
} from "../engines/material-pricing/material-resolution";
import {
    resolveQuantityForUnitBasis,
} from "../engines/material-pricing/quantity-policy";

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
    generate: orgHeavyMutationProcedure
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
            const project = await requireProjectForOrg(input.projectId, orgId);

            const geometryAuthority =
                await db.getProjectGeometryAuthorityForOrg(input.projectId, orgId);
            if (geometryAuthority?.mode === "canonical") {
                const accepted =
                    await db.getAcceptedRoomFloorMeasurementsForOrg(input.projectId, orgId);
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message:
                        accepted.status === "ready"
                            ? "Canonical room-floor geometry is available, but material quantities remain insufficient until every stable space has an explicit reviewed finish-scope mapping. GFA, fit-out, wall, ceiling, and opening assumptions were not inferred."
                            : accepted.reason ??
                              "Canonical room-floor geometry is not complete and reviewed. Material quantities were not generated.",
                });
            }

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
            // Group locked allocations by room+element
            const lockedGroupMap = new Map<string, AllocationSlice[]>();
            for (const alloc of existingAllocations) {
                if (alloc.isLocked) {
                    const key = `${alloc.roomId}:${alloc.element}`;
                    if (!lockedGroupMap.has(key)) lockedGroupMap.set(key, []);
                    lockedGroupMap.get(key)!.push({
                        materialLibraryId: alloc.materialLibraryId,
                        materialName: alloc.materialName,
                        percentage: Number(alloc.allocationPct),
                        reasoning: alloc.aiReasoning || "Locked by user",
                        explicitQuantity:
                            alloc.explicitQuantity === null
                                ? null
                                : Number(alloc.explicitQuantity),
                        explicitQuantityUnit: alloc.explicitQuantityUnit,
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

            const resolverAsOf = new Date();
            const materialReferences = Array.from(
                new Set(
                    allocationResult.rooms.flatMap(room =>
                        [...room.floor, ...room.walls, ...room.ceiling, ...room.joinery]
                            .map(slice => slice.materialLibraryId)
                            .filter((id): id is number => id !== null)
                    )
                )
            ).map(legacyId => ({
                source: "material_library" as const,
                legacyId,
            }));
            const priceSnapshots = await resolveMaterialPriceSnapshots({
                references: materialReferences,
                organizationId: orgId,
                priceScope: "supply_only",
                requestedGeography: resolveProjectMaterialPriceGeography(
                    (project as any).materialPriceGeography
                ),
                asOf: resolverAsOf,
                allowLegacyUnknownScope: true,
            });

            // 7. Compute costs from governed resolver snapshots (pure math)
            const costResult = buildQuantityCostSummary(
                surfaces,
                allocationResult,
                priceSnapshots,
                {
                    fin01BudgetCap: project.fin01BudgetCap
                        ? Number(project.fin01BudgetCap)
                        : null,
                    ctx03Gfa: project.ctx03Gfa ? Number(project.ctx03Gfa) : null,
                }
            );

            // 8. Build replacement rows; locked rows remain untouched.
            const allocationsToInsert: any[] = [];
            for (const room of costResult.rooms) {
                for (const element of room.elements) {
                    for (const alloc of element.allocations) {
                        // Skip if this room+element is locked (already preserved)
                        const lockKey = `${room.roomId}:${element.element}`;
                        if (lockedGroupMap.has(lockKey)) continue;

                        const snapshot = alloc.priceSnapshot;
                        const resolvedSnapshot =
                            snapshot?.state === "resolved" ? snapshot : null;
                        allocationsToInsert.push({
                            projectId: input.projectId,
                            organizationId: orgId,
                            roomId: room.roomId,
                            roomName: room.roomName,
                            element: element.element,
                            materialLibraryId: alloc.materialLibraryId,
                            productId: alloc.productId,
                            specId: alloc.specificationId,
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
                            resolutionState: alloc.resolutionState,
                            resolutionReason: alloc.resolutionReason ?? null,
                            benchmarkProposalId:
                                resolvedSnapshot?.benchmarkProposalId ?? null,
                            resolvedPriceScope:
                                resolvedSnapshot?.resolvedPriceScope ?? null,
                            requestedGeography:
                                snapshot?.requestedGeography ?? null,
                            resolvedGeography:
                                resolvedSnapshot?.resolvedGeography ?? null,
                            resolvedUnitBasis:
                                resolvedSnapshot?.unitBasis ?? null,
                            resolutionAsOf: snapshot
                                ? new Date(snapshot.resolverAsOf)
                                : resolverAsOf,
                            resolverPolicyVersion:
                                snapshot?.policyVersion
                                ?? "ev03-material-resolution-v1",
                            benchmarkVersionId:
                                resolvedSnapshot?.benchmarkVersionId ?? null,
                            benchmarkVersion:
                                resolvedSnapshot?.provenance.benchmarkVersion
                                ?? null,
                            provenancePolicyVersion:
                                resolvedSnapshot?.provenance
                                    .provenancePolicyVersion ?? null,
                            presentationProvenance:
                                resolvedSnapshot?.provenance ?? null,
                            quantityPolicyVersion:
                                alloc.quantityPolicyVersion,
                            quantityConversionInputs:
                                alloc.quantityConversionInputs,
                            aiReasoning: alloc.reasoning,
                            isLocked: false,
                        });
                    }
                }
            }

            if (!(await db.replaceMaterialAllocationsForOrg(
                input.projectId,
                orgId,
                allocationsToInsert,
                {
                    materialPricingRevision:
                        project.materialPricingRevision,
                    materialPriceGeography:
                        project.materialPriceGeography,
                }
            ))) {
                await requireProjectForOrg(input.projectId, orgId);
                throw new TRPCError({
                    code: "CONFLICT",
                    message:
                        "Material pricing inputs changed while quantities were generated. Retry with the current project geography.",
                });
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
            await requireProjectForOrg(input.projectId, orgId);

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
                    explicitQuantity:
                        alloc.explicitQuantity === null
                            ? null
                            : Number(alloc.explicitQuantity),
                    explicitQuantityUnit: alloc.explicitQuantityUnit,
                    unitCostMin: alloc.unitCostMin === null ? null : Number(alloc.unitCostMin),
                    unitCostMax: alloc.unitCostMax === null ? null : Number(alloc.unitCostMax),
                    totalCostMin: alloc.totalCostMin === null ? null : Number(alloc.totalCostMin),
                    totalCostMax: alloc.totalCostMax === null ? null : Number(alloc.totalCostMax),
                    resolutionState: alloc.resolutionState,
                    resolutionReason: alloc.resolutionReason,
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
     * Adds the reviewed, explicit non-surface quantity needed for an issued
     * joinery or sanitaryware line. Identity and organization are resolved on
     * the server; callers cannot supply canonical IDs or provenance.
     */
    addExplicitAllocation: orgMutationProcedure
        .input(
            z.discriminatedUnion("element", [
                z.object({
                    projectId: z.number(),
                    roomId: z.string().min(1).max(20),
                    element: z.literal("joinery"),
                    materialLibraryId: z.number().int().positive(),
                    explicitQuantity: z.number().positive().refine(
                        value =>
                            Math.abs(value * 1000 - Math.round(value * 1000)) <
                            1e-8,
                        "Quantity supports at most three decimal places"
                    ),
                    explicitQuantityUnit: z.literal("lm"),
                }),
                z.object({
                    projectId: z.number(),
                    roomId: z.string().min(1).max(20),
                    element: z.literal("sanitaryware"),
                    materialLibraryId: z.number().int().positive(),
                    explicitQuantity: z.number().int().positive(),
                    explicitQuantityUnit: z.literal("piece"),
                }),
            ])
        )
        .mutation(async ({ input, ctx }) => {
            const project = await requireProjectForOrg(
                input.projectId,
                ctx.orgId
            );
            const [rooms, materialLibrary] = await Promise.all([
                db.getSpaceProgramRooms(input.projectId, ctx.orgId),
                db.getMaterialLibrary(),
            ]);
            const room = rooms.find(
                candidate => candidate.roomCode === input.roomId
            );
            const material = materialLibrary.find(
                candidate => candidate.id === input.materialLibraryId
            );
            if (!room || !room.isFitOut || !material) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Resource not found",
                });
            }
            if (material.category !== input.element) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: "MATERIAL_CATEGORY_INCOMPATIBLE",
                });
            }
            const resolverAsOf = new Date();
            const explicitQuantity =
                Math.round(input.explicitQuantity * 1000) / 1000;
            const [snapshot] = await resolveMaterialPriceSnapshots({
                references: [{
                    source: "material_library",
                    legacyId: material.id,
                }],
                organizationId: ctx.orgId,
                priceScope: "supply_only",
                requestedGeography: resolveProjectMaterialPriceGeography(
                    project.materialPriceGeography
                ),
                asOf: resolverAsOf,
                allowLegacyUnknownScope: true,
            });
            if (!snapshot || snapshot.state !== "resolved") {
                if (
                    snapshot?.state === "insufficient" &&
                    snapshot.reason === "identity_not_found" &&
                    snapshot.productId === undefined
                ) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Resource not found",
                    });
                }
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: "MATERIAL_PRICING_INSUFFICIENT",
                });
            }
            const quantity = resolveQuantityForUnitBasis({
                unitBasis: snapshot.unitBasis,
                asOf: resolverAsOf,
                explicitQuantity,
                explicitQuantityUnit: input.explicitQuantityUnit,
                paintCoverageProfile: snapshot.paintCoverageProfile
                    ? { status: "approved", ...snapshot.paintCoverageProfile }
                    : undefined,
            });
            if (quantity.state !== "resolved") {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: `MATERIAL_QUANTITY_INSUFFICIENT:${quantity.reason}`,
                });
            }
            const totalMin = Math.round(
                quantity.quantity * Number(snapshot.priceMin) * 100
            ) / 100;
            const totalMax = Math.round(
                quantity.quantity * Number(snapshot.priceMax) * 100
            ) / 100;
            const created =
                await db.createExplicitMaterialAllocationForOrg(
                    input.projectId,
                    ctx.orgId,
                    {
                        projectId: input.projectId,
                        organizationId: ctx.orgId,
                        roomId: room.roomCode,
                        roomName: room.roomName,
                        element: input.element,
                        materialLibraryId: material.id,
                        materialName: material.productName,
                        allocationPct: "100",
                        surfaceAreaM2: "0",
                        explicitQuantity: String(explicitQuantity),
                        explicitQuantityUnit: input.explicitQuantityUnit,
                        unitCostMin: snapshot.priceMin,
                        unitCostMax: snapshot.priceMax,
                        totalCostMin: String(totalMin),
                        totalCostMax: String(totalMax),
                        productId: snapshot.productId,
                        specId: snapshot.specificationId,
                        benchmarkProposalId: snapshot.benchmarkProposalId,
                        resolutionState: "resolved",
                        resolutionReason: null,
                        resolvedPriceScope: snapshot.resolvedPriceScope,
                        requestedGeography: snapshot.requestedGeography,
                        resolvedGeography: snapshot.resolvedGeography,
                        resolvedUnitBasis: snapshot.unitBasis,
                        resolutionAsOf: resolverAsOf,
                        resolverPolicyVersion: snapshot.policyVersion,
                        benchmarkVersionId: snapshot.benchmarkVersionId,
                        benchmarkVersion:
                            snapshot.provenance.benchmarkVersion,
                        provenancePolicyVersion:
                            snapshot.provenance.provenancePolicyVersion,
                        presentationProvenance: snapshot.provenance,
                        quantityPolicyVersion: quantity.policyVersion,
                        quantityConversionInputs:
                            quantity.conversionInputs,
                        aiReasoning:
                            "Explicit reviewed non-surface quantity.",
                        isLocked: true,
                    },
                    {
                        materialPricingRevision:
                            project.materialPricingRevision,
                        materialPriceGeography:
                            project.materialPriceGeography,
                    }
                );
            if (!created) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Explicit allocation already exists",
                });
            }
            return created;
        }),

    /**
     * updateAllocation — Edit a single allocation
     * Server-side recalculation of costs
     */
    updateAllocation: orgMutationProcedure
        .input(
            z.object({
                allocationId: z.number(),
                allocationPct: z.number().min(0).max(100),
                surfaceAreaM2: z.number().min(0),
                explicitQuantity: z.number().positive().optional(),
                explicitQuantityUnit: z
                    .enum(["sqm", "lm", "piece", "pack", "litre"])
                    .optional(),
            }).refine(
                value =>
                    (value.explicitQuantity === undefined) ===
                    (value.explicitQuantityUnit === undefined),
                {
                    message:
                        "Explicit quantity and unit must be supplied together",
                }
            )
        )
        .mutation(async ({ input, ctx }) => {
            await requireProjectOrgResourceForOrg(input.allocationId, ctx.orgId, {
                lookupResource: db.getMaterialAllocationById,
                getProjectId: allocation => allocation.projectId,
                getOrgId: allocation => allocation.organizationId,
            });
            // Recalculate costs on server side
            // For now, update percentage and let the frontend trigger a full recalc
            if (!(await db.updateMaterialAllocationForOrg(input.allocationId, ctx.orgId, {
                allocationPct: String(input.allocationPct),
                surfaceAreaM2: String(input.surfaceAreaM2),
                explicitQuantity:
                    input.explicitQuantity === undefined
                        ? null
                        : String(input.explicitQuantity),
                explicitQuantityUnit: input.explicitQuantityUnit ?? null,
                unitCostMin: null,
                unitCostMax: null,
                totalCostMin: null,
                totalCostMax: null,
                benchmarkProposalId: null,
                resolutionState: "insufficient",
                resolutionReason: "quantity_required",
                resolvedPriceScope: null,
                requestedGeography: null,
                resolvedGeography: null,
                resolvedUnitBasis: null,
                resolutionAsOf: null,
                resolverPolicyVersion: null,
                benchmarkVersionId: null,
                benchmarkVersion: null,
                provenancePolicyVersion: null,
                presentationProvenance: null,
                quantityPolicyVersion: null,
                quantityConversionInputs: null,
            }))) {
                await requireProjectOrgResourceForOrg(input.allocationId, ctx.orgId, {
                    lookupResource: db.getMaterialAllocationById,
                    getProjectId: allocation => allocation.projectId,
                    getOrgId: allocation => allocation.organizationId,
                });
            }
            return { success: true };
        }),

    /**
     * lockAllocations — Bulk lock/unlock all allocations for a project
     */
    lockAllocations: orgMutationProcedure
        .input(
            z.object({
                projectId: z.number(),
                isLocked: z.boolean(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const orgId = (ctx as any).orgId;
            if (!orgId) throw new Error("Organization context required");
            await requireProjectForOrg(input.projectId, orgId);
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
    addSupplierSource: orgMutationProcedure
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
    scrapeSupplierSource: orgHeavyMutationProcedure
        .input(z.object({ sourceId: z.number() }))
        .mutation(async ({ input, ctx }) => {
            const source = await requireOrgResourceForOrg(
                input.sourceId,
                ctx.orgId,
                {
                    lookupResource: db.getMaterialSupplierSourceById,
                    getOrgId: record => record.organizationId,
                }
            );

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
                const parsedMin = Number(prices.minPrice ?? prices.min);
                const parsedMax = Number(prices.maxPrice ?? prices.max);
                const minPrice =
                    Number.isFinite(parsedMin) && parsedMin > 0
                        ? parsedMin
                        : null;
                const maxPrice =
                    Number.isFinite(parsedMax) && parsedMax > 0
                        ? parsedMax
                        : null;

                if (!(await db.updateMaterialSupplierSourceForOrg(input.sourceId, ctx.orgId, {
                    lastScrapedAt: new Date(),
                    lastPriceAedMin:
                        minPrice === null ? undefined : String(minPrice),
                    lastPriceAedMax:
                        maxPrice === null ? undefined : String(maxPrice),
                }))) {
                    await requireOrgResourceForOrg(input.sourceId, ctx.orgId, {
                        lookupResource: db.getMaterialSupplierSourceById,
                        getOrgId: record => record.organizationId,
                    });
                }

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
