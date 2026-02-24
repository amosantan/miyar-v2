/**
 * AI Design Advisor Tests
 * Tests the core engine functions: space recommendations, material matching,
 * kitchen/bathroom specialization, and design brief generation.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("../../_core/llm", () => ({
    invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import {
    generateDesignRecommendations,
    generateAIDesignBrief,
} from "../design/ai-design-advisor";
import { buildSpaceProgram } from "../design/space-program";

// ─── Test Data ──────────────────────────────────────────────────────────────

const mockProject = {
    id: 1,
    name: "Marina Heights",
    orgId: 1,
    ctx01Typology: "Residential",
    ctx02Scale: "Medium",
    ctx03Gfa: 200,
    ctx04Location: "Prime",
    mkt01Tier: "Luxury",
    des01Style: "Modern",
    des02MaterialLevel: 4,
    des03Complexity: 3,
    fin01BudgetCap: 200,
};

const mockInputs = {
    ctx01Typology: "Residential",
    ctx02Scale: "Medium",
    ctx03Gfa: 200,
    ctx04Location: "Prime",
    ctx05Horizon: "12-24m",
    str01BrandClarity: 4,
    str02Differentiation: 4,
    str03BuyerMaturity: 4,
    mkt01Tier: "Luxury",
    mkt02Competitor: 3,
    mkt03Trend: 3,
    fin01BudgetCap: 200,
    fin02Flexibility: 3,
    fin03ShockTolerance: 3,
    fin04SalesPremium: 4,
    des01Style: "Modern",
    des02MaterialLevel: 4,
    des03Complexity: 3,
    des04Experience: 4,
    des05Sustainability: 3,
    exe01SupplyChain: 3,
    exe02Contractor: 3,
    exe03Approvals: 3,
    exe04QaMaturity: 3,
    add01SampleKit: false,
    add02PortfolioMode: false,
    add03DashboardExport: false,
};

const mockMaterials = [
    { id: 1, category: "flooring", tier: "premium", style: "modern", productName: "Calacatta Gold Slab", brand: "Margraf", priceAedMin: "450", priceAedMax: "600", unitLabel: "sqm", isActive: true, notes: null },
    { id: 2, category: "wall_paint", tier: "premium", style: "modern", productName: "Platinum Silk Matt", brand: "Jotun", priceAedMin: "35", priceAedMax: "55", unitLabel: "litre", isActive: true, notes: null },
    { id: 3, category: "wall_tile", tier: "premium", style: "modern", productName: "Zellige Bone", brand: "RAK", priceAedMin: "85", priceAedMax: "120", unitLabel: "sqm", isActive: true, notes: null },
    { id: 4, category: "joinery", tier: "premium", style: "modern", productName: "Walnut Veneer System", brand: "Poliform", priceAedMin: "800", priceAedMax: "1200", unitLabel: "lm", isActive: true, notes: null },
    { id: 5, category: "hardware", tier: "premium", style: "modern", productName: "Lever Set Brushed Brass", brand: "Colombo", priceAedMin: "350", priceAedMax: "500", unitLabel: "set", isActive: true, notes: null },
];

const mockGeminiDesignResponse = {
    spaces: [
        {
            roomId: "LVG",
            roomName: "Living & Dining",
            styleDirection: "Warm minimalism with brass accents and limestone textures",
            colorScheme: "Warm sand #D4C5A9, Charcoal #3A3A3A, Brass #B8860B",
            rationale: "Open plan space demands a cohesive warm palette that flows between living and dining zones",
            specialNotes: ["Consider integrated AV cabinet", "Use layered lighting"],
            materials: [
                { element: "floor", productName: "Calacatta Gold Slab", brand: "Margraf", priceRange: "450-600 AED/sqm", rationale: "Natural stone adds warmth and luxury" },
                { element: "wall_primary", productName: "Platinum Silk Matt", brand: "Jotun", priceRange: "35-55 AED/litre", rationale: "Neutral base for artwork" },
            ],
            budgetBreakdown: [
                { element: "floor", percentage: 30 },
                { element: "wall_primary", percentage: 15 },
                { element: "joinery", percentage: 25 },
                { element: "hardware", percentage: 10 },
                { element: "ceiling", percentage: 10 },
                { element: "wall_feature", percentage: 10 },
            ],
        },
        {
            roomId: "KIT",
            roomName: "Kitchen",
            styleDirection: "Sleek modern with integrated appliances",
            colorScheme: "White #FAFAFA, Dark grey #333, Walnut #5C3A21",
            rationale: "Kitchen needs to balance beauty with functionality",
            specialNotes: ["Island layout for this GFA"],
            materials: [
                { element: "floor", productName: "Porcelain Tile", brand: "RAK", priceRange: "120-180 AED/sqm", rationale: "Durable and easy to clean" },
            ],
            budgetBreakdown: [{ element: "floor", percentage: 20 }, { element: "joinery", percentage: 50 }],
            kitchenSpec: {
                layoutType: "Island",
                layoutRationale: "200sqm GFA supports an island layout",
                cabinetStyle: "Handleless flat-panel",
                cabinetFinish: "Lacquer",
                countertopMaterial: "Calacatta quartz, 20mm polished",
                countertopPriceRange: "600-900 AED/lm",
                backsplash: "Zellige tile in bone",
                sinkType: "Undermount stainless",
                applianceLevel: "premium",
                applianceBrands: ["Bosch", "Siemens"],
                storageFeatures: ["Pull-out pantry", "Corner carousel"],
            },
        },
        {
            roomId: "MEN",
            roomName: "Master Ensuite",
            styleDirection: "Spa-inspired retreat with natural stone",
            colorScheme: "Ivory #F5F0E6, Sage #B2BDA0, Brass #B8860B",
            rationale: "Master ensuite should feel like a private spa",
            specialNotes: ["Frameless glass shower", "Heated flooring recommended"],
            materials: [
                { element: "floor", productName: "Travertine Honed", brand: "Margraf", priceRange: "380-500 AED/sqm", rationale: "Warm natural stone for wet areas" },
            ],
            budgetBreakdown: [{ element: "floor", percentage: 25 }, { element: "wall_wet", percentage: 35 }],
            bathroomSpec: {
                showerType: "walk-in",
                vanityStyle: "Wall-mounted double vanity in stone",
                vanityWidth: "1500mm",
                tilePattern: "Large format 600×1200 marble-effect",
                wallTile: "Bianco Carrara porcelain",
                floorTile: "Travertine honed",
                fixtureFinish: "Brushed brass",
                fixtureBrand: "Hansgrohe",
                mirrorType: "Backlit LED rectangular",
                luxuryFeatures: ["Rain shower head", "Freestanding tub", "Heated flooring"],
            },
        },
    ],
    overallDesignNarrative: "Marina Heights embodies warm minimalism with a UAE-luxury sensibility.",
    designPhilosophy: "Understated elegance through natural materials and warm metallics.",
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Space Program", () => {
    test("builds residential rooms correctly", () => {
        const sp = buildSpaceProgram(mockProject);
        expect(sp.rooms.length).toBe(9);
        expect(sp.rooms[0].id).toBe("LVG");
        expect(sp.rooms[0].name).toBe("Living & Dining");
        expect(sp.totalFitoutBudgetAed).toBeGreaterThan(0);
    });

    test("builds hospitality rooms when typology is Hospitality", () => {
        const sp = buildSpaceProgram({ ...mockProject, ctx01Typology: "Hospitality" });
        expect(sp.rooms.length).toBe(6);
        expect(sp.rooms[0].id).toBe("LBY");
    });

    test("builds commercial rooms for office typology", () => {
        const sp = buildSpaceProgram({ ...mockProject, ctx01Typology: "Commercial" });
        expect(sp.rooms.length).toBe(6);
        expect(sp.rooms[0].id).toBe("OPN");
    });

    test("budget allocations sum to ~100%", () => {
        const sp = buildSpaceProgram(mockProject);
        const totalPct = sp.rooms.reduce((sum, r) => sum + r.budgetPct, 0);
        expect(totalPct).toBeCloseTo(1.0, 1);
    });

    test("sqm allocations sum to ~GFA", () => {
        const sp = buildSpaceProgram(mockProject);
        expect(sp.totalAllocatedSqm).toBeCloseTo(200, 0);
    });
});

describe("AI Design Advisor — Generate Recommendations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("generates recommendations for all rooms", async () => {
        (invokeLLM as any).mockResolvedValue({
            choices: [{
                message: { content: JSON.stringify(mockGeminiDesignResponse) },
            }],
        });

        const recs = await generateDesignRecommendations(mockProject, mockInputs, mockMaterials);

        expect(recs.length).toBe(9); // 9 residential rooms
        expect(recs[0].roomId).toBe("LVG");
        expect(recs[0].styleDirection).toBe("Warm minimalism with brass accents and limestone textures");
        expect(recs[0].materialPackage.length).toBeGreaterThan(0);
        expect(recs[0].budgetAllocation).toBeGreaterThan(0);
    });

    test("matches materials to library when available", async () => {
        (invokeLLM as any).mockResolvedValue({
            choices: [{
                message: { content: JSON.stringify(mockGeminiDesignResponse) },
            }],
        });

        const recs = await generateDesignRecommendations(mockProject, mockInputs, mockMaterials);
        const lvg = recs.find(r => r.roomId === "LVG")!;

        const floorMat = lvg.materialPackage.find(m => m.element === "floor");
        expect(floorMat).toBeDefined();
        expect(floorMat!.materialLibraryId).toBe(1); // Matched to Calacatta Gold
        expect(floorMat!.brand).toBe("Margraf");
    });

    test("includes kitchen spec for KIT rooms", async () => {
        (invokeLLM as any).mockResolvedValue({
            choices: [{
                message: { content: JSON.stringify(mockGeminiDesignResponse) },
            }],
        });

        const recs = await generateDesignRecommendations(mockProject, mockInputs, mockMaterials);
        const kit = recs.find(r => r.roomId === "KIT")!;

        expect(kit.kitchenSpec).toBeDefined();
        expect(kit.kitchenSpec!.layoutType).toBe("Island");
        expect(kit.kitchenSpec!.cabinetStyle).toBe("Handleless flat-panel");
        expect(kit.kitchenSpec!.applianceBrands).toContain("Bosch");
        expect(kit.kitchenSpec!.estimatedCostAed).toBeGreaterThan(0);
    });

    test("includes bathroom spec for MEN rooms", async () => {
        (invokeLLM as any).mockResolvedValue({
            choices: [{
                message: { content: JSON.stringify(mockGeminiDesignResponse) },
            }],
        });

        const recs = await generateDesignRecommendations(mockProject, mockInputs, mockMaterials);
        const men = recs.find(r => r.roomId === "MEN")!;

        expect(men.bathroomSpec).toBeDefined();
        expect(men.bathroomSpec!.showerType).toBe("walk-in");
        expect(men.bathroomSpec!.fixtureBrand).toBe("Hansgrohe");
        expect(men.bathroomSpec!.luxuryFeatures).toContain("Rain shower head");
        expect(men.bathroomSpec!.estimatedCostAed).toBeGreaterThan(0);
    });

    test("provides fallback recommendations for uncovered rooms", async () => {
        // AI only returns 3 rooms, but there are 9
        (invokeLLM as any).mockResolvedValue({
            choices: [{
                message: { content: JSON.stringify(mockGeminiDesignResponse) },
            }],
        });

        const recs = await generateDesignRecommendations(mockProject, mockInputs, mockMaterials);
        const bd2 = recs.find(r => r.roomId === "BD2")!;

        expect(bd2).toBeDefined();
        expect(bd2.aiRationale).toContain("Fallback");
        expect(bd2.budgetAllocation).toBeGreaterThan(0);
    });

    test("handles invalid Gemini response gracefully", async () => {
        (invokeLLM as any).mockResolvedValue({
            choices: [{ message: { content: "not json" } }],
        });

        await expect(
            generateDesignRecommendations(mockProject, mockInputs, mockMaterials)
        ).rejects.toThrow("invalid response format");
    });

    test("handles empty material library correctly", async () => {
        (invokeLLM as any).mockResolvedValue({
            choices: [{
                message: { content: JSON.stringify(mockGeminiDesignResponse) },
            }],
        });

        const recs = await generateDesignRecommendations(mockProject, mockInputs, []);
        const lvg = recs.find(r => r.roomId === "LVG")!;
        const floorMat = lvg.materialPackage.find(m => m.element === "floor");
        expect(floorMat!.materialLibraryId).toBeNull(); // No library match
    });
});

describe("AI Design Brief", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("generates a full design brief from recommendations", async () => {
        const mockBriefResponse = {
            executiveSummary: "Marina Heights is a luxury residential project in Dubai Prime.",
            designDirection: {
                overallStyle: "Warm Minimalism",
                colorStrategy: "Earth tones with brass accents",
                materialPhilosophy: "Natural materials with subtle luxury",
                lightingApproach: "Layered: ambient, task, accent",
                keyDifferentiators: ["Natural stone throughout", "Bespoke joinery"],
            },
            spaceBySpaceGuide: [
                {
                    roomId: "LVG",
                    roomName: "Living & Dining",
                    designIntent: "An elegant open-plan living space that flows seamlessly.",
                    keyMaterials: ["Calacatta Gold", "Walnut veneer"],
                    moodKeywords: ["warm", "luxurious", "contemporary"],
                    doList: ["Use layered lighting", "Consider integrated AV"],
                    dontList: ["Avoid cold white LED"],
                },
            ],
            deliverables: ["Concept package", "Material specs"],
            qualityGates: ["Client sign-off"],
            notes: ["Consider lead times for imported stone"],
        };

        (invokeLLM as any).mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(mockBriefResponse) } }],
        });

        const mockRecs = [
            {
                roomId: "LVG",
                roomName: "Living & Dining",
                sqm: 56,
                styleDirection: "Warm minimalism",
                colorScheme: "Earth tones",
                materialPackage: [
                    { productName: "Calacatta Gold", brand: "Margraf", element: "floor", category: "flooring" },
                ],
                budgetAllocation: 100000,
                budgetBreakdown: [],
                aiRationale: "test",
                specialNotes: [],
                alternatives: [],
            },
        ];

        const brief = await generateAIDesignBrief(mockProject, mockInputs, mockRecs as any);

        expect(brief.projectName).toBe("Marina Heights");
        expect(brief.executiveSummary).toContain("Marina Heights");
        expect(brief.designDirection.overallStyle).toBe("Warm Minimalism");
        expect(brief.budgetSummary.totalFitoutBudget).toBe(100000);
        expect(brief.spaceBySpaceGuide.length).toBe(1);
        expect(brief.supplierDirectory.length).toBeGreaterThan(0);
        expect(brief.supplierDirectory[0].name).toBe("Margraf");
    });
});
