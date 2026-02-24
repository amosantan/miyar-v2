/**
 * V11: Cognitive Bias Framework — Type Definitions & Constants
 * Detects psychological biases in real estate project evaluation inputs.
 */

// ─── Bias Types ─────────────────────────────────────────────────────────────

export const BIAS_TYPES = [
    "optimism_bias",
    "anchoring_bias",
    "confirmation_bias",
    "overconfidence",
    "scope_creep",
    "sunk_cost",
    "clustering_illusion",
] as const;

export type BiasType = (typeof BIAS_TYPES)[number];

export type BiasSeverity = "low" | "medium" | "high" | "critical";

export type BiasTrend = "increasing" | "stable" | "decreasing";

// ─── Bias Alert (output of a detector) ──────────────────────────────────────

export interface EvidencePoint {
    variable: string;       // e.g. "mkt01Tier"
    label: string;          // Human-readable label
    value: string | number; // Actual input value
    expected?: string;      // What a rational input would look like
    deviation?: string;     // Explanation of the gap
}

export interface BiasAlert {
    biasType: BiasType;
    severity: BiasSeverity;
    confidence: number;           // 0-100
    title: string;
    description: string;
    intervention: string;         // Recommended corrective action
    evidencePoints: EvidencePoint[];
    mathExplanation: string;      // Formula / logic used
}

// ─── Bias Profile (aggregated per user) ─────────────────────────────────────

export interface BiasProfileEntry {
    biasType: BiasType;
    occurrenceCount: number;
    lastDetectedAt: string | null;
    avgSeverity: number;
    trend: BiasTrend;
}

// ─── Detector Context ───────────────────────────────────────────────────────

export interface DetectorContext {
    projectId: number;
    userId: number;
    orgId: number | null;
    evaluationCount: number;              // How many times this project was evaluated
    previousScores: number[];             // Historical composite scores for this project
    previousBudgets: number[];            // Historical budgetCap values for this project
    overrideCount: number;                // Number of manual overrides applied
    overrideNetEffect: number;            // Sum of score changes from overrides (positive = inflated)
    marketTrendActual: number | null;     // Objective trend metric from evidence data (if available)
}

// ─── Severity Thresholds ────────────────────────────────────────────────────

export const SEVERITY_THRESHOLDS = {
    low: { minConfidence: 30, color: "#60a5fa", label: "Watch" },
    medium: { minConfidence: 50, color: "#fbbf24", label: "Caution" },
    high: { minConfidence: 70, color: "#f97316", label: "Intervention Recommended" },
    critical: { minConfidence: 85, color: "#ef4444", label: "Immediate Attention" },
} as const;

// ─── Budget Benchmarks by Tier (AED/sqm, approximate UAE market) ───────────

export const TIER_BUDGET_BENCHMARKS: Record<string, { median: number; low: number; high: number }> = {
    "Mid": { median: 800, low: 500, high: 1200 },
    "Upper-mid": { median: 1500, low: 1000, high: 2200 },
    "Luxury": { median: 3000, low: 2000, high: 5000 },
    "Ultra-luxury": { median: 6000, low: 4000, high: 12000 },
};

// ─── Bias Labels ────────────────────────────────────────────────────────────

export const BIAS_LABELS: Record<BiasType, string> = {
    optimism_bias: "Optimism Bias",
    anchoring_bias: "Anchoring Bias",
    confirmation_bias: "Confirmation Bias",
    overconfidence: "Overconfidence",
    scope_creep: "Scope Creep Risk",
    sunk_cost: "Sunk Cost Fallacy",
    clustering_illusion: "Clustering Illusion",
};

export const BIAS_ICONS: Record<BiasType, string> = {
    optimism_bias: "☀️",
    anchoring_bias: "⚓",
    confirmation_bias: "🔍",
    overconfidence: "🎯",
    scope_creep: "📐",
    sunk_cost: "💸",
    clustering_illusion: "🎲",
};
