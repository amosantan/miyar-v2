import { describe, expect, it } from "vitest";

import {
  EV04_APPROVED_POLICY_DOCUMENT,
  EV04_POLICY_VERSION,
  EV04_REQUIRED_CELL_SCHEMA_VERSION,
  canonicalizeClaimHealthValue,
  claimHealthDigest,
} from "./claim-health";
import {
  CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON,
  CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
} from "../engines/ingestion/claim-health";

describe("EV-04 claim-health persistence foundations", () => {
  it("canonicalizes object keys and dates byte-stably", () => {
    const left = {
      z: [2, 1],
      a: { clock: new Date("2026-07-30T08:00:00.000Z"), value: -0 },
    };
    const right = {
      a: { value: 0, clock: "2026-07-30T08:00:00.000Z" },
      z: [2, 1],
    };
    expect(canonicalizeClaimHealthValue(left)).toBe(
      canonicalizeClaimHealthValue(right)
    );
    expect(claimHealthDigest(left)).toBe(claimHealthDigest(right));
    expect(claimHealthDigest(left)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("binds array order and every content field into the digest", () => {
    expect(claimHealthDigest({ values: [1, 2] })).not.toBe(
      claimHealthDigest({ values: [2, 1] })
    );
    expect(claimHealthDigest({ state: "current" })).not.toBe(
      claimHealthDigest({ state: "aging" })
    );
  });

  it("rejects values that cannot be represented by canonical JSON", () => {
    expect(() => claimHealthDigest({ missing: undefined })).toThrow(TypeError);
    expect(() => claimHealthDigest({ invalid: Number.NaN })).toThrow(
      "Non-finite"
    );
    expect(() => claimHealthDigest({ invalid: Symbol("invalid") })).toThrow(
      "Unsupported canonical value"
    );
  });

  it("pins the approved default policy manifest and prefixed digest", () => {
    expect(EV04_APPROVED_POLICY_DOCUMENT).toMatchObject({
      policyVersion: EV04_POLICY_VERSION,
      requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
      exactRequiredCoveragePercentForCurrent: 100,
      freshness: {
        marketObservation: {
          currentThroughDays: 90,
          agingThroughDays: 365,
        },
      },
    });
    expect(claimHealthDigest(EV04_APPROVED_POLICY_DOCUMENT)).toBe(
      CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST
    );
    expect(canonicalizeClaimHealthValue(EV04_APPROVED_POLICY_DOCUMENT)).toBe(
      CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON
    );
  });
});
