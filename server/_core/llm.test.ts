import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./llm";
import type { ValidatedMedia } from "./media-validation";

const originalKey = process.env.GEMINI_API_KEY;

const imageMedia: ValidatedMedia = {
  buffer: Buffer.from("image-bytes"),
  mimeType: "image/png",
  kind: "image",
  sizeBytes: 11,
  checksum: "a".repeat(64),
};

const pdfMedia: ValidatedMedia = {
  buffer: Buffer.from("%PDF-1.7"),
  mimeType: "application/pdf",
  kind: "pdf",
  sizeBytes: 8,
  checksum: "b".repeat(64),
};

const successfulModelResponse = () => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: "safe answer" }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
}), { status: 200, headers: { "content-type": "application/json" } });

describe("Gemini AI operation boundary", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it("sends a validated small image inline and never fetches a caller URL", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(successfulModelResponse());

    const result = await invokeLLM({ messages: [{ role: "user", content: { type: "media", media: imageMedia } }] });

    expect(result.choices[0]?.message.content).toBe("safe answer");
    const [, request] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      contents: [{ parts: [{ inlineData: { mimeType: "image/png" } }] }],
    });
  });

  it("uses the Files API for validated documents and deletes the temporary file", async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (url, init) => {
      const value = String(url);
      if (value.includes("upload/v1beta/files")) {
        return new Response(null, { status: 200, headers: { "x-goog-upload-url": "https://upload.example.invalid/session" } });
      }
      if (value === "https://upload.example.invalid/session") {
        return new Response(JSON.stringify({ file: {
          name: "files/miyar-test", uri: "https://files.example.invalid/miyar-test", mimeType: "application/pdf", state: "ACTIVE",
        } }), { status: 200 });
      }
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return successfulModelResponse();
    });

    await expect(invokeLLM({ messages: [{ role: "user", content: { type: "media", media: pdfMedia } }] }))
      .resolves.toMatchObject({ choices: [{ message: { content: "safe answer" } }] });

    const generation = fetchMock.mock.calls.find(([url]) => String(url).includes(":generateContent"));
    expect(JSON.parse(String(generation?.[1]?.body))).toMatchObject({
      contents: [{ parts: [{ fileData: { mimeType: "application/pdf" } }] }],
    });
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("files/miyar-test") && init?.method === "DELETE"))
      .toBe(true);
  });

  it("cleans up a provider file when provider-side preparation fails", async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async (url, init) => {
      const value = String(url);
      if (value.includes("upload/v1beta/files")) {
        return new Response(null, { status: 200, headers: { "x-goog-upload-url": "https://upload.example.invalid/failure-session" } });
      }
      if (value === "https://upload.example.invalid/failure-session") {
        return new Response(JSON.stringify({ file: {
          name: "files/miyar-failed", uri: "https://files.example.invalid/miyar-failed", mimeType: "application/pdf", state: "FAILED",
        } }), { status: 200 });
      }
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      throw new Error(`Unexpected provider request: ${value}`);
    });

    await expect(invokeLLM({ messages: [{ role: "user", content: { type: "media", media: pdfMedia } }] }))
      .rejects.toMatchObject({ code: "PROVIDER_REJECTED_INPUT" });
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("files/miyar-failed") && init?.method === "DELETE"))
      .toBe(true);
  });

  it("rejects legacy media URLs instead of allowing server-side URL fetching", async () => {
    await expect(invokeLLM({ messages: [{ role: "user", content: {
      type: "image_url", image_url: { url: "http://169.254.169.254/latest/meta-data" },
    } }] })).rejects.toMatchObject({ code: "MEDIA_UNAVAILABLE" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [400, "PROVIDER_REJECTED_INPUT"],
    [401, "PROVIDER_UNAUTHORIZED"],
    [403, "PROVIDER_UNAUTHORIZED"],
  ] as const)("maps provider HTTP %i to a stable safe error", async (status, code) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"provider-secret"}', { status }));

    await expect(invokeLLM({ messages: [{ role: "user", content: "hello" }] }))
      .rejects.toMatchObject({ code, message: expect.not.stringContaining("provider-secret") });
  });

  it("retries only retryable 429 and 5xx responses at the bounded limit", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response("busy", { status: 429 }));
    const rateLimited = invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    const rateLimitedExpectation = expect(rateLimited).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMITED", retryable: true });
    await vi.runAllTimersAsync();
    await rateLimitedExpectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }));
    const unavailable = invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    const unavailableExpectation = expect(unavailable).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
    await vi.runAllTimersAsync();
    await unavailableExpectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("maps provider timeouts and malformed output without exposing provider bodies", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException("request timed out", "TimeoutError"));
    await expect(invokeLLM({ messages: [{ role: "user", content: "hello" }] }))
      .rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", retryable: true });

    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"candidates":[{"content":{"parts":[{"other":"provider-secret"}]}}]}', { status: 200 }));
    await expect(invokeLLM({ messages: [{ role: "user", content: "hello" }] }))
      .rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE", message: expect.not.stringContaining("provider-secret") });
  });
});
