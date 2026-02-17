/**
 * MIYAR PDF Report Generator
 * Generates structured HTML report content and stores it in S3.
 * Three report types:
 * 1. validation_summary - Executive decision pack
 * 2. design_brief - Design direction brief with variable contributions
 * 3. full_report - Complete report with ROI analysis and scenarios
 */
import type { ScoreResult, ProjectInputs, SensitivityEntry, ROIResult, ReportType } from "../../shared/miyar-types";

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

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── HTML Template Helpers ──────────────────────────────────────────────────

function htmlHeader(title: string, subtitle: string, projectName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 11px; }
  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 80vh; text-align: center; }
  .cover h1 { font-size: 28px; color: #0f3460; margin-bottom: 8px; letter-spacing: 1px; }
  .cover h2 { font-size: 16px; color: #4ecdc4; font-weight: 400; margin-bottom: 24px; }
  .cover .project { font-size: 20px; color: #1a1a2e; font-weight: 600; }
  .cover .date { font-size: 12px; color: #666; margin-top: 16px; }
  .cover .logo { font-size: 36px; font-weight: 800; color: #0f3460; letter-spacing: 3px; margin-bottom: 32px; }
  .cover .confidential { font-size: 10px; color: #999; margin-top: 40px; text-transform: uppercase; letter-spacing: 2px; }
  h2 { font-size: 16px; color: #0f3460; border-bottom: 2px solid #4ecdc4; padding-bottom: 6px; margin: 24px 0 12px; }
  h3 { font-size: 13px; color: #0f3460; margin: 16px 0 8px; }
  p { margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10px; }
  th { background: #0f3460; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .score-box { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 14px; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #fff; letter-spacing: 1px; }
  .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
  .metric-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .metric-card .value { font-size: 22px; font-weight: 700; color: #0f3460; margin: 4px 0; }
  .metric-card .grade { font-size: 10px; }
  .risk-flag { background: #fff3cd; border-left: 3px solid #f0c674; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .action-item { background: #e8f5e9; border-left: 3px solid #4ecdc4; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .penalty-item { background: #fce4ec; border-left: 3px solid #e07a5f; padding: 6px 10px; margin: 4px 0; font-size: 10px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 9px; color: #999; text-align: center; }
  .section { page-break-inside: avoid; margin-bottom: 20px; }
</style>
</head>
<body>
<div class="cover">
  <div class="logo">MIYAR</div>
  <h1>${title}</h1>
  <h2>${subtitle}</h2>
  <div class="project">${projectName}</div>
  <div class="date">${formatDate()}</div>
  <div class="confidential">Confidential — For Internal Use Only</div>
</div>
`;
}

function htmlFooter(projectId: number, reportType: string): string {
  return `
<div class="footer">
  MIYAR Decision Intelligence Platform | Report ID: ${reportType.toUpperCase()}-${projectId}-${Date.now().toString(36)} | Generated: ${formatDate()}<br>
  Model Version: v1.0.0 | This report is auto-generated. Scores are advisory and do not constitute professional design or financial advice.
</div>
</body>
</html>
`;
}

// ─── Executive Summary Section ──────────────────────────────────────────────

function renderExecutiveSummary(scoreResult: ScoreResult): string {
  const dims = scoreResult.dimensions;
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
    `<div class="penalty-item"><strong>${p.id}:</strong> ${p.description} (Effect: ${p.effect > 0 ? "+" : ""}${p.effect.toFixed(1)})</div>`
  ).join("");

  const flags = scoreResult.riskFlags.map((f) =>
    `<div class="risk-flag">${f}</div>`
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

function renderSensitivity(sensitivity: SensitivityEntry[]): string {
  const top = sensitivity.slice(0, 8);
  const rows = top.map((s) => {
    const direction = s.sensitivity > 0 ? "↑" : "↓";
    return `<tr>
      <td>${s.variable}</td>
      <td style="text-align:center;">${Math.abs(s.sensitivity).toFixed(2)}</td>
      <td style="text-align:center;">${s.scoreUp.toFixed(1)}</td>
      <td style="text-align:center;">${s.scoreDown.toFixed(1)}</td>
      <td style="text-align:center;">${(s.scoreUp - s.scoreDown).toFixed(1)}</td>
    </tr>`;
  }).join("");

  return `
<div class="section">
  <h2>Sensitivity Analysis</h2>
  <p>Top ${top.length} variables ranked by impact on composite score when adjusted ±1 unit:</p>
  <table>
    <tr><th>Variable</th><th>Sensitivity</th><th>Score (+1)</th><th>Score (-1)</th><th>Range</th></tr>
    ${rows}
  </table>
</div>
`;
}

// ─── Conditional Actions ────────────────────────────────────────────────────

function renderConditionalActions(scoreResult: ScoreResult): string {
  if (scoreResult.conditionalActions.length === 0) {
    return `<div class="section"><h2>Recommended Actions</h2><p>No conditional actions required. All parameters are within acceptable ranges.</p></div>`;
  }

  const actions = scoreResult.conditionalActions.map((a) =>
    `<div class="action-item">
      <strong>Trigger:</strong> ${a.trigger}<br>
      <strong>Recommendation:</strong> ${a.recommendation}<br>
      <strong>Variables:</strong> ${a.variables.join(", ")}
    </div>`
  ).join("");

  return `
<div class="section">
  <h2>Recommended Actions</h2>
  <p>${scoreResult.conditionalActions.length} conditional action(s) identified:</p>
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
        ["GFA (sqm)", inputs.ctx03Gfa ? inputs.ctx03Gfa.toLocaleString() : "N/A"],
        ["Location", inputs.ctx04Location],
        ["Delivery Horizon", inputs.ctx05Horizon],
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
        ["Budget Cap (AED/sqft)", inputs.fin01BudgetCap ? inputs.fin01BudgetCap.toLocaleString() : "N/A"],
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
    const rows = g.items.map(([k, v]) => `<tr><td style="width:50%;">${k}</td><td>${v}</td></tr>`).join("");
    return `<h3>${g.title}</h3><table><tr><th>Parameter</th><th>Value</th></tr>${rows}</table>`;
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
      `<tr><td>${v}</td><td style="text-align:center; color: ${c >= 0 ? "#4ecdc4" : "#e07a5f"}; font-weight:600;">${c >= 0 ? "+" : ""}${c.toFixed(2)}</td></tr>`
    ).join("");
    return `<h3>${DIMENSION_LABELS[dim] || dim}</h3><table><tr><th>Variable</th><th>Contribution</th></tr>${rows}</table>`;
  }).join("");

  return `<div class="section"><h2>Variable Contribution Analysis</h2><p>How each input variable contributes to each dimension score:</p>${sections}</div>`;
}

// ─── ROI Analysis ───────────────────────────────────────────────────────────

function renderROI(roi: ROIResult): string {
  return `
<div class="section">
  <h2>ROI & Economic Impact Analysis</h2>
  <table>
    <tr><th>Value Component</th><th>Amount (AED)</th></tr>
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
  <p style="margin-top:12px; font-size:10px; color:#666;">
    <em>Assumptions: Rework avoidance based on industry benchmarks (15-25% of construction cost for misaligned projects). 
    Procurement savings estimated at 3-8% through validated specifications. Time-value calculated using standard cost-of-capital models.</em>
  </p>
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
}

export function generateValidationSummaryHTML(data: PDFReportInput): string {
  return [
    htmlHeader("Validation Summary", "Interior Design Direction Assessment", data.projectName),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderRiskAssessment(data.scoreResult),
    renderSensitivity(data.sensitivity),
    renderConditionalActions(data.scoreResult),
    renderInputSummary(data.inputs),
    htmlFooter(data.projectId, "validation_summary"),
  ].join("\n");
}

export function generateDesignBriefHTML(data: PDFReportInput): string {
  return [
    htmlHeader("Design Direction Brief", "Technical Specification & Variable Analysis", data.projectName),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderVariableContributions(data.scoreResult.variableContributions),
    renderSensitivity(data.sensitivity),
    renderRiskAssessment(data.scoreResult),
    renderConditionalActions(data.scoreResult),
    renderInputSummary(data.inputs),
    htmlFooter(data.projectId, "design_brief"),
  ].join("\n");
}

export function generateFullReportHTML(data: PDFReportInput): string {
  const sections = [
    htmlHeader("Full Evaluation Report", "Comprehensive Decision Intelligence Analysis", data.projectName),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderVariableContributions(data.scoreResult.variableContributions),
    renderSensitivity(data.sensitivity),
    renderRiskAssessment(data.scoreResult),
    renderConditionalActions(data.scoreResult),
  ];

  if (data.roi) {
    sections.push(renderROI(data.roi));
  }

  sections.push(renderInputSummary(data.inputs));
  sections.push(htmlFooter(data.projectId, "full_report"));

  return sections.join("\n");
}

export function generateReportHTML(reportType: ReportType, data: PDFReportInput): string {
  switch (reportType) {
    case "validation_summary":
      return generateValidationSummaryHTML(data);
    case "design_brief":
      return generateDesignBriefHTML(data);
    case "full_report":
      return generateFullReportHTML(data);
    default:
      return generateValidationSummaryHTML(data);
  }
}
