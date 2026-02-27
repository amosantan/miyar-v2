/**
 * MIYAR — Sustainability Compliance Checklists (Phase D.1)
 *
 * Evaluates projects against two UAE green building standards:
 * 1. Estidama Pearl Rating System (Abu Dhabi UPC) — Pearl 1 to Pearl 5
 * 2. Al Sa'fat (Dubai Municipality) — Bronze, Silver, Gold, Platinum
 *
 * Each checklist item can be auto-evaluated from digital twin data
 * or left as "pending" for manual verification.
 */

// ─── Types ──────────────────────────────────────────────────────

export type ComplianceStatus = "pass" | "fail" | "pending" | "na";

export interface ChecklistItem {
    id: string;
    category: string;
    requirement: string;
    minTier: string;           // Minimum tier that requires this item
    autoEvaluated: boolean;    // Can be evaluated from digital twin data
    status: ComplianceStatus;
    notes?: string;
    score?: number;            // If numeric threshold, the measured value
    threshold?: number;        // Required threshold
    unit?: string;
}

export interface ComplianceResult {
    standard: "estidama" | "alsafat";
    standardLabel: string;
    achievedTier: string;
    maxPossibleTier: string;
    totalItems: number;
    passed: number;
    failed: number;
    pending: number;
    na: number;
    checklist: ChecklistItem[];
}

// ─── Digital Twin Data Interface ────────────────────────────────

interface TwinData {
    carbonPerSqm: number;
    energyPerSqm: number;
    coolingLoad: number;
    operationalEnergy: number;
    sustainabilityScore: number;
    carbonEfficiency: number;
    energyRating: number;
    materialCircularity: number;
    waterEfficiency: number;
    gfa: number;
    specLevel: string;
    location: string;
    includeRenewables?: boolean;
    waterRecycling?: boolean;
    glazingRatio?: number;
}

// ─── Estidama Pearl Rating System (Abu Dhabi) ───────────────────

const ESTIDAMA_TIERS = ["Pearl 1", "Pearl 2", "Pearl 3", "Pearl 4", "Pearl 5"] as const;

function buildEstidamaChecklist(twin: TwinData): ChecklistItem[] {
    return [
        // Integrated Development Process (IDP)
        {
            id: "EST-IDP-01",
            category: "Integrated Development Process",
            requirement: "Integrated development strategy documented",
            minTier: "Pearl 1",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "EST-IDP-02",
            category: "Integrated Development Process",
            requirement: "Life cycle cost analysis performed",
            minTier: "Pearl 2",
            autoEvaluated: true,
            status: twin.sustainabilityScore > 0 ? "pass" : "pending",
            notes: "Digital twin lifecycle analysis available",
        },

        // Natural Systems (NS)
        {
            id: "EST-NS-01",
            category: "Natural Systems",
            requirement: "Ecological assessment of site",
            minTier: "Pearl 1",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "EST-NS-02",
            category: "Natural Systems",
            requirement: "Native/adaptive landscaping (≥50%)",
            minTier: "Pearl 2",
            autoEvaluated: false,
            status: "pending",
        },

        // Livable Buildings (LB)
        {
            id: "EST-LB-01",
            category: "Livable Buildings",
            requirement: "Thermal comfort — indoor temp 22-25°C maintained",
            minTier: "Pearl 1",
            autoEvaluated: true,
            status: twin.energyRating >= 40 ? "pass" : "fail",
            score: twin.energyRating,
            threshold: 40,
            unit: "rating",
        },
        {
            id: "EST-LB-02",
            category: "Livable Buildings",
            requirement: "Daylight provision — glazing ratio optimized",
            minTier: "Pearl 1",
            autoEvaluated: true,
            status: (twin.glazingRatio ?? 0.3) >= 0.2 && (twin.glazingRatio ?? 0.3) <= 0.6 ? "pass" : "fail",
            score: (twin.glazingRatio ?? 0.3) * 100,
            threshold: 20,
            unit: "%",
            notes: "Glazing 20-60% acceptable",
        },
        {
            id: "EST-LB-03",
            category: "Livable Buildings",
            requirement: "Indoor air quality — ventilation per ASHRAE 62.1",
            minTier: "Pearl 2",
            autoEvaluated: false,
            status: "pending",
        },

        // Precious Water (PW)
        {
            id: "EST-PW-01",
            category: "Precious Water",
            requirement: "Water budget and monitoring plan",
            minTier: "Pearl 1",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "EST-PW-02",
            category: "Precious Water",
            requirement: "Efficient fixtures — 30% reduction vs baseline",
            minTier: "Pearl 2",
            autoEvaluated: true,
            status: twin.waterEfficiency >= 50 ? "pass" : "fail",
            score: twin.waterEfficiency,
            threshold: 50,
            unit: "score",
        },
        {
            id: "EST-PW-03",
            category: "Precious Water",
            requirement: "Greywater recycling system installed",
            minTier: "Pearl 3",
            autoEvaluated: true,
            status: twin.waterRecycling ? "pass" : "fail",
            notes: twin.waterRecycling ? "Water recycling enabled" : "No recycling system",
        },

        // Resourceful Energy (RE)
        {
            id: "EST-RE-01",
            category: "Resourceful Energy",
            requirement: "Energy monitoring & sub-metering",
            minTier: "Pearl 1",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "EST-RE-02",
            category: "Resourceful Energy",
            requirement: "Energy performance ≤120 kWh/m²/yr",
            minTier: "Pearl 2",
            autoEvaluated: true,
            status: twin.energyPerSqm <= 120 ? "pass" : "fail",
            score: twin.energyPerSqm,
            threshold: 120,
            unit: "kWh/m²/yr",
        },
        {
            id: "EST-RE-03",
            category: "Resourceful Energy",
            requirement: "Energy performance ≤90 kWh/m²/yr",
            minTier: "Pearl 3",
            autoEvaluated: true,
            status: twin.energyPerSqm <= 90 ? "pass" : "fail",
            score: twin.energyPerSqm,
            threshold: 90,
            unit: "kWh/m²/yr",
        },
        {
            id: "EST-RE-04",
            category: "Resourceful Energy",
            requirement: "On-site renewable energy (≥5% of demand)",
            minTier: "Pearl 3",
            autoEvaluated: true,
            status: twin.includeRenewables ? "pass" : "fail",
            notes: twin.includeRenewables ? "Renewables included" : "No on-site renewables",
        },
        {
            id: "EST-RE-05",
            category: "Resourceful Energy",
            requirement: "Energy performance ≤60 kWh/m²/yr (net zero pathway)",
            minTier: "Pearl 5",
            autoEvaluated: true,
            status: twin.energyPerSqm <= 60 ? "pass" : "fail",
            score: twin.energyPerSqm,
            threshold: 60,
            unit: "kWh/m²/yr",
        },

        // Stewarding Materials (SM)
        {
            id: "EST-SM-01",
            category: "Stewarding Materials",
            requirement: "Construction waste management plan",
            minTier: "Pearl 1",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "EST-SM-02",
            category: "Stewarding Materials",
            requirement: "Embodied carbon ≤500 kgCO₂e/m²",
            minTier: "Pearl 2",
            autoEvaluated: true,
            status: twin.carbonPerSqm <= 500 ? "pass" : "fail",
            score: twin.carbonPerSqm,
            threshold: 500,
            unit: "kgCO₂e/m²",
        },
        {
            id: "EST-SM-03",
            category: "Stewarding Materials",
            requirement: "Embodied carbon ≤350 kgCO₂e/m²",
            minTier: "Pearl 4",
            autoEvaluated: true,
            status: twin.carbonPerSqm <= 350 ? "pass" : "fail",
            score: twin.carbonPerSqm,
            threshold: 350,
            unit: "kgCO₂e/m²",
        },
        {
            id: "EST-SM-04",
            category: "Stewarding Materials",
            requirement: "≥20% recycled/reclaimed materials by value",
            minTier: "Pearl 3",
            autoEvaluated: true,
            status: twin.materialCircularity >= 50 ? "pass" : "fail",
            score: twin.materialCircularity,
            threshold: 50,
            unit: "score",
        },
    ];
}

// ─── Al Sa'fat — Dubai Green Building System ────────────────────

const ALSAFAT_TIERS = ["Bronze", "Silver", "Gold", "Platinum"] as const;

function buildAlSafatChecklist(twin: TwinData): ChecklistItem[] {
    return [
        // Energy Efficiency
        {
            id: "SAF-EN-01",
            category: "Energy Efficiency",
            requirement: "Building envelope U-value compliance (walls ≤0.57 W/m²K)",
            minTier: "Bronze",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "SAF-EN-02",
            category: "Energy Efficiency",
            requirement: "Glazing SHGC ≤0.25 for east/west facades",
            minTier: "Bronze",
            autoEvaluated: true,
            status: (twin.glazingRatio ?? 0.3) <= 0.4 ? "pass" : "fail",
            notes: "Lower glazing ratio reduces solar heat gain",
        },
        {
            id: "SAF-EN-03",
            category: "Energy Efficiency",
            requirement: "Energy performance ≤150 kWh/m²/yr",
            minTier: "Bronze",
            autoEvaluated: true,
            status: twin.energyPerSqm <= 150 ? "pass" : "fail",
            score: twin.energyPerSqm,
            threshold: 150,
            unit: "kWh/m²/yr",
        },
        {
            id: "SAF-EN-04",
            category: "Energy Efficiency",
            requirement: "Energy performance ≤110 kWh/m²/yr",
            minTier: "Silver",
            autoEvaluated: true,
            status: twin.energyPerSqm <= 110 ? "pass" : "fail",
            score: twin.energyPerSqm,
            threshold: 110,
            unit: "kWh/m²/yr",
        },
        {
            id: "SAF-EN-05",
            category: "Energy Efficiency",
            requirement: "Energy performance ≤80 kWh/m²/yr",
            minTier: "Gold",
            autoEvaluated: true,
            status: twin.energyPerSqm <= 80 ? "pass" : "fail",
            score: twin.energyPerSqm,
            threshold: 80,
            unit: "kWh/m²/yr",
        },
        {
            id: "SAF-EN-06",
            category: "Energy Efficiency",
            requirement: "On-site renewable energy generation",
            minTier: "Gold",
            autoEvaluated: true,
            status: twin.includeRenewables ? "pass" : "fail",
        },

        // Water Efficiency
        {
            id: "SAF-WA-01",
            category: "Water Efficiency",
            requirement: "Low-flow fixtures (≤8 L/min showers, ≤6 L flush)",
            minTier: "Bronze",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "SAF-WA-02",
            category: "Water Efficiency",
            requirement: "Condensate recovery from HVAC",
            minTier: "Silver",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "SAF-WA-03",
            category: "Water Efficiency",
            requirement: "Greywater treatment and reuse system",
            minTier: "Gold",
            autoEvaluated: true,
            status: twin.waterRecycling ? "pass" : "fail",
        },

        // Materials & Waste
        {
            id: "SAF-MW-01",
            category: "Materials & Waste",
            requirement: "Construction waste management (≥50% diversion)",
            minTier: "Bronze",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "SAF-MW-02",
            category: "Materials & Waste",
            requirement: "Embodied carbon assessment conducted",
            minTier: "Silver",
            autoEvaluated: true,
            status: twin.carbonPerSqm > 0 ? "pass" : "pending",
            notes: `Measured: ${twin.carbonPerSqm} kgCO₂e/m²`,
        },
        {
            id: "SAF-MW-03",
            category: "Materials & Waste",
            requirement: "Embodied carbon ≤400 kgCO₂e/m²",
            minTier: "Gold",
            autoEvaluated: true,
            status: twin.carbonPerSqm <= 400 ? "pass" : "fail",
            score: twin.carbonPerSqm,
            threshold: 400,
            unit: "kgCO₂e/m²",
        },
        {
            id: "SAF-MW-04",
            category: "Materials & Waste",
            requirement: "≥30% materials from recycled/regional sources",
            minTier: "Platinum",
            autoEvaluated: true,
            status: twin.materialCircularity >= 60 ? "pass" : "fail",
            score: twin.materialCircularity,
            threshold: 60,
            unit: "score",
        },

        // Indoor Environment
        {
            id: "SAF-IE-01",
            category: "Indoor Environment",
            requirement: "Low-VOC paints and adhesives",
            minTier: "Bronze",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "SAF-IE-02",
            category: "Indoor Environment",
            requirement: "Thermal comfort per ASHRAE 55",
            minTier: "Silver",
            autoEvaluated: true,
            status: twin.energyRating >= 45 ? "pass" : "fail",
            score: twin.energyRating,
            threshold: 45,
            unit: "rating",
        },

        // MEP Systems
        {
            id: "SAF-MEP-01",
            category: "MEP Systems",
            requirement: "District cooling connection or high-efficiency chiller (COP ≥5.5)",
            minTier: "Silver",
            autoEvaluated: false,
            status: "pending",
        },
        {
            id: "SAF-MEP-02",
            category: "MEP Systems",
            requirement: "BMS (Building Management System) installed",
            minTier: "Gold",
            autoEvaluated: false,
            status: "pending",
        },
    ];
}

// ─── Tier Achievement Calculator ────────────────────────────────

function determineEstidamaTier(checklist: ChecklistItem[]): string {
    for (let i = ESTIDAMA_TIERS.length - 1; i >= 0; i--) {
        const tier = ESTIDAMA_TIERS[i];
        const required = checklist.filter((c) => {
            const tierIndex = ESTIDAMA_TIERS.indexOf(c.minTier as any);
            return tierIndex >= 0 && tierIndex <= i;
        });
        const allPassed = required.every((c) => c.status === "pass" || c.status === "na");
        if (allPassed && required.length > 0) return tier;
    }
    return "Below Pearl 1";
}

function determineAlSafatTier(checklist: ChecklistItem[]): string {
    for (let i = ALSAFAT_TIERS.length - 1; i >= 0; i--) {
        const tier = ALSAFAT_TIERS[i];
        const required = checklist.filter((c) => {
            const tierIndex = ALSAFAT_TIERS.indexOf(c.minTier as any);
            return tierIndex >= 0 && tierIndex <= i;
        });
        const allPassed = required.every((c) => c.status === "pass" || c.status === "na");
        if (allPassed && required.length > 0) return tier;
    }
    return "Below Bronze";
}

// ─── Public API ─────────────────────────────────────────────────

export function evaluateEstidama(twin: TwinData): ComplianceResult {
    const checklist = buildEstidamaChecklist(twin);
    const passed = checklist.filter((c) => c.status === "pass").length;
    const failed = checklist.filter((c) => c.status === "fail").length;
    const pending = checklist.filter((c) => c.status === "pending").length;
    const na = checklist.filter((c) => c.status === "na").length;

    return {
        standard: "estidama",
        standardLabel: "Estidama Pearl Rating (Abu Dhabi UPC)",
        achievedTier: determineEstidamaTier(checklist),
        maxPossibleTier: "Pearl 5",
        totalItems: checklist.length,
        passed,
        failed,
        pending,
        na,
        checklist,
    };
}

export function evaluateAlSafat(twin: TwinData): ComplianceResult {
    const checklist = buildAlSafatChecklist(twin);
    const passed = checklist.filter((c) => c.status === "pass").length;
    const failed = checklist.filter((c) => c.status === "fail").length;
    const pending = checklist.filter((c) => c.status === "pending").length;
    const na = checklist.filter((c) => c.status === "na").length;

    return {
        standard: "alsafat",
        standardLabel: "Al Sa'fat (Dubai Green Building Regulations)",
        achievedTier: determineAlSafatTier(checklist),
        maxPossibleTier: "Platinum",
        totalItems: checklist.length,
        passed,
        failed,
        pending,
        na,
        checklist,
    };
}

export function evaluateCompliance(twin: TwinData): {
    estidama: ComplianceResult;
    alsafat: ComplianceResult;
} {
    return {
        estidama: evaluateEstidama(twin),
        alsafat: evaluateAlSafat(twin),
    };
}
