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
}

const DEFAULT_CACHE_TTL_MS = 15 * 60_000;
const DEFAULT_ROBOTS_FETCH_TIMEOUT_MS = 10_000;

const defaultCache: RobotsPolicyCache = new Map();

/** Test hook: clear the module-level per-origin cache. */
export function resetDefaultRobotsPolicyCache(): void {
  defaultCache.clear();
}

async function loadRulesetForOrigin(
  origin: string,
  userAgent: string,
  deps: RobotsPolicyDeps,
  loadedAt: number,
): Promise<RobotsCacheEntry> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = deps.robotsFetchTimeoutMs ?? DEFAULT_ROBOTS_FETCH_TIMEOUT_MS;
  const ttlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const expiresAt = loadedAt + ttlMs;
  const robotsUrl = `${origin}/robots.txt`;

  try {
    const res = await fetchImpl(robotsUrl, {
      headers: { "User-Agent": userAgent, Accept: "text/plain" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 429 || res.status >= 500) {
      return {
        ruleset: null,
        detail: `robots.txt returned HTTP ${res.status}; robots state unknown`,
        expiresAt,
      };
    }
    if (!res.ok) {
      // RFC 9309 §2.3.1.3: a 4xx "unavailable" robots.txt imposes no crawl
      // restrictions — represented as an empty, allow-all ruleset.
      return {
        ruleset: robotsParser(robotsUrl, ""),
        detail: `robots.txt HTTP ${res.status} treated as allow-all per RFC 9309`,
        expiresAt,
      };
    }

    const contentType = res.headers.get("content-type");
    if (contentType && !contentType.toLowerCase().includes("text/plain")) {
      return {
        ruleset: null,
        detail: `robots.txt served unexpected content type "${contentType}"`,
        expiresAt,
      };
    }

    const text = await res.text();
    return {
      ruleset: robotsParser(robotsUrl, text),
      detail: "robots.txt loaded",
      expiresAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ruleset: null,
      detail: `robots.txt fetch failed: ${message}`,
      expiresAt,
    };
  }
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
