import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import { createTypologyPackRevision, getTypologyPackRevision, transitionTypologyPackRevision, TypologyPackStoreError } from "../../server/db/typology-packs";
import { NEUTRAL_SYNTHETIC_TYPOLOGY_PACK } from "../../shared/typology-pack";
import { canonicalizeTypologyPack, fingerprintTypologyPack } from "../../server/engines/typology-pack";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(url);
const packFingerprint = fingerprintTypologyPack(NEUTRAL_SYNTHETIC_TYPOLOGY_PACK);
const payload = { pack: { packId: "neutral-example", version: "0.1.0", fingerprint: packFingerprint }, operations: [{ kind: "add_constraint" as const, constraint: { id: "scope", kind: "fitout_scope" as const, roomArchetypeId: "example-room", scope: "full_fitout" as const } }] };
const base = { packKey: "neutral-example", basePackKey: "neutral-example", basePackVersion: "0.1.0", basePackFingerprint: packFingerprint, payloadSchemaVersion: "typology-pack/v1", payload, payloadFingerprint: createHash("sha256").update(canonicalizeTypologyPack(payload), "utf8").digest("hex"), reviewDueAt: new Date("2030-01-01T00:00:00Z"), reason: "fixture", idempotencyKey: "create-request-0001" };
const author = { organizationId: 8101, userId: 81011 };
const reviewer = { organizationId: 8101, userId: 81012 };
const approver = { organizationId: 8101, userId: 81013 };

beforeEach(async () => {
  await pool.query("set foreign_key_checks=0");
  for (const table of ["typology_pack_events", "typology_pack_revisions", "organization_members", "users", "organizations"]) await pool.query(`truncate table \`${table}\``);
  await pool.query("set foreign_key_checks=1");
  await pool.query("insert into organizations (id,name,slug) values (8101,'BR05 A','br05-a'),(8102,'BR05 B','br05-b')");
  await pool.query("insert into users (id,openId,orgId) values (81011,'br05-author',8101),(81012,'br05-reviewer',8101),(81013,'br05-approver',8101),(81021,'br05-foreign',8102)");
  await pool.query("insert into organization_members (orgId,userId,role) values (8101,81011,'member'),(8101,81012,'admin'),(8101,81013,'admin'),(8102,81021,'admin')");
});
afterAll(async () => { await pool.end(); });

describe("BR-05 disposable MySQL governance", () => {
  it("conceals foreign revisions and enforces separated live review/approval", async () => {
    const revision = await createTypologyPackRevision(base, author);
    expect(await getTypologyPackRevision(revision.id, { organizationId: 8102, userId: 81021 })).toBeNull();
    await expect(transitionTypologyPackRevision({ revisionId: revision.id, action: "review", reason: "self", idempotencyKey: "review-self-0001" }, { organizationId: 8101, userId: 81011 })).rejects.toBeInstanceOf(TypologyPackStoreError);
    await transitionTypologyPackRevision({ revisionId: revision.id, action: "review", reason: "peer", idempotencyKey: "review-peer-0001" }, reviewer);
    await pool.query("delete from organization_members where orgId=8101 and userId=81012");
    await expect(transitionTypologyPackRevision({ revisionId: revision.id, action: "approve", reason: "approve", idempotencyKey: "approve-revoked-0001" }, approver)).rejects.toBeInstanceOf(TypologyPackStoreError);
  });

  it("binds idempotency to the exact request and actor, and preserves append-only revisions", async () => {
    const first = await createTypologyPackRevision(base, author);
    expect((await createTypologyPackRevision(base, author)).id).toBe(first.id);
    await expect(createTypologyPackRevision({ ...base, packKey: "different-pack" }, author)).rejects.toBeInstanceOf(TypologyPackStoreError);
    await expect(createTypologyPackRevision(base, reviewer)).rejects.toBeInstanceOf(TypologyPackStoreError);
    const second = await createTypologyPackRevision({ ...base, idempotencyKey: "create-request-0002" }, author);
    expect(second.revisionNumber).toBe(2);
  });

  it("rejects incompatible overrides before they can be reviewed or approved", async () => {
    const invalidPayload = {
      ...payload,
      operations: [{ kind: "add_constraint" as const, constraint: { id: "invalid-room", kind: "fitout_scope" as const, roomArchetypeId: "missing-room", scope: "full_fitout" as const } }],
    };
    await expect(createTypologyPackRevision({
      ...base,
      payload: invalidPayload,
      payloadFingerprint: createHash("sha256").update(canonicalizeTypologyPack(invalidPayload), "utf8").digest("hex"),
      idempotencyKey: "invalid-create-0001",
    }, author)).rejects.toBeInstanceOf(TypologyPackStoreError);
  });
});
