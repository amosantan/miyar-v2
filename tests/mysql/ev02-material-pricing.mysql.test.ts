import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import {
  createEvidenceRecord,
  createBenchmarkProposal,
  deleteEvidenceRecord,
  reviewBenchmarkProposal,
  upsertPublicEvidenceObservation,
} from "../../server/db";
import {
  insertPriceObservation,
  insertSupersedingPriceObservation,
  insertSupplierQuote,
  insertSupersedingSupplierQuote,
} from "../../server/db/material-pricing";
import {
  applyEv02LegacyBackfill,
  rollbackEv02LegacyBackfill,
} from "../../server/engines/material-pricing/backfill";
import { assertEv02ProductionSchemaContract } from "../../server/engines/material-pricing/backfill-schema-contract";
import { resolveGovernedMaterialValue } from "../../server/engines/material-pricing/resolver";
import { buildProductIdentityKey } from "../../server/engines/material-pricing/policy";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(url);
const target = new URL(url);
const canonicalTarget = `${target.hostname}:${target.port || "3306"}/${target.pathname.slice(1)}`;

async function truncateFixtures() {
  await pool.query("set foreign_key_checks=0");
  for (const table of [
    "benchmark_proposals",
    "supplier_quote",
    "specification",
    "product",
    "evidence_records",
    "material_library",
    "materials_catalog",
  ]) {
    await pool.query(`truncate table \`${table}\``);
  }
  await pool.query("set foreign_key_checks=1");
}

beforeAll(async () =>
  assertEv02ProductionSchemaContract(pool as unknown as mysql.Connection)
);
beforeEach(truncateFixtures);
afterAll(async () => pool.end());

async function insertSpec() {
  const [result] = await pool.execute(
    `insert into specification
      (specKey,category,finishLevel,unitBasis,geography,policyVersion)
     values ('floors:standard:per_sqm:uae','floors','standard','per_sqm','uae','test-v1')`
  );
  return Number((result as { insertId: number }).insertId);
}

async function insertGovernedValue(input: {
  specId: number;
  orgId: number | null;
  quoteId: number | null;
  rung: string;
  p50: string;
}) {
  await pool.execute(
    `insert into benchmark_proposals
     (benchmarkKey,specId,orgId,priceScope,sourceKind,sourceLadderRung,
      supplierQuoteId,keyPolicyVersion,proposedP25,proposedP50,proposedP75,
      weightedMean,evidenceCount,sourceDiversity,reliabilityDist,recencyDist,
      confidenceScore,recommendation,status,reviewedBy,reviewedAt,createdAt)
     values ('floors:standard:per_sqm:uae',?,?,'supply_only','observed',?,?,
      'test-v1',?,?,?, ?,1,1,JSON_OBJECT('A',1),JSON_OBJECT('recent',1),
      90,'publish','approved',9001,'2026-07-21','2026-07-21')`,
    [
      input.specId,
      input.orgId,
      input.rung,
      input.quoteId,
      input.p50,
      input.p50,
      input.p50,
      input.p50,
    ]
  );
}

describe("EV-02 disposable MySQL evidence and price schema", () => {
  it("requires immutable human approval provenance for governed values", async () => {
    const specId = await insertSpec();
    const proposalData = {
      benchmarkKey: "floors:standard:per_sqm:uae",
      specId,
      priceScope: "supply_only" as const,
      sourceKind: "observed" as const,
      sourceLadderRung: "official_statistic" as const,
      proposedP25: "140.00",
      proposedP50: "150.00",
      proposedP75: "160.00",
      weightedMean: "150.00",
      evidenceCount: 1,
      sourceDiversity: 1,
      reliabilityDist: { A: 1 },
      recencyDist: { recent: 1 },
      confidenceScore: 90,
      recommendation: "publish" as const,
    };
    const proposal = await createBenchmarkProposal({
      ...proposalData,
      status: "approved",
      reviewedBy: 9001,
      reviewedAt: new Date("2026-07-20T00:00:00Z"),
    } as never);
    const [created] = await pool.query<mysql.RowDataPacket[]>(
      "select status,reviewedBy,reviewedAt from benchmark_proposals where id=?",
      [proposal.id]
    );
    expect(created[0]).toMatchObject({
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
    });

    await pool.execute(
      `insert into benchmark_proposals
       (benchmarkKey,specId,priceScope,sourceKind,sourceLadderRung,
        proposedP25,proposedP50,proposedP75,weightedMean,evidenceCount,
        sourceDiversity,reliabilityDist,recencyDist,confidenceScore,
        recommendation,status,reviewedAt,createdAt)
       values (?,?, 'supply_only','observed','official_statistic',
        '10.00','10.00','10.00','10.00',1,1,JSON_OBJECT('A',1),
        JSON_OBJECT('recent',1),90,'publish','approved','2026-07-20','2026-07-19')`,
      ["unproven", specId]
    );
    await expect(
      resolveGovernedMaterialValue({
        specId,
        priceScope: "supply_only",
        asOf: new Date("2026-07-22T00:00:00Z"),
      })
    ).resolves.toMatchObject({ status: "insufficient" });

    await expect(
      reviewBenchmarkProposal(
        proposal.id,
        { status: "approved", reviewedBy: 9001 },
        { now: new Date("2026-07-21T00:00:00Z") }
      )
    ).resolves.toBe(true);
    await expect(
      reviewBenchmarkProposal(
        proposal.id,
        { status: "rejected", reviewedBy: 9002 },
        { now: new Date("2026-07-22T00:00:00Z") }
      )
    ).resolves.toBe(false);

    const successor = await createBenchmarkProposal({
      ...proposalData,
      supersedesId: proposal.id,
      proposedP50: "155.00",
      weightedMean: "155.00",
    });
    await expect(
      reviewBenchmarkProposal(
        successor.id,
        { status: "approved", reviewedBy: 9001 },
        { now: new Date("2026-07-24T00:00:00Z") }
      )
    ).resolves.toBe(true);
    await expect(
      resolveGovernedMaterialValue({
        specId,
        priceScope: "supply_only",
        asOf: new Date("2026-07-23T00:00:00Z"),
      })
    ).resolves.toMatchObject({
      status: "resolved",
      value: { benchmarkProposalId: proposal.id, p50: "150.00" },
    });
    await expect(
      resolveGovernedMaterialValue({
        specId,
        priceScope: "supply_only",
        asOf: new Date("2026-07-25T00:00:00Z"),
      })
    ).resolves.toMatchObject({
      status: "resolved",
      value: { benchmarkProposalId: successor.id, p50: "155.00" },
    });
  });

  it("isolates quote authority by organization and enforces append-only supersession", async () => {
    const specId = await insertSpec();
    const first = await insertSupplierQuote({
      orgId: 7101,
      supplierName: "EV02 Supplier",
      quoteRef: "EV02-Q-1",
      receivedAt: new Date("2026-07-20T00:00:00Z"),
      validUntil: new Date("2026-08-20T00:00:00Z"),
      createdBy: 9001,
    });
    await insertGovernedValue({
      specId,
      orgId: 7101,
      quoteId: first.id,
      rung: "supplier_quote",
      p50: "125.00",
    });
    await insertGovernedValue({
      specId,
      orgId: null,
      quoteId: null,
      rung: "official_statistic",
      p50: "150.00",
    });
    await insertGovernedValue({
      specId,
      orgId: 7102,
      quoteId: first.id,
      rung: "supplier_quote",
      p50: "50.00",
    });

    await expect(
      resolveGovernedMaterialValue({
        specId,
        organizationId: 7101,
        priceScope: "supply_only",
        asOf: new Date("2026-07-28T00:00:00Z"),
      })
    ).resolves.toMatchObject({
      status: "resolved",
      value: { p50: "125.00", organizationId: 7101 },
    });
    await expect(
      resolveGovernedMaterialValue({
        specId,
        organizationId: 7102,
        priceScope: "supply_only",
        asOf: new Date("2026-07-28T00:00:00Z"),
      })
    ).resolves.toMatchObject({
      status: "resolved",
      value: { p50: "150.00", organizationId: null },
    });

    await pool.execute(
      `insert into supplier_quote
       (orgId,supplierName,quoteRef,receivedAt,validUntil,supersedesId,createdBy)
       values (7102,'Hostile supplier','EV02-MALFORMED','2026-07-24',
        '2026-08-24',?,9002)`,
      [first.id]
    );
    await expect(
      resolveGovernedMaterialValue({
        specId,
        organizationId: 7101,
        priceScope: "supply_only",
        asOf: new Date("2026-07-28T00:00:00Z"),
      })
    ).resolves.toMatchObject({
      status: "resolved",
      value: { p50: "125.00", organizationId: 7101 },
    });
    await pool.execute(
      "delete from supplier_quote where quoteRef='EV02-MALFORMED'"
    );

    const successor = await insertSupersedingSupplierQuote({
      predecessorId: first.id,
      orgId: 7101,
      data: {
        supplierName: "EV02 Supplier",
        quoteRef: "EV02-Q-2",
        receivedAt: new Date("2026-07-25T00:00:00Z"),
        validUntil: new Date("2026-08-25T00:00:00Z"),
        createdBy: 9001,
      },
    });
    expect(successor.id).toBeGreaterThan(first.id);
    await expect(
      resolveGovernedMaterialValue({
        specId,
        organizationId: 7101,
        priceScope: "supply_only",
        asOf: new Date("2026-07-24T00:00:00Z"),
      })
    ).resolves.toMatchObject({
      status: "resolved",
      value: { p50: "125.00" },
    });
    await expect(
      resolveGovernedMaterialValue({
        specId,
        organizationId: 7101,
        priceScope: "supply_only",
        asOf: new Date("2026-07-26T00:00:00Z"),
      })
    ).resolves.toMatchObject({
      status: "resolved",
      value: { p50: "150.00", organizationId: null },
    });
    await expect(
      insertSupplierQuote({
        orgId: 7102,
        supplierName: "Hostile supplier",
        quoteRef: "EV02-CROSS-ORG",
        receivedAt: new Date("2026-07-26T00:00:00Z"),
        createdBy: 9002,
        supersedesId: first.id,
      } as never)
    ).rejects.toThrow("insertSupersedingSupplierQuote");
    await expect(
      insertSupersedingSupplierQuote({
        predecessorId: first.id,
        orgId: 7101,
        data: {
          supplierName: "EV02 Supplier",
          quoteRef: "EV02-Q-3",
          receivedAt: new Date("2026-07-26T00:00:00Z"),
          createdBy: 9001,
        },
      })
    ).rejects.toThrow("already superseded");
  });

  it("requires specification and explicit scope on the closed observation helper", async () => {
    const specId = await insertSpec();
    const original = await insertPriceObservation({
      recordId: "EV02-OBS-1",
      category: "floors",
      itemName: "Test observation",
      unit: "sqm",
      sourceUrl: "https://example.invalid/ev02",
      captureDate: new Date("2026-07-28T00:00:00Z"),
      reliabilityGrade: "B",
      confidenceScore: 70,
      specId,
      priceScope: "supply_only",
      observationKind: "manual",
    });
    expect(original).toMatchObject({ id: expect.any(Number) });
    await expect(deleteEvidenceRecord(original.id)).rejects.toThrow(
      "append-only"
    );
    const [preserved] = await pool.query<mysql.RowDataPacket[]>(
      "select id from evidence_records where id=?",
      [original.id]
    );
    expect(preserved).toHaveLength(1);
    await expect(
      createEvidenceRecord({
        recordId: "EV02-RAW-GOVERNED",
        category: "floors",
        itemName: "Raw governed write",
        unit: "sqm",
        sourceUrl: "https://example.invalid/raw",
        captureDate: new Date("2026-07-28T00:00:00Z"),
        reliabilityGrade: "B",
        confidenceScore: 70,
        specId,
        priceScope: "supply_only",
        observationKind: "manual",
      })
    ).rejects.toThrow("append-only material-pricing helper");
    await expect(
      insertSupersedingPriceObservation({
        predecessorId: original.id,
        orgId: null,
        data: {
          recordId: "EV02-OBS-1-CORRECTION",
          category: "floors",
          itemName: "Corrected observation",
          unit: "sqm",
          sourceUrl: "https://example.invalid/ev02-correction",
          captureDate: new Date("2026-07-28T01:00:00Z"),
          reliabilityGrade: "B",
          confidenceScore: 75,
          specId,
          priceScope: "supply_only",
          observationKind: "manual",
        },
      })
    ).resolves.toMatchObject({ id: expect.any(Number) });
    await expect(
      insertSupersedingPriceObservation({
        predecessorId: original.id,
        orgId: null,
        data: {
          recordId: "EV02-OBS-1-SECOND",
          category: "floors",
          itemName: "Second correction",
          unit: "sqm",
          sourceUrl: "https://example.invalid/ev02-second",
          captureDate: new Date("2026-07-28T02:00:00Z"),
          reliabilityGrade: "B",
          confidenceScore: 75,
          specId,
          priceScope: "supply_only",
          observationKind: "manual",
        },
      })
    ).rejects.toThrow("already superseded");
    await expect(
      insertPriceObservation({
        recordId: "EV02-OBS-2",
        category: "floors",
        itemName: "Missing specification",
        unit: "sqm",
        sourceUrl: "https://example.invalid/ev02-2",
        captureDate: new Date("2026-07-28T00:00:00Z"),
        reliabilityGrade: "B",
        confidenceScore: 70,
        specId: 999999,
        priceScope: "supply_only",
        observationKind: "manual",
      })
    ).rejects.toThrow("Specification not found");
  });

  it("preserves repeated connector captures as an idempotent successor chain", async () => {
    const assessment = {
      runId: "EV02-RUN",
      sourceId: "77",
      corpusScope: "platform_public" as const,
      origin: "connector" as const,
      outcome: "accepted" as const,
      evaluationClock: new Date("2026-07-28T00:00:00Z"),
      datePrecision: "timestamp" as const,
      parsingStatus: "valid" as const,
      confidencePolicyId: "ev02-test",
      qualityPolicyId: "ev02-test",
      mergePolicyId: "ev02-test",
      grade: "B" as const,
      candidateScore: 70,
      finalScore: 70,
      mergeDecision: "inserted" as const,
    };
    const base = {
      projectId: null,
      orgId: null,
      sourceRegistryId: 77,
      category: "floors" as const,
      itemName: "Append-only tile",
      unit: "sqm",
      currencyOriginal: "AED",
      sourceUrl: "https://example.invalid/append-only",
      reliabilityGrade: "B" as const,
      confidenceScore: 70,
      platformProductKey: "APPEND-1",
      corpusScope: "platform_public" as const,
      corpusPolicyVersion: "public-v1",
    };
    const first = await upsertPublicEvidenceObservation(
      {
        ...base,
        recordId: "EV02-APPEND-1",
        priceTypical: "100.00",
        captureDate: new Date("2026-07-27T00:00:00Z"),
      },
      assessment
    );
    const secondInput = {
      ...base,
      recordId: "EV02-APPEND-2",
      priceTypical: "120.00",
      captureDate: new Date("2026-07-28T00:00:00Z"),
    };
    const second = await upsertPublicEvidenceObservation(
      secondInput,
      assessment
    );
    expect(second.id).not.toBe(first.id);
    expect(second.created).toBe(false);
    await expect(
      upsertPublicEvidenceObservation(secondInput, assessment)
    ).resolves.toMatchObject({ id: second.id, created: false });
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `select id,priceTypical,supersedesObservationId
       from evidence_records order by id`
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: first.id,
        priceTypical: "100.00",
        supersedesObservationId: null,
      }),
      expect.objectContaining({
        id: second.id,
        priceTypical: "120.00",
        supersedesObservationId: first.id,
      }),
    ]);
  });

  it("backfills idempotently, reports unresolved rows, restores links, and preserves legacy numbers", async () => {
    const libraryIdentity = buildProductIdentityKey([
      "global",
      "brand-code",
      "Exact Brand",
      "EX-1",
    ]);
    const evidenceIdentity = buildProductIdentityKey([
      "global",
      "source-product",
      77,
      "SKU-77",
    ]);
    await pool.execute(
      `insert into product
       (identityKey,brand,productCode,productName,canonicalCategory,createdVia,sourceRegistryId)
       values
       (?,'Exact Brand','EX-1','Existing identity','floors','manual',null),
       (?,null,'SKU-77','Existing evidence identity','walls','manual',77)`,
      [libraryIdentity, evidenceIdentity]
    );
    await pool.execute(
      `insert into product
       (orgId,identityKey,brand,productCode,productName,canonicalCategory,createdVia)
       values
       (7101,?,'Tenant Brand','SHARED-SKU','Tenant A','floors','manual'),
       (7102,?,'Tenant Brand','SHARED-SKU','Tenant B','floors','manual')`,
      [
        buildProductIdentityKey([
          "org",
          7101,
          "brand-code",
          "Tenant Brand",
          "SHARED-SKU",
        ]),
        buildProductIdentityKey([
          "org",
          7102,
          "brand-code",
          "Tenant Brand",
          "SHARED-SKU",
        ]),
      ]
    );
    await expect(
      pool.execute(
        `insert into product
         (orgId,identityKey,brand,productCode,productName,canonicalCategory,createdVia)
         values (7101,?,'Tenant Brand','SHARED-SKU','Duplicate','floors','manual')`,
        [
          buildProductIdentityKey([
            "org",
            7101,
            "brand-code",
            "Tenant Brand",
            "SHARED-SKU",
          ]),
        ]
      )
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await pool.execute(
      `insert into material_library
       (category,tier,product_code,product_name,brand,supplier_name,unit_label,
        price_aed_min,price_aed_max)
       values
       ('flooring','mid','EX-1','Exact identity','Exact Brand','Supplier','sqm','100.00','150.01'),
       ('lighting','premium',null,'Incomplete','Brand B','Supplier','piece',null,'300.00'),
       ('joinery','mid',null,'Unknown basis','Brand C','Supplier','lot','400.00','500.00')`
    );
    await pool.execute(
      "insert into materials_catalog (name,category,tier) values ('Catalog only','tile','mid')"
    );
    await pool.execute(
      `insert into evidence_records
       (recordId,sourceRegistryId,category,itemName,unit,sourceUrl,captureDate,
        reliabilityGrade,confidenceScore,platformProductKey)
       values
       ('EV02-E-1',77,'walls','Stable evidence A','sqm','https://example.invalid/a',now(),'B',70,'SKU-77')`
    );
    const [before] = await pool.query<mysql.RowDataPacket[]>(
      "select id,price_aed_min,price_aed_max from material_library order by id"
    );
    const beforeHash = createHash("sha256")
      .update(JSON.stringify(before))
      .digest("hex");

    const connection = await pool.getConnection();
    let first;
    try {
      await connection.beginTransaction();
      first = await applyEv02LegacyBackfill(connection, {
        databaseTarget: canonicalTarget,
        now: new Date("2026-07-28T00:00:00Z"),
      });
      await connection.commit();
      await connection.beginTransaction();
      const second = await applyEv02LegacyBackfill(connection, {
        databaseTarget: canonicalTarget,
        now: new Date("2026-07-28T00:00:00Z"),
      });
      await connection.commit();
      expect(second.insertedProductIds).toEqual([]);
      expect(second.insertedSpecificationIds).toEqual([]);
      expect(second.insertedBenchmarkProposalIds).toEqual([]);
      expect(first.unresolved.map(row => row.reason).sort()).toEqual([
        "incomplete_price_range",
        "unknown_unit_basis",
      ]);
      const [governed] = await pool.query<mysql.RowDataPacket[]>(
        "select proposedP25,proposedP50,proposedP75,weightedMean,priceScope from benchmark_proposals"
      );
      expect(governed).toEqual([
        expect.objectContaining({
          proposedP25: "100.00",
          proposedP50: "125.01",
          proposedP75: "150.01",
          weightedMean: "125.01",
          priceScope: null,
        }),
      ]);
      const [evidenceProducts] = await pool.query<mysql.RowDataPacket[]>(
        "select productId from evidence_records order by id"
      );
      const [stableEvidenceProduct] = await pool.query<mysql.RowDataPacket[]>(
        "select id from product where sourceRegistryId=77 and productCode='SKU-77'"
      );
      expect(evidenceProducts[0].productId).toBe(stableEvidenceProduct[0].id);

      await pool.execute(
        `insert into evidence_records
         (recordId,category,itemName,unit,sourceUrl,captureDate,reliabilityGrade,
          confidenceScore,specId,priceScope,observationKind)
         values
         ('EV02-ROLLBACK-REF','floors','Rollback reference','sqm',
          'https://example.invalid/rollback',now(),'B',70,?,'supply_only','manual')`,
        [first.insertedSpecificationIds[0]]
      );
      await connection.beginTransaction();
      await expect(
        rollbackEv02LegacyBackfill(connection, first, canonicalTarget)
      ).rejects.toThrow("specification has an evidence reference");
      await connection.rollback();
      const [stillLinked] = await pool.query<mysql.RowDataPacket[]>(
        "select product_id from material_library order by id"
      );
      expect(stillLinked.some(row => row.product_id !== null)).toBe(true);
      await pool.execute(
        "delete from evidence_records where recordId='EV02-ROLLBACK-REF'"
      );

      await pool.execute(
        "update benchmark_proposals set proposedP50='999.00' where id=?",
        [first.insertedBenchmarkProposalIds[0]]
      );
      await connection.beginTransaction();
      await expect(
        rollbackEv02LegacyBackfill(connection, first, canonicalTarget)
      ).rejects.toThrow("governed value");
      await connection.rollback();
      await pool.execute(
        "update benchmark_proposals set proposedP50=? where id=?",
        [first.insertedBenchmarks[0].p50, first.insertedBenchmarkProposalIds[0]]
      );

      await connection.beginTransaction();
      await rollbackEv02LegacyBackfill(connection, first, canonicalTarget);
      await connection.commit();
      const [links] = await pool.query<mysql.RowDataPacket[]>(
        "select product_id from material_library order by id"
      );
      expect(links.every(row => row.product_id === null)).toBe(true);

      await connection.beginTransaction();
      const reapplied = await applyEv02LegacyBackfill(connection, {
        databaseTarget: canonicalTarget,
        now: new Date("2026-07-28T00:00:00Z"),
      });
      await connection.commit();
      expect(reapplied.insertedBenchmarkProposalIds).toHaveLength(1);
    } finally {
      connection.release();
    }

    const [after] = await pool.query<mysql.RowDataPacket[]>(
      "select id,price_aed_min,price_aed_max from material_library order by id"
    );
    expect(
      createHash("sha256").update(JSON.stringify(after)).digest("hex")
    ).toBe(beforeHash);
    expect(after).toHaveLength(before.length);
  });
});
