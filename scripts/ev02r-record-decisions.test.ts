import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXPECTED_EV02R_UNRESOLVED_ROWS,
  buildEv02rDecisionPacket,
  createEv02rSourceRowFingerprint,
  type Ev02rInventoryRow,
} from "../server/engines/material-pricing/unresolved-remediation";
import {
  EV02R_PRODUCTION_INVENTORY_SHA256,
  recordEv02rDecisions,
} from "./ev02r-record-decisions";

function fixtureArtifact() {
  const inventory: Ev02rInventoryRow[] =
    EXPECTED_EV02R_UNRESOLVED_ROWS.map(expected => {
      const legacyRow = {
        id: expected.legacyRowId,
        productName: `Legacy ${expected.legacyRowId}`,
      };
      return {
        legacyRowId: expected.legacyRowId,
        unresolvedReason: expected.reason,
        legacyRow,
        sourceRowFingerprint: createEv02rSourceRowFingerprint(legacyRow),
        currentProductLink: {
          productId: expected.legacyRowId + 1_000,
          identityKey: `legacy:${expected.legacyRowId}`,
        },
        legacyProvenance: {
          sourceLabel: "legacy",
          sourceUrl: null,
          provenancePolicyVersion: "legacy-v0",
        },
        usageImpact: {
          downstreamConsumers: ["material_library_browse"],
          governedFinancialImpact: "insufficient",
          currentEligibility: "insufficient",
        },
        proposedResolution: null,
        decision: "needs_evidence",
        decisionReason: "evidence outstanding",
      };
    });
  const packet = buildEv02rDecisionPacket(inventory);
  return {
    version: "ev02r-inventory-v1" as const,
    decisionPacketSha256: packet.sha256,
    decisionPacket: packet.packet,
  };
}

describe("EV-02R human decision recorder", () => {
  it("rejects any inventory not bound to the verified production digest", () => {
    const artifact = fixtureArtifact();
    expect(artifact.decisionPacketSha256).not.toBe(
      EV02R_PRODUCTION_INVENTORY_SHA256
    );
    expect(() =>
      recordEv02rDecisions(artifact, "2026-07-30T12:00:00.000Z")
    ).toThrow("unbound inventory");
  });

  it("requires a canonical UTC recording timestamp", () => {
    const source = readFileSync(
      new URL("./ev02r-record-decisions.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("parsedRecordedAt.toISOString() !== recordedAt");
  });

  it("creates output exclusively with owner-only permissions", () => {
    const source = readFileSync(
      new URL("./ev02r-record-decisions.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain('flag: "wx"');
    expect(source).toContain("mode: 0o600");

    const root = mkdtempSync(join(tmpdir(), "miyar-ev02r-decision-mode-"));
    const output = join(root, "artifact.json");
    writeFileSync(output, "{}", { flag: "wx", mode: 0o600 });
    chmodSync(output, 0o600);
    expect(statSync(output).mode & 0o777).toBe(0o600);
  });
});
