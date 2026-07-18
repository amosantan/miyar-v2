import { describe, expect, it } from "vitest";
import {
  REPORT_COPY,
  REPORT_COPY_REVIEW_STATUS,
  formatReportAed,
  formatReportDate,
  formatReportNumber,
  localizeGovernedReportCopy,
  reportCopy,
  reportDocumentMetadata,
  reportLocaleCss,
} from "./report-catalog";
import {
  isReportLocale,
  reportDirection,
  reportLocaleOrDefault,
} from "../../shared/report-locale";

describe("report locale contract", () => {
  it("accepts only the two issued locales and defaults non-router input to English", () => {
    expect(isReportLocale("en")).toBe(true);
    expect(isReportLocale("ar")).toBe(true);
    expect(isReportLocale("fr")).toBe(false);
    expect(isReportLocale(undefined)).toBe(false);
    expect(reportLocaleOrDefault("ar")).toBe("ar");
    expect(reportLocaleOrDefault("fr")).toBe("en");
    expect(reportDirection("en")).toBe("ltr");
    expect(reportDirection("ar")).toBe("rtl");
  });
});

describe("report catalog", () => {
  it("has deterministic English and Arabic copy for every governed key", () => {
    expect(Object.keys(REPORT_COPY.ar).sort()).toEqual(Object.keys(REPORT_COPY.en).sort());
    expect(reportCopy("en", "importantDisclaimer")).toBe("Important disclaimer");
    expect(reportCopy("ar", "importantDisclaimer")).toBe("إخلاء مسؤولية مهم");
    expect(reportCopy("ar", "renderInputFingerprint")).toBe("بصمة مدخلات العرض");
    expect(REPORT_COPY_REVIEW_STATUS).toBe("approved_2026_07_18");
  });

  it("never translates governed phrases inside dynamic report values", () => {
    const html = '<h2>Important disclaimer</h2><bdi data-report-dynamic dir="auto">Customer says Important disclaimer</bdi>';
    const localized = localizeGovernedReportCopy(html, "ar");
    expect(localized).toContain("<h2>إخلاء مسؤولية مهم</h2>");
    expect(localized).toContain("Customer says Important disclaimer");
  });

  it("formats finite values using the report locale and never serializes invalid values", () => {
    expect(formatReportNumber(Number.NaN, "en")).toBe("—");
    expect(formatReportAed(Number.POSITIVE_INFINITY, "ar")).toBe("—");
    expect(formatReportNumber(1234.5, "en")).toContain("1,234.5");
    expect(formatReportAed(1250, "en")).toMatch(/AED|د\.إ/);
    expect(formatReportDate("not-a-date", "ar")).toBe("—");
  });

  it("provides standalone HTML metadata and bidi-safe CSS for each direction", () => {
    expect(reportDocumentMetadata("en")).toMatchObject({ lang: "en", dir: "ltr", dynamicTextDir: "auto" });
    expect(reportDocumentMetadata("ar")).toMatchObject({ lang: "ar", dir: "rtl", dynamicTextDir: "auto" });
    expect(reportLocaleCss("ar")).toContain("direction: rtl");
    expect(reportLocaleCss("ar")).toContain("Noto Sans Arabic");
    expect(reportLocaleCss("en")).toContain("text-align: start");
  });
});
