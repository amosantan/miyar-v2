/**
 * MIYAR Investor Brief — HTML PDF Generator (Phase 5)
 *
 * Generates a professional printable HTML page for the Investor Summary.
 * Same pattern as board-pdf.ts — returned as HTML string, served via
 * `design.exportInvestorPdf` tRPC action, opened with ?print=1 to trigger
 * browser print dialog or used in puppeteer.
 */

export interface InvestorPdfInput {
  projectName: string;
  typology: string;
  location: string;
  tier: string;
  style: string;
  gfaSqm: number;
  execSummary: string;
  designDirection: Record<string, any>;
  spaces: {
    name: string;
    budgetAed: number;
    sqm: number;
    pct: number;
    styleDirection?: string;
  }[];
  materials: {
    name: string;
    brand: string;
    price?: string;
    room: string;
  }[];
  materialConstants: {
    materialType: string;
    costPerM2: number;
    carbonIntensity: number;
    sustainabilityGrade: string;
  }[];
  totalFitoutBudget: number;
  costPerSqm: number;
  sustainabilityGrade: string;
  salePremiumPct: number;
  estimatedSalesPremiumAed: number;
  benchmark?: {
    costPerSqmLow?: number | null;
    costPerSqmMid?: number | null;
    costPerSqmHigh?: number | null;
    typology?: string;
    location?: string;
    marketTier?: string;
    dataYear?: number | null;
  } | null;
  designTrends?: {
    trendName: string;
    confidenceLevel: string;
    trendCategory: string;
    description?: string | null;
  }[];
  shareToken?: string;
  spaceEfficiency?: {
    efficiencyScore: number;
    criticalCount: number;
    advisoryCount: number;
    circulationPct: number;
    rooms: { name: string; currentPct: number; benchmarkPct: number; severity: string }[];
  };
}

function fmtAed(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M AED`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K AED`;
  return `${n.toLocaleString()} AED`;
}

function gradeColor(g: string): string {
  return { A: "#10b981", B: "#22c55e", C: "#f59e0b", D: "#f97316", E: "#ef4444" }[g] ?? "#94a3b8";
}

function confColor(c: string): string {
  return { established: "#10b981", emerging: "#8b5cf6", declining: "#ef4444" }[c] ?? "#94a3b8";
}

export function generateInvestorPdfHtml(input: InvestorPdfInput): string {
  const {
    projectName, typology, location, tier, style, gfaSqm,
    execSummary, designDirection, spaces, materials, materialConstants,
    totalFitoutBudget, costPerSqm, sustainabilityGrade, salePremiumPct,
    estimatedSalesPremiumAed, benchmark, designTrends, shareToken, spaceEfficiency,
  } = input;

  const watermark = `MYR-INV-${Date.now().toString(36).toUpperCase()}`;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── Space budget bars ────────────────────────────────────────────────────
  const spaceBars = spaces.slice(0, 12).map(s => `
    <div class="bar-row">
      <span class="bar-label">${s.name}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.min(s.pct, 100).toFixed(1)}%"></div>
      </div>
      <span class="bar-pct">${s.pct.toFixed(0)}%</span>
      <span class="bar-amt">${fmtAed(s.budgetAed)}</span>
    </div>
  `).join("");

  // ── Material table ───────────────────────────────────────────────────────
  const matRows = materials.slice(0, 16).map((m, i) => `
    <tr class="${i % 2 === 0 ? "even" : ""}">
      <td>${m.name}</td>
      <td>${m.brand}</td>
      <td>${m.room}</td>
      <td>${m.price ?? "—"}</td>
    </tr>
  `).join("");

  // ── Material constants table ─────────────────────────────────────────────
  const constRows = materialConstants.slice(0, 9).map((c, i) => `
    <tr class="${i % 2 === 0 ? "even" : ""}">
      <td class="capitalize">${c.materialType}</td>
      <td>${c.costPerM2.toLocaleString()} AED</td>
      <td>${Number(c.carbonIntensity).toFixed(0)} kg/m²</td>
      <td><span class="grade-badge" style="background:${gradeColor(c.sustainabilityGrade)}">${c.sustainabilityGrade}</span></td>
    </tr>
  `).join("");

  // ── Benchmark comparison ─────────────────────────────────────────────────
  const bmSection = benchmark ? `
    <div class="panel">
      <div class="panel-title">Market Benchmark — ${benchmark.typology ?? typology} · ${benchmark.marketTier ?? tier}${benchmark.dataYear ? ` · ${benchmark.dataYear}` : ""}</div>
      <div class="kpi-grid">
        ${benchmark.costPerSqmLow != null ? `<div class="kpi"><div class="kpi-label">Low</div><div class="kpi-value">${benchmark.costPerSqmLow.toLocaleString()} AED/m²</div></div>` : ""}
        ${benchmark.costPerSqmMid != null ? `<div class="kpi"><div class="kpi-label">Mid</div><div class="kpi-value">${benchmark.costPerSqmMid.toLocaleString()} AED/m²</div></div>` : ""}
        ${benchmark.costPerSqmHigh != null ? `<div class="kpi"><div class="kpi-label">High</div><div class="kpi-value">${benchmark.costPerSqmHigh.toLocaleString()} AED/m²</div></div>` : ""}
        <div class="kpi"><div class="kpi-label">Your Estimate</div><div class="kpi-value" style="color:${costPerSqm <= (benchmark.costPerSqmMid ?? Infinity) ? "#10b981" : "#f59e0b"}">${costPerSqm.toLocaleString()} AED/m²</div></div>
      </div>
    </div>
  ` : "";

  // ── Design trends ────────────────────────────────────────────────────────
  const trendRows = (designTrends ?? []).slice(0, 8).map(t => `
    <div class="trend-row">
      <span class="conf-badge" style="background:${confColor(t.confidenceLevel)}">${t.confidenceLevel}</span>
      <span class="trend-name">${t.trendName}</span>
      <span class="trend-cat">${t.trendCategory}</span>
    </div>
  `).join("");

  // ── Design direction pills ───────────────────────────────────────────────
  const ddPills = Object.entries(designDirection ?? {}).slice(0, 6).map(([k, v]) => `
    <div class="dd-row">
      <span class="dd-key">${k.replace(/([A-Z])/g, " $1").trim()}</span>
      <span class="dd-val">${Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</span>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MIYAR Investor Brief — ${projectName}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 14mm; }
  @media print { .no-print { display: none; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; font-size: 10px; line-height: 1.5; background: #fff; }

  /* Cover */
  .cover { page-break-after: always; padding: 40mm 0 20mm; text-align: center; }
  .cover .brand { font-size: 30px; font-weight: 800; letter-spacing: 4px; color: #0f3460; }
  .cover .subtitle { font-size: 12px; color: #4ecdc4; margin: 4px 0 20px; letter-spacing: 2px; text-transform: uppercase; }
  .cover .project-name { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
  .cover .meta { font-size: 10px; color: #64748b; margin-bottom: 6px; }
  .cover .divider { width: 60px; height: 3px; background: #4ecdc4; margin: 20px auto; }
  .cover .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 340px; margin: 24px auto 0; }
  .cover .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 8px; background: #f8fafc; }
  .cover .kpi-card .cv { font-size: 16px; font-weight: 800; color: #0f3460; }
  .cover .kpi-card .cl { font-size: 7px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .cover .watermark { font-size: 7px; color: #cbd5e1; margin-top: 30px; font-family: monospace; }

  /* Sections */
  h2 { font-size: 12px; font-weight: 700; color: #0f3460; border-bottom: 2px solid #4ecdc4; padding-bottom: 4px; margin: 18px 0 10px; text-transform: uppercase; letter-spacing: 1px; }
  h3 { font-size: 10px; font-weight: 700; color: #334155; margin: 12px 0 6px; }

  .section { page-break-inside: avoid; margin-bottom: 14px; }
  .section-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* KPI row */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; background: #f8fafc; }
  .kpi-label { font-size: 7px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .kpi-value { font-size: 14px; font-weight: 800; color: #0f3460; margin: 2px 0; }
  .kpi-sub { font-size: 7px; color: #64748b; }

  /* Panel */
  .panel { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin: 8px 0; background: #f8fafc; }
  .panel-title { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }

  /* Exec summary */
  .exec-body { font-size: 10px; color: #334155; line-height: 1.65; padding: 8px 0; }

  /* Design direction */
  .dd-row { display: flex; gap: 8px; padding: 3px 0; border-bottom: 1px dotted #e2e8f0; font-size: 9px; }
  .dd-key { width: 110px; color: #64748b; font-weight: 600; text-transform: capitalize; flex-shrink: 0; }
  .dd-val { color: #0f172a; flex: 1; }

  /* Budget bars */
  .bar-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; font-size: 9px; }
  .bar-label { width: 90px; color: #475569; flex-shrink: 0; }
  .bar-track { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; background: linear-gradient(90deg, #4ecdc4, #0f3460); border-radius: 4px; }
  .bar-pct { width: 28px; color: #475569; text-align: right; flex-shrink: 0; }
  .bar-amt { width: 60px; color: #0f3460; font-weight: 600; text-align: right; flex-shrink: 0; font-size: 8px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9px; }
  th { background: #0f3460; color: #fff; padding: 5px 8px; text-align: left; font-weight: 600; font-size: 8px; letter-spacing: 0.5px; }
  td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; }
  tr.even td { background: #f8fafc; }
  .capitalize { text-transform: capitalize; }

  /* ROI grid */
  .roi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .roi-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
  .roi-big { font-size: 20px; font-weight: 800; color: #0f3460; }
  .roi-label { font-size: 7px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .roi-sub { font-size: 8px; color: #64748b; margin-top: 3px; }
  .text-emerald { color: #10b981; }
  .text-amber { color: #f59e0b; }

  /* Sustainability */
  .grade-chip { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; font-weight: 800; color: #fff; }
  .grade-badge { font-size: 8px; color: #fff; padding: 1px 5px; border-radius: 3px; font-weight: 700; }

  /* Trends */
  .trend-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; border-bottom: 1px dotted #e2e8f0; font-size: 9px; }
  .conf-badge { font-size: 7px; color: #fff; padding: 1px 5px; border-radius: 3px; font-weight: 600; flex-shrink: 0; }
  .trend-name { flex: 1; font-weight: 600; color: #0f172a; }
  .trend-cat { font-size: 7px; color: #94a3b8; text-transform: uppercase; }

  /* Footer */
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 7px; color: #94a3b8; text-align: center; }

  /* Print button */
  .no-print { position: fixed; top: 16px; right: 16px; z-index: 999; background: #0f3460; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .no-print:hover { background: #1e4a7a; }
</style>
</head>
<body>

<button class="no-print" onclick="window.print()">⬇ Download / Print PDF</button>

<!-- COVER -->
<div class="cover">
  <div class="brand">MIYAR</div>
  <div class="subtitle">Investor Intelligence Brief</div>
  <div class="project-name">${projectName}</div>
  <div class="meta">${typology} · ${tier} · ${location}</div>
  <div class="meta">${gfaSqm.toLocaleString()} sqm GFA · ${style} Design</div>
  <div class="divider"></div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="cv">${fmtAed(totalFitoutBudget)}</div><div class="cl">Total Fitout</div></div>
    <div class="kpi-card"><div class="cv">${costPerSqm.toLocaleString()}</div><div class="cl">AED/m²</div></div>
    <div class="kpi-card"><div class="cv" style="color:${gradeColor(sustainabilityGrade)}">${sustainabilityGrade}</div><div class="cl">Sust. Grade</div></div>
  </div>
  <div class="meta" style="margin-top:20px">${date}</div>
  <div class="watermark">Document ID: ${watermark}${shareToken ? ` · Share: /share/${shareToken}` : ""}</div>
</div>

<!-- SECTION A: DESIGN IDENTITY -->
<div class="section">
  <h2>A · Design Identity</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Typology</div><div class="kpi-value" style="font-size:11px">${typology}</div></div>
    <div class="kpi"><div class="kpi-label">Style</div><div class="kpi-value" style="font-size:11px">${style}</div></div>
    <div class="kpi"><div class="kpi-label">Tier</div><div class="kpi-value" style="font-size:11px">${tier}</div></div>
    <div class="kpi"><div class="kpi-label">Location</div><div class="kpi-value" style="font-size:11px">${location}</div></div>
  </div>
  ${execSummary ? `<p class="exec-body">${execSummary}</p>` : ""}
  ${ddPills ? `<div class="panel" style="margin-top:8px">${ddPills}</div>` : ""}
</div>

<!-- SECTION B: MATERIAL SPEC -->
${materials.length > 0 ? `
<div class="section">
  <h2>B · Material Specification</h2>
  <table>
    <thead><tr><th>Product</th><th>Brand</th><th>Space</th><th>Price Range</th></tr></thead>
    <tbody>${matRows}</tbody>
  </table>
  ${materialConstants.length > 0 ? `
  <h3>UAE Market Constants (AED/m²)</h3>
  <table>
    <thead><tr><th>Material</th><th>Cost/m²</th><th>Carbon</th><th>Grade</th></tr></thead>
    <tbody>${constRows}</tbody>
  </table>` : ""}
</div>
` : ""}

<!-- SECTION C: BUDGET SYNTHESIS -->
<div class="section">
  <h2>C · Budget Synthesis</h2>
  <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
    <div class="kpi"><div class="kpi-label">Total Fitout Budget</div><div class="kpi-value" style="font-size:13px">${fmtAed(totalFitoutBudget)}</div></div>
    <div class="kpi"><div class="kpi-label">Cost / m²</div><div class="kpi-value" style="font-size:13px">${costPerSqm.toLocaleString()} AED</div></div>
    <div class="kpi"><div class="kpi-label">GFA</div><div class="kpi-value" style="font-size:13px">${gfaSqm.toLocaleString()} sqm</div></div>
  </div>
  ${spaceBars ? `<h3>Budget by Space</h3><div class="panel">${spaceBars}</div>` : ""}
  ${bmSection}
</div>

${spaceEfficiency ? `
<!-- SECTION C½: SPACE PLANNING INTELLIGENCE -->
<div class="section">
  <h2>C½ · Space Planning Intelligence</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Efficiency Score</div><div class="kpi-value" style="color:${spaceEfficiency.efficiencyScore >= 75 ? '#10b981' : spaceEfficiency.efficiencyScore >= 50 ? '#f59e0b' : '#ef4444'}">${spaceEfficiency.efficiencyScore}/100</div></div>
    <div class="kpi"><div class="kpi-label">Critical Issues</div><div class="kpi-value" style="color:${spaceEfficiency.criticalCount > 0 ? '#ef4444' : '#10b981'}">${spaceEfficiency.criticalCount}</div></div>
    <div class="kpi"><div class="kpi-label">Advisory Issues</div><div class="kpi-value" style="color:#f59e0b">${spaceEfficiency.advisoryCount}</div></div>
    <div class="kpi"><div class="kpi-label">Circulation</div><div class="kpi-value">${spaceEfficiency.circulationPct?.toFixed(1)}%</div></div>
  </div>
  ${spaceEfficiency.rooms.length > 0 ? `
  <h3>Room Allocation vs DLD Benchmark</h3>
  <div class="panel">
    ${spaceEfficiency.rooms.slice(0, 10).map(r => `
    <div class="bar-row">
      <span class="bar-label">${r.name}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.min(r.currentPct, 100).toFixed(1)}%;background:${r.severity === 'critical' ? '#ef4444' : r.severity === 'advisory' ? '#f59e0b' : '#10b981'}"></div>
      </div>
      <span class="bar-pct">${r.currentPct?.toFixed(0)}%</span>
      <span class="bar-amt" style="font-weight:400;color:#94a3b8">vs ${r.benchmarkPct?.toFixed(0)}%</span>
    </div>`).join('')}
  </div>` : ''}
</div>
` : ''}

<!-- SECTION D: ROI BRIDGE -->
<div class="section">
  <h2>D · ROI Bridge</h2>
  <div class="roi-grid">
    <div class="roi-card">
      <div class="roi-label">Sustainability Grade</div>
      <div style="margin-top: 6px; display: flex; align-items: center; gap: 10px;">
        <div class="grade-chip" style="background:${gradeColor(sustainabilityGrade)}">${sustainabilityGrade}</div>
        <div class="roi-sub">Based on material selection and tier for ${location}</div>
      </div>
    </div>
    <div class="roi-card">
      <div class="roi-label">Design Premium Potential</div>
      <div class="roi-big text-emerald">+${salePremiumPct}%</div>
      <div class="roi-sub">≈ ${fmtAed(estimatedSalesPremiumAed)} uplift vs. standard fitout</div>
    </div>
    <div class="roi-card" style="grid-column: span 2">
      <div class="roi-label">ROI Summary</div>
      <div style="display: flex; gap: 30px; margin-top: 6px; font-size: 9px;">
        <div><div style="color: #64748b">Fitout Investment</div><div style="font-weight:700; color:#0f3460">${fmtAed(totalFitoutBudget)}</div></div>
        <div><div style="color: #64748b">Design Premium</div><div style="font-weight:700; color:#10b981">+${fmtAed(estimatedSalesPremiumAed)}</div></div>
        <div><div style="color: #64748b">Net Uplift</div><div style="font-weight:700; color:${estimatedSalesPremiumAed > totalFitoutBudget ? "#10b981" : "#f59e0b"}">${fmtAed(estimatedSalesPremiumAed - totalFitoutBudget)}</div></div>
      </div>
    </div>
  </div>
</div>

<!-- SECTION E: MARKET INTELLIGENCE -->
${(designTrends ?? []).length > 0 ? `
<div class="section">
  <h2>E · Market Intelligence</h2>
  ${trendRows ? `
  <h3>UAE Design Trends (${style} · UAE)</h3>
  <div class="panel">${trendRows}</div>` : ""}
</div>
` : ""}

<!-- FOOTER -->
<div class="footer">
  MIYAR Decision Intelligence Platform · Investor Brief · ${date} · ${watermark}<br>
  This document is auto-generated. All estimates are indicative and should be professionally validated before investment decisions.
  ${shareToken ? `· Accessible at /share/${shareToken}` : ""}
</div>

</body>
</html>`;
}
