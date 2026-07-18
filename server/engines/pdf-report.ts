/**
 * MIYAR PDF Report Generator V2
 * Generates structured HTML report content with V2 Intelligence Layer:
 * - 5-Lens Defensibility Framework
 * - ROI Narrative Engine
 * - Evidence Trace & Watermarking
 * - Three report types: Executive Decision Pack, Design Brief + RFQ, Full Report
 */
import type { ScoreResult, ProjectInputs, SensitivityEntry, ROIResult, ReportType } from "../../shared/miyar-types";
import { randomUUID } from "node:crypto";
import type { ReportLocale } from "../../shared/report-locale";
import type { BoardAnnexBoard, BoardAnnexData } from "./board-annex";
import type { WorkflowSpaceMqiReconciliation } from "./report-reconciliation";
import {
  formatReportDate,
  formatReportDateTime,
  localizeGovernedReportCopy,
  reportCopy,
  reportDocumentMetadata,
  reportLocaleCss,
} from "./report-catalog";
import {
  createRenderFingerprintPayload,
  createReportRenderContext,
  type ReportRenderContext,
} from "./report-render-context";
import {
  escapeReportEvidenceUrl,
  escapeReportText,
  renderReportMarkdown,
} from "./report-safe-output";

const DIMENSION_LABELS: Record<string, string> = {
  sa: "Strategic Alignment",
  ff: "Financial Feasibility",
  mp: "Market Positioning",
  ds: "Differentiation Strength",
  er: "Execution Risk",
};

function statusColor(status: string): string {
  if (status === "validated") return "#4ecdc4";
  if (status === "conditional") return "#f0c674";
  return "#e07a5f";
}

function statusLabel(status: string): string {
  if (status === "validated") return "VALIDATED";
  if (status === "conditional") return "CONDITIONALLY VALIDATED";
  return "NOT VALIDATED";
}

function scoreGrade(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 60) return "Moderate";
  if (score >= 50) return "Weak";
  return "Critical";
}

const REPORT_ARTIFACT_VERSION = "tr10-report-artifact-v1";
const REPORT_RENDERER_VERSION = "pdf-report-html-v3";

function dynamicText(value: unknown): string {
  return `<bdi dir="auto" data-report-dynamic>${escapeReportText(value)}</bdi>`;
}

// ─── HTML Template Helpers ──────────────────────────────────────────────────

function htmlHeader(title: string, subtitle: string, projectName: string, context: ReportRenderContext): string {
  const metadata = reportDocumentMetadata(context.locale);
  return `
<!DOCTYPE html>
<html lang="${metadata.lang}" dir="${metadata.dir}">
<head>
<meta charset="utf-8">
<style>
  ${reportLocaleCss(context.locale)}
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { color: #1a1a2e; line-height: 1.6; font-size: 11px; overflow-wrap: anywhere; }
  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 80vh; text-align: center; }
  .cover h1 { font-size: 28px; color: #0f3460; margin-bottom: 8px; letter-spacing: 1px; }
  .cover h2 { font-size: 16px; color: #4ecdc4; font-weight: 400; margin-bottom: 24px; }
  .cover .project { font-size: 20px; color: #1a1a2e; font-weight: 600; }
  .cover .date { font-size: 12px; color: #666; margin-top: 16px; }
  .cover .logo { font-size: 36px; font-weight: 800; color: #0f3460; letter-spacing: 3px; margin-bottom: 32px; }
  .cover .confidential { font-size: 10px; color: #999; margin-top: 40px; text-transform: uppercase; letter-spacing: 2px; }
  .cover .watermark { font-size: 8px; color: #ccc; margin-top: 8px; font-family: monospace; }
  h2 { font-size: 16px; color: #0f3460; border-bottom: 2px solid #4ecdc4; padding-bottom: 6px; margin: 40px 0 14px; }
  h3 { font-size: 13px; color: #0f3460; margin: 16px 0 8px; }
  h4 { font-size: 12px; color: #0f3460; margin: 14px 0 6px; }
  p { margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10px; }
  .keep-together { break-inside: avoid-page; page-break-inside: avoid; }
  table.keep-together { break-inside: avoid-page; page-break-inside: avoid; }
  th { background: #0f3460; color: #fff; padding: 10px 16px; text-align: left; font-weight: 600; }
  td { padding: 10px 16px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .content-wrapper { max-width: 900px; margin: 0 auto; padding: 0 48px; }
  .brief-list { list-style: disc; padding-inline-start: 24px; margin: 8px 0; }
  .brief-list li { margin-bottom: 4px; font-size: 10px; line-height: 1.5; }
  .color-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
  .color-chip { background: #f4f4f0; border: 1px solid #ddd; border-radius: 20px; padding: 4px 14px; font-size: 11px; color: #333; }
  .boq-bar { height: 8px; border-radius: 4px; background: #4ecdc4; min-width: 4px; }
  .boq-bar-wrap { display: flex; align-items: center; gap: 8px; }
  .phase-header { font-size: 12px; font-weight: 700; color: #0f3460; margin: 14px 0 6px; border-inline-start: 3px solid #4ecdc4; padding-inline-start: 10px; }
  .toc { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px 24px; margin: 24px 0 32px; }
  .toc-title { font-size: 13px; font-weight: 700; color: #0f3460; margin-bottom: 10px; }
  .toc a { color: #0f3460; text-decoration: none; font-size: 11px; display: block; padding: 3px 0; }
  .toc a:hover { color: #4ecdc4; }
  .score-box { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 14px; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #fff; letter-spacing: 1px; }
  .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
  .metric-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .metric-card .value { font-size: 22px; font-weight: 700; color: #0f3460; margin: 4px 0; }
  .metric-card .grade { font-size: 10px; }
  .risk-flag { background: #fff3cd; border-inline-start: 3px solid #f0c674; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .action-item { background: #e8f5e9; border-inline-start: 3px solid #4ecdc4; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .penalty-item { background: #fce4ec; border-inline-start: 3px solid #e07a5f; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .lens-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin: 8px 0; }
  .lens-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .lens-title { font-size: 12px; font-weight: 700; color: #0f3460; }
  .lens-score { font-size: 14px; font-weight: 700; }
  .lens-evidence { font-size: 9px; color: #666; margin-top: 4px; }
  .roi-highlight { background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border: 1px solid #c8e6c9; border-radius: 8px; padding: 16px; margin: 12px 0; text-align: center; }
  .roi-value { font-size: 28px; font-weight: 800; color: #2e7d32; }
  .roi-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .evidence-trace { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px 12px; margin: 8px 0; font-size: 9px; font-family: monospace; color: #666; }
  .report-closing { break-inside: avoid-page; page-break-inside: avoid; }
  .footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #999; text-align: center; break-before: avoid-page; page-break-before: avoid; }
  .section { page-break-inside: avoid; margin-bottom: 28px; }
  .repro-meta { background: #f0f4f8; border: 1px solid #d0d7de; border-radius: 6px; padding: 10px 14px; margin: 16px auto; max-width: 400px; font-size: 9px; color: #444; text-align: left; }
  .repro-meta .label { font-weight: 600; color: #0f3460; display: inline-block; min-width: 120px; }
  .citation-ref { font-size: 8px; color: #0f3460; vertical-align: super; font-weight: 600; cursor: help; }
</style>
</head>
<body>
<div class="cover">
  <div class="logo">MIYAR</div>
  <h1>${escapeReportText(title)}</h1>
  <h2>${escapeReportText(subtitle)}</h2>
  <div class="project">${dynamicText(projectName)}</div>
  <div class="date">${formatReportDate(context.generatedAt, context.locale)}</div>
  <div class="confidential">${reportCopy(context.locale, "confidentialInternalOnly")}</div>
  <div class="watermark">${reportCopy(context.locale, "documentId")}: ${escapeReportText(context.documentId)}</div>
  <div class="repro-meta">
    <div><span class="label">${reportCopy(context.locale, "modelVersion")}:</span> ${escapeReportText(context.modelVersion ?? reportCopy(context.locale, "notAvailable"))}</div>
    <div><span class="label">${reportCopy(context.locale, "benchmarkVersion")}:</span> ${escapeReportText(context.benchmarkVersion ?? reportCopy(context.locale, "notAvailable"))}</div>
    <div><span class="label">${reportCopy(context.locale, "logicVersion")}:</span> ${escapeReportText(context.logicVersion ?? reportCopy(context.locale, "notAvailable"))}</div>
    <div><span class="label">${reportCopy(context.locale, "generatedAt")}:</span> ${escapeReportText(context.generatedAt)}</div>
    <div><span class="label">${reportCopy(context.locale, "documentId")}:</span> ${escapeReportText(context.documentId)}</div>
    <div><span class="label">${reportCopy(context.locale, "renderInputFingerprint")}:</span> ${escapeReportText(context.renderInputFingerprint)}</div>
    <div>${reportCopy(context.locale, "renderInputFingerprintHelp")}</div>
  </div>
</div>
`;
}

export interface ReportEvidenceReference {
  title: string;
  sourceUrl?: string;
  category?: string;
  reliabilityGrade?: string;
  captureDate?: string;
  confidenceStatus: "computed" | "asserted" | "legacy_unknown";
  confidencePolicyVersion?: string;
}

function renderEvidenceReferences(refs: ReportEvidenceReference[] | undefined, locale: ReportLocale): string {
  if (!refs || refs.length === 0) return "";
  const rows = refs.map((r, i) => {
    const gradeColor = r.reliabilityGrade === 'A' ? '#2e7d32' : r.reliabilityGrade === 'B' ? '#f57c00' : '#c62828';
    const sourceUrl = escapeReportEvidenceUrl(r.sourceUrl);
    return `<tr>
    <td><span class="citation-ref">[${i + 1}]</span></td>
    <td>${dynamicText(r.title)}</td>
    <td>${r.category ? dynamicText(r.category) : "\u2014"}</td>
    <td style="color:${gradeColor}; font-weight:600;">${r.reliabilityGrade ? dynamicText(r.reliabilityGrade) : "\u2014"}</td>
    <td>${r.captureDate ? formatReportDate(r.captureDate, locale) : "\u2014"}</td>
    <td>${!r.confidenceStatus || r.confidenceStatus === "legacy_unknown"
      ? reportCopy(locale, "legacyCalculationProvenanceUnavailable")
      : r.confidenceStatus === "asserted"
        ? reportCopy(locale, "operatorAssertedConfidence").replace("{policy}", dynamicText(r.confidencePolicyVersion || "manual-asserted-confidence-v1"))
        : reportCopy(locale, "computedConfidence").replace("{policy}", dynamicText(r.confidencePolicyVersion || "policy unavailable"))}</td>
    <td>${sourceUrl ? `<a href="${sourceUrl}" rel="noopener noreferrer" style="color:#0f3460;">${reportCopy(locale, "evidenceLink")}</a>` : "\u2014"}</td>
  </tr>`;
  }).join("");
  return `
<div class="section">
  <h2>${reportCopy(locale, "evidenceReferences")}</h2>
  <p style="font-size:9px; color:#666; margin-bottom:8px;">${reportCopy(locale, "evidenceReferenceDescription")} ${reportCopy(locale, "evidenceInlineCitationHelp").replace("[n]", '<span class="citation-ref">[n]</span>')}</p>
  <table>
    <tr><th>${reportCopy(locale, "reference")}</th><th>${reportCopy(locale, "title")}</th><th>${reportCopy(locale, "category")}</th><th>${reportCopy(locale, "grade")}</th><th>${reportCopy(locale, "captured")}</th><th>${reportCopy(locale, "confidenceProvenance")}</th><th>${reportCopy(locale, "source")}</th></tr>
    ${rows}
  </table>
  <p style="font-size:8px; color:#999; margin-top:4px;">${reportCopy(locale, "evidenceGradeLegend")}</p>
</div>
`;
}

function renderDisclaimer(locale: ReportLocale): string {
  return `
<div class="section" style="margin-top:24px; padding:12px; background:#fff8e1; border:1px solid #ffe082; border-radius:6px;">
  <h3 style="color:#e65100; font-size:11px; margin-bottom:6px;">${reportCopy(locale, "importantDisclaimer")}</h3>
  <p style="font-size:9px; color:#5d4037; line-height:1.5;">${reportCopy(locale, "disclaimer")}</p>
</div>
`;
}

function htmlFooter(context: ReportRenderContext): string {
  return `
<div class="report-closing">
${renderDisclaimer(context.locale)}
<div class="footer">
  MIYAR Decision Intelligence Platform | ${reportCopy(context.locale, "documentId")}: ${escapeReportText(context.documentId)} | ${reportCopy(context.locale, "generated")}: ${formatReportDate(context.generatedAt, context.locale)}<br>
  ${reportCopy(context.locale, "modelVersion")}: ${escapeReportText(context.modelVersion ?? reportCopy(context.locale, "notAvailable"))} | ${reportCopy(context.locale, "benchmarkVersion")}: ${escapeReportText(context.benchmarkVersion ?? reportCopy(context.locale, "notAvailable"))} | ${reportCopy(context.locale, "logicVersion")}: ${escapeReportText(context.logicVersion ?? reportCopy(context.locale, "notAvailable"))}<br>
  <span style="font-size:8px;">${reportCopy(context.locale, "scoresAdvisory")}</span>
</div>
</div>
</body>
</html>
`;
}

// ─── Executive Summary Section ──────────────────────────────────────────────

function renderExecutiveSummary(scoreResult: ScoreResult): string {
  return `
<div class="section">
  <h2>Executive Summary</h2>
  <div style="text-align: center; margin: 16px 0;">
    <div class="status-badge" style="background: ${statusColor(scoreResult.decisionStatus)};">
      ${statusLabel(scoreResult.decisionStatus)}
    </div>
  </div>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="label">Composite Score</div>
      <div class="value">${scoreResult.compositeScore.toFixed(1)}</div>
      <div class="grade">${scoreGrade(scoreResult.compositeScore)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Risk-Adjusted Score</div>
      <div class="value" style="color: ${statusColor(scoreResult.decisionStatus)};">${scoreResult.rasScore.toFixed(1)}</div>
      <div class="grade">${scoreGrade(scoreResult.rasScore)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Confidence</div>
      <div class="value">${scoreResult.confidenceScore.toFixed(0)}%</div>
      <div class="grade">${scoreResult.confidenceScore >= 75 ? "High" : scoreResult.confidenceScore >= 50 ? "Moderate" : "Low"}</div>
    </div>
  </div>
</div>
`;
}

// ─── Dimension Scores Table ─────────────────────────────────────────────────

function renderDimensionTable(scoreResult: ScoreResult): string {
  const dims = ["sa", "ff", "mp", "ds", "er"] as const;
  const rows = dims.map((d) => {
    const score = scoreResult.dimensions[d];
    const weight = scoreResult.dimensionWeights[d];
    const weighted = score * weight;
    return `<tr>
      <td>${DIMENSION_LABELS[d]}</td>
      <td style="text-align:center; font-weight:700;">${score.toFixed(1)}</td>
      <td style="text-align:center;">${(weight * 100).toFixed(0)}%</td>
      <td style="text-align:center;">${weighted.toFixed(1)}</td>
      <td style="text-align:center;">${scoreGrade(score)}</td>
    </tr>`;
  }).join("");

  return `
<div class="section">
  <h2>Dimension Score Breakdown</h2>
  <table>
    <tr><th>Dimension</th><th>Score (0-100)</th><th>Weight</th><th>Weighted</th><th>Grade</th></tr>
    ${rows}
    <tr style="font-weight:700; background:#f0f4f8;">
      <td>Composite</td>
      <td style="text-align:center;">${scoreResult.compositeScore.toFixed(1)}</td>
      <td style="text-align:center;">100%</td>
      <td style="text-align:center;">${scoreResult.compositeScore.toFixed(1)}</td>
      <td style="text-align:center;">${scoreGrade(scoreResult.compositeScore)}</td>
    </tr>
  </table>
</div>
`;
}

// ─── Risk Assessment ────────────────────────────────────────────────────────

function renderRiskAssessment(scoreResult: ScoreResult): string {
  const penalties = scoreResult.penalties.map((p) =>
    `<div class="penalty-item"><strong>${dynamicText(p.id)}:</strong> ${dynamicText(p.description)} (Effect: ${p.effect > 0 ? "+" : ""}${p.effect.toFixed(1)})</div>`
  ).join("");

  const flags = scoreResult.riskFlags.map((f) =>
    `<div class="risk-flag">${dynamicText(f)}</div>`
  ).join("");

  return `
<div class="section">
  <h2>Risk Assessment</h2>
  <div class="metric-grid" style="grid-template-columns: repeat(2, 1fr);">
    <div class="metric-card">
      <div class="label">Risk Score</div>
      <div class="value" style="color: ${scoreResult.riskScore <= 45 ? "#4ecdc4" : scoreResult.riskScore <= 60 ? "#f0c674" : "#e07a5f"};">${scoreResult.riskScore.toFixed(1)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Penalties Applied</div>
      <div class="value">${scoreResult.penalties.length}</div>
    </div>
  </div>
  ${scoreResult.penalties.length > 0 ? `<h3>Active Penalties</h3>${penalties}` : ""}
  ${scoreResult.riskFlags.length > 0 ? `<h3>Risk Flags</h3>${flags}` : "<p>No risk flags triggered.</p>"}
</div>
`;
}

// ─── Sensitivity Analysis ───────────────────────────────────────────────────

function renderSensitivity(sensitivity: SensitivityEntry[], locale: ReportLocale): string {
  const top = sensitivity.slice(0, 8);
  const rows = top.map((s) => {
    return `<tr>
      <td>${dynamicText(s.variable)}</td>
      <td style="text-align:center;">${Math.abs(s.sensitivity).toFixed(2)}</td>
      <td style="text-align:center;">${s.scoreUp.toFixed(1)}</td>
      <td style="text-align:center;">${s.scoreDown.toFixed(1)}</td>
      <td style="text-align:center;">${(s.scoreUp - s.scoreDown).toFixed(1)}</td>
    </tr>`;
  }).join("");

  return `
<div class="section">
  <h2>${reportCopy(locale, "sensitivityAnalysis")}</h2>
  <p>${reportCopy(locale, "sensitivityIntroduction").replace("{count}", String(top.length))}</p>
  <table>
    <tr><th>Variable</th><th>Sensitivity</th><th>Score (+1)</th><th>Score (-1)</th><th>Range</th></tr>
    ${rows}
  </table>
</div>
`;
}

// ─── Conditional Actions ────────────────────────────────────────────────────

function renderConditionalActions(scoreResult: ScoreResult, locale: ReportLocale): string {
  if (scoreResult.conditionalActions.length === 0) {
    return `<div class="section"><h2>${reportCopy(locale, "recommendedActions")}</h2><p>${reportCopy(locale, "noConditionalActions")}</p></div>`;
  }

  const actions = scoreResult.conditionalActions.map((a) =>
    `<div class="action-item">
      <strong>${reportCopy(locale, "actionTrigger")}</strong> ${dynamicText(a.trigger)}<br>
      <strong>${reportCopy(locale, "actionRecommendation")}</strong> ${dynamicText(a.recommendation)}<br>
      <strong>${reportCopy(locale, "actionVariables")}</strong> ${dynamicText(a.variables.join(", "))}
    </div>`
  ).join("");

  return `
<div class="section">
  <h2>${reportCopy(locale, "recommendedActions")}</h2>
  <p>${reportCopy(locale, "conditionalActionsIdentified").replace("{count}", String(scoreResult.conditionalActions.length))}</p>
  ${actions}
</div>
`;
}

// ─── Input Summary ──────────────────────────────────────────────────────────

function renderInputSummary(inputs: ProjectInputs): string {
  const groups = [
    {
      title: "Context",
      items: [
        ["Typology", inputs.ctx01Typology],
        ["Scale", inputs.ctx02Scale],
        ["Gross Floor Area (sqm)", inputs.ctx03Gfa ? inputs.ctx03Gfa.toLocaleString() : "N/A"],
        ["Interior Fit-out Area (sqm)", inputs.totalFitoutArea ? inputs.totalFitoutArea.toLocaleString() : "N/A"],
        ...(inputs.ctx03Gfa && inputs.totalFitoutArea
          ? [["Fitout Efficiency Ratio", `${Math.round((inputs.totalFitoutArea / inputs.ctx03Gfa) * 100)}%`] as [string, string]]
          : []),
        ["Location", inputs.ctx04Location],
        ["Delivery Horizon", inputs.ctx05Horizon],
        ["City", (inputs as any).city || "Dubai"],
      ],
    },
    {
      title: "Strategy",
      items: [
        ["Brand Clarity", `${inputs.str01BrandClarity}/5`],
        ["Differentiation", `${inputs.str02Differentiation}/5`],
        ["Buyer Maturity", `${inputs.str03BuyerMaturity}/5`],
      ],
    },
    {
      title: "Market",
      items: [
        ["Market Tier", inputs.mkt01Tier],
        ["Competitor Intensity", `${inputs.mkt02Competitor}/5`],
        ["Trend Sensitivity", `${inputs.mkt03Trend}/5`],
      ],
    },
    {
      title: "Financial",
      items: [
        ["Budget Cap (AED/sqm)", inputs.fin01BudgetCap ? inputs.fin01BudgetCap.toLocaleString() : "N/A"],
        ["Flexibility", `${inputs.fin02Flexibility}/5`],
        ["Shock Tolerance", `${inputs.fin03ShockTolerance}/5`],
        ["Sales Premium", `${inputs.fin04SalesPremium}/5`],
      ],
    },
    {
      title: "Design",
      items: [
        ["Style", inputs.des01Style],
        ["Material Level", `${inputs.des02MaterialLevel}/5`],
        ["Complexity", `${inputs.des03Complexity}/5`],
        ["Experience", `${inputs.des04Experience}/5`],
        ["Sustainability", `${inputs.des05Sustainability}/5`],
      ],
    },
    {
      title: "Execution",
      items: [
        ["Supply Chain", `${inputs.exe01SupplyChain}/5`],
        ["Contractor", `${inputs.exe02Contractor}/5`],
        ["Approvals", `${inputs.exe03Approvals}/5`],
        ["QA Maturity", `${inputs.exe04QaMaturity}/5`],
      ],
    },
  ];

  const tables = groups.map((g) => {
    const rows = g.items.map(([k, v]) => `<tr><td style="width:50%;">${escapeReportText(k)}</td><td>${dynamicText(v)}</td></tr>`).join("");
    return `<div class="keep-together"><h3>${escapeReportText(g.title)}</h3><table><tr><th>Parameter</th><th>Value</th></tr>${rows}</table></div>`;
  }).join("");

  return `<div class="section"><h2>Project Input Summary</h2>${tables}</div>`;
}

// ─── Variable Contributions ─────────────────────────────────────────────────

function renderVariableContributions(contributions: Record<string, Record<string, number>>): string {
  const dims = Object.keys(contributions);
  const sections = dims.map((dim) => {
    const vars = contributions[dim];
    const sorted = Object.entries(vars).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const rows = sorted.map(([v, c]) =>
      `<tr><td>${dynamicText(v)}</td><td style="text-align:center; color: ${c >= 0 ? "#4ecdc4" : "#e07a5f"}; font-weight:600;">${c >= 0 ? "+" : ""}${c.toFixed(2)}</td></tr>`
    ).join("");
    return `<h3>${DIMENSION_LABELS[dim] || dim}</h3><table><tr><th>Variable</th><th>Contribution</th></tr>${rows}</table>`;
  }).join("");

  return `<div class="section"><h2>Variable Contribution Analysis</h2><p>How each input variable contributes to each dimension score:</p>${sections}</div>`;
}

// ─── V2: ROI Narrative Engine Section ───────────────────────────────────────

function renderROINarrative(roi: any, locale: ReportLocale): string {
  if (!roi) return "";

  const totalValue = roi.totalCostAvoided?.mid || roi.totalCostAvoided?.base || roi.totalValue || roi.totalValueCreated || 0;
  // Calculate a mock ROI multiple just for presentation, assuming a generic project cost of 1M if budgetCap is missing
  // or based on total saved. If there is no real roiMultiple provided by the engine.
  const roiMultiple = roi.roiMultiple || (totalValue > 0 ? (totalValue / 150000) : 0);

  const drivers = roi.drivers || roi.components || Object.entries(roi).filter(([k, v]) => typeof v === 'number' && k !== 'totalValue' && k !== 'roiMultiple' && k !== 'fee' && k !== 'netROI').map(([name, value]) => ({ name, value })) || [];

  return `
<div class="section">
  <h2>ROI & Economic Impact Analysis</h2>
  
  <div class="roi-highlight">
    <div class="roi-label">Total Value Created</div>
    <div class="roi-value">AED ${Number(totalValue).toLocaleString()}</div>
    <div style="font-size:10px; color:#666; margin-top:4px;">ROI Multiple: ${Number(roiMultiple).toFixed(1)}x</div>
  </div>
  <p class="fallback" style="font-size:9px;">${reportCopy(locale, "roiNarrativeFallbackDenominator")}</p>

  <h3>Value Breakdown</h3>
  <table>
    <tr><th>Value Component</th><th>Conservative</th><th>Base</th><th>Aggressive</th></tr>
    ${drivers.length > 0 ? drivers.map((c: any) => `
    <tr>
      <td><strong>${dynamicText(c.name)}</strong><br><span style="font-size:9px; color:#666;">${dynamicText(c.description || c.narrative || "")}</span></td>
      <td style="text-align:right;">AED ${Number(c.costAvoided?.conservative || c.conservative || (c.value ? c.value * 0.8 : 0)).toLocaleString()}</td>
      <td style="text-align:right; font-weight:600;">AED ${Number(c.costAvoided?.mid || c.base || c.value || 0).toLocaleString()}</td>
      <td style="text-align:right;">AED ${Number(c.costAvoided?.aggressive || c.aggressive || (c.value ? c.value * 1.2 : 0)).toLocaleString()}</td>
    </tr>`).join("") : `
    <tr><td>Rework Avoided</td><td style="text-align:right;" colspan="3">AED ${Number(roi.reworkAvoided || 0).toLocaleString()}</td></tr>
    <tr><td>Procurement Savings</td><td style="text-align:right;" colspan="3">AED ${Number(roi.procurementSavings || 0).toLocaleString()}</td></tr>
    <tr><td>Time-Value Gain</td><td style="text-align:right;" colspan="3">AED ${Number(roi.timeValueGain || 0).toLocaleString()}</td></tr>
    <tr><td>Spec Efficiency</td><td style="text-align:right;" colspan="3">AED ${Number(roi.specEfficiency || 0).toLocaleString()}</td></tr>
    <tr><td>Positioning Premium</td><td style="text-align:right;" colspan="3">AED ${Number(roi.positioningPremium || 0).toLocaleString()}</td></tr>
    `}
  </table>

  ${roi.narrative ? `
  <h3>Executive Narrative</h3>
  <p style="font-size:10px; line-height:1.6;">${dynamicText(roi.narrative)}</p>
  ` : ""}

  ${roi.assumptions ? `
  <h3>Key Assumptions</h3>
  <ul style="font-size:9px; color:#666; padding-left:16px;">
    ${roi.assumptions.map((a: string) => `<li>${dynamicText(a)}</li>`).join("")}
  </ul>
  ` : `
  <p style="margin-top:12px; font-size:10px; color:#666;">
    <em>Assumptions: Rework avoidance based on industry benchmarks (15-25% of construction cost for misaligned projects). 
    Procurement savings estimated at 3-8% through validated specifications. Time-value calculated using standard cost-of-capital models.</em>
  </p>
  `}
</div>
`;
}

// ─── V2: 5-Lens Defensibility Framework ─────────────────────────────────────

function renderFiveLens(fiveLens: any): string {
  if (!fiveLens) return "";

  const LENS_ICONS: Record<string, string> = {
    "Market Fit Lens": "📊",
    "Cost Discipline Lens": "💰",
    "Brand/Vision Alignment Lens": "🎨",
    "Procurement Feasibility Lens": "⚙️",
    "Differentiation Lens": "🎯",
  };

  const lensCards = (fiveLens.lenses || []).map((lens: any) => {
    const color = lens.score >= 70 ? "#4ecdc4" : lens.score >= 50 ? "#f0c674" : "#e07a5f";
    const icon = LENS_ICONS[lens.lensName] || "🔍";
    return `
    <div class="lens-card">
      <div class="lens-header">
        <div class="lens-title">${escapeReportText(icon)} ${dynamicText(lens.lensName)}</div>
        <div class="lens-score" style="color:${color};">${(lens.score || 0).toFixed(0)}/100</div>
      </div>
      <p style="font-size:10px; margin-bottom:6px;">${dynamicText(lens.rationale || "")}</p>
      ${lens.evidence && lens.evidence.length > 0 ? `
      <div class="lens-evidence">
        <strong>Evidence:</strong> ${dynamicText(lens.evidence.slice(0, 3).map((e: any) => typeof e === 'string' ? e : (e.label && e.value ? `${e.label}: ${e.value}` : JSON.stringify(e))).join(" • "))}
      </div>
      ` : ""}
      ${lens.gaps && lens.gaps.length > 0 ? `
      <div style="font-size:9px; color:#e07a5f; margin-top:4px;">
        <strong>Gaps:</strong> ${dynamicText(lens.gaps.slice(0, 2).join(" • "))}
      </div>
      ` : ""}
    </div>`;
  }).join("");

  return `
<div class="section">
  <h2>5-Lens Defensibility Framework</h2>
  <div class="metric-grid" style="grid-template-columns: repeat(2, 1fr);">
    <div class="metric-card">
      <div class="label">Overall Defensibility</div>
      <div class="value" style="color: ${fiveLens.overallScore >= 70 ? "#4ecdc4" : fiveLens.overallScore >= 50 ? "#f0c674" : "#e07a5f"};">
        ${fiveLens.overallScore.toFixed(0)}
      </div>
      <div class="grade">${dynamicText(fiveLens.overallVerdict || scoreGrade(fiveLens.overallScore))}</div>
    </div>
    <div class="metric-card">
      <div class="label">Weakest Lens</div>
      <div class="value" style="font-size:14px; color:#e07a5f;">${dynamicText(fiveLens.weakestLens || "—")}</div>
      <div class="grade">Priority improvement area</div>
    </div>
  </div>
  ${lensCards}
</div>
`;
}

// ─── V2: Evidence Trace ─────────────────────────────────────────────────────

function renderEvidenceTrace(projectId: number, context: ReportRenderContext): string {
  return `
<div class="section">
  <h2>${reportCopy(context.locale, "evidenceTrace")}</h2>
  <div class="evidence-trace">
    ${reportCopy(context.locale, "documentId")}: ${escapeReportText(context.documentId)}<br>
    Project ID: ${projectId}<br>
    ${reportCopy(context.locale, "benchmarkVersion")}: ${escapeReportText(context.benchmarkVersion ?? reportCopy(context.locale, "notAvailable"))}<br>
    ${reportCopy(context.locale, "logicVersion")}: ${escapeReportText(context.logicVersion ?? reportCopy(context.locale, "notAvailable"))}<br>
    ${reportCopy(context.locale, "modelVersion")}: ${escapeReportText(context.modelVersion ?? reportCopy(context.locale, "notAvailable"))}<br>
    ${reportCopy(context.locale, "generatedAt")}: ${escapeReportText(context.generatedAt)}<br>
    ${reportCopy(context.locale, "artifactVersion")}: ${escapeReportText(context.artifactVersion)}<br>
    ${reportCopy(context.locale, "rendererVersion")}: ${escapeReportText(context.rendererVersion)}<br>
    ${reportCopy(context.locale, "renderInputFingerprint")}: ${escapeReportText(context.renderInputFingerprint)}
  </div>
  <p style="font-size:9px; color:#666; margin-top:8px;">${reportCopy(context.locale, "renderInputFingerprintHelp")}</p>
</div>
`;
}

// ─── Legacy ROI Section (backward compat) ───────────────────────────────────

function renderROI(roi: ROIResult, locale: ReportLocale): string {
  return `
<div class="section">
  <h2>${locale === "ar" ? "تحليل العائد على الاستثمار والأثر الاقتصادي" : "ROI & Economic Impact Analysis"}</h2>
  <div class="roi-highlight">
    <div class="roi-label">Total Value Created</div>
    <div class="roi-value">AED ${roi.totalValue.toLocaleString()}</div>
    <div style="font-size:10px; color:#666; margin-top:4px;">ROI Multiple: ${roi.roiMultiple.toFixed(1)}x</div>
  </div>
  <table>
    <tr><th>${locale === "ar" ? "مكوّن القيمة" : "Value Component"}</th><th>${reportCopy(locale, "amountAed")}</th></tr>
    <tr><td>Rework Avoided</td><td style="text-align:right;">${roi.reworkAvoided.toLocaleString()}</td></tr>
    <tr><td>Procurement Savings</td><td style="text-align:right;">${roi.procurementSavings.toLocaleString()}</td></tr>
    <tr><td>Time-Value Gain</td><td style="text-align:right;">${roi.timeValueGain.toLocaleString()}</td></tr>
    <tr><td>Spec Efficiency</td><td style="text-align:right;">${roi.specEfficiency.toLocaleString()}</td></tr>
    <tr><td>Positioning Premium</td><td style="text-align:right;">${roi.positioningPremium.toLocaleString()}</td></tr>
    <tr style="font-weight:700; background:#e8f5e9;"><td>Total Value Created</td><td style="text-align:right;">${roi.totalValue.toLocaleString()}</td></tr>
    <tr><td>MIYAR Fee</td><td style="text-align:right;">(${roi.fee.toLocaleString()})</td></tr>
    <tr style="font-weight:700; background:#f0f4f8;"><td>Net ROI</td><td style="text-align:right;">${roi.netROI.toLocaleString()}</td></tr>
    <tr style="font-weight:700;"><td>ROI Multiple</td><td style="text-align:right;">${roi.roiMultiple.toFixed(1)}x</td></tr>
  </table>
</div>
`;
}

// ─── Board Annex ────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return escapeReportText(value);
}

function renderBoardResolutionMessage(board: BoardAnnexBoard, locale: ReportLocale): string {
  const copy = (key: "boardEmptyResolution" | "boardUnresolvableResolution" | "boardPartialResolution" | "boardCompleteSingleResolution" | "boardCompleteMultipleResolution") => reportCopy(locale, key);
  if (board.state === "empty") {
    return copy("boardEmptyResolution");
  }
  if (board.state === "unresolvable") {
    return copy("boardUnresolvableResolution").replace("{linked}", String(board.linkedItemCount));
  }
  if (board.state === "partial") {
    return copy("boardPartialResolution")
      .replace("{resolved}", String(board.resolvedItemCount))
      .replace("{linked}", String(board.linkedItemCount))
      .replace("{unresolved}", String(board.unresolvedItemCount))
      .replace("{itemStatus}", reportCopy(locale, board.unresolvedItemCount === 1 ? "boardItemIs" : "boardItemsAre"));
  }
  return board.linkedItemCount === 1
    ? copy("boardCompleteSingleResolution")
    : copy("boardCompleteMultipleResolution").replace("{linked}", String(board.linkedItemCount));
}

function renderBoardCard(board: BoardAnnexBoard, locale: ReportLocale): string {
  const stateColor = board.state === "complete"
    ? "#166534"
    : board.state === "partial"
      ? "#92400e"
      : "#991b1b";
  const summary = "summary" in board ? board.summary : undefined;

  const summaryHtml = summary
    ? (() => {
        const tierRows = Object.entries(summary.tierDistribution).map(([tier, count]) =>
          `<span style="display:inline-block; margin-right:8px; font-size:9px;"><strong>${dynamicText(tier.replaceAll("_", " "))}:</strong> ${count}</span>`
        ).join("");
        const criticalItems = summary.criticalPathItems;

        return `
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:8px;">
        <div style="text-align:center;">
          <div style="font-size:8px; color:#666; text-transform:uppercase;">${reportCopy(locale, "resolvedItemCostRange")}</div>
          <div style="font-size:12px; font-weight:700; color:#0f3460;">${summary.estimatedCostLow.toLocaleString()} – ${summary.estimatedCostHigh.toLocaleString()} ${escapeHtml(summary.currency)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:8px; color:#666; text-transform:uppercase;">${reportCopy(locale, "resolvedItemLongestLead")}</div>
          <div style="font-size:12px; font-weight:700; color:#0f3460;">${summary.longestLeadTimeDays}d</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:8px; color:#666; text-transform:uppercase;">${reportCopy(locale, "resolvedCriticalItems")}</div>
          <div style="font-size:12px; font-weight:700; color:${summary.criticalPathItems.length > 0 ? "#dc2626" : "#16a34a"};">${summary.criticalPathItems.length}</div>
        </div>
      </div>
      <div style="font-size:9px; color:#444;">${tierRows}</div>
      ${criticalItems.length > 0 ? `<div style="margin-top:6px;"><span style="font-size:9px; color:#dc2626; font-weight:600;">${locale === "ar" ? "حرج:" : "Critical:"}</span> <span style="font-size:9px; color:#666;">${criticalItems.map(dynamicText).join(", ")}</span></div>` : ""}`;
      })()
    : "";

  return `
    <div style="border:1px solid #e0e0e0; border-radius:6px; padding:12px; margin:8px 0; page-break-inside:avoid;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:700; color:#0f3460;">${dynamicText(board.boardName)}</span>
        <span style="font-size:10px; color:#666;">${reportCopy(locale, "boardResolvedCount").replace("{resolved}", String(board.resolvedItemCount)).replace("{linked}", String(board.linkedItemCount))}</span>
      </div>
      <div style="font-size:9px; color:${stateColor}; margin-bottom:${summary ? "8px" : "0"};">${renderBoardResolutionMessage(board, locale)}</div>
      ${summaryHtml}
    </div>`;
}

function renderBoardAnnex(boardAnnex: BoardAnnexData, locale: ReportLocale): string {
  if (boardAnnex.state === "no_boards") {
    return `
<div class="section">
  <h2>${reportCopy(locale, "materialBoardAnnex")}</h2>
  <p style="font-size:10px; color:#666;">${reportCopy(locale, "noMaterialBoards")}</p>
</div>
`;
  }

  const boardCards = boardAnnex.boards.map(board => renderBoardCard(board, locale)).join("");

  return `
<div class="section">
  <h2>${reportCopy(locale, "materialBoardAnnex")}</h2>
  <p style="font-size:10px; color:#666; margin-bottom:8px;">${reportCopy(locale, "materialBoardAnnexDescription")}</p>
  ${boardCards}
</div>
`;
}

function renderWorkflowReconciliation(
  reconciliation: WorkflowSpaceMqiReconciliation,
  locale: ReportLocale
): string {
  const isArabic = locale === "ar";
  const copy = isArabic
    ? {
        heading: "مطابقة سير العمل والمساحات وكميات المواد",
        description:
          "مطابقة حتمية للبيانات المخزنة في المشروع وبرنامج المساحات وتخصيصات المواد وأسعار مكتبة المواد.",
        projectFitOut: "مساحة التجهيز في المشروع",
        roomFitOut: "إجمالي غرف التجهيز",
        variance: "فرق المساحة",
        unavailable: "غير متاح",
        pass: "مطابق",
        fail: "غير مطابق",
        rooms: "الغرف المخزنة / غرف التجهيز / الغرف اليدوية",
        allocationCount: "صفوف / مجموعات التخصيص",
        locked: "صفوف / مجموعات التخصيص المقفلة",
        surfaces: "إجماليات المساحات الحتمية",
        surface: "السطح",
        area: "المساحة (م²)",
        floor: "الأرضيات",
        walls: "الجدران",
        ceiling: "الأسقف",
        total: "الإجمالي",
        formula: "صيغة الحساب",
        height: "ارتفاع السقف",
        allocationChecks: "فحوص مجموعات التخصيص بنسبة 100%",
        room: "الغرفة",
        element: "العنصر",
        allocationTotal: "إجمالي التخصيص",
        storedSurface: "المساحة المخزنة / المتوقعة",
        allocationCheck: "فحص النسبة",
        surfaceCheck: "فحص المساحة",
        check: "الفحص",
        noGroups: "لا توجد مجموعات تخصيص مخزنة.",
        allGroups: "جميع المجموعات بنسبة 100%",
        allSurfaces: "جميع المساحات مطابقة للصيغة",
        costs: "تكلفة المواد من مكتبة المواد",
        minimum: "الحد الأدنى",
        midpoint: "المتوسط",
        maximum: "الحد الأعلى",
        priceCoverage: "تغطية الأسعار",
        unpriced: "غير مسعّر",
        source: "المصدر",
        sourceTables: "جداول المصدر",
      }
    : {
        heading: "Workflow, Space & MQI Reconciliation",
        description:
          "Deterministic reconciliation of stored project, space-programme, material-allocation, and material-library values.",
        projectFitOut: "Project fit-out area",
        roomFitOut: "Fit-out room total",
        variance: "Area variance",
        unavailable: "Unavailable",
        pass: "PASS",
        fail: "FAIL",
        rooms: "Stored / fit-out / manual rooms",
        allocationCount: "Allocation rows / groups",
        locked: "Locked allocation rows / groups",
        surfaces: "Deterministic surface totals",
        surface: "Surface",
        area: "Area (m²)",
        floor: "Floor",
        walls: "Walls",
        ceiling: "Ceiling",
        total: "Total",
        formula: "Formula",
        height: "Ceiling height",
        allocationChecks: "Allocation-group 100% checks",
        room: "Room",
        element: "Element",
        allocationTotal: "Allocation total",
        storedSurface: "Stored / expected surface",
        allocationCheck: "Allocation check",
        surfaceCheck: "Surface check",
        check: "Check",
        noGroups: "No stored allocation groups.",
        allGroups: "All groups at 100%",
        allSurfaces: "All surfaces match formula",
        costs: "Material-library cost reconciliation",
        minimum: "Minimum",
        midpoint: "Midpoint",
        maximum: "Maximum",
        priceCoverage: "Price coverage",
        unpriced: "unpriced",
        source: "Source",
        sourceTables: "Source tables",
      };
  const number = (value: number) =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const areaStatus =
    reconciliation.spaceProgram.reconciles === null
      ? copy.unavailable
      : reconciliation.spaceProgram.reconciles
        ? copy.pass
        : copy.fail;
  const allocationRows = reconciliation.allocations.groups
    .map(
      group => `
    <tr>
      <td>${dynamicText(group.roomName)} <span style="color:#777;">(${dynamicText(group.roomId)})</span></td>
      <td>${dynamicText(group.element)}</td>
      <td style="text-align:right;">${number(group.allocationPctTotal)}%</td>
      <td style="text-align:right; color:${group.surfaceReconciles ? "#2e7d32" : "#c62828"};">${number(group.surfaceAreaM2Total)} / ${group.expectedSurfaceAreaM2 === null ? copy.unavailable : number(group.expectedSurfaceAreaM2)} m²</td>
      <td style="font-weight:700; color:${group.passes100Pct ? "#2e7d32" : "#c62828"};">${group.passes100Pct ? copy.pass : copy.fail}</td>
      <td style="font-weight:700; color:${group.surfaceReconciles ? "#2e7d32" : "#c62828"};">${group.surfaceReconciles ? copy.pass : copy.fail}</td>
    </tr>`
    )
    .join("");
  const projectArea = reconciliation.spaceProgram.projectFitOutAreaM2;
  const variance = reconciliation.spaceProgram.varianceM2;

  return `
<div class="section" id="sec-workflow-reconciliation" style="page-break-inside:auto;">
  <h2>${copy.heading}</h2>
  <p style="font-size:9px; color:#666;">${copy.description}</p>
  <div class="metric-grid">
    <div class="metric-card"><div class="label">${copy.projectFitOut}</div><div class="value" style="font-size:18px;">${projectArea === null ? copy.unavailable : `${number(projectArea)} m²`}</div></div>
    <div class="metric-card"><div class="label">${copy.roomFitOut}</div><div class="value" style="font-size:18px;">${number(reconciliation.spaceProgram.fitOutRoomAreaM2)} m²</div></div>
    <div class="metric-card"><div class="label">${copy.variance}</div><div class="value" style="font-size:18px; color:${reconciliation.spaceProgram.reconciles === false ? "#c62828" : "#2e7d32"};">${variance === null ? copy.unavailable : `${number(variance)} m² · ${areaStatus}`}</div></div>
  </div>
  <table class="keep-together">
    <tr><th>${copy.rooms}</th><th>${copy.allocationCount}</th><th>${copy.locked}</th><th>${copy.allGroups}</th><th>${copy.allSurfaces}</th></tr>
    <tr>
      <td>${reconciliation.spaceProgram.storedRoomCount} / ${reconciliation.spaceProgram.fitOutRoomCount} / ${reconciliation.spaceProgram.manualRoomCount}</td>
      <td>${reconciliation.allocations.rowCount} / ${reconciliation.allocations.groupCount}</td>
      <td>${reconciliation.allocations.lockedRowCount} / ${reconciliation.allocations.lockedGroupCount}</td>
      <td style="font-weight:700; color:${reconciliation.allocations.allGroupsPass100Pct ? "#2e7d32" : "#c62828"};">${reconciliation.allocations.allGroupsPass100Pct ? copy.pass : copy.fail}</td>
      <td style="font-weight:700; color:${reconciliation.allocations.allGroupsSurfaceReconcile ? "#2e7d32" : "#c62828"};">${reconciliation.allocations.allGroupsSurfaceReconcile ? copy.pass : copy.fail}</td>
    </tr>
  </table>

  <h3>${copy.surfaces}</h3>
  <p style="font-size:9px; color:#666;">${copy.formula}: ${dynamicText(reconciliation.surfaces.formulaVersion)} · ${copy.height}: ${number(reconciliation.surfaces.ceilingHeightM)} m</p>
  <table>
    <tr><th>${copy.surface}</th><th style="text-align:right;">${copy.area}</th></tr>
    <tr><td>${copy.floor}</td><td style="text-align:right;">${number(reconciliation.surfaces.floorM2)}</td></tr>
    <tr><td>${copy.walls}</td><td style="text-align:right;">${number(reconciliation.surfaces.wallsM2)}</td></tr>
    <tr><td>${copy.ceiling}</td><td style="text-align:right;">${number(reconciliation.surfaces.ceilingM2)}</td></tr>
    <tr style="font-weight:700; background:#f0f4f8;"><td>${copy.total}</td><td style="text-align:right;">${number(reconciliation.surfaces.totalM2)}</td></tr>
  </table>

  <h3>${copy.allocationChecks}</h3>
  ${allocationRows ? `<table><tr><th>${copy.room}</th><th>${copy.element}</th><th style="text-align:right;">${copy.allocationTotal}</th><th style="text-align:right;">${copy.storedSurface}</th><th>${copy.allocationCheck}</th><th>${copy.surfaceCheck}</th></tr>${allocationRows}</table>` : `<p>${copy.noGroups}</p>`}

  <h3>${copy.costs}</h3>
  <table>
    <tr><th>${copy.minimum}</th><th>${copy.midpoint}</th><th>${copy.maximum}</th><th>${copy.priceCoverage}</th></tr>
    <tr>
      <td>${reconciliation.materialCosts.currency} ${number(reconciliation.materialCosts.min)}</td>
      <td>${reconciliation.materialCosts.currency} ${number(reconciliation.materialCosts.mid)}</td>
      <td>${reconciliation.materialCosts.currency} ${number(reconciliation.materialCosts.max)}</td>
      <td>${reconciliation.materialCosts.pricedAllocationCount}/${reconciliation.allocations.rowCount} · ${reconciliation.materialCosts.unpricedAllocationCount} ${copy.unpriced} · ${reconciliation.materialCosts.allAllocationsPriced ? copy.pass : copy.fail}</td>
    </tr>
  </table>
  <p style="font-size:8px; color:#777;">${copy.source}: ${dynamicText(reconciliation.materialCosts.source)} · ${copy.sourceTables}: ${dynamicText(reconciliation.sourceTables.join(", "))} · ${dynamicText(reconciliation.version)}</p>
</div>
`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface PDFReportInput {
  projectName: string;
  projectId: number;
  inputs: ProjectInputs;
  scoreResult: ScoreResult;
  sensitivity: SensitivityEntry[];
  roi?: ROIResult;
  scenarioComparison?: any[];
  fiveLens?: any;
  roiNarrative?: any;
  designBrief?: any;
  benchmarkVersion?: string;
  logicVersion?: string;
  modelVersion?: string;
  locale?: ReportLocale;
  renderContext?: ReportRenderContext;
  evidenceRefs?: ReportEvidenceReference[];
  boardAnnex?: BoardAnnexData;
  workflowReconciliation?: WorkflowSpaceMqiReconciliation;
  autonomousContent?: string;
}

export type IssuedPDFReportInput = PDFReportInput & { boardAnnex: BoardAnnexData };

export interface ReportRenderContextOverrides {
  documentId?: string;
  generatedAt?: Date | string;
  locale?: ReportLocale;
  artifactVersion?: string;
  rendererVersion?: string;
  modelVersion?: string | null;
  benchmarkVersion?: string | null;
  logicVersion?: string | null;
}

function scoreFingerprint(score: ScoreResult, includeContributions: boolean) {
  return {
    dimensions: score.dimensions,
    dimensionWeights: score.dimensionWeights,
    compositeScore: score.compositeScore,
    riskScore: score.riskScore,
    rasScore: score.rasScore,
    confidenceScore: score.confidenceScore,
    decisionStatus: score.decisionStatus,
    penalties: score.penalties,
    riskFlags: score.riskFlags,
    conditionalActions: score.conditionalActions,
    ...(includeContributions ? { variableContributions: score.variableContributions } : {}),
  };
}

function renderedEvidenceReferences(refs: ReportEvidenceReference[] | undefined) {
  return refs?.map(ref => ({
    title: ref.title,
    sourceUrl: ref.sourceUrl,
    category: ref.category,
    reliabilityGrade: ref.reliabilityGrade,
    captureDate: ref.captureDate,
    confidenceStatus: ref.confidenceStatus,
    confidencePolicyVersion: ref.confidencePolicyVersion,
  }));
}

function pdfFingerprintRenderedValues(
  reportType: string,
  data: PDFReportInput | ScenarioComparisonPDFInput | PortfolioPDFInput,
) {
  if (reportType === "scenario_comparison") {
    const scenario = data as ScenarioComparisonPDFInput;
    return {
      project: { id: scenario.projectId, name: scenario.projectName },
      baselineScenario: scenario.baselineScenario,
      comparedScenarios: scenario.comparedScenarios,
      decisionNote: scenario.decisionNote,
    };
  }
  if (reportType === "portfolio") {
    const portfolio = data as PortfolioPDFInput;
    return {
      portfolio: {
        id: portfolio.portfolioId,
        name: portfolio.portfolioName,
        description: portfolio.description,
        totalProjects: portfolio.totalProjects,
        scoredCount: portfolio.scoredCount,
        avgComposite: portfolio.avgComposite,
        avgRisk: portfolio.avgRisk,
        projects: portfolio.projects,
        distributions: portfolio.distributions,
        failurePatterns: portfolio.failurePatterns,
        improvementLevers: portfolio.improvementLevers,
        complianceHeatmap: portfolio.complianceHeatmap,
      },
    };
  }

  const report = data as PDFReportInput;
  const common = {
    project: { id: report.projectId, name: report.projectName },
  };
  if (reportType === "autonomous_design_brief") {
    return { ...common, autonomousContent: report.autonomousContent, evidenceReferences: renderedEvidenceReferences(report.evidenceRefs) };
  }
  if (reportType === "design_brief") {
    return { ...common, designBrief: report.designBrief, boardAnnex: report.boardAnnex, evidenceReferences: renderedEvidenceReferences(report.evidenceRefs) };
  }
  if (reportType === "full_report") {
    return {
      ...common,
      inputs: report.inputs,
      score: scoreFingerprint(report.scoreResult, true),
      sensitivity: report.sensitivity,
      fiveLens: report.fiveLens,
      roiNarrative: report.roiNarrative,
      roi: report.roiNarrative ? undefined : report.roi,
      boardAnnex: report.boardAnnex,
      workflowReconciliation: report.workflowReconciliation,
      evidenceReferences: renderedEvidenceReferences(report.evidenceRefs),
    };
  }
  return {
    ...common,
    inputs: report.inputs,
    score: scoreFingerprint(report.scoreResult, false),
    sensitivity: report.sensitivity,
    fiveLens: report.fiveLens,
    evidenceReferences: renderedEvidenceReferences(report.evidenceRefs),
  };
}

/** Builds the generic HTML report context from the values that the selected surface renders. */
export function createPdfReportRenderContext(
  reportType: string,
  data: PDFReportInput | ScenarioComparisonPDFInput | PortfolioPDFInput,
  overrides: ReportRenderContextOverrides = {},
): ReportRenderContext {
  const locale = overrides.locale ?? data.locale ?? "en";
  const labels = {
    artifactVersion: overrides.artifactVersion ?? REPORT_ARTIFACT_VERSION,
    rendererVersion: overrides.rendererVersion ?? REPORT_RENDERER_VERSION,
    modelVersion: overrides.modelVersion ?? data.modelVersion ?? null,
    benchmarkVersion: overrides.benchmarkVersion ?? data.benchmarkVersion ?? null,
    logicVersion: overrides.logicVersion ?? data.logicVersion ?? null,
  };
  const prefix = reportType === "scenario_comparison" ? "SCE"
    : reportType === "portfolio" ? "PFL"
      : reportType.toUpperCase().slice(0, 3);
  const subjectId = "projectId" in data ? data.projectId : data.portfolioId;
  return createReportRenderContext({
    documentId: overrides.documentId ?? `MYR-${prefix}-${subjectId}-${randomUUID()}`,
    generatedAt: overrides.generatedAt,
    locale,
    ...labels,
    fingerprintInput: createRenderFingerprintPayload(reportType, locale, labels, pdfFingerprintRenderedValues(reportType, data)),
  });
}

function resolveReportContext(
  reportType: string,
  data: PDFReportInput | ScenarioComparisonPDFInput | PortfolioPDFInput,
): ReportRenderContext {
  if (data.renderContext) return data.renderContext;
  return createPdfReportRenderContext(reportType, data);
}

function finalizeReportHtml(html: string, context: ReportRenderContext): string {
  return localizeGovernedReportCopy(html, context.locale);
}

export function generateAutonomousBriefHTML(data: PDFReportInput): string {
  const context = resolveReportContext("autonomous_design_brief", data);
  const contentHtml = `<div class="section markdown-body">${renderReportMarkdown(data.autonomousContent || reportCopy(context.locale, "noContentGenerated"))}</div>`;
  return finalizeReportHtml([
    htmlHeader("Autonomous Design Brief", "AI-Generated Concept & Technical Specification", data.projectName, context),
    contentHtml,
    renderEvidenceTrace(data.projectId, context),
    htmlFooter(context),
  ].join(""), context);
}

export function generateValidationSummaryHTML(data: PDFReportInput): string {
  const context = resolveReportContext("validation_summary", data);
  return finalizeReportHtml([
    htmlHeader("Executive Decision Pack", "Interior Design Direction Assessment", data.projectName, context),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderRiskAssessment(data.scoreResult),
    renderSensitivity(data.sensitivity, context.locale),
    renderConditionalActions(data.scoreResult, context.locale),
    data.fiveLens ? renderFiveLens(data.fiveLens) : "",
    renderEvidenceReferences(data.evidenceRefs, context.locale),
    renderEvidenceTrace(data.projectId, context),
    renderInputSummary(data.inputs),
    htmlFooter(context),
  ].join("\n"), context);
}

function renderDesignBrief(brief: any): string {
  if (!brief) return "<div class='section'><p>No Design Brief data available.</p></div>";

  const narrative = brief.designNarrative || {};
  const materials = brief.materialSpecifications || {};
  const boq = brief.boqFramework || { coreAllocations: [] };
  const budget = brief.detailedBudget || {};
  const instructions = brief.designerInstructions || { phasedDeliverables: {} };

  // Color palette chips
  const colorChips = (narrative.colorPalette || []).map((c: string) =>
    `<span class="color-chip">${dynamicText(c)}</span>`
  ).join("");

  // BOQ rows with visual percentage bars
  const boqRows = (boq.coreAllocations || []).map((b: any) => {
    const rawPct = Number(b.percentage);
    const pct = Number.isFinite(rawPct) ? Math.max(0, Math.min(100, rawPct)) : 0;
    return `
    <tr>
      <td>${dynamicText(b.category || "—")}</td>
      <td>
        <div class="boq-bar-wrap">
          <div class="boq-bar" style="width:${pct}%;"></div>
          <span>${pct}%</span>
        </div>
      </td>
      <td style="text-align:right;">${dynamicText(b.estimatedCostLabel || "—")}</td>
      <td><span style="font-size: 10px; color: #666;">${dynamicText(b.notes || "—")}</span></td>
    </tr>
  `;
  }).join("");

  // Table of Contents
  const toc = `
  <div class="toc">
    <div class="toc-title">Table of Contents</div>
    <a href="#sec-narrative">1. Design Narrative & Positioning</a>
    <a href="#sec-materials">2. Material Specifications</a>
    <a href="#sec-boq">3. Target BOQ Framework</a>
    <a href="#sec-budget">4. Detailed Budget Guardrails</a>
    <a href="#sec-workflow">5. Workflow & Execution Instructions</a>
    <a href="#sec-deliverables">6. Phased Deliverables</a>
  </div>`;

  return `
${toc}

<div class="section">
  <h2 id="sec-narrative">Design Narrative &amp; Positioning</h2>
  <p>${dynamicText(narrative.positioningStatement || "—")}</p>
  <table>
    <tr><th width="30%">Parameter</th><th>Value</th></tr>
    <tr><td style="font-weight:bold;">Primary Style</td><td>${dynamicText(narrative.primaryStyle || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Mood Keywords</td><td>${dynamicText((narrative.moodKeywords || []).join(", ") || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Color Palette</td><td><div class="color-chips">${colorChips || "—"}</div></td></tr>
    <tr><td style="font-weight:bold;">Texture Direction</td><td>${dynamicText(narrative.textureDirection || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Lighting Approach</td><td>${dynamicText(narrative.lightingApproach || "—")}</td></tr>
  </table>
</div>

<div class="section">
  <h2 id="sec-materials">Material Specifications</h2>
  <table>
    <tr><th width="30%">Parameter</th><th>Value</th></tr>
    <tr><td style="font-weight:bold;">Tier Requirement</td><td>${dynamicText(materials.tierRequirement || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Quality Benchmark</td><td>${dynamicText(materials.qualityBenchmark || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Sustainability</td><td>${dynamicText(materials.sustainabilityMandate || "—")}</td></tr>
  </table>
  
  <h3>Approved Materials (Primary)</h3>
  <ul class="brief-list">${(materials.approvedMaterials || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>
  
  <h3>Approved Finishes &amp; Textures</h3>
  <ul class="brief-list">${(materials.finishesAndTextures || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>
  
  <h3 style="color: #c62828;">Prohibited Materials (Value Engineering Flags)</h3>
  <ul class="brief-list">${(materials.prohibitedMaterials || []).map((m: string) => `<li><span style="color: #c62828;">${dynamicText(m)}</span></li>`).join("")}</ul>
</div>

<div class="section">
  <h2 id="sec-boq">Target BOQ Framework</h2>
  ${boq.totalEstimatedSqm ? `<p><strong>Total Estimated Project Area:</strong> ${boq.totalEstimatedSqm.toLocaleString()} Sqm</p>` : ""}
  <table>
    <tr>
      <th width="35%">Category</th>
      <th width="20%">Allocation</th>
      <th width="20%" style="text-align:right;">Estimated Budget</th>
      <th width="25%">Notes</th>
    </tr>
    ${boqRows || "<tr><td colspan='4'>No allocations available.</td></tr>"}
  </table>
</div>

<div class="section">
  <h2 id="sec-budget">Detailed Budget Guardrails</h2>
  <table>
    <tr><th width="30%">Parameter</th><th>Value</th></tr>
    <tr><td style="font-weight:bold;">Cost Per Sqm Target</td><td>${dynamicText(budget.costPerSqmTarget || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Total Budget Cap</td><td>${dynamicText(budget.totalBudgetCap || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Cost Band</td><td>${dynamicText(budget.costBand || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Contingency</td><td>${dynamicText(budget.contingencyRecommendation || "—")}</td></tr>
    <tr><td style="font-weight:bold;">Flexibility Level</td><td>${dynamicText(budget.flexibilityLevel || "—")}</td></tr>
  </table>
  
  <h3>Value Engineering Directives</h3>
  <ul class="brief-list">${(budget.valueEngineeringMandates || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>
</div>

<div class="section">
  <h2 id="sec-workflow">Workflow &amp; Execution Instructions</h2>
  <p><strong>Lead Time Window:</strong> ${dynamicText((instructions.procurementAndLogistics || {}).leadTimeWindow || "—")}</p>
  
  <h3>Critical Path Procurement Items</h3>
  <ul class="brief-list">${((instructions.procurementAndLogistics || {}).criticalPathItems || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>
  
  <h3>Local Authority Approvals (Dubai)</h3>
  <ul class="brief-list">${(instructions.authorityApprovals || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>
  
  <h3>Contractor Coordination Requirements</h3>
  <ul class="brief-list">${(instructions.coordinationRequirements || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>
</div>

<div class="section">
  <h2 id="sec-deliverables">Phased Deliverables</h2>
  <h4 class="phase-header">Phase 1 — Concept &amp; Schematic</h4>
  <ul class="brief-list">${(instructions.phasedDeliverables.conceptDesign || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>

  <h4 class="phase-header">Phase 2 — Detailed Design</h4>
  <ul class="brief-list">${(instructions.phasedDeliverables.schematicDesign || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>

  <h4 class="phase-header">Phase 3 — IFC &amp; Tender</h4>
  <ul class="brief-list">${(instructions.phasedDeliverables.detailedDesign || []).map((m: string) => `<li>${dynamicText(m)}</li>`).join("")}</ul>
</div>
`;
}

export function generateDesignBriefHTML(data: IssuedPDFReportInput): string {
  const context = resolveReportContext("design_brief", data);
  return finalizeReportHtml([
    htmlHeader("Interior Design Instruction Brief", "Technical Specification & Execution Workflows", data.projectName, context),
    `<div class="content-wrapper">`,
    renderDesignBrief(data.designBrief),
    renderBoardAnnex(data.boardAnnex, context.locale),
    renderEvidenceReferences(data.evidenceRefs, context.locale),
    renderEvidenceTrace(data.projectId, context),
    `</div>`,
    htmlFooter(context),
  ].join(""), context);
}

export function generateFullReportHTML(data: IssuedPDFReportInput): string {
  const context = resolveReportContext("full_report", data);
  const sections = [
    htmlHeader("Full Evaluation Report", "Comprehensive Decision Intelligence Analysis", data.projectName, context),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderVariableContributions(data.scoreResult.variableContributions),
    renderSensitivity(data.sensitivity, context.locale),
    renderRiskAssessment(data.scoreResult),
    renderConditionalActions(data.scoreResult, context.locale),
  ];

  // V2: Add 5-Lens Defensibility
  if (data.fiveLens) {
    sections.push(renderFiveLens(data.fiveLens));
  }

  // V2: Add ROI Narrative Engine
  if (data.roiNarrative) {
    sections.push(renderROINarrative(data.roiNarrative, context.locale));
  } else if (data.roi) {
    sections.push(renderROI(data.roi, context.locale));
  }

  if (data.workflowReconciliation) {
    sections.push(renderWorkflowReconciliation(data.workflowReconciliation, context.locale));
  }

  // V4: Board Annex
  sections.push(renderBoardAnnex(data.boardAnnex, context.locale));

  // V2: Evidence References
  sections.push(renderEvidenceReferences(data.evidenceRefs, context.locale));

  // V2: Evidence Trace
  sections.push(renderEvidenceTrace(data.projectId, context));

  sections.push(renderInputSummary(data.inputs));
  sections.push(htmlFooter(context));

  return finalizeReportHtml(sections.join("\n"), context);
}

// ─── Scenario Comparison Pack PDF ───────────────────────────────────────────

export interface ScenarioComparisonPDFInput {
  projectName: string;
  projectId: number;
  baselineScenario: { id: number; name: string; scores: Record<string, number> | null; roi: Record<string, number> | null };
  comparedScenarios: Array<{
    id: number;
    name: string;
    scores: Record<string, number> | null;
    roi: Record<string, number> | null;
    deltas: Record<string, number> | null;
  }>;
  decisionNote?: string;
  benchmarkVersion?: string;
  logicVersion?: string;
  modelVersion?: string;
  locale?: ReportLocale;
  renderContext?: ReportRenderContext;
}

function renderScenarioComparisonTable(data: ScenarioComparisonPDFInput): string {
  const dims = ["sa", "ff", "mp", "ds", "er"] as const;
  const baseScores = (data.baselineScenario.scores ?? {}) as Record<string, number>;

  // Header row: Dimension | Baseline | Scenario A | Scenario B | ...
  const headerCols = [
    `<th>Dimension</th>`,
    `<th style="text-align:center;">Baseline<br><span style="font-size:8px;font-weight:400;">${dynamicText(data.baselineScenario.name)}</span></th>`,
    ...data.comparedScenarios.map((s, i) =>
      `<th style="text-align:center;">Scenario ${String.fromCharCode(65 + i)}<br><span style="font-size:8px;font-weight:400;">${dynamicText(s.name)}</span></th>`
    ),
  ].join("");

  const rows = dims.map((d) => {
    const baseVal = baseScores[`${d}Score`] ?? baseScores[d] ?? 0;
    const cells = data.comparedScenarios.map((s) => {
      const sScores = (s.scores ?? {}) as Record<string, number>;
      const val = sScores[`${d}Score`] ?? sScores[d] ?? 0;
      const delta = val - baseVal;
      const color = delta > 0 ? "#2e7d32" : delta < 0 ? "#c62828" : "#666";
      const arrow = delta > 0 ? "\u25B2" : delta < 0 ? "\u25BC" : "\u2014";
      return `<td style="text-align:center;">${val.toFixed(1)} <span style="color:${color};font-size:9px;">${arrow} ${delta !== 0 ? Math.abs(delta).toFixed(1) : ""}</span></td>`;
    }).join("");
    return `<tr><td>${DIMENSION_LABELS[d]}</td><td style="text-align:center;font-weight:700;">${baseVal.toFixed(1)}</td>${cells}</tr>`;
  }).join("");

  // Composite row
  const baseComposite = baseScores.compositeScore ?? baseScores.composite ?? 0;
  const compositeCells = data.comparedScenarios.map((s) => {
    const sScores = (s.scores ?? {}) as Record<string, number>;
    const val = sScores.compositeScore ?? sScores.composite ?? 0;
    const delta = val - baseComposite;
    const color = delta > 0 ? "#2e7d32" : delta < 0 ? "#c62828" : "#666";
    const arrow = delta > 0 ? "\u25B2" : delta < 0 ? "\u25BC" : "\u2014";
    return `<td style="text-align:center;font-weight:700;">${val.toFixed(1)} <span style="color:${color};font-size:9px;">${arrow} ${delta !== 0 ? Math.abs(delta).toFixed(1) : ""}</span></td>`;
  }).join("");

  return `
<div class="section">
  <h2>Scenario Score Comparison</h2>
  <table>
    <tr>${headerCols}</tr>
    ${rows}
    <tr style="font-weight:700; background:#f0f4f8;">
      <td>Composite Score</td>
      <td style="text-align:center;">${baseComposite.toFixed(1)}</td>
      ${compositeCells}
    </tr>
  </table>
</div>
`;
}

function renderROIComparison(data: ScenarioComparisonPDFInput): string {
  const baseRoi = (data.baselineScenario.roi ?? {}) as Record<string, number>;
  if (!baseRoi.totalValue && data.comparedScenarios.every(s => !s.roi)) return "";

  const metrics = ["totalValue", "reworkAvoided", "procurementSavings", "timeValueGain"];
  const metricLabels: Record<string, string> = {
    totalValue: "Total Value Created",
    reworkAvoided: "Rework Avoided",
    procurementSavings: "Procurement Savings",
    timeValueGain: "Time-Value Gain",
  };

  const headerCols = [
    `<th>ROI Metric</th>`,
    `<th style="text-align:right;">Baseline</th>`,
    ...data.comparedScenarios.map((s, i) =>
      `<th style="text-align:right;">Scenario ${String.fromCharCode(65 + i)}</th>`
    ),
  ].join("");

  const rows = metrics.map((m) => {
    const baseVal = baseRoi[m] ?? 0;
    const cells = data.comparedScenarios.map((s) => {
      const sRoi = (s.roi ?? {}) as Record<string, number>;
      const val = sRoi[m] ?? 0;
      return `<td style="text-align:right;">AED ${val.toLocaleString()}</td>`;
    }).join("");
    return `<tr><td>${metricLabels[m] ?? m}</td><td style="text-align:right;">AED ${baseVal.toLocaleString()}</td>${cells}</tr>`;
  }).join("");

  return `
<div class="section">
  <h2>ROI Comparison</h2>
  <table>
    <tr>${headerCols}</tr>
    ${rows}
  </table>
</div>
`;
}

function renderTradeoffAnalysis(data: ScenarioComparisonPDFInput, locale: ReportLocale): string {
  const analyses = data.comparedScenarios.map((s, i) => {
    const deltas = (s.deltas ?? {}) as Record<string, number>;
    const positives = Object.entries(deltas).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const negatives = Object.entries(deltas).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);

    const posItems = positives.slice(0, 3).map(([k, v]) =>
      `<div class="action-item">${DIMENSION_LABELS[k.replace("Score", "")] ?? k}: +${v.toFixed(1)} ${reportCopy(locale, "scenarioPoints")}</div>`
    ).join("");
    const negItems = negatives.slice(0, 3).map(([k, v]) =>
      `<div class="penalty-item">${DIMENSION_LABELS[k.replace("Score", "")] ?? k}: ${v.toFixed(1)} ${reportCopy(locale, "scenarioPoints")}</div>`
    ).join("");

    return `
    <h3>Scenario ${String.fromCharCode(65 + i)}: ${dynamicText(s.name)}</h3>
    ${positives.length > 0 ? `<p><strong>Improvements vs Baseline:</strong></p>${posItems}` : "<p>No improvements over baseline.</p>"}
    ${negatives.length > 0 ? `<p><strong>Trade-offs vs Baseline:</strong></p>${negItems}` : "<p>No trade-offs identified.</p>"}
    `;
  }).join("");

  return `
<div class="section">
  <h2>Trade-off Analysis</h2>
  ${analyses}
  ${data.decisionNote ? `<h3>Decision Note</h3><p>${dynamicText(data.decisionNote)}</p>` : ""}
</div>
`;
}

export function generateScenarioComparisonHTML(data: ScenarioComparisonPDFInput): string {
  const context = resolveReportContext("scenario_comparison", data);
  return finalizeReportHtml([
    htmlHeader("Scenario Comparison Pack", "Decision Tradeoff Analysis", data.projectName, context),
    renderScenarioComparisonTable(data),
    renderROIComparison(data),
    renderTradeoffAnalysis(data, context.locale),
    renderEvidenceTrace(data.projectId, context),
    htmlFooter(context),
  ].join("\n"), context);
}

function requireBoardAnnex(data: PDFReportInput): IssuedPDFReportInput {
  if (!data.boardAnnex) {
    throw new Error("Material Board Annex data is required for this issued report");
  }
  return data as IssuedPDFReportInput;
}

export function generateReportHTML(reportType: ReportType, data: PDFReportInput): string {
  switch (reportType) {
    case "validation_summary":
      return generateValidationSummaryHTML(data);
    case "design_brief":
      return generateDesignBriefHTML(requireBoardAnnex(data));
    case "full_report":
      return generateFullReportHTML(requireBoardAnnex(data));
    case "autonomous_design_brief":
      return generateAutonomousBriefHTML(data);
    default:
      return generateValidationSummaryHTML(data);
  }
}

// ─── Portfolio Report ───────────────────────────────────────────────────────

export interface PortfolioPDFInput {
  portfolioName: string;
  portfolioId: number;
  description?: string;
  totalProjects: number;
  scoredCount: number;
  avgComposite: number;
  avgRisk: number;
  projects: Array<{
    name: string;
    tier?: string;
    style?: string;
    compositeScore: number | null;
    riskScore: number | null;
    decisionStatus: string | null;
  }>;
  distributions: Array<{
    dimension: string;
    buckets: Array<{ label: string; count: number; avgScore: number }>;
  }>;
  failurePatterns: Array<{
    pattern: string;
    description: string;
    severity: string;
    frequency: number;
  }>;
  improvementLevers: Array<{
    rank: number;
    lever: string;
    description: string;
    estimatedImpact: string;
  }>;
  complianceHeatmap: Array<{
    tier: string;
    dimensions: Record<string, { avg: number; count: number }>;
  }>;
  benchmarkVersion?: string;
  logicVersion?: string;
  modelVersion?: string;
  locale?: ReportLocale;
  renderContext?: ReportRenderContext;
}

export function generatePortfolioReportHTML(data: PortfolioPDFInput): string {
  const context = resolveReportContext("portfolio", data);
  const metadata = reportDocumentMetadata(context.locale);

  // ─── Cover ─────────────────────────────────────────────────────────────
  const cover = `
<!DOCTYPE html>
<html lang="${metadata.lang}" dir="${metadata.dir}">
<head>
<meta charset="utf-8">
<style>
  ${reportLocaleCss(context.locale)}
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { color: #1a1a2e; line-height: 1.6; font-size: 11px; overflow-wrap: anywhere; }
  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 80vh; text-align: center; }
  .cover .logo { font-size: 36px; font-weight: 800; color: #0f3460; letter-spacing: 3px; margin-bottom: 32px; }
  .cover h1 { font-size: 28px; color: #0f3460; margin-bottom: 8px; }
  .cover h2 { font-size: 16px; color: #4ecdc4; font-weight: 400; margin-bottom: 24px; }
  .cover .project { font-size: 20px; color: #1a1a2e; font-weight: 600; }
  .cover .date { font-size: 12px; color: #666; margin-top: 16px; }
  .cover .confidential { font-size: 10px; color: #999; margin-top: 40px; text-transform: uppercase; letter-spacing: 2px; }
  h2 { font-size: 16px; color: #0f3460; border-bottom: 2px solid #4ecdc4; padding-bottom: 6px; margin: 24px 0 12px; }
  h3 { font-size: 13px; color: #0f3460; margin: 16px 0 8px; }
  p { margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10px; }
  th { background: #0f3460; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
  .metric-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .metric-card .value { font-size: 22px; font-weight: 700; color: #0f3460; margin: 4px 0; }
  .section { page-break-inside: avoid; margin-bottom: 20px; }
  .risk-flag { background: #fff3cd; border-inline-start: 3px solid #f0c674; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .action-item { background: #e8f5e9; border-inline-start: 3px solid #4ecdc4; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .penalty-item { background: #fce4ec; border-inline-start: 3px solid #e07a5f; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #999; text-align: center; }
  .status-go { color: #2e7d32; font-weight: 700; }
  .status-conditional { color: #f57f17; font-weight: 700; }
  .status-nogo { color: #c62828; font-weight: 700; }
</style>
</head>
<body>
<div class="cover">
  <div class="logo">MIYAR</div>
  <h1>Portfolio Analysis Report</h1>
  <h2>Multi-Project Decision Intelligence Summary</h2>
  <div class="project">${dynamicText(data.portfolioName)}</div>
  <div class="date">${formatReportDate(context.generatedAt, context.locale)}</div>
  <div class="confidential">${reportCopy(context.locale, "confidentialInternalOnly")}</div>
  <div class="watermark">${reportCopy(context.locale, "documentId")}: ${escapeReportText(context.documentId)}</div>
</div>
`;

  // ─── Executive Summary ─────────────────────────────────────────────────
  const summary = `
<div class="section">
  <h2>Portfolio Executive Summary</h2>
  ${data.description ? `<p>${dynamicText(data.description)}</p>` : ""}
  <div class="metric-grid">
    <div class="metric-card">
      <div class="label">${reportCopy(context.locale, "portfolioTotalProjects")}</div>
      <div class="value">${data.totalProjects}</div>
    </div>
    <div class="metric-card">
      <div class="label">${reportCopy(context.locale, "portfolioScored")}</div>
      <div class="value">${data.scoredCount}</div>
    </div>
    <div class="metric-card">
      <div class="label">${reportCopy(context.locale, "portfolioAverageComposite")}</div>
      <div class="value" style="color: ${data.avgComposite >= 75 ? "#4ecdc4" : data.avgComposite >= 55 ? "#f0c674" : "#e07a5f"};">${data.avgComposite}</div>
    </div>
    <div class="metric-card">
      <div class="label">${reportCopy(context.locale, "portfolioAverageRisk")}</div>
      <div class="value" style="color: ${data.avgRisk <= 45 ? "#4ecdc4" : data.avgRisk <= 60 ? "#f0c674" : "#e07a5f"};">${data.avgRisk}</div>
    </div>
  </div>
</div>
`;

  // ─── Project Comparison Table ──────────────────────────────────────────
  const projectRows = data.projects.map((p) => {
    const statusClass = p.decisionStatus === "GO" ? "status-go"
      : p.decisionStatus === "CONDITIONAL_GO" ? "status-conditional"
        : p.decisionStatus === "NO_GO" ? "status-nogo" : "";
    return `<tr>
      <td>${dynamicText(p.name)}</td>
      <td>${p.tier ? dynamicText(p.tier) : "—"}</td>
      <td>${p.style ? dynamicText(p.style) : "—"}</td>
      <td style="text-align:center; font-weight:700; color: ${(p.compositeScore || 0) >= 75 ? "#4ecdc4" : (p.compositeScore || 0) >= 55 ? "#f0c674" : "#e07a5f"};">${p.compositeScore ?? "N/A"}</td>
      <td style="text-align:center;">${p.riskScore ?? "N/A"}</td>
      <td style="text-align:center;" class="${statusClass}">${p.decisionStatus?.toLowerCase() === "conditional" ? reportCopy(context.locale, "portfolioConditional") : dynamicText((p.decisionStatus || "—").replace(/_/g, " "))}</td>
    </tr>`;
  }).join("");

  const projectTable = `
<div class="section">
  <h2>Project Comparison</h2>
  <table>
    <tr><th>Project</th><th>Tier</th><th>Style</th><th>Composite</th><th>Risk</th><th>Decision</th></tr>
    ${projectRows}
  </table>
</div>
`;

  // ─── Score Distributions ───────────────────────────────────────────────
  let distSection = "";
  if (data.distributions.length > 0) {
    const distTables = data.distributions.map((dist) => {
      const rows = dist.buckets
        .filter((b) => b.count > 0)
        .map((b) => `<tr><td>${dynamicText(b.label)}</td><td style="text-align:center;">${b.count}</td><td style="text-align:center; font-weight:700;">${b.avgScore}</td></tr>`)
        .join("");
      return `<h3>${dynamicText(dist.dimension)}</h3><table><tr><th>Group</th><th>Count</th><th>Avg Score</th></tr>${rows}</table>`;
    }).join("");
    distSection = `<div class="section"><h2>Score Distributions by Dimension</h2>${distTables}</div>`;
  }

  // ─── Failure Patterns ──────────────────────────────────────────────────
  let fpSection = "";
  if (data.failurePatterns.length > 0) {
    const fpItems = data.failurePatterns.map((fp) => {
      const css = fp.severity === "high" ? "penalty-item" : fp.severity === "medium" ? "risk-flag" : "action-item";
      return `<div class="${css}"><strong>${dynamicText(fp.pattern)}</strong> (${dynamicText(fp.severity)}, ${fp.frequency} project(s))<br>${dynamicText(fp.description)}</div>`;
    }).join("");
    fpSection = `<div class="section"><h2>Failure Patterns</h2>${fpItems}</div>`;
  }

  // ─── Improvement Levers ────────────────────────────────────────────────
  let leverSection = "";
  if (data.improvementLevers.length > 0) {
    const leverRows = data.improvementLevers.map((l) =>
      `<tr><td style="text-align:center; font-weight:700;">${l.rank}</td><td>${dynamicText(l.lever)}</td><td>${dynamicText(l.description)}</td><td style="text-align:center; color: ${l.estimatedImpact === "High" ? "#4ecdc4" : l.estimatedImpact === "Medium" ? "#f0c674" : "#666"}; font-weight:700;">${dynamicText(l.estimatedImpact)}</td></tr>`
    ).join("");
    leverSection = `<div class="section"><h2>Improvement Levers</h2><table><tr><th>#</th><th>Lever</th><th>Description</th><th>Impact</th></tr>${leverRows}</table></div>`;
  }

  // ─── Compliance Heatmap ────────────────────────────────────────────────
  let heatmapSection = "";
  if (data.complianceHeatmap.length > 0) {
    const dims = ["sa", "ff", "mp", "ds", "er"];
    const dimLabels: Record<string, string> = { sa: "SA", ff: "FF", mp: "MP", ds: "DS", er: "ER" };
    const headerCols = dims.map((d) => `<th style="text-align:center;">${dimLabels[d] || d}</th>`).join("");
    const heatRows = data.complianceHeatmap.map((row) => {
      const cells = dims.map((d) => {
        const cell = row.dimensions[d];
        if (!cell || cell.count === 0) return `<td style="text-align:center; color:#999;">—</td>`;
        const color = cell.avg >= 75 ? "#e8f5e9" : cell.avg >= 55 ? "#fff8e1" : "#fce4ec";
        const textColor = cell.avg >= 75 ? "#2e7d32" : cell.avg >= 55 ? "#f57f17" : "#c62828";
        return `<td style="text-align:center; background:${color}; color:${textColor}; font-weight:700;">${cell.avg} <span style="font-size:8px; font-weight:400;">(${cell.count})</span></td>`;
      }).join("");
      return `<tr><td style="font-weight:700;">${dynamicText(row.tier)}</td>${cells}</tr>`;
    }).join("");
    heatmapSection = `<div class="section"><h2>Compliance Heatmap (Tier × Dimension)</h2><table><tr><th>Tier</th>${headerCols}</tr>${heatRows}</table></div>`;
  }

  // ─── Footer ────────────────────────────────────────────────────────────
  const footer = `
<div class="footer">
  <p>${reportCopy(context.locale, "portfolioGeneratedBy")} • ${formatReportDate(context.generatedAt, context.locale)} • ${reportCopy(context.locale, "documentId")}: ${escapeReportText(context.documentId)}</p>
  <p>${reportCopy(context.locale, "portfolioId")}: ${data.portfolioId} • ${reportCopy(context.locale, "modelVersion")}: ${escapeReportText(context.modelVersion ?? reportCopy(context.locale, "notAvailable"))} • ${data.totalProjects} ${reportCopy(context.locale, "portfolioProjectsAnalyzed")}</p>
  <p>${reportCopy(context.locale, "renderInputFingerprint")}: ${escapeReportText(context.renderInputFingerprint)}</p>
</div>
</body>
</html>
`;

  return finalizeReportHtml([
    cover,
    summary,
    projectTable,
    distSection,
    heatmapSection,
    fpSection,
    leverSection,
    renderDisclaimer(context.locale),
    footer,
  ].join("\n"), context);
}
