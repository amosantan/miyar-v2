import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import {
  EV02_MIGRATION_SHA256,
  EV02_PRODUCTION_DATABASE_TARGET,
} from "../server/engines/material-pricing/backfill-execution-target";
import {
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_DATABASE_TARGET,
  EV03_PRODUCTION_TARGET,
} from "../server/engines/material-pricing/ev03-identity-backfill";
import {
  EXPECTED_EV02R_UNRESOLVED_ROWS,
  buildEv02rDecisionPacket,
  canonicalizeEv02rJson,
  type Ev02rDecisionPacket,
  type Ev02rJsonValue,
} from "../server/engines/material-pricing/unresolved-remediation";

const ORGANIZATION = "amr-saleh-hotmail";
const DATABASE = "miyar-v2";
const BRANCH = "main";
const OPERATION_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CAPTURE_BYTES = 1024 * 1024;
const TRUSTED_EV02_MANIFEST_SHA256 =
  "d39ffebeedca686e4f0fa35c22b3d27ac246b2493f9f0595f05616cfcffc7508";
const REQUIRED_EV02_DEPLOY_REQUESTS = ["10", "11", "12", "13", "14", "15"];
const REQUIRED_EV03_DEPLOY_REQUESTS = ["16", "17", "18", "19", "20", "21"];

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safeArg(value: string): string {
  if (!/^[A-Za-z0-9_./,:=-]+$/.test(value)) {
    throw new Error("Unsafe EV-02R operational argument");
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
    throw new Error("EV-02R PlanetScale preflight failed");
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("EV-02R PlanetScale preflight returned invalid JSON");
  }
}

function assertSecureOutputPath(path: string): void {
  if (!isAbsolute(path) || existsSync(path)) {
    throw new Error("EV-02R output must be a new absolute path");
  }
  const getUid = process.getuid;
  if (!getUid) throw new Error("EV-02R owner checks require POSIX");
  const parent = lstatSync(dirname(path));
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== getUid.call(process) ||
    (parent.mode & 0o077) !== 0
  ) {
    throw new Error("EV-02R output parent must be owner-only");
  }
}

function verifyDeployRequests(
  requests: string[],
  requiredRequests: readonly string[],
  expectedDigest: string
): void {
  if (
    requests.length !== requiredRequests.length ||
    requests.some((request, index) => request !== requiredRequests[index])
  ) {
    throw new Error("EV-02R requires the complete ordered deploy request set");
  }
  for (const request of requests) {
    if (!/^[0-9]+$/.test(request)) {
      throw new Error("EV-02R deploy request identifier must be numeric");
    }
    const deployment = pscaleJson([
      "deploy-request",
      "show",
      DATABASE,
      request,
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
      !deployment.notes?.includes(expectedDigest)
    ) {
      throw new Error("EV-02R deploy request does not match the governed schema");
    }
  }
}

const outputPath = valueAfter("--output");
const ev02ManifestPath = valueAfter("--ev02-manifest");
if (!outputPath || !ev02ManifestPath) {
  throw new Error("EV-02R inventory requires --output and --ev02-manifest");
}
assertSecureOutputPath(outputPath);
if (!isAbsolute(ev02ManifestPath)) {
  throw new Error("EV-02R EV-02 manifest path must be absolute");
}
const ev02ManifestBytes = readFileSync(ev02ManifestPath);
const ev02Manifest = JSON.parse(ev02ManifestBytes.toString("utf8")) as {
  version?: string;
  databaseTarget?: string;
  appliedAt?: string;
  unresolved?: Array<{ table?: string; id?: number; reason?: string }>;
};
if (
  ev02Manifest.version !== "ev02-backfill-v1" ||
  ev02Manifest.databaseTarget !== EV02_PRODUCTION_DATABASE_TARGET ||
  ev02Manifest.appliedAt !== "2026-07-28T20:34:26.493Z" ||
  ev02Manifest.unresolved?.length !== 43 ||
  ev02Manifest.unresolved.filter(
    row => row.reason === "unknown_unit_basis"
  ).length !== 37 ||
  ev02Manifest.unresolved.filter(
    row => row.reason === "incomplete_price_range"
  ).length !== 6 ||
  ev02Manifest.unresolved.some(row => row.table !== "material_library") ||
  ev02Manifest.unresolved.some(row => {
    const expected = EXPECTED_EV02R_UNRESOLVED_ROWS.find(
      candidate => candidate.legacyRowId === row.id
    );
    return !expected || expected.reason !== row.reason;
  }) ||
  EXPECTED_EV02R_UNRESOLVED_ROWS.some(
    expected =>
      !ev02Manifest.unresolved?.some(
        row =>
          row.id === expected.legacyRowId &&
          row.reason === expected.reason &&
          row.table === "material_library"
      )
  )
) {
  throw new Error("EV-02R source manifest is not the exact 43-row EV-02 set");
}
const ev02ManifestSha256 = createHash("sha256")
  .update(ev02ManifestBytes)
  .digest("hex");
if (ev02ManifestSha256 !== TRUSTED_EV02_MANIFEST_SHA256) {
  throw new Error(
    "EV-02R source manifest digest is not the trusted production artifact"
  );
}
const databaseApproval = process.env.MIYAR_DATABASE_APPROVAL;
if (databaseApproval !== `migrate@${EV02_PRODUCTION_DATABASE_TARGET}`) {
  throw new Error("EV-02R requires the exact external database approval");
}

const auth = pscaleJson(["auth", "check"]) as {
  authenticated?: boolean;
  organization?: string;
};
if (!auth.authenticated || auth.organization !== ORGANIZATION) {
  throw new Error("EV-02R PlanetScale OAuth organization mismatch");
}
verifyDeployRequests(
  (valueAfter("--ev02-deploy-requests") ?? "").split(",").filter(Boolean),
  REQUIRED_EV02_DEPLOY_REQUESTS,
  EV02_MIGRATION_SHA256
);
verifyDeployRequests(
  (valueAfter("--ev03-deploy-requests") ?? "").split(",").filter(Boolean),
  REQUIRED_EV03_DEPLOY_REQUESTS,
  EV03_MIGRATION_SHA256
);

for (const [migrationUrl, expectedDigest, label] of [
  [
    new URL("../drizzle/0061_ev02_evidence_price_schema.sql", import.meta.url),
    EV02_MIGRATION_SHA256,
    "EV-02",
  ],
  [
    new URL("../drizzle/0062_ev03_material_consolidation.sql", import.meta.url),
    EV03_MIGRATION_SHA256,
    "EV-03",
  ],
] as const) {
  const migrationDigest = createHash("sha256")
    .update(readFileSync(migrationUrl))
    .digest("hex");
  if (migrationDigest !== expectedDigest) {
    throw new Error(`Checked-out ${label} migration digest mismatch`);
  }
}

const nonce = randomBytes(32).toString("hex");
const stagingPath = `${outputPath}.ev02r-${nonce}.partial`;
assertSecureOutputPath(stagingPath);
const command = [
  process.execPath,
  "--import",
  "tsx",
  "scripts/ev02r-inventory.ts",
  "--output",
  stagingPath,
  "--production-target",
  EV03_PRODUCTION_TARGET,
  "--expected-migration-sha256",
  EV03_MIGRATION_SHA256,
  "--provider-attestation",
  nonce,
  "--expected-ev02-manifest-sha256",
  ev02ManifestSha256,
]
  .map(safeArg)
  .join(" ");

try {
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
        EV02R_PLANETSCALE_WRAPPER_ATTESTATION: nonce,
        MIYAR_DATABASE_APPROVAL: databaseApproval,
      }),
    }
  );
  let capturedOutput = "";
  let capturedBytes = 0;
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk: Buffer) => {
      if (capturedBytes >= MAX_CAPTURE_BYTES) return;
      const remaining = MAX_CAPTURE_BYTES - capturedBytes;
      capturedOutput += chunk.subarray(0, remaining).toString("utf8");
      capturedBytes += Math.min(chunk.length, remaining);
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
    throw new Error("EV-02R reader inventory failed; no output accepted");
  }
  const summary = capturedOutput.match(
    /\[ev02r-inventory\] PASS target=([^\s]+) rows=(\d+) unknownUnit=(\d+) incompleteRange=(\d+) digest=([a-f0-9]{64})/
  );
  if (
    !summary ||
    summary[1] !== EV03_PRODUCTION_DATABASE_TARGET ||
    Number(summary[2]) !== 43 ||
    Number(summary[3]) !== 37 ||
    Number(summary[4]) !== 6
  ) {
    throw new Error("EV-02R inventory completion summary is invalid");
  }
  const evidenceStat = lstatSync(stagingPath);
  if (
    !evidenceStat.isFile() ||
    evidenceStat.isSymbolicLink() ||
    evidenceStat.uid !== process.getuid?.call(process) ||
    (evidenceStat.mode & 0o777) !== 0o600
  ) {
    throw new Error("EV-02R staged inventory is not owner-only");
  }
  const inventory = JSON.parse(readFileSync(stagingPath, "utf8")) as {
    version?: string;
    databaseTarget?: string;
    ev02ManifestSha256?: string;
    rowCount?: number;
    unknownUnitBasisCount?: number;
    incompletePriceRangeCount?: number;
    decisionPacketSha256?: string;
    decisionPacket?: Ev02rDecisionPacket;
  };
  const rebuiltPacket = inventory.decisionPacket
    ? buildEv02rDecisionPacket(inventory.decisionPacket.inventory)
    : null;
  if (
    inventory.version !== "ev02r-inventory-v1" ||
    inventory.databaseTarget !== EV03_PRODUCTION_DATABASE_TARGET ||
    inventory.ev02ManifestSha256 !== ev02ManifestSha256 ||
    inventory.rowCount !== 43 ||
    inventory.unknownUnitBasisCount !== 37 ||
    inventory.incompletePriceRangeCount !== 6 ||
    inventory.decisionPacket?.inventory.length !== 43 ||
    inventory.decisionPacketSha256 !== summary[5] ||
    rebuiltPacket?.sha256 !== inventory.decisionPacketSha256 ||
    !inventory.decisionPacket ||
    canonicalizeEv02rJson(
      inventory.decisionPacket as unknown as Ev02rJsonValue
    ) !== rebuiltPacket?.canonicalJson
  ) {
    throw new Error("EV-02R inventory artifact does not bind its summary");
  }
  linkSync(stagingPath, outputPath);
  try {
    unlinkSync(stagingPath);
  } catch {
    try {
      unlinkSync(outputPath);
    } catch {
      // The final error remains fail-closed inside an owner-only directory.
    }
    throw new Error("EV-02R inventory promotion failed");
  }
  console.log(summary[0]);
} finally {
  if (existsSync(stagingPath)) unlinkSync(stagingPath);
}
