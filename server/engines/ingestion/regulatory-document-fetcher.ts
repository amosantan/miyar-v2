/**
 * Regulatory document retrieval is deliberately separate from BaseSourceConnector.
 *
 * It never falls back to a proxy or a third-party reader.  A caller must provide a
 * registered, officially-approved source and this module records what was actually
 * retrieved.  It is intentionally a transport/receipt layer: parsing and legal
 * interpretation happen elsewhere and cannot change a receipt.
 */
import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import * as https from "node:https";
import robotsParser from "robots-parser";

export type RegulatoryTermsStatus = "approved" | "pending_review" | "denied";
export type RegulatoryRetentionStatus = "approved" | "pending_review" | "denied";
export type RegulatoryLicensingStatus = "permitted" | "pending_review" | "denied";

export interface RegisteredRegulatorySource {
  sourceKey: string;
  canonicalUrl: string;
  /** Exact official DNS hosts. Wildcards and raw IP addresses are not supported. */
  allowedHosts: readonly string[];
  termsStatus: RegulatoryTermsStatus;
  retentionStatus: RegulatoryRetentionStatus;
  /** Acquisition is prohibited until the source's licensing/terms use is permitted. */
  licensingStatus: RegulatoryLicensingStatus;
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface RegulatoryTransportResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
}

export interface RegulatoryDocumentTransport {
  /**
   * A single direct HTTPS request. `resolvedAddresses` must be used to pin DNS in
   * production transports; it is supplied so tests can be completely deterministic.
   */
  request(input: {
    url: URL;
    headers: Record<string, string>;
    timeoutMs: number;
    resolvedAddresses: readonly ResolvedAddress[];
    /** Aborts DNS-pinned direct I/O when the whole acquisition deadline expires. */
    signal: AbortSignal;
  }): Promise<RegulatoryTransportResponse>;
}

export type RegulatoryResolver = (host: string, signal: AbortSignal) => Promise<ResolvedAddress[]>;

export interface RegulatoryFetchReceipt {
  readonly sourceKey: string;
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly fetchedAt: string;
  readonly statusCode: number;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly etag?: string;
  readonly lastModified?: string;
  readonly parserVersion: string;
  readonly redirectCount: number;
  readonly transport: "direct_official_https";
}

export interface RegulatoryFetchedDocument {
  readonly bytes: Buffer;
  readonly receipt: RegulatoryFetchReceipt;
}

export type RegulatoryFetchErrorCode =
  | "UNREGISTERED_SOURCE"
  | "TERMS_NOT_APPROVED"
  | "RETENTION_NOT_APPROVED"
  | "LICENSING_NOT_APPROVED"
  | "INVALID_URL"
  | "UNAPPROVED_HOST"
  | "NON_HTTPS_URL"
  | "PRIVATE_OR_RESERVED_ADDRESS"
  | "DNS_LOOKUP_FAILED"
  | "ROBOTS_UNAVAILABLE"
  | "ROBOTS_DENIED"
  | "REDIRECT_DENIED"
  | "TOO_MANY_REDIRECTS"
  | "HTTP_STATUS"
  | "UNSUPPORTED_MIME"
  | "OVERSIZED_DOCUMENT"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "TRANSPORT_FAILURE";

export class RegulatoryFetchError extends Error {
  constructor(
    readonly code: RegulatoryFetchErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RegulatoryFetchError";
  }
}

export interface RegulatoryDocumentFetcherOptions {
  /** The platform-owned registry. Callers may select a key, never submit a source policy. */
  sources: readonly RegisteredRegulatorySource[];
  resolver?: RegulatoryResolver;
  transport?: RegulatoryDocumentTransport;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  /** A hard deadline for DNS, robots, redirect hops, retry delays and document body reads. */
  operationTimeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  minRequestIntervalMs?: number;
  userAgent?: string;
  parserVersion?: string;
  allowedMimeTypes?: readonly string[];
  maxAttempts?: number;
  retryDelayMs?: number;
  /** Robots rules are refreshed; a stale permission never remains indefinitely trusted. */
  robotsCacheTtlMs?: number;
  /** Injectable monotonic clock for deterministic deadline tests. */
  monotonicNow?: () => number;
}

const DEFAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/html",
  "application/xhtml+xml",
] as const;
const DEFAULT_USER_AGENT = "MIYAR-Regulatory-Acquisition/1.0 (+compliance@miyar.example)";
const DOCUMENT_ACCEPT = "application/pdf,text/html,application/xhtml+xml;q=0.9";
/**
 * robots.txt is plain text. Offering only document media types makes a
 * correctly-behaved server answer 406 Not Acceptable, which the acquisition
 * path can only report as an unestablished robots policy — indistinguishable
 * from a genuine refusal. Ask for text/plain, tolerating anything else.
 */
const ROBOTS_ACCEPT = "text/plain,*/*;q=0.1";

function headerValue(
  headers: RegulatoryTransportResponse["headers"],
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

function isBlockedAddress(address: string): boolean {
  const candidate = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
    const octets = candidate.split(".").map(Number);
    if (octets.some((part) => part > 255)) return true;
    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }

  const words = parseIpv6(candidate);
  if (!words) return true; // DNS must only hand us a valid numeric address.
  const [first, second] = words;
  const embeddedIpv4 = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
  const firstFiveZero = words.slice(0, 5).every(word => word === 0);
  // Unspecified, loopback, IPv4-compatible and IPv4-mapped address forms.
  if (firstFiveZero && (words[5] === 0 || words[5] === 0xffff)) return true;
  // ULA, link-local, multicast, documentation, 6to4 and IPv6 special-purpose
  // ranges are never valid destinations for a public official source. This is
  // fail-closed: only normal global-unicast space is eligible after exclusions.
  if (
    first < 0x2000 || first >= 0x4000 ||
    (first >= 0xfc00 && first <= 0xfdff) ||
    (first >= 0xfe80 && first <= 0xfebf) ||
    first >= 0xff00 ||
    (first === 0x2001 && (second === 0 || second === 0x2 || second === 0x10 || second === 0x20 || second === 0xdb8)) ||
    first === 0x2002 ||
    first === 0x3fff
  ) return true;
  // A 6to4 address can encode an RFC1918/loopback IPv4 destination. It is
  // already blocked above, while this keeps the intent explicit for audits.
  if (first === 0x2002 && isBlockedAddress(embeddedIpv4)) return true;
  return false;
}

function parseIpv6(candidate: string): number[] | undefined {
  if (!candidate.includes(":")) return undefined;
  const split = candidate.split("::");
  if (split.length > 2) return undefined;
  const expand = (part: string) => part ? part.split(":") : [];
  const left = expand(split[0]);
  const right = split.length === 2 ? expand(split[1]) : [];
  const convertIpv4Tail = (parts: string[]): string[] | undefined => {
    const tail = parts.at(-1);
    if (!tail?.includes(".")) return parts;
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(tail)) return undefined;
    const octets = tail.split(".").map(Number);
    if (octets.some(part => part > 255)) return undefined;
    return [...parts.slice(0, -1), ((octets[0] << 8) | octets[1]).toString(16), ((octets[2] << 8) | octets[3]).toString(16)];
  };
  const normalizedLeft = convertIpv4Tail(left);
  const normalizedRight = convertIpv4Tail(right);
  if (!normalizedLeft || !normalizedRight) return undefined;
  const supplied = normalizedLeft.length + normalizedRight.length;
  if ((split.length === 1 && supplied !== 8) || supplied > 8) return undefined;
  const fields = split.length === 2
    ? [...normalizedLeft, ...Array(8 - supplied).fill("0"), ...normalizedRight]
    : normalizedLeft;
  if (fields.length !== 8 || fields.some(field => !/^[0-9a-f]{1,4}$/i.test(field))) return undefined;
  return fields.map(field => Number.parseInt(field, 16));
}

async function defaultResolver(host: string, signal: AbortSignal): Promise<ResolvedAddress[]> {
  try {
    if (signal.aborted) throw new RegulatoryFetchError("TIMEOUT", `Deadline expired before DNS lookup for ${host}`);
    const addresses = await dnsLookup(host, { all: true, verbatim: true });
    if (signal.aborted) throw new RegulatoryFetchError("TIMEOUT", `Deadline expired during DNS lookup for ${host}`);
    return addresses.map(({ address, family }) => ({
      address,
      family: family === 6 ? 6 : 4,
    }));
  } catch (error) {
    throw new RegulatoryFetchError("DNS_LOOKUP_FAILED", `DNS lookup failed for ${host}`, error);
  }
}

async function* incomingBody(response: import("node:http").IncomingMessage): AsyncIterable<Uint8Array> {
  for await (const chunk of response) {
    yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  }
}

/**
 * Builds the DNS hook that pins a request to already-vetted addresses.
 *
 * Node enables happy-eyeballs (`autoSelectFamily`) by default from v20, which
 * calls this hook with `{ all: true }` and requires an array result. Answering
 * with the single-address form yields `ERR_INVALID_IP_ADDRESS` and no request is
 * ever made, so both shapes must be handled.
 *
 * Every address offered here already passed the private and reserved-range
 * check, so returning the full set keeps the SSRF guarantee while letting Node
 * pick a reachable family.
 *
 * Exported for regression tests: production transports are replaced wholesale in
 * unit tests, so this hook is otherwise only exercised against a real socket.
 */
export function createPinnedLookup(resolvedAddresses: readonly ResolvedAddress[]) {
  return (
    _hostname: string,
    options: unknown,
    callback: (error: null, ...rest: unknown[]) => void,
  ): void => {
    if ((options as { all?: boolean } | undefined)?.all) {
      callback(null, resolvedAddresses.map(({ address, family }) => ({ address, family })));
      return;
    }
    callback(null, resolvedAddresses[0].address, resolvedAddresses[0].family);
  };
}

const directHttpsTransport: RegulatoryDocumentTransport = {
  async request({ url, headers, timeoutMs, resolvedAddresses, signal }) {
    const pinned = resolvedAddresses[0];
    if (!pinned) throw new RegulatoryFetchError("DNS_LOOKUP_FAILED", `No address resolved for ${url.hostname}`);
    return new Promise<RegulatoryTransportResponse>((resolve, reject) => {
      const request = https.request(url, {
        method: "GET",
        headers,
        timeout: timeoutMs,
        agent: false,
        // Preserve TLS/SNI and Host while connecting only to vetted addresses.
        lookup: createPinnedLookup(resolvedAddresses) as never,
      }, (response) => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: incomingBody(response),
        });
      });
      request.once("timeout", () => request.destroy(new RegulatoryFetchError("TIMEOUT", `Timed out fetching ${url}`)));
      request.once("error", reject);
      const abort = () => request.destroy(new RegulatoryFetchError("TIMEOUT", `Acquisition deadline expired for ${url}`));
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
      request.end();
    });
  },
};

/**
 * Direct, fail-closed acquisition for regulated documents.  It is stateful only
 * for the per-host acquisition gate (serialization plus reserved rate slots);
 * all successful fetch facts are returned as receipts.
 */
export class RegulatoryDocumentFetcher {
  private readonly sources: ReadonlyMap<string, Readonly<RegisteredRegulatorySource>>;
  private readonly resolver: RegulatoryResolver;
  private readonly transport: RegulatoryDocumentTransport;
  private readonly now: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly operationTimeoutMs: number;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;
  private readonly minRequestIntervalMs: number;
  private readonly userAgent: string;
  private readonly parserVersion: string;
  private readonly allowedMimeTypes: ReadonlySet<string>;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly robotsCacheTtlMs: number;
  private readonly monotonicNow: () => number;
  /** Tail of the per-host serial chain. Keys are bounded by the registry's approved hosts. */
  private readonly hostGates = new Map<string, Promise<void>>();
  /** Earliest instant the next request to a host may start; reserved before any await. */
  private readonly nextRequestAt = new Map<string, number>();
  private readonly robotsCache = new Map<string, { parser: ReturnType<typeof robotsParser>; fetchedAt: number }>();

  constructor(options: RegulatoryDocumentFetcherOptions) {
    const sources = new Map<string, Readonly<RegisteredRegulatorySource>>();
    for (const source of options.sources) {
      if (!source.sourceKey || sources.has(source.sourceKey)) {
        throw new RegulatoryFetchError("UNREGISTERED_SOURCE", "Regulatory source registry contains a missing or duplicate source key");
      }
      sources.set(source.sourceKey, Object.freeze({
        ...source,
        allowedHosts: Object.freeze(source.allowedHosts.map(normalizeHost)),
      }));
    }
    this.sources = sources;
    this.resolver = options.resolver ?? defaultResolver;
    this.transport = options.transport ?? directHttpsTransport;
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? ((milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds)));
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.operationTimeoutMs = options.operationTimeoutMs ?? 45_000;
    this.maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
    this.maxRedirects = options.maxRedirects ?? 3;
    this.minRequestIntervalMs = options.minRequestIntervalMs ?? 1_000;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.parserVersion = options.parserVersion ?? "regulatory-direct-v1";
    this.allowedMimeTypes = new Set(options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES);
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.robotsCacheTtlMs = options.robotsCacheTtlMs ?? 6 * 60 * 60 * 1_000;
    this.monotonicNow = options.monotonicNow ?? Date.now;
  }

  async fetch(sourceKey: string): Promise<RegulatoryFetchedDocument> {
    const source = this.sources.get(sourceKey);
    if (!source) throw new RegulatoryFetchError("UNREGISTERED_SOURCE", `Regulatory source ${sourceKey} is not registered`);
    this.assertSourcePolicy(source);
    const controller = new AbortController();
    const context: AcquisitionContext = {
      signal: controller.signal,
      abort: () => controller.abort(),
      deadline: this.monotonicNow() + this.operationTimeoutMs,
    };
    const deadlineTimer = setTimeout(() => controller.abort(), this.operationTimeoutMs);
    try {
      const initialUrl = this.validateUrl(source, source.canonicalUrl, "INVALID_URL");
      await this.assertRobotsAllowed(source, initialUrl, context);
      const { response, finalUrl, redirectCount } = await this.requestFollowingRedirects(source, initialUrl, context);
      if (response.statusCode === 429) throw new RegulatoryFetchError("RATE_LIMITED", "Official source rate-limited direct retrieval");
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new RegulatoryFetchError("HTTP_STATUS", `Official source returned HTTP ${response.statusCode}`);
      }
      const mimeType = (headerValue(response.headers, "content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
      if (!this.allowedMimeTypes.has(mimeType)) {
        throw new RegulatoryFetchError("UNSUPPORTED_MIME", `Regulatory document MIME ${mimeType || "missing"} is not allowed`);
      }
      const declaredLength = Number(headerValue(response.headers, "content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxBytes) {
        throw new RegulatoryFetchError("OVERSIZED_DOCUMENT", "Regulatory document exceeds maximum size before download");
      }
      const bytes = await this.readBounded(response.body, context);
      const receipt: RegulatoryFetchReceipt = Object.freeze({
        sourceKey: source.sourceKey,
        requestedUrl: initialUrl.toString(),
        finalUrl: finalUrl.toString(),
        fetchedAt: this.now().toISOString(),
        statusCode: response.statusCode,
        mimeType,
        byteLength: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        etag: headerValue(response.headers, "etag"),
        lastModified: headerValue(response.headers, "last-modified"),
        parserVersion: this.parserVersion,
        redirectCount,
        transport: "direct_official_https",
      });
      return Object.freeze({ bytes, receipt });
    } finally {
      clearTimeout(deadlineTimer);
    }
  }

  private assertSourcePolicy(source: RegisteredRegulatorySource): void {
    if (!source.sourceKey || !source.allowedHosts.length) throw new RegulatoryFetchError("UNREGISTERED_SOURCE", "Source is not registered with official hosts");
    if (source.termsStatus !== "approved") throw new RegulatoryFetchError("TERMS_NOT_APPROVED", "Official source terms have not been approved for retrieval");
    if (source.retentionStatus !== "approved") throw new RegulatoryFetchError("RETENTION_NOT_APPROVED", "Official source retention policy has not been approved");
    if (source.licensingStatus !== "permitted") throw new RegulatoryFetchError("LICENSING_NOT_APPROVED", "Official source licensing/usage permission has not been approved");
  }

  private validateUrl(source: RegisteredRegulatorySource, rawUrl: string, invalidCode: RegulatoryFetchErrorCode): URL {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new RegulatoryFetchError(invalidCode, `Invalid regulatory URL: ${rawUrl}`); }
    if (url.protocol !== "https:") throw new RegulatoryFetchError("NON_HTTPS_URL", "Only HTTPS official sources may be retrieved");
    if (url.username || url.password || url.port) throw new RegulatoryFetchError("INVALID_URL", "Credentialed or custom-port URLs are not allowed");
    const allowed = new Set(source.allowedHosts.map(normalizeHost));
    if (!allowed.has(normalizeHost(url.hostname))) throw new RegulatoryFetchError("UNAPPROVED_HOST", `Host ${url.hostname} is not registered for ${source.sourceKey}`);
    return url;
  }

  private async resolvePublicAddress(url: URL, context: AcquisitionContext): Promise<ResolvedAddress[]> {
    let addresses: ResolvedAddress[];
    try { addresses = await this.withDeadline(this.resolver(url.hostname, context.signal), context); } catch (error) {
      if (error instanceof RegulatoryFetchError) throw error;
      throw new RegulatoryFetchError("DNS_LOOKUP_FAILED", `DNS lookup failed for ${url.hostname}`, error);
    }
    if (!addresses.length) throw new RegulatoryFetchError("DNS_LOOKUP_FAILED", `No address resolved for ${url.hostname}`);
    if (addresses.some(({ address }) => isBlockedAddress(address))) {
      throw new RegulatoryFetchError("PRIVATE_OR_RESERVED_ADDRESS", `Refusing private or reserved address for ${url.hostname}`);
    }
    return addresses;
  }

  /**
   * Serializes competing acquisitions for one official host and reserves the
   * next rate slot before awaiting, so concurrent callers can never observe the
   * same "last request" value and burst together.
   *
   * Enqueueing is synchronous: there is no `await` between reading the chain
   * tail and writing the new one, so on a single-threaded runtime each caller
   * necessarily observes a distinct predecessor. Queue waiting and rate spacing
   * both run through `withDeadline`, so a queued request fails closed with
   * `TIMEOUT` rather than waiting past the operation deadline, and the `finally`
   * release runs on success, failure, timeout and cancellation alike.
   *
   * Different hosts use independent chains and never block each other.
   */
  private async withHostGate<T>(host: string, context: AcquisitionContext, action: () => Promise<T>): Promise<T> {
    const key = normalizeHost(host);
    const predecessor = this.hostGates.get(key) ?? Promise.resolve();
    let release!: () => void;
    // `mine` only ever resolves, so the chain cannot poison a later waiter or
    // surface an unhandled rejection.
    const mine = new Promise<void>(resolve => { release = resolve; });
    const composed = predecessor.then(() => mine);
    this.hostGates.set(key, composed);
    try {
      await this.withDeadline(predecessor, context);
      const now = this.now().getTime();
      const earliest = this.nextRequestAt.get(key) ?? 0;
      const wait = earliest - now;
      if (wait > 0) {
        // Fail closed immediately when the reserved slot lies beyond this
        // acquisition's deadline, rather than sleeping into a certain expiry.
        if (wait >= this.remaining(context)) {
          throw new RegulatoryFetchError("TIMEOUT", `Acquisition deadline expires before the ${key} rate slot`);
        }
        await this.withDeadline(this.sleep(wait), context);
      }
      this.nextRequestAt.set(key, this.now().getTime() + this.minRequestIntervalMs);
      return await action();
    } finally {
      release();
      if (this.hostGates.get(key) === composed) this.hostGates.delete(key);
    }
  }

  private async requestOnce(url: URL, context: AcquisitionContext, accept: string = DOCUMENT_ACCEPT): Promise<RegulatoryTransportResponse> {
    // The gate covers address resolution and the response headers only. Body
    // streaming stays outside it so a slow document cannot hold the host.
    return this.withHostGate(url.hostname, context, async () => {
      const addresses = await this.resolvePublicAddress(url, context);
      try {
        return await this.withDeadline(this.transport.request({
          url,
          headers: { "user-agent": this.userAgent, "accept": accept },
          timeoutMs: Math.min(this.timeoutMs, this.remaining(context)),
          resolvedAddresses: addresses,
          signal: context.signal,
        }), context);
      } catch (error) {
        if (error instanceof RegulatoryFetchError) throw error;
        const code = error instanceof Error && /timeout/i.test(error.message) ? "TIMEOUT" : "TRANSPORT_FAILURE";
        throw new RegulatoryFetchError(code, `Direct official-host retrieval failed for ${url}`, error);
      }
    });
  }

  private async requestFollowingRedirects(source: RegisteredRegulatorySource, initialUrl: URL, context: AcquisitionContext, checkRedirectRobots = true, accept: string = DOCUMENT_ACCEPT): Promise<{ response: RegulatoryTransportResponse; finalUrl: URL; redirectCount: number }> {
    let url = initialUrl;
    for (let redirectCount = 0; redirectCount <= this.maxRedirects; redirectCount += 1) {
      const response = await this.requestWithRetries(url, context, accept);
      if (![301, 302, 303, 307, 308].includes(response.statusCode)) return { response, finalUrl: url, redirectCount };
      const location = headerValue(response.headers, "location");
      if (!location) throw new RegulatoryFetchError("REDIRECT_DENIED", "Official source returned a redirect without a location");
      if (redirectCount === this.maxRedirects) throw new RegulatoryFetchError("TOO_MANY_REDIRECTS", "Official source exceeded redirect limit");
      let redirected: URL;
      try { redirected = new URL(location, url); } catch { throw new RegulatoryFetchError("REDIRECT_DENIED", "Official source returned an invalid redirect"); }
      try { this.validateUrl(source, redirected.toString(), "REDIRECT_DENIED"); } catch (error) {
        if (error instanceof RegulatoryFetchError && error.code === "UNAPPROVED_HOST") throw new RegulatoryFetchError("REDIRECT_DENIED", error.message);
        throw error;
      }
      if (checkRedirectRobots) await this.assertRobotsAllowed(source, redirected, context);
      url = redirected;
    }
    throw new RegulatoryFetchError("TOO_MANY_REDIRECTS", "Official source exceeded redirect limit");
  }

  private async assertRobotsAllowed(source: RegisteredRegulatorySource, target: URL, context: AcquisitionContext): Promise<void> {
    const origin = target.origin;
    let cached = this.robotsCache.get(origin);
    if (cached && this.monotonicNow() - cached.fetchedAt >= this.robotsCacheTtlMs) {
      this.robotsCache.delete(origin);
      cached = undefined;
    }
    let robots = cached?.parser;
    if (!robots) {
      const robotsUrl = new URL("/robots.txt", origin);
      let response: RegulatoryTransportResponse;
      try { response = await this.requestFollowingRedirects(source, robotsUrl, context, false, ROBOTS_ACCEPT).then(result => result.response); } catch (error) {
        if (error instanceof RegulatoryFetchError && ["PRIVATE_OR_RESERVED_ADDRESS", "UNAPPROVED_HOST", "NON_HTTPS_URL", "REDIRECT_DENIED", "TIMEOUT", "RATE_LIMITED"].includes(error.code)) throw error;
        throw new RegulatoryFetchError("ROBOTS_UNAVAILABLE", `Could not establish robots policy for ${origin}`, error);
      }
      const status = response.statusCode;
      const unavailable = status >= 400 && status < 500 && status !== 429;
      if (unavailable) {
        // RFC 9309 section 2.3.1.3: a 4xx robots.txt is "unavailable" — the
        // host publishes no restrictions — and a crawler may access any
        // resource. Object-storage and CDN hosts answer 400/403/404 because
        // they simply have no such key, which is where authorities publish
        // their actual documents. 429 is excluded: it means slow down, not
        // "no rules". 5xx remains "unreachable" and still fails closed below.
        //
        // This is narrower than it looks: a robots.txt that exists and
        // disallows is still obeyed, and an unreadable 2xx body still fails.
        robots = robotsParser(robotsUrl.toString(), "User-agent: *\nAllow: /");
      } else if (status < 200 || status >= 300) {
        throw new RegulatoryFetchError("ROBOTS_UNAVAILABLE", `robots.txt returned HTTP ${status}`);
      } else {
        const mime = (headerValue(response.headers, "content-type") ?? "text/plain").split(";", 1)[0].trim().toLowerCase();
        if (mime && mime !== "text/plain") throw new RegulatoryFetchError("ROBOTS_UNAVAILABLE", "robots.txt did not return text/plain");
        try {
          robots = robotsParser(robotsUrl.toString(), (await this.readBounded(response.body, context, 512 * 1024)).toString("utf8"));
        } catch (error) {
          throw new RegulatoryFetchError("ROBOTS_UNAVAILABLE", `Could not read robots policy for ${origin}`, error);
        }
      }
      this.robotsCache.set(origin, { parser: robots, fetchedAt: this.monotonicNow() });
    }
    if (robots.isAllowed(target.toString(), this.userAgent) !== true) {
      throw new RegulatoryFetchError("ROBOTS_DENIED", `robots.txt does not explicitly allow ${target.pathname}`);
    }
  }

  private async readBounded(body: AsyncIterable<Uint8Array>, context: AcquisitionContext, maximumBytes = this.maxBytes): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    const iterator = body[Symbol.asyncIterator]();
    while (true) {
      const next = await this.withDeadline(iterator.next(), context);
      if (next.done) break;
      const chunk = next.value;
      const bytes = Buffer.from(chunk);
      byteLength += bytes.length;
      if (byteLength > maximumBytes) throw new RegulatoryFetchError("OVERSIZED_DOCUMENT", "Regulatory document exceeds maximum size");
      chunks.push(bytes);
    }
    return Buffer.concat(chunks);
  }

  private async requestWithRetries(url: URL, context: AcquisitionContext, accept: string = DOCUMENT_ACCEPT): Promise<RegulatoryTransportResponse> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const response = await this.requestOnce(url, context, accept);
      const retryable = response.statusCode === 429 || (response.statusCode >= 500 && response.statusCode <= 599);
      if (!retryable || attempt === this.maxAttempts) {
        if (response.statusCode === 429) throw new RegulatoryFetchError("RATE_LIMITED", `Official source rate-limited after ${attempt} direct attempts`);
        return response;
      }
      await this.withDeadline(this.sleep(this.retryDelayMs * attempt), context);
    }
    throw new RegulatoryFetchError("TRANSPORT_FAILURE", "Retry loop exhausted unexpectedly");
  }

  private remaining(context: AcquisitionContext): number {
    const remaining = context.deadline - this.monotonicNow();
    if (context.signal.aborted || remaining <= 0) throw new RegulatoryFetchError("TIMEOUT", "Regulatory acquisition deadline expired");
    return remaining;
  }

  private async withDeadline<T>(promise: Promise<T>, context: AcquisitionContext): Promise<T> {
    const remaining = this.remaining(context);
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        context.abort();
        reject(new RegulatoryFetchError("TIMEOUT", "Regulatory acquisition deadline expired"));
      }, remaining);
      const abort = () => reject(new RegulatoryFetchError("TIMEOUT", "Regulatory acquisition deadline expired"));
      context.signal.addEventListener("abort", abort, { once: true });
      promise.then(resolve, reject).finally(() => {
        clearTimeout(timeout);
        context.signal.removeEventListener("abort", abort);
      });
    });
  }
}

interface AcquisitionContext {
  signal: AbortSignal;
  abort: () => void;
  deadline: number;
}

/** Exported for focused policy tests and security audits. */
export const isPrivateOrReservedRegulatoryAddress = isBlockedAddress;
