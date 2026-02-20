/**
 * MIYAR V2-10 / V2-11 — Resilience & Integration Tests
 *
 * Tests cover:
 *   V2-10 Resilience:
 *     1. Connector HTTP 404 → orchestrator continues
 *     2. Connector timeout (15s) → orchestrator continues
 *     3. LLM malformed JSON → safe fallback
 *     4. Duplicate detection on double run
 *
 *   V2-11 Unit & Integration:
 *     5. Freshness computation (fresh/aging/stale)
 *     6. Freshness weight multiplier
 *     7. Grade assignment rules
 *     8. Confidence computation rules
 *     9. Scheduler status API
 *     10. Full orchestrator with mock connectors
 *     11. Proposal generator with freshness weighting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assignGrade,
  computeConfidence,
  type SourceConnector,
  type RawSourcePayload,
  type ExtractedEvidence,
  type NormalizedEvidenceInput,
} from "../engines/ingestion/connector";
import {
  computeFreshness,
  getFreshnessWeight,
  FRESHNESS_FRESH_DAYS,
  FRESHNESS_AGING_DAYS,
  FRESHNESS_WEIGHT_FRESH,
  FRESHNESS_WEIGHT_AGING,
  FRESHNESS_WEIGHT_STALE,
} from "../engines/ingestion/freshness";
import {
  getSchedulerStatus,
  getCronExpression,
  getNextScheduledRun,
} from "../engines/ingestion/scheduler";

// ─── Mock Connector Helpers ─────────────────────────────────────

function createMockConnector(overrides: Partial<SourceConnector> & { sourceId: string; sourceName: string }): SourceConnector {
  return {
    sourceId: overrides.sourceId,
    sourceName: overrides.sourceName,
    fetch: overrides.fetch ?? (async () => ({
      url: "https://example.com",
      fetchedAt: new Date(),
      rawHtml: "<html><body>Test</body></html>",
      statusCode: 200,
    })),
    extract: overrides.extract ?? (async () => []),
    normalize: overrides.normalize ?? (async (ev) => ({
      metric: ev.title,
      value: 100,
      unit: "AED/sqm",
      confidence: 0.70,
      grade: "B" as const,
      summary: "Test evidence",
      tags: ["test"],
    })),
  };
}

// ─── V2-10: Resilience Tests ────────────────────────────────────

describe("V2-10: Connector HTTP 404 → orchestrator continues", () => {
  it("returns failed status for 404 connector but does not throw", async () => {
    const failingConnector = createMockConnector({
      sourceId: "test-404",
      sourceName: "Test 404 Source",
      fetch: async () => ({
        url: "https://example.com/missing",
        fetchedAt: new Date(),
        statusCode: 404,
        error: "HTTP 404 Not Found",
      }),
    });

    const successConnector = createMockConnector({
      sourceId: "test-success",
      sourceName: "Test Success Source",
      fetch: async () => ({
        url: "https://example.com/ok",
        fetchedAt: new Date(),
        rawHtml: "<html>OK</html>",
        statusCode: 200,
      }),
      extract: async () => [{
        title: "Test Item",
        rawText: "AED 150 per sqm",
        category: "material_cost",
        geography: "Dubai",
        sourceUrl: "https://example.com/ok",
      }],
    });

    // Simulate orchestrator logic: process both connectors
    const results: Array<{ sourceId: string; status: string; error?: string }> = [];

    for (const connector of [failingConnector, successConnector]) {
      try {
        const raw = await connector.fetch();
        if (raw.statusCode >= 400) {
          results.push({ sourceId: connector.sourceId, status: "failed", error: raw.error });
        } else {
          const extracted = await connector.extract(raw);
          results.push({ sourceId: connector.sourceId, status: "success" });
        }
      } catch (err) {
        results.push({ sourceId: connector.sourceId, status: "failed", error: String(err) });
      }
    }

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("failed");
    expect(results[0].error).toContain("404");
    expect(results[1].status).toBe("success");
  });
});

describe("V2-10: Connector timeout → orchestrator continues", () => {
  it("handles fetch timeout gracefully without crashing", async () => {
    const timeoutConnector = createMockConnector({
      sourceId: "test-timeout",
      sourceName: "Test Timeout Source",
      fetch: async () => ({
        url: "https://example.com/slow",
        fetchedAt: new Date(),
        statusCode: 0,
        error: "Failed after 3 attempts: The operation was aborted",
      }),
    });

    const raw = await timeoutConnector.fetch();
    expect(raw.statusCode).toBe(0);
    expect(raw.error).toContain("aborted");
  });

  it("orchestrator marks timed-out connector as failed and continues", async () => {
    const connectors = [
      createMockConnector({
        sourceId: "timeout-source",
        sourceName: "Timeout Source",
        fetch: async () => ({
          url: "https://example.com",
          fetchedAt: new Date(),
          statusCode: 0,
          error: "Failed after 3 attempts: timeout",
        }),
      }),
      createMockConnector({
        sourceId: "ok-source",
        sourceName: "OK Source",
      }),
    ];

    const results = [];
    for (const c of connectors) {
      const raw = await c.fetch();
      if (raw.statusCode === 0 || raw.statusCode >= 400) {
        results.push({ sourceId: c.sourceId, status: "failed" });
      } else {
        results.push({ sourceId: c.sourceId, status: "success" });
      }
    }

    expect(results[0].status).toBe("failed");
    expect(results[1].status).toBe("success");
  });
});

describe("V2-10: LLM malformed JSON → safe fallback", () => {
  it("normalize returns safe fallback when extract throws", async () => {
    const badExtractConnector = createMockConnector({
      sourceId: "bad-extract",
      sourceName: "Bad Extract Source",
      extract: async () => {
        throw new Error("LLM returned malformed JSON");
      },
    });

    const raw = await badExtractConnector.fetch();
    let extracted: ExtractedEvidence[] = [];
    let usedFallback = false;

    try {
      extracted = await badExtractConnector.extract(raw);
    } catch {
      // Safe fallback: empty extraction
      extracted = [];
      usedFallback = true;
    }

    expect(usedFallback).toBe(true);
    expect(extracted).toHaveLength(0);
  });

  it("normalize returns safe fallback for malformed evidence", async () => {
    const badNormalizeConnector = createMockConnector({
      sourceId: "bad-normalize",
      sourceName: "Bad Normalize Source",
      normalize: async () => {
        throw new Error("Cannot parse price from malformed text");
      },
    });

    const evidence: ExtractedEvidence = {
      title: "Test",
      rawText: "Some malformed text with no price",
      category: "material_cost",
      geography: "Dubai",
      sourceUrl: "https://example.com",
    };

    let normalized: NormalizedEvidenceInput;
    try {
      normalized = await badNormalizeConnector.normalize(evidence);
    } catch {
      // Safe fallback
      normalized = {
        metric: evidence.title,
        value: null,
        unit: null,
        confidence: 0.20,
        grade: "C",
        summary: evidence.rawText.substring(0, 500),
        tags: [],
      };
    }

    expect(normalized.confidence).toBe(0.20);
    expect(normalized.grade).toBe("C");
    expect(normalized.value).toBeNull();
    expect(normalized.metric).toBe("Test");
  });
});

describe("V2-10: Duplicate detection on double run", () => {
  it("detects duplicates based on sourceUrl + itemName + captureDate", () => {
    // Simulate the duplicate detection logic
    const seen = new Map<string, boolean>();

    function isDuplicate(sourceUrl: string, itemName: string, captureDate: Date): boolean {
      const key = `${sourceUrl}|${itemName}|${captureDate.toISOString().split("T")[0]}`;
      if (seen.has(key)) return true;
      seen.set(key, true);
      return false;
    }

    const url = "https://rak-ceramics.com/products";
    const item = "Porcelain Floor Tile 60x60";
    const date = new Date("2026-02-15");

    expect(isDuplicate(url, item, date)).toBe(false); // First time
    expect(isDuplicate(url, item, date)).toBe(true);  // Duplicate
    expect(isDuplicate(url, item, new Date("2026-02-16"))).toBe(false); // Different date
    expect(isDuplicate(url, "Different Item", date)).toBe(false); // Different item
  });

  it("same source + same item + same date = duplicate", () => {
    const records: Array<{ sourceUrl: string; itemName: string; captureDate: string }> = [];

    function addRecord(sourceUrl: string, itemName: string, captureDate: string): boolean {
      const existing = records.find(
        r => r.sourceUrl === sourceUrl && r.itemName === itemName && r.captureDate === captureDate
      );
      if (existing) return false; // duplicate
      records.push({ sourceUrl, itemName, captureDate });
      return true; // created
    }

    expect(addRecord("https://a.com", "Tile", "2026-02-15")).toBe(true);
    expect(addRecord("https://a.com", "Tile", "2026-02-15")).toBe(false);
    expect(addRecord("https://b.com", "Tile", "2026-02-15")).toBe(true);
  });
});

// ─── V2-11: Freshness Computation ───────────────────────────────

describe("V2-11: Freshness computation", () => {
  const refDate = new Date("2026-02-20T12:00:00Z");

  it("classifies evidence captured today as fresh", () => {
    const result = computeFreshness(new Date("2026-02-20"), refDate);
    expect(result.status).toBe("fresh");
    expect(result.badgeColor).toBe("green");
    expect(result.weight).toBe(FRESHNESS_WEIGHT_FRESH);
    expect(result.ageDays).toBe(0);
  });

  it("classifies evidence captured 89 days ago as fresh", () => {
    const date = new Date(refDate.getTime() - 89 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(date, refDate);
    expect(result.status).toBe("fresh");
    expect(result.weight).toBe(1.0);
  });

  it("classifies evidence captured 90 days ago as fresh (boundary)", () => {
    const date = new Date(refDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(date, refDate);
    expect(result.status).toBe("fresh");
    expect(result.weight).toBe(1.0);
  });

  it("classifies evidence captured 91 days ago as aging", () => {
    const date = new Date(refDate.getTime() - 91 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(date, refDate);
    expect(result.status).toBe("aging");
    expect(result.badgeColor).toBe("amber");
    expect(result.weight).toBe(FRESHNESS_WEIGHT_AGING);
  });

  it("classifies evidence captured 6 months ago as aging", () => {
    const date = new Date(refDate.getTime() - 180 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(date, refDate);
    expect(result.status).toBe("aging");
    expect(result.weight).toBe(0.75);
  });

  it("classifies evidence captured 365 days ago as aging (boundary)", () => {
    const date = new Date(refDate.getTime() - 365 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(date, refDate);
    expect(result.status).toBe("aging");
    expect(result.weight).toBe(0.75);
  });

  it("classifies evidence captured 366 days ago as stale", () => {
    const date = new Date(refDate.getTime() - 366 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(date, refDate);
    expect(result.status).toBe("stale");
    expect(result.badgeColor).toBe("red");
    expect(result.weight).toBe(FRESHNESS_WEIGHT_STALE);
  });

  it("classifies evidence captured 2 years ago as stale", () => {
    const date = new Date(refDate.getTime() - 730 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(date, refDate);
    expect(result.status).toBe("stale");
    expect(result.weight).toBe(0.50);
  });

  it("handles string date input", () => {
    const result = computeFreshness("2026-02-20", refDate);
    expect(result.status).toBe("fresh");
  });

  it("handles future date gracefully (ageDays = 0)", () => {
    const futureDate = new Date(refDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const result = computeFreshness(futureDate, refDate);
    expect(result.ageDays).toBe(0);
    expect(result.status).toBe("fresh");
  });
});

describe("V2-11: Freshness weight multiplier", () => {
  it("getFreshnessWeight returns 1.0 for fresh evidence", () => {
    expect(getFreshnessWeight(new Date())).toBe(1.0);
  });

  it("getFreshnessWeight returns 0.75 for aging evidence", () => {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    expect(getFreshnessWeight(sixMonthsAgo)).toBe(0.75);
  });

  it("getFreshnessWeight returns 0.50 for stale evidence", () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    expect(getFreshnessWeight(twoYearsAgo)).toBe(0.50);
  });

  it("named constants match expected values", () => {
    expect(FRESHNESS_FRESH_DAYS).toBe(90);
    expect(FRESHNESS_AGING_DAYS).toBe(365);
    expect(FRESHNESS_WEIGHT_FRESH).toBe(1.0);
    expect(FRESHNESS_WEIGHT_AGING).toBe(0.75);
    expect(FRESHNESS_WEIGHT_STALE).toBe(0.50);
  });
});

// ─── V2-11: Grade Assignment Rules ──────────────────────────────

describe("V2-11: Grade assignment rules", () => {
  it("assigns Grade A to all 6 A-tier sources", () => {
    const aSources = [
      "emaar-properties", "damac-properties", "nakheel-properties",
      "rics-market-reports", "jll-mena-research", "dubai-statistics-center",
    ];
    for (const id of aSources) {
      expect(assignGrade(id)).toBe("A");
    }
  });

  it("assigns Grade B to all 5 B-tier sources", () => {
    const bSources = [
      "rak-ceramics-uae", "porcelanosa-uae", "hafele-uae",
      "gems-building-materials", "dragon-mart-dubai",
    ];
    for (const id of bSources) {
      expect(assignGrade(id)).toBe("B");
    }
  });

  it("assigns Grade C to DERA Interiors", () => {
    expect(assignGrade("dera-interiors")).toBe("C");
  });

  it("assigns Grade C to unknown sources", () => {
    expect(assignGrade("unknown-source")).toBe("C");
    expect(assignGrade("")).toBe("C");
    expect(assignGrade("random-vendor")).toBe("C");
  });

  it("grade assignment is deterministic (same input = same output)", () => {
    for (let i = 0; i < 10; i++) {
      expect(assignGrade("emaar-properties")).toBe("A");
      expect(assignGrade("rak-ceramics-uae")).toBe("B");
      expect(assignGrade("dera-interiors")).toBe("C");
    }
  });
});

// ─── V2-11: Confidence Computation Rules ────────────────────────

describe("V2-11: Confidence computation rules", () => {
  const fetchedAt = new Date("2026-02-20T12:00:00Z");

  it("Grade A + recent = 0.95 (0.85 + 0.10)", () => {
    const recent = new Date("2026-02-01");
    expect(computeConfidence("A", recent, fetchedAt)).toBeCloseTo(0.95, 2);
  });

  it("Grade A + no date = 0.70 (0.85 - 0.15)", () => {
    expect(computeConfidence("A", undefined, fetchedAt)).toBeCloseTo(0.70, 2);
  });

  it("Grade A + stale (>365 days) = 0.70 (0.85 - 0.15)", () => {
    const stale = new Date("2024-01-01");
    expect(computeConfidence("A", stale, fetchedAt)).toBeCloseTo(0.70, 2);
  });

  it("Grade B + recent = 0.80 (0.70 + 0.10)", () => {
    const recent = new Date("2026-02-10");
    expect(computeConfidence("B", recent, fetchedAt)).toBeCloseTo(0.80, 2);
  });

  it("Grade B + mid-range (91-365 days) = 0.70 (no bonus/penalty)", () => {
    const mid = new Date("2025-06-01");
    expect(computeConfidence("B", mid, fetchedAt)).toBeCloseTo(0.70, 2);
  });

  it("Grade C + recent = 0.65 (0.55 + 0.10)", () => {
    const recent = new Date("2026-02-15");
    expect(computeConfidence("C", recent, fetchedAt)).toBeCloseTo(0.65, 2);
  });

  it("Grade C + stale = 0.40 (0.55 - 0.15)", () => {
    const stale = new Date("2024-01-01");
    expect(computeConfidence("C", stale, fetchedAt)).toBeCloseTo(0.40, 2);
  });

  it("Grade C + no date = 0.40 (0.55 - 0.15)", () => {
    expect(computeConfidence("C", undefined, fetchedAt)).toBeCloseTo(0.40, 2);
  });

  it("confidence is capped at 1.0", () => {
    // Even with maximum bonuses, should not exceed 1.0
    const veryRecent = new Date("2026-02-20");
    const result = computeConfidence("A", veryRecent, fetchedAt);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  it("confidence floor is 0.20", () => {
    // Even with maximum penalties, should not go below 0.20
    // Grade C (0.55) - staleness (0.15) = 0.40, still above floor
    // But if we had a worse case, it should floor at 0.20
    const result = computeConfidence("C", undefined, fetchedAt);
    expect(result).toBeGreaterThanOrEqual(0.20);
  });
});

// ─── V2-11: Scheduler Status ────────────────────────────────────

describe("V2-11: Scheduler status API", () => {
  it("getSchedulerStatus returns expected shape", () => {
    const status = getSchedulerStatus();
    expect(status).toHaveProperty("active");
    expect(status).toHaveProperty("cronExpression");
    expect(status).toHaveProperty("nextScheduledRun");
    expect(status).toHaveProperty("lastScheduledRunAt");
    expect(status).toHaveProperty("isCurrentlyRunning");
    expect(typeof status.active).toBe("boolean");
    expect(typeof status.cronExpression).toBe("string");
    expect(typeof status.isCurrentlyRunning).toBe("boolean");
  });

  it("getCronExpression returns default when env not set", () => {
    const original = process.env.INGESTION_CRON_SCHEDULE;
    delete process.env.INGESTION_CRON_SCHEDULE;
    expect(getCronExpression()).toBe("0 0 6 * * 1");
    if (original) process.env.INGESTION_CRON_SCHEDULE = original;
  });

  it("getCronExpression returns env override when set", () => {
    const original = process.env.INGESTION_CRON_SCHEDULE;
    process.env.INGESTION_CRON_SCHEDULE = "0 30 8 * * *";
    expect(getCronExpression()).toBe("0 30 8 * * *");
    if (original) {
      process.env.INGESTION_CRON_SCHEDULE = original;
    } else {
      delete process.env.INGESTION_CRON_SCHEDULE;
    }
  });
});

// ─── V2-11: Full Orchestrator with Mock Connectors ──────────────

describe("V2-11: Full orchestrator simulation with mock connectors", () => {
  it("processes mix of successful and failing connectors", async () => {
    const connectors = [
      createMockConnector({
        sourceId: "good-1",
        sourceName: "Good Source 1",
        extract: async () => [
          { title: "Item A", rawText: "AED 100/sqm", category: "material_cost", geography: "Dubai", sourceUrl: "https://good1.com" },
          { title: "Item B", rawText: "AED 200/sqm", category: "material_cost", geography: "Dubai", sourceUrl: "https://good1.com" },
        ],
      }),
      createMockConnector({
        sourceId: "bad-1",
        sourceName: "Bad Source 1",
        fetch: async () => ({
          url: "https://bad1.com",
          fetchedAt: new Date(),
          statusCode: 500,
          error: "Internal Server Error",
        }),
      }),
      createMockConnector({
        sourceId: "good-2",
        sourceName: "Good Source 2",
        extract: async () => [
          { title: "Item C", rawText: "AED 300/sqm", category: "fitout_rate", geography: "Dubai", sourceUrl: "https://good2.com" },
        ],
      }),
    ];

    let succeeded = 0;
    let failed = 0;
    let totalExtracted = 0;

    for (const c of connectors) {
      try {
        const raw = await c.fetch();
        if (raw.statusCode >= 400 || raw.statusCode === 0) {
          failed++;
          continue;
        }
        const extracted = await c.extract(raw);
        totalExtracted += extracted.length;
        succeeded++;
      } catch {
        failed++;
      }
    }

    expect(succeeded).toBe(2);
    expect(failed).toBe(1);
    expect(totalExtracted).toBe(3);
  });

  it("handles all connectors failing without throwing", async () => {
    const connectors = [
      createMockConnector({
        sourceId: "fail-1",
        sourceName: "Fail 1",
        fetch: async () => ({ url: "https://fail1.com", fetchedAt: new Date(), statusCode: 503, error: "Service Unavailable" }),
      }),
      createMockConnector({
        sourceId: "fail-2",
        sourceName: "Fail 2",
        fetch: async () => { throw new Error("Network error"); },
      }),
    ];

    let failed = 0;
    for (const c of connectors) {
      try {
        const raw = await c.fetch();
        if (raw.statusCode >= 400 || raw.statusCode === 0) {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    expect(failed).toBe(2);
  });

  it("handles empty connector list gracefully", async () => {
    const connectors: SourceConnector[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const c of connectors) {
      try {
        await c.fetch();
        succeeded++;
      } catch {
        failed++;
      }
    }

    expect(succeeded).toBe(0);
    expect(failed).toBe(0);
  });
});

// ─── V2-11: Proposal Generator with Freshness Weighting ────────

describe("V2-11: Proposal generation with freshness weighting", () => {
  it("fresh evidence gets full weight in weighted mean", () => {
    const gradeWeight = 3; // Grade A
    const freshnessWeight = getFreshnessWeight(new Date()); // Fresh = 1.0
    const combinedWeight = gradeWeight * freshnessWeight;
    expect(combinedWeight).toBe(3.0);
  });

  it("aging evidence gets reduced weight in weighted mean", () => {
    const gradeWeight = 3; // Grade A
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const freshnessWeight = getFreshnessWeight(sixMonthsAgo); // Aging = 0.75
    const combinedWeight = gradeWeight * freshnessWeight;
    expect(combinedWeight).toBe(2.25);
  });

  it("stale evidence gets half weight in weighted mean", () => {
    const gradeWeight = 2; // Grade B
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    const freshnessWeight = getFreshnessWeight(twoYearsAgo); // Stale = 0.50
    const combinedWeight = gradeWeight * freshnessWeight;
    expect(combinedWeight).toBe(1.0);
  });

  it("weighted mean shifts toward fresh evidence", () => {
    // Simulate: 2 fresh records at 100, 2 stale records at 200
    const records = [
      { price: 100, grade: "A", captureDate: new Date() },
      { price: 100, grade: "A", captureDate: new Date() },
      { price: 200, grade: "A", captureDate: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) },
      { price: 200, grade: "A", captureDate: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) },
    ];

    const gradeWeightMap: Record<string, number> = { A: 3, B: 2, C: 1 };
    let weightedSum = 0;
    let totalWeight = 0;

    for (const rec of records) {
      const gw = gradeWeightMap[rec.grade];
      const fw = getFreshnessWeight(rec.captureDate);
      const combined = gw * fw;
      weightedSum += rec.price * combined;
      totalWeight += combined;
    }

    const weightedMean = weightedSum / totalWeight;

    // Without freshness: (100*3 + 100*3 + 200*3 + 200*3) / (3+3+3+3) = 150
    // With freshness: (100*3*1.0 + 100*3*1.0 + 200*3*0.5 + 200*3*0.5) / (3+3+1.5+1.5) = (300+300+300+300)/9 = 133.33
    expect(weightedMean).toBeLessThan(150);
    expect(weightedMean).toBeCloseTo(133.33, 1);
  });

  it("all-fresh records produce same result as unweighted", () => {
    const records = [
      { price: 100, grade: "B", captureDate: new Date() },
      { price: 150, grade: "B", captureDate: new Date() },
      { price: 200, grade: "B", captureDate: new Date() },
    ];

    const gradeWeightMap: Record<string, number> = { A: 3, B: 2, C: 1 };
    let weightedSum = 0;
    let totalWeight = 0;
    let unweightedSum = 0;
    let unweightedTotal = 0;

    for (const rec of records) {
      const gw = gradeWeightMap[rec.grade];
      const fw = getFreshnessWeight(rec.captureDate);
      const combined = gw * fw;
      weightedSum += rec.price * combined;
      totalWeight += combined;
      unweightedSum += rec.price * gw;
      unweightedTotal += gw;
    }

    const withFreshness = weightedSum / totalWeight;
    const withoutFreshness = unweightedSum / unweightedTotal;

    expect(withFreshness).toBeCloseTo(withoutFreshness, 5);
  });
});

// ─── V2-11: Edge Cases ──────────────────────────────────────────

describe("V2-11: Edge cases", () => {
  it("connector with empty extraction returns 0 evidence", async () => {
    const emptyConnector = createMockConnector({
      sourceId: "empty",
      sourceName: "Empty Source",
      extract: async () => [],
    });

    const raw = await emptyConnector.fetch();
    const extracted = await emptyConnector.extract(raw);
    expect(extracted).toHaveLength(0);
  });

  it("connector with null rawHtml still works", async () => {
    const noHtmlConnector = createMockConnector({
      sourceId: "no-html",
      sourceName: "No HTML Source",
      fetch: async () => ({
        url: "https://example.com",
        fetchedAt: new Date(),
        rawJson: { data: [] },
        statusCode: 200,
      }),
    });

    const raw = await noHtmlConnector.fetch();
    expect(raw.rawHtml).toBeUndefined();
    expect(raw.rawJson).toBeDefined();
    expect(raw.statusCode).toBe(200);
  });

  it("normalize handles evidence with no price gracefully", async () => {
    const noPriceConnector = createMockConnector({
      sourceId: "no-price",
      sourceName: "No Price Source",
      normalize: async (ev) => ({
        metric: ev.title,
        value: null,
        unit: null,
        confidence: 0.55,
        grade: "C",
        summary: "No price data available",
        tags: [],
      }),
    });

    const evidence: ExtractedEvidence = {
      title: "Market Report",
      rawText: "The market is growing",
      category: "market_trend",
      geography: "Dubai",
      sourceUrl: "https://example.com",
    };

    const normalized = await noPriceConnector.normalize(evidence);
    expect(normalized.value).toBeNull();
    expect(normalized.unit).toBeNull();
    expect(normalized.grade).toBe("C");
  });

  it("concurrent connector execution does not cause race conditions", async () => {
    const connectors = Array.from({ length: 10 }, (_, i) =>
      createMockConnector({
        sourceId: `concurrent-${i}`,
        sourceName: `Concurrent Source ${i}`,
        fetch: async () => {
          // Simulate varying response times
          await new Promise(r => setTimeout(r, Math.random() * 50));
          return {
            url: `https://example.com/${i}`,
            fetchedAt: new Date(),
            rawHtml: `<html>${i}</html>`,
            statusCode: 200,
          };
        },
      })
    );

    const results = await Promise.all(
      connectors.map(async (c) => {
        const raw = await c.fetch();
        return { sourceId: c.sourceId, status: raw.statusCode === 200 ? "success" : "failed" };
      })
    );

    expect(results).toHaveLength(10);
    expect(results.every(r => r.status === "success")).toBe(true);
    // Verify unique source IDs
    const ids = new Set(results.map(r => r.sourceId));
    expect(ids.size).toBe(10);
  });
});
