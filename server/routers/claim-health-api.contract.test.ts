import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designRouter = readFileSync(
  new URL("./design-market-context.ts", import.meta.url),
  "utf8"
);
const marketRouter = readFileSync(
  new URL("./market-intelligence.ts", import.meta.url),
  "utf8"
);

describe("EV-04 claim-health API contract", () => {
  it("replaces source-wide fetch heuristics with the versioned safe projection", () => {
    const procedure = designRouter.slice(
      designRouter.indexOf("getDataFreshness:"),
      designRouter.indexOf("getEvidenceChain:")
    );
    expect(procedure).toContain("projectId");
    expect(procedure).toContain("requireDesignProject");
    expect(procedure).toContain("evaluateClaimHealth");
    expect(procedure).toContain("getPublicMarketEvidenceCounts");
    expect(procedure).not.toContain("lastSuccessfulFetch");
    expect(procedure).not.toContain("getConnectorHealthSummary");
    expect(procedure).not.toContain("getIngestionRunHistory");
    expect(procedure).not.toContain("runId");
    expect(procedure).not.toContain("sourceName");
  });

  it("keeps the customer data-health endpoint organization-bound and telemetry-free", () => {
    const procedure = marketRouter.slice(
      marketRouter.indexOf("dataHealth:"),
      marketRouter.indexOf("// ─── Default Source Registry Entries")
    );
    expect(procedure).toContain("orgProcedure");
    expect(procedure).toContain("evaluateClaimHealth");
    expect(procedure).not.toContain("getDataHealthStats");
    expect(procedure).not.toContain("getConnectorHealthSummary");
    expect(procedure).not.toContain("errorMessage");
  });
});
