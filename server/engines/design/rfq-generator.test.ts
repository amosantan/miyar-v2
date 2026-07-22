/**
 * ADR-0009 (audit F1): an RFQ line's pricingSource derives only from the
 * quoted rate's own material provenance — never from BOQ label wording.
 */
import { describe, expect, it } from "vitest";
import type { DesignBriefData } from "../design-brief";
import { buildRFQFromBrief } from "./rfq-generator";

const FLOORING_SECTION = "Civil & MEP Works (Flooring, Ceilings, Partitions)";
const FFE_SECTION = "FF&E (Custom Furniture, Drapery, Rugs)";

function briefWith(allocations: Array<{ category: string; estimatedCostLabel: string }>): DesignBriefData {
  return {
    boqFramework: {
      totalEstimatedSqm: 100,
      coreAllocations: allocations.map((allocation, index) => ({
        category: allocation.category,
        percentage: 50,
        estimatedCostLabel: allocation.estimatedCostLabel,
        notes: `allocation ${index + 1}`,
      })),
    },
    materialSpecifications: {
      tierRequirement: "Upper-mid",
      approvedMaterials: [],
      prohibitedMaterials: [],
      finishesAndTextures: [],
      sustainabilityMandate: "",
      qualityBenchmark: "",
    },
    detailedBudget: {
      costPerSqmTarget: "Not specified",
      totalBudgetCap: "AED 1,000,000",
      costBand: "Standard (Fit-out)",
      costBasis: "static_default",
      flexibilityLevel: "Moderate",
      contingencyRecommendation: "Allocate 10% Contractor Contingency",
      valueEngineeringMandates: [],
    },
  } as unknown as DesignBriefData;
}

const materials = [
  {
    id: 1,
    name: "Assumption Porcelain",
    category: "flooring",
    tier: "premium",
    priceAedMin: 100,
    priceAedMax: 150,
    supplierName: "Assumption Supplier",
    sourceType: "miyar_assumption",
  },
  {
    id: 2,
    name: "Observed Marble",
    category: "flooring",
    tier: "premium",
    priceAedMin: 200,
    priceAedMax: 260,
    supplierName: "Observed Supplier",
    sourceType: "market_observation",
  },
  {
    id: 3,
    name: "Legacy Ceramic",
    category: "flooring",
    tier: "mid",
    priceAedMin: 40,
    priceAedMax: 60,
    supplierName: "Legacy Supplier",
    // sourceType absent — pre-provenance rows stay estimates
  },
];

describe("buildRFQFromBrief pricingSource provenance (ADR-0009)", () => {
  it("derives market-verified only from a market_observation material row", () => {
    const result = buildRFQFromBrief(
      7,
      1,
      briefWith([{ category: FLOORING_SECTION, estimatedCostLabel: "AED 40,000 – 60,000" }]),
      5,
      materials,
    );

    const materialLines = result.items.filter(item => item.itemCode.startsWith("01-"));
    expect(materialLines).toHaveLength(3);
    const byDescription = Object.fromEntries(
      materialLines.map(line => [line.description, line.pricingSource]),
    );
    expect(byDescription[`Supply & install Assumption Porcelain — ${FLOORING_SECTION}`]).toBe("estimated");
    expect(byDescription[`Supply & install Observed Marble — ${FLOORING_SECTION}`]).toBe("market-verified");
    expect(byDescription[`Supply & install Legacy Ceramic — ${FLOORING_SECTION}`]).toBe("estimated");
    expect(result.summary.marketVerifiedCount).toBe(1);
  });

  it("ignores label wording entirely — the old string-match cannot flip a line", () => {
    const assumptionOnly = materials.filter(material => material.sourceType !== "market_observation");
    const result = buildRFQFromBrief(
      7,
      1,
      briefWith([
        {
          category: FLOORING_SECTION,
          // Both legacy trigger phrases present — must change nothing.
          estimatedCostLabel:
            "AED 40,000 – 60,000 (indicative benchmark estimate) market-verified",
        },
      ]),
      5,
      assumptionOnly,
    );

    const materialLines = result.items.filter(item => item.itemCode.startsWith("01-"));
    expect(materialLines.length).toBeGreaterThan(0);
    for (const line of materialLines) {
      expect(line.pricingSource).toBe("estimated");
    }
    expect(result.summary.marketVerifiedCount).toBe(0);
  });

  it("keeps provisional sums estimated regardless of label wording", () => {
    const result = buildRFQFromBrief(
      7,
      1,
      briefWith([
        {
          category: FFE_SECTION,
          estimatedCostLabel: "AED 50,000 (indicative benchmark estimate)",
        },
      ]),
      5,
      materials, // no furniture rows → provisional-sum branch
    );

    const provisional = result.items.find(item => item.itemCode === "01-PS");
    expect(provisional).toBeDefined();
    expect(provisional!.pricingSource).toBe("estimated");
    expect(result.summary.marketVerifiedCount).toBe(0);
  });
});
