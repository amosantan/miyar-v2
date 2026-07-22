import { describe, expect, it } from "vitest";
import { collectEvidenceDrift, describeFinding } from "./check-mysql-evidence-freshness";

const files = ["scripts/run-guarded-mysql-tests.ts", "drizzle/schema.ts"] as const;
const passing = {
  status: "PASS",
  fileHashes: {
    "scripts/run-guarded-mysql-tests.ts": "a".repeat(64),
    "drizzle/schema.ts": "b".repeat(64),
  },
};
const hashOf = (file: string) => (passing.fileHashes as Record<string, string>)[file];

describe("MySQL evidence freshness guard", () => {
  it("reports no drift when every pinned file still matches", () => {
    expect(collectEvidenceDrift({ evidence: passing, requiredFiles: files, hashOf })).toEqual([]);
  });

  it("names the exact file that changed after the evidence was recorded", () => {
    const findings = collectEvidenceDrift({
      evidence: passing,
      requiredFiles: files,
      // Reproduces the real BR-06 regression: one edited script, evidence untouched.
      hashOf: file => (file === "scripts/run-guarded-mysql-tests.ts" ? "c".repeat(64) : hashOf(file)),
    });
    expect(findings).toEqual([
      { kind: "hash_drift", file: "scripts/run-guarded-mysql-tests.ts", recorded: "a".repeat(64), actual: "c".repeat(64) },
    ]);
    expect(describeFinding(findings[0])).toContain("scripts/run-guarded-mysql-tests.ts");
  });

  it("fails closed when the evidence document is missing or has no hashes", () => {
    expect(collectEvidenceDrift({ evidence: undefined, requiredFiles: files, hashOf })).toEqual([
      { kind: "evidence_unreadable", detail: expect.stringContaining("missing or not valid JSON") },
    ]);
    expect(collectEvidenceDrift({ evidence: { status: "PASS" }, requiredFiles: files, hashOf }))
      .toEqual([{ kind: "evidence_unreadable", detail: expect.stringContaining("no fileHashes") }]);
  });

  it("rejects a non-passing evidence record even when hashes match", () => {
    const findings = collectEvidenceDrift({ evidence: { ...passing, status: "FAILED" }, requiredFiles: files, hashOf });
    expect(findings).toContainEqual({ kind: "evidence_not_pass", detail: expect.stringContaining("FAILED") });
  });

  it("flags a pinned file with no recorded hash and an unreadable pinned file", () => {
    expect(collectEvidenceDrift({ evidence: passing, requiredFiles: [...files, "drizzle/0099_new.sql"], hashOf }))
      .toContainEqual({ kind: "missing_hash_entry", file: "drizzle/0099_new.sql" });

    const findings = collectEvidenceDrift({
      evidence: passing,
      requiredFiles: files,
      hashOf: file => { if (file === "drizzle/schema.ts") throw new Error("ENOENT"); return hashOf(file); },
    });
    expect(findings).toContainEqual({ kind: "file_unreadable", file: "drizzle/schema.ts", detail: "ENOENT" });
  });

  it("flags a recorded hash that the contract no longer pins", () => {
    expect(collectEvidenceDrift({ evidence: passing, requiredFiles: ["drizzle/schema.ts"], hashOf }))
      .toContainEqual({ kind: "unexpected_hash_entry", file: "scripts/run-guarded-mysql-tests.ts" });
  });
});
