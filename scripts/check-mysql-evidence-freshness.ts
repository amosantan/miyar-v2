/**
 * Fast, database-free guard for the MySQL authorization evidence contract.
 *
 * `.agent/state/TR03H_MYSQL_EVIDENCE.json` pins a SHA-256 for every file in
 * `REQUIRED_MYSQL_EVIDENCE_FILES`. Editing any pinned file without regenerating
 * the evidence invalidates the whole document, and `pnpm audit:authorization`
 * then reports one stale hash plus a long tail of "integration evidence status
 * drift" rows on unrelated procedures — a confusing cascade with a single
 * upstream cause (see `LES-046`).
 *
 * This check names the drifted files directly so the cause is obvious before a
 * merge rather than after one. It reads files only; it never opens a database
 * and never rewrites evidence.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  MYSQL_EVIDENCE_FILE,
  REQUIRED_MYSQL_EVIDENCE_FILES,
} from "./tr03h-mysql-evidence-contract";

export type EvidenceDriftFinding =
  | { kind: "evidence_unreadable"; detail: string }
  | { kind: "evidence_not_pass"; detail: string }
  | { kind: "missing_hash_entry"; file: string }
  | { kind: "file_unreadable"; file: string; detail: string }
  | { kind: "hash_drift"; file: string; recorded: string; actual: string }
  | { kind: "unexpected_hash_entry"; file: string };

export type EvidenceDocument = {
  status?: unknown;
  fileHashes?: Record<string, unknown>;
};

/**
 * Pure comparison so the drift rules stay testable without touching disk.
 * `hashOf` throws when a pinned file cannot be read.
 */
export function collectEvidenceDrift(input: {
  evidence: EvidenceDocument | undefined;
  requiredFiles: readonly string[];
  hashOf: (file: string) => string;
}): EvidenceDriftFinding[] {
  const findings: EvidenceDriftFinding[] = [];
  if (!input.evidence) {
    return [{ kind: "evidence_unreadable", detail: `${MYSQL_EVIDENCE_FILE} is missing or not valid JSON` }];
  }
  if (input.evidence.status !== "PASS") {
    findings.push({ kind: "evidence_not_pass", detail: `recorded status is ${JSON.stringify(input.evidence.status)}, expected "PASS"` });
  }
  const recorded = input.evidence.fileHashes;
  if (!recorded || typeof recorded !== "object") {
    return [...findings, { kind: "evidence_unreadable", detail: `${MYSQL_EVIDENCE_FILE} has no fileHashes object` }];
  }

  for (const file of input.requiredFiles) {
    const expected = recorded[file];
    if (typeof expected !== "string") {
      findings.push({ kind: "missing_hash_entry", file });
      continue;
    }
    let actual: string;
    try {
      actual = input.hashOf(file);
    } catch (error) {
      findings.push({ kind: "file_unreadable", file, detail: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (actual !== expected) findings.push({ kind: "hash_drift", file, recorded: expected, actual });
  }

  // A pinned entry with no corresponding contract file means the contract and
  // the evidence document have diverged; regeneration is required either way.
  const required = new Set(input.requiredFiles);
  for (const file of Object.keys(recorded)) {
    if (!required.has(file)) findings.push({ kind: "unexpected_hash_entry", file });
  }
  return findings;
}

export function describeFinding(finding: EvidenceDriftFinding): string {
  switch (finding.kind) {
    case "evidence_unreadable":
      return `Evidence unreadable: ${finding.detail}`;
    case "evidence_not_pass":
      return `Evidence is not a passing record: ${finding.detail}`;
    case "missing_hash_entry":
      return `No recorded hash for pinned file: ${finding.file}`;
    case "file_unreadable":
      return `Pinned file could not be read: ${finding.file} (${finding.detail})`;
    case "hash_drift":
      return `Changed since evidence was recorded: ${finding.file}\n    recorded ${finding.recorded}\n    actual   ${finding.actual}`;
    case "unexpected_hash_entry":
      return `Recorded hash is no longer in the evidence contract: ${finding.file}`;
  }
}

const REMEDIATION = `
Regenerate the evidence through the approved disposable-MySQL workflow. Never
hand-edit a hash or timestamp — the document is generated, and an edited hash
records a run that did not happen.

  TEST_DATABASE_URL="mysql://<user>:<password>@127.0.0.1:<port>/miyar_auth_test_<scope>" \\
    pnpm test:authorization:mysql

Run it after every other change in the same commit, so no pinned file moves
afterwards. See docs/runbooks/regulatory-source-acquisition.md.`;

function main(): void {
  const root = path.resolve(import.meta.dirname, "..");
  let evidence: EvidenceDocument | undefined;
  try {
    evidence = JSON.parse(readFileSync(path.join(root, MYSQL_EVIDENCE_FILE), "utf8")) as EvidenceDocument;
  } catch {
    evidence = undefined;
  }

  const findings = collectEvidenceDrift({
    evidence,
    requiredFiles: REQUIRED_MYSQL_EVIDENCE_FILES,
    hashOf: file => createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex"),
  });

  if (findings.length === 0) {
    console.log(`MySQL evidence is current: ${REQUIRED_MYSQL_EVIDENCE_FILES.length} pinned files match ${MYSQL_EVIDENCE_FILE}.`);
    return;
  }

  console.error(findings.map(finding => `- ${describeFinding(finding)}`).join("\n"));
  console.error(REMEDIATION);
  process.exitCode = 1;
}

// Only run the CLI when invoked directly, so tests can import the pure helpers.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}
