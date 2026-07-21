import { z } from "zod";

/**
 * BR-06 deliberately keeps this contract separate from typology-pack/v1.
 * A v2 pack is content-addressed candidate material until an exact checked-in
 * platform release envelope has all four independent professional approvals.
 */
export const TYPOLOGY_PACK_V2_SCHEMA_VERSION = "typology-pack/v2" as const;
export const TYPOLOGY_PACK_V2_ENGINE_VERSION = "constraint-engine/v2" as const;

const identifier = z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/);
const sourceKey = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/);
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const isoDate = z.string().datetime({ offset: true });

export const PACK_FAMILY_IDS = [
  "apartment", "villa", "residential_building", "office", "hospitality",
  "food_beverage", "retail", "mixed_use",
] as const;
export const packFamilyIdSchema = z.enum(PACK_FAMILY_IDS);
export type PackFamilyId = z.infer<typeof packFamilyIdSchema>;

export const typologyPackV2BasisSchema = z.enum([
  "regulatory_minimum", "official_guidance", "professional_benchmark", "client_requirement", "assumption",
]);
export const typologyPackV2EnforcementSchema = z.enum(["guideline", "required_input", "hard_constraint"]);
export const typologyPackV2DisciplineSchema = z.enum(["architecture_interiors", "cost", "compliance", "product"]);
export const regulatorySourceAssertionTypeSchema = z.enum(["document_identity", "authenticity", "temporal_status", "jurisdiction", "permitted_use"]);
export const regulatorySourceAssertionEnvelopeSchema = z.object({
  sourceKey,
  sourceVersionFingerprint: fingerprint,
  assertionType: regulatorySourceAssertionTypeSchema,
  decision: z.literal("accepted"),
  assertedBy: z.string().trim().min(1).max(160),
  validFrom: isoDate,
  validTo: isoDate.optional(),
}).strict().superRefine((assertion, ctx) => {
  if (assertion.validTo && assertion.validTo <= assertion.validFrom) {
    ctx.addIssue({ code: "custom", path: ["validTo"], message: "Assertion validity interval is invalid" });
  }
});
export type RegulatorySourceAssertionEnvelope = z.infer<typeof regulatorySourceAssertionEnvelopeSchema>;
export const typologyPackV2SectionSchema = z.enum([
  "intake", "objectives", "personas", "programme", "adjacencies", "fitout_ffe",
  "compliance", "risks", "deliverables", "assumptions",
]);
export const TYPOLOGY_PACK_V2_SECTIONS = typologyPackV2SectionSchema.options;

/** Canonical non-exponent decimal strings, max three decimal places, no trailing zeros. */
export const canonicalDecimalStringSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{0,2}[1-9])?$/);
export const scaledIntegerSchema = z.object({
  scaledValue: z.number().int().safe().nonnegative(),
  scale: z.number().int().min(0).max(3),
}).strict();
export const exactQuantitySchema = z.union([
  z.object({ format: z.literal("decimal"), value: canonicalDecimalStringSchema }).strict(),
  z.object({ format: z.literal("scaled_integer"), value: scaledIntegerSchema }).strict(),
]);

export const applicabilityPredicateSchema = z.object({
  jurisdiction: z.string().trim().min(2).max(160),
  authorityScopes: z.array(identifier).min(1).max(20),
  permitBasis: z.enum(["issue_date", "permit_date", "completion_date", "historical_replay"]),
  applicableFrom: isoDate.optional(),
  applicableTo: isoDate.optional(),
  projectConditions: z.array(identifier).max(30).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.applicableFrom && value.applicableTo && value.applicableFrom > value.applicableTo) {
    ctx.addIssue({ code: "custom", path: ["applicableTo"], message: "Applicability interval is invalid" });
  }
});

/** A reference addresses a version by bytes, not a mutable database row or “latest”. */
export const regulatorySourceReferenceSchema = z.object({
  sourceKey,
  sourceVersionFingerprint: fingerprint,
  clauseLocator: z.string().trim().min(1).max(500),
  basis: typologyPackV2BasisSchema,
  enforcement: typologyPackV2EnforcementSchema,
  jurisdiction: z.string().trim().min(2).max(160),
  applicability: applicabilityPredicateSchema,
}).strict().superRefine((value, ctx) => {
  if (value.jurisdiction !== value.applicability.jurisdiction) {
    ctx.addIssue({ code: "custom", path: ["applicability", "jurisdiction"], message: "Citation and applicability jurisdictions must match" });
  }
});
export type RegulatorySourceReference = z.infer<typeof regulatorySourceReferenceSchema>;

export const sourcedTextSchema = z.object({
  value: z.string().trim().min(1).max(2_000).refine(value => !/\b(?:fully compliant|guaranteed compliant|ensures compliance|certified compliant)\b/i.test(value), "Pack text cannot provide compliance assurance"),
  source: regulatorySourceReferenceSchema,
}).strict();
export const sourcedBooleanSchema = z.object({ value: z.boolean(), source: regulatorySourceReferenceSchema }).strict();
export const sourcedQuantitySchema = z.object({ value: exactQuantitySchema, source: regulatorySourceReferenceSchema }).strict();
export const sourcedAreaRangeSchema = z.object({
  min: sourcedQuantitySchema,
  max: sourcedQuantitySchema,
  unit: z.literal("sqm"),
  basis: z.enum(["gfa", "nfa", "gia", "room_net"]),
}).strict().superRefine((range, ctx) => {
  if (range.min.source.sourceVersionFingerprint !== range.max.source.sourceVersionFingerprint || range.min.source.clauseLocator !== range.max.source.clauseLocator) {
    ctx.addIssue({ code: "custom", message: "An authoritative area range must have one exact clause reference" });
  }
  const asScaled = (quantity: z.infer<typeof exactQuantitySchema>): string => {
    if (quantity.format === "decimal") {
      const [whole, fraction = ""] = quantity.value.split(".");
      return `${whole}${fraction.padEnd(3, "0")}`.replace(/^0+(?=\d)/, "");
    }
    const digits = String(quantity.value.scaledValue).padStart(quantity.value.scale + 1, "0");
    const whole = quantity.value.scale === 0 ? digits : digits.slice(0, -quantity.value.scale);
    const fraction = quantity.value.scale === 0 ? "" : digits.slice(-quantity.value.scale);
    return `${whole}${fraction.padEnd(3, "0")}`.replace(/^0+(?=\d)/, "");
  };
  const min = asScaled(range.min.value); const max = asScaled(range.max.value);
  if (min.length > max.length || (min.length === max.length && min > max)) ctx.addIssue({ code: "custom", message: "Area minimum cannot exceed maximum" });
});

export const packRoomV2Schema = z.object({
  id: identifier,
  name: sourcedTextSchema,
  required: sourcedBooleanSchema,
  area: sourcedAreaRangeSchema.optional(),
}).strict();

/** Adjacency is an unordered pair. Cycles are valid and intentionally preserved. */
export const adjacencyV2Schema = z.object({
  id: identifier,
  rooms: z.tuple([identifier, identifier]),
  relationship: z.enum(["must_adjoin", "must_separate"]),
  source: regulatorySourceReferenceSchema,
}).strict().superRefine((value, ctx) => {
  if (value.rooms[0] === value.rooms[1]) ctx.addIssue({ code: "custom", path: ["rooms"], message: "An adjacency cannot point to itself" });
  if (value.rooms[0].localeCompare(value.rooms[1]) >= 0) ctx.addIssue({ code: "custom", path: ["rooms"], message: "An unordered adjacency pair must use canonical lexical order" });
});

export const responsibilityV2Schema = z.object({
  id: identifier,
  roomId: identifier.optional(),
  category: z.enum(["fitout", "ffe", "services", "authority_submission"]),
  party: z.enum(["developer", "landlord", "tenant", "operator", "consultant"]),
  source: regulatorySourceReferenceSchema,
}).strict();

export const requirementV2Schema = z.object({
  id: identifier,
  section: typologyPackV2SectionSchema,
  statement: sourcedTextSchema,
}).strict();
export const riskV2Schema = z.object({ id: identifier, statement: sourcedTextSchema }).strict();

const commonPackSchema = z.object({
  schemaVersion: z.literal(TYPOLOGY_PACK_V2_SCHEMA_VERSION),
  engineVersion: z.literal(TYPOLOGY_PACK_V2_ENGINE_VERSION),
  packId: identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  family: packFamilyIdSchema,
  variant: identifier.optional(),
  title: z.string().trim().min(1).max(160),
  authoredBy: z.string().trim().min(1).max(160),
  applicability: applicabilityPredicateSchema,
  sections: z.array(typologyPackV2SectionSchema).max(10),
  rooms: z.array(packRoomV2Schema).max(200),
  adjacencies: z.array(adjacencyV2Schema).max(400),
  responsibilities: z.array(responsibilityV2Schema).max(400),
  requirements: z.array(requirementV2Schema).max(500),
  risks: z.array(riskV2Schema).max(200),
  candidateNotes: z.array(z.string().trim().min(1).max(1_000)).max(80).default([]),
  candidateSourceKeys: z.array(sourceKey).min(1).max(80),
}).strict();

export const atomicTypologyPackV2Schema = commonPackSchema.extend({
  kind: z.literal("atomic"),
  family: z.enum(["apartment", "villa", "residential_building", "office", "hospitality", "food_beverage", "retail"]),
  components: z.never().optional(),
}).strict();

export const v2ComponentReferenceSchema = z.object({
  packId: identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  contentFingerprint: fingerprint,
  family: z.enum(["apartment", "villa", "residential_building", "office", "hospitality", "food_beverage", "retail"]),
}).strict();
export const mixedUseTypologyPackV2Schema = commonPackSchema.extend({
  kind: z.literal("mixed_use"),
  family: z.literal("mixed_use"),
  rooms: z.array(packRoomV2Schema).length(0),
  adjacencies: z.array(adjacencyV2Schema).length(0),
  responsibilities: z.array(responsibilityV2Schema).length(0),
  components: z.array(v2ComponentReferenceSchema).min(2).max(12),
}).strict();

export const typologyPackV2CandidateSchema = z.discriminatedUnion("kind", [atomicTypologyPackV2Schema, mixedUseTypologyPackV2Schema]).superRefine((pack, ctx) => {
  const ids = (values: ReadonlyArray<{ id: string }>, field: string) => {
    if (new Set(values.map(value => value.id)).size !== values.length) ctx.addIssue({ code: "custom", path: [field], message: `${field} IDs must be unique` });
  };
  ids(pack.rooms, "rooms"); ids(pack.adjacencies, "adjacencies"); ids(pack.responsibilities, "responsibilities"); ids(pack.requirements, "requirements"); ids(pack.risks, "risks");
  if (new Set(pack.sections).size !== pack.sections.length) ctx.addIssue({ code: "custom", path: ["sections"], message: "Sections must be unique" });
  const roomIds = new Set(pack.rooms.map(room => room.id));
  const pairRelationships = new Map<string, string>();
  for (const adjacency of pack.adjacencies) {
    if (adjacency.rooms.some(room => !roomIds.has(room))) ctx.addIssue({ code: "custom", path: ["adjacencies"], message: "Adjacency references an unknown room" });
    const key = [...adjacency.rooms].sort().join("\u0000");
    const previous = pairRelationships.get(key);
    if (previous && previous !== adjacency.relationship) ctx.addIssue({ code: "custom", path: ["adjacencies"], message: "An unordered room pair cannot both adjoin and separate" });
    pairRelationships.set(key, adjacency.relationship);
  }
  for (const responsibility of pack.responsibilities) if (responsibility.roomId && !roomIds.has(responsibility.roomId)) ctx.addIssue({ code: "custom", path: ["responsibilities"], message: "Responsibility references an unknown room" });
  if (pack.kind === "mixed_use") {
    const keys = pack.components.map(component => `${component.packId}@${component.version}@${component.contentFingerprint}`);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", path: ["components"], message: "Mixed-use components must be exact and unique" });
  }
  if (pack.family === "hospitality" && !pack.variant) {
    ctx.addIssue({ code: "custom", path: ["variant"], message: "Hospitality packs require an immutable hotel or serviced_apartment variant" });
  }
  if (pack.family === "hospitality" && pack.variant && !["hotel", "serviced_apartment"].includes(pack.variant)) {
    ctx.addIssue({ code: "custom", path: ["variant"], message: "Hospitality variants are limited to immutable hotel or serviced_apartment packs" });
  }
});
export type TypologyPackV2Candidate = z.infer<typeof typologyPackV2CandidateSchema>;

export const professionalApprovalSchema = z.object({
  discipline: typologyPackV2DisciplineSchema,
  reviewerId: z.string().trim().min(1).max(160),
  signedAt: isoDate,
  expiresAt: isoDate.optional(),
  decision: z.literal("approved"),
}).strict().superRefine((approval, ctx) => {
  if (approval.expiresAt && approval.expiresAt <= approval.signedAt) ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Approval expiry must follow signature" });
});
export const typologyPackV2ReleaseEnvelopeSchema = z.object({
  schemaVersion: z.literal(TYPOLOGY_PACK_V2_SCHEMA_VERSION),
  packId: identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  contentFingerprint: fingerprint,
  releaseFingerprint: fingerprint,
  status: z.enum(["approved", "withdrawn"]),
  platformReleaseOwner: z.string().trim().min(1).max(160),
  approvedAt: isoDate,
  approvals: z.array(professionalApprovalSchema).length(4),
  withdrawnAt: isoDate.optional(),
}).strict().superRefine((envelope, ctx) => {
  const disciplines = envelope.approvals.map(approval => approval.discipline);
  if (new Set(disciplines).size !== 4) ctx.addIssue({ code: "custom", path: ["approvals"], message: "All four independent disciplines are required exactly once" });
  const reviewers = envelope.approvals.map(approval => approval.reviewerId);
  if (new Set(reviewers).size !== reviewers.length) ctx.addIssue({ code: "custom", path: ["approvals"], message: "Professional approvals must be independently named" });
  if (envelope.status === "withdrawn" && !envelope.withdrawnAt) ctx.addIssue({ code: "custom", path: ["withdrawnAt"], message: "Withdrawn releases require a withdrawal timestamp" });
  if (envelope.status === "approved" && envelope.withdrawnAt) ctx.addIssue({ code: "custom", path: ["withdrawnAt"], message: "Approved releases cannot have a withdrawal timestamp" });
});
export type TypologyPackV2ReleaseEnvelope = z.infer<typeof typologyPackV2ReleaseEnvelopeSchema>;

export const typologyPackV2ReferenceSchema = z.object({
  packId: identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  contentFingerprint: fingerprint,
}).strict();
export type TypologyPackV2Reference = z.infer<typeof typologyPackV2ReferenceSchema>;

/**
 * Tenant overrides are deliberately additive-only. They may add an
 * organization-specific, cited requirement but cannot remove, replace, or
 * weaken a released regulatory/professional datum.
 */
export const typologyPackV2TenantOverrideOperationSchema = z.object({
  kind: z.literal("add_requirement"),
  requirement: requirementV2Schema,
}).strict();
export const typologyPackV2TenantOverrideSchema = z.object({
  organizationId: z.string().trim().min(1).max(128),
  pack: typologyPackV2ReferenceSchema,
  requestedBy: z.string().trim().min(1).max(160),
  approvedBy: z.string().trim().min(1).max(160),
  approvedByRole: z.enum(["organization_admin", "architecture_interiors", "cost", "compliance", "product"]),
  status: z.literal("approved"),
  approvedAt: isoDate,
  expiresAt: isoDate.optional(),
  operations: z.array(typologyPackV2TenantOverrideOperationSchema).min(1).max(100),
}).strict().superRefine((override, ctx) => {
  if (override.requestedBy === override.approvedBy) ctx.addIssue({ code: "custom", path: ["approvedBy"], message: "Tenant override requester cannot self-approve" });
  if (override.expiresAt && override.expiresAt <= override.approvedAt) ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Override expiry must follow approval" });
  const ids = override.operations.map(operation => operation.requirement.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["operations"], message: "Override requirement IDs must be unique" });
});
export type TypologyPackV2TenantOverride = z.infer<typeof typologyPackV2TenantOverrideSchema>;

export type PublicTypologyPackV2Projection = Readonly<{
  packId: string; version: string; contentFingerprint: string; family: PackFamilyId; variant?: string; title: string;
  citations: ReadonlyArray<Readonly<Pick<RegulatorySourceReference, "sourceKey" | "sourceVersionFingerprint" | "clauseLocator" | "basis" | "enforcement" | "jurisdiction">>>;
}>;

export function validateTypologyPackV2Candidate(input: unknown): TypologyPackV2Candidate {
  return typologyPackV2CandidateSchema.parse(input);
}
