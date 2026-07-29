import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const AUTHORITATIVE_PATHS = [
  "server/engines/design/material-quantity-engine.ts",
  "server/engines/design/rfq-generator.ts",
  "server/engines/design/ai-design-advisor.ts",
  "server/engines/design-brief.ts",
  "server/engines/report-reconciliation.ts",
  "server/engines/pdf-report.ts",
  "server/engines/docx-brief.ts",
  "server/engines/investor-pdf.ts",
  "server/engines/explainability.ts",
  "server/engines/sustainability/digital-twin.ts",
  "server/routers/materialQuantity.ts",
  "server/routers/design-briefs.ts",
  "server/routers/project.ts",
  "server/routers/predictive.ts",
  "server/routers/learning.ts",
  "server/routers/scenario.ts",
] as const;

const FORBIDDEN = [
  {
    label: "legacy material_library price read",
    pattern: /\.\s*priceAed(?:Min|Mid|Max)\b/g,
  },
  {
    label: "browse-only materials_catalog estimate read",
    pattern: /\.\s*typicalCost(?:Low|High)\b/g,
  },
  {
    label: "sustainability-only material_constants cost read",
    pattern: /\.\s*costPerM2\b/g,
  },
  {
    label: "legacy unscoped category pricing helper",
    pattern: /\bgetLiveCategoryPricing\s*\(/g,
  },
  {
    label: "browse-only catalog estimate helper",
    pattern: /\bgetBrowseOnlyCategoryEstimates\s*\(/g,
  },
] as const;

const violations: string[] = [];
for (const relativePath of AUTHORITATIVE_PATHS) {
  const source = await readFile(path.join(ROOT, relativePath), "utf8");
  for (const rule of FORBIDDEN) {
    for (const match of source.matchAll(rule.pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${relativePath}:${line}: ${rule.label}`);
    }
  }
}

for (const relativePath of [
  "server/routers/predictive.ts",
  "server/routers/learning.ts",
] as const) {
  const source = await readFile(path.join(ROOT, relativePath), "utf8");
  for (const match of source.matchAll(
    /\b(?:listOrganizationEvidenceRecords|listPublicCorpusEvidence)\s*\(/g
  )) {
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(
      `${relativePath}:${line}: raw evidence used as a material-price population`
    );
  }
}

if (violations.length > 0) {
  throw new Error(
    `EV-03 material price authority check failed:\n- ${violations.join("\n- ")}`
  );
}

const rfqSource = await readFile(
  path.join(ROOT, "server/engines/design/rfq-generator.ts"),
  "utf8"
);
const forbiddenRfqRates = [
  /let\s+rateMin\s*=\s*(?:90|1200|2000)\b/,
  /rateMax\s*=\s*(?:120|1800|3500)\b/,
  /priceAed(?:Min|Max)/,
];
if (forbiddenRfqRates.some(pattern => pattern.test(rfqSource))) {
  throw new Error("EV-03 RFQ contains a legacy or hard-coded material rate");
}

const scenarioSource = await readFile(
  path.join(ROOT, "server/routers/scenario.ts"),
  "utf8"
);
if (
  /baseCostPerSqm\s*:[^,\n]*(?:2500|\|\|)/.test(scenarioSource) ||
  /getPricingArea\([^)]*\)\s*\|\|/.test(scenarioSource)
) {
  throw new Error(
    "EV-03 scenario simulation contains a fabricated cost or area fallback"
  );
}

const dbSource = await readFile(path.join(ROOT, "server/db.ts"), "utf8");
const reportBoardStart = dbSource.indexOf(
  "export async function getReportBoardSnapshotForOrg"
);
const reportBoardEnd = dbSource.indexOf(
  "export async function getMaterialBoardById",
  reportBoardStart
);
const reportBoardSource = dbSource.slice(reportBoardStart, reportBoardEnd);
if (
  /typicalCost(?:Low|High)|Number\(row\.cost(?:Low|High)\)|\|\|\s*0/.test(
    reportBoardSource
  )
) {
  throw new Error(
    "EV-03 issued board report snapshot reads or zero-coerces catalog prices"
  );
}

console.log(
  `EV-03 material price authority PASS: ${AUTHORITATIVE_PATHS.length} calculation paths`
);
