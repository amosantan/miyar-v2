import { afterEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({
  getText: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText = pdfMocks.getText;
    destroy = pdfMocks.destroy;
  },
}));

vi.mock("../../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { SCADPdfConnector } from "./scad-pdf-connector";
import { resetDefaultRobotsPolicyCache } from "../robots-policy";

// ADR-0010: the connector now asserts robots.txt before every raw download,
// so the stubbed fetch must serve an allow-all robots.txt as text/plain.
const robotsAllowAll = {
  ok: true,
  status: 200,
  headers: {
    get: (name: string) =>
      name.toLowerCase() === "content-type" ? "text/plain" : null,
  },
  text: async () => "User-agent: *\nAllow: /\n",
};

describe("SCADPdfConnector fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    resetDefaultRobotsPolicyCache();
  });

  it("extracts PDF text through the typed parser and releases resources", async () => {
    const extractedText = "SCAD material price index ".repeat(10);
    pdfMocks.getText.mockResolvedValue({
      text: extractedText,
      total: 3,
      pages: [],
    });
    pdfMocks.destroy.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).endsWith("/robots.txt")) return robotsAllowAll;
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      })
    );

    const payload = await new SCADPdfConnector().fetch();

    expect(payload.statusCode).toBe(200);
    expect(payload.rawHtml).toContain(extractedText);
    expect(pdfMocks.getText).toHaveBeenCalled();
    expect(pdfMocks.destroy).toHaveBeenCalled();
  });

  it("falls back to the publications page when PDF downloads fail", async () => {
    const fallbackHtml = `<html><body>${"SCAD publications ".repeat(10)}</body></html>`;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          async (
            url: string,
            options?: { headers?: Record<string, string> }
          ) => {
            if (String(url).endsWith("/robots.txt")) return robotsAllowAll;
            if (options?.headers?.Accept === "application/pdf") {
              return { ok: false, status: 404 };
            }
            return {
              ok: true,
              status: 200,
              text: async () => fallbackHtml,
            };
          }
        )
    );

    const payload = await new SCADPdfConnector().fetch();

    expect(payload.statusCode).toBe(200);
    expect(payload.rawHtml).toBe(fallbackHtml);
    expect(pdfMocks.getText).not.toHaveBeenCalled();
  });
});
