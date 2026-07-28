import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import process from "node:process";

import {
  EV02_MIGRATION_SHA256,
  EV02_PRODUCTION_DATABASE_TARGET,
  EV02_PRODUCTION_TARGET,
} from "../server/engines/material-pricing/backfill-execution-target";

const ORG = "amr-saleh-hotmail";
const DATABASE = "miyar-v2";
const BRANCH = "main";
const OPERATION_TIMEOUT_MS = 10 * 60 * 1000;
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const rollback = args.has("--rollback");
const writeQuiesced = args.has("--write-quiesced");

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safeArg(value: string): string {
  if (!/^[A-Za-z0-9_./,:=-]+$/.test(value)) {
    throw new Error(`Unsafe EV-02 operational argument: ${value}`);
  }
  return value;
}

function pscaleJson(command: string[]): unknown {
  const result = spawnSync("pscale", [...command, "--format", "json"], {
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`PlanetScale preflight failed: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

if (apply && rollback) throw new Error("Choose --apply or --rollback");
if (rollback && !writeQuiesced) {
  throw new Error(
    "Production rollback requires --write-quiesced after application/API writes are disabled and verified"
  );
}
const manifestArg = valueAfter("--manifest");
if ((apply || rollback) && !manifestArg) {
  throw new Error("--apply and --rollback require --manifest");
}
if (manifestArg && !isAbsolute(manifestArg)) {
  throw new Error("EV-02 production manifest path must be absolute");
}
const manifestPath = manifestArg ? resolve(manifestArg) : undefined;
if (manifestPath) safeArg(manifestPath);

const migration = readFileSync(
  resolve("drizzle/0061_ev02_evidence_price_schema.sql")
);
const digest = createHash("sha256").update(migration).digest("hex");
if (digest !== EV02_MIGRATION_SHA256) {
  throw new Error("Checked-out EV-02 migration digest mismatch");
}

const auth = pscaleJson(["auth", "check"]) as {
  authenticated?: boolean;
  organization?: string;
};
if (!auth.authenticated || auth.organization !== ORG) {
  throw new Error(`PlanetScale OAuth must be authenticated to ${ORG}`);
}
const deployRequests = (valueAfter("--deploy-requests") ?? "")
  .split(",")
  .filter(Boolean);
if (!deployRequests.length) {
  throw new Error(
    "--deploy-requests requires the deployed EV-02 request numbers"
  );
}
for (const request of deployRequests) {
  safeArg(request);
  const deployment = pscaleJson([
    "deploy-request",
    "show",
    DATABASE,
    request,
    "--org",
    ORG,
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
    !deployment.notes?.includes(EV02_MIGRATION_SHA256)
  ) {
    throw new Error(`Deploy request ${request} is not an applied EV-02 batch`);
  }
}

const nonce = randomBytes(32).toString("hex");
const innerArgs = [
  process.execPath,
  "--import",
  "tsx",
  "scripts/ev02-backfill.ts",
  ...(apply ? ["--apply"] : rollback ? ["--rollback"] : []),
  ...(writeQuiesced ? ["--write-quiesced"] : []),
  ...(manifestPath ? ["--manifest", manifestPath] : []),
  "--production-target",
  EV02_PRODUCTION_TARGET,
  "--expected-migration-sha256",
  EV02_MIGRATION_SHA256,
  "--approval-ref",
  "user-approved:2026-07-28:ev02-0061-backfill",
  "--wrapper-attestation",
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
    ORG,
    "--role",
    "readwriter",
    "--execute",
    command,
  ],
  {
    detached: true,
    stdio: "inherit",
    env: {
      ...process.env,
      MIYAR_DATABASE_APPROVAL: `migrate@${EV02_PRODUCTION_DATABASE_TARGET}`,
      EV02_PLANETSCALE_WRAPPER_ATTESTATION: nonce,
    },
  }
);
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
    "EV-02 PlanetScale backfill failed or timed out. Do not retry apply until manifest and live state are reconciled."
  );
}
