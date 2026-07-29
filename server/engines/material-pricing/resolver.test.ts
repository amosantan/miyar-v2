import { describe, expect, it } from "vitest";

import type { GovernedValueCandidate } from "../../db/material-pricing";
import { resolveGovernedMaterialValueFromCandidates } from "./resolver";

const NOW = new Date("2026-07-28T00:00:00Z");

function candidate(
  overrides: Partial<GovernedValueCandidate> = {}
): GovernedValueCandidate {
  return {
    id: 1,
    specId: 9,
    productId: null,
    orgId: null,
    priceScope: "supply_only",
    sourceKind: "observed",
    sourceLadderRung: "market_observation",
    benchmarkVersionId: 3,
    benchmarkVersion: "test-benchmark-v1",
    effectiveAt: new Date("2026-07-01T00:00:00Z"),
    supplierQuoteId: null,
    supersedesId: null,
    p25: "90.00",
    p50: "100.00",
    p75: "110.00",
    weightedMean: "101.00",
    sourceLabel: "test",
    provenancePolicyVersion: "test-v1",
    unitBasis: "per_sqm",
    geography: "uae",
    quoteValidUntil: null,
    quoteReceivedAt: null,
    quoteOrgId: null,
    quoteSupersededAt: null,
    ...overrides,
  };
}

const input = {
  specId: 9,
  priceScope: "supply_only" as const,
  asOf: NOW,
};

describe("EV-02 governed value resolver", () => {
  it("ranks authoritative rungs and uses product specificity within a rung", () => {
    const result = resolveGovernedMaterialValueFromCandidates(
      { ...input, productId: 20 },
      [
        candidate({ id: 1, sourceLadderRung: "assumption" }),
        candidate({ id: 2, sourceLadderRung: "official_statistic" }),
        candidate({
          id: 3,
          sourceLadderRung: "official_statistic",
          productId: 20,
        }),
      ]
    );
    expect(result).toMatchObject({
      status: "resolved",
      value: { benchmarkProposalId: 3 },
    });
  });

  it("fails closed for equally ranked active values", () => {
    expect(
      resolveGovernedMaterialValueFromCandidates(input, [
        candidate({ id: 1 }),
        candidate({ id: 2 }),
      ])
    ).toMatchObject({
      status: "insufficient",
      reason: "ambiguous_governed_value",
    });
  });

  it("keeps retail values diagnostic and never authoritative", () => {
    const retail = candidate({ sourceLadderRung: "retail_sanity" });
    expect(resolveGovernedMaterialValueFromCandidates(input, [retail])).toEqual(
      {
        status: "insufficient",
        reason: "only_retail_sanity",
        retailSanityBand: { p25: "90.00", p50: "100.00", p75: "110.00" },
      }
    );
  });

  it("separates explicit price scopes and gates legacy unknown scope", () => {
    const legacy = candidate({
      sourceKind: "assumption",
      sourceLadderRung: "assumption",
      priceScope: null,
    });
    expect(
      resolveGovernedMaterialValueFromCandidates(input, [legacy])
    ).toMatchObject({ status: "insufficient", reason: "legacy_scope_unknown" });
    expect(
      resolveGovernedMaterialValueFromCandidates(
        { ...input, allowLegacyUnknownScope: true },
        [legacy]
      )
    ).toMatchObject({
      status: "resolved",
      value: { priceScope: "legacy_unknown", isLegacyScopeFallback: true },
    });
    expect(
      resolveGovernedMaterialValueFromCandidates(
        { ...input, priceScope: "supply_and_install" },
        [candidate()]
      )
    ).toMatchObject({ status: "insufficient" });
  });

  it("requires same-organization, live, non-superseded quotes at the explicit clock", () => {
    const quote = candidate({
      sourceLadderRung: "supplier_quote",
      orgId: 7,
      supplierQuoteId: 70,
      quoteValidUntil: new Date("2026-07-29T00:00:00Z"),
      quoteReceivedAt: new Date("2026-07-20T00:00:00Z"),
      quoteOrgId: 7,
    });
    expect(
      resolveGovernedMaterialValueFromCandidates(
        { ...input, organizationId: 7 },
        [quote]
      )
    ).toMatchObject({ status: "resolved" });
    expect(
      resolveGovernedMaterialValueFromCandidates(
        { ...input, organizationId: 8 },
        [quote]
      )
    ).toMatchObject({ status: "insufficient" });
    expect(
      resolveGovernedMaterialValueFromCandidates(
        { ...input, organizationId: 7, asOf: new Date("2026-07-30T00:00:00Z") },
        [quote]
      )
    ).toMatchObject({ status: "insufficient" });
    expect(
      resolveGovernedMaterialValueFromCandidates(
        { ...input, organizationId: 7 },
        [
          candidate({
            ...quote,
            quoteSupersededAt: new Date("2026-07-25T00:00:00Z"),
          }),
        ]
      )
    ).toMatchObject({ status: "insufficient" });
  });

  it("replays proposal, quote receipt, and supersession at the explicit clock", () => {
    const futureProposal = candidate({
      effectiveAt: new Date("2026-07-29T00:00:00Z"),
    });
    expect(
      resolveGovernedMaterialValueFromCandidates(input, [futureProposal])
    ).toMatchObject({ status: "insufficient" });

    const futureQuote = candidate({
      sourceLadderRung: "supplier_quote",
      orgId: 7,
      quoteOrgId: 7,
      supplierQuoteId: 70,
      quoteReceivedAt: new Date("2026-07-29T00:00:00Z"),
      quoteValidUntil: new Date("2026-08-29T00:00:00Z"),
    });
    expect(
      resolveGovernedMaterialValueFromCandidates(
        { ...input, organizationId: 7 },
        [futureQuote]
      )
    ).toMatchObject({ status: "insufficient" });

    const predecessor = candidate({ id: 1 });
    const successor = candidate({
      id: 2,
      supersedesId: 1,
      effectiveAt: new Date("2026-07-29T00:00:00Z"),
    });
    expect(
      resolveGovernedMaterialValueFromCandidates(input, [
        predecessor,
        successor,
      ])
    ).toMatchObject({
      status: "resolved",
      value: { benchmarkProposalId: 1 },
    });
  });

  it("removes superseded governed rows before ranking", () => {
    expect(
      resolveGovernedMaterialValueFromCandidates(input, [
        candidate({ id: 1 }),
        candidate({ id: 2, supersedesId: 1 }),
      ])
    ).toMatchObject({
      status: "resolved",
      value: { benchmarkProposalId: 2 },
    });
  });

  it.each([
    { p25: "0.00", p50: "100.00", p75: "110.00" },
    { p25: "-1.00", p50: "100.00", p75: "110.00" },
    { p25: "120.00", p50: "100.00", p75: "110.00" },
    { p25: "90.00", p50: "120.00", p75: "110.00" },
    { weightedMean: "NaN" },
  ])("rejects invalid authoritative price bands: %o", invalidBand => {
    expect(
      resolveGovernedMaterialValueFromCandidates(input, [
        candidate(invalidBand),
      ])
    ).toMatchObject({
      status: "insufficient",
      reason: "no_governed_value",
    });
  });
});
