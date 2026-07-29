import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { inspectDatabaseTarget } from "../../_core/database-safety";
import {
  EV03_MIGRATION_SHA256,
  EV03_PRODUCTION_DATABASE_TARGET,
  EV03_PRODUCTION_TARGET,
  EV03_IDENTITY_BACKFILL_APPROVAL_REF,
  EV03_IDENTITY_BACKFILL_VERSION,
  applyEv03IdentityBackfill,
  assertEv03CompletionSummaryBindsManifest,
  assertEv03ManifestIntegrity,
  assertEv03ManifestSafety,
  buildEv03IdentityBackfillPlan,
  createEv03IdentityBackfillManifest,
  fingerprintEv03Value,
  normalizeEv03ConnectionUrlForInspection,
  resolveEv03BackfillExecutionTarget,
  rollbackEv03IdentityBackfill,
  type Ev03IdentityBackfillInput,
  type Ev03SourceRow,
} from "./ev03-identity-backfill";

const specification = {
  id: 41,
  specKey: "floors:premium:per_sqm:uae",
  category: "floors",
  finishLevel: "premium",
  unitBasis: "per_sqm",
  geography: "uae",
  policyVersion: "ev02-spec-key-v1",
};

function fixture(): Ev03IdentityBackfillInput {
  return {
    finishScheduleItems: [
      {
        id: 1,
        project_id: 10,
        organization_id: 20,
        material_library_id: 101,
        product_id: null,
        spec_id: null,
        identity_state: "legacy_unverified",
        room_name: "Living",
      },
    ],
    materialAllocations: [
      {
        id: 2,
        projectId: 10,
        organizationId: 20,
        materialLibraryId: 101,
        productId: null,
        specId: null,
        resolutionState: "legacy_unverified",
        allocationPct: "100.00",
        surfaceAreaM2: "25.00",
        unitCostMin: "100.00",
        unitCostMax: "200.00",
        totalCostMin: "2500.00",
        totalCostMax: "5000.00",
      },
    ],
    materialsToBoards: [
      {
        id: 3,
        boardId: 9,
        materialId: 201,
        productId: null,
        specId: null,
        identityState: "legacy_unverified",
        quantity: "12.00",
        costBandOverride: null,
      },
    ],
    rfqLineItems: [
      {
        id: 4,
        description: "Premium marble, wording is not an identity key",
        product_id: null,
        spec_id: null,
        resolution_state: "legacy_unverified",
        line_kind: "legacy_unverified",
        quantity: "25.00",
        unit_rate_aed_min: "100.00",
        unit_rate_aed_max: "200.00",
        total_aed_min: "2500.00",
        total_aed_max: "5000.00",
      },
    ],
    materialLibrary: [
      {
        id: 101,
        product_id: 301,
        category: "flooring",
        tier: "premium",
        unit_label: "AED/sqm",
      },
    ],
    materialsCatalog: [
      {
        id: 201,
        productId: 302,
        category: "stone",
        tier: "premium",
        costUnit: "AED/sqm",
      },
    ],
    specifications: [specification],
  };
}

function productionShapeFixture(): Ev03IdentityBackfillInput {
  const input = fixture();
  input.finishScheduleItems = Array.from({ length: 3 }, (_, index) => ({
    ...input.finishScheduleItems[0],
    id: 1_000 + index,
  }));
  input.materialAllocations = Array.from({ length: 45 }, (_, index) => ({
    ...input.materialAllocations[0],
    id: 2_000 + index,
  }));
  input.materialsToBoards = Array.from({ length: 3 }, (_, index) => ({
    ...input.materialsToBoards[0],
    id: 3_000 + index,
  }));
  input.rfqLineItems = [];
  return input;
}

describe("EV-03 identity-only backfill planner", () => {
  it("copies identity only through exact legacy links and the EV-02 spec key", () => {
    const plan = buildEv03IdentityBackfillPlan(fixture());

    expect(plan.actions).toEqual([
      expect.objectContaining({
        table: "finish_schedule_items",
        id: 1,
        productId: 301,
        specId: 41,
        stateAfter: "resolved",
      }),
      expect.objectContaining({
        table: "material_allocations",
        id: 2,
        productId: 301,
        specId: 41,
        // Historical price snapshots have no reconstructable resolver clock or
        // provenance, so identity linkage cannot promote pricing state.
        stateAfter: "legacy_unverified",
      }),
      expect.objectContaining({
        table: "materials_to_boards",
        id: 3,
        productId: 302,
        specId: 41,
        stateAfter: "resolved",
      }),
    ]);
    expect(plan.decisions).toContainEqual(
      expect.objectContaining({
        table: "rfq_line_items",
        id: 4,
        reason: "historical_rfq_requires_explicit_classification",
        proposedMapping: null,
        mappingContext: {
          sourceTable: null,
          sourceId: null,
          canonicalCategory: null,
          finishLevel: null,
          unitBasis: null,
        },
      })
    );
    expect(JSON.stringify(plan.decisions)).not.toMatch(
      /not an identity key|organization|project|supplier|description|aiReasoning|contact/i
    );
  });

  it("leaves missing and ambiguous mappings legacy-unverified with a decision package", () => {
    const input = fixture();
    input.finishScheduleItems[0] = {
      ...input.finishScheduleItems[0],
      material_library_id: null,
    };
    input.materialAllocations[0] = {
      ...input.materialAllocations[0],
      materialLibraryId: 999,
    };
    input.materialsCatalog[0] = {
      ...input.materialsCatalog[0],
      costUnit: "descriptive only",
    };

    const plan = buildEv03IdentityBackfillPlan(input);

    expect(plan.actions).toHaveLength(0);
    expect(plan.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "finish_schedule_items",
          reason: "missing_exact_source_reference",
          requiredApprover: "material_data_owner",
        }),
        expect.objectContaining({
          table: "material_allocations",
          reason: "missing_exact_source_reference",
          numericalImpact: {
            fields: expect.objectContaining({
              totalCostMin: "2500.00",
              totalCostMax: "5000.00",
            }),
            changesNumericalAuthority: false,
          },
        }),
        expect.objectContaining({
          table: "materials_to_boards",
          reason: "unknown_unit_basis",
          proposedMapping: { productId: 302 },
        }),
      ])
    );
  });

  it("refuses non-EV-02, missing, or duplicate canonical specifications", () => {
    const wrongPolicy = fixture();
    wrongPolicy.specifications[0] = {
      ...wrongPolicy.specifications[0],
      policyVersion: "later-policy",
    };
    expect(buildEv03IdentityBackfillPlan(wrongPolicy).decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "missing_exact_ev02_specification",
        }),
      ])
    );

    const duplicate = fixture();
    duplicate.specifications.push({ ...specification, id: 42 });
    expect(buildEv03IdentityBackfillPlan(duplicate).decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "ambiguous_exact_ev02_specification",
        }),
      ])
    );
  });

  it("is deterministic and idempotently recognizes exact existing links", () => {
    const first = buildEv03IdentityBackfillPlan(fixture());
    const second = buildEv03IdentityBackfillPlan(fixture());
    expect(second.planFingerprint).toBe(first.planFingerprint);

    const linked = fixture();
    linked.finishScheduleItems[0] = {
      ...linked.finishScheduleItems[0],
      product_id: 301,
      spec_id: 41,
      identity_state: "resolved",
    };
    linked.materialAllocations[0] = {
      ...linked.materialAllocations[0],
      productId: 301,
      specId: 41,
    };
    linked.materialsToBoards[0] = {
      ...linked.materialsToBoards[0],
      productId: 302,
      specId: 41,
      identityState: "resolved",
    };
    const replay = buildEv03IdentityBackfillPlan(linked);
    expect(replay.actions).toHaveLength(0);
    expect(replay.alreadyLinked).toHaveLength(3);
  });

  it("fingerprints object keys canonically and meaningful values distinctly", () => {
    expect(fingerprintEv03Value({ b: 2, a: 1 })).toBe(
      fingerprintEv03Value({ a: 1, b: 2 })
    );
    expect(fingerprintEv03Value({ a: 1 })).not.toBe(
      fingerprintEv03Value({ a: 2 })
    );
  });

  it("recursively rejects raw fields and confidential content from manifests", () => {
    expect(() =>
      assertEv03ManifestSafety({
        decisions: [{ sourceRow: { description: "customer text" } }],
      })
    ).toThrow("Forbidden EV-03 manifest field");
    expect(() =>
      assertEv03ManifestSafety({
        decisions: [{ mappingContext: { unitBasis: "secret@example.com" } }],
      })
    ).toThrow("Unsafe EV-03 manifest content");
    expect(() =>
      assertEv03ManifestSafety({
        decisions: [
          {
            id: 4,
            table: "rfq_line_items",
            mappingContext: {
              sourceTable: null,
              sourceId: null,
              canonicalCategory: "floors",
              finishLevel: "premium",
              unitBasis: "per_sqm",
            },
            numericalImpact: {
              fields: { quantity: "25.000", total_aed_min: "2500.00" },
              changesNumericalAuthority: false,
            },
          },
        ],
      })
    ).not.toThrow();
  });
});

class MemoryConnection {
  readonly tables: Record<string, Ev03SourceRow[]>;
  readonly queries: string[] = [];
  rollbackConflictTable: string | null = null;
  shortAffectedRowsTable: string | null = null;
  private transactionSnapshot: Record<string, Ev03SourceRow[]> | null = null;

  constructor(input: Ev03IdentityBackfillInput) {
    this.tables = {
      finish_schedule_items: input.finishScheduleItems,
      material_allocations: input.materialAllocations,
      materials_to_boards: input.materialsToBoards,
      rfq_line_items: input.rfqLineItems,
      material_library: input.materialLibrary,
      materials_catalog: input.materialsCatalog,
      specification: input.specifications,
      product: [{ id: 301 }, { id: 302 }],
    };
  }

  async query(options: string | { sql: string; values?: unknown[] }) {
    const sql = typeof options === "string" ? options : options.sql;
    const values = typeof options === "string" ? [] : (options.values ?? []);
    this.queries.push(sql.replace(/\s+/g, " ").trim());
    if (sql.includes("/* ev03 rollback compatibility */")) {
      const table = /from `([a-z_]+)`/i.exec(sql)?.[1];
      return [
        table && table === this.rollbackConflictTable ? [{ id: 999 }] : [],
        [],
      ];
    }
    const selectAll = /^select \* from `?([a-z_]+)`? order by id$/i.exec(sql);
    if (selectAll) return [this.copy(selectAll[1]), []];
    const selectOne = /^select \* from `([a-z_]+)` where id=\?$/i.exec(sql);
    if (selectOne) {
      return [
        this.copy(selectOne[1]).filter(row => row.id === Number(values[0])),
        [],
      ];
    }
    const selectMany =
      /^select \* from `([a-z_]+)`\s+where id in \(([^)]+)\)\s+order by id$/i.exec(
        sql.replace(/\s+/g, " ").trim()
      );
    if (selectMany) {
      const ids = values.map(Number);
      return [
        this.copy(selectMany[1])
          .filter(row => ids.includes(row.id))
          .sort((a, b) => a.id - b.id),
        [],
      ];
    }
    const lockRows =
      /^select id from `([a-z_]+)`\s+where id in \(([^)]+)\)\s+order by id for update$/i.exec(
        sql.replace(/\s+/g, " ").trim()
      );
    if (lockRows) {
      const ids = values.map(Number);
      return [
        this.copy(lockRows[1])
          .filter(row => ids.includes(row.id))
          .map(row => ({ id: row.id }))
          .sort((a, b) => a.id - b.id),
        [],
      ];
    }
    if (/select p\.id as productId, s\.id as specId/i.test(sql)) {
      const specId = Number(values[0]);
      const sourceId = Number(values[1]);
      const productId = Number(values[2]);
      const policy = String(values[3]);
      const spec = this.tables.specification.find(
        row => row.id === specId && row.policyVersion === policy
      );
      const product = this.tables.product.find(row => row.id === productId);
      const sourceTable = sql.includes("`material_library`")
        ? "material_library"
        : "materials_catalog";
      const sourceProduct =
        sourceTable === "material_library" ? "product_id" : "productId";
      const source = this.tables[sourceTable].find(
        row => row.id === sourceId && row[sourceProduct] === productId
      );
      return [spec && product && source ? [{ productId, specId }] : [], []];
    }
    if (/select requested\.actionId/i.test(sql)) {
      const sourceTable = sql.includes("`material_library`")
        ? "material_library"
        : "materials_catalog";
      const sourceProduct =
        sourceTable === "material_library" ? "product_id" : "productId";
      const policy = String(values.at(-1));
      const matches: { actionId: number }[] = [];
      for (let index = 0; index < values.length - 1; index += 4) {
        const actionId = Number(values[index]);
        const specId = Number(values[index + 1]);
        const sourceId = Number(values[index + 2]);
        const productId = Number(values[index + 3]);
        const spec = this.tables.specification.find(
          row => row.id === specId && row.policyVersion === policy
        );
        const product = this.tables.product.find(row => row.id === productId);
        const source = this.tables[sourceTable].find(
          row => row.id === sourceId && row[sourceProduct] === productId
        );
        if (spec && product && source) matches.push({ actionId });
      }
      return [matches.sort((a, b) => a.actionId - b.actionId), []];
    }
    const batchUpdate = /update `([a-z_]+)`[\s\S]+case id/i.exec(sql);
    if (batchUpdate) {
      const table = batchUpdate[1];
      const actionCount = (sql.match(/when \? then \?/g) ?? []).length / 3;
      const productColumn =
        table === "finish_schedule_items" ? "product_id" : "productId";
      const specColumn =
        table === "finish_schedule_items" ? "spec_id" : "specId";
      const stateColumn =
        table === "finish_schedule_items"
          ? "identity_state"
          : table === "material_allocations"
            ? "resolutionState"
            : "identityState";
      let affectedRows = 0;
      for (let index = 0; index < actionCount; index += 1) {
        const id = Number(values[index * 2]);
        const row = this.tables[table].find(candidate => candidate.id === id);
        if (
          !row ||
          row[productColumn] !== null ||
          row[specColumn] !== null ||
          row[stateColumn] !== "legacy_unverified"
        ) {
          continue;
        }
        row[productColumn] = values[index * 2 + 1];
        row[specColumn] = values[actionCount * 2 + index * 2 + 1];
        row[stateColumn] = values[actionCount * 4 + index * 2 + 1];
        affectedRows += 1;
      }
      if (table === this.shortAffectedRowsTable) affectedRows -= 1;
      return [{ affectedRows }, []];
    }
    const batchRollback =
      /update `([a-z_]+)`[\s\S]+set `[^`]+`=null[\s\S]+where \(/i.exec(sql);
    if (batchRollback) {
      const table = batchRollback[1];
      const columns = [...sql.matchAll(/`([^`]+)`/g)].map(match => match[1]);
      const product = columns[1];
      const spec = columns[2];
      const state = columns[3];
      let affectedRows = 0;
      for (let index = 0; index < values.length; index += 4) {
        const row = this.tables[table].find(
          candidate => candidate.id === Number(values[index])
        );
        if (
          !row ||
          row[product] !== values[index + 1] ||
          row[spec] !== values[index + 2] ||
          row[state] !== values[index + 3]
        ) {
          continue;
        }
        row[product] = null;
        row[spec] = null;
        row[state] = "legacy_unverified";
        affectedRows += 1;
      }
      if (table === this.shortAffectedRowsTable) affectedRows -= 1;
      return [{ affectedRows }, []];
    }
    const update = /update `([a-z_]+)`[\s\S]+where id=\?/i.exec(sql);
    if (update) {
      const table = update[1];
      const applying = /set `[^`]+`=\?, `[^`]+`=\?, `[^`]+`=\?/i.test(sql);
      const row = this.tables[table].find(
        candidate => candidate.id === Number(applying ? values[3] : values[0])
      );
      if (!row) return [{ affectedRows: 0 }, []];
      if (applying) {
        const columns = [...sql.matchAll(/`([^`]+)`=\?/g)].map(
          match => match[1]
        );
        if (
          row[columns[0]] !== null ||
          row[columns[1]] !== null ||
          row[columns[2]] !== "legacy_unverified"
        ) {
          return [{ affectedRows: 0 }, []];
        }
        const sourceReference =
          table === "finish_schedule_items"
            ? "material_library_id"
            : table === "material_allocations"
              ? "materialLibraryId"
              : "materialId";
        if (row[sourceReference] !== values[4]) {
          return [{ affectedRows: 0 }, []];
        }
        const sourceTable = sql.includes("`material_library` source")
          ? "material_library"
          : "materials_catalog";
        const sourceProduct =
          sourceTable === "material_library" ? "product_id" : "productId";
        const source = this.tables[sourceTable].find(
          candidate =>
            candidate.id === Number(values[5]) &&
            candidate[sourceProduct] === Number(values[6])
        );
        if (!source) return [{ affectedRows: 0 }, []];
        row[columns[0]] = values[0];
        row[columns[1]] = values[1];
        row[columns[2]] = values[2];
        return [{ affectedRows: 1 }, []];
      }
      const columns = [...sql.matchAll(/`([^`]+)`/g)].map(match => match[1]);
      const product = columns[1];
      const spec = columns[2];
      const state = columns[3];
      if (
        row[product] !== values[1] ||
        row[spec] !== values[2] ||
        row[state] !== values[3]
      ) {
        return [{ affectedRows: 0 }, []];
      }
      row[product] = null;
      row[spec] = null;
      row[state] = "legacy_unverified";
      return [{ affectedRows: 1 }, []];
    }
    throw new Error(`Unhandled test SQL: ${sql}`);
  }

  async beginTransaction() {
    this.transactionSnapshot = structuredClone(this.tables);
  }

  async commit() {
    this.transactionSnapshot = null;
  }

  async rollback() {
    if (!this.transactionSnapshot) return;
    for (const [table, rows] of Object.entries(this.transactionSnapshot)) {
      this.tables[table].splice(0, this.tables[table].length, ...rows);
    }
    this.transactionSnapshot = null;
  }

  private copy(table: string) {
    return this.tables[table].map(row => ({ ...row }));
  }
}

describe("EV-03 identity-only apply and recovery", () => {
  it("keeps a production-shaped 51-row apply and rollback within a bounded statement count", async () => {
    const connection = new MemoryConnection(productionShapeFixture());
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "f".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    const dryRun = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    expect(dryRun.actions).toHaveLength(51);

    connection.queries.length = 0;
    const applied = await applyEv03IdentityBackfill(
      connection as never,
      dryRun,
      { ...context, now: new Date("2026-07-29T08:01:00.000Z") }
    );
    expect(connection.queries.length).toBeLessThanOrEqual(20);
    expect(
      applied.actions.map(action => `${action.table}:${action.id}`)
    ).toEqual(dryRun.actions.map(action => `${action.table}:${action.id}`));

    connection.queries.length = 0;
    await rollbackEv03IdentityBackfill(
      connection as never,
      applied,
      context.databaseTarget
    );
    expect(connection.queries.length).toBeLessThanOrEqual(23);
    const replanned = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    expect(replanned.planFingerprint).toBe(dryRun.planFingerprint);
    expect(replanned.actions).toHaveLength(51);
    const reapplied = await applyEv03IdentityBackfill(
      connection as never,
      replanned,
      { ...context, now: new Date("2026-07-29T08:02:00.000Z") }
    );
    expect(reapplied.actions).toHaveLength(51);
    const zeroActionPlan = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    expect(zeroActionPlan.actions).toHaveLength(0);
  });

  it("treats a short batched affected-row count as an atomic failure", async () => {
    const connection = new MemoryConnection(productionShapeFixture());
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "9".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    const dryRun = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    connection.shortAffectedRowsTable = "material_allocations";
    await connection.beginTransaction();
    await expect(
      applyEv03IdentityBackfill(connection as never, dryRun, context)
    ).rejects.toThrow("Concurrent EV-03 identity write");
    await connection.rollback();
    expect(
      connection.tables.finish_schedule_items.every(
        row => row.product_id === null
      )
    ).toBe(true);
    expect(
      connection.tables.material_allocations.every(
        row => row.productId === null
      )
    ).toBe(true);
  });

  it("rolls back all prior table clears when a later rollback batch fails", async () => {
    const connection = new MemoryConnection(productionShapeFixture());
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "8".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    const dryRun = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    const applied = await applyEv03IdentityBackfill(
      connection as never,
      dryRun,
      { ...context, now: new Date("2026-07-29T08:01:00.000Z") }
    );
    connection.shortAffectedRowsTable = "material_allocations";
    await connection.beginTransaction();
    await expect(
      rollbackEv03IdentityBackfill(
        connection as never,
        applied,
        context.databaseTarget
      )
    ).rejects.toThrow("EV-03 rollback failed");
    await connection.rollback();
    expect(
      connection.tables.materials_to_boards.every(row => row.productId !== null)
    ).toBe(true);
    expect(
      connection.tables.material_allocations.every(
        row => row.productId !== null
      )
    ).toBe(true);
  });

  it("applies transaction-ready CAS writes, seals a recovery manifest, and clears only EV-03 fields", async () => {
    const connection = new MemoryConnection(fixture());
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "a".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    const dryRun = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    expect(dryRun.appliedAt).toBeNull();
    expect(dryRun.actions).toHaveLength(3);
    expect(JSON.stringify(dryRun)).not.toMatch(
      /Premium marble|project_id|organization_id|description|supplier|contact|aiReasoning/i
    );

    const applied = await applyEv03IdentityBackfill(
      connection as never,
      dryRun,
      { ...context, now: new Date("2026-07-29T08:01:00.000Z") }
    );
    expect(() => assertEv03ManifestIntegrity(applied)).not.toThrow();
    expect(() =>
      assertEv03CompletionSummaryBindsManifest(
        {
          mode: "apply",
          target: context.databaseTarget,
          fingerprint: applied.recoveryFingerprint!,
          rowCount: applied.actions.length,
          decisionCount: applied.decisions.length,
        },
        applied
      )
    ).not.toThrow();
    expect(() =>
      assertEv03CompletionSummaryBindsManifest(
        {
          mode: "apply",
          target: context.databaseTarget,
          fingerprint: "0".repeat(64),
          rowCount: applied.actions.length,
          decisionCount: applied.decisions.length,
        },
        applied
      )
    ).toThrow("does not bind");
    expect(connection.tables.material_allocations[0].resolutionState).toBe(
      "legacy_unverified"
    );
    expect(connection.tables.rfq_line_items[0]).toEqual(
      fixture().rfqLineItems[0]
    );

    await rollbackEv03IdentityBackfill(
      connection as never,
      applied,
      context.databaseTarget
    );
    expect(connection.tables.finish_schedule_items[0]).toMatchObject({
      product_id: null,
      spec_id: null,
      identity_state: "legacy_unverified",
      room_name: "Living",
    });
    expect(connection.tables.material_allocations[0]).toMatchObject({
      productId: null,
      specId: null,
      totalCostMax: "5000.00",
    });
  });

  it("refuses rollback after manifest tampering or a later row write", async () => {
    const connection = new MemoryConnection(fixture());
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "b".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    const dryRun = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    const applied = await applyEv03IdentityBackfill(
      connection as never,
      dryRun,
      { ...context, now: new Date("2026-07-29T08:01:00.000Z") }
    );
    expect(() =>
      assertEv03ManifestIntegrity({
        ...applied,
        databaseTarget: "changed",
      })
    ).toThrow("fingerprint mismatch");

    connection.tables.finish_schedule_items[0].room_name = "Later edit";
    await expect(
      rollbackEv03IdentityBackfill(
        connection as never,
        applied,
        context.databaseTarget
      )
    ).rejects.toThrow("later write");
  });

  it("refuses rollback after an EV-03 canonical write outside manifest ownership", async () => {
    const connection = new MemoryConnection(fixture());
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "e".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    const dryRun = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    const applied = await applyEv03IdentityBackfill(
      connection as never,
      dryRun,
      context
    );
    connection.rollbackConflictTable = "rfq_line_items";
    await expect(
      rollbackEv03IdentityBackfill(
        connection as never,
        applied,
        context.databaseTarget
      )
    ).rejects.toThrow("external canonical write in rfq_line_items");
  });

  it("refuses a stale source-product or target-reference mapping", async () => {
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "d".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    for (const mutate of [
      (connection: MemoryConnection) => {
        connection.tables.material_library[0].product_id = 302;
      },
      (connection: MemoryConnection) => {
        connection.tables.finish_schedule_items[0].material_library_id = 999;
      },
    ]) {
      const connection = new MemoryConnection(fixture());
      const dryRun = await createEv03IdentityBackfillManifest(
        connection as never,
        context
      );
      mutate(connection);
      await expect(
        applyEv03IdentityBackfill(connection as never, dryRun, context)
      ).rejects.toThrow("source data changed after dry-run");
      expect(connection.tables.finish_schedule_items[0].product_id).toBeNull();
    }
  });

  it("refuses a dry-run manifest whose exact mapping was edited", async () => {
    const connection = new MemoryConnection(fixture());
    const context = {
      databaseTarget: "127.0.0.1:3306/miyar_test_ev03",
      migrationFingerprint: "e".repeat(64),
      now: new Date("2026-07-29T08:00:00.000Z"),
    };
    const dryRun = await createEv03IdentityBackfillManifest(
      connection as never,
      context
    );
    dryRun.actions[0] = { ...dryRun.actions[0], sourceId: 999 };
    await expect(
      applyEv03IdentityBackfill(connection as never, dryRun, context)
    ).rejects.toThrow("dry-run manifest fingerprint mismatch");
  });
});

describe("EV-03 execution target gate", () => {
  it("normalizes only the mysql2 scheme emitted by pscale connect", () => {
    expect(
      normalizeEv03ConnectionUrlForInspection(
        "mysql2://root@127.0.0.1:3317/miyar-v2"
      )
    ).toBe("mysql://root@127.0.0.1:3317/miyar-v2");
    expect(
      normalizeEv03ConnectionUrlForInspection(
        "mysql://root@127.0.0.1:3317/miyar-v2"
      )
    ).toBe("mysql://root@127.0.0.1:3317/miyar-v2");
  });

  it("accepts a disposable loopback target by default", () => {
    const target = inspectDatabaseTarget(
      "mysql://root:secret@127.0.0.1:3306/miyar_test_ev03"
    );
    expect(
      resolveEv03BackfillExecutionTarget({ connectionTarget: target })
    ).toMatchObject({
      production: false,
      manifestTarget: "127.0.0.1:3306/miyar_test_ev03",
    });
  });

  it("requires the exact provider-bound production target and approvals", () => {
    const connectionTarget = inspectDatabaseTarget(
      "mysql://root@127.0.0.1:3317/miyar-v2"
    );
    const attestation = "e".repeat(64);
    const approved = {
      connectionTarget,
      productionTarget: EV03_PRODUCTION_TARGET,
      expectedMigrationSha256: EV03_MIGRATION_SHA256,
      approvalRef: EV03_IDENTITY_BACKFILL_APPROVAL_REF,
      databaseApproval: `migrate@${EV03_PRODUCTION_DATABASE_TARGET}`,
      providerAttestation: attestation,
      environmentAttestation: attestation,
    };
    expect(resolveEv03BackfillExecutionTarget(approved)).toMatchObject({
      production: true,
      manifestTarget: EV03_PRODUCTION_DATABASE_TARGET,
    });
    expect(() =>
      resolveEv03BackfillExecutionTarget({
        ...approved,
        expectedMigrationSha256: "f".repeat(64),
      })
    ).toThrow("migration digest mismatch");
    expect(() =>
      resolveEv03BackfillExecutionTarget({
        ...approved,
        providerAttestation: undefined,
      })
    ).toThrow("provider-bound runner attestation");
    expect(() =>
      resolveEv03BackfillExecutionTarget({
        ...approved,
        providerAttestation: "a".repeat(64),
      })
    ).toThrow("provider-bound runner attestation");
    expect(() =>
      resolveEv03BackfillExecutionTarget({
        ...approved,
        approvalRef: "user-approved:2026-07-30:ev03-0062-identity-backfill",
      })
    ).toThrow("approval must be exactly");
    expect(() =>
      resolveEv03BackfillExecutionTarget({
        ...approved,
        rollback: true,
      })
    ).toThrow("write-quiescent");
    expect(() =>
      resolveEv03BackfillExecutionTarget({
        ...approved,
        connectionTarget: inspectDatabaseTarget(
          `mysql://runner:secret@${EV03_PRODUCTION_DATABASE_TARGET}`
        ),
      })
    ).toThrow("wrapper-owned loopback");
    expect(() =>
      resolveEv03BackfillExecutionTarget({
        ...approved,
        connectionTarget: inspectDatabaseTarget(
          "mysql://root@127.0.0.1:3317/not-miyar"
        ),
      })
    ).toThrow("wrapper-owned loopback");
  });
});

describe("EV-03 migration/backfill contract", () => {
  it("is additive plus a backward-compatible lifecycle nullability widening", () => {
    const migration = readFileSync(
      new URL(
        "../../../drizzle/0062_ev03_material_consolidation.sql",
        import.meta.url
      ),
      "utf8"
    );
    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      EV03_MIGRATION_SHA256
    );
    expect(migration).toContain(
      "ALTER TABLE `finish_schedule_items` ADD `identity_state` enum('resolved','unresolved','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL"
    );
    expect(migration).toContain(
      "ALTER TABLE `material_allocations` ADD `resolutionState` enum('resolved','insufficient','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL"
    );
    expect(migration).toContain(
      "ALTER TABLE `materials_to_boards` ADD `identityState` enum('resolved','unresolved','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL"
    );
    expect(migration).toContain(
      "ALTER TABLE `rfq_line_items` ADD `resolution_state` enum('resolved','insufficient','legacy_unverified') DEFAULT 'legacy_unverified' NOT NULL"
    );
    expect(migration).toContain(
      "ALTER TABLE `sustainability_snapshots` MODIFY COLUMN `lifecycleCost` decimal(18,2)"
    );
    expect(migration).toContain(
      "ALTER TABLE `material_allocations` MODIFY COLUMN `element` enum('floor','walls','ceiling','joinery','hardware','sanitaryware') NOT NULL"
    );
    expect(migration).toContain(
      "ALTER TABLE `finish_schedule_items` MODIFY COLUMN `element` enum('floor','wall_primary','wall_feature','wall_wet','ceiling','joinery','hardware','sanitaryware') NOT NULL"
    );

    const schema = readFileSync(
      new URL("../../../drizzle/schema.ts", import.meta.url),
      "utf8"
    );
    const finishScheduleSchema = schema.slice(
      schema.indexOf(
        'export const finishScheduleItems = mysqlTable("finish_schedule_items"'
      ),
      schema.indexOf(
        "export type FinishScheduleItem = typeof finishScheduleItems.$inferSelect"
      )
    );
    expect(finishScheduleSchema).toContain('"wall_primary"');
    expect(finishScheduleSchema).toContain('"wall_feature"');
    expect(finishScheduleSchema).toContain('"wall_wet"');
    expect(finishScheduleSchema).not.toContain('"walls"');
    expect(finishScheduleSchema).toContain('"sanitaryware"');
  });

  it("contains no RFQ update or description-based identity inference", () => {
    const source = readFileSync(
      new URL("./ev03-identity-backfill.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/update\s+`?rfq_line_items/i);
    expect(source).not.toMatch(
      /description[^;\n]*(match|includes|startsWith|endsWith|test)\s*\(/i
    );
    expect(source).toMatch(/order by id for update/i);
    expect(EV03_IDENTITY_BACKFILL_VERSION).toBe("ev03-identity-backfill-v2");
  });

  it("ships a provider-owned production wrapper with exact release gates", () => {
    const wrapper = readFileSync(
      new URL(
        "../../../scripts/ev03-planetscale-identity-backfill.ts",
        import.meta.url
      ),
      "utf8"
    );
    const inner = readFileSync(
      new URL("../../../scripts/ev03-identity-backfill.ts", import.meta.url),
      "utf8"
    );
    expect(wrapper).toContain('const ORGANIZATION = "amr-saleh-hotmail"');
    expect(wrapper).toContain('const DATABASE = "miyar-v2"');
    expect(wrapper).toContain('const BRANCH = "main"');
    expect(wrapper).toContain('"auth", "check"');
    expect(wrapper).toContain('"deploy-request"');
    expect(wrapper).toContain("deployment_state");
    expect(wrapper).toContain("EV03_MIGRATION_SHA256");
    expect(wrapper).toContain('"connect"');
    expect(wrapper).toContain("randomBytes(32)");
    expect(wrapper).toContain("OPERATION_TIMEOUT_MS");
    expect(wrapper).toContain("--write-quiesced");
    expect(wrapper).toContain("--expect-zero-actions");
    expect(wrapper).not.toContain("result.stderr");
    expect(wrapper).toContain('"--provider-attestation"');
    expect(inner).toContain('"--provider-attestation"');
    expect(wrapper).toContain("assertEv03CompletionSummaryBindsManifest(");
    expect(inner).toContain("assertEv03MigrationSchema(connection)");
    expect(inner).toContain("Production EV-03 manifest path must be absolute");
    expect(inner).toContain("owner-owned regular 0600 file");
  });
});
