/**
 * Material-board HTML export. It is a standalone printable artifact, not an
 * annex for any other report type.
 */
import type { ReportLocale } from "../../shared/report-locale";
import { randomUUID } from "node:crypto";
import { reportDirection, reportLocaleOrDefault } from "../../shared/report-locale";
import {
  formatReportDateTime,
  formatReportNumber,
  reportCopy,
  reportLocaleCss,
} from "./report-catalog";
import { createRenderFingerprintPayload, createReportRenderContext, type ReportRenderContext } from "./report-render-context";
import { escapeReportText } from "./report-safe-output";
import type { BoardSummary, RfqLine } from "./board-composer";

export interface BoardPdfItem {
  materialId: number;
  name: string;
  category: string;
  tier: string;
  costLow: number | null;
  costHigh: number | null;
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
  locale?: ReportLocale;
  documentId?: string;
  generatedAt?: Date | string;
  artifactVersion?: string;
  rendererVersion?: string;
  modelVersion?: string | null;
  benchmarkVersion?: string | null;
  logicVersion?: string | null;
  renderContext?: ReportRenderContext;
}

const BOARD_COPY = {
  en: {
    boardSummary: "Board Summary", totalItems: "Total Items", estimatedCostRange: "Browse-only Catalog Estimate",
    longestLeadTime: "Longest Lead Time", criticalPathItems: "Critical Path Items", tierDistribution: "Tier Distribution",
    categoryDistribution: "Category Distribution", materialTiles: "Material Tiles", rfqSchedule: "Concept Schedule — Not RFQ-Ready",
    material: "Material", specification: "Specification", quantity: "Quantity", unit: "Unit", costLow: "Browse Low (AED)",
    costHigh: "Browse High (AED)", lead: "Lead", supplier: "Supplier", costRange: "Browse Estimate", leadTime: "Lead Time",
    costBand: "Cost Band", criticalLeadBand: "critical", generatedNotice: "This document is auto-generated. All cost estimates are indicative and subject to supplier confirmation.",
  },
  ar: {
    boardSummary: "ملخص اللوحة", totalItems: "إجمالي العناصر", estimatedCostRange: "تقدير الكتالوج للاستعراض فقط",
    longestLeadTime: "أطول مدة توريد", criticalPathItems: "عناصر المسار الحرج", tierDistribution: "توزيع الشرائح",
    categoryDistribution: "توزيع الفئات", materialTiles: "بطاقات المواد", rfqSchedule: "جدول مبدئي — غير جاهز لطلب عروض الأسعار",
    material: "المادة", specification: "المواصفة", quantity: "الكمية", unit: "الوحدة", costLow: "تقدير أدنى للاستعراض (درهم)",
    costHigh: "تقدير أعلى للاستعراض (درهم)", lead: "مدة التوريد", supplier: "المورّد", costRange: "تقدير للاستعراض", leadTime: "مدة التوريد",
    costBand: "شريحة التكلفة", criticalLeadBand: "حرج", generatedNotice: "تم إنشاء هذا المستند آلياً. جميع تقديرات التكلفة استرشادية وتخضع لتأكيد المورّد.",
  },
} as const;

function finite(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return `<span dir="auto" data-report-dynamic>${escapeReportText(value)}</span>`;
}

function number(value: number, locale: ReportLocale): string {
  return formatReportNumber(value, locale);
}

function browseNumber(value: number | null, locale: ReportLocale): string {
  return value === null ? "—" : number(value, locale);
}

function tierColor(tier: string): string {
  return ({ economy: "#6b7280", mid: "#3b82f6", premium: "#8b5cf6", luxury: "#d97706", ultra_luxury: "#e11d48" } as Record<string, string>)[tier] ?? "#6b7280";
}

function leadBadgeColor(band: string): string {
  return ({ short: "#16a34a", medium: "#ca8a04", long: "#ea580c", critical: "#dc2626" } as Record<string, string>)[band] ?? "#ca8a04";
}

function renderMetadata(context: ReturnType<typeof createReportRenderContext>, locale: ReportLocale): string {
  const c = (key: Parameters<typeof reportCopy>[1]) => reportCopy(locale, key);
  const value = (entry: string | null) => text(entry ?? c("notAvailable"));
  return `<div class="render-meta">
    <div><b>${c("documentId")}:</b> ${text(context.documentId)}</div>
    <div><b>${c("generatedAt")}:</b> ${text(formatReportDateTime(context.generatedAt, locale))}</div>
    <div><b>${c("renderInputFingerprint")}:</b> ${text(context.renderInputFingerprint)}</div>
    <div><b>${c("artifactVersion")}:</b> ${value(context.artifactVersion)} · <b>${c("rendererVersion")}:</b> ${value(context.rendererVersion)}</div>
    <div><b>${c("modelVersion")}:</b> ${value(context.modelVersion)} · <b>${c("benchmarkVersion")}:</b> ${value(context.benchmarkVersion)} · <b>${c("logicVersion")}:</b> ${value(context.logicVersion)}</div>
  </div>`;
}

/** Builds a board-export context from only the values rendered by the board surface. */
export function createBoardPdfRenderContext(input: BoardPdfInput): ReportRenderContext {
  const locale = reportLocaleOrDefault(input.locale);
  const { boardName, projectName, items, summary, rfqLines } = input;
  const versions = {
    artifactVersion: input.artifactVersion ?? "material-board-html-v1",
    rendererVersion: input.rendererVersion ?? "standalone-html-v1",
    modelVersion: input.modelVersion ?? null,
    benchmarkVersion: input.benchmarkVersion ?? null,
    logicVersion: input.logicVersion ?? null,
  };
  return createReportRenderContext({
    documentId: input.documentId ?? `MYR-BRD-${randomUUID().toUpperCase()}`,
    generatedAt: input.generatedAt,
    locale,
    ...versions,
    fingerprintInput: createRenderFingerprintPayload("material_board", locale, versions, {
      project: { name: projectName },
      board: {
        name: boardName,
        items: items.map(item => ({
          name: item.name, category: item.category, tier: item.tier,
          costLow: finite(item.costLow), costHigh: finite(item.costHigh), costUnit: item.costUnit,
          leadTimeDays: finite(item.leadTimeDays), leadTimeBand: item.leadTimeBand, supplierName: item.supplierName,
          quantity: item.quantity, unitOfMeasure: item.unitOfMeasure, specNotes: item.specNotes,
          costBandOverride: item.costBandOverride, notes: item.notes,
        })),
        summary: {
        totalItems: finite(summary.totalItems), estimatedCostLow: finite(summary.estimatedCostLow), estimatedCostHigh: finite(summary.estimatedCostHigh),
        currency: summary.currency, longestLeadTimeDays: finite(summary.longestLeadTimeDays), criticalPathItems: summary.criticalPathItems,
        tierDistribution: Object.fromEntries(Object.entries(summary.tierDistribution).map(([key, value]) => [key, finite(value)])),
        categoryDistribution: Object.fromEntries(Object.entries(summary.categoryDistribution).map(([key, value]) => [key, finite(value)])),
        },
        rfqLines: rfqLines.map(line => ({
          lineNo: finite(line.lineNo), materialName: line.materialName, category: line.category,
          specification: line.specification, quantity: line.quantity, unit: line.unit,
          estimatedUnitCostLow: finite(line.estimatedUnitCostLow), estimatedUnitCostHigh: finite(line.estimatedUnitCostHigh),
          leadTimeDays: finite(line.leadTimeDays), supplierSuggestion: line.supplierSuggestion, notes: line.notes,
        })),
      },
    }),
  });
}

export function generateBoardPdfHtml(input: BoardPdfInput): string {
  const locale = reportLocaleOrDefault(input.locale);
  const c = (key: Parameters<typeof reportCopy>[1]) => reportCopy(locale, key);
  const labels = BOARD_COPY[locale];
  const { boardName, projectName, items, summary, rfqLines } = input;
  const context = input.renderContext ?? createBoardPdfRenderContext(input);

  const tileCards = items.map((item, index) => `<div class="tile-card">
    <div class="tile-header"><span class="tile-num">${number(index + 1, locale)}</span><span class="tile-name">${text(item.name)}</span><span class="tier-badge" style="background:${tierColor(item.tier)}">${text(item.tier.replace(/_/g, " "))}</span></div>
    <div class="tile-body">
      <div class="tile-row"><span class="tile-label">${c("category")}</span>${text(item.category)}</div>
      <div class="tile-row"><span class="tile-label">${labels.costRange}</span><span>${browseNumber(item.costLow, locale)} – ${browseNumber(item.costHigh, locale)} ${text(item.costUnit)}</span></div>
      <div class="tile-row"><span class="tile-label">${labels.leadTime}</span><span style="color:${leadBadgeColor(item.leadTimeBand)}">${number(item.leadTimeDays, locale)}d (${item.leadTimeBand === "critical" ? labels.criticalLeadBand : text(item.leadTimeBand)})</span></div>
      <div class="tile-row"><span class="tile-label">${labels.supplier}</span>${text(item.supplierName)}</div>
      ${item.quantity ? `<div class="tile-row"><span class="tile-label">${labels.quantity}</span><span>${text(item.quantity)} ${text(item.unitOfMeasure ?? "")}</span></div>` : ""}
      ${item.costBandOverride ? `<div class="tile-row"><span class="tile-label">${labels.costBand}</span><span class="cost-band-badge">${text(item.costBandOverride)}</span></div>` : ""}
      ${item.specNotes ? `<div class="tile-spec">${text(item.specNotes)}</div>` : ""}
      ${item.notes ? `<div class="tile-notes">${text(item.notes)}</div>` : ""}
    </div></div>`).join("");

  const rfqRows = rfqLines.map(line => `<tr><td>${number(line.lineNo, locale)}</td><td class="font-medium">${text(line.materialName)}</td><td>${text(line.category)}</td><td>${text(line.specification)}</td><td>${text(line.quantity)}</td><td>${text(line.unit)}</td><td class="text-end">${browseNumber(line.estimatedUnitCostLow, locale)}</td><td class="text-end">${browseNumber(line.estimatedUnitCostHigh, locale)}</td><td>${number(line.leadTimeDays, locale)}d</td><td>${text(line.supplierSuggestion)}</td><td>${text(line.notes)}</td></tr>`).join("");
  const tierRows = Object.entries(summary.tierDistribution).map(([tier, count]) => `<div class="dist-item"><span class="dist-badge" style="background:${tierColor(tier)}">${text(tier.replace(/_/g, " "))}</span><span class="dist-count">${number(count, locale)}</span></div>`).join("");
  const categoryRows = Object.entries(summary.categoryDistribution).map(([category, count]) => `<div class="dist-item"><span class="dist-label">${text(category)}</span><span class="dist-count">${number(count, locale)}</span></div>`).join("");
  const criticalItems = summary.criticalPathItems.map(item => `<div class="critical-item">${text(item)}</div>`).join("");

  return `<!DOCTYPE html><html lang="${locale}" dir="${reportDirection(locale)}"><head><meta charset="utf-8"><title>${escapeReportText(`${c("materialBoard")} — ${boardName}`)}</title><style>
    @page { size: A4 landscape; margin: 15mm 12mm; } * { box-sizing: border-box; margin: 0; padding: 0; }
    ${reportLocaleCss(locale)} body { color:#1a1a2e; line-height:1.5; font-size:10px; } .cover { page-break-after:always; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:70vh; text-align:center; }
    .logo { font-size:32px; font-weight:800; color:#0f3460; letter-spacing:3px; margin-block-end:24px; } .cover h1 { font-size:24px; color:#0f3460; margin-block-end:6px; } .cover h2 { font-size:14px; color:#4ecdc4; font-weight:400; margin-block-end:16px; } .project { font-size:18px; font-weight:600; } .date,.confidential,.watermark { font-size:9px; color:#666; margin-block-start:12px; } .confidential,.watermark { color:#999; text-transform:uppercase; letter-spacing:2px; } .watermark { font-family:monospace; }
    h2 { font-size:14px; color:#0f3460; border-block-end:2px solid #4ecdc4; padding-block-end:4px; margin:20px 0 10px; } h3 { font-size:12px; color:#0f3460; margin:14px 0 6px; } .section { break-inside:avoid; margin-block-end:16px; } .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:12px 0; } .summary-card { border:1px solid #e0e0e0; border-radius:6px; padding:10px; text-align:center; } .label { font-size:8px; color:#666; text-transform:uppercase; letter-spacing:1px; } .value { font-size:20px; font-weight:700; color:#0f3460; margin:2px 0; } .sub { font-size:9px; color:#888; }
    .tile-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:12px 0; } .tile-card { border:1px solid #e0e0e0; border-radius:6px; overflow:hidden; break-inside:avoid; } .tile-header { display:flex; align-items:center; gap:6px; padding:6px 10px; background:#f8f9fa; border-block-end:1px solid #e0e0e0; } .tile-num { font-weight:700; background:#e8f4fd; border-radius:50%; inline-size:20px; block-size:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0; } .tile-name { font-weight:600; flex:1; } .tier-badge,.dist-badge { font-size:8px; color:#fff; padding:1px 6px; border-radius:3px; text-transform:uppercase; } .tile-body { padding:8px 10px; } .tile-row { display:flex; justify-content:space-between; gap:8px; padding-block:2px; border-block-end:1px dotted #f0f0f0; } .tile-label,.dist-label { color:#666; font-weight:500; } .tile-spec { color:#0f3460; background:#e8f4fd; padding:4px 6px; border-radius:3px; margin-block-start:4px; font-style:italic; } .tile-notes { color:#888; margin-block-start:3px; } .cost-band-badge { background:#fef3c7; color:#92400e; padding-inline:4px; border-radius:2px; font-weight:600; }
    table { width:100%; border-collapse:collapse; margin:10px 0; font-size:9px; } th { background:#0f3460; color:#fff; padding:6px 8px; font-weight:600; } td { padding:5px 8px; border-block-end:1px solid #e0e0e0; } tr:nth-child(even) td { background:#f8f9fa; } .text-end { text-align:end; } .font-medium { font-weight:600; } .dist-grid { display:flex; gap:16px; margin:8px 0; flex-wrap:wrap; } .dist-item { display:flex; align-items:center; gap:6px; } .dist-count { font-weight:700; color:#0f3460; } .critical-item { background:#fef2f2; border-inline-start:3px solid #dc2626; padding:4px 8px; margin-block:3px; color:#991b1b; } .render-meta { margin:10px auto; max-inline-size:620px; padding:8px 10px; border:1px solid #d0d7de; background:#f0f4f8; font-size:8px; text-align:start; overflow-wrap:anywhere; } .closing { break-inside:avoid-page; page-break-inside:avoid; } .footer { margin-block-start:12px; padding-block-start:10px; border-block-start:1px solid #e0e0e0; font-size:8px; color:#999; text-align:center; break-before:avoid-page; page-break-before:avoid; }
  </style></head><body><div class="cover"><div class="logo">MIYAR</div><h1>${c("materialBoard")}</h1><h2>${text(boardName)}</h2><div class="project">${text(projectName)}</div><div class="date">${text(formatReportDateTime(context.generatedAt, locale))}</div><div class="confidential">${c("confidentialInternalOnly")}</div>${renderMetadata(context, locale)}</div>
  <div class="section"><h2>${labels.boardSummary}</h2><div class="summary-grid"><div class="summary-card"><div class="label">${labels.totalItems}</div><div class="value">${number(summary.totalItems, locale)}</div></div><div class="summary-card"><div class="label">${labels.estimatedCostRange}</div><div class="value" style="font-size:14px">${browseNumber(summary.estimatedCostLow, locale)} – ${browseNumber(summary.estimatedCostHigh, locale)}</div><div class="sub">${text(summary.currency)}</div></div><div class="summary-card"><div class="label">${labels.longestLeadTime}</div><div class="value">${number(summary.longestLeadTimeDays, locale)}d</div></div><div class="summary-card"><div class="label">${labels.criticalPathItems}</div><div class="value">${number(summary.criticalPathItems.length, locale)}</div></div></div><h3>${labels.tierDistribution}</h3><div class="dist-grid">${tierRows}</div><h3>${labels.categoryDistribution}</h3><div class="dist-grid">${categoryRows}</div>${summary.criticalPathItems.length > 0 ? `<h3>${labels.criticalPathItems}</h3><div>${criticalItems}</div>` : ""}</div>
  <div class="section"><h2>${labels.materialTiles}</h2><div class="tile-grid">${tileCards}</div></div><div class="closing"><div class="section"><h2>${labels.rfqSchedule}</h2><table><thead><tr><th>#</th><th>${labels.material}</th><th>${c("category")}</th><th>${labels.specification}</th><th>${labels.quantity}</th><th>${labels.unit}</th><th class="text-end">${labels.costLow}</th><th class="text-end">${labels.costHigh}</th><th>${labels.lead}</th><th>${labels.supplier}</th><th>${c("notes")}</th></tr></thead><tbody>${rfqRows}</tbody></table></div><div class="footer">MIYAR · ${c("materialBoard")} · ${text(formatReportDateTime(context.generatedAt, locale))}<br>${labels.generatedNotice}</div></div></body></html>`;
}
