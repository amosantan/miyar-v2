import { describe, expect, it } from "vitest";
import {
  createRenderInputFingerprint,
  createReportRenderContext,
} from "./report-render-context";
import { isReportLocale } from "../../shared/report-locale";

describe("report render context", () => {
  it("produces a deterministic SHA-256 fingerprint regardless of object key order", () => {
    const first = createRenderInputFingerprint({ projectId: 7, report: { score: 88, status: "validated" } });
    const reordered = createRenderInputFingerprint({ report: { status: "validated", score: 88 }, projectId: 7 });
    const changed = createRenderInputFingerprint({ projectId: 8, report: { score: 88, status: "validated" } });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("creates one artifact context from explicit identity and UTC inputs", () => {
    const context = createReportRenderContext({
      documentId: "MYR-TEST-001",
      generatedAt: "2026-07-18T08:00:00.000Z",
      locale: "ar",
      artifactVersion: "report-v1",
      rendererVersion: "chromium-1",
      modelVersion: "model-v2",
      benchmarkVersion: "benchmark-2026-01",
      logicVersion: "logic-v3",
      fingerprintInput: { projectId: 7, reportType: "full_report", locale: "ar" },
    });

    expect(context).toMatchObject({
      documentId: "MYR-TEST-001",
      generatedAt: "2026-07-18T08:00:00.000Z",
      locale: "ar",
      artifactVersion: "report-v1",
      rendererVersion: "chromium-1",
      modelVersion: "model-v2",
      benchmarkVersion: "benchmark-2026-01",
      logicVersion: "logic-v3",
    });
    expect(context.renderInputFingerprint).toHaveLength(64);
  });

  it("defaults locale to English and rejects unsafe fingerprint values", () => {
    expect(isReportLocale("en")).toBe(true);
    expect(isReportLocale("ar")).toBe(true);
    expect(isReportLocale("fr")).toBe(false);
    expect(() => createRenderInputFingerprint({ value: Number.NaN })).toThrow("finite");
    expect(createReportRenderContext({
      artifactVersion: "report-v1",
      rendererVersion: "renderer-v1",
      fingerprintInput: { projectId: 1 },
    }).locale).toBe("en");
  });
});
