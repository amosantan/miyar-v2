import { describe, expect, it } from "vitest";
import {
  normalizeCustomerClaimHealthProjection,
  safeClaimHealthReason,
} from "./claim-health-view-model";

const safeProjection = {
  claimState: "current_with_fallback",
  evaluatedAt: "2026-07-30T10:00:00.000Z",
  policyVersion: "ev04-claim-health-v1",
  policyManifestDigest: `sha256:${"a".repeat(64)}`,
  requiredCellSchemaVersion: "ev04-required-cell-v1",
  counts: { required: 1, eligible: 1, exact: 0, fallback: 1, optional: 0 },
  reasonCodes: ["approved_fallback"],
  cells: [
    {
      cellRef: `sha256:${"b".repeat(64)}`,
      catalogueId: "material-project-v1",
      requirement: "required",
      match: "approved_fallback",
      authority: "governed_benchmark",
      freshness: "current",
      cadence: "not_applicable",
      quality: "pass",
      confidence: "known",
      incident: "none",
      fallbackCode: "emirate_to_uae",
      observedThrough: "2026-07-29T00:00:00.000Z",
      reasonCodes: ["approved_fallback"],
    },
  ],
} as const;

describe("claim-health customer projection", () => {
  it("accepts the canonical safe projection and preserves coverage counts", () =>
    expect(
      normalizeCustomerClaimHealthProjection(safeProjection)
    ).toMatchObject({
      claimState: "current_with_fallback",
      counts: { required: 1, eligible: 1, exact: 0, fallback: 1, optional: 0 },
    }));
  it("fails closed when legacy source telemetry is received", () =>
    expect(
      normalizeCustomerClaimHealthProjection({
        overallHealth: "healthy",
        freshCount: 3,
        latestRun: { runId: "secret" },
      })
    ).toMatchObject({ claimState: "unknown" }));
  it("copies only the approved safe fields from an otherwise valid response", () => {
    const normalized = normalizeCustomerClaimHealthProjection({
      ...safeProjection,
      latestRun: { runId: "private-run-id", rawError: "private failure" },
    });
    expect(normalized).not.toHaveProperty("latestRun");
  });
  it("fails closed for missing policy metadata and impossible counts", () =>
    expect(
      normalizeCustomerClaimHealthProjection({
        ...safeProjection,
        policyVersion: "",
        counts: {
          required: 1,
          eligible: 2,
          exact: 1,
          fallback: 0,
          optional: 0,
        },
      }).claimState
    ).toBe("unknown"));
  it("never renders arbitrary server reason text", () => {
    expect(
      safeClaimHealthReason("raw_connector_error: credentials leaked", "en")
    ).toBe("Evidence status is unavailable");
    expect(safeClaimHealthReason("approved_fallback", "ar")).toBe(
      "بديل أبعادي معتمد"
    );
  });
  it("fails closed for unsupported identities and malformed digests", () => {
    expect(
      normalizeCustomerClaimHealthProjection({
        ...safeProjection,
        policyVersion: "ev04-claim-health-v99",
      }).claimState
    ).toBe("unknown");
    expect(
      normalizeCustomerClaimHealthProjection({
        ...safeProjection,
        policyManifestDigest: "sha256:not-a-digest",
      }).claimState
    ).toBe("unknown");
    expect(
      normalizeCustomerClaimHealthProjection({
        ...safeProjection,
        requiredCellSchemaVersion: "ev04-required-cell-v99",
      }).claimState
    ).toBe("unknown");
  });
  it("rejects internally inconsistent current projections", () => {
    expect(
      normalizeCustomerClaimHealthProjection({
        ...safeProjection,
        claimState: "current",
      }).claimState
    ).toBe("unknown");
    expect(
      normalizeCustomerClaimHealthProjection({
        ...safeProjection,
        counts: { ...safeProjection.counts, required: 3 },
      }).claimState
    ).toBe("unknown");
  });
});
