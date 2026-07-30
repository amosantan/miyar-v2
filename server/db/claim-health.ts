import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

import {
  benchmarkProposals,
  benchmarkVersions,
  claimHealthPolicyVersions,
  claimHealthSnapshots,
  evidenceRecords,
  ingestionRuns,
  materialAllocations,
  organizationMembers,
  projects,
  reportPublicShares,
  reportInstances,
  sourceIncidentEvents,
  sourceIncidents,
  sourceRegistry,
  specifications,
  supplierQuotes,
  users,
} from "../../drizzle/schema";
import {
  CLAIM_HEALTH_V1_POLICY_MANIFEST,
  type ClaimHealthDigests,
  type ClaimHealthEvaluation,
  type ClaimHealthEvaluationInput,
  type ClaimHealthIncidentSeverity,
  type ClaimHealthIncidentType,
  type ClaimHealthSafeProjection,
} from "../../shared/claim-health";
import { getDb } from "../db";
import {
  CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
  canonicalizeClaimHealth,
  canonicalizeClaimHealthValue as canonicalizeEngineClaimHealthValue,
  createClaimHealthDigests,
  createClaimHealthValueDigest,
  evaluateClaimHealth,
  composeClaimHealthIncidentStates,
  resolveClaimHealthIncidentSeverity,
  resolveClaimHealthIncidentTransition,
} from "../engines/ingestion/claim-health";
import type { ProjectClaimHealthAuthorityBinding } from "../engines/ingestion/project-claim-health-loader";
import { createClaimHealthGovernedSourceRevision } from "../engines/ingestion/project-claim-health-loader";

export class ClaimHealthStoreError extends Error {
  constructor(
    public readonly code:
      | "CONCEALED"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVALID"
      | "RETENTION_GATE"
      | "UNAVAILABLE",
    message: string
  ) {
    super(message);
  }
}

export const canonicalizeClaimHealthValue = canonicalizeEngineClaimHealthValue;
export const claimHealthDigest = createClaimHealthValueDigest;

export const EV04_POLICY_VERSION = "ev04-claim-health-v1";
export const EV04_REQUIRED_CELL_SCHEMA_VERSION = "ev04-required-cell-v1";
export const EV04_APPROVED_POLICY_DOCUMENT = CLAIM_HEALTH_V1_POLICY_MANIFEST;

function normalizedDate(value: Date, label: string): Date {
  const milliseconds = value.getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new ClaimHealthStoreError("INVALID", `${label} must be a valid date`);
  }
  // Current MySQL timestamp columns have second precision. Digest exactly what
  // is persisted so a read/replay remains byte-stable.
  return new Date(Math.trunc(milliseconds / 1_000) * 1_000);
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ClaimHealthStoreError(
      "INVALID",
      `${label} must be a positive integer`
    );
  }
  return value;
}

function boundedText(value: string, label: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new ClaimHealthStoreError(
      "INVALID",
      `${label} must contain 1-${maximum} characters`
    );
  }
  return normalized;
}

async function database() {
  const db = await getDb();
  if (!db) {
    throw new ClaimHealthStoreError("UNAVAILABLE", "Database unavailable");
  }
  return db;
}

function retryableTransactionError(error: unknown): boolean {
  const value = error as { code?: string; errno?: number };
  return (
    value?.code === "ER_LOCK_DEADLOCK" ||
    value?.code === "ER_LOCK_WAIT_TIMEOUT" ||
    value?.errno === 1213 ||
    value?.errno === 1205
  );
}

async function withClaimHealthTransaction<T>(
  db: any,
  work: (tx: any) => Promise<T>
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(work);
    } catch (error) {
      if (!retryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw new ClaimHealthStoreError(
    "UNAVAILABLE",
    "Claim-health transaction retry budget exhausted"
  );
}

export type PlatformAdminContext = {
  kind: "platform_admin";
  userId: number;
  sessionIdentity: string;
};

export type OrganizationMemberContext = {
  kind: "organization_member";
  organizationId: number;
  userId: number;
  sessionIdentity: string;
};

export type OrganizationAdminContext = {
  kind: "organization_admin";
  organizationId: number;
  userId: number;
  sessionIdentity: string;
};

export type SystemDetectorContext = {
  kind: "system_detector";
  detectorPolicyVersion: string;
};

type IncidentActorContext =
  | PlatformAdminContext
  | OrganizationAdminContext
  | SystemDetectorContext;

async function assertPlatformAdmin(
  tx: any,
  context: PlatformAdminContext
): Promise<void> {
  positiveInteger(context.userId, "userId");
  boundedText(context.sessionIdentity, "sessionIdentity", 160);
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, context.userId), eq(users.role, "admin")))
    .limit(2)
    .for("update");
  if (rows.length !== 1) {
    throw new ClaimHealthStoreError(
      "FORBIDDEN",
      "Platform administrator required"
    );
  }
}

async function assertOrganizationMember(
  tx: any,
  context: OrganizationMemberContext | OrganizationAdminContext,
  requireAdmin: boolean
): Promise<void> {
  positiveInteger(context.organizationId, "organizationId");
  positiveInteger(context.userId, "userId");
  boundedText(context.sessionIdentity, "sessionIdentity", 160);
  const rows = await tx
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, context.organizationId),
        eq(organizationMembers.userId, context.userId)
      )
    )
    .limit(2)
    .for("update");
  if (rows.length !== 1) {
    throw new ClaimHealthStoreError(
      "CONCEALED",
      "Claim-health resource not found"
    );
  }
  if (requireAdmin && rows[0].role !== "admin") {
    throw new ClaimHealthStoreError(
      "FORBIDDEN",
      "Organization administrator required"
    );
  }
}

type ClaimHealthScope =
  | { scope: "platform" }
  | { scope: "organization"; organizationId: number }
  | { scope: "project"; organizationId: number; projectId: number }
  | {
      scope: "supplier_quote";
      organizationId: number;
      supplierQuoteId: number;
    };

async function assertScopedResources(tx: any, scope: ClaimHealthScope) {
  if (scope.scope === "platform") return;
  positiveInteger(scope.organizationId, "organizationId");
  if (scope.scope === "organization") return;
  if (scope.scope === "project") {
    positiveInteger(scope.projectId, "projectId");
    const rows = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, scope.projectId),
          eq(projects.orgId, scope.organizationId)
        )
      )
      .limit(2)
      .for("update");
    if (rows.length !== 1) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    return;
  }
  positiveInteger(scope.supplierQuoteId, "supplierQuoteId");
  const rows = await tx
    .select({ id: supplierQuotes.id })
    .from(supplierQuotes)
    .where(
      and(
        eq(supplierQuotes.id, scope.supplierQuoteId),
        eq(supplierQuotes.orgId, scope.organizationId)
      )
    )
    .limit(2)
    .for("update");
  if (rows.length !== 1) {
    throw new ClaimHealthStoreError(
      "CONCEALED",
      "Claim-health resource not found"
    );
  }
}

function scopeColumns(scope: ClaimHealthScope) {
  return {
    scope: scope.scope,
    organizationId: scope.scope === "platform" ? null : scope.organizationId,
    projectId: scope.scope === "project" ? scope.projectId : null,
    supplierQuoteId:
      scope.scope === "supplier_quote" ? scope.supplierQuoteId : null,
  };
}

function scopeFromIncident(row: {
  scope: string;
  organizationId: number | null;
  projectId: number | null;
  supplierQuoteId: number | null;
}): ClaimHealthScope {
  if (
    row.scope === "platform" &&
    row.organizationId === null &&
    row.projectId === null &&
    row.supplierQuoteId === null
  ) {
    return { scope: "platform" };
  }
  if (
    row.scope === "organization" &&
    row.organizationId !== null &&
    row.projectId === null &&
    row.supplierQuoteId === null
  ) {
    return { scope: "organization", organizationId: row.organizationId };
  }
  if (
    row.scope === "project" &&
    row.organizationId !== null &&
    row.projectId !== null &&
    row.supplierQuoteId === null
  ) {
    return {
      scope: "project",
      organizationId: row.organizationId,
      projectId: row.projectId,
    };
  }
  if (
    row.scope === "supplier_quote" &&
    row.organizationId !== null &&
    row.projectId === null &&
    row.supplierQuoteId !== null
  ) {
    return {
      scope: "supplier_quote",
      organizationId: row.organizationId,
      supplierQuoteId: row.supplierQuoteId,
    };
  }
  throw new ClaimHealthStoreError(
    "CONFLICT",
    "Persisted incident scope is inconsistent"
  );
}

async function assertIncidentActor(
  tx: any,
  scope: ClaimHealthScope,
  context: IncidentActorContext
) {
  if (context.kind === "system_detector") {
    if (scope.scope !== "platform") {
      throw new ClaimHealthStoreError(
        "FORBIDDEN",
        "System detectors cannot mutate tenant incidents"
      );
    }
    const detectorPolicyVersion = boundedText(
      context.detectorPolicyVersion,
      "detectorPolicyVersion",
      96
    );
    return {
      actorType: "system_detector" as const,
      actorUserId: null,
      actorIdentity: `system:${detectorPolicyVersion}`,
      actorSessionIdentity: null,
      detectorPolicyVersion,
      auditIdentity: `system:${detectorPolicyVersion}`,
    };
  }
  if (context.kind === "platform_admin") {
    if (scope.scope !== "platform") {
      throw new ClaimHealthStoreError(
        "FORBIDDEN",
        "Platform incident authority does not grant tenant evidence access"
      );
    }
    await assertPlatformAdmin(tx, context);
    return {
      actorType: "platform_admin" as const,
      actorUserId: context.userId,
      actorIdentity: `user:${context.userId}`,
      actorSessionIdentity: context.sessionIdentity,
      detectorPolicyVersion: null,
      auditIdentity: `session:${context.sessionIdentity}`,
    };
  }
  if (
    scope.scope === "platform" ||
    scope.organizationId !== context.organizationId
  ) {
    throw new ClaimHealthStoreError(
      "CONCEALED",
      "Claim-health resource not found"
    );
  }
  await assertOrganizationMember(tx, context, true);
  await assertScopedResources(tx, scope);
  return {
    actorType: "organization_admin" as const,
    actorUserId: context.userId,
    actorIdentity: `user:${context.userId}`,
    actorSessionIdentity: context.sessionIdentity,
    detectorPolicyVersion: null,
    auditIdentity: `session:${context.sessionIdentity}`,
  };
}

function assertDisposableIncidentPersistence(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new ClaimHealthStoreError(
      "RETENTION_GATE",
      "Incident persistence requires the unapproved SC-06/PDPL retention decision"
    );
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new ClaimHealthStoreError(
      "RETENTION_GATE",
      "Disposable incident persistence requires a guarded database target"
    );
  }
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new ClaimHealthStoreError(
      "RETENTION_GATE",
      "Disposable incident persistence requires a valid database target"
    );
  }
  const databaseName = target.pathname.slice(1);
  const allowedPrefixes =
    CLAIM_HEALTH_V1_POLICY_MANIFEST.retention.incidentHistory
      .disposableDatabaseNamePrefixes;
  if (
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    !allowedPrefixes.some(prefix => databaseName.startsWith(prefix))
  ) {
    throw new ClaimHealthStoreError(
      "RETENTION_GATE",
      "Incident history may only be written to a disposable localhost test database"
    );
  }
}

function assertPolicyManifestIntegrity(row: {
  version: string;
  requiredCellSchemaVersion: string;
  policyDocument: unknown;
  policyDigest: string;
}) {
  const document =
    row.policyDocument &&
    typeof row.policyDocument === "object" &&
    !Array.isArray(row.policyDocument)
      ? (row.policyDocument as Record<string, unknown>)
      : null;
  if (
    !document ||
    document.policyVersion !== row.version ||
    document.requiredCellSchemaVersion !== row.requiredCellSchemaVersion
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Claim-health policy manifest identity is invalid"
    );
  }
  const recomputed = createClaimHealthValueDigest(row.policyDocument);
  if (row.policyDigest !== recomputed) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Claim-health policy manifest digest is invalid"
    );
  }
  if (
    row.version === EV04_POLICY_VERSION &&
    (row.requiredCellSchemaVersion !== EV04_REQUIRED_CELL_SCHEMA_VERSION ||
      row.policyDigest !== CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST)
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "EV-04 v1 policy does not match the canonical approved manifest"
    );
  }
}

async function approvedPolicy(tx: any, policyVersionId: number, asOf?: Date) {
  positiveInteger(policyVersionId, "policyVersionId");
  const clock = asOf ? normalizedDate(asOf, "policy asOf") : null;
  const rows = await tx
    .select()
    .from(claimHealthPolicyVersions)
    .where(
      and(
        eq(claimHealthPolicyVersions.id, policyVersionId),
        eq(claimHealthPolicyVersions.status, "approved")
      )
    )
    .limit(2)
    .for("update");
  if (rows.length !== 1) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Approved claim-health policy version required"
    );
  }
  assertPolicyManifestIntegrity(rows[0]);
  if (
    clock &&
    ((rows[0].effectiveFrom !== null &&
      rows[0].effectiveFrom.getTime() > clock.getTime()) ||
      (rows[0].effectiveTo !== null &&
        rows[0].effectiveTo.getTime() <= clock.getTime()))
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Claim-health policy is not effective at the evaluation clock"
    );
  }
  return rows[0];
}

export async function resolveApprovedClaimHealthPolicyInTransaction(
  tx: any,
  input: {
    version: string;
    requiredCellSchemaVersion: string;
    asOf: Date;
  }
) {
  const version = boundedText(input.version, "version", 96);
  const requiredCellSchemaVersion = boundedText(
    input.requiredCellSchemaVersion,
    "requiredCellSchemaVersion",
    96
  );
  const asOf = normalizedDate(input.asOf, "asOf");
  const rows = await tx
    .select()
    .from(claimHealthPolicyVersions)
    .where(
      and(
        eq(claimHealthPolicyVersions.version, version),
        eq(
          claimHealthPolicyVersions.requiredCellSchemaVersion,
          requiredCellSchemaVersion
        ),
        eq(claimHealthPolicyVersions.status, "approved"),
        or(
          isNull(claimHealthPolicyVersions.effectiveFrom),
          lte(claimHealthPolicyVersions.effectiveFrom, asOf)
        ),
        or(
          isNull(claimHealthPolicyVersions.effectiveTo),
          gt(claimHealthPolicyVersions.effectiveTo, asOf)
        )
      )
    )
    .limit(2);
  if (rows.length !== 1) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Exact effective claim-health policy version not found"
    );
  }
  assertPolicyManifestIntegrity(rows[0]);
  return rows[0];
}

export async function resolveApprovedClaimHealthPolicy(input: {
  version: string;
  requiredCellSchemaVersion: string;
  asOf: Date;
}) {
  const db = await database();
  return resolveApprovedClaimHealthPolicyInTransaction(db, input);
}

export async function createClaimHealthPolicyVersion(
  input: {
    version: string;
    requiredCellSchemaVersion: string;
    status: "draft" | "approved" | "superseded";
    policyDocument: unknown;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
    supersedesId?: number | null;
    approvedAt?: Date;
    approval?:
      | { kind: "user" }
      | { kind: "external_identity"; identity: string };
  },
  context: PlatformAdminContext
) {
  const db = await database();
  return withClaimHealthTransaction(db, async tx => {
    await assertPlatformAdmin(tx, context);
    const version = boundedText(input.version, "version", 96);
    const requiredCellSchemaVersion = boundedText(
      input.requiredCellSchemaVersion,
      "requiredCellSchemaVersion",
      96
    );
    const effectiveFrom = input.effectiveFrom
      ? normalizedDate(input.effectiveFrom, "effectiveFrom")
      : null;
    const effectiveTo = input.effectiveTo
      ? normalizedDate(input.effectiveTo, "effectiveTo")
      : null;
    if (
      effectiveTo &&
      (!effectiveFrom || effectiveTo.getTime() <= effectiveFrom.getTime())
    ) {
      throw new ClaimHealthStoreError(
        "INVALID",
        "Policy effective interval is invalid"
      );
    }
    const approvedAt =
      input.status === "approved"
        ? normalizedDate(input.approvedAt ?? new Date(), "approvedAt")
        : null;
    if (input.status === "approved" && !input.approval) {
      throw new ClaimHealthStoreError(
        "INVALID",
        "Approved policy versions require explicit approval provenance"
      );
    }
    if (input.status !== "approved" && input.approval) {
      throw new ClaimHealthStoreError(
        "INVALID",
        "Only approved policy versions may carry approval provenance"
      );
    }
    const approvedBy =
      input.status === "approved" && input.approval?.kind === "user"
        ? context.userId
        : null;
    const approvedByIdentity =
      input.status === "approved" &&
      input.approval?.kind === "external_identity"
        ? boundedText(input.approval.identity, "approval.identity", 160)
        : null;
    const supersedesId = input.supersedesId
      ? positiveInteger(input.supersedesId, "supersedesId")
      : null;
    if (supersedesId) {
      const predecessors = await tx
        .select({ id: claimHealthPolicyVersions.id })
        .from(claimHealthPolicyVersions)
        .where(eq(claimHealthPolicyVersions.id, supersedesId))
        .limit(2)
        .for("update");
      if (predecessors.length !== 1) {
        throw new ClaimHealthStoreError(
          "CONFLICT",
          "Superseded policy version not found"
        );
      }
    }
    const policyDigest = createClaimHealthValueDigest(input.policyDocument);
    const policyDocument =
      input.policyDocument &&
      typeof input.policyDocument === "object" &&
      !Array.isArray(input.policyDocument)
        ? (input.policyDocument as Record<string, unknown>)
        : null;
    if (
      !policyDocument ||
      policyDocument.policyVersion !== version ||
      policyDocument.requiredCellSchemaVersion !== requiredCellSchemaVersion
    ) {
      throw new ClaimHealthStoreError(
        "INVALID",
        "Policy manifest identity must match its version and cell schema"
      );
    }
    if (
      version === EV04_POLICY_VERSION &&
      (requiredCellSchemaVersion !== EV04_REQUIRED_CELL_SCHEMA_VERSION ||
        policyDigest !== CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST)
    ) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "EV-04 v1 policy requires the exact canonical approved manifest"
      );
    }
    const existing = await tx
      .select()
      .from(claimHealthPolicyVersions)
      .where(eq(claimHealthPolicyVersions.version, version))
      .limit(2)
      .for("update");
    if (existing[0]) {
      const row = existing[0];
      const matches =
        row.requiredCellSchemaVersion === requiredCellSchemaVersion &&
        row.status === input.status &&
        row.policyDigest === policyDigest &&
        row.approvedBy === approvedBy &&
        row.approvedByIdentity === approvedByIdentity &&
        (row.approvedAt?.getTime() ?? null) ===
          (approvedAt?.getTime() ?? null) &&
        row.supersedesId === supersedesId &&
        (row.effectiveFrom?.getTime() ?? null) ===
          (effectiveFrom?.getTime() ?? null) &&
        (row.effectiveTo?.getTime() ?? null) ===
          (effectiveTo?.getTime() ?? null);
      if (!matches) {
        throw new ClaimHealthStoreError(
          "CONFLICT",
          "Policy version is immutable and already has different content"
        );
      }
      return row;
    }
    const result = await tx.insert(claimHealthPolicyVersions).values({
      version,
      requiredCellSchemaVersion,
      status: input.status,
      effectiveFrom,
      effectiveTo,
      policyDocument: input.policyDocument,
      policyDigest,
      approvedBy,
      approvedByIdentity,
      approvedAt,
      supersedesId,
      createdBy: context.userId,
    });
    const id = Number(result[0].insertId);
    return (
      await tx
        .select()
        .from(claimHealthPolicyVersions)
        .where(eq(claimHealthPolicyVersions.id, id))
        .limit(1)
    )[0];
  });
}

export async function ensureApprovedClaimHealthPolicySeed() {
  const db = await database();
  return withClaimHealthTransaction(db, async tx => {
    const effectiveFrom = new Date("2026-07-30T00:00:00.000Z");
    const approvedAt = new Date("2026-07-30T00:00:00.000Z");
    await tx.insert(claimHealthPolicyVersions).ignore().values({
      version: EV04_POLICY_VERSION,
      requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
      status: "approved",
      effectiveFrom,
      effectiveTo: null,
      policyDocument: EV04_APPROVED_POLICY_DOCUMENT,
      policyDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
      approvedBy: null,
      approvedByIdentity: "Amro Saleh",
      approvedAt,
      supersedesId: null,
      createdBy: null,
    });
    const rows = await tx
      .select()
      .from(claimHealthPolicyVersions)
      .where(eq(claimHealthPolicyVersions.version, EV04_POLICY_VERSION))
      .limit(2)
      .for("update");
    if (rows.length !== 1) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "Canonical EV-04 policy seed could not be established"
      );
    }
    const row = rows[0];
    assertPolicyManifestIntegrity(row);
    if (
      row.status !== "approved" ||
      row.approvedBy !== null ||
      row.approvedByIdentity !== "Amro Saleh" ||
      row.approvedAt?.getTime() !== approvedAt.getTime() ||
      row.effectiveFrom?.getTime() !== effectiveFrom.getTime() ||
      row.effectiveTo !== null ||
      row.supersedesId !== null ||
      canonicalizeClaimHealth(row.policyDocument) !==
        canonicalizeClaimHealth(EV04_APPROVED_POLICY_DOCUMENT)
    ) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "Existing EV-04 policy seed differs from the approved canonical row"
      );
    }
    return row;
  });
}

export type ClaimHealthConsumer =
  | "project_workspace"
  | "material_cost"
  | "design_brief"
  | "investor_summary"
  | "stored_project_report"
  | "public_share"
  | "market_evidence"
  | "admin_operations";

export type CreateClaimHealthSnapshotInput = ClaimHealthScope & {
  consumer: ClaimHealthConsumer;
  evaluationClock: Date;
  policyVersionId: number;
  evaluationInput: ClaimHealthEvaluationInput;
  evaluation: ClaimHealthEvaluation;
  digests?: ClaimHealthDigests;
  reportInstanceId?: number | null;
};

export type ClaimHealthSnapshotActorContext =
  | PlatformAdminContext
  | OrganizationMemberContext
  | { kind: "system"; systemIdentity: string };

export async function createClaimHealthSnapshotInTransaction(
  tx: any,
  input: CreateClaimHealthSnapshotInput,
  context: ClaimHealthSnapshotActorContext
) {
  await assertScopedResources(tx, input);
  if (input.scope === "platform") {
    if (context.kind === "platform_admin") {
      await assertPlatformAdmin(tx, context);
    } else if (context.kind !== "system") {
      throw new ClaimHealthStoreError(
        "FORBIDDEN",
        "Platform snapshot authority required"
      );
    }
  } else {
    if (
      context.kind !== "organization_member" ||
      context.organizationId !== input.organizationId
    ) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    await assertOrganizationMember(tx, context, false);
  }
  const evaluationClock = normalizedDate(
    input.evaluationClock,
    "evaluationClock"
  );
  const policy = await approvedPolicy(
    tx,
    input.policyVersionId,
    evaluationClock
  );
  const evaluatedAt =
    input.evaluationInput.evaluatedAt instanceof Date
      ? input.evaluationInput.evaluatedAt
      : new Date(input.evaluationInput.evaluatedAt);
  if (
    !Number.isFinite(evaluatedAt.getTime()) ||
    evaluatedAt.getTime() !== evaluationClock.getTime()
  ) {
    throw new ClaimHealthStoreError(
      "INVALID",
      "Evaluation input clock must exactly match the persisted evaluation clock"
    );
  }
  if (
    input.evaluationInput.policyVersion !== policy.version ||
    input.evaluationInput.policyManifestDigest !== policy.policyDigest ||
    input.evaluationInput.requiredCellSchemaVersion !==
      policy.requiredCellSchemaVersion
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Evaluation input does not match the exact persisted policy contract"
    );
  }
  if (
    input.evaluationInput.cells.some(
      cell => cell.key.consumer !== input.consumer
    )
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Snapshot consumer must match every evaluated claim-health cell"
    );
  }
  const recomputedEvaluation = evaluateClaimHealth(input.evaluationInput);
  if (
    canonicalizeClaimHealth(input.evaluation) !==
    canonicalizeClaimHealth(recomputedEvaluation)
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Supplied claim-health evaluation does not match deterministic recomputation"
    );
  }
  const computedDigests = createClaimHealthDigests(
    input.evaluationInput,
    recomputedEvaluation
  );
  if (
    input.digests &&
    (input.digests.algorithm !== computedDigests.algorithm ||
      input.digests.inputDigest !== computedDigests.inputDigest ||
      input.digests.contentDigest !== computedDigests.contentDigest)
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Claim-health digests do not match the deterministic evaluation"
    );
  }
  const reportInstanceId = input.reportInstanceId
    ? positiveInteger(input.reportInstanceId, "reportInstanceId")
    : null;
  if (reportInstanceId && input.scope !== "project") {
    throw new ClaimHealthStoreError(
      "INVALID",
      "Only a project-scoped snapshot may bind a report"
    );
  }
  if (reportInstanceId && input.scope === "project") {
    const reports = await tx
      .select({ id: reportInstances.id })
      .from(reportInstances)
      .where(
        and(
          eq(reportInstances.id, reportInstanceId),
          eq(reportInstances.projectId, input.projectId)
        )
      )
      .limit(2)
      .for("update");
    if (reports.length !== 1) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
  }
  const scope = scopeColumns(input);
  const creationActor =
    context.kind === "system"
      ? {
          createdByUserId: null,
          createdBySystemIdentity: boundedText(
            context.systemIdentity,
            "systemIdentity",
            128
          ),
        }
      : { createdByUserId: context.userId, createdBySystemIdentity: null };
  const result = await tx.insert(claimHealthSnapshots).values({
    ...scope,
    reportInstanceId,
    consumer: input.consumer,
    evaluationClock,
    policyVersionId: policy.id,
    policyVersion: policy.version,
    requiredCellSchemaVersion: policy.requiredCellSchemaVersion,
    requiredCellInputs: input.evaluationInput,
    evaluatedResults: recomputedEvaluation,
    safeProjection: recomputedEvaluation.safeProjection,
    inputDigest: computedDigests.inputDigest,
    contentDigest: computedDigests.contentDigest,
    ...creationActor,
  });
  const id = Number(result[0].insertId);
  return (
    await tx
      .select()
      .from(claimHealthSnapshots)
      .where(eq(claimHealthSnapshots.id, id))
      .limit(1)
  )[0];
}

export async function createClaimHealthSnapshot(
  input: CreateClaimHealthSnapshotInput,
  context:
    | PlatformAdminContext
    | OrganizationMemberContext
    | { kind: "system"; systemIdentity: string }
) {
  const db = await database();
  return withClaimHealthTransaction(db, tx =>
    createClaimHealthSnapshotInTransaction(tx, input, context)
  );
}

export async function assertProjectClaimHealthAuthorityBindingInTransaction(
  tx: any,
  binding: ProjectClaimHealthAuthorityBinding
): Promise<void> {
  const unsigned = {
    version: binding.version,
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    evaluationClock: binding.evaluationClock,
    entries: binding.entries,
  };
  const evaluationClock = normalizedDate(
    new Date(binding.evaluationClock),
    "authorityBinding.evaluationClock"
  );
  if (
    binding.version !== "ev04-authority-binding-v1" ||
    claimHealthDigest(unsigned) !== binding.digest
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Claim-health authority binding digest is invalid"
    );
  }
  await assertScopedResources(tx, {
    scope: "project",
    organizationId: binding.organizationId,
    projectId: binding.projectId,
  });
  const allocationIds = binding.entries.map(entry =>
    positiveInteger(entry.allocationId, "authorityBinding.allocationId")
  );
  const boundAllocationIds = new Set(allocationIds);
  const allocationRows: Array<{
    id: number;
    materialLibraryId: number | null;
    resolvedUnitBasis: string | null;
  }> = await tx
    .select({
      id: materialAllocations.id,
      materialLibraryId: materialAllocations.materialLibraryId,
      resolvedUnitBasis: materialAllocations.resolvedUnitBasis,
    })
    .from(materialAllocations)
    .where(
      and(
        eq(materialAllocations.organizationId, binding.organizationId),
        eq(materialAllocations.projectId, binding.projectId)
      )
    )
    .for("update");
  const allocationById = new Map(
    allocationRows.map(row => [row.id, row] as const)
  );
  if (
    boundAllocationIds.size !== binding.entries.length ||
    allocationRows.length !== boundAllocationIds.size ||
    allocationRows.some(row => !boundAllocationIds.has(row.id))
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      `Authoritative material evidence changed before report persistence${
        process.env.NODE_ENV === "test" ? " (allocation_set)" : ""
      }`
    );
  }
  for (const entry of binding.entries) {
    const row = allocationById.get(entry.allocationId);
    const mismatches = !row
      ? ["missing_allocation"]
      : [
          row.materialLibraryId !== entry.materialLibraryId
            ? "materialLibraryId"
            : null,
          row.resolvedUnitBasis !== entry.resolvedUnitBasis
            ? "resolvedUnitBasis"
            : null,
        ].filter((value): value is string => value !== null);
    // The loader resolves product/specification/proposal/version authority from
    // the governed resolver tables. The similarly named allocation columns are
    // cached issuance output and are deliberately not an authority source.
    if (mismatches.length > 0) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        `Authoritative material evidence changed before report persistence${
          process.env.NODE_ENV === "test" ? ` (${mismatches.join(",")})` : ""
        }`
      );
    }
  }

  const proposalIds = Array.from(
    new Set(
      binding.entries
        .map(entry => entry.benchmarkProposalId)
        .filter((id): id is number => id !== null)
    )
  );
  const proposalRows: Array<{
    id: number;
    orgId: number | null;
    specId: number | null;
    productId: number | null;
    benchmarkVersionId: number | null;
    supplierQuoteId: number | null;
    provenancePolicyVersion: string | null;
    sourceLadderRung: string | null;
    status: string;
    recommendation: string;
    reviewedAt: Date | null;
  }> =
    proposalIds.length === 0
      ? []
      : await tx
          .select({
            id: benchmarkProposals.id,
            orgId: benchmarkProposals.orgId,
            specId: benchmarkProposals.specId,
            productId: benchmarkProposals.productId,
            benchmarkVersionId: benchmarkProposals.benchmarkVersionId,
            supplierQuoteId: benchmarkProposals.supplierQuoteId,
            provenancePolicyVersion: benchmarkProposals.provenancePolicyVersion,
            sourceLadderRung: benchmarkProposals.sourceLadderRung,
            status: benchmarkProposals.status,
            recommendation: benchmarkProposals.recommendation,
            reviewedAt: benchmarkProposals.reviewedAt,
          })
          .from(benchmarkProposals)
          .where(
            and(
              inArray(benchmarkProposals.id, proposalIds),
              or(
                isNull(benchmarkProposals.orgId),
                eq(benchmarkProposals.orgId, binding.organizationId)
              )
            )
          )
          .for("update");
  const proposalById = new Map(proposalRows.map(row => [row.id, row] as const));
  for (const entry of binding.entries) {
    if (entry.benchmarkProposalId === null) continue;
    const row = proposalById.get(entry.benchmarkProposalId);
    if (
      !row ||
      row.status !== "approved" ||
      row.recommendation !== "publish" ||
      row.reviewedAt === null ||
      row.reviewedAt.getTime() > evaluationClock.getTime() ||
      row.specId !== entry.specificationId ||
      row.productId !== entry.productId ||
      row.benchmarkVersionId !== entry.benchmarkVersionId ||
      row.supplierQuoteId !== entry.supplierQuoteId ||
      row.provenancePolicyVersion !== entry.provenancePolicyVersion ||
      row.sourceLadderRung !== entry.sourceLadderRung
    ) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "Authoritative benchmark evidence changed before report persistence"
      );
    }
  }
  if (proposalIds.length > 0) {
    const successors = await tx
      .select({ id: benchmarkProposals.id })
      .from(benchmarkProposals)
      .where(
        and(
          inArray(benchmarkProposals.supersedesId, proposalIds),
          eq(benchmarkProposals.status, "approved"),
          eq(benchmarkProposals.recommendation, "publish"),
          isNotNull(benchmarkProposals.reviewedAt),
          lte(benchmarkProposals.reviewedAt, evaluationClock),
          or(
            isNull(benchmarkProposals.orgId),
            eq(benchmarkProposals.orgId, binding.organizationId)
          )
        )
      )
      .for("update");
    if (successors.length > 0) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "Authoritative benchmark supersession changed before report persistence"
      );
    }
  }

  const quoteIds = Array.from(
    new Set(
      binding.entries
        .map(entry => entry.supplierQuoteId)
        .filter((id): id is number => id !== null)
    )
  );
  if (quoteIds.length > 0) {
    const quoteRows = await tx
      .select({
        id: supplierQuotes.id,
        orgId: supplierQuotes.orgId,
      })
      .from(supplierQuotes)
      .where(
        and(
          eq(supplierQuotes.orgId, binding.organizationId),
          inArray(supplierQuotes.id, quoteIds)
        )
      )
      .for("update");
    const quoteSet = new Set(quoteRows.map((row: { id: number }) => row.id));
    const quoteSuccessors = await tx
      .select({ id: supplierQuotes.id })
      .from(supplierQuotes)
      .where(
        and(
          eq(supplierQuotes.orgId, binding.organizationId),
          inArray(supplierQuotes.supersedesId, quoteIds),
          lte(supplierQuotes.receivedAt, evaluationClock)
        )
      )
      .for("update");
    if (quoteSet.size !== quoteIds.length || quoteSuccessors.length > 0) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "Authoritative supplier quote changed before report persistence"
      );
    }
  }

  const sourceEntries = binding.entries.filter(
    entry => entry.sourceRegistryId !== null
  );
  if (sourceEntries.length > 0) {
    const sourceIds = Array.from(
      new Set(sourceEntries.map(entry => entry.sourceRegistryId as number))
    );
    const sources: Array<{
      id: number;
      slug: string | null;
      termsDecision: "pending" | "approved" | "rejected";
      isActive: boolean;
      isWhitelisted: boolean;
      updatedAt: Date;
    }> = await tx
      .select({
        id: sourceRegistry.id,
        slug: sourceRegistry.slug,
        termsDecision: sourceRegistry.termsDecision,
        isActive: sourceRegistry.isActive,
        isWhitelisted: sourceRegistry.isWhitelisted,
        updatedAt: sourceRegistry.updatedAt,
      })
      .from(sourceRegistry)
      .where(inArray(sourceRegistry.id, sourceIds))
      .for("update");
    const sourcesById = new Map(sources.map(row => [row.id, row] as const));
    for (const entry of sourceEntries) {
      const source = sourcesById.get(entry.sourceRegistryId!);
      if (
        !source ||
        !source.slug ||
        !entry.sourceSlug ||
        !entry.sourcePolicyVersion ||
        source.slug !== entry.sourceSlug ||
        createClaimHealthGovernedSourceRevision({
          sourceRegistryId: source.id,
          sourceSlug: source.slug,
          termsDecision: source.termsDecision,
          sourceActive: source.isActive,
          sourceWhitelisted: source.isWhitelisted,
          sourcePolicyVersion: entry.sourcePolicyVersion,
          updatedAt: source.updatedAt,
        }) !== entry.sourceRevision
      ) {
        throw new ClaimHealthStoreError(
          "CONFLICT",
          "Governed source authorization changed before report persistence"
        );
      }
    }
  }

  const sourceIdentities = Array.from(
    new Set(
      binding.entries
        .map(entry => entry.governedSourceIdentity)
        .filter((identity): identity is string => identity !== null)
    )
  );
  if (sourceIdentities.length > 0) {
    const incidents: Array<typeof sourceIncidents.$inferSelect> = await tx
      .select()
      .from(sourceIncidents)
      .where(
        and(
          inArray(sourceIncidents.sourceIdentity, sourceIdentities),
          lte(sourceIncidents.openedAt, evaluationClock),
          or(
            eq(sourceIncidents.scope, "platform"),
            and(
              eq(sourceIncidents.scope, "organization"),
              eq(sourceIncidents.organizationId, binding.organizationId)
            ),
            and(
              eq(sourceIncidents.scope, "project"),
              eq(sourceIncidents.organizationId, binding.organizationId),
              eq(sourceIncidents.projectId, binding.projectId)
            ),
            and(
              eq(sourceIncidents.scope, "supplier_quote"),
              eq(sourceIncidents.organizationId, binding.organizationId),
              inArray(sourceIncidents.supplierQuoteId, quoteIds)
            )
          )
        )
      )
      .orderBy(asc(sourceIncidents.id))
      .for("update");
    const events =
      incidents.length === 0
        ? []
        : await tx
            .select({
              id: sourceIncidentEvents.id,
              incidentId: sourceIncidentEvents.incidentId,
              eventSequence: sourceIncidentEvents.eventSequence,
              resultingState: sourceIncidentEvents.resultingState,
              severity: sourceIncidentEvents.severity,
              blockingEffect: sourceIncidentEvents.blockingEffect,
              effectiveAt: sourceIncidentEvents.effectiveAt,
              policyVersionId: sourceIncidentEvents.policyVersionId,
              requestDigest: sourceIncidentEvents.requestDigest,
            })
            .from(sourceIncidentEvents)
            .where(
              and(
                inArray(
                  sourceIncidentEvents.incidentId,
                  incidents.map(incident => incident.id)
                ),
                lte(sourceIncidentEvents.effectiveAt, evaluationClock)
              )
            )
            .orderBy(
              asc(sourceIncidentEvents.incidentId),
              asc(sourceIncidentEvents.eventSequence)
            )
            .for("update");
    const latestByIncident = new Map<number, (typeof events)[number]>();
    for (const event of events) latestByIncident.set(event.incidentId, event);
    for (const entry of binding.entries) {
      if (!entry.governedSourceIdentity) continue;
      const relevant = incidents.filter(
        incident =>
          incident.sourceIdentity === entry.governedSourceIdentity &&
          (incident.scope !== "supplier_quote" ||
            incident.supplierQuoteId === entry.supplierQuoteId)
      );
      const revision = createIncidentAuthorityRevisionDigest(
        evaluationClock,
        entry.governedSourceIdentity,
        relevant,
        latestByIncident
      );
      const effectiveStates: EffectiveClaimIncidentState[] = [];
      for (const incident of relevant) {
        const event = latestByIncident.get(incident.id);
        if (!event || event.resultingState === "resolved") continue;
        effectiveStates.push(event.blockingEffect ? "blocking" : "advisory");
      }
      const state = composeClaimHealthIncidentStates(effectiveStates);
      if (
        revision !== entry.incidentAuthorityRevisionDigest ||
        state !== entry.incidentState
      ) {
        throw new ClaimHealthStoreError(
          "CONFLICT",
          "Source incident authority changed before report persistence"
        );
      }
    }
  }
}

export async function verifyProjectClaimHealthAuthorityBinding(
  binding: ProjectClaimHealthAuthorityBinding,
  context: OrganizationMemberContext | OrganizationAdminContext
): Promise<void> {
  const db = await database();
  if (context.organizationId !== binding.organizationId) {
    throw new ClaimHealthStoreError(
      "CONCEALED",
      "Claim-health resource not found"
    );
  }
  return withClaimHealthTransaction(db, async tx => {
    await assertOrganizationMember(tx, context, false);
    await assertProjectClaimHealthAuthorityBindingInTransaction(tx, binding);
  });
}

type VerifiedReportClaimHealthRow = {
  reportInstanceId: number;
  reportType: string;
  reportContent: unknown;
  reportGeneratedAt: Date;
  reportProjectId: number;
  projectOrganizationId: number | null;
  snapshotId: number;
  snapshotScope: string;
  snapshotOrganizationId: number | null;
  snapshotProjectId: number | null;
  snapshotReportInstanceId: number | null;
  snapshotConsumer: string;
  snapshotEvaluationClock: Date;
  snapshotPolicyVersionId: number;
  snapshotPolicyVersion: string;
  snapshotRequiredCellSchemaVersion: string;
  snapshotRequiredCellInputs: unknown;
  snapshotEvaluatedResults: unknown;
  snapshotSafeProjection: unknown;
  snapshotInputDigest: string;
  snapshotContentDigest: string;
  policyVersion: string;
  policyRequiredCellSchemaVersion: string;
  policyStatus: string;
  policyEffectiveFrom: Date | null;
  policyEffectiveTo: Date | null;
  policyDocument: unknown;
  policyDigest: string;
};

async function loadVerifiedReportClaimHealthRow(
  tx: any,
  input: {
    reportInstanceId: number;
    organizationId: number;
    snapshotId?: number;
    lock?: boolean;
  }
): Promise<VerifiedReportClaimHealthRow | null> {
  const conditions = [
    eq(reportInstances.id, input.reportInstanceId),
    eq(projects.orgId, input.organizationId),
    eq(claimHealthSnapshots.organizationId, input.organizationId),
    eq(claimHealthSnapshots.reportInstanceId, input.reportInstanceId),
  ];
  if (input.snapshotId !== undefined) {
    conditions.push(eq(claimHealthSnapshots.id, input.snapshotId));
  }
  let query = tx
    .select({
      reportInstanceId: reportInstances.id,
      reportType: reportInstances.reportType,
      reportContent: reportInstances.content,
      reportGeneratedAt: reportInstances.generatedAt,
      reportProjectId: reportInstances.projectId,
      projectOrganizationId: projects.orgId,
      snapshotId: claimHealthSnapshots.id,
      snapshotScope: claimHealthSnapshots.scope,
      snapshotOrganizationId: claimHealthSnapshots.organizationId,
      snapshotProjectId: claimHealthSnapshots.projectId,
      snapshotReportInstanceId: claimHealthSnapshots.reportInstanceId,
      snapshotConsumer: claimHealthSnapshots.consumer,
      snapshotEvaluationClock: claimHealthSnapshots.evaluationClock,
      snapshotPolicyVersionId: claimHealthSnapshots.policyVersionId,
      snapshotPolicyVersion: claimHealthSnapshots.policyVersion,
      snapshotRequiredCellSchemaVersion:
        claimHealthSnapshots.requiredCellSchemaVersion,
      snapshotRequiredCellInputs: claimHealthSnapshots.requiredCellInputs,
      snapshotEvaluatedResults: claimHealthSnapshots.evaluatedResults,
      snapshotSafeProjection: claimHealthSnapshots.safeProjection,
      snapshotInputDigest: claimHealthSnapshots.inputDigest,
      snapshotContentDigest: claimHealthSnapshots.contentDigest,
      policyVersion: claimHealthPolicyVersions.version,
      policyRequiredCellSchemaVersion:
        claimHealthPolicyVersions.requiredCellSchemaVersion,
      policyStatus: claimHealthPolicyVersions.status,
      policyEffectiveFrom: claimHealthPolicyVersions.effectiveFrom,
      policyEffectiveTo: claimHealthPolicyVersions.effectiveTo,
      policyDocument: claimHealthPolicyVersions.policyDocument,
      policyDigest: claimHealthPolicyVersions.policyDigest,
    })
    .from(reportInstances)
    .innerJoin(projects, eq(projects.id, reportInstances.projectId))
    .innerJoin(
      claimHealthSnapshots,
      eq(claimHealthSnapshots.reportInstanceId, reportInstances.id)
    )
    .innerJoin(
      claimHealthPolicyVersions,
      eq(claimHealthPolicyVersions.id, claimHealthSnapshots.policyVersionId)
    )
    .where(and(...conditions))
    .limit(2);
  if (input.lock) query = query.for("update");
  const rows = (await query) as VerifiedReportClaimHealthRow[];
  return rows.length === 1 ? rows[0] : null;
}

function verifyReportClaimHealthRow(
  row: VerifiedReportClaimHealthRow
): ClaimHealthSafeProjection | null {
  try {
    if (
      row.projectOrganizationId === null ||
      row.snapshotScope !== "project" ||
      row.snapshotOrganizationId !== row.projectOrganizationId ||
      row.snapshotProjectId !== row.reportProjectId ||
      row.snapshotReportInstanceId !== row.reportInstanceId ||
      row.snapshotConsumer !== "stored_project_report" ||
      row.snapshotPolicyVersionId <= 0 ||
      row.snapshotPolicyVersion !== EV04_POLICY_VERSION ||
      row.snapshotRequiredCellSchemaVersion !==
        EV04_REQUIRED_CELL_SCHEMA_VERSION ||
      row.policyVersion !== row.snapshotPolicyVersion ||
      row.policyRequiredCellSchemaVersion !==
        row.snapshotRequiredCellSchemaVersion ||
      row.policyStatus !== "approved" ||
      row.policyDigest !== CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST ||
      (row.policyEffectiveFrom !== null &&
        row.policyEffectiveFrom.getTime() >
          row.snapshotEvaluationClock.getTime()) ||
      (row.policyEffectiveTo !== null &&
        row.policyEffectiveTo.getTime() <=
          row.snapshotEvaluationClock.getTime())
    ) {
      return null;
    }
    assertPolicyManifestIntegrity({
      version: row.policyVersion,
      requiredCellSchemaVersion: row.policyRequiredCellSchemaVersion,
      policyDocument: row.policyDocument,
      policyDigest: row.policyDigest,
    });
    const evaluationInput =
      row.snapshotRequiredCellInputs as ClaimHealthEvaluationInput;
    const suppliedEvaluation =
      row.snapshotEvaluatedResults as ClaimHealthEvaluation;
    const recomputedEvaluation = evaluateClaimHealth(evaluationInput);
    const digests = createClaimHealthDigests(
      evaluationInput,
      recomputedEvaluation
    );
    if (
      new Date(evaluationInput.evaluatedAt).getTime() !==
        row.snapshotEvaluationClock.getTime() ||
      evaluationInput.policyVersion !== row.policyVersion ||
      evaluationInput.policyManifestDigest !== row.policyDigest ||
      evaluationInput.requiredCellSchemaVersion !==
        row.policyRequiredCellSchemaVersion ||
      canonicalizeClaimHealth(suppliedEvaluation) !==
        canonicalizeClaimHealth(recomputedEvaluation) ||
      canonicalizeClaimHealth(row.snapshotSafeProjection) !==
        canonicalizeClaimHealth(recomputedEvaluation.safeProjection) ||
      row.snapshotInputDigest !== digests.inputDigest ||
      row.snapshotContentDigest !== digests.contentDigest
    ) {
      return null;
    }
    return recomputedEvaluation.safeProjection;
  } catch {
    return null;
  }
}

export async function getVerifiedReportClaimHealthProjection(input: {
  reportInstanceId: number;
  organizationId: number;
}): Promise<ClaimHealthSafeProjection | null> {
  const db = await database();
  const reportInstanceId = positiveInteger(
    input.reportInstanceId,
    "reportInstanceId"
  );
  const organizationId = positiveInteger(
    input.organizationId,
    "organizationId"
  );
  const row = await loadVerifiedReportClaimHealthRow(db, {
    reportInstanceId,
    organizationId,
  });
  return row ? verifyReportClaimHealthRow(row) : null;
}

function hashPublicShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createReportPublicShare(
  input: {
    organizationId: number;
    reportInstanceId: number;
    expiresAt: Date;
  },
  context: OrganizationAdminContext
): Promise<{ shareId: number; token: string; expiresAt: Date }> {
  const db = await database();
  const organizationId = positiveInteger(
    input.organizationId,
    "organizationId"
  );
  const reportInstanceId = positiveInteger(
    input.reportInstanceId,
    "reportInstanceId"
  );
  const expiresAt = normalizedDate(input.expiresAt, "expiresAt");
  return withClaimHealthTransaction(db, async tx => {
    if (context.organizationId !== organizationId) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    await assertOrganizationMember(tx, context, true);
    const row = await loadVerifiedReportClaimHealthRow(tx, {
      reportInstanceId,
      organizationId,
      lock: true,
    });
    if (!row || !verifyReportClaimHealthRow(row)) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    const createdAt = normalizedDate(new Date(), "createdAt");
    if (expiresAt.getTime() <= createdAt.getTime()) {
      throw new ClaimHealthStoreError(
        "INVALID",
        "Public share expiry must be in the future"
      );
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashPublicShareToken(token);
      try {
        const result = await tx.insert(reportPublicShares).values({
          organizationId,
          reportInstanceId,
          snapshotId: row.snapshotId,
          tokenHash,
          expiresAt,
          createdByUserId: context.userId,
          createdAt,
        });
        return {
          shareId: Number(result[0].insertId),
          token,
          expiresAt,
        };
      } catch (error) {
        const value = error as {
          code?: string;
          errno?: number;
          cause?: { code?: string; errno?: number };
        };
        const duplicate =
          value.code === "ER_DUP_ENTRY" ||
          value.errno === 1062 ||
          value.cause?.code === "ER_DUP_ENTRY" ||
          value.cause?.errno === 1062;
        if (!duplicate || attempt === 3) throw error;
      }
    }
    throw new ClaimHealthStoreError(
      "UNAVAILABLE",
      "Public share token retry budget exhausted"
    );
  });
}

export async function revokeReportPublicShare(
  input: { organizationId: number; shareId: number },
  context: OrganizationAdminContext
): Promise<boolean> {
  const db = await database();
  const organizationId = positiveInteger(
    input.organizationId,
    "organizationId"
  );
  const shareId = positiveInteger(input.shareId, "shareId");
  return withClaimHealthTransaction(db, async tx => {
    if (context.organizationId !== organizationId) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    await assertOrganizationMember(tx, context, true);
    const rows = await tx
      .select({
        id: reportPublicShares.id,
        revokedAt: reportPublicShares.revokedAt,
      })
      .from(reportPublicShares)
      .where(
        and(
          eq(reportPublicShares.id, shareId),
          eq(reportPublicShares.organizationId, organizationId)
        )
      )
      .limit(2)
      .for("update");
    if (rows.length !== 1) return false;
    if (rows[0].revokedAt !== null) return true;
    await tx
      .update(reportPublicShares)
      .set({
        revokedAt: normalizedDate(new Date(), "revokedAt"),
        revokedByUserId: context.userId,
      })
      .where(
        and(
          eq(reportPublicShares.id, shareId),
          eq(reportPublicShares.organizationId, organizationId),
          isNull(reportPublicShares.revokedAt)
        )
      );
    return true;
  });
}

export async function listActiveReportPublicShares(
  input: { organizationId: number; reportInstanceId: number },
  context: OrganizationAdminContext
): Promise<
  Array<{
    shareId: number;
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    active: boolean;
  }>
> {
  const db = await database();
  const organizationId = positiveInteger(
    input.organizationId,
    "organizationId"
  );
  const reportInstanceId = positiveInteger(
    input.reportInstanceId,
    "reportInstanceId"
  );
  return withClaimHealthTransaction(db, async tx => {
    if (context.organizationId !== organizationId) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    await assertOrganizationMember(tx, context, true);
    const asOf = normalizedDate(new Date(), "asOf");
    const rows = await tx
      .select({
        shareId: reportPublicShares.id,
        createdAt: reportPublicShares.createdAt,
        expiresAt: reportPublicShares.expiresAt,
        revokedAt: reportPublicShares.revokedAt,
      })
      .from(reportPublicShares)
      .innerJoin(
        reportInstances,
        and(
          eq(reportInstances.id, reportPublicShares.reportInstanceId),
          eq(reportInstances.id, reportInstanceId)
        )
      )
      .innerJoin(
        projects,
        and(
          eq(projects.id, reportInstances.projectId),
          eq(projects.orgId, organizationId)
        )
      )
      .where(
        and(
          eq(reportPublicShares.organizationId, organizationId),
          eq(reportPublicShares.reportInstanceId, reportInstanceId),
          isNull(reportPublicShares.revokedAt),
          gt(reportPublicShares.expiresAt, asOf)
        )
      )
      .orderBy(desc(reportPublicShares.createdAt), desc(reportPublicShares.id));
    return rows.map(
      (row: {
        shareId: number;
        createdAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
      }) => ({
        ...row,
        active: true,
      })
    );
  });
}

export async function resolveReportPublicShare(input: {
  token: string;
  asOf: Date;
}): Promise<{
  report: {
    reportType: string;
    locale: "en" | "ar";
    generatedAt: Date;
  };
  claimHealth: ClaimHealthSafeProjection;
  expiresAt: Date;
} | null> {
  const token = input.token.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const asOf = normalizedDate(input.asOf, "asOf");
  const db = await database();
  const shares = await db
    .select()
    .from(reportPublicShares)
    .where(
      and(
        eq(reportPublicShares.tokenHash, hashPublicShareToken(token)),
        isNull(reportPublicShares.revokedAt),
        gt(reportPublicShares.expiresAt, asOf)
      )
    )
    .limit(2);
  if (shares.length !== 1) return null;
  const share = shares[0];
  const row = await loadVerifiedReportClaimHealthRow(db, {
    reportInstanceId: share.reportInstanceId,
    organizationId: share.organizationId,
    snapshotId: share.snapshotId,
  });
  if (!row) return null;
  const claimHealth = verifyReportClaimHealthRow(row);
  if (!claimHealth) return null;
  const content =
    row.reportContent &&
    typeof row.reportContent === "object" &&
    !Array.isArray(row.reportContent)
      ? (row.reportContent as Record<string, unknown>)
      : null;
  return {
    report: {
      reportType: row.reportType,
      locale: content?.locale === "ar" ? "ar" : "en",
      generatedAt: row.reportGeneratedAt,
    },
    claimHealth,
    expiresAt: share.expiresAt,
  };
}

export async function assertEv04ClaimHealthRecoverySafe(): Promise<void> {
  const db = await database();
  const [shares, snapshots, events, incidents] = await Promise.all([
    db.select({ id: reportPublicShares.id }).from(reportPublicShares).limit(1),
    db
      .select({ id: claimHealthSnapshots.id })
      .from(claimHealthSnapshots)
      .limit(1),
    db
      .select({ id: sourceIncidentEvents.id })
      .from(sourceIncidentEvents)
      .limit(1),
    db.select({ id: sourceIncidents.id }).from(sourceIncidents).limit(1),
  ]);
  const blockers = [
    shares.length > 0 ? "report_public_share" : null,
    snapshots.length > 0 ? "claim_health_snapshot" : null,
    events.length > 0 ? "source_incident_event" : null,
    incidents.length > 0 ? "source_incident" : null,
  ].filter((value): value is string => value !== null);
  if (blockers.length > 0) {
    throw new ClaimHealthStoreError(
      "RETENTION_GATE",
      `EV-04 recovery refused while dependent rows exist: ${blockers.join(",")}`
    );
  }
}

/**
 * Test-only dependency-order cleanup for fixtures that intentionally reuse one
 * project across runtimes. Production callers cannot pass the disposable
 * localhost retention gate and have no delete API for immutable snapshots.
 */
export async function cleanupEv04ClaimHealthForDisposableTest(input: {
  organizationId: number;
  projectId: number;
}): Promise<number> {
  assertDisposableIncidentPersistence();
  const organizationId = positiveInteger(
    input.organizationId,
    "organizationId"
  );
  const projectId = positiveInteger(input.projectId, "projectId");
  const db = await database();
  return withClaimHealthTransaction(db, async tx => {
    const snapshots = await tx
      .select({ id: claimHealthSnapshots.id })
      .from(claimHealthSnapshots)
      .where(
        and(
          eq(claimHealthSnapshots.organizationId, organizationId),
          eq(claimHealthSnapshots.projectId, projectId)
        )
      )
      .for("update");
    const snapshotIds = snapshots.map((row: { id: number }) => row.id);
    if (snapshotIds.length === 0) return 0;
    await tx
      .delete(reportPublicShares)
      .where(inArray(reportPublicShares.snapshotId, snapshotIds));
    await tx
      .delete(sourceIncidentEvents)
      .where(inArray(sourceIncidentEvents.snapshotId, snapshotIds));
    await tx
      .delete(claimHealthSnapshots)
      .where(inArray(claimHealthSnapshots.id, snapshotIds));
    return snapshotIds.length;
  });
}

export async function listClaimHealthBenchmarkFacts(
  input: {
    projectId: number;
    benchmarkProposalIds: number[];
    evaluationClock: Date;
  },
  context: OrganizationMemberContext
) {
  const ids = Array.from(new Set(input.benchmarkProposalIds)).map(id =>
    positiveInteger(id, "benchmarkProposalId")
  );
  const evaluationClock = normalizedDate(
    input.evaluationClock,
    "evaluationClock"
  );
  if (ids.length > 2_000) {
    throw new ClaimHealthStoreError(
      "INVALID",
      "At most 2000 benchmark proposals may be loaded"
    );
  }
  if (ids.length === 0) return [];
  const db = await database();
  await assertOrganizationMember(db, context, false);
  await assertScopedResources(db, {
    scope: "project",
    organizationId: context.organizationId,
    projectId: input.projectId,
  });
  const rows = await db
    .select({
      id: benchmarkProposals.id,
      specId: benchmarkProposals.specId,
      proposalOrganizationId: benchmarkProposals.orgId,
      priceScope: benchmarkProposals.priceScope,
      sourceKind: benchmarkProposals.sourceKind,
      sourceLadderRung: benchmarkProposals.sourceLadderRung,
      benchmarkVersionId: benchmarkProposals.benchmarkVersionId,
      benchmarkVersion: benchmarkVersions.versionTag,
      supplierQuoteId: benchmarkProposals.supplierQuoteId,
      proposalSupersedesId: benchmarkProposals.supersedesId,
      sourceLabel: benchmarkProposals.sourceLabel,
      priceConfidence: benchmarkProposals.priceConfidence,
      provenancePolicyVersion: benchmarkProposals.provenancePolicyVersion,
      keyPolicyVersion: benchmarkProposals.keyPolicyVersion,
      proposedP25: benchmarkProposals.proposedP25,
      proposedP50: benchmarkProposals.proposedP50,
      proposedP75: benchmarkProposals.proposedP75,
      weightedMean: benchmarkProposals.weightedMean,
      recommendation: benchmarkProposals.recommendation,
      status: benchmarkProposals.status,
      reviewedBy: benchmarkProposals.reviewedBy,
      reviewedAt: benchmarkProposals.reviewedAt,
      createdAt: benchmarkProposals.createdAt,
      specificationCategory: specifications.category,
      specificationFinishLevel: specifications.finishLevel,
      specificationUnitBasis: specifications.unitBasis,
      specificationGeography: specifications.geography,
      quoteOrganizationId: supplierQuotes.orgId,
      quoteReceivedAt: supplierQuotes.receivedAt,
      quoteValidUntil: supplierQuotes.validUntil,
      quoteSupersedesId: supplierQuotes.supersedesId,
    })
    .from(benchmarkProposals)
    .leftJoin(specifications, eq(specifications.id, benchmarkProposals.specId))
    .leftJoin(
      benchmarkVersions,
      eq(benchmarkVersions.id, benchmarkProposals.benchmarkVersionId)
    )
    .leftJoin(
      supplierQuotes,
      eq(supplierQuotes.id, benchmarkProposals.supplierQuoteId)
    )
    .where(
      and(
        inArray(benchmarkProposals.id, ids),
        eq(benchmarkProposals.status, "approved"),
        eq(benchmarkProposals.recommendation, "publish"),
        isNotNull(benchmarkProposals.reviewedAt),
        lte(benchmarkProposals.reviewedAt, evaluationClock),
        or(
          isNull(benchmarkProposals.orgId),
          eq(benchmarkProposals.orgId, context.organizationId)
        )
      )
    );
  const successorRows = await db
    .select({
      id: benchmarkProposals.id,
      supersedesId: benchmarkProposals.supersedesId,
      reviewedAt: benchmarkProposals.reviewedAt,
    })
    .from(benchmarkProposals)
    .where(
      and(
        inArray(benchmarkProposals.supersedesId, ids),
        eq(benchmarkProposals.status, "approved"),
        eq(benchmarkProposals.recommendation, "publish"),
        isNotNull(benchmarkProposals.reviewedAt),
        lte(benchmarkProposals.reviewedAt, evaluationClock),
        or(
          isNull(benchmarkProposals.orgId),
          eq(benchmarkProposals.orgId, context.organizationId)
        )
      )
    );
  const approvedSuccessors = new Map<number, number>();
  for (const successor of successorRows) {
    if (
      successor.supersedesId !== null &&
      successor.reviewedAt !== null &&
      successor.reviewedAt.getTime() <= evaluationClock.getTime()
    ) {
      approvedSuccessors.set(successor.supersedesId, successor.id);
    }
  }
  const visibleQuoteIds = rows
    .filter(
      row =>
        row.supplierQuoteId !== null &&
        row.proposalOrganizationId === context.organizationId &&
        row.quoteOrganizationId === context.organizationId
    )
    .map(row => row.supplierQuoteId as number);
  const quoteSuccessors =
    visibleQuoteIds.length === 0
      ? []
      : await db
          .select({
            id: supplierQuotes.id,
            supersedesId: supplierQuotes.supersedesId,
          })
          .from(supplierQuotes)
          .where(
            and(
              inArray(supplierQuotes.supersedesId, visibleQuoteIds),
              eq(supplierQuotes.orgId, context.organizationId),
              lte(supplierQuotes.receivedAt, evaluationClock)
            )
          );
  const supersededQuotes = new Map<number, number>();
  for (const successor of quoteSuccessors) {
    if (successor.supersedesId !== null) {
      supersededQuotes.set(successor.supersedesId, successor.id);
    }
  }
  return rows
    .filter(row => {
      if (
        row.reviewedAt === null ||
        row.reviewedAt.getTime() > evaluationClock.getTime()
      ) {
        return false;
      }
      if (row.supplierQuoteId === null) return true;
      return (
        row.proposalOrganizationId === context.organizationId &&
        row.quoteOrganizationId === context.organizationId
      );
    })
    .map(row => ({
      id: row.id,
      specId: row.specId,
      proposalScope:
        row.proposalOrganizationId === null
          ? ("platform_public" as const)
          : ("organization" as const),
      priceScope: row.priceScope,
      sourceKind: row.sourceKind,
      sourceLadderRung: row.sourceLadderRung,
      benchmarkVersionId: row.benchmarkVersionId,
      benchmarkVersion: row.benchmarkVersion,
      supplierQuoteId: row.supplierQuoteId,
      proposalSupersedesId: row.proposalSupersedesId,
      supersededByApprovedProposalId: approvedSuccessors.get(row.id) ?? null,
      sourceLabel: row.sourceLabel,
      priceConfidence: row.priceConfidence,
      provenancePolicyVersion: row.provenancePolicyVersion,
      keyPolicyVersion: row.keyPolicyVersion,
      proposedP25: row.proposedP25,
      proposedP50: row.proposedP50,
      proposedP75: row.proposedP75,
      weightedMean: row.weightedMean,
      specification:
        row.specId === null
          ? null
          : {
              category: row.specificationCategory,
              finishLevel: row.specificationFinishLevel,
              unitBasis: row.specificationUnitBasis,
              geography: row.specificationGeography,
            },
      recommendation: row.recommendation,
      status: row.status,
      humanApprovalComplete:
        row.status === "approved" &&
        row.reviewedBy !== null &&
        row.reviewedAt !== null,
      reviewedAt: row.reviewedAt,
      proposalCreatedAt: row.createdAt,
      observationAt:
        row.sourceLadderRung === "supplier_quote" ? row.quoteReceivedAt : null,
      supplierQuote:
        row.supplierQuoteId === null
          ? null
          : {
              id: row.supplierQuoteId,
              receivedAt: row.quoteReceivedAt,
              validUntil: row.quoteValidUntil,
              supersedesId: row.quoteSupersedesId,
              supersededByQuoteId:
                supersededQuotes.get(row.supplierQuoteId) ?? null,
            },
    }));
}

type IncidentReferenceInput = {
  ingestionRunId?: string | null;
  evidenceRecordId?: number | null;
  snapshotId?: number | null;
};

async function assertIncidentReferences(
  tx: any,
  scope: ClaimHealthScope,
  sourceIdentity: string,
  sourceRegistryId: number | null,
  references: IncidentReferenceInput
) {
  if (references.ingestionRunId) {
    if (scope.scope !== "platform") {
      throw new ClaimHealthStoreError(
        "INVALID",
        "Ingestion runs may only support platform incidents"
      );
    }
    const runs = await tx
      .select({ runId: ingestionRuns.runId })
      .from(ingestionRuns)
      .where(eq(ingestionRuns.runId, references.ingestionRunId))
      .limit(2)
      .for("update");
    if (runs.length !== 1) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
  }
  if (sourceRegistryId !== null) {
    const sources = await tx
      .select({ id: sourceRegistry.id, slug: sourceRegistry.slug })
      .from(sourceRegistry)
      .where(eq(sourceRegistry.id, sourceRegistryId))
      .limit(2)
      .for("update");
    if (sources.length !== 1) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    if (
      sources[0].slug !== null &&
      sources[0].slug !== sourceIdentity &&
      String(sources[0].id) !== sourceIdentity
    ) {
      throw new ClaimHealthStoreError(
        "INVALID",
        "Source identity does not match its registry reference"
      );
    }
  }
  if (references.evidenceRecordId) {
    positiveInteger(references.evidenceRecordId, "evidenceRecordId");
    const evidence = await tx
      .select({
        orgId: evidenceRecords.orgId,
        projectId: evidenceRecords.projectId,
        supplierQuoteId: evidenceRecords.supplierQuoteId,
        corpusScope: evidenceRecords.corpusScope,
      })
      .from(evidenceRecords)
      .where(eq(evidenceRecords.id, references.evidenceRecordId))
      .limit(2)
      .for("update");
    const row = evidence[0];
    const valid =
      row &&
      ((scope.scope === "platform" &&
        row.orgId === null &&
        row.projectId === null &&
        row.supplierQuoteId === null &&
        row.corpusScope === "platform_public") ||
        (scope.scope === "organization" &&
          row.orgId === scope.organizationId &&
          row.corpusScope === "organization") ||
        (scope.scope === "project" &&
          row.orgId === scope.organizationId &&
          row.projectId === scope.projectId &&
          row.corpusScope === "organization") ||
        (scope.scope === "supplier_quote" &&
          row.orgId === scope.organizationId &&
          row.supplierQuoteId === scope.supplierQuoteId &&
          row.corpusScope === "organization"));
    if (!valid) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
  }
  if (references.snapshotId) {
    positiveInteger(references.snapshotId, "snapshotId");
    const snapshots = await tx
      .select({
        scope: claimHealthSnapshots.scope,
        organizationId: claimHealthSnapshots.organizationId,
        projectId: claimHealthSnapshots.projectId,
        supplierQuoteId: claimHealthSnapshots.supplierQuoteId,
      })
      .from(claimHealthSnapshots)
      .where(eq(claimHealthSnapshots.id, references.snapshotId))
      .limit(2)
      .for("update");
    const row = snapshots[0];
    if (
      !row ||
      row.scope !== scope.scope ||
      row.organizationId !==
        (scope.scope === "platform" ? null : scope.organizationId) ||
      row.projectId !== (scope.scope === "project" ? scope.projectId : null) ||
      row.supplierQuoteId !==
        (scope.scope === "supplier_quote" ? scope.supplierQuoteId : null)
    ) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
  }
}

async function appendIncidentEvent(
  tx: any,
  incident: typeof sourceIncidents.$inferSelect,
  eventType: "opened" | "acknowledged" | "resolved" | "reopened",
  input: {
    severity: ClaimHealthIncidentSeverity;
    reason: string;
    effectiveAt: Date;
    policyVersionId: number;
    idempotencyKey: string;
  } & IncidentReferenceInput,
  context: IncidentActorContext
) {
  const scope = scopeFromIncident(incident);
  const actor = await assertIncidentActor(tx, scope, context);
  if (
    context.kind === "system_detector" &&
    eventType !== "opened" &&
    eventType !== "reopened"
  ) {
    throw new ClaimHealthStoreError(
      "FORBIDDEN",
      "System detectors may only open or reopen platform incidents"
    );
  }
  const effectiveAt = normalizedDate(input.effectiveAt, "effectiveAt");
  const policy = await approvedPolicy(tx, input.policyVersionId, effectiveAt);
  const idempotencyKey = boundedText(
    input.idempotencyKey,
    "idempotencyKey",
    128
  );
  const reason = boundedText(input.reason, "reason", 4_000);
  const severity = resolveClaimHealthIncidentSeverity(
    incident.incidentType as ClaimHealthIncidentType,
    input.severity
  );
  const references = {
    ingestionRunId: input.ingestionRunId
      ? boundedText(input.ingestionRunId, "ingestionRunId", 64)
      : null,
    evidenceRecordId: input.evidenceRecordId ?? null,
    snapshotId: input.snapshotId ?? null,
  };
  await assertIncidentReferences(
    tx,
    scope,
    incident.sourceIdentity,
    incident.sourceRegistryId,
    references
  );
  const requestDigest = claimHealthDigest({
    incidentId: incident.id,
    eventType,
    severity,
    reason,
    effectiveAt,
    policyVersion: policy.version,
    references,
    actorIdentity: actor.actorIdentity,
    actorSessionIdentity: actor.actorSessionIdentity,
    detectorPolicyVersion: actor.detectorPolicyVersion,
    auditIdentity: actor.auditIdentity,
  });
  const replay = await tx
    .select()
    .from(sourceIncidentEvents)
    .where(
      and(
        eq(sourceIncidentEvents.incidentId, incident.id),
        eq(sourceIncidentEvents.actorIdentity, actor.actorIdentity),
        eq(sourceIncidentEvents.idempotencyKey, idempotencyKey)
      )
    )
    .limit(2)
    .for("update");
  if (replay[0]) {
    if (replay[0].requestDigest !== requestDigest) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "Idempotency key was used for a different incident transition"
      );
    }
    return replay[0];
  }
  const latest = await tx
    .select({
      eventSequence: sourceIncidentEvents.eventSequence,
      resultingState: sourceIncidentEvents.resultingState,
      effectiveAt: sourceIncidentEvents.effectiveAt,
    })
    .from(sourceIncidentEvents)
    .where(eq(sourceIncidentEvents.incidentId, incident.id))
    .orderBy(desc(sourceIncidentEvents.eventSequence))
    .limit(1)
    .for("update");
  const prior = latest[0]?.resultingState ?? "absent";
  if (
    effectiveAt.getTime() < incident.openedAt.getTime() ||
    (latest[0] && effectiveAt.getTime() < latest[0].effectiveAt.getTime())
  ) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      "Incident event clock precedes the incident lifecycle"
    );
  }
  const resultingState = resolveClaimHealthIncidentTransition(prior, eventType);
  if (!resultingState) {
    throw new ClaimHealthStoreError(
      "CONFLICT",
      `Incident transition ${prior} -> ${eventType} is not permitted`
    );
  }
  const eventSequence = (latest[0]?.eventSequence ?? 0) + 1;
  const result = await tx.insert(sourceIncidentEvents).values({
    incidentId: incident.id,
    eventSequence,
    eventType,
    resultingState,
    severity,
    blockingEffect: severity === "blocking",
    ...actor,
    reason,
    effectiveAt,
    policyVersionId: policy.id,
    ...references,
    idempotencyKey,
    requestDigest,
  });
  const id = Number(result[0].insertId);
  return (
    await tx
      .select()
      .from(sourceIncidentEvents)
      .where(eq(sourceIncidentEvents.id, id))
      .limit(1)
  )[0];
}

export async function openSourceIncident(
  input: ClaimHealthScope & {
    incidentKey: string;
    sourceRegistryId?: number | null;
    sourceIdentity: string;
    incidentType: ClaimHealthIncidentType;
    openedAt: Date;
    severity: ClaimHealthIncidentSeverity;
    reason: string;
    policyVersionId: number;
    idempotencyKey: string;
  } & IncidentReferenceInput,
  context: IncidentActorContext
) {
  assertDisposableIncidentPersistence();
  const db = await database();
  return withClaimHealthTransaction(db, async tx => {
    await assertScopedResources(tx, input);
    await assertIncidentActor(tx, input, context);
    const policy = await approvedPolicy(tx, input.policyVersionId);
    const incidentKey = boundedText(input.incidentKey, "incidentKey", 128);
    const sourceIdentity = boundedText(
      input.sourceIdentity,
      "sourceIdentity",
      255
    );
    const sourceRegistryId = input.sourceRegistryId
      ? positiveInteger(input.sourceRegistryId, "sourceRegistryId")
      : null;
    await assertIncidentReferences(
      tx,
      input,
      sourceIdentity,
      sourceRegistryId,
      {
        ingestionRunId: input.ingestionRunId,
        evidenceRecordId: input.evidenceRecordId,
        snapshotId: input.snapshotId,
      }
    );
    const openedAt = normalizedDate(input.openedAt, "openedAt");
    await tx
      .insert(sourceIncidents)
      .ignore()
      .values({
        incidentKey,
        ...scopeColumns(input),
        sourceRegistryId,
        sourceIdentity,
        incidentType: input.incidentType,
        openedAt,
        openedUnderPolicyVersionId: policy.id,
      });
    const incident = (
      await tx
        .select()
        .from(sourceIncidents)
        .where(eq(sourceIncidents.incidentKey, incidentKey))
        .limit(2)
        .for("update")
    )[0];
    if (!incident) {
      throw new ClaimHealthStoreError(
        "CONFLICT",
        "Incident identity could not be established"
      );
    }
    const expectedScope = scopeColumns(input);
    if (
      incident.scope !== expectedScope.scope ||
      incident.organizationId !== expectedScope.organizationId ||
      incident.projectId !== expectedScope.projectId ||
      incident.supplierQuoteId !== expectedScope.supplierQuoteId ||
      incident.sourceRegistryId !== sourceRegistryId ||
      incident.sourceIdentity !== sourceIdentity ||
      incident.incidentType !== input.incidentType ||
      incident.openedAt.getTime() !== openedAt.getTime() ||
      incident.openedUnderPolicyVersionId !== policy.id
    ) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    const event = await appendIncidentEvent(
      tx,
      incident,
      "opened",
      {
        severity: input.severity,
        reason: input.reason,
        effectiveAt: input.openedAt,
        policyVersionId: input.policyVersionId,
        idempotencyKey: input.idempotencyKey,
        ingestionRunId: input.ingestionRunId,
        evidenceRecordId: input.evidenceRecordId,
        snapshotId: input.snapshotId,
      },
      context
    );
    return { incident, event };
  });
}

export async function transitionSourceIncident(
  input: {
    incidentId: number;
    eventType: "acknowledged" | "resolved" | "reopened";
    severity: ClaimHealthIncidentSeverity;
    reason: string;
    effectiveAt: Date;
    policyVersionId: number;
    idempotencyKey: string;
  } & IncidentReferenceInput,
  context: IncidentActorContext
) {
  assertDisposableIncidentPersistence();
  const db = await database();
  return withClaimHealthTransaction(db, async tx => {
    const incidentId = positiveInteger(input.incidentId, "incidentId");
    const incident = (
      await tx
        .select()
        .from(sourceIncidents)
        .where(eq(sourceIncidents.id, incidentId))
        .limit(2)
        .for("update")
    )[0];
    if (!incident) {
      throw new ClaimHealthStoreError(
        "CONCEALED",
        "Claim-health resource not found"
      );
    }
    const event = await appendIncidentEvent(
      tx,
      incident,
      input.eventType,
      input,
      context
    );
    return { incident, event };
  });
}

export async function getSourceIncidentHistory(
  incidentId: number,
  context: PlatformAdminContext | OrganizationAdminContext
) {
  assertDisposableIncidentPersistence();
  const db = await database();
  const id = positiveInteger(incidentId, "incidentId");
  return withClaimHealthTransaction(db, async tx => {
    const incident = (
      await tx
        .select()
        .from(sourceIncidents)
        .where(eq(sourceIncidents.id, id))
        .limit(2)
        .for("update")
    )[0];
    if (!incident) return null;
    const scope = scopeFromIncident(incident);
    await assertIncidentActor(tx, scope, context);
    const events = await tx
      .select()
      .from(sourceIncidentEvents)
      .where(eq(sourceIncidentEvents.incidentId, id))
      .orderBy(sourceIncidentEvents.eventSequence);
    return { incident, events };
  });
}

export type EffectiveClaimIncidentState = "none" | "advisory" | "blocking";

function createIncidentAuthorityRevisionDigest(
  evaluationClock: Date,
  sourceIdentity: string,
  incidents: readonly (typeof sourceIncidents.$inferSelect)[],
  latestByIncident: ReadonlyMap<
    number,
    {
      id: number;
      eventSequence: number;
      resultingState: "open" | "acknowledged" | "resolved";
      severity: "advisory" | "blocking";
      blockingEffect: boolean;
      effectiveAt: Date;
      policyVersionId: number;
      requestDigest: string;
    }
  >
) {
  return claimHealthDigest({
    evaluationClock,
    sourceIdentity,
    incidents: incidents
      .filter(incident => incident.sourceIdentity === sourceIdentity)
      .map(incident => {
        const event = latestByIncident.get(incident.id);
        return {
          incidentId: incident.id,
          scope: incident.scope,
          organizationId: incident.organizationId,
          projectId: incident.projectId,
          supplierQuoteId: incident.supplierQuoteId,
          incidentType: incident.incidentType,
          openedAt: incident.openedAt,
          event: event
            ? {
                id: event.id,
                eventSequence: event.eventSequence,
                resultingState: event.resultingState,
                severity: event.severity,
                blockingEffect: event.blockingEffect,
                effectiveAt: event.effectiveAt,
                policyVersionId: event.policyVersionId,
                requestDigest: event.requestDigest,
              }
            : null,
        };
      }),
  });
}

export async function getEffectiveClaimIncidentStates(
  input: {
    evaluationClock: Date;
    organizationId: number;
    projectId?: number | null;
    supplierQuoteId?: number | null;
    sourceIdentities: string[];
  },
  context: OrganizationMemberContext | OrganizationAdminContext
) {
  const db = await database();
  const organizationId = positiveInteger(
    input.organizationId,
    "organizationId"
  );
  if (context.organizationId !== organizationId) {
    throw new ClaimHealthStoreError(
      "CONCEALED",
      "Claim-health resource not found"
    );
  }
  const sourceIdentities = Array.from(new Set(input.sourceIdentities))
    .map(identity => boundedText(identity, "sourceIdentity", 255))
    .sort();
  if (sourceIdentities.length > 500) {
    throw new ClaimHealthStoreError(
      "INVALID",
      "At most 500 source identities may be evaluated"
    );
  }
  if (sourceIdentities.length === 0) return [];
  const evaluationClock = normalizedDate(
    input.evaluationClock,
    "evaluationClock"
  );
  const projectId = input.projectId
    ? positiveInteger(input.projectId, "projectId")
    : null;
  const supplierQuoteId = input.supplierQuoteId
    ? positiveInteger(input.supplierQuoteId, "supplierQuoteId")
    : null;
  return withClaimHealthTransaction(db, async tx => {
    await assertOrganizationMember(tx, context, false);
    if (projectId !== null) {
      await assertScopedResources(tx, {
        scope: "project",
        organizationId,
        projectId,
      });
    }
    if (supplierQuoteId !== null) {
      await assertScopedResources(tx, {
        scope: "supplier_quote",
        organizationId,
        supplierQuoteId,
      });
    }
    const incidents: Array<typeof sourceIncidents.$inferSelect> = await tx
      .select()
      .from(sourceIncidents)
      .where(
        and(
          inArray(sourceIncidents.sourceIdentity, sourceIdentities),
          lte(sourceIncidents.openedAt, evaluationClock),
          or(
            and(
              eq(sourceIncidents.scope, "platform"),
              isNull(sourceIncidents.organizationId),
              isNull(sourceIncidents.projectId),
              isNull(sourceIncidents.supplierQuoteId)
            ),
            and(
              eq(sourceIncidents.scope, "organization"),
              eq(sourceIncidents.organizationId, organizationId),
              isNull(sourceIncidents.projectId),
              isNull(sourceIncidents.supplierQuoteId)
            ),
            projectId === null
              ? undefined
              : and(
                  eq(sourceIncidents.scope, "project"),
                  eq(sourceIncidents.organizationId, organizationId),
                  eq(sourceIncidents.projectId, projectId),
                  isNull(sourceIncidents.supplierQuoteId)
                ),
            supplierQuoteId === null
              ? undefined
              : and(
                  eq(sourceIncidents.scope, "supplier_quote"),
                  eq(sourceIncidents.organizationId, organizationId),
                  isNull(sourceIncidents.projectId),
                  eq(sourceIncidents.supplierQuoteId, supplierQuoteId)
                )
          )
        )
      )
      .orderBy(asc(sourceIncidents.id));
    if (incidents.length === 0) {
      return sourceIdentities.map(sourceIdentity => ({
        sourceIdentity,
        platform: "none" as const,
        organization: "none" as const,
        project: "none" as const,
        supplierQuote: "none" as const,
        aggregate: "none" as const,
        authorityRevisionDigest: createIncidentAuthorityRevisionDigest(
          evaluationClock,
          sourceIdentity,
          [],
          new Map()
        ),
      }));
    }
    const events: Array<{
      id: number;
      incidentId: number;
      eventSequence: number;
      resultingState: "open" | "acknowledged" | "resolved";
      severity: "advisory" | "blocking";
      blockingEffect: boolean;
      effectiveAt: Date;
      policyVersionId: number;
      requestDigest: string;
    }> = await tx
      .select({
        id: sourceIncidentEvents.id,
        incidentId: sourceIncidentEvents.incidentId,
        eventSequence: sourceIncidentEvents.eventSequence,
        resultingState: sourceIncidentEvents.resultingState,
        severity: sourceIncidentEvents.severity,
        blockingEffect: sourceIncidentEvents.blockingEffect,
        effectiveAt: sourceIncidentEvents.effectiveAt,
        policyVersionId: sourceIncidentEvents.policyVersionId,
        requestDigest: sourceIncidentEvents.requestDigest,
      })
      .from(sourceIncidentEvents)
      .where(
        and(
          inArray(
            sourceIncidentEvents.incidentId,
            incidents.map(incident => incident.id)
          ),
          lte(sourceIncidentEvents.effectiveAt, evaluationClock)
        )
      )
      .orderBy(
        asc(sourceIncidentEvents.incidentId),
        asc(sourceIncidentEvents.eventSequence)
      );
    const latestByIncident = new Map<number, (typeof events)[number]>();
    for (const event of events) {
      latestByIncident.set(event.incidentId, event);
    }
    const bySource = new Map<
      string,
      {
        platform: EffectiveClaimIncidentState;
        organization: EffectiveClaimIncidentState;
        project: EffectiveClaimIncidentState;
        supplierQuote: EffectiveClaimIncidentState;
      }
    >();
    for (const sourceIdentity of sourceIdentities) {
      bySource.set(sourceIdentity, {
        platform: "none",
        organization: "none",
        project: "none",
        supplierQuote: "none",
      });
    }
    for (const incident of incidents) {
      const event = latestByIncident.get(incident.id);
      if (
        !event ||
        event.resultingState === "resolved" ||
        (!event.blockingEffect && event.severity !== "advisory")
      ) {
        continue;
      }
      const state: EffectiveClaimIncidentState = event.blockingEffect
        ? "blocking"
        : "advisory";
      const target = bySource.get(incident.sourceIdentity);
      if (!target) continue;
      const key: "platform" | "organization" | "project" | "supplierQuote" =
        incident.scope === "supplier_quote" ? "supplierQuote" : incident.scope;
      const composed = composeClaimHealthIncidentStates([target[key], state]);
      target[key] = composed === "unknown" ? "none" : composed;
    }
    return sourceIdentities.map(sourceIdentity => {
      const states = bySource.get(sourceIdentity)!;
      return {
        sourceIdentity,
        ...states,
        aggregate: composeClaimHealthIncidentStates([
          states.platform,
          states.organization,
          states.project,
          states.supplierQuote,
        ]) as EffectiveClaimIncidentState,
        authorityRevisionDigest: createIncidentAuthorityRevisionDigest(
          evaluationClock,
          sourceIdentity,
          incidents,
          latestByIncident
        ),
      };
    });
  });
}
