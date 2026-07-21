import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(connectionString);

const sections = [
  "intent", "asset_context", "space_programme", "design_direction",
  "specification_intent", "cost_quantities", "supply", "risk_compliance",
  "concept_media", "governance",
] as const;

async function clear() {
  await pool.query("set foreign_key_checks = 0");
  for (const table of [
    "brief_issue_dependencies", "brief_issue_applicability", "brief_issue_approvals",
    "brief_issue_sections", "brief_issues", "brief_events", "brief_condition_events",
    "brief_dependencies", "brief_approvals", "brief_applicability_events",
    "brief_finding_resolutions", "brief_findings", "brief_role_events",
    "brief_version_sections", "brief_section_revisions", "brief_versions", "brief_streams",
  ]) await pool.query(`truncate table \`${table}\``);
  await pool.query("set foreign_key_checks = 1");
}

async function stream(org = 1, project = 11) {
  const [result] = await pool.query<any>(
    `insert into brief_streams
       (organizationId,projectId,scopeType,scenarioId,scopeKey,issuePurpose,typologyProfileVersion,revision,nextEventSequence,createdBy)
     values (?,?,'project',null,'project','internal_coordination','br03-test',1,1,1)`,
    [org, project],
  );
  return result.insertId as number;
}

async function version(streamId: number, org = 1, project = 11) {
  const [result] = await pool.query<any>(
    `insert into brief_versions
       (organizationId,projectId,streamId,versionNumber,origin,status,requirementProfileVersion,componentScope,revision,createdBy)
     values (?,?,?,1,'user','working','br03-test',json_array(),0,1)`,
    [org, project, streamId],
  );
  return result.insertId as number;
}

beforeEach(clear);
afterAll(async () => { await clear(); await pool.end(); });

describe("BR-03 disposable MySQL persistence boundary", () => {
  it("installs all canonical tables and authoritative sequence columns", async () => {
    const [tables] = await pool.query<any[]>(
      `select table_name from information_schema.tables
       where table_schema=database() and table_name like 'brief_%'`,
    );
    const names = new Set(tables.map(row => row.TABLE_NAME ?? row.table_name));
    expect(names.has("brief_streams")).toBe(true);
    expect(names.has("brief_versions")).toBe(true);
    expect(names.has("brief_issue_sections")).toBe(true);
    const [columns] = await pool.query<any[]>(
      `select table_name from information_schema.columns
       where table_schema=database() and column_name='streamSequence'
         and table_name in ('brief_role_events','brief_findings','brief_finding_resolutions','brief_applicability_events','brief_approvals','brief_condition_events')`,
    );
    expect(columns).toHaveLength(6);
  });

  it("rejects a cross-scope stream/version substitution", async () => {
    const streamA = await stream(1, 11);
    await stream(2, 22);
    await expect(version(streamA, 2, 22)).rejects.toThrow();
  });

  it("allows exactly ten distinct section bindings and rejects duplicates", async () => {
    const streamId = await stream();
    const versionId = await version(streamId);
    for (const sectionId of sections) {
      await pool.query(
        `insert into brief_version_sections
           (organizationId,projectId,streamId,versionId,sectionId,applicability,achievedState,classifications,classificationFingerprint,componentScope,revision)
         values (1,11,?, ?,?,'required','missing',json_array(),?,json_array(),0)`,
        [streamId, versionId, sectionId, "0".repeat(64)],
      );
    }
    const [count] = await pool.query<any[]>(
      "select count(*) n, count(distinct sectionId) d from brief_version_sections where versionId=?",
      [versionId],
    );
    expect(Number(count[0].n)).toBe(10);
    expect(Number(count[0].d)).toBe(10);
    await expect(pool.query(
      `insert into brief_version_sections
       (organizationId,projectId,streamId,versionId,sectionId,applicability,achievedState,classifications,classificationFingerprint,componentScope,revision)
       values (1,11,?,?,'intent','required','missing',json_array(),?,json_array(),0)`,
      [streamId, versionId, "0".repeat(64)],
    )).rejects.toThrow();
  });

  it("enforces one authoritative ledger fact per stream sequence", async () => {
    const streamId = await stream();
    await pool.query(
      `insert into brief_role_events
       (organizationId,projectId,streamId,subjectUserId,role,action,actorUserId,reason,streamSequence)
       values (1,11,?,1,'author','granted',1,'fixture',1)`, [streamId],
    );
    await expect(pool.query(
      `insert into brief_role_events
       (organizationId,projectId,streamId,subjectUserId,role,action,actorUserId,reason,streamSequence)
       values (1,11,?,2,'reviewer','granted',1,'duplicate',1)`, [streamId],
    )).rejects.toThrow();
  });

  it("rolls back an incomplete ten-section transaction", async () => {
    const streamId = await stream();
    const versionId = await version(streamId);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const sectionId of sections.slice(0, 9)) await connection.query(
        `insert into brief_version_sections
         (organizationId,projectId,streamId,versionId,sectionId,applicability,achievedState,classifications,classificationFingerprint,componentScope,revision)
         values (1,11,?, ?,?,'required','missing',json_array(),?,json_array(),0)`,
        [streamId, versionId, sectionId, "0".repeat(64)],
      );
      const [rows] = await connection.query<any[]>("select count(*) n from brief_version_sections where versionId=?", [versionId]);
      if (Number(rows[0].n) !== 10) await connection.rollback();
      else await connection.commit();
    } finally { connection.release(); }
    const [rows] = await pool.query<any[]>("select count(*) n from brief_version_sections where versionId=?", [versionId]);
    expect(Number(rows[0].n)).toBe(0);
  });
});
