import { describe, expect, it } from "vitest";
import { isCronAuthorized, shouldStartBackgroundJobs } from "./runtime-safety";

describe("shouldStartBackgroundJobs", () => {
  it("keeps background jobs disabled by default in development", () => {
    expect(shouldStartBackgroundJobs("development", undefined)).toBe(false);
  });

  it("allows an explicit development opt-in", () => {
    expect(shouldStartBackgroundJobs("development", "true")).toBe(true);
  });

  it("preserves production scheduler behavior", () => {
    expect(shouldStartBackgroundJobs("production", undefined)).toBe(true);
  });
});

describe("isCronAuthorized", () => {
  it("fails closed when the cron secret is missing", () => {
    expect(isCronAuthorized(undefined, undefined)).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  });

  it("rejects a missing or incorrect bearer token", () => {
    expect(isCronAuthorized(undefined, "secret")).toBe(false);
    expect(isCronAuthorized("Bearer wrong", "secret")).toBe(false);
  });

  it("accepts the configured bearer token", () => {
    expect(isCronAuthorized("Bearer secret", "secret")).toBe(true);
  });
});
