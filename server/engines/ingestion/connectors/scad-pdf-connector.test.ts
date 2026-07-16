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

describe("SCADPdfConnector fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
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
            _url: string,
            options?: { headers?: Record<string, string> }
          ) => {
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
