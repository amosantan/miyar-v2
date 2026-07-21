import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DUBAI_REGULATORY_SOURCE_CATALOGUE } from "@shared/regulatory-sources";
import { adminProcedure, router } from "../_core/trpc";
import {
  createRegulatorySourceAssertion,
  createRegulatorySourceRelation,
  listRegulatorySources,
  listRegulatorySourceVersions,
  registerRegulatorySource,
  RegulatorySourceStoreError,
} from "../db/regulatory-sources";

function translate(error: unknown): never {
  if (error instanceof RegulatorySourceStoreError) {
    throw new TRPCError({
      code: error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "UNAVAILABLE" ? "SERVICE_UNAVAILABLE" : error.code === "DENIED" ? "FORBIDDEN" : "CONFLICT",
      message: error.message,
    });
  }
  throw error;
}

const reason = z.string().trim().min(10).max(2_000);

/** Platform administrators only. Tenant administrators have no release or source-assertion authority. */
export const regulatorySourceRouter = router({
  catalogue: adminProcedure.query(() => DUBAI_REGULATORY_SOURCE_CATALOGUE),
  list: adminProcedure.query(async () => { try { return await listRegulatorySources(); } catch (error) { translate(error); } }),
  versions: adminProcedure.input(z.object({ sourceKey: z.string().min(3).max(128) }).strict()).query(async ({ input }) => {
    try { return await listRegulatorySourceVersions(input.sourceKey); } catch (error) { translate(error); }
  }),
  registerCatalogueSource: adminProcedure.input(z.object({ sourceKey: z.string().min(3).max(128) }).strict()).mutation(async ({ input }) => {
    const source = DUBAI_REGULATORY_SOURCE_CATALOGUE.find(item => item.sourceKey === input.sourceKey);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Regulatory source registration not found" });
    try { return await registerRegulatorySource(source); } catch (error) { translate(error); }
  }),
  assertVersion: adminProcedure.input(z.object({
    sourceVersionId: z.number().int().positive(),
    assertionType: z.enum(["document_identity", "authenticity", "temporal_status", "jurisdiction", "permitted_use"]),
    decision: z.enum(["accepted", "rejected", "withdrawn"]),
    reason,
    validFrom: z.string().datetime({ offset: true }),
    validTo: z.string().datetime({ offset: true }).optional(),
  }).strict()).mutation(async ({ ctx, input }) => {
    try {
      return await createRegulatorySourceAssertion({ ...input, assertedByUserId: ctx.user.id, validFrom: new Date(input.validFrom), validTo: input.validTo ? new Date(input.validTo) : undefined });
    } catch (error) { translate(error); }
  }),
  relateVersions: adminProcedure.input(z.object({
    sourceVersionId: z.number().int().positive(),
    targetSourceVersionId: z.number().int().positive(),
    relationType: z.enum(["amends", "supersedes", "suspends", "revokes", "clarifies"]),
    clauseScope: z.array(z.string().trim().min(1).max(255)).min(1),
    effectiveFrom: z.string().datetime({ offset: true }).optional(),
    effectiveTo: z.string().datetime({ offset: true }).optional(),
  }).strict()).mutation(async ({ input }) => {
    try { return await createRegulatorySourceRelation({ ...input, effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined, effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined }); }
    catch (error) { translate(error); }
  }),
});
