/**
 * Digital Twin & Sustainability Engine (Phase H)
 *
 * Computes a building's environmental profile:
 *   - Embodied Carbon (kgCO₂e) per material
 *   - Operational Energy (kWh/yr) — cooling, lighting, equipment
 *   - 30-year Lifecycle Cost (construction + maintenance + energy + end-of-life)
 *   - Composite Sustainability Score (0-100)
 *
 * Material carbon intensity data based on ICE Database v3,
 * adapted for UAE/GCC construction context.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type MaterialType =
    | "concrete" | "steel" | "glass" | "aluminum"
    | "timber" | "stone" | "gypsum" | "insulation" | "ceramic";

export interface MaterialMix {
    material: MaterialType;
    percentage: number; // 0-100, sum should be ~100
}

export interface DigitalTwinConfig {
    gfa: number;                  // gross floor area (m²)
    floors: number;               // number of floors
    specLevel: "economy" | "standard" | "premium" | "luxury";
    glazingRatio: number;         // 0-1 (facade glazing percentage)
    materials: MaterialMix[];     // material composition
    location: "dubai" | "abu_dhabi" | "sharjah" | "other_gcc" | "temperate";
    sustainabilityRating?: number; // existing des05 rating (1-4)
    includeRenewables?: boolean;
    waterRecycling?: boolean;
}

export interface CarbonBreakdownItem {
    material: string;
    kgCO2e: number;
    percentage: number;
    intensity: number;  // kgCO₂e per m²
}

export interface LifecyclePoint {
    year: number;
    cumulativeCost: number;      // AED
    maintenanceCost: number;
    energyCost: number;
    constructionCost: number;
}

export interface DigitalTwinResult {
    sustainabilityScore: number;  // 0-100
    sustainabilityGrade: string;  // A+ to F

    // Carbon
    totalEmbodiedCarbon: number;  // kgCO₂e total
    carbonPerSqm: number;        // kgCO₂e/m²
    carbonBreakdown: CarbonBreakdownItem[];

    // Energy
    operationalEnergy: number;     // kWh/yr total
    energyPerSqm: number;         // kWh/m²/yr
    coolingLoad: number;           // kWh/yr
    lightingLoad: number;
    equipmentLoad: number;

    // Lifecycle
    lifecycleCost30yr: number | null;     // AED
    lifecycleCostPerSqm: number | null;   // AED/m²
    lifecycleCostResolutionState: "insufficient";
    lifecycle: LifecyclePoint[];

    // Scores
    carbonEfficiency: number;      // 0-100
    energyRating: number;          // 0-100
    materialCircularity: number;   // 0-100
    waterEfficiency: number;       // 0-100

    recommendations: string[];
    config: DigitalTwinConfig;
}

// ─── Material Database (ICE v3 adapted for GCC) ─────────────────────────────

interface MaterialData {
    carbonIntensity: number;    // kgCO₂e per kg
    density: number;            // kg per m³
    typicalThickness: number;   // metres (for qty estimation)
    recyclability: number;      // 0-1
    maintenanceFactor: number;  // annual % of install cost
}

const MATERIAL_DB: Record<MaterialType, MaterialData> = {
    concrete: { carbonIntensity: 0.159, density: 2400, typicalThickness: 0.25, recyclability: 0.65, maintenanceFactor: 0.005 },
    steel: { carbonIntensity: 1.550, density: 7850, typicalThickness: 0.015, recyclability: 0.90, maintenanceFactor: 0.008 },
    glass: { carbonIntensity: 0.860, density: 2500, typicalThickness: 0.012, recyclability: 0.40, maintenanceFactor: 0.015 },
    aluminum: { carbonIntensity: 8.240, density: 2700, typicalThickness: 0.003, recyclability: 0.95, maintenanceFactor: 0.010 },
    timber: { carbonIntensity: 0.460, density: 600, typicalThickness: 0.10, recyclability: 0.70, maintenanceFactor: 0.020 },
    stone: { carbonIntensity: 0.079, density: 2600, typicalThickness: 0.03, recyclability: 0.30, maintenanceFactor: 0.003 },
    gypsum: { carbonIntensity: 0.120, density: 1000, typicalThickness: 0.013, recyclability: 0.20, maintenanceFactor: 0.010 },
    insulation: { carbonIntensity: 1.860, density: 30, typicalThickness: 0.10, recyclability: 0.15, maintenanceFactor: 0.002 },
    ceramic: { carbonIntensity: 0.740, density: 2000, typicalThickness: 0.01, recyclability: 0.10, maintenanceFactor: 0.005 },
};

// Climate factors (cooling degree days multiplier)
const CLIMATE_FACTOR: Record<string, number> = {
    dubai: 1.35,
    abu_dhabi: 1.40,
    sharjah: 1.30,
    other_gcc: 1.25,
    temperate: 0.70,
};

// Spec level multipliers
const SPEC_MULTIPLIER: Record<string, number> = {
    economy: 0.75,
    standard: 1.0,
    premium: 1.3,
    luxury: 1.65,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, v));
}

function gradeFromScore(score: number): string {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B+";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    if (score >= 40) return "D";
    return "F";
}

// ─── Carbon Calculator ──────────────────────────────────────────────────────

function calculateEmbodiedCarbon(config: DigitalTwinConfig): {
    total: number;
    perSqm: number;
    breakdown: CarbonBreakdownItem[];
} {
    const totalArea = config.gfa * config.floors;
    const breakdown: CarbonBreakdownItem[] = [];
    let totalCarbon = 0;

    for (const mix of config.materials) {
        const mat = MATERIAL_DB[mix.material];
        if (!mat) continue;

        // Estimate material volume: area × percentage × typical thickness
        const areaShare = totalArea * (mix.percentage / 100);
        const volume = areaShare * mat.typicalThickness;
        const mass = volume * mat.density;
        const carbon = mass * mat.carbonIntensity;

        totalCarbon += carbon;
        breakdown.push({
            material: mix.material,
            kgCO2e: Math.round(carbon),
            percentage: 0, // filled after
            intensity: Math.round(carbon / areaShare),
        });
    }

    // Fill percentages
    for (const item of breakdown) {
        item.percentage = totalCarbon > 0
            ? Math.round((item.kgCO2e / totalCarbon) * 100)
            : 0;
    }

    // Sort by carbon descending
    breakdown.sort((a, b) => b.kgCO2e - a.kgCO2e);

    return {
        total: Math.round(totalCarbon),
        perSqm: Math.round(totalCarbon / config.gfa),
        breakdown,
    };
}

// ─── Energy Calculator ──────────────────────────────────────────────────────

function calculateOperationalEnergy(config: DigitalTwinConfig): {
    total: number;
    perSqm: number;
    cooling: number;
    lighting: number;
    equipment: number;
} {
    const climateFactor = CLIMATE_FACTOR[config.location] || 1.0;
    const specMult = SPEC_MULTIPLIER[config.specLevel] || 1.0;

    // Base energy intensity (kWh/m²/yr) for UAE commercial/residential
    const baseEUI = 180; // UAE average ~180 kWh/m²/yr

    // Cooling: heavily influenced by glazing and climate
    const glazingPenalty = 1 + (config.glazingRatio - 0.3) * 1.5; // >30% glazing = more cooling
    const coolingFraction = 0.55 * climateFactor * Math.max(0.5, glazingPenalty);

    // Renewables offset
    const renewableOffset = config.includeRenewables ? 0.85 : 1.0;

    const totalEUI = baseEUI * specMult * renewableOffset;
    const cooling = totalEUI * coolingFraction;
    const lighting = totalEUI * 0.25;
    const equipment = totalEUI * (1 - coolingFraction - 0.25);

    return {
        total: Math.round(totalEUI * config.gfa),
        perSqm: Math.round(totalEUI),
        cooling: Math.round(cooling * config.gfa),
        lighting: Math.round(lighting * config.gfa),
        equipment: Math.round(Math.max(0, equipment * config.gfa)),
    };
}

// ─── Sustainability Scores ──────────────────────────────────────────────────

function scoreCarbonEfficiency(carbonPerSqm: number): number {
    // UAE benchmark: ~800 kgCO₂e/m² is average, <400 is excellent
    if (carbonPerSqm <= 200) return 100;
    if (carbonPerSqm >= 1200) return 10;
    return clamp(Math.round(100 - ((carbonPerSqm - 200) / 1000) * 90));
}

function scoreEnergyRating(euiPerSqm: number, hasRenewables: boolean): number {
    // UAE benchmark: ~180 kWh/m²/yr average, <100 is excellent
    let score = 0;
    if (euiPerSqm <= 80) score = 100;
    else if (euiPerSqm >= 300) score = 10;
    else score = Math.round(100 - ((euiPerSqm - 80) / 220) * 90);
    if (hasRenewables) score = Math.min(100, score + 10);
    return clamp(score);
}

function scoreMaterialCircularity(materials: MaterialMix[]): number {
    let weightedRecyclability = 0;
    for (const mix of materials) {
        const mat = MATERIAL_DB[mix.material];
        if (!mat) continue;
        weightedRecyclability += mat.recyclability * (mix.percentage / 100);
    }
    return clamp(Math.round(weightedRecyclability * 100));
}

function scoreWaterEfficiency(hasRecycling: boolean, specLevel: string): number {
    let score = 40; // baseline
    if (hasRecycling) score += 35;
    if (specLevel === "premium" || specLevel === "luxury") score += 15;
    else if (specLevel === "standard") score += 10;
    return clamp(score);
}

// ─── Recommendations ────────────────────────────────────────────────────────

function generateRecommendations(
    carbonEff: number,
    energyRating: number,
    circularity: number,
    waterEff: number,
    config: DigitalTwinConfig,
): string[] {
    const recs: string[] = [];

    if (carbonEff < 50) {
        const highCarbon = config.materials
            .sort((a, b) => {
                const ca = MATERIAL_DB[a.material]?.carbonIntensity || 0;
                const cb = MATERIAL_DB[b.material]?.carbonIntensity || 0;
                return cb - ca;
            })[0];
        if (highCarbon) {
            recs.push(`🏗️ Consider reducing ${highCarbon.material} usage — it has the highest carbon intensity in your material mix.`);
        }
        recs.push("♻️ Explore low-carbon concrete alternatives (GGBS, fly ash) to reduce embodied carbon by 30-50%.");
    }

    if (energyRating < 50) {
        if (config.glazingRatio > 0.4) {
            recs.push("🪟 Reduce glazing ratio below 40% or use high-performance low-E glass to cut cooling loads.");
        }
        if (!config.includeRenewables) {
            recs.push("☀️ Add rooftop solar PV to offset 15-25% of operational energy consumption.");
        }
    }

    if (circularity < 50) {
        recs.push("🔄 Incorporate design-for-disassembly principles and prefer materials with >70% recyclability.");
    }

    if (waterEff < 50 && !config.waterRecycling) {
        recs.push("💧 Implement greywater recycling and condensate recovery to improve water efficiency by 40%.");
    }

    if (recs.length === 0) {
        recs.push("🌟 Excellent sustainability profile — consider pursuing Estidama Pearl or LEED certification.");
    }

    return recs.slice(0, 5);
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export function computeDigitalTwin(config: DigitalTwinConfig): DigitalTwinResult {
    const carbon = calculateEmbodiedCarbon(config);
    const energy = calculateOperationalEnergy(config);

    const carbonEfficiency = scoreCarbonEfficiency(carbon.perSqm);
    const energyRating = scoreEnergyRating(energy.perSqm, !!config.includeRenewables);
    const materialCircularity = scoreMaterialCircularity(config.materials);
    const waterEfficiency = scoreWaterEfficiency(!!config.waterRecycling, config.specLevel);

    // Composite sustainability score
    const sustainabilityScore = Math.round(
        carbonEfficiency * 0.35 +
        energyRating * 0.30 +
        materialCircularity * 0.20 +
        waterEfficiency * 0.15
    );

    const recommendations = generateRecommendations(
        carbonEfficiency, energyRating, materialCircularity, waterEfficiency, config
    );

    return {
        sustainabilityScore,
        sustainabilityGrade: gradeFromScore(sustainabilityScore),
        totalEmbodiedCarbon: carbon.total,
        carbonPerSqm: carbon.perSqm,
        carbonBreakdown: carbon.breakdown,
        operationalEnergy: energy.total,
        energyPerSqm: energy.perSqm,
        coolingLoad: energy.cooling,
        lightingLoad: energy.lighting,
        equipmentLoad: energy.equipment,
        lifecycleCost30yr: null,
        lifecycleCostPerSqm: null,
        lifecycleCostResolutionState: "insufficient",
        lifecycle: [],
        carbonEfficiency,
        energyRating,
        materialCircularity,
        waterEfficiency,
        recommendations,
        config,
    };
}
