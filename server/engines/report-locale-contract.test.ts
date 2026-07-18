import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("TR-10 export locale contract", () => {
  it("validates English/Arabic locale on every server export boundary", () => {
    const contracts: Array<[string, string[]]> = [
      ["../routers/project.ts", ["generateReport:"]],
      ["../routers/design.ts", ["generateBrief:", "exportBriefDocx:", "exportBoardPdf:", "exportInvestorPdf:", "resolveShareLink:"]],
      ["../routers/intelligence.ts", ["exportComparisonPDF:"]],
      ["../routers/portfolio.ts", ["generateReport:"]],
      ["../routers/autonomous.ts", ["generateBrief:"]],
    ];

    for (const [file, endpointNames] of contracts) {
      const router = source(file);
      for (const [index, endpoint] of endpointNames.entries()) {
        const start = router.indexOf(endpoint);
        const next = index + 1 < endpointNames.length ? router.indexOf(endpointNames[index + 1], start) : router.length;
        expect(start, `${file} ${endpoint}`).toBeGreaterThanOrEqual(0);
        expect(router.slice(start, next)).toContain('locale: z.enum(["en", "ar"]).default("en")');
      }
    }
  });

  it("renders an explicit selector and typed locale payload on every browser export surface", () => {
    const clientFiles = [
      "../../client/src/pages/Reports.tsx",
      "../../client/src/pages/ProjectDetail.tsx",
      "../../client/src/pages/DesignBrief.tsx",
      "../../client/src/pages/BoardComposer.tsx",
      "../../client/src/pages/DesignStudio.tsx",
      "../../client/src/pages/InvestorSummary.tsx",
      "../../client/src/pages/ScenarioComparison.tsx",
      "../../client/src/pages/PortfolioPage.tsx",
    ];
    for (const file of clientFiles) {
      const client = source(file);
      expect(client, file).toContain("ReportLocaleSelect");
      expect(client, file).toContain("locale: reportLocale");
    }
  });
});
