import { and, desc, eq, max } from "drizzle-orm";
import { createHash } from "node:crypto";
import { NEUTRAL_SYNTHETIC_TYPOLOGY_PACK } from "@shared/typology-pack";
import { canonicalizeTypologyPack, TypologyPackResolutionError, typologyPackOverridePayloadSchema, validateTypologyPackOverride } from "../engines/typology-pack";
import { getDb } from "../db";
import { organizationMembers, typologyPackEvents, typologyPackRevisions } from "../../drizzle/schema";

export class TypologyPackStoreError extends Error {
  constructor(public readonly code: "CONCEALED" | "FORBIDDEN" | "CONFLICT" | "INVALID" | "UNAVAILABLE", message: string) {
    super(message);
  }
}

type Context = { organizationId: number; userId: number; requireAdmin?: boolean };
const requestFingerprint = (value: unknown) => createHash("sha256").update(canonicalizeTypologyPack(value), "utf8").digest("hex");

async function database() {
  const db = await getDb();
  if (!db) throw new TypologyPackStoreError("UNAVAILABLE", "Database unavailable");
  return db;
}

async function assertLiveMember(tx: any, context: Context) {
  const memberships = await tx.select().from(organizationMembers).where(and(
    eq(organizationMembers.orgId, context.organizationId),
    eq(organizationMembers.userId, context.userId),
  )).limit(2).for("update");
  if (memberships.length !== 1) throw new TypologyPackStoreError("CONCEALED", "Typology pack not found");
  if (context.requireAdmin && memberships[0].role !== "admin") {
    throw new TypologyPackStoreError("FORBIDDEN", "Organization administrator required");
  }
}

export async function createTypologyPackRevision(input: {
  packKey: string; basePackKey: string; basePackVersion: string; basePackFingerprint: string;
  payloadSchemaVersion: string; payload: unknown; payloadFingerprint: string; reviewDueAt: Date;
  reason: string; idempotencyKey: string;
}, context: Context) {
  const db = await database();
  return db.transaction(async (tx: any) => {
    await assertLiveMember(tx, context);
    const replay = await tx.select().from(typologyPackEvents).where(and(
      eq(typologyPackEvents.organizationId, context.organizationId),
      eq(typologyPackEvents.idempotencyKey, input.idempotencyKey),
    )).limit(1).for("update");
    const fingerprint = requestFingerprint({ action: "create", actorUserId: context.userId, ...input });
    if (replay[0]) {
      if (replay[0].eventType !== "created" || replay[0].requestFingerprint !== fingerprint) throw new TypologyPackStoreError("CONFLICT", "Idempotency key was used for a different request");
      const revisions = await tx.select().from(typologyPackRevisions).where(and(eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.id, replay[0].revisionId))).limit(1);
      if (revisions[0]) return revisions[0];
      throw new TypologyPackStoreError("CONFLICT", "Idempotency record is inconsistent");
    }
    const payload = typologyPackOverridePayloadSchema.safeParse(input.payload);
    if (!payload.success || payload.data.pack.packId !== input.basePackKey || payload.data.pack.version !== input.basePackVersion || payload.data.pack.fingerprint !== input.basePackFingerprint || input.payloadFingerprint !== requestFingerprint(input.payload)) {
      throw new TypologyPackStoreError("INVALID", "Typology pack override is invalid");
    }
    try {
      validateTypologyPackOverride({
        reference: payload.data.pack,
        builtIns: [NEUTRAL_SYNTHETIC_TYPOLOGY_PACK],
        organizationId: String(context.organizationId),
        payload: payload.data,
      });
    } catch (error) {
      if (error instanceof TypologyPackResolutionError || error instanceof Error) {
        throw new TypologyPackStoreError("INVALID", "Typology pack override is incompatible with its exact base pack");
      }
      throw error;
    }
    const latest = await tx.select({ revisionNumber: max(typologyPackRevisions.revisionNumber) }).from(typologyPackRevisions).where(and(
      eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.packKey, input.packKey),
    )).for("update");
    const revisionNumber = Number(latest[0]?.revisionNumber ?? 0) + 1;
    const result = await tx.insert(typologyPackRevisions).values({
      organizationId: context.organizationId, packKey: input.packKey, revisionNumber,
      basePackKey: input.basePackKey, basePackVersion: input.basePackVersion, basePackFingerprint: input.basePackFingerprint,
      payloadSchemaVersion: input.payloadSchemaVersion, payload: input.payload, payloadFingerprint: input.payloadFingerprint,
      reviewDueAt: input.reviewDueAt, createdBy: context.userId,
    });
    const id = Number(result[0].insertId);
    await tx.insert(typologyPackEvents).values({ organizationId: context.organizationId, revisionId: id, eventType: "created", actorUserId: context.userId, reason: input.reason, idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint });
    return (await tx.select().from(typologyPackRevisions).where(and(eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.id, id))).limit(1))[0];
  });
}

export async function transitionTypologyPackRevision(input: { revisionId: number; action: "review" | "approve" | "withdraw"; reason: string; idempotencyKey: string }, context: Context) {
  const db = await database();
  return db.transaction(async (tx: any) => {
    await assertLiveMember(tx, { ...context, requireAdmin: true });
    const replay = await tx.select().from(typologyPackEvents).where(and(eq(typologyPackEvents.organizationId, context.organizationId), eq(typologyPackEvents.idempotencyKey, input.idempotencyKey))).limit(1).for("update");
    const fingerprint = requestFingerprint({ actorUserId: context.userId, ...input });
    if (replay[0]) {
      if (replay[0].revisionId !== input.revisionId || replay[0].requestFingerprint !== fingerprint) throw new TypologyPackStoreError("CONFLICT", "Idempotency key was used for a different request");
      return (await tx.select().from(typologyPackRevisions).where(and(eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.id, replay[0].revisionId))).limit(1))[0];
    }
    const revision = (await tx.select().from(typologyPackRevisions).where(and(eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.id, input.revisionId))).limit(1).for("update"))[0];
    if (!revision) throw new TypologyPackStoreError("CONCEALED", "Typology pack not found");
    if (input.action === "review" && (revision.status !== "draft" || revision.createdBy === context.userId)) throw new TypologyPackStoreError("CONFLICT", "Only another administrator may review a draft revision");
    if (input.action === "approve" && (revision.status !== "reviewed" || revision.createdBy === context.userId || revision.reviewedBy === context.userId || revision.reviewDueAt <= new Date())) throw new TypologyPackStoreError("CONFLICT", "Revision cannot be approved");
    if (input.action === "approve") {
      const reviewers = await tx.select().from(organizationMembers).where(and(eq(organizationMembers.orgId, context.organizationId), eq(organizationMembers.userId, revision.reviewedBy!))).limit(2).for("update");
      if (reviewers.length !== 1 || reviewers[0].role !== "admin") throw new TypologyPackStoreError("CONFLICT", "Revision reviewer is no longer an active administrator");
    }
    if (input.action === "withdraw" && revision.status === "withdrawn") throw new TypologyPackStoreError("CONFLICT", "Revision is already withdrawn");
    const now = new Date();
    const fields = input.action === "review" ? { status: "reviewed" as const, reviewedBy: context.userId, reviewedAt: now }
      : input.action === "approve" ? { status: "approved" as const, approvedBy: context.userId, approvedAt: now }
      : { status: "withdrawn" as const, withdrawnBy: context.userId, withdrawnAt: now };
    await tx.update(typologyPackRevisions).set(fields).where(and(eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.id, input.revisionId)));
    await tx.insert(typologyPackEvents).values({ organizationId: context.organizationId, revisionId: input.revisionId, eventType: input.action === "review" ? "reviewed" : input.action === "approve" ? "approved" : "withdrawn", actorUserId: context.userId, reason: input.reason, idempotencyKey: input.idempotencyKey, requestFingerprint: fingerprint });
    return (await tx.select().from(typologyPackRevisions).where(and(eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.id, input.revisionId))).limit(1))[0];
  });
}

export async function listTypologyPackRevisions(context: Context) {
  const db = await database();
  await assertLiveMember(db, context);
  return db.select().from(typologyPackRevisions).where(eq(typologyPackRevisions.organizationId, context.organizationId)).orderBy(desc(typologyPackRevisions.createdAt));
}

export async function getTypologyPackRevision(revisionId: number, context: Context) {
  const db = await database();
  await assertLiveMember(db, context);
  return (await db.select().from(typologyPackRevisions).where(and(eq(typologyPackRevisions.organizationId, context.organizationId), eq(typologyPackRevisions.id, revisionId))).limit(1))[0] ?? null;
}
