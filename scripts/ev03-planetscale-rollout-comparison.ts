import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import {
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_DATABASE_TARGET,
  EV03_PRODUCTION_TARGET,
} from "../server/engines/material-pricing/ev03-identity-backfill";
import {
  assertMaterialPricingCompletionSummaryBindsEvidence,
  type MaterialPricingComparisonEvidence,
} from "../server/engines/material-pricing/rollout-comparison";

const ORGANIZATION = "amr-saleh-hotmail";
const DATABASE = "miyar-v2";
const BRANCH = "main";
const OPERATION_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CAPTURE_BYTES = 1024 * 1024;
const argv = process.argv.slice(2);

function valueAfter(flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function safeArg(value: string): string {
  if (!/^[A-Za-z0-9_./,:=-]+$/.test(value)) {
    throw new Error("Unsafe EV-03 operational argument");
  }
  return value;
}

function providerEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of [
    "PATH",
    "HOME",
    "XDG_CONFIG_HOME",
    "LANG",
    "LC_ALL",
    "TERM",
    "TMPDIR",
  ]) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  return { ...environment, ...extra };
}

function pscaleJson(command: string[]): unknown {
  const result = spawnSync("pscale", [...command, "--format", "json"], {
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
    env: providerEnvironment(),
  });
  if (result.status !== 0) {
    throw new Error("PlanetScale OAuth/deploy-request preflight failed");
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("PlanetScale preflight did not return valid JSON");
  }
}

function assertSecureEvidencePath(path: string): void {
  if (!isAbsolute(path)) {
    throw new Error("EV-03 production evidence path must be absolute");
  }
  if (existsSync(path)) {
    throw new Error("Refusing to overwrite EV-03 production evidence");
  }
  const getUid = process.getuid;
  if (!getUid) {
    throw new Error("EV-03 owner-only path checks require POSIX");
  }
  const parent = lstatSync(dirname(path));
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== getUid.call(process) ||
    (parent.mode & 0o077) !== 0
  ) {
    throw new Error(
      "EV-03 production evidence parent must be an owner-only directory"
    );
  }
}

const outputPath = valueAfter("--output");
if (!outputPath) {
  throw new Error("Production EV-03 comparison requires --output");
}
assertSecureEvidencePath(outputPath);
const databaseApproval = process.env.MIYAR_DATABASE_APPROVAL;
if (databaseApproval !== `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`) {
  throw new Error(
    "Production EV-03 comparison requires the exact externally supplied database approval binding"
  );
}
const deployRequests = (valueAfter("--deploy-requests") ?? "")
  .split(",")
  .filter(Boolean);
if (deployRequests.length === 0) {
  throw new Error("--deploy-requests requires at least one applied request");
}

const migration = readFileSync(
  new URL("../drizzle/0062_ev03_material_consolidation.sql", import.meta.url)
);
const digest = createHash("sha256").update(migration).digest("hex");
if (digest !== EV03_MIGRATION_SHA256) {
  throw new Error("Checked-out EV-03 migration digest mismatch");
}

const auth = pscaleJson(["auth", "check"]) as {
  authenticated?: boolean;
  organization?: string;
};
if (!auth.authenticated || auth.organization !== ORGANIZATION) {
  throw new Error(`PlanetScale OAuth must be authenticated to ${ORGANIZATION}`);
}
for (const request of deployRequests) {
  if (!/^[0-9]+$/.test(request)) {
    throw new Error("EV-03 deploy request identifiers must be numeric");
  }
  const deployment = pscaleJson([
    "deploy-request",
    "show",
    DATABASE,
    safeArg(request),
    "--org",
    ORGANIZATION,
  ]) as {
    into_branch?: string;
    deployment_state?: string;
    notes?: string;
  };
  if (
    deployment.into_branch !== BRANCH ||
    !["complete", "complete_pending_revert"].includes(
      deployment.deployment_state ?? ""
    ) ||
    !deployment.notes?.includes(EV03_MIGRATION_SHA256)
  ) {
    throw new Error(
      `Deploy request ${request} is not an applied exact-0062 EV-03 batch`
    );
  }
}

const nonce = randomBytes(32).toString("hex");
const innerArgs = [
  process.execPath,
  "--import",
  "tsx",
  "scripts/ev03-rollout-comparison.ts",
  "--output",
  outputPath,
  "--production-target",
  EV03_PRODUCTION_TARGET,
  "--expected-migration-sha256",
  EV03_MIGRATION_SHA256,
  "--provider-attestation",
  nonce,
];
const command = innerArgs.map(safeArg).join(" ");
const child = spawn(
  "pscale",
  [
    "connect",
    DATABASE,
    BRANCH,
    "--org",
    ORGANIZATION,
    "--role",
    "reader",
    "--execute",
    command,
  ],
  {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: providerEnvironment({
      EV03_PLANETSCALE_WRAPPER_ATTESTATION: nonce,
      MIYAR_DATABASE_APPROVAL: databaseApproval,
    }),
  }
);

let capturedOutput = "";
let capturedBytes = 0;
for (const stream of [child.stdout, child.stderr]) {
  stream?.on("data", (chunk: Buffer) => {
    if (capturedBytes >= MAX_CAPTURE_BYTES) return;
    capturedBytes += chunk.length;
    capturedOutput += chunk
      .subarray(
        0,
        Math.max(0, MAX_CAPTURE_BYTES - capturedBytes + chunk.length)
      )
      .toString("utf8");
  });
}
let timedOut = false;
function killChildGroup(signal: NodeJS.Signals): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}
const timeout = setTimeout(() => {
  timedOut = true;
  killChildGroup("SIGTERM");
  setTimeout(() => killChildGroup("SIGKILL"), 5_000).unref();
}, OPERATION_TIMEOUT_MS);
const exitCode = await new Promise<number | null>((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", resolveExit);
});
clearTimeout(timeout);
if (timedOut || exitCode !== 0) {
  throw new Error(
    "EV-03 PlanetScale rollout comparison failed or timed out; no evidence was accepted."
  );
}
const safeResult = capturedOutput.match(
  /\[ev03-rollout-comparison\] PASS target=([^\s]+) eligible=(\d+) equal=(\d+) different=(\d+) insufficient=(\d+) digest=([a-f0-9]{64})/
);
if (!safeResult) {
  throw new Error(
    "EV-03 inner comparison did not emit a valid completion record"
  );
}
const evidence = lstatSync(outputPath);
if (
  !evidence.isFile() ||
  evidence.isSymbolicLink() ||
  evidence.uid !== process.getuid?.call(process) ||
  (evidence.mode & 0o777) !== 0o600
) {
  throw new Error(
    "EV-03 production evidence is not an exclusive owner-only file"
  );
}
let producedEvidence: MaterialPricingComparisonEvidence;
try {
  producedEvidence = JSON.parse(
    readFileSync(outputPath, "utf8")
  ) as MaterialPricingComparisonEvidence;
} catch {
  throw new Error("EV-03 produced comparison evidence is not valid JSON");
}
assertMaterialPricingCompletionSummaryBindsEvidence(
  {
    target: safeResult[1],
    eligibleRowCount: Number(safeResult[2]),
    equalRowCount: Number(safeResult[3]),
    differentRowCount: Number(safeResult[4]),
    insufficientRowCount: Number(safeResult[5]),
    evidenceDigest: safeResult[6],
  },
  producedEvidence
);
console.log(safeResult[0]);
