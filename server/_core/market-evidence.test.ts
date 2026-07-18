import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedMarketEvidenceSnapshot, resetMarketEvidenceCacheForTests, validateMarketEvidenceSnapshot } from "./market-evidence";

const valid = {
  transactionCount: "5000",
  transactionObservedThrough: "2026-02-24",
  rentContractCount: 5000,
  rentObservedThrough: "2026-02-27",
  projectCount: 3039,
};

describe("public market evidence snapshot", () => {
  beforeEach(resetMarketEvidenceCacheForTests);

  it("returns the closed indexed-subset DTO for valid aggregate evidence", () => {
    expect(validateMarketEvidenceSnapshot(valid)).toEqual({
      available: true,
      scope: "indexed_subset",
      source: {
        nameEn: "Dubai Land Department",
        nameAr: "دائرة الأراضي والأملاك في دبي",
        url: "https://dubailand.gov.ae/en/open-data/real-estate-data/",
      },
      datasets: {
        transactions: { count: 5000, recordsDatedThrough: "2026-02-24" },
        rentContracts: { count: 5000, recordsDatedThrough: "2026-02-27" },
        projects: { count: 3039 },
      },
    });
  });

  it.each([
    ["zero transactions", { ...valid, transactionCount: 0 }],
    ["zero rents", { ...valid, rentContractCount: 0 }],
    ["zero projects", { ...valid, projectCount: 0 }],
    ["fractional count", { ...valid, projectCount: 1.5 }],
    ["unsafe count", { ...valid, projectCount: Number.MAX_SAFE_INTEGER + 1 }],
    ["malformed date", { ...valid, transactionObservedThrough: "2026-02-30" }],
    ["timestamp date", { ...valid, rentObservedThrough: "2026-02-27T00:00:00Z" }],
    ["missing date", { ...valid, rentObservedThrough: null }],
  ])("fails closed for %s", (_name, raw) => {
    expect(validateMarketEvidenceSnapshot(raw)).toEqual({ available: false });
  });

  it("coalesces concurrent loads and caches only the validated public DTO", async () => {
    const load = vi.fn(async () => valid);
    const [first, second] = await Promise.all([
      getCachedMarketEvidenceSnapshot(load, 1000),
      getCachedMarketEvidenceSnapshot(load, 1000),
    ]);
    expect(first).toEqual(second);
    expect(load).toHaveBeenCalledTimes(1);
    await getCachedMarketEvidenceSnapshot(load, 1001);
    expect(load).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(first)).not.toMatch(/orgId|projectId|tenant|benchmark|connector|runId/);
  });

  it("returns exactly unavailable without leaking loader failures", async () => {
    const result = await getCachedMarketEvidenceSnapshot(async () => {
      throw new Error("secret database host");
    });
    expect(result).toEqual({ available: false });
  });

  it("refetches after success expiry", async () => {
    const load = vi.fn(async () => valid);
    await getCachedMarketEvidenceSnapshot(load, 1_000);
    await getCachedMarketEvidenceSnapshot(load, 301_001);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("uses a short failure TTL and recovers after it expires", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue(valid);
    await expect(getCachedMarketEvidenceSnapshot(load, 1_000)).resolves.toEqual({ available: false });
    await expect(getCachedMarketEvidenceSnapshot(load, 1_001)).resolves.toEqual({ available: false });
    expect(load).toHaveBeenCalledTimes(1);
    await expect(getCachedMarketEvidenceSnapshot(load, 21_001)).resolves.toMatchObject({ available: true });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
