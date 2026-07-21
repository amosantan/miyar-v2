import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { initializeDatabaseSafety } from "../server/_core/database-safety";
import { createBriefStream } from "../server/db/brief-workflow";

initializeDatabaseSafety("integration-test", { loadDotenv: false });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("BR-04 browser seeding requires DATABASE_URL");
const target = new URL(databaseUrl);
const database = decodeURIComponent(target.pathname.slice(1));
if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname) || !database.startsWith("miyar_test_tr13_br04_")) {
  throw new Error("BR-04 browser seeding requires a loopback disposable database");
}

const organizationId = 13_001;
const projectId = 13_301;
const authorUserId = 13_101;
const reviewerUserId = 13_102;
const approverUserId = 13_103;
const issuerUserId = 13_104;
const credentials = [
  [authorUserId, "br04-author@example.invalid", "br04-local-author"],
  [reviewerUserId, "br04-reviewer@example.invalid", "br04-local-reviewer"],
  [approverUserId, "br04-approver@example.invalid", "br04-local-approver"],
] as const;

const connection = await mysql.createConnection(databaseUrl);
try {
  for (const [id, email, password] of credentials) {
    await connection.query(
      "update users set email = ?, password = ?, loginMethod = 'local' where id = ?",
      [email, await bcrypt.hash(password, 12), id]
    );
    await connection.query(
      `insert into organization_members (orgId, userId, role) values (?, ?, ?)
       on duplicate key update role = values(role)`,
      [organizationId, id, id === authorUserId ? "admin" : "member"]
    );
  }
  await connection.query(
    `insert into users (id, openId, name, email, password, loginMethod, role, orgId)
     values (?, 'br04-issuer', 'BR04 Issuer', 'br04-issuer@example.invalid', ?, 'local', 'user', ?)
     on duplicate key update email = values(email), password = values(password), loginMethod = 'local', orgId = values(orgId)`,
    [issuerUserId, await bcrypt.hash("br04-local-issuer", 12), organizationId]
  );
  await connection.query(
    `insert into organization_members (orgId, userId, role) values (?, ?, 'member')
     on duplicate key update role = values(role)`,
    [organizationId, issuerUserId]
  );
} finally {
  await connection.end();
}

const created = await createBriefStream({
  projectId,
  scope: { type: "project" },
  purpose: "internal_coordination",
  profile: "apartment",
  typologyProfileVersion: "BR-01-v1",
  componentIds: [],
  initialAssignments: [
    { userId: authorUserId, role: "author" },
    { userId: authorUserId, role: "section_owner" },
    { userId: reviewerUserId, role: "reviewer" },
    { userId: approverUserId, role: "approver" },
    { userId: issuerUserId, role: "issuer" },
  ],
  idempotencyKey: "br04-browser-create-stream",
}, { organizationId, userId: authorUserId, actorType: "human" });

process.stdout.write(`${JSON.stringify({
  syntheticOnly: true,
  projectId,
  briefId: created.value.briefId,
  versionId: created.value.currentVersionId,
  actors: ["author", "reviewer", "approver", "issuer"],
})}\n`);
process.exit(0);
