import { describe, expect, it } from "vitest";

import { evaluateClaimHealth } from "./claim-health";
import {
  buildDldMarketClaimHealthEvaluationInput,
  buildRequiredSourceOperationsClaimHealthEvaluationInput,
} from "./market-claim-health";

const CLOCK = new Date("2026-07-30T12:00:00.000Z");
const NON_EMPTY = {
  count: 10,
  observedThrough: "2026-07-01T00:00:00.000Z",
  sourceEligibility: "eligible",
  incident: "none",
} as const;

describe("fixed v1 market/source-operation claim-health builders", () => {
  it("builds exactly the three fixed DLD cells as unconfigured/unknown", () => {
    const input = buildDldMarketClaimHealthEvaluationInput({
      evaluatedAt: CLOCK,
      transactions: NON_EMPTY,
      rents: NON_EMPTY,
      projects: NON_EMPTY,
    });
    expect(input.cells.map(cell => cell.catalogueId)).toEqual([
      "dld-indexed-transactions-v1",
      "dld-indexed-rents-v1",
      "dld-indexed-projects-v1",
    ]);
    expect(
      input.cells.every(
        cell =>
          cell.match === "exact" &&
          cell.authority === "official_observation" &&
          cell.eligibility === "eligible" &&
          cell.slaConfigured === false
      )
    ).toBe(true);
    expect(evaluateClaimHealth(input).safeProjection.claimState).toBe(
      "unknown"
    );
  });

  it("fails closed when a DLD indexed subset is empty", () => {
    const input = buildDldMarketClaimHealthEvaluationInput({
      evaluatedAt: CLOCK,
      transactions: {
        count: 0,
        observedThrough: null,
        sourceEligibility: "eligible",
        incident: "none",
      },
      rents: NON_EMPTY,
      projects: NON_EMPTY,
    });
    const projection = evaluateClaimHealth(input).safeProjection;
    expect(projection.claimState).toBe("insufficient");
    expect(projection.reasonCodes).toContain("missing_match");
  });

  it("keeps a non-empty unconfigured project dataset unknown until EV-05", () => {
    const input = buildDldMarketClaimHealthEvaluationInput({
      evaluatedAt: CLOCK,
      transactions: NON_EMPTY,
      rents: NON_EMPTY,
      projects: {
        count: 5,
        observedThrough: null,
        sourceEligibility: "eligible",
        incident: "none",
      },
    });
    const projection = evaluateClaimHealth(input).safeProjection;
    expect(projection.claimState).toBe("unknown");
    expect(projection.reasonCodes).toContain("unconfigured_sla");
  });

  it("does not invent source eligibility or an incident-free state", () => {
    const missingGovernance = buildDldMarketClaimHealthEvaluationInput({
      evaluatedAt: CLOCK,
      transactions: {
        count: 10,
        observedThrough: NON_EMPTY.observedThrough,
      },
      rents: NON_EMPTY,
      projects: NON_EMPTY,
    });
    const projection = evaluateClaimHealth(missingGovernance).safeProjection;
    expect(projection.claimState).toBe("insufficient");
    expect(projection.reasonCodes).toContain("ineligible_evidence");

    const blocked = buildDldMarketClaimHealthEvaluationInput({
      evaluatedAt: CLOCK,
      transactions: { ...NON_EMPTY, incident: "blocking" },
      rents: NON_EMPTY,
      projects: NON_EMPTY,
    });
    expect(evaluateClaimHealth(blocked).safeProjection.claimState).toBe(
      "incident"
    );
  });

  it("keeps the initially empty required-source list insufficient", () => {
    const input =
      buildRequiredSourceOperationsClaimHealthEvaluationInput(CLOCK);
    const projection = evaluateClaimHealth(input).safeProjection;
    expect(input.cells).toEqual([]);
    expect(projection.claimState).toBe("insufficient");
    expect(projection.reasonCodes).toContain("empty_required_set");
  });
});
