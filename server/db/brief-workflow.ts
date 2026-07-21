import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { evaluateBriefReadiness } from "../engines/brief-readiness";
import {
  BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
  parseBriefSectionContentV1,
  readBriefSectionContent,
} from "../../shared/brief-section-content";
import {
  briefApplicabilityEvents,
  briefApprovals,
  briefConditionEvents,
  briefDependencies,
  briefEvents,
  briefFindingResolutions,
  briefFindings,
  briefIssueApplicability,
  briefIssueApprovals,
  briefIssueDependencies,
  briefIssueSections,
  briefIssues,
  briefOperations,
  briefRoleEvents,
  briefSectionRevisions,
  briefStreams,
  briefVersions,
  briefVersionSections,
  organizationMembers,
  projects,
  scenarios,
  users,
} from "../../drizzle/schema";

export const BRIEF_SECTION_IDS = [
  "intent",
  "asset_context",
  "space_programme",
  "design_direction",
  "specification_intent",
  "cost_quantities",
  "supply",
  "risk_compliance",
  "concept_media",
  "governance",
] as const;
export type BriefSectionId = (typeof BRIEF_SECTION_IDS)[number];
export type BriefWorkflowContext = {
  organizationId: number;
  userId: number;
  actorType?: "human" | "ai" | "system";
};
export type BriefStudioAction =
  | "revise"
  | "submit_evidence"
  | "record_finding"
  | "submit_finding_resolution"
  | "raise_condition"
  | "submit_condition_resolution"
  | "propose_not_applicable"
  | "review_not_applicable"
  | "approve_not_applicable"
  | "accept_review"
  | "approve_section";
export class BriefWorkflowError extends Error {
  constructor(
    public readonly code:
      | "CONCEALED"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVALID"
      | "UNAVAILABLE",
    message: string
  ) {
    super(message);
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}
export function hashBriefRequest(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function normalizeApplicabilityStage(action: string) {
  return action === "propose" ? "proposed" : action === "accept_review" ? "reviewed" : action === "approve" ? "approved" : action === "withdraw" ? "withdrawn" : null;
}
export function decisionStage(outcome: "accepted" | "rejected") {
  return outcome === "rejected" ? "rejected" : "accepted";
}
export function assertWorkingBriefVersion(status: string) {
  if (status !== "working")
    throw new BriefWorkflowError("CONFLICT", "Locked brief versions are immutable");
}
function positive(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new BriefWorkflowError(
      "INVALID",
      `${label} must be a positive integer`
    );
  return n;
}

async function database() {
  const db = await getDb();
  if (!db) throw new BriefWorkflowError("UNAVAILABLE", "Database unavailable");
  return db;
}
function retryableTransactionError(error: unknown) {
  const value = error as { code?: string; errno?: number };
  return value?.code === "ER_LOCK_DEADLOCK" || value?.code === "ER_LOCK_WAIT_TIMEOUT" || value?.errno === 1213 || value?.errno === 1205;
}
async function withBriefTransaction<T>(db: any, work: (tx: any) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await db.transaction(work); }
    catch (error) {
      if (!retryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw new BriefWorkflowError("UNAVAILABLE", "Brief transaction retry budget exhausted");
}
async function lockTenant(
  tx: any,
  context: BriefWorkflowContext,
  projectId: number,
  requireAdmin = false
) {
  const rows = await tx
    .select({
      projectId: projects.id,
      orgId: projects.orgId,
      typology: projects.ctx01Typology,
      memberRole: organizationMembers.role,
    })
    .from(projects)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.orgId, context.organizationId),
        eq(organizationMembers.userId, context.userId)
      )
    )
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.orgId, context.organizationId)
      )
    )
    .limit(1)
    .for("update");
  if (!rows[0])
    throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
  if (requireAdmin && rows[0].memberRole !== "admin")
    throw new BriefWorkflowError(
      "FORBIDDEN",
      "Organization administrator required"
    );
  return rows[0];
}

function normalizeBriefProfile(value: unknown) {
  const normalized = String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (normalized.includes("mixed")) return "mixed_use";
  if (normalized.includes("villa")) return "villa";
  if (normalized.includes("office")) return "office";
  if (normalized.includes("hotel") || normalized.includes("hospital")) return "hospitality";
  if (normalized.includes("retail")) return "retail";
  return "apartment";
}
async function lockStream(
  tx: any,
  context: BriefWorkflowContext,
  projectId: number,
  streamId: number
) {
  await lockTenant(tx, context, projectId);
  const rows = await tx
    .select()
    .from(briefStreams)
    .where(
      and(
        eq(briefStreams.organizationId, context.organizationId),
        eq(briefStreams.projectId, projectId),
        eq(briefStreams.id, streamId)
      )
    )
    .limit(1)
    .for("update");
  if (!rows[0])
    throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
  return rows[0];
}
async function activeRole(
  tx: any,
  context: BriefWorkflowContext,
  streamId: number,
  role: string,
  sectionId?: string
) {
  const rows = await tx
    .select()
    .from(briefRoleEvents)
    .where(
      and(
        eq(briefRoleEvents.organizationId, context.organizationId),
        eq(briefRoleEvents.streamId, streamId),
        eq(briefRoleEvents.subjectUserId, context.userId),
        sql`${briefRoleEvents.role}=${role}`,
        sectionId
          ? sql`(${briefRoleEvents.sectionId} is null or ${briefRoleEvents.sectionId}=${sectionId})`
          : sql`1=1`
      )
    )
    .orderBy(desc(briefRoleEvents.streamSequence));
  const latest = rows.find(
    (r: any) =>
      r.action === "granted" &&
      !rows.some(
        (x: any) => x.action === "revoked" && x.targetGrantEventId === r.id
      )
  );
  if (!latest)
    throw new BriefWorkflowError(
      "FORBIDDEN",
      `Active ${role} assignment required`
    );
  return latest;
}
async function allocateEvents(
  tx: any,
  stream: any,
  operationId: number,
  actor: BriefWorkflowContext,
  versionId: number,
  events: Array<{
    type: string;
    sectionId?: BriefSectionId;
    issueId?: number;
    payload?: unknown;
  }>
) {
  const first = Number(stream.nextEventSequence);
  const next = first + events.length;
  const allocation = await tx
    .update(briefStreams)
    .set({ nextEventSequence: next })
    .where(
      and(
        eq(briefStreams.organizationId, actor.organizationId),
        eq(briefStreams.projectId, stream.projectId),
        eq(briefStreams.id, stream.id),
        eq(briefStreams.nextEventSequence, first)
      )
    );
  if (Number(allocation[0]?.affectedRows) !== 1)
    throw new BriefWorkflowError("CONFLICT", "Event sequence allocation conflict");
  if (events.length)
    await tx.insert(briefEvents).values(
      events.map((event, i) => ({
        organizationId: actor.organizationId,
        projectId: stream.projectId,
        streamId: stream.id,
        versionId,
        sectionId: event.sectionId,
        issueId: event.issueId,
        operationId,
        actorUserId:
          actor.actorType === "human" || !actor.actorType ? actor.userId : null,
        actorType: actor.actorType ?? "human",
        eventType: event.type,
        payloadSchemaVersion: "br-03-v1",
        payload: event.payload ?? {},
        operationOrdinal: i + 1,
        streamSequence: first + i,
      }))
    );
}

export async function createBriefStream(
  input: any,
  context: BriefWorkflowContext
) {
  if (context.actorType && context.actorType !== "human")
    throw new BriefWorkflowError("FORBIDDEN", "A human organization administrator is required");
  const projectId = positive(input.projectId, "projectId");
  const requestHash = hashBriefRequest(input);
  const db = await database();
  return withBriefTransaction(db, async tx => {
    const tenant = await lockTenant(tx, context, projectId, true);
    if (input.scope?.type === "scenario") {
      const scenarioId = positive(input.scope.scenarioId, "scenarioId");
      const found = await tx
        .select({ id: scenarios.id })
        .from(scenarios)
        .where(
          and(eq(scenarios.id, scenarioId), eq(scenarios.projectId, projectId))
        )
        .limit(1)
        .for("update");
      if (!found[0])
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
    }
    const existing = await tx
      .select()
      .from(briefOperations)
      .where(
        and(
          eq(briefOperations.organizationId, context.organizationId),
          eq(briefOperations.projectId, projectId),
          eq(briefOperations.actorUserId, context.userId),
          eq(briefOperations.operation, "createStream"),
          eq(briefOperations.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1)
      .for("update");
    if (existing[0]) {
      if (existing[0].requestHash !== requestHash)
        throw new BriefWorkflowError(
          "CONFLICT",
          "Idempotency key reused with different input"
        );
      if (existing[0].status === "completed") return existing[0].result as any;
      throw new BriefWorkflowError("CONFLICT", "Operation already in progress");
    }
    const opInsert = await tx.insert(briefOperations).values({
      organizationId: context.organizationId,
      projectId,
      actorUserId: context.userId,
      operation: "createStream",
      idempotencyKey: input.idempotencyKey,
      requestHash,
    });
    const operationId = Number(opInsert[0].insertId);
    const scopeKey =
      input.scope?.type === "scenario"
        ? `scenario:${positive(input.scope.scenarioId, "scenarioId")}`
        : "project";
    const streamInsert = await tx.insert(briefStreams).values({
      organizationId: context.organizationId,
      projectId,
      scopeType: input.scope?.type ?? "project",
      scenarioId:
        input.scope?.type === "scenario" ? input.scope.scenarioId : null,
      scopeKey,
      issuePurpose: input.purpose,
      typologyProfileVersion: `${input.profile ?? normalizeBriefProfile(tenant.typology)}:${input.typologyProfileVersion}`,
      revision: 1,
      nextEventSequence: 1,
      createdBy: context.userId,
    });
    const streamId = Number(streamInsert[0].insertId);
    const versionInsert = await tx.insert(briefVersions).values({
      organizationId: context.organizationId,
      projectId,
      streamId,
      versionNumber: 1,
      origin: "user",
      requirementProfileVersion: input.typologyProfileVersion,
      componentScope: input.componentIds ?? [],
      revision: 0,
      createdBy: context.userId,
    });
    const versionId = Number(versionInsert[0].insertId);
    await tx.insert(briefVersionSections).values(
      BRIEF_SECTION_IDS.map(sectionId => ({
        organizationId: context.organizationId,
        projectId,
        streamId,
        versionId,
        sectionId,
        applicability: "required" as const,
        achievedState: "missing" as const,
        classifications: [],
        classificationFingerprint: hashBriefRequest([]),
        componentScope: input.componentIds ?? [],
        revision: 0,
      }))
    );
    if (input.initialAssignments?.length) {
      const assigneeIds = Array.from(new Set<number>(input.initialAssignments.map((a: any) => positive(a.userId, "assignment userId"))));
      const members = await tx.select({ userId: organizationMembers.userId }).from(organizationMembers).where(and(eq(organizationMembers.orgId, context.organizationId), inArray(organizationMembers.userId, assigneeIds))).for("update");
      if (members.length !== assigneeIds.length)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      await tx.insert(briefRoleEvents).values(
        input.initialAssignments.map((a: any, index: number) => ({
          organizationId: context.organizationId,
          projectId,
          streamId,
          versionId: null,
          sectionId: a.sectionId ?? null,
          subjectUserId: positive(a.userId, "assignment userId"),
          role: a.role,
          action: "granted" as const,
          actorUserId: context.userId,
          reason: "Initial stream assignment",
          streamSequence: 3 + index,
        }))
      );
    }
    const stream = { id: streamId, projectId, nextEventSequence: 1 };
    await allocateEvents(tx, stream, operationId, context, versionId, [
      { type: "stream_created", payload: { scopeKey } },
      { type: "version_created", payload: { versionNumber: 1 } },
      ...(input.initialAssignments ?? []).map((a: any) => ({
        type: "role_assigned",
        sectionId: a.sectionId,
        payload: { userId: a.userId, role: a.role },
      })),
    ]);
    const value = {
      operationId: String(operationId),
      revision: 1,
      value: {
        briefId: String(streamId),
        projectId,
        scope: input.scope ?? { type: "project" },
        purpose: input.purpose,
        typologyProfileVersion: `${input.profile ?? normalizeBriefProfile(tenant.typology)}:${input.typologyProfileVersion}`,
        currentVersionId: String(versionId),
        latestIssueId: null,
        revision: 1,
      },
    };
    await tx
      .update(briefOperations)
      .set({
        streamId,
        status: "completed",
        resultEntityType: "stream",
        resultEntityId: streamId,
        resultRevision: 1,
        result: value,
        completedAt: new Date(),
      })
      .where(eq(briefOperations.id, operationId));
    return value;
  });
}

export async function executeBriefCommand(
  operation: string,
  input: any,
  context: BriefWorkflowContext
): Promise<any> {
  if (operation === "createStream" || operation === "brief.createStream")
    return createBriefStream(input, context);
  if (operation.endsWith("reviseSection")) {
    if (input.contentSchemaVersion !== BRIEF_SECTION_CONTENT_SCHEMA_VERSION) {
      throw new BriefWorkflowError("INVALID", "New section revisions require the BR-04-v1 structured content contract");
    }
    try {
      input = {
        ...input,
        content: parseBriefSectionContentV1(input.sectionId, input.content),
      };
    } catch {
      throw new BriefWorkflowError("INVALID", "Section content does not match the selected structured editor");
    }
    if ((input.dependencies ?? []).some((dependency: any) =>
      dependency?.serverResolved !== true ||
      dependency?.authority !== "governed_evidence" ||
      dependency?.type !== "evidence"
    )) {
      throw new BriefWorkflowError("INVALID", "Section dependencies must be resolved by an authorized server picker");
    }
  }
  const projectId = positive(input.projectId, "projectId"),
    streamId = positive(input.briefId ?? input.streamId, "briefId"),
    db = await database(),
    requestHash = hashBriefRequest(input);
  return withBriefTransaction(db, async tx => {
    const stream = await lockStream(tx, context, projectId, streamId);
    const previous = await tx
      .select()
      .from(briefOperations)
      .where(
        and(
          eq(briefOperations.organizationId, context.organizationId),
          eq(briefOperations.projectId, projectId),
          eq(briefOperations.actorUserId, context.userId),
          eq(briefOperations.operation, operation),
          eq(briefOperations.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1)
      .for("update");
    if (previous[0]) {
      if (previous[0].requestHash !== requestHash)
        throw new BriefWorkflowError(
          "CONFLICT",
          "Idempotency key reused with different input"
        );
      if (previous[0].status === "completed") return previous[0].result;
      throw new BriefWorkflowError("CONFLICT", "Operation already in progress");
    }
    if (Number(input.expectedRevision) !== stream.revision)
      throw new BriefWorkflowError("CONFLICT", "Stale stream revision");
    if (
      (context.actorType === "ai" || context.actorType === "system") &&
      !["reviseSection", "markDependencyChanged"].some(x =>
        operation.endsWith(x)
      )
    )
      throw new BriefWorkflowError(
        "FORBIDDEN",
        "Non-human principals cannot perform governance actions"
      );
    const op = await tx.insert(briefOperations).values({
      organizationId: context.organizationId,
      projectId,
      streamId,
      actorUserId: context.userId,
      operation,
      idempotencyKey: input.idempotencyKey,
      requestHash,
    });
    const operationId = Number(op[0].insertId);
    const versionId = input.versionId
      ? positive(input.versionId, "versionId")
      : Number(
          (
            await tx
              .select({ id: briefVersions.id })
              .from(briefVersions)
              .where(
                and(
                  eq(briefVersions.organizationId, context.organizationId),
                  eq(briefVersions.streamId, streamId)
                )
              )
              .orderBy(desc(briefVersions.versionNumber))
              .limit(1)
              .for("update")
          )[0]?.id
        );
    if (!versionId)
      throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
    const versionRows = await tx
      .select()
      .from(briefVersions)
      .where(
        and(
          eq(briefVersions.organizationId, context.organizationId),
          eq(briefVersions.projectId, projectId),
          eq(briefVersions.streamId, streamId),
          eq(briefVersions.id, versionId)
        )
      )
      .limit(1)
      .for("update");
    if (!versionRows[0])
      throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
    const mutatesWorkingVersion = [
      "reviseSection", "submitEvidence", "recordFinding",
      "submitFindingResolution", "acceptFindingResolution",
      "decideApplicability", "raiseCondition", "submitConditionResolution",
      "acceptConditionResolution", "markDependencyChanged", "acceptReview",
      "approveSection", "withdrawApproval", "issue",
    ].some(name => operation.endsWith(name));
    if (mutatesWorkingVersion) assertWorkingBriefVersion(versionRows[0].status);
    const sectionId = input.sectionId as BriefSectionId | undefined;
    let entityId: number | undefined;
    let eventType = operation
      .replace(/^brief\./, "")
      .replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
    if (operation.endsWith("reviseSection")) {
      await activeRole(tx, context, streamId, "author", sectionId).catch(() =>
        activeRole(tx, context, streamId, "section_owner", sectionId)
      );
      const fp = hashBriefRequest({
        content: input.content,
        origin: input.origin,
        dependencies: input.dependencies ?? [],
      });
      const inserted = await tx.insert(briefSectionRevisions).values({
        organizationId: context.organizationId,
        projectId,
        scopeKey: stream.scopeKey,
        sectionId: sectionId!,
        content: input.content,
        origin: input.origin,
        authorUserId: context.actorType === "ai" ? null : context.userId,
        actorType: context.actorType ?? "human",
        contentSchemaVersion: input.contentSchemaVersion,
        revisionFingerprint: fp,
        lineageFingerprint: hashBriefRequest(input.dependencies ?? []),
      });
      entityId = Number(inserted[0].insertId);
      const currentBinding = (
        await tx
          .select()
          .from(briefVersionSections)
          .where(
            and(
              eq(briefVersionSections.organizationId, context.organizationId),
              eq(briefVersionSections.projectId, projectId),
              eq(briefVersionSections.versionId, versionId),
              eq(briefVersionSections.sectionId, sectionId!)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!currentBinding)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const suppliedClassifications = Array.isArray(input.content?.requirements)
        ? input.content.requirements
        : currentBinding.classifications;
      await tx
        .update(briefVersionSections)
        .set({
          sectionRevisionId: entityId,
          achievedState: "drafted",
          classifications: suppliedClassifications,
          classificationFingerprint: hashBriefRequest(suppliedClassifications),
          revision: sql`${briefVersionSections.revision}+1`,
        })
        .where(
          and(
            eq(briefVersionSections.organizationId, context.organizationId),
            eq(briefVersionSections.projectId, projectId),
            eq(briefVersionSections.versionId, versionId),
            eq(briefVersionSections.sectionId, sectionId!)
          )
        );
      for (const dependency of input.dependencies ?? []) {
        const type = dependency.type;
        const recordVersion =
          dependency.recordVersion ??
          dependency.engineVersion ??
          dependency.modelVersion;
        const fingerprint =
          dependency.fingerprint ??
          dependency.resultFingerprint ??
          dependency.outputFingerprint;
        if (!recordVersion || !fingerprint)
          throw new BriefWorkflowError(
            "INVALID",
            "Dependencies require an exact version and fingerprint"
          );
        await tx.insert(briefDependencies).values({
          organizationId: context.organizationId,
          projectId,
          streamId,
          versionId,
          bindingId: currentBinding.id,
          sectionRevisionId: entityId,
          dependencyType: type,
          dependencyRef: dependency,
          authority: dependency.authority,
          recordVersion,
          fingerprint,
          observedAt: dependency.observedAt
            ? new Date(dependency.observedAt)
            : new Date(),
          relevance: dependency.relevance,
        });
      }
    } else if (
      operation.endsWith("submitEvidence") ||
      operation.endsWith("acceptReview") ||
      operation.endsWith("approveSection")
    ) {
      const role = operation.endsWith("submitEvidence")
        ? "section_owner"
        : operation.endsWith("acceptReview")
          ? "reviewer"
          : "approver";
      await activeRole(tx, context, streamId, role, sectionId);
      const binding = (
        await tx
          .select()
          .from(briefVersionSections)
          .where(
            and(
              eq(briefVersionSections.organizationId, context.organizationId),
              eq(briefVersionSections.versionId, versionId),
              eq(briefVersionSections.sectionId, sectionId!)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!binding?.sectionRevisionId)
        throw new BriefWorkflowError("INVALID", "Section has no revision");
      if (positive(input.revisionId, "revisionId") !== binding.sectionRevisionId)
        throw new BriefWorkflowError("CONFLICT", "Command targets a stale section revision");
      const revision = (
        await tx
          .select()
          .from(briefSectionRevisions)
          .where(eq(briefSectionRevisions.id, binding.sectionRevisionId))
          .limit(1)
      )[0];
      if (revision?.authorUserId === context.userId && role !== "section_owner")
        throw new BriefWorkflowError(
          "FORBIDDEN",
          "Authors cannot review or approve their revision"
        );
      const expected =
          role === "section_owner"
            ? "drafted"
            : role === "reviewer"
              ? "evidenced"
              : "reviewed",
        next =
          role === "section_owner"
            ? "evidenced"
            : role === "reviewer"
              ? "reviewed"
              : "approved";
      if (binding.achievedState !== expected)
        throw new BriefWorkflowError("INVALID", `Section must be ${expected}`);
      if (role === "reviewer") {
        const blocking = await tx.select({ id: briefFindings.id }).from(briefFindings).where(and(
          eq(briefFindings.organizationId, context.organizationId), eq(briefFindings.projectId, projectId),
          eq(briefFindings.streamId, streamId), eq(briefFindings.versionId, versionId),
          eq(briefFindings.bindingId, binding.id), eq(briefFindings.sectionRevisionId, binding.sectionRevisionId),
          eq(briefFindings.severity, "blocking")
        )).for("update");
        const resolutionRows = blocking.length ? await tx.select().from(briefFindingResolutions).where(and(
          eq(briefFindingResolutions.organizationId, context.organizationId), eq(briefFindingResolutions.projectId, projectId),
          eq(briefFindingResolutions.streamId, streamId), inArray(briefFindingResolutions.findingId, blocking.map((f: any) => f.id))
        )).for("update") : [];
        if (blocking.some((f: any) => !resolutionRows.some((r: any) => r.findingId === f.id && r.stage === "accepted")))
          throw new BriefWorkflowError("INVALID", "Blocking findings must be resolved before review acceptance");
      }
      if (role === "approver") {
        const conditionRows = await tx.select().from(briefConditionEvents).where(and(
          eq(briefConditionEvents.organizationId, context.organizationId), eq(briefConditionEvents.projectId, projectId),
          eq(briefConditionEvents.streamId, streamId), eq(briefConditionEvents.versionId, versionId),
          eq(briefConditionEvents.bindingId, binding.id)
        )).for("update");
        const active = conditionRows.filter((c: any) => c.stage === "raised" && !conditionRows.some((accepted: any) => accepted.stage === "resolution_accepted" && conditionRows.some((submitted: any) => submitted.id === accepted.targetEventId && submitted.stage === "resolution_submitted" && submitted.targetEventId === c.id)));
        if (active.length) throw new BriefWorkflowError("INVALID", "Active conditions must be resolved before approval");
      }
      if (role === "section_owner") {
        const dependencyIds = (input.dependencyIds ?? []).map((id: any) =>
          positive(id, "dependencyId")
        );
        if (!dependencyIds.length)
          throw new BriefWorkflowError(
            "INVALID",
            "Evidence requires at least one governed dependency"
          );
        const available = await tx
          .select({ id: briefDependencies.id })
          .from(briefDependencies)
          .where(
            and(
              eq(briefDependencies.organizationId, context.organizationId),
              eq(briefDependencies.projectId, projectId),
              eq(briefDependencies.bindingId, binding.id),
              eq(briefDependencies.sectionRevisionId, binding.sectionRevisionId)
            )
          );
        if (
          dependencyIds.some(
            (id: number) => !available.some((d: any) => d.id === id)
          )
        )
          throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      }
      if (role === "approver") {
        const a = await tx.insert(briefApprovals).values({
          organizationId: context.organizationId,
          projectId,
          streamId,
          versionId,
          bindingId: binding.id,
          sectionRevisionId: binding.sectionRevisionId,
          approverUserId: context.userId,
          decision: "approved",
          issuePurpose: stream.issuePurpose,
          rationale: input.rationale ?? "",
          limitations: input.limitations ?? [],
          streamSequence: Number(stream.nextEventSequence),
        });
        entityId = Number(a[0].insertId);
      }
      await tx
        .update(briefVersionSections)
        .set({
          achievedState: next as any,
          revision: sql`${briefVersionSections.revision}+1`,
        })
        .where(eq(briefVersionSections.id, binding.id));
    } else if (operation.endsWith("createVersion")) {
      await activeRole(tx, context, streamId, "author").catch(() =>
        activeRole(tx, context, streamId, "section_owner")
      );
      const predecessorId = positive(
        input.predecessorVersionId,
        "predecessorVersionId"
      );
      const predecessor = (
        await tx
          .select()
          .from(briefVersions)
          .where(
            and(
              eq(briefVersions.organizationId, context.organizationId),
              eq(briefVersions.streamId, streamId),
              eq(briefVersions.id, predecessorId)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!predecessor)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const latest = (
        await tx
          .select({ n: sql<number>`max(${briefVersions.versionNumber})` })
          .from(briefVersions)
          .where(
            and(
              eq(briefVersions.organizationId, context.organizationId),
              eq(briefVersions.streamId, streamId)
            )
          )
      )[0];
      const n = Number(latest?.n ?? 0) + 1;
      const ins = await tx.insert(briefVersions).values({
        organizationId: context.organizationId,
        projectId,
        streamId,
        versionNumber: n,
        predecessorVersionId: predecessorId,
        origin: "user",
        requirementProfileVersion: predecessor.requirementProfileVersion,
        componentScope: predecessor.componentScope,
        revision: 0,
        createdBy: context.userId,
      });
      entityId = Number(ins[0].insertId);
      const old = await tx
        .select()
        .from(briefVersionSections)
        .where(
          and(
            eq(briefVersionSections.organizationId, context.organizationId),
            eq(briefVersionSections.versionId, predecessorId)
          )
        )
        .orderBy(asc(briefVersionSections.id));
      const carry = new Set(input.carryForwardSections ?? []);
      await tx.insert(briefVersionSections).values(
        old.map((b: any) => ({
          organizationId: context.organizationId,
          projectId,
          streamId,
          versionId: entityId!,
          sectionRevisionId: carry.has(b.sectionId)
            ? b.sectionRevisionId
            : null,
          sectionId: b.sectionId,
          applicability: b.applicability,
          achievedState:
            carry.has(b.sectionId) && b.sectionRevisionId
              ? "drafted"
              : ("missing" as "drafted" | "missing"),
          classifications: b.classifications,
          classificationFingerprint: b.classificationFingerprint,
          componentScope: b.componentScope,
          revision: 0,
        }))
      );
      eventType = "version_created";
    } else if (
      operation.endsWith("assignRole") ||
      operation.endsWith("revokeRole")
    ) {
      await lockTenant(tx, context, projectId, true);
      const revoke = operation.endsWith("revokeRole");
      // Functional roles may only target a server-resolved organization user
      // membership. Caller-supplied principal-type claims are never trusted.
      const requestedSubject = input.userId ?? input.subjectUserId;
      const subject = revoke ? null : positive(requestedSubject, "subjectUserId");
      const targetGrant = revoke ? (await tx.select().from(briefRoleEvents).where(and(
        eq(briefRoleEvents.organizationId, context.organizationId), eq(briefRoleEvents.projectId, projectId),
        eq(briefRoleEvents.streamId, streamId), eq(briefRoleEvents.id, positive(input.grantEventId ?? input.targetGrantEventId, "grantEventId")),
        eq(briefRoleEvents.action, "granted")
      )).limit(1).for("update"))[0] : null;
      if (revoke && !targetGrant) throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const member = (
        await tx
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.orgId, context.organizationId),
              eq(organizationMembers.userId, revoke ? targetGrant!.subjectUserId : subject!)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!member)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const ins = await tx.insert(briefRoleEvents).values({
        organizationId: context.organizationId,
        projectId,
        streamId,
        versionId: input.assignmentVersionId
          ? positive(input.assignmentVersionId, "assignmentVersionId")
          : null,
        sectionId: revoke ? targetGrant!.sectionId : input.sectionId ?? null,
        subjectUserId: revoke ? targetGrant!.subjectUserId : subject!,
        role: revoke ? targetGrant!.role : input.role,
        action: revoke ? "revoked" : "granted",
        targetGrantEventId: revoke
          ? positive(
              input.grantEventId ?? input.targetGrantEventId,
              "grantEventId"
            )
          : null,
        actorUserId: context.userId,
        reason: input.reason ?? input.rationale ?? "",
        streamSequence: Number(stream.nextEventSequence),
      });
      entityId = Number(ins[0].insertId);
      eventType = revoke ? "role_revoked" : "role_assigned";
    } else if (operation.endsWith("recordFinding")) {
      await activeRole(tx, context, streamId, "reviewer", sectionId);
      const binding = (
        await tx
          .select()
          .from(briefVersionSections)
          .where(
            and(
              eq(briefVersionSections.organizationId, context.organizationId),
              eq(briefVersionSections.versionId, versionId),
              eq(briefVersionSections.sectionId, sectionId!)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!binding?.sectionRevisionId)
        throw new BriefWorkflowError(
          "INVALID",
          "Finding requires an exact section revision"
        );
      if (positive(input.revisionId, "revisionId") !== binding.sectionRevisionId)
        throw new BriefWorkflowError("CONFLICT", "Finding targets a stale section revision");
      const rev = (
        await tx
          .select()
          .from(briefSectionRevisions)
          .where(eq(briefSectionRevisions.id, binding.sectionRevisionId))
          .limit(1)
      )[0];
      if (rev?.authorUserId === context.userId)
        throw new BriefWorkflowError(
          "FORBIDDEN",
          "Authors cannot review their revision"
        );
      const ins = await tx.insert(briefFindings).values({
        organizationId: context.organizationId,
        projectId,
        streamId,
        versionId,
        bindingId: binding.id,
        sectionRevisionId: binding.sectionRevisionId,
        reviewerUserId: context.userId,
        severity: input.severity,
        ownerUserId: positive(input.ownerUserId, "ownerUserId"),
        statement: input.statement,
        streamSequence: Number(stream.nextEventSequence),
      });
      entityId = Number(ins[0].insertId);
      eventType = "finding_opened";
    } else if (
      operation.endsWith("submitFindingResolution") ||
      operation.endsWith("acceptFindingResolution")
    ) {
      const findingId = positive(input.findingId, "findingId");
      const finding = (
        await tx
          .select()
          .from(briefFindings)
          .where(
            and(
              eq(briefFindings.organizationId, context.organizationId),
              eq(briefFindings.projectId, projectId),
              eq(briefFindings.streamId, streamId),
              eq(briefFindings.versionId, versionId),
              eq(briefFindings.id, findingId)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!finding)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const accept = operation.endsWith("acceptFindingResolution");
      if (accept)
        await activeRole(tx, context, streamId, "reviewer", sectionId);
      else if (finding.ownerUserId !== context.userId)
        throw new BriefWorkflowError("FORBIDDEN", "Finding owner required");
      const target = accept
        ? positive(
            input.resolutionSubmissionEventId ??
              input.resolutionId ??
              input.targetSubmissionId,
            "resolutionSubmissionEventId"
          )
        : null;
      let resolutionRevisionId = finding.sectionRevisionId;
      if (!accept) {
        resolutionRevisionId = positive(input.resolutionRevisionId, "resolutionRevisionId");
        const resolutionRevision = (await tx.select({ id: briefSectionRevisions.id }).from(briefSectionRevisions).where(and(
          eq(briefSectionRevisions.organizationId, context.organizationId), eq(briefSectionRevisions.projectId, projectId),
          eq(briefSectionRevisions.id, resolutionRevisionId), eq(briefSectionRevisions.sectionId, sectionId ?? (await tx.select({ sectionId: briefVersionSections.sectionId }).from(briefVersionSections).where(eq(briefVersionSections.id, finding.bindingId)).limit(1))[0]?.sectionId)
        )).limit(1).for("update"))[0];
        if (!resolutionRevision) throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      }
      if (accept) {
        const submission = (
          await tx
            .select()
            .from(briefFindingResolutions)
            .where(
              and(
                eq(
                  briefFindingResolutions.organizationId,
                  context.organizationId
                ),
                eq(briefFindingResolutions.projectId, projectId),
                eq(briefFindingResolutions.streamId, streamId),
                eq(briefFindingResolutions.id, target!)
              )
            )
            .limit(1)
            .for("update")
        )[0];
        if (!submission || submission.findingId !== findingId)
          throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
        if (submission.submitterUserId === context.userId)
          throw new BriefWorkflowError(
            "FORBIDDEN",
            "Reviewers cannot accept their own resolution"
          );
        resolutionRevisionId = submission.sectionRevisionId;
      }
      const ins = await tx.insert(briefFindingResolutions).values({
        organizationId: context.organizationId,
        projectId,
        streamId,
        findingId,
        sectionRevisionId: resolutionRevisionId,
        stage: accept
          ? decisionStage(input.outcome)
          : "submitted",
        submitterUserId: accept
          ? positive(
              input.submitterUserId ?? finding.ownerUserId,
              "submitterUserId"
            )
          : context.userId,
        actorUserId: context.userId,
        targetSubmissionId: target,
        evidence: input.evidence ?? {},
        streamSequence: Number(stream.nextEventSequence),
      });
      entityId = Number(ins[0].insertId);
      eventType = accept
        ? "finding_resolution_accepted"
        : "finding_resolution_submitted";
    } else if (operation.endsWith("decideApplicability")) {
      const rawAction = input.action ?? input.stage ?? input.decision;
      const stage = normalizeApplicabilityStage(rawAction);
      if (!stage) throw new BriefWorkflowError("INVALID", "Invalid applicability action");
      const role =
        stage === "reviewed"
          ? "reviewer"
          : stage === "approved" || stage === "withdrawn"
            ? "approver"
            : "section_owner";
      await activeRole(tx, context, streamId, role, sectionId);
      const binding = (
        await tx
          .select()
          .from(briefVersionSections)
          .where(
            and(
              eq(briefVersionSections.organizationId, context.organizationId),
              eq(briefVersionSections.versionId, versionId),
              eq(briefVersionSections.sectionId, sectionId!)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!binding)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const target =
        (input.proposalEventId ?? input.targetEventId)
          ? positive(
              input.proposalEventId ?? input.targetEventId,
              "proposalEventId"
            )
          : null;
      if (stage !== "proposed" && !target)
        throw new BriefWorkflowError(
          "INVALID",
          "Review and approval require a target event"
        );
      const prior = target
        ? (
            await tx
              .select()
              .from(briefApplicabilityEvents)
              .where(
                and(
                  eq(
                    briefApplicabilityEvents.organizationId,
                    context.organizationId
                  ),
                  eq(briefApplicabilityEvents.projectId, projectId),
                  eq(briefApplicabilityEvents.streamId, streamId),
                  eq(briefApplicabilityEvents.versionId, versionId),
                  eq(briefApplicabilityEvents.bindingId, binding.id),
                  eq(briefApplicabilityEvents.classificationFingerprint, binding.classificationFingerprint),
                  eq(briefApplicabilityEvents.id, target!)
                )
              )
              .limit(1)
              .for("update")
          )[0]
        : null;
      if (
        stage !== "proposed" &&
        (!prior || prior.actorUserId === context.userId)
      )
        throw new BriefWorkflowError(
          "FORBIDDEN",
          "Applicability stages require independent actors"
        );
      if (stage === "reviewed" && prior?.stage !== "proposed")
        throw new BriefWorkflowError("INVALID", "Applicability review must target the proposal");
      if (stage === "withdrawn" && prior?.stage !== "approved")
        throw new BriefWorkflowError("INVALID", "Applicability withdrawal must target the approval");
      if (stage === "approved") {
        if (prior?.stage !== "reviewed")
          throw new BriefWorkflowError("INVALID", "Applicability approval must target the review");
        if (!prior.targetEventId) throw new BriefWorkflowError("INVALID", "Applicability review lacks its proposal target");
        const proposal = (await tx.select().from(briefApplicabilityEvents).where(and(
          eq(briefApplicabilityEvents.organizationId, context.organizationId), eq(briefApplicabilityEvents.projectId, projectId),
          eq(briefApplicabilityEvents.streamId, streamId), eq(briefApplicabilityEvents.versionId, versionId),
          eq(briefApplicabilityEvents.bindingId, binding.id), eq(briefApplicabilityEvents.id, prior.targetEventId)
        )).limit(1).for("update"))[0];
        if (!proposal || proposal.stage !== "proposed" || proposal.actorUserId === context.userId || proposal.actorUserId === prior.actorUserId)
          throw new BriefWorkflowError("FORBIDDEN", "Applicability requires three independent actors");
      }
      const ins = await tx.insert(briefApplicabilityEvents).values({
        organizationId: context.organizationId,
        projectId,
        streamId,
        versionId,
        bindingId: binding.id,
        classificationFingerprint: binding.classificationFingerprint,
        stage,
        targetEventId: target,
        actorUserId: context.userId,
        rationale: input.rationale,
        inputs: input.evidence ?? input.inputs ?? {},
        streamSequence: Number(stream.nextEventSequence),
      });
      entityId = Number(ins[0].insertId);
      if (stage === "approved")
        await tx
          .update(briefVersionSections)
          .set({ applicability: "not_applicable" })
          .where(eq(briefVersionSections.id, binding.id));
      if (stage === "withdrawn")
        await tx.update(briefVersionSections).set({
          applicability: "conditional",
          achievedState: binding.sectionRevisionId ? "drafted" : "missing",
          revision: sql`${briefVersionSections.revision}+1`,
        }).where(eq(briefVersionSections.id, binding.id));
      eventType = `applicability_${stage}`;
    } else if (
      operation.endsWith("raiseCondition") ||
      operation.endsWith("submitConditionResolution") ||
      operation.endsWith("acceptConditionResolution") ||
      operation.endsWith("markDependencyChanged")
    ) {
      const resolving =
        !operation.endsWith("raiseCondition") &&
        !operation.endsWith("markDependencyChanged");
      const accepting = operation.endsWith("acceptConditionResolution");
      if (operation.endsWith("markDependencyChanged")) {
        if (context.actorType !== "system" || !input.sourceAuthority)
          throw new BriefWorkflowError("FORBIDDEN", "Typed system source authority required");
      } else if (operation.endsWith("raiseCondition")) {
        await activeRole(tx, context, streamId, "section_owner", sectionId)
          .catch(() => activeRole(tx, context, streamId, "reviewer", sectionId))
          .catch(() => activeRole(tx, context, streamId, "approver", sectionId));
      }
      const conditionId = resolving ? positive(input.conditionId, "conditionId") : null;
      const submissionId = accepting ? positive(input.resolutionSubmissionEventId, "resolutionSubmissionEventId") : null;
      const target = accepting ? submissionId : conditionId;
      let original: any = null;
      if (conditionId)
        original = (
          await tx
            .select()
            .from(briefConditionEvents)
            .where(
              and(
                eq(briefConditionEvents.organizationId, context.organizationId),
                eq(briefConditionEvents.projectId, projectId),
                eq(briefConditionEvents.streamId, streamId),
                eq(briefConditionEvents.versionId, versionId),
                eq(briefConditionEvents.id, conditionId)
              )
            )
            .limit(1)
            .for("update")
        )[0];
      if (resolving && !original)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      if (resolving && original.stage !== "raised")
        throw new BriefWorkflowError("INVALID", "Condition resolution must target a raised condition");
      if (accepting) {
        const submission = (await tx.select().from(briefConditionEvents).where(and(
          eq(briefConditionEvents.organizationId, context.organizationId), eq(briefConditionEvents.projectId, projectId),
          eq(briefConditionEvents.streamId, streamId), eq(briefConditionEvents.versionId, versionId),
          eq(briefConditionEvents.bindingId, original.bindingId), eq(briefConditionEvents.id, submissionId!)
        )).limit(1).for("update"))[0];
        if (!submission || submission.stage !== "resolution_submitted" || submission.targetEventId !== original.id)
          throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
        await activeRole(
          tx,
          context,
          streamId,
          original.gate === "approval_issue" ? "approver" : "reviewer",
          sectionId
        );
        if (
          submission.actorUserId === context.userId || original.ownerUserId === context.userId
        )
          throw new BriefWorkflowError(
            "FORBIDDEN",
            "Condition acceptance must be independent"
          );
      } else if (resolving && original.ownerUserId !== context.userId)
        throw new BriefWorkflowError("FORBIDDEN", "Condition owner required");
      const bindingId =
        original?.bindingId ??
        Number(
          (
            await tx
              .select({ id: briefVersionSections.id })
              .from(briefVersionSections)
              .where(
                and(
                  eq(
                    briefVersionSections.organizationId,
                    context.organizationId
                  ),
                  eq(briefVersionSections.versionId, versionId),
                  eq(briefVersionSections.sectionId, sectionId!)
                )
              )
              .limit(1)
              .for("update")
          )[0]?.id
        );
      if (!bindingId)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const ins = await tx.insert(briefConditionEvents).values({
        organizationId: context.organizationId,
        projectId,
        streamId,
        versionId,
        bindingId,
        kind: original?.kind ?? input.kind ?? "stale",
        gate: original?.gate ?? input.gate ?? "evidence_content",
        stage: accepting
          ? decisionStage(input.outcome) === "rejected"
            ? "resolution_rejected"
            : "resolution_accepted"
          : resolving
            ? "resolution_submitted"
            : "raised",
        reasonCode:
          original?.reasonCode ?? input.reasonCode ?? "dependency_changed",
        explanation: input.explanation ?? input.reason ?? "",
        targetEventId: target,
        dependencyId: input.dependencyId ?? original?.dependencyId ?? null,
        ownerUserId:
          original?.ownerUserId ?? positive(input.ownerUserId, "ownerUserId"),
        actorUserId: context.userId,
        evidence: input.evidence ?? {},
        streamSequence: Number(stream.nextEventSequence),
      });
      entityId = Number(ins[0].insertId);
      eventType = accepting
        ? "condition_resolution_accepted"
        : resolving
          ? "condition_resolution_submitted"
          : "condition_raised";
    } else if (operation.endsWith("withdrawApproval")) {
      await activeRole(tx, context, streamId, "approver", sectionId);
      const approvalId = positive(
        input.approvalEventId ?? input.approvalId,
        "approvalEventId"
      );
      const approval = (
        await tx
          .select()
          .from(briefApprovals)
          .where(
            and(
              eq(briefApprovals.organizationId, context.organizationId),
              eq(briefApprovals.streamId, streamId),
              eq(briefApprovals.id, approvalId)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!approval)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      const priorWithdrawal = (await tx.select({ id: briefApprovals.id }).from(briefApprovals).where(and(
        eq(briefApprovals.organizationId, context.organizationId), eq(briefApprovals.projectId, projectId),
        eq(briefApprovals.streamId, streamId), eq(briefApprovals.versionId, versionId),
        eq(briefApprovals.targetApprovalId, approvalId), eq(briefApprovals.decision, "withdrawn")
      )).limit(1).for("update"))[0];
      if (approval.decision !== "approved" || priorWithdrawal)
        throw new BriefWorkflowError("CONFLICT", "Approval is already withdrawn");
      const ins = await tx.insert(briefApprovals).values({
        ...approval,
        id: undefined,
        decision: "withdrawn",
        targetApprovalId: approvalId,
        approverUserId: context.userId,
        rationale: input.rationale ?? "",
        limitations: input.limitations ?? [],
        streamSequence: Number(stream.nextEventSequence),
      });
      entityId = Number(ins[0].insertId);
      await tx
        .update(briefVersionSections)
        .set({ achievedState: "reviewed" })
        .where(eq(briefVersionSections.id, approval.bindingId));
      eventType = "approval_withdrawn";
    } else if (operation.endsWith("issue")) {
      await activeRole(tx, context, streamId, "issuer");
      await activeRole(tx, context, streamId, "approver");
      const bindings = await tx
        .select()
        .from(briefVersionSections)
        .where(
          and(
            eq(briefVersionSections.organizationId, context.organizationId),
            eq(briefVersionSections.streamId, streamId),
            eq(briefVersionSections.versionId, versionId)
          )
        )
        .orderBy(asc(briefVersionSections.id))
        .for("update");
      if (
        bindings.length !== 10 ||
        new Set(bindings.map((b: any) => b.sectionId)).size !== 10
      )
        throw new BriefWorkflowError(
          "INVALID",
          "Issue requires exactly ten unique sections"
        );
      if (bindings.some((b: any) => b.achievedState !== "approved"))
        throw new BriefWorkflowError(
          "INVALID",
          "Every section must be approved before issue"
        );
      for (const binding of bindings) {
        const revision = (await tx.select().from(briefSectionRevisions).where(and(
          eq(briefSectionRevisions.organizationId, context.organizationId), eq(briefSectionRevisions.projectId, projectId),
          eq(briefSectionRevisions.id, binding.sectionRevisionId!)
        )).limit(1).for("update"))[0];
        const approvalRows = await tx.select().from(briefApprovals).where(and(
          eq(briefApprovals.organizationId, context.organizationId), eq(briefApprovals.projectId, projectId),
          eq(briefApprovals.streamId, streamId), eq(briefApprovals.versionId, versionId),
          eq(briefApprovals.bindingId, binding.id), eq(briefApprovals.sectionRevisionId, binding.sectionRevisionId!)
        )).for("update");
        const activeApprovals = approvalRows.filter((a: any) => a.decision === "approved" && !approvalRows.some((w: any) => w.decision === "withdrawn" && w.targetApprovalId === a.id));
        if (!revision || !activeApprovals.length || (revision.authorUserId === context.userId && !activeApprovals.some((a: any) => a.approverUserId !== context.userId)))
          throw new BriefWorkflowError("INVALID", "Each exact revision requires an independent active approval");
      }
      const issueMetadata = {
        documentIdentity: true,
        disclaimerVersion: Boolean(input.disclaimerVersion),
        confidentiality: Boolean(input.confidentiality),
        distributionPolicyVersion: Boolean(input.distributionPolicyVersion),
        reproducibilityIdentity: true,
      };
      const readiness = evaluateBriefReadiness(
        (await getBriefReadinessFacts(
          { ...input, issuerUserId: context.userId, issueMetadata },
          context,
          tx,
          stream,
          versionRows[0]
        )) as any
      );
      if (!readiness.canIssue)
        throw new BriefWorkflowError(
          "INVALID",
          `Brief is not ready to issue: ${readiness.reasons.map(reason => reason.code).join(", ")}`
        );
      const conditions = await tx
        .select()
        .from(briefConditionEvents)
        .where(
          and(
            eq(briefConditionEvents.organizationId, context.organizationId),
            eq(briefConditionEvents.streamId, streamId),
            eq(briefConditionEvents.versionId, versionId)
          )
        )
        .orderBy(asc(briefConditionEvents.id));
      const active = conditions.filter(
        (c: any) =>
          c.stage === "raised" &&
          !conditions.some(
            (r: any) => r.stage === "resolution_accepted" && conditions.some((submitted: any) => submitted.id === r.targetEventId && submitted.stage === "resolution_submitted" && submitted.targetEventId === c.id)
          )
      );
      if (active.length)
        throw new BriefWorkflowError(
          "INVALID",
          "Active stale or blocked conditions prevent issue"
        );
      const maxIssue = (
        await tx
          .select({ n: sql<number>`max(${briefIssues.issueNumber})` })
          .from(briefIssues)
          .where(
            and(
              eq(briefIssues.organizationId, context.organizationId),
              eq(briefIssues.streamId, streamId)
            )
          )
      )[0];
      const issueNumber = Number(maxIssue?.n ?? 0) + 1;
      const ins = await tx.insert(briefIssues).values({
        organizationId: context.organizationId,
        projectId,
        streamId,
        versionId,
        operationId,
        issueNumber,
        issuerUserId: context.userId,
        issuePurpose: stream.issuePurpose,
        metadata: input.metadata ?? {
          documentIdentity: `brief:${streamId}:version:${versionId}:issue:${issueNumber}`,
          disclaimerVersion: input.disclaimerVersion,
          confidentiality: input.confidentiality,
          distributionPolicyVersion: input.distributionPolicyVersion,
          expiresAt: input.expiresAt ?? null,
          reproducibilityIdentity: hashBriefRequest(
            bindings.map((binding: any) => ({
              sectionId: binding.sectionId,
              sectionRevisionId: binding.sectionRevisionId,
              classificationFingerprint: binding.classificationFingerprint,
              applicability: binding.applicability,
            }))
          ),
        },
      });
      entityId = Number(ins[0].insertId);
      for (const b of bindings) {
        const is = await tx.insert(briefIssueSections).values({
          organizationId: context.organizationId,
          projectId,
          streamId,
          issueId: entityId,
          bindingId: b.id,
          sectionRevisionId: b.sectionRevisionId!,
          sectionId: b.sectionId,
          applicability: b.applicability,
          achievedState: "issued",
          requirementProfileVersion: versionRows[0].requirementProfileVersion,
          classificationFingerprint: b.classificationFingerprint,
          componentScope: b.componentScope,
        });
        const issueSectionId = Number(is[0].insertId);
        const approvals = await tx
          .select()
          .from(briefApprovals)
          .where(
            and(
                eq(briefApprovals.organizationId, context.organizationId),
                eq(briefApprovals.projectId, projectId),
                eq(briefApprovals.streamId, streamId),
                eq(briefApprovals.versionId, versionId),
                eq(briefApprovals.bindingId, b.id),
                eq(briefApprovals.sectionRevisionId, b.sectionRevisionId!)
              )
            );
        for (const a of approvals.filter((a: any) => a.decision === "approved" && !approvals.some((w: any) => w.decision === "withdrawn" && w.targetApprovalId === a.id)))
          await tx.insert(briefIssueApprovals).values({
            organizationId: context.organizationId,
            projectId,
            streamId,
            issueId: entityId,
            issueSectionId,
            approvalId: a.id,
          });
        const deps = await tx
          .select()
          .from(briefDependencies)
          .where(
            and(
              eq(briefDependencies.organizationId, context.organizationId),
              eq(briefDependencies.bindingId, b.id)
            )
          );
        for (const d of deps)
          await tx.insert(briefIssueDependencies).values({
            organizationId: context.organizationId,
            projectId,
            streamId,
            issueId: entityId,
            issueSectionId,
            dependencyId: d.id,
            recordVersion: d.recordVersion,
            fingerprint: d.fingerprint,
          });
        if (b.applicability === "not_applicable") {
          const apps = await tx
            .select()
            .from(briefApplicabilityEvents)
            .where(
              and(
                eq(
                  briefApplicabilityEvents.organizationId,
                  context.organizationId
                ),
                eq(briefApplicabilityEvents.bindingId, b.id),
                eq(briefApplicabilityEvents.stage, "approved")
              )
            )
            .orderBy(desc(briefApplicabilityEvents.id))
            .limit(1);
          if (!apps[0])
            throw new BriefWorkflowError(
              "INVALID",
              "N/A section lacks approved applicability"
            );
          await tx.insert(briefIssueApplicability).values({
            organizationId: context.organizationId,
            projectId,
            streamId,
            issueId: entityId,
            issueSectionId,
            applicabilityEventId: apps[0].id,
          });
        }
      }
      await tx
        .update(briefVersions)
        .set({ status: "locked" })
        .where(eq(briefVersions.id, versionId));
      await tx
        .update(briefVersionSections)
        .set({ achievedState: "issued" })
        .where(
          and(
            eq(briefVersionSections.organizationId, context.organizationId),
            eq(briefVersionSections.versionId, versionId)
          )
        );
      eventType = "issue_created";
    } else if (
      operation.endsWith("supersedeIssue") ||
      operation.endsWith("requestIssueWithdrawal") ||
      operation.endsWith("approveIssueWithdrawal")
    ) {
      const issueId = positive(
        operation.endsWith("supersedeIssue")
          ? input.priorIssueId
          : input.issueId,
        operation.endsWith("supersedeIssue") ? "priorIssueId" : "issueId"
      );
      const issue = (
        await tx
          .select()
          .from(briefIssues)
          .where(
            and(
              eq(briefIssues.organizationId, context.organizationId),
              eq(briefIssues.streamId, streamId),
              eq(briefIssues.id, issueId)
            )
          )
          .limit(1)
          .for("update")
      )[0];
      if (!issue)
        throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
      if (operation.endsWith("supersedeIssue")) {
        const successorId = positive(
          input.successorIssueId,
          "successorIssueId"
        );
        const successor = (
          await tx
            .select()
            .from(briefIssues)
            .where(
              and(
                eq(briefIssues.organizationId, context.organizationId),
                eq(briefIssues.projectId, projectId),
                eq(briefIssues.streamId, streamId),
                eq(briefIssues.id, successorId)
              )
            )
            .limit(1)
            .for("update")
        )[0];
        if (!successor || successor.issueNumber <= issue.issueNumber)
          throw new BriefWorkflowError(
            "INVALID",
            "Successor issue must be a later issue in the same stream"
          );
      }
      if (operation.endsWith("approveIssueWithdrawal")) {
        await activeRole(tx, context, streamId, "approver");
        const requestEvent = (await tx.select().from(briefEvents).where(and(
          eq(briefEvents.organizationId, context.organizationId), eq(briefEvents.projectId, projectId),
          eq(briefEvents.streamId, streamId), eq(briefEvents.id, positive(input.withdrawalRequestEventId, "withdrawalRequestEventId")),
          eq(briefEvents.eventType, "issue_withdrawal_requested"), eq(briefEvents.issueId, issueId)
        )).limit(1).for("update"))[0];
        if (!requestEvent) throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
        if (requestEvent.actorUserId === context.userId)
          throw new BriefWorkflowError(
            "FORBIDDEN",
            "Withdrawal approval must be independent"
          );
        eventType = "issue_withdrawal_approved";
      } else {
        await activeRole(tx, context, streamId, "issuer");
        eventType = operation.endsWith("supersedeIssue")
          ? "issue_superseded"
          : "issue_withdrawal_requested";
      }
      entityId = issueId;
    } else
      throw new BriefWorkflowError(
        "INVALID",
        `Unsupported command: ${operation}`
      );
    const nextRevision = stream.revision + 1;
    const revisionUpdate = await tx
      .update(briefStreams)
      .set({ revision: nextRevision })
      .where(
        and(
          eq(briefStreams.id, streamId),
          eq(briefStreams.revision, stream.revision)
        )
      );
    if (Number(revisionUpdate[0]?.affectedRows) !== 1)
      throw new BriefWorkflowError("CONFLICT", "Stale stream revision");
    await allocateEvents(tx, stream, operationId, context, versionId, [
      { type: eventType, sectionId, issueId:eventType.startsWith("issue_")?entityId:undefined, payload: { entityId, priorIssueId:input.priorIssueId, successorIssueId:input.successorIssueId, withdrawalRequestEventId:input.withdrawalRequestEventId, reason:input.reason, distributionImpact:input.distributionImpact } },
    ]);
    const result = {
      operationId: String(operationId),
      revision: nextRevision,
      value: { id: entityId ? String(entityId) : undefined },
    };
    await tx
      .update(briefOperations)
      .set({
        status: "completed",
        resultEntityType: eventType,
        resultEntityId: entityId,
        resultRevision: nextRevision,
        result,
        completedAt: new Date(),
      })
      .where(eq(briefOperations.id, operationId));
    return result;
  });
}

async function scopedStream(input: any, context: BriefWorkflowContext) {
  const db = await database(),
    projectId = positive(input.projectId, "projectId"),
    streamId = positive(input.briefId ?? input.streamId, "briefId");
  const rows = await db
    .select()
    .from(briefStreams)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.orgId, context.organizationId),
        eq(organizationMembers.userId, context.userId)
      )
    )
    .where(
      and(
        eq(briefStreams.organizationId, context.organizationId),
        eq(briefStreams.projectId, projectId),
        eq(briefStreams.id, streamId)
      )
    )
    .limit(1);
  if (!rows[0])
    throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
  return { db, stream: rows[0].brief_streams };
}
export async function getBriefSummary(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return briefSummaryDto(db, stream);
}
async function briefSummaryDto(db: any, stream: any) {
  const current = (
    await db
      .select({ id: briefVersions.id })
      .from(briefVersions)
      .where(
        and(
          eq(briefVersions.organizationId, stream.organizationId),
          eq(briefVersions.projectId, stream.projectId),
          eq(briefVersions.streamId, stream.id)
        )
      )
      .orderBy(desc(briefVersions.versionNumber))
      .limit(1)
  )[0];
  const issue = (
    await db
      .select({ id: briefIssues.id })
      .from(briefIssues)
      .where(
        and(
          eq(briefIssues.organizationId, stream.organizationId),
          eq(briefIssues.projectId, stream.projectId),
          eq(briefIssues.streamId, stream.id)
        )
      )
      .orderBy(desc(briefIssues.issueNumber))
      .limit(1)
  )[0];
  return {
    briefId: String(stream.id),
    projectId: stream.projectId,
    scope:
      stream.scopeType === "scenario"
        ? { type: "scenario", scenarioId: stream.scenarioId }
        : { type: "project" },
    purpose: stream.issuePurpose,
    typologyProfileVersion: stream.typologyProfileVersion,
    currentVersionId: current ? String(current.id) : null,
    latestIssueId: issue ? String(issue.id) : null,
    revision: stream.revision,
  };
}
export async function listBriefStreams(
  input: any,
  context: BriefWorkflowContext
) {
  const db = await database();
  const streams = await db
    .select()
    .from(briefStreams)
    .where(
      and(
        eq(briefStreams.organizationId, context.organizationId),
        eq(briefStreams.projectId, positive(input.projectId, "projectId"))
      )
    )
    .orderBy(desc(briefStreams.id));
  const membership = (
    await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.orgId, context.organizationId),
          eq(organizationMembers.userId, context.userId)
        )
      )
      .limit(1)
  )[0];
  if (!membership)
    throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
  return Promise.all(streams.map(stream => briefSummaryDto(db, stream)));
}
export async function getBriefVersion(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  const version =
    (
      await db
        .select()
        .from(briefVersions)
        .where(
          and(
            eq(briefVersions.organizationId, context.organizationId),
            eq(briefVersions.streamId, stream.id),
            eq(briefVersions.id, positive(input.versionId, "versionId"))
          )
        )
        .limit(1)
    )[0] ?? null;
  if (!version) return null;
  const sections = await db
    .select()
    .from(briefVersionSections)
    .where(
      and(
        eq(briefVersionSections.organizationId, context.organizationId),
        eq(briefVersionSections.versionId, version.id)
      )
    )
    .orderBy(asc(briefVersionSections.id));
  return {
    ...version,
    id: String(version.id),
    briefId: String(stream.id),
    sections: sections.map(section => ({
      ...section,
      id: String(section.id),
      revisionId: section.sectionRevisionId
        ? String(section.sectionRevisionId)
        : null,
    })),
  };
}
export async function listBriefVersions(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return db
    .select()
    .from(briefVersions)
    .where(
      and(
        eq(briefVersions.organizationId, context.organizationId),
        eq(briefVersions.streamId, stream.id)
      )
    )
    .orderBy(desc(briefVersions.versionNumber));
}
export async function getBriefSection(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  const binding = (
    await db
        .select()
        .from(briefVersionSections)
        .where(
          and(
            eq(briefVersionSections.organizationId, context.organizationId),
            eq(briefVersionSections.streamId, stream.id),
            eq(
              briefVersionSections.versionId,
              positive(input.versionId, "versionId")
            ),
            eq(briefVersionSections.sectionId, input.sectionId)
          )
        )
        .limit(1)
  )[0] ?? null;
  if (!binding) return null;
  const section = {
    ...binding,
    id: String(binding.id),
    briefId: String(stream.id),
    versionId: String(binding.versionId),
    revisionId: binding.sectionRevisionId
      ? String(binding.sectionRevisionId)
      : null,
  };
  if (!binding.sectionRevisionId) return { ...section, content: null };
  const revision = (
    await db
      .select()
      .from(briefSectionRevisions)
      .where(
        and(
          eq(briefSectionRevisions.organizationId, context.organizationId),
          eq(briefSectionRevisions.projectId, stream.projectId),
          eq(briefSectionRevisions.id, binding.sectionRevisionId)
        )
      )
      .limit(1)
  )[0];
  if (!revision) return { ...section, content: null };
  return {
    ...section,
    contentSchemaVersion: revision.contentSchemaVersion,
    contentState: readBriefSectionContent(
      binding.sectionId,
      revision.contentSchemaVersion,
      revision.content
    ),
    content: revision.content,
    origin: revision.origin,
    authorUserId: revision.authorUserId,
    revisionFingerprint: revision.revisionFingerprint,
    createdAt: revision.createdAt,
  };
}
export async function listBriefAssignments(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return db
    .select()
    .from(briefRoleEvents)
    .where(
      and(
        eq(briefRoleEvents.organizationId, context.organizationId),
        eq(briefRoleEvents.streamId, stream.id)
      )
    )
    .orderBy(asc(briefRoleEvents.id));
}
export async function listBriefFindings(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return db
    .select()
    .from(briefFindings)
    .where(
      and(
        eq(briefFindings.organizationId, context.organizationId),
        eq(briefFindings.streamId, stream.id)
      )
    )
    .orderBy(asc(briefFindings.id));
}
export async function listBriefFindingResolutions(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return db
    .select()
    .from(briefFindingResolutions)
    .where(
      and(
        eq(briefFindingResolutions.organizationId, context.organizationId),
        eq(briefFindingResolutions.streamId, stream.id)
      )
    )
    .orderBy(asc(briefFindingResolutions.id));
}
export async function listBriefDependencies(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return db
    .select()
    .from(briefDependencies)
    .where(
      and(
        eq(briefDependencies.organizationId, context.organizationId),
        eq(briefDependencies.streamId, stream.id)
      )
    )
    .orderBy(asc(briefDependencies.id));
}
export async function listBriefConditions(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return db
    .select()
    .from(briefConditionEvents)
    .where(
      and(
        eq(briefConditionEvents.organizationId, context.organizationId),
        eq(briefConditionEvents.streamId, stream.id),
        eq(briefConditionEvents.versionId, positive(input.versionId, "versionId"))
      )
    )
    .orderBy(asc(briefConditionEvents.streamSequence));
}

export function derivePermittedBriefActions(input: {
  userId: number;
  sectionId: BriefSectionId;
  achievedState: string;
  authorUserId?: number | null;
  hasOpenFindings?: boolean;
  hasOpenConditions?: boolean;
  activeAssignments: Array<{ subjectUserId: number; role: string; sectionId?: string | null }>;
}) {
  const hasRole = (role: string) => input.activeAssignments.some(assignment =>
    assignment.subjectUserId === input.userId &&
    assignment.role === role &&
    (assignment.sectionId == null || assignment.sectionId === input.sectionId)
  );
  const actions: BriefStudioAction[] = [];
  if (hasRole("author") || hasRole("section_owner")) {
    actions.push("revise", "propose_not_applicable");
  }
  if (hasRole("section_owner")) {
    actions.push("record_finding", "raise_condition");
    if (input.achievedState === "drafted") actions.push("submit_evidence");
  }
  if (hasRole("reviewer") && input.authorUserId !== input.userId) {
    actions.push("record_finding", "review_not_applicable");
    if (input.achievedState === "evidenced") actions.push("accept_review");
  }
  if (hasRole("approver") && input.authorUserId !== input.userId) {
    actions.push("approve_not_applicable");
    if (input.achievedState === "reviewed") actions.push("approve_section");
  }
  if (hasRole("author") || hasRole("section_owner")) {
    if (input.hasOpenFindings) actions.push("submit_finding_resolution");
    if (input.hasOpenConditions) actions.push("submit_condition_resolution");
  }
  return Array.from(new Set(actions));
}

export async function getBriefStudio(
  input: any,
  context: BriefWorkflowContext
) {
  const [summary, version, readinessFacts, assignments, findings, findingResolutions, dependencies, conditions, events, issues] = await Promise.all([
    getBriefSummary(input, context),
    getBriefVersion(input, context),
    getBriefReadinessFacts({ ...input, issuerUserId: context.userId }, context),
    listBriefAssignments(input, context),
    listBriefFindings(input, context),
    listBriefFindingResolutions(input, context),
    listBriefDependencies(input, context),
    listBriefConditions(input, context),
    listBriefEvents(input, context),
    listBriefIssues(input, context),
  ]);
  if (!version) throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
  const activeAssignments = assignments.filter((assignment: any) =>
    assignment.action === "granted" &&
    !assignments.some((later: any) => later.action === "revoked" && later.targetGrantEventId === assignment.id)
  );
  const db = await database();
  const memberChoices = await db
    .select({ id: users.id, name: users.name, organizationRole: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.orgId, context.organizationId))
    .orderBy(asc(users.id));
  const readiness = evaluateBriefReadiness(readinessFacts as any);
  const sections = await Promise.all(BRIEF_SECTION_IDS.map(sectionId =>
    getBriefSection({ ...input, sectionId }, context)
  ));
  const studioSections = sections.filter(Boolean).map((section: any) => {
    const sectionReadiness = readiness.sections.find(item => item.sectionId === section.sectionId);
    const sectionAssignments = activeAssignments.filter((assignment: any) =>
      assignment.sectionId == null || assignment.sectionId === section.sectionId
    );
    const sectionDependencies = dependencies.filter((dependency: any) =>
      dependency.versionId === Number(input.versionId) && dependency.bindingId === Number(section.id)
    );
    const sectionFindings = findings.filter((finding: any) =>
      finding.versionId === Number(input.versionId) && finding.bindingId === Number(section.id)
    );
    const sectionConditions = conditions.filter((condition: any) => condition.bindingId === Number(section.id));
    const hasOpenFindings = sectionFindings.some((finding: any) =>
      !findingResolutions.some((resolution: any) =>
        resolution.findingId === finding.id && resolution.stage === "accepted"
      )
    );
    const hasOpenConditions = sectionConditions.some((condition: any) =>
      condition.stage === "raised" && !sectionConditions.some((accepted: any) =>
        accepted.stage === "resolution_accepted" && (
          accepted.targetEventId === condition.id || sectionConditions.some((submitted: any) =>
            submitted.id === accepted.targetEventId && submitted.targetEventId === condition.id
          )
        )
      )
    );
    const assumptions = section.contentState?.kind === "structured"
      ? section.contentState.content.assumptions
      : [];
    return {
      ...section,
      readiness: sectionReadiness,
      owner: sectionAssignments.find((assignment: any) => assignment.role === "section_owner") ?? null,
      assignments: sectionAssignments,
      assumptions,
      evidence: sectionDependencies.filter((dependency: any) => dependency.dependencyType === "evidence"),
      dependencies: sectionDependencies,
      findings: sectionFindings,
      conditions: sectionConditions,
      applicabilityChoices: events
        .filter((event: any) => event.versionId === Number(input.versionId) && event.sectionId === section.sectionId && (event.eventType === "applicability_proposed" || event.eventType === "applicability_reviewed"))
        .map((event: any) => ({
          id: Number((event.payload as any)?.entityId),
          stage: event.eventType === "applicability_proposed" ? "proposed" : "reviewed",
          actorUserId: event.actorUserId,
          createdAt: event.createdAt,
        }))
        .filter((choice: any) => Number.isSafeInteger(choice.id)),
      permittedActions: derivePermittedBriefActions({
        userId: context.userId,
        sectionId: section.sectionId,
        achievedState: section.achievedState,
        authorUserId: section.authorUserId,
        hasOpenFindings,
        hasOpenConditions,
        activeAssignments,
      }),
      nextAction: sectionReadiness?.nextActions?.[0] ?? null,
    };
  });
  const currentUserRoles = activeAssignments
    .filter((assignment: any) => assignment.subjectUserId === context.userId)
    .map((assignment: any) => assignment.role);
  return {
    identity: {
      projectId: Number(input.projectId),
      briefId: String(summary.briefId),
      versionId: String(version.id),
      streamRevision: summary.revision,
      versionRevision: version.revision,
    },
    summary,
    version: { ...version, sections: undefined },
    readiness,
    sections: studioSections,
    assignments: activeAssignments,
    assumptions: studioSections.flatMap(section => section.assumptions.map((assumption: any) => ({ ...assumption, sectionId: section.sectionId }))),
    findings: findings.filter((finding: any) => finding.versionId === Number(input.versionId)),
    conditions,
    dependencies: dependencies.filter((dependency: any) => dependency.versionId === Number(input.versionId)),
    issues,
    history: events,
    inbox: studioSections.flatMap(section => section.permittedActions
      .filter((action: BriefStudioAction) => action !== "revise")
      .map((action: BriefStudioAction) => ({
        id: `${section.sectionId}:${action}`,
        sectionId: section.sectionId,
        eventType: action,
        nextAction: section.nextAction,
      }))),
    choices: {
      members: memberChoices.map(member => ({ id: member.id, label: member.name?.trim() || `Member ${member.id}`, organizationRole: member.organizationRole })),
    },
    permittedActions: {
      createVersion: currentUserRoles.some((role: string) => role === "author" || role === "section_owner"),
      issue: currentUserRoles.includes("issuer") && readiness.canIssue,
      administerRoles: false,
    },
  };
}
export async function listBriefEvents(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  return db
    .select()
    .from(briefEvents)
    .where(
      and(
        eq(briefEvents.organizationId, context.organizationId),
        eq(briefEvents.streamId, stream.id)
      )
    )
    .orderBy(asc(briefEvents.streamSequence));
}
export async function listBriefIssues(
  input: any,
  context: BriefWorkflowContext
) {
  const { db, stream } = await scopedStream(input, context);
  const issues=await db
    .select()
    .from(briefIssues)
    .where(
      and(
        eq(briefIssues.organizationId, context.organizationId),
        eq(briefIssues.streamId, stream.id)
      )
    )
    .orderBy(desc(briefIssues.issueNumber));
  const events=await db.select().from(briefEvents).where(and(eq(briefEvents.organizationId,context.organizationId),eq(briefEvents.streamId,stream.id))).orderBy(asc(briefEvents.streamSequence));
  return issues.map(issue=>{const statusEvent=events.filter(event=>event.issueId===issue.id&&(event.eventType==="issue_superseded"||event.eventType==="issue_withdrawal_approved")).at(-1);return {...issue,issueId:String(issue.id),briefId:String(stream.id),versionId:String(issue.versionId),purpose:issue.issuePurpose,status:statusEvent?.eventType==="issue_withdrawal_approved"?"withdrawn":statusEvent?.eventType==="issue_superseded"?"superseded":"active"};});
}
export async function getBriefSectionHistory(input:any,context:BriefWorkflowContext){const {db,stream}=await scopedStream(input,context);return db.select({revisionId:briefSectionRevisions.id,origin:briefSectionRevisions.origin,fingerprint:briefSectionRevisions.revisionFingerprint,createdAt:briefSectionRevisions.createdAt}).from(briefSectionRevisions).where(and(eq(briefSectionRevisions.organizationId,context.organizationId),eq(briefSectionRevisions.projectId,stream.projectId),eq(briefSectionRevisions.scopeKey,stream.scopeKey),eq(briefSectionRevisions.sectionId,input.sectionId))).orderBy(desc(briefSectionRevisions.id));}
export async function getBriefReadinessFacts(
  input: any,
  context: BriefWorkflowContext,
  transaction?: any,
  lockedStream?: any,
  lockedVersion?: any
) {
  const scoped =
    transaction && lockedStream
      ? { db: transaction, stream: lockedStream }
      : await scopedStream(input, context);
  const { db, stream } = scoped;
  const versionId = positive(input.versionId, "versionId");
  const [queriedVersion] = lockedVersion
    ? [lockedVersion]
    : await db
        .select()
        .from(briefVersions)
        .where(
          and(
            eq(briefVersions.organizationId, context.organizationId),
            eq(briefVersions.streamId, stream.id),
            eq(briefVersions.id, versionId)
          )
        )
        .limit(1);
  const version = lockedVersion ?? queriedVersion;
  if (!version)
    throw new BriefWorkflowError("CONCEALED", "Brief resource not found");
  const [
    bindings,
    roles,
    conditions,
    findings,
    resolutions,
    approvals,
    apps,
    deps,
    revisions,
  ] = await Promise.all([
    db
      .select()
      .from(briefVersionSections)
      .where(
        and(
          eq(briefVersionSections.organizationId, context.organizationId),
          eq(briefVersionSections.streamId, stream.id),
          eq(briefVersionSections.versionId, versionId)
        )
      )
      .orderBy(asc(briefVersionSections.id)),
    db
      .select()
      .from(briefRoleEvents)
      .where(
        and(
          eq(briefRoleEvents.organizationId, context.organizationId),
          eq(briefRoleEvents.streamId, stream.id)
        )
      )
      .orderBy(asc(briefRoleEvents.id)),
    db
      .select()
      .from(briefConditionEvents)
      .where(
        and(
          eq(briefConditionEvents.organizationId, context.organizationId),
          eq(briefConditionEvents.streamId, stream.id),
          eq(briefConditionEvents.versionId, versionId)
        )
      )
      .orderBy(asc(briefConditionEvents.id)),
    db
      .select()
      .from(briefFindings)
      .where(
        and(
          eq(briefFindings.organizationId, context.organizationId),
          eq(briefFindings.streamId, stream.id),
          eq(briefFindings.versionId, versionId)
        )
      ),
    db
      .select()
      .from(briefFindingResolutions)
      .where(
        and(
          eq(briefFindingResolutions.organizationId, context.organizationId),
          eq(briefFindingResolutions.streamId, stream.id)
        )
      ),
    db
      .select()
      .from(briefApprovals)
      .where(
        and(
          eq(briefApprovals.organizationId, context.organizationId),
          eq(briefApprovals.streamId, stream.id),
          eq(briefApprovals.versionId, versionId)
        )
      )
      .orderBy(asc(briefApprovals.streamSequence)),
    db
      .select()
      .from(briefApplicabilityEvents)
      .where(
        and(
          eq(briefApplicabilityEvents.organizationId, context.organizationId),
          eq(briefApplicabilityEvents.streamId, stream.id),
          eq(briefApplicabilityEvents.versionId, versionId)
        )
      )
      .orderBy(asc(briefApplicabilityEvents.streamSequence)),
    db
      .select()
      .from(briefDependencies)
      .where(
        and(
          eq(briefDependencies.organizationId, context.organizationId),
          eq(briefDependencies.streamId, stream.id),
          eq(briefDependencies.versionId, versionId)
        )
      ),
    db
      .select()
      .from(briefSectionRevisions)
      .where(
        and(
          eq(briefSectionRevisions.organizationId, context.organizationId),
          eq(briefSectionRevisions.projectId, stream.projectId)
        )
      ),
  ]);
  const activeGrants = roles.filter(
    (r: any) =>
      r.action === "granted" &&
      !roles.some(
        (x: any) => x.action === "revoked" && x.targetGrantEventId === r.id
      )
  );
  const sectionFacts = bindings.map((b: any) => {
    const rev = revisions.find((r: any) => r.id === b.sectionRevisionId);
    const bd = deps.filter((d: any) => d.bindingId === b.id);
    const bf = findings.filter((f: any) => f.bindingId === b.id);
    const ba = approvals.filter(
      (a: any) =>
        a.bindingId === b.id &&
        a.decision === "approved" &&
        !approvals.some(
          (w: any) => w.decision === "withdrawn" && w.targetApprovalId === a.id
        )
    );
    const ev = apps.filter((a: any) => a.bindingId === b.id && a.classificationFingerprint === b.classificationFingerprint);
    const approved = ev.filter((a: any) => a.stage === "approved").at(-1);
    const reviewed = approved ? ev.find((a: any) => a.id === approved.targetEventId && a.stage === "reviewed") : undefined;
    const proposed = reviewed ? ev.find((a: any) => a.id === reviewed.targetEventId && a.stage === "proposed") : undefined;
    const cs = conditions.filter((c: any) => c.bindingId === b.id);
    const raised = cs.filter((c: any) => c.stage === "raised");
    const active = raised.filter(
      (c: any) =>
        !cs.some(
          (accepted: any) =>
            accepted.stage === "resolution_accepted" &&
            (accepted.targetEventId === c.id ||
              cs.some(
                (submitted: any) =>
                  submitted.id === accepted.targetEventId &&
                  submitted.targetEventId === c.id
              ))
        )
    );
    const classifications = Array.isArray(b.classifications)
      ? b.classifications
      : [];
    const requirements = classifications.map((c: any) => {
      const ruleDependencies = bd.filter((d: any) => {
        const ref = d.dependencyRef as any;
        return ref?.ruleId === c.ruleId || (c.sourceId && ref?.recordId === c.sourceId && (!c.sourceVersion || d.recordVersion === c.sourceVersion));
      });
      return ({
      ruleId: String(c.ruleId ?? "unclassified"),
      classified: Boolean(c.ruleId && c.requirement),
      required: c.requirement === "required",
      componentId: c.componentId,
      hasContent: Boolean(rev),
      hasEvidence: ruleDependencies.some((d: any) => d.authority !== "ai_suggestion"),
      authority:
        c.authority ??
        (rev?.origin === "ai_proposal"
          ? "ai_suggestion"
          : rev
            ? "explicit_user_input"
            : undefined),
      assumptionImpacts: c.impacts ?? [],
      hasRequiredProfessionalReview: c.impacts?.includes?.("professional")
        ? Boolean(c.approvedBy)
        : true,
      lineageComplete: ruleDependencies.length > 0 && ruleDependencies.every((d: any) =>
        Boolean(d.recordVersion && d.fingerprint)
      ),
    });});
    const componentCoverage = (version.componentScope as any[]).map(componentId => {
      const componentRules = requirements.filter((r: any) => r.componentId === String(componentId));
      const reconciliation = bd.some((d: any) => {
        const ref = d.dependencyRef as any;
        return ref?.componentId === String(componentId) && ref?.reconciliationPassed === true;
      });
      return { componentId: String(componentId), complete: componentRules.length > 0 && componentRules.every((r: any) => !r.required || (r.hasContent && r.hasEvidence && r.lineageComplete)), reconciled: reconciliation };
    });
    return {
      sectionId: b.sectionId,
      applicability: b.applicability,
      achievedState: b.achievedState,
      revisionId: b.sectionRevisionId ? String(b.sectionRevisionId) : null,
      authorUserId: rev?.authorUserId,
      reviewerUserId: activeGrants.find(
        (r: any) =>
          r.role === "reviewer" &&
          (r.sectionId == null || r.sectionId === b.sectionId)
      )?.subjectUserId,
      approverUserId: ba.at(-1)?.approverUserId,
      applicabilityProposerUserId: proposed?.actorUserId,
      applicabilityReviewerUserId: reviewed?.actorUserId,
      applicabilityApproverUserId: approved?.actorUserId,
      requirements,
      conditions: raised.map((c: any) => ({
        conditionId: String(c.id),
        kind: c.kind,
        active: active.some((x: any) => x.id === c.id),
        dependencyId: c.dependencyId ? String(c.dependencyId) : undefined,
      })),
      findings: bf.map((f: any) => ({
        findingId: String(f.id),
        severity: f.severity,
        resolved: resolutions.some(
          (r: any) => r.findingId === f.id && r.stage === "accepted"
        ),
        componentId: undefined,
      })),
      reconciliations: [],
      componentCoverage,
    };
  });
  return {
    briefId: String(stream.id),
    versionId: String(version.id),
    streamRevision: stream.revision,
    versionRevision: version.revision,
    purpose: stream.issuePurpose,
    profile: String(stream.typologyProfileVersion).split(":")[0],
    componentIds: (version.componentScope as any[]).map(String),
    sections: sectionFacts,
    issuerUserId: input.issuerUserId,
    activeRoles: activeGrants.map((r: any) => ({
      userId: r.subjectUserId,
      role: r.role,
    })),
    issueMetadata: input.issueMetadata ?? {
      documentIdentity: false,
      disclaimerVersion: false,
      confidentiality: false,
      distributionPolicyVersion: false,
      reproducibilityIdentity: false,
    },
  };
}
export async function queryBriefWorkflow(
  query: string,
  input: any,
  context: BriefWorkflowContext
) {
  const map: Record<string, (i: any, c: BriefWorkflowContext) => Promise<any>> =
    {
      get: getBriefSummary,
      getStream: getBriefSummary,
      list: listBriefStreams,
      listStreams: listBriefStreams,
      getVersion: getBriefVersion,
      listVersions: listBriefVersions,
      getSection: getBriefSection,
      listAssignments: listBriefAssignments,
      listFindings: listBriefFindings,
      listDependencies: listBriefDependencies,
      listEvents: listBriefEvents,
      listIssues: listBriefIssues,
      getReadiness: getBriefReadinessFacts,
      getSectionHistory: getBriefSectionHistory,
      getAssignments: listBriefAssignments,
      getFindings: listBriefFindings,
      getDependencyStatus: listBriefDependencies,
      getWorkflowHistory: listBriefEvents,
      getIssueLedger: listBriefIssues,
      getStudio: getBriefStudio,
    };
  const fn = map[query.replace(/^brief\./, "")];
  if (!fn)
    throw new BriefWorkflowError("INVALID", `Unsupported query: ${query}`);
  return fn(input, context);
}
