import { describe, it, expect } from "vitest";
import {
    calculateSurfaceAreas,
    buildQuantityCostSummary,
    type RoomSurfaces,
    type AllocationResult,
    type AllocationSlice,
} from "./design/material-quantity-engine";
import type { Room } from "./design/space-program";
import {
    MATERIAL_RESOLUTION_POLICY_VERSION,
    type GovernedMaterialPriceSnapshot,
    type MaterialPriceSnapshot,
} from "../../shared/material-calculations";

// ─── Test Fixtures (from SKILL.md) ────────────────────────────────────────────

const testRooms: Room[] = [
    { id: "LVG", name: "Living & Dining", sqm: 45, finishGrade: "A", priority: "high", budgetPct: 0.28 },
    { id: "MBR", name: "Master Bedroom", sqm: 25, finishGrade: "A", priority: "high", budgetPct: 0.22 },
    { id: "MEN", name: "Master Ensuite", sqm: 10, finishGrade: "A", priority: "high", budgetPct: 0.14 },
    { id: "KIT", name: "Kitchen", sqm: 18, finishGrade: "A", priority: "high", budgetPct: 0.16 },
    { id: "BD2", name: "Bedroom 2", sqm: 18, finishGrade: "B", priority: "medium", budgetPct: 0.07 },
    { id: "BTH", name: "Bathroom", sqm: 6, finishGrade: "B", priority: "medium", budgetPct: 0.05 },
    { id: "UTL", name: "Utility", sqm: 5, finishGrade: "C", priority: "low", budgetPct: 0.01 },
];

function governedSnapshot(
    legacyId: number,
    priceMin: number,
    priceMax: number,
    sourceLadderRung: "assumption" | "market_observation" = "assumption"
): GovernedMaterialPriceSnapshot {
    const priceMid = (priceMin + priceMax) / 2;
    return {
        state: "resolved",
        policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
        reference: { source: "material_library", legacyId },
        productId: legacyId * 10,
        specificationId: legacyId * 100,
        benchmarkProposalId: legacyId * 1000,
        benchmarkVersionId: null,
        resolverAsOf: "2026-07-29T00:00:00.000Z",
        requestedGeography: "uae",
        resolvedGeography: "uae",
        usedUaeFallback: false,
        requestedPriceScope: "supply_only",
        resolvedPriceScope: "legacy_unknown",
        currency: "AED",
        unitBasis: "per_sqm",
        priceMin: priceMin.toFixed(2),
        priceMid: priceMid.toFixed(2),
        priceMax: priceMax.toFixed(2),
        weightedMean: priceMid.toFixed(2),
        provenance: {
            sourceLadderRung,
            sourceLabel:
                sourceLadderRung === "assumption"
                    ? "Legacy scope-unknown assumption"
                    : "Governed market observation",
            provenancePolicyVersion: "test-provenance-v1",
            benchmarkVersion: "test-v1",
            compatibilityFallback: sourceLadderRung === "assumption",
        },
    };
}

const mockPriceSnapshots: MaterialPriceSnapshot[] = [
    governedSnapshot(1, 350, 600),
    governedSnapshot(2, 200, 320),
    governedSnapshot(3, 80, 140),
    governedSnapshot(4, 35, 60),
];

// ─── calculateSurfaceAreas Tests ──────────────────────────────────────────────

describe("calculateSurfaceAreas", () => {
    it("calculates correct surface areas for a 7-room test fixture", () => {
        const surfaces = calculateSurfaceAreas(testRooms, 2.8);

        // Total floor should equal sum of room sqm
        const totalFloor = surfaces.reduce((sum, s) => sum + s.floorM2, 0);
        expect(totalFloor).toBeCloseTo(127, 0);

        // Total walls should be ~2.0-2.5x floor area for typical residential
        const totalWalls = surfaces.reduce((sum, s) => sum + s.wallM2, 0);
        expect(totalWalls).toBeGreaterThan(270);
        expect(totalWalls).toBeLessThan(330);

        // Total ceiling should be floor × 0.95
        const totalCeiling = surfaces.reduce((sum, s) => sum + s.ceilingM2, 0);
        expect(totalCeiling).toBeCloseTo(127 * 0.95, 0);

        // Total surface should be ~520-560 sqm per SKILL.md
        const totalSurface = totalFloor + totalWalls + totalCeiling;
        expect(totalSurface).toBeGreaterThan(500);
        expect(totalSurface).toBeLessThan(580);
    });

    it("returns correct values for a single living room (40sqm)", () => {
        const rooms: Room[] = [
            { id: "LVG", name: "Living", sqm: 40, finishGrade: "A", priority: "high", budgetPct: 1.0 },
        ];

        const [surface] = calculateSurfaceAreas(rooms, 2.8);

        // Floor = 40
        expect(surface.floorM2).toBe(40);

        // Ceiling = 40 × 0.95 = 38
        expect(surface.ceilingM2).toBe(38);

        // Wall calculation: ratio=1.6
        // sideA = sqrt(40 * 1.6) = sqrt(64) = 8
        // sideB = sqrt(40 / 1.6) = sqrt(25) = 5
        // perimeter = 2 * (8 + 5) = 26
        // rawWall = 26 * 2.8 = 72.8
        // wall = 72.8 * 0.85 = 61.88
        expect(surface.wallM2).toBeCloseTo(61.88, 1);
    });

    it("returns zeros for a room with zero sqm without throwing", () => {
        const rooms: Room[] = [
            { id: "TST", name: "Empty", sqm: 0, finishGrade: "C", priority: "low", budgetPct: 0 },
        ];

        const [surface] = calculateSurfaceAreas(rooms, 2.8);

        expect(surface.floorM2).toBe(0);
        expect(surface.wallM2).toBe(0);
        expect(surface.ceilingM2).toBe(0);
    });

    it("clamps ceiling height to valid range [2.4, 5.0]", () => {
        const rooms: Room[] = [
            { id: "LVG", name: "Living", sqm: 40, finishGrade: "A", priority: "high", budgetPct: 1.0 },
        ];

        // Height below minimum → should be clamped to 2.4
        const lowHeight = calculateSurfaceAreas(rooms, 1.5);
        const normalHeight = calculateSurfaceAreas(rooms, 2.4);
        expect(lowHeight[0].wallM2).toBe(normalHeight[0].wallM2);

        // Height above maximum → should be clamped to 5.0
        const highHeight = calculateSurfaceAreas(rooms, 8.0);
        const maxHeight = calculateSurfaceAreas(rooms, 5.0);
        expect(highHeight[0].wallM2).toBe(maxHeight[0].wallM2);
    });

    it("uses default ceiling height of 2.8m when not specified", () => {
        const rooms: Room[] = [
            { id: "MBR", name: "Bedroom", sqm: 25, finishGrade: "A", priority: "high", budgetPct: 1.0 },
        ];

        const withDefault = calculateSurfaceAreas(rooms);
        const explicit28 = calculateSurfaceAreas(rooms, 2.8);

        expect(withDefault[0].wallM2).toBe(explicit28[0].wallM2);
    });
});

// ─── buildQuantityCostSummary Tests ──────────────────────────────────────────

describe("buildQuantityCostSummary", () => {
    const singleRoomSurface: RoomSurfaces[] = [
        { roomId: "LVG", roomName: "Living", floorM2: 40, wallM2: 62, ceilingM2: 38 },
    ];

    it("calculates cost correctly for a single 100% allocation", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Full marble" }],
                    walls: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Full marble" }],
                    ceiling: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Full marble" }],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Premium",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        // Floor: 40 sqm × 100% = 40 sqm × 350 = 14,000 min, 40 × 600 = 24,000 max
        const floorElement = result.rooms[0].elements.find((e) => e.element === "floor")!;
        expect(floorElement.elementCostMin).toBe(14000);
        expect(floorElement.elementCostMax).toBe(24000);

        // All required surfaces are priced, so the authoritative total is complete.
        expect(result.summary.totalFinishCostMid).toBe(66500);
        expect(result.summary.aggregateCoverage.state).toBe("complete");
    });

    it("calculates cost correctly for a 60/40 split", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [
                        { materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 60, reasoning: "Primary" },
                        { materialLibraryId: 2, materialName: "Natural Oak Timber", percentage: 40, reasoning: "Border" },
                    ],
                    walls: [],
                    ceiling: [],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Premium",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        // 60% of 40 = 24 sqm marble: 24 × 350 = 8,400 min, 24 × 600 = 14,400 max
        // 40% of 40 = 16 sqm timber: 16 × 200 = 3,200 min, 16 × 320 = 5,120 max
        // Total min = 11,600, max = 19,520
        const floorElement = result.rooms[0].elements.find((e) => e.element === "floor")!;
        expect(floorElement.elementCostMin).toBe(11600);
        expect(floorElement.elementCostMax).toBe(19520);

        // Check individual allocation areas
        expect(floorElement.allocations[0].actualAreaM2).toBe(24);
        expect(floorElement.allocations[1].actualAreaM2).toBe(16);
    });

    it("sets isOverBudget when cost exceeds budget cap", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Full marble" }],
                    walls: [{ materialLibraryId: 3, materialName: "Venetian Plaster", percentage: 100, reasoning: "Full plaster" }],
                    ceiling: [{ materialLibraryId: 4, materialName: "Gypsum Board", percentage: 100, reasoning: "Basic" }],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Premium",
        };

        // Set a very low budget: 100 AED/sqft × 40 sqm × 10.764 × 0.35 = 15,069.6 finish budget
        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: 100, ctx03Gfa: 40 }
        );

        expect(result.summary.isOverBudget).toBe(true);
        expect(result.summary.overBudgetByAed).toBeGreaterThan(0);
        // 100 × 40 × 10.764 × 0.35 = 15,069.6
        expect(result.summary.budgetCapAed).toBeCloseTo(15069.6, 0);
    });

    it("returns null budget metrics when fin01BudgetCap is null", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [{ materialLibraryId: 1, materialName: "Marble", percentage: 100, reasoning: "Test" }],
                    walls: [],
                    ceiling: [],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Standard",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: 100 }
        );

        expect(result.summary.budgetCapAed).toBeNull();
        expect(result.summary.budgetUtilizationPct).toBeNull();
        expect(result.summary.isOverBudget).toBe(false);
        expect(result.summary.overBudgetByAed).toBe(0);
    });

    it("calculates material breakdown percentages correctly", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [
                        { materialLibraryId: 1, materialName: "Marble", percentage: 60, reasoning: "Primary" },
                        { materialLibraryId: 2, materialName: "Timber", percentage: 40, reasoning: "Border" },
                    ],
                    walls: [{ materialLibraryId: 3, materialName: "Plaster", percentage: 100, reasoning: "Full" }],
                    ceiling: [{ materialLibraryId: 4, materialName: "Gypsum", percentage: 100, reasoning: "Full" }],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Premium",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        // Sum of pctOfTotalSurface should be 100
        const totalPct = result.summary.materialBreakdown.reduce(
            (s, m) => s + m.pctOfTotalSurface,
            0
        );
        expect(totalPct).toBeCloseTo(100, 0);
    });

    it("treats an empty or missing room allocation as insufficient, never AED 0", () => {
        const result = buildQuantityCostSummary(
            singleRoomSurface,
            { rooms: [], designRationale: "No response", estimatedQualityLabel: "Unknown" },
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        expect(result.summary.aggregateCoverage).toMatchObject({
            state: "insufficient",
            totalItemCount: 3,
            pricedItemCount: 0,
            insufficientItemCount: 3,
            reasons: { quantity_required: 3 },
        });
        expect(result.summary.totalFinishCostMin).toBeNull();
        expect(result.summary.totalFinishCostMid).toBeNull();
        expect(result.summary.totalFinishCostMax).toBeNull();
    });

    it("rejects zero-sum percentages and omitted required surfaces", () => {
        const result = buildQuantityCostSummary(
            singleRoomSurface,
            {
                rooms: [{
                    roomId: "LVG",
                    floor: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 0, reasoning: "Invalid" }],
                    walls: [],
                    ceiling: [],
                    joinery: [],
                }],
                designRationale: "Invalid response",
                estimatedQualityLabel: "Unknown",
            },
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        expect(result.summary.aggregateCoverage.state).toBe("insufficient");
        expect(result.summary.aggregateCoverage.reasons.quantity_required).toBe(3);
        expect(result.summary.totalFinishCostMid).toBeNull();
    });
});

// ─── ADR-0009: unpriced allocations and cost basis ──────────────────────────

describe("buildQuantityCostSummary unpriced semantics and cost basis (ADR-0009)", () => {
    const singleRoomSurface: RoomSurfaces[] = [
        { roomId: "LVG", roomName: "Living", floorM2: 40, wallM2: 62, ceilingM2: 38 },
    ];

    it("does not invent a category-fallback price for a null materialLibraryId", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [{ materialLibraryId: null, materialName: "Generic Stone", percentage: 100, reasoning: "No library match" }],
                    walls: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Known wall" }],
                    ceiling: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Known ceiling" }],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Standard",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        const floorElement = result.rooms[0].elements.find((e) => e.element === "floor")!;
        expect(floorElement.elementCostMin).toBeNull();
        expect(floorElement.elementCostMax).toBeNull();
        expect(floorElement.allocations[0].priced).toBe(false);
        expect(floorElement.allocations[0].unitCostMin).toBeNull();
        expect(result.summary.unpricedAllocationCount).toBe(1);
        expect(result.summary.totalFinishCostMid).toBeNull();
        expect(result.summary.aggregateCoverage).toMatchObject({
            state: "partial",
            totalItemCount: 3,
            pricedItemCount: 2,
            insufficientItemCount: 1,
            reasons: { identity_not_found: 1 },
        });
    });

    it("counts an unknown or price-less library id as unpriced", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [{ materialLibraryId: 999, materialName: "Ghost Material", percentage: 100, reasoning: "Stale id" }],
                    walls: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Known wall" }],
                    ceiling: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Known ceiling" }],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Standard",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        expect(result.summary.unpricedAllocationCount).toBe(1);
        expect(result.summary.totalFinishCostMid).toBeNull();
        expect(result.summary.aggregateCoverage.state).toBe("partial");
    });

    it("labels all legacy-compatible values as legacy scope-unknown assumptions", () => {
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Full marble" }],
                    walls: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Full marble" }],
                    ceiling: [{ materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 100, reasoning: "Full marble" }],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Premium",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            mockPriceSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        expect(result.summary.unpricedAllocationCount).toBe(0);
        expect(result.summary.costBasis).toEqual({
            policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
            label: "Legacy scope-unknown assumption",
            assumptionRowCount: 3,
            observedRowCount: 0,
        });
    });

    it("labels mixed assumption and observed rows as Mixed", () => {
        const observedSnapshots: MaterialPriceSnapshot[] = [
            ...mockPriceSnapshots,
            governedSnapshot(50, 100, 140, "market_observation"),
        ];
        const allocations: AllocationResult = {
            rooms: [
                {
                    roomId: "LVG",
                    floor: [
                        { materialLibraryId: 1, materialName: "Calacatta Marble", percentage: 50, reasoning: "Assumption row" },
                        { materialLibraryId: 50, materialName: "Observed Porcelain", percentage: 50, reasoning: "Observed row" },
                    ],
                    walls: [],
                    ceiling: [],
                    joinery: [],
                },
            ],
            designRationale: "Test",
            estimatedQualityLabel: "Premium",
        };

        const result = buildQuantityCostSummary(
            singleRoomSurface,
            allocations,
            observedSnapshots,
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        expect(result.summary.costBasis.label).toBe(
            "Mixed (legacy scope-unknown assumption + observed)"
        );
        expect(result.summary.costBasis.assumptionRowCount).toBe(1);
        expect(result.summary.costBasis.observedRowCount).toBe(1);
    });
});
