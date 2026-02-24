/**
 * Phase 1: Smart Design Brain — Type Definitions
 * Per-space AI recommendations, kitchen/bath specialization, design packages.
 */

// ─── Space Recommendation Types ─────────────────────────────────────────────

export interface MaterialRec {
    materialLibraryId: number | null;
    productName: string;
    brand: string;
    category: string;
    element: string;            // "floor", "wall_primary", etc.
    priceRangeAed: string;      // "120-180 AED/sqm"
    alternativeId?: number | null;
    alternativeName?: string;
    aiRationale: string;        // Why this material was chosen
}

export interface BudgetBreakdownItem {
    element: string;
    amount: number;             // AED
    percentage: number;         // of room budget
}

export interface AlternativePackage {
    name: string;               // "Budget-Friendly" | "Premium Upgrade"
    priceDelta: number;         // AED difference from primary
    materials: MaterialRec[];
    rationale: string;
}

export interface SpaceRecommendation {
    roomId: string;
    roomName: string;
    sqm: number;
    styleDirection: string;          // "Warm Minimalism with brass accents"
    colorScheme: string;             // "Earth tones: sand, warm grey, walnut"
    materialPackage: MaterialRec[];
    budgetAllocation: number;        // AED
    budgetBreakdown: BudgetBreakdownItem[];
    aiRationale: string;             // Why this style/direction
    specialNotes: string[];          // Tips for interior designers
    alternatives: AlternativePackage[];
    kitchenSpec?: KitchenSpec;
    bathroomSpec?: BathroomSpec;
}

// ─── Kitchen Specialization ─────────────────────────────────────────────────

export type KitchenLayout = "L-shape" | "U-shape" | "Island" | "Galley" | "Peninsula" | "One-wall";

export interface KitchenSpec {
    layoutType: KitchenLayout;
    layoutRationale: string;         // Why this layout fits
    cabinetStyle: string;            // "Handleless flat-panel in warm walnut"
    cabinetFinish: string;           // "Veneer" | "Lacquer" | "Laminate"
    countertopMaterial: string;      // "Calacatta quartz, 20mm polished"
    countertopPriceRange: string;
    backsplash: string;              // "Zellige tile in bone"
    sinkType: string;                // "Undermount stainless" | "Integrated composite"
    applianceLevel: "standard" | "premium" | "professional";
    applianceBrands: string[];       // ["Bosch", "Siemens"] or ["Gaggenau", "Miele"]
    storageFeatures: string[];       // ["Pull-out pantry", "Corner carousel"]
    estimatedCostAed: number;
}

// ─── Bathroom Specialization ────────────────────────────────────────────────

export type ShowerType = "walk-in" | "enclosed" | "wet-room" | "bath-shower-combo";

export interface BathroomSpec {
    showerType: ShowerType;
    vanityStyle: string;             // "Wall-mounted double vanity in stone"
    vanityWidth: string;             // "1200mm" | "1500mm"
    tilePattern: string;             // "Large format 600×1200 marble-effect"
    wallTile: string;
    floorTile: string;
    fixtureFinish: string;           // "Brushed brass" | "Matte black" | "Chrome"
    fixtureBrand: string;            // "Hansgrohe" | "Grohe" | "Kohler"
    mirrorType: string;              // "Backlit LED rectangular"
    luxuryFeatures: string[];        // ["Rain shower head", "Freestanding tub"]
    estimatedCostAed: number;
}

// ─── Design Package (Reusable Templates) ────────────────────────────────────

export interface DesignPackage {
    id?: number;
    name: string;                    // "Modern Luxury — Dubai Marina"
    typology: string;
    tier: string;
    style: string;
    description: string;
    targetBudgetPerSqm: number;
    rooms: SpaceRecommendation[];
    isTemplate: boolean;             // true = reusable standard package
}

// ─── AI Design Brief ────────────────────────────────────────────────────────

export interface AIDesignBrief {
    projectName: string;
    preparedFor: string;
    generatedAt: string;
    version: string;

    executiveSummary: string;
    designDirection: {
        overallStyle: string;
        colorStrategy: string;
        materialPhilosophy: string;
        lightingApproach: string;
        keyDifferentiators: string[];
    };

    spaceBySpaceGuide: SpaceBriefEntry[];

    budgetSummary: {
        totalFitoutBudget: number;
        costPerSqm: number;
        allocationBySpace: { room: string; amount: number; pct: number }[];
        contingency: number;
    };

    materialSpecifications: {
        primary: MaterialRec[];
        secondary: MaterialRec[];
        accent: MaterialRec[];
    };

    supplierDirectory: {
        name: string;
        categories: string[];
        contact?: string;
        location?: string;
    }[];

    deliverables: string[];
    qualityGates: string[];
    notes: string[];
}

export interface SpaceBriefEntry {
    roomId: string;
    roomName: string;
    designIntent: string;     // AI-written narrative
    keyMaterials: string[];
    moodKeywords: string[];
    doList: string[];          // "Use warm LED strips under floating vanity"
    dontList: string[];        // "Avoid glossy surfaces in bedrooms"
}

// ─── Gemini Response Schema ─────────────────────────────────────────────────

export interface GeminiDesignResponse {
    spaces: {
        roomId: string;
        roomName: string;
        styleDirection: string;
        colorScheme: string;
        rationale: string;
        specialNotes: string[];
        materials: {
            element: string;
            productName: string;
            brand: string;
            priceRange: string;
            rationale: string;
        }[];
        budgetBreakdown: { element: string; percentage: number }[];
        kitchenSpec?: Omit<KitchenSpec, "estimatedCostAed">;
        bathroomSpec?: Omit<BathroomSpec, "estimatedCostAed">;
    }[];
    overallDesignNarrative: string;
    designPhilosophy: string;
}
