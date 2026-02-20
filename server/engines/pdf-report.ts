/**
 * MIYAR PDF Report Generator V2
 * Generates structured HTML report content with V2 Intelligence Layer:
 * - 5-Lens Defensibility Framework
 * - ROI Narrative Engine
 * - Evidence Trace & Watermarking
 * - Three report types: Executive Decision Pack, Design Brief + RFQ, Full Report
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

function generateWatermark(projectId: number, reportType: string): string {
  const ts = Date.now().toString(36);
  const hash = `MYR-${reportType.toUpperCase().slice(0, 3)}-${projectId}-${ts}`;
  return hash;
}

// ─── HTML Template Helpers ──────────────────────────────────────────────────

function htmlHeader(title: string, subtitle: string, projectName: string, watermark: string): string {
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
  .cover .watermark { font-size: 8px; color: #ccc; margin-top: 8px; font-family: monospace; }
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
  .lens-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin: 8px 0; }
  .lens-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .lens-title { font-size: 12px; font-weight: 700; color: #0f3460; }
  .lens-score { font-size: 14px; font-weight: 700; }
  .lens-evidence { font-size: 9px; color: #666; margin-top: 4px; }
  .roi-highlight { background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border: 1px solid #c8e6c9; border-radius: 8px; padding: 16px; margin: 12px 0; text-align: center; }
  .roi-value { font-size: 28px; font-weight: 800; color: #2e7d32; }
  .roi-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .evidence-trace { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px 12px; margin: 8px 0; font-size: 9px; font-family: monospace; color: #666; }
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
  <div class="watermark">Document ID: ${watermark}</div>
</div>
`;
}

function renderEvidenceReferences(refs?: Array<{ title: string; sourceUrl?: string; category?: string; reliabilityGrade?: string; captureDate?: string }>): string {
  if (!refs || refs.length === 0) return "";
  const rows = refs.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${r.title}</td>
    <td>${r.category || "—"}</td>
    <td>${r.reliabilityGrade || "—"}</td>
    <td>${r.captureDate ? new Date(r.captureDate).toLocaleDateString() : "—"}</td>
    <td>${r.sourceUrl ? `<a href="${r.sourceUrl}" style="color:#0f3460;">[link]</a>` : "—"}</td>
  </tr>`).join("");
  return `
<div class="section">
  <h2>Evidence References</h2>
  <table>
    <tr><th>#</th><th>Title</th><th>Category</th><th>Grade</th><th>Captured</th><th>Source</th></tr>
    ${rows}
  </table>
  <p style="font-size:9px; color:#666; margin-top:4px;">Evidence records linked to this project at the time of report generation.</p>
</div>
`;
}

function renderDisclaimer(): string {
  return `
<div class="section" style="margin-top:24px; padding:12px; background:#fff8e1; border:1px solid #ffe082; border-radius:6px;">
  <h3 style="color:#e65100; font-size:11px; margin-bottom:6px;">Important Disclaimer</h3>
  <p style="font-size:9px; color:#5d4037; line-height:1.5;">
    This document is a <strong>concept-level assessment</strong> generated by the MIYAR Decision Intelligence Platform.
    All scores, recommendations, and specifications are <strong>advisory only</strong> and are subject to detailed design,
    engineering review, and professional validation. Material specifications, cost estimates, and procurement guidance
    are indicative and must be confirmed through formal tender processes. MIYAR does not warrant the accuracy of
    third-party benchmark data or market intelligence used in this assessment. This document does not constitute
    professional design, financial, or legal advice.
  </p>
</div>
`;
}

function htmlFooter(projectId: number, reportType: string, watermark: string, benchmarkVersion?: string, logicVersion?: string): string {
  return `
${renderDisclaimer()}
<div class="footer">
  MIYAR Decision Intelligence Platform V2 | Document ID: ${watermark} | Generated: ${formatDate()}<br>
  Model Version: v2.0.0 | Benchmark Version: ${benchmarkVersion || "v1.0-baseline"} | Logic Version: ${logicVersion || "v1.0-default"}<br>
  <span style="font-size:8px;">This report is auto-generated and watermarked. Scores are advisory and do not constitute professional design or financial advice.</span>
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

// ─── V2: ROI Narrative Engine Section ───────────────────────────────────────

function renderROINarrative(roi: any): string {
  if (!roi) return "";

  return `
<div class="section">
  <h2>ROI & Economic Impact Analysis</h2>
  
  <div class="roi-highlight">
    <div class="roi-label">Total Value Created</div>
    <div class="roi-value">AED ${Number(roi.totalValue || 0).toLocaleString()}</div>
    <div style="font-size:10px; color:#666; margin-top:4px;">ROI Multiple: ${Number(roi.roiMultiple || 0).toFixed(1)}x</div>
  </div>

  <h3>Value Breakdown</h3>
  <table>
    <tr><th>Value Component</th><th>Conservative</th><th>Base</th><th>Aggressive</th></tr>
    ${roi.components ? roi.components.map((c: any) => `
    <tr>
      <td><strong>${c.name}</strong><br><span style="font-size:9px; color:#666;">${c.narrative || ""}</span></td>
      <td style="text-align:right;">AED ${Number(c.conservative || 0).toLocaleString()}</td>
      <td style="text-align:right; font-weight:600;">AED ${Number(c.base || 0).toLocaleString()}</td>
      <td style="text-align:right;">AED ${Number(c.aggressive || 0).toLocaleString()}</td>
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
  <p style="font-size:10px; line-height:1.6;">${roi.narrative}</p>
  ` : ""}

  ${roi.assumptions ? `
  <h3>Key Assumptions</h3>
  <ul style="font-size:9px; color:#666; padding-left:16px;">
    ${roi.assumptions.map((a: string) => `<li>${a}</li>`).join("")}
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
    "Market Positioning": "📊",
    "Financial Viability": "💰",
    "Design Coherence": "🎨",
    "Execution Feasibility": "⚙️",
    "Strategic Alignment": "🎯",
  };

  const lensCards = (fiveLens.lenses || []).map((lens: any) => {
    const color = lens.score >= 70 ? "#4ecdc4" : lens.score >= 50 ? "#f0c674" : "#e07a5f";
    const icon = LENS_ICONS[lens.name] || "🔍";
    return `
    <div class="lens-card">
      <div class="lens-header">
        <div class="lens-title">${icon} ${lens.name}</div>
        <div class="lens-score" style="color:${color};">${lens.score.toFixed(0)}/100</div>
      </div>
      <p style="font-size:10px; margin-bottom:6px;">${lens.verdict}</p>
      ${lens.evidence && lens.evidence.length > 0 ? `
      <div class="lens-evidence">
        <strong>Evidence:</strong> ${lens.evidence.slice(0, 3).join(" • ")}
      </div>
      ` : ""}
      ${lens.gaps && lens.gaps.length > 0 ? `
      <div style="font-size:9px; color:#e07a5f; margin-top:4px;">
        <strong>Gaps:</strong> ${lens.gaps.slice(0, 2).join(" • ")}
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
      <div class="grade">${fiveLens.overallVerdict || scoreGrade(fiveLens.overallScore)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Weakest Lens</div>
      <div class="value" style="font-size:14px; color:#e07a5f;">${fiveLens.weakestLens || "—"}</div>
      <div class="grade">Priority improvement area</div>
    </div>
  </div>
  ${lensCards}
</div>
`;
}

// ─── V2: Evidence Trace ─────────────────────────────────────────────────────

function renderEvidenceTrace(projectId: number, watermark: string, benchmarkVersion?: string, logicVersion?: string): string {
  return `
<div class="section">
  <h2>Evidence Trace & Provenance</h2>
  <div class="evidence-trace">
    Document ID: ${watermark}<br>
    Project ID: ${projectId}<br>
    Benchmark Version: ${benchmarkVersion || "v1.0-baseline"}<br>
    Logic Version: ${logicVersion || "v1.0-default"}<br>
    Model Version: v2.0.0<br>
    Generated: ${new Date().toISOString()}<br>
    Scoring Engine: MIYAR Decision Intelligence V2<br>
    Hash: ${Buffer.from(watermark + projectId).toString("base64").slice(0, 16)}
  </div>
  <p style="font-size:9px; color:#666; margin-top:8px;">
    This document contains a cryptographic evidence trace linking the scoring inputs, benchmark data version,
    logic version (weights + thresholds), and model configuration used at the time of generation. Any modification
    to the underlying data would produce a different document hash, ensuring auditability and defensibility of the decision record.
  </p>
</div>
`;
}

// ─── Legacy ROI Section (backward compat) ───────────────────────────────────

function renderROI(roi: ROIResult): string {
  return `
<div class="section">
  <h2>ROI & Economic Impact Analysis</h2>
  <div class="roi-highlight">
    <div class="roi-label">Total Value Created</div>
    <div class="roi-value">AED ${roi.totalValue.toLocaleString()}</div>
    <div style="font-size:10px; color:#666; margin-top:4px;">ROI Multiple: ${roi.roiMultiple.toFixed(1)}x</div>
  </div>
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
  benchmarkVersion?: string;
  logicVersion?: string;
  evidenceRefs?: Array<{ title: string; sourceUrl?: string; category?: string; reliabilityGrade?: string; captureDate?: string }>;
}

export function generateValidationSummaryHTML(data: PDFReportInput): string {
  const watermark = generateWatermark(data.projectId, "validation_summary");
  return [
    htmlHeader("Executive Decision Pack", "Interior Design Direction Assessment", data.projectName, watermark),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderRiskAssessment(data.scoreResult),
    renderSensitivity(data.sensitivity),
    renderConditionalActions(data.scoreResult),
    data.fiveLens ? renderFiveLens(data.fiveLens) : "",
    renderEvidenceReferences(data.evidenceRefs),
    renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion),
    renderInputSummary(data.inputs),
    htmlFooter(data.projectId, "validation_summary", watermark, data.benchmarkVersion, data.logicVersion),
  ].join("\n");
}

export function generateDesignBriefHTML(data: PDFReportInput): string {
  const watermark = generateWatermark(data.projectId, "design_brief");
  return [
    htmlHeader("Design Brief + RFQ Pack", "Technical Specification & Variable Analysis", data.projectName, watermark),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderVariableContributions(data.scoreResult.variableContributions),
    renderSensitivity(data.sensitivity),
    renderRiskAssessment(data.scoreResult),
    renderConditionalActions(data.scoreResult),
    data.fiveLens ? renderFiveLens(data.fiveLens) : "",
    renderEvidenceReferences(data.evidenceRefs),
    renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion),
    renderInputSummary(data.inputs),
    htmlFooter(data.projectId, "design_brief", watermark, data.benchmarkVersion, data.logicVersion),
  ].join("\n");
}

export function generateFullReportHTML(data: PDFReportInput): string {
  const watermark = generateWatermark(data.projectId, "full_report");
  const sections = [
    htmlHeader("Full Evaluation Report", "Comprehensive Decision Intelligence Analysis", data.projectName, watermark),
    renderExecutiveSummary(data.scoreResult),
    renderDimensionTable(data.scoreResult),
    renderVariableContributions(data.scoreResult.variableContributions),
    renderSensitivity(data.sensitivity),
    renderRiskAssessment(data.scoreResult),
    renderConditionalActions(data.scoreResult),
  ];

  // V2: Add 5-Lens Defensibility
  if (data.fiveLens) {
    sections.push(renderFiveLens(data.fiveLens));
  }

  // V2: Add ROI Narrative Engine
  if (data.roiNarrative) {
    sections.push(renderROINarrative(data.roiNarrative));
  } else if (data.roi) {
    sections.push(renderROI(data.roi));
  }

  // V2: Evidence References
  sections.push(renderEvidenceReferences(data.evidenceRefs));

  // V2: Evidence Trace
  sections.push(renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion));

  sections.push(renderInputSummary(data.inputs));
  sections.push(htmlFooter(data.projectId, "full_report", watermark, data.benchmarkVersion, data.logicVersion));

  return sections.join("\n");
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
}

function renderScenarioComparisonTable(data: ScenarioComparisonPDFInput): string {
  const dims = ["sa", "ff", "mp", "ds", "er"] as const;
  const baseScores = (data.baselineScenario.scores ?? {}) as Record<string, number>;
  
  // Header row: Dimension | Baseline | Scenario A | Scenario B | ...
  const headerCols = [
    `<th>Dimension</th>`,
    `<th style="text-align:center;">Baseline<br><span style="font-size:8px;font-weight:400;">${data.baselineScenario.name}</span></th>`,
    ...data.comparedScenarios.map((s, i) => 
      `<th style="text-align:center;">Scenario ${String.fromCharCode(65 + i)}<br><span style="font-size:8px;font-weight:400;">${s.name}</span></th>`
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

function renderTradeoffAnalysis(data: ScenarioComparisonPDFInput): string {
  const analyses = data.comparedScenarios.map((s, i) => {
    const deltas = (s.deltas ?? {}) as Record<string, number>;
    const positives = Object.entries(deltas).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const negatives = Object.entries(deltas).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);

    const posItems = positives.slice(0, 3).map(([k, v]) => 
      `<div class="action-item">${DIMENSION_LABELS[k.replace("Score", "")] ?? k}: +${v.toFixed(1)} points</div>`
    ).join("");
    const negItems = negatives.slice(0, 3).map(([k, v]) => 
      `<div class="penalty-item">${DIMENSION_LABELS[k.replace("Score", "")] ?? k}: ${v.toFixed(1)} points</div>`
    ).join("");

    return `
    <h3>Scenario ${String.fromCharCode(65 + i)}: ${s.name}</h3>
    ${positives.length > 0 ? `<p><strong>Improvements vs Baseline:</strong></p>${posItems}` : "<p>No improvements over baseline.</p>"}
    ${negatives.length > 0 ? `<p><strong>Trade-offs vs Baseline:</strong></p>${negItems}` : "<p>No trade-offs identified.</p>"}
    `;
  }).join("");

  return `
<div class="section">
  <h2>Trade-off Analysis</h2>
  ${analyses}
  ${data.decisionNote ? `<h3>Decision Note</h3><p>${data.decisionNote}</p>` : ""}
</div>
`;
}

export function generateScenarioComparisonHTML(data: ScenarioComparisonPDFInput): string {
  const watermark = generateWatermark(data.projectId, "scenario_comparison");
  return [
    htmlHeader("Scenario Comparison Pack", "Decision Tradeoff Analysis", data.projectName, watermark),
    renderScenarioComparisonTable(data),
    renderROIComparison(data),
    renderTradeoffAnalysis(data),
    renderEvidenceTrace(data.projectId, watermark, data.benchmarkVersion, data.logicVersion),
    htmlFooter(data.projectId, "scenario_comparison", watermark, data.benchmarkVersion, data.logicVersion),
  ].join("\n");
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
