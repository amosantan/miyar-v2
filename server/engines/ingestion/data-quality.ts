/**
 * MIYAR — Data Quality Validation Engine
 *
 * Post-extraction validation layer that checks extracted values against
 * configurable quality rules. Flags outliers without rejecting them.
 *
 * Used by the orchestrator after normalization, before upsert.
 */

// ─── Quality Rule Types ──────────────────────────────────────────

interface QualityRule {
    /** Category this rule applies to (e.g. "floors", "sanitary") */
    category: string;
    /** Optional regex to match specific item names */
    itemPattern?: RegExp;
    /** Minimum acceptable value in AED */
    minValue: number;
    /** Maximum acceptable value in AED */
    maxValue: number;
    /** Unit this rule applies to */
    unit: string;
    /** Human-readable description for audit */
    description: string;
}

export interface QualityResult {
    status: "valid" | "outlier_flagged" | "missing_value";
    flags: string[];
    adjustedConfidence?: number;
}

// ─── UAE Market Quality Rules ────────────────────────────────────
// Based on known UAE luxury/premium market ranges

const QUALITY_RULES: QualityRule[] = [
    // Flooring
    { category: "floors", minValue: 15, maxValue: 5000, unit: "sqm", description: "Floor materials AED/sqm" },
    { category: "floors", minValue: 1, maxValue: 500, unit: "sqft", description: "Floor materials AED/sqft" },
    { category: "floors", minValue: 5, maxValue: 2000, unit: "piece", description: "Floor tiles per piece" },

    // Walls
    { category: "walls", minValue: 10, maxValue: 3000, unit: "sqm", description: "Wall materials AED/sqm" },
    { category: "walls", minValue: 5, maxValue: 500, unit: "sqft", description: "Wall materials AED/sqft" },
    { category: "walls", minValue: 20, maxValue: 800, unit: "L", description: "Paint per litre" },

    // Ceilings
    { category: "ceilings", minValue: 30, maxValue: 2000, unit: "sqm", description: "Ceiling materials AED/sqm" },

    // Sanitary ware
    { category: "sanitary", minValue: 50, maxValue: 80000, unit: "piece", description: "Sanitary fixtures per piece" },
    { category: "sanitary", minValue: 50, maxValue: 80000, unit: "unit", description: "Sanitary fixtures per unit" },
    { category: "sanitary", minValue: 100, maxValue: 200000, unit: "set", description: "Sanitary sets" },

    // Kitchen
    { category: "kitchen", minValue: 200, maxValue: 500000, unit: "set", description: "Kitchen sets" },
    { category: "kitchen", minValue: 50, maxValue: 100000, unit: "unit", description: "Kitchen appliances per unit" },
    { category: "kitchen", minValue: 100, maxValue: 50000, unit: "piece", description: "Kitchen items per piece" },
    { category: "kitchen", minValue: 200, maxValue: 10000, unit: "m", description: "Kitchen countertops per meter" },

    // Hardware
    { category: "hardware", minValue: 5, maxValue: 20000, unit: "piece", description: "Hardware items per piece" },
    { category: "hardware", minValue: 5, maxValue: 20000, unit: "unit", description: "Hardware items per unit" },
    { category: "hardware", minValue: 10, maxValue: 50000, unit: "set", description: "Hardware sets" },

    // Joinery
    { category: "joinery", minValue: 500, maxValue: 50000, unit: "unit", description: "Joinery per unit (doors, cabinets)" },
    { category: "joinery", minValue: 200, maxValue: 10000, unit: "sqm", description: "Joinery per sqm" },
    { category: "joinery", minValue: 200, maxValue: 10000, unit: "m", description: "Joinery per linear meter" },

    // Lighting
    { category: "lighting", minValue: 20, maxValue: 200000, unit: "piece", description: "Lighting fixtures per piece" },
    { category: "lighting", minValue: 20, maxValue: 200000, unit: "unit", description: "Lighting fixtures per unit" },

    // FF&E
    { category: "ffe", minValue: 100, maxValue: 500000, unit: "unit", description: "FF&E per unit" },
    { category: "ffe", minValue: 100, maxValue: 500000, unit: "piece", description: "FF&E per piece" },
    { category: "ffe", minValue: 50, maxValue: 10000, unit: "sqm", description: "FF&E per sqm (carpets, rugs)" },

    // Fitout rates (other)
    { category: "other", minValue: 100, maxValue: 15000, unit: "sqft", description: "Fitout rates AED/sqft" },
    { category: "other", minValue: 500, maxValue: 50000, unit: "sqm", description: "Fitout rates AED/sqm" },
];

// ─── Validation ──────────────────────────────────────────────────

/**
 * Validate an evidence record against quality rules.
 * Returns flags for outlier values but does NOT reject records.
 */
export function validateEvidence(record: {
    category: string;
    itemName: string;
    value: number | null;
    valueMax?: number | null;
    unit: string | null;
    confidence: number;
}): QualityResult {
    const flags: string[] = [];

    // Missing value — still valid, just flagged
    if (record.value === null || record.value === undefined) {
        return { status: "missing_value", flags: ["no_price_value"] };
    }

    // Non-positive value
    if (record.value <= 0) {
        flags.push("non_positive_value");
        return {
            status: "outlier_flagged",
            flags,
            adjustedConfidence: Math.max(record.confidence * 0.5, 0.10),
        };
    }

    // Find matching rules
    const matchingRules = QUALITY_RULES.filter(
        (rule) =>
            rule.category === record.category &&
            rule.unit === (record.unit || "unit") &&
            (!rule.itemPattern || rule.itemPattern.test(record.itemName))
    );

    if (matchingRules.length === 0) {
        // No rules for this category/unit — pass through
        return { status: "valid", flags: [] };
    }

    // Check against rules (any matching rule must pass)
    let passedAnyRule = false;
    for (const rule of matchingRules) {
        if (record.value >= rule.minValue && record.value <= rule.maxValue) {
            passedAnyRule = true;

            // Also check valueMax if present
            if (record.valueMax !== null && record.valueMax !== undefined) {
                if (record.valueMax < record.value) {
                    flags.push("max_less_than_min");
                }
                if (record.valueMax > rule.maxValue * 1.5) {
                    flags.push("value_max_extreme");
                }
            }

            break;
        }
    }

    if (!passedAnyRule) {
        const rule = matchingRules[0];
        if (record.value < rule.minValue) {
            flags.push(`below_minimum: ${record.value} < ${rule.minValue} ${rule.unit} (${rule.description})`);
        }
        if (record.value > rule.maxValue) {
            flags.push(`above_maximum: ${record.value} > ${rule.maxValue} ${rule.unit} (${rule.description})`);
        }

        return {
            status: "outlier_flagged",
            flags,
            adjustedConfidence: Math.max(record.confidence * 0.3, 0.10),
        };
    }

    return {
        status: flags.length > 0 ? "outlier_flagged" : "valid",
        flags,
        adjustedConfidence: flags.length > 0 ? record.confidence * 0.8 : undefined,
    };
}

/**
 * Batch validate multiple records, returning summary statistics.
 */
export function validateBatch(
    records: Array<{
        category: string;
        itemName: string;
        value: number | null;
        valueMax?: number | null;
        unit: string | null;
        confidence: number;
    }>
): {
    valid: number;
    outliers: number;
    missingValue: number;
    results: QualityResult[];
} {
    const results = records.map(validateEvidence);
    return {
        valid: results.filter((r) => r.status === "valid").length,
        outliers: results.filter((r) => r.status === "outlier_flagged").length,
        missingValue: results.filter((r) => r.status === "missing_value").length,
        results,
    };
}
