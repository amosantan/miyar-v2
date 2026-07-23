/**
 * ADR-0010 regression coverage: the strict robots gate runs BEFORE any
 * acquisition provider (proxies included), no connector bypasses it via a
 * fetch() override, and the SCAD PDF connector's raw downloads are gated.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./robots-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./robots-policy")>();
  return {
    ...actual,
    evaluateRobotsPolicy: vi.fn(),
    assertUrlAllowedByRobots: vi.fn(),
  };
});

import {
  INGESTION_ROBOTS_POLICY_VERSION,
  RobotsPolicyError,
  assertUrlAllowedByRobots,
  evaluateRobotsPolicy,
} from "./robots-policy";
import {
  BaseSourceConnector,
  type ExtractedEvidence,
  type NormalizedEvidenceInput,
  type RawSourcePayload,
} from "./connector";
import {
  BayutListingsConnector,
  PropertyFinderListingsConnector,
} from "./connectors/index";
import { SCADPdfConnector } from "./connectors/scad-pdf-connector";

const PROVIDER_ENV_KEYS = [
  "FIRECRAWL_API_KEY",
  "SCRAPINGANT_API_KEY",
  "SCRAPINGDOG_API_KEY",
  "APIFY_API_KEY",
  "PARSEHUB_API_KEY",
  "PARSEHUB_PROJECT_TOKEN",
] as const;

class TestConnector extends BaseSourceConnector {
  sourceId = "test-robots-source";
  sourceName = "Test Robots Source";
  sourceUrl = "https://source.example/page";
  async extract(): Promise<ExtractedEvidence[]> {
    return [];
  }
  async normalize(): Promise<NormalizedEvidenceInput> {
    throw new Error("normalize is not exercised by these tests");
  }
}

const allowedVerdict = {
  allowed: true,
  code: "ROBOTS_ALLOWED",
  policyVersion: INGESTION_ROBOTS_POLICY_VERSION,
  detail: "robots.txt loaded",
} as const;

const deniedVerdict = {
  allowed: false,
  code: "ROBOTS_DENIED",
  policyVersion: INGESTION_ROBOTS_POLICY_VERSION,
  detail: "target disallowed by robots.txt",
} as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of PROVIDER_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of PROVIDER_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe("connector robots enforcement (ADR-0010)", () => {
  it("denies before ANY provider runs when robots refuses the source", async () => {
    vi.mocked(evaluateRobotsPolicy).mockResolvedValue(deniedVerdict);
    const conn = new TestConnector();
    const spies = [
      vi.spyOn(conn, "fetchWithFirecrawl"),
      vi.spyOn(conn, "fetchWithScrapingAnt"),
      vi.spyOn(conn, "fetchWithScrapingDog"),
      vi.spyOn(conn, "fetchWithApify"),
      vi.spyOn(conn, "fetchWithParseHub"),
      vi.spyOn(conn, "fetchBasic"),
    ];

    const result = await conn.fetch();

    expect(result.statusCode).toBe(403);
    expect(result.error).toContain("ROBOTS_DENIED");
    expect(result.url).toBe("https://source.example/page");
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
    expect(evaluateRobotsPolicy).toHaveBeenCalledWith(
      "https://source.example/page",
      expect.any(String),
      );
  });

  it("proceeds down the provider chain when robots allows", async () => {
    vi.mocked(evaluateRobotsPolicy).mockResolvedValue(allowedVerdict);
    vi.mocked(assertUrlAllowedByRobots).mockResolvedValue(undefined);
    const conn = new TestConnector();
    const canned: RawSourcePayload = {
      url: conn.sourceUrl,
      fetchedAt: new Date(),
      rawHtml: "<html>ok</html>",
      statusCode: 200,
    };
    const basicSpy = vi.spyOn(conn, "fetchBasic").mockResolvedValue(canned);

    const result = await conn.fetch();

    expect(result).toBe(canned);
    expect(basicSpy).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the robots state is unavailable", async () => {
    vi.mocked(evaluateRobotsPolicy).mockResolvedValue({
      ...deniedVerdict,
      code: "ROBOTS_UNAVAILABLE",
      detail: "robots.txt fetch failed: ECONNREFUSED",
    });
    const conn = new TestConnector();
    const basicSpy = vi.spyOn(conn, "fetchBasic");

    const result = await conn.fetch();

    expect(result.statusCode).toBe(403);
    expect(result.error).toContain("ROBOTS_UNAVAILABLE");
    expect(basicSpy).not.toHaveBeenCalled();
  });

  it("gates direct provider-helper calls defensively", async () => {
    vi.mocked(assertUrlAllowedByRobots).mockRejectedValue(
      new RobotsPolicyError(
        "ROBOTS_DENIED",
        "https://direct.example/x",
        "target disallowed by robots.txt",
      ),
    );
    const conn = new TestConnector();

    await expect(
      conn.fetchWithScrapingDog("https://direct.example/x"),
    ).rejects.toMatchObject({ name: "RobotsPolicyError", code: "ROBOTS_DENIED" });
    await expect(
      conn.fetchWithFirecrawl("https://direct.example/x"),
    ).rejects.toMatchObject({ name: "RobotsPolicyError" });
    await expect(
      conn.fetchWithApify("https://direct.example/x"),
    ).rejects.toMatchObject({ name: "RobotsPolicyError" });
  });

  it("Bayut and PropertyFinder no longer define fetch() overrides", () => {
    expect(
      Object.prototype.hasOwnProperty.call(BayutListingsConnector.prototype, "fetch"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        PropertyFinderListingsConnector.prototype,
        "fetch",
      ),
    ).toBe(false);
  });

  it("SCAD PDF connector performs no raw download when robots denies", async () => {
    vi.mocked(assertUrlAllowedByRobots).mockRejectedValue(
      new RobotsPolicyError(
        "ROBOTS_UNAVAILABLE",
        "https://www.scad.gov.ae/robots.txt",
        "robots.txt returned HTTP 503; robots state unknown",
      ),
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("should never be reached"));

    const scad = new SCADPdfConnector();
    const raw = await scad.fetch();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(raw.statusCode).toBe(0);
  });
});
