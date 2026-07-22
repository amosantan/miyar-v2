/**
 * KF-013 exit-criterion proof: insertRfqLineItemsForOrg is a replace
 * contract — a retried generateRfqFromBrief converges to exactly one
 * intended batch per (project, brief, organization) instead of appending
 * duplicates, while other briefs' rows and cross-org safety are untouched.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import { insertRfqLineItemsForOrg } from "../../server/db";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(connectionString);

const ID = {
  org: 9301,
  foreignOrg: 9302,
  user: 9311,
  project: 9321,
  briefA: 9331,
  briefB: 9332,
} as const;

async function clear() {
  await pool.query("set foreign_key_checks = 0");
  for (const table of [
    "rfq_line_items",
    "design_briefs",
    "projects",
    "organization_members",
    "users",
    "organizations",
  ]) {
    await pool.query(`truncate table \`${table}\``);
  }
  await pool.query("set foreign_key_checks = 1");

  await pool.query(
    "insert into organizations (id, name, slug) values (?, 'RFQ Idempotency Org', 'rfq-idem-org'), (?, 'Foreign Org', 'rfq-idem-foreign')",
    [ID.org, ID.foreignOrg],
  );
  await pool.query(
    "insert into users (id, openId, name, email, loginMethod, role, orgId) values (?, 'rfq-idem-user', 'RFQ User', 'rfq-idem@example.invalid', 'synthetic', 'user', ?)",
    [ID.user, ID.org],
  );
  await pool.query(
    "insert into organization_members (orgId, userId, role) values (?, ?, 'admin')",
    [ID.org, ID.user],
  );
  await pool.query(
    "insert into projects (id, userId, orgId, name, status) values (?, ?, ?, 'RFQ Idempotency Project', 'draft')",
    [ID.project, ID.user, ID.org],
  );
  await pool.query(
    `insert into design_briefs
       (id, projectId, version, projectIdentity, designNarrative, materialSpecifications, boqFramework, detailedBudget, designerInstructions, createdBy)
     values
       (?, ?, 1, '{}', '{}', '{}', '{}', '{}', '{}', ?),
       (?, ?, 2, '{}', '{}', '{}', '{}', '{}', '{}', ?)`,
    [ID.briefA, ID.project, ID.user, ID.briefB, ID.project, ID.user],
  );
}

function line(briefId: number, itemCode: string, description: string) {
  return {
    projectId: ID.project,
    organizationId: ID.org,
    briefId,
    sectionNo: 1,
    itemCode,
    description,
    unit: "sqm",
    quantity: "10.00",
    unitRateAedMin: "100.00",
    unitRateAedMax: "150.00",
    totalAedMin: "1000.00",
    totalAedMax: "1500.00",
    supplierName: "Test Supplier",
    pricingSource: "estimated",
  };
}

async function rowsFor(briefId: number): Promise<Array<{ item_code: string; description: string }>> {
  const [rows] = await pool.query<any[]>(
    "select item_code, description from rfq_line_items where brief_id = ? order by item_code",
    [briefId],
  );
  return rows as Array<{ item_code: string; description: string }>;
}

beforeEach(clear);
afterAll(async () => {
  await pool.query("set foreign_key_checks = 0");
  for (const table of [
    "rfq_line_items",
    "design_briefs",
    "projects",
    "organization_members",
    "users",
    "organizations",
  ]) {
    await pool.query(`truncate table \`${table}\``);
  }
  await pool.query("set foreign_key_checks = 1");
  await pool.end();
});

describe("KF-013 RFQ replace contract (real MySQL)", () => {
  it("a retried generation converges to exactly the latest batch", async () => {
    const firstBatch = [
      line(ID.briefA, "01-01", "First batch line 1"),
      line(ID.briefA, "01-02", "First batch line 2"),
      line(ID.briefA, "01-03", "First batch line 3"),
    ];
    expect(
      await insertRfqLineItemsForOrg(firstBatch as any[], {
        projectId: ID.project,
        briefId: ID.briefA,
        orgId: ID.org,
      }),
    ).toBe(true);
    expect((await rowsFor(ID.briefA)).length).toBe(3);

    const retryBatch = [
      line(ID.briefA, "01-01", "Retry batch line 1"),
      line(ID.briefA, "01-02", "Retry batch line 2"),
    ];
    expect(
      await insertRfqLineItemsForOrg(retryBatch as any[], {
        projectId: ID.project,
        briefId: ID.briefA,
        orgId: ID.org,
      }),
    ).toBe(true);

    const rows = await rowsFor(ID.briefA);
    expect(rows.length).toBe(2);
    expect(rows.map(row => row.description)).toEqual([
      "Retry batch line 1",
      "Retry batch line 2",
    ]);
  });

  it("leaves another brief's batch untouched", async () => {
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefB, "01-01", "Brief B line")] as any[],
        { projectId: ID.project, briefId: ID.briefB, orgId: ID.org },
      ),
    ).toBe(true);
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefA, "01-01", "Brief A line")] as any[],
        { projectId: ID.project, briefId: ID.briefA, orgId: ID.org },
      ),
    ).toBe(true);
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefA, "01-01", "Brief A replacement")] as any[],
        { projectId: ID.project, briefId: ID.briefA, orgId: ID.org },
      ),
    ).toBe(true);

    expect((await rowsFor(ID.briefB)).map(row => row.description)).toEqual(["Brief B line"]);
    expect((await rowsFor(ID.briefA)).map(row => row.description)).toEqual(["Brief A replacement"]);
  });

  it("a rejected cross-org call neither deletes nor inserts", async () => {
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefA, "01-01", "Original line")] as any[],
        { projectId: ID.project, briefId: ID.briefA, orgId: ID.org },
      ),
    ).toBe(true);

    const foreignAttempt = [{
      ...line(ID.briefA, "01-01", "Foreign overwrite"),
      organizationId: ID.foreignOrg,
    }];
    expect(
      await insertRfqLineItemsForOrg(foreignAttempt as any[], {
        projectId: ID.project,
        briefId: ID.briefA,
        orgId: ID.foreignOrg,
      }),
    ).toBe(false);

    expect((await rowsFor(ID.briefA)).map(row => row.description)).toEqual(["Original line"]);
  });
});
