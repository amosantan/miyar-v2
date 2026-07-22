import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as ts from "typescript";

import { designRouter } from "../server/routers/design";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(
  ROOT,
  "tests/contracts/design-router.sc01-baseline.json"
);
const INVENTORY_PATH = path.join(
  ROOT,
  "docs/security/resource-authorization-inventory.json"
);
const DOMAIN_FILES = [
  "server/routers/design-assets.ts",
  "server/routers/design-briefs.ts",
  "server/routers/design-boards.ts",
  "server/routers/design-collaboration.ts",
  "server/routers/design-market-context.ts",
  "server/routers/design-materials.ts",
  "server/routers/design-sharing.ts",
  "server/routers/design-visuals.ts",
  "server/routers/design-geometry-assets.ts",
] as const;
const APPROVED_ADDITIVE_CONTRACTS = new Map([
  [
    "design.createGeometrySourceUpload",
    { operation: "mutation", accessPrimitive: "designOrgMutationProcedure" },
  ],
  [
    "design.finalizeGeometrySourceUpload",
    { operation: "mutation", accessPrimitive: "designOrgMutationProcedure" },
  ],
] as const);
const APPROVED_INITIALIZER_CHANGES = new Set([
  // DI-01 release-N compatibility guard; operation and middleware are frozen.
  "design.analyzeFloorPlan",
  // EV-00 / ADR-0009: RFQ rates now come from material_library with
  // provenance-derived pricingSource; operation and middleware are frozen.
  "design.generateRfqFromBrief",
]);
const ACCESS_PRIMITIVES = [
  "designOrgMutationProcedure",
  "publicRateLimitedProcedure",
  "designOrgAdminProcedure",
  "protectedProcedure",
  "adminProcedure",
  "orgProcedure",
] as const;

type Operation = "query" | "mutation";

interface SourceContract {
  path: string;
  operation: Operation;
  accessPrimitive: (typeof ACCESS_PRIMITIVES)[number];
  initializerSha256: string;
}

interface BaselineContract extends SourceContract {
  classification: string;
  middlewareCount: number;
  middlewareSha256: string[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedNode(node: ts.Node, _sourceFile: ts.SourceFile): string {
  const parts: string[] = [];
  const visit = (current: ts.Node) => {
    if (ts.isParenthesizedExpression(current)) {
      current.forEachChild(visit);
      return;
    }
    const parentWithName = current.parent as
      | (ts.Node & { name?: ts.Node })
      | undefined;
    if (
      parentWithName?.name === current &&
      (ts.isIdentifier(current) || ts.isStringLiteralLike(current))
    ) {
      parts.push(`property-name:${current.text}`);
      return;
    }
    parts.push(String(current.kind));
    if (
      ts.isIdentifier(current) ||
      ts.isStringLiteralLike(current) ||
      ts.isNumericLiteral(current) ||
      ts.isRegularExpressionLiteral(current)
    ) {
      parts.push(JSON.stringify(current.text));
    }
    current.forEachChild(visit);
  };
  visit(node);
  return parts.join("|");
}

async function extractSourceContracts(
  relativeFiles: readonly string[]
): Promise<SourceContract[]> {
  const contracts: SourceContract[] = [];
  for (const relativeFile of relativeFiles) {
    const absoluteFile = path.isAbsolute(relativeFile)
      ? relativeFile
      : path.join(ROOT, relativeFile);
    const source = await readFile(absoluteFile, "utf8");
    const sourceFile = ts.createSourceFile(
      absoluteFile,
      source,
      ts.ScriptTarget.Latest,
      true
    );
    sourceFile.forEachChild(node => {
      if (!ts.isVariableStatement(node)) return;
      for (const declaration of node.declarationList.declarations) {
        if (
          !declaration.initializer ||
          !ts.isCallExpression(declaration.initializer) ||
          !ts.isIdentifier(declaration.initializer.expression) ||
          declaration.initializer.expression.text !== "router" ||
          !declaration.initializer.arguments[0] ||
          !ts.isObjectLiteralExpression(declaration.initializer.arguments[0])
        ) {
          continue;
        }
        for (const property of declaration.initializer.arguments[0]
          .properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = property.name
            .getText(sourceFile)
            .replace(/^['"]|['"]$/g, "");
          const initializerText = property.initializer.getText(sourceFile);
          const accessPrimitive = ACCESS_PRIMITIVES.find(primitive =>
            new RegExp(`\\b${primitive}\\b`).test(initializerText)
          );
          const operation = /\.mutation\s*\(/.test(initializerText)
            ? "mutation"
            : /\.query\s*\(/.test(initializerText)
              ? "query"
              : null;
          if (!accessPrimitive || !operation) continue;
          contracts.push({
            path: `design.${name}`,
            operation,
            accessPrimitive,
            initializerSha256: sha256(
              normalizedNode(property.initializer, sourceFile)
            ),
          });
        }
      }
    });
  }
  return contracts.sort((a, b) => a.path.localeCompare(b.path));
}

function runtimeContract(name: string) {
  const procedure = designRouter._def.procedures[name];
  if (!procedure) throw new Error(`Missing runtime procedure design.${name}`);
  const middleware = procedure._def.middlewares;
  return {
    operation: procedure._def.type as Operation,
    middlewareCount: middleware.length,
    middlewareSha256: middleware.map(item =>
      sha256(item.toString().replace(/\s+/g, " ").trim())
    ),
  };
}

async function captureBaseline() {
  const sourceArgument = process.argv.find(argument =>
    argument.startsWith("--source=")
  );
  const sourceContracts = await extractSourceContracts([
    sourceArgument?.slice("--source=".length) ?? "server/routers/design.ts",
  ]);
  const inventory = JSON.parse(await readFile(INVENTORY_PATH, "utf8")) as {
    procedures: Array<{ key: string; classification: string }>;
  };
  const classificationByPath = new Map(
    inventory.procedures.map(procedure => [
      procedure.key,
      procedure.classification,
    ])
  );
  const baseline: BaselineContract[] = sourceContracts.map(contract => {
    const name = contract.path.slice("design.".length);
    const runtime = runtimeContract(name);
    const classification = classificationByPath.get(contract.path);
    if (!classification) {
      throw new Error(
        `Missing authorization classification for ${contract.path}`
      );
    }
    return { ...contract, classification, ...runtime };
  });
  if (baseline.length !== 63) {
    throw new Error(`Expected 63 design procedures, found ${baseline.length}`);
  }
  await mkdir(path.dirname(BASELINE_PATH), { recursive: true });
  await writeFile(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `Captured immutable SC-01 baseline: ${baseline.length} procedures`
  );
}

async function checkContract() {
  const baseline = JSON.parse(
    await readFile(BASELINE_PATH, "utf8")
  ) as BaselineContract[];
  const current = await extractSourceContracts(DOMAIN_FILES);
  const duplicatePaths = current
    .map(contract => contract.path)
    .filter((item, index, all) => all.indexOf(item) !== index);
  if (duplicatePaths.length > 0) {
    throw new Error(
      `Duplicate design procedures: ${duplicatePaths.join(", ")}`
    );
  }
  const currentByPath = new Map(
    current.map(contract => [contract.path, contract])
  );
  const inventory = JSON.parse(await readFile(INVENTORY_PATH, "utf8")) as {
    procedures: Array<{ key: string; classification: string }>;
  };
  const classificationByPath = new Map(
    inventory.procedures.map(procedure => [
      procedure.key,
      procedure.classification,
    ])
  );
  const errors: string[] = [];
  for (const expected of baseline) {
    const actual = currentByPath.get(expected.path);
    if (!actual) {
      errors.push(`Missing source procedure ${expected.path}`);
      continue;
    }
    for (const field of [
      "operation",
      "accessPrimitive",
      "initializerSha256",
    ] as const) {
      if (
        field === "initializerSha256" &&
        APPROVED_INITIALIZER_CHANGES.has(expected.path)
      ) {
        continue;
      }
      if (actual[field] !== expected[field]) {
        errors.push(`${expected.path} ${field} changed`);
      }
    }
    if (classificationByPath.get(expected.path) !== expected.classification) {
      errors.push(`${expected.path} authorization classification changed`);
    }
    const runtime = runtimeContract(expected.path.slice("design.".length));
    if (runtime.operation !== expected.operation) {
      errors.push(`${expected.path} runtime operation changed`);
    }
    if (runtime.middlewareCount !== expected.middlewareCount) {
      errors.push(`${expected.path} middleware count changed`);
    }
    if (
      JSON.stringify(runtime.middlewareSha256) !==
      JSON.stringify(expected.middlewareSha256)
    ) {
      errors.push(`${expected.path} middleware chain changed`);
    }
    currentByPath.delete(expected.path);
  }
  for (const [path, added] of currentByPath) {
    const approved = APPROVED_ADDITIVE_CONTRACTS.get(path as any);
    if (!approved) {
      errors.push(`Unexpected source procedure ${path}`);
      continue;
    }
    if (
      added.operation !== approved.operation ||
      added.accessPrimitive !== approved.accessPrimitive
    ) {
      errors.push(`${path} does not match its approved additive contract`);
    }
    if (!classificationByPath.get(path)) {
      errors.push(`${path} is missing an authorization classification`);
    }
  }
  const runtimeNames = Object.keys(designRouter._def.procedures).sort();
  const expectedNames = baseline
    .map(contract => contract.path.slice("design.".length))
    .concat(
      Array.from(APPROVED_ADDITIVE_CONTRACTS.keys()).map(path =>
        path.slice("design.".length)
      )
    )
    .sort();
  if (JSON.stringify(runtimeNames) !== JSON.stringify(expectedNames)) {
    errors.push("Runtime design procedure names changed");
  }
  const publicProcedures = current.filter(
    contract => contract.accessPrimitive === "publicRateLimitedProcedure"
  );
  if (
    publicProcedures.length !== 1 ||
    publicProcedures[0]?.path !== "design.resolveShareLink" ||
    publicProcedures[0]?.operation !== "query"
  ) {
    errors.push("Public share boundary changed");
  }
  if (errors.length > 0) {
    throw new Error(`SC-01 design contract drift:\n- ${errors.join("\n- ")}`);
  }
  console.log(
    `SC-01 design contract PASS: ${baseline.length} baseline procedures and ${APPROVED_ADDITIVE_CONTRACTS.size} approved additive procedures`
  );
}

if (process.argv.includes("--capture-baseline")) {
  await captureBaseline();
} else {
  await checkContract();
}
