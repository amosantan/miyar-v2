/**
 * First behavioral coverage for runIngestion's persist path (ADR-0009):
 * finishLevel is deterministic from price+unit with the model's suggestion
 * demoted to metadata, and per-item categories flow while connector-level
 * buckets map to "other" instead of pooling into floors.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({
  createIntelligenceAuditEntry: vi.fn(async () => undefined),
  insertConnectorHealth: vi.fn(async () => undefined),
  insertPublicTrendSnapshot: vi.fn(async () => undefined),
  getDb: vi.fn(async () => null),
  getEvidenceRecordById: vi.fn(async () => null),
  recordRejectedConfidenceAssessment: vi.fn(async () => undefined),
  upsertPublicEvidenceObservation: vi.fn(async () => ({
    id: 1,
    assessmentId: 1,
    created: true,
    previousConfidenceScore: null,
    previousPriceTypical: null,
  })),
}));
vi.mock("./proposal-generator", () => ({
  generateBenchmarkProposals: vi.fn(async () => ({
    proposalsCreated: 0,
    groupsAnalyzed: 0,
    totalEvidence: 0,
    proposals: [],
  })),
}));
vi.mock("../autonomous/alert-engine", () => ({
  triggerAlertEngine: vi.fn(async () => undefined),
}));
vi.mock("./change-detector", () => ({
  detectPriceChange: vi.fn(async () => undefined),
}));
vi.mock("./evidence-to-materials", () => ({
  syncEvidenceToMaterials: vi.fn(async () => ({ created: 0, updated: 0, skipped: 0 })),
}));
vi.mock("../../_core/database-safety", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../_core/database-safety")>();
  return { ...actual, assertDatabaseAccess: vi.fn(() => undefined) };
});

import { upsertPublicEvidenceObservation } from "../../db";
import { runIngestion } from "./orchestrator";
import type { SourceConnector } from "./connector";

const FETCHED_AT = new Date("2026-07-20T06:00:00.000Z");

interface StubItem {
  title: string;
  category: string;
  value: number | null;
  valueMax?: number | null;
  unit?: string | null;
  modelFinish?: string | null;
}

function stubConnector(items: StubItem[]): SourceConnector {
  return {
    sourceId: "test-static-source",
    sourceName: "Test Static Source",
    sourceUrl: "https://test-source.example/",
    async fetch() {
      return {
        url: "https://test-source.example/",
        fetchedAt: FETCHED_AT,
        rawHtml: "<html>stub</html>",
        statusCode: 200,
      };
    },
    async extract() {
      return items.map((item) => ({
        title: item.title,
        rawText: `${item.title} raw text`,
        observedAt: FETCHED_AT,
        category: item.category,
        geography: "Dubai",
        sourceUrl: "https://test-source.example/items",
        _stub: item,
      })) as never;
    },
    async normalize(evidence) {
      const stub = (evidence as { _stub: StubItem })._stub;
      return {
        metric: evidence.title,
        value: stub.value,
        valueMax: stub.valueMax ?? null,
        unit: stub.unit ?? "sqm",
        confidence: 0.7,
        grade: "B",
        summary: `${evidence.title} summary`,
        tags: ["test"],
        finishLevel: stub.modelFinish ?? null,
      } as never;
    },
  };
}

function upsertCalls() {
  return vi.mocked(upsertPublicEvidenceObservation).mock.calls.map(call => call[0]);
}

beforeEach(() => {
  vi.mocked(upsertPublicEvidenceObservation).mockClear();
});

describe("runIngestion persist policy (ADR-0009)", () => {
  it("assigns finishLevel deterministically and demotes the model suggestion to metadata", async () => {
    await runIngestion(
      [stubConnector([
        { title: "Luxury Slab", category: "floors", value: 500, unit: "sqm", modelFinish: "basic" },
      ])],
      "manual",
    );

    const [persisted] = upsertCalls();
    expect(persisted.finishLevel).toBe("luxury");
    expect(persisted.modelSuggestedFinishLevel).toBe("basic");
  });

  it("leaves finishLevel null for unpriced evidence", async () => {
    await runIngestion(
      [stubConnector([
        { title: "Brochure Finish Note", category: "floors", value: null, unit: null, modelFinish: "ultra_luxury" },
      ])],
      "manual",
    );

    const [persisted] = upsertCalls();
    expect(persisted.finishLevel).toBeNull();
    expect(persisted.modelSuggestedFinishLevel).toBe("ultra_luxury");
  });

  it("normalizes per-square-foot prices before classifying finish", async () => {
    await runIngestion(
      [stubConnector([
        // 50 AED/sqft ≈ 538 AED/sqm → luxury; the raw 50 would misread as mid.
        { title: "Sqft Priced Stone", category: "floors", value: 50, unit: "sqft" },
      ])],
      "manual",
    );

    const [persisted] = upsertCalls();
    expect(persisted.finishLevel).toBe("luxury");
  });

  it("keeps valid per-item categories and maps connector buckets to other", async () => {
    await runIngestion(
      [stubConnector([
        { title: "Basin Mixer", category: "sanitary", value: 700, unit: "unit" },
        { title: "Uncategorized Material", category: "material_cost", value: 100, unit: "sqm" },
        { title: "Listing", category: "property_price", value: 1500, unit: "sqft" },
      ])],
      "manual",
    );

    const categories = upsertCalls().map(persisted => persisted.category);
    expect(categories).toEqual(["sanitary", "other", "other"]);
  });
});
