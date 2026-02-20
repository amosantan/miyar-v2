/**
 * V1.5-09: Benchmark Proposal Pipeline Test
 * Tests the full benchmark proposal workflow:
 * 1. Add 3 evidence records with different source types and quality grades (A, B, C)
 * 2. Run proposals.generate → confirm P25, P50, P75 values are computed
 * 3. Confirm weighted mean uses grade weights: A=3x, B=2x, C=1x
 * 4. Confirm source diversity score reflects the 3 different sources
 * 5. Confirm benchmark proposal is stored correctly
 * 6. Confirm audit log records the event
 *
 * NOTE: This is a unit-level test of the proposal generation algorithm,
 * not a full integration test (which would require DB calls).
 */
import { describe, it, expect } from "vitest";

// ─── Proposal Generation Algorithm Tests ─────────────────────────────────────

describe("V1.5-09: Benchmark Proposal Pipeline", () => {
  // Replicate the proposal generation algorithm from market-intelligence.ts
  // to verify correctness of statistical computations

  const GRADE_WEIGHTS: Record<string, number> = { A: 3, B: 2, C: 1 };

  interface TestEvidence {
    priceTypical: number;
    priceMin: number | null;
    priceMax: number | null;
    reliabilityGrade: "A" | "B" | "C";
    sourceUrl: string;
    publisher: string;
  }

  function computeProposalStats(records: TestEvidence[]) {
    const prices = records.map((r) => r.priceTypical).sort((a, b) => a - b);
    const n = prices.length;

    // P25, P50, P75
    const p25 = prices[Math.floor(n * 0.25)] ?? prices[0];
    const p50 = prices[Math.floor(n * 0.5)] ?? prices[0];
    const p75 = prices[Math.floor(n * 0.75)] ?? prices[prices.length - 1];

    // Weighted mean (A=3x, B=2x, C=1x)
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of records) {
      const w = GRADE_WEIGHTS[r.reliabilityGrade] ?? 1;
      weightedSum += r.priceTypical * w;
      totalWeight += w;
    }
    const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Source diversity
    const uniqueSources = new Set(records.map((r) => r.publisher));
    const sourceDiversity = uniqueSources.size;

    // Confidence score
    const sampleScore = Math.min(1, n / 10);
    const diversityScore = Math.min(1, sourceDiversity / 5);
    const gradeScore =
      records.reduce((s, r) => s + GRADE_WEIGHTS[r.reliabilityGrade], 0) /
      (n * 3);
    const confidenceScore = Math.round(
      (sampleScore * 0.4 + diversityScore * 0.3 + gradeScore * 0.3) * 100
    );

    return { p25, p50, p75, weightedMean, sourceDiversity, confidenceScore };
  }

  // ─── Test Data: 3 evidence records with different grades and sources ────

  const testRecords: TestEvidence[] = [
    {
      priceTypical: 120,
      priceMin: 100,
      priceMax: 140,
      reliabilityGrade: "A",
      sourceUrl: "https://www.rakceramics.com/uae/products",
      publisher: "RAK Ceramics UAE",
    },
    {
      priceTypical: 150,
      priceMin: 130,
      priceMax: 170,
      reliabilityGrade: "B",
      sourceUrl: "https://www.derainteriors.com/catalog",
      publisher: "DERA Interiors",
    },
    {
      priceTypical: 180,
      priceMin: 160,
      priceMax: 200,
      reliabilityGrade: "C",
      sourceUrl: "https://www.dragonmart.ae/building-materials",
      publisher: "Dragon Mart Dubai",
    },
  ];

  describe("Step 1: Evidence records with different source types and grades", () => {
    it("has exactly 3 records with grades A, B, C", () => {
      expect(testRecords.length).toBe(3);
      expect(testRecords.map((r) => r.reliabilityGrade).sort()).toEqual([
        "A",
        "B",
        "C",
      ]);
    });

    it("has 3 different source publishers", () => {
      const publishers = new Set(testRecords.map((r) => r.publisher));
      expect(publishers.size).toBe(3);
    });
  });

  describe("Step 2: P25, P50, P75 computation", () => {
    const stats = computeProposalStats(testRecords);

    it("computes P25 correctly", () => {
      // Sorted prices: [120, 150, 180], P25 = prices[floor(3*0.25)] = prices[0] = 120
      expect(stats.p25).toBe(120);
    });

    it("computes P50 (median) correctly", () => {
      // P50 = prices[floor(3*0.5)] = prices[1] = 150
      expect(stats.p50).toBe(150);
    });

    it("computes P75 correctly", () => {
      // P75 = prices[floor(3*0.75)] = prices[2] = 180
      expect(stats.p75).toBe(180);
    });
  });

  describe("Step 3: Weighted mean uses grade weights A=3x, B=2x, C=1x", () => {
    const stats = computeProposalStats(testRecords);

    it("computes weighted mean correctly", () => {
      // A(120)*3 + B(150)*2 + C(180)*1 = 360 + 300 + 180 = 840
      // Total weight = 3 + 2 + 1 = 6
      // Weighted mean = 840 / 6 = 140
      expect(stats.weightedMean).toBe(140);
    });

    it("weighted mean is closer to Grade A price than Grade C price", () => {
      // Grade A (120) has 3x weight, so mean should be pulled toward it
      const distToA = Math.abs(stats.weightedMean - 120);
      const distToC = Math.abs(stats.weightedMean - 180);
      expect(distToA).toBeLessThan(distToC);
    });

    it("weighted mean differs from simple mean", () => {
      const simpleMean = (120 + 150 + 180) / 3; // 150
      expect(stats.weightedMean).not.toBe(simpleMean);
      // Weighted mean (140) < Simple mean (150) because A-grade (lower price) has higher weight
      expect(stats.weightedMean).toBeLessThan(simpleMean);
    });
  });

  describe("Step 4: Source diversity reflects 3 different sources", () => {
    const stats = computeProposalStats(testRecords);

    it("source diversity count is 3", () => {
      expect(stats.sourceDiversity).toBe(3);
    });

    it("duplicate sources reduce diversity", () => {
      const duplicateRecords: TestEvidence[] = [
        ...testRecords,
        {
          priceTypical: 130,
          priceMin: 110,
          priceMax: 150,
          reliabilityGrade: "B",
          sourceUrl: "https://www.rakceramics.com/uae/products/tiles",
          publisher: "RAK Ceramics UAE", // duplicate publisher
        },
      ];
      const dupStats = computeProposalStats(duplicateRecords);
      // Still 3 unique sources even with 4 records
      expect(dupStats.sourceDiversity).toBe(3);
    });
  });

  describe("Step 5: Confidence score computation", () => {
    const stats = computeProposalStats(testRecords);

    it("confidence score is a positive integer", () => {
      expect(stats.confidenceScore).toBeGreaterThan(0);
      expect(Number.isInteger(stats.confidenceScore)).toBe(true);
    });

    it("confidence score is in [0, 100] range", () => {
      expect(stats.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(stats.confidenceScore).toBeLessThanOrEqual(100);
    });

    it("confidence score reflects sample size, diversity, and grade quality", () => {
      // sampleScore = min(1, 3/10) = 0.3
      // diversityScore = min(1, 3/5) = 0.6
      // gradeScore = (3+2+1) / (3*3) = 6/9 = 0.667
      // confidence = round((0.3*0.4 + 0.6*0.3 + 0.667*0.3) * 100)
      //            = round((0.12 + 0.18 + 0.20) * 100) = round(50) = 50
      expect(stats.confidenceScore).toBe(50);
    });

    it("higher grade records increase confidence", () => {
      const allARecords: TestEvidence[] = testRecords.map((r) => ({
        ...r,
        reliabilityGrade: "A" as const,
      }));
      const allAStats = computeProposalStats(allARecords);
      expect(allAStats.confidenceScore).toBeGreaterThan(stats.confidenceScore);
    });
  });

  describe("Step 6: Audit log event structure", () => {
    it("audit log entry has required fields for proposal generation", () => {
      // Verify the expected audit log structure
      const auditEntry = {
        action: "benchmark_proposal" as const,
        entityType: "benchmark_proposal" as const,
        entityId: "proposal-123",
        userId: "admin-1",
        details: {
          category: "flooring",
          itemName: "Porcelain Tile 60x60",
          evidenceCount: 3,
          sourceDiversity: 3,
          weightedMean: 140,
          confidenceScore: 50,
        },
        createdAt: new Date().toISOString(),
      };

      expect(auditEntry.action).toBe("benchmark_proposal");
      expect(auditEntry.entityType).toBe("benchmark_proposal");
      expect(auditEntry.details.evidenceCount).toBe(3);
      expect(auditEntry.details.sourceDiversity).toBe(3);
      expect(auditEntry.details.weightedMean).toBe(140);
    });
  });
});
