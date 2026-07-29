/**
 * MIYAR 3.0 Phase A — Material Quantity Intelligence Engine
 *
 * Three core functions:
 *   1. calculateSurfaceAreas()      — pure deterministic math (no DB, no LLM)
 *   2. generateMaterialAllocations() — single Gemini call for material splits
 *   3. buildQuantityCostSummary()    — pure cost math (no LLM)
 *
 * Rules:
 *   - Gemini SUGGESTS allocations only — never sets prices
 *   - Prices come only from EV-03 governed material-price snapshots
 *   - fin01BudgetCap is AED/sqft (total construction cost per sqft)
 *   - Budget formula: fin01BudgetCap × ctx03Gfa × SQFT_TO_SQM × FINISH_BUDGET_RATIO
 *   - Max 2 materials per surface (coerce if Gemini returns more)
 *   - Grade C rooms get single affordable material (no Gemini call)
 *   - Locked allocations survive re-generation
 */

import type { Room } from "./space-program";
import { invokeLLM } from "../../_core/llm";
import type { MaterialLibrary } from "../../../drizzle/schema";
import {
    type MaterialAggregateCoverage,
    type MaterialPriceInsufficiencyReason,
    type MaterialPriceSnapshot,
} from "../../../shared/material-calculations";
import { libraryTiersForMkt01Tier } from "../tier-policy";
import { exactDecimalMidpoint } from "../material-pricing/policy";
import { resolveQuantityForUnitBasis } from "../material-pricing/quantity-policy";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomSurfaces {
    roomId: string;
    roomName: string;
    floorM2: number;
    wallM2: number;
    ceilingM2: number;
}

export interface AllocationSlice {
    materialLibraryId: number | null;
    materialName: string;
    percentage: number;
    reasoning: string;
    explicitQuantity?: number | null;
    explicitQuantityUnit?: "sqm" | "lm" | "piece" | "pack" | "litre" | null;
}

export interface RoomAllocation {
    roomId: string;
    floor: AllocationSlice[];
    walls: AllocationSlice[];
    ceiling: AllocationSlice[];
    joinery: AllocationSlice[];
}

export interface AllocationResult {
    rooms: RoomAllocation[];
    designRationale: string;
    estimatedQualityLabel: string;
}

export interface RoomCostBreakdown {
    roomId: string;
    roomName: string;
    floorM2: number;
    wallM2: number;
    ceilingM2: number;
    elements: Array<{
        element: string;
        surfaceAreaM2: number;
        allocations: Array<{
            materialLibraryId: number | null;
            materialName: string;
            percentage: number;
            actualAreaM2: number;
            productId: number | null;
            specificationId: number | null;
            unitCostMin: number | null;
            unitCostMax: number | null;
            totalCostMin: number | null;
            totalCostMax: number | null;
            resolutionState: "resolved" | "insufficient";
            resolutionReason?: string;
            priceSnapshot: MaterialPriceSnapshot | null;
            quantityPolicyVersion: string | null;
            quantityConversionInputs: Record<
                string,
                string | number | readonly string[]
            > | null;
            /** False when no governed value and compatible quantity resolved. */
            priced: boolean;
            reasoning: string;
        }>;
        elementCostMin: number | null;
        elementCostMax: number | null;
    }>;
    roomCostMin: number | null;
    roomCostMax: number | null;
}

export interface MaterialQuantityResult {
    rooms: RoomCostBreakdown[];
    summary: {
        totalFloorM2: number;
        totalWallM2: number;
        totalCeilingM2: number;
        totalSurfaceM2: number;
        materialBreakdown: Array<{
            materialName: string;
            totalAreaM2: number;
            totalCostMin: number | null;
            totalCostMax: number | null;
            pctOfTotalSurface: number;
        }>;
        totalFinishCostMin: number | null;
        totalFinishCostMax: number | null;
        totalFinishCostMid: number | null;
        budgetCapAed: number | null;
        budgetUtilizationPct: number | null;
        isOverBudget: boolean;
        overBudgetByAed: number;
        qualityLabel: string;
        /** Allocation slices with no resolvable priced library row (ADR-0009). */
        unpricedAllocationCount: number;
        aggregateCoverage: MaterialAggregateCoverage;
        /** Provenance basis of the priced library rows behind the totals. */
        costBasis: {
            policyVersion: string;
            label: string;
            assumptionRowCount: number;
            observedRowCount: number;
        };
    };
    generatedAt: string;
}

// ─── Function 1: calculateSurfaceAreas ────────────────────────────────────────

const ASPECT_RATIOS: Record<string, number> = {
    // Living / Dining / Lobby
    LVG: 1.6, DIN: 1.6, LBY: 1.6,
    // Master bedroom
    MBR: 1.4,
    // Secondary bedrooms
    BD2: 1.3, BD3: 1.3, BD4: 1.3,
    // Kitchen
    KIT: 1.4,
    // Bathrooms / Ensuite (near-square)
    BTH: 1.0, MEN: 1.0, ENS: 1.0,
    // Corridors / Hallways (long and narrow)
    COR: 2.5, ENT: 2.5, HAL: 2.5,
    // Office / Meeting
    OFC: 1.5, MET: 1.5, OPN: 1.5,
    // Back-of-house / Utility
    BOH: 1.8, UTL: 1.8,
    // Hospitality
    GRM: 1.4, GRS: 1.5, FBB: 1.6, RCP: 1.5, BRK: 1.4,
};

const DEFAULT_ASPECT_RATIO = 1.4;
const DEFAULT_CEILING_HEIGHT = 2.8; // meters — standard residential

/**
 * Pure deterministic surface area calculation.
 * No DB calls, no LLM.
 */
export function calculateSurfaceAreas(
    rooms: Room[],
    ceilingHeightM?: number
): RoomSurfaces[] {
    const height = ceilingHeightM ?? DEFAULT_CEILING_HEIGHT;

    // Clamp height to sane range
    const clampedHeight = Math.max(2.4, Math.min(5.0, height));
    if (clampedHeight !== height) {
        console.warn(
            `[MQI] Ceiling height ${height}m outside valid range [2.4, 5.0]. Clamped to ${clampedHeight}m.`
        );
    }

    return rooms.map((room) => {
        if (room.sqm <= 0) {
            return {
                roomId: room.id,
                roomName: room.name,
                floorM2: 0,
                wallM2: 0,
                ceilingM2: 0,
            };
        }

        const ratio = ASPECT_RATIOS[room.id] ?? DEFAULT_ASPECT_RATIO;
        const sqm = room.sqm;

        // Floor = raw sqm (no deduction)
        const floorM2 = sqm;

        // Wall estimation from aspect ratio
        const sideA = Math.sqrt(sqm * ratio);
        const sideB = Math.sqrt(sqm / ratio);
        const perimeter = 2 * (sideA + sideB);
        const rawWallM2 = perimeter * clampedHeight;
        const wallM2 = rawWallM2 * 0.85; // 15% deduction for door/window openings

        // Ceiling = 95% of floor area (5% structural deduction)
        const ceilingM2 = sqm * 0.95;

        // Sanity check: wall/floor ratio should be 1.5–3.5 for typical residential
        const wallFloorRatio = wallM2 / floorM2;
        if (wallFloorRatio < 1.5 || wallFloorRatio > 3.5) {
            console.warn(
                `[MQI] Room ${room.id} wall/floor ratio ${wallFloorRatio.toFixed(2)} outside expected range [1.5, 3.5]`
            );
        }

        return {
            roomId: room.id,
            roomName: room.name,
            floorM2: Number(floorM2.toFixed(2)),
            wallM2: Number(wallM2.toFixed(2)),
            ceilingM2: Number(ceilingM2.toFixed(2)),
        };
    });
}

// ─── Function 2: generateMaterialAllocations ──────────────────────────────────

/** Wet room IDs that require wall_tile, never wall_paint */
const WET_ROOM_IDS = new Set(["BTH", "MEN", "ENS", "KIT"]);

/**
 * Single Gemini call for the whole project.
 * Grade C rooms are set deterministically BEFORE calling Gemini.
 * Locked allocations from previous runs are preserved and excluded from Gemini.
 */
export async function generateMaterialAllocations(
    project: any,
    surfaces: RoomSurfaces[],
    materialLibrary: MaterialLibrary[],
    rooms: Room[],
    existingLockedAllocations?: Array<{ roomId: string; element: string; allocations: AllocationSlice[] }>
): Promise<AllocationResult> {
    // Build room grade map
    const roomGradeMap = new Map(rooms.map((r) => [r.id, r.finishGrade]));

    // Build locked allocation lookup: "roomId:element" → AllocationSlice[]
    const lockedMap = new Map<string, AllocationSlice[]>();
    if (existingLockedAllocations?.length) {
        for (const locked of existingLockedAllocations) {
            lockedMap.set(`${locked.roomId}:${locked.element}`, locked.allocations);
        }
    }

    // Separate Grade C rooms — deterministic single affordable material
    const gradeCRooms = surfaces.filter(
        (s) => roomGradeMap.get(s.roomId) === "C"
    );
    const nonGradeCRooms = surfaces.filter(
        (s) => roomGradeMap.get(s.roomId) !== "C"
    );

    // Filter out rooms/elements that have locked allocations from Gemini generation
    const roomsForGemini = nonGradeCRooms.filter((s) => {
        // Include room if at least one element is unlocked
        const elements = ["floor", "walls", "ceiling", "joinery"];
        return elements.some((el) => !lockedMap.has(`${s.roomId}:${el}`));
    });

    // Pre-filter material library to matching tier + style.
    // ADR-0009: tier selection is owned by the versioned tier policy. v1
    // deliberately preserves the legacy behavior (Mid → mid+affordable;
    // higher tiers → mid only) until the richer mapping receives
    // cost-consultant approval.
    const projectTier = project.mkt01Tier?.toLowerCase() || "mid";
    const projectStyle = (project.des01Style || "modern").toLowerCase();
    const allowedTiers = libraryTiersForMkt01Tier(project.mkt01Tier);
    const filteredLibrary = materialLibrary.filter(
        (m) =>
            allowedTiers.includes(m.tier as (typeof allowedTiers)[number]) &&
            (m.style === projectStyle || m.style === "all")
    );

    // Build Gemini prompt
    const roomDescriptions = roomsForGemini
        .map((s) => {
            const grade = roomGradeMap.get(s.roomId) || "B";
            const isWet = WET_ROOM_IDS.has(s.roomId);
            // List which elements need allocation (exclude locked ones)
            const elements = ["floor", "walls", "ceiling", "joinery"]
                .filter((el) => !lockedMap.has(`${s.roomId}:${el}`));
            return `- ${s.roomId} "${s.roomName}": floor=${s.floorM2}m², walls=${s.wallM2}m², ceiling=${s.ceilingM2}m², grade=${grade}, wet=${isWet}, elements_needed=[${elements.join(",")}]`;
        })
        .join("\n");

    const libraryDescriptions = filteredLibrary
        .slice(0, 60) // Cap to keep prompt token cost manageable
        .map(
            (m) =>
                `id=${m.id} category=${m.category} tier=${m.tier} style=${m.style} brand="${m.brand}" product="${m.productName}" unit=${m.unitLabel}`
        )
        .join("\n");

    const systemPrompt = `You are a UAE interior design cost consultant. Your job is to suggest how the surfaces of a project should be split across materials, based on the project's design style, market tier, and available material library.

PROJECT:
- Typology: ${project.ctx01Typology || "Residential"}
- Style: ${project.des01Style || "Modern"}
- Market Tier: ${projectTier}
- Material Level: ${project.des02MaterialLevel || 3}/5
- Purpose: ${project.projectPurpose || "Residential development"}

ROOMS AND SURFACES (only rooms that need new allocations):
${roomDescriptions}

AVAILABLE MATERIAL LIBRARY (filtered to matching tier and style):
${libraryDescriptions}

RULES:
1. For each room × element, provide 1 OR 2 materials with percentages summing to exactly 100.
2. MAXIMUM 2 materials per surface — never return 3 or more.
3. Use materials from the library when possible (reference by materialLibraryId). If no exact match, use a generic name and set materialLibraryId to null.
4. Grade A rooms get premium finishes. Grade B rooms get mid-range.
5. Wet room walls (BTH, MEN, ENS, KIT where wet=true) MUST use wall_tile, NEVER wall_paint or stone.
6. Ceiling is almost always single material (gypsum or plaster). Only split ceiling if Grade A + ultra tier.
7. For each allocation, write one sentence of reasoning (max 15 words).
8. Never suggest materials that conflict with UAE climate (e.g. solid wood flooring in wet areas).
9. Only provide allocations for the elements listed in elements_needed for each room.`;

    const outputSchema = {
        name: "material_allocations",
        schema: {
            type: "object",
            properties: {
                rooms: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            roomId: { type: "string" },
                            floor: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        materialLibraryId: { type: "number" },
                                        materialName: { type: "string" },
                                        percentage: { type: "number" },
                                        reasoning: { type: "string" },
                                    },
                                    required: ["materialName", "percentage", "reasoning"],
                                },
                            },
                            walls: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        materialLibraryId: { type: "number" },
                                        materialName: { type: "string" },
                                        percentage: { type: "number" },
                                        reasoning: { type: "string" },
                                    },
                                    required: ["materialName", "percentage", "reasoning"],
                                },
                            },
                            ceiling: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        materialLibraryId: { type: "number" },
                                        materialName: { type: "string" },
                                        percentage: { type: "number" },
                                        reasoning: { type: "string" },
                                    },
                                    required: ["materialName", "percentage", "reasoning"],
                                },
                            },
                            joinery: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        materialLibraryId: { type: "number" },
                                        materialName: { type: "string" },
                                        percentage: { type: "number" },
                                        reasoning: { type: "string" },
                                    },
                                    required: ["materialName", "percentage", "reasoning"],
                                },
                            },
                        },
                        required: ["roomId", "floor", "walls", "ceiling", "joinery"],
                    },
                },
                designRationale: { type: "string" },
                estimatedQualityLabel: { type: "string" },
            },
            required: ["rooms", "designRationale", "estimatedQualityLabel"],
        },
    };

    let geminiResult: AllocationResult;

    if (roomsForGemini.length === 0) {
        // All rooms are Grade C or locked — no Gemini call needed
        geminiResult = {
            rooms: [],
            designRationale: "All rooms are utility-grade or locked — deterministic allocation applied.",
            estimatedQualityLabel: "Standard Utility",
        };
    } else {
        const response = await invokeLLM({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content:
                        "Generate material allocations for all listed rooms. Return structured JSON.",
                },
            ],
            outputSchema,
        });

        const rawContent = response.choices[0]?.message?.content;
        const text = typeof rawContent === "string"
            ? rawContent
            : Array.isArray(rawContent)
                ? rawContent.map((p: any) => (typeof p === "string" ? p : p.text || "")).join("")
                : "";

        geminiResult = JSON.parse(text) as AllocationResult;
    }

    // Post-process: validate and coerce
    for (const room of geminiResult.rooms) {
        for (const element of ["floor", "walls", "ceiling", "joinery"] as const) {
            const slices = room[element];
            if (!slices || slices.length === 0) continue;

            // Coerce to max 2 materials (user note #3)
            if (slices.length > 2) {
                // Keep top 2 by percentage
                slices.sort((a, b) => b.percentage - a.percentage);
                slices.length = 2;
            }

            // Normalize percentages to sum to 100
            const sum = slices.reduce((s, sl) => s + sl.percentage, 0);
            if (Math.abs(sum - 100) > 0.01) {
                const scale = 100 / sum;
                for (const sl of slices) {
                    sl.percentage = Number((sl.percentage * scale).toFixed(2));
                }
                // Fix any floating point remainder
                const newSum = slices.reduce((s, sl) => s + sl.percentage, 0);
                if (Math.abs(newSum - 100) > 0.01) {
                    slices[0].percentage += 100 - newSum;
                }
            }
        }
    }

    // Merge Grade C rooms with deterministic allocations
    for (const surface of gradeCRooms) {
        // Find the cheapest flooring/wall material in affordable tier
        const cheapFloor = materialLibrary.find(
            (m) => m.category === "flooring" && m.tier === "affordable"
        );
        const isWet = WET_ROOM_IDS.has(surface.roomId);
        const cheapWall = materialLibrary.find(
            (m) =>
                m.category === (isWet ? "wall_tile" : "wall_paint") &&
                (m.tier === "affordable" || m.tier === "mid")
        );
        const cheapCeiling = materialLibrary.find(
            (m) => m.category === "ceiling" && (m.tier === "affordable" || m.tier === "mid")
        );

        geminiResult.rooms.push({
            roomId: surface.roomId,
            floor: [
                {
                    materialLibraryId: cheapFloor?.id ?? null,
                    materialName: cheapFloor?.productName || "Basic Ceramic Tile",
                    percentage: 100,
                    reasoning: "Grade C utility room — affordable single material.",
                },
            ],
            walls: [
                {
                    materialLibraryId: cheapWall?.id ?? null,
                    materialName: cheapWall?.productName || (isWet ? "Standard Ceramic Wall Tile" : "Standard Emulsion Paint"),
                    percentage: 100,
                    reasoning: isWet ? "Wet utility room — affordable wall tile." : "Grade C — standard paint.",
                },
            ],
            ceiling: [
                {
                    materialLibraryId: cheapCeiling?.id ?? null,
                    materialName: cheapCeiling?.productName || "Basic Gypsum Board",
                    percentage: 100,
                    reasoning: "Grade C — basic gypsum ceiling.",
                },
            ],
            joinery: [],
        });
    }

    // Merge locked allocations back — they override Gemini output (user note #2)
    for (const [key, lockedSlices] of Array.from(lockedMap.entries())) {
        const [roomId, element] = key.split(":");
        let room = geminiResult.rooms.find((r) => r.roomId === roomId);
        if (!room) {
            room = { roomId, floor: [], walls: [], ceiling: [], joinery: [] };
            geminiResult.rooms.push(room);
        }
        (room as any)[element] = lockedSlices;
    }

    return geminiResult;
}

/** Get adjacent tier for broader material library matching */
// ADR-0009: the legacy adjacentTier helper moved into tier-policy's
// libraryTiersForMkt01Tier (v1 reproduces its behavior verbatim).

// ─── Function 3: buildQuantityCostSummary ─────────────────────────────────────

/**
 * Pure deterministic cost calculation. No LLM.
 *
 * For each allocation slice:
 *   actualAreaM2 = surfaceAreaM2 × (allocationPct / 100)
 *   totalCostMin = actualAreaM2 × unitCostMin
 *   totalCostMax = actualAreaM2 × unitCostMax
 *
 * Budget comparison:
 *   fin01BudgetCap is AED/sqft (total construction cost per sqft)
 *   budgetCapAed = fin01BudgetCap × ctx03Gfa × SQFT_TO_SQM (10.764) × FINISH_BUDGET_RATIO (0.35)
 *   This must match space-program.ts formula
 */
export function buildQuantityCostSummary(
    surfaces: RoomSurfaces[],
    allocations: AllocationResult,
    priceSnapshots: readonly MaterialPriceSnapshot[],
    project: { fin01BudgetCap?: number | null; ctx03Gfa?: number | null }
): MaterialQuantityResult {
    const priceByLibraryId = new Map(
        priceSnapshots
            .filter(snapshot => snapshot.reference.source === "material_library")
            .map(snapshot => [snapshot.reference.legacyId, snapshot])
    );

    const roomBreakdowns: RoomCostBreakdown[] = [];
    const materialTotals = new Map<
        string,
        { totalAreaM2: number; totalCostMin: number; totalCostMax: number; complete: boolean }
    >();
    let unpricedAllocationCount = 0;
    let totalAllocationCount = 0;
    let pricedAllocationCount = 0;
    const insufficiencyReasons: MaterialAggregateCoverage["reasons"] = {};
    const pricedSnapshots: MaterialPriceSnapshot[] = [];

    let totalFloorM2 = 0;
    let totalWallM2 = 0;
    let totalCeilingM2 = 0;

    for (const surface of surfaces) {
        const roomAllocation = allocations.rooms.find(
            (r) => r.roomId === surface.roomId
        );

        totalFloorM2 += surface.floorM2;
        totalWallM2 += surface.wallM2;
        totalCeilingM2 += surface.ceilingM2;

        const elements: RoomCostBreakdown["elements"] = [];

        const elementDefs = [
            { name: "floor", areaM2: surface.floorM2 },
            { name: "walls", areaM2: surface.wallM2 },
            { name: "ceiling", areaM2: surface.ceilingM2 },
            { name: "joinery", areaM2: 0 }, // Joinery doesn't have a simple surface area
        ];

        let roomCostMin = 0;
        let roomCostMax = 0;

        for (const elDef of elementDefs) {
            const slices =
                roomAllocation?.[elDef.name as keyof RoomAllocation] as AllocationSlice[] | undefined;
            if (!slices || slices.length === 0) {
                if (elDef.name !== "joinery" && elDef.areaM2 > 0) {
                    totalAllocationCount += 1;
                    unpricedAllocationCount += 1;
                    insufficiencyReasons.quantity_required =
                        (insufficiencyReasons.quantity_required ?? 0) + 1;
                    elements.push({
                        element: elDef.name,
                        surfaceAreaM2: elDef.areaM2,
                        allocations: [],
                        elementCostMin: null,
                        elementCostMax: null,
                    });
                }
                continue;
            }

            const allocationTotal = slices.reduce(
                (sum, slice) => sum + Number(slice.percentage),
                0
            );
            if (
                !Number.isFinite(allocationTotal)
                || allocationTotal <= 0
                || Math.abs(allocationTotal - 100) > 0.01
                || slices.some(slice =>
                    !Number.isFinite(Number(slice.percentage))
                    || Number(slice.percentage) <= 0
                )
            ) {
                totalAllocationCount += 1;
                unpricedAllocationCount += 1;
                insufficiencyReasons.quantity_required =
                    (insufficiencyReasons.quantity_required ?? 0) + 1;
                elements.push({
                    element: elDef.name,
                    surfaceAreaM2: elDef.areaM2,
                    allocations: [],
                    elementCostMin: null,
                    elementCostMax: null,
                });
                continue;
            }

            let elementCostMin = 0;
            let elementCostMax = 0;
            const allocationDetails: RoomCostBreakdown["elements"][0]["allocations"] = [];

            for (const slice of slices) {
                totalAllocationCount += 1;
                const actualAreaM2 = elDef.areaM2 * (slice.percentage / 100);

                // Look up unit costs from material library. ADR-0009 (F3):
                // there is deliberately no category fallback — a slice
                // without a resolvable priced library row is reported as
                // unpriced (cost 0) instead of silently borrowing another
                // material's price. This matches the report-reconciliation
                // unpriced semantics.
                let unitCostMin: number | null = null;
                let unitCostMax: number | null = null;
                let sliceCostMin: number | null = null;
                let sliceCostMax: number | null = null;
                let productId: number | null = null;
                let specificationId: number | null = null;
                let resolutionReason: string | undefined;
                let priced = false;
                let selectedSnapshot: MaterialPriceSnapshot | null = null;
                let quantityPolicyVersion: string | null = null;
                let quantityConversionInputs: Record<
                    string,
                    string | number | readonly string[]
                > | null = null;

                if (slice.materialLibraryId) {
                    const snapshot = priceByLibraryId.get(slice.materialLibraryId);
                    if (snapshot) {
                        selectedSnapshot = snapshot;
                        if (snapshot.state === "resolved") {
                            productId = snapshot.productId;
                            specificationId = snapshot.specificationId;
                            const quantity = resolveQuantityForUnitBasis({
                                unitBasis: snapshot.unitBasis,
                                surfaceAreaM2: actualAreaM2,
                                explicitQuantity:
                                    slice.explicitQuantity ?? undefined,
                                explicitQuantityUnit:
                                    slice.explicitQuantityUnit ?? undefined,
                                paintCoverageState: snapshot.paintCoverageState,
                                paintCoverageProfile: snapshot.paintCoverageProfile
                                    ? {
                                        status: "approved",
                                        ...snapshot.paintCoverageProfile,
                                    }
                                    : undefined,
                                asOf: new Date(snapshot.resolverAsOf),
                            });
                            if (quantity.state === "resolved") {
                                quantityPolicyVersion = quantity.policyVersion;
                                quantityConversionInputs = quantity.conversionInputs;
                                const priceMin = Number(snapshot.priceMin);
                                const priceMax = Number(snapshot.priceMax);
                                if (Number.isFinite(priceMin) && Number.isFinite(priceMax)) {
                                    unitCostMin = priceMin;
                                    unitCostMax = priceMax;
                                    sliceCostMin = quantity.quantity * unitCostMin;
                                    sliceCostMax = quantity.quantity * unitCostMax;
                                    priced = true;
                                    pricedAllocationCount += 1;
                                    pricedSnapshots.push(snapshot);
                                }
                            } else {
                                resolutionReason = quantity.reason;
                            }
                        } else {
                            productId = snapshot.productId ?? null;
                            specificationId = snapshot.specificationId ?? null;
                            resolutionReason = snapshot.reason;
                        }
                    }
                }
                if (!priced) {
                    unpricedAllocationCount += 1;
                    if (!resolutionReason) resolutionReason = "identity_not_found";
                    const reason = resolutionReason as MaterialPriceInsufficiencyReason;
                    insufficiencyReasons[reason] = (insufficiencyReasons[reason] ?? 0) + 1;
                }

                if (sliceCostMin !== null && sliceCostMax !== null) {
                    elementCostMin += sliceCostMin;
                    elementCostMax += sliceCostMax;
                }

                allocationDetails.push({
                    materialLibraryId: slice.materialLibraryId,
                    materialName: slice.materialName,
                    percentage: slice.percentage,
                    actualAreaM2: Number(actualAreaM2.toFixed(2)),
                    unitCostMin,
                    unitCostMax,
                    totalCostMin: sliceCostMin === null ? null : Number(sliceCostMin.toFixed(2)),
                    totalCostMax: sliceCostMax === null ? null : Number(sliceCostMax.toFixed(2)),
                    productId,
                    specificationId,
                    resolutionState: priced ? "resolved" : "insufficient",
                    ...(resolutionReason ? { resolutionReason } : {}),
                    priceSnapshot: selectedSnapshot,
                    quantityPolicyVersion,
                    quantityConversionInputs,
                    priced,
                    reasoning: slice.reasoning,
                });

                // Accumulate material totals
                const existing = materialTotals.get(slice.materialName) || {
                    totalAreaM2: 0,
                    totalCostMin: 0,
                    totalCostMax: 0,
                    complete: true,
                };
                existing.totalAreaM2 += actualAreaM2;
                if (sliceCostMin === null || sliceCostMax === null) {
                    existing.complete = false;
                } else {
                    existing.totalCostMin += sliceCostMin;
                    existing.totalCostMax += sliceCostMax;
                }
                materialTotals.set(slice.materialName, existing);
            }

            const elementComplete = allocationDetails.every(detail => detail.priced);
            elements.push({
                element: elDef.name,
                surfaceAreaM2: elDef.areaM2,
                allocations: allocationDetails,
                elementCostMin: elementComplete ? Number(elementCostMin.toFixed(2)) : null,
                elementCostMax: elementComplete ? Number(elementCostMax.toFixed(2)) : null,
            });

            if (elementComplete) {
                roomCostMin += elementCostMin;
                roomCostMax += elementCostMax;
            }
        }

        const roomComplete = elements.every(element => element.elementCostMin !== null);
        roomBreakdowns.push({
            roomId: surface.roomId,
            roomName: surface.roomName,
            floorM2: surface.floorM2,
            wallM2: surface.wallM2,
            ceilingM2: surface.ceilingM2,
            elements,
            roomCostMin: roomComplete ? Number(roomCostMin.toFixed(2)) : null,
            roomCostMax: roomComplete ? Number(roomCostMax.toFixed(2)) : null,
        });
    }

    // Compute totals
    const totalSurfaceM2 = totalFloorM2 + totalWallM2 + totalCeilingM2;
    const insufficientItemCount = totalAllocationCount - pricedAllocationCount;
    const aggregateCoverage: MaterialAggregateCoverage = {
        state:
            totalAllocationCount === 0
                ? "insufficient"
                : insufficientItemCount === 0
                ? "complete"
                : pricedAllocationCount === 0
                    ? "insufficient"
                    : "partial",
        totalItemCount: totalAllocationCount,
        pricedItemCount: pricedAllocationCount,
        insufficientItemCount,
        reasons: insufficiencyReasons,
    };
    const allRoomsComplete =
        roomBreakdowns.length > 0
        && totalAllocationCount > 0
        && roomBreakdowns.every(room => room.roomCostMin !== null);
    const totalFinishCostMin = allRoomsComplete
        ? roomBreakdowns.reduce((s, r) => s + (r.roomCostMin ?? 0), 0)
        : null;
    const totalFinishCostMax = allRoomsComplete
        ? roomBreakdowns.reduce((s, r) => s + (r.roomCostMax ?? 0), 0)
        : null;
    const totalFinishCostMid =
        totalFinishCostMin === null || totalFinishCostMax === null
            ? null
            : Number(
                exactDecimalMidpoint(
                    totalFinishCostMin.toFixed(2),
                    totalFinishCostMax.toFixed(2)
                )
            );

    // Budget comparison
    // fin01BudgetCap = AED/sqft (total construction cost — NOT finish-only)
    // SQFT_TO_SQM = 10.764 — converts sqft to sqm (1 sqm = 10.764 sqft)
    // FINISH_BUDGET_RATIO = 0.35 — finishes represent ~35% of total construction cost
    // Must match space-program.ts: totalFitoutBudgetAed = GFA × budgetCap × 10.764 × 0.35
    const SQFT_TO_SQM = 10.764;
    const FINISH_BUDGET_RATIO = 0.35;
    const budgetCapPerSqft = Number(project.fin01BudgetCap) || 0;
    const gfa = Number(project.ctx03Gfa) || 0;
    const budgetCapAed =
        budgetCapPerSqft > 0 && gfa > 0
            ? budgetCapPerSqft * gfa * SQFT_TO_SQM * FINISH_BUDGET_RATIO
            : null;

    const budgetUtilizationPct =
        budgetCapAed && budgetCapAed > 0 && totalFinishCostMid !== null
            ? Number(((totalFinishCostMid / budgetCapAed) * 100).toFixed(1))
            : null;

    const isOverBudget = budgetCapAed
        ? totalFinishCostMid !== null && totalFinishCostMid > budgetCapAed
        : false;
    const overBudgetByAed = isOverBudget
        ? Number(((totalFinishCostMid ?? 0) - (budgetCapAed || 0)).toFixed(2))
        : 0;

    // Material breakdown sorted by total area
    const materialBreakdown = Array.from(materialTotals.entries())
        .map(([name, totals]) => ({
            materialName: name,
            totalAreaM2: Number(totals.totalAreaM2.toFixed(2)),
            totalCostMin: totals.complete ? Number(totals.totalCostMin.toFixed(2)) : null,
            totalCostMax: totals.complete ? Number(totals.totalCostMax.toFixed(2)) : null,
            pctOfTotalSurface:
                totalSurfaceM2 > 0
                    ? Number(((totals.totalAreaM2 / totalSurfaceM2) * 100).toFixed(1))
                    : 0,
        }))
        .sort((a, b) => b.totalAreaM2 - a.totalAreaM2);

    // ADR-0009: classify the provenance of the priced library rows so every
    // rendering of these totals can carry an honest cost-basis label.
    // "Observed" covers market observations and supplier quotes; assumptions
    // and manual entries remain assumption-class.
    const resolvedSnapshots = pricedSnapshots.filter(
        (snapshot): snapshot is Extract<MaterialPriceSnapshot, { state: "resolved" }> =>
            snapshot.state === "resolved"
    );
    const assumptionRowCount = resolvedSnapshots.filter(
        snapshot => snapshot.provenance.sourceLadderRung === "assumption"
    ).length;
    const legacyCompatibilityRowCount = resolvedSnapshots.filter(
        snapshot => snapshot.provenance.compatibilityFallback
    ).length;
    const ordinaryAssumptionRowCount =
        assumptionRowCount - legacyCompatibilityRowCount;
    const observedRowCount = resolvedSnapshots.length - assumptionRowCount;
    const costBasisLabel =
        legacyCompatibilityRowCount === resolvedSnapshots.length
            && legacyCompatibilityRowCount > 0
            ? "Legacy scope-unknown assumption"
            : legacyCompatibilityRowCount > 0
                ? `Mixed (${[
                    "legacy scope-unknown assumption",
                    ordinaryAssumptionRowCount > 0
                        ? "MIYAR assumption"
                        : null,
                    observedRowCount > 0 ? "observed" : null,
                ].filter(Boolean).join(" + ")})`
                : observedRowCount === 0
                    ? "MIYAR assumption"
                    : assumptionRowCount === 0
                        ? "Observed market data"
                        : "Mixed (MIYAR assumption + observed)";

    return {
        rooms: roomBreakdowns,
        summary: {
            totalFloorM2: Number(totalFloorM2.toFixed(2)),
            totalWallM2: Number(totalWallM2.toFixed(2)),
            totalCeilingM2: Number(totalCeilingM2.toFixed(2)),
            totalSurfaceM2: Number(totalSurfaceM2.toFixed(2)),
            materialBreakdown,
            totalFinishCostMin: totalFinishCostMin === null ? null : Number(totalFinishCostMin.toFixed(2)),
            totalFinishCostMax: totalFinishCostMax === null ? null : Number(totalFinishCostMax.toFixed(2)),
            totalFinishCostMid: totalFinishCostMid === null ? null : Number(totalFinishCostMid.toFixed(2)),
            budgetCapAed,
            budgetUtilizationPct,
            isOverBudget,
            overBudgetByAed,
            qualityLabel: allocations.estimatedQualityLabel || "Standard",
            unpricedAllocationCount,
            aggregateCoverage,
            costBasis: {
                policyVersion: "ev03-material-resolution-v1",
                label: costBasisLabel,
                assumptionRowCount,
                observedRowCount,
            },
        },
        generatedAt: new Date().toISOString(),
    };
}
