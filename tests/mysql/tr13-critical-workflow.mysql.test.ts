import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import type { TrpcContext } from "../../server/_core/context";
import { initializeDatabaseSafety } from "../../server/_core/database-safety";
import { requireActivePublicShare } from "../../server/_core/public-share-access";
import { resetPublicRateLimitForTests } from "../../server/_core/rate-limit";
import { designRouter } from "../../server/routers/design";
import { designAdvisorRouter } from "../../server/routers/design-advisor";
import { materialQuantityRouter } from "../../server/routers/materialQuantity";
import { projectRouter } from "../../server/routers/project";
import { spaceProgramRouter } from "../../server/routers/spaceProgram";
import {
  TR13_EXPECTED_RECONCILIATION,
  TR13_MYSQL_CRITICAL_FIXTURE,
  TR13_WORKFLOW_FIXTURE,
  TR13_WORKFLOW_FIXTURE_VERSION,
} from "../fixtures/workflows/tr13-workflow-fixtures";

const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("../../server/_core/llm", () => ({ invokeLLM: llm.invokeLLM }));

initializeDatabaseSafety("integration-test", { loadDotenv: false });
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("TR-13 MySQL contract requires guarded DATABASE_URL");
const pool = mysql.createPool(connectionString);

const FIXTURE = TR13_MYSQL_CRITICAL_FIXTURE;
const ID = FIXTURE.ids;

function context(
  userId: number,
  orgId: number,
  user: (typeof FIXTURE.users)[keyof typeof FIXTURE.users]
): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `tr13-${userId}`,
      password: null,
      name: user.name,
      email: user.email,
      loginMethod: "tr13-synthetic",
      role: "user",
      orgId,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const admin = () => context(ID.admin, ID.primaryOrg, FIXTURE.users.admin);
const member = () => context(ID.member, ID.primaryOrg, FIXTURE.users.member);
const viewer = () => context(ID.viewer, ID.primaryOrg, FIXTURE.users.viewer);
const foreign = () => context(ID.foreign, ID.foreignOrg, FIXTURE.users.foreign);

async function clearOwnedFixture(): Promise<void> {
  const projectIds = [ID.project, ID.foreignProject];
  await pool.query("delete from audit_logs where entityId in (?, ?)", projectIds);
  await pool.query("delete from report_instances where projectId in (?, ?)", projectIds);
  await pool.query("delete from ai_design_briefs where project_id in (?, ?)", projectIds);
  await pool.query("delete from design_briefs where projectId in (?, ?)", projectIds);
  await pool.query("delete from material_allocations where projectId in (?, ?)", projectIds);
  await pool.query("delete from space_program_rooms where projectId in (?, ?)", projectIds);
  await pool.query("delete from space_recommendations where project_id in (?, ?)", projectIds);
  await pool.query("delete from evidence_records where projectId in (?, ?)", projectIds);
  await pool.query("delete from score_matrices where projectId in (?, ?)", projectIds);
  await pool.query("delete from projects where id in (?, ?)", projectIds);
  await pool.query("delete from organization_members where orgId in (?, ?)", [ID.primaryOrg, ID.foreignOrg]);
  await pool.query("delete from users where id in (?, ?, ?, ?)", [ID.admin, ID.member, ID.viewer, ID.foreign]);
  await pool.query("delete from organizations where id in (?, ?)", [ID.primaryOrg, ID.foreignOrg]);
  await pool.query("delete from benchmark_data where benchmarkVersionId = ?", [ID.benchmark]);
  await pool.query("delete from logic_weights where logicVersionId = ?", [ID.logic]);
  await pool.query("delete from logic_versions where id = ?", [ID.logic]);
  await pool.query("delete from benchmark_versions where id = ?", [ID.benchmark]);
  await pool.query("delete from model_versions where id = ?", [ID.model]);
  await pool.query("delete from materials_catalog where id = ?", [ID.materialCatalog]);
  await pool.query("delete from material_library where id in (?, ?, ?, ?)", [ID.materialLibrary, ID.affordableFloor, ID.affordableWall, ID.affordableCeiling]);
}

async function seed(): Promise<void> {
  await clearOwnedFixture();
  const { primary, foreign: foreignOrganization } = FIXTURE.organizations;
  const { admin: fixtureAdmin, member: fixtureMember, viewer: fixtureViewer, foreign: fixtureForeign } = FIXTURE.users;
  const [premiumStone, affordableFloor, affordableWall, affordableCeiling] = FIXTURE.materials.library;
  const [living, bedroom] = FIXTURE.rooms;
  await pool.query(`
    insert into organizations (id, name, slug) values
      (${ID.primaryOrg}, '${primary.name}', '${primary.slug}'),
      (${ID.foreignOrg}, '${foreignOrganization.name}', '${foreignOrganization.slug}')
  `);
  await pool.query(`
    insert into users (id, openId, name, email, loginMethod, role, orgId) values
      (${ID.admin}, 'tr13-${ID.admin}', '${fixtureAdmin.name}', '${fixtureAdmin.email}', 'tr13-synthetic', 'user', ${ID.primaryOrg}),
      (${ID.member}, 'tr13-${ID.member}', '${fixtureMember.name}', '${fixtureMember.email}', 'tr13-synthetic', 'user', ${ID.primaryOrg}),
      (${ID.viewer}, 'tr13-${ID.viewer}', '${fixtureViewer.name}', '${fixtureViewer.email}', 'tr13-synthetic', 'user', ${ID.primaryOrg}),
      (${ID.foreign}, 'tr13-${ID.foreign}', '${fixtureForeign.name}', '${fixtureForeign.email}', 'tr13-synthetic', 'user', ${ID.foreignOrg})
  `);
  await pool.query(`
    insert into organization_members (orgId, userId, role) values
      (${ID.primaryOrg}, ${ID.admin}, '${fixtureAdmin.membership}'),
      (${ID.primaryOrg}, ${ID.member}, '${fixtureMember.membership}'),
      (${ID.primaryOrg}, ${ID.viewer}, '${fixtureViewer.membership}'),
      (${ID.foreignOrg}, ${ID.foreign}, '${fixtureForeign.membership}')
  `);
  await pool.query(`
    insert into model_versions (id, versionTag, dimensionWeights, variableWeights, penaltyConfig, isActive, createdBy)
    values (${ID.model}, '${FIXTURE.versions.model.tag}', '${JSON.stringify(FIXTURE.versions.model.dimensionWeights)}', '{}', '[]', true, ${ID.admin})
  `);
  await pool.query(`
    insert into benchmark_versions (id, versionTag, description, status, publishedAt, publishedBy, recordCount, createdBy)
    values (${ID.benchmark}, '${FIXTURE.versions.benchmark.tag}', 'Synthetic certification benchmark', 'published', '${FIXTURE.versions.benchmark.date}', ${ID.admin}, 1, ${ID.admin})
  `);
  await pool.query(`
    insert into logic_versions (id, name, status, createdBy, publishedAt, notes)
    values (${ID.logic}, '${FIXTURE.versions.logic.name}', 'published', ${ID.admin}, '${FIXTURE.versions.logic.date}', 'Synthetic certification logic')
  `);
  await pool.query(`
    insert into logic_weights (logicVersionId, dimension, weight) values
      (${ID.logic}, 'sa', ${FIXTURE.versions.model.dimensionWeights.sa}), (${ID.logic}, 'ff', ${FIXTURE.versions.model.dimensionWeights.ff}), (${ID.logic}, 'mp', ${FIXTURE.versions.model.dimensionWeights.mp}), (${ID.logic}, 'ds', ${FIXTURE.versions.model.dimensionWeights.ds}), (${ID.logic}, 'er', ${FIXTURE.versions.model.dimensionWeights.er})
  `);
  await pool.query(`
    insert into benchmark_data (typology, location, marketTier, materialLevel, roomType, costPerSqftLow, costPerSqftMid, costPerSqftHigh, dataYear, benchmarkVersionId)
    values ('${FIXTURE.benchmark.typology}', '${FIXTURE.benchmark.location}', '${FIXTURE.benchmark.marketTier}', ${FIXTURE.benchmark.materialLevel}, '${FIXTURE.benchmark.roomType}', ${FIXTURE.benchmark.low}, ${FIXTURE.benchmark.mid}, ${FIXTURE.benchmark.high}, ${FIXTURE.benchmark.year}, ${ID.benchmark})
  `);
  await pool.query(`
    insert into projects (id, userId, orgId, name, description, status, ctx01Typology, ctx02Scale, ctx03Gfa, totalFitoutArea, ctx04Location, ctx05Horizon, city, mkt01Tier, fin01BudgetCap, des01Style, inputProvenance, modelVersionId, benchmarkVersionId)
    values
      (${ID.project}, ${ID.admin}, ${ID.primaryOrg}, '${FIXTURE.project.name}', '${FIXTURE.project.description}', '${FIXTURE.project.status}', '${FIXTURE.project.typology}', '${FIXTURE.project.scale}', ${FIXTURE.project.gfa}, ${FIXTURE.project.fitOutArea}, '${FIXTURE.project.location}', '${FIXTURE.project.horizon}', '${FIXTURE.project.city}', '${FIXTURE.project.marketTier}', ${FIXTURE.project.budgetCap}, '${FIXTURE.project.style}', '${JSON.stringify(FIXTURE.project.provenance)}', ${ID.model}, ${ID.benchmark}),
      (${ID.foreignProject}, ${ID.foreign}, ${ID.foreignOrg}, '${FIXTURE.foreignProject.name}', '${FIXTURE.project.description}', '${FIXTURE.project.status}', '${FIXTURE.project.typology}', '${FIXTURE.project.scale}', ${FIXTURE.project.gfa}, ${FIXTURE.foreignProject.fitOutArea}, '${FIXTURE.project.location}', '${FIXTURE.project.horizon}', '${FIXTURE.project.city}', '${FIXTURE.project.marketTier}', ${FIXTURE.project.budgetCap}, '${FIXTURE.project.style}', '{"ctx01Typology":"explicit"}', ${ID.model}, ${ID.benchmark})
  `);
  await pool.query(`
    insert into score_matrices (id, projectId, modelVersionId, saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore, rasScore, confidenceScore, decisionStatus, dimensionWeights, variableContributions, inputSnapshot)
    values (${ID.score}, ${ID.project}, ${ID.model}, ${FIXTURE.score.dimensions.sa}, ${FIXTURE.score.dimensions.ff}, ${FIXTURE.score.dimensions.mp}, ${FIXTURE.score.dimensions.ds}, ${FIXTURE.score.dimensions.er}, ${FIXTURE.score.composite}, ${FIXTURE.score.risk}, ${FIXTURE.score.ras}, ${FIXTURE.score.confidence}, 'validated', '${JSON.stringify(FIXTURE.versions.model.dimensionWeights)}', '{}', '{}')
  `);
  await pool.query(`
    insert into evidence_records (id, recordId, projectId, orgId, category, itemName, unit, sourceUrl, captureDate, reliabilityGrade, confidenceScore, confidentiality, corpusScope)
    values (${ID.evidence}, '${FIXTURE.evidence.recordId}', ${ID.project}, ${ID.primaryOrg}, '${FIXTURE.evidence.category}', '${FIXTURE.evidence.itemName}', '${FIXTURE.evidence.unit}', '${FIXTURE.evidence.sourceUrl}', '${FIXTURE.evidence.date}', '${FIXTURE.evidence.reliability}', ${FIXTURE.evidence.confidence}, '${FIXTURE.evidence.confidentiality}', '${FIXTURE.evidence.corpusScope}')
  `);
  await pool.query(`
    insert into materials_catalog (id, name, category, tier, typicalCostLow, typicalCostHigh, costUnit, supplierName, isActive)
    values (${ID.materialCatalog}, '${FIXTURE.materials.catalog.name}', '${FIXTURE.materials.catalog.category}', '${FIXTURE.materials.catalog.tier}', ${FIXTURE.materials.catalog.low}, ${FIXTURE.materials.catalog.high}, '${FIXTURE.materials.catalog.unit}', '${FIXTURE.materials.catalog.supplier}', true)
  `);
  await pool.query(`
    insert into material_library (id, category, tier, style, product_code, product_name, brand, supplier_name, unit_label, price_aed_min, price_aed_max, is_active)
    values
      (${ID.materialLibrary}, '${premiumStone.category}', '${premiumStone.tier}', 'modern', '${premiumStone.code}', '${premiumStone.name}', 'Synthetic', 'Synthetic Supplier', 'sqm', ${premiumStone.low}, ${premiumStone.high}, true),
      (${ID.affordableFloor}, '${affordableFloor.category}', '${affordableFloor.tier}', 'modern', '${affordableFloor.code}', '${affordableFloor.name}', 'Synthetic', 'Synthetic Supplier', 'sqm', ${affordableFloor.low}, ${affordableFloor.high}, true),
      (${ID.affordableWall}, '${affordableWall.category}', '${affordableWall.tier}', 'modern', '${affordableWall.code}', '${affordableWall.name}', 'Synthetic', 'Synthetic Supplier', 'sqm', ${affordableWall.low}, ${affordableWall.high}, true),
      (${ID.affordableCeiling}, '${affordableCeiling.category}', '${affordableCeiling.tier}', 'modern', '${affordableCeiling.code}', '${affordableCeiling.name}', 'Synthetic', 'Synthetic Supplier', 'sqm', ${affordableCeiling.low}, ${affordableCeiling.high}, true)
  `);
  await pool.query(`
    insert into space_program_rooms (projectId, organizationId, roomCode, roomName, category, sqm, source, isFitOut, fitOutOverridden, finishGrade, priority, budgetPct, sortOrder, blockName, blockTypology)
    values
      (${ID.project}, ${ID.primaryOrg}, '${living.code}', '${living.name}', '${living.category}', ${living.sqm}, 'user_manual', true, false, '${living.grade}', '${living.priority}', ${living.budgetPct}, ${living.sortOrder}, 'Main', 'residential'),
      (${ID.project}, ${ID.primaryOrg}, '${bedroom.code}', '${bedroom.name}', '${bedroom.category}', ${bedroom.sqm}, 'user_manual', true, false, '${bedroom.grade}', '${bedroom.priority}', ${bedroom.budgetPct}, ${bedroom.sortOrder}, 'Main', 'residential')
  `);
  await pool.query(`
    insert into material_allocations (projectId, organizationId, roomId, roomName, element, materialLibraryId, materialName, allocationPct, surfaceAreaM2, unitCostMin, unitCostMax, totalCostMin, totalCostMax, aiReasoning, isLocked)
    values (${ID.project}, ${ID.primaryOrg}, '${FIXTURE.lockedAllocation.roomCode}', '${living.name}', '${FIXTURE.lockedAllocation.element}', ${ID[FIXTURE.lockedAllocation.material]}, '${premiumStone.name}', ${FIXTURE.lockedAllocation.pct}, ${FIXTURE.lockedAllocation.area}, ${FIXTURE.lockedAllocation.low}, ${FIXTURE.lockedAllocation.high}, ${FIXTURE.lockedAllocation.totalLow}, ${FIXTURE.lockedAllocation.totalHigh}, 'Synthetic locked allocation', true)
  `);
  await pool.query(`
    insert into space_recommendations (project_id, org_id, room_id, room_name, sqm, style_direction, color_scheme, material_package, budget_allocation, budget_breakdown, ai_rationale, special_notes, alternatives)
    values (${ID.project}, ${ID.primaryOrg}, 'LVG', 'Synthetic Living', 10, 'Synthetic Modern', 'Warm neutral', '[]', 10000, '[]', 'Synthetic recommendation', '[]', '[]')
  `);

  // Read back every value governed by the canonical fixture. This makes any
  // accidental SQL-only fixture drift fail before a router is exercised.
  const [organizations] = await pool.query<any[]>(
    "select id, name, slug from organizations where id in (?, ?) order by id",
    [ID.primaryOrg, ID.foreignOrg]
  );
  expect(organizations).toEqual([
    { id: ID.primaryOrg, ...FIXTURE.organizations.primary },
    { id: ID.foreignOrg, ...FIXTURE.organizations.foreign },
  ]);
  const [users] = await pool.query<any[]>(
    "select id, name, email, orgId from users where id in (?, ?, ?, ?) order by id",
    [ID.admin, ID.member, ID.viewer, ID.foreign]
  );
  expect(users).toEqual([
    { id: ID.admin, name: FIXTURE.users.admin.name, email: FIXTURE.users.admin.email, orgId: ID.primaryOrg },
    { id: ID.member, name: FIXTURE.users.member.name, email: FIXTURE.users.member.email, orgId: ID.primaryOrg },
    { id: ID.viewer, name: FIXTURE.users.viewer.name, email: FIXTURE.users.viewer.email, orgId: ID.primaryOrg },
    { id: ID.foreign, name: FIXTURE.users.foreign.name, email: FIXTURE.users.foreign.email, orgId: ID.foreignOrg },
  ]);
  const [memberships] = await pool.query<any[]>(
    "select orgId, userId, role from organization_members where userId in (?, ?, ?, ?) order by userId",
    [ID.admin, ID.member, ID.viewer, ID.foreign]
  );
  expect(memberships).toEqual([
    { orgId: ID.primaryOrg, userId: ID.admin, role: FIXTURE.users.admin.membership },
    { orgId: ID.primaryOrg, userId: ID.member, role: FIXTURE.users.member.membership },
    { orgId: ID.primaryOrg, userId: ID.viewer, role: FIXTURE.users.viewer.membership },
    { orgId: ID.foreignOrg, userId: ID.foreign, role: FIXTURE.users.foreign.membership },
  ]);
  const [versions] = await pool.query<any[]>(
    `select
       (select versionTag from model_versions where id = ?) as modelTag,
       (select dimensionWeights from model_versions where id = ?) as modelWeights,
       (select versionTag from benchmark_versions where id = ?) as benchmarkTag,
       (select date_format(publishedAt, '%Y-%m-%d') from benchmark_versions where id = ?) as benchmarkDate,
       (select name from logic_versions where id = ?) as logicName,
       (select date_format(publishedAt, '%Y-%m-%d') from logic_versions where id = ?) as logicDate`,
    [ID.model, ID.model, ID.benchmark, ID.benchmark, ID.logic, ID.logic]
  );
  expect(versions).toEqual([{
    modelTag: FIXTURE.versions.model.tag,
    modelWeights: FIXTURE.versions.model.dimensionWeights,
    benchmarkTag: FIXTURE.versions.benchmark.tag,
    benchmarkDate: FIXTURE.versions.benchmark.date,
    logicName: FIXTURE.versions.logic.name,
    logicDate: FIXTURE.versions.logic.date,
  }]);
  const [projectRows] = await pool.query<any[]>(
    `select name, description, status, ctx01Typology as typology, ctx02Scale as scale,
      ctx03Gfa as gfa, totalFitoutArea as fitOutArea, ctx04Location as location,
      ctx05Horizon as horizon, city, mkt01Tier as marketTier, fin01BudgetCap as budgetCap,
      des01Style as style, inputProvenance as provenance
     from projects where id = ?`,
    [ID.project]
  );
  expect({
    ...projectRows[0],
    gfa: Number(projectRows[0]?.gfa), fitOutArea: Number(projectRows[0]?.fitOutArea),
    budgetCap: Number(projectRows[0]?.budgetCap),
    provenance: typeof projectRows[0]?.provenance === "string"
      ? JSON.parse(projectRows[0].provenance)
      : projectRows[0]?.provenance,
  }).toEqual({ ...FIXTURE.project, provenance: FIXTURE.project.provenance });
  const [scoreRows] = await pool.query<any[]>(
    "select saScore, ffScore, mpScore, dsScore, erScore, compositeScore, riskScore, rasScore, confidenceScore from score_matrices where id = ?",
    [ID.score]
  );
  expect(Object.fromEntries(Object.entries(scoreRows[0] ?? {}).map(([key, value]) => [key, Number(value)]))).toEqual({
    saScore: FIXTURE.score.dimensions.sa, ffScore: FIXTURE.score.dimensions.ff,
    mpScore: FIXTURE.score.dimensions.mp, dsScore: FIXTURE.score.dimensions.ds,
    erScore: FIXTURE.score.dimensions.er, compositeScore: FIXTURE.score.composite,
    riskScore: FIXTURE.score.risk, rasScore: FIXTURE.score.ras, confidenceScore: FIXTURE.score.confidence,
  });
  const [evidenceRows] = await pool.query<any[]>(
    "select recordId, category, itemName, unit, sourceUrl, date_format(captureDate, '%Y-%m-%d') as date, reliabilityGrade, confidenceScore, confidentiality, corpusScope from evidence_records where id = ?",
    [ID.evidence]
  );
  expect({ ...evidenceRows[0], confidenceScore: Number(evidenceRows[0]?.confidenceScore) }).toEqual({
    recordId: FIXTURE.evidence.recordId, category: FIXTURE.evidence.category,
    itemName: FIXTURE.evidence.itemName, unit: FIXTURE.evidence.unit, sourceUrl: FIXTURE.evidence.sourceUrl, date: FIXTURE.evidence.date,
    reliabilityGrade: FIXTURE.evidence.reliability, confidenceScore: FIXTURE.evidence.confidence,
    confidentiality: FIXTURE.evidence.confidentiality, corpusScope: FIXTURE.evidence.corpusScope,
  });
  const [library] = await pool.query<any[]>(
    "select id, category, tier, product_code as code, product_name as name, price_aed_min as low, price_aed_max as high from material_library where id in (?, ?, ?, ?) order by id",
    [ID.materialLibrary, ID.affordableFloor, ID.affordableWall, ID.affordableCeiling]
  );
  expect(library.map(row => ({ ...row, low: Number(row.low), high: Number(row.high) }))).toEqual(
    FIXTURE.materials.library.map(material => ({
      id: ID[material.id], category: material.category, tier: material.tier, code: material.code,
      name: material.name, low: material.low, high: material.high,
    }))
  );
  const [catalog] = await pool.query<any[]>(
    "select name, category, tier, typicalCostLow as low, typicalCostHigh as high, costUnit as unit, supplierName as supplier from materials_catalog where id = ?",
    [ID.materialCatalog]
  );
  expect({ ...catalog[0], low: Number(catalog[0]?.low), high: Number(catalog[0]?.high) }).toEqual(
    FIXTURE.materials.catalog
  );
  const [benchmarkRows] = await pool.query<any[]>(
    "select typology, location, marketTier, materialLevel, roomType, costPerSqftLow as low, costPerSqftMid as mid, costPerSqftHigh as high, dataYear as year from benchmark_data where benchmarkVersionId = ?",
    [ID.benchmark]
  );
  expect({
    ...benchmarkRows[0],
    materialLevel: Number(benchmarkRows[0]?.materialLevel),
    low: Number(benchmarkRows[0]?.low), mid: Number(benchmarkRows[0]?.mid),
    high: Number(benchmarkRows[0]?.high), year: Number(benchmarkRows[0]?.year),
  }).toEqual(FIXTURE.benchmark);
  const [rooms] = await pool.query<any[]>(
    "select roomCode as code, roomName as name, category, sqm, finishGrade as grade, priority, budgetPct, sortOrder from space_program_rooms where projectId = ? order by sortOrder",
    [ID.project]
  );
  expect(rooms.map(row => ({ ...row, sqm: Number(row.sqm), budgetPct: Number(row.budgetPct), sortOrder: Number(row.sortOrder) }))).toEqual(FIXTURE.rooms);
  const [locked] = await pool.query<any[]>(
    "select roomId as roomCode, element, materialLibraryId, allocationPct as pct, surfaceAreaM2 as area, unitCostMin as low, unitCostMax as high, totalCostMin as totalLow, totalCostMax as totalHigh, isLocked from material_allocations where projectId = ? and isLocked = true",
    [ID.project]
  );
  expect({
    roomCode: locked[0]?.roomCode, element: locked[0]?.element, material: "materialLibrary",
    pct: Number(locked[0]?.pct), area: Number(locked[0]?.area), low: Number(locked[0]?.low),
    high: Number(locked[0]?.high), totalLow: Number(locked[0]?.totalLow), totalHigh: Number(locked[0]?.totalHigh),
  }).toEqual(FIXTURE.lockedAllocation);
  const [foreignProjects] = await pool.query<any[]>(
    "select name, totalFitoutArea as fitOutArea from projects where id = ?",
    [ID.foreignProject]
  );
  expect({ ...foreignProjects[0], fitOutArea: Number(foreignProjects[0]?.fitOutArea) }).toEqual(FIXTURE.foreignProject);
}

beforeAll(async () => {
  mkdirSync(path.join(process.cwd(), "tmp", "tr13-workflow-certification"), {
    recursive: true,
  });
  await seed();
  llm.invokeLLM.mockImplementation(
    async (params: { outputSchema?: unknown }) => ({
      id: "tr13-synthetic-llm",
      created: 0,
      model: "tr13-synthetic-model",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify(
              params.outputSchema
                ? {
                    rooms: [
                      {
                        roomId: "LVG",
                        floor: [
                          {
                            materialLibraryId: ID.materialLibrary,
                            materialName: "TR-13 Synthetic Stone",
                            percentage: 100,
                            reasoning: "Synthetic Grade B allocation",
                          },
                        ],
                        walls: [],
                        ceiling: [],
                        joinery: [],
                      },
                      {
                        roomId: "MBR",
                        floor: [
                          {
                            materialLibraryId: ID.materialLibrary,
                            materialName: "TR-13 Synthetic Stone",
                            percentage: 100,
                            reasoning: "Synthetic Grade A allocation",
                          },
                        ],
                        walls: [],
                        ceiling: [],
                        joinery: [],
                      },
                    ],
                    designRationale: "Synthetic parsed allocation",
                    estimatedQualityLabel: "Synthetic",
                  }
                : {
                    executiveSummary: "Synthetic AI-assisted narrative",
                    designDirection: {
                      overallStyle: "Modern",
                      colorStrategy: "Warm neutral",
                      materialPhilosophy: "Synthetic stone",
                      lightingApproach: "Layered",
                      keyDifferentiators: ["Synthetic"],
                    },
                    spaceBySpaceGuide: [],
                    deliverables: ["Synthetic deliverable"],
                    qualityGates: ["Synthetic quality gate"],
                    notes: ["Synthetic note"],
                  }
            ),
          },
        },
      ],
    })
  );
  resetPublicRateLimitForTests();
});

afterAll(async () => {
  await pool.end();
});

describe("TR-13 real MySQL critical workflow contract", () => {
  it("exercises the guarded tenant, brief, stored-report, share, and numerical routes", async () => {
    const space = await spaceProgramRouter
      .createCaller(member())
      .getForProject({ projectId: ID.project });
    expect(space.rooms).toHaveLength(2);
    expect(space.rooms[0]).toMatchObject({ roomCode: "LVG" });
    expect(Number(space.rooms[0]?.sqm)).toBe(10);

    const gradeAbGenerated = await materialQuantityRouter
      .createCaller(member())
      .generate({ projectId: ID.project });
    expect(gradeAbGenerated.rooms).toHaveLength(2);
    expect(llm.invokeLLM).toHaveBeenCalled();
    const persistedGradeAb = await materialQuantityRouter
      .createCaller(member())
      .getForProject({ projectId: ID.project });
    expect(persistedGradeAb?.rooms.some(room => room.roomId === "MBR")).toBe(true);

    await Promise.all(
      space.rooms.map(room =>
        spaceProgramRouter
          .createCaller(member())
          .updateRoom({ roomId: room.id, finishGrade: "C" })
      )
    );
    const llmCallsBeforeGradeC = llm.invokeLLM.mock.calls.length;
    await materialQuantityRouter
      .createCaller(member())
      .generate({ projectId: ID.project });
    expect(llm.invokeLLM).toHaveBeenCalledTimes(llmCallsBeforeGradeC);

    const mqi = await materialQuantityRouter
      .createCaller(member())
      .getForProject({ projectId: ID.project });
    expect(mqi?.totalAllocations).toBe(TR13_EXPECTED_RECONCILIATION.allocationCount);
    const allocations = mqi?.rooms.flatMap(room =>
      room.elements.flatMap(element => element.allocations)
    ) ?? [];
    expect(allocations.some(allocation => allocation.isLocked)).toBe(true);
    expect(allocations.every(allocation => allocation.materialLibraryId !== null)).toBe(true);
    expect(allocations.reduce((total, allocation) => total + allocation.totalCostMin, 0)).toBeCloseTo(TR13_EXPECTED_RECONCILIATION.costAed.min, 2);
    expect(allocations.reduce((total, allocation) => total + allocation.totalCostMax, 0)).toBeCloseTo(TR13_EXPECTED_RECONCILIATION.costAed.max, 2);

    const structured = await designRouter
      .createCaller(member())
      .generateBrief({ projectId: ID.project, locale: "en" });
    expect(structured.version).toBe(1);
    expect(structured.data.projectIdentity.projectName).toBe(
      FIXTURE.project.name
    );
    expect(structured.data.mqiSummary).toMatchObject({
      totalFinishCostMin: TR13_EXPECTED_RECONCILIATION.costAed.min,
      totalFinishCostMax: TR13_EXPECTED_RECONCILIATION.costAed.max,
      totalFinishCostMid: TR13_EXPECTED_RECONCILIATION.costAed.mid,
    });

    const generatedAutonomous = await designAdvisorRouter
      .createCaller(member())
      .generateDesignBrief({ projectId: ID.project });
    expect(generatedAutonomous.executiveSummary).toBe(
      "Synthetic AI-assisted narrative"
    );
    const autonomous = await designAdvisorRouter
      .createCaller(member())
      .getDesignBrief({ projectId: ID.project });
    expect(autonomous).toMatchObject({ version: "1.0" });
    expect(autonomous).not.toHaveProperty("shareToken");

    const generatedReport = await projectRouter
      .createCaller(member())
      .generateReport({
        projectId: ID.project,
        reportType: "full_report",
        locale: "en",
      });
    expect(generatedReport).toMatchObject({
      projectId: ID.project,
      projectName: FIXTURE.project.name,
    });
    const reports = await projectRouter
      .createCaller(member())
      .listReports({ projectId: ID.project });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      reportType: "full_report",
      benchmarkVersionId: ID.benchmark,
      modelVersionId: ID.model,
    });
    const storedContent = reports[0]?.content as { html?: string };
    const storedHtml = storedContent.html!;
    expect(storedHtml).toMatch(/Document ID:|Render-input fingerprint:/);
    expect(storedHtml).toContain(FIXTURE.evidence.itemName);
    expect(storedHtml).toMatch(/assumption|advisory|disclaimer/i);
    expect(storedHtml).toContain(FIXTURE.versions.benchmark.tag);
    expect(storedHtml).toContain(FIXTURE.versions.logic.name);
    expect(storedHtml).toContain(FIXTURE.versions.model.tag);
    expect(storedHtml).toContain("Workflow, Space & MQI Reconciliation");
    expect(storedHtml).toContain("0.00 m² · PASS");
    expect(storedHtml).toContain(`${TR13_EXPECTED_RECONCILIATION.roomCount} / ${TR13_EXPECTED_RECONCILIATION.roomCount} / ${TR13_EXPECTED_RECONCILIATION.roomCount}`);
    expect(storedHtml).toContain(`${TR13_EXPECTED_RECONCILIATION.allocationCount} / ${TR13_EXPECTED_RECONCILIATION.allocationCount}`);
    expect(storedHtml).toMatch(/100\.00%[\s\S]*10\.00 \/ 10\.00 m²[\s\S]*PASS/);
    expect(storedHtml).toContain(`${FIXTURE.lockedAllocation.area.toFixed(2)} / ${FIXTURE.lockedAllocation.area.toFixed(2)} m²`);
    expect(storedHtml).toContain(`AED ${TR13_EXPECTED_RECONCILIATION.costAed.min.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    expect(storedHtml).toContain(`AED ${TR13_EXPECTED_RECONCILIATION.costAed.mid.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    expect(storedHtml).toContain(`AED ${TR13_EXPECTED_RECONCILIATION.costAed.max.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    expect(storedHtml).toContain(`${TR13_EXPECTED_RECONCILIATION.allocationCount}/${TR13_EXPECTED_RECONCILIATION.allocationCount} · 0 unpriced · PASS`);
    expect(storedHtml).not.toMatch(/share[_-]?token|tr13-admin-password/i);
    writeFileSync(
      path.join(
        process.cwd(),
        "tmp",
        "tr13-workflow-certification",
        "report.html"
      ),
      storedHtml
    );

    await expect(
      designRouter
        .createCaller(viewer())
        .generateBrief({ projectId: ID.project })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      designRouter
        .createCaller(foreign())
        .getLatestBrief({ projectId: ID.project })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      projectRouter
        .createCaller(foreign())
        .listReports({ projectId: ID.project })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const share = await designRouter
      .createCaller(admin())
      .createShareLink({ projectId: ID.project, expiryDays: 7 });
    expect(share.token).toHaveLength(32);
    const resolved = await designRouter
      .createCaller({ user: null, req: {} as any, res: {} as any })
      .resolveShareLink({ token: share.token });
    expect(resolved).toMatchObject({
      projectName: FIXTURE.project.name,
      readOnly: true,
    });
    await expect(requireActivePublicShare(share.token)).resolves.toMatchObject({
      project: { id: ID.project, orgId: ID.primaryOrg },
    });

    await expect(
      designRouter
        .createCaller(member())
        .revokeShareLinks({ projectId: ID.project })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      designRouter
        .createCaller(viewer())
        .createShareLink({ projectId: ID.project, expiryDays: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      designRouter
        .createCaller(foreign())
        .revokeShareLinks({ projectId: ID.project })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await designRouter
        .createCaller(admin())
        .revokeShareLinks({ projectId: ID.project })
    ).toMatchObject({ revokedCount: 1, active: false });
    await expect(
      designRouter
        .createCaller({ user: null, req: {} as any, res: {} as any })
        .resolveShareLink({ token: share.token })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          fixture: TR13_WORKFLOW_FIXTURE,
          mysqlFixture: FIXTURE,
          reconciliation: TR13_EXPECTED_RECONCILIATION,
          storedReport: reports[0]?.id,
        })
      )
      .digest("hex");
    const workflowReconciliationFingerprint = createHash("sha256")
      .update(JSON.stringify(TR13_EXPECTED_RECONCILIATION))
      .digest("hex");
    const reportRenderInputFingerprint =
      /Render-input fingerprint:<\/span>\s*([a-f0-9]{64})/i.exec(
        storedHtml
      )?.[1];
    expect(reportRenderInputFingerprint).toMatch(/^[a-f0-9]{64}$/);
    writeFileSync(
      path.join(
        process.cwd(),
        "tmp",
        "tr13-workflow-certification",
        "integration-evidence.json"
      ),
      `${JSON.stringify(
        {
          status: "PASS",
          syntheticOnly: true,
          nonSecretIds: {
            primaryOrg: ID.primaryOrg,
            foreignOrg: ID.foreignOrg,
            project: ID.project,
            score: ID.score,
            evidence: ID.evidence,
            material: ID.materialCatalog,
            structuredBrief: structured.id,
            autonomousBrief: autonomous?.id,
            storedReport: reports[0]?.id,
          },
          fixtureFingerprint: fingerprint,
          workflowReconciliationFingerprint,
          reportRenderInputFingerprint,
          reconciliations: {
            scoreComposite: FIXTURE.score.composite,
            fitOutAreaM2: TR13_EXPECTED_RECONCILIATION.fitOutAreaM2,
            roomAreaM2: TR13_EXPECTED_RECONCILIATION.roomAreaM2,
            allocationPct: TR13_EXPECTED_RECONCILIATION.allocationPct,
            roomCount: TR13_EXPECTED_RECONCILIATION.roomCount,
            allocationCount: TR13_EXPECTED_RECONCILIATION.allocationCount,
            lockedAllocationCount: TR13_EXPECTED_RECONCILIATION.lockedAllocationCount,
            manualRoomCount: TR13_EXPECTED_RECONCILIATION.manualRoomCount,
            allocationSurfacesMatchFormula: TR13_EXPECTED_RECONCILIATION.allocationSurfacesMatchFormula,
            mqiTotalCostMin: TR13_EXPECTED_RECONCILIATION.costAed.min,
            mqiTotalCostMax: TR13_EXPECTED_RECONCILIATION.costAed.max,
            mqiTotalCostMid: TR13_EXPECTED_RECONCILIATION.costAed.mid,
            storedReportContract: "stored_report",
          },
          security: {
            viewerWriteDenied: true,
            foreignTenantDenied: true,
            shareRevokedAndConcealed: true,
            shareTokenExcluded: true,
          },
          runtime: {
            realMySqlRouterPaths: true,
            nodeServerlessPublicShareHeaders: "separate guarded real-MySQL application-factory runtime matrix",
            liveAiGeneration: "Vitest-only mocked router path",
          },
          aiBoundary:
            "Vitest-only invokeLLM mocks; no live provider result certified",
        },
        null,
        2
      )}\n`
    );
  });
});
