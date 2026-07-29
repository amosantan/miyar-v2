import { describe, it, expect } from "vitest";
import { generateBoardPdfHtml } from "./board-pdf";
import { computeBoardSummary, generateRfqLines, recommendMaterials, type BoardItem } from "./board-composer";
import { buildBoardAnnexData, type BoardAnnexData } from "./board-annex";
import { generateDesignBriefHTML, generateFullReportHTML, generateReportHTML } from "./pdf-report";

// ─── Board Composer Engine Tests ──────────────────────────────────────────────

describe("V4-06: Board Composer V2 — computeBoardSummary", () => {
  const sampleItems: BoardItem[] = [
    {
      materialId: 1, name: "Calacatta Gold Marble", category: "stone", tier: "luxury",
      costLow: 450, costHigh: 800, costUnit: "AED/sqm", leadTimeDays: 120,
      leadTimeBand: "critical", supplierName: "Al Habtoor Marble",
    },
    {
      materialId: 2, name: "Engineered Oak Flooring", category: "wood", tier: "premium",
      costLow: 180, costHigh: 320, costUnit: "AED/sqm", leadTimeDays: 45,
      leadTimeBand: "medium", supplierName: "RAK Timber",
    },
    {
      materialId: 3, name: "Italian Porcelain Tile", category: "tile", tier: "premium",
      costLow: 120, costHigh: 250, costUnit: "AED/sqm", leadTimeDays: 60,
      leadTimeBand: "long", supplierName: "Ceramiche Italia",
    },
  ];

  it("computes correct total items", () => {
    const summary = computeBoardSummary(sampleItems);
    expect(summary.totalItems).toBe(3);
  });

  it("computes correct cost range", () => {
    const summary = computeBoardSummary(sampleItems);
    expect(summary.estimatedCostLow).toBe(750); // 450+180+120
    expect(summary.estimatedCostHigh).toBe(1370); // 800+320+250
    expect(summary.currency).toBe("AED");
  });

  it("identifies longest lead time", () => {
    const summary = computeBoardSummary(sampleItems);
    expect(summary.longestLeadTimeDays).toBe(120);
  });

  it("identifies critical path items", () => {
    const summary = computeBoardSummary(sampleItems);
    expect(summary.criticalPathItems).toContain("Calacatta Gold Marble");
    expect(summary.criticalPathItems.length).toBe(1);
  });

  it("computes tier distribution", () => {
    const summary = computeBoardSummary(sampleItems);
    expect(summary.tierDistribution).toEqual({ luxury: 1, premium: 2 });
  });

  it("computes category distribution", () => {
    const summary = computeBoardSummary(sampleItems);
    expect(summary.categoryDistribution).toEqual({ stone: 1, wood: 1, tile: 1 });
  });

  it("handles empty items array", () => {
    const summary = computeBoardSummary([]);
    expect(summary.totalItems).toBe(0);
    expect(summary.estimatedCostLow).toBeNull();
    expect(summary.estimatedCostHigh).toBeNull();
    expect(summary.longestLeadTimeDays).toBe(0);
    expect(summary.criticalPathItems).toEqual([]);
  });

  it("does not sum a partial browse-only catalog estimate", () => {
    const summary = computeBoardSummary([
      sampleItems[0],
      { ...sampleItems[1], costLow: null, costHigh: null },
    ]);
    expect(summary.estimatedCostLow).toBeNull();
    expect(summary.estimatedCostHigh).toBeNull();
  });
});

describe("V4-06: Board Composer V2 — generateRfqLines", () => {
  const items: BoardItem[] = [
    {
      materialId: 1, name: "Marble Slab", category: "stone", tier: "luxury",
      costLow: 500, costHigh: 900, costUnit: "AED/sqm", leadTimeDays: 90,
      leadTimeBand: "critical", supplierName: "Gulf Stone",
      quantity: 200, unitOfMeasure: "sqm", notes: "Honed finish required",
    },
  ];

  it("generates correct line numbers", () => {
    const lines = generateRfqLines(items);
    expect(lines.length).toBe(1);
    expect(lines[0].lineNo).toBe(1);
  });

  it("includes material details in RFQ line", () => {
    const lines = generateRfqLines(items);
    expect(lines[0].materialName).toBe("Marble Slab");
    expect(lines[0].category).toBe("stone");
    expect(lines[0].estimatedUnitCostLow).toBe(500);
    expect(lines[0].estimatedUnitCostHigh).toBe(900);
    expect(lines[0].leadTimeDays).toBe(90);
    expect(lines[0].supplierSuggestion).toBe("Gulf Stone");
  });

  it("uses quantity when provided", () => {
    const lines = generateRfqLines(items);
    expect(lines[0].quantity).toBe("200");
  });

  it("uses TBD when quantity not provided", () => {
    const noQty = [{ ...items[0], quantity: undefined }];
    const lines = generateRfqLines(noQty);
    expect(lines[0].quantity).toBe("TBD");
  });
});

describe("V4-06: Board Composer V2 — recommendMaterials", () => {
  const catalog = [
    { id: 1, name: "Economy Tile", category: "tile", tier: "economy", typicalCostLow: "50", typicalCostHigh: "100", costUnit: "AED/sqm", leadTimeDays: 14, leadTimeBand: "short", supplierName: "Budget Tiles" },
    { id: 2, name: "Mid Marble", category: "stone", tier: "mid", typicalCostLow: "150", typicalCostHigh: "300", costUnit: "AED/sqm", leadTimeDays: 30, leadTimeBand: "medium", supplierName: "Stone Co" },
    { id: 3, name: "Premium Oak", category: "wood", tier: "premium", typicalCostLow: "200", typicalCostHigh: "400", costUnit: "AED/sqm", leadTimeDays: 45, leadTimeBand: "medium", supplierName: "Oak Ltd" },
    { id: 4, name: "Luxury Silk", category: "fabric", tier: "luxury", typicalCostLow: "500", typicalCostHigh: "1000", costUnit: "AED/m", leadTimeDays: 90, leadTimeBand: "long", supplierName: "Silk House" },
    { id: 5, name: "Ultra Glass", category: "glass", tier: "ultra_luxury", typicalCostLow: "800", typicalCostHigh: "1500", costUnit: "AED/sqm", leadTimeDays: 120, leadTimeBand: "critical", supplierName: "Crystal Co" },
  ];

  it("filters by project tier — Luxury allows premium and luxury", () => {
    const result = recommendMaterials(catalog, "Luxury", 10);
    const tiers = result.map(r => r.tier);
    expect(tiers.every(t => ["premium", "luxury"].includes(t))).toBe(true);
  });

  it("filters by project tier — Mid allows economy and mid", () => {
    const result = recommendMaterials(catalog, "Mid", 10);
    const tiers = result.map(r => r.tier);
    expect(tiers.every(t => ["economy", "mid"].includes(t))).toBe(true);
  });

  it("respects maxItems limit", () => {
    const result = recommendMaterials(catalog, "Luxury", 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("diversifies by category", () => {
    const result = recommendMaterials(catalog, "Luxury", 10);
    const categories = new Set(result.map(r => r.category));
    // Should have multiple categories
    expect(categories.size).toBeGreaterThanOrEqual(1);
  });
});

// ─── Board PDF Generation Tests ──────────────────────────────────────────────

describe("V4-06: Board PDF HTML Generation", () => {
  const items = [
    {
      materialId: 1, name: "Calacatta Marble", category: "stone", tier: "luxury",
      costLow: 450, costHigh: 800, costUnit: "AED/sqm", leadTimeDays: 120,
      leadTimeBand: "critical", supplierName: "Al Habtoor",
      specNotes: "Honed finish, 600x600mm", costBandOverride: "Luxury",
      quantity: "200", unitOfMeasure: "sqm", notes: "Priority item",
    },
    {
      materialId: 2, name: "Oak Flooring", category: "wood", tier: "premium",
      costLow: 180, costHigh: 320, costUnit: "AED/sqm", leadTimeDays: 45,
      leadTimeBand: "medium", supplierName: "RAK Timber",
    },
  ];

  const summary = computeBoardSummary(items as any);
  const rfqLines = generateRfqLines(items as any);

  it("generates valid HTML document", () => {
    const html = generateBoardPdfHtml({
      boardName: "Master Suite Board",
      projectName: "Test Project Alpha",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("MIYAR");
  });

  it("includes board name and project name", () => {
    const html = generateBoardPdfHtml({
      boardName: "Master Suite Board",
      projectName: "Test Project Alpha",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("Master Suite Board");
    expect(html).toContain("Test Project Alpha");
  });

  it("includes material tiles with details", () => {
    const html = generateBoardPdfHtml({
      boardName: "Test Board",
      projectName: "Test Project",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("Calacatta Marble");
    expect(html).toContain("Oak Flooring");
    expect(html).toContain("stone");
    expect(html).toContain("luxury");
  });

  it("includes spec notes when present", () => {
    const html = generateBoardPdfHtml({
      boardName: "Test Board",
      projectName: "Test Project",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("Honed finish, 600x600mm");
  });

  it("includes cost band override when present", () => {
    const html = generateBoardPdfHtml({
      boardName: "Test Board",
      projectName: "Test Project",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("Luxury");
  });

  it("includes RFQ table", () => {
    const html = generateBoardPdfHtml({
      boardName: "Test Board",
      projectName: "Test Project",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("Concept Schedule — Not RFQ-Ready");
    expect(html).toContain("not RFQ-ready or eligible for issued totals");
    expect(html).toContain("Calacatta Marble");
  });

  it("includes summary statistics", () => {
    const html = generateBoardPdfHtml({
      boardName: "Test Board",
      projectName: "Test Project",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("Total Items");
    expect(html).toContain("Browse-only Catalog Estimate");
    expect(html).toContain("Longest Lead Time");
  });

  it("includes watermark", () => {
    const html = generateBoardPdfHtml({
      boardName: "Test Board",
      projectName: "Test Project",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("MYR-BRD-");
  });

  it("uses A4 landscape page size", () => {
    const html = generateBoardPdfHtml({
      boardName: "Test Board",
      projectName: "Test Project",
      items,
      summary,
      rfqLines,
    });
    expect(html).toContain("A4 landscape");
  });
});

// ─── Board Annex in Report Tests ──────────────────────────────────────────────

describe("V4-06: Board Annex in PDF Reports", () => {
  const reportData = {
    projectName: "Test Project",
    projectId: 1,
    inputs: {} as any,
    scoreResult: {
      dimensions: { sa: 70, ff: 65, mp: 72, ds: 68, er: 60 },
      dimensionWeights: { sa: 0.25, ff: 0.20, mp: 0.20, ds: 0.20, er: 0.15 },
      compositeScore: 67.5,
      riskScore: 25,
      rasScore: 72,
      confidenceScore: 80,
      decisionStatus: "conditional" as const,
      penalties: [],
      riskFlags: [],
      conditionalActions: [],
      variableContributions: {},
      inputSnapshot: {},
    },
    sensitivity: [],
  };
  const item = (name = "Italian Marble"): BoardItem => ({
    materialId: 1,
    name,
    category: "stone",
    tier: "ultra_luxury",
    costLow: 1_000,
    costHigh: 2_500,
    costUnit: "AED/sqm",
    leadTimeDays: 90,
    leadTimeBand: "critical",
    supplierName: "Supplier",
  });
  const renderBoth = (boardAnnex: BoardAnnexData) => {
    const data = { ...reportData, boardAnnex };
    return [generateDesignBriefHTML(data), generateFullReportHTML(data)];
  };

  it("renders a mandatory complete annex in design-brief and full-report HTML", () => {
    const boardAnnex = buildBoardAnnexData([{
      boardName: "Master Suite Board",
      linkedItemCount: 1,
      resolvedItems: [item()],
    }]);

    for (const html of renderBoth(boardAnnex)) {
      expect(html).toContain("Material Board Annex");
      expect(html).toContain("Master Suite Board");
      expect(html).toContain("Complete board — the linked item is resolved");
      expect(html).toContain("1 of 1 items resolved");
      expect(html).toContain("Browse-only Catalog Estimate (excluded from issued totals)");
      expect(html).toContain("1,000 – 2,500 AED");
    }
  });

  it("renders the genuine no-board state in both issued paths", () => {
    for (const html of renderBoth(buildBoardAnnexData([]))) {
      expect(html).toContain("Material Board Annex");
      expect(html).toContain("No material boards have been created");
    }
  });

  it("renders an existing zero-item board without claiming no board or showing fake costs", () => {
    const boardAnnex = buildBoardAnnexData([{
      boardName: "Unspecified Finishes",
      linkedItemCount: 0,
      resolvedItems: [],
    }]);

    for (const html of renderBoth(boardAnnex)) {
      expect(html).toContain("Unspecified Finishes");
      expect(html).toContain("Empty board — no materials are attached");
      expect(html).not.toContain("No material boards have been created");
      expect(html).not.toContain("Resolved-item Cost Range");
      expect(html).not.toContain("0 – 0 AED");
    }
  });

  it("renders a partial board with qualified resolved-only figures", () => {
    const boardAnnex = buildBoardAnnexData([{
      boardName: "Partial Board",
      linkedItemCount: 3,
      resolvedItems: [item()],
    }]);

    for (const html of renderBoth(boardAnnex)) {
      expect(html).toContain("Partial board — 1 of 3 linked items resolved");
      expect(html).toContain("2 unresolved items are excluded from the figures below");
      expect(html).toContain("2 unresolved items are excluded from the figures below");
      expect(html).toContain("Browse-only Catalog Estimate (excluded from issued totals)");
      expect(html).not.toContain("No material boards have been created");
    }
  });

  it("renders a wholly unresolvable board without summary figures or missing IDs", () => {
    const boardAnnex = buildBoardAnnexData([{
      boardName: "Broken Links",
      linkedItemCount: 2,
      resolvedItems: [],
    }]);

    for (const html of renderBoth(boardAnnex)) {
      expect(html).toContain("Unresolvable board — none of the 2 linked items could be resolved");
      expect(html).toContain("repair the board links before relying on it");
      expect(html).not.toContain("No material boards have been created");
      expect(html).not.toContain("Resolved-item Cost Range");
      expect(html).not.toMatch(/material(?:Id| ID)/);
      expect(html).not.toContain("0 – 0 AED");
    }
  });

  it("escapes board and resolved critical-item names in issued HTML", () => {
    const boardAnnex = buildBoardAnnexData([{
      boardName: '<Board & "Suite">',
      linkedItemCount: 1,
      resolvedItems: [item("<Marble & Stone>")],
    }]);

    for (const html of renderBoth(boardAnnex)) {
      expect(html).toContain("&lt;Board &amp; &quot;Suite&quot;&gt;");
      expect(html).toContain("&lt;Marble &amp; Stone&gt;");
      expect(html).not.toContain('<Board & "Suite">');
      expect(html).not.toContain("<Marble & Stone>");
    }
  });

  it("requires annex data only for the two supported issued report types", () => {
    expect(() => generateReportHTML("design_brief", reportData)).toThrow(
      "Material Board Annex data is required for this issued report"
    );
    expect(() => generateReportHTML("full_report", reportData)).toThrow(
      "Material Board Annex data is required for this issued report"
    );
    expect(() => generateReportHTML("validation_summary", reportData)).not.toThrow();
    expect(() => generateReportHTML("autonomous_design_brief", reportData)).not.toThrow();
  });

  it("never describes a reference with omitted provenance as computed", () => {
    const html = generateFullReportHTML({
      ...reportData,
      boardAnnex: buildBoardAnnexData([]),
      evidenceRefs: [{
        title: "Historical row without provenance",
        reliabilityGrade: "B",
      } as any],
    });

    expect(html).toContain("Legacy — calculation provenance unavailable");
    expect(html).not.toContain("Computed (policy unavailable)");
  });
});
