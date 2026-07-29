/**
 * Board Composer Engine (V4)
 * Deterministic material board composition from catalog + project context.
 * Generates browse-only board suggestions and concept schedules.
 */

export interface BriefConstraints {
  approvedMaterials: string[];
  prohibitedMaterials: string[];
  totalBudgetCap: string;
  tierRequirement: string;
  pricingVerified?: boolean;
}

export interface BoardItem {
  materialId: number;
  name: string;
  category: string;
  tier: string;
  costLow: number | null;
  costHigh: number | null;
  costUnit: string;
  leadTimeDays: number;
  leadTimeBand: string;
  supplierName: string;
  quantity?: number;
  unitOfMeasure?: string;
  notes?: string;
}

export interface BoardSummary {
  totalItems: number;
  estimatedCostLow: number | null;
  estimatedCostHigh: number | null;
  currency: string;
  longestLeadTimeDays: number;
  criticalPathItems: string[];
  tierDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  budgetComplianceCheck?: {
    budgetCapAed: number | null;
    utilizationPct: number | null;
    status: "within_budget" | "over_budget" | "unknown";
  };
}

export interface RfqLine {
  lineNo: number;
  materialName: string;
  category: string;
  specification: string;
  quantity: string;
  unit: string;
  estimatedUnitCostLow: number | null;
  estimatedUnitCostHigh: number | null;
  leadTimeDays: number;
  supplierSuggestion: string;
  notes: string;
  pricingState: "browse_only_estimate";
}

/**
 * Compute board summary statistics
 */
export function computeBoardSummary(items: BoardItem[], briefConstraints?: BriefConstraints): BoardSummary {
  const tierDist: Record<string, number> = {};
  const catDist: Record<string, number> = {};
  let costLow = 0;
  let costHigh = 0;
  let hasCompleteBrowseEstimate = items.length > 0;
  let maxLead = 0;
  const criticalItems: string[] = [];

  for (const item of items) {
    tierDist[item.tier] = (tierDist[item.tier] || 0) + 1;
    catDist[item.category] = (catDist[item.category] || 0) + 1;
    if (
      item.costLow === null ||
      item.costHigh === null ||
      !Number.isFinite(item.costLow) ||
      !Number.isFinite(item.costHigh)
    ) {
      hasCompleteBrowseEstimate = false;
    } else {
      costLow += item.costLow;
      costHigh += item.costHigh;
    }
    if (item.leadTimeDays > maxLead) maxLead = item.leadTimeDays;
    if (item.leadTimeBand === "critical" || item.leadTimeDays >= 90) {
      criticalItems.push(item.name);
    }
  }

  // Catalog prices are browse-only. They may be displayed as estimates, but
  // cannot establish budget compliance or enter an issued calculation.
  let budgetComplianceCheck: BoardSummary["budgetComplianceCheck"];
  if (briefConstraints) {
    const capStr = briefConstraints.totalBudgetCap.replace(/[^0-9.]/g, "");
    const cap = Number(capStr) || null;
    budgetComplianceCheck = {
      budgetCapAed: cap,
      utilizationPct: null,
      status: "unknown",
    };
  }

  return {
    totalItems: items.length,
    estimatedCostLow: hasCompleteBrowseEstimate ? costLow : null,
    estimatedCostHigh: hasCompleteBrowseEstimate ? costHigh : null,
    currency: "AED",
    longestLeadTimeDays: maxLead,
    criticalPathItems: criticalItems,
    tierDistribution: tierDist,
    categoryDistribution: catDist,
    budgetComplianceCheck,
  };
}

/**
 * Generate a browse-only concept schedule from board catalog data.
 * These compatibility-shaped rows are not RFQ-ready until governed values
 * resolve through the EV-03 supply-and-install path.
 */
export function generateRfqLines(items: BoardItem[], briefConstraints?: BriefConstraints): RfqLine[] {
  return items.map((item, idx) => {
    const notes: string[] = [];
    if (item.notes) notes.push(item.notes);

    // Check against brief constraints if provided
    if (briefConstraints) {
      if (briefConstraints.pricingVerified) notes.push("(indicative estimate from configured benchmark observations)");
      const prohibited = briefConstraints.prohibitedMaterials.map(p => p.toLowerCase());
      const itemLower = item.name.toLowerCase();
      if (prohibited.some(p => itemLower.includes(p.split("(")[0].trim().toLowerCase()))) {
        notes.push("⚠ Not in approved materials list");
      }
    }

    return {
      lineNo: idx + 1,
      materialName: item.name,
      category: item.category,
      specification: `${item.tier} grade — ${item.name}`,
      quantity: item.quantity ? `${item.quantity}` : "TBD",
      unit: item.unitOfMeasure || item.costUnit.replace("AED/", ""),
      estimatedUnitCostLow: item.costLow,
      estimatedUnitCostHigh: item.costHigh,
      leadTimeDays: item.leadTimeDays,
      supplierSuggestion: item.supplierName,
      notes: [
        ...notes,
        "Browse-only catalog estimate; not RFQ-ready or eligible for issued totals.",
      ].join(" | "),
      pricingState: "browse_only_estimate",
    };
  });
}

/**
 * Recommend materials from catalog based on project tier and style
 */
export function recommendMaterials(
  catalog: Array<{
    id: number;
    name: string;
    category: string;
    tier: string;
    typicalCostLow: string | null;
    typicalCostHigh: string | null;
    costUnit: string | null;
    leadTimeDays: number | null;
    leadTimeBand: string | null;
    supplierName: string | null;
  }>,
  projectTier: string,
  maxItems = 10,
): BoardItem[] {
  // Map project tier to catalog tiers
  const tierMap: Record<string, string[]> = {
    Mid: ["economy", "mid"],
    "Upper-mid": ["mid", "premium"],
    Luxury: ["premium", "luxury"],
    "Ultra-luxury": ["luxury", "ultra_luxury"],
  };

  const allowedTiers = tierMap[projectTier] || ["mid", "premium"];

  // Filter and score materials
  const scored = catalog
    .filter(m => allowedTiers.includes(m.tier))
    .map(m => ({
      materialId: m.id,
      name: m.name,
      category: m.category,
      tier: m.tier,
      costLow:
        m.typicalCostLow === null || !Number.isFinite(Number(m.typicalCostLow))
          ? null
          : Number(m.typicalCostLow),
      costHigh:
        m.typicalCostHigh === null ||
        !Number.isFinite(Number(m.typicalCostHigh))
          ? null
          : Number(m.typicalCostHigh),
      costUnit: m.costUnit || "AED/unit",
      leadTimeDays: m.leadTimeDays || 30,
      leadTimeBand: m.leadTimeBand || "medium",
      supplierName: m.supplierName || "TBD",
    }));

  // Diversify by category — pick at most 2 per category
  const byCategory: Record<string, BoardItem[]> = {};
  for (const item of scored) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  const result: BoardItem[] = [];
  for (const [, items] of Object.entries(byCategory)) {
    result.push(...items.slice(0, 2));
  }

  return result.slice(0, maxItems);
}
