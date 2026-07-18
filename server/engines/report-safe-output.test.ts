import { describe, expect, it } from "vitest";
import {
  escapeReportAttribute,
  escapeReportEvidenceUrl,
  escapeReportText,
  normalizeReportEvidenceUrl,
  renderReportMarkdown,
} from "./report-safe-output";

describe("report safe output", () => {
  it("escapes text and attributes independently without emitting executable markup", () => {
    const hostile = `</p><img src=x onerror=alert(1)>\"'\u202E`;
    expect(escapeReportText(hostile)).toBe("&lt;/p&gt;&lt;img src=x onerror=alert(1)&gt;&quot;&#39;�");
    expect(escapeReportAttribute(hostile)).not.toContain("<img");
  });

  it("allows only absolute HTTP(S) evidence URLs", () => {
    expect(normalizeReportEvidenceUrl("https://example.com/evidence?a=1&b=2")).toBe("https://example.com/evidence?a=1&b=2");
    expect(escapeReportEvidenceUrl("https://example.com/evidence?a=1&b=2")).toBe("https://example.com/evidence?a=1&amp;b=2");
    for (const unsafe of ["javascript:alert(1)", "data:text/html,boom", "//example.com", "/relative", "https://example.com/\nInjected"]) {
      expect(normalizeReportEvidenceUrl(unsafe)).toBeNull();
    }
  });

  it("renders only the markdown allowlist after escaping hostile input", () => {
    const html = renderReportMarkdown([
      "# Summary",
      "A **strong** and *emphasized* statement.",
      "- first item",
      "- <img src=x onerror=alert(1)>",
      "[unsafe](javascript:alert(1))",
    ].join("\n"));

    expect(html).toContain("<h1>Summary</h1>");
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain("<em>emphasized</em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("[unsafe](javascript:alert(1))");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a ");
  });
});
