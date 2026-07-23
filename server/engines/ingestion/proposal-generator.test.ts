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
  // EV-01b. Absent on legacy records, which is the truthful state for them.
  priceClass?: string;
  priceBasis?: string;
  priceBasisPolicyVersion?: string | null;
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

/**
 * EV-01b — the population a global material benchmark may be computed from.
 *
 * Before this, the generator asked only for a category. Every static connector
 * left `intelligenceType` undefined and the orchestrator defaulted it to
 * `material_price`, so property listings, developer brochures and consultancy
 * research were pooled into material-price percentiles — along with any
 * organization-scoped or confidential evidence.
 */
describe("benchmark population filters", () => {
  function fiveRecords(overrides: Partial<EvidenceFixture> = {}) {
    return Array.from({ length: 5 }, (_, index) =>
      record({ sourceUrl: `https://s${index}.example/`, ...overrides }),
    ) as never;
  }

  it("asks the database only for public, non-confidential material prices", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(fiveRecords());

    await generateBenchmarkProposals();

    const filters = vi.mocked(db.listEvidenceRecords).mock.calls[0][0];
    expect(filters).toMatchObject({
      intelligenceType: "material_price",
      corpusScope: "platform_public",
      excludeConfidential: true,
    });
  });

  it("drops a record priced above the material sanity ceiling", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue([
      ...(fiveRecords() as unknown as EvidenceFixture[]),
      record({ priceTypical: "12000000.00", sourceUrl: "https://listing.example/" }),
    ] as never);

    await generateBenchmarkProposals();

    const call = vi.mocked(db.createBenchmarkProposal).mock.calls[0][0];
    expect(call.evidenceCount).toBe(5);
  });

  it("drops a record with no positive price rather than counting it", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue([
      ...(fiveRecords() as unknown as EvidenceFixture[]),
      record({ priceTypical: "0.00", sourceUrl: "https://zero.example/" }),
    ] as never);

    await generateBenchmarkProposals();

    expect(vi.mocked(db.createBenchmarkProposal).mock.calls[0][0].evidenceCount).toBe(5);
  });

  it("documents that the inherited ceiling does NOT catch a typical property listing", async () => {
    // AED 4.2m is a Dubai apartment, not a material unit price — but it sits
    // under the inherited 10M bound and therefore survives. Tightening that
    // bound is a decision threshold change and needs cost-consultant approval
    // (AGENTS.md human gates), so this records the real behaviour rather than
    // asserting a limit the code does not enforce.
    vi.mocked(db.listEvidenceRecords).mockResolvedValue([
      ...(fiveRecords() as unknown as EvidenceFixture[]),
      record({ priceTypical: "4200000.00", sourceUrl: "https://listing.example/" }),
    ] as never);

    await generateBenchmarkProposals();

    expect(vi.mocked(db.createBenchmarkProposal).mock.calls[0][0].evidenceCount).toBe(6);
  });

  it("rejects a group made only of consumer retail listings", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(
      Array.from({ length: 5 }, (_, index) =>
        record({ sourceUrl: `https://s${index}.example/`, priceClass: "retail_listed" }),
      ) as never,
    );

    const result = await generateBenchmarkProposals();

    expect(result.proposals[0].recommendation).toBe("reject");
    const call = vi.mocked(db.createBenchmarkProposal).mock.calls[0][0];
    expect(call.rejectionReason).toContain("Retail-only price class");
    expect(call.priceClassDist).toEqual({ retail_listed: 5 });
  });

  it("publishes once a second price class joins the retail evidence", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue([
      record({ sourceUrl: "https://s0.example/", priceClass: "retail_listed" }),
      record({ sourceUrl: "https://s1.example/", priceClass: "retail_listed" }),
      record({ sourceUrl: "https://s2.example/", priceClass: "retail_listed" }),
      record({ sourceUrl: "https://s3.example/", priceClass: "retail_listed" }),
      record({ sourceUrl: "https://s4.example/", priceClass: "trade_quoted" }),
    ] as never);

    const result = await generateBenchmarkProposals();

    expect(result.proposals[0].recommendation).toBe("publish");
    const call = vi.mocked(db.createBenchmarkProposal).mock.calls[0][0];
    expect(call.priceClassDist).toEqual({ retail_listed: 4, trade_quoted: 1 });
  });

  it("rejects a group whose basis a parser evaluated and could not resolve", async () => {
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(
      Array.from({ length: 5 }, (_, index) =>
        record({
          sourceUrl: `https://s${index}.example/`,
          priceClass: "trade_quoted",
          priceBasis: "unknown",
          priceBasisPolicyVersion: "price-basis-policy-v1",
        }),
      ) as never,
    );

    const result = await generateBenchmarkProposals();

    expect(result.proposals[0].recommendation).toBe("reject");
    expect(
      vi.mocked(db.createBenchmarkProposal).mock.calls[0][0].rejectionReason,
    ).toContain("basis unresolved");
  });

  it("does not apply the basis rule to legacy records no parser ever saw", async () => {
    // These predate the basis column; their basis signal is `unit`, which
    // already keys the benchmark. Rejecting them would halt every existing
    // proposal for a reason that does not apply to them.
    vi.mocked(db.listEvidenceRecords).mockResolvedValue(fiveRecords());

    const result = await generateBenchmarkProposals();

    expect(result.proposals[0].recommendation).toBe("publish");
  });
});
