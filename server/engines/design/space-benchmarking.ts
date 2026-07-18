/**
 * Space Ratio Benchmarking Engine (Phase 9 — Pillar B)
 *
 * Compares AI-extracted floor-plan room ratios with versioned MIYAR ratio
 * guidelines. DLD transaction counts may be retained as separate area context;
 * they do not calibrate the ratios, scores, or scenario coefficients here.
 */

import type { FloorPlanAnalysis, AnalyzedRoom } from "./floor-plan-analyzer";
import type { SpaceEfficiencyEvidence } from "../../../shared/miyar-types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpaceRecommendation {
    roomName: string;
    roomType: string;
    currentPercent: number;
    benchmarkPercent: number;   // MIYAR ratio guideline
    delta: number;              // positive = oversized, negative = undersized
    financialImpact: string;    // labelled MIYAR scenario-proxy statement
    severity: "critical" | "advisory" | "optimal";
    dataSource: string;         // guideline identity plus separate market context
    action: string;             // specific recommended action
}

export interface SpaceBenchmarkResult {
    recommendations: SpaceRecommendation[];
    overallEfficiencyScore: number;  // 0-100
    circulationWastePercent: number;
    balconyToLivingRatio: number;
    totalCritical: number;
    totalAdvisory: number;
    totalOptimal: number;
    unitType: string;
    areaName: string;
    evidence: SpaceEfficiencyEvidence;
}

// ─── Benchmark Data ──────────────────────────────────────────────────────────

/**
 * MIYAR residential ratio guidelines by room type. They are deterministic
 * scenario inputs, not official DLD ratios or proven causal price effects.
 */
interface RoomBenchmark {
    optimalPercent: number;
    tolerancePct: number;      // acceptable deviation before flagging
    priceImpactPerPct: number; // indicative scenario-sensitivity coefficient
    priority: "high" | "medium" | "low";
}

// Benchmarks vary by unit type (bedroom count)
const RESIDENTIAL_BENCHMARKS: Record<string, Record<string, RoomBenchmark>> = {
    // Studio apartments
    "Studio": {
        living: { optimalPercent: 55, tolerancePct: 5, priceImpactPerPct: 0.8, priority: "high" },
        kitchen: { optimalPercent: 12, tolerancePct: 3, priceImpactPerPct: 0.5, priority: "medium" },
        bathroom: { optimalPercent: 10, tolerancePct: 2, priceImpactPerPct: 0.3, priority: "medium" },
        balcony: { optimalPercent: 10, tolerancePct: 3, priceImpactPerPct: 0.6, priority: "medium" },
        corridor: { optimalPercent: 8, tolerancePct: 3, priceImpactPerPct: -0.5, priority: "low" },
        storage: { optimalPercent: 3, tolerancePct: 2, priceImpactPerPct: 0.2, priority: "low" },
    },
    // 1-Bedroom
    "1BR": {
        bedroom: { optimalPercent: 22, tolerancePct: 3, priceImpactPerPct: 0.7, priority: "high" },
        living: { optimalPercent: 30, tolerancePct: 4, priceImpactPerPct: 0.9, priority: "high" },
        kitchen: { optimalPercent: 10, tolerancePct: 2, priceImpactPerPct: 0.5, priority: "high" },
        bathroom: { optimalPercent: 9, tolerancePct: 2, priceImpactPerPct: 0.3, priority: "medium" },
        balcony: { optimalPercent: 10, tolerancePct: 3, priceImpactPerPct: 0.6, priority: "medium" },
        corridor: { optimalPercent: 10, tolerancePct: 3, priceImpactPerPct: -0.5, priority: "low" },
        dressing: { optimalPercent: 4, tolerancePct: 2, priceImpactPerPct: 0.4, priority: "medium" },
    },
    // 2-Bedroom
    "2BR": {
        bedroom: { optimalPercent: 26, tolerancePct: 3, priceImpactPerPct: 0.6, priority: "high" },
        living: { optimalPercent: 26, tolerancePct: 4, priceImpactPerPct: 1.0, priority: "high" },
        kitchen: { optimalPercent: 9, tolerancePct: 2, priceImpactPerPct: 0.6, priority: "high" },
        bathroom: { optimalPercent: 10, tolerancePct: 2, priceImpactPerPct: 0.3, priority: "medium" },
        balcony: { optimalPercent: 9, tolerancePct: 3, priceImpactPerPct: 0.7, priority: "high" },
        corridor: { optimalPercent: 12, tolerancePct: 3, priceImpactPerPct: -0.4, priority: "low" },
        dressing: { optimalPercent: 4, tolerancePct: 2, priceImpactPerPct: 0.3, priority: "medium" },
    },
    // 3-Bedroom (+Maid)
    "3BR": {
        bedroom: { optimalPercent: 28, tolerancePct: 3, priceImpactPerPct: 0.5, priority: "high" },
        living: { optimalPercent: 22, tolerancePct: 3, priceImpactPerPct: 1.2, priority: "high" },
        dining: { optimalPercent: 6, tolerancePct: 2, priceImpactPerPct: 0.4, priority: "medium" },
        kitchen: { optimalPercent: 8, tolerancePct: 2, priceImpactPerPct: 0.7, priority: "high" },
        bathroom: { optimalPercent: 11, tolerancePct: 2, priceImpactPerPct: 0.3, priority: "medium" },
        balcony: { optimalPercent: 8, tolerancePct: 3, priceImpactPerPct: 0.8, priority: "high" },
        corridor: { optimalPercent: 10, tolerancePct: 3, priceImpactPerPct: -0.3, priority: "low" },
        maid: { optimalPercent: 3, tolerancePct: 1, priceImpactPerPct: 0.5, priority: "medium" },
        dressing: { optimalPercent: 4, tolerancePct: 2, priceImpactPerPct: 0.4, priority: "medium" },
    },
    // 4+ Bedroom / Penthouse
    "4BR+": {
        bedroom: { optimalPercent: 30, tolerancePct: 4, priceImpactPerPct: 0.4, priority: "high" },
        living: { optimalPercent: 20, tolerancePct: 3, priceImpactPerPct: 1.5, priority: "high" },
        dining: { optimalPercent: 6, tolerancePct: 2, priceImpactPerPct: 0.5, priority: "medium" },
        kitchen: { optimalPercent: 7, tolerancePct: 2, priceImpactPerPct: 0.8, priority: "high" },
        bathroom: { optimalPercent: 12, tolerancePct: 2, priceImpactPerPct: 0.3, priority: "medium" },
        balcony: { optimalPercent: 7, tolerancePct: 3, priceImpactPerPct: 1.0, priority: "high" },
        corridor: { optimalPercent: 8, tolerancePct: 3, priceImpactPerPct: -0.3, priority: "low" },
        maid: { optimalPercent: 3, tolerancePct: 1, priceImpactPerPct: 0.4, priority: "medium" },
        dressing: { optimalPercent: 5, tolerancePct: 2, priceImpactPerPct: 0.5, priority: "high" },
        office: { optimalPercent: 4, tolerancePct: 2, priceImpactPerPct: 0.3, priority: "medium" },
    },
};

// ─── Main Function ───────────────────────────────────────────────────────────

export function benchmarkSpaceRatios(
    analysis: FloorPlanAnalysis,
    areaName: string,
    transactionCount: number = 0,
    _saleP50: number | null = null,
): SpaceBenchmarkResult {
    if (analysis.rooms.length === 0) {
        return {
            recommendations: [],
            overallEfficiencyScore: 50,
            circulationWastePercent: Math.round(analysis.circulationPercentage * 10) / 10,
            balconyToLivingRatio: 0,
            totalCritical: 0,
            totalAdvisory: 0,
            totalOptimal: 0,
            unitType: analysis.unitType,
            areaName,
            evidence: {
                status: "neutral_fallback",
                reason: "no_rooms_detected",
                roomCount: 0,
                benchmarkBasis: "not_applied",
                transactionCount: 0,
            },
        };
    }

    // Determine which benchmark set to use
    const bedroomCount = analysis.bedroomCount;
    let benchmarkKey = "3BR"; // default
    if (bedroomCount === 0) benchmarkKey = "Studio";
    else if (bedroomCount === 1) benchmarkKey = "1BR";
    else if (bedroomCount === 2) benchmarkKey = "2BR";
    else if (bedroomCount === 3) benchmarkKey = "3BR";
    else benchmarkKey = "4BR+";

    const benchmarks = RESIDENTIAL_BENCHMARKS[benchmarkKey] || RESIDENTIAL_BENCHMARKS["3BR"];

    const dataSource = transactionCount > 0
        ? `MIYAR ratio guideline; separate DLD area context: ${areaName}, n=${transactionCount}`
        : `MIYAR UAE ratio guideline (${areaName})`;

    const recommendations: SpaceRecommendation[] = [];

    // Aggregate rooms by type for comparison (e.g., sum all bedrooms)
    const roomsByType = new Map<string, { totalPercent: number; rooms: AnalyzedRoom[] }>();
    for (const room of analysis.rooms) {
        const type = room.type;
        if (!roomsByType.has(type)) roomsByType.set(type, { totalPercent: 0, rooms: [] });
        const entry = roomsByType.get(type)!;
        entry.totalPercent += room.percentOfTotal;
        entry.rooms.push(room);
    }

    // Compare each room type against benchmarks
    for (const [roomType, benchmark] of Object.entries(benchmarks)) {
        const actual = roomsByType.get(roomType);
        const currentPercent = actual?.totalPercent || 0;
        const delta = currentPercent - benchmark.optimalPercent;
        const absDelta = Math.abs(delta);

        // Determine severity
        let severity: "critical" | "advisory" | "optimal" = "optimal";
        if (absDelta > benchmark.tolerancePct * 2) severity = "critical";
        else if (absDelta > benchmark.tolerancePct) severity = "advisory";

        // Calculate financial impact
        const priceImpact = delta * benchmark.priceImpactPerPct;
        const impactDirection = priceImpact > 0 ? "+" : "";
        const impactAbs = Math.abs(priceImpact);

        let financialImpact = "";
        let action = "";

        if (severity === "optimal") {
            financialImpact = `${roomType} ratio is within the MIYAR guideline range for ${areaName}`;
            action = "No change suggested — this allocation is within the MIYAR ratio guideline";
        } else if (delta < 0) {
            // Undersized
            const increaseBy = Math.round(absDelta);
            financialImpact = `MIYAR scenario coefficient: ${impactAbs.toFixed(1)}% indicative sensitivity for a ${increaseBy}% NFA adjustment; not a predicted or DLD-calibrated sale uplift (${dataSource})`;
            action = `Consider increasing ${roomType} allocation from ${currentPercent.toFixed(1)}% to ${benchmark.optimalPercent}% of NFA`;
        } else {
            // Oversized
            const decreaseBy = Math.round(absDelta);
            if (benchmark.priceImpactPerPct < 0) {
                // Corridors/circulation — oversized is bad
                financialImpact = `MIYAR ratio proxy: ${roomType} is ${decreaseBy}% above the guideline range; no sale-price outcome is claimed (${dataSource})`;
                action = `Reduce ${roomType} from ${currentPercent.toFixed(1)}% to ${benchmark.optimalPercent}% — reallocate to living/bedroom space`;
            } else {
                financialImpact = `MIYAR ratio proxy: ${roomType} is ${decreaseBy}% above the guideline range of ${(benchmark.optimalPercent + benchmark.tolerancePct)}%; no market-return claim is made (${dataSource})`;
                action = `${roomType} at ${currentPercent.toFixed(1)}% exceeds typical allocation. Consider redistributing excess to other high-impact rooms`;
            }
        }

        const roomLabel = actual?.rooms.map(r => r.name).join(", ") || roomType;

        recommendations.push({
            roomName: roomLabel,
            roomType,
            currentPercent: Math.round(currentPercent * 10) / 10,
            benchmarkPercent: benchmark.optimalPercent,
            delta: Math.round(delta * 10) / 10,
            financialImpact,
            severity,
            dataSource,
            action,
        });
    }

    // Sort: critical first, then advisory, then optimal
    const severityOrder = { critical: 0, advisory: 1, optimal: 2 };
    recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Calculate overall efficiency score
    const totalCritical = recommendations.filter(r => r.severity === "critical").length;
    const totalAdvisory = recommendations.filter(r => r.severity === "advisory").length;
    const totalOptimal = recommendations.filter(r => r.severity === "optimal").length;
    const total = recommendations.length;

    const efficiencyScore = total > 0
        ? Math.round(((totalOptimal * 100 + totalAdvisory * 60 + totalCritical * 20) / total))
        : 50;

    // Balcony to living ratio
    const balconyPct = roomsByType.get("balcony")?.totalPercent || 0;
    const livingPct = roomsByType.get("living")?.totalPercent || 0;
    const balconyToLivingRatio = livingPct > 0 ? Math.round((balconyPct / livingPct) * 100) / 100 : 0;

    return {
        recommendations,
        overallEfficiencyScore: Math.max(0, Math.min(100, efficiencyScore)),
        circulationWastePercent: Math.round(analysis.circulationPercentage * 10) / 10,
        balconyToLivingRatio,
        totalCritical,
        totalAdvisory,
        totalOptimal,
        unitType: analysis.unitType,
        areaName,
        evidence: {
            status: "measured",
            roomCount: analysis.rooms.length,
            benchmarkBasis: transactionCount > 0 ? "dld_area" : "miyar_uae",
            transactionCount: Math.max(0, Math.trunc(transactionCount)),
        },
    };
}
