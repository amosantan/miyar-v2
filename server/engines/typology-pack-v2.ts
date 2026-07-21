import { createHash } from "node:crypto";
import {
  type PublicTypologyPackV2Projection,
  type RegulatorySourceReference,
  type RegulatorySourceAssertionEnvelope,
  type TypologyPackV2Candidate,
  type TypologyPackV2Reference,
  type TypologyPackV2ReleaseEnvelope,
  type TypologyPackV2TenantOverride,
  typologyPackV2CandidateSchema,
  typologyPackV2ReferenceSchema,
  typologyPackV2ReleaseEnvelopeSchema,
  typologyPackV2TenantOverrideSchema,
} from "@shared/typology-pack-v2";
import {
  resolveRegulatoryReference,
  type RegulatoryTemporalRelation,
  type RegulatoryVersionState,
} from "./regulatory-source-resolution";
import { loadRegulatoryResolutionState } from "../db/regulatory-sources";

export class TypologyPackV2ResolutionError extends Error {
  constructor(message: string) { super(message); this.name = "TypologyPackV2ResolutionError"; }
}

export type TypologyPackV2ResolutionContext = Readonly<{
  jurisdiction: string;
  authorityScopes: readonly string[];
  permitBasis: "issue_date" | "permit_date" | "completion_date";
  basisAt: string;
  projectConditions: readonly string[];
}>;

/** Stable JSON serialization for the two independently-addressed v2 fingerprints. */
export function canonicalizeTypologyPackV2(input: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypologyPackV2ResolutionError("Canonical serialization rejects non-finite numbers");
      return Object.is(value, -0) ? 0 : value;
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (typeof value !== "object") throw new TypologyPackV2ResolutionError("Canonical serialization accepts JSON values only");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypologyPackV2ResolutionError("Canonical serialization accepts plain objects only");
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [key, normalize((value as Record<string, unknown>)[key])]));
  };
  return JSON.stringify(normalize(input));
}

function sha256(input: unknown): string {
  return createHash("sha256").update(canonicalizeTypologyPackV2(input), "utf8").digest("hex");
}

export function fingerprintTypologyPackV2Content(pack: TypologyPackV2Candidate): string {
  return sha256(pack);
}

/** The release fingerprint deliberately excludes itself while binding approvals to exact content. */
export function fingerprintTypologyPackV2Release(envelope: Omit<TypologyPackV2ReleaseEnvelope, "releaseFingerprint">): string {
  return sha256(envelope);
}

export type CheckedInTypologyPackV2Release = Readonly<{
  pack: TypologyPackV2Candidate;
  envelope: TypologyPackV2ReleaseEnvelope;
}>;

/** Content-addressed governed source state compiled from version assertions and temporal relations. */
export type RegulatorySourceAuthorityRecord = Readonly<{
  sourceKey: string;
  sourceVersionFingerprint: string;
  jurisdiction: string;
  authorityScope: string;
  clauseLocators: readonly string[];
  permittedBases: readonly RegulatorySourceReference["basis"][];
  assertions: readonly RegulatorySourceAssertionEnvelope[];
  liveVersions: readonly RegulatoryVersionState[];
  liveRelations: readonly RegulatoryTemporalRelation[];
}>;

export function compileRegulatorySourceAuthorityRecord(input: Readonly<{
  sourceKey: string;
  sourceVersionFingerprint: string;
  jurisdiction: string;
  authorityScope: string;
  clauseLocators: readonly string[];
  permittedBases: readonly RegulatorySourceReference["basis"][];
  assertions: readonly RegulatorySourceAssertionEnvelope[];
  liveVersions: readonly RegulatoryVersionState[];
  liveRelations: readonly RegulatoryTemporalRelation[];
}>): RegulatorySourceAuthorityRecord {
  return Object.freeze({
    sourceKey: input.sourceKey,
    sourceVersionFingerprint: input.sourceVersionFingerprint,
    jurisdiction: input.jurisdiction,
    authorityScope: input.authorityScope,
    clauseLocators: Object.freeze([...input.clauseLocators]),
    permittedBases: Object.freeze([...input.permittedBases]),
    assertions: Object.freeze([...input.assertions]),
    liveVersions: Object.freeze([...input.liveVersions]),
    liveRelations: Object.freeze([...input.liveRelations]),
  });
}

/**
 * This is the only production v2 registry. It intentionally ships empty:
 * the source catalogue creates candidates, not project-ready requirements.
 */
export const CHECKED_IN_TYPOLOGY_PACK_V2_RELEASES: ReadonlyArray<CheckedInTypologyPackV2Release> = Object.freeze([]);
export const CHECKED_IN_REGULATORY_SOURCE_AUTHORITIES: ReadonlyArray<RegulatorySourceAuthorityRecord> = Object.freeze([]);

const REQUIRED_ASSERTION_TYPES = ["document_identity", "authenticity", "temporal_status", "jurisdiction", "permitted_use"] as const;

function citationApplies(citation: RegulatorySourceReference, context: TypologyPackV2ResolutionContext): boolean {
  const at = Date.parse(context.basisAt);
  return Number.isFinite(at)
    && citation.jurisdiction === context.jurisdiction
    && citation.applicability.jurisdiction === context.jurisdiction
    && citation.applicability.permitBasis === context.permitBasis
    && citation.applicability.authorityScopes.every(scope => context.authorityScopes.includes(scope))
    && citation.applicability.projectConditions.every(condition => context.projectConditions.includes(condition))
    && (!citation.applicability.applicableFrom || Date.parse(citation.applicability.applicableFrom) <= at)
    && (!citation.applicability.applicableTo || Date.parse(citation.applicability.applicableTo) > at);
}

function hasCurrentAssertions(authority: RegulatorySourceAuthorityRecord, citation: RegulatorySourceReference, basisAt: string): boolean {
  const at = Date.parse(basisAt);
  if (!Number.isFinite(at)) return false;
  return REQUIRED_ASSERTION_TYPES.every(type => authority.assertions.filter(assertion => assertion.assertionType === type).some(assertion =>
    assertion.sourceKey === citation.sourceKey
    && assertion.sourceVersionFingerprint === citation.sourceVersionFingerprint
    && assertion.decision === "accepted"
    && Date.parse(assertion.validFrom) <= at
    && (!assertion.validTo || Date.parse(assertion.validTo) > at),
  ));
}

function assertGovernedCitation(citation: RegulatorySourceReference, authorities: readonly RegulatorySourceAuthorityRecord[], context: TypologyPackV2ResolutionContext, allowedSourceKeys?: readonly string[]): void {
    const authority = authorities.find(record => record.sourceKey === citation.sourceKey && record.sourceVersionFingerprint === citation.sourceVersionFingerprint);
    if (!authority) throw new TypologyPackV2ResolutionError("Every authoritative datum must resolve to an exact governed source version");
    if (!hasCurrentAssertions(authority, citation, context.basisAt)) throw new TypologyPackV2ResolutionError("Authoritative source version lacks five accepted current assertion envelopes");
    if (authority.jurisdiction !== citation.jurisdiction || citation.applicability.jurisdiction !== authority.jurisdiction) throw new TypologyPackV2ResolutionError("Authoritative citation jurisdiction does not match governed source state");
    if (!citationApplies(citation, context) || !context.authorityScopes.includes(authority.authorityScope) || !citation.applicability.authorityScopes.includes(authority.authorityScope)) throw new TypologyPackV2ResolutionError("Authoritative citation is not applicable to the issue basis, authority scope, or project conditions");
    if (!authority.clauseLocators.includes(citation.clauseLocator)) throw new TypologyPackV2ResolutionError("Authoritative citation locator is not present in the governed source version");
    if (!authority.permittedBases.includes(citation.basis)) throw new TypologyPackV2ResolutionError("Source class cannot support the claimed authority basis");
    if (allowedSourceKeys && !allowedSourceKeys.includes(citation.sourceKey)) throw new TypologyPackV2ResolutionError("Authoritative citation is outside the pack source manifest");
    const resolution = resolveRegulatoryReference({ contentFingerprint: citation.sourceVersionFingerprint, clauseLocator: citation.clauseLocator, basisAt: context.basisAt, mode: "current", versions: authority.liveVersions, relations: authority.liveRelations });
    if (!resolution.usable) throw new TypologyPackV2ResolutionError(`Authoritative source is not current for new use: ${resolution.reason}`);
}

function assertGovernedCitations(pack: TypologyPackV2Candidate, authorities: readonly RegulatorySourceAuthorityRecord[], context: TypologyPackV2ResolutionContext): void {
  for (const citation of collectCitations(pack)) {
    assertGovernedCitation(citation, authorities, context, pack.candidateSourceKeys);
  }
}

function assertPackApplicability(pack: TypologyPackV2Candidate, context: TypologyPackV2ResolutionContext): void {
  const at = Date.parse(context.basisAt);
  if (!Number.isFinite(at) || context.jurisdiction !== pack.applicability.jurisdiction || context.permitBasis !== pack.applicability.permitBasis) {
    throw new TypologyPackV2ResolutionError("Pack jurisdiction or permit basis is not applicable");
  }
  if (context.authorityScopes.some(scope => !pack.applicability.authorityScopes.includes(scope))) throw new TypologyPackV2ResolutionError("Pack has no approved overlay for an applicable authority");
  if (pack.applicability.projectConditions.some(condition => !context.projectConditions.includes(condition))) throw new TypologyPackV2ResolutionError("Pack project conditions are not satisfied");
  if (pack.applicability.applicableFrom && Date.parse(pack.applicability.applicableFrom) > at) throw new TypologyPackV2ResolutionError("Pack is not yet applicable at the issue basis date");
  if (pack.applicability.applicableTo && Date.parse(pack.applicability.applicableTo) <= at) throw new TypologyPackV2ResolutionError("Pack is no longer applicable for a new issue");
}

function assertCompleteForRelease(pack: TypologyPackV2Candidate): void {
  if (pack.sections.length !== 10) throw new TypologyPackV2ResolutionError("Released v2 packs require all ten product sections");
  const coveredSections = new Set(pack.requirements.map(requirement => requirement.section));
  if (pack.sections.some(section => !coveredSections.has(section))) throw new TypologyPackV2ResolutionError("Every released product section requires a sourced requirement");
  if (pack.risks.length === 0) throw new TypologyPackV2ResolutionError("Released v2 packs require at least one sourced risk");
  if (pack.kind === "mixed_use") return;
  if (pack.rooms.length === 0 || pack.adjacencies.length === 0 || pack.responsibilities.length === 0) {
    throw new TypologyPackV2ResolutionError("Released atomic packs require sourced rooms, adjacency and responsibility data");
  }
  if (pack.requirements.some(requirement => !requirement.statement.source)) {
    throw new TypologyPackV2ResolutionError("Every released requirement must have an exact source reference");
  }
  for (const room of pack.rooms) {
    if (!room.name.source || !room.required.source || (room.area && (!room.area.min.source || !room.area.max.source))) {
      throw new TypologyPackV2ResolutionError("Every released room datum must have an exact source reference");
    }
  }
}

export function assertTypologyPackV2Release(args: Readonly<{
  pack: TypologyPackV2Candidate;
  envelope: TypologyPackV2ReleaseEnvelope;
  sourceAuthorities: readonly RegulatorySourceAuthorityRecord[];
  context: TypologyPackV2ResolutionContext;
  now?: Date;
}>): void {
  const pack = typologyPackV2CandidateSchema.parse(args.pack);
  const envelope = typologyPackV2ReleaseEnvelopeSchema.parse(args.envelope);
  const now = args.now ?? new Date();
  const contentFingerprint = fingerprintTypologyPackV2Content(pack);
  if (envelope.packId !== pack.packId || envelope.version !== pack.version || envelope.contentFingerprint !== contentFingerprint) {
    throw new TypologyPackV2ResolutionError("A release envelope must bind the exact pack version and content fingerprint");
  }
  const { releaseFingerprint: _releaseFingerprint, ...unsignedEnvelope } = envelope;
  const expectedReleaseFingerprint = fingerprintTypologyPackV2Release(unsignedEnvelope);
  if (envelope.releaseFingerprint !== expectedReleaseFingerprint) {
    throw new TypologyPackV2ResolutionError("A release envelope fingerprint must bind its exact approval records");
  }
  if (envelope.status !== "approved" || envelope.withdrawnAt || new Date(envelope.approvedAt) > now) {
    throw new TypologyPackV2ResolutionError("Only an approved, current platform release may be resolved");
  }
  for (const approval of envelope.approvals) {
    if (approval.reviewerId === pack.authoredBy) throw new TypologyPackV2ResolutionError("A pack author cannot approve the same pack");
    if (new Date(approval.signedAt) > now || (approval.expiresAt && new Date(approval.expiresAt) <= now)) {
      throw new TypologyPackV2ResolutionError("All professional approvals must be current");
    }
  }
  if (envelope.approvals.some(approval => new Date(approval.signedAt) > new Date(envelope.approvedAt))) {
    throw new TypologyPackV2ResolutionError("Platform release approval must follow every professional signature");
  }
  assertGovernedCitations(pack, args.sourceAuthorities, args.context);
  assertCompleteForRelease(pack);
}

function exactReleaseFor(reference: TypologyPackV2Reference, registry: ReadonlyArray<CheckedInTypologyPackV2Release>): CheckedInTypologyPackV2Release {
  const hit = registry.find(entry => entry.pack.packId === reference.packId && entry.pack.version === reference.version && fingerprintTypologyPackV2Content(entry.pack) === reference.contentFingerprint);
  if (!hit) throw new TypologyPackV2ResolutionError("Only an exact checked-in platform v2 release may be resolved");
  return hit;
}

function assertReleaseTree(
  root: CheckedInTypologyPackV2Release,
  registry: ReadonlyArray<CheckedInTypologyPackV2Release>,
  sourceAuthorities: readonly RegulatorySourceAuthorityRecord[],
  context: TypologyPackV2ResolutionContext,
  now?: Date,
): void {
  assertTypologyPackV2Release({ pack: root.pack, envelope: root.envelope, sourceAuthorities, context, now });
  assertPackApplicability(root.pack, context);
  if (root.pack.kind !== "mixed_use") return;
  for (const component of root.pack.components) {
    const componentRelease = exactReleaseFor(component, registry);
    assertTypologyPackV2Release({ pack: componentRelease.pack, envelope: componentRelease.envelope, sourceAuthorities, context, now });
    assertPackApplicability(componentRelease.pack, context);
    if (componentRelease.pack.kind === "mixed_use") throw new TypologyPackV2ResolutionError("Mixed-use packs cannot nest mixed-use components");
  }
}

/**
 * Resolves only the shipped release envelope, but refreshes every source's
 * temporal state from governed persistence at the requested basis date. A
 * checked-in release therefore cannot outlive a changed capture, assertion or
 * clause relation.
 */
export async function resolveProductionTypologyPackV2(referenceInput: TypologyPackV2Reference, context: TypologyPackV2ResolutionContext, now?: Date): Promise<TypologyPackV2Candidate> {
  const reference = typologyPackV2ReferenceSchema.parse(referenceInput);
  const hit = exactReleaseFor(reference, CHECKED_IN_TYPOLOGY_PACK_V2_RELEASES);
  const basisAt = new Date(context.basisAt);
  if (!Number.isFinite(basisAt.getTime())) throw new TypologyPackV2ResolutionError("Production resolution requires a valid basis date");
  const sourceAuthorities = await Promise.all(CHECKED_IN_REGULATORY_SOURCE_AUTHORITIES.map(async authority => {
    const live = await loadRegulatoryResolutionState({ sourceKey: authority.sourceKey, basisAt });
    return compileRegulatorySourceAuthorityRecord({
      ...authority,
      assertions: live.assertions,
      liveVersions: live.versions,
      liveRelations: live.relations,
    });
  }));
  assertReleaseTree(hit, CHECKED_IN_TYPOLOGY_PACK_V2_RELEASES, sourceAuthorities, context, now);
  return hit.pack;
}

/** Injectable registry is only for deterministic tests and offline release validation. */
export function resolveCheckedInTypologyPackV2(args: Readonly<{
  reference: TypologyPackV2Reference;
  registry: ReadonlyArray<CheckedInTypologyPackV2Release>;
  sourceAuthorities: readonly RegulatorySourceAuthorityRecord[];
  context: TypologyPackV2ResolutionContext;
  now?: Date;
}>): TypologyPackV2Candidate {
  const reference = typologyPackV2ReferenceSchema.parse(args.reference);
  const root = exactReleaseFor(reference, args.registry);
  assertReleaseTree(root, args.registry, args.sourceAuthorities, args.context, args.now);
  return root.pack;
}

/** Validates a tenant-bound additive override against an exact approved v2 base. */
export function validateTypologyPackV2TenantOverride(args: Readonly<{
  organizationId: string;
  override: TypologyPackV2TenantOverride;
  registry: ReadonlyArray<CheckedInTypologyPackV2Release>;
  sourceAuthorities: readonly RegulatorySourceAuthorityRecord[];
  context: TypologyPackV2ResolutionContext;
  now?: Date;
}>): void {
  const override = typologyPackV2TenantOverrideSchema.parse(args.override);
  const now = args.now ?? new Date();
  if (override.organizationId !== args.organizationId || new Date(override.approvedAt) > now || (override.expiresAt && new Date(override.expiresAt) <= now)) {
    throw new TypologyPackV2ResolutionError("A current same-organization approved override is required");
  }
  resolveCheckedInTypologyPackV2({ reference: override.pack, registry: args.registry, sourceAuthorities: args.sourceAuthorities, context: args.context, now });
  for (const operation of override.operations) {
    const citation = operation.requirement.statement.source;
    assertGovernedCitation(citation, args.sourceAuthorities, args.context);
    const role = override.approvedByRole;
    if ((citation.basis === "regulatory_minimum" || citation.basis === "official_guidance" || citation.enforcement === "hard_constraint") && role !== "compliance") {
      throw new TypologyPackV2ResolutionError("Regulatory or hard-constraint tenant overrides require compliance discipline approval");
    }
    if (citation.basis === "professional_benchmark" && !["architecture_interiors", "cost", "compliance"].includes(role)) {
      throw new TypologyPackV2ResolutionError("Professional-benchmark tenant overrides require an equivalent professional discipline approval");
    }
    if ((citation.basis === "client_requirement" || citation.basis === "assumption") && !["organization_admin", "architecture_interiors", "cost", "compliance", "product"].includes(role)) {
      throw new TypologyPackV2ResolutionError("Tenant override approval role is not authorized for its cited basis");
    }
  }
}

function collectCitations(pack: TypologyPackV2Candidate): RegulatorySourceReference[] {
  const citations: RegulatorySourceReference[] = [];
  const push = (citation: RegulatorySourceReference) => citations.push(citation);
  for (const room of pack.rooms) {
    push(room.name.source); push(room.required.source);
    if (room.area) { push(room.area.min.source); push(room.area.max.source); }
  }
  for (const adjacency of pack.adjacencies) push(adjacency.source);
  for (const responsibility of pack.responsibilities) push(responsibility.source);
  for (const requirement of pack.requirements) push(requirement.statement.source);
  for (const risk of pack.risks) push(risk.statement.source);
  const unique = new Map(citations.map(citation => [canonicalizeTypologyPackV2(citation), citation]));
  return Array.from(unique.values());
}

/** No raw artifacts, OCR, private review notes, candidate state, or storage keys are projected. */
export function projectPublicTypologyPackV2(args: Readonly<{
  reference: TypologyPackV2Reference;
  registry: ReadonlyArray<CheckedInTypologyPackV2Release>;
  sourceAuthorities: readonly RegulatorySourceAuthorityRecord[];
  context: TypologyPackV2ResolutionContext;
  now?: Date;
}>): PublicTypologyPackV2Projection {
  const pack = resolveCheckedInTypologyPackV2(args);
  return {
    packId: pack.packId,
    version: pack.version,
    contentFingerprint: fingerprintTypologyPackV2Content(pack),
    family: pack.family,
    ...(pack.variant ? { variant: pack.variant } : {}),
    title: pack.title,
    citations: collectCitations(pack).map(citation => ({
      sourceKey: citation.sourceKey,
      sourceVersionFingerprint: citation.sourceVersionFingerprint,
      clauseLocator: citation.clauseLocator,
      basis: citation.basis,
      enforcement: citation.enforcement,
      jurisdiction: citation.jurisdiction,
    })),
  };
}
