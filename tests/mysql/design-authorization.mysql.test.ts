import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import * as db from "../../server/db";
import { projectRouter } from "../../server/routers/project";
import { scenarioRouter } from "../../server/routers/scenario";
import { spaceProgramRouter } from "../../server/routers/spaceProgram";
import { portfolioRouter } from "../../server/routers/portfolio";
import { intakeRouter } from "../../server/routers/intake";
import { adminRouter } from "../../server/routers/admin";
import { analyticsRouter } from "../../server/routers/analytics";
import { autonomousRouter } from "../../server/routers/autonomous";
import { biasRouter } from "../../server/routers/bias";
import { designAdvisorRouter } from "../../server/routers/design-advisor";
import { intelligenceRouter } from "../../server/routers/intelligence";
import { marketIntelligenceRouter } from "../../server/routers/market-intelligence";
import { materialQuantityRouter } from "../../server/routers/materialQuantity";
import { predictiveRouter } from "../../server/routers/predictive";
import { salesPremiumRouter } from "../../server/routers/salesPremium";
import { seedRouter } from "../../server/routers/seed";
import { sustainabilityRouter } from "../../server/routers/sustainability";
import type { TrpcContext } from "../../server/_core/context";
import { requireActivePublicShare } from "../../server/_core/public-share-access";
import { initializeDatabaseSafety } from "../../server/_core/database-safety";

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(connectionString);
const providerCompatibility = process.env.PLANETSCALE_COMPAT === "1";

const tables = [
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
  "asset_links",
  "comments",
  "materials_to_boards",
  "material_boards",
  "rfq_line_items",
  "generated_visuals",
  "design_briefs",
  "ai_design_briefs",
  "project_assets",
  "report_instances",
  "score_matrices",
  "outcome_comparisons",
  "project_outcomes",
  "scenarios",
  "evidence_records",
  "trend_snapshots",
  "design_trends",
  "decision_patterns",
  "accuracy_snapshots",
  "benchmark_suggestions",
  "logic_change_log",
  "project_insights",
  "material_allocations",
  "material_supplier_sources",
  "amenity_sub_spaces",
  "space_program_rooms",
  "bias_alerts",
  "override_records",
  "portfolio_projects",
  "portfolio_alerts",
  "portfolios",
  "finish_schedule_items",
  "project_color_palettes",
  "dm_compliance_checklists",
  "materials_catalog",
  "organization_members",
  "projects",
  "users",
  "organizations",
] as const;

async function count(table: string) {
  const [rows] = await pool.query(`select count(*) as count from \`${table}\``);
  return Number((rows as Array<{ count: number }>)[0].count);
}

async function seedBase() {
  await pool.query(`
    insert into organizations (id, name, slug) values
      (101, 'Org A', 'org-a'),
      (202, 'Org B', 'org-b')
  `);
  await pool.query(`
    insert into users (id, openId, name, orgId) values
      (1, 'mysql-user-a', 'User A', 101),
      (2, 'mysql-user-b', 'User B', 202)
  `);
  await pool.query(`
    insert into organization_members (id, orgId, userId, role) values
      (1, 101, 1, 'admin'),
      (2, 202, 2, 'viewer')
  `);
  await pool.query(`
    insert into projects (id, userId, orgId, name) values
      (11, 1, 101, 'Project A'),
      (22, 2, 202, 'Project B'),
      (33, 1, null, 'Legacy Null')
  `);
}

async function seedScore(id: number, projectId: number) {
  await pool.query(`
    insert into score_matrices
      (id, projectId, modelVersionId, saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore, rasScore, confidenceScore, decisionStatus, dimensionWeights, variableContributions, inputSnapshot)
    values (?, ?, 1, 60, 60, 60, 60, 60, 60, 40, 60, 80, 'validated', '{}', '{}', '{}')
  `, [id, projectId]);
}

function orgContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "mysql-user-a",
      password: null,
      name: "User A",
      email: null,
      loginMethod: "test",
      role: "user",
      orgId: 101,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function viewerContext(): TrpcContext {
  const ctx = orgContext();
  return {
    ...ctx,
    user: {
      ...ctx.user!,
      id: 2,
      openId: "mysql-user-b",
      name: "User B",
      orgId: 202,
    },
  };
}

beforeEach(async () => {
  if (!providerCompatibility) {
    await pool.query("drop trigger if exists tr03h_fail_board_delete");
    await pool.query("drop trigger if exists tr03h_fail_project_update");
    await pool.query("drop trigger if exists tr03h_fail_rfq_insert");
    await pool.query("drop trigger if exists tr04_fail_report_rfq_insert");
  }
  await pool.query("set foreign_key_checks = 0");
  for (const table of tables) await pool.query(`truncate table \`${table}\``);
  await pool.query("set foreign_key_checks = 1");
  await seedBase();
});

afterAll(async () => {
  await pool.query("set foreign_key_checks = 0");
  for (const table of tables) await pool.query(`truncate table \`${table}\``);
  await pool.query("set foreign_key_checks = 1");
  await pool.end();
});

describe("TR-03H/TR-04 real MySQL authorization boundary", () => {
  it("rejects cross-organization reads through representative router chains", async () => {
    const ctx = orgContext();
    await expect(projectRouter.createCaller(ctx).get({ id: 22 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(projectRouter.createCaller(ctx).get({ id: 33 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(scenarioRouter.createCaller(ctx).list({ projectId: 22 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(spaceProgramRouter.createCaller(ctx).getForProject({ projectId: 22 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(intakeRouter.createCaller(ctx).listAssets({ projectId: 22 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    await pool.query(
      "insert into portfolios (id, organization_id, name, created_by) values (501, 202, 'Foreign portfolio', 2)"
    );
    await expect(
      portfolioRouter.createCaller(ctx).availableProjects({ portfolioId: 501 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await pool.query(`
      insert into evidence_records
        (id, recordId, projectId, orgId, category, itemName, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore, confidentiality)
      values
        (902, 'FOREIGN-EVIDENCE', 22, 202, 'other', 'Foreign', 'item', 'https://example.invalid/foreign', now(), 'A', 90, 'confidential')
    `);

    const crossOrgCalls = [
      () => adminRouter.createCaller(ctx).overrides.list({ projectId: 22 }),
      () => analyticsRouter.createCaller(ctx).getProjectInsights({ projectId: 22, limit: 50 }),
      () => autonomousRouter.createCaller(ctx).generateBrief({ projectId: 22 }),
      () => biasRouter.createCaller(ctx).getAlerts({ projectId: 22 }),
      () => designAdvisorRouter.createCaller(ctx).getRecommendations({ projectId: 22 }),
      () => intelligenceRouter.createCaller(ctx).calibrate({ projectId: 22 }),
      () => marketIntelligenceRouter.createCaller(ctx).evidence.get({ id: 902 }),
      () => materialQuantityRouter.createCaller(ctx).getForProject({ projectId: 22 }),
      () => predictiveRouter.createCaller(ctx).getProjectPatterns({ projectId: 22 }),
      () => salesPremiumRouter.createCaller(ctx).getBrandEquityForecast({
        projectId: 22,
        salePerformancePct: 50,
      }),
      () => sustainabilityRouter.createCaller(ctx).getTwinModels({ projectId: 22 }),
    ];
    for (const call of crossOrgCalls) {
      await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }

    await expect(autonomousRouter.createCaller(ctx).getAlerts({}))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(seedRouter.createCaller(ctx).seedEvidence())
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps TR-04 root, scenario, room, allocation and insight writes organization scoped", async () => {
    expect(await db.updateProjectForOrg(11, 202, { name: "Foreign" })).toBe(false);
    expect(await db.updateProjectForOrg(11, 101, { name: "Owned" })).toBe(true);

    const scenario = await db.createScenarioRecordForOrg({
      projectId: 11,
      name: "Scoped scenario",
      variableOverrides: {},
    }, 101);
    expect(scenario?.id).toBeTypeOf("number");
    expect(await db.createScenarioRecordForOrg({
      projectId: 22,
      name: "Rejected scenario",
      variableOverrides: {},
    }, 101)).toBeNull();
    expect(await db.deleteScenarioForOrg(scenario!.id, 202)).toBe(false);
    expect(await db.deleteScenarioForOrg(scenario!.id, 101)).toBe(true);

    const override = await db.createOverrideRecordForOrg({
      projectId: 11,
      userId: 1,
      overrideType: "strategic",
      authorityLevel: 2,
      originalValue: { value: 1 },
      overrideValue: { value: 2 },
      justification: "Scoped authorization integration test",
    }, 101);
    expect(override?.id).toBeTypeOf("number");
    expect(await db.createOverrideRecordForOrg({
      projectId: 22,
      userId: 1,
      overrideType: "strategic",
      authorityLevel: 2,
      originalValue: { value: 1 },
      overrideValue: { value: 2 },
      justification: "Rejected cross organization override",
    }, 101)).toBeNull();

    await pool.query(`
      insert into space_program_rooms
        (id, projectId, organizationId, roomCode, roomName, category, sqm, source, isFitOut, fitOutOverridden, finishGrade, priority, sortOrder, blockName, blockTypology)
      values
        (301, 11, 101, 'R1', 'Room', 'living', 20, 'user_manual', true, false, 'B', 'medium', 0, 'Main', 'residential')
    `);
    expect(await db.updateSpaceProgramRoomForOrg(301, 202, { roomName: "Foreign" })).toBe(false);
    expect(await db.updateSpaceProgramRoomForOrg(301, 101, { roomName: "Owned" })).toBe(true);
    expect(await db.deleteSpaceProgramRoomForOrg(301, 202)).toBe(false);
    expect(await db.deleteSpaceProgramRoomForOrg(301, 101)).toBe(true);

    await pool.query(`
      insert into material_allocations
        (id, projectId, organizationId, roomId, roomName, element, materialName, allocationPct, surfaceAreaM2, isLocked)
      values
        (401, 11, 101, 'R1', 'Room', 'floor', 'Stone', 100, 20, false)
    `);
    expect(await db.updateMaterialAllocationForOrg(401, 202, { allocationPct: "50" })).toBe(false);
    expect(await db.updateMaterialAllocationForOrg(401, 101, { allocationPct: "50" })).toBe(true);

    expect(await db.insertProjectInsightForOrg({
      projectId: 22,
      insightType: "cost_pressure",
      severity: "warning",
      title: "Rejected",
    }, 101)).toBe(false);
    expect(await db.insertProjectInsightForOrg({
      projectId: 11,
      insightType: "cost_pressure",
      severity: "warning",
      title: "Owned",
    }, 101)).toBe(true);
    const [insights] = await pool.query("select id from project_insights where projectId = 11");
    const insightId = Number((insights as Array<{ id: number }>)[0].id);
    expect(await db.updateInsightStatusForOrg(insightId, 202, "resolved", 2)).toBe(false);
    expect(await db.updateInsightStatusForOrg(insightId, 101, "resolved", 1)).toBe(true);
  });

  it("persists report artifacts atomically and rechecks project ownership", async () => {
    await seedScore(601, 11);
    const artifacts = {
      finishSchedule: [{
        projectId: 11,
        organizationId: 101,
        roomId: "L1",
        roomName: "Lobby",
        element: "floor" as const,
      }],
      colorPalette: {
        projectId: 11,
        organizationId: 101,
        paletteKey: "report-test",
        colors: [{ hex: "#ffffff" }],
      },
      complianceChecklist: {
        projectId: 11,
        organizationId: 101,
        items: [{ requirement: "test", status: "pass" }],
      },
      brief: {
        projectId: 11,
        createdBy: 1,
        projectIdentity: {},
        designNarrative: {},
        materialSpecifications: {},
        boqFramework: {},
        detailedBudget: {},
        designerInstructions: {},
      },
      rfqItems: [{
        projectId: 11,
        organizationId: 101,
        sectionNo: 1,
        itemCode: "RPT-1",
        description: "Report line",
        unit: "sqm",
      }],
    };
    const result = await db.createReportArtifactsForOrg({
      projectId: 11,
      orgId: 101,
      report: {
        projectId: 11,
        scoreMatrixId: 601,
        reportType: "design_brief",
        generatedBy: 1,
      },
      designArtifacts: artifacts,
    });
    expect(result?.reportId).toBeTypeOf("number");
    expect(result?.briefId).toBeTypeOf("number");
    const [rfqRows] = await pool.query(
      "select brief_id as briefId from rfq_line_items where project_id = 11"
    );
    expect((rfqRows as Array<{ briefId: number }>)[0].briefId).toBe(result!.briefId);

    expect(await db.createReportArtifactsForOrg({
      projectId: 22,
      orgId: 101,
      report: {
        projectId: 22,
        scoreMatrixId: 601,
        reportType: "design_brief",
        generatedBy: 1,
      },
    })).toBeNull();

    await seedScore(602, 11);
    const blocker = await pool.getConnection();
    try {
      await blocker.beginTransaction();
      await blocker.query("select id from projects where id = 11 for update");
      let settled = false;
      const pending = db.createReportArtifactsForOrg({
        projectId: 11,
        orgId: 101,
        report: {
          projectId: 11,
          scoreMatrixId: 602,
          reportType: "validation_summary",
          generatedBy: 1,
        },
      }).finally(() => {
        settled = true;
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(settled).toBe(false);
      await blocker.query("update projects set orgId = 202 where id = 11");
      await blocker.commit();
      await expect(pending).resolves.toBeNull();
      const [rows] = await pool.query(
        "select count(*) as count from report_instances where scoreMatrixId = 602"
      );
      expect(Number((rows as Array<{ count: number }>)[0].count)).toBe(0);
    } finally {
      await blocker.rollback().catch(() => undefined);
      blocker.release();
    }
  });

  it.skipIf(providerCompatibility)(
    "rolls back every report artifact after a late RFQ failure",
    async () => {
      await seedScore(603, 11);
      await pool.query(`
        create trigger tr04_fail_report_rfq_insert
        before insert on rfq_line_items
        for each row signal sqlstate '45000' set message_text = 'forced report RFQ failure'
      `);
      await expect(db.createReportArtifactsForOrg({
        projectId: 11,
        orgId: 101,
        report: {
          projectId: 11,
          scoreMatrixId: 603,
          reportType: "design_brief",
          generatedBy: 1,
        },
        designArtifacts: {
          finishSchedule: [{
            projectId: 11, organizationId: 101, roomId: "L1",
            roomName: "Lobby", element: "floor",
          }],
          colorPalette: {
            projectId: 11, organizationId: 101,
            paletteKey: "rollback", colors: [],
          },
          complianceChecklist: {
            projectId: 11, organizationId: 101, items: [],
          },
          brief: {
            projectId: 11, createdBy: 1, projectIdentity: {},
            designNarrative: {}, materialSpecifications: {},
            boqFramework: {}, detailedBudget: {}, designerInstructions: {},
          },
          rfqItems: [{
            projectId: 11, organizationId: 101, sectionNo: 1,
            itemCode: "BAD", description: "Rollback", unit: "sqm",
          }],
        },
      })).rejects.toThrow();
      for (const table of [
        "finish_schedule_items",
        "project_color_palettes",
        "dm_compliance_checklists",
        "design_briefs",
        "rfq_line_items",
        "report_instances",
      ]) {
        expect(await count(table)).toBe(0);
      }
      await pool.query("drop trigger tr04_fail_report_rfq_insert");
    }
  );

  it("keeps tenant portfolio alerts organization scoped and deduplicated", async () => {
    await pool.query(
      "insert into portfolios (id, organization_id, name, created_by) values (501, 101, 'Owned', 1)"
    );
    await pool.query(
      "insert into portfolio_projects (portfolio_id, project_id) values (501, 11)"
    );
    const alert = {
      organizationId: 101,
      portfolioId: 501,
      alertType: "portfolio_risk" as const,
      severity: "high" as const,
      title: "Owned portfolio risk",
      body: "Risk body",
      affectedProjectIds: [11],
      triggerData: { portfolioId: 501 },
      suggestedAction: "Review",
      status: "active" as const,
      activeDedupKey: "portfolio-risk-key",
      expiresAt: new Date(Date.now() + 60_000),
    };
    const inserted = await db.insertPortfolioAlertsForOrg({
      portfolioId: 501,
      orgId: 101,
      alerts: [alert],
    });
    expect(inserted).toHaveLength(1);
    expect(await db.insertPortfolioAlertsForOrg({
      portfolioId: 501,
      orgId: 101,
      alerts: [alert],
    })).toEqual([]);
    expect(await db.insertPortfolioAlertsForOrg({
      portfolioId: 501,
      orgId: 202,
      alerts: [{ ...alert, organizationId: 202 }],
    })).toBeNull();

    await pool.query(
      "update portfolio_alerts set expires_at = date_sub(now(), interval 1 minute) where id = ?",
      [inserted![0].id]
    );
    expect(await db.insertPortfolioAlertsForOrg({
      portfolioId: 501,
      orgId: 101,
      alerts: [alert],
    })).toHaveLength(1);

    await pool.query("delete from portfolio_alerts where portfolio_id = 501");
    const concurrentResults = await Promise.all([
      db.insertPortfolioAlertsForOrg({
        portfolioId: 501,
        orgId: 101,
        alerts: [alert],
      }),
      db.insertPortfolioAlertsForOrg({
        portfolioId: 501,
        orgId: 101,
        alerts: [alert],
      }),
    ]);
    expect(concurrentResults.flat()).toHaveLength(1);
    expect(await count("portfolio_alerts")).toBe(1);

    await expect(
      portfolioRouter.createCaller(viewerContext()).create({
        name: "Viewer cannot create",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed for expired and null-expiry public shares in real MySQL", async () => {
    await pool.query(`
      insert into ai_design_briefs
        (id, project_id, org_id, brief_data, share_token, share_expires_at)
      values
        (701, 11, 101, '{}', 'expired-share', date_sub(now(), interval 1 minute)),
        (702, 11, 101, '{}', 'null-expiry-share', null)
    `);
    await expect(requireActivePublicShare("expired-share"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requireActivePublicShare("null-expiry-share"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("enforces membership uniqueness and resolves exactly one role", async () => {
    await expect(
      pool.query("insert into organization_members (orgId, userId, role) values (101, 1, 'member')")
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await expect(db.getOrganizationMemberships(1, 101)).resolves.toMatchObject([
      { orgId: 101, userId: 1, role: "admin" },
    ]);
    await expect(db.getOrganizationMemberships(1, 202)).resolves.toEqual([]);
  });

  it("scopes project assets and generated visuals through project ownership", async () => {
    const asset = await db.createProjectAssetForOrg({
      projectId: 11,
      filename: "plan.png",
      mimeType: "image/png",
      sizeBytes: 10,
      storagePath: "projects/11/plan.png",
      uploadedBy: 1,
    }, 101);
    expect(asset?.id).toBeTypeOf("number");
    expect(await db.createProjectAssetForOrg({
      projectId: 22,
      filename: "foreign.png",
      mimeType: "image/png",
      sizeBytes: 10,
      storagePath: "projects/22/foreign.png",
      uploadedBy: 1,
    }, 101)).toBeNull();
    expect(await db.updateProjectAssetForOrg(asset!.id, 101, { notes: "owned" })).toBe(true);
    expect(await db.updateProjectAssetForOrg(asset!.id, 202, { notes: "foreign" })).toBe(false);

    const visual = await db.createGeneratedVisualForOrg({
      projectId: 11,
      type: "mood",
      promptJson: { prompt: "test" },
      createdBy: 1,
    }, 101);
    expect(visual?.id).toBeTypeOf("number");
    expect(await db.updateGeneratedVisualForOrg(visual!.id, 101, { status: "completed" })).toBe(true);
    expect(await db.updateGeneratedVisualForOrg(visual!.id, 202, { status: "failed" })).toBe(false);
    expect(await db.deleteProjectAssetForOrg(asset!.id, 202)).toBe(false);
    expect(await db.deleteProjectAssetForOrg(asset!.id, 101)).toBe(true);
  });

  it("creates and rolls back scenario-bound boards atomically", async () => {
    await pool.query(`
      insert into scenarios (id, projectId, orgId, name) values
        (71, 11, 101, 'Owned'),
        (72, 22, 202, 'Foreign')
    `);
    await pool.query(`
      insert into materials_catalog (id, name, category, tier, isActive) values
        (81, 'Stone', 'stone', 'premium', true),
        (82, 'Wood', 'wood', 'mid', true),
        (83, 'Inactive', 'paint', 'mid', false)
    `);
    const board = await db.createMaterialBoardWithMaterialsForOrg({
      projectId: 11,
      scenarioId: 71,
      boardName: "Owned board",
      createdBy: 1,
    }, [82, 81], 101);
    expect(board?.id).toBeTypeOf("number");
    const joins = await db.getMaterialsByBoard(board!.id);
    expect(joins.map(row => [row.materialId, row.sortOrder])).toEqual([[82, 0], [81, 1]]);

    const before = await count("material_boards");
    expect(await db.createMaterialBoardWithMaterialsForOrg({
      projectId: 11,
      scenarioId: 71,
      boardName: "Rejected board",
      createdBy: 1,
    }, [81, 83], 101)).toBeNull();
    expect(await count("material_boards")).toBe(before);

    const extra = await db.addMaterialToBoardForOrg({ boardId: board!.id, materialId: 81 }, 101);
    expect(await db.addMaterialToBoardForOrg({ boardId: board!.id, materialId: 83 }, 101)).toBeNull();
    expect(await db.addMaterialToBoardForOrg({ boardId: board!.id, materialId: 9999 }, 101)).toBeNull();
    expect(await db.updateBoardTileForOrg(extra!.id, 101, { notes: "updated" })).toBe(true);
    expect(await db.reorderBoardTilesForOrg(board!.id, [extra!.id, joins[0].id, joins[1].id], 101)).toBe(true);
    expect(await db.removeMaterialFromBoardForOrg(extra!.id, 101)).toBe(true);
    expect(await db.deleteMaterialBoardForOrg(board!.id, 202)).toBe(false);
    expect(await db.deleteMaterialBoardForOrg(board!.id, 101)).toBe(true);
    expect(await count("materials_to_boards")).toBe(0);
  });

  it("rechecks ownership after waiting on a concurrent project lock", async () => {
    const blocker = await pool.getConnection();
    try {
      await blocker.beginTransaction();
      await blocker.query("select id from projects where id = 11 for update");
      let settled = false;
      const pending = db.createProjectAssetForOrg({
        projectId: 11,
        filename: "locked.png",
        mimeType: "image/png",
        sizeBytes: 10,
        storagePath: "projects/11/locked.png",
        uploadedBy: 1,
      }, 101).finally(() => {
        settled = true;
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(settled).toBe(false);
      await blocker.query("update projects set orgId = 202 where id = 11");
      await blocker.commit();
      await expect(pending).resolves.toBeNull();
      expect(await count("project_assets")).toBe(0);
    } finally {
      if ((blocker as any).connection?._closing !== true) {
        await blocker.rollback().catch(() => undefined);
      }
      blocker.release();
    }
  });

  it.skipIf(providerCompatibility)(
    "rolls back board, RFQ and floor-plan transactions after late SQL failures",
    async () => {
    await pool.query(`
      insert into materials_catalog (id, name, category, tier, isActive)
      values (81, 'Stone', 'stone', 'premium', true)
    `);
    const board = await db.createMaterialBoardWithMaterialsForOrg({
      projectId: 11,
      boardName: "Rollback board",
      createdBy: 1,
    }, [81], 101);
    await pool.query(`
      create trigger tr03h_fail_board_delete
      before delete on material_boards
      for each row signal sqlstate '45000' set message_text = 'forced board delete failure'
    `);
    await expect(db.deleteMaterialBoardForOrg(board!.id, 101)).rejects.toThrow();
    expect(await count("material_boards")).toBe(1);
    expect(await count("materials_to_boards")).toBe(1);
    await pool.query("drop trigger tr03h_fail_board_delete");

    const brief = await db.createDesignBriefForOrg({
      projectId: 11,
      projectIdentity: {},
      designNarrative: {},
      materialSpecifications: {},
      boqFramework: {},
      detailedBudget: {},
      designerInstructions: {},
      createdBy: 1,
    }, 101);
    await pool.query(`
      create trigger tr03h_fail_rfq_insert
      before insert on rfq_line_items
      for each row
      begin
        if new.item_code = 'BAD' then
          signal sqlstate '45000' set message_text = 'forced RFQ insert failure';
        end if;
      end
    `);
    await expect(db.insertRfqLineItemsForOrg([
      {
        projectId: 11, organizationId: 101, briefId: brief!.id,
        sectionNo: 1, itemCode: "GOOD", description: "Good", unit: "sqm",
      },
      {
        projectId: 11, organizationId: 101, briefId: brief!.id,
        sectionNo: 1, itemCode: "BAD", description: "Bad", unit: "sqm",
      },
    ], { projectId: 11, briefId: brief!.id, orgId: 101 })).rejects.toThrow();
    expect(await count("rfq_line_items")).toBe(0);
    await pool.query("drop trigger tr03h_fail_rfq_insert");

    await pool.query(`
      create trigger tr03h_fail_project_update
      before update on projects
      for each row
      begin
        if new.floorPlanAssetId is not null then
          signal sqlstate '45000' set message_text = 'forced project update failure';
        end if;
      end
    `);
    await expect(db.createFloorPlanAssetAndLinkForOrg({
      projectId: 11,
      filename: "rollback.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storagePath: "projects/11/rollback.pdf",
      uploadedBy: 1,
    }, 101)).rejects.toThrow();
    expect(await count("project_assets")).toBe(0);
    await pool.query("drop trigger tr03h_fail_project_update");
    }
  );

  it("keeps brief, RFQ, floor-plan, approval and share writes scoped and atomic", async () => {
    await pool.query("insert into scenarios (id, projectId, orgId, name) values (71, 11, 101, 'Owned')");
    await pool.query("insert into scenarios (id, projectId, orgId, name) values (171, 22, 202, 'Foreign')");
    const brief = await db.createDesignBriefForOrg({
      projectId: 11,
      scenarioId: 71,
      projectIdentity: {},
      designNarrative: {},
      materialSpecifications: {},
      boqFramework: {},
      detailedBudget: {},
      designerInstructions: {},
      createdBy: 1,
    }, 101);
    expect(brief?.id).toBeTypeOf("number");
    expect(await db.createDesignBriefForOrg({
      projectId: 11,
      scenarioId: 71,
      projectIdentity: {},
      designNarrative: {},
      materialSpecifications: {},
      boqFramework: {},
      detailedBudget: {},
      designerInstructions: {},
      createdBy: 1,
    }, 202)).toBeNull();

    const lines = [0, 1].map(index => ({
      projectId: 11,
      organizationId: 101,
      briefId: brief!.id,
      sectionNo: 1,
      itemCode: `A-${index}`,
      description: "Line",
      unit: "sqm",
    }));
    expect(await db.insertRfqLineItemsForOrg(lines, {
      projectId: 11,
      briefId: brief!.id,
      orgId: 101,
    })).toBe(true);
    expect(await count("rfq_line_items")).toBe(2);
    expect(await db.insertRfqLineItemsForOrg(
      [{ ...lines[0], organizationId: 202 }],
      { projectId: 11, briefId: brief!.id, orgId: 101 },
    )).toBe(false);
    expect(await count("rfq_line_items")).toBe(2);
    expect(await db.insertRfqLineItemsForOrg([], {
      projectId: 11,
      briefId: brief!.id,
      orgId: 101,
    })).toBe(true);

    const floorPlan = await db.createFloorPlanAssetAndLinkForOrg({
      projectId: 11,
      filename: "floor.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storagePath: "projects/11/floor.pdf",
      uploadedBy: 1,
    }, 101);
    expect(floorPlan?.id).toBeTypeOf("number");
    const [projectRows] = await pool.query("select floorPlanAssetId from projects where id = 11");
    expect((projectRows as any[])[0].floorPlanAssetId).toBe(floorPlan!.id);
    expect(await db.createFloorPlanAssetAndLinkForOrg({
      projectId: 22,
      filename: "foreign.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storagePath: "projects/22/foreign.pdf",
      uploadedBy: 1,
    }, 101)).toBeNull();

    expect(await db.updateProjectApprovalStateForOrg(11, 101, "review")).toBe(true);
    expect(await db.updateProjectApprovalStateForOrg(11, 202, "approved_rfq")).toBe(false);
    expect(await db.updateProjectForOrg(11, 101, {
      floorPlanAnalysis: { rooms: [] },
    })).toBe(true);
    expect(await db.updateProjectForOrg(11, 202, {
      floorPlanAnalysis: { rooms: [{ name: "foreign" }] },
    })).toBe(false);

    await pool.query("insert into ai_design_briefs (id, project_id, org_id, brief_data) values (91, 11, 101, '{}'), (92, 11, 101, '{}')");
    expect(await db.updateAiDesignBriefShareTokenForOrg(91, 11, 101, "unique-token", new Date(Date.now() + 60_000))).toBe(true);
    await expect(
      db.updateAiDesignBriefShareTokenForOrg(92, 11, 101, "unique-token", new Date(Date.now() + 60_000))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "ER_DUP_ENTRY" }),
    });
    expect(await db.updateAiDesignBriefShareTokenForOrg(91, 11, 202, "foreign-token", new Date())).toBe(false);
  });

  it("validates all polymorphic link targets, typed comments and evidence isolation", async () => {
    const asset = await db.createProjectAssetForOrg({
      projectId: 11,
      filename: "evidence.png",
      mimeType: "image/png",
      sizeBytes: 10,
      storagePath: "projects/11/evidence.png",
      uploadedBy: 1,
    }, 101);
    await pool.query("insert into scenarios (id, projectId, orgId, name) values (71, 11, 101, 'Owned')");
    await pool.query(`
      insert into design_briefs
        (id, projectId, projectIdentity, designNarrative, materialSpecifications, boqFramework, detailedBudget, designerInstructions, createdBy)
      values (73, 11, '{}', '{}', '{}', '{}', '{}', '{}', 1)
    `);
    await pool.query(`
      insert into design_briefs
        (id, projectId, projectIdentity, designNarrative, materialSpecifications, boqFramework, detailedBudget, designerInstructions, createdBy)
      values (173, 22, '{}', '{}', '{}', '{}', '{}', '{}', 2)
    `);
    await pool.query("insert into generated_visuals (id, projectId, type, promptJson, createdBy) values (74, 11, 'mood', '{}', 1)");
    await pool.query("insert into generated_visuals (id, projectId, type, promptJson, createdBy) values (174, 22, 'mood', '{}', 2)");
    await pool.query("insert into material_boards (id, projectId, boardName, boardJson, createdBy) values (75, 11, 'Board', '[]', 1)");
    await pool.query("insert into material_boards (id, projectId, boardName, boardJson, createdBy) values (175, 22, 'Foreign Board', '[]', 2)");
    await pool.query(`
      insert into score_matrices
        (id, projectId, modelVersionId, saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore, rasScore, confidenceScore, decisionStatus, dimensionWeights, variableContributions, inputSnapshot)
      values (76, 11, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'validated', '{}', '{}', '{}')
    `);
    await pool.query(`
      insert into score_matrices
        (id, projectId, modelVersionId, saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore, rasScore, confidenceScore, decisionStatus, dimensionWeights, variableContributions, inputSnapshot)
      values (176, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'validated', '{}', '{}', '{}')
    `);
    await pool.query("insert into report_instances (id, projectId, scoreMatrixId, reportType) values (77, 11, 76, 'design_brief')");
    await pool.query("insert into report_instances (id, projectId, scoreMatrixId, reportType) values (177, 22, 176, 'design_brief')");

    const targets = [
      ["evaluation", 76],
      ["report", 77],
      ["scenario", 71],
      ["material_board", 75],
      ["design_brief", 73],
      ["visual", 74],
    ] as const;
    for (const [linkType, linkId] of targets) {
      const link = await db.createAssetLinkForOrg({ assetId: asset!.id, linkType, linkId }, 101);
      expect(link?.id).toBeTypeOf("number");
      expect(await db.deleteAssetLinkForOrg(link!.id, 202)).toBe(false);
      expect(await db.deleteAssetLinkForOrg(link!.id, 101)).toBe(true);
    }
    const foreignTargets = [
      ["evaluation", 176],
      ["report", 177],
      ["scenario", 171],
      ["material_board", 175],
      ["design_brief", 173],
      ["visual", 174],
    ] as const;
    for (const [linkType, linkId] of foreignTargets) {
      expect(await db.createAssetLinkForOrg({
        assetId: asset!.id,
        linkType,
        linkId,
      }, 101)).toBeNull();
    }
    expect(await db.createAssetLinkForOrg({ assetId: asset!.id, linkType: "scenario", linkId: 71 }, 202)).toBeNull();

    expect(await db.createCommentForOrg({
      projectId: 11,
      entityType: "general",
      userId: 1,
      content: "General",
    }, 101)).not.toBeNull();
    expect(await db.createCommentForOrg({
      projectId: 11,
      entityType: "design_brief",
      entityId: 73,
      userId: 1,
      content: "Brief",
    }, 101)).not.toBeNull();
    expect(await db.createCommentForOrg({
      projectId: 11,
      entityType: "material_board",
      entityId: 75,
      userId: 1,
      content: "Board",
    }, 101)).not.toBeNull();
    expect(await db.createCommentForOrg({
      projectId: 11,
      entityType: "visual",
      entityId: 74,
      userId: 1,
      content: "Typed",
    }, 101)).not.toBeNull();
    expect(await db.createCommentForOrg({
      projectId: 11,
      entityType: "general",
      entityId: 74,
      userId: 1,
      content: "Invalid",
    }, 101)).toBeNull();
    expect(await db.createCommentForOrg({
      projectId: 11,
      entityType: "design_brief",
      entityId: 173,
      userId: 1,
      content: "Foreign",
    }, 101)).toBeNull();
    expect(await db.createCommentForOrg({
      projectId: 11,
      entityType: "visual",
      entityId: 9999,
      userId: 1,
      content: "Orphan",
    }, 101)).toBeNull();

    await pool.query(`
      insert into evidence_records
        (recordId, projectId, orgId, category, itemName, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore)
      values
        ('E-A', 11, 101, 'other', 'Owned', 'item', 'https://example.invalid/a', now(), 'A', 90),
        ('E-B', 22, 202, 'other', 'Foreign', 'item', 'https://example.invalid/b', now(), 'A', 90),
        ('E-N', null, null, 'other', 'Null', 'item', 'https://example.invalid/n', now(), 'A', 90)
    `);
    const evidence = await db.getEvidenceWithSources({ orgId: 101 });
    expect(evidence.map((row: any) => row.recordId)).toEqual(["E-A"]);
  });

  it("pools learning and prediction reads strictly by organization", async () => {
    await pool.query(`
      insert into evidence_records
        (recordId, projectId, orgId, category, itemName, priceMin, priceTypical, priceMax, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore, confidentiality, corpusScope, corpusPolicyVersion)
      values
        ('ORG-A-1', 11, 101, 'floors', 'Floor A1', 100, 100, 100, 'sqm', 'https://example.invalid/a1', now(), 'A', 90, 'internal', 'organization', 'org-public-v1'),
        ('ORG-A-2', 11, 101, 'floors', 'Floor A2', 110, 110, 110, 'sqm', 'https://example.invalid/a2', now(), 'A', 90, 'internal', 'organization', 'org-public-v1'),
        ('ORG-A-3', 11, 101, 'floors', 'Floor A3', 120, 120, 120, 'sqm', 'https://example.invalid/a3', now(), 'A', 90, 'internal', 'organization', 'org-public-v1'),
        ('PUBLIC-1', null, null, 'floors', 'Public Floor', 115, 115, 115, 'sqm', 'https://example.invalid/public', now(), 'A', 95, 'public', 'platform_public', 'public-v1'),
        ('LEGACY-1', null, null, 'floors', 'Legacy Floor', 9000, 9000, 9000, 'sqm', 'https://example.invalid/legacy', now(), 'A', 95, 'public', 'legacy_unscoped', 'legacy-v0')
    `);
    const caller = predictiveRouter.createCaller(orgContext());
    const before = await caller.getCostRange({ projectId: 11, category: "floors" });
    await pool.query(`
      insert into evidence_records
        (recordId, projectId, orgId, category, itemName, priceMin, priceTypical, priceMax, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore, confidentiality, corpusScope, corpusPolicyVersion)
      values
        ('ORG-B-1', 22, 202, 'floors', 'Foreign Floor 1', 5000, 5000, 5000, 'sqm', 'https://example.invalid/b1', now(), 'A', 90, 'confidential', 'organization', 'org-public-v1'),
        ('ORG-B-2', 22, 202, 'floors', 'Foreign Floor 2', 6000, 6000, 6000, 'sqm', 'https://example.invalid/b2', now(), 'A', 90, 'confidential', 'organization', 'org-public-v1'),
        ('ORG-B-3', 22, 202, 'floors', 'Foreign Floor 3', 7000, 7000, 7000, 'sqm', 'https://example.invalid/b3', now(), 'A', 90, 'confidential', 'organization', 'org-public-v1')
    `);
    const after = await caller.getCostRange({ projectId: 11, category: "floors" });
    expect(after).toEqual(before);
    expect(after.organizationSampleCount).toBe(3);
    expect(after.publicSampleCount).toBe(1);
  });

  it("only returns explicitly classified platform-public evidence", async () => {
    await pool.query(`
      insert into evidence_records
        (recordId, projectId, orgId, category, itemName, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore, confidentiality, corpusScope, corpusPolicyVersion)
      values
        ('PUBLIC-SAFE', null, null, 'walls', 'Safe', 'sqm', 'https://example.invalid/safe', now(), 'A', 95, 'public', 'platform_public', 'public-v1'),
        ('PUBLIC-LEGACY', null, null, 'walls', 'Legacy', 'sqm', 'https://example.invalid/legacy', now(), 'A', 95, 'public', 'legacy_unscoped', 'legacy-v0'),
        ('PUBLIC-FOREIGN', 22, 202, 'walls', 'Foreign', 'sqm', 'https://example.invalid/foreign', now(), 'A', 95, 'public', 'organization', 'org-public-v1')
    `);
    const rows = await db.listPublicCorpusEvidence({ category: "walls" });
    expect(rows.map(row => row.recordId)).toEqual(["PUBLIC-SAFE"]);
  });

  it("excludes legacy and inconsistent project insights from tenant reads", async () => {
    await pool.query(`
      insert into project_insights
        (projectId, orgId, insightType, insightSeverity, title, corpusScope, corpusPolicyVersion)
      values
        (11, 101, 'cost_pressure', 'warning', 'Owned insight', 'organization', 'org-public-v1'),
        (11, null, 'cost_pressure', 'critical', 'Legacy insight', 'legacy_unscoped', 'legacy-v0'),
        (11, 202, 'cost_pressure', 'critical', 'Foreign-tagged insight', 'organization', 'org-public-v1'),
        (null, null, 'market_opportunity', 'info', 'Governed public insight', 'platform_public', 'public-v1'),
        (null, null, 'market_opportunity', 'warning', 'Legacy global insight', 'legacy_unscoped', 'legacy-v0')
    `);
    const caller = analyticsRouter.createCaller(orgContext());
    const projectResult = await caller.getProjectInsights({ projectId: 11, limit: 50 });
    expect(projectResult.insights.map(row => row.title)).toEqual(["Owned insight"]);
    const globalResult = await caller.getProjectInsights({ limit: 50 });
    expect(globalResult.insights.map(row => row.title)).toEqual(["Governed public insight"]);
  });

  it("stores tenant trends with organization identity and conceals other corpora", async () => {
    await pool.query(`
      insert into evidence_records
        (recordId, projectId, orgId, category, itemName, priceMin, priceTypical, priceMax, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore, corpusScope, corpusPolicyVersion)
      values
        ('TREND-A-1', 11, 101, 'floors', 'Stone', 100, 100, 100, 'sqm', 'https://example.invalid/t1', date_sub(now(), interval 40 day), 'A', 90, 'organization', 'org-public-v1'),
        ('TREND-A-2', 11, 101, 'floors', 'Stone', 120, 120, 120, 'sqm', 'https://example.invalid/t2', now(), 'A', 90, 'organization', 'org-public-v1')
    `);
    const result = await analyticsRouter.createCaller(orgContext()).runTrendDetection({
      category: "floors",
      geography: "UAE",
      windowDays: 30,
      generateNarrative: false,
    });
    expect(result.metricsAnalyzed).toBe(1);
    const [stored] = await pool.query(`
      select orgId, corpusScope, corpusPolicyVersion
      from trend_snapshots
    `);
    expect(stored).toEqual([
      expect.objectContaining({
        orgId: 101,
        corpusScope: "organization",
        corpusPolicyVersion: "org-public-v1",
      }),
    ]);
    await pool.query(`
      insert into trend_snapshots
        (metric, category, geography, direction, trendConfidence, orgId, corpusScope, corpusPolicyVersion)
      values
        ('foreign', 'floors', 'UAE', 'rising', 'high', 202, 'organization', 'org-public-v1'),
        ('legacy', 'floors', 'UAE', 'rising', 'high', null, 'legacy_unscoped', 'legacy-v0')
    `);
    const visible = await db.getTrendSnapshotsForOrg(101, { category: "floors" });
    expect(visible.map(row => row.metric)).toEqual(["Stone"]);
  });

  it("refuses cross-organization comparable outcomes and scoped comparison writes", async () => {
    await seedScore(801, 11);
    await seedScore(802, 22);
    const comparables = await db.getComparableScoreMatricesForOrg(101, 11);
    expect(comparables).toEqual([]);
    const rejected = await db.createOutcomeComparisonForOrg(22, 101, {
      projectId: 22,
      predictedCostMid: null,
      actualCost: null,
      costDeltaPct: null,
      costAccuracyBand: "no_prediction",
      predictedComposite: 60,
      predictedDecision: "validated",
      actualOutcomeSuccess: true,
      scorePredictionCorrect: true,
      predictedRisk: 40,
      actualReworkOccurred: false,
      riskPredictionCorrect: true,
      overallAccuracyGrade: "A",
    });
    expect(rejected).toBeNull();
    expect(await count("outcome_comparisons")).toBe(0);
  });

  it("scopes project readiness and confirmed-input writes to the organization", async () => {
    const caller = projectRouter.createCaller(orgContext());
    const created = await caller.create({
      name: "Readiness project",
      ctx01Typology: "Residential",
      ctx03Gfa: 12000,
      ctx04Location: "Prime",
      projectPurpose: "sell_offplan",
      fin01BudgetCap: 650,
      inputProvenance: {
        name: "explicit",
        ctx01Typology: "explicit",
        ctx03Gfa: "explicit",
        ctx04Location: "explicit",
        projectPurpose: "explicit",
        fin01BudgetCap: "explicit",
      },
    });
    const before = await caller.readiness({ id: created.id });
    expect(before.canEvaluate).toBe(false);
    expect(before.unconfirmedAssumptions.length).toBeGreaterThan(0);

    const foreign = projectRouter.createCaller(viewerContext());
    await expect(foreign.readiness({ id: created.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(foreign.confirmInputs({ id: created.id, fields: before.unconfirmedAssumptions })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const after = await caller.confirmInputs({ id: created.id, fields: before.unconfirmedAssumptions });
    expect(after).toMatchObject({ canEvaluate: true, status: "ready", policyVersion: "input-readiness-v1" });
    const [rows] = await pool.query("select inputProvenance from projects where id = ?", [created.id]);
    const stored = (rows as Array<{ inputProvenance: string | Record<string, string> }>)[0].inputProvenance;
    const provenance = typeof stored === "string" ? JSON.parse(stored) : stored;
    expect(provenance.mkt01Tier).toBe("confirmed");
  });
});
