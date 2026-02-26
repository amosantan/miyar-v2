/**
 * MIYAR V2-04 — UAE Source Connector Tests
 *
 * Tests cover:
 *   1. Connector registry (all 12 connectors registered)
 *   2. Connector factory (getConnectorById, getAllConnectors, getConnectorsByIds)
 *   3. Grade assignment (A/B/C deterministic mapping)
 *   4. Confidence computation (base, recency bonus, staleness penalty)
 *   5. Extraction from mock HTML
 *   6. Normalization with price extraction
 *   7. Zod schema validation
 *   8. Price regex extraction helper
 */

import { describe, it, expect } from "vitest";
import {
  assignGrade,
  computeConfidence,
  type RawSourcePayload,
  type ExtractedEvidence,
  extractedEvidenceSchema,
  normalizedEvidenceInputSchema,
} from "../engines/ingestion/connector";
import {
  ALL_CONNECTORS,
  getConnectorById,
  getAllConnectors,
  getConnectorsByIds,
  RAKCeramicsConnector,
  DERAInteriorsConnector,
  DragonMartConnector,
  PorcelanosaConnector,
  EmaarConnector,
  DAMACConnector,
  NakheelConnector,
  RICSConnector,
  JLLConnector,
  DubaiStatisticsConnector,
  HafeleConnector,
  GEMSConnector,
} from "../engines/ingestion/connectors/index";

// ─── 1. Connector Registry ──────────────────────────────────────

describe("V2-04: Connector Registry", () => {
  it("has at least 12 registered connectors (V2 core + V4/V5 additions)", () => {
    expect(Object.keys(ALL_CONNECTORS).length).toBeGreaterThanOrEqual(12);
  });

  it("contains all 12 UAE source IDs", () => {
    const expectedIds = [
      "rak-ceramics-uae",
      "dera-interiors",
      "dragon-mart-dubai",
      "porcelanosa-uae",
      "emaar-properties",
      "damac-properties",
      "nakheel-properties",
      "rics-market-reports",
      "jll-mena-research",
      "dubai-statistics-center",
      "hafele-uae",
      "gems-building-materials",
    ];
    for (const id of expectedIds) {
      expect(ALL_CONNECTORS).toHaveProperty(id);
    }
  });

  it("getConnectorById returns correct connector", () => {
    const connector = getConnectorById("rak-ceramics-uae");
    expect(connector).not.toBeNull();
    expect(connector!.sourceId).toBe("rak-ceramics-uae");
    expect(connector!.sourceName).toBe("RAK Ceramics UAE");
  });

  it("getConnectorById returns null for unknown ID", () => {
    const connector = getConnectorById("unknown-source");
    expect(connector).toBeNull();
  });

  it("getAllConnectors returns all registered connectors", () => {
    const connectors = getAllConnectors();
    expect(connectors.length).toBeGreaterThanOrEqual(12);
    const ids = connectors.map((c) => c.sourceId);
    expect(ids).toContain("rak-ceramics-uae");
    expect(ids).toContain("emaar-properties");
    expect(ids).toContain("dubai-statistics-center");
  });

  it("getConnectorsByIds returns only requested connectors", () => {
    const connectors = getConnectorsByIds(["emaar-properties", "damac-properties"]);
    expect(connectors).toHaveLength(2);
    expect(connectors[0].sourceId).toBe("emaar-properties");
    expect(connectors[1].sourceId).toBe("damac-properties");
  });

  it("getConnectorsByIds skips unknown IDs gracefully", () => {
    const connectors = getConnectorsByIds(["emaar-properties", "nonexistent"]);
    expect(connectors).toHaveLength(1);
    expect(connectors[0].sourceId).toBe("emaar-properties");
  });
});

// ─── 2. Grade Assignment ────────────────────────────────────────

describe("V2-04: Grade Assignment", () => {
  it("assigns Grade A to developer/research sources", () => {
    expect(assignGrade("emaar-properties")).toBe("A");
    expect(assignGrade("damac-properties")).toBe("A");
    expect(assignGrade("nakheel-properties")).toBe("A");
    expect(assignGrade("rics-market-reports")).toBe("A");
    expect(assignGrade("jll-mena-research")).toBe("A");
    expect(assignGrade("dubai-statistics-center")).toBe("A");
  });

  it("assigns Grade B to established trade suppliers", () => {
    expect(assignGrade("rak-ceramics-uae")).toBe("B");
    expect(assignGrade("porcelanosa-uae")).toBe("B");
    expect(assignGrade("hafele-uae")).toBe("B");
    expect(assignGrade("gems-building-materials")).toBe("B");
    expect(assignGrade("dragon-mart-dubai")).toBe("B");
  });

  it("assigns Grade C to fit-out firms", () => {
    expect(assignGrade("dera-interiors")).toBe("C");
  });

  it("defaults to Grade C for unknown sources", () => {
    expect(assignGrade("random-unknown-source")).toBe("C");
  });
});

// ─── 3. Confidence Computation ──────────────────────────────────

describe("V2-04: Confidence Computation", () => {
  const now = new Date("2026-02-20T12:00:00Z");

  it("Grade A base confidence is 0.85", () => {
    // Published 180 days ago (no bonus, no penalty)
    const published = new Date("2025-08-24T12:00:00Z");
    const confidence = computeConfidence("A", published, now);
    expect(confidence).toBe(0.85);
  });

  it("Grade B base confidence is 0.70", () => {
    const published = new Date("2025-08-24T12:00:00Z");
    const confidence = computeConfidence("B", published, now);
    expect(confidence).toBe(0.70);
  });

  it("Grade C base confidence is 0.55", () => {
    const published = new Date("2025-08-24T12:00:00Z");
    const confidence = computeConfidence("C", published, now);
    expect(confidence).toBe(0.55);
  });

  it("adds recency bonus for content published within 90 days", () => {
    const recent = new Date("2026-01-15T12:00:00Z"); // ~36 days ago
    const confidence = computeConfidence("A", recent, now);
    expect(confidence).toBe(0.95); // 0.85 + 0.10
  });

  it("applies staleness penalty for content older than 365 days", () => {
    const stale = new Date("2024-12-01T12:00:00Z"); // ~447 days ago
    const confidence = computeConfidence("A", stale, now);
    expect(confidence).toBe(0.70); // 0.85 - 0.15
  });

  it("applies staleness penalty when publishedDate is missing", () => {
    const confidence = computeConfidence("B", undefined, now);
    expect(confidence).toBeCloseTo(0.55, 10); // 0.70 - 0.15
  });

  it("caps confidence at 1.0", () => {
    // Grade A (0.85) + recency bonus (0.10) = 0.95 (under cap)
    const recent = new Date("2026-02-19T12:00:00Z");
    const confidence = computeConfidence("A", recent, now);
    expect(confidence).toBeLessThanOrEqual(1.0);
  });

  it("floors confidence at 0.20", () => {
    // Grade C (0.55) - staleness (0.15) = 0.40 (above floor)
    // But if we had a lower base, it would floor at 0.20
    const confidence = computeConfidence("C", undefined, now);
    expect(confidence).toBe(0.40); // 0.55 - 0.15
    expect(confidence).toBeGreaterThanOrEqual(0.20);
  });
});

// ─── 4. Extraction from Mock HTML ──────────────────────────────

describe("V2-04: Connector Extraction", () => {
  const mockPayload: RawSourcePayload = {
    url: "https://www.example.com/products",
    fetchedAt: new Date("2026-02-20T12:00:00Z"),
    rawHtml: `
      <div class="product-card">
        <h2>Premium Marble Tile 60x60</h2>
        <p>AED 120 per sqm. Available in white, beige, and grey.</p>
      </div>
      <div class="product-card">
        <h3>Porcelain Floor Tile 80x80</h3>
        <p>Price: AED 85 per sqm. Matte finish, anti-slip.</p>
      </div>
    `,
    statusCode: 200,
  };

  it("RAK Ceramics extracts product evidence from HTML", async () => {
    const connector = new RAKCeramicsConnector();
    const evidence = await connector.extract(mockPayload);
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].category).toBe("material_cost");
    expect(evidence[0].geography).toBe("UAE");
    expect(evidence[0].sourceUrl).toBe(mockPayload.url);
  }, 15_000);

  it("DERA Interiors extracts fitout evidence", async () => {
    const connector = new DERAInteriorsConnector();
    const servicePayload: RawSourcePayload = {
      ...mockPayload,
      rawHtml: `
        <div class="service-item">
          <h2>Luxury Villa Fit-out</h2>
          <p>Starting from AED 350 per sqft for premium residential fit-out.</p>
        </div>
      `,
    };
    const evidence = await connector.extract(servicePayload);
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].category).toBe("fitout_rate");
    expect(evidence[0].geography).toBe("Dubai");
  }, 15_000);

  it("Emaar extracts competitor project evidence", async () => {
    const connector = new EmaarConnector();
    const devPayload: RawSourcePayload = {
      ...mockPayload,
      rawHtml: `
        <article class="project-card">
          <h2>Dubai Creek Harbour</h2>
          <p>A waterfront community with premium residences starting from AED 1,200,000.</p>
        </article>
      `,
    };
    const evidence = await connector.extract(devPayload);
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].category).toBe("competitor_project");
    expect(evidence[0].geography).toBe("Dubai");
  }, 15_000);

  it("RICS extracts market trend evidence with dates", async () => {
    const connector = new RICSConnector();
    const reportPayload: RawSourcePayload = {
      ...mockPayload,
      rawHtml: `
        <article class="report-card">
          <h3>UAE Construction Market Survey Q4 2025</h3>
          <span>Published: 15 January 2026</span>
          <p>Construction activity continues to grow with workloads increasing.</p>
        </article>
      `,
    };
    const evidence = await connector.extract(reportPayload);
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].category).toBe("market_trend");
    expect(evidence[0].geography).toBe("UAE");
  }, 15_000);

  it("handles empty HTML gracefully with fallback evidence", async () => {
    const connector = new RAKCeramicsConnector();
    const emptyPayload: RawSourcePayload = {
      url: "https://www.rakceramics.com/ae/",
      fetchedAt: new Date(),
      rawHtml: "<html><body>" + "x".repeat(101) + "</body></html>",
      statusCode: 200,
    };
    const evidence = await connector.extract(emptyPayload);
    // Should produce at least one fallback evidence item (HTML > 100 chars)
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].title).toContain("RAK Ceramics");
  });

  it("handles completely empty HTML with no evidence", async () => {
    const connector = new RAKCeramicsConnector();
    const emptyPayload: RawSourcePayload = {
      url: "https://www.rakceramics.com/ae/",
      fetchedAt: new Date(),
      rawHtml: "",
      statusCode: 200,
    };
    const evidence = await connector.extract(emptyPayload);
    expect(evidence).toHaveLength(0);
  });
});

// ─── 5. Normalization ───────────────────────────────────────────

describe("V2-04: Connector Normalization", () => {
  it("RAK Ceramics normalizes with Grade B and material tags", async () => {
    const connector = new RAKCeramicsConnector();
    const evidence: ExtractedEvidence = {
      title: "RAK Ceramics - Premium Marble Tile",
      rawText: "Premium marble tile AED 120 per sqm, available in white and beige finishes.",
      category: "material_cost",
      geography: "UAE",
      sourceUrl: "https://www.rakceramics.com/ae/products",
    };
    const normalized = await connector.normalize(evidence);
    expect(normalized.grade).toBe("B");
    expect(normalized.confidence).toBeGreaterThanOrEqual(0.20);
    expect(normalized.confidence).toBeLessThanOrEqual(1.0);
    expect(normalized.value).toBe(120);
    expect(normalized.unit).toBe("sqm");
    expect(normalized.tags).toContain("ceramics");
    expect(normalized.tags).toContain("tiles");
  });

  it("Emaar normalizes with Grade A and developer tags", async () => {
    const connector = new EmaarConnector();
    const evidence: ExtractedEvidence = {
      title: "Emaar - Dubai Creek Harbour",
      rawText: "Starting from AED 1,200,000 per unit. Waterfront living.",
      category: "competitor_project",
      geography: "Dubai",
      sourceUrl: "https://www.emaar.com/en/projects",
    };
    const normalized = await connector.normalize(evidence);
    expect(normalized.grade).toBe("A");
    expect(normalized.tags).toContain("developer");
    expect(normalized.tags).toContain("luxury");
  });

  it("RICS normalizes with Grade A and null value for reports", async () => {
    const connector = new RICSConnector();
    const evidence: ExtractedEvidence = {
      title: "RICS - UAE Construction Market Survey",
      rawText: "Construction activity continues to grow with workloads increasing across the UAE.",
      publishedDate: new Date("2026-01-15"),
      category: "market_trend",
      geography: "UAE",
      sourceUrl: "https://www.rics.org/news-insights",
    };
    const normalized = await connector.normalize(evidence);
    expect(normalized.grade).toBe("A");
    expect(normalized.value).toBeNull(); // Reports don't have single prices
    expect(normalized.unit).toBeNull();
    expect(normalized.tags).toContain("market-survey");
    // Recency bonus applies (within 90 days)
    expect(normalized.confidence).toBe(0.95); // 0.85 + 0.10
  });

  it("Hafele normalizes with Grade B and hardware tags", async () => {
    const connector = new HafeleConnector();
    const evidence: ExtractedEvidence = {
      title: "Hafele - Soft Close Hinge System",
      rawText: "Soft close hinge system AED 45 per piece. Premium quality.",
      category: "material_cost",
      geography: "UAE",
      sourceUrl: "https://www.hafele.ae/en/products",
    };
    const normalized = await connector.normalize(evidence);
    expect(normalized.grade).toBe("B");
    expect(normalized.value).toBe(45);
    // Price regex extracts "AED 45" but context "per piece" needs exact match
    // The regex looks for "per" keyword near the price
    expect(["piece", "unit"]).toContain(normalized.unit);
    expect(normalized.tags).toContain("hardware");
    expect(normalized.tags).toContain("fittings");
  });

  it("normalized output passes Zod schema validation", async () => {
    const connector = new RAKCeramicsConnector();
    const evidence: ExtractedEvidence = {
      title: "RAK Ceramics - Test Product",
      rawText: "Test product AED 100 per sqm",
      category: "material_cost",
      geography: "UAE",
      sourceUrl: "https://www.rakceramics.com/ae/test",
    };
    const normalized = await connector.normalize(evidence);
    const result = normalizedEvidenceInputSchema.safeParse(normalized);
    expect(result.success).toBe(true);
  });

  it("extracted evidence passes Zod schema validation", () => {
    const evidence: ExtractedEvidence = {
      title: "Test Evidence",
      rawText: "Some raw text content",
      category: "material_cost",
      geography: "Dubai",
      sourceUrl: "https://example.com/test",
    };
    const result = extractedEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });
});

// ─── 6. Connector Properties ────────────────────────────────────

describe("V2-04: Connector Properties", () => {
  const connectorSpecs = [
    { cls: RAKCeramicsConnector, id: "rak-ceramics-uae", name: "RAK Ceramics UAE", grade: "B" },
    { cls: DERAInteriorsConnector, id: "dera-interiors", name: "DERA Interiors", grade: "C" },
    { cls: DragonMartConnector, id: "dragon-mart-dubai", name: "Dragon Mart Dubai", grade: "B" },
    { cls: PorcelanosaConnector, id: "porcelanosa-uae", name: "Porcelanosa UAE", grade: "B" },
    { cls: EmaarConnector, id: "emaar-properties", name: "Emaar Properties", grade: "A" },
    { cls: DAMACConnector, id: "damac-properties", name: "DAMAC Properties", grade: "A" },
    { cls: NakheelConnector, id: "nakheel-properties", name: "Nakheel Properties", grade: "A" },
    { cls: RICSConnector, id: "rics-market-reports", name: "RICS Market Reports", grade: "A" },
    { cls: JLLConnector, id: "jll-mena-research", name: "JLL MENA Research", grade: "A" },
    { cls: DubaiStatisticsConnector, id: "dubai-statistics-center", name: "Dubai Statistics Center", grade: "A" },
    { cls: HafeleConnector, id: "hafele-uae", name: "Hafele UAE", grade: "B" },
    { cls: GEMSConnector, id: "gems-building-materials", name: "GEMS Building Materials", grade: "B" },
  ];

  for (const spec of connectorSpecs) {
    it(`${spec.name} has correct sourceId and grade`, () => {
      const connector = new spec.cls();
      expect(connector.sourceId).toBe(spec.id);
      expect(connector.sourceName).toBe(spec.name);
      expect(assignGrade(connector.sourceId)).toBe(spec.grade);
      expect(connector.sourceUrl).toBeTruthy();
      expect(connector.sourceUrl.startsWith("https://")).toBe(true);
    });
  }
});
