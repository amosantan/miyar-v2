import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateBoardPdfHtml } from "./board-pdf";
import { generateDesignBriefDocx } from "./docx-brief";
import { generateInvestorPdfHtml } from "./investor-pdf";
import {
  generatePortfolioReportHTML,
  generateReportHTML,
  generateScenarioComparisonHTML,
} from "./pdf-report";

const ANNEX_HEADING = "Material Board Annex";

const baseReport = {
  projectName: "Annex Boundary Fixture",
  projectId: 101,
  inputs: {} as any,
  scoreResult: {
    dimensions: { sa: 70, ff: 65, mp: 72, ds: 68, er: 60 },
    dimensionWeights: { sa: 0.25, ff: 0.2, mp: 0.2, ds: 0.2, er: 0.15 },
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

/** Extract textual XML entries from the central directory of a DOCX ZIP. */
function docxXmlText(buffer: Buffer): string {
  const chunks: string[] = [];
  for (let offset = 0; offset + 46 <= buffer.length; ) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x02014b50) {
      offset += 1;
      continue;
    }

    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    if (fileName.startsWith("word/") && fileName.endsWith(".xml")) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const xml =
        compression === 0
          ? compressed
          : compression === 8
            ? inflateRawSync(compressed)
            : Buffer.alloc(0);
      chunks.push(xml.toString("utf8"));
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return chunks.join("\n");
}

describe("Material Board Annex output boundary", () => {
  it("renders only in design-brief and full-report HTML", () => {
    const withAnnex = {
      ...baseReport,
      boardAnnex: { state: "no_boards" as const, boards: [] },
    };

    expect(generateReportHTML("design_brief", withAnnex)).toContain(
      ANNEX_HEADING
    );
    expect(generateReportHTML("full_report", withAnnex)).toContain(
      ANNEX_HEADING
    );
    expect(generateReportHTML("validation_summary", baseReport)).not.toContain(
      ANNEX_HEADING
    );
    expect(
      generateReportHTML("autonomous_design_brief", {
        ...baseReport,
        autonomousContent: `# Autonomous\n${ANNEX_HEADING.replace("Annex", "Schedule")}`,
      })
    ).not.toContain(ANNEX_HEADING);
  });

  it("stays out of board, investor, scenario, and portfolio HTML exports", () => {
    const boardHtml = generateBoardPdfHtml({
      boardName: "Approved Board Export",
      projectName: "Boundary Fixture",
      items: [],
      summary: {
        totalItems: 0,
        estimatedCostLow: 0,
        estimatedCostHigh: 0,
        currency: "AED",
        longestLeadTimeDays: 0,
        criticalPathItems: [],
        tierDistribution: {},
        categoryDistribution: {},
      },
      rfqLines: [],
    });

    const investorHtml = generateInvestorPdfHtml({
      projectName: "Boundary Fixture",
      typology: "Residential",
      location: "Dubai",
      tier: "Upper-mid",
      style: "Modern",
      gfaSqm: 1_000,
      execSummary: "Synthetic fixture",
      designDirection: {},
      spaces: [],
      materials: [],
      materialConstants: [],
      totalFitoutBudget: 0,
      costPerSqm: 0,
      sustainabilityGrade: "C",
      salePremiumPct: 0,
      estimatedSalesPremiumAed: 0,
    });

    const scenarioHtml = generateScenarioComparisonHTML({
      projectName: "Boundary Fixture",
      projectId: 101,
      baselineScenario: { id: 1, name: "Baseline", scores: null, roi: null },
      comparedScenarios: [],
    });

    const portfolioHtml = generatePortfolioReportHTML({
      portfolioName: "Boundary Portfolio",
      portfolioId: 7,
      totalProjects: 0,
      scoredCount: 0,
      avgComposite: 0,
      avgRisk: 0,
      projects: [],
      distributions: [],
      failurePatterns: [],
      improvementLevers: [],
      complianceHeatmap: [],
    });

    for (const html of [boardHtml, investorHtml, scenarioHtml, portfolioHtml]) {
      expect(html).not.toContain(ANNEX_HEADING);
    }
  });

  it("stays out of the generated design-brief DOCX", async () => {
    const docx = await generateDesignBriefDocx({
      projectIdentity: { projectName: "Boundary Fixture" },
      designNarrative: {},
      materialSpecifications: {},
      boqFramework: { totalEstimatedSqm: null, coreAllocations: [] },
      detailedBudget: {},
      designerInstructions: {
        phasedDeliverables: {},
        authorityApprovals: [],
        coordinationRequirements: [],
        procurementAndLogistics: {},
      },
      version: 1,
      projectName: "Boundary Fixture",
    });

    expect(docxXmlText(docx)).not.toContain(ANNEX_HEADING);
  });

  it("keeps Annex imports out of non-issued generator modules", () => {
    for (const relativeFile of [
      "./board-pdf.ts",
      "./investor-pdf.ts",
      "./docx-brief.ts",
    ]) {
      const source = readFileSync(
        new URL(relativeFile, import.meta.url),
        "utf8"
      );
      expect(source).not.toMatch(/from\s+["']\.\/board-annex["']/);
      expect(source).not.toContain(ANNEX_HEADING);
    }
  });
});
