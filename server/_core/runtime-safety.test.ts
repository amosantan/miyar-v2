import { describe, expect, it } from "vitest";
import { isCronAuthorized, shouldStartBackgroundJobs } from "./runtime-safety";
import type { DatabaseDecision } from "./database-safety";

function decision(
  profile: DatabaseDecision["profile"],
  options: Partial<DatabaseDecision> = {}
): DatabaseDecision {
  return {
    allowed: true,
    profile,
    operation: "ingest",
    trustedDeployment: profile === "production",
    target: {
      class: "safe-loopback",
      host: "127.0.0.1",
      port: 3306,
      database: "miyar_local",
      canonical: "127.0.0.1:3306/miyar_local",
    },
    reasonCode: "SAFE_LOOPBACK_ALLOWED",
    ...options,
  };
}

describe("shouldStartBackgroundJobs", () => {
  it("keeps background jobs disabled by default in development", () => {
    expect(shouldStartBackgroundJobs(decision("local"), undefined)).toBe(false);
  });

  it("allows an explicit development opt-in", () => {
    expect(shouldStartBackgroundJobs(decision("local"), "true")).toBe(true);
  });

  it("preserves production scheduler behavior", () => {
    expect(shouldStartBackgroundJobs(decision("production"), undefined)).toBe(true);
  });

  it("never starts jobs for tests, denied targets, or absent databases", () => {
    expect(shouldStartBackgroundJobs(decision("test"), "true")).toBe(false);
    expect(shouldStartBackgroundJobs(decision("local", { allowed: false }), "true")).toBe(false);
    expect(
      shouldStartBackgroundJobs(
        decision("local", { target: { class: "absent" } }),
        "true"
      )
    ).toBe(false);
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
