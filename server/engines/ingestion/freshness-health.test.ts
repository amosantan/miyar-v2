import { describe, expect, it } from "vitest";
import { deriveOverallFreshnessHealth } from "./freshness-health";

describe("overall freshness health", () => {
  it("never treats zero-source or all-unknown evidence as healthy", () => {
    expect(deriveOverallFreshnessHealth({ totalSources: 0, agingCount: 0, staleCount: 0, unknownCount: 0 })).toBe("unknown");
    expect(deriveOverallFreshnessHealth({ totalSources: 3, agingCount: 0, staleCount: 0, unknownCount: 3 })).toBe("unknown");
  });

  it("preserves deterministic known-source states", () => {
    expect(deriveOverallFreshnessHealth({ totalSources: 10, agingCount: 0, staleCount: 4, unknownCount: 0 })).toBe("degraded");
    expect(deriveOverallFreshnessHealth({ totalSources: 10, agingCount: 6, staleCount: 0, unknownCount: 0 })).toBe("aging");
    expect(deriveOverallFreshnessHealth({ totalSources: 10, agingCount: 1, staleCount: 1, unknownCount: 0 })).toBe("healthy");
  });
});
