import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import {
  EV03_IDENTITY_BACKFILL_APPROVAL_REF,
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_DATABASE_TARGET,
  EV03_PRODUCTION_TARGET,
  assertEv03CompletionSummaryBindsManifest,
  type Ev03IdentityBackfillManifest,
} from "../server/engines/material-pricing/ev03-identity-backfill";

const ORGANIZATION = "amr-saleh-hotmail";
const DATABASE = "miyar-v2";
const BRANCH = "main";
const OPERATION_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CAPTURE_BYTES = 1024 * 1024;
const argv = process.argv.slice(2);
const flags = new Set(argv);
const apply = flags.has("--apply");
const rollback = flags.has("--rollback");
const writeQuiesced = flags.has("--write-quiesced");
const expectZeroActions = flags.has("--expect-zero-actions");

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

function assertSecureManifestPath(
  path: string,
  options: { mustExist: boolean }
): void {
  if (!isAbsolute(path)) {
    throw new Error("EV-03 production manifest path must be absolute");
  }
  const getUid = process.getuid;
  if (!getUid) {
    throw new Error("EV-03 owner-only path checks require POSIX");
  }
  const ownerUid = getUid.call(process);
  const parent = lstatSync(dirname(path));
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== ownerUid ||
    (parent.mode & 0o077) !== 0
  ) {
    throw new Error(
      "EV-03 production manifest parent must be an owner-only directory"
    );
  }
  if (options.mustExist) {
    const file = lstatSync(path);
    if (
      !file.isFile() ||
      file.isSymbolicLink() ||
      file.uid !== ownerUid ||
      (file.mode & 0o777) !== 0o600
    ) {
      throw new Error(
        "EV-03 production manifest must be an owner-owned regular 0600 file"
      );
    }
  } else if (existsSync(path)) {
    throw new Error("Refusing to overwrite existing EV-03 manifest");
  }
}

if (apply && rollback) throw new Error("Choose --apply or --rollback");
if (expectZeroActions && (apply || rollback)) {
  throw new Error("--expect-zero-actions is valid only for a dry-run");
}
if (rollback && !writeQuiesced) {
  throw new Error(
    "Production rollback requires --write-quiesced after application/API writes are disabled and verified"
  );
}
const manifestPath = valueAfter("--manifest");
if (!manifestPath) {
  throw new Error("Production EV-03 requires --manifest for every run");
}
assertSecureManifestPath(manifestPath, { mustExist: apply || rollback });
const confirmedFingerprint = valueAfter("--confirm-fingerprint");
if (apply && !confirmedFingerprint) {
  throw new Error("--apply requires --confirm-fingerprint");
}
const suppliedApprovalRef = valueAfter("--approval-ref");
if (
  suppliedApprovalRef !== undefined &&
  suppliedApprovalRef !== EV03_IDENTITY_BACKFILL_APPROVAL_REF
) {
  throw new Error("EV-03 production approval reference is pinned");
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
  "scripts/ev03-identity-backfill.ts",
  ...(apply ? ["--apply"] : rollback ? ["--rollback"] : []),
  ...(writeQuiesced ? ["--write-quiesced"] : []),
  ...(expectZeroActions ? ["--expect-zero-actions"] : []),
  "--manifest",
  manifestPath,
  ...(confirmedFingerprint
    ? ["--confirm-fingerprint", confirmedFingerprint]
    : []),
  "--production-target",
  EV03_PRODUCTION_TARGET,
  "--expected-migration-sha256",
  EV03_MIGRATION_SHA256,
  "--approval-ref",
  EV03_IDENTITY_BACKFILL_APPROVAL_REF,
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
    "readwriter",
    "--execute",
    command,
  ],
  {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: providerEnvironment({
      MIYAR_DATABASE_APPROVAL: `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`,
      EV03_PLANETSCALE_WRAPPER_ATTESTATION: nonce,
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
    "EV-03 PlanetScale identity backfill failed or timed out. Do not retry apply until manifest and live state are reconciled."
  );
}
const safeResult = capturedOutput.match(
  /\[ev03-identity-backfill\] (dry-run|apply|rollback) PASS target=([^\s]+) fingerprint=([a-f0-9]{64}) rows=(\d+) decisions=(\d+)/
);
if (!safeResult) {
  throw new Error(
    "EV-03 inner backfill did not emit a valid completion record"
  );
}
assertSecureManifestPath(manifestPath, { mustExist: true });
let producedManifest: Ev03IdentityBackfillManifest;
try {
  producedManifest = JSON.parse(
    readFileSync(manifestPath, "utf8")
  ) as Ev03IdentityBackfillManifest;
} catch {
  throw new Error("EV-03 produced manifest is not valid JSON");
}
const expectedMode = apply ? "apply" : rollback ? "rollback" : "dry-run";
if (safeResult[1] !== expectedMode) {
  throw new Error("EV-03 completion mode does not match the requested mode");
}
assertEv03CompletionSummaryBindsManifest(
  {
    mode: expectedMode,
    target: safeResult[2],
    fingerprint: safeResult[3],
    rowCount: Number(safeResult[4]),
    decisionCount: Number(safeResult[5]),
  },
  producedManifest
);
console.log(safeResult[0]);
