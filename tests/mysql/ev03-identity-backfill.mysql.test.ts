import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import {
  applyEv03IdentityBackfill,
  createEv03IdentityBackfillManifest,
  lockEv03IdentityBackfillDependencies,
  rollbackEv03IdentityBackfill,
} from "../../server/engines/material-pricing/ev03-identity-backfill";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(databaseUrl);
const target = new URL(databaseUrl);
const canonicalTarget = `${target.hostname}:${target.port || "3306"}/${target.pathname.slice(1)}`;

async function clearFixtures() {
  await pool.query("set foreign_key_checks=0");
  for (const table of [
    "rfq_line_items",
    "material_allocations",
    "finish_schedule_items",
    "materials_to_boards",
    "material_library",
    "materials_catalog",
    "specification",
    "product",
  ]) {
    await pool.query(`truncate table \`${table}\``);
  }
  await pool.query("set foreign_key_checks=1");
}

beforeEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await pool.end();
});

async function seedExactIdentityFixture() {
  await pool.query(
    `insert into product
      (id,identityKey,productName,canonicalCategory,createdVia)
     values
      (301,REPEAT('a',64),'Library Product','floors','manual'),
      (302,REPEAT('b',64),'Catalog Product','floors','manual')`
  );
  await pool.query(
    `insert into specification
      (id,specKey,category,finishLevel,unitBasis,geography,policyVersion)
     values
      (41,'floors:premium:per_sqm:uae','floors','premium','per_sqm','uae','ev02-spec-key-v1')`
  );
  await pool.query(
    `insert into material_library
      (id,product_id,category,tier,style,product_name,brand,supplier_name,
       unit_label)
     values
      (101,301,'flooring','premium','all','Library Product','Synthetic',
       'Synthetic Supplier','AED/sqm')`
  );
  await pool.query(
    `insert into materials_catalog
      (id,productId,name,category,tier,costUnit)
     values
      (201,302,'Catalog Product','stone','premium','AED/sqm')`
  );
  await pool.query(
    `insert into finish_schedule_items
      (id,project_id,organization_id,room_id,room_name,element,
       material_library_id)
     values (1,10,20,'R1','Living','floor',101)`
  );
  await pool.query(
    `insert into material_allocations
      (id,projectId,organizationId,roomId,roomName,element,materialLibraryId,
       materialName,allocationPct,surfaceAreaM2,unitCostMin,unitCostMax,
       totalCostMin,totalCostMax,generatedAt,updatedAt)
     values
      (2,10,20,'R1','Living','floor',101,'Library Product','100.00','25.00',
       '100.00','200.00','2500.00','5000.00',
       '2026-07-29 08:00:00','2026-07-29 08:00:00')`
  );
  await pool.query(
    `insert into materials_to_boards
      (id,boardId,materialId,quantity,unitOfMeasure)
     values (3,9,201,'12.00','sqm')`
  );
  await pool.query(
    `insert into rfq_line_items
      (id,project_id,organization_id,section_no,item_code,description,unit,
       quantity,unit_rate_aed_min,unit_rate_aed_max,total_aed_min,total_aed_max)
     values
      (4,10,20,1,'01-01','Premium marble wording is not identity','sqm',
       '25.00','100.00','200.00','2500.00','5000.00')`
  );
}

describe("EV-03 identity-only backfill on disposable MySQL", () => {
  it("proves forward apply, idempotency, later-write refusal, and field-only rollback", async () => {
    await seedExactIdentityFixture();
    const connection = await pool.getConnection();
    const context = {
      databaseTarget: canonicalTarget,
      migrationFingerprint: "c".repeat(64),
      now: new Date("2026-07-29T08:05:00.000Z"),
    };
    try {
      const [beforeAllocation] = await connection.query<mysql.RowDataPacket[]>(
        "select updatedAt,totalCostMin,totalCostMax from material_allocations where id=2"
      );
      const [beforeRfq] = await connection.query<mysql.RowDataPacket[]>(
        "select * from rfq_line_items where id=4"
      );

      await connection.beginTransaction();
      const dryRun = await createEv03IdentityBackfillManifest(
        connection,
        context
      );
      await connection.rollback();
      expect(dryRun.actions).toHaveLength(3);
      expect(dryRun.decisions).toEqual([
        expect.objectContaining({
          table: "rfq_line_items",
          proposedMapping: null,
        }),
      ]);

      await connection.beginTransaction();
      const applied = await applyEv03IdentityBackfill(connection, dryRun, {
        ...context,
        now: new Date("2026-07-29T08:06:00.000Z"),
      });
      await connection.commit();

      const [linked] = await connection.query<mysql.RowDataPacket[]>(
        `select product_id as productId,spec_id as specId,
           identity_state as identityState
         from finish_schedule_items where id=1
         union all
         select productId,specId,resolutionState
         from material_allocations where id=2
         union all
         select productId,specId,identityState
         from materials_to_boards where id=3`
      );
      expect(linked).toEqual([
        expect.objectContaining({
          productId: 301,
          specId: 41,
          identityState: "resolved",
        }),
        expect.objectContaining({
          productId: 301,
          specId: 41,
          identityState: "legacy_unverified",
        }),
        expect.objectContaining({
          productId: 302,
          specId: 41,
          identityState: "resolved",
        }),
      ]);
      const replay = await createEv03IdentityBackfillManifest(connection, {
        ...context,
        now: new Date("2026-07-29T08:07:00.000Z"),
      });
      expect(replay.actions).toHaveLength(0);

      await connection.query(
        "update finish_schedule_items set notes='later write' where id=1"
      );
      await expect(
        rollbackEv03IdentityBackfill(connection, applied, canonicalTarget)
      ).rejects.toThrow("later write");
      await connection.query(
        "update finish_schedule_items set notes=null where id=1"
      );

      await connection.beginTransaction();
      await rollbackEv03IdentityBackfill(connection, applied, canonicalTarget);
      await connection.commit();

      const [restored] = await connection.query<mysql.RowDataPacket[]>(
        `select product_id as productId,spec_id as specId,
           identity_state as identityState
         from finish_schedule_items where id=1
         union all
         select productId,specId,resolutionState
         from material_allocations where id=2
         union all
         select productId,specId,identityState
         from materials_to_boards where id=3`
      );
      expect(restored).toEqual([
        { productId: null, specId: null, identityState: "legacy_unverified" },
        { productId: null, specId: null, identityState: "legacy_unverified" },
        { productId: null, specId: null, identityState: "legacy_unverified" },
      ]);
      const [afterAllocation] = await connection.query<mysql.RowDataPacket[]>(
        "select updatedAt,totalCostMin,totalCostMax from material_allocations where id=2"
      );
      expect(afterAllocation).toEqual(beforeAllocation);
      const [afterRfq] = await connection.query<mysql.RowDataPacket[]>(
        "select * from rfq_line_items where id=4"
      );
      expect(afterRfq).toEqual(beforeRfq);
    } finally {
      connection.release();
    }
  });

  it("serializes a concurrent source-product change before applying the mapping", async () => {
    await seedExactIdentityFixture();
    const writer = await pool.getConnection();
    const racer = await pool.getConnection();
    const context = {
      databaseTarget: canonicalTarget,
      migrationFingerprint: "d".repeat(64),
      now: new Date("2026-07-29T08:10:00.000Z"),
    };
    try {
      const dryRun = await createEv03IdentityBackfillManifest(writer, context);
      await writer.beginTransaction();
      await lockEv03IdentityBackfillDependencies(writer, dryRun.actions);

      await racer.query("set session innodb_lock_wait_timeout=1");
      await racer.beginTransaction();
      await expect(
        racer.query("update material_library set product_id=302 where id=101")
      ).rejects.toThrow(/Lock wait timeout|ER_LOCK_WAIT_TIMEOUT/i);
      await racer.rollback();

      const applied = await applyEv03IdentityBackfill(writer, dryRun, context);
      await writer.commit();
      expect(applied.actions).toHaveLength(3);
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        "select material_library_id,product_id,spec_id from finish_schedule_items where id=1"
      );
      expect(rows).toEqual([
        { material_library_id: 101, product_id: 301, spec_id: 41 },
      ]);
    } finally {
      await writer.rollback().catch(() => undefined);
      await racer.rollback().catch(() => undefined);
      writer.release();
      racer.release();
    }
  });

  it("serializes a concurrent target source-reference change before applying the mapping", async () => {
    await seedExactIdentityFixture();
    const writer = await pool.getConnection();
    const racer = await pool.getConnection();
    const context = {
      databaseTarget: canonicalTarget,
      migrationFingerprint: "e".repeat(64),
      now: new Date("2026-07-29T08:15:00.000Z"),
    };
    try {
      const dryRun = await createEv03IdentityBackfillManifest(writer, context);
      await writer.beginTransaction();
      await lockEv03IdentityBackfillDependencies(writer, dryRun.actions);

      await racer.query("set session innodb_lock_wait_timeout=1");
      await racer.beginTransaction();
      await expect(
        racer.query(
          "update finish_schedule_items set material_library_id=null where id=1"
        )
      ).rejects.toThrow(/Lock wait timeout|ER_LOCK_WAIT_TIMEOUT/i);
      await racer.rollback();

      await applyEv03IdentityBackfill(writer, dryRun, context);
      await writer.commit();
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        "select material_library_id,product_id,spec_id from finish_schedule_items where id=1"
      );
      expect(rows).toEqual([
        { material_library_id: 101, product_id: 301, spec_id: 41 },
      ]);
    } finally {
      await writer.rollback().catch(() => undefined);
      await racer.rollback().catch(() => undefined);
      writer.release();
      racer.release();
    }
  });
});
