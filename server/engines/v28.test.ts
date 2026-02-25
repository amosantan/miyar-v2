import { describe, it, expect } from "vitest";
import { generateDesignBrief } from "./design-brief";
import { computeBoardSummary, generateRfqLines, recommendMaterials, type BoardItem } from "./board-composer";
import { buildPromptContext, generateDefaultPrompt, interpolateTemplate, validatePrompt } from "./visual-gen";
import type { ProjectInputs } from "../../shared/miyar-types";

/* ─── Shared test fixtures ─── */
const baseInputs: ProjectInputs = {
  ctx01Typology: "Residential",
  ctx02Scale: "Large",
  ctx03Gfa: 500000,
  ctx04Location: "Prime",
  ctx05Horizon: "12-24m",
  mkt01Tier: "Luxury",
  str02Differentiation: 4,
  mkt03BrandAlignment: 4,
  des01Style: "Contemporary",
  des02MaterialLevel: 4,
  des03Complexity: 4,
  des04Experience: 4,
  des05Sustainability: 3,
  fin01BudgetCap: 4600,
  fin02Flexibility: 3,
  fin03ShockTolerance: 3,
  exe01SupplyChain: 3,
  exe02Timeline: 3,
  exe03LocalLabor: 3,
};

const scoreResult = {
  compositeScore: 78.5,
  decisionStatus: "validated",
  dimensions: { market: 80, design: 75, financial: 78, execution: 82 },
};

/* ─── Design Brief Tests ─── */
describe("Design Brief Generator", () => {
  it("generates all 7 sections", () => {
    const brief = generateDesignBrief(
      { name: "Test Tower", description: "A luxury tower" },
      baseInputs,
      scoreResult,
    );

    expect(brief.projectIdentity).toBeDefined();
    expect(brief.projectIdentity.projectName).toBe("Test Tower");
    expect(brief.projectIdentity.typology).toBe("Residential");
    expect(brief.projectIdentity.marketTier).toBe("Luxury");
    expect(brief.projectIdentity.style).toBe("Contemporary");

    expect(brief.designNarrative.positioningStatement).toContain("Test Tower");
    expect(brief.designNarrative.positioningStatement).toContain("validates");

    expect(brief.designNarrative).toBeDefined();
    expect(brief.designNarrative.primaryStyle).toBe("Contemporary");
    expect(brief.designNarrative.moodKeywords.length).toBeGreaterThan(0);
    expect(brief.designNarrative.colorPalette.length).toBeGreaterThan(0);

    expect(brief.materialSpecifications).toBeDefined();
    expect(brief.materialSpecifications.tierRequirement).toBe("Luxury");
    expect(brief.materialSpecifications.approvedMaterials.length).toBeGreaterThan(0);
    expect(brief.materialSpecifications.finishesAndTextures.length).toBeGreaterThan(0);
    expect(brief.materialSpecifications.prohibitedMaterials.length).toBeGreaterThan(0);

    expect(brief.boqFramework).toBeDefined();
    expect(brief.boqFramework.coreAllocations.length).toBeGreaterThan(0);

    expect(brief.detailedBudget).toBeDefined();
    expect(brief.detailedBudget.costPerSqmTarget).toContain("4,600");
    expect(brief.detailedBudget.costBand).toBe("Premium High-End");

    expect(brief.designerInstructions.procurementAndLogistics).toBeDefined();
    expect(brief.designerInstructions.procurementAndLogistics.criticalPathItems.length).toBeGreaterThan(0);
    expect(brief.designerInstructions.procurementAndLogistics.importDependencies.length).toBeGreaterThan(0);

    expect(brief.designerInstructions.phasedDeliverables).toBeDefined();
    expect(brief.designerInstructions.phasedDeliverables.conceptDesign.length).toBeGreaterThan(0);
    expect(brief.designerInstructions.phasedDeliverables.schematicDesign.length).toBeGreaterThan(0);
    expect(brief.designerInstructions.phasedDeliverables.detailedDesign.length).toBeGreaterThan(0);
    expect(brief.designerInstructions.authorityApprovals.length).toBeGreaterThan(0);
  });

  it("adjusts for different tiers", () => {
    const midInputs = { ...baseInputs, mkt01Tier: "Mid" as any, des02MaterialLevel: 2, des03Complexity: 2 };
    const midBrief = generateDesignBrief({ name: "Mid Project", description: null }, midInputs, { ...scoreResult, compositeScore: 65 });

    expect(midBrief.materialSpecifications.tierRequirement).toBe("Mid");
    expect(midBrief.materialSpecifications.approvedMaterials).toContain("Engineered stone countertops");
  });

  it("adjusts positioning for conditional status", () => {
    const brief = generateDesignBrief(
      { name: "Conditional", description: null },
      baseInputs,
      { ...scoreResult, decisionStatus: "conditional", compositeScore: 55 },
    );
    expect(brief.designNarrative.positioningStatement).toContain("conditionally validates");
  });

  it("adjusts positioning for not_validated status", () => {
    const brief = generateDesignBrief(
      { name: "Failed", description: null },
      baseInputs,
      { ...scoreResult, decisionStatus: "not_validated", compositeScore: 35 },
    );
    expect(brief.designNarrative.positioningStatement).toContain("revision");
  });

  it("handles ultra-luxury tier", () => {
    const ultraInputs = { ...baseInputs, mkt01Tier: "Ultra-luxury" as any, fin01BudgetCap: 8500 };
    const brief = generateDesignBrief({ name: "Ultra", description: null }, ultraInputs, scoreResult);
    expect(brief.detailedBudget.costBand).toBe("Ultra-Premium Luxury");
    expect(brief.materialSpecifications.tierRequirement).toBe("Ultra-luxury");
    expect(brief.designerInstructions.procurementAndLogistics.criticalPathItems).toContain("Procurement of limited-edition or custom-commissioned FF&E.");
  });

  it("handles high sustainability priority", () => {
    const sustainInputs = { ...baseInputs, des05Sustainability: 5 };
    const brief = generateDesignBrief({ name: "Green", description: null }, sustainInputs, scoreResult);
    expect(brief.materialSpecifications.sustainabilityMandate).toContain("High Priority");
  });
});

/* ─── Board Composer Tests ─── */
describe("Board Composer", () => {
  const sampleItems: BoardItem[] = [
    { materialId: 1, name: "Italian Marble", category: "stone", tier: "luxury", costLow: 300, costHigh: 500, costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "long", supplierName: "Supplier A" },
    { materialId: 2, name: "Oak Flooring", category: "wood", tier: "premium", costLow: 150, costHigh: 250, costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "medium", supplierName: "Supplier B" },
    { materialId: 3, name: "Custom Chandelier", category: "lighting", tier: "luxury", costLow: 5000, costHigh: 15000, costUnit: "AED/unit", leadTimeDays: 120, leadTimeBand: "critical", supplierName: "Supplier C" },
  ];

  it("computes board summary correctly", () => {
    const summary = computeBoardSummary(sampleItems);
    expect(summary.totalItems).toBe(3);
    expect(summary.estimatedCostLow).toBe(5450);
    expect(summary.estimatedCostHigh).toBe(15750);
    expect(summary.longestLeadTimeDays).toBe(120);
    expect(summary.criticalPathItems).toContain("Custom Chandelier");
    expect(summary.tierDistribution.luxury).toBe(2);
    expect(summary.tierDistribution.premium).toBe(1);
    expect(summary.categoryDistribution.stone).toBe(1);
    expect(summary.categoryDistribution.wood).toBe(1);
    expect(summary.categoryDistribution.lighting).toBe(1);
  });

  it("generates RFQ lines with correct numbering", () => {
    const lines = generateRfqLines(sampleItems);
    expect(lines.length).toBe(3);
    expect(lines[0].lineNo).toBe(1);
    expect(lines[0].materialName).toBe("Italian Marble");
    expect(lines[2].lineNo).toBe(3);
    expect(lines[2].supplierSuggestion).toBe("Supplier C");
  });

  it("handles empty board", () => {
    const summary = computeBoardSummary([]);
    expect(summary.totalItems).toBe(0);
    expect(summary.estimatedCostLow).toBe(0);
    expect(summary.longestLeadTimeDays).toBe(0);
    expect(summary.criticalPathItems).toHaveLength(0);
  });

  it("recommends materials based on project tier", () => {
    const catalog = [
      { id: 1, name: "Marble A", category: "stone", tier: "luxury", typicalCostLow: "300", typicalCostHigh: "500", costUnit: "AED/sqm", leadTimeDays: 60, leadTimeBand: "long", supplierName: "S1" },
      { id: 2, name: "Laminate B", category: "wood", tier: "economy", typicalCostLow: "50", typicalCostHigh: "80", costUnit: "AED/sqm", leadTimeDays: 14, leadTimeBand: "short", supplierName: "S2" },
      { id: 3, name: "Oak C", category: "wood", tier: "premium", typicalCostLow: "150", typicalCostHigh: "250", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "medium", supplierName: "S3" },
      { id: 4, name: "Brass D", category: "metal", tier: "luxury", typicalCostLow: "200", typicalCostHigh: "400", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "S4" },
    ];

    // Luxury tier should match premium + luxury
    const luxuryRecs = recommendMaterials(catalog, "Luxury");
    expect(luxuryRecs.length).toBeGreaterThan(0);
    const tiers = luxuryRecs.map(r => r.tier);
    expect(tiers.every(t => ["premium", "luxury"].includes(t))).toBe(true);
    // Economy should be excluded
    expect(tiers).not.toContain("economy");

    // Mid tier should match economy + mid
    const midRecs = recommendMaterials(catalog, "Mid");
    const midTiers = midRecs.map(r => r.tier);
    expect(midTiers.every(t => ["economy", "mid"].includes(t))).toBe(true);
  });
});

/* ─── Visual Generation Prompt Tests ─── */
describe("Visual Generation Prompt Builder", () => {
  it("builds prompt context from project inputs", () => {
    const ctx = buildPromptContext(baseInputs);
    expect(ctx.typology).toBe("Residential");
    expect(ctx.style).toBe("Contemporary");
    expect(ctx.tier).toBe("Luxury");
    expect(ctx.location).toContain("Dubai");
    expect(ctx.materialLevel).toContain("luxury");
  });

  it("generates mood board default prompt", () => {
    const ctx = buildPromptContext(baseInputs);
    const prompt = generateDefaultPrompt("mood", ctx);
    expect(prompt).toContain("mood board");
    expect(prompt).toContain("Residential");
    expect(prompt).toContain("Contemporary");
    expect(prompt).toContain("Luxury");
  });

  it("generates material board default prompt", () => {
    const ctx = buildPromptContext(baseInputs);
    const prompt = generateDefaultPrompt("material_board", ctx);
    expect(prompt).toContain("material");
    expect(prompt).toContain("Luxury");
  });

  it("generates marketing hero default prompt", () => {
    const ctx = buildPromptContext(baseInputs);
    const prompt = generateDefaultPrompt("hero", ctx);
    expect(prompt).toContain("marketing");
    expect(prompt).toContain("Residential");
  });

  it("interpolates template variables", () => {
    const ctx = buildPromptContext(baseInputs);
    const template = "A {{style}} interior for {{typology}} in {{location}}";
    const result = interpolateTemplate(template, ctx);
    expect(result).toContain("Contemporary");
    expect(result).toContain("Residential");
    expect(result).not.toContain("{{");
  });

  it("validates prompt length", () => {
    expect(validatePrompt("short").valid).toBe(false);
    expect(validatePrompt("A sufficiently long prompt for testing purposes").valid).toBe(true);
  });

  it("blocks unsafe content", () => {
    const result = validatePrompt("Create an nsfw image of a building interior");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Blocked");
  });
});
