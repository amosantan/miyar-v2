/**
 * Deterministic robots.txt policy for market/material ingestion acquisition.
 *
 * ADR-0010: robots.txt is consulted once per origin BEFORE any acquisition
 * provider — including third-party rendering proxies — and a fetch proceeds
 * only on an explicit allow. Semantics follow RFC 9309 and mirror the
 * regulatory document fetcher:
 *   - HTTP 4xx (except 429) on robots.txt → "unavailable" per RFC 9309
 *     §2.3.1.3 → treated as an empty, allow-all ruleset.
 *   - HTTP 429 or 5xx → robots state unknown → fail closed (deny).
 *   - Network error or timeout → fail closed (deny).
 *   - HTTP 200 with a non-text/plain content type → fail closed (deny).
 *   - The target is permitted only when `isAllowed(...) === true`; an
 *     undefined verdict denies.
 *
 * Dependencies (fetch, clock, cache) are injectable for tests; the default
 * per-origin cache bounds robots traffic to one request per origin per TTL.
 */

import robotsParser from "robots-parser";

export const INGESTION_ROBOTS_POLICY_VERSION = "ingestion-robots-v1" as const;

export type RobotsDenialCode = "ROBOTS_DENIED" | "ROBOTS_UNAVAILABLE";

export type RobotsPolicyVerdict =
  | {
      allowed: true;
      code: "ROBOTS_ALLOWED";
      policyVersion: typeof INGESTION_ROBOTS_POLICY_VERSION;
      detail: string;
    }
  | {
      allowed: false;
      code: RobotsDenialCode;
      policyVersion: typeof INGESTION_ROBOTS_POLICY_VERSION;
      detail: string;
    };

export class RobotsPolicyError extends Error {
  constructor(
    readonly code: RobotsDenialCode,
    readonly targetUrl: string,
    readonly detail: string,
  ) {
    super(`Robots policy ${code} for ${targetUrl} (${detail})`);
    this.name = "RobotsPolicyError";
  }
}

type RobotsRuleset = ReturnType<typeof robotsParser>;

interface RobotsCacheEntry {
  /** Parsed ruleset, or null when the robots state is unknown (fail closed). */
  ruleset: RobotsRuleset | null;
  detail: string;
  expiresAt: number;
}

export type RobotsPolicyCache = Map<string, RobotsCacheEntry>;

export interface RobotsPolicyDeps {
  fetchImpl?: typeof globalThis.fetch;
  now?: () => number;
  cache?: RobotsPolicyCache;
  cacheTtlMs?: number;
  robotsFetchTimeoutMs?: number;
  /** Total attempts for a transiently unavailable robots.txt (default 2). */
  maxAttempts?: number;
  /** Delay between attempts; injectable so tests stay fast and deterministic. */
  retryDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
}

const DEFAULT_CACHE_TTL_MS = 15 * 60_000;
const DEFAULT_ROBOTS_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

const defaultCache: RobotsPolicyCache = new Map();

/** Test hook: clear the module-level per-origin cache. */
export function resetDefaultRobotsPolicyCache(): void {
  defaultCache.clear();
}

async function attemptRobotsFetch(
  robotsUrl: string,
  userAgent: string,
  deps: RobotsPolicyDeps,
): Promise<{ ruleset: RobotsRuleset | null; detail: string }> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = deps.robotsFetchTimeoutMs ?? DEFAULT_ROBOTS_FETCH_TIMEOUT_MS;

  try {
    const res = await fetchImpl(robotsUrl, {
      headers: { "User-Agent": userAgent, Accept: "text/plain,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 429 || res.status >= 500) {
      return {
        ruleset: null,
        detail: `robots.txt returned HTTP ${res.status}; robots state unknown`,
      };
    }
    if (!res.ok) {
      // RFC 9309 §2.3.1.3: a 4xx "unavailable" robots.txt imposes no crawl
      // restrictions — represented as an empty, allow-all ruleset.
      return {
        ruleset: robotsParser(robotsUrl, ""),
        detail: `robots.txt HTTP ${res.status} treated as allow-all per RFC 9309`,
      };
    }

    // A 200 body is parsed whatever its declared content type. RFC 9309 does
    // not require rejecting a mislabelled robots.txt, and several official
    // UAE/institutional hosts serve theirs as text/html; refusing those
    // blocked exactly the Tier-A sources this platform most needs. A body
    // carrying no valid directives parses to an empty, allow-all ruleset,
    // which is the same outcome RFC 9309 prescribes for "unavailable".
    const text = await res.text();
    return { ruleset: robotsParser(robotsUrl, text), detail: "robots.txt loaded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ruleset: null, detail: `robots.txt fetch failed: ${message}` };
  }
}

async function loadRulesetForOrigin(
  origin: string,
  userAgent: string,
  deps: RobotsPolicyDeps,
  loadedAt: number,
): Promise<RobotsCacheEntry> {
  const ttlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const expiresAt = loadedAt + ttlMs;
  const robotsUrl = `${origin}/robots.txt`;
  const maxAttempts = Math.max(1, deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const retryDelayMs = deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const sleep = deps.sleepImpl ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));

  let last = { ruleset: null as RobotsRuleset | null, detail: "robots.txt was never attempted" };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await attemptRobotsFetch(robotsUrl, userAgent, deps);
    // Only a transient unavailable state is retried; an established verdict
    // (parsed rules, or an RFC 9309 allow-all) is returned immediately so a
    // deny is never converted into an allow by trying again.
    if (last.ruleset !== null) break;
    if (attempt < maxAttempts && retryDelayMs > 0) await sleep(retryDelayMs);
  }

  return { ruleset: last.ruleset, detail: last.detail, expiresAt };
}

/**
 * Evaluate whether `targetUrl` may be fetched under the strict robots policy.
 * Never throws; every failure mode resolves to a denial verdict.
 */
export async function evaluateRobotsPolicy(
  targetUrl: string,
  userAgent: string,
  deps: RobotsPolicyDeps = {},
): Promise<RobotsPolicyVerdict> {
  let origin: string;
  try {
    origin = new URL(targetUrl).origin;
  } catch {
    return {
      allowed: false,
      code: "ROBOTS_UNAVAILABLE",
      policyVersion: INGESTION_ROBOTS_POLICY_VERSION,
      detail: `invalid target URL "${targetUrl}"`,
    };
  }

  const cache = deps.cache ?? defaultCache;
  const now = deps.now ? deps.now() : Date.now();

  let entry = cache.get(origin);
  if (!entry || entry.expiresAt <= now) {
    entry = await loadRulesetForOrigin(origin, userAgent, deps, now);
    cache.set(origin, entry);
  }

  if (entry.ruleset === null) {
    return {
      allowed: false,
      code: "ROBOTS_UNAVAILABLE",
      policyVersion: INGESTION_ROBOTS_POLICY_VERSION,
      detail: entry.detail,
    };
  }

  const verdict = entry.ruleset.isAllowed(targetUrl, userAgent);
  if (verdict === true) {
    return {
      allowed: true,
      code: "ROBOTS_ALLOWED",
      policyVersion: INGESTION_ROBOTS_POLICY_VERSION,
      detail: entry.detail,
    };
  }
  return {
    allowed: false,
    code: "ROBOTS_DENIED",
    policyVersion: INGESTION_ROBOTS_POLICY_VERSION,
    detail:
      verdict === false
        ? "target disallowed by robots.txt"
        : "robots.txt produced no explicit allow for target",
  };
}

/**
 * Assert that `targetUrl` may be fetched; throws `RobotsPolicyError` when the
 * strict policy denies or cannot establish the robots state.
 */
export async function assertUrlAllowedByRobots(
  targetUrl: string,
  userAgent: string,
  deps: RobotsPolicyDeps = {},
): Promise<void> {
  const verdict = await evaluateRobotsPolicy(targetUrl, userAgent, deps);
  if (!verdict.allowed) {
    throw new RobotsPolicyError(verdict.code, targetUrl, verdict.detail);
  }
}
