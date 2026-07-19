import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import * as db from "../../server/db";
import { canonicalizeGeometry } from "../../server/engines/geometry/canonical-geometry";
import {
  GEOMETRY_SCHEMA_VERSION,
  ROOM_FLOOR_POLYGON_AREA,
} from "../../shared/geometry";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(connectionString);

const newTables = [
  "artifact_input_snapshots",
  "geometry_reconciliation_events",
  "measurement_input_edges",
  "measurement_records",
  "legacy_space_links",
  "space_versions",
  "space_identities",
  "spatial_graph_versions",
  "geometry_sources",
  "project_geometry_authorities",
] as const;

async function truncateData() {
  await pool.query("set foreign_key_checks = 0");
  for (const table of [
    ...newTables,
    "amenity_sub_spaces",
    "material_allocations",
    "space_program_rooms",
    "report_instances",
    "score_matrices",
    "project_assets",
    "organization_members",
    "projects",
    "users",
    "organizations",
  ]) {
    await pool.query(`truncate table \`${table}\``);
  }
  await pool.query("set foreign_key_checks = 1");
}

async function resetData() {
  await truncateData();
  await pool.query(`
    insert into organizations (id, name, slug) values
      (8101, 'DI Org A', 'di-org-a'),
      (8202, 'DI Org B', 'di-org-b')
  `);
  await pool.query(`
    insert into users (id, openId, name, orgId) values
      (8101, 'di-user-a', 'DI User A', 8101),
      (8202, 'di-user-b', 'DI User B', 8202)
  `);
  await pool.query(`
    insert into organization_members (id, orgId, userId, role) values
      (8101, 8101, 8101, 'admin'),
      (8202, 8202, 8202, 'admin')
  `);
  await pool.query(`
    insert into projects (id, userId, orgId, name, ctx03Gfa, totalFitoutArea) values
      (8111, 8101, 8101, 'DI Project A', 1000.00, 12.00),
      (8222, 8202, 8202, 'DI Project B', 2000.00, 20.00)
  `);
  await pool.query(`
    insert into score_matrices
      (id, projectId, modelVersionId, saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore, rasScore, confidenceScore, decisionStatus, dimensionWeights, variableContributions, inputSnapshot)
    values
      (8150, 8111, 1, 70, 71, 72, 73, 74, 72, 20, 80, 95, 'validated', JSON_OBJECT('sa', 1), JSON_OBJECT('source', 'fixture'), JSON_OBJECT('basis', 'explicit'))
  `);
  await pool.query(`
    insert into report_instances
      (id, projectId, scoreMatrixId, reportType, content)
    values
      (8160, 8111, 8150, 'full_report', JSON_OBJECT('fingerprint', 'report-before-geometry'))
  `);
  await pool.query(`
    insert into material_allocations
      (id, projectId, organizationId, roomId, roomName, element, materialName, allocationPct, surfaceAreaM2, totalCostMin, totalCostMax, isLocked)
    values
      (8170, 8111, 8101, 'LEG1', 'Legacy room', 'floor', 'Locked fixture', 100, 12, 1200, 1800, true)
  `);
  await pool.query(`
    insert into space_program_rooms
      (id, projectId, organizationId, roomCode, roomName, category, sqm, source, isFitOut, fitOutOverridden, finishGrade, priority, sortOrder, blockName, blockTypology)
    values
      (8131, 8111, 8101, 'LEG1', 'Legacy room', 'living', 12.00, 'user_manual', true, true, 'B', 'medium', 0, 'Main', 'residential')
  `);
  await pool.query(`
    insert into project_assets
      (id, projectId, filename, mimeType, sizeBytes, storagePath, checksum, uploadedBy, category, assetType, isClientVisible)
    values
      (8299, 8222, 'foreign.dxf', 'application/dxf', 100, 'foreign.dxf', '${"f".repeat(64)}', 8202, 'floor_plan', 'cad', false)
  `);
}

function candidate(
  width: string,
  key: string,
  expected: number | null,
  options: { height?: string; spaceId?: string } = {}
) {
  const height = options.height ?? "3";
  const spaceId = options.spaceId ?? "stable-room-001";
  const canonical = canonicalizeGeometry({
    schemaVersion: GEOMETRY_SCHEMA_VERSION,
    measurementBasis: ROOM_FLOOR_POLYGON_AREA,
    sourceUnit: "m",
    rooms: [
      {
        spaceId,
        levelElevation: "0",
        outerRing: [
          { x: "0", y: "0" },
          { x: width, y: "0" },
          { x: width, y: height },
          { x: "0", y: height },
          { x: "0", y: "0" },
        ],
      },
    ],
  });
  return {
    organizationId: 8101,
    projectId: 8111,
    userId: 8101,
    expectedCurrentVersionId: expected,
    canonical,
    rooms: [{ spaceId, roomName: "Stable room" }],
    source: {
      sourceType: "manual" as const,
      acquisitionMethod: "manual_entry" as const,
      sourceUnits: "m" as const,
      sourceChecksum: key.padEnd(64, "0"),
      assetChecksum: key.padEnd(64, "0"),
      adapterName: "mysql-test-manual",
      adapterVersion: "miyar-manual-v1",
      sourceObservation: { width },
      sourceTransform: { snapTransform: "none" },
      idempotencyKey: key.padEnd(64, "1"),
    },
  };
}

beforeEach(resetData);

afterAll(async () => {
  await truncateData();
  await pool.end();
});

describe("DI-01 disposable MySQL tenant, CAS, and compatibility boundary", () => {
  it("creates a fresh project and canonical authority atomically", async () => {
    const created = await db.createProject({
      userId: 8101,
      orgId: 8101,
      name: "Canonical-first project",
      status: "draft",
    });
    const [rows] = await pool.query(
      `select p.id, pga.mode, pga.currentGraphVersionId, pga.selectedGeometryVersionId
       from projects p
       join project_geometry_authorities pga
         on pga.organizationId = p.orgId and pga.projectId = p.id
       where p.id = ? and p.orgId = ?`,
      [created.id, 8101]
    );
    expect(rows).toEqual([
      {
        id: created.id,
        mode: "canonical",
        currentGraphVersionId: null,
        selectedGeometryVersionId: null,
      },
    ]);
  });

  it("round-trips one stable room, rejects cross-scope relations, serializes CAS writers, and blocks legacy writers only in canonical mode", async () => {
    const first = await db.saveGeometryDraftForOrg(
      candidate("4", "first", null)
    );
    expect(first).toMatchObject({ kind: "ok", replayed: false });
    if (first.kind !== "ok") throw new Error("first draft save failed");

    const staleReplay = await db.saveGeometryDraftForOrg(
      candidate("4", "first", null)
    );
    expect(staleReplay).toMatchObject({
      kind: "conflict",
      currentGraphVersionId: first.graphVersionId,
    });

    const replay = await db.saveGeometryDraftForOrg(
      candidate("4", "first", first.graphVersionId)
    );
    expect(replay).toMatchObject({
      kind: "ok",
      replayed: true,
      graphVersionId: first.graphVersionId,
    });

    const [roundTripRows] = await pool.query(`
      select si.publicId, sv.roomName, mr.normalizedValueExact,
             sg.totalAreaSquareMicrometresTwice, pga.mode
      from space_identities si
      join space_versions sv on sv.organizationId = si.organizationId
        and sv.projectId = si.projectId and sv.spaceIdentityId = si.id
      join measurement_records mr on mr.organizationId = sv.organizationId
        and mr.projectId = sv.projectId and mr.spaceVersionId = sv.id
      join spatial_graph_versions sg on sg.organizationId = sv.organizationId
        and sg.projectId = sv.projectId and sg.id = sv.geometryVersionId
      join project_geometry_authorities pga on pga.organizationId = sv.organizationId
        and pga.projectId = sv.projectId and pga.currentGraphVersionId = sg.id
    `);
    expect(roundTripRows).toEqual([
      expect.objectContaining({
        publicId: "stable-room-001",
        roomName: "Stable room",
        normalizedValueExact: "24000000000000",
        totalAreaSquareMicrometresTwice: "24000000000000",
        mode: "legacy",
      }),
    ]);
    await expect(
      pool.query(
        `insert into legacy_space_links
          (organizationId, projectId, legacySourceKey, legacyTable, spaceIdentityId, disposition, evidence, createdBy)
         values
          (8202, 8222, 'cross-scope', 'space_program_rooms',
           (select id from space_identities where organizationId = 8101 and projectId = 8111 limit 1),
           'mapped', JSON_OBJECT('test', true), 8202)`
      )
    ).rejects.toThrow();

    const beforeStale = await pool.query(
      "select (select count(*) from geometry_sources) sourceCount, (select count(*) from spatial_graph_versions) graphCount"
    );
    const stale = await db.saveGeometryDraftForOrg(
      candidate("5", "stale", null)
    );
    expect(stale).toMatchObject({
      kind: "conflict",
      currentGraphVersionId: first.graphVersionId,
    });
    const afterStale = await pool.query(
      "select (select count(*) from geometry_sources) sourceCount, (select count(*) from spatial_graph_versions) graphCount"
    );
    expect(afterStale[0]).toEqual(beforeStale[0]);

    const crossOrganization = await db.saveGeometryDraftForOrg({
      ...candidate("5", "cross-org", first.graphVersionId),
      organizationId: 8202,
    });
    expect(crossOrganization).toEqual({ kind: "not_found" });
    const crossProjectAsset = await db.saveGeometryDraftForOrg({
      ...candidate("5", "foreign-asset", first.graphVersionId),
      source: {
        ...candidate("5", "foreign-asset", first.graphVersionId).source,
        sourceType: "project_asset",
        acquisitionMethod: "dxf",
        assetId: 8299,
        assetChecksum: "f".repeat(64),
      },
    });
    expect(crossProjectAsset).toEqual({ kind: "not_found" });

    const [left, right] = await Promise.all([
      db.saveGeometryDraftForOrg(
        candidate("5", "concurrent-left", first.graphVersionId)
      ),
      db.saveGeometryDraftForOrg(
        candidate("6", "concurrent-right", first.graphVersionId)
      ),
    ]);
    expect([left.kind, right.kind].sort()).toEqual(["conflict", "ok"]);
    const winner =
      left.kind === "ok" ? left : right.kind === "ok" ? right : null;
    if (!winner) throw new Error("CAS did not produce one winner");
    const obsoleteReplay = await db.saveGeometryDraftForOrg(
      candidate("4", "first", winner.graphVersionId)
    );
    expect(obsoleteReplay).toMatchObject({
      kind: "conflict",
      currentGraphVersionId: winner.graphVersionId,
    });

    const wrongReview = await db.reviewGeometryDraftForOrg({
      organizationId: 8101,
      projectId: 8111,
      userId: 8101,
      geometryVersionId: winner.graphVersionId,
      expectedCurrentVersionId: first.graphVersionId,
      decision: "approve_as_canonical",
    });
    expect(wrongReview.kind).toBe("conflict");
    const racingWrites = await (async () => {
      const blocker = await pool.getConnection();
      let committed = false;
      try {
        await blocker.beginTransaction();
        await blocker.query(
          "select id from projects where id = 8111 for update"
        );
        const reviewPromise = db.reviewGeometryDraftForOrg({
          organizationId: 8101,
          projectId: 8111,
          userId: 8101,
          geometryVersionId: winner.graphVersionId,
          expectedCurrentVersionId: winner.graphVersionId,
          decision: "approve_as_canonical",
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        const legacyAggregatePromise =
          db.updateProjectWithLegacyGeometryAuthorityForOrg(8111, 8101, {
            totalFitoutArea: "13.00",
          });
        await new Promise(resolve => setTimeout(resolve, 100));
        await blocker.commit();
        committed = true;
        return [reviewPromise, legacyAggregatePromise] as const;
      } finally {
        if (!committed) await blocker.rollback().catch(() => undefined);
        blocker.release();
      }
    })();
    const [accepted, racingLegacyAggregate] = await Promise.all(racingWrites);
    expect(accepted).toMatchObject({
      kind: "ok",
      selectedGeometryVersionId: winner.graphVersionId,
    });
    expect(racingLegacyAggregate).toBe("canonical");
    const acceptedMeasurements =
      await db.getAcceptedRoomFloorMeasurementsForOrg(8111, 8101);
    expect(acceptedMeasurements).toMatchObject({
      status: "ready",
      graphVersionId: winner.graphVersionId,
    });
    const [acceptedLinks] = await pool.query<
      Array<{ id: number; spaceVersionId: number; normalizedValueExact: string }>
    >(
      `select id, spaceVersionId, normalizedValueExact
       from measurement_records where graphVersionId = ?`,
      [winner.graphVersionId]
    );
    expect(acceptedLinks).toHaveLength(1);
    await pool.query(
      "update measurement_records set spaceVersionId = null where id = ?",
      [acceptedLinks[0].id]
    );
    await expect(
      db.getAcceptedRoomFloorMeasurementsForOrg(8111, 8101)
    ).resolves.toMatchObject({ status: "insufficient" });
    await pool.query(
      "update measurement_records set spaceVersionId = ? where id = ?",
      [acceptedLinks[0].spaceVersionId, acceptedLinks[0].id]
    );
    await pool.query(
      "update measurement_records set normalizedValueExact = ? where id = ?",
      [(BigInt(acceptedLinks[0].normalizedValueExact) + 1n).toString(), acceptedLinks[0].id]
    );
    await expect(
      db.getAcceptedRoomFloorMeasurementsForOrg(8111, 8101)
    ).resolves.toMatchObject({ status: "insufficient" });
    await pool.query(
      "update measurement_records set normalizedValueExact = ? where id = ?",
      [acceptedLinks[0].normalizedValueExact, acceptedLinks[0].id]
    );
    const revision = await db.saveGeometryDraftForOrg(
      candidate("7", "revision", winner.graphVersionId)
    );
    expect(revision.kind).toBe("ok");
    if (revision.kind !== "ok") throw new Error("revision draft failed");
    const rejected = await db.reviewGeometryDraftForOrg({
      organizationId: 8101,
      projectId: 8111,
      userId: 8101,
      geometryVersionId: revision.graphVersionId,
      expectedCurrentVersionId: revision.graphVersionId,
      decision: "reject",
      note: "Reviewer found a source conflict",
    });
    expect(rejected).toMatchObject({
      kind: "ok",
      selectedGeometryVersionId: winner.graphVersionId,
    });
    const acceptedAgain = await db.reviewGeometryDraftForOrg({
      organizationId: 8101,
      projectId: 8111,
      userId: 8101,
      geometryVersionId: revision.graphVersionId,
      expectedCurrentVersionId: revision.graphVersionId,
      decision: "approve_as_canonical",
    });
    expect(acceptedAgain).toMatchObject({
      kind: "conflict",
      currentGraphVersionId: revision.graphVersionId,
    });
    const clarificationDraft = await db.saveGeometryDraftForOrg(
      candidate("8", "clarification", revision.graphVersionId)
    );
    expect(clarificationDraft.kind).toBe("ok");
    if (clarificationDraft.kind !== "ok")
      throw new Error("clarification draft failed");
    const clarification = await db.reviewGeometryDraftForOrg({
      organizationId: 8101,
      projectId: 8111,
      userId: 8101,
      geometryVersionId: clarificationDraft.graphVersionId,
      expectedCurrentVersionId: clarificationDraft.graphVersionId,
      decision: "request_clarification",
    });
    expect(clarification).toMatchObject({
      kind: "ok",
      selectedGeometryVersionId: winner.graphVersionId,
    });
    const [reviewRows] = await pool.query(
      `select reviewDecision from geometry_reconciliation_events
       where organizationId = 8101 and projectId = 8111
         and reviewDecision in ('accepted', 'rejected', 'needs_clarification')
       order by id`
    );
    expect(reviewRows).toEqual([
      { reviewDecision: "accepted" },
      { reviewDecision: "rejected" },
      { reviewDecision: "needs_clarification" },
    ]);
    const [downstreamRows] = await pool.query(
      `select p.ctx03Gfa, p.totalFitoutArea,
              sm.id scoreId, sm.compositeScore, sm.inputSnapshot,
              ri.id reportId, ri.reportType, ri.content reportContent,
              ma.id allocationId, ma.surfaceAreaM2, ma.totalCostMin, ma.totalCostMax, ma.isLocked
       from projects p
       join score_matrices sm on sm.projectId = p.id and sm.id = 8150
       join report_instances ri on ri.projectId = p.id and ri.id = 8160
       join material_allocations ma on ma.projectId = p.id and ma.organizationId = p.orgId and ma.id = 8170
       where p.id = 8111`
    );
    expect(downstreamRows).toEqual([
      {
        ctx03Gfa: "1000.00",
        totalFitoutArea: "12.00",
        scoreId: 8150,
        compositeScore: "72.00",
        inputSnapshot: { basis: "explicit" },
        reportId: 8160,
        reportType: "full_report",
        reportContent: { fingerprint: "report-before-geometry" },
        allocationId: 8170,
        surfaceAreaM2: "12.00",
        totalCostMin: "1200.00",
        totalCostMax: "1800.00",
        isLocked: 1,
      },
    ]);

    expect(
      await db.updateSpaceProgramRoomForOrg(8131, 8101, {
        roomName: "Still legacy before canonical selection",
      })
    ).toBe(true);
    expect(
      await db.updateProjectWithLegacyGeometryAuthorityForOrg(8111, 8101, {
        totalFitoutArea: "13.00",
      })
    ).toBe("canonical");
    expect(
      await db.updateProjectVerificationForOrg(8111, 8101, {
        totalFitoutArea: 14,
      })
    ).toBe(true);
    await pool.query(
      "update project_geometry_authorities set mode = 'canonical' where organizationId = 8101 and projectId = 8111"
    );
    const canonicalDraft = await db.saveGeometryDraftForOrg(
      candidate("9", "canonical-draft", clarificationDraft.graphVersionId)
    );
    expect(canonicalDraft).toMatchObject({ kind: "ok", replayed: false });
    if (canonicalDraft.kind !== "ok") throw new Error("canonical draft failed");
    expect(
      await db.updateProjectWithLegacyGeometryAuthorityForOrg(8111, 8101, {
        totalFitoutArea: "99.00",
      })
    ).toBe("canonical");
    expect(
      await db.updateProjectVerificationForOrg(8111, 8101, {
        totalFitoutArea: 99,
      })
    ).toBe(true);
    expect(
      await db.updateSpaceProgramRoomForOrg(8131, 8101, {
        sqm: "99.00",
      })
    ).toBe(false);
    expect(
      await db.insertSpaceProgramRoomForOrg(
        {
          projectId: 8111,
          organizationId: 8101,
          roomCode: "BLOCKED",
          roomName: "Blocked",
          category: "other",
          sqm: "1",
          source: "user_manual",
          isFitOut: true,
          fitOutOverridden: false,
          finishGrade: "B",
          priority: "medium",
          sortOrder: 2,
          blockName: "Main",
          blockTypology: "residential",
        },
        8101
      )
    ).toBe(false);
    expect(await db.deleteSpaceProgramRoomForOrg(8131, 8101)).toBe(false);
    expect(
      await db.replaceSpaceProgramRoomsForOrg(8111, 8101, [], [], true)
    ).toBeNull();
    await expect(db.resetSpaceProgramRooms(8111, 8101, false)).rejects.toThrow(
      "Legacy room and area values are read-only"
    );
    const [legacyRows] = await pool.query(
      "select roomName from space_program_rooms where id = 8131"
    );
    expect(legacyRows).toEqual([
      { roomName: "Still legacy before canonical selection" },
    ]);
    const [projectRows] = await pool.query(
      "select totalFitoutArea from projects where id = 8111"
    );
    expect(projectRows).toEqual([{ totalFitoutArea: "99.00" }]);

    const reviewState = await db.getGeometryReviewStateForOrg(8111, 8101);
    expect(reviewState?.authority).toMatchObject({
      currentGraphVersionId: canonicalDraft.graphVersionId,
      selectedGeometryVersionId: winner.graphVersionId,
    });
    expect(reviewState?.canonical?.fingerprint).toBe(winner.fingerprint);
    expect(reviewState?.acceptedMeasurements).toMatchObject({
      status: "ready",
      graphVersionId: winner.graphVersionId,
      measurementBasis: "room_floor_polygon_area",
    });
  });

  it("persists the maximum accepted identity length and a 19-digit area", async () => {
    const spaceId = "s".repeat(64);
    const result = await db.saveGeometryDraftForOrg(
      candidate("1000000000", "large-domain", null, {
        height: "1000000000",
        spaceId,
      })
    );
    expect(result.kind).toBe("ok");

    const [rows] = await pool.query(`
      select si.publicId, sg.totalAreaSquareMetres
      from space_identities si
      join spatial_graph_versions sg
        on sg.organizationId = si.organizationId
       and sg.projectId = si.projectId
      where si.organizationId = 8101 and si.projectId = 8111
    `);
    expect(rows).toEqual([
      {
        publicId: spaceId,
        totalAreaSquareMetres: "1000000000000000000.000000000000",
      },
    ]);
  });

  it("restores an exact logical snapshot of the additive DI-01 tables", async () => {
    const committed = await db.saveGeometryDraftForOrg(
      candidate("4", "restore", null)
    );
    expect(committed.kind).toBe("ok");

    const connection = await pool.getConnection();
    const backupTables = [...newTables].reverse();
    const restoreOrder = [
      "geometry_sources",
      "spatial_graph_versions",
      "project_geometry_authorities",
      "space_identities",
      "space_versions",
      "measurement_records",
      "measurement_input_edges",
      "geometry_reconciliation_events",
      "legacy_space_links",
      "artifact_input_snapshots",
    ] as const;
    try {
      for (const table of backupTables) {
        await connection.query(
          `create temporary table \`di01_restore_${table}\` like \`${table}\``
        );
        await connection.query(
          `insert into \`di01_restore_${table}\` select * from \`${table}\``
        );
      }
      const [before] = await connection.query(`
        select si.publicId, sv.roomName, mr.normalizedValueExact,
               sg.totalAreaSquareMicrometresTwice, sg.fingerprint, pga.mode
        from space_identities si
        join space_versions sv on sv.spaceIdentityId = si.id
        join measurement_records mr on mr.spaceVersionId = sv.id
        join spatial_graph_versions sg on sg.id = sv.geometryVersionId
        join project_geometry_authorities pga
          on pga.currentGraphVersionId = sg.id
      `);

      await connection.query("set foreign_key_checks = 0");
      for (const table of backupTables) {
        await connection.query(`delete from \`${table}\``);
      }
      await connection.query("set foreign_key_checks = 1");

      for (const table of restoreOrder) {
        await connection.query(
          `insert into \`${table}\` select * from \`di01_restore_${table}\``
        );
      }
      const [after] = await connection.query(`
        select si.publicId, sv.roomName, mr.normalizedValueExact,
               sg.totalAreaSquareMicrometresTwice, sg.fingerprint, pga.mode
        from space_identities si
        join space_versions sv on sv.spaceIdentityId = si.id
        join measurement_records mr on mr.spaceVersionId = sv.id
        join spatial_graph_versions sg on sg.id = sv.geometryVersionId
        join project_geometry_authorities pga
          on pga.currentGraphVersionId = sg.id
      `);
      expect(after).toEqual(before);
    } finally {
      await connection
        .query("set foreign_key_checks = 1")
        .catch(() => undefined);
      connection.release();
    }
  });
});
