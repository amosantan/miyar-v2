import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import * as db from "../../server/db";
import {
  ClaimHealthStoreError,
  EV04_POLICY_VERSION,
  EV04_REQUIRED_CELL_SCHEMA_VERSION,
  assertEv04ClaimHealthRecoverySafe,
  claimHealthDigest,
  createReportPublicShare,
  createClaimHealthSnapshot,
  ensureApprovedClaimHealthPolicySeed,
  getEffectiveClaimIncidentStates,
  getVerifiedReportClaimHealthProjection,
  getSourceIncidentHistory,
  listActiveReportPublicShares,
  listClaimHealthBenchmarkFacts,
  openSourceIncident,
  resolveApprovedClaimHealthPolicy,
  resolveReportPublicShare,
  revokeReportPublicShare,
  transitionSourceIncident,
  verifyProjectClaimHealthAuthorityBinding,
} from "../../server/db/claim-health";
import {
  createClaimHealthGovernedSourceRevision,
  type ProjectClaimHealthAuthorityBinding,
} from "../../server/engines/ingestion/project-claim-health-loader";
import {
  CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON,
  CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
  canonicalizeClaimHealth,
  createClaimHealthDigests,
  evaluateClaimHealth,
} from "../../server/engines/ingestion/claim-health";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(databaseUrl);

const platformAdmin = {
  kind: "platform_admin" as const,
  userId: 94001,
  sessionIdentity: "ev04-platform-session",
};
const organizationAdmin = {
  kind: "organization_admin" as const,
  organizationId: 9401,
  userId: 94101,
  sessionIdentity: "ev04-org-session",
};
const organizationMember = {
  kind: "organization_member" as const,
  organizationId: 9401,
  userId: 94101,
  sessionIdentity: "ev04-org-session",
};
const foreignOrganizationAdmin = {
  kind: "organization_admin" as const,
  organizationId: 9402,
  userId: 94201,
  sessionIdentity: "ev04-foreign-org-session",
};

function exactMaterialCell(
  consumer: "project_workspace" | "stored_project_report"
) {
  return {
    cellId: `material:${consumer}:1`,
    catalogueId:
      consumer === "stored_project_report"
        ? ("project-report-material-v1" as const)
        : ("material-project-v1" as const),
    requirement: "required" as const,
    key: {
      consumer,
      domain: "material_price" as const,
      category: "floors",
      geography: "dubai",
      finishTier: "premium",
      unitBasis: "per_sqm",
      priceScope: "supply_only",
      requiredAuthorityClass: "governed_benchmark" as const,
    },
    match: "exact" as const,
    authority: "governed_benchmark" as const,
    eligibility: "eligible" as const,
    freshness: "current" as const,
    cadence: "on_time" as const,
    quality: "pass" as const,
    confidence: "known" as const,
    incident: "none" as const,
    observationDateStatus: "valid" as const,
    quoteValidity: "not_applicable" as const,
    successfulRun: "valid" as const,
    slaConfigured: true,
    provenanceIdentityKnown: true,
    fallbackCode: null,
    observedThrough: "2026-07-29T00:00:00.000Z",
  };
}

async function resetFixtures() {
  await pool.query("set foreign_key_checks=0");
  for (const table of [
    "report_public_share",
    "source_incident_event",
    "source_incident",
    "claim_health_snapshot",
    "report_instances",
    "benchmark_proposals",
    "benchmark_versions",
    "specification",
    "supplier_quote",
    "source_registry",
    "material_allocations",
    "score_matrices",
    "projects",
    "organization_members",
    "users",
    "organizations",
  ]) {
    await pool.query(`truncate table \`${table}\``);
  }
  await pool.query("set foreign_key_checks=1");
  await pool.query(
    `insert into organizations (id,name,slug)
     values (9401,'EV04 Organization A','ev04-org-a'),
            (9402,'EV04 Organization B','ev04-org-b')`
  );
  await pool.query(
    `insert into users (id,openId,role,orgId)
     values (94001,'ev04-platform-admin','admin',NULL),
            (94101,'ev04-org-admin','user',9401),
            (94201,'ev04-foreign-admin','user',9402)`
  );
  await pool.query(
    `insert into organization_members (orgId,userId,role)
     values (9401,94101,'admin'),(9402,94201,'admin')`
  );
  await pool.query(
    `insert into projects (id,userId,orgId,name)
     values (9411,94101,9401,'EV04 Project A'),
            (9421,94201,9402,'EV04 Project B')`
  );
  await pool.query(
    `insert into source_registry
      (id,name,slug,url,sourceType)
     values
      (9431,'EV04 Synthetic Source','ev04-source',
       'https://example.invalid/ev04','other')`
  );
  await ensureApprovedClaimHealthPolicySeed();
}

beforeEach(resetFixtures);
afterAll(async () => {
  await pool.end();
});

async function approvedPolicy() {
  return resolveApprovedClaimHealthPolicy({
    version: EV04_POLICY_VERSION,
    requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
    asOf: new Date("2026-07-30T12:00:00Z"),
  });
}

const FINAL_PERSISTENCE_CLOCK = new Date("2026-07-30T15:00:00.000Z");

async function seedFinalPersistenceAuthorityFixture(): Promise<ProjectClaimHealthAuthorityBinding> {
  await pool.query(
    `update source_registry
     set termsDecision='approved',isActive=true,isWhitelisted=true,
         updatedAt='2026-07-29 00:00:00'
     where id=9431`
  );
  await pool.query(
    `insert into specification
      (id,specKey,category,finishLevel,unitBasis,geography,policyVersion)
     values
      (9451,'floors:premium:per_sqm:dubai','floors','premium','per_sqm',
       'dubai','ev02-spec-key-v1')`
  );
  await pool.query(
    `insert into benchmark_versions
      (id,versionTag,status,publishedAt,recordCount)
     values (9461,'ev04-authority-v1','published','2026-07-01',1)`
  );
  await pool.query(
    `insert into supplier_quote
      (id,orgId,supplierName,quoteRef,receivedAt,validUntil,createdBy)
     values
      (9471,9401,'Authority Supplier','AUTH-1','2026-07-01',
       '2026-08-30',94101)`
  );
  await pool.query(
    `insert into benchmark_proposals
      (id,benchmarkKey,specId,orgId,priceScope,sourceKind,sourceLadderRung,
       benchmarkVersionId,supplierQuoteId,sourceLabel,
       provenancePolicyVersion,proposedP25,proposedP50,proposedP75,
       weightedMean,evidenceCount,sourceDiversity,reliabilityDist,recencyDist,
       confidenceScore,recommendation,status,reviewedBy,reviewedAt,createdAt)
     values
      (9481,'floors:premium:per_sqm:dubai',9451,9401,'supply_only',
       'observed','official_statistic',9461,9471,'Authority source',
       'ev02-provenance-v1','100','110','120','111',1,1,
       JSON_OBJECT('A',1),JSON_OBJECT('recent',1),95,'publish','approved',
       94101,'2026-07-29','2026-07-01')`
  );
  await pool.query(
    `insert into material_allocations
      (id,projectId,organizationId,roomId,roomName,element,materialName,
       allocationPct,surfaceAreaM2,resolutionState,resolvedUnitBasis,isLocked)
     values
      (9501,9411,9401,'R1','Room 1','floor','Authority material',
       '100','10','resolved','per_sqm',true)`
  );
  const incidentAuthority = (
    await getEffectiveClaimIncidentStates(
      {
        evaluationClock: FINAL_PERSISTENCE_CLOCK,
        organizationId: 9401,
        projectId: 9411,
        supplierQuoteId: 9471,
        sourceIdentities: ["ev04-source"],
      },
      organizationMember
    )
  )[0];
  const sourcePolicyVersion = "ev04-source-eligibility-v1";
  const sourceRevision = createClaimHealthGovernedSourceRevision({
    sourceRegistryId: 9431,
    sourceSlug: "ev04-source",
    termsDecision: "approved",
    sourceActive: true,
    sourceWhitelisted: true,
    sourcePolicyVersion,
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
  });
  const unsigned = {
    version: "ev04-authority-binding-v1" as const,
    organizationId: 9401,
    projectId: 9411,
    evaluationClock: FINAL_PERSISTENCE_CLOCK.toISOString(),
    entries: [
      {
        allocationId: 9501,
        materialLibraryId: null,
        resolvedUnitBasis: "per_sqm",
        resolutionState: "resolved" as const,
        materialResolutionPolicyVersion: "ev03-material-resolution-v1",
        benchmarkProposalId: 9481,
        benchmarkVersionId: 9461,
        benchmarkVersion: "ev04-authority-v1",
        specificationId: 9451,
        productId: null,
        supplierQuoteId: 9471,
        provenancePolicyVersion: "ev02-provenance-v1",
        sourceLadderRung: "official_statistic" as const,
        governedSourceIdentity: "ev04-source",
        sourceRegistryId: 9431,
        sourceSlug: "ev04-source",
        sourcePolicyVersion,
        sourceRevision,
        sourceEligibilityDigest: claimHealthDigest({
          governedSourceRegistryId: 9431,
          governedSourceSlug: "ev04-source",
        }),
        incidentState: "none" as const,
        incidentAuthorityRevisionDigest:
          incidentAuthority.authorityRevisionDigest,
      },
    ],
  };
  return { ...unsigned, digest: claimHealthDigest(unsigned) };
}

async function expectFinalPersistenceConflict(
  binding: ProjectClaimHealthAuthorityBinding
) {
  await pool.query(
    `insert into score_matrices
      (id,projectId,modelVersionId,saScore,ffScore,mpScore,dsScore,erScore,
       compositeScore,riskScore,rasScore,confidenceScore,decisionStatus,
       dimensionWeights,variableContributions,inputSnapshot)
     values
      (9591,9411,1,60,60,60,60,60,60,40,60,80,'validated',
       JSON_OBJECT(),JSON_OBJECT(),JSON_OBJECT())`
  );
  const evaluationInput = {
    policyVersion: EV04_POLICY_VERSION,
    policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
    requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
    evaluatedAt: FINAL_PERSISTENCE_CLOCK,
    artifactSnapshot: "present" as const,
    cells: [exactMaterialCell("stored_project_report")],
  };
  const evaluation = evaluateClaimHealth(evaluationInput);
  await expect(
    db.createReportArtifactsForOrg({
      projectId: 9411,
      orgId: 9401,
      expectedMaterialPricingRevision: 1,
      report: {
        projectId: 9411,
        scoreMatrixId: 9591,
        reportType: "full_report",
        content: { claimHealth: evaluation.safeProjection },
        generatedBy: 94101,
      },
      claimHealthSnapshot: {
        evaluationClock: FINAL_PERSISTENCE_CLOCK,
        evaluationInput,
        evaluation,
        digests: createClaimHealthDigests(evaluationInput, evaluation),
        authorityBinding: binding,
        actorUserId: 94101,
        actorSessionIdentity: "ev04-final-persistence-test",
      },
    })
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const [reports] = await pool.query<mysql.RowDataPacket[]>(
    "select id from report_instances where scoreMatrixId=9591"
  );
  expect(reports).toHaveLength(0);
}

describe("EV-04 additive persistence on disposable MySQL", () => {
  it("applies the forward shape and seeds explicit external approval provenance", async () => {
    const policy = await approvedPolicy();
    expect(policy).toMatchObject({
      version: EV04_POLICY_VERSION,
      requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
      status: "approved",
      approvedBy: null,
      approvedByIdentity: "Amro Saleh",
      policyDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
    });
    expect(claimHealthDigest(policy.policyDocument)).toBe(policy.policyDigest);
    expect(canonicalizeClaimHealth(policy.policyDocument)).toBe(
      CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON
    );
    expect((await ensureApprovedClaimHealthPolicySeed()).id).toBe(policy.id);
    const [checks] = await pool.query<mysql.RowDataPacket[]>(
      `select constraint_name
       from information_schema.table_constraints
       where constraint_schema=database()
         and table_name in
           ('claim_health_policy_version','claim_health_snapshot',
            'source_incident','source_incident_event')
         and constraint_type='CHECK'`
    );
    expect(checks.map(row => row.CONSTRAINT_NAME)).toEqual(
      expect.arrayContaining([
        "claim_health_policy_version_approval_check",
        "claim_health_snapshot_scope_check",
        "source_incident_scope_check",
        "source_incident_event_sequence_check",
      ])
    );
    const [triggers] = await pool.query<mysql.RowDataPacket[]>(
      `select trigger_name
       from information_schema.triggers
       where trigger_schema=database()
         and trigger_name like 'claim_health_%'
            or trigger_schema=database()
           and trigger_name like 'source_incident_%'`
    );
    expect(triggers.map(row => row.TRIGGER_NAME)).toHaveLength(0);
  });

  it("binds an immutable snapshot to one report and keeps legacy reports compatible", async () => {
    const policy = await approvedPolicy();
    await pool.query(
      `insert into report_instances
        (id,projectId,scoreMatrixId,reportType,content,generatedBy)
       values
        (9441,9411,1,'full_report',JSON_OBJECT('legacy',true),94101),
        (9442,9411,1,'full_report',JSON_OBJECT('ev04',true),94101)`
    );
    const evaluationInput = {
      policyVersion: EV04_POLICY_VERSION,
      policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
      requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
      evaluatedAt: new Date("2026-07-30T12:00:00.000Z"),
      artifactSnapshot: "present" as const,
      cells: [],
    };
    const evaluation = evaluateClaimHealth(evaluationInput);
    const digests = createClaimHealthDigests(evaluationInput, evaluation);
    const forgedEvaluation = {
      ...evaluation,
      safeProjection: {
        ...evaluation.safeProjection,
        state: "current" as const,
      },
    };
    await expect(
      createClaimHealthSnapshot(
        {
          scope: "project",
          organizationId: 9401,
          projectId: 9411,
          consumer: "stored_project_report",
          evaluationClock: new Date("2026-07-30T12:00:00.000Z"),
          policyVersionId: policy.id,
          evaluationInput,
          evaluation: forgedEvaluation,
          digests,
        },
        organizationMember
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const mismatchedConsumerInput = {
      ...evaluationInput,
      cells: [exactMaterialCell("project_workspace")],
    };
    const mismatchedConsumerEvaluation = evaluateClaimHealth(
      mismatchedConsumerInput
    );
    await expect(
      createClaimHealthSnapshot(
        {
          scope: "project",
          organizationId: 9401,
          projectId: 9411,
          consumer: "stored_project_report",
          evaluationClock: new Date("2026-07-30T12:00:00.000Z"),
          policyVersionId: policy.id,
          evaluationInput: mismatchedConsumerInput,
          evaluation: mismatchedConsumerEvaluation,
          digests: createClaimHealthDigests(
            mismatchedConsumerInput,
            mismatchedConsumerEvaluation
          ),
        },
        organizationMember
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const snapshot = await createClaimHealthSnapshot(
      {
        scope: "project",
        organizationId: 9401,
        projectId: 9411,
        consumer: "stored_project_report",
        evaluationClock: new Date("2026-07-30T12:00:00.000Z"),
        policyVersionId: policy.id,
        reportInstanceId: 9442,
        evaluationInput,
        evaluation,
        digests,
      },
      organizationMember
    );
    expect(snapshot.evaluationClock.toISOString()).toBe(
      "2026-07-30T12:00:00.000Z"
    );
    expect(snapshot.inputDigest).toBe(digests.inputDigest);
    expect(snapshot.contentDigest).toBe(digests.contentDigest);
    await expect(
      createClaimHealthSnapshot(
        {
          scope: "project",
          organizationId: 9401,
          projectId: 9411,
          consumer: "stored_project_report",
          evaluationClock: new Date("2026-07-30T12:00:00Z"),
          policyVersionId: policy.id,
          reportInstanceId: 9442,
          evaluationInput,
          evaluation,
          digests,
        },
        organizationMember
      )
    ).rejects.toBeTruthy();
    expect(
      await getVerifiedReportClaimHealthProjection({
        reportInstanceId: 9442,
        organizationId: 9401,
      })
    ).toEqual(evaluation.safeProjection);
    await pool.query(
      "update claim_health_snapshot set safeProjection=JSON_OBJECT('claimState','current') where id=?",
      [snapshot.id]
    );
    expect(
      await getVerifiedReportClaimHealthProjection({
        reportInstanceId: 9442,
        organizationId: 9401,
      })
    ).toBeNull();
    await pool.query(
      "update claim_health_snapshot set safeProjection=? where id=?",
      [JSON.stringify(evaluation.safeProjection), snapshot.id]
    );
    await pool.query(
      "update claim_health_policy_version set policyDigest=? where id=?",
      [`sha256:${"d".repeat(64)}`, policy.id]
    );
    expect(
      await getVerifiedReportClaimHealthProjection({
        reportInstanceId: 9442,
        organizationId: 9401,
      })
    ).toBeNull();
    await pool.query(
      "update claim_health_policy_version set policyDigest=? where id=?",
      [CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST, policy.id]
    );
    await pool.query("set foreign_key_checks=0");
    await pool.query(
      "update claim_health_snapshot set policyVersion='unsupported-v9' where id=?",
      [snapshot.id]
    );
    expect(
      await getVerifiedReportClaimHealthProjection({
        reportInstanceId: 9442,
        organizationId: 9401,
      })
    ).toBeNull();
    await pool.query(
      "update claim_health_snapshot set policyVersion=? where id=?",
      [EV04_POLICY_VERSION, snapshot.id]
    );
    await pool.query("set foreign_key_checks=1");
    expect(
      await getVerifiedReportClaimHealthProjection({
        reportInstanceId: 9441,
        organizationId: 9401,
      })
    ).toBeNull();
    const [legacy] = await pool.query<mysql.RowDataPacket[]>(
      `select r.id,s.id as snapshotId
       from report_instances r
       left join claim_health_snapshot s on s.reportInstanceId=r.id
       where r.id in (9441,9442)
       order by r.id`
    );
    expect(legacy).toEqual([
      { id: 9441, snapshotId: null },
      { id: 9442, snapshotId: snapshot.id },
    ]);
  });

  it("creates only hashed report shares and resolves a frozen minimal projection", async () => {
    const policy = await approvedPolicy();
    await pool.query(
      `insert into report_instances
        (id,projectId,scoreMatrixId,reportType,content,generatedBy,generatedAt)
       values
        (9443,9411,1,'full_report',JSON_OBJECT('locale','ar','secret','omit'),
         94101,'2026-07-30 12:00:00')`
    );
    const evaluationInput = {
      policyVersion: EV04_POLICY_VERSION,
      policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
      requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
      evaluatedAt: new Date("2026-07-30T12:00:00.000Z"),
      artifactSnapshot: "present" as const,
      cells: [exactMaterialCell("stored_project_report")],
    };
    const evaluation = evaluateClaimHealth(evaluationInput);
    await createClaimHealthSnapshot(
      {
        scope: "project",
        organizationId: 9401,
        projectId: 9411,
        consumer: "stored_project_report",
        evaluationClock: new Date("2026-07-30T12:00:00.000Z"),
        policyVersionId: policy.id,
        reportInstanceId: 9443,
        evaluationInput,
        evaluation,
        digests: createClaimHealthDigests(evaluationInput, evaluation),
      },
      organizationMember
    );
    const expiry = new Date("2026-08-30T00:00:00.000Z");
    const shares = await Promise.all(
      Array.from({ length: 8 }, () =>
        createReportPublicShare(
          {
            organizationId: 9401,
            reportInstanceId: 9443,
            expiresAt: expiry,
          },
          organizationAdmin
        )
      )
    );
    expect(new Set(shares.map(share => share.token)).size).toBe(8);
    expect(shares.every(share => /^[A-Za-z0-9_-]{43}$/.test(share.token))).toBe(
      true
    );
    const [stored] = await pool.query<mysql.RowDataPacket[]>(
      "select tokenHash from report_public_share order by id"
    );
    expect(stored).toHaveLength(8);
    expect(
      stored.every(
        row =>
          /^[0-9a-f]{64}$/.test(row.tokenHash) &&
          !shares.some(share => share.token === row.tokenHash)
      )
    ).toBe(true);
    const activeShares = await listActiveReportPublicShares(
      { organizationId: 9401, reportInstanceId: 9443 },
      organizationAdmin
    );
    expect(activeShares).toHaveLength(8);
    expect(
      activeShares.every(
        share =>
          Object.keys(share).sort().join(",") ===
            "active,createdAt,expiresAt,revokedAt,shareId" &&
          share.active === true &&
          share.revokedAt === null
      )
    ).toBe(true);
    await expect(
      listActiveReportPublicShares(
        { organizationId: 9401, reportInstanceId: 9443 },
        foreignOrganizationAdmin
      )
    ).rejects.toMatchObject({ code: "CONCEALED" });
    expect(
      await resolveReportPublicShare({
        token: shares[0].token,
        asOf: new Date("2026-07-31T00:00:00.000Z"),
      })
    ).toEqual({
      report: {
        reportType: "full_report",
        locale: "ar",
        generatedAt: new Date("2026-07-30T12:00:00.000Z"),
      },
      claimHealth: evaluation.safeProjection,
      expiresAt: expiry,
    });
    expect(
      await resolveReportPublicShare({
        token: shares[0].token,
        asOf: expiry,
      })
    ).toBeNull();
    expect(
      await resolveReportPublicShare({
        token: "invalid",
        asOf: new Date("2026-07-31T00:00:00.000Z"),
      })
    ).toBeNull();
    expect(
      await revokeReportPublicShare(
        { organizationId: 9401, shareId: shares[0].shareId },
        organizationAdmin
      )
    ).toBe(true);
    expect(
      await listActiveReportPublicShares(
        { organizationId: 9401, reportInstanceId: 9443 },
        organizationAdmin
      )
    ).toHaveLength(7);
    expect(
      await resolveReportPublicShare({
        token: shares[0].token,
        asOf: new Date("2026-07-31T00:00:00.000Z"),
      })
    ).toBeNull();
  });

  it("rejects mixed and foreign scopes at both schema and helper boundaries", async () => {
    const policy = await approvedPolicy();
    await pool.query(
      `insert into supplier_quote
        (id,orgId,supplierName,quoteRef,receivedAt,validUntil,createdBy)
       values
        (9491,9402,'Foreign Supplier','FOREIGN-QUOTE','2026-07-20',
         '2026-08-20',94201)`
    );
    await pool.query(
      `insert into report_instances
        (id,projectId,scoreMatrixId,reportType,content,generatedBy)
       values
        (9492,9421,1,'full_report',JSON_OBJECT('foreign',true),94201)`
    );
    await expect(
      pool.query(
        `insert into source_incident
          (incidentKey,scope,organizationId,projectId,sourceIdentity,
           incidentType,openedAt,openedUnderPolicyVersionId)
         values
          ('mixed-scope','organization',9401,9411,'ev04-source',
           'repeated_source_failure','2026-07-30 12:00:00',?)`,
        [policy.id]
      )
    ).rejects.toThrow();
    await expect(
      pool.query(
        `insert into source_incident
          (incidentKey,scope,organizationId,projectId,sourceRegistryId,
           sourceIdentity,incidentType,openedAt,openedUnderPolicyVersionId)
         values
          ('foreign-direct-project','project',9401,9421,9431,'ev04-source',
           'repeated_source_failure','2026-07-30 12:00:00',?)`,
        [policy.id]
      )
    ).rejects.toThrow();
    await expect(
      pool.query(
        `insert into source_incident
          (incidentKey,scope,organizationId,supplierQuoteId,sourceRegistryId,
           sourceIdentity,incidentType,openedAt,openedUnderPolicyVersionId)
         values
          ('foreign-direct-quote','supplier_quote',9401,9491,9431,
           'ev04-source','repeated_source_failure',
           '2026-07-30 12:00:00',?)`,
        [policy.id]
      )
    ).rejects.toThrow();
    await expect(
      pool.query(
        `insert into claim_health_snapshot
          (scope,organizationId,projectId,reportInstanceId,consumer,
           evaluationClock,policyVersionId,policyVersion,
           requiredCellSchemaVersion,requiredCellInputs,evaluatedResults,
           safeProjection,inputDigest,contentDigest,createdByUserId)
         values
          ('project',9401,9411,9492,'stored_project_report',
           '2026-07-30 12:00:00',?,'ev04-claim-health-v1',
           'ev04-required-cell-v1',JSON_OBJECT(),JSON_OBJECT(),JSON_OBJECT(),
           ?,?,94101)`,
        [policy.id, `sha256:${"a".repeat(64)}`, `sha256:${"b".repeat(64)}`]
      )
    ).rejects.toThrow();
    await expect(
      openSourceIncident(
        {
          scope: "project",
          organizationId: 9401,
          projectId: 9421,
          incidentKey: "foreign-project",
          sourceRegistryId: 9431,
          sourceIdentity: "ev04-source",
          incidentType: "repeated_source_failure",
          openedAt: new Date("2026-07-30T12:00:00Z"),
          severity: "advisory",
          reason: "foreign project must remain concealed",
          policyVersionId: policy.id,
          idempotencyKey: "foreign-project-open",
        },
        organizationAdmin
      )
    ).rejects.toMatchObject({ code: "CONCEALED" });
    await expect(
      openSourceIncident(
        {
          scope: "platform",
          incidentKey: "org-cannot-open-platform",
          sourceRegistryId: 9431,
          sourceIdentity: "ev04-source",
          incidentType: "repeated_source_failure",
          openedAt: new Date("2026-07-30T12:00:00Z"),
          severity: "advisory",
          reason: "wrong procedure boundary",
          policyVersionId: policy.id,
          idempotencyKey: "wrong-boundary",
        },
        organizationAdmin
      )
    ).rejects.toBeInstanceOf(ClaimHealthStoreError);

    const evaluationInput = {
      policyVersion: EV04_POLICY_VERSION,
      policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
      requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
      evaluatedAt: new Date("2026-07-30T12:00:00.000Z"),
      artifactSnapshot: "present" as const,
      cells: [exactMaterialCell("stored_project_report")],
    };
    const evaluation = evaluateClaimHealth(evaluationInput);
    const snapshot = await createClaimHealthSnapshot(
      {
        scope: "project",
        organizationId: 9401,
        projectId: 9411,
        consumer: "stored_project_report",
        evaluationClock: new Date("2026-07-30T12:00:00.000Z"),
        policyVersionId: policy.id,
        evaluationInput,
        evaluation,
        digests: createClaimHealthDigests(evaluationInput, evaluation),
      },
      organizationMember
    );
    const [incidentResult] = await pool.query<mysql.ResultSetHeader>(
      `insert into source_incident
        (incidentKey,scope,organizationId,sourceRegistryId,sourceIdentity,
         incidentType,openedAt,openedUnderPolicyVersionId)
       values
        ('foreign-event-snapshot','organization',9402,9431,'ev04-source',
         'repeated_source_failure','2026-07-30 12:00:00',?)`,
      [policy.id]
    );
    await expect(
      transitionSourceIncident(
        {
          incidentId: incidentResult.insertId,
          eventType: "acknowledged",
          severity: "advisory",
          reason: "forged cross-tenant snapshot",
          effectiveAt: new Date("2026-07-30T12:01:00Z"),
          policyVersionId: policy.id,
          snapshotId: snapshot.id,
          idempotencyKey: "foreign-event",
        },
        organizationAdmin
      )
    ).rejects.toMatchObject({ code: "CONCEALED" });
  });

  it("enforces actor-bound idempotency, closed transitions, and append-only events", async () => {
    const policy = await approvedPolicy();
    const opened = await openSourceIncident(
      {
        scope: "organization",
        organizationId: 9401,
        incidentKey: "org-source-failure",
        sourceRegistryId: 9431,
        sourceIdentity: "ev04-source",
        incidentType: "repeated_source_failure",
        openedAt: new Date("2026-07-30T12:00:00Z"),
        severity: "advisory",
        reason: "three consecutive source failures",
        policyVersionId: policy.id,
        idempotencyKey: "org-open-1",
      },
      organizationAdmin
    );
    const replay = await openSourceIncident(
      {
        scope: "organization",
        organizationId: 9401,
        incidentKey: "org-source-failure",
        sourceRegistryId: 9431,
        sourceIdentity: "ev04-source",
        incidentType: "repeated_source_failure",
        openedAt: new Date("2026-07-30T12:00:00Z"),
        severity: "advisory",
        reason: "three consecutive source failures",
        policyVersionId: policy.id,
        idempotencyKey: "org-open-1",
      },
      organizationAdmin
    );
    expect(replay.event.id).toBe(opened.event.id);
    await expect(
      openSourceIncident(
        {
          scope: "organization",
          organizationId: 9401,
          incidentKey: "org-source-failure",
          sourceRegistryId: 9431,
          sourceIdentity: "ev04-source",
          incidentType: "repeated_source_failure",
          openedAt: new Date("2026-07-30T12:00:00Z"),
          severity: "advisory",
          reason: "three consecutive source failures",
          policyVersionId: policy.id,
          idempotencyKey: "org-open-1",
        },
        {
          ...organizationAdmin,
          sessionIdentity: "different-live-session",
        }
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      transitionSourceIncident(
        {
          incidentId: opened.incident.id,
          eventType: "reopened",
          severity: "advisory",
          reason: "cannot reopen an open incident",
          effectiveAt: new Date("2026-07-30T12:01:00Z"),
          policyVersionId: policy.id,
          idempotencyKey: "invalid-reopen",
        },
        organizationAdmin
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const acknowledged = await transitionSourceIncident(
      {
        incidentId: opened.incident.id,
        eventType: "acknowledged",
        severity: "advisory",
        reason: "operations owns remediation",
        effectiveAt: new Date("2026-07-30T12:02:00Z"),
        policyVersionId: policy.id,
        idempotencyKey: "ack-1",
      },
      organizationAdmin
    );
    expect(acknowledged.event.resultingState).toBe("acknowledged");
    await expect(
      transitionSourceIncident(
        {
          incidentId: opened.incident.id,
          eventType: "resolved",
          severity: "advisory",
          reason: "backdated transition is forbidden",
          effectiveAt: new Date("2026-07-30T12:01:00Z"),
          policyVersionId: policy.id,
          idempotencyKey: "backdated-resolve",
        },
        organizationAdmin
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("serializes concurrent replays into one transition event", async () => {
    const policy = await approvedPolicy();
    const opened = await openSourceIncident(
      {
        scope: "platform",
        incidentKey: "platform-concurrency",
        sourceRegistryId: 9431,
        sourceIdentity: "ev04-source",
        incidentType: "unexpected_zero",
        openedAt: new Date("2026-07-30T13:00:00Z"),
        severity: "advisory",
        reason: "zero rows require review",
        policyVersionId: policy.id,
        idempotencyKey: "platform-open",
      },
      platformAdmin
    );
    const transition = {
      incidentId: opened.incident.id,
      eventType: "acknowledged" as const,
      severity: "advisory" as const,
      reason: "investigation accepted",
      effectiveAt: new Date("2026-07-30T13:01:00Z"),
      policyVersionId: policy.id,
      idempotencyKey: "concurrent-ack",
    };
    const [left, right] = await Promise.all([
      transitionSourceIncident(transition, platformAdmin),
      transitionSourceIncident(transition, platformAdmin),
    ]);
    expect(left.event.id).toBe(right.event.id);
    const history = await getSourceIncidentHistory(
      opened.incident.id,
      platformAdmin
    );
    expect(history?.events).toHaveLength(2);
  });

  it("derives only safe effective incident states at the injected clock", async () => {
    const policy = await approvedPolicy();
    const platform = await openSourceIncident(
      {
        scope: "platform",
        incidentKey: "effective-platform",
        sourceRegistryId: 9431,
        sourceIdentity: "ev04-source",
        incidentType: "unexpected_zero",
        openedAt: new Date("2026-07-30T14:00:00Z"),
        severity: "advisory",
        reason: "platform dataset returned zero rows",
        policyVersionId: policy.id,
        idempotencyKey: "effective-platform-open",
      },
      platformAdmin
    );
    const tenant = await openSourceIncident(
      {
        scope: "organization",
        organizationId: 9401,
        incidentKey: "effective-tenant",
        sourceRegistryId: 9431,
        sourceIdentity: "ev04-source",
        incidentType: "confidentiality_concern",
        openedAt: new Date("2026-07-30T14:01:00Z"),
        severity: "advisory",
        reason: "confidentiality concern is always blocking",
        policyVersionId: policy.id,
        idempotencyKey: "effective-tenant-open",
      },
      organizationAdmin
    );
    expect(
      await getEffectiveClaimIncidentStates(
        {
          evaluationClock: new Date("2026-07-30T13:59:59Z"),
          organizationId: 9401,
          projectId: 9411,
          sourceIdentities: ["ev04-source"],
        },
        organizationMember
      )
    ).toEqual([
      {
        sourceIdentity: "ev04-source",
        platform: "none",
        organization: "none",
        project: "none",
        supplierQuote: "none",
        aggregate: "none",
        authorityRevisionDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
    ]);
    expect(
      await getEffectiveClaimIncidentStates(
        {
          evaluationClock: new Date("2026-07-30T14:01:00Z"),
          organizationId: 9401,
          projectId: 9411,
          sourceIdentities: ["ev04-source"],
        },
        organizationMember
      )
    ).toEqual([
      {
        sourceIdentity: "ev04-source",
        platform: "advisory",
        organization: "blocking",
        project: "none",
        supplierQuote: "none",
        aggregate: "blocking",
        authorityRevisionDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
    ]);
    await transitionSourceIncident(
      {
        incidentId: tenant.incident.id,
        eventType: "resolved",
        severity: "blocking",
        reason: "confidentiality boundary restored",
        effectiveAt: new Date("2026-07-30T14:02:00Z"),
        policyVersionId: policy.id,
        idempotencyKey: "effective-tenant-resolved",
      },
      organizationAdmin
    );
    expect(
      await getEffectiveClaimIncidentStates(
        {
          evaluationClock: new Date("2026-07-30T14:02:00Z"),
          organizationId: 9401,
          projectId: 9411,
          sourceIdentities: ["ev04-source"],
        },
        organizationMember
      )
    ).toEqual([
      {
        sourceIdentity: "ev04-source",
        platform: "advisory",
        organization: "none",
        project: "none",
        supplierQuote: "none",
        aggregate: "advisory",
        authorityRevisionDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
    ]);
    await transitionSourceIncident(
      {
        incidentId: platform.incident.id,
        eventType: "resolved",
        severity: "advisory",
        reason: "platform extraction recovered",
        effectiveAt: new Date("2026-07-30T14:03:00Z"),
        policyVersionId: policy.id,
        idempotencyKey: "effective-platform-resolved",
      },
      platformAdmin
    );
  });

  it("rejects final persistence after an allocation authority input mutates", async () => {
    const binding = await seedFinalPersistenceAuthorityFixture();
    await pool.query(
      "update material_allocations set resolvedUnitBasis='per_lm' where id=9501"
    );
    await expectFinalPersistenceConflict(binding);
  });

  it("rejects final persistence after a project allocation is added", async () => {
    const binding = await seedFinalPersistenceAuthorityFixture();
    await pool.query(
      `insert into material_allocations
        (id,projectId,organizationId,roomId,roomName,element,materialName,
         allocationPct,surfaceAreaM2,resolutionState,isLocked)
       values
        (9502,9411,9401,'R2','Room 2','walls','Added after evaluation',
         '100','8','legacy_unverified',false)`
    );
    await expectFinalPersistenceConflict(binding);
  });

  it.each([
    ["approval", "status='rejected'"],
    ["recommendation", "recommendation='reject'"],
  ])(
    "rejects final persistence after proposal %s changes",
    async (_label, mutation) => {
      const binding = await seedFinalPersistenceAuthorityFixture();
      await pool.query(
        `update benchmark_proposals set ${mutation} where id=9481`
      );
      await expectFinalPersistenceConflict(binding);
    }
  );

  it("rejects final persistence after an approved proposal supersedes the evaluated proposal", async () => {
    const binding = await seedFinalPersistenceAuthorityFixture();
    await pool.query(
      `insert into benchmark_proposals
        (id,benchmarkKey,specId,orgId,priceScope,sourceKind,sourceLadderRung,
         benchmarkVersionId,supplierQuoteId,supersedesId,sourceLabel,
         provenancePolicyVersion,proposedP25,proposedP50,proposedP75,
         weightedMean,evidenceCount,sourceDiversity,reliabilityDist,recencyDist,
         confidenceScore,recommendation,status,reviewedBy,reviewedAt,createdAt)
       values
        (9482,'floors:premium:per_sqm:dubai',9451,9401,'supply_only',
         'observed','official_statistic',9461,9471,9481,'Authority successor',
         'ev02-provenance-v1','101','111','121','112',1,1,
         JSON_OBJECT('A',1),JSON_OBJECT('recent',1),95,'publish','approved',
         94101,'2026-07-30 14:00:00','2026-07-30 14:00:00')`
    );
    await expectFinalPersistenceConflict(binding);
  });

  it("rejects final persistence after a quote supersedes the evaluated quote", async () => {
    const binding = await seedFinalPersistenceAuthorityFixture();
    await pool.query(
      `insert into supplier_quote
        (id,orgId,supplierName,quoteRef,receivedAt,validUntil,createdBy,
         supersedesId)
       values
        (9472,9401,'Authority Supplier','AUTH-2','2026-07-30 14:00:00',
         '2026-09-30',94101,9471)`
    );
    await expectFinalPersistenceConflict(binding);
  });

  it.each([
    ["terms", "termsDecision='rejected'"],
    ["active state", "isActive=false"],
    ["whitelist state", "isWhitelisted=false"],
  ])(
    "rejects final persistence after source-registry %s revision drift",
    async (_label, mutation) => {
      const binding = await seedFinalPersistenceAuthorityFixture();
      await pool.query(`update source_registry set ${mutation} where id=9431`);
      await expectFinalPersistenceConflict(binding);
    }
  );

  it("rejects an authority binding when an incident changes before persistence", async () => {
    const policy = await approvedPolicy();
    await pool.query(
      `insert into material_allocations
        (id,projectId,organizationId,roomId,roomName,element,materialName,
         allocationPct,surfaceAreaM2,resolutionState,isLocked)
       values
        (9501,9411,9401,'R1','Room 1','floor','Unresolved material',
         '100','10','legacy_unverified',false)`
    );
    const before = (
      await getEffectiveClaimIncidentStates(
        {
          evaluationClock: new Date("2026-07-30T15:00:00Z"),
          organizationId: 9401,
          projectId: 9411,
          sourceIdentities: ["ev04-source"],
        },
        organizationMember
      )
    )[0];
    const unsigned = {
      version: "ev04-authority-binding-v1" as const,
      organizationId: 9401,
      projectId: 9411,
      evaluationClock: "2026-07-30T15:00:00.000Z",
      entries: [
        {
          allocationId: 9501,
          materialLibraryId: null,
          resolvedUnitBasis: null,
          resolutionState: "missing" as const,
          materialResolutionPolicyVersion: null,
          benchmarkProposalId: null,
          benchmarkVersionId: null,
          benchmarkVersion: null,
          specificationId: null,
          productId: null,
          supplierQuoteId: null,
          provenancePolicyVersion: null,
          sourceLadderRung: null,
          governedSourceIdentity: "ev04-source",
          sourceRegistryId: null,
          sourceSlug: null,
          sourceRevision: null,
          sourcePolicyVersion: null,
          sourceEligibilityDigest: claimHealthDigest(null),
          incidentState: "none" as const,
          incidentAuthorityRevisionDigest: before.authorityRevisionDigest,
        },
      ],
    };
    const binding = { ...unsigned, digest: claimHealthDigest(unsigned) };
    await expect(
      verifyProjectClaimHealthAuthorityBinding(binding, organizationMember)
    ).resolves.toBeUndefined();
    await openSourceIncident(
      {
        scope: "organization",
        organizationId: 9401,
        incidentKey: "report-race-incident",
        sourceRegistryId: 9431,
        sourceIdentity: "ev04-source",
        incidentType: "repeated_source_failure",
        openedAt: new Date("2026-07-30T15:00:00Z"),
        severity: "advisory",
        reason: "incident opened between evaluation and report persistence",
        policyVersionId: policy.id,
        idempotencyKey: "report-race-open",
      },
      organizationAdmin
    );
    await expect(
      verifyProjectClaimHealthAuthorityBinding(binding, organizationMember)
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("loads only exact tenant/platform governed facts and distinguishes supersession direction", async () => {
    await pool.query(
      `insert into specification
        (id,specKey,category,finishLevel,unitBasis,geography,policyVersion)
       values
        (9451,'floors:premium:per_sqm:dubai','floors','premium','per_sqm',
         'dubai','ev02-spec-key-v1')`
    );
    await pool.query(
      `insert into benchmark_versions
        (id,versionTag,status,publishedAt,recordCount)
       values (9461,'ev04-governed-values','published','2026-07-01',2)`
    );
    await pool.query(
      `insert into supplier_quote
        (id,orgId,supplierName,quoteRef,receivedAt,validUntil,createdBy,
         supersedesId)
       values
        (9471,9401,'Private Supplier','PRIVATE-1','2026-07-01',
         '2026-08-01',94101,NULL),
        (9472,9401,'Private Supplier','PRIVATE-2','2026-07-20',
         '2026-08-20',94101,9471)`
    );
    const proposalColumns = `
      (id,benchmarkKey,specId,orgId,priceScope,sourceKind,sourceLadderRung,
       benchmarkVersionId,supplierQuoteId,supersedesId,sourceLabel,
       provenancePolicyVersion,proposedP25,proposedP50,proposedP75,
       weightedMean,evidenceCount,sourceDiversity,reliabilityDist,recencyDist,
       confidenceScore,recommendation,status,reviewedBy,reviewedAt,createdAt)`;
    await pool.query(
      `insert into benchmark_proposals ${proposalColumns}
       values
        (9481,'floors:premium:per_sqm:dubai',9451,9401,'supply_only',
         'observed','supplier_quote',9461,9471,NULL,'Internal governed quote',
         'ev02-provenance-v1','100','110','120','111',1,1,
         JSON_OBJECT('A',1),JSON_OBJECT('recent',1),95,'publish','approved',
         94101,'2026-07-02','2026-07-01'),
        (9482,'floors:premium:per_sqm:dubai',9451,9401,'supply_only',
         'observed','supplier_quote',9461,9472,9481,'Internal successor quote',
         'ev02-provenance-v1','105','115','125','116',1,1,
         JSON_OBJECT('A',1),JSON_OBJECT('recent',1),95,'publish','approved',
         94101,'2026-07-20','2026-07-20'),
        (9483,'floors:premium:per_sqm:dubai',9451,9402,'supply_only',
         'assumption','assumption',9461,NULL,NULL,'Foreign',
         'ev02-provenance-v1','1','1','1','1',1,1,
         JSON_OBJECT('C',1),JSON_OBJECT('old',1),20,'publish','approved',
         94201,'2026-07-01','2026-07-01')`
    );
    const beforeSuccessor = await listClaimHealthBenchmarkFacts(
      {
        projectId: 9411,
        benchmarkProposalIds: [9481, 9483],
        evaluationClock: new Date("2026-07-10T00:00:00Z"),
      },
      organizationMember
    );
    expect(beforeSuccessor).toEqual([
      expect.objectContaining({
        id: 9481,
        benchmarkVersion: "ev04-governed-values",
        proposedP25: "100.00",
        proposedP50: "110.00",
        proposedP75: "120.00",
        weightedMean: "111.00",
        supersededByApprovedProposalId: null,
        observationAt: new Date("2026-07-01T00:00:00.000Z"),
        specification: {
          category: "floors",
          finishLevel: "premium",
          unitBasis: "per_sqm",
          geography: "dubai",
        },
        supplierQuote: expect.objectContaining({
          supersedesId: null,
          supersededByQuoteId: null,
        }),
      }),
    ]);
    const afterSuccessor = await listClaimHealthBenchmarkFacts(
      {
        projectId: 9411,
        benchmarkProposalIds: [9481],
        evaluationClock: new Date("2026-07-21T00:00:00Z"),
      },
      organizationMember
    );
    expect(afterSuccessor[0]).toMatchObject({
      proposalSupersedesId: null,
      supersededByApprovedProposalId: 9482,
      supplierQuote: {
        id: 9471,
        supersedesId: null,
        supersededByQuoteId: 9472,
      },
    });
  });

  it("refuses unsafe recovery, then rehearses dependency-order removal and reapply", async () => {
    const policy = await approvedPolicy();
    await pool.query(
      `insert into report_instances
        (id,projectId,scoreMatrixId,reportType,content,generatedBy)
       values
        (9499,9411,1,'full_report',JSON_OBJECT('locale','en'),94101)`
    );
    const evaluationInput = {
      policyVersion: EV04_POLICY_VERSION,
      policyManifestDigest: CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST,
      requiredCellSchemaVersion: EV04_REQUIRED_CELL_SCHEMA_VERSION,
      evaluatedAt: new Date("2026-07-30T12:00:00.000Z"),
      artifactSnapshot: "present" as const,
      cells: [exactMaterialCell("stored_project_report")],
    };
    const evaluation = evaluateClaimHealth(evaluationInput);
    const snapshot = await createClaimHealthSnapshot(
      {
        scope: "project",
        organizationId: 9401,
        projectId: 9411,
        consumer: "stored_project_report",
        evaluationClock: new Date("2026-07-30T12:00:00.000Z"),
        policyVersionId: policy.id,
        reportInstanceId: 9499,
        evaluationInput,
        evaluation,
        digests: createClaimHealthDigests(evaluationInput, evaluation),
      },
      organizationMember
    );
    await createReportPublicShare(
      {
        organizationId: 9401,
        reportInstanceId: 9499,
        expiresAt: new Date("2026-08-30T00:00:00Z"),
      },
      organizationAdmin
    );
    const incident = await openSourceIncident(
      {
        scope: "organization",
        organizationId: 9401,
        incidentKey: "recovery-populated",
        sourceRegistryId: 9431,
        sourceIdentity: "ev04-source",
        incidentType: "repeated_source_failure",
        openedAt: new Date("2026-07-30T12:00:00Z"),
        severity: "advisory",
        reason: "recovery fixture",
        policyVersionId: policy.id,
        idempotencyKey: "recovery-open",
      },
      organizationAdmin
    );
    expect(incident.event.eventSequence).toBe(1);
    await expect(assertEv04ClaimHealthRecoverySafe()).rejects.toMatchObject({
      code: "RETENTION_GATE",
    });
    const [dependencies] = await pool.query<mysql.RowDataPacket[]>(
      `select table_name,referenced_table_name
       from information_schema.key_column_usage
       where constraint_schema=database()
         and referenced_table_name in
           ('claim_health_policy_version','claim_health_snapshot',
            'source_incident')
       order by table_name,referenced_table_name`
    );
    expect(dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          TABLE_NAME: "claim_health_snapshot",
          REFERENCED_TABLE_NAME: "claim_health_policy_version",
        }),
        expect.objectContaining({
          TABLE_NAME: "source_incident_event",
          REFERENCED_TABLE_NAME: "source_incident",
        }),
      ])
    );
    await expect(
      pool.query("delete from claim_health_policy_version where version=?", [
        EV04_POLICY_VERSION,
      ])
    ).rejects.toThrow();
    await expect(
      pool.query("drop table claim_health_policy_version")
    ).rejects.toThrow();
    const [legacyColumns] = await pool.query<mysql.RowDataPacket[]>(
      `select column_name
       from information_schema.columns
       where table_schema=database()
         and table_name='report_instances'
         and column_name like 'claimHealth%'`
    );
    expect(legacyColumns).toHaveLength(0);

    await pool.query("delete from report_public_share");
    await pool.query("delete from source_incident_event");
    await pool.query("delete from source_incident");
    await pool.query("delete from claim_health_snapshot");
    await assertEv04ClaimHealthRecoverySafe();
    for (const table of [
      "report_public_share",
      "source_incident_event",
      "source_incident",
      "claim_health_snapshot",
      "claim_health_policy_version",
    ]) {
      await pool.query(`drop table \`${table}\``);
    }
    await pool.query("alter table projects drop index projects_org_id_unique");
    await pool.query(
      "alter table report_instances drop index report_instances_project_id_unique"
    );
    await pool.query(
      "alter table supplier_quote drop index supplier_quote_org_id_unique"
    );
    const migration = readFileSync(
      "drizzle/0063_ev04_claim_health.sql",
      "utf8"
    );
    const statements = migration
      .split("--> statement-breakpoint")
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pool.query(statement);
    }
    await ensureApprovedClaimHealthPolicySeed();
    const restoredPolicy = await approvedPolicy();
    expect(restoredPolicy.policyDigest).toBe(
      CLAIM_HEALTH_V1_POLICY_MANIFEST_DIGEST
    );
    expect(canonicalizeClaimHealth(restoredPolicy.policyDocument)).toBe(
      CLAIM_HEALTH_V1_POLICY_MANIFEST_CANONICAL_JSON
    );
    const [restoredTriggers] = await pool.query<mysql.RowDataPacket[]>(
      `select trigger_name
       from information_schema.triggers
       where trigger_schema=database()
         and (
           trigger_name like 'claim_health_%'
           or trigger_name like 'source_incident_%'
         )`
    );
    expect(restoredTriggers).toHaveLength(0);
  });
});
