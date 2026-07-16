import { afterAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import * as db from "../../server/db";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Guarded MySQL suite requires DATABASE_URL");
const pool = mysql.createPool(connectionString);

const tables = [
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
  "scenarios",
  "evidence_records",
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

beforeEach(async () => {
  await pool.query("drop trigger if exists tr03h_fail_board_delete");
  await pool.query("drop trigger if exists tr03h_fail_project_update");
  await pool.query("drop trigger if exists tr03h_fail_rfq_insert");
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

describe("TR-03H real MySQL authorization boundary", () => {
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

  it("rolls back board, RFQ and floor-plan transactions after late SQL failures", async () => {
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
  });

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
});
