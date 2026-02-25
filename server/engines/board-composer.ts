/**
 * Board Composer Engine (V4)
 * Deterministic material board composition from catalog + project context.
 * Generates RFQ-ready material lists with cost estimates.
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
  costLow: number;
  costHigh: number;
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
  estimatedCostLow: number;
  estimatedCostHigh: number;
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
  estimatedUnitCostLow: number;
  estimatedUnitCostHigh: number;
  leadTimeDays: number;
  supplierSuggestion: string;
  notes: string;
}

/**
 * Compute board summary statistics
 */
export function computeBoardSummary(items: BoardItem[], briefConstraints?: BriefConstraints): BoardSummary {
  const tierDist: Record<string, number> = {};
  const catDist: Record<string, number> = {};
  let costLow = 0;
  let costHigh = 0;
  let maxLead = 0;
  const criticalItems: string[] = [];

  for (const item of items) {
    tierDist[item.tier] = (tierDist[item.tier] || 0) + 1;
    catDist[item.category] = (catDist[item.category] || 0) + 1;
    costLow += item.costLow;
    costHigh += item.costHigh;
    if (item.leadTimeDays > maxLead) maxLead = item.leadTimeDays;
    if (item.leadTimeBand === "critical" || item.leadTimeDays >= 90) {
      criticalItems.push(item.name);
    }
  }

  // Budget compliance check if brief constraints provided
  let budgetComplianceCheck: BoardSummary["budgetComplianceCheck"];
  if (briefConstraints) {
    const capStr = briefConstraints.totalBudgetCap.replace(/[^0-9.]/g, "");
    const cap = Number(capStr) || null;
    const utilizationPct = cap ? Math.round((costHigh / cap) * 100) : null;
    budgetComplianceCheck = {
      budgetCapAed: cap,
      utilizationPct,
      status: cap ? (costHigh <= cap ? "within_budget" : "over_budget") : "unknown",
    };
  }

  return {
    totalItems: items.length,
    estimatedCostLow: costLow,
    estimatedCostHigh: costHigh,
    currency: "AED",
    longestLeadTimeDays: maxLead,
    criticalPathItems: criticalItems,
    tierDistribution: tierDist,
    categoryDistribution: catDist,
    budgetComplianceCheck,
  };
}

/**
 * Generate RFQ-ready line items from board
 */
export function generateRfqLines(items: BoardItem[], briefConstraints?: BriefConstraints): RfqLine[] {
  return items.map((item, idx) => {
    const notes: string[] = [];
    if (item.notes) notes.push(item.notes);

    // Check against brief constraints if provided
    if (briefConstraints) {
      if (briefConstraints.pricingVerified) notes.push("(market-verified)");
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
      notes: notes.join(" | ") || "",
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
      costLow: Number(m.typicalCostLow) || 0,
      costHigh: Number(m.typicalCostHigh) || 0,
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
