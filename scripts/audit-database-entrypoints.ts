#!/usr/bin/env tsx

/**
 * Inventories direct mysql2/drizzle construction sites and the canonical getDb
 * wrapper. Direct constructors require a reachable central preflight before
 * each open; getDb is governed at its audited constructor in server/db.ts.
 *
 * This is intentionally a source audit, not a control-flow proof. It requires
 * the preflight and constructor to share an execution scope and rejects a
 * preflight that is after the constructor or hidden in a nested callback.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const DATABASE_OPERATIONS = [
  "serve",
  "unit-test",
  "integration-test",
  "seed",
  "reset",
  "migrate",
  "ingest",
] as const;

export type AuditedDatabaseOperation = (typeof DATABASE_OPERATIONS)[number];
export type DatabaseConstructorKind =
  | "mysql2.createPool"
  | "mysql2.createConnection"
  | "drizzle.mysql2"
  | "miyar.getDb";

export interface DatabaseEntrypoint {
  file: string;
  line: number;
  column: number;
  kind: DatabaseConstructorKind;
  preflight:
    | {
        functionName: "initializeDatabaseSafety" | "assertDatabaseAccess";
        operation: AuditedDatabaseOperation | "active";
        line: number;
        column: number;
      }
    | null;
  allowlisted: boolean;
}

export interface DatabaseEntrypointFinding {
  file: string;
  line: number;
  column: number;
  rule: "missing-preflight" | "invalid-preflight-operation" | "stale-allowlist";
  message: string;
}

export interface DatabaseEntrypointAllowlistEntry {
  file: string;
  constructors: readonly DatabaseConstructorKind[];
  owner: string;
  justification: string;
}

/** Generated output is rebuilt from audited source; no hand-written opener is exempt. */
export const DATABASE_ENTRYPOINT_ALLOWLIST = [
  {
    file: "api/index.js",
    constructors: ["mysql2.createPool", "drizzle.mysql2"],
    owner: "Platform engineering",
    justification:
      "Tracked esbuild output from server/serverless/index.ts; pnpm build regenerates it from audited sources and CI verifies the build.",
  },
] as const satisfies readonly DatabaseEntrypointAllowlistEntry[];

export interface AuditDatabaseEntrypointsOptions {
  repositoryRoot?: string;
  sourceRoots?: readonly string[];
  allowlist?: readonly DatabaseEntrypointAllowlistEntry[];
}

export interface DatabaseEntrypointAuditResult {
  entrypoints: DatabaseEntrypoint[];
  findings: DatabaseEntrypointFinding[];
}

type PreflightCall = NonNullable<DatabaseEntrypoint["preflight"]> & {
  position: number;
  scope: ts.Node;
  statementContainer: ts.Node | null;
  validOperation: boolean;
};

const DEFAULT_SOURCE_ROOTS = ["server", "scripts", "drizzle", "tests", "api"] as const;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage", ".git"]);
const OPERATIONS = new Set<string>(DATABASE_OPERATIONS);

function collectSourceFiles(repositoryRoot: string, sourceRoots: readonly string[]): string[] {
  const files: string[] = [];

  const visit = (absolutePath: string) => {
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(path.basename(absolutePath))) return;
      for (const entry of readdirSync(absolutePath).sort()) {
        visit(path.join(absolutePath, entry));
      }
      return;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(absolutePath))) files.push(absolutePath);
  };

  for (const sourceRoot of sourceRoots) {
    const absoluteRoot = path.join(repositoryRoot, sourceRoot);
    try {
      visit(absoluteRoot);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
  }
  return files;
}

function scriptKind(file: string): ts.ScriptKind {
  if (/\.tsx$/i.test(file)) return ts.ScriptKind.TSX;
  if (/\.(?:js|mjs|cjs)$/i.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function location(sourceFile: ts.SourceFile, node: ts.Node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: position.line + 1, column: position.character + 1 };
}

function executionScope(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return node.getSourceFile();
}

function directStatementContainer(node: ts.Node): ts.Node | null {
  let current: ts.Node | undefined = node;
  while (current?.parent) {
    if (ts.isStatement(current)) {
      return ts.isBlock(current.parent) || ts.isSourceFile(current.parent)
        ? current.parent
        : null;
    }
    current = current.parent;
  }
  return null;
}

function containsNode(container: ts.Node, node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (current === container) return true;
    current = current.parent;
  }
  return false;
}

function moduleIsDatabaseSafety(moduleName: string): boolean {
  return /(?:^|\/)database-safety(?:\.[cm]?[jt]s)?$/.test(moduleName);
}

function moduleIsDatabaseWrapper(moduleName: string): boolean {
  return /(?:^|\/)db(?:\.[cm]?[jt]s)?$/.test(moduleName);
}

function importedBindings(sourceFile: ts.SourceFile) {
  const mysqlObjects = new Set<string>();
  const mysqlCreatePool = new Set<string>();
  const mysqlCreateConnection = new Set<string>();
  const drizzleObjects = new Set<string>();
  const drizzleFunctions = new Set<string>();
  const databaseWrapperObjects = new Set<string>();
  const getDbFunctions = new Set<string>();
  const preflights = new Map<string, "initializeDatabaseSafety" | "assertDatabaseAccess">();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleName = statement.moduleSpecifier.text;
    const importClause = statement.importClause;
    if (!importClause) continue;

    if (moduleName === "mysql2" || moduleName === "mysql2/promise") {
      if (importClause.name) mysqlObjects.add(importClause.name.text);
      const bindings = importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) mysqlObjects.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = element.propertyName?.text ?? element.name.text;
          if (imported === "createPool") mysqlCreatePool.add(element.name.text);
          if (imported === "createConnection") mysqlCreateConnection.add(element.name.text);
        }
      }
    }

    if (moduleName === "drizzle-orm/mysql2") {
      if (importClause.name) drizzleFunctions.add(importClause.name.text);
      const bindings = importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) drizzleObjects.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = element.propertyName?.text ?? element.name.text;
          if (imported === "drizzle") drizzleFunctions.add(element.name.text);
        }
      }
    }

    if (moduleIsDatabaseWrapper(moduleName)) {
      const bindings = importClause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) databaseWrapperObjects.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = element.propertyName?.text ?? element.name.text;
          if (imported === "getDb") getDbFunctions.add(element.name.text);
        }
      }
    }

    if (moduleIsDatabaseSafety(moduleName)) {
      const bindings = importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = element.propertyName?.text ?? element.name.text;
          if (imported === "initializeDatabaseSafety" || imported === "assertDatabaseAccess") {
            preflights.set(element.name.text, imported);
          }
        }
      }
    }
  }

  return {
    mysqlObjects,
    mysqlCreatePool,
    mysqlCreateConnection,
    drizzleObjects,
    drizzleFunctions,
    databaseWrapperObjects,
    getDbFunctions,
    preflights,
  };
}

function classifyConstructor(
  call: ts.CallExpression,
  bindings: ReturnType<typeof importedBindings>,
): DatabaseConstructorKind | null {
  const expression = call.expression;
  if (ts.isIdentifier(expression)) {
    if (bindings.mysqlCreatePool.has(expression.text)) return "mysql2.createPool";
    if (bindings.mysqlCreateConnection.has(expression.text)) return "mysql2.createConnection";
    if (bindings.drizzleFunctions.has(expression.text)) return "drizzle.mysql2";
    if (bindings.getDbFunctions.has(expression.text)) return "miyar.getDb";
    return null;
  }

  if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) return null;
  const object = expression.expression.text;
  const property = expression.name.text;
  if (bindings.mysqlObjects.has(object) && property === "createPool") return "mysql2.createPool";
  if (bindings.mysqlObjects.has(object) && property === "createConnection") {
    return "mysql2.createConnection";
  }
  if (bindings.drizzleObjects.has(object) && property === "drizzle") return "drizzle.mysql2";
  if (bindings.databaseWrapperObjects.has(object) && property === "getDb") return "miyar.getDb";
  return null;
}

function collectPreflights(
  sourceFile: ts.SourceFile,
  bindings: ReturnType<typeof importedBindings>,
): PreflightCall[] {
  const calls: PreflightCall[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const functionName = bindings.preflights.get(node.expression.text);
      if (functionName) {
        const argument = node.arguments[0];
        const operation = argument && ts.isStringLiteralLike(argument)
          ? argument.text
          : functionName === "assertDatabaseAccess" && !argument
            ? "active"
            : "";
        calls.push({
          functionName,
          operation: operation as AuditedDatabaseOperation | "active",
          ...location(sourceFile, node),
          position: node.getStart(sourceFile),
          scope: executionScope(node),
          statementContainer: directStatementContainer(node),
          validOperation: operation === "active" || OPERATIONS.has(operation),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

function allowlistCounts(entries: readonly DatabaseEntrypointAllowlistEntry[]) {
  const counts = new Map<string, Map<DatabaseConstructorKind, number>>();
  for (const entry of entries) {
    const byKind = counts.get(entry.file) ?? new Map<DatabaseConstructorKind, number>();
    for (const constructor of entry.constructors) {
      byKind.set(constructor, (byKind.get(constructor) ?? 0) + 1);
    }
    counts.set(entry.file, byKind);
  }
  return counts;
}

export function auditDatabaseEntrypoints(
  options: AuditDatabaseEntrypointsOptions = {},
): DatabaseEntrypointAuditResult {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
  const sourceRoots = options.sourceRoots ?? DEFAULT_SOURCE_ROOTS;
  const allowlist = options.allowlist ?? DATABASE_ENTRYPOINT_ALLOWLIST;
  const expectedAllowlist = allowlistCounts(allowlist);
  const observedAllowlist = new Map<string, Map<DatabaseConstructorKind, number>>();
  const entrypoints: DatabaseEntrypoint[] = [];
  const findings: DatabaseEntrypointFinding[] = [];

  for (const absoluteFile of collectSourceFiles(repositoryRoot, sourceRoots)) {
    const relativeFile = path.relative(repositoryRoot, absoluteFile).split(path.sep).join("/");
    const sourceFile = ts.createSourceFile(
      absoluteFile,
      readFileSync(absoluteFile, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      scriptKind(absoluteFile),
    );
    const bindings = importedBindings(sourceFile);
    const preflights = collectPreflights(sourceFile, bindings);

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const kind = classifyConstructor(node, bindings);
        if (kind) {
          const nodeLocation = location(sourceFile, node);
          const scope = executionScope(node);
          const statementContainer = directStatementContainer(node);
          const earlierCalls = preflights
            .filter(preflight =>
              preflight.scope === scope &&
              preflight.statementContainer !== null &&
              (preflight.statementContainer === statementContainer ||
                containsNode(preflight.statementContainer, node)) &&
              preflight.position < node.getStart(sourceFile)
            )
            .sort((left, right) => right.position - left.position);
          const validPreflight = earlierCalls.find(preflight => preflight.validOperation) ?? null;
          const invalidPreflight = earlierCalls.find(preflight => !preflight.validOperation);
          const expectedCount = expectedAllowlist.get(relativeFile)?.get(kind) ?? 0;
          const observedByKind = observedAllowlist.get(relativeFile) ?? new Map<DatabaseConstructorKind, number>();
          const alreadyObserved = observedByKind.get(kind) ?? 0;
          const allowlisted = !validPreflight && alreadyObserved < expectedCount;
          if (allowlisted) {
            observedByKind.set(kind, alreadyObserved + 1);
            observedAllowlist.set(relativeFile, observedByKind);
          }

          entrypoints.push({
            file: relativeFile,
            ...nodeLocation,
            kind,
            preflight: validPreflight
              ? {
                  functionName: validPreflight.functionName,
                  operation: validPreflight.operation,
                  line: validPreflight.line,
                  column: validPreflight.column,
                }
              : null,
            allowlisted,
          });

          if (kind !== "miyar.getDb" && !validPreflight && !allowlisted) {
            findings.push({
              file: relativeFile,
              ...nodeLocation,
              rule: invalidPreflight ? "invalid-preflight-operation" : "missing-preflight",
              message: invalidPreflight
                ? `Database constructor follows a central preflight with unsupported operation ${JSON.stringify(invalidPreflight.operation)}.`
                : "Database constructor must follow initializeDatabaseSafety or assertDatabaseAccess in the same execution scope.",
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const entry of allowlist) {
    const expectedByKind = expectedAllowlist.get(entry.file) ?? new Map();
    const observedByKind = observedAllowlist.get(entry.file) ?? new Map();
    for (const [kind, expected] of expectedByKind) {
      const observed = observedByKind.get(kind) ?? 0;
      if (observed !== expected) {
        findings.push({
          file: entry.file,
          line: 1,
          column: 1,
          rule: "stale-allowlist",
          message: `Allowlist expects ${expected} ${kind} constructor(s), but observed ${observed}; remove or update the exact exception.`,
        });
      }
    }
  }

  entrypoints.sort((left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column,
  );
  findings.sort((left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column,
  );
  return { entrypoints, findings };
}

export function formatDatabaseEntrypointAudit(result: DatabaseEntrypointAuditResult): string {
  const lines = result.entrypoints.map(entrypoint => {
    const governance = entrypoint.preflight
      ? `${entrypoint.preflight.functionName}(${entrypoint.preflight.operation}) at ${entrypoint.preflight.line}:${entrypoint.preflight.column}`
      : entrypoint.allowlisted
        ? "exact legacy allowlist"
        : entrypoint.kind === "miyar.getDb"
          ? "central guarded wrapper"
        : "UNSAFE";
    return `${entrypoint.file}:${entrypoint.line}:${entrypoint.column} ${entrypoint.kind} -> ${governance}`;
  });
  for (const finding of result.findings) {
    lines.push(
      `ERROR ${finding.file}:${finding.line}:${finding.column} [${finding.rule}] ${finding.message}`,
    );
  }
  lines.push(
    `Database entrypoints: ${result.entrypoints.length}; allowlisted: ${result.entrypoints.filter(entrypoint => entrypoint.allowlisted).length}; findings: ${result.findings.length}`,
  );
  return lines.join("\n");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = auditDatabaseEntrypoints();
  console.log(formatDatabaseEntrypointAudit(result));
  if (result.findings.length > 0) process.exitCode = 1;
}
