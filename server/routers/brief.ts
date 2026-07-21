import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
  briefSectionContentV1InputSchema,
} from "@shared/brief-section-content";
import {
  briefConditionGateSchema,
  briefConditionKindSchema,
  briefContentAuthoritySchema,
  briefFunctionalRoleSchema,
  briefSectionIdSchema,
  briefTypologyProfileSchema,
  issuePurposeSchema,
} from "@shared/brief-contract";
import { requireEvidenceRecordForOrg } from "../_core/market-resource-access";
import { evaluateBriefReadiness } from "../engines/brief-readiness";
import {
  BriefWorkflowError,
  createBriefStream,
  executeBriefCommand,
  getBriefReadinessFacts,
  getBriefSection,
  getBriefStudio,
  getBriefSummary,
  getBriefVersion,
  listBriefAssignments,
  listBriefDependencies,
  listBriefEvents,
  listBriefFindings,
  listBriefIssues,
  listBriefStreams,
  hashBriefRequest,
} from "../db/brief-workflow";
import { listOrganizationEvidenceRecords, listPublicCorpusEvidence } from "../db";
import {
  orgAdminProcedure as baseOrgAdminProcedure,
  orgMutationProcedure as baseOrgMutationProcedure,
  orgProcedure as baseOrgProcedure,
  router,
} from "../_core/trpc";

function briefWorkflowEnabled(organizationId: number) {
  if (process.env.NODE_ENV !== "production") return true;
  const organizations = new Set(
    (process.env.BRIEF_WORKFLOW_ORG_IDS ?? "")
      .split(",")
      .map(value => Number(value.trim()))
      .filter(Number.isSafeInteger)
  );
  const consumers = new Set(
    (process.env.BRIEF_WORKFLOW_CONSUMERS ?? "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean)
  );
  return organizations.has(organizationId) && consumers.has("project_workspace");
}

const requireBriefWorkflow = async ({ ctx, next }: any) => {
  if (!briefWorkflowEnabled(ctx.orgId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Brief resource not found" });
  }
  return next({ ctx });
};

const orgProcedure = baseOrgProcedure.use(requireBriefWorkflow);
const orgMutationProcedure = baseOrgMutationProcedure.use(requireBriefWorkflow);
const orgAdminProcedure = baseOrgAdminProcedure.use(requireBriefWorkflow);

const canonicalId = z.string().regex(/^\d+$/).max(32);
const bounded = z.string().trim().min(1).max(2_000);
const idempotencyKey = z.string().trim().min(8).max(128);
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.null(), z.boolean(), z.number(), z.string().max(100_000),
    z.array(jsonValue).max(2_000), z.record(z.string().max(256), jsonValue),
  ])
);
const briefRef = z.object({ projectId: z.number().int().positive(), briefId: canonicalId });
const versionRef = briefRef.extend({ versionId: canonicalId });
const mutationMeta = z.object({ expectedRevision: z.number().int().nonnegative(), idempotencyKey });
const versionMutation = versionRef.merge(mutationMeta);
const page = z.object({ cursor: canonicalId.optional(), limit: z.number().int().min(1).max(100).default(50) });
const dependency = z.object({
  type: z.string().trim().min(1).max(64),
  recordId: z.string().trim().min(1).max(128).optional(),
  recordVersion: z.string().trim().min(1).max(128).optional(),
  fingerprint: z.string().trim().min(1).max(128).optional(),
  engineVersion: z.string().trim().min(1).max(128).optional(),
  modelVersion: z.string().trim().min(1).max(128).optional(),
  promptVersion: z.string().trim().min(1).max(128).optional(),
  inputFingerprint: z.string().trim().min(1).max(128).optional(),
  outputFingerprint: z.string().trim().min(1).max(128).optional(),
});
const evidenceReference = z.object({
  kind: z.literal("evidence_record"),
  id: z.number().int().positive(),
  ruleId: z.string().trim().min(1).max(128),
  relevance: z.string().trim().min(1).max(2_000),
}).strict();

const reviseSectionInput = versionMutation.extend({
  sectionId: briefSectionIdSchema,
  contentSchemaVersion: z.literal(BRIEF_SECTION_CONTENT_SCHEMA_VERSION),
  content: briefSectionContentV1InputSchema,
  origin: z.enum(["user", "deterministic", "ai_proposal"]),
  evidenceReferences: z.array(evidenceReference).max(100).default([]),
}).strict().superRefine((value, issue) => {
  if (value.content.sectionId !== value.sectionId) {
    issue.addIssue({
      code: "custom",
      path: ["content", "sectionId"],
      message: `Content is for ${value.content.sectionId}, not ${value.sectionId}`,
    });
  }
});

function context(ctx: { orgId: number; user: { id: number } }) {
  return { organizationId: ctx.orgId, userId: ctx.user.id, actorType: "human" as const };
}

function translate(error: unknown): never {
  if (error instanceof BriefWorkflowError) {
    const code = error.code === "CONCEALED" ? "NOT_FOUND"
      : error.code === "FORBIDDEN" ? "FORBIDDEN"
      : error.code === "CONFLICT" ? "CONFLICT"
      : error.code === "UNAVAILABLE" ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message });
  }
  throw error;
}

async function command(name: string, input: unknown, ctx: Parameters<typeof context>[0]) {
  try { return await executeBriefCommand(name, input, context(ctx)); }
  catch (error) { translate(error); }
}

async function resolveRevisionDependencies(
  input: z.infer<typeof reviseSectionInput>,
  organizationId: number
) {
  const dependencies = [];
  for (const reference of input.evidenceReferences) {
    const { evidence } = await requireEvidenceRecordForOrg(reference.id, organizationId);
    if (evidence.projectId !== null && evidence.projectId !== input.projectId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
    }
    const observedAt = evidence.captureDate ?? evidence.createdAt;
    const fingerprint = hashBriefRequest({
      id: evidence.id,
      recordId: evidence.recordId,
      captureDate: observedAt,
      corpusPolicyVersion: evidence.corpusPolicyVersion,
      currentConfidenceAssessmentId: evidence.currentConfidenceAssessmentId,
    });
    dependencies.push({
      type: "evidence",
      recordId: String(evidence.id),
      recordVersion: evidence.runId ?? new Date(observedAt).toISOString(),
      fingerprint,
      observedAt: new Date(observedAt).toISOString(),
      authority: "governed_evidence",
      ruleId: reference.ruleId,
      relevance: reference.relevance,
      serverResolved: true,
    });
  }
  return dependencies;
}

export const briefRouter = router({
  createStream: orgAdminProcedure.input(z.object({
    projectId: z.number().int().positive(),
    scope: z.discriminatedUnion("type", [
      z.object({ type: z.literal("project") }),
      z.object({ type: z.literal("scenario"), scenarioId: z.number().int().positive() }),
    ]),
    purpose: issuePurposeSchema,
    typologyProfileVersion: z.string().trim().min(1).max(96),
    profile: briefTypologyProfileSchema.optional(),
    componentIds: z.array(z.string().trim().min(1).max(96)).max(32),
    initialAssignments: z.array(z.object({ userId: z.number().int().positive(), role: briefFunctionalRoleSchema, sectionId: briefSectionIdSchema.optional() })).max(100),
    idempotencyKey,
  })).mutation(async ({ ctx, input }) => {
    try { return await createBriefStream(input, context(ctx)); }
    catch (error) { translate(error); }
  }),

  createVersion: orgMutationProcedure.input(versionMutation.extend({ predecessorVersionId: canonicalId, carryForwardSections: z.array(briefSectionIdSchema).max(10) })).mutation(({ ctx, input }) => command("createVersion", input, ctx)),
  reviseSection: orgMutationProcedure.input(reviseSectionInput).mutation(async ({ ctx, input }) => command("reviseSection", {
    ...input,
    dependencies: await resolveRevisionDependencies(input, ctx.orgId),
  }, ctx)),
  submitEvidence: orgMutationProcedure.input(versionMutation.extend({ sectionId: briefSectionIdSchema, revisionId: canonicalId, dependencyIds: z.array(canonicalId).max(500), rationale: bounded })).mutation(({ ctx, input }) => command("submitEvidence", input, ctx)),
  assignRole: orgAdminProcedure.input(briefRef.merge(mutationMeta).extend({ userId: z.number().int().positive(), role: briefFunctionalRoleSchema, versionId: canonicalId.optional(), sectionId: briefSectionIdSchema.optional(), reason: bounded })).mutation(({ ctx, input }) => command("assignRole", input, ctx)),
  revokeRole: orgAdminProcedure.input(briefRef.merge(mutationMeta).extend({ grantEventId: canonicalId, reason: bounded })).mutation(({ ctx, input }) => command("revokeRole", input, ctx)),
  recordFinding: orgMutationProcedure.input(versionMutation.extend({ sectionId: briefSectionIdSchema, revisionId: canonicalId, severity: z.enum(["blocking", "advisory"]), ownerUserId: z.number().int().positive(), statement: bounded })).mutation(({ ctx, input }) => command("recordFinding", input, ctx)),
  submitFindingResolution: orgMutationProcedure.input(versionMutation.extend({ findingId: canonicalId, resolutionRevisionId: canonicalId, evidence: jsonValue })).mutation(({ ctx, input }) => command("submitFindingResolution", input, ctx)),
  acceptFindingResolution: orgMutationProcedure.input(versionMutation.extend({ findingId: canonicalId, resolutionSubmissionEventId: canonicalId, outcome: z.enum(["accepted", "rejected"]), rationale: bounded })).mutation(({ ctx, input }) => command("acceptFindingResolution", input, ctx)),
  decideApplicability: orgMutationProcedure.input(versionMutation.extend({ sectionId: briefSectionIdSchema, action: z.enum(["propose", "accept_review", "approve", "withdraw"]), proposalEventId: canonicalId.optional(), rationale: bounded, evidence: jsonValue })).mutation(({ ctx, input }) => command("decideApplicability", input, ctx)),
  raiseCondition: orgMutationProcedure.input(versionMutation.extend({ sectionId: briefSectionIdSchema, kind: briefConditionKindSchema, gate: briefConditionGateSchema, reasonCode: z.string().trim().min(1).max(96), explanation: bounded, ownerUserId: z.number().int().positive(), dependencyId: canonicalId.optional(), resolutionRequirement: bounded })).mutation(({ ctx, input }) => command("raiseCondition", input, ctx)),
  submitConditionResolution: orgMutationProcedure.input(versionMutation.extend({ conditionId: canonicalId, evidence: jsonValue })).mutation(({ ctx, input }) => command("submitConditionResolution", input, ctx)),
  acceptConditionResolution: orgMutationProcedure.input(versionMutation.extend({ conditionId: canonicalId, resolutionSubmissionEventId: canonicalId, outcome: z.enum(["accepted", "rejected"]), rationale: bounded })).mutation(({ ctx, input }) => command("acceptConditionResolution", input, ctx)),
  acceptReview: orgMutationProcedure.input(versionMutation.extend({ sectionId: briefSectionIdSchema, revisionId: canonicalId, rationale: bounded })).mutation(({ ctx, input }) => command("acceptReview", input, ctx)),
  approveSection: orgMutationProcedure.input(versionMutation.extend({ sectionId: briefSectionIdSchema, revisionId: canonicalId, limitations: z.array(z.string().max(1_000)).max(100), rationale: bounded })).mutation(({ ctx, input }) => command("approveSection", input, ctx)),
  withdrawApproval: orgMutationProcedure.input(versionMutation.extend({ approvalEventId: canonicalId, reason: bounded })).mutation(({ ctx, input }) => command("withdrawApproval", input, ctx)),
  issue: orgMutationProcedure.input(versionMutation.extend({ disclaimerVersion: z.string().trim().min(1).max(96), confidentiality: z.enum(["organization", "named_recipients"]), distributionPolicyVersion: z.string().trim().min(1).max(96), expiresAt: z.string().datetime().optional() })).mutation(({ ctx, input }) => command("issue", input, ctx)),
  supersedeIssue: orgMutationProcedure.input(briefRef.merge(mutationMeta).extend({ priorIssueId: canonicalId, successorIssueId: canonicalId, reason: bounded })).mutation(({ ctx, input }) => command("supersedeIssue", input, ctx)),
  requestIssueWithdrawal: orgMutationProcedure.input(briefRef.merge(mutationMeta).extend({ issueId: canonicalId, reason: bounded, distributionImpact: bounded })).mutation(({ ctx, input }) => command("requestIssueWithdrawal", input, ctx)),
  approveIssueWithdrawal: orgMutationProcedure.input(briefRef.merge(mutationMeta).extend({ issueId: canonicalId, withdrawalRequestEventId: canonicalId, rationale: bounded })).mutation(({ ctx, input }) => command("approveIssueWithdrawal", input, ctx)),

  getStream: orgProcedure.input(briefRef).query(async ({ ctx, input }) => { try { return await getBriefSummary(input, context(ctx)); } catch (error) { translate(error); } }),
  listStreams: orgProcedure.input(z.object({ projectId: z.number().int().positive(), scope: z.enum(["project", "scenario"]).optional(), purpose: issuePurposeSchema.optional() }).merge(page)).query(async ({ ctx, input }) => { try { const items = await listBriefStreams(input, context(ctx)); return { items, nextCursor: null, canCreate: ctx.orgRole === "admin" }; } catch (error) { translate(error); } }),
  getVersion: orgProcedure.input(versionRef).query(async ({ ctx, input }) => { try { const [summary, version] = await Promise.all([getBriefSummary(input, context(ctx)), getBriefVersion(input, context(ctx))]); if (!version) throw new BriefWorkflowError("CONCEALED", "Brief resource not found"); const sections = await Promise.all((await import("@shared/brief-contract")).BRIEF_SECTION_IDS.map(sectionId => getBriefSection({ ...input, sectionId }, context(ctx)))); return { summary, version, sections: sections.filter(Boolean) }; } catch (error) { translate(error); } }),
  getStudio: orgProcedure.input(versionRef).query(async ({ ctx, input }) => {
    try {
      const [studio, organizationEvidence, publicEvidence] = await Promise.all([
        getBriefStudio(input, context(ctx)),
        listOrganizationEvidenceRecords(ctx.orgId, { limit: 50 }),
        listPublicCorpusEvidence({ limit: 50 }),
      ]);
      return {
        ...studio,
        choices: {
          ...studio.choices,
          evidence: [...organizationEvidence, ...publicEvidence]
            .filter(item => item.orgId == null || item.orgId === ctx.orgId)
            .filter(item => item.projectId == null || item.projectId === input.projectId)
            .map(item => ({
              id: item.id,
              label: item.title?.trim() || item.itemName,
              recordId: item.recordId,
              category: item.category,
              reliabilityGrade: item.reliabilityGrade,
              observedAt: item.captureDate,
              scope: item.orgId === ctx.orgId ? "organization" : "platform_public",
            })),
        },
        permittedActions: {
          ...studio.permittedActions,
          administerRoles: ctx.orgRole === "admin",
        },
      };
    } catch (error) { translate(error); }
  }),
  getSectionHistory: orgProcedure.input(briefRef.extend({ sectionId: briefSectionIdSchema }).merge(page)).query(async ({ ctx, input }) => { try { const items = await listBriefEvents(input, context(ctx)); return { items: items.filter((item: any) => item.sectionId === input.sectionId && item.eventType === "section_revised"), nextCursor: null }; } catch (error) { translate(error); } }),
  getAssignments: orgProcedure.input(briefRef.merge(page)).query(async ({ ctx, input }) => { try { return { items: await listBriefAssignments(input, context(ctx)), nextCursor: null }; } catch (error) { translate(error); } }),
  getFindings: orgProcedure.input(versionRef.extend({ sectionId: briefSectionIdSchema.optional() }).merge(page)).query(async ({ ctx, input }) => { try { const items = await listBriefFindings(input, context(ctx)); return { items: input.sectionId ? items.filter((item: any) => item.sectionId === input.sectionId) : items, nextCursor: null }; } catch (error) { translate(error); } }),
  getDependencyStatus: orgProcedure.input(versionRef.extend({ sectionId: briefSectionIdSchema.optional() })).query(async ({ ctx, input }) => { try { return await listBriefDependencies(input, context(ctx)); } catch (error) { translate(error); } }),
  getWorkflowHistory: orgProcedure.input(briefRef.merge(page)).query(async ({ ctx, input }) => { try { return { items: await listBriefEvents(input, context(ctx)), nextCursor: null }; } catch (error) { translate(error); } }),
  getIssueLedger: orgProcedure.input(briefRef.merge(page)).query(async ({ ctx, input }) => { try { return { items: await listBriefIssues(input, context(ctx)), nextCursor: null }; } catch (error) { translate(error); } }),
  getReadiness: orgProcedure.input(versionRef).query(async ({ ctx, input }) => { try { return evaluateBriefReadiness(await getBriefReadinessFacts(input, context(ctx)) as any); } catch (error) { translate(error); } }),
});
