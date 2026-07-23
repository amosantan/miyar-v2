import { describe, expect, it, vi } from "vitest";
import {
  INGESTION_ROBOTS_POLICY_VERSION,
  RobotsPolicyError,
  assertUrlAllowedByRobots,
  evaluateRobotsPolicy,
  type RobotsPolicyCache,
} from "./robots-policy";

const UA = "MIYARBot/1.0";

function robotsResponse(
  body: string,
  status = 200,
  contentType = "text/plain",
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL) => handler(String(input)));
}

function freshDeps(fetchImpl: ReturnType<typeof stubFetch>, nowMs = 1_000) {
  const cache: RobotsPolicyCache = new Map();
  let now = nowMs;
  const sleeps: number[] = [];
  return {
    deps: {
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
      cache,
      now: () => now,
      // Keep retry behavior deterministic and instant in tests.
      sleepImpl: async (ms: number) => {
        sleeps.push(ms);
      },
    },
    cache,
    sleeps,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("robots-policy (ingestion-robots-v1)", () => {
  it("exposes the v1 policy version", () => {
    expect(INGESTION_ROBOTS_POLICY_VERSION).toBe("ingestion-robots-v1");
  });

  it("allows a target explicitly permitted by robots.txt", async () => {
    const fetchImpl = stubFetch(() =>
      robotsResponse("User-agent: *\nDisallow: /private/\n"),
    );
    const { deps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy(
      "https://example.com/public/page",
      UA,
      deps,
    );
    expect(verdict).toMatchObject({ allowed: true, code: "ROBOTS_ALLOWED" });
  });

  it("denies a target disallowed by robots.txt", async () => {
    const fetchImpl = stubFetch(() =>
      robotsResponse("User-agent: *\nDisallow: /private/\n"),
    );
    const { deps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy(
      "https://example.com/private/page",
      UA,
      deps,
    );
    expect(verdict).toMatchObject({ allowed: false, code: "ROBOTS_DENIED" });
  });

  it("treats an empty robots.txt as allow-all", async () => {
    const fetchImpl = stubFetch(() => robotsResponse(""));
    const { deps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict.allowed).toBe(true);
  });

  it("treats a 404 robots.txt as allow-all per RFC 9309", async () => {
    const fetchImpl = stubFetch(() => robotsResponse("not found", 404, "text/html"));
    const { deps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict.allowed).toBe(true);
  });

  it("treats a 403 robots.txt as allow-all per RFC 9309", async () => {
    const fetchImpl = stubFetch(() => robotsResponse("denied", 403, "text/html"));
    const { deps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict.allowed).toBe(true);
  });

  it("fails closed on a 429 robots.txt after retrying", async () => {
    const fetchImpl = stubFetch(() => robotsResponse("slow down", 429));
    const { deps, sleeps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict).toMatchObject({ allowed: false, code: "ROBOTS_UNAVAILABLE" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleeps).toHaveLength(1);
  });

  it("fails closed on a 5xx robots.txt", async () => {
    const fetchImpl = stubFetch(() => robotsResponse("boom", 503));
    const { deps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict).toMatchObject({ allowed: false, code: "ROBOTS_UNAVAILABLE" });
  });

  it("fails closed when the robots.txt fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const { deps } = freshDeps(fetchImpl as never);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict).toMatchObject({ allowed: false, code: "ROBOTS_UNAVAILABLE" });
    expect(verdict.detail).toContain("ECONNREFUSED");
  });

  it("parses a 200 robots.txt served as text/html rather than refusing it", async () => {
    // Several official UAE/institutional hosts (e.g. rics.org) serve a valid
    // robots.txt as text/html. RFC 9309 does not require rejecting those, and
    // refusing them blocked exactly the Tier-A sources MIYAR needs.
    const fetchImpl = stubFetch(() =>
      robotsResponse("User-agent: *\nDisallow: /private/\n", 200, "text/html"),
    );
    const { deps } = freshDeps(fetchImpl);
    expect(
      (await evaluateRobotsPolicy("https://example.com/public/a", UA, deps)).allowed,
    ).toBe(true);
    expect(
      await evaluateRobotsPolicy("https://example.com/private/a", UA, deps),
    ).toMatchObject({ allowed: false, code: "ROBOTS_DENIED" });
  });

  it("treats a directive-free 200 body as allow-all", async () => {
    const fetchImpl = stubFetch(() =>
      robotsResponse("<html><body>not a robots file</body></html>", 200, "text/html"),
    );
    const { deps } = freshDeps(fetchImpl);
    expect((await evaluateRobotsPolicy("https://example.com/x", UA, deps)).allowed).toBe(true);
  });

  it("recovers when a transient failure is followed by a good response", async () => {
    let call = 0;
    const fetchImpl = stubFetch(() => {
      call += 1;
      return call === 1
        ? robotsResponse("boom", 503)
        : robotsResponse("User-agent: *\nAllow: /\n");
    });
    const { deps, sleeps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict.allowed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([500]);
  });

  it("does not retry an established deny — a disallow cannot be retried into an allow", async () => {
    const fetchImpl = stubFetch(() => robotsResponse("User-agent: *\nDisallow: /\n"));
    const { deps, sleeps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(verdict).toMatchObject({ allowed: false, code: "ROBOTS_DENIED" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleeps).toHaveLength(0);
  });

  it("fails closed for an unparsable target URL", async () => {
    const fetchImpl = stubFetch(() => robotsResponse(""));
    const { deps } = freshDeps(fetchImpl);
    const verdict = await evaluateRobotsPolicy("not a url", UA, deps);
    expect(verdict).toMatchObject({ allowed: false, code: "ROBOTS_UNAVAILABLE" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("caches per origin within the TTL and refreshes after expiry", async () => {
    const fetchImpl = stubFetch(() => robotsResponse(""));
    const { deps, advance } = freshDeps(fetchImpl);

    await evaluateRobotsPolicy("https://example.com/a", UA, deps);
    await evaluateRobotsPolicy("https://example.com/b", UA, deps);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    advance(16 * 60_000);
    await evaluateRobotsPolicy("https://example.com/c", UA, deps);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("caches denial states so unavailable origins are not hammered", async () => {
    const fetchImpl = stubFetch(() => robotsResponse("boom", 500));
    const { deps } = freshDeps(fetchImpl);
    await evaluateRobotsPolicy("https://example.com/a", UA, deps);
    // One attempt plus its single retry, then the unavailable state is cached.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await evaluateRobotsPolicy("https://example.com/b", UA, deps);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("isolates verdicts per origin", async () => {
    const fetchImpl = stubFetch((url) =>
      url.startsWith("https://open.example")
        ? robotsResponse("")
        : robotsResponse("User-agent: *\nDisallow: /\n"),
    );
    const { deps } = freshDeps(fetchImpl);
    const open = await evaluateRobotsPolicy("https://open.example/x", UA, deps);
    const closed = await evaluateRobotsPolicy("https://closed.example/x", UA, deps);
    expect(open.allowed).toBe(true);
    expect(closed).toMatchObject({ allowed: false, code: "ROBOTS_DENIED" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("requests robots.txt with the caller user agent and a text/plain Accept", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        "User-Agent": UA,
        Accept: "text/plain",
      });
      return robotsResponse("");
    });
    const { deps } = freshDeps(fetchImpl as never);
    await evaluateRobotsPolicy("https://example.com/x", UA, deps);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/robots.txt",
      expect.anything(),
    );
  });

  it("assertUrlAllowedByRobots throws a typed error on denial", async () => {
    const fetchImpl = stubFetch(() =>
      robotsResponse("User-agent: *\nDisallow: /\n"),
    );
    const { deps } = freshDeps(fetchImpl);
    await expect(
      assertUrlAllowedByRobots("https://example.com/x", UA, deps),
    ).rejects.toMatchObject({
      name: "RobotsPolicyError",
      code: "ROBOTS_DENIED",
      targetUrl: "https://example.com/x",
    });
  });

  it("assertUrlAllowedByRobots resolves on allow", async () => {
    const fetchImpl = stubFetch(() => robotsResponse(""));
    const { deps } = freshDeps(fetchImpl);
    await expect(
      assertUrlAllowedByRobots("https://example.com/x", UA, deps),
    ).resolves.toBeUndefined();
  });

  it("exposes RobotsPolicyError for instanceof checks", () => {
    const error = new RobotsPolicyError("ROBOTS_DENIED", "https://x", "detail");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("ROBOTS_DENIED");
  });
});
