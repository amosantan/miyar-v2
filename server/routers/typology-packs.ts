import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { NEUTRAL_SYNTHETIC_TYPOLOGY_PACK, TYPOLOGY_PACK_SCHEMA_VERSION } from "@shared/typology-pack";
import { canonicalizeTypologyPack, fingerprintTypologyPack, resolveTypologyPack, TypologyPackResolutionError, typologyPackOverridePayloadSchema, typologyPackReferenceSchema, validateTypologyPackOverride } from "../engines/typology-pack";
import { createTypologyPackRevision, getTypologyPackRevision, listTypologyPackRevisions, transitionTypologyPackRevision, TypologyPackStoreError } from "../db/typology-packs";
import { orgAdminProcedure, orgMutationProcedure, orgProcedure, router } from "../_core/trpc";

const idempotencyKey = z.string().trim().min(8).max(128);
const reason = z.string().trim().min(3).max(2_000);
const reference = typologyPackReferenceSchema;

function context(ctx: { orgId: number; user: { id: number } }) { return { organizationId: ctx.orgId, userId: ctx.user.id }; }
function translate(error: unknown): never {
  if (error instanceof TypologyPackStoreError) {
    throw new TRPCError({ code: error.code === "CONCEALED" ? "NOT_FOUND" : error.code === "FORBIDDEN" ? "FORBIDDEN" : error.code === "CONFLICT" ? "CONFLICT" : error.code === "UNAVAILABLE" ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST", message: error.message });
  }
  if (error instanceof TypologyPackResolutionError || error instanceof z.ZodError) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Typology pack not found" });
  }
  throw error;
}

const builtIns = [NEUTRAL_SYNTHETIC_TYPOLOGY_PACK] as const;

export const typologyPackRouter = router({
  builtIns: orgProcedure.query(() => builtIns.map(pack => ({ packId: pack.packId, version: pack.version, fingerprint: fingerprintTypologyPack(pack), productionStatus: pack.productionStatus, title: pack.title }))),
  list: orgProcedure.query(async ({ ctx }) => { try { return await listTypologyPackRevisions(context(ctx)); } catch (error) { translate(error); } }),
  create: orgMutationProcedure.input(z.object({
    packKey: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/), base: reference, payload: typologyPackOverridePayloadSchema,
    reviewDueAt: z.string().datetime({ offset: true }), reason, idempotencyKey,
  }).strict()).mutation(async ({ ctx, input }) => {
    if (input.payload.pack.packId !== input.base.packId || input.payload.pack.version !== input.base.version || input.payload.pack.fingerprint !== input.base.fingerprint) throw new TRPCError({ code: "BAD_REQUEST", message: "Override payload must pin the requested base pack" });
    try {
      validateTypologyPackOverride({ reference: input.base, builtIns, organizationId: String(ctx.orgId), payload: input.payload });
    } catch (error) {
      if (error instanceof TypologyPackResolutionError) throw new TRPCError({ code: "BAD_REQUEST", message: "Override is incompatible with its exact base pack" });
      throw error;
    }
    try { return await createTypologyPackRevision({
      packKey: input.packKey, basePackKey: input.base.packId, basePackVersion: input.base.version, basePackFingerprint: input.base.fingerprint,
      payloadSchemaVersion: TYPOLOGY_PACK_SCHEMA_VERSION, payload: input.payload, payloadFingerprint: createHash("sha256").update(canonicalizeTypologyPack(input.payload), "utf8").digest("hex"),
      reviewDueAt: new Date(input.reviewDueAt), reason: input.reason, idempotencyKey: input.idempotencyKey,
    }, context(ctx)); } catch (error) { translate(error); }
  }),
  review: orgAdminProcedure.input(z.object({ revisionId: z.number().int().positive(), reason, idempotencyKey }).strict()).mutation(async ({ ctx, input }) => { try { return await transitionTypologyPackRevision({ ...input, action: "review" }, context(ctx)); } catch (error) { translate(error); } }),
  approve: orgAdminProcedure.input(z.object({ revisionId: z.number().int().positive(), reason, idempotencyKey }).strict()).mutation(async ({ ctx, input }) => { try { return await transitionTypologyPackRevision({ ...input, action: "approve" }, context(ctx)); } catch (error) { translate(error); } }),
  withdraw: orgAdminProcedure.input(z.object({ revisionId: z.number().int().positive(), reason, idempotencyKey }).strict()).mutation(async ({ ctx, input }) => { try { return await transitionTypologyPackRevision({ ...input, action: "withdraw" }, context(ctx)); } catch (error) { translate(error); } }),
  resolve: orgProcedure.input(z.object({ base: reference, revisionId: z.number().int().positive().optional() }).strict()).query(async ({ ctx, input }) => {
    try {
      if (!input.revisionId) return resolveTypologyPack({ reference: input.base, builtIns });
      const revision = await getTypologyPackRevision(input.revisionId, context(ctx));
      if (!revision || revision.status !== "approved" || revision.reviewDueAt <= new Date() || revision.basePackKey !== input.base.packId || revision.basePackVersion !== input.base.version || revision.basePackFingerprint !== input.base.fingerprint || !revision.approvedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Typology pack not found" });
      if (revision.payloadFingerprint !== createHash("sha256").update(canonicalizeTypologyPack(revision.payload), "utf8").digest("hex")) throw new TRPCError({ code: "NOT_FOUND", message: "Typology pack not found" });
      const payload = typologyPackOverridePayloadSchema.parse(revision.payload);
      return resolveTypologyPack({ reference: input.base, builtIns, organizationId: String(ctx.orgId), override: { organizationId: String(ctx.orgId), ...payload, status: "approved", approvedAt: revision.approvedAt.toISOString() } });
    } catch (error) { if (error instanceof TRPCError) throw error; translate(error); }
  }),
});
