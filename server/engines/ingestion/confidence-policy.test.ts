import { describe, expect, it, vi } from "vitest";
import {
  CONFIDENCE_CHAIN_POLICY_VERSION,
  CONNECTOR_CONFIDENCE_POLICY_VERSION,
  QUALITY_CONFIDENCE_POLICY_VERSION,
  buildQualityConfidenceStage,
  classifyPublicationDate,
  evaluateConnectorConfidence,
} from "./confidence-policy";
import {
  computeConfidence,
  publicationDateFields,
  resolveGradePolicy,
} from "./connector";
import { validateEvidence } from "./data-quality";
import { DynamicConnector } from "./connectors/dynamic";

describe("TR-09 deterministic confidence policy", () => {
  const evaluatedAt = new Date("2026-02-20T12:00:00.000Z");

  it.each([
    ["2025-11-22T12:00:00.000Z", 90, 0.95],
    ["2025-11-21T12:00:00.000Z", 91, 0.85],
    ["2025-02-20T12:00:00.000Z", 365, 0.85],
    ["2025-02-19T12:00:00.000Z", 366, 0.7],
  ])("preserves the %s boundary", (publishedAt, ageDays, expected) => {
    const result = evaluateConnectorConfidence({
      grade: "A",
      publicationDate: new Date(publishedAt),
      evaluatedAt,
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.chainPolicyVersion).toBe(CONFIDENCE_CHAIN_POLICY_VERSION);
    expect(result.initial.policyVersion).toBe(CONNECTOR_CONFIDENCE_POLICY_VERSION);
    expect(result.initial.ageDays).toBe(ageDays);
    expect(result.initial.score).toBe(expected);
  });

  it("retains the approved missing-date penalty and its explanation", () => {
    const result = evaluateConnectorConfidence({
      grade: "B",
      publicationDate: undefined,
      evaluatedAt,
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.publicationDate.status).toBe("missing");
    expect(result.initial).toMatchObject({
      baseScore: 0.7,
      ageDays: null,
      dateAdjustment: -0.15,
      score: 0.55,
    });
  });

  it("rejects invalid publication dates instead of treating them as missing", () => {
    const result = evaluateConnectorConfidence({
      grade: "A",
      publicationDate: "not-a-date",
      evaluatedAt,
    });

    expect(result).toMatchObject({
      accepted: false,
      rejectionCode: "invalid_publication_date",
      publicationDate: { raw: "not-a-date", status: "invalid" },
    });
  });

  it("rejects an invalid evaluation clock", () => {
    const result = evaluateConnectorConfidence({
      grade: "A",
      publicationDate: undefined,
      evaluatedAt: new Date(Number.NaN),
    });
    expect(result).toMatchObject({
      accepted: false,
      rejectionCode: "invalid_evaluation_clock",
    });
  });

  it("accepts a date-only publication on the evaluation UTC day", () => {
    const result = evaluateConnectorConfidence({
      grade: "A",
      publicationDate: "2026-02-20",
      evaluatedAt: new Date("2026-02-20T00:01:00.000Z"),
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.publicationDate.precision).toBe("date");
      expect(result.initial.ageDays).toBe(0);
      expect(result.initial.score).toBe(0.95);
    }
  });

  it.each([
    ["2026-02-21", "date"],
    ["2026-02-20T12:00:00.001Z", "datetime"],
  ])("rejects future %s publication values", (publicationDate, precision) => {
    const result = evaluateConnectorConfidence({
      grade: "A",
      publicationDate,
      evaluatedAt,
    });
    expect(result).toMatchObject({
      accepted: false,
      rejectionCode: "future_publication_date",
      publicationDate: { precision, status: "future" },
    });
  });

  it("does not read the wall clock", () => {
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("wall clock read");
    });
    expect(
      evaluateConnectorConfidence({
        grade: "C",
        publicationDate: undefined,
        evaluatedAt,
      })
    ).toMatchObject({ accepted: true, initial: { score: 0.4 } });
    now.mockRestore();
  });

  it("keeps the number-only compatibility helper on the same authority", () => {
    expect(
      computeConfidence("A", new Date("2025-11-22T12:00:00.000Z"), evaluatedAt)
    ).toBe(0.95);
    expect(() =>
      computeConfidence("A", new Date("2026-02-21T00:00:00.000Z"), evaluatedAt)
    ).toThrow(/future_publication_date/);
  });

  it("retains raw invalid extraction input for orchestration rejection", () => {
    const fields = publicationDateFields("31/31/2026", evaluatedAt);
    expect(fields).toMatchObject({
      publishedDate: undefined,
      publishedDateRaw: "31/31/2026",
      publicationDate: { status: "invalid" },
    });
  });

  it("distinguishes static and registry grade authority", () => {
    expect(resolveGradePolicy("rics-market-reports")).toMatchObject({
      grade: "A",
      policyVersion: "source-grade-v1",
      source: "static_source_registry",
    });
    expect(resolveGradePolicy("42", "B")).toMatchObject({
      grade: "B",
      policyVersion: "source-registry-grade-v1",
      source: "source_registry",
    });
  });

  it("uses the source-registry grade in dynamic connector normalization", async () => {
    const connector = new DynamicConnector({
      id: 42,
      name: "Registry source",
      url: "https://example.com/source",
      reliabilityDefault: "A",
    });
    const normalized = await connector.normalize(
      {
        title: "Registry evidence",
        rawText: "Observed evidence",
        category: "other",
        geography: "UAE",
        sourceUrl: "https://example.com/source",
      },
      { evaluatedAt }
    );

    expect(normalized).toMatchObject({
      grade: "A",
      confidence: 0.7,
      gradePolicy: {
        grade: "A",
        source: "source_registry",
        policyVersion: "source-registry-grade-v1",
      },
    });
  });

  it("records the deterministic quality multiplier and floor", () => {
    expect(
      buildQualityConfidenceStage({
        status: "outlier_flagged",
        flags: ["non_positive_value"],
        inputScore: 0.15,
        multiplier: 0.5,
        floor: 0.1,
      })
    ).toEqual({
      policyVersion: QUALITY_CONFIDENCE_POLICY_VERSION,
      status: "outlier_flagged",
      flags: ["non_positive_value"],
      inputScore: 0.15,
      multiplier: 0.5,
      floor: 0.1,
      score: 0.1,
    });
  });

  it("attaches the same auditable quality stage used for the adjusted score", () => {
    expect(
      validateEvidence({
        metric: "Ceramic tile cost",
        value: -1,
        unit: "sqm",
        category: "material_cost",
        confidence: 0.7,
      })
    ).toEqual({
      status: "outlier_flagged",
      flags: ["non_positive_value"],
      adjustedConfidence: 0.35,
      confidencePolicy: {
        policyVersion: QUALITY_CONFIDENCE_POLICY_VERSION,
        status: "outlier_flagged",
        flags: ["non_positive_value"],
        inputScore: 0.7,
        multiplier: 0.5,
        floor: 0.1,
        score: 0.35,
      },
    });
  });
});

describe("publication date parser", () => {
  const evaluatedAt = new Date("2026-02-20T12:00:00.000Z");

  it("strictly rejects impossible ISO calendar dates", () => {
    expect(classifyPublicationDate("2026-02-30", evaluatedAt)).toMatchObject({
      precision: "date",
      status: "invalid",
    });
  });

  it("strictly rejects impossible ISO datetime calendar dates", () => {
    expect(
      classifyPublicationDate("2026-02-30T00:00:00Z", evaluatedAt)
    ).toMatchObject({ precision: "datetime", status: "invalid" });
  });

  it("rejects timezone-ambiguous datetime strings", () => {
    expect(
      classifyPublicationDate("2026-02-20T10:00:00", evaluatedAt)
    ).toMatchObject({ precision: "unknown", status: "invalid" });
  });

  it("handles an invalid Date object without throwing", () => {
    expect(
      classifyPublicationDate(new Date(Number.NaN), evaluatedAt)
    ).toMatchObject({ raw: "Invalid Date", status: "invalid" });
  });
});
