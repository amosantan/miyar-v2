import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "tmp", "tr13-workflow-certification");
const htmlPath = path.join(output, "report.html");
const pdfPath = path.join(output, "report.pdf");
const pages = path.join(output, "report-pages");

async function sha256(file: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

const html = await readFile(htmlPath, "utf8");
if (
  /share[_-]?token|tr13-(?:local-)?(?:admin|member|viewer|foreign)(?:-password)?/i.test(
    html
  ) ||
  /https?:\/\/[^\s"'<>]+\/share\/[A-Za-z0-9_-]+/i.test(html)
) {
  throw new Error(
    "Refusing to render report HTML containing a secret-like marker"
  );
}
await mkdir(pages, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1800 },
  });
  await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  const horizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
  );
  if (horizontalOverflow)
    throw new Error("Stored report has horizontal overflow at render width");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
} finally {
  await browser.close();
}
const info = await exec("pdfinfo", [pdfPath], { timeout: 30_000 });
const pageCount = Number(/^Pages:\s+(\d+)/m.exec(info.stdout)?.[1] ?? 0);
if (!Number.isSafeInteger(pageCount) || pageCount < 1)
  throw new Error("Rendered PDF has no pages");
await exec(
  "pdftoppm",
  ["-r", "144", "-png", pdfPath, path.join(pages, "page")],
  { timeout: 30_000 }
);
const images = (await readdir(pages))
  .filter(file => file.endsWith(".png"))
  .sort();
if (images.length !== pageCount)
  throw new Error(`Expected ${pageCount} PNG pages, found ${images.length}`);
const text = (await exec("pdftotext", [pdfPath, "-"], { timeout: 30_000 }))
  .stdout;
const textChecks = {
  identity: /Document ID:/.test(text),
  fingerprint: /Render-input fingerprint:/.test(text),
  disclaimer: /advisory|disclaimer/i.test(text),
  reconciliation: /Workflow, Space & MQI Reconciliation/.test(text),
  noSecretMarkers:
    !/share[_-]?token|https?:\/\/[^\s]+\/share\/[A-Za-z0-9_-]+/i.test(text),
};
if (Object.values(textChecks).some(value => !value))
  throw new Error("Stored report failed required identity or content checks");
const blankPages: number[] = [];
for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
  const pageText = (
    await exec(
      "pdftotext",
      ["-f", String(pageNumber), "-l", String(pageNumber), pdfPath, "-"],
      { timeout: 30_000 }
    )
  ).stdout.replace(/\s/g, "");
  if (!pageText) blankPages.push(pageNumber);
}
if (blankPages.length > 0)
  throw new Error("Stored report contains blank rasterized pages");
const reportRenderInputFingerprint =
  /Render-input fingerprint:\s*([a-f0-9]{64})/i.exec(text)?.[1];
if (!reportRenderInputFingerprint)
  throw new Error("Stored report fingerprint value is missing");
await writeFile(
  path.join(output, "render-evidence.json"),
  `${JSON.stringify(
    {
      status: "PASS",
      pageCount,
      renderedViews: images,
      blankPages,
      horizontalOverflow: false,
      textChecks,
      reportRenderInputFingerprint,
      hashes: {
        htmlSha256: createHash("sha256").update(html).digest("hex"),
        pdfSha256: await sha256(pdfPath),
        pagePngSha256: Object.fromEntries(
          await Promise.all(
            images.map(async image => [
              image,
              await sha256(path.join(pages, image)),
            ])
          )
        ),
      },
    },
    null,
    2
  )}\n`
);
