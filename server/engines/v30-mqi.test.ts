import { describe, it, expect } from "vitest";
import {
    calculateSurfaceAreas,
    buildQuantityCostSummary,
    type RoomSurfaces,
    type AllocationResult,
    type AllocationSlice,
} from "./design/material-quantity-engine";
import type { Room } from "./design/space-program";
import type { MaterialLibrary } from "../../drizzle/schema";

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

const mockMaterialLibrary: Partial<MaterialLibrary>[] = [
    {
        id: 1,
        category: "flooring",
        tier: "premium",
        style: "modern",
        brand: "Test",
        productName: "Calacatta Marble",
        supplierName: "Test",
        unitLabel: "sqm",
        priceAedMin: "350.00",
        priceAedMax: "600.00",
        isActive: true,
    },
    {
        id: 2,
        category: "flooring",
        tier: "premium",
        style: "modern",
        brand: "Test",
        productName: "Natural Oak Timber",
        supplierName: "Test",
        unitLabel: "sqm",
        priceAedMin: "200.00",
        priceAedMax: "320.00",
        isActive: true,
    },
    {
        id: 3,
        category: "wall_paint",
        tier: "premium",
        style: "modern",
        brand: "Test",
        productName: "Venetian Plaster",
        supplierName: "Test",
        unitLabel: "sqm",
        priceAedMin: "80.00",
        priceAedMax: "140.00",
        isActive: true,
    },
    {
        id: 4,
        category: "ceiling",
        tier: "mid",
        style: "all",
        brand: "Test",
        productName: "Basic Gypsum Board",
        supplierName: "Test",
        unitLabel: "sqm",
        priceAedMin: "35.00",
        priceAedMax: "60.00",
        isActive: true,
    },
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
            mockMaterialLibrary as MaterialLibrary[],
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        // Floor: 40 sqm × 100% = 40 sqm × 350 = 14,000 min, 40 × 600 = 24,000 max
        const floorElement = result.rooms[0].elements.find((e) => e.element === "floor")!;
        expect(floorElement.elementCostMin).toBe(14000);
        expect(floorElement.elementCostMax).toBe(24000);

        // Mid cost = (14000 + 24000) / 2 = 19000
        expect(result.summary.totalFinishCostMid).toBe(19000);
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
            mockMaterialLibrary as MaterialLibrary[],
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
            mockMaterialLibrary as MaterialLibrary[],
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
            mockMaterialLibrary as MaterialLibrary[],
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
            mockMaterialLibrary as MaterialLibrary[],
            { fin01BudgetCap: null, ctx03Gfa: null }
        );

        // Sum of pctOfTotalSurface should be 100
        const totalPct = result.summary.materialBreakdown.reduce(
            (s, m) => s + m.pctOfTotalSurface,
            0
        );
        expect(totalPct).toBeCloseTo(100, 0);
    });
});
