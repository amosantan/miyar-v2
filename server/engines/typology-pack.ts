import { createHash } from "node:crypto";
import { z } from "zod";
import {
  areaRangeSchema,
  deterministicConstraintSchema,
  typologyPackSchema,
  type DeterministicConstraint,
  type TypologyPack,
  validateTypologyPack,
} from "@shared/typology-pack";

export class TypologyPackResolutionError extends Error {
  constructor(message: string) { super(message); this.name = "TypologyPackResolutionError"; }
}

/** Canonical JSON has sorted object keys and rejects non-JSON runtime values. */
export function canonicalizeTypologyPack(input: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypologyPackResolutionError("Canonical serialization rejects non-finite numbers");
      return Object.is(value, -0) ? 0 : value;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new TypologyPackResolutionError("Canonical serialization rejects invalid dates");
      return value.toISOString();
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (typeof value !== "object") throw new TypologyPackResolutionError("Canonical serialization accepts JSON values only");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypologyPackResolutionError("Canonical serialization accepts plain objects only");
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [key, normalize((value as Record<string, unknown>)[key])]));
  };
  return JSON.stringify(normalize(input));
}

export function fingerprintTypologyPack(input: TypologyPack): string {
  return createHash("sha256").update(canonicalizeTypologyPack(input), "utf8").digest("hex");
}

/**
 * Shipped pack versions are content-addressed here.  Changing a built-in's
 * contents without creating a new version must fail closed at resolution.
 */
export const BUILT_IN_TYPOLOGY_PACK_FINGERPRINT_MANIFEST = Object.freeze({
  "neutral-example@0.1.0": "6ad359c44b59dd982223519c819be2a2e176f4f1a854b707ab191d8bccf4c2e7",
} as const);

function builtInManifestKey(pack: Pick<TypologyPack, "packId" | "version">): string {
  return `${pack.packId}@${pack.version}`;
}

function assertBuiltInFingerprint(pack: TypologyPack): void {
  const expected = BUILT_IN_TYPOLOGY_PACK_FINGERPRINT_MANIFEST[builtInManifestKey(pack) as keyof typeof BUILT_IN_TYPOLOGY_PACK_FINGERPRINT_MANIFEST];
  if (!expected || fingerprintTypologyPack(pack) !== expected) {
    throw new TypologyPackResolutionError("Built-in typology pack is absent from or differs from its immutable fingerprint manifest");
  }
}

export type TypologyPackReference = Readonly<{ packId: string; version: string; fingerprint: string }>;
export const typologyPackReferenceSchema = z.object({
  packId: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type TypologyPackOverrideOperation =
  | Readonly<{ kind: "add_constraint"; constraint: DeterministicConstraint }>
  | Readonly<{ kind: "narrow_area_range"; constraintId: string; range: Extract<DeterministicConstraint, { kind: "area_range" }>["range"] }>;
export const typologyPackOverrideOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add_constraint"), constraint: deterministicConstraintSchema }).strict(),
  z.object({ kind: z.literal("narrow_area_range"), constraintId: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/), range: areaRangeSchema }).strict(),
]);
/** Payload persisted by the tenant-governance layer; it has no mutable “latest” selector. */
export const typologyPackOverridePayloadSchema = z.object({
  pack: typologyPackReferenceSchema,
  operations: z.array(typologyPackOverrideOperationSchema).min(1).max(300),
}).strict();
export type ApprovedTypologyPackOverride = Readonly<{
  organizationId: string; pack: TypologyPackReference; status: "approved"; approvedAt: string; expiresAt?: string;
  operations: ReadonlyArray<TypologyPackOverrideOperation>;
}>;
export const approvedTypologyPackOverrideSchema = typologyPackOverridePayloadSchema.extend({
  organizationId: z.string().trim().min(1).max(128),
  status: z.literal("approved"), approvedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export const typologyPackResolutionInputSchema = z.object({
  reference: typologyPackReferenceSchema,
  builtIns: z.array(typologyPackSchema).min(1),
  organizationId: z.string().trim().min(1).max(128).optional(),
  override: approvedTypologyPackOverrideSchema.optional(),
}).strict();

function mergeOverride(pack: TypologyPack, override: ApprovedTypologyPackOverride): TypologyPack {
  const constraints = [...pack.constraints];
  for (const operation of override.operations) {
    if (operation.kind === "add_constraint") {
      if (constraints.some(rule => rule.id === operation.constraint.id)) throw new TypologyPackResolutionError("Override duplicates a stable constraint ID");
      constraints.push(operation.constraint);
      continue;
    }
    const index = constraints.findIndex(rule => rule.id === operation.constraintId && rule.kind === "area_range");
    if (index < 0) throw new TypologyPackResolutionError("Override cannot alter an unknown or incompatible constraint");
    const existing = constraints[index] as Extract<DeterministicConstraint, { kind: "area_range" }>;
    const next = operation.range;
    if (existing.range.min.unit !== next.min.unit || existing.range.min.basis !== next.min.basis || existing.range.max.unit !== next.max.unit || existing.range.max.basis !== next.max.basis || next.min.value < existing.range.min.value || next.max.value > existing.range.max.value) {
      throw new TypologyPackResolutionError("Override may narrow, but never relax, an area range");
    }
    constraints[index] = { ...existing, range: next };
  }
  return validateTypologyPack({ ...pack, constraints });
}

export function resolveTypologyPack(args: Readonly<{
  reference: TypologyPackReference; builtIns: ReadonlyArray<TypologyPack>; organizationId?: string; override?: ApprovedTypologyPackOverride;
  now?: Date;
}>): TypologyPack {
  const base = args.builtIns.find(pack => pack.packId === args.reference.packId && pack.version === args.reference.version);
  if (!base) throw new TypologyPackResolutionError("Exact built-in typology pack version and fingerprint are required");
  assertBuiltInFingerprint(base);
  if (fingerprintTypologyPack(base) !== args.reference.fingerprint) throw new TypologyPackResolutionError("Exact built-in typology pack version and fingerprint are required");
  if (!args.override) return base;
  const now = args.now ?? new Date();
  const override = approvedTypologyPackOverrideSchema.safeParse(args.override);
  if (!override.success || !args.organizationId || override.data.organizationId !== args.organizationId || override.data.pack.packId !== args.reference.packId || override.data.pack.version !== args.reference.version || override.data.pack.fingerprint !== args.reference.fingerprint || new Date(override.data.approvedAt) > now || (override.data.expiresAt && new Date(override.data.expiresAt) <= now)) {
    throw new TypologyPackResolutionError("Approved, current same-organization exact override is required");
  }
  return mergeOverride(base, override.data);
}

/** Validates an unapproved override against its exact immutable base before persistence. */
export function validateTypologyPackOverride(args: Readonly<{
  reference: TypologyPackReference; builtIns: ReadonlyArray<TypologyPack>; organizationId: string;
  payload: z.infer<typeof typologyPackOverridePayloadSchema>;
}>): void {
  resolveTypologyPack({
    reference: args.reference,
    builtIns: args.builtIns,
    organizationId: args.organizationId,
    override: { organizationId: args.organizationId, ...args.payload, status: "approved", approvedAt: "1970-01-01T00:00:00.000Z" },
  });
}
