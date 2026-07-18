import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PUBLIC_CLAIM_REGISTRY } from "../../shared/public-claims";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("TR-11 truthful public claims", () => {
  it("keeps a bilingual machine-readable registry with evidence and qualifications", () => {
    expect(PUBLIC_CLAIM_REGISTRY.length).toBeGreaterThanOrEqual(8);
    for (const claim of PUBLIC_CLAIM_REGISTRY) {
      expect(claim.id).toBeTruthy();
      expect(claim.copy.en).toBeTruthy();
      expect(claim.copy.ar).toBeTruthy();
      expect(claim.evidence).toBeTruthy();
      expect(claim.qualification).toBeTruthy();
    }
  });

  it("removes fixed public live, verified, weight and certification claims", () => {
    const files = [
      "client/src/pages/Home.tsx", "client/src/pages/Methodology.tsx", "client/src/pages/ShareView.tsx",
      "client/src/pages/DesignStudio.tsx", "client/src/pages/BriefEditor.tsx", "client/src/pages/SpacePlanner.tsx",
      "client/src/pages/DesignBrief.tsx", "client/src/pages/InvestorSummary.tsx",
      "client/src/pages/market-intel/DldInsights.tsx", "client/src/pages/market-intel/MarketIntelligence.tsx",
      "client/src/pages/market-intel/IngestionMonitor.tsx",
    ].map(read).join("\n");
    for (const forbidden of [
      "updated daily", "Live DLD", "live market pricing", "Real-time benchmark",
      "Market-Verified", "Sustainability Grade", '|| "Silver"',
      "DLD-Backed Recommendations",
      "DLD Live Feed", "Live Market Ingestion Engine", "Cost updates in real time",
      "Live market benchmarks", "DLD-Backed Recommendations", "(market-verified)",
      'weight: "25%"', 'weight: "20%"', 'weight: "15%"',
      "never use unverified", "all cost data comes from verified",
      "ensuring institutional credibility", "DLD Transaction Calibration",
    ]) expect(files.toLowerCase()).not.toContain(forbidden.toLowerCase());

    const generatedOutputFiles = [
      "server/engines/design-brief.ts", "server/engines/docx-brief.ts",
      "server/engines/board-composer.ts",
    ].map(read).join("\n");
    for (const forbidden of [
      "Live market benchmarks", "DLD-Backed Recommendations", "(Market-Verified)",
    ]) expect(generatedOutputFiles.toLowerCase()).not.toContain(forbidden.toLowerCase());
    expect(generatedOutputFiles).toContain("indicative benchmark estimate");
    expect(generatedOutputFiles).toContain("MIYAR Ratio Guidance:");
  });

  it("keeps Home scoped to the indexed subset and observed-through date", () => {
    const home = read("client/src/pages/Home.tsx");
    expect(home).toContain("not complete DLD coverage");
    expect(home).toContain("recordsDatedThrough");
    expect(home).toContain("PUBLIC_CLAIMS.observedThrough");
  });

  it("keeps legal publication outside TR-11", () => {
    const app = read("client/src/App.tsx");
    expect(app).not.toContain('path="/privacy"');
    expect(app).not.toContain('path="/terms"');
  });

  it("qualifies share values and requires explicit DLD provenance", () => {
    const share = read("client/src/pages/ShareView.tsx");
    const router = read("server/routers/design-sharing.ts");
    const publicShareStart = router.indexOf("resolveShareLink: publicRateLimitedProcedure");
    expect(publicShareStart).toBeGreaterThanOrEqual(0);
    const publicShareRouter = router.slice(publicShareStart);
    expect(share).toContain("estimateQualifier");
    expect(share).not.toContain("DLD-Backed Recommendations");
    expect(share).not.toContain("sustainCertTarget");
    expect(router).toContain('kind: "miyar_ratio_guideline"');
    expect(router).toContain("marketContext:");
    expect(share).toContain("Separate market context");
    expect(router).toContain('salesPremium: "tier_assumption"');
    expect(publicShareRouter).not.toContain("Number(dldBench.saleTransactionCount) || 100");
    expect(publicShareRouter).not.toContain("Number(dldBench.saleP50) || 25000");
    const spaceEngine = read("server/engines/design/space-benchmarking.ts");
    expect(spaceEngine).not.toContain("projected +");
    expect(spaceEngine).not.toContain("historically correlated");
    expect(spaceEngine).toContain("not a predicted or DLD-calibrated sale uplift");
    const persistedClaims = [
      read("server/routers/project.ts"),
      read("server/engines/scoring.ts"),
      read("server/engines/space-evidence.ts"),
    ].join("\n");
    expect(persistedClaims).not.toContain("transaction-backed DLD area benchmark");
    expect(persistedClaims).not.toContain("The comparison uses transaction-backed DLD area data");
    expect(persistedClaims).toContain("separate DLD area context");
  });
});
