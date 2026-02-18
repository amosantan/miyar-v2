/**
 * MIYAR Scenario Templates & Constraint Solver Engine
 * Provides pre-built scenario templates and a lightweight constraint solver
 * that proposes best-fit scenario variants deterministically.
 */

export interface ScenarioTemplate {
  key: string;
  name: string;
  description: string;
  overrides: Record<string, number | string>;
  tradeoffs: string[];
}

export interface Constraint {
  variable: string;
  operator: "eq" | "gte" | "lte" | "in";
  value: number | string | (number | string)[];
}

export interface ConstraintSolverResult {
  name: string;
  description: string;
  overrides: Record<string, number | string>;
  estimatedScoreImpact: string;
  constraintsSatisfied: number;
  constraintsTotal: number;
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    key: "cost_discipline",
    name: "Cost Discipline",
    description: "Optimize for budget efficiency while maintaining acceptable quality. Reduces material level and complexity to lower cost bands.",
    overrides: {
      des02MaterialLevel: 2,
      des03Complexity: 2,
      fin02Flexibility: 4,
      fin03ShockTolerance: 4,
      exe01SupplyChain: 4,
    },
    tradeoffs: [
      "Lower material specification may reduce perceived luxury",
      "Simplified design reduces differentiation potential",
      "Improved budget headroom and shock absorption",
      "Faster procurement with simpler supply chain",
    ],
  },
  {
    key: "market_differentiation",
    name: "Market Differentiation",
    description: "Maximize competitive differentiation through bold design choices and premium positioning. Increases brand clarity and design ambition.",
    overrides: {
      str01BrandClarity: 5,
      str02Differentiation: 5,
      des03Complexity: 4,
      des04Experience: 5,
      mkt03Trend: 4,
    },
    tradeoffs: [
      "Higher design complexity increases execution risk",
      "Premium positioning narrows buyer pool",
      "Stronger brand identity commands premium pricing",
      "Trend-forward design may require specialized contractors",
    ],
  },
  {
    key: "luxury_upgrade",
    name: "Luxury Upgrade",
    description: "Elevate project to luxury tier with premium materials, high experience quality, and international-grade specifications.",
    overrides: {
      des02MaterialLevel: 5,
      des03Complexity: 4,
      des04Experience: 5,
      des05Sustainability: 3,
      str01BrandClarity: 4,
    },
    tradeoffs: [
      "Significant budget increase required",
      "Extended procurement timelines for premium materials",
      "Higher risk of supply chain disruption",
      "Premium pricing potential with luxury positioning",
    ],
  },
  {
    key: "fast_delivery",
    name: "Fast Delivery / Procurement Simplicity",
    description: "Optimize for speed and procurement simplicity. Uses locally available materials and proven contractors.",
    overrides: {
      exe01SupplyChain: 5,
      exe02Contractor: 4,
      exe03Approvals: 4,
      des02MaterialLevel: 2,
      des03Complexity: 2,
    },
    tradeoffs: [
      "Limited material palette reduces design options",
      "Simplified execution accelerates timeline",
      "Lower procurement risk with local sourcing",
      "May sacrifice uniqueness for speed",
    ],
  },
  {
    key: "brand_alignment",
    name: "Brand/Story Alignment",
    description: "Align all design and execution decisions with a strong brand narrative. Prioritizes coherence between vision, materials, and market positioning.",
    overrides: {
      str01BrandClarity: 5,
      str02Differentiation: 4,
      des04Experience: 5,
      des05Sustainability: 4,
      mkt03Trend: 4,
    },
    tradeoffs: [
      "Brand-driven decisions may conflict with cost optimization",
      "Sustainability focus adds procurement complexity",
      "Strong narrative supports marketing and sales",
      "Experience-focused design requires careful execution",
    ],
  },
];

export function getScenarioTemplate(key: string): ScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find(t => t.key === key);
}

function checkConstraint(value: number | string | undefined | null, constraint: Constraint): boolean {
  if (value === undefined || value === null) return false;
  const numVal = typeof value === "string" ? parseFloat(value) : value;
  switch (constraint.operator) {
    case "eq":
      return value === constraint.value || numVal === constraint.value;
    case "gte":
      return typeof constraint.value === "number" && numVal >= constraint.value;
    case "lte":
      return typeof constraint.value === "number" && numVal <= constraint.value;
    case "in":
      return Array.isArray(constraint.value) && constraint.value.includes(value);
    default:
      return false;
  }
}

export function solveConstraints(
  baseProject: Record<string, any>,
  constraints: Constraint[]
): ConstraintSolverResult[] {
  const results: ConstraintSolverResult[] = [];

  // Generate candidate variants from templates
  for (const template of SCENARIO_TEMPLATES) {
    const variant = { ...baseProject, ...template.overrides };
    let satisfied = 0;
    for (const c of constraints) {
      if (checkConstraint(variant[c.variable], c)) {
        satisfied++;
      }
    }
    const pct = constraints.length > 0 ? (satisfied / constraints.length) * 100 : 100;
    let impact = "neutral";
    if (pct >= 80) impact = "positive — meets most constraints";
    else if (pct >= 50) impact = "mixed — partial constraint satisfaction";
    else impact = "negative — significant constraint violations";

    results.push({
      name: template.name,
      description: template.description,
      overrides: template.overrides,
      estimatedScoreImpact: impact,
      constraintsSatisfied: satisfied,
      constraintsTotal: constraints.length,
    });
  }

  // Also generate a "custom optimized" variant that tries to satisfy all constraints
  const customOverrides: Record<string, number | string> = {};
  for (const c of constraints) {
    if (c.operator === "eq") {
      customOverrides[c.variable] = c.value as number | string;
    } else if (c.operator === "gte" && typeof c.value === "number") {
      const current = typeof baseProject[c.variable] === "number" ? baseProject[c.variable] : 3;
      customOverrides[c.variable] = Math.max(current, c.value);
    } else if (c.operator === "lte" && typeof c.value === "number") {
      const current = typeof baseProject[c.variable] === "number" ? baseProject[c.variable] : 3;
      customOverrides[c.variable] = Math.min(current, c.value);
    }
  }

  if (Object.keys(customOverrides).length > 0) {
    results.push({
      name: "Custom Optimized",
      description: "Auto-generated variant that directly satisfies all specified constraints",
      overrides: customOverrides,
      estimatedScoreImpact: "targeted — directly addresses constraints",
      constraintsSatisfied: constraints.length,
      constraintsTotal: constraints.length,
    });
  }

  // Sort by constraint satisfaction
  results.sort((a, b) => b.constraintsSatisfied - a.constraintsSatisfied);

  // Return top 3
  return results.slice(0, 3);
}
