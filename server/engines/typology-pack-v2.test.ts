import { describe, expect, it } from "vitest";
import { TYPOLOGY_PACK_V2_SECTIONS, validateTypologyPackV2Candidate } from "@shared/typology-pack-v2";
import { DUBAI_REGULATORY_SOURCE_CATALOGUE } from "@shared/regulatory-sources";
import {
  CHECKED_IN_TYPOLOGY_PACK_V2_RELEASES,
  TypologyPackV2ResolutionError,
  assertTypologyPackV2Release,
  fingerprintTypologyPackV2Content,
  fingerprintTypologyPackV2Release,
  projectPublicTypologyPackV2,
  resolveCheckedInTypologyPackV2,
  resolveProductionTypologyPackV2,
  validateTypologyPackV2TenantOverride,
} from "./typology-pack-v2";
import {
  DUBAI_MIXED_USE_TYPOLOGY_PACK_V2_CANDIDATE,
  DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES,
  DUBAI_TYPOLOGY_PACK_V2_CANDIDATES,
} from "./typology-packs/v2/dubai-candidates";

const now = new Date("2026-07-21T00:00:00.000Z");
const source = {
  sourceKey: "dm.dubai-building-code", sourceVersionFingerprint: "a".repeat(64), clauseLocator: "p. 1 / cl. 1",
  basis: "regulatory_minimum" as const, enforcement: "hard_constraint" as const, jurisdiction: "Dubai",
  applicability: { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality"], permitBasis: "permit_date" as const },
};
const text = (value: string) => ({ value, source });
const bool = (value: boolean) => ({ value, source });
const quantity = (value: string) => ({ value: { format: "decimal" as const, value }, source });
const assertions = ["document_identity", "authenticity", "temporal_status", "jurisdiction", "permitted_use"].map(assertionType => ({
  sourceKey: source.sourceKey, sourceVersionFingerprint: source.sourceVersionFingerprint,
  assertionType: assertionType as "document_identity" | "authenticity" | "temporal_status" | "jurisdiction" | "permitted_use",
  decision: "accepted" as const, assertedBy: `reviewer-${assertionType}`,
  validFrom: "2021-01-01T00:00:00.000Z",
}));
const sourceAuthorities = [{
  sourceKey: source.sourceKey,
  sourceVersionFingerprint: source.sourceVersionFingerprint,
  jurisdiction: "Dubai",
  authorityScope: "dubai_municipality",
  clauseLocators: [source.clauseLocator],
  permittedBases: ["regulatory_minimum" as const],
  assertions,
  liveVersions: [{ versionKey: "2021", contentFingerprint: source.sourceVersionFingerprint, effectiveFrom: "2021-01-01T00:00:00.000Z", status: "asserted" as const, requiredAssertionsCurrent: true, latestCaptureResult: "captured" as const }],
  liveRelations: [],
}];
const resolutionContext = { jurisdiction: "Dubai", authorityScopes: ["dubai_municipality"], permitBasis: "permit_date" as const, basisAt: "2026-07-21T00:00:00.000Z", projectConditions: [] };

const completeAtomic = () => validateTypologyPackV2Candidate({
  schemaVersion: "typology-pack/v2", engineVersion: "constraint-engine/v2", kind: "atomic",
  packId: "test-apartment", version: "1.0.0", family: "apartment", title: "Test apartment", authoredBy: "author-a",
  applicability: source.applicability, sections: [...TYPOLOGY_PACK_V2_SECTIONS],
  rooms: [
    { id: "living", name: text("Living"), required: bool(true), area: { min: quantity("10"), max: quantity("12"), unit: "sqm", basis: "room_net" } },
    { id: "kitchen", name: text("Kitchen"), required: bool(true) },
    { id: "bedroom", name: text("Bedroom"), required: bool(true) },
  ],
  adjacencies: [
    { id: "living-kitchen", rooms: ["kitchen", "living"], relationship: "must_adjoin", source },
    { id: "kitchen-bedroom", rooms: ["bedroom", "kitchen"], relationship: "must_adjoin", source },
    { id: "bedroom-living", rooms: ["bedroom", "living"], relationship: "must_adjoin", source },
  ],
  responsibilities: [{ id: "living-fitout", roomId: "living", category: "fitout", party: "tenant", source }],
  requirements: TYPOLOGY_PACK_V2_SECTIONS.map(section => ({ id: `${section}-requirement`, section, statement: text(`${section} requirement`) })),
  risks: [{ id: "permit-risk", statement: text("Confirm authority applicability before issue.") }], candidateNotes: ["private candidate note"],
  candidateSourceKeys: [source.sourceKey],
});

const envelopeFor = (pack: ReturnType<typeof completeAtomic>, options: Partial<{ status: "approved" | "withdrawn"; expiresAt: string; reviewerId: string; withdrawnAt: string }> = {}) => {
  const approvals = ["architecture_interiors", "cost", "compliance", "product"].map((discipline, index) => ({
    discipline: discipline as "architecture_interiors" | "cost" | "compliance" | "product",
    reviewerId: options.reviewerId ?? `reviewer-${index}`,
    signedAt: "2026-07-01T00:00:00.000Z",
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}), decision: "approved" as const,
  }));
  const unsigned = {
    schemaVersion: "typology-pack/v2" as const, packId: pack.packId, version: pack.version,
    contentFingerprint: fingerprintTypologyPackV2Content(pack), status: options.status ?? "approved" as const,
    platformReleaseOwner: "platform-release-owner", approvedAt: "2026-07-02T00:00:00.000Z", approvals,
    ...(options.withdrawnAt ? { withdrawnAt: options.withdrawnAt } : {}),
  };
  return { ...unsigned, releaseFingerprint: fingerprintTypologyPackV2Release(unsigned) };
};

describe("BR-06 typology-pack/v2", () => {
  it("keeps eight closed families and creates only unapproved Dubai candidates", async () => {
    expect(new Set(DUBAI_TYPOLOGY_PACK_V2_CANDIDATES.map(pack => pack.family))).toEqual(new Set([
      "apartment", "villa", "residential_building", "office", "hospitality", "food_beverage", "retail", "mixed_use",
    ]));
    expect(DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES.filter(pack => pack.family === "hospitality").map(pack => pack.variant).sort()).toEqual(["hotel", "serviced_apartment"]);
    expect(CHECKED_IN_TYPOLOGY_PACK_V2_RELEASES).toEqual([]);
    const registeredSources = new Set(DUBAI_REGULATORY_SOURCE_CATALOGUE.map(item => item.sourceKey));
    expect(DUBAI_TYPOLOGY_PACK_V2_CANDIDATES.every(pack => pack.candidateSourceKeys.every(key => registeredSources.has(key)))).toBe(true);
    expect(DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES.filter(pack => pack.candidateSourceKeys.some(key => key.startsWith("dcd."))).every(pack => pack.applicability.authorityScopes.includes("dubai_civil_defence"))).toBe(true);
    const candidate = DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES[0];
    await expect(resolveProductionTypologyPackV2({ packId: candidate.packId, version: candidate.version, contentFingerprint: fingerprintTypologyPackV2Content(candidate) }, resolutionContext)).rejects.toThrow(TypologyPackV2ResolutionError);
  });

  it("pins deterministic golden fingerprints for every Dubai candidate and material variant", () => {
    expect(Object.fromEntries(DUBAI_TYPOLOGY_PACK_V2_CANDIDATES.map(pack => [pack.packId, fingerprintTypologyPackV2Content(pack)]))).toEqual({
      "dubai-apartment": "d53a49963a5adf818046bae313da396c220a7e815fd6e5385543027893d933d0",
      "dubai-villa": "eab6db5a16f0d1167a7efee50cfd8b14a0b61c81ff51e96cc3f7c80032dc5fce",
      "dubai-residential-building": "8ca3dd9202b9e62f630996364252cac8c9f424c3de97d3f4e3bb1408eb9898f2",
      "dubai-office": "28cb5f8a619e9cdf9a8e81f7944b7f300a2fd6430ea4f3c7f50c29bf5bd8aa7d",
      "dubai-hotel": "65742c2d45b6cee2d228c8115f29f7a1a4b704533f455eb82901b0ecc730c726",
      "dubai-serviced-apartment": "648053be88f016b2067e5fa5eb831c7907458aefe0bdadf43e308b058ab219b7",
      "dubai-food-beverage": "0ffcb20428d1c6b1468a269d0b8917e328e564bf6e3b6070233d1043f7511625",
      "dubai-retail": "6356fb86595ea5e7a0a8c9ffdea25ce9f3635401cd21516f2f6451fa57352c29",
      "dubai-mixed-use": "7c47280d2bc6d47b607c07d520bbd031346bcdf7097123e55832ef78a66c23f3",
    });
  });

  it("uses deterministic decimal strings and accepts undirected adjacency cycles", () => {
    expect(completeAtomic().adjacencies).toHaveLength(3);
    const invalid = structuredClone(completeAtomic());
    invalid.rooms[0].area!.min.value = { format: "decimal", value: "10.0" };
    expect(() => validateTypologyPackV2Candidate(invalid)).toThrow();
    const reversed = structuredClone(completeAtomic());
    reversed.adjacencies[0].rooms = ["living", "kitchen"];
    expect(() => validateTypologyPackV2Candidate(reversed)).toThrow(/canonical lexical order/);
    const contradictory = structuredClone(completeAtomic());
    contradictory.adjacencies.push({ id: "reverse-conflict", rooms: ["kitchen", "living"], relationship: "must_separate", source });
    expect(() => validateTypologyPackV2Candidate(contradictory)).toThrow(/both adjoin and separate/);
    const assurance = structuredClone(completeAtomic());
    assurance.requirements[0].statement.value = "This pack ensures compliance.";
    expect(() => validateTypologyPackV2Candidate(assurance)).toThrow(/compliance assurance/);
  });

  it("requires exact content binding, four independent disciplines, current approvals, and no self-approval", () => {
    const pack = completeAtomic();
    const envelope = envelopeFor(pack);
    expect(() => assertTypologyPackV2Release({ pack, envelope, sourceAuthorities, context: resolutionContext, now })).not.toThrow();
    expect(() => assertTypologyPackV2Release({ pack: { ...pack, title: "Changed after approval" }, envelope, sourceAuthorities, context: resolutionContext, now })).toThrow(/exact pack version and content fingerprint/);
    const selfApprovalUnsigned = { ...envelope, approvals: envelope.approvals.map((approval, index) => index === 0 ? { ...approval, reviewerId: "author-a" } : approval) };
    const { releaseFingerprint: _ignored, ...selfApprovalForFingerprint } = selfApprovalUnsigned;
    const selfApproval = { ...selfApprovalUnsigned, releaseFingerprint: fingerprintTypologyPackV2Release(selfApprovalForFingerprint) };
    expect(() => assertTypologyPackV2Release({ pack, envelope: selfApproval, sourceAuthorities, context: resolutionContext, now })).toThrow(/cannot approve/);
    expect(() => assertTypologyPackV2Release({ pack, envelope: envelopeFor(pack, { expiresAt: "2026-07-20T00:00:00.000Z" }), sourceAuthorities, context: resolutionContext, now })).toThrow(/current/);
    expect(() => assertTypologyPackV2Release({ pack, envelope: envelopeFor(pack, { status: "withdrawn", withdrawnAt: "2026-07-20T00:00:00.000Z" }), sourceAuthorities, context: resolutionContext, now })).toThrow(/current/);
    const earlyUnsigned = { ...envelope, approvedAt: "2026-06-30T00:00:00.000Z" };
    const { releaseFingerprint: _earlyIgnored, ...earlyForFingerprint } = earlyUnsigned;
    expect(() => assertTypologyPackV2Release({ pack, envelope: { ...earlyUnsigned, releaseFingerprint: fingerprintTypologyPackV2Release(earlyForFingerprint) }, sourceAuthorities, context: resolutionContext, now })).toThrow(/follow every professional signature/);
  });

  it("rejects orphan, stale, unlicensed, wrong-jurisdiction, missing-locator and future source state", () => {
    const pack = completeAtomic(); const envelope = envelopeFor(pack);
    const assertWith = (overrides: Record<string, unknown>) => assertTypologyPackV2Release({ pack, envelope, sourceAuthorities: [{ ...sourceAuthorities[0], ...overrides }] as never, context: resolutionContext, now });
    expect(() => assertTypologyPackV2Release({ pack, envelope, sourceAuthorities: [], context: resolutionContext, now })).toThrow(/exact governed source version/);
    expect(() => assertWith({ assertions: assertions.slice(0, 4) })).toThrow(/five accepted/);
    expect(() => assertWith({ jurisdiction: "DIFC" })).toThrow(/jurisdiction/);
    expect(() => assertWith({ authorityScope: "difc" })).toThrow(/authority scope/);
    expect(() => assertWith({ clauseLocators: ["another-clause"] })).toThrow(/locator/);
    expect(() => assertWith({ liveVersions: [{ ...sourceAuthorities[0].liveVersions[0], effectiveFrom: "2027-01-01T00:00:00.000Z" }] })).toThrow(/not current/);
    expect(() => assertWith({ liveVersions: [{ ...sourceAuthorities[0].liveVersions[0], latestCaptureResult: "changed_candidate" }] })).toThrow(/stale_source/);
    expect(() => assertWith({ liveRelations: [{ sourceVersionFingerprint: "b".repeat(64), targetVersionFingerprint: source.sourceVersionFingerprint, relationType: "supersedes", clauseScope: [source.clauseLocator], effectiveFrom: "2022-01-01T00:00:00.000Z" }], liveVersions: [...sourceAuthorities[0].liveVersions, { versionKey: "amendment", contentFingerprint: "b".repeat(64), effectiveFrom: "2022-01-01T00:00:00.000Z", status: "asserted", requiredAssertionsCurrent: true, latestCaptureResult: "captured" }] })).toThrow(/superseded/);
    expect(() => assertTypologyPackV2Release({ pack, envelope, sourceAuthorities, context: { ...resolutionContext, permitBasis: "issue_date" }, now })).toThrow(/not applicable/);
    expect(() => assertTypologyPackV2Release({ pack, envelope, sourceAuthorities, context: { ...resolutionContext, authorityScopes: ["dubai_municipality", "dubai_civil_defence"] }, now })).not.toThrow();
  });

  it("validates every tenant override citation and requires discipline authority for non-client constraints", () => {
    const pack = completeAtomic(); const envelope = envelopeFor(pack);
    const registry = [{ pack, envelope }];
    const override = {
      organizationId: "org-1", pack: { packId: pack.packId, version: pack.version, contentFingerprint: fingerprintTypologyPackV2Content(pack) },
      requestedBy: "tenant-author", approvedBy: "tenant-admin", approvedByRole: "organization_admin" as const,
      status: "approved" as const, approvedAt: "2026-07-03T00:00:00.000Z",
      operations: [{ kind: "add_requirement" as const, requirement: { id: "tenant-extra", section: "intake" as const, statement: text("Extra regulatory review") } }],
    };
    expect(() => validateTypologyPackV2TenantOverride({ organizationId: "org-1", override, registry, sourceAuthorities, context: resolutionContext, now })).toThrow(/compliance discipline/);
    expect(() => validateTypologyPackV2TenantOverride({ organizationId: "org-1", override: { ...override, approvedBy: "compliance-reviewer", approvedByRole: "compliance" }, registry, sourceAuthorities, context: resolutionContext, now })).not.toThrow();
    expect(() => validateTypologyPackV2TenantOverride({ organizationId: "org-2", override: { ...override, approvedBy: "compliance-reviewer", approvedByRole: "compliance" }, registry, sourceAuthorities, context: resolutionContext, now })).toThrow(/same-organization/);
    const wrongCitation = structuredClone(override);
    wrongCitation.approvedBy = "compliance-reviewer"; wrongCitation.approvedByRole = "compliance";
    wrongCitation.operations[0].requirement.statement.source.sourceVersionFingerprint = "f".repeat(64);
    expect(() => validateTypologyPackV2TenantOverride({ organizationId: "org-1", override: wrongCitation, registry, sourceAuthorities, context: resolutionContext, now })).toThrow(/exact governed source version/);
  });

  it("pins mixed-use components exactly and blocks the composition when one is unavailable", () => {
    const mixed = validateTypologyPackV2Candidate({
      ...DUBAI_MIXED_USE_TYPOLOGY_PACK_V2_CANDIDATE,
      sections: [...TYPOLOGY_PACK_V2_SECTIONS],
      requirements: TYPOLOGY_PACK_V2_SECTIONS.map(section => ({ id: `${section}-mixed-r`, section, statement: text(section) })),
      risks: [{ id: "mixed-component-risk", statement: text("A blocked component blocks issue.") }],
    });
    const component = DUBAI_TYPOLOGY_PACK_V2_ATOMIC_CANDIDATES.find(pack => pack.packId === "dubai-apartment")!;
    const componentEnvelope = envelopeFor({ ...component, sections: [...TYPOLOGY_PACK_V2_SECTIONS], requirements: TYPOLOGY_PACK_V2_SECTIONS.map(section => ({ id: `${section}-r`, section, statement: text(section) })) });
    const reference = { packId: mixed.packId, version: mixed.version, contentFingerprint: fingerprintTypologyPackV2Content(mixed) };
    const mixedEnvelope = envelopeFor(mixed as ReturnType<typeof completeAtomic>);
    expect(() => resolveCheckedInTypologyPackV2({ reference, registry: [{ pack: mixed, envelope: mixedEnvelope }] as never, sourceAuthorities, context: resolutionContext, now })).toThrow(/exact checked-in/);
    // The failure is intentional: a candidate component has no complete, independently approved release.
    expect(componentEnvelope.contentFingerprint).not.toBe(mixed.components[0].contentFingerprint);
    const nested = structuredClone(DUBAI_MIXED_USE_TYPOLOGY_PACK_V2_CANDIDATE);
    nested.components[0] = { ...nested.components[0], family: "mixed_use" } as never;
    expect(() => validateTypologyPackV2Candidate(nested)).toThrow();
  });

  it("does not project candidates and returns only public-safe citations for a released pack", () => {
    const pack = completeAtomic(); const envelope = envelopeFor(pack);
    const reference = { packId: pack.packId, version: pack.version, contentFingerprint: fingerprintTypologyPackV2Content(pack) };
    expect(() => projectPublicTypologyPackV2({ reference, registry: [], sourceAuthorities, context: resolutionContext, now })).toThrow(TypologyPackV2ResolutionError);
    const projection = projectPublicTypologyPackV2({ reference, registry: [{ pack, envelope }], sourceAuthorities, context: resolutionContext, now });
    expect(projection).not.toHaveProperty("candidateNotes");
    expect(projection).not.toHaveProperty("authoredBy");
    expect(projection.citations[0]).not.toHaveProperty("applicability");
    expect(projection.citations[0]).not.toHaveProperty("rawArtifact");
    expect(() => projectPublicTypologyPackV2({ reference, registry: [{ pack, envelope }], sourceAuthorities, context: { ...resolutionContext, authorityScopes: ["difc"] }, now })).toThrow(/applicable|overlay/);
  });
});
