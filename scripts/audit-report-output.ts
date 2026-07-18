#!/usr/bin/env tsx

/**
 * Static safety and scope audit for MIYAR's server-side HTML report generators.
 *
 * This intentionally uses the repository's TypeScript dev dependency rather
 * than adding a parser to the production dependency graph. It complements
 * hostile-output tests: this audit guards source-level boundaries that output
 * assertions alone cannot prove, such as the Material Board Annex call sites.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type Finding = {
  file: string;
  line: number;
  column: number;
  rule: string;
  message: string;
};

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatorFiles = [
  "server/engines/pdf-report.ts",
  "server/engines/board-pdf.ts",
  "server/engines/investor-pdf.ts",
] as const;

const safetyModule = "./report-safe-output";
const approvedAnnexCallers = new Set([
  "generateDesignBriefHTML",
  "generateFullReportHTML",
]);

function location(sourceFile: ts.SourceFile, node: ts.Node) {
  const start = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  );
  return { line: start.line + 1, column: start.character + 1 };
}

function addFinding(
  findings: Finding[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  rule: string,
  message: string
) {
  findings.push({
    file: path.relative(repositoryRoot, sourceFile.fileName),
    ...location(sourceFile, node),
    rule,
    message,
  });
}

function enclosingFunctionName(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name)
      return current.name.text;
    if (
      (ts.isVariableDeclaration(current) || ts.isPropertyAssignment(current)) &&
      ts.isIdentifier(current.name)
    ) {
      return current.name.text;
    }
    current = current.parent;
  }
  return undefined;
}

function dynamicResourceAttributeExpressions(
  node: ts.TemplateExpression
): ts.Expression[] {
  const expressions: ts.Expression[] = [];
  let precedingText = node.head.text;
  for (const span of node.templateSpans) {
    if (/\b(?:href|src)\s*=\s*["']\s*$/i.test(precedingText)) {
      expressions.push(span.expression);
    }
    precedingText = span.literal.text;
  }
  return expressions;
}

function auditGenerator(
  relativeFile: (typeof generatorFiles)[number]
): Finding[] {
  const absoluteFile = path.join(repositoryRoot, relativeFile);
  const source = readFileSync(absoluteFile, "utf8");
  const sourceFile = ts.createSourceFile(
    absoluteFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const findings: Finding[] = [];
  let importsSafetyBoundary = false;
  const safetyImports = new Set<string>();
  const governedAttributeValues = new Set<string>();

  const isGovernedAttributeExpression = (
    expression: ts.Expression
  ): boolean => {
    if (ts.isIdentifier(expression)) {
      return governedAttributeValues.has(expression.text);
    }
    if (ts.isParenthesizedExpression(expression)) {
      return isGovernedAttributeExpression(expression.expression);
    }
    if (ts.isConditionalExpression(expression)) {
      const branchIsSafe = (branch: ts.Expression) =>
        branch.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isStringLiteral(branch) && branch.text.length === 0) ||
        isGovernedAttributeExpression(branch);
      return (
        branchIsSafe(expression.whenTrue) && branchIsSafe(expression.whenFalse)
      );
    }
    if (
      !ts.isCallExpression(expression) ||
      !ts.isIdentifier(expression.expression)
    ) {
      return false;
    }
    return (
      safetyImports.has(expression.expression.text) &&
      ["escapeReportAttribute", "escapeReportEvidenceUrl"].includes(
        expression.expression.text
      )
    );
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const moduleName = node.moduleSpecifier.text;
      if (moduleName === safetyModule) {
        importsSafetyBoundary = true;
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            safetyImports.add(element.name.text);
          }
        }
      }
      if (
        moduleName.endsWith("/board-annex") ||
        moduleName === "./board-annex"
      ) {
        if (relativeFile !== "server/engines/pdf-report.ts") {
          addFinding(
            findings,
            sourceFile,
            node,
            "annex-import-boundary",
            "Only pdf-report.ts may import Material Board Annex data."
          );
        }
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isGovernedAttributeExpression(node.initializer)
    ) {
      governedAttributeValues.add(node.name.text);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "renderBoardAnnex"
    ) {
      const caller = enclosingFunctionName(node);
      if (!caller || !approvedAnnexCallers.has(caller)) {
        addFinding(
          findings,
          sourceFile,
          node,
          "annex-output-boundary",
          `renderBoardAnnex may only be called by ${[...approvedAnnexCallers].join(" or ")}; found ${caller ?? "top-level code"}.`
        );
      }
    }

    if (ts.isTemplateExpression(node)) {
      for (const expression of dynamicResourceAttributeExpressions(node)) {
        if (isGovernedAttributeExpression(expression)) continue;
        addFinding(
          findings,
          sourceFile,
          expression,
          "raw-resource-attribute",
          "Do not interpolate href/src attributes directly; use escapeReportAttribute or escapeReportEvidenceUrl."
        );
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (!importsSafetyBoundary) {
    findings.push({
      file: relativeFile,
      line: 1,
      column: 1,
      rule: "missing-safety-boundary",
      message: `HTML generators must import the centralized ${safetyModule} boundary.`,
    });
  } else if (!safetyImports.has("escapeReportText")) {
    findings.push({
      file: relativeFile,
      line: 1,
      column: 1,
      rule: "missing-text-escape",
      message: `${safetyModule} must supply escapeReportText to each HTML generator.`,
    });
  }

  const prohibitedText: Array<[string, RegExp, string]> = [
    [
      "inline-event-handler",
      /\son[a-z]+\s*=/i,
      "Inline event-handler attributes are prohibited in report HTML.",
    ],
    [
      "script-element",
      /<script\b/i,
      "Executable script elements are prohibited in report HTML.",
    ],
    [
      "unsafe-url-scheme",
      /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i,
      "Executable URL schemes are prohibited.",
    ],
    [
      "raw-html-sink",
      /dangerouslySetInnerHTML|\.document\.write\s*\(/,
      "Raw browser HTML sinks are prohibited in report generators.",
    ],
    [
      "false-cryptographic-claim",
      /cryptographic evidence trace/i,
      "A render-input fingerprint must not be described as a cryptographic evidence trace.",
    ],
    [
      "false-frozen-snapshot-claim",
      /inputs, weights, thresholds, and benchmark data are frozen at generation time/i,
      "TR-10 must not claim BR-07 immutable snapshot semantics.",
    ],
    [
      "hardcoded-model-version",
      /Model Version:\s*<\/span>\s*v2\.0\.0|Model Version:\s*v2\.0\.0/i,
      "Render actual model identity rather than the historical hardcoded model label.",
    ],
    [
      "unsafe-markdown-transform",
      /let\s+html\s*=\s*markdown\s*\|\|\s*["']["']|<[a-z]+>\$1<\//i,
      "Markdown must be escaped before the allowlist tokenizer emits markup.",
    ],
  ];

  for (const [rule, pattern, message] of prohibitedText) {
    const match = pattern.exec(source);
    if (!match || match.index === undefined) continue;
    const position = sourceFile.getLineAndCharacterOfPosition(match.index);
    findings.push({
      file: relativeFile,
      line: position.line + 1,
      column: position.character + 1,
      rule,
      message,
    });
  }

  return findings;
}

export function auditReportOutput(): Finding[] {
  return generatorFiles.flatMap(auditGenerator);
}

const findings = auditReportOutput();
if (findings.length > 0) {
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line}:${finding.column} [${finding.rule}] ${finding.message}`
    );
  }
  console.error(
    `Report output audit failed with ${findings.length} finding(s).`
  );
  process.exitCode = 1;
} else {
  console.log(
    `Report output audit passed for ${generatorFiles.length} generator files.`
  );
}
