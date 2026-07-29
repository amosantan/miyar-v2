import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import * as ts from "typescript";
import {
  MYSQL_EVIDENCE_FILE,
  MYSQL_INTEGRATION_TEST,
  REQUIRED_MYSQL_EVIDENCE_FILES,
} from "./tr03h-mysql-evidence-contract";

const ROOT = process.cwd();
const ROUTERS_DIR = path.join(ROOT, "server/routers");
const INVENTORY_PATH = path.join(
  ROOT,
  "docs/security/resource-authorization-inventory.json"
);
const REPORT_PATH = path.join(
  ROOT,
  "docs/security/RESOURCE_AUTHORIZATION_INVENTORY.md"
);
const MYSQL_EVIDENCE_PATH = path.join(ROOT, MYSQL_EVIDENCE_FILE);
const RECLASSIFICATION_ACK_PATH = path.join(
  ROOT,
  "docs/security/authorization-reclassification-ack.json"
);

const ACCESS_PRIMITIVES = [
  "orgHeavyMutationProcedure",
  "orgRateLimitedProcedure",
  "orgAdminProcedure",
  "orgMutationProcedure",
  "designOrgAdminProcedure",
  "designOrgMutationProcedure",
  "publicRateLimitedProcedure",
  "publicProcedure",
  "protectedProcedure",
  "orgProcedure",
  "adminProcedure",
  "heavyProcedure",
] as const;

const ORG_ACCESS_PRIMITIVES = new Set<AccessPrimitive>([
  "orgHeavyMutationProcedure",
  "orgRateLimitedProcedure",
  "orgAdminProcedure",
  "orgMutationProcedure",
  "designOrgAdminProcedure",
  "designOrgMutationProcedure",
  "orgProcedure",
]);

const CLASSIFICATIONS = [
  "org_guarded",
  "public_token_guarded",
  "admin_governed",
  "global_governed",
  "legacy_user_guard",
  "legacy_null",
  "unsafe",
  "not_project_scoped",
] as const;

const SEVERITIES = ["critical", "high", "medium", "low", "none"] as const;
const TARGET_STEPS = [
  "TR-02",
  "TR-03",
  "TR-04",
  "TR-05",
  "NEEDS_HUMAN",
  "none",
] as const;
const INTEGRATION_EVIDENCE_STATUSES = [
  "not_applicable",
  "defined_not_executed",
  "executed",
] as const;

type AccessPrimitive = (typeof ACCESS_PRIMITIVES)[number];
type Classification = (typeof CLASSIFICATIONS)[number];
type Severity = (typeof SEVERITIES)[number];
type TargetStep = (typeof TARGET_STEPS)[number];
type IntegrationEvidenceStatus = (typeof INTEGRATION_EVIDENCE_STATUSES)[number];
type Operation = "query" | "mutation" | "subscription";

interface ExtractedProcedure {
  key: string;
  router: string;
  procedure: string;
  source: string;
  accessPrimitive: AccessPrimitive;
  operation: Operation;
  inputIdentifiers: string[];
  helperCalls: string[];
  firstDataAccess: string | null;
  sourceText: string;
}

interface InventoryProcedure extends Omit<ExtractedProcedure, "sourceText"> {
  resourceTypes: string[];
  ownershipPath: string[];
  authorizationEvidence: string;
  classification: Classification;
  severity: Severity;
  disposition: string;
  targetStep: TargetStep;
  notes: string;
  finalScopedWrite: string | null;
  integrationTest: string | null;
  integrationTestName: string | null;
  integrationEvidenceStatus: IntegrationEvidenceStatus;
}

interface InventoryDocument {
  schemaVersion: 2;
  generatedAt: string;
  sourceRoot: "server/routers + server/_core/systemRouter.ts";
  procedureCount: number;
  allowedClassifications: readonly Classification[];
  allowedSeverities: readonly Severity[];
  allowedTargetSteps: readonly TargetStep[];
  allowedIntegrationEvidenceStatuses: readonly IntegrationEvidenceStatus[];
  procedures: InventoryProcedure[];
}

const RESOURCE_ID_PATTERN = /^(id|[A-Za-z][A-Za-z0-9]*(Id|Ids))$/;
const TENANT_RESOURCE_ID_PATTERN =
  /^(projectId|projectIds|assetId|assetIds|briefId|briefIds|scenarioId|scenarioIds|reportId|reportIds|boardId|boardIds|visualId|visualIds|commentId|commentIds|roomId|roomIds|alertId|alertIds|comparisonId|comparisonIds|portfolioId|portfolioIds|outcomeId|outcomeIds|evidenceId|evidenceIds|allocationId|allocationIds|linkId|linkIds|revisionId|revisionIds)$/;

const RESOURCE_HELPER_PATTERN =
  /(Project|Asset|Brief|Scenario|Report|Board|Visual|Comment|Room|Outcome|Evidence|Portfolio|BiasAlert|Simulation|Allocation|Checklist|Recommendation|Rfq|Share|TypologyPack)/i;
const GLOBAL_PLATFORM_ALERT_EFFECT_PATTERN =
  /\b(?:triggerAlertEngine\s*\(|platformAlerts\b)/;
const CROSS_ORG_LEARNING_EFFECT_PATTERN =
  /\b(?:getAllScoreMatrices|getProjectInsights\s*\(|getProjectOutcomes\s*\(|listAllOutcomes\s*\(|listPublicEvidenceRecords|getPreviousEvidenceRecord\s*\(|getTrendSnapshots\s*\(|getTrendHistory\s*\(|getAnomalies\s*\(|getDesignTrends\s*\(|listEvidenceRecords\s*\()/;
const PLATFORM_PUBLIC_DERIVED_WRITE_PATTERN =
  /\b(?:insertPublicTrendSnapshot|insertPublicProjectInsight)\s*\(/;

const GLOBAL_ROUTER_PATTERN = /^(admin|ingestion|market-intelligence)$/;
const ROUTER_NAMESPACE_ALIASES: Readonly<Record<string, string>> = {
  designAssetsRouter: "design",
  designBriefsRouter: "design",
  designBoardsRouter: "design",
  designCollaborationRouter: "design",
  designMarketContextRouter: "design",
  designMaterialsRouter: "design",
  designSharingRouter: "design",
  designVisualsRouter: "design",
  designGeometryAssetsRouter: "design",
  spaceProgramGeometryRouter: "space-program",
};
const SCOPED_WRITE_EVIDENCE: Record<
  string,
  { finalScopedWrite: string; integrationTestName: string }
> = {
  "project.confirmInputs": {
    finalScopedWrite: "db.updateProjectForOrg",
    integrationTestName:
      "scopes project readiness and confirmed-input writes to the organization",
  },
  "design.addComment": {
    finalScopedWrite: "db.createCommentForOrg",
    integrationTestName:
      "validates all polymorphic link targets, typed comments and evidence isolation",
  },
  "design.addMaterialToBoard": {
    finalScopedWrite: "db.addMaterialToBoardForOrg",
    integrationTestName:
      "creates and rolls back scenario-bound boards atomically",
  },
  "design.analyzeFloorPlan": {
    finalScopedWrite: "db.updateProjectForOrg",
    integrationTestName:
      "keeps brief, RFQ, floor-plan, approval and share writes scoped and atomic",
  },
  "design.createBoard": {
    finalScopedWrite: "db.createMaterialBoardWithMaterialsForOrg",
    integrationTestName:
      "creates and rolls back scenario-bound boards atomically",
  },
  "design.createShareLink": {
    finalScopedWrite: "db.updateAiDesignBriefShareTokenForOrg",
    integrationTestName:
      "keeps brief, RFQ, floor-plan, approval and share writes scoped and atomic",
  },
  "design.deleteAsset": {
    finalScopedWrite: "db.deleteProjectAssetForOrg",
    integrationTestName:
      "scopes project assets and generated visuals through project ownership",
  },
  "design.deleteBoard": {
    finalScopedWrite: "db.deleteMaterialBoardForOrg",
    integrationTestName:
      "rolls back board, RFQ and floor-plan transactions after late SQL failures",
  },
  "design.generateBrief": {
    finalScopedWrite: "db.createDesignBriefForOrg",
    integrationTestName:
      "keeps brief, RFQ, floor-plan, approval and share writes scoped and atomic",
  },
  "design.generateRfqFromBrief": {
    finalScopedWrite: "db.insertRfqLineItemsForOrg",
    integrationTestName:
      "rolls back board, RFQ and floor-plan transactions after late SQL failures",
  },
  "design.generateRoomRender": {
    finalScopedWrite:
      "db.createGeneratedVisualForOrg + db.createProjectAssetForOrg + db.updateGeneratedVisualForOrg",
    integrationTestName:
      "scopes project assets and generated visuals through project ownership",
  },
  "design.generateVisual": {
    finalScopedWrite:
      "db.createGeneratedVisualForOrg + db.createProjectAssetForOrg + db.updateGeneratedVisualForOrg",
    integrationTestName:
      "scopes project assets and generated visuals through project ownership",
  },
  "design.linkAsset": {
    finalScopedWrite: "db.createAssetLinkForOrg",
    integrationTestName:
      "validates all polymorphic link targets, typed comments and evidence isolation",
  },
  "design.pinVisualToBoard": {
    finalScopedWrite: "db.createAssetLinkForOrg",
    integrationTestName:
      "validates all polymorphic link targets, typed comments and evidence isolation",
  },
  "design.removeMaterialFromBoard": {
    finalScopedWrite: "db.removeMaterialFromBoardForOrg",
    integrationTestName:
      "creates and rolls back scenario-bound boards atomically",
  },
  "design.reorderBoardTiles": {
    finalScopedWrite: "db.reorderBoardTilesForOrg",
    integrationTestName:
      "creates and rolls back scenario-bound boards atomically",
  },
  "design.unpinVisual": {
    finalScopedWrite: "db.deleteAssetLinkForOrg",
    integrationTestName:
      "validates all polymorphic link targets, typed comments and evidence isolation",
  },
  "design.updateApprovalState": {
    finalScopedWrite: "db.updateProjectApprovalStateForOrg",
    integrationTestName:
      "keeps brief, RFQ, floor-plan, approval and share writes scoped and atomic",
  },
  "design.updateAsset": {
    finalScopedWrite: "db.updateProjectAssetForOrg",
    integrationTestName:
      "scopes project assets and generated visuals through project ownership",
  },
  "design.updateBoardTile": {
    finalScopedWrite: "db.updateBoardTileForOrg",
    integrationTestName:
      "creates and rolls back scenario-bound boards atomically",
  },
  "design.uploadAsset": {
    finalScopedWrite: "db.createProjectAssetForOrg",
    integrationTestName:
      "scopes project assets and generated visuals through project ownership",
  },
  "design.uploadFloorPlan": {
    finalScopedWrite: "db.createFloorPlanAssetAndLinkForOrg",
    integrationTestName:
      "rolls back board, RFQ and floor-plan transactions after late SQL failures",
  },
  "portfolio.checkAlerts": {
    finalScopedWrite: "db.insertPortfolioAlertsForOrg",
    integrationTestName:
      "keeps tenant portfolio alerts organization scoped and deduplicated",
  },
  "project.generateReport": {
    finalScopedWrite: "db.createReportArtifactsForOrg",
    integrationTestName:
      "persists report artifacts atomically and rechecks project ownership",
  },
};

const READ_ONLY_ORG_PRIMITIVES = new Set<AccessPrimitive>([
  "orgProcedure",
  "orgRateLimitedProcedure",
]);

const GLOBAL_TENANT_IDENTIFIER_POLICY_KEYS = new Set([
  "design.attachVisualToPack",
  "market-intelligence.competitors.compare",
]);

const OWNERSHIP_PATHS: Record<string, string> = {
  projectId: "input.projectId -> projects.id -> projects.orgId",
  projectIds: "input.projectIds[] -> projects.id -> projects.orgId",
  assetId:
    "input.assetId -> project_assets.id -> project_assets.projectId -> projects.orgId",
  assetIds:
    "input.assetIds[] -> project_assets.id -> project_assets.projectId -> projects.orgId",
  briefId:
    "input.briefId -> design_briefs/ai_design_briefs.id -> projectId -> projects.orgId",
  briefIds:
    "input.briefIds[] -> design_briefs/ai_design_briefs.id -> projectId -> projects.orgId",
  scenarioId:
    "input.scenarioId -> scenarios.id -> scenarios.projectId -> projects.orgId",
  scenarioIds:
    "input.scenarioIds[] -> scenarios.id -> scenarios.projectId -> projects.orgId",
  reportId:
    "input.reportId -> report_instances.id -> report_instances.projectId -> projects.orgId",
  reportIds:
    "input.reportIds[] -> report_instances.id -> report_instances.projectId -> projects.orgId",
  boardId:
    "input.boardId -> material_boards.id -> material_boards.projectId -> projects.orgId",
  boardIds:
    "input.boardIds[] -> material_boards.id -> material_boards.projectId -> projects.orgId",
  visualId:
    "input.visualId -> generated_visuals.id -> generated_visuals.projectId -> projects.orgId",
  visualIds:
    "input.visualIds[] -> generated_visuals.id -> generated_visuals.projectId -> projects.orgId",
  commentId:
    "input.commentId -> comments.id -> comments.projectId -> projects.orgId",
  commentIds:
    "input.commentIds[] -> comments.id -> comments.projectId -> projects.orgId",
  roomId:
    "input.roomId -> space_program_rooms.id -> space_program_rooms.projectId/organizationId",
  roomIds:
    "input.roomIds[] -> space_program_rooms.id -> space_program_rooms.projectId/organizationId",
  materialLibraryId:
    "input.materialLibraryId -> material_library.id -> products.id -> products.orgId is global or the authenticated organization",
  geometryVersionId:
    "input.geometryVersionId -> spatial_graph_versions.id -> spatial_graph_versions.projectId/organizationId",
  expectedCurrentVersionId:
    "input.expectedCurrentVersionId -> project_geometry_authorities.currentGraphVersionId -> spatial_graph_versions.projectId/organizationId",
  sourceLineageId:
    "input.sourceLineageId -> caller-declared drawing lineage namespace -> bound to the already-authorized project in the geometry fingerprint; not a standalone resource",
  alertId:
    "input.alertId -> bias_alerts/platform_alerts.id -> projectId/orgId when project-owned",
  alertIds:
    "input.alertIds[] -> alert record -> projectId/orgId when project-owned",
  comparisonId:
    "input.comparisonId -> scenario/outcome comparison -> projectId -> projects.orgId",
  comparisonIds:
    "input.comparisonIds[] -> comparison -> projectId -> projects.orgId",
  portfolioId:
    "input.portfolioId -> portfolios.id -> portfolios.organizationId",
  portfolioIds:
    "input.portfolioIds[] -> portfolios.id -> portfolios.organizationId",
  outcomeId:
    "input.outcomeId -> project_outcomes.id -> project_outcomes.projectId -> projects.orgId",
  outcomeIds:
    "input.outcomeIds[] -> project_outcomes.id -> projectId -> projects.orgId",
  evidenceId:
    "input.evidenceId -> evidence_records.id -> evidence_records.orgId/projectId or governed global",
  evidenceIds:
    "input.evidenceIds[] -> evidence_records.id -> orgId/projectId or governed global",
  allocationId:
    "input.allocationId -> material_allocations.id -> material_allocations.organizationId/projectId",
  allocationIds:
    "input.allocationIds[] -> material_allocations.id -> material_allocations.organizationId/projectId",
  linkId:
    "input.linkId -> asset_links.id -> asset_links.assetId -> project_assets.projectId -> projects.orgId",
  linkIds:
    "input.linkIds[] -> asset_links.id -> asset_links.assetId -> project_assets.projectId -> projects.orgId",
  templateId:
    "input.templateId -> prompt_templates.id -> prompt_templates.orgId or governed global",
  sourceId: "input.sourceId -> source_registry.id -> governed global source",
  areaId:
    "input.areaId -> DLD/area benchmark identifier -> governed global market data",
  tagId:
    "input.tagId -> trend_tags.id -> governed global intelligence taxonomy",
  entityId:
    "input.entityId -> tagged/evidence target -> ownership follows target type",
  benchmarkVersionId:
    "input.benchmarkVersionId -> benchmark_versions.id -> governed global benchmark version",
  newVersionId:
    "input.newVersionId -> benchmark_versions.id -> governed global benchmark version",
  oldVersionId:
    "input.oldVersionId -> benchmark_versions.id -> governed global benchmark version",
  versionId:
    "input.versionId -> benchmark/model version -> governed global version",
  insightId:
    "input.insightId -> project_insights.id -> project_insights.projectId or governed global insight",
  materialId:
    "input.materialId -> materials_catalog.id -> governed global material",
  materialIds:
    "input.materialIds[] -> materials_catalog.id -> governed global materials",
  targetId:
    "input.targetId -> polymorphic target -> ownership follows linkType/targetType",
  joinId:
    "input.joinId -> materials_to_boards.id -> materials_to_boards.boardId -> material_boards.projectId -> projects.orgId",
  orderedJoinIds:
    "input.orderedJoinIds[] -> materials_to_boards.id -> boardId -> material_boards.projectId -> projects.orgId",
  runId:
    "input.runId -> ingestion_runs.runId -> governed global ingestion operation",
  logicVersionId:
    "input.logicVersionId -> logic_versions.id -> governed global deterministic logic version",
  baselineScenarioId:
    "input.baselineScenarioId -> scenarios.id -> scenarios.projectId -> projects.orgId",
  comparedScenarioIds:
    "input.comparedScenarioIds[] -> scenarios.id -> scenarios.projectId -> projects.orgId",
  competitorId:
    "input.competitorId -> competitor_entities.id -> governed global competitor record",
  evidenceRecordId:
    "input.evidenceRecordId -> evidence_records.id -> evidence_records.orgId/projectId or governed global",
  extractionId:
    "input.extractionId -> pdf_extractions.id -> pdf_extractions.projectId -> projects.orgId",
};

function kebabCase(value: string) {
  return value
    .replace(/Router$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function propertyName(node: ts.PropertyName): string {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  return node.getText();
}

function findPrimitive(text: string): AccessPrimitive | null {
  return (
    ACCESS_PRIMITIVES.find(primitive =>
      new RegExp(`\\b${primitive}\\b`).test(text)
    ) ?? null
  );
}

function findOperation(text: string): Operation | null {
  const match = text.match(/\.(query|mutation|subscription)\s*\(/);
  return (match?.[1] as Operation | undefined) ?? null;
}

function collectInputIdentifiers(node: ts.Node): string[] {
  const identifiers = new Set<string>();

  function visit(current: ts.Node) {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === "input"
    ) {
      for (const argument of current.arguments) {
        argument.forEachChild(function walkInput(child) {
          if (
            ts.isPropertyAssignment(child) ||
            ts.isShorthandPropertyAssignment(child)
          ) {
            const name = propertyName(child.name);
            if (RESOURCE_ID_PATTERN.test(name)) identifiers.add(name);
          }
          child.forEachChild(walkInput);
        });
      }
      return;
    }
    current.forEachChild(visit);
  }

  visit(node);
  return [...identifiers].sort();
}

function callName(expression: ts.LeftHandSideExpression): string | null {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    let root: ts.Expression = expression.expression;
    while (ts.isCallExpression(root) || ts.isPropertyAccessExpression(root)) {
      root = root.expression;
    }
    if (ts.isIdentifier(root)) return `${root.text}.${expression.name.text}`;
    return expression.name.text;
  }
  return null;
}

function collectHelperCalls(node: ts.Node): string[] {
  const calls: Array<{ name: string; position: number }> = [];

  function visit(current: ts.Node) {
    if (ts.isCallExpression(current)) {
      const name = callName(current.expression);
      if (
        name &&
        (name.startsWith("db.") ||
          name === "getDb" ||
          name === "storagePut" ||
          name === "storageGet" ||
          name === "requireProjectForOrg" ||
          RESOURCE_HELPER_PATTERN.test(name))
      ) {
        calls.push({ name, position: current.getStart() });
      }
    }
    current.forEachChild(visit);
  }

  visit(node);
  return [
    ...new Set(
      calls.sort((a, b) => a.position - b.position).map(call => call.name)
    ),
  ];
}

function firstDataAccess(
  node: ts.Node,
  directDbImports: ReadonlySet<string>
): string | null {
  const calls: Array<{ name: string; position: number }> = [];

  function visit(current: ts.Node) {
    if (ts.isCallExpression(current)) {
      const name = callName(current.expression);
      if (
        name &&
        ((name.startsWith("db.") && name !== "db.getDb") ||
          /\.(select|insert|update|delete)$/.test(name) ||
          (directDbImports.has(name) && name !== "getDb") ||
          name === "storagePut" ||
          name === "storageGet" ||
          name === "requireProjectForOrg")
      ) {
        calls.push({ name, position: current.getStart() });
      }
    }
    current.forEachChild(visit);
  }

  visit(node);
  const operationPriority = (name: string) =>
    /\.(select|insert|update|delete)$/.test(name) ||
    name === "requireProjectForOrg"
      ? 0
      : 1;
  return (
    calls.sort(
      (a, b) =>
        a.position - b.position ||
        operationPriority(a.name) - operationPriority(b.name)
    )[0]?.name ?? null
  );
}

function extractProceduresFromRouter(
  sourceFile: ts.SourceFile,
  routerName: string,
  objectLiteral: ts.ObjectLiteralExpression,
  directDbImports: ReadonlySet<string>,
  prefix: string[] = []
): ExtractedProcedure[] {
  const procedures: ExtractedProcedure[] = [];

  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isMethodDeclaration(property))
      continue;
    const name = propertyName(property.name);
    const initializer = ts.isPropertyAssignment(property)
      ? property.initializer
      : property;

    if (
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) &&
      initializer.expression.text === "router" &&
      initializer.arguments[0] &&
      ts.isObjectLiteralExpression(initializer.arguments[0])
    ) {
      procedures.push(
        ...extractProceduresFromRouter(
          sourceFile,
          routerName,
          initializer.arguments[0],
          directDbImports,
          [...prefix, name]
        )
      );
      continue;
    }

    const text = initializer.getText(sourceFile);
    const accessPrimitive = findPrimitive(text);
    const operation = findOperation(text);
    if (!accessPrimitive || !operation) continue;

    const procedurePath = [...prefix, name];
    const line =
      sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile))
        .line + 1;
    const relativeSource = path.relative(ROOT, sourceFile.fileName);

    procedures.push({
      key: [routerName, ...procedurePath].join("."),
      router: routerName,
      procedure: procedurePath.join("."),
      source: `${relativeSource}:${line}`,
      accessPrimitive,
      operation,
      inputIdentifiers: collectInputIdentifiers(initializer),
      helperCalls: collectHelperCalls(initializer),
      firstDataAccess: firstDataAccess(initializer, directDbImports),
      sourceText: text,
    });
  }

  return procedures;
}

async function extractProcedures(): Promise<ExtractedProcedure[]> {
  const routerFiles = (await readdir(ROUTERS_DIR))
    .filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .sort()
    .map(file => path.join(ROUTERS_DIR, file));
  const files = [
    ...routerFiles,
    path.join(ROOT, "server/_core/systemRouter.ts"),
  ];
  const procedures: ExtractedProcedure[] = [];

  for (const absolutePath of files) {
    const sourceText = await readFile(absolutePath, "utf8");
    const sourceFile = ts.createSourceFile(
      absolutePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );
    const directDbImports = new Set<string>();
    for (const statement of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== "../db" ||
        !statement.importClause?.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        continue;
      }
      for (const element of statement.importClause.namedBindings.elements) {
        directDbImports.add(element.name.text);
      }
    }

    sourceFile.forEachChild(node => {
      if (!ts.isVariableStatement(node)) return;
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
          continue;
        if (
          !ts.isCallExpression(declaration.initializer) ||
          !ts.isIdentifier(declaration.initializer.expression) ||
          declaration.initializer.expression.text !== "router" ||
          !declaration.initializer.arguments[0] ||
          !ts.isObjectLiteralExpression(declaration.initializer.arguments[0])
        ) {
          continue;
        }

        const routerName =
          ROUTER_NAMESPACE_ALIASES[declaration.name.text] ??
          kebabCase(declaration.name.text);
        procedures.push(
          ...extractProceduresFromRouter(
            sourceFile,
            routerName,
            declaration.initializer.arguments[0],
            directDbImports
          )
        );
      }
    });
  }

  return procedures.sort((a, b) => a.key.localeCompare(b.key));
}

function isResourceRelevant(procedure: ExtractedProcedure) {
  if (
    procedure.inputIdentifiers.some(identifier =>
      TENANT_RESOURCE_ID_PATTERN.test(identifier)
    )
  )
    return true;
  if (
    procedure.inputIdentifiers.includes("id") &&
    /^(project|scenario|portfolio|design|bias|space-program|material-quantity)$/.test(
      procedure.router
    ) &&
    procedure.helperCalls.some(helper => RESOURCE_HELPER_PATTERN.test(helper))
  )
    return true;
  return procedure.helperCalls.some(helper =>
    RESOURCE_HELPER_PATTERN.test(helper)
  );
}

function inferIdentifierOwnership(
  procedure: ExtractedProcedure,
  identifier: string
): string {
  if (OWNERSHIP_PATHS[identifier]) return OWNERSHIP_PATHS[identifier];
  const helpers = procedure.helperCalls.join(" ");

  if (identifier === "id") {
    if (
      [
        "design.deleteMaterial",
        "design.getMaterial",
        "design.updateMaterial",
      ].includes(procedure.key)
    ) {
      return "input.id -> materials_catalog.id -> governed global material";
    }
    if (procedure.key === "design.updatePromptTemplate") {
      return "input.id -> prompt_templates.id -> prompt_templates.orgId or governed global";
    }
    if (
      procedure.key.startsWith("intelligence.logicVersions.") ||
      procedure.key === "intelligence.benchmarkLearning.reviewSuggestion"
    ) {
      return "input.id -> governed global logic/benchmark governance record";
    }
    if (
      /ProjectById|projects/.test(helpers) ||
      procedure.router === "project"
    ) {
      return "input.id -> projects.id -> projects.orgId";
    }
    if (/Scenario|scenario/.test(helpers) || procedure.router === "scenario") {
      return "input.id -> scenario/simulation record -> projectId -> projects.orgId";
    }
    if (
      /Portfolio|portfolios/.test(helpers) ||
      procedure.router === "portfolio"
    ) {
      return "input.id -> portfolios.id -> portfolios.organizationId";
    }
    if (/Evidence/.test(helpers)) {
      return "input.id -> evidence_records.id -> evidence_records.orgId/projectId or governed global";
    }
    if (/ProjectAsset|assetLinks/.test(helpers)) {
      return "input.id -> project asset/link -> projectId -> projects.orgId";
    }
    if (/MaterialBoard|Board/.test(helpers)) {
      return "input.id -> board/link record -> material_boards.projectId -> projects.orgId";
    }
    if (/platformAlerts/.test(procedure.sourceText)) {
      return "input.id -> platform_alerts.id -> governed global operational alert";
    }
    if (GLOBAL_ROUTER_PATTERN.test(procedure.router)) {
      return "input.id -> governed global intelligence/administrative record";
    }
  }

  return `input.${identifier} -> resource identified by ${procedure.firstDataAccess ?? procedure.router} -> ownership recorded by the procedure classification`;
}

function ownershipPath(
  procedure: ExtractedProcedure,
  classification: Classification
): string[] {
  if (procedure.router === "brief") {
    return [
      "authenticated organization + input projectId/briefId/versionId/child IDs -> canonical brief workflow lockTenant resolver -> organization/project/scenario-scoped records",
    ];
  }
  if (procedure.router === "typology-pack") {
    return [
      "authenticated organization -> typology_pack_revisions.organizationId -> exact tenant-owned immutable revision",
    ];
  }
  if (procedure.router === "regulatory-source") {
    return [
      "platform administrator -> platform-global regulatory source/version governance; no tenant-owned or public projection",
    ];
  }
  if (procedure.key === "design.linkAsset") {
    return [
      "input.assetId -> project_assets.id -> project_assets.projectId -> projects.orgId",
      "input.linkType/linkId -> closed evaluation/report/scenario/material_board/design_brief/visual registry -> target.projectId -> projects.orgId",
    ];
  }
  if (procedure.key === "design.resolveShareLink") {
    return [
      "input.token -> ai_design_briefs.shareToken -> ai_design_briefs.projectId -> projects.id",
    ];
  }
  if (procedure.key === "market-intelligence.competitors.getProject") {
    return [
      "input.id -> competitor_projects.id -> governed global competitor record",
    ];
  }
  if (procedure.key === "market-intelligence.competitors.compare") {
    return [
      "input.projectIds[] -> competitor_projects.id -> governed global competitor records",
    ];
  }
  if (procedure.key === "intelligence.scenarios.getComparison") {
    return [
      "input.id -> scenario_comparisons.id -> scenario_comparisons.projectId -> projects.orgId",
    ];
  }
  if (procedure.key === "economics.rankScenarios") {
    return [
      "caller-supplied scenario DTOs -> deterministic ranking only; no database resource access",
    ];
  }
  if (procedure.key === "organization.acceptInvite") {
    return [
      "input.token -> organization_invites.token -> organization_invites.orgId -> organizations.id",
    ];
  }
  if (procedure.key === "organization.myOrgs") {
    return [
      "session user -> organization_members.userId -> organization_members.orgId -> organizations.id",
    ];
  }
  if (procedure.key === "market-intelligence.tags.getEntityTags") {
    return [
      "input.entityType/entityId -> project, scenario, evidence, competitor, or trend target -> ownership follows target type",
    ];
  }
  if (procedure.key === "market-intelligence.tags.getTaggedEntities") {
    return [
      "input.entityType/tagId -> entity_tags target IDs -> ownership follows each polymorphic target type",
    ];
  }
  const paths = procedure.inputIdentifiers
    .map(identifier => inferIdentifierOwnership(procedure, identifier))
    .filter((value): value is string => Boolean(value));

  if (paths.length > 0) return [...new Set(paths)];
  if (procedure.accessPrimitive === "adminProcedure") {
    return [
      "authenticated global admin role -> governed administrative resource",
    ];
  }
  if (
    procedure.sourceText.includes("ctx.orgId") ||
    procedure.sourceText.includes("ctx.user.orgId")
  ) {
    return ["session organization context -> organization-scoped query/write"];
  }
  if (GLOBAL_ROUTER_PATTERN.test(procedure.router)) {
    return ["governed global intelligence/administrative resource"];
  }
  if (procedure.key === "autonomous.portfolioInsights") {
    return [
      "all-project portfolio data -> project organization ownership is not scoped",
    ];
  }
  if (procedure.key === "predictive.getUaeCostRanges") {
    return [
      "evidence_records -> evidence_records.orgId/projectId or governed global",
    ];
  }
  if (
    procedure.key === "seed.seedEvidence" ||
    procedure.key === "seed.seedEnrichedData"
  ) {
    return ["governed global evidence/material seed data"];
  }
  if (classification === "global_governed") {
    return [
      `governed global ${procedure.router} data -> no project/org-owned identifier is accepted`,
    ];
  }
  if (classification === "not_project_scoped") {
    return [
      "session/user credential, deterministic input, or non-project workflow -> no project/org-owned identifier is accepted",
    ];
  }
  if (classification === "legacy_user_guard") {
    return ["session user -> user-owned projects -> legacy user boundary"];
  }
  if (classification === "unsafe") {
    return [
      `global or aggregate ${procedure.router} data -> authorization/governance scope is not established`,
    ];
  }
  return ["session organization context -> organization-scoped query/write"];
}

function defaultAnnotation(
  procedure: ExtractedProcedure
): Omit<InventoryProcedure, keyof Omit<ExtractedProcedure, "sourceText">> {
  const text = procedure.sourceText;
  const relevant = isResourceRelevant(procedure);
  const canonicalGuardMatch =
    /\b(require[A-Z][A-Za-z]+ForOrg|requireDesign[A-Z][A-Za-z]+|requireActivePublicShare)\s*\(/.exec(
      text
    );
  const firstDataAccessPosition = procedure.firstDataAccess
    ? text.indexOf(procedure.firstDataAccess)
    : -1;
  const hasCanonicalGuard = Boolean(
    canonicalGuardMatch &&
      (firstDataAccessPosition < 0 ||
        canonicalGuardMatch.index <= firstDataAccessPosition)
  );
  const hasOrgCheck =
    /(project|record|portfolio|brief|scenario|asset|board)\??\.?(orgId|organizationId)\s*!==?\s*(ctx\.orgId|ctx\.user\.orgId)/.test(
      text
    ) ||
    /(ctx\.orgId|ctx\.user\.orgId)\s*!==?\s*(project|record|portfolio|brief|scenario|asset|board)\??\.?(orgId|organizationId)/.test(
      text
    );
  const hasLegacyUserGuard =
    /userId\s*!==?\s*ctx\.user\.id/.test(text) ||
    /ctx\.user\.id\s*!==?\s*[^;\n]*userId/.test(text) ||
    /getProjectsByUser\s*\(/.test(text);
  const hasLegacyFallback =
    hasOrgCheck && /(\|\||&&)[^;\n]*(userId|ctx\.user\.id)/.test(text);
  const usesOrgContext = /ctx\.(orgId|user\.orgId)/.test(text);
  const hasOrgScopedPredicate =
    /eq\([^,]*(orgId|organizationId),\s*ctx\.(orgId|user\.orgId)\)/s.test(text);
  const hasOrgScopedHelper =
    /\b(?:[A-Za-z][A-Za-z0-9]*(?:ByOrg|ForOrg)|(?:listOrganization|insertOrganization)[A-Za-z0-9]*)\s*\([^)]*ctx\.orgId/s.test(
      text
    );
  const hasOrgScopedInsert =
    /\b(orgId|organizationId)\s*:\s*ctx\.(orgId|user\.orgId)\b/.test(text);
  const hasBriefWorkflowGuard =
    procedure.router === "brief" &&
    /\b(?:command|createBriefStream|getBriefSummary|getBriefVersion|getBriefSection|listBriefAssignments|listBriefDependencies|listBriefEvents|listBriefFindings|listBriefIssues|listBriefStreams|getBriefReadinessFacts)\s*\(/.test(text);

  const globalGovernedKeys = new Set([
    "admin.portfolio.overview",
    "analytics.generateGlobalProjectInsights",
    "analytics.getCompetitorLandscape",
    "analytics.runPublicTrendDetection",
    "design.calculateSpec",
    "design.getAreaBenchmark",
    "design.getAreaBenchmarks",
    "design.getCompetitorContext",
    "design.getDataFreshness",
    "design.getDldAreaComparison",
    "design.getDldAreas",
    "design.getDldDataStats",
    "design.getMaterial",
    "design.getMaterialConstants",
    "design.listMaterials",
    "ingestion.verifyData",
    "intelligence.benchmarkLearning.generateSuggestions",
    "intelligence.outcomes.listAll",
    "market-intelligence.competitors.bulkImport",
    "market-intelligence.competitors.createProject",
    "market-intelligence.competitors.deleteProject",
    "market-intelligence.competitors.updateProject",
    "market-intelligence.evidence.bulkImport",
    "market-intelligence.evidence.create",
    "market-intelligence.evidence.delete",
    "market-intelligence.proposals.generate",
    "market-intelligence.competitors.compare",
    "market-intelligence.competitors.getEntity",
    "market-intelligence.competitors.getProject",
    "market-intelligence.competitors.listEntities",
    "market-intelligence.competitors.listProjects",
    "market-intelligence.dataHealth",
    "market-intelligence.evidence.stats",
    "market-intelligence.sources.get",
    "market-intelligence.sources.list",
    "market-intelligence.tags.list",
    "project.scenarioTemplates",
    "seed.seedEnrichedData",
    "seed.seedEvidence",
  ]);

  const intentionallyDisabledKeys = new Set(["design.attachVisualToPack"]);

  let classification: Classification;
  if (
    intentionallyDisabledKeys.has(procedure.key) &&
    /PRECONDITION_FAILED/.test(text)
  ) {
    classification = "global_governed";
  } else if (globalGovernedKeys.has(procedure.key)) {
    classification = "global_governed";
  } else if (procedure.router === "regulatory-source" && procedure.accessPrimitive === "adminProcedure") {
    classification = "admin_governed";
  } else if (procedure.accessPrimitive === "adminProcedure") {
    classification = relevant ? "unsafe" : "admin_governed";
  } else if (
    procedure.accessPrimitive === "publicProcedure" ||
    procedure.accessPrimitive === "publicRateLimitedProcedure"
  ) {
    classification = /\b(token|shareToken|expiresAt|shareExpiresAt)\b/.test(
      text
    )
      ? "public_token_guarded"
      : "not_project_scoped";
  } else if (procedure.router === "typology-pack" && ORG_ACCESS_PRIMITIVES.has(procedure.accessPrimitive)) {
    classification = "org_guarded";
  } else if (hasLegacyFallback || (hasLegacyUserGuard && relevant)) {
    classification = "legacy_user_guard";
  } else if (
    hasCanonicalGuard ||
    hasBriefWorkflowGuard ||
    hasOrgCheck ||
    hasOrgScopedPredicate ||
    hasOrgScopedHelper ||
    hasOrgScopedInsert
  ) {
    classification = "org_guarded";
  } else if (
    ORG_ACCESS_PRIMITIVES.has(procedure.accessPrimitive) &&
    usesOrgContext &&
    !relevant
  ) {
    classification = "org_guarded";
  } else if (relevant) {
    classification = "unsafe";
  } else if (GLOBAL_ROUTER_PATTERN.test(procedure.router)) {
    classification = "global_governed";
  } else if (
    ORG_ACCESS_PRIMITIVES.has(procedure.accessPrimitive) &&
    usesOrgContext
  ) {
    classification = "org_guarded";
  } else {
    classification = "not_project_scoped";
  }

  let severity: Severity = "none";
  if (classification === "unsafe")
    severity = procedure.operation === "mutation" ? "critical" : "high";
  if (classification === "legacy_user_guard") severity = "medium";
  if (classification === "legacy_null") severity = "high";

  let targetStep: TargetStep = "none";
  if (classification === "unsafe" || classification === "legacy_user_guard") {
    if (procedure.router === "design") targetStep = "TR-03";
    else if (
      (procedure.router === "learning" || procedure.router === "predictive") &&
      /(getAllScoreMatrices|listEvidenceRecords\s*\(\s*\{\s*limit|getProjectOutcomes\s*\(\s*\)|allEvidence|allScores)/s.test(
        text
      )
    ) {
      targetStep = "TR-05";
    } else {
      targetStep = "TR-04";
    }
  }
  if (classification === "legacy_null") targetStep = "NEEDS_HUMAN";

  const hasCrossOrgLearningEffect =
    ORG_ACCESS_PRIMITIVES.has(procedure.accessPrimitive) &&
    CROSS_ORG_LEARNING_EFFECT_PATTERN.test(text);
  if (hasCrossOrgLearningEffect) {
    targetStep = "TR-05";
    severity =
      procedure.key === "analytics.runTrendDetection" ? "critical" : "high";
  }
  if (procedure.key === "design.resolveShareLink") {
    if (!/\brequireActivePublicShare\s*\(/.test(text)) {
      targetStep = "TR-03";
      severity = "high";
    } else {
      targetStep = "none";
      severity = "none";
    }
  }

  const resourceTypes = procedure.inputIdentifiers
    .map(identifier =>
      identifier.replace(/Ids?$/, "").replace(/^id$/, "record")
    )
    .filter(Boolean);
  const scopedWriteEvidence = SCOPED_WRITE_EVIDENCE[procedure.key];
  const finalScopedWrite = scopedWriteEvidence?.finalScopedWrite ?? null;

  const guardEvidence =
    classification === "org_guarded"
      ? hasCanonicalGuard || hasBriefWorkflowGuard
        ? scopedWriteEvidence
          ? "Calls a canonical project/resource authorization resolver before access and uses an organization-scoped final-write helper; named real-SQL coverage is maintained in tests/mysql/design-authorization.mysql.test.ts."
          : hasBriefWorkflowGuard
            ? "Delegates to the canonical brief workflow boundary, which resolves organization, project, stream, version, and child scope from the authenticated organization before access."
            : "Calls a canonical project/resource authorization resolver before project-scoped child access."
        : procedure.key === "organization.acceptInvite"
          ? "Resolves an organization invite token, verifies its expiry, and adds the authenticated user to the invite's organization."
          : procedure.key === "organization.myOrgs"
            ? "Scopes organization reads through organization_members.userId for the authenticated user."
            : "Checks resource organization against session organization or scopes by session organization."
      : classification === "legacy_user_guard"
        ? "Uses userId ownership or userId fallback; does not establish the organization boundary."
        : classification === "public_token_guarded"
          ? procedure.key === "design.resolveShareLink"
            ? "Uses requireActivePublicShare to require matching non-null organization ownership and a finite future expiry before any query-only public data reads."
            : "Public token path detected; token scope, expiry, and query-only behavior require explicit review."
          : classification === "admin_governed"
            ? "Requires the global admin role; resource scope remains part of the admin-governance review."
            : classification === "global_governed"
              ? "No project-owned identifier detected; handled as governed global data."
              : classification === "unsafe"
                ? `No organization/resource ownership check detected before ${procedure.firstDataAccess ?? "data access"}.`
                : "No project-owned identifier or project-data helper detected.";

  return {
    resourceTypes: [...new Set(resourceTypes)],
    ownershipPath: ownershipPath(procedure, classification),
    authorizationEvidence: guardEvidence,
    classification,
    severity,
    disposition:
      targetStep === "none"
        ? "No remediation assigned; retain classification evidence."
        : `Remediate under ${targetStep}.`,
    targetStep,
    finalScopedWrite,
    integrationTest: finalScopedWrite ? MYSQL_INTEGRATION_TEST : null,
    integrationTestName: scopedWriteEvidence?.integrationTestName ?? null,
    integrationEvidenceStatus: finalScopedWrite
      ? "defined_not_executed"
      : "not_applicable",
    notes:
      procedure.key === "design.resolveShareLink"
        ? "Token authorization is isolated from authenticated organization access; missing, invalid, expired, null-expiry, orphaned, and ownership-mismatched shares fail closed."
        : procedure.key === "design.attachVisualToPack"
          ? "Fails closed with PRECONDITION_FAILED and performs no data access until a typed visual-attachment model is approved."
          : procedure.key === "design.listAssets"
            ? "Requires the canonical design project guard before listing project assets."
            : hasCrossOrgLearningEffect
              ? "Target-project access and cross-organization learning-data isolation are separate concerns; this path reads global evidence, scores, or project comparables."
              : procedure.key === "organization.acceptInvite"
                ? "Invite-token authorization is distinct from session organization context; the token selects one organization and expiry is checked before membership mutation."
                : "",
  };
}

async function mergeInventory(
  extracted: ExtractedProcedure[],
  existing: InventoryDocument | null
): Promise<InventoryDocument> {
  const mysqlEvidenceExecuted = (await validateMysqlEvidence()).valid;
  const procedures = extracted.map(procedure => {
    const { sourceText: _sourceText, ...facts } = procedure;
    const defaults = defaultAnnotation(procedure);
    return {
      ...facts,
      ...defaults,
      finalScopedWrite: defaults.finalScopedWrite,
      integrationTest: defaults.integrationTest,
      integrationTestName: defaults.integrationTestName,
      integrationEvidenceStatus: defaults.integrationTest
        ? mysqlEvidenceExecuted
          ? "executed"
          : "defined_not_executed"
        : "not_applicable",
    };
  });

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    sourceRoot: "server/routers + server/_core/systemRouter.ts",
    procedureCount: procedures.length,
    allowedClassifications: CLASSIFICATIONS,
    allowedSeverities: SEVERITIES,
    allowedTargetSteps: TARGET_STEPS,
    allowedIntegrationEvidenceStatuses: INTEGRATION_EVIDENCE_STATUSES,
    procedures,
  };
}

async function requireReclassificationAcknowledgement(
  inventory: InventoryDocument
) {
  let committed: InventoryDocument;
  try {
    committed = JSON.parse(
      execFileSync(
        "git",
        ["show", "HEAD:docs/security/resource-authorization-inventory.json"],
        { cwd: ROOT, encoding: "utf8" }
      )
    ) as InventoryDocument;
  } catch {
    return;
  }
  const currentByKey = new Map(
    inventory.procedures.map(procedure => [procedure.key, procedure])
  );
  const removed = committed.procedures
    .filter(
      previous =>
        previous.targetStep !== "none" &&
        currentByKey.get(previous.key)?.targetStep === "none"
    )
    .map(procedure => procedure.key)
    .sort();
  if (removed.length === 0) return;

  const ack = JSON.parse(await readFile(RECLASSIFICATION_ACK_PATH, "utf8")) as {
    taskId?: string;
    removedTargetStep?: string;
    keyCount?: number;
    keysSha256?: string;
    rationale?: string;
  };
  const hash = createHash("sha256").update(removed.join("\n")).digest("hex");
  if (
    !ack.taskId ||
    !ack.rationale?.trim() ||
    ack.keyCount !== removed.length ||
    ack.keysSha256 !== hash
  ) {
    throw new Error(
      `Security reclassification acknowledgement is missing or does not match the removed remediation keys: count=${removed.length} sha256=${hash} keys=${removed.join(",")}`
    );
  }
}

async function validateMysqlEvidence(): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  try {
    const evidence = JSON.parse(
      await readFile(MYSQL_EVIDENCE_PATH, "utf8")
    ) as {
      status?: string;
      testFile?: string;
      cleanupVerified?: boolean;
      fileHashes?: Record<string, string>;
    };
    if (evidence.status !== "PASS")
      errors.push("MySQL evidence status is not PASS");
    if (evidence.testFile !== MYSQL_INTEGRATION_TEST) {
      errors.push("MySQL evidence test-file identity is invalid");
    }
    if (evidence.cleanupVerified !== true) {
      errors.push("MySQL evidence does not prove cleanup");
    }
    const expectedFiles = [...REQUIRED_MYSQL_EVIDENCE_FILES].sort();
    const actualFiles = Object.keys(evidence.fileHashes ?? {}).sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      errors.push("MySQL evidence hash file set is incomplete or unexpected");
    } else {
      for (const file of expectedFiles) {
        const contents = await readFile(path.join(ROOT, file));
        const actual = createHash("sha256").update(contents).digest("hex");
        if (actual !== evidence.fileHashes?.[file]) {
          errors.push(`Stale MySQL evidence hash: ${file}`);
        }
      }
    }
  } catch {
    errors.push("MySQL evidence file is missing or unreadable");
  }
  return { valid: errors.length === 0, errors };
}

async function readExistingInventory(): Promise<InventoryDocument | null> {
  try {
    return JSON.parse(
      await readFile(INVENTORY_PATH, "utf8")
    ) as InventoryDocument;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function validateInventory(
  extracted: ExtractedProcedure[],
  inventory: InventoryDocument
): string[] {
  const errors: string[] = [];
  const extractedByKey = new Map(
    extracted.map(procedure => [procedure.key, procedure])
  );
  const inventoryByKey = new Map<string, InventoryProcedure>();

  for (const procedure of inventory.procedures) {
    if (inventoryByKey.has(procedure.key))
      errors.push(`Duplicate inventory key: ${procedure.key}`);
    inventoryByKey.set(procedure.key, procedure);
    if (!CLASSIFICATIONS.includes(procedure.classification)) {
      errors.push(
        `Invalid classification for ${procedure.key}: ${procedure.classification}`
      );
    }
    if (!SEVERITIES.includes(procedure.severity)) {
      errors.push(
        `Invalid severity for ${procedure.key}: ${procedure.severity}`
      );
    }
    if (!TARGET_STEPS.includes(procedure.targetStep)) {
      errors.push(
        `Invalid target step for ${procedure.key}: ${procedure.targetStep}`
      );
    }
    if (
      !INTEGRATION_EVIDENCE_STATUSES.includes(
        procedure.integrationEvidenceStatus
      )
    ) {
      errors.push(
        `Invalid integration evidence status for ${procedure.key}: ${procedure.integrationEvidenceStatus}`
      );
    }
    if (procedure.finalScopedWrite && !procedure.integrationTest) {
      errors.push(`Missing integration test mapping: ${procedure.key}`);
    }
    if (procedure.finalScopedWrite && !procedure.integrationTestName) {
      errors.push(`Missing integration test name: ${procedure.key}`);
    }
    if (
      procedure.integrationEvidenceStatus !== "not_applicable" &&
      (!procedure.finalScopedWrite ||
        !procedure.integrationTest ||
        !procedure.integrationTestName)
    ) {
      errors.push(`Incomplete scoped-write evidence: ${procedure.key}`);
    }
    if (procedure.ownershipPath.length === 0)
      errors.push(`Missing ownership path: ${procedure.key}`);
    if (
      procedure.ownershipPath.some(path =>
        /ownership recorded by|not project-scoped or no project-owned identifier detected/i.test(
          path
        )
      )
    ) {
      errors.push(`Placeholder ownership path: ${procedure.key}`);
    }
    if (!procedure.authorizationEvidence.trim()) {
      errors.push(`Missing authorization evidence: ${procedure.key}`);
    }
    if (!procedure.disposition.trim())
      errors.push(`Missing disposition: ${procedure.key}`);
    if (
      ["unsafe", "legacy_user_guard", "legacy_null"].includes(
        procedure.classification
      ) &&
      procedure.targetStep === "none"
    ) {
      errors.push(
        `Unsafe/ambiguous row lacks remediation target: ${procedure.key}`
      );
    }
    if (
      ["unsafe", "legacy_user_guard", "legacy_null"].includes(
        procedure.classification
      ) &&
      procedure.severity === "none"
    ) {
      errors.push(`Unsafe/ambiguous row lacks severity: ${procedure.key}`);
    }
    if (procedure.classification === "public_token_guarded") {
      if (procedure.operation !== "query") {
        errors.push(
          `Public-token procedure is not read-only: ${procedure.key}`
        );
      }
      if (
        !/expir/i.test(`${procedure.authorizationEvidence} ${procedure.notes}`)
      ) {
        errors.push(
          `Public-token procedure lacks expiry evidence: ${procedure.key}`
        );
      }
      if (
        !/query-only|read-only/i.test(
          `${procedure.authorizationEvidence} ${procedure.notes}`
        )
      ) {
        errors.push(
          `Public-token procedure lacks read-only evidence: ${procedure.key}`
        );
      }
    }
  }

  for (const [key, procedure] of extractedByKey) {
    const row = inventoryByKey.get(key);
    if (!row) {
      errors.push(`Missing inventory row: ${key}`);
      continue;
    }
    if (row.accessPrimitive !== procedure.accessPrimitive) {
      errors.push(
        `Access primitive drift for ${key}: ${row.accessPrimitive} != ${procedure.accessPrimitive}`
      );
    }
    if (row.operation !== procedure.operation) {
      errors.push(
        `Operation drift for ${key}: ${row.operation} != ${procedure.operation}`
      );
    }
    if (
      JSON.stringify(row.inputIdentifiers) !==
      JSON.stringify(procedure.inputIdentifiers)
    ) {
      errors.push(`Input identifier drift for ${key}`);
    }
    if (row.router !== procedure.router) errors.push(`Router drift for ${key}`);
    if (row.procedure !== procedure.procedure)
      errors.push(`Procedure-name drift for ${key}`);
    if (row.source !== procedure.source)
      errors.push(`Source-location drift for ${key}`);
    if (
      JSON.stringify(row.helperCalls) !== JSON.stringify(procedure.helperCalls)
    ) {
      errors.push(`Helper-call drift for ${key}`);
    }
    if (row.firstDataAccess !== procedure.firstDataAccess) {
      errors.push(`First-data-access drift for ${key}`);
    }
    if (
      procedure.operation === "mutation" &&
      READ_ONLY_ORG_PRIMITIVES.has(procedure.accessPrimitive)
    ) {
      errors.push(
        `Organization mutation uses read-only procedure primitive: ${key}`
      );
    }
    if (
      ORG_ACCESS_PRIMITIVES.has(procedure.accessPrimitive) &&
      GLOBAL_PLATFORM_ALERT_EFFECT_PATTERN.test(procedure.sourceText)
    ) {
      errors.push(
        `Tenant procedure reaches globally governed platform alerts: ${key}`
      );
    }
    if (
      ORG_ACCESS_PRIMITIVES.has(procedure.accessPrimitive) &&
      CROSS_ORG_LEARNING_EFFECT_PATTERN.test(procedure.sourceText)
    ) {
      errors.push(
        `Tenant procedure reaches an unscoped learning or prediction helper: ${key}`
      );
    }
    if (
      ORG_ACCESS_PRIMITIVES.has(procedure.accessPrimitive) &&
      PLATFORM_PUBLIC_DERIVED_WRITE_PATTERN.test(procedure.sourceText)
    ) {
      errors.push(
        `Tenant procedure writes a platform-public derived artifact: ${key}`
      );
    }
    if (
      row.classification === "global_governed" &&
      procedure.inputIdentifiers.some(identifier =>
        TENANT_RESOURCE_ID_PATTERN.test(identifier)
      ) &&
      !GLOBAL_TENANT_IDENTIFIER_POLICY_KEYS.has(key)
    ) {
      errors.push(
        `Global-governed path accepts a tenant resource identifier without explicit policy: ${key}`
      );
    }
    if (
      SCOPED_WRITE_EVIDENCE[key] &&
      row.finalScopedWrite !== SCOPED_WRITE_EVIDENCE[key].finalScopedWrite
    ) {
      errors.push(`Missing final scoped-write evidence: ${key}`);
    }
  }

  for (const key of inventoryByKey.keys()) {
    if (!extractedByKey.has(key)) errors.push(`Stale inventory row: ${key}`);
  }

  if (inventory.procedureCount !== extracted.length) {
    errors.push(
      `Procedure count mismatch: inventory=${inventory.procedureCount}, extracted=${extracted.length}`
    );
  }

  return errors;
}

async function validateIntegrationEvidence(
  inventory: InventoryDocument
): Promise<string[]> {
  const errors: string[] = [];
  const sourceCache = new Map<string, string>();
  for (const procedure of inventory.procedures) {
    if (!procedure.integrationTest || !procedure.integrationTestName) continue;
    let source = sourceCache.get(procedure.integrationTest);
    if (source === undefined) {
      try {
        source = await readFile(
          path.join(ROOT, procedure.integrationTest),
          "utf8"
        );
        sourceCache.set(procedure.integrationTest, source);
      } catch {
        errors.push(
          `Missing integration test file: ${procedure.integrationTest}`
        );
        continue;
      }
    }
    if (!source.includes(procedure.integrationTestName)) {
      errors.push(
        `Missing named integration test for ${procedure.key}: ${procedure.integrationTestName}`
      );
    }
  }
  return errors;
}

function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function renderReport(inventory: InventoryDocument) {
  const byClassification = countBy(
    inventory.procedures.map(row => row.classification)
  );
  const bySeverity = countBy(inventory.procedures.map(row => row.severity));
  const byTarget = countBy(inventory.procedures.map(row => row.targetStep));
  const severityRank: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
  };
  const remediationRows = inventory.procedures
    .filter(row => row.targetStep !== "none")
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.targetStep.localeCompare(b.targetStep) ||
        a.key.localeCompare(b.key)
    );
  const scopedWriteRows = inventory.procedures.filter(
    row => row.finalScopedWrite
  );

  const lines = [
    "# MIYAR Project-Resource Authorization Inventory",
    "",
    `Generated from \`${inventory.sourceRoot}\` by \`scripts/audit-resource-authorization.ts\`.`,
    "",
    `- Procedures inventoried: **${inventory.procedureCount}**`,
    `- Generated: ${inventory.generatedAt}`,
    "- Canonical machine-readable source: `docs/security/resource-authorization-inventory.json`",
    "- Validation: `pnpm audit:authorization`",
    "",
    "## Method and Scope",
    "",
    "- The TypeScript compiler AST enumerates every procedure declared by the router modules and `systemRouter`.",
    "- Extracted facts include access primitive, operation, input identifiers, helper calls, first resource access, and source location.",
    "- Semantic classification combines source-text rules, explicit governed/disabled registries, scoped-write evidence mappings, and manual ownership review; AST enumeration does not by itself prove authorization correctness.",
    "- The validator fails on missing/duplicate/stale procedures, source/helper/access drift, placeholder ownership paths, invalid classifications, and incomplete public-token evidence.",
    "- Inventory generation never accesses a live or shared database. Scoped-write SQL semantics are separately covered by the guarded serial suite at `tests/mysql/design-authorization.mysql.test.ts`, which accepts only disposable local database names prefixed `miyar_auth_test`.",
    "- Named MySQL coverage includes asset/visual/brief/scenario writes, board create/delete/join/reorder rollback paths, all six asset-link target types, comments, RFQ batches, share-token uniqueness, floor-plan linking, approval updates, evidence isolation, membership uniqueness, and two-connection ownership locking.",
    "",
    "## Review Batches",
    "",
    "1. Project, design, scenario, assets, briefs, boards, visuals, reports, and shares.",
    "2. Predictive, learning, intelligence, analytics, bias, economics, sales premium, and sustainability.",
    "3. Intake, material quantities, space programmes, design advisor, portfolio, customer success, and autonomous operations.",
    "4. Admin, ingestion, market intelligence, organization, authentication, seed, public-token, and governed-global paths.",
    "",
    "## Classification Summary",
    "",
    "| Classification | Count |",
    "| --- | ---: |",
    ...byClassification.map(
      ([classification, count]) => `| \`${classification}\` | ${count} |`
    ),
    "",
    "## Severity Summary",
    "",
    "| Severity | Count |",
    "| --- | ---: |",
    ...bySeverity.map(([severity, count]) => `| \`${severity}\` | ${count} |`),
    "",
    "## Remediation Summary",
    "",
    "| Target | Count |",
    "| --- | ---: |",
    ...byTarget.map(([target, count]) => `| \`${target}\` | ${count} |`),
    "",
    "### Remediation ownership",
    "",
    "- `TR-02` supplies shared organization/resource authorization primitives used by the remediation steps.",
    "- `TR-03` owns design-domain resources and public-share fail-closed behavior.",
    "- `TR-04` owns remaining project, child, polymorphic, global-governance, and legacy-user paths.",
    "- `TR-05` owns pooled evidence, score, outcome, and comparable-data isolation.",
    "- `NEEDS_HUMAN` is reserved for ownership or policy ambiguity that cannot be safely defaulted.",
    "",
    "## Ownership Graph",
    "",
    "- Project root: `projects.id -> projects.orgId` (`orgId` is currently nullable).",
    "- Project children: child `projectId -> projects.id -> projects.orgId`.",
    "- Asset links: `asset_links.assetId -> project_assets.projectId -> projects.orgId`.",
    "- Board materials: `materials_to_boards.boardId -> material_boards.projectId -> projects.orgId`.",
    "- Scenario children: child `scenarioId -> scenarios.projectId -> projects.orgId`.",
    "- Direct organization records: `organizationId`/`orgId -> organizations.id`.",
    "- Governed global records: explicit global intelligence/admin data; null ownership is not assumed global.",
    "- Public shares: `shareToken -> ai_design_briefs.projectId -> projects.id`; token expiry and query-only behavior are required.",
    "- Legacy user checks: `projects.userId` is recorded as a legacy guard, not organization authorization.",
    "",
    "## Final Scoped-Write Evidence",
    "",
    "| Procedure | Final scoped write | Integration test | Test case | Status |",
    "| --- | --- | --- | --- | --- |",
    ...scopedWriteRows.map(
      row =>
        `| \`${row.key}\` | ${row.finalScopedWrite} | \`${row.integrationTest}\` | ${row.integrationTestName} | \`${row.integrationEvidenceStatus}\` |`
    ),
    "",
    "## Remediation Inventory",
    "",
    "| Key | Access | Operation | Classification | Severity | Ownership path | First data access | Target | Source |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...remediationRows.map(
      row =>
        `| \`${row.key}\` | \`${row.accessPrimitive}\` | ${row.operation} | \`${row.classification}\` | \`${row.severity}\` | ${row.ownershipPath.join("<br>")} | \`${row.firstDataAccess ?? "none"}\` | \`${row.targetStep}\` | \`${row.source}\` |`
    ),
    "",
    "## Public-Token Procedures",
    "",
    "| Key | Operation | Evidence | Notes | Source |",
    "| --- | --- | --- | --- | --- |",
    ...inventory.procedures
      .filter(row => row.classification === "public_token_guarded")
      .map(
        row =>
          `| \`${row.key}\` | ${row.operation} | ${row.authorizationEvidence} | ${row.notes || "Review recorded in canonical JSON."} | \`${row.source}\` |`
      ),
    "",
    "## Complete Procedure Checklist",
    "",
    "| Key | Classification | Ownership | Disposition |",
    "| --- | --- | --- | --- |",
    ...inventory.procedures.map(
      row =>
        `| \`${row.key}\` | \`${row.classification}\` | ${row.ownershipPath.join("<br>")} | ${row.disposition} |`
    ),
  ];

  return `${lines.join("\n")}\n`;
}

async function main() {
  const mode = process.argv.includes("--render") ? "render" : "check";
  const extracted = await extractProcedures();

  if (mode === "render") {
    const inventory = await mergeInventory(
      extracted,
      process.argv.includes("--reset") ? null : await readExistingInventory()
    );
    await requireReclassificationAcknowledgement(inventory);
    await mkdir(path.dirname(INVENTORY_PATH), { recursive: true });
    await writeFile(
      INVENTORY_PATH,
      `${JSON.stringify(inventory, null, 2)}\n`,
      "utf8"
    );
    await writeFile(REPORT_PATH, renderReport(inventory), "utf8");
    console.log(`Rendered ${inventory.procedureCount} procedures.`);
    return;
  }

  const inventory = await readExistingInventory();
  if (!inventory)
    throw new Error(
      `Inventory missing: ${path.relative(ROOT, INVENTORY_PATH)}`
    );
  const mysqlEvidence = await validateMysqlEvidence();
  const hasExecutedRows = inventory.procedures.some(
    row => row.integrationEvidenceStatus === "executed"
  );
  const errors = [
    ...validateInventory(extracted, inventory),
    ...(await validateIntegrationEvidence(inventory)),
    ...(hasExecutedRows && !mysqlEvidence.valid ? mysqlEvidence.errors : []),
  ];
  for (const row of inventory.procedures.filter(row => row.integrationTest)) {
    const expected = mysqlEvidence.valid ? "executed" : "defined_not_executed";
    if (row.integrationEvidenceStatus !== expected) {
      errors.push(
        `Integration evidence status drift for ${row.key}: ${row.integrationEvidenceStatus} != ${expected}`
      );
    }
  }
  if (errors.length > 0) {
    console.error(errors.map(error => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Authorization inventory valid: ${inventory.procedureCount} procedures, ${inventory.procedures.filter(row => row.targetStep !== "none").length} remediation rows.`
  );
}

await main();
