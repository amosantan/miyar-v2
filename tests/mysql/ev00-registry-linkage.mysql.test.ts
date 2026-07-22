/**
 * EV-00 (audit F4/F5) real-MySQL proof: a static connector's ingestion run
 * resolves its source_registry row by slug, links its evidence to that row,
 * and finally advances lastSuccessfulFetch/health metrics — the former
 * name-vs-sourceId join matched zero rows on both scheduled paths.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import { runIngestion } from "../../server/engines/ingestion/orchestrator";
import type { SourceConnector } from "../../server/engines/ingestion/connector";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(connectionString);

const SLUG = "ev00-linkage-static-source";
const SOURCE_URL = "https://ev00-linkage.example/";

const CLEAN_TABLES = [
  "evidence_confidence_assessments",
  "evidence_records",
  "ingestion_runs",
  "connector_health",
  "intelligence_audit_log",
  "benchmark_proposals",
  "trend_snapshots",
  "materials_catalog",
  "platform_alerts",
  "source_registry",
] as const;

async function clean() {
  await pool.query("set foreign_key_checks = 0");
  for (const table of CLEAN_TABLES) {
    await pool.query(`truncate table \`${table}\``);
  }
  await pool.query("set foreign_key_checks = 1");
}

function stubConnector(sourceId: string): SourceConnector {
  const fetchedAt = new Date();
  return {
    sourceId,
    sourceName: "EV-00 Linkage Stub",
    sourceUrl: SOURCE_URL,
    async fetch() {
      return { url: SOURCE_URL, fetchedAt, rawHtml: "<html>stub</html>", statusCode: 200 };
    },
    async extract() {
      return [{
        title: "Linkage Porcelain 60x60",
        rawText: "Linkage Porcelain 60x60 at AED 180/sqm",
        observedAt: fetchedAt,
        category: "floors",
        geography: "Dubai",
        sourceUrl: `${SOURCE_URL}items`,
      }] as never;
    },
    async normalize(evidence) {
      return {
        metric: evidence.title,
        value: 180,
        valueMax: 220,
        unit: "sqm",
        confidence: 0.7,
        grade: "B",
        summary: "Linkage stub summary",
        tags: ["ev00-linkage"],
      } as never;
    },
  };
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await pool.end();
});

describe("EV-00 source_registry linkage (real MySQL)", () => {
  it("resolves the registry row by slug, links evidence, and advances health metrics", async () => {
    const [inserted] = await pool.query<any>(
      `insert into source_registry
         (name, slug, url, sourceType, reliabilityDefault, isWhitelisted, region, isActive,
          scrapeMethod, lastScrapedStatus, lastRecordCount, consecutiveFailures, requestDelayMs)
       values ('EV-00 Linkage Stub', ?, ?, 'supplier_catalog', 'B', 1, 'UAE', 1,
               'html_llm', 'never', 0, 3, 0)`,
      [SLUG, SOURCE_URL],
    );
    const registryId = inserted.insertId as number;

    const report = await runIngestion([stubConnector(SLUG)], "manual");
    expect(report.evidenceCreated).toBe(1);

    const [evidenceRows] = await pool.query<any[]>(
      "select sourceRegistryId, finishLevel, modelSuggestedFinishLevel, category from evidence_records where sourceUrl = ?",
      [`${SOURCE_URL}items`],
    );
    expect(evidenceRows.length).toBe(1);
    expect(evidenceRows[0].sourceRegistryId).toBe(registryId);
    // Deterministic finish from price 220 AED/sqm — premium band.
    expect(evidenceRows[0].finishLevel).toBe("premium");
    expect(evidenceRows[0].modelSuggestedFinishLevel).toBeNull();
    expect(evidenceRows[0].category).toBe("floors");

    const [registryRows] = await pool.query<any[]>(
      "select lastSuccessfulFetch, lastScrapedStatus, consecutiveFailures from source_registry where id = ?",
      [registryId],
    );
    expect(registryRows[0].lastSuccessfulFetch).not.toBeNull();
    expect(registryRows[0].lastScrapedStatus).toBe("success");
    expect(registryRows[0].consecutiveFailures).toBe(0);
  });

  it("skips health updates for an unresolved connector without failing the run", async () => {
    const report = await runIngestion([stubConnector("ev00-unregistered-source")], "manual");
    expect(report.evidenceCreated).toBe(1);

    const [evidenceRows] = await pool.query<any[]>(
      "select sourceRegistryId from evidence_records where sourceUrl = ?",
      [`${SOURCE_URL}items`],
    );
    expect(evidenceRows.length).toBe(1);
    expect(evidenceRows[0].sourceRegistryId).toBeNull();

    const [registryRows] = await pool.query<any[]>("select count(*) as n from source_registry");
    expect(registryRows[0].n).toBe(0);
  });
});
