import { z } from "zod";

/**
 * BR-05's portable, deterministic typology-pack contract.  This file contains
 * data only: engines must never interpret narrative strings as rules.
 */
export const TYPOLOGY_PACK_SCHEMA_VERSION = "typology-pack/v1" as const;
export const TYPOLOGY_PACK_ENGINE_VERSION = "constraint-engine/v1" as const;

const identifier = z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/);
const isoDate = z.string().datetime({ offset: true });
const safeNumber = z.number().finite().safe();

export const areaUnitSchema = z.enum(["sqm"]);
export const areaBasisSchema = z.enum(["gfa", "nfa", "gia", "room_net"]);
export const roundingModeSchema = z.enum(["none", "nearest", "up", "down"]);
export const provenanceSchema = z.object({
  source: z.string().trim().min(3).max(500),
  sourceUrl: z.string().url().max(2048).optional(),
  authority: z.enum(["synthetic_example", "human_reviewed", "client_requirement"]),
  notes: z.string().trim().max(2_000).optional(),
}).strict();

export const areaValueSchema = z.object({
  value: safeNumber.nonnegative(),
  unit: areaUnitSchema,
  basis: areaBasisSchema,
  precision: z.number().int().min(0).max(6),
  rounding: roundingModeSchema,
}).strict();

export const areaRangeSchema = z.object({
  min: areaValueSchema,
  max: areaValueSchema,
}).strict().superRefine((range, ctx) => {
  if (range.min.unit !== range.max.unit || range.min.basis !== range.max.basis) {
    ctx.addIssue({ code: "custom", message: "Area range endpoints must use the same unit and basis" });
  }
  if (range.min.value > range.max.value) {
    ctx.addIssue({ code: "custom", message: "Area range minimum cannot exceed maximum" });
  }
});

export const objectiveSchema = z.object({ id: identifier, statement: z.string().trim().min(1).max(1_000) }).strict();
export const personaSchema = z.object({ id: identifier, name: z.string().trim().min(1).max(160), needs: z.array(z.string().trim().min(1).max(500)).max(40) }).strict();
export const roomArchetypeSchema = z.object({
  id: identifier,
  name: z.string().trim().min(1).max(160),
  area: areaRangeSchema,
  required: z.boolean(),
  narrativeGuidance: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
}).strict();

/** Closed primitives only; no expression, code, or natural-language parsing. */
export const deterministicConstraintSchema = z.discriminatedUnion("kind", [
  z.object({ id: identifier, kind: z.literal("area_range"), roomArchetypeId: identifier, range: areaRangeSchema }).strict(),
  z.object({ id: identifier, kind: z.literal("required_room"), roomArchetypeId: identifier }).strict(),
  z.object({ id: identifier, kind: z.literal("adjacency"), fromRoomArchetypeId: identifier, toRoomArchetypeId: identifier, relationship: z.enum(["must_adjoin", "must_separate"]) }).strict(),
  z.object({ id: identifier, kind: z.literal("fitout_scope"), roomArchetypeId: identifier, scope: z.enum(["shell_and_core", "tenant_fitout", "full_fitout"]) }).strict(),
  z.object({ id: identifier, kind: z.literal("ffe_requirement"), roomArchetypeId: identifier, category: z.enum(["fixed", "loose", "operational"]), required: z.boolean() }).strict(),
]);

export const typologyPackSchema = z.object({
  schemaVersion: z.literal(TYPOLOGY_PACK_SCHEMA_VERSION),
  engineVersion: z.literal(TYPOLOGY_PACK_ENGINE_VERSION),
  packId: identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().trim().min(1).max(160),
  productionStatus: z.enum(["synthetic_non_production", "human_approved"]),
  provenance: provenanceSchema,
  governance: z.object({
    owner: z.string().trim().min(1).max(160), reviewer: z.string().trim().min(1).max(160),
    reviewedAt: isoDate, reviewDueAt: isoDate,
  }).strict(),
  applicability: z.object({
    typologies: z.array(identifier).min(1).max(30), regions: z.array(z.string().trim().min(2).max(80)).min(1).max(30),
    assetScales: z.array(z.enum(["unit", "building", "district"])).min(1),
  }).strict(),
  objectives: z.array(objectiveSchema).max(40),
  personas: z.array(personaSchema).max(40),
  roomArchetypes: z.array(roomArchetypeSchema).min(1).max(100),
  constraints: z.array(deterministicConstraintSchema).max(300),
  narrativeGuidance: z.array(z.string().trim().min(1).max(2_000)).max(100).default([]),
  compliancePrompts: z.array(z.string().trim().min(1).max(1_000)).max(60).default([]),
  risks: z.array(z.object({ id: identifier, description: z.string().trim().min(1).max(1_000) }).strict()).max(60).default([]),
  deliverables: z.array(z.object({ id: identifier, name: z.string().trim().min(1).max(300) }).strict()).max(60).default([]),
}).strict().superRefine((pack, ctx) => {
  if (new Date(pack.governance.reviewDueAt) < new Date(pack.governance.reviewedAt)) {
    ctx.addIssue({ code: "custom", path: ["governance", "reviewDueAt"], message: "Review due date must not precede review date" });
  }
  const collections: Array<[string, ReadonlyArray<{ id: string }>]> = [
    ["objectives", pack.objectives], ["personas", pack.personas], ["roomArchetypes", pack.roomArchetypes],
    ["constraints", pack.constraints], ["risks", pack.risks], ["deliverables", pack.deliverables],
  ];
  for (const [name, values] of collections) {
    if (new Set(values.map(value => value.id)).size !== values.length) ctx.addIssue({ code: "custom", path: [name], message: `${name} IDs must be unique` });
  }
  const roomIds = new Set(pack.roomArchetypes.map(room => room.id));
  const roomById = new Map(pack.roomArchetypes.map(room => [room.id, room]));
  const edges = new Map<string, string[]>();
  const adjacencyByPair = new Map<string, "must_adjoin" | "must_separate">();
  const fitoutByRoom = new Map<string, "shell_and_core" | "tenant_fitout" | "full_fitout">();
  const areaRangesByRoomAndBasis = new Map<string, Array<{ min: number; max: number; constraintId: string }>>();
  for (const constraint of pack.constraints) {
    const references = constraint.kind === "adjacency"
      ? [constraint.fromRoomArchetypeId, constraint.toRoomArchetypeId]
      : "roomArchetypeId" in constraint ? [constraint.roomArchetypeId] : [];
    if (references.some(id => !roomIds.has(id))) ctx.addIssue({ code: "custom", path: ["constraints"], message: "Constraint references an unknown room archetype" });
    if (constraint.kind === "adjacency") {
      if (constraint.fromRoomArchetypeId === constraint.toRoomArchetypeId) ctx.addIssue({ code: "custom", message: "Adjacency may not reference itself" });
      const pair = [constraint.fromRoomArchetypeId, constraint.toRoomArchetypeId].sort().join("\u0000");
      const existingRelationship = adjacencyByPair.get(pair);
      if (existingRelationship && existingRelationship !== constraint.relationship) {
        ctx.addIssue({ code: "custom", path: ["constraints"], message: "A room pair cannot both adjoin and separate" });
      } else {
        adjacencyByPair.set(pair, constraint.relationship);
      }
      if (constraint.relationship === "must_adjoin") {
        edges.set(constraint.fromRoomArchetypeId, [...(edges.get(constraint.fromRoomArchetypeId) ?? []), constraint.toRoomArchetypeId]);
      }
    }
    if (constraint.kind === "fitout_scope") {
      const existingScope = fitoutByRoom.get(constraint.roomArchetypeId);
      if (existingScope && existingScope !== constraint.scope) {
        ctx.addIssue({ code: "custom", path: ["constraints"], message: "A room cannot have conflicting fit-out scopes" });
      } else {
        fitoutByRoom.set(constraint.roomArchetypeId, constraint.scope);
      }
    }
    if (constraint.kind === "area_range") {
      const archetype = roomById.get(constraint.roomArchetypeId);
      if (archetype &&
        (archetype.area.min.unit !== constraint.range.min.unit || archetype.area.min.basis !== constraint.range.min.basis)) {
        ctx.addIssue({ code: "custom", path: ["constraints"], message: "An area-range constraint must use its room archetype area unit and basis" });
      } else if (archetype &&
        (constraint.range.min.value > archetype.area.max.value || constraint.range.max.value < archetype.area.min.value)) {
        ctx.addIssue({ code: "custom", path: ["constraints"], message: "An area-range constraint must overlap its room archetype area" });
      }
      const key = `${constraint.roomArchetypeId}\u0000${constraint.range.min.unit}\u0000${constraint.range.min.basis}`;
      const ranges = areaRangesByRoomAndBasis.get(key) ?? [];
      const contradictsExisting = ranges.some(range => constraint.range.min.value > range.max || constraint.range.max.value < range.min);
      if (contradictsExisting) {
        ctx.addIssue({ code: "custom", path: ["constraints"], message: "Area-range constraints for the same room and basis must overlap" });
      }
      ranges.push({ min: constraint.range.min.value, max: constraint.range.max.value, constraintId: constraint.id });
      areaRangesByRoomAndBasis.set(key, ranges);
    }
    if (constraint.kind === "required_room" && roomById.get(constraint.roomArchetypeId)?.required === false) {
      ctx.addIssue({ code: "custom", path: ["constraints"], message: "A required-room constraint cannot reference an optional room archetype" });
    }
  }
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of edges.get(id) ?? []) if (visit(next)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  if (Array.from(edges.keys()).some(visit)) ctx.addIssue({ code: "custom", path: ["constraints"], message: "must_adjoin constraints may not contain a cycle" });
});

export type TypologyPack = z.infer<typeof typologyPackSchema>;
export type DeterministicConstraint = z.infer<typeof deterministicConstraintSchema>;

/** Validates untrusted input without mutating it. */
export function validateTypologyPack(input: unknown): TypologyPack {
  return typologyPackSchema.parse(input);
}

export const NEUTRAL_SYNTHETIC_TYPOLOGY_PACK: TypologyPack = validateTypologyPack({
  schemaVersion: TYPOLOGY_PACK_SCHEMA_VERSION, engineVersion: TYPOLOGY_PACK_ENGINE_VERSION,
  packId: "neutral-example", version: "0.1.0", title: "Neutral synthetic example (non-production)",
  productionStatus: "synthetic_non_production",
  provenance: { source: "BR-05 synthetic neutral example", authority: "synthetic_example", notes: "Not UAE design, compliance, cost, or fit-out guidance." },
  governance: { owner: "MIYAR product", reviewer: "MIYAR product", reviewedAt: "2026-01-01T00:00:00.000Z", reviewDueAt: "2027-01-01T00:00:00.000Z" },
  applicability: { typologies: ["neutral_example"], regions: ["non-production"], assetScales: ["unit"] },
  objectives: [{ id: "demonstrate", statement: "Demonstrate contract structure only." }], personas: [],
  roomArchetypes: [{ id: "example-room", name: "Example room", area: { min: { value: 1, unit: "sqm", basis: "room_net", precision: 0, rounding: "none" }, max: { value: 2, unit: "sqm", basis: "room_net", precision: 0, rounding: "none" } }, required: true }],
  constraints: [{ id: "example-room-required", kind: "required_room", roomArchetypeId: "example-room" }],
  narrativeGuidance: ["Synthetic example; do not use for a project."], compliancePrompts: [], risks: [], deliverables: [],
});
