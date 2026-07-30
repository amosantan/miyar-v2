import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { evaluateDatabaseAccess } from "../server/_core/database-safety";

const seedSource = readFileSync(
  "scripts/seed-ev04-claim-health-policy.ts",
  "utf8"
);
const remoteTarget =
  "mysql://service-token:secret@db.example.com:3306/miyar-v2";
const canonicalTarget = "db.example.com:3306/miyar-v2";

describe("EV-04 policy seed database authority", () => {
  it("declares seed authority rather than migration authority", () => {
    expect(seedSource).toContain('initializeDatabaseSafety("seed"');
    expect(seedSource).not.toContain('initializeDatabaseSafety("migrate"');
  });

  it("requires seed-specific approval for a remote-shared-shaped target without connecting", () => {
    expect(
      evaluateDatabaseAccess({
        operation: "seed",
        databaseUrl: remoteTarget,
        approval: `migrate@${canonicalTarget}`,
      })
    ).toMatchObject({
      allowed: false,
      reasonCode: "REMOTE_APPROVAL_MISMATCH",
    });
    expect(
      evaluateDatabaseAccess({
        operation: "seed",
        databaseUrl: remoteTarget,
        approval: `seed@${canonicalTarget}`,
      })
    ).toMatchObject({
      allowed: true,
      reasonCode: "REMOTE_APPROVAL_ALLOWED",
    });
    expect(
      evaluateDatabaseAccess({
        operation: "seed",
        databaseUrl: remoteTarget,
        approval: `seed+migrate@${canonicalTarget}`,
      })
    ).toMatchObject({
      allowed: true,
      reasonCode: "REMOTE_APPROVAL_ALLOWED",
    });
  });
});
