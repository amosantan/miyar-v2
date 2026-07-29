/**
 * KF-013 exit-criterion proof: insertRfqLineItemsForOrg is a replace
 * contract — a retried generateRfqFromBrief converges to exactly one
 * intended batch per (project, brief, organization) instead of appending
 * duplicates, while other briefs' rows and cross-org safety are untouched.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import {
  createExplicitMaterialAllocationForOrg,
  insertRfqLineItemsForOrg,
  replaceMaterialAllocationsForOrg,
} from "../../server/db";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(connectionString);

const ID = {
  org: 9301,
  foreignOrg: 9302,
  user: 9311,
  project: 9321,
  briefA: 9331,
  briefB: 9332,
  room: 9341,
  material: 9351,
} as const;

async function clear() {
  await pool.query("set foreign_key_checks = 0");
  for (const table of [
    "material_allocations",
    "space_program_rooms",
    "material_library",
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
    [ID.org, ID.foreignOrg]
  );
  await pool.query(
    "insert into users (id, openId, name, email, loginMethod, role, orgId) values (?, 'rfq-idem-user', 'RFQ User', 'rfq-idem@example.invalid', 'synthetic', 'user', ?)",
    [ID.user, ID.org]
  );
  await pool.query(
    "insert into organization_members (orgId, userId, role) values (?, ?, 'admin')",
    [ID.org, ID.user]
  );
  await pool.query(
    "insert into projects (id, userId, orgId, name, status) values (?, ?, ?, 'RFQ Idempotency Project', 'draft')",
    [ID.project, ID.user, ID.org]
  );
  await pool.query(
    `insert into design_briefs
       (id, projectId, version, projectIdentity, designNarrative, materialSpecifications, boqFramework, detailedBudget, designerInstructions, createdBy)
     values
       (?, ?, 1, '{}', '{}', '{}', '{}', '{}', '{}', ?),
       (?, ?, 2, '{}', '{}', '{}', '{}', '{}', '{}', ?)`,
    [ID.briefA, ID.project, ID.user, ID.briefB, ID.project, ID.user]
  );
  await pool.query(
    `insert into space_program_rooms
       (id, projectId, organizationId, roomCode, roomName, category, sqm,
        source, isFitOut, finishGrade, priority, sortOrder, blockName, blockTypology)
     values (?, ?, ?, 'BTH', 'Bathroom', 'bathroom', 10,
       'user_manual', true, 'B', 'medium', 1, 'Main', 'residential')`,
    [ID.room, ID.project, ID.org]
  );
  await pool.query(
    `insert into material_library
       (id, product_id, category, tier, style, product_code, product_name,
        brand, supplier_name, unit_label, is_active)
     values (?, 770, 'sanitaryware', 'mid', 'all', 'RFQ-SAN-1',
       'Approved sanitary suite', 'Test Brand', 'Test Supplier', 'piece', true)`,
    [ID.material]
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

async function rowsFor(briefId: number): Promise<
  Array<{
    item_code: string;
    description: string;
    artifact_state: "draft" | "issued" | "legacy_unverified";
  }>
> {
  const [rows] = await pool.query<any[]>(
    `select item_code, description, artifact_state
     from rfq_line_items
     where brief_id = ?
     order by item_code, artifact_state`,
    [briefId]
  );
  return rows;
}

beforeEach(clear);
afterAll(async () => {
  await pool.query("set foreign_key_checks = 0");
  for (const table of [
    "material_allocations",
    "space_program_rooms",
    "material_library",
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
        materialPricingRevision: 1,
      })
    ).toBe(true);
    expect((await rowsFor(ID.briefA)).length).toBe(3);
    expect(
      (await rowsFor(ID.briefA)).every(row => row.artifact_state === "draft")
    ).toBe(true);

    const retryBatch = [
      line(ID.briefA, "01-01", "Retry batch line 1"),
      line(ID.briefA, "01-02", "Retry batch line 2"),
    ];
    expect(
      await insertRfqLineItemsForOrg(retryBatch as any[], {
        projectId: ID.project,
        briefId: ID.briefA,
        orgId: ID.org,
        materialPricingRevision: 1,
      })
    ).toBe(true);

    const rows = await rowsFor(ID.briefA);
    expect(rows.length).toBe(2);
    expect(rows.map(row => row.description)).toEqual([
      "Retry batch line 1",
      "Retry batch line 2",
    ]);
    expect(rows.every(row => row.artifact_state === "draft")).toBe(true);
  });

  it("cannot promote standalone rows and never replaces an issued artifact", async () => {
    await pool.query(
      `insert into rfq_line_items
        (project_id, organization_id, brief_id, section_no, item_code,
         description, unit, total_aed_min, total_aed_max, artifact_state)
       values (?, ?, ?, 1, 'ISSUED-1', 'Issued report line', 'sqm',
         1000, 1500, 'issued')`,
      [ID.project, ID.org, ID.briefA]
    );

    expect(
      await insertRfqLineItemsForOrg(
        [
          {
            ...line(ID.briefA, "DRAFT-1", "Standalone replacement"),
            artifactState: "issued",
          },
        ] as any[],
        {
          projectId: ID.project,
          briefId: ID.briefA,
          orgId: ID.org,
          materialPricingRevision: 1,
        }
      )
    ).toBe(true);

    expect(await rowsFor(ID.briefA)).toEqual([
      {
        item_code: "DRAFT-1",
        description: "Standalone replacement",
        artifact_state: "draft",
      },
      {
        item_code: "ISSUED-1",
        description: "Issued report line",
        artifact_state: "issued",
      },
    ]);
  });

  it("leaves another brief's batch untouched", async () => {
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefB, "01-01", "Brief B line")] as any[],
        {
          projectId: ID.project,
          briefId: ID.briefB,
          orgId: ID.org,
          materialPricingRevision: 1,
        }
      )
    ).toBe(true);
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefA, "01-01", "Brief A line")] as any[],
        {
          projectId: ID.project,
          briefId: ID.briefA,
          orgId: ID.org,
          materialPricingRevision: 1,
        }
      )
    ).toBe(true);
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefA, "01-01", "Brief A replacement")] as any[],
        {
          projectId: ID.project,
          briefId: ID.briefA,
          orgId: ID.org,
          materialPricingRevision: 1,
        }
      )
    ).toBe(true);

    expect((await rowsFor(ID.briefB)).map(row => row.description)).toEqual([
      "Brief B line",
    ]);
    expect((await rowsFor(ID.briefA)).map(row => row.description)).toEqual([
      "Brief A replacement",
    ]);
  });

  it("a rejected cross-org call neither deletes nor inserts", async () => {
    expect(
      await insertRfqLineItemsForOrg(
        [line(ID.briefA, "01-01", "Original line")] as any[],
        {
          projectId: ID.project,
          briefId: ID.briefA,
          orgId: ID.org,
          materialPricingRevision: 1,
        }
      )
    ).toBe(true);

    const foreignAttempt = [
      {
        ...line(ID.briefA, "01-01", "Foreign overwrite"),
        organizationId: ID.foreignOrg,
      },
    ];
    expect(
      await insertRfqLineItemsForOrg(foreignAttempt as any[], {
        projectId: ID.project,
        briefId: ID.briefA,
        orgId: ID.foreignOrg,
        materialPricingRevision: 1,
      })
    ).toBe(false);

    expect((await rowsFor(ID.briefA)).map(row => row.description)).toEqual([
      "Original line",
    ]);
  });

  it("revalidates the fit-out room after the project lock before an explicit allocation insert", async () => {
    const blocker = await pool.getConnection();
    try {
      await blocker.beginTransaction();
      await blocker.query("select id from projects where id = ? for update", [
        ID.project,
      ]);
      const pending = createExplicitMaterialAllocationForOrg(
        ID.project,
        ID.org,
        {
          projectId: ID.project,
          organizationId: ID.org,
          roomId: "BTH",
          roomName: "Bathroom",
          element: "sanitaryware",
          materialLibraryId: ID.material,
          materialName: "Approved sanitary suite",
          allocationPct: "100",
          surfaceAreaM2: "0",
          explicitQuantity: "2",
          explicitQuantityUnit: "piece",
          productId: 770,
          specId: 771,
          benchmarkProposalId: 772,
          resolutionState: "resolved",
          resolvedPriceScope: "supply_only",
          requestedGeography: "uae",
          resolvedGeography: "uae",
          resolvedUnitBasis: "per_piece",
          resolutionAsOf: new Date("2026-07-29T12:00:00.000Z"),
          resolverPolicyVersion: "ev03-material-resolution-v1",
          benchmarkVersion: "test-v1",
          provenancePolicyVersion: "test-v1",
          quantityPolicyVersion: "ev03-direct-unit-v1",
          isLocked: true,
        },
        {
          materialPricingRevision: 1,
          materialPriceGeography: null,
        }
      );
      await blocker.query(
        "delete from space_program_rooms where id = ? and organizationId = ?",
        [ID.room, ID.org]
      );
      await blocker.commit();

      await expect(pending).resolves.toBeNull();
      const [rows] = await pool.query<any[]>(
        "select id from material_allocations where projectId = ?",
        [ID.project]
      );
      expect(rows).toHaveLength(0);
    } finally {
      blocker.release();
    }
  });

  it("rejects an explicit allocation resolved against stale project geography", async () => {
    const blocker = await pool.getConnection();
    try {
      await blocker.beginTransaction();
      await blocker.query("select id from projects where id = ? for update", [
        ID.project,
      ]);
      const pending = createExplicitMaterialAllocationForOrg(
        ID.project,
        ID.org,
        {
          projectId: ID.project,
          organizationId: ID.org,
          roomId: "BTH",
          roomName: "Bathroom",
          element: "sanitaryware",
          materialLibraryId: ID.material,
          materialName: "Approved sanitary suite",
          allocationPct: "100",
          surfaceAreaM2: "0",
          explicitQuantity: "2",
          explicitQuantityUnit: "piece",
          productId: 770,
          specId: 771,
          benchmarkProposalId: 772,
          resolutionState: "resolved",
          resolvedPriceScope: "supply_only",
          requestedGeography: "uae",
          resolvedGeography: "uae",
          resolvedUnitBasis: "per_piece",
          resolutionAsOf: new Date("2026-07-29T12:00:00.000Z"),
          resolverPolicyVersion: "ev03-material-resolution-v1",
          benchmarkVersion: "test-v1",
          provenancePolicyVersion: "test-v1",
          quantityPolicyVersion: "ev03-direct-unit-v1",
          isLocked: true,
        },
        {
          materialPricingRevision: 1,
          materialPriceGeography: null,
        }
      );
      await blocker.query(
        `update projects
         set materialPriceGeography = 'dubai',
             material_pricing_revision = material_pricing_revision + 1
         where id = ? and orgId = ?`,
        [ID.project, ID.org]
      );
      await blocker.commit();

      await expect(pending).resolves.toBeNull();
      const [rows] = await pool.query<any[]>(
        "select id from material_allocations where projectId = ?",
        [ID.project]
      );
      expect(rows).toHaveLength(0);
    } finally {
      blocker.release();
    }
  });

  it("rejects a bulk MQI replacement resolved against stale project geography", async () => {
    await pool.query(
      `insert into material_allocations
        (projectId, organizationId, roomId, roomName, element,
         materialLibraryId, materialName, allocationPct, surfaceAreaM2,
         resolutionState, isLocked)
       values (?, ?, 'BTH', 'Bathroom', 'sanitaryware',
         ?, 'Approved sanitary suite', 100, 0, 'legacy_unverified', false)`,
      [ID.project, ID.org, ID.material]
    );
    const blocker = await pool.getConnection();
    try {
      await blocker.beginTransaction();
      await blocker.query("select id from projects where id = ? for update", [
        ID.project,
      ]);
      const pending = replaceMaterialAllocationsForOrg(
        ID.project,
        ID.org,
        [],
        {
          materialPricingRevision: 1,
          materialPriceGeography: null,
        }
      );
      await blocker.query(
        `update projects
         set materialPriceGeography = 'dubai',
             material_pricing_revision = material_pricing_revision + 1
         where id = ? and orgId = ?`,
        [ID.project, ID.org]
      );
      await blocker.commit();

      await expect(pending).resolves.toBe(false);
      const [rows] = await pool.query<any[]>(
        "select id from material_allocations where projectId = ?",
        [ID.project]
      );
      expect(rows).toHaveLength(1);
    } finally {
      blocker.release();
    }
  });
});
