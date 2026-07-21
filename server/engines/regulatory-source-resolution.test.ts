import { describe, expect, it } from "vitest";
import { resolveRegulatoryReference, type RegulatoryTemporalRelation, type RegulatoryVersionState } from "./regulatory-source-resolution";

const oldFingerprint = "a".repeat(64);
const amendmentFingerprint = "b".repeat(64);
const version = (overrides: Partial<RegulatoryVersionState> = {}): RegulatoryVersionState => ({
  versionKey: "dbc-2021", contentFingerprint: oldFingerprint, effectiveFrom: "2021-01-01T00:00:00.000Z",
  status: "asserted", requiredAssertionsCurrent: true, latestCaptureResult: "unchanged", ...overrides,
});
const resolve = (overrides: Partial<Parameters<typeof resolveRegulatoryReference>[0]> = {}) => resolveRegulatoryReference({
  contentFingerprint: oldFingerprint, clauseLocator: "5.2.1", basisAt: "2025-01-01T00:00:00.000Z", mode: "current",
  versions: [version(), version({ versionKey: "amendment", contentFingerprint: amendmentFingerprint })], relations: [], ...overrides,
});

describe("regulatory temporal resolution", () => {
  it("applies partial amendments only to their clause scope", () => {
    const relation: RegulatoryTemporalRelation = { sourceVersionFingerprint: amendmentFingerprint, targetVersionFingerprint: oldFingerprint, relationType: "amends", clauseScope: ["5.2"], effectiveFrom: "2024-01-01T00:00:00.000Z" };
    expect(resolve({ relations: [relation] })).toMatchObject({ usable: false, reason: "amended" });
    expect(resolve({ clauseLocator: "6.1", relations: [relation] })).toMatchObject({ usable: true });
  });

  it("ignores a relation whose source version is future-effective or lacks current assertions", () => {
    const relation: RegulatoryTemporalRelation = { sourceVersionFingerprint: amendmentFingerprint, targetVersionFingerprint: oldFingerprint, relationType: "revokes", clauseScope: ["*"], effectiveFrom: "2024-01-01T00:00:00.000Z" };
    expect(resolve({ relations: [relation], versions: [version(), version({ contentFingerprint: amendmentFingerprint, effectiveFrom: "2027-01-01T00:00:00.000Z" })] })).toMatchObject({ usable: true });
    expect(resolve({ relations: [relation], versions: [version(), version({ contentFingerprint: amendmentFingerprint, requiredAssertionsCurrent: false })] })).toMatchObject({ usable: true });
  });

  it("supports bounded suspensions and future-effective relations", () => {
    const relation: RegulatoryTemporalRelation = { sourceVersionFingerprint: amendmentFingerprint, targetVersionFingerprint: oldFingerprint, relationType: "suspends", clauseScope: ["*"], effectiveFrom: "2025-06-01T00:00:00.000Z", effectiveTo: "2025-07-01T00:00:00.000Z" };
    expect(resolve({ basisAt: "2025-05-31T00:00:00.000Z", relations: [relation] })).toMatchObject({ usable: true });
    expect(resolve({ basisAt: "2025-06-15T00:00:00.000Z", relations: [relation] })).toMatchObject({ usable: false, reason: "suspended" });
    expect(resolve({ basisAt: "2025-07-01T00:00:00.000Z", relations: [relation] })).toMatchObject({ usable: true });
  });

  it("blocks an asserted clause-scoped revocation without treating unrelated clauses as revoked", () => {
    const relation: RegulatoryTemporalRelation = { sourceVersionFingerprint: amendmentFingerprint, targetVersionFingerprint: oldFingerprint, relationType: "revokes", clauseScope: ["5.2"], effectiveFrom: "2024-01-01T00:00:00.000Z" };
    expect(resolve({ relations: [relation] })).toMatchObject({ usable: false, reason: "revoked" });
    expect(resolve({ relations: [relation], clauseLocator: "8.1" })).toMatchObject({ usable: true });
  });

  it.each(["changed_candidate", "disappeared_candidate"] as const)("treats %s as stale review, never repeal", latestCaptureResult => {
    expect(resolve({ versions: [version({ latestCaptureResult })] })).toEqual({ usable: false, mode: "current", reason: "stale_source" });
  });

  it("allows exact archival replay but does not authorize current use", () => {
    const stale = version({ status: "archived", requiredAssertionsCurrent: false });
    expect(resolve({ versions: [stale] })).toMatchObject({ usable: false, reason: "not_asserted" });
    expect(resolve({ versions: [stale], mode: "historical_replay" })).toMatchObject({ usable: true, mode: "historical_replay" });
  });

  it("is independent of capture ordering and URL identity", () => {
    expect(resolve({ versions: [version({ versionKey: "same-url-new-bytes", contentFingerprint: "c".repeat(64) }), version()] })).toMatchObject({ usable: true, version: { contentFingerprint: oldFingerprint } });
  });
});
