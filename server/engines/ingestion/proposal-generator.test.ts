/**
 * Behavioral coverage for the REAL generateBenchmarkProposals (replacing the
 * former v15 test that re-implemented a drifted copy of the algorithm).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({
  listEvidenceRecords: vi.fn(),
  createBenchmarkProposal: vi.fn(),
  createIntelligenceAuditEntry: vi.fn(),
}));

import * as db from "../../db";
import {
  BENCHMARK_KEY_POLICY_VERSION,
  generateBenchmarkProposals,
} from "./proposal-generator";

type EvidenceFixture = {
  category: string;
  finishLevel: string | null;
  unit: string;
  priceTypical: string | null;
  reliabilityGrade: "A" | "B" | "C";
  captureDate: Date;
  sourceRegistryId: number | null;
  sourceUrl: string;
};

function record(overrides: Partial<EvidenceFixture> = {}): EvidenceFixture {
  return {
    category: "floors",
    finishLevel: "premium",
    unit: "sqm",
    priceTypical: "200.00",
    reliabilityGrade: "B",
    captureDate: new Date(), // fresh → freshness weight 1.0
    sourceRegistryId: null,
    sourceUrl: "https://source-a.example/",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(db.listEvidenceRecords).mockReset();
  vi.mocked(db.createBenchmarkProposal).mockReset().mockResolvedValue({ id: 1 });
  vi.mocked(db.createIntelligenceAuditEntry).mockReset().mockResolvedValue(undefined as never);
});

describe("generateBenchmarkProposals (real function)", () => {
  it("groups by category:finishLevel:unit and stamps benchmark-key-v2", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(
      Array.from({ length: 5 }, (_, index) =>
        record({ priceTypical: `${100 + index * 10}.00`, sourceUrl: `https://s${index}.example/` }),
      ) as never,
    );

    const result = await generateBenchmarkProposals();

    expect(result.proposalsCreated).toBe(1);
    const call = vi.mocked(db.createBenchmarkProposal).mock.calls[0][0];
    expect(call.benchmarkKey).toBe("floors:premium:sqm");
    expect(call.keyPolicyVersion).toBe(BENCHMARK_KEY_POLICY_VERSION);
    expect(call.evidenceCount).toBe(5);
  });

  it("defaults a missing finishLevel to standard in the key", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(
      Array.from({ length: 5 }, (_, index) =>
        record({ finishLevel: null, sourceUrl: `https://s${index}.example/` }),
      ) as never,
    );

    await generateBenchmarkProposals();

    expect(vi.mocked(db.createBenchmarkProposal).mock.calls[0][0].benchmarkKey).toBe(
      "floors:standard:sqm",
    );
  });

  it("no longer persists groups below the aligned minimum of five", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(
      Array.from({ length: 4 }, (_, index) =>
        record({ sourceUrl: `https://s${index}.example/` }),
      ) as never,
    );

    const result = await generateBenchmarkProposals();

    expect(result.proposalsCreated).toBe(0);
    expect(db.createBenchmarkProposal).not.toHaveBeenCalled();
  });

  it("computes index-based percentiles over sorted prices", async () => {
    const prices = ["100.00", "200.00", "300.00", "400.00", "500.00"];
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(
      prices.map((price, index) =>
        record({ priceTypical: price, sourceUrl: `https://s${index}.example/` }),
      ) as never,
    );

    await generateBenchmarkProposals();

    const call = vi.mocked(db.createBenchmarkProposal).mock.calls[0][0];
    expect(call.proposedP25).toBe("200.00");
    expect(call.proposedP50).toBe("300.00");
    expect(call.proposedP75).toBe("400.00");
  });

  it("weights the mean by grade (A=3, B=2, C=1) with fresh capture dates", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue([
      record({ priceTypical: "100.00", reliabilityGrade: "A", sourceUrl: "https://a.example/" }),
      record({ priceTypical: "100.00", reliabilityGrade: "A", sourceUrl: "https://b.example/" }),
      record({ priceTypical: "100.00", reliabilityGrade: "A", sourceUrl: "https://c.example/" }),
      record({ priceTypical: "100.00", reliabilityGrade: "A", sourceUrl: "https://d.example/" }),
      record({ priceTypical: "400.00", reliabilityGrade: "C", sourceUrl: "https://e.example/" }),
    ] as never);

    await generateBenchmarkProposals();

    // (4×3×100 + 1×1×400) / (12 + 1) = 1600/13 = 123.08
    const call = vi.mocked(db.createBenchmarkProposal).mock.calls[0][0];
    expect(call.weightedMean).toBe("123.08");
  });

  it("counts source diversity by sourceRegistryId with sourceUrl fallback", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue([
      record({ sourceRegistryId: 1 }),
      record({ sourceRegistryId: 1 }),
      record({ sourceRegistryId: 2 }),
      record({ sourceRegistryId: null, sourceUrl: "https://fallback-a.example/" }),
      record({ sourceRegistryId: null, sourceUrl: "https://fallback-b.example/" }),
    ] as never);

    await generateBenchmarkProposals();

    expect(vi.mocked(db.createBenchmarkProposal).mock.calls[0][0].sourceDiversity).toBe(4);
  });

  it("recommends reject when diversity is below two", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(
      Array.from({ length: 5 }, () => record({ sourceUrl: "https://only.example/" })) as never,
    );

    const result = await generateBenchmarkProposals();

    expect(result.proposals[0].recommendation).toBe("reject");
    const call = vi.mocked(db.createBenchmarkProposal).mock.calls[0][0];
    expect(call.recommendation).toBe("reject");
    expect(call.rejectionReason).toContain("source diversity");
  });
});
