import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  RegulatoryDocumentFetcher,
  type RegisteredRegulatorySource,
  type RegulatoryDocumentTransport,
  type RegulatoryTransportResponse,
} from "./regulatory-document-fetcher";

const source: RegisteredRegulatorySource = {
  sourceKey: "dm-building-code",
  canonicalUrl: "https://official.example/documents/code.pdf",
  allowedHosts: ["official.example", "cdn.official.example"],
  termsStatus: "approved",
  retentionStatus: "approved",
  licensingStatus: "permitted",
};

function body(content: string | Uint8Array): AsyncIterable<Uint8Array> {
  const bytes = typeof content === "string" ? Buffer.from(content) : content;
  return (async function* () { yield bytes; })();
}

function response(
  statusCode: number,
  content: string | Uint8Array = "",
  headers: Record<string, string> = {},
): RegulatoryTransportResponse {
  return { statusCode, headers, body: body(content) };
}

function transportFor(
  handler: (url: URL) => RegulatoryTransportResponse | Promise<RegulatoryTransportResponse>,
): RegulatoryDocumentTransport {
  return { request: async ({ url }) => handler(url) };
}

function approvedRobotsAnd(documentResponse: RegulatoryTransportResponse): RegulatoryDocumentTransport {
  return transportFor((url) => url.pathname === "/robots.txt"
    ? response(200, "User-agent: *\nAllow: /", { "content-type": "text/plain" })
    : documentResponse);
}

function testFetcher(transport: RegulatoryDocumentTransport, options: Partial<ConstructorParameters<typeof RegulatoryDocumentFetcher>[0]> = {}) {
  return new RegulatoryDocumentFetcher({
    sources: [source],
    transport,
    resolver: async (host) => [{ address: host === "cdn.official.example" ? "2606:4700:4700::1111" : "93.184.216.34", family: host === "cdn.official.example" ? 6 : 4 }],
    minRequestIntervalMs: 0,
    retryDelayMs: 0,
    now: () => new Date("2026-07-21T08:00:00.000Z"),
    ...options,
  });
}

describe("RegulatoryDocumentFetcher", () => {
  it("binds source policy to the immutable constructor registry and refuses source-key spoofing", async () => {
    const transport = { request: vi.fn() } as unknown as RegulatoryDocumentTransport;
    const fetcher = testFetcher(transport, { sources: [{ ...source, termsStatus: "pending_review" }] });

    await expect(fetcher.fetch(source.sourceKey)).rejects.toMatchObject({ code: "TERMS_NOT_APPROVED" });
    await expect(fetcher.fetch("dm-building-code-with-caller-hosts")).rejects.toMatchObject({ code: "UNREGISTERED_SOURCE" });
    expect(transport.request).not.toHaveBeenCalled();

    const retentionDenied = testFetcher(transport, { sources: [{ ...source, retentionStatus: "denied" }] });
    await expect(retentionDenied.fetch(source.sourceKey)).rejects.toMatchObject({ code: "RETENTION_NOT_APPROVED" });
    expect(transport.request).not.toHaveBeenCalled();

    const licensingDenied = testFetcher(transport, { sources: [{ ...source, licensingStatus: "pending_review" }] });
    await expect(licensingDenied.fetch(source.sourceKey)).rejects.toMatchObject({ code: "LICENSING_NOT_APPROVED" });
    expect(transport.request).not.toHaveBeenCalled();
  });

  it("uses only the injected direct transport, checks robots, and returns an immutable SHA-256 receipt", async () => {
    const document = Buffer.from("official regulatory document bytes");
    const directTransport = approvedRobotsAnd(response(200, document, {
      "content-type": "application/pdf; charset=binary",
      etag: "\"v2\"",
      "last-modified": "Mon, 20 Jul 2026 10:00:00 GMT",
    }));
    const globalFetch = vi.fn();
    vi.stubGlobal("fetch", globalFetch);

    const result = await testFetcher(directTransport).fetch(source.sourceKey);

    expect(globalFetch).not.toHaveBeenCalled();
    expect(result.receipt).toMatchObject({
      sourceKey: source.sourceKey,
      statusCode: 200,
      mimeType: "application/pdf",
      byteLength: document.length,
      etag: "\"v2\"",
      parserVersion: "regulatory-direct-v1",
      transport: "direct_official_https",
    });
    expect(result.receipt.sha256).toBe(createHash("sha256").update(document).digest("hex"));
    expect(Object.isFrozen(result.receipt)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("fails closed when robots cannot be retrieved or denies the document path", async () => {
    await expect(testFetcher(transportFor(() => response(503))).fetch(source.sourceKey)).rejects.toMatchObject({ code: "ROBOTS_UNAVAILABLE" });

    const denied = transportFor((url) => url.pathname === "/robots.txt"
      ? response(200, "User-agent: *\nDisallow: /documents/", { "content-type": "text/plain" })
      : response(200, "never reached", { "content-type": "application/pdf" }));
    await expect(testFetcher(denied).fetch(source.sourceKey)).rejects.toMatchObject({ code: "ROBOTS_DENIED" });
  });

  it("rejects redirect escapes from the registry-owned host policy", async () => {
    const fetcher = testFetcher(approvedRobotsAnd(response(302, "", { location: "https://evil.example/stolen.pdf" })));
    await expect(fetcher.fetch(source.sourceKey)).rejects.toMatchObject({ code: "REDIRECT_DENIED" });
  });

  it("blocks private/reserved DNS answers before a direct request, including redirects", async () => {
    const directTransport = approvedRobotsAnd(response(302, "", { location: "https://cdn.official.example/changed.pdf" }));
    const request = vi.spyOn(directTransport, "request");
    const fetcher = new RegulatoryDocumentFetcher({
      sources: [source],
      transport: directTransport,
      resolver: async (host) => [{ address: host === "cdn.official.example" ? "127.0.0.1" : "93.184.216.34", family: 4 }],
      minRequestIntervalMs: 0,
    });

    await expect(fetcher.fetch(source.sourceKey)).rejects.toMatchObject({ code: "PRIVATE_OR_RESERVED_ADDRESS" });
    expect(request).toHaveBeenCalledTimes(2); // robots + original document, never redirected IP
  });

  it("establishes robots policy again before following an approved cross-host redirect", async () => {
    const directTransport = transportFor((url) => {
      if (url.hostname === "official.example" && url.pathname === "/robots.txt") return response(200, "User-agent: *\nAllow: /", { "content-type": "text/plain" });
      if (url.hostname === "official.example") return response(302, "", { location: "https://cdn.official.example/changed.pdf" });
      if (url.hostname === "cdn.official.example" && url.pathname === "/robots.txt") return response(200, "User-agent: *\nDisallow: /changed.pdf", { "content-type": "text/plain" });
      return response(200, "must not be fetched", { "content-type": "application/pdf" });
    });
    const request = vi.spyOn(directTransport, "request");
    await expect(testFetcher(directTransport).fetch(source.sourceKey)).rejects.toMatchObject({ code: "ROBOTS_DENIED" });
    expect(request).toHaveBeenCalledTimes(3); // origin robots, origin redirect, destination robots
  });

  it("rejects wrong MIME types and over-size content before accepting a capture", async () => {
    await expect(testFetcher(approvedRobotsAnd(response(200, "image", { "content-type": "image/png" }))).fetch(source.sourceKey)).rejects.toMatchObject({ code: "UNSUPPORTED_MIME" });
    await expect(testFetcher(approvedRobotsAnd(response(200, "", {
      "content-type": "application/pdf",
      "content-length": "999",
    })), { maxBytes: 100 }).fetch(source.sourceKey)).rejects.toMatchObject({ code: "OVERSIZED_DOCUMENT" });
  });

  it("enforces timeout mapping and per-host request spacing", async () => {
    const sleeper = vi.fn(async () => undefined);
    const timedOut = transportFor((url) => url.pathname === "/robots.txt"
      ? response(200, "User-agent: *\nAllow: /", { "content-type": "text/plain" })
      : Promise.reject(new Error("socket timeout")));
    const fetcher = testFetcher(timedOut, { minRequestIntervalMs: 500, sleep: sleeper });
    await expect(fetcher.fetch(source.sourceKey)).rejects.toMatchObject({ code: "TIMEOUT" });
    // The document request is spaced after the robots request, even when it fails.
    expect(sleeper).toHaveBeenCalledWith(500);
  });

  it("uses a single total deadline for slow DNS and slow response bodies", async () => {
    const directTransport = approvedRobotsAnd(response(200, "document", { "content-type": "application/pdf" }));
    const slowDns = new RegulatoryDocumentFetcher({
      sources: [source],
      transport: directTransport,
      resolver: async () => new Promise(resolve => setTimeout(() => resolve([{ address: "93.184.216.34", family: 4 }]), 40)),
      operationTimeoutMs: 5,
      minRequestIntervalMs: 0,
    });
    await expect(slowDns.fetch(source.sourceKey)).rejects.toMatchObject({ code: "TIMEOUT" });

    const slowBodyTransport = transportFor((url) => {
      if (url.pathname === "/robots.txt") return response(200, "User-agent: *\nAllow: /", { "content-type": "text/plain" });
      return {
        statusCode: 200,
        headers: { "content-type": "application/pdf" },
        body: (async function* () {
          await new Promise(resolve => setTimeout(resolve, 40));
          yield Buffer.from("late document");
        })(),
      };
    });
    const slowBody = testFetcher(slowBodyTransport, { operationTimeoutMs: 5 });
    await expect(slowBody.fetch(source.sourceKey)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("retries direct-host 429 responses only within a bounded budget and then reports RATE_LIMITED", async () => {
    let documentAttempts = 0;
    const directTransport = transportFor((url) => {
      if (url.pathname === "/robots.txt") return response(200, "User-agent: *\nAllow: /", { "content-type": "text/plain" });
      documentAttempts += 1;
      return response(429, "retry later", { "content-type": "text/plain" });
    });
    const sleeper = vi.fn(async () => undefined);
    const fetcher = testFetcher(directTransport, { maxAttempts: 2, retryDelayMs: 1, sleep: sleeper });

    await expect(fetcher.fetch(source.sourceKey)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(documentAttempts).toBe(2);
    expect(sleeper).toHaveBeenCalledTimes(1);
  });

  it("retries bounded 5xx responses directly, but never retries a successful policy denial", async () => {
    let documentAttempts = 0;
    const directTransport = transportFor((url) => {
      if (url.pathname === "/robots.txt") return response(200, "User-agent: *\nAllow: /", { "content-type": "text/plain" });
      documentAttempts += 1;
      return response(503, "maintenance", { "content-type": "text/plain" });
    });
    const fetcher = testFetcher(directTransport, { maxAttempts: 2, retryDelayMs: 0 });
    await expect(fetcher.fetch(source.sourceKey)).rejects.toMatchObject({ code: "HTTP_STATUS" });
    expect(documentAttempts).toBe(2);
  });

  it("fails closed for IPv6 private, multicast, documentation and mapped address ranges", async () => {
    for (const address of ["::1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1"]) {
      const transport = { request: vi.fn() } as unknown as RegulatoryDocumentTransport;
      const fetcher = new RegulatoryDocumentFetcher({
        sources: [source],
        transport,
        resolver: async () => [{ address, family: 6 }],
        minRequestIntervalMs: 0,
      });
      await expect(fetcher.fetch(source.sourceKey)).rejects.toMatchObject({ code: "PRIVATE_OR_RESERVED_ADDRESS" });
      expect(transport.request).not.toHaveBeenCalled();
    }
  });

  it("refreshes robots permissions after the configured TTL instead of trusting stale policy", async () => {
    let clock = 10_000;
    let robotsRequests = 0;
    const directTransport = transportFor((url) => {
      if (url.pathname === "/robots.txt") {
        robotsRequests += 1;
        return response(200, "User-agent: *\nAllow: /", { "content-type": "text/plain" });
      }
      return response(200, "document", { "content-type": "application/pdf" });
    });
    const fetcher = testFetcher(directTransport, { robotsCacheTtlMs: 100, monotonicNow: () => clock });
    await fetcher.fetch(source.sourceKey);
    await fetcher.fetch(source.sourceKey);
    expect(robotsRequests).toBe(1);
    clock += 100;
    await fetcher.fetch(source.sourceKey);
    expect(robotsRequests).toBe(2);
  });
});
