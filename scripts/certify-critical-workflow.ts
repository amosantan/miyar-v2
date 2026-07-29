import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import { initializeDatabaseSafety } from "../server/_core/database-safety";
import {
  TR13_EXPECTED_RECONCILIATION,
  TR13_WORKFLOW_FIXTURE_VERSION,
  tr13GovernedPricingEnvironment,
  tr13GovernedSnapshotFromLiveRow,
} from "../tests/fixtures/workflows/tr13-workflow-fixtures";
import {
  assertTr13WorkflowEnvironment,
  tr13ChildEnvironment,
} from "./tr13-workflow-certification-contract";
import {
  resolveTr13SourceProvenance,
  sameTr13SourceProvenance,
  type Tr13SourceProvenance,
} from "./tr13-workflow-source-provenance";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(ROOT, "tmp", "tr13-workflow-certification");
const MANIFEST = path.join(OUTPUT, "manifest.json");

type JsonRecord = Record<string, any>;
type CommandRecord = {
  stage: string;
  command: string;
  result: "PASS" | "FAILED";
};

async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(new Error(`TR-13 port ${port} is already in use`))
    );
    server.listen(port, "127.0.0.1", () =>
      server.close(error => (error ? reject(error) : resolve()))
    );
  });
}

function fail(message: string): never {
  throw new Error(message);
}

function run(
  stage: string,
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  commands: CommandRecord[],
  options: { scanShareSecrets?: boolean } = {}
): void {
  const record: CommandRecord = {
    stage,
    command: `${command} ${args.join(" ")}`,
    result: "FAILED",
  };
  commands.push(record);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: environment,
    stdio: options.scanShareSecrets ? "pipe" : "inherit",
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (options.scanShareSecrets) {
    const output = Buffer.concat([
      Buffer.isBuffer(result.stdout)
        ? result.stdout
        : Buffer.from(result.stdout ?? ""),
      Buffer.isBuffer(result.stderr)
        ? result.stderr
        : Buffer.from(result.stderr ?? ""),
    ]).toString("utf8");
    // Persist a sanitized copy before any verdict so a failing journey stays
    // diagnosable; the replacements cannot match the secret-scan patterns.
    const sanitizedOutput = output
      .replace(/\/share\/(?!:token)[A-Za-z0-9_-]{8,}/g, "/share/[REDACTED]")
      .replace(
        /(shareToken["']?\s*[:=]\s*["'])[A-Za-z0-9_-]{8,}/gi,
        "$1[REDACTED]"
      );
    const sanitizedLogName = `${stage}.log`;
    writeFileSync(path.join(OUTPUT, sanitizedLogName), sanitizedOutput);
    if (
      /\/share\/(?!:token)[A-Za-z0-9_-]{8,}/.test(output) ||
      /shareToken["']?\s*[:=]\s*["'][A-Za-z0-9_-]{8,}/i.test(output)
    ) {
      fail(`${stage} exposed a public-share secret in process output`);
    }
    writeFileSync(
      path.join(OUTPUT, "browser-process-log-evidence.json"),
      `${JSON.stringify(
        {
          status: "PASS",
          fullShareUrls: 0,
          rawShareTokens: 0,
          sanitizedProcessLog: sanitizedLogName,
        },
        null,
        2
      )}\n`
    );
    if (result.error || result.status !== 0) {
      process.stderr.write(
        `${stage} failed; sanitized process output tail (full log: ${path.join(
          "tmp/tr13-workflow-certification",
          sanitizedLogName
        )}):\n${sanitizedOutput.slice(-16_000)}\n`
      );
    }
  }
  if (result.error)
    fail(`${stage} did not complete within its bounded runtime`);
  if (result.status !== 0) fail(`${stage} exited unsuccessfully`);
  record.result = "PASS";
}

function readJson(name: string): JsonRecord {
  try {
    return JSON.parse(
      readFileSync(path.join(OUTPUT, name), "utf8")
    ) as JsonRecord;
  } catch {
    return fail(`Required sanitized evidence ${name} is missing or invalid`);
  }
}

function assertNoSecretBearingArtifacts(): void {
  const findings: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const absolutePath = path.join(directory, entry);
      if (statSync(absolutePath).isDirectory()) {
        visit(absolutePath);
        continue;
      }
      const contents = readFileSync(absolutePath);
      const text = contents.toString("utf8");
      if (/\/share\/(?!:token)[A-Za-z0-9_-]{8,}/.test(text)) {
        findings.push(path.relative(OUTPUT, absolutePath));
      }
      if (/shareToken["']?\s*[:=]\s*["'][A-Za-z0-9_-]{8,}/i.test(text)) {
        findings.push(path.relative(OUTPUT, absolutePath));
      }
    }
  };
  visit(OUTPUT);
  if (findings.length > 0) {
    for (const relativePath of new Set(findings)) {
      rmSync(path.join(OUTPUT, relativePath), { force: true });
    }
    fail("Secret-bearing browser or report evidence was detected and removed");
  }
  writeFileSync(
    path.join(OUTPUT, "secret-scan-evidence.json"),
    `${JSON.stringify(
      {
        status: "PASS",
        fullShareUrls: 0,
        rawShareTokens: 0,
        inspectedRoot: "tmp/tr13-workflow-certification",
      },
      null,
      2
    )}\n`
  );
}

function expectedWorkflowFingerprint(): string {
  return createHash("sha256")
    .update(JSON.stringify(TR13_EXPECTED_RECONCILIATION))
    .digest("hex");
}

function assertIntegrationEvidence(evidence: JsonRecord): void {
  if (evidence.status !== "PASS" || evidence.syntheticOnly !== true)
    fail("Real-MySQL integration evidence is incomplete");
  if (
    evidence.workflowReconciliationFingerprint !== expectedWorkflowFingerprint()
  )
    fail("Real-MySQL reconciliation fingerprint does not match the fixture");
  const values = evidence.reconciliations ?? {};
  if (
    values.fitOutAreaM2 !== TR13_EXPECTED_RECONCILIATION.fitOutAreaM2 ||
    values.roomAreaM2 !== TR13_EXPECTED_RECONCILIATION.roomAreaM2 ||
    values.allocationPct !== TR13_EXPECTED_RECONCILIATION.allocationPct ||
    values.allocationSurfacesMatchFormula !==
      TR13_EXPECTED_RECONCILIATION.allocationSurfacesMatchFormula ||
    values.mqiTotalCostMin !== TR13_EXPECTED_RECONCILIATION.costAed.min ||
    values.mqiTotalCostMid !== TR13_EXPECTED_RECONCILIATION.costAed.mid ||
    values.mqiTotalCostMax !== TR13_EXPECTED_RECONCILIATION.costAed.max ||
    values.mqiPriceCoverage?.priced !==
      TR13_EXPECTED_RECONCILIATION.priceCoverage.priced ||
    values.mqiPriceCoverage?.unpriced !==
      TR13_EXPECTED_RECONCILIATION.priceCoverage.unpriced ||
    values.mqiPriceCoverage?.state !==
      TR13_EXPECTED_RECONCILIATION.priceCoverage.state
  )
    fail("Real-MySQL numerical reconciliation is incomplete");
}

function collectFinalEvidence() {
  const integration = readJson("integration-evidence.json");
  const runtimeMatrix = readJson("runtime-matrix-evidence.json");
  const render = readJson("render-evidence.json");
  const browser = readJson("browser-evidence.json");
  assertIntegrationEvidence(integration);
  const runtimeNode = runtimeMatrix.profiles?.node;
  const runtimeServerless = runtimeMatrix.profiles?.serverless;
  const runtimeReconciliation = runtimeNode?.reconciliation;
  if (
    runtimeMatrix.status !== "PASS" ||
    runtimeMatrix.syntheticOnly !== true ||
    runtimeMatrix.actualAppRouter !== true ||
    runtimeMatrix.fixtureResetBeforeEachProfile !== true ||
    runtimeMatrix.parity?.reportFingerprint !== true ||
    runtimeMatrix.parity?.reconciliation !== true ||
    runtimeMatrix.parity?.activePublicContract !== true ||
    runtimeMatrix.parity?.concealed404Body !== true ||
    runtimeMatrix.parity?.privacyHeaders !== true ||
    !/^[a-f0-9]{64}$/.test(runtimeNode?.reportRenderInputFingerprint ?? "") ||
    runtimeNode?.reportRenderInputFingerprint !==
      runtimeServerless?.reportRenderInputFingerprint ||
    JSON.stringify(runtimeNode?.reconciliation) !==
      JSON.stringify(runtimeServerless?.reconciliation) ||
    runtimeNode?.security?.activeShareReadOnlyAndMinimized !== true ||
    runtimeNode?.security?.invalidExpiredRevokedNeverIssuedConcealed !== true ||
    runtimeNode?.security?.projectWideRevocationThroughActualRouter !== true ||
    runtimeServerless?.security?.activeShareReadOnlyAndMinimized !== true ||
    runtimeServerless?.security?.invalidExpiredRevokedNeverIssuedConcealed !==
      true ||
    runtimeServerless?.security?.projectWideRevocationThroughActualRouter !==
      true ||
    JSON.stringify(runtimeNode?.privacyHeaders) !==
      JSON.stringify({
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      }) ||
    JSON.stringify(runtimeNode?.privacyHeaders) !==
      JSON.stringify(runtimeServerless?.privacyHeaders) ||
    runtimeReconciliation?.fitOutAreaM2 !==
      TR13_EXPECTED_RECONCILIATION.fitOutAreaM2 ||
    runtimeReconciliation?.roomAreaM2 !==
      TR13_EXPECTED_RECONCILIATION.roomAreaM2 ||
    runtimeReconciliation?.allocationPct !==
      TR13_EXPECTED_RECONCILIATION.allocationPct ||
    runtimeReconciliation?.costAed?.min !==
      TR13_EXPECTED_RECONCILIATION.costAed.min ||
    runtimeReconciliation?.costAed?.mid !==
      TR13_EXPECTED_RECONCILIATION.costAed.mid ||
    runtimeReconciliation?.costAed?.max !==
      TR13_EXPECTED_RECONCILIATION.costAed.max ||
    runtimeReconciliation?.priceCoverage?.priced !==
      TR13_EXPECTED_RECONCILIATION.priceCoverage.priced ||
    runtimeReconciliation?.priceCoverage?.unpriced !==
      TR13_EXPECTED_RECONCILIATION.priceCoverage.unpriced ||
    runtimeReconciliation?.priceCoverage?.state !==
      TR13_EXPECTED_RECONCILIATION.priceCoverage.state
  )
    fail("Real-appRouter Node/serverless runtime matrix is incomplete");
  if (
    render.status !== "PASS" ||
    render.horizontalOverflow !== false ||
    !Array.isArray(render.blankPages) ||
    render.blankPages.length !== 0 ||
    !render.textChecks ||
    Object.values(render.textChecks).some(value => value !== true) ||
    render.reportRenderInputFingerprint !==
      integration.reportRenderInputFingerprint
  )
    fail("Stored report render evidence is incomplete or mismatched");
  for (const key of [
    "publicHomeInspected",
    "publicLoginInspected",
    "unauthenticatedProtectedAccessDenied",
    "quickCreate",
    "assumptionsConfirmed",
    "evaluationRun",
    "canonicalFirstProjectAuthority",
    "legacySpaceProgramWriteRefused",
    "canonicalGeometryDraftApprovedByAdmin",
    "canonicalMqiFailsClosedPendingFinishScope",
    "noLegacyProgrammeMaterialized",
    "spaceProgrammeScreenInspected",
    "mqiScreenInspected",
    "assistantDeferredUntilOpen",
    "assistantMarkdownLoadedOnDemand",
    "reportRendererLoadedOnDemand",
    "mobileAuthenticatedDashboard",
    "mobileAssistantPanel",
    "mobileAuthenticatedProject",
    "mobileAuthenticatedReports",
    "adminShareCreated",
    "mobilePublicShareReadOnly",
    "projectShareRevoked",
    "priorShareConcealedAfterRevocation",
    "memberShareControlsHidden",
    "viewerShareControlsHidden",
    "foreignProjectAccessConcealed",
  ]) {
    if (browser[key] !== true) fail(`Browser evidence is missing ${key}`);
  }
  if (
    !Number.isSafeInteger(browser.createdProjectId) ||
    browser.createdProjectId !== browser.criticalWorkflowProjectId ||
    browser.sameProjectThroughoutCriticalJourney !== true ||
    browser.structuredBriefGeneratedThroughApi !== true ||
    browser.insufficientFullReportRejectedThroughApi !== true ||
    browser.storedValidationSummaryGeneratedThroughApi !== true ||
    browser.aiAdvisorSharePrerequisite !== "synthetic-browser-fixture" ||
    browser.aiAdvisorGenerationCertifiedInVitestMysqlRouter !== true
  ) {
    fail(
      "Browser evidence does not prove one UI-created project across the critical journey"
    );
  }
  if (
    browser.syntheticOnly !== true ||
    browser.mobileAuthenticatedHorizontalOverflow !== false ||
    browser.mobileHorizontalOverflow !== false ||
    browser.unexpectedRequestFailures !== 0 ||
    browser.unexpectedConsoleErrors !== 0 ||
    browser.unexpectedPageErrors !== 0 ||
    browser.unexpectedHttpErrors !== 0
  )
    fail("Browser diagnostics or synthetic-only evidence did not pass");
  const secretScan = readJson("secret-scan-evidence.json");
  if (
    secretScan.status !== "PASS" ||
    secretScan.fullShareUrls !== 0 ||
    secretScan.rawShareTokens !== 0
  ) {
    fail("Secret-bearing artifact scan did not pass");
  }
  return { integration, runtimeMatrix, render, browser };
}

async function verifyDatabaseAbsent(databaseUrl: string): Promise<void> {
  initializeDatabaseSafety("integration-test", {
    databaseUrl,
    loadDotenv: false,
    nodeEnv: "test",
    runtimeProfile: "test",
  });
  const target = new URL(databaseUrl);
  const database = decodeURIComponent(target.pathname.slice(1));
  const connection = await mysql.createConnection({
    host: target.hostname,
    port: target.port ? Number(target.port) : 3306,
    user: decodeURIComponent(target.username),
    password: decodeURIComponent(target.password),
  });
  try {
    const [rows] = await connection.query(
      "select schema_name from information_schema.schemata where schema_name = ?",
      [database]
    );
    if (Array.isArray(rows) && rows.length > 0)
      fail("Disposable TR-13 database remains after cleanup");
  } finally {
    await connection.end();
  }
}

function writeManifest(input: {
  status: "PASS" | "FAILED";
  provenance: Tr13SourceProvenance;
  provenanceVerification: {
    finalMatchesStart: boolean;
    failureReason?: string;
  };
  commands: CommandRecord[];
  cleanup: { attempted: boolean; succeeded: boolean; databaseAbsent: boolean };
  evidence?: ReturnType<typeof collectFinalEvidence>;
  failureReason?: string;
}): void {
  const { integration, runtimeMatrix, render, browser } = input.evidence ?? {
    integration: undefined,
    runtimeMatrix: undefined,
    render: undefined,
    browser: undefined,
  };
  const manifest = {
    terminalStatus: input.status,
    syntheticOnly: true,
    fixtureVersion: TR13_WORKFLOW_FIXTURE_VERSION,
    harnessVersion: "tr13-critical-workflow-v1",
    sourceProvenance: {
      ...input.provenance,
      verification: input.provenanceVerification,
    },
    runtimeMatrix: {
      node: {
        criticalHttpApiSecurity:
          runtimeMatrix?.profiles?.node?.security ?? false,
        applicationBrowserJourney: input.status === "PASS",
      },
      serverless: {
        criticalHttpApiSecurity:
          runtimeMatrix?.profiles?.serverless?.security ?? false,
      },
      parity: runtimeMatrix?.parity ?? false,
      numericalReconciliation: {
        node: runtimeMatrix?.profiles?.node?.reconciliation,
        serverless: runtimeMatrix?.profiles?.serverless?.reconciliation,
      },
      limitations: runtimeMatrix?.limitations,
      intentionalNodeOnlyBehavior: [
        "static and Vite application-shell serving",
        "server-sent events",
        "API documentation",
        "request and performance logging",
        "schedulers and background jobs",
      ],
    },
    commands: input.commands,
    nonSecretIds: integration
      ? {
          mysqlRouterFixture: integration.nonSecretIds,
          browserCreatedProject: browser?.createdProjectId,
          browserCriticalWorkflowProject: browser?.criticalWorkflowProjectId,
        }
      : undefined,
    hashesAndFingerprints: integration
      ? {
          fixture: integration.fixtureFingerprint,
          workflowReconciliation: integration.workflowReconciliationFingerprint,
          reportRenderInput: integration.reportRenderInputFingerprint,
          runtimeNodeReportRenderInput:
            runtimeMatrix?.profiles?.node?.reportRenderInputFingerprint,
          runtimeServerlessReportRenderInput:
            runtimeMatrix?.profiles?.serverless?.reportRenderInputFingerprint,
          renderedFiles: render?.hashes,
        }
      : undefined,
    numericalReconciliation: integration?.reconciliations,
    securityResults: integration
      ? {
          ...integration.security,
          runtimeMatrix: runtimeMatrix?.profiles,
          ...browser,
        }
      : undefined,
    inspectedViews: render
      ? {
          storedReportPages: render.renderedViews,
          browser: [
            "desktop public home and login",
            "desktop admin project creation, confirmation, and evaluation",
            "canonical geometry draft, admin approval, and fail-closed MQI state",
            "deferred assistant and rich Markdown loading",
            "mobile authenticated dashboard, assistant, project, and reports",
            "deferred stored-report preview rendering",
            "desktop admin share creation and project-wide revocation",
            "mobile public read-only share",
            "member and viewer control concealment",
            "foreign-organization concealed access",
          ],
        }
      : undefined,
    artifactBoundary: {
      structuredBrief: "design.generateBrief",
      publicAiAdvisorBrief: "designAdvisor.generateDesignBrief",
      governedStoredReport:
        "project.generateReport full_report (guarded real-MySQL runtime matrix)",
      browserStoredReport:
        "project.generateReport validation_summary plus full_report insufficiency rejection",
      publicLinkExposes:
        "AI-advisor brief only; it does not expose the structured brief or stored report",
    },
    aiBoundary:
      "Deterministic PASS uses Vitest-only invokeLLM mocks. Live-provider smoke is not certified.",
    cleanup: input.cleanup,
    failureReason: input.failureReason,
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

let child: NodeJS.ProcessEnv | null = null;
let provenance: Tr13SourceProvenance | null = null;
try {
  provenance = resolveTr13SourceProvenance(ROOT);
  const testDatabaseUrl = assertTr13WorkflowEnvironment();
  child = tr13ChildEnvironment(testDatabaseUrl);
  await assertPortAvailable(34_313);
} catch (error) {
  process.stderr.write(
    `TR-13 workflow certification blocked: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}

if (child && provenance) {
  rmSync(OUTPUT, { recursive: true, force: true });
  mkdirSync(OUTPUT, { recursive: true });
  const commands: CommandRecord[] = [];
  const cleanup = { attempted: false, succeeded: false, databaseAbsent: false };
  const provenanceVerification: {
    finalMatchesStart: boolean;
    failureReason?: string;
  } = { finalMatchesStart: false };
  let primaryError: unknown;
  let evidence: ReturnType<typeof collectFinalEvidence> | undefined;
  try {
    run(
      "prepare-disposable-database",
      "pnpm",
      ["exec", "tsx", "scripts/prepare-tr13-workflow-certification.ts"],
      child,
      commands
    );
    run(
      "apply-schema",
      "pnpm",
      [
        "exec",
        "drizzle-kit",
        "push",
        "--force",
        "--config",
        "drizzle.mysql-test.config.ts",
      ],
      child,
      commands
    );
    run(
      "real-mysql-critical-workflow",
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "--config",
        "vitest.mysql.config.ts",
        "tests/mysql/tr13-critical-workflow.mysql.test.ts",
      ],
      child,
      commands
    );
    assertIntegrationEvidence(readJson("integration-evidence.json"));
    run(
      "real-app-router-node-serverless-runtime-matrix",
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "--config",
        "vitest.mysql.config.ts",
        "tests/mysql/tr13-runtime-matrix.mysql.test.ts",
      ],
      child,
      commands
    );
    initializeDatabaseSafety("integration-test", {
      databaseUrl: child.DATABASE_URL!,
      loadDotenv: false,
      nodeEnv: "test",
      runtimeProfile: "test",
    });
    const rolloutConnection = await mysql.createConnection(child.DATABASE_URL!);
    try {
      const [eligibleRows] = await rolloutConnection.query<any[]>(
        `select ml.id as legacyId, ml.price_aed_min as priceMin,
                ml.price_aed_max as priceMax, bp.productId,
                bp.specId as specificationId, bp.id as benchmarkProposalId,
                bp.benchmarkVersionId,
                coalesce(bv.versionTag, 'legacy-unversioned-benchmark') as benchmarkVersion,
                bp.provenancePolicyVersion, s.unitBasis, s.geography
         from material_library ml
         join benchmark_proposals bp
           on bp.legacyMaterialLibraryId=ml.id and bp.productId=ml.product_id
         join specification s on s.id=bp.specId
         left join benchmark_versions bv on bv.id=bp.benchmarkVersionId
         where ml.price_aed_min is not null and ml.price_aed_max is not null
           and bp.productId is not null
           and bp.sourceKind='assumption'
           and bp.sourceLadderRung='assumption'
           and bp.orgId is null and bp.priceScope is null
           and bp.keyPolicyVersion='ev02-backfill-v1'
           and bp.status='approved' and bp.recommendation='publish'
         order by ml.id`
      );
      child = tr13GovernedPricingEnvironment(
        child,
        eligibleRows.map(row => ({
          reference: {
            source: "material_library" as const,
            legacyId: Number(row.legacyId),
          },
          priceMin: String(row.priceMin),
          priceMax: String(row.priceMax),
        })),
        eligibleRows.map(tr13GovernedSnapshotFromLiveRow)
      );
    } finally {
      await rolloutConnection.end();
    }
    run(
      "db-free-public-share-header-edge-cases",
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "server/_core/public-share-headers.integration.test.ts",
      ],
      { ...child, DATABASE_URL: "" },
      commands
    );
    run(
      "render-and-inspect-matching-stored-report",
      "pnpm",
      ["exec", "tsx", "scripts/render-tr13-workflow-report.ts"],
      child,
      commands
    );
    run(
      "seed-synthetic-local-login-users",
      "pnpm",
      ["exec", "tsx", "scripts/seed-tr13-playwright-users.ts"],
      child,
      commands
    );
    run(
      "serial-node-browser-journey",
      "pnpm",
      ["exec", "playwright", "test", "--config", "playwright.tr13.config.ts"],
      child,
      commands,
      { scanShareSecrets: true }
    );
    assertNoSecretBearingArtifacts();
    evidence = collectFinalEvidence();
  } catch (error) {
    primaryError = error;
  } finally {
    cleanup.attempted = true;
    try {
      run(
        "strict-finally-cleanup",
        "pnpm",
        ["exec", "tsx", "scripts/cleanup-tr13-workflow-certification.ts"],
        child,
        commands
      );
      cleanup.succeeded = true;
      await verifyDatabaseAbsent(child.DATABASE_URL!);
      cleanup.databaseAbsent = true;
    } catch (cleanupError) {
      if (!primaryError) primaryError = cleanupError;
    }
  }

  try {
    const finalProvenance = resolveTr13SourceProvenance(ROOT);
    if (!sameTr13SourceProvenance(provenance, finalProvenance)) {
      throw new Error(
        "Tracked or untracked source changed during certification"
      );
    }
    provenanceVerification.finalMatchesStart = true;
  } catch (provenanceError) {
    provenanceVerification.failureReason =
      provenanceError instanceof Error
        ? provenanceError.message
        : String(provenanceError);
    if (!primaryError) primaryError = provenanceError;
  }

  const status = primaryError ? "FAILED" : "PASS";
  const failureReason =
    primaryError instanceof Error
      ? primaryError.message
      : primaryError
        ? String(primaryError)
        : undefined;
  writeManifest({
    status,
    provenance,
    provenanceVerification,
    commands,
    cleanup,
    evidence,
    failureReason,
  });
  if (primaryError) {
    process.stderr.write(
      `TR-13 workflow certification failed: ${failureReason}. Strict cleanup was attempted.\n`
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(
      "TR-13 critical workflow certification PASS. Manifest: tmp/tr13-workflow-certification/manifest.json\n"
    );
  }
}
