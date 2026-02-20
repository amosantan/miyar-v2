/**
 * Board PDF Generator (V4-06)
 * Generates A4 landscape HTML for material board export.
 * Includes tile grid, cost summary, RFQ-ready line items, and procurement notes.
 */

import type { BoardSummary, RfqLine } from "./board-composer";

export interface BoardPdfItem {
  materialId: number;
  name: string;
  category: string;
  tier: string;
  costLow: number;
  costHigh: number;
  costUnit: string;
  leadTimeDays: number;
  leadTimeBand: string;
  supplierName: string;
  specNotes?: string;
  costBandOverride?: string;
  quantity?: string;
  unitOfMeasure?: string;
  notes?: string;
}

export interface BoardPdfInput {
  boardName: string;
  projectName: string;
  items: BoardPdfItem[];
  summary: BoardSummary;
  rfqLines: RfqLine[];
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function tierColor(tier: string): string {
  const map: Record<string, string> = {
    economy: "#6b7280",
    mid: "#3b82f6",
    premium: "#8b5cf6",
    luxury: "#d97706",
    ultra_luxury: "#e11d48",
  };
  return map[tier] || "#6b7280";
}

function leadBadgeColor(band: string): string {
  const map: Record<string, string> = {
    short: "#16a34a",
    medium: "#ca8a04",
    long: "#ea580c",
    critical: "#dc2626",
  };
  return map[band] || "#ca8a04";
}

export function generateBoardPdfHtml(input: BoardPdfInput): string {
  const { boardName, projectName, items, summary, rfqLines } = input;
  const date = formatDate();
  const watermark = `MYR-BRD-${Date.now().toString(36)}`;

  // ─── Tile Grid ──────────────────────────────────────────────────────────────
  const tileCards = items.map((item, idx) => `
    <div class="tile-card">
      <div class="tile-header">
        <span class="tile-num">${idx + 1}</span>
        <span class="tile-name">${item.name}</span>
        <span class="tier-badge" style="background:${tierColor(item.tier)}">${item.tier.replace("_", " ")}</span>
      </div>
      <div class="tile-body">
        <div class="tile-row"><span class="tile-label">Category</span><span>${item.category}</span></div>
        <div class="tile-row"><span class="tile-label">Cost Range</span><span>${item.costLow.toLocaleString()} – ${item.costHigh.toLocaleString()} ${item.costUnit}</span></div>
        <div class="tile-row"><span class="tile-label">Lead Time</span><span style="color:${leadBadgeColor(item.leadTimeBand)}">${item.leadTimeDays}d (${item.leadTimeBand})</span></div>
        <div class="tile-row"><span class="tile-label">Supplier</span><span>${item.supplierName}</span></div>
        ${item.quantity ? `<div class="tile-row"><span class="tile-label">Quantity</span><span>${item.quantity} ${item.unitOfMeasure || ""}</span></div>` : ""}
        ${item.costBandOverride ? `<div class="tile-row"><span class="tile-label">Cost Band</span><span class="cost-band-badge">${item.costBandOverride}</span></div>` : ""}
        ${item.specNotes ? `<div class="tile-spec">${item.specNotes}</div>` : ""}
        ${item.notes ? `<div class="tile-notes">${item.notes}</div>` : ""}
      </div>
    </div>
  `).join("");

  // ─── RFQ Table ──────────────────────────────────────────────────────────────
  const rfqRows = rfqLines.map(line => `
    <tr>
      <td>${line.lineNo}</td>
      <td class="font-medium">${line.materialName}</td>
      <td>${line.category}</td>
      <td>${line.specification}</td>
      <td>${line.quantity}</td>
      <td>${line.unit}</td>
      <td class="text-right">${line.estimatedUnitCostLow.toLocaleString()}</td>
      <td class="text-right">${line.estimatedUnitCostHigh.toLocaleString()}</td>
      <td>${line.leadTimeDays}d</td>
      <td>${line.supplierSuggestion}</td>
      <td>${line.notes}</td>
    </tr>
  `).join("");

  // ─── Tier Distribution ──────────────────────────────────────────────────────
  const tierDistRows = Object.entries(summary.tierDistribution).map(([tier, count]) => `
    <div class="dist-item">
      <span class="dist-badge" style="background:${tierColor(tier)}">${tier.replace("_", " ")}</span>
      <span class="dist-count">${count}</span>
    </div>
  `).join("");

  const catDistRows = Object.entries(summary.categoryDistribution).map(([cat, count]) => `
    <div class="dist-item">
      <span class="dist-label">${cat}</span>
      <span class="dist-count">${count}</span>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; line-height: 1.5; font-size: 10px; }

  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 70vh; text-align: center; }
  .cover .logo { font-size: 32px; font-weight: 800; color: #0f3460; letter-spacing: 3px; margin-bottom: 24px; }
  .cover h1 { font-size: 24px; color: #0f3460; margin-bottom: 6px; }
  .cover h2 { font-size: 14px; color: #4ecdc4; font-weight: 400; margin-bottom: 16px; }
  .cover .project { font-size: 18px; color: #1a1a2e; font-weight: 600; }
  .cover .date { font-size: 11px; color: #666; margin-top: 12px; }
  .cover .confidential { font-size: 9px; color: #999; margin-top: 32px; text-transform: uppercase; letter-spacing: 2px; }
  .cover .watermark { font-size: 8px; color: #ccc; margin-top: 6px; font-family: monospace; }

  h2 { font-size: 14px; color: #0f3460; border-bottom: 2px solid #4ecdc4; padding-bottom: 4px; margin: 20px 0 10px; }
  h3 { font-size: 12px; color: #0f3460; margin: 14px 0 6px; }

  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
  .summary-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; text-align: center; }
  .summary-card .label { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .summary-card .value { font-size: 20px; font-weight: 700; color: #0f3460; margin: 2px 0; }
  .summary-card .sub { font-size: 9px; color: #888; }

  .tile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
  .tile-card { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .tile-header { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
  .tile-num { font-size: 10px; font-weight: 700; color: #0f3460; background: #e8f4fd; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .tile-name { font-size: 10px; font-weight: 600; flex: 1; }
  .tier-badge { font-size: 8px; color: #fff; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
  .tile-body { padding: 8px 10px; }
  .tile-row { display: flex; justify-content: space-between; font-size: 9px; padding: 2px 0; border-bottom: 1px dotted #f0f0f0; }
  .tile-label { color: #666; font-weight: 500; }
  .tile-spec { font-size: 9px; color: #0f3460; background: #e8f4fd; padding: 4px 6px; border-radius: 3px; margin-top: 4px; font-style: italic; }
  .tile-notes { font-size: 8px; color: #888; margin-top: 3px; }
  .cost-band-badge { background: #fef3c7; color: #92400e; padding: 0 4px; border-radius: 2px; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9px; }
  th { background: #0f3460; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .text-right { text-align: right; }
  .font-medium { font-weight: 600; }

  .dist-grid { display: flex; gap: 16px; margin: 8px 0; flex-wrap: wrap; }
  .dist-item { display: flex; align-items: center; gap: 6px; }
  .dist-badge { font-size: 8px; color: #fff; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; }
  .dist-label { font-size: 9px; color: #444; }
  .dist-count { font-size: 11px; font-weight: 700; color: #0f3460; }

  .critical-list { margin: 8px 0; }
  .critical-item { background: #fef2f2; border-left: 3px solid #dc2626; padding: 4px 8px; margin: 3px 0; font-size: 9px; color: #991b1b; }

  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 8px; color: #999; text-align: center; }
  .section { page-break-inside: avoid; margin-bottom: 16px; }
</style>
</head>
<body>

<div class="cover">
  <div class="logo">MIYAR</div>
  <h1>Material Board</h1>
  <h2>${boardName}</h2>
  <div class="project">${projectName}</div>
  <div class="date">${date}</div>
  <div class="confidential">Confidential — For Internal Use Only</div>
  <div class="watermark">Document ID: ${watermark}</div>
</div>

<div class="section">
  <h2>Board Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Items</div>
      <div class="value">${summary.totalItems}</div>
    </div>
    <div class="summary-card">
      <div class="label">Estimated Cost Range</div>
      <div class="value" style="font-size:14px">${summary.estimatedCostLow.toLocaleString()} – ${summary.estimatedCostHigh.toLocaleString()}</div>
      <div class="sub">${summary.currency}</div>
    </div>
    <div class="summary-card">
      <div class="label">Longest Lead Time</div>
      <div class="value">${summary.longestLeadTimeDays}d</div>
    </div>
    <div class="summary-card">
      <div class="label">Critical Path Items</div>
      <div class="value">${summary.criticalPathItems.length}</div>
    </div>
  </div>

  <h3>Tier Distribution</h3>
  <div class="dist-grid">${tierDistRows}</div>

  <h3>Category Distribution</h3>
  <div class="dist-grid">${catDistRows}</div>

  ${summary.criticalPathItems.length > 0 ? `
  <h3>Critical Path Items</h3>
  <div class="critical-list">
    ${summary.criticalPathItems.map(item => `<div class="critical-item">${item}</div>`).join("")}
  </div>
  ` : ""}
</div>

<div class="section">
  <h2>Material Tiles</h2>
  <div class="tile-grid">
    ${tileCards}
  </div>
</div>

<div class="section">
  <h2>RFQ-Ready Procurement Schedule</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Material</th>
        <th>Category</th>
        <th>Specification</th>
        <th>Qty</th>
        <th>Unit</th>
        <th class="text-right">Cost Low (AED)</th>
        <th class="text-right">Cost High (AED)</th>
        <th>Lead</th>
        <th>Supplier</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rfqRows}
    </tbody>
  </table>
</div>

<div class="footer">
  MIYAR Decision Intelligence Platform — Material Board Export — ${date} — ${watermark}<br/>
  This document is auto-generated. All cost estimates are indicative and subject to supplier confirmation.
</div>

</body>
</html>`;
}
