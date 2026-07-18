import { execFile } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import { createDesignBriefDocxRenderContext, generateDesignBriefDocx } from "../server/engines/docx-brief";
import { createBoardPdfRenderContext, generateBoardPdfHtml } from "../server/engines/board-pdf";
import { createInvestorPdfRenderContext, generateInvestorPdfHtml } from "../server/engines/investor-pdf";
import { createPdfReportRenderContext, generateAutonomousBriefHTML, generateDesignBriefHTML, generateFullReportHTML, generatePortfolioReportHTML, generateScenarioComparisonHTML, generateValidationSummaryHTML } from "../server/engines/pdf-report";
import { TR10_FIXTURES, TR10_PAIRWISE_MATRIX, type Tr10FixtureId } from "../tests/fixtures/reports/tr10-report-fixtures";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(ROOT, "tmp", "tr10-report-qa");
const NOW = "2026-07-18T08:00:00.000Z";
type Surface = (typeof TR10_PAIRWISE_MATRIX)[number][0];
type ManifestEntry = { fixture: Tr10FixtureId; surface: Surface; html?: string; pdf?: string; docx?: string; pageCount: number; checks: Record<string, boolean>; inspectedPages: string[]; status: "pass" | "fail"; error?: string };
const ARABIC_SMOKE_SURFACES = ["validation_summary", "design_brief", "autonomous_design_brief", "board", "scenario", "portfolio"] as const satisfies readonly Surface[];
const CERTIFICATION_MATRIX = [
  ...TR10_PAIRWISE_MATRIX,
  ...ARABIC_SMOKE_SURFACES.map(surface => [surface, "arabic_bidi"] as const),
] as const;

function safeName(value: string) { return value.replace(/[^a-z0-9_-]/gi, "-"); }
function renderContext(surface: Surface, fixtureId: Tr10FixtureId) {
  const fixture = TR10_FIXTURES[fixtureId];
  const overrides = { documentId: `MYR-QA-${surface}-${fixtureId}`, generatedAt: NOW, artifactVersion: "tr10-qa-v1", rendererVersion: "playwright-chromium", modelVersion: "synthetic-model-v1", benchmarkVersion: "synthetic-benchmark-v1", logicVersion: "synthetic-logic-v1" };
  if (surface === "board") return createBoardPdfRenderContext({ ...fixture.board, ...overrides });
  if (surface === "investor") return createInvestorPdfRenderContext({ ...fixture.investor, ...overrides });
  if (surface === "docx") return createDesignBriefDocxRenderContext(fixture.docx, overrides);
  if (surface === "scenario") return createPdfReportRenderContext("scenario_comparison", fixture.scenario, overrides);
  if (surface === "portfolio") return createPdfReportRenderContext("portfolio", fixture.portfolio, overrides);
  return createPdfReportRenderContext(surface, fixture.report, overrides);
}
function normalizeNumericText(value: string): string {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return value.replace(/[٠-٩]/g, digit => String(arabicDigits.indexOf(digit))).replace(/[,.،٬\s]/g, "");
}
function normalizeExtractedText(value: string): string {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\s]/g, "");
}
function containsExactNumber(html: string, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return normalizeNumericText(html).includes(String(value).replace(".", ""));
}
function sourceValuesCheck(html: string, surface: Surface, fixtureId: Tr10FixtureId): boolean {
  const fixture = TR10_FIXTURES[fixtureId];
  if (surface === "board") return containsExactNumber(html, fixture.expected.exactTotals.boardCostLow);
  if (surface === "investor") return containsExactNumber(html, fixture.expected.exactTotals.fitoutBudget);
  if (surface === "full_report") return containsExactNumber(html, Number(fixture.report.roi?.totalValue ?? 0));
  if (surface === "portfolio") return containsExactNumber(html, fixture.portfolio.totalProjects);
  if (surface === "scenario") return containsExactNumber(html, Number(fixture.scenario.baselineScenario.scores?.compositeScore ?? 0));
  return fixture.expected.requiredText.every(text => html.includes(text));
}
function commonChecks(
  html: string,
  locale: "en" | "ar",
  surface: Surface,
  fixtureId: Tr10FixtureId,
  inspection: Awaited<ReturnType<typeof inspectPdf>>,
  browserChecks: Awaited<ReturnType<typeof htmlPdf>>,
) {
  const requiresAnnex = surface === "design_brief" || surface === "full_report";
  return {
    langDir: html.includes(`<html lang="${locale}"`) && html.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`),
    identity: /Document ID|معرّف المستند/.test(html) && /Render-input fingerprint|بصمة مدخلات العرض/.test(html),
    localizedStaticCopy: locale !== "ar" || /معرّف المستند/.test(html) && /بصمة مدخلات العرض/.test(html),
    disclaimer: /disclaimer|indicative|advisory|استرشادي|استشارية|إخلاء مسؤولية/i.test(html),
    finite: !/\b(?:NaN|Infinity)\b/.test(html),
    noExecutableMarkup: !/<script\b|<[^>]+\bon\w+\s*=|(?:href|src)\s*=\s*["']?\s*javascript:/i.test(html),
    annexBoundary: requiresAnnex ? html.includes("Material Board Annex") || html.includes("ملحق لوحة المواد") : !html.includes("Material Board Annex"),
    sourceValues: sourceValuesCheck(html, surface, fixtureId),
    noHorizontalOverflow: !browserChecks.horizontalOverflow,
    noBrokenAssets: browserChecks.brokenAssets === 0,
    noBlankPages: inspection.blankPages.length === 0,
    arabicGlyphText: locale !== "ar" || inspection.arabicTextPresent,
  };
}
async function command(command: string, args: string[], cwd: string) { return run(command, args, { cwd, timeout: 45_000, maxBuffer: 5_000_000, env: { ...process.env, HOME: cwd } }); }
async function inspectPdf(pdf: string, imageDir: string, options: { docx?: boolean } = {}) {
  const { stdout } = await command("pdfinfo", [pdf], OUTPUT); const match = /^Pages:\s+(\d+)/m.exec(stdout); const pageCount = Number(match?.[1] ?? 0);
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new Error(`pdfinfo did not report pages for ${pdf}`);
  const text = (await command("pdftotext", [pdf, "-"], OUTPUT)).stdout;
  await command("pdftoppm", ["-r", "144", "-png", pdf, path.join(imageDir, "page")], OUTPUT);
  const inspectedPages = (await readdir(imageDir)).filter(file => file.endsWith(".png")).sort();
  if (inspectedPages.length !== pageCount) throw new Error(`Expected ${pageCount} page images, found ${inspectedPages.length}`);
  const blankPages: number[] = [];
  const pageFurniture = /^(?:MIYAR(?:\s+Decision Intelligence Platform)?|Document ID:|Generated(?: at)?:|Model Version:|Benchmark Version:|Logic Version:|Artifact version:|Renderer version:|Render-input fingerprint:|This document is auto-generated\.|Scores are advisory|Page\s+.*?[—-]\s*\d+$)/i;
  const docxFurniture = /^(?:MIYAR Interior Design Instruction\s+[—-]|تعليمات التصميم الداخلي من\s+(?:MIYAR\s+[—-]|[—-]\s*MIYAR)|(?:Page|الصفحة)\s+.*?[—-]\s*\d+$)/i;
  for (let page = 1; page <= pageCount; page += 1) {
    const pageText = (await command("pdftotext", ["-f", String(page), "-l", String(page), pdf, "-"], OUTPUT)).stdout;
    const meaningfulText = pageText.split(/\r?\n/)
      .map(line => line.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim())
      .filter(line => !pageFurniture.test(line) && !(options.docx && docxFurniture.test(line)))
      .join(" ")
      .replace(/[\s\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
    // A page containing only a footer/header and identifiers is not report body.
    // DOCX has localized header/footer text, so use its dedicated furniture patterns too.
    if (meaningfulText.length < 48) blankPages.push(page);
  }
  return { pageCount, inspectedPages, text, blankPages, arabicTextPresent: /[\u0600-\u06FF]/.test(text) };
}
async function htmlPdf(html: string, pdf: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const checks = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      brokenAssets: Array.from(document.images).filter(image => !image.complete || image.naturalWidth === 0).length,
    }));
    await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
    return checks;
  } finally { await browser.close(); }
}
function htmlFor(surface: Exclude<Surface, "docx">, fixtureId: Tr10FixtureId): string {
  const fixture = TR10_FIXTURES[fixtureId]; const context = renderContext(surface, fixtureId);
  if (surface === "validation_summary") return generateValidationSummaryHTML({ ...fixture.report, renderContext: context });
  if (surface === "design_brief") return generateDesignBriefHTML({ ...fixture.report, renderContext: context, boardAnnex: fixture.report.boardAnnex! });
  if (surface === "full_report") return generateFullReportHTML({ ...fixture.report, renderContext: context, boardAnnex: fixture.report.boardAnnex! });
  if (surface === "autonomous_design_brief") return generateAutonomousBriefHTML({ ...fixture.report, renderContext: context });
  if (surface === "board") return generateBoardPdfHtml({ ...fixture.board, documentId: context.documentId, generatedAt: NOW, artifactVersion: context.artifactVersion, rendererVersion: context.rendererVersion, modelVersion: context.modelVersion, benchmarkVersion: context.benchmarkVersion, logicVersion: context.logicVersion });
  if (surface === "investor") return generateInvestorPdfHtml({ ...fixture.investor, documentId: context.documentId, generatedAt: NOW, artifactVersion: context.artifactVersion, rendererVersion: context.rendererVersion, modelVersion: context.modelVersion, benchmarkVersion: context.benchmarkVersion, logicVersion: context.logicVersion });
  if (surface === "scenario") return generateScenarioComparisonHTML({ ...fixture.scenario, renderContext: context });
  return generatePortfolioReportHTML({ ...fixture.portfolio, renderContext: context });
}
async function main() {
  await rm(OUTPUT, { recursive: true, force: true }); await mkdir(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true }); await browser.close(); // fail early with a precise Playwright blocker
  const entries: ManifestEntry[] = [];
  for (const [surface, fixtureId] of CERTIFICATION_MATRIX) {
    const base = `${safeName(surface)}-${fixtureId}`; const fixture = TR10_FIXTURES[fixtureId]; const imageDir = path.join(OUTPUT, `${base}-pages`); await mkdir(imageDir, { recursive: true });
    try {
      if (surface === "docx") {
        const context = renderContext(surface, fixtureId); const docx = path.join(OUTPUT, `${base}.docx`); await writeFile(docx, await generateDesignBriefDocx({ ...fixture.docx, renderContext: context }));
        await command("soffice", ["--headless", "--convert-to", "pdf", "--outdir", OUTPUT, docx], OUTPUT); const pdf = path.join(OUTPUT, `${base}.pdf`); const inspection = await inspectPdf(pdf, imageDir, { docx: true });
        const documentXml = (await command("unzip", ["-p", docx, "word/document.xml"], OUTPUT)).stdout;
        const checks = { docxGenerated: true, identity: inspection.text.includes(context.documentId), localizedStaticCopy: fixture.locale !== "ar" || documentXml.includes("معرّف المستند") && documentXml.includes("بصمة مدخلات العرض"), disclaimer: /disclaimer|indicative|advisory|استرشادي|استشارية|إخلاء مسؤولية/i.test(inspection.text), finite: !/\b(?:NaN|Infinity)\b/.test(documentXml), noExecutableMarkup: !/<w:hyperlink\b|HYPERLINK\s/i.test(documentXml), annexBoundary: !documentXml.includes("Material Board Annex"), sourceValues: normalizeExtractedText(documentXml).includes(normalizeExtractedText(fixture.docx.projectName ?? "")), noBlankPages: inspection.blankPages.length === 0, arabicGlyphText: fixture.locale !== "ar" || inspection.arabicTextPresent };
        entries.push({ fixture: fixtureId, surface, docx: path.relative(ROOT, docx), pdf: path.relative(ROOT, pdf), pageCount: inspection.pageCount, checks, inspectedPages: inspection.inspectedPages, status: Object.values(checks).every(Boolean) ? "pass" : "fail" });
      } else {
        const html = htmlFor(surface, fixtureId); const htmlPath = path.join(OUTPUT, `${base}.html`); const pdf = path.join(OUTPUT, `${base}.pdf`); await writeFile(htmlPath, html); const browserChecks = await htmlPdf(html, pdf); const inspection = await inspectPdf(pdf, imageDir); const checks = commonChecks(html, fixture.locale, surface, fixtureId, inspection, browserChecks); const status = Object.values(checks).every(Boolean) ? "pass" : "fail";
        entries.push({ fixture: fixtureId, surface, html: path.relative(ROOT, htmlPath), pdf: path.relative(ROOT, pdf), pageCount: inspection.pageCount, checks, inspectedPages: inspection.inspectedPages, status });
      }
    } catch (error) { entries.push({ fixture: fixtureId, surface, pageCount: 0, checks: {}, inspectedPages: [], status: "fail", error: error instanceof Error ? error.message : String(error) }); }
  }
  const manifest = { generatedAt: new Date().toISOString(), outputRoot: path.relative(ROOT, OUTPUT), syntheticOnly: true, visualInspection: "Every rendered page is rasterized at 144 DPI; PNGs are ready for human inspection and listed per artifact.", matrix: TR10_PAIRWISE_MATRIX, arabicSmokeMatrix: ARABIC_SMOKE_SURFACES.map(surface => [surface, "arabic_bidi"]), entries };
  await writeFile(path.join(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const failures = entries.filter(entry => entry.status === "fail");
  process.stdout.write(`TR-10 report certification: ${entries.length - failures.length}/${entries.length} artifacts passed. Manifest: ${path.relative(ROOT, path.join(OUTPUT, "manifest.json"))}\n`);
  if (failures.length) { for (const failure of failures) process.stderr.write(`${failure.surface}/${failure.fixture}: ${failure.error ?? JSON.stringify(failure.checks)}\n`); process.exitCode = 1; }
}
main().catch(error => { process.stderr.write(`TR-10 report certification environment blocker: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 2; });
