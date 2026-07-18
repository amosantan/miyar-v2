import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "../db";
import { resetMarketEvidenceCacheForTests } from "./market-evidence";
import { resetPublicRateLimitForTests } from "./rate-limit";
import { systemRouter } from "./systemRouter";

const context = (remoteAddress = "127.0.0.1") => ({
  user: null,
  req: { socket: { remoteAddress }, headers: {} },
  res: {},
}) as any;

const valid = {
  transactionCount: 5000,
  transactionObservedThrough: "2026-02-24",
  rentContractCount: 5000,
  rentObservedThrough: "2026-02-27",
  projectCount: 3039,
};

describe("system.marketEvidenceSnapshot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetMarketEvidenceCacheForTests();
    resetPublicRateLimitForTests();
    delete process.env.TRUST_PROXY;
  });

  it("is unauthenticated, cached, and exposes only the closed public contract", async () => {
    const load = vi.spyOn(db, "getPublicMarketEvidenceCounts").mockResolvedValue(valid);
    const caller = systemRouter.createCaller(context());
    const first = await caller.marketEvidenceSnapshot();
    const second = await caller.marketEvidenceSnapshot();
    expect(first).toEqual(second);
    expect(load).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(first)).not.toMatch(/orgId|projectId|tenant|benchmark|connector|runId|health/);
  });

  it("rejects unexpected input before loading evidence", async () => {
    const load = vi.spyOn(db, "getPublicMarketEvidenceCounts").mockResolvedValue(valid);
    await expect((systemRouter.createCaller(context()).marketEvidenceSnapshot as any)({ projectId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(load).not.toHaveBeenCalled();
  });

  it("applies a per-address ceiling without sharing one anonymous bucket", async () => {
    vi.spyOn(db, "getPublicMarketEvidenceCounts").mockResolvedValue(valid);
    const firstAddress = systemRouter.createCaller(context("10.0.0.1"));
    for (let i = 0; i < 60; i += 1) await firstAddress.marketEvidenceSnapshot();
    for (let i = 0; i < 540; i += 1) {
      await expect(firstAddress.marketEvidenceSnapshot()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    }
    await expect(systemRouter.createCaller(context("10.0.0.2")).marketEvidenceSnapshot()).resolves.toMatchObject({ available: true });
  });
});
