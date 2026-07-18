import { eq, and, desc, asc, sql, inArray, gte, isNull, or } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { createHash } from "node:crypto";
import {
  InsertUser,
  users,
  organizationMembers,
  projects,
  directionCandidates,
  scoreMatrices,
  scenarios,
  modelVersions,
  benchmarkData,
  benchmarkVersions,
  benchmarkCategories,
  projectIntelligence,
  reportInstances,
  roiConfigs,
  webhookConfigs,
  auditLogs,
  overrideRecords,
  projectAssets,
  assetLinks,
  designBriefs,
  generatedVisuals,
  materialBoards,
  materialsCatalog,
  materialsToBoards,
  promptTemplates,
  comments,
  logicVersions,
  logicWeights,
  logicThresholds,
  logicChangeLog,
  scenarioInputs,
  scenarioOutputs,
  scenarioComparisons,
  projectOutcomes,
  outcomeComparisons,
  accuracySnapshots,
  decisionPatterns,
  benchmarkSuggestions,
  sourceRegistry,
  evidenceRecords,
  evidenceConfidenceAssessments,
  benchmarkProposals,
  benchmarkSnapshots,
  competitorEntities,
  competitorProjects,
  trendTags,
  entityTags,
  intelligenceAuditLog,
  evidenceReferences,
  ingestionRuns,
  connectorHealth,
  trendSnapshots,
  projectInsights,
  priceChangeEvents,
  platformAlerts,
  materialLibrary,
  finishScheduleItems,
  projectColorPalettes,
  rfqLineItems,
  dmComplianceChecklists,
  biasAlerts,
  biasProfiles,
  spaceRecommendations,
  designPackages,
  aiDesignBriefs,
  materialConstants,
  designTrends,
  dldProjects,
  dldTransactions,
  dldRents,
  dldAreaBenchmarks,
  pdfExtractions,
  materialAllocations,
  materialSupplierSources,
  spaceProgramRooms,
  amenitySubSpaces,
  monteCarloSimulations,
  scenarioStressTests,
  riskSurfaceMaps,
  projectRoiModels,
  digitalTwinModels,
  sustainabilitySnapshots,
  portfolios,
  portfolioProjects,
  portfolioAlerts,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: MySql2Database | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      console.log("[Database] Connecting to:", url.hostname, "database:", url.pathname.slice(1));
      const pool = mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: process.env.DATABASE_SSL_DISABLED === "1"
          ? undefined
          : { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
      });
      _db = drizzle(pool);
      console.log("[Database] Connected successfully");
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (!_db) {
    console.warn("[Database] getDb() returning null. DATABASE_URL set:", !!process.env.DATABASE_URL);
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser & { password?: string }): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: Record<string, unknown> = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.password !== undefined) {
    values.password = user.password;
    updateSet.password = user.password;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values as any).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  console.log("[Database] getUserByEmail called, db available:", !!db, "email:", email);
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  console.log("[Database] getUserByEmail query result count:", result.length);
  return result.length > 0 ? result[0] : undefined;
}

export async function emailExists(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(eq(users.email, email));
  return (result[0]?.count ?? 0) > 0;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(data: typeof projects.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projects).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function getProjectsByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.orgId, orgId)).orderBy(desc(projects.updatedAt));
}

export async function getOrganizationMemberships(userId: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select().from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.orgId, orgId),
    ))
    .limit(2);
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function updateProject(id: number, data: Partial<typeof projects.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function updateProjectForOrg(id: number, orgId: number, data: Partial<typeof projects.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
  return Number(result[0].affectedRows) === 1;
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projects).where(eq(projects.id, id));
}

export async function deleteProjectForOrg(id: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(projects)
    .where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
  return Number(result[0].affectedRows) === 1;
}

// ─── Direction Candidates ────────────────────────────────────────────────────

export async function createDirection(data: typeof directionCandidates.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(directionCandidates).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getDirectionsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(directionCandidates).where(eq(directionCandidates.projectId, projectId));
}

export async function deleteDirection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(directionCandidates).where(eq(directionCandidates.id, id));
}

// ─── Score Matrices ──────────────────────────────────────────────────────────

export async function createScoreMatrix(data: typeof scoreMatrices.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scoreMatrices).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getScoreMatricesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scoreMatrices).where(eq(scoreMatrices.projectId, projectId)).orderBy(desc(scoreMatrices.computedAt));
}

export async function getScoreMatrixById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scoreMatrices).where(eq(scoreMatrices.id, id)).limit(1);
  return result[0];
}

export async function getAllScoreMatrices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scoreMatrices).orderBy(desc(scoreMatrices.computedAt));
}

export async function getComparableScoreMatricesForOrg(orgId: number, excludeProjectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(projects.orgId, orgId)];
  if (excludeProjectId !== undefined) conditions.push(sql`${scoreMatrices.projectId} <> ${excludeProjectId}`);
  return db.select({ scoreMatrix: scoreMatrices, project: projects })
    .from(scoreMatrices)
    .innerJoin(projects, eq(scoreMatrices.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(scoreMatrices.computedAt));
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

export async function createScenarioRecord(data: typeof scenarios.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scenarios).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createScenarioRecordForOrg(
  data: typeof scenarios.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return null;
    const result = await tx.insert(scenarios).values({ ...data, orgId });
    return { id: Number(result[0].insertId) };
  });
}

export async function getScenariosByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scenarios).where(eq(scenarios.projectId, projectId));
}

export async function getScenarioById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1);
  return rows[0];
}

export async function deleteScenario(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(scenarios).where(eq(scenarios.id, id));
}

export async function deleteScenarioForOrg(id: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(scenarios)
    .where(and(eq(scenarios.id, id), eq(scenarios.orgId, orgId)));
  return Number(result[0].affectedRows) === 1;
}

export async function getMonteCarloSimulationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(monteCarloSimulations)
    .where(eq(monteCarloSimulations.id, id))
    .limit(1);
  return rows[0];
}

export async function createScenarioStressTestForOrg(
  data: typeof scenarioStressTests.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const scenario = await tx.select({ id: scenarios.id })
      .from(scenarios)
      .innerJoin(projects, eq(scenarios.projectId, projects.id))
      .where(and(
        eq(scenarios.id, data.scenarioId),
        eq(projects.orgId, orgId)
      ))
      .limit(1)
      .for("update");
    if (scenario.length !== 1) return false;
    await tx.insert(scenarioStressTests).values(data);
    return true;
  });
}

export async function createProjectRoiModelForOrg(
  data: typeof projectRoiModels.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return false;
    if (data.scenarioId !== null && data.scenarioId !== undefined) {
      const scenario = await tx.select({ id: scenarios.id })
        .from(scenarios)
        .where(and(
          eq(scenarios.id, data.scenarioId),
          eq(scenarios.projectId, data.projectId),
          eq(scenarios.orgId, orgId)
        ))
        .limit(1)
        .for("update");
      if (scenario.length !== 1) return false;
    }
    await tx.insert(projectRoiModels).values(data);
    return true;
  });
}

export async function createRiskSurfaceMapsForOrg(
  data: (typeof riskSurfaceMaps.$inferInsert)[],
  orgId: number
) {
  if (data.length === 0) return true;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const projectId = data[0].projectId;
  if (data.some(row => row.projectId !== projectId)) return false;
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return false;
    await tx.insert(riskSurfaceMaps).values(data);
    return true;
  });
}

export async function createMonteCarloSimulationForOrg(
  data: typeof monteCarloSimulations.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return false;
    await tx.insert(monteCarloSimulations).values({ ...data, orgId });
    return true;
  });
}

export async function createDigitalTwinForOrg(
  model: typeof digitalTwinModels.$inferInsert,
  snapshot: typeof sustainabilitySnapshots.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, model.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1 || snapshot.projectId !== model.projectId) {
      return false;
    }
    await tx.insert(digitalTwinModels).values({ ...model, orgId });
    await tx.insert(sustainabilitySnapshots).values(snapshot);
    return true;
  });
}

// ─── Model Versions ──────────────────────────────────────────────────────────

export async function getActiveModelVersion() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(modelVersions).where(eq(modelVersions.isActive, true)).limit(1);
  return result[0];
}

export async function getAllModelVersions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelVersions).orderBy(desc(modelVersions.createdAt));
}

export async function createModelVersion(data: typeof modelVersions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(modelVersions).set({ isActive: false }).where(eq(modelVersions.isActive, true));
  const result = await db.insert(modelVersions).values({ ...data, isActive: true });
  return { id: Number(result[0].insertId) };
}

// ─── Benchmark Data ──────────────────────────────────────────────────────────

export async function getBenchmarks(typology?: string, location?: string, marketTier?: string) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(benchmarkData);
  const conditions = [];
  if (typology) conditions.push(eq(benchmarkData.typology, typology));
  if (location) conditions.push(eq(benchmarkData.location, location));
  if (marketTier) conditions.push(eq(benchmarkData.marketTier, marketTier));
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return query;
}

export async function getExpectedCost(typology: string, location: string, marketTier: string): Promise<number> {
  const benchmarks = await getBenchmarks(typology, location, marketTier);
  if (benchmarks.length === 0) return 400 * 10.7639; // Convert default to sqm
  const avgSqft = benchmarks.reduce((sum: number, b: any) => sum + Number(b.costPerSqftMid ?? 400), 0) / benchmarks.length;
  return avgSqft * 10.7639; // Convert to AED/sqm
}

export async function createBenchmark(data: typeof benchmarkData.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(benchmarkData).values(data);
  return { id: Number(result[0].insertId) };
}

export async function deleteBenchmark(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(benchmarkData).where(eq(benchmarkData.id, id));
}

export async function getAllBenchmarkData() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkData).orderBy(desc(benchmarkData.updatedAt));
}

// ─── Benchmark Versions (V2) ────────────────────────────────────────────────

export async function getAllBenchmarkVersions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkVersions).orderBy(desc(benchmarkVersions.createdAt));
}

export async function getActiveBenchmarkVersion() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(benchmarkVersions)
    .where(eq(benchmarkVersions.status, "published"))
    .orderBy(desc(benchmarkVersions.publishedAt))
    .limit(1);
  return result[0];
}

export async function getBenchmarkVersionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(benchmarkVersions).where(eq(benchmarkVersions.id, id)).limit(1);
  return result[0];
}

export async function createBenchmarkVersion(data: typeof benchmarkVersions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(benchmarkVersions).values(data);
  return { id: Number(result[0].insertId) };
}

export async function publishBenchmarkVersion(id: number, publishedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Archive all currently published
  await db.update(benchmarkVersions).set({ status: "archived" }).where(eq(benchmarkVersions.status, "published"));
  // Publish this one
  const count = await db.select({ count: sql<number>`COUNT(*)` }).from(benchmarkData).where(eq(benchmarkData.benchmarkVersionId, id));
  await db.update(benchmarkVersions).set({
    status: "published",
    publishedAt: new Date(),
    publishedBy,
    recordCount: count[0]?.count ?? 0,
  }).where(eq(benchmarkVersions.id, id));
}

export async function getBenchmarkDiff(oldVersionId: number, newVersionId: number) {
  const db = await getDb();
  if (!db) return { added: 0, removed: 0, changed: 0 };
  const oldData = await db.select().from(benchmarkData).where(eq(benchmarkData.benchmarkVersionId, oldVersionId));
  const newData = await db.select().from(benchmarkData).where(eq(benchmarkData.benchmarkVersionId, newVersionId));
  const oldKeys = new Set(oldData.map((d: any) => `${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`));
  const newKeys = new Set(newData.map((d: any) => `${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`));
  let added = 0, removed = 0, changed = 0;
  newKeys.forEach(k => { if (!oldKeys.has(k)) added++; });
  oldKeys.forEach(k => { if (!newKeys.has(k)) removed++; });
  // For shared keys, compare cost mid values
  const oldMap = new Map<string, any>(oldData.map((d: any) => [`${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`, d]));
  const newMap = new Map<string, any>(newData.map((d: any) => [`${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`, d]));
  oldKeys.forEach(k => {
    if (newKeys.has(k)) {
      const o: any = oldMap.get(k as string);
      const n: any = newMap.get(k as string);
      if (o && n && Number(o.costPerSqftMid) !== Number(n.costPerSqftMid)) changed++;
    }
  });
  return { added, removed, changed };
}

// ─── Benchmark Categories (V2) ──────────────────────────────────────────────

export async function getAllBenchmarkCategories(category?: string, projectClass?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (category) conditions.push(eq(benchmarkCategories.category, category as any));
  if (projectClass) conditions.push(eq(benchmarkCategories.projectClass, projectClass as any));
  let query = db.select().from(benchmarkCategories);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return query.orderBy(desc(benchmarkCategories.createdAt));
}

export async function createBenchmarkCategory(data: typeof benchmarkCategories.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(benchmarkCategories).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateBenchmarkCategory(id: number, data: Partial<typeof benchmarkCategories.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(benchmarkCategories).set(data).where(eq(benchmarkCategories.id, id));
}

export async function deleteBenchmarkCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(benchmarkCategories).where(eq(benchmarkCategories.id, id));
}

// ─── Project Intelligence Warehouse (V2) ────────────────────────────────────

export async function createProjectIntelligence(data: typeof projectIntelligence.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projectIntelligence).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getProjectIntelligenceByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectIntelligence)
    .where(eq(projectIntelligence.projectId, projectId))
    .orderBy(desc(projectIntelligence.computedAt));
}

export async function getAllProjectIntelligence() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectIntelligence).orderBy(desc(projectIntelligence.computedAt));
}

// ─── ROI Configurations (V2) ────────────────────────────────────────────────

export async function getActiveRoiConfig() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(roiConfigs).where(eq(roiConfigs.isActive, true)).limit(1);
  return result[0];
}

export async function getAllRoiConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roiConfigs).orderBy(desc(roiConfigs.createdAt));
}

export async function createRoiConfig(data: typeof roiConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Deactivate all existing
  await db.update(roiConfigs).set({ isActive: false }).where(eq(roiConfigs.isActive, true));
  const result = await db.insert(roiConfigs).values({ ...data, isActive: true });
  return { id: Number(result[0].insertId) };
}

export async function updateRoiConfig(id: number, data: Partial<typeof roiConfigs.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(roiConfigs).set(data).where(eq(roiConfigs.id, id));
}

// ─── Webhook Configurations (V2) ────────────────────────────────────────────

export async function getAllWebhookConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookConfigs).orderBy(desc(webhookConfigs.createdAt));
}

export async function getActiveWebhookConfigs(event?: string) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(webhookConfigs).where(eq(webhookConfigs.isActive, true));
  if (!event) return all;
  return all.filter((w: any) => {
    const events = w.events as string[];
    return events && events.includes(event);
  });
}

export async function createWebhookConfig(data: typeof webhookConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(webhookConfigs).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateWebhookConfig(id: number, data: Partial<typeof webhookConfigs.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(webhookConfigs).set(data).where(eq(webhookConfigs.id, id));
}

export async function deleteWebhookConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(webhookConfigs).where(eq(webhookConfigs.id, id));
}

// ─── Report Instances ────────────────────────────────────────────────────────

export async function createReportInstance(data: typeof reportInstances.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(reportInstances).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createReportArtifactsForOrg(input: {
  projectId: number;
  orgId: number;
  report: typeof reportInstances.$inferInsert;
  designArtifacts?: {
    finishSchedule: (typeof finishScheduleItems.$inferInsert)[];
    colorPalette: typeof projectColorPalettes.$inferInsert;
    complianceChecklist: typeof dmComplianceChecklists.$inferInsert;
    brief: typeof designBriefs.$inferInsert;
    rfqItems: (typeof rfqLineItems.$inferInsert)[];
  };
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const owned = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(
        eq(projects.id, input.projectId),
        eq(projects.orgId, input.orgId)
      ))
      .limit(1)
      .for("update");
    if (owned.length !== 1 || input.report.projectId !== input.projectId) {
      return null;
    }
    const score = await tx.select({ id: scoreMatrices.id })
      .from(scoreMatrices)
      .where(and(
        eq(scoreMatrices.id, input.report.scoreMatrixId),
        eq(scoreMatrices.projectId, input.projectId)
      ))
      .limit(1)
      .for("update");
    if (score.length !== 1) return null;

    let briefId: number | null = null;
    const artifacts = input.designArtifacts;
    if (artifacts) {
      const rowsMatch = artifacts.finishSchedule.every(row =>
        row.projectId === input.projectId &&
        row.organizationId === input.orgId
      ) &&
        artifacts.colorPalette.projectId === input.projectId &&
        artifacts.colorPalette.organizationId === input.orgId &&
        artifacts.complianceChecklist.projectId === input.projectId &&
        artifacts.complianceChecklist.organizationId === input.orgId &&
        artifacts.brief.projectId === input.projectId &&
        artifacts.rfqItems.every(row =>
          row.projectId === input.projectId &&
          row.organizationId === input.orgId
        );
      if (!rowsMatch) return null;

      if (artifacts.finishSchedule.length > 0) {
        await tx.insert(finishScheduleItems).values(artifacts.finishSchedule);
      }
      await tx.insert(projectColorPalettes).values(artifacts.colorPalette);
      await tx.insert(dmComplianceChecklists).values(artifacts.complianceChecklist);
      const briefResult = await tx.insert(designBriefs).values(artifacts.brief);
      briefId = Number(briefResult[0].insertId);
      if (artifacts.rfqItems.length > 0) {
        await tx.insert(rfqLineItems).values(
          artifacts.rfqItems.map(row => ({ ...row, briefId }))
        );
      }
    }

    const reportResult = await tx.insert(reportInstances).values(input.report);
    return {
      reportId: Number(reportResult[0].insertId),
      briefId,
    };
  });
}

export async function getReportsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportInstances).where(eq(reportInstances.projectId, projectId)).orderBy(desc(reportInstances.generatedAt));
}

export async function getAllReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportInstances).orderBy(desc(reportInstances.generatedAt));
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(reportInstances).where(eq(reportInstances.id, id)).limit(1);
  return rows[0];
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export async function createAuditLog(data: typeof auditLogs.$inferInsert) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values(data);
  } catch (error) {
    console.error("[AuditLog] Failed to insert audit log:", error);
    // Silent fail - audit logging should never crash the main application flow
  }
}

export async function getAuditLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({
    log: auditLogs,
    user: {
      email: users.email,
      name: users.name,
    }
  })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return results.map((r: any) => ({ ...r.log, user: r.user }));
}

// ─── Override Records ────────────────────────────────────────────────────────

export async function createOverrideRecord(data: typeof overrideRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(overrideRecords).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createOverrideRecordForOrg(
  data: typeof overrideRecords.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return null;
    const result = await tx.insert(overrideRecords).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getOverridesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(overrideRecords).where(eq(overrideRecords.projectId, projectId)).orderBy(desc(overrideRecords.createdAt));
}

// ─── Project Assets (V2.8 — Evidence Vault) ─────────────────────────────────

export async function createProjectAsset(data: typeof projectAssets.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projectAssets).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createProjectAssetForOrg(data: typeof projectAssets.$inferInsert, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!owned[0]) return null;
    const result = await tx.insert(projectAssets).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getProjectAssets(projectId: number, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(projectAssets.projectId, projectId)];
  if (category) conditions.push(eq(projectAssets.category, category as any));
  return db.select().from(projectAssets).where(and(...conditions)).orderBy(desc(projectAssets.uploadedAt));
}

export async function getProjectAssetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projectAssets).where(eq(projectAssets.id, id));
  return result[0];
}

export async function deleteProjectAsset(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projectAssets).where(eq(projectAssets.id, id));
}

export async function deleteProjectAssetForOrg(id: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(projectAssets).where(and(
    eq(projectAssets.id, id),
    sql`exists (
      select 1 from ${projects}
      where ${projects.id} = ${projectAssets.projectId}
        and ${projects.orgId} = ${orgId}
    )`
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function updateProjectAsset(id: number, data: Partial<typeof projectAssets.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projectAssets).set(data).where(eq(projectAssets.id, id));
}

export async function updateProjectAssetForOrg(id: number, orgId: number, data: Partial<typeof projectAssets.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(projectAssets).set(data).where(and(
    eq(projectAssets.id, id),
    sql`exists (
      select 1 from ${projects}
      where ${projects.id} = ${projectAssets.projectId}
        and ${projects.orgId} = ${orgId}
    )`
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function linkProjectAssetsForOrg(
  assetIds: readonly number[],
  projectId: number,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const uniqueAssetIds = Array.from(new Set(assetIds));
  if (uniqueAssetIds.length === 0) return true;
  return db.transaction(async (tx: any) => {
    const target = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (target.length !== 1) return false;

    const authorizedAssets = await tx.select({ id: projectAssets.id })
      .from(projectAssets)
      .innerJoin(projects, eq(projectAssets.projectId, projects.id))
      .where(and(
        inArray(projectAssets.id, uniqueAssetIds),
        eq(projects.orgId, orgId)
      ))
      .for("update");
    if (authorizedAssets.length !== uniqueAssetIds.length) return false;

    const result = await tx.update(projectAssets)
      .set({ projectId })
      .where(inArray(projectAssets.id, uniqueAssetIds));
    return Number(result[0].affectedRows) === uniqueAssetIds.length;
  });
}

// ─── Asset Links (V2.8) ─────────────────────────────────────────────────────

type AssetLinkType = (typeof assetLinks.$inferInsert)["linkType"];
type AssetLinkTargetResolver = (
  tx: any,
  id: number,
  orgId: number
) => Promise<Array<{ projectId: number }>>;

const assetLinkTargetResolvers = {
  evaluation: (tx, id, orgId) =>
    tx.select({ projectId: scoreMatrices.projectId }).from(scoreMatrices)
      .innerJoin(projects, eq(projects.id, scoreMatrices.projectId))
      .where(and(eq(scoreMatrices.id, id), eq(projects.orgId, orgId)))
      .limit(1).for("update"),
  report: (tx, id, orgId) =>
    tx.select({ projectId: reportInstances.projectId }).from(reportInstances)
      .innerJoin(projects, eq(projects.id, reportInstances.projectId))
      .where(and(eq(reportInstances.id, id), eq(projects.orgId, orgId)))
      .limit(1).for("update"),
  scenario: (tx, id, orgId) =>
    tx.select({ projectId: scenarios.projectId }).from(scenarios)
      .innerJoin(projects, eq(projects.id, scenarios.projectId))
      .where(and(
        eq(scenarios.id, id),
        eq(scenarios.orgId, orgId),
        eq(projects.orgId, orgId)
      ))
      .limit(1).for("update"),
  material_board: (tx, id, orgId) =>
    tx.select({ projectId: materialBoards.projectId }).from(materialBoards)
      .innerJoin(projects, eq(projects.id, materialBoards.projectId))
      .where(and(eq(materialBoards.id, id), eq(projects.orgId, orgId)))
      .limit(1).for("update"),
  design_brief: (tx, id, orgId) =>
    tx.select({ projectId: designBriefs.projectId }).from(designBriefs)
      .innerJoin(projects, eq(projects.id, designBriefs.projectId))
      .where(and(eq(designBriefs.id, id), eq(projects.orgId, orgId)))
      .limit(1).for("update"),
  visual: (tx, id, orgId) =>
    tx.select({ projectId: generatedVisuals.projectId }).from(generatedVisuals)
      .innerJoin(projects, eq(projects.id, generatedVisuals.projectId))
      .where(and(eq(generatedVisuals.id, id), eq(projects.orgId, orgId)))
      .limit(1).for("update"),
} satisfies Record<AssetLinkType, AssetLinkTargetResolver>;

export async function createAssetLinkForOrg(data: typeof assetLinks.$inferInsert, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const source = await tx.select({ projectId: projectAssets.projectId }).from(projectAssets)
      .innerJoin(projects, eq(projects.id, projectAssets.projectId))
      .where(and(eq(projectAssets.id, data.assetId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!source[0]) return null;

    const target = await assetLinkTargetResolvers[data.linkType](
      tx,
      data.linkId,
      orgId
    );
    if (!target[0] || target[0].projectId !== source[0].projectId) return null;
    const result = await tx.insert(assetLinks).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getAssetLinksByAsset(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetLinks).where(eq(assetLinks.assetId, assetId));
}

export async function getAssetLinkById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(assetLinks).where(eq(assetLinks.id, id)).limit(1);
  return rows[0];
}

export async function getAssetLinksByEntity(linkType: string, linkId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetLinks).where(
    and(eq(assetLinks.linkType, linkType as any), eq(assetLinks.linkId, linkId))
  );
}

export async function deleteAssetLinkForOrg(id: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const links = await tx.select({
      id: assetLinks.id,
      linkType: assetLinks.linkType,
      linkId: assetLinks.linkId,
      projectId: projectAssets.projectId,
    }).from(assetLinks)
      .innerJoin(projectAssets, eq(projectAssets.id, assetLinks.assetId))
      .innerJoin(projects, eq(projects.id, projectAssets.projectId))
      .where(and(eq(assetLinks.id, id), eq(projects.orgId, orgId))).limit(1).for("update");
    const link = links[0];
    if (!link) return false;

    const linkType = link.linkType as AssetLinkType;
    const target = await assetLinkTargetResolvers[linkType](
      tx,
      link.linkId,
      orgId
    );
    if (!target[0] || target[0].projectId !== link.projectId) return false;
    const result = await tx.delete(assetLinks).where(eq(assetLinks.id, id));
    return Number(result[0].affectedRows) === 1;
  });
}

// ─── Design Briefs (V2.8) ───────────────────────────────────────────────────

export async function createDesignBrief(data: typeof designBriefs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(designBriefs).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createDesignBriefForOrg(data: typeof designBriefs.$inferInsert, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!owned[0]) return null;
    if (data.scenarioId !== null && data.scenarioId !== undefined) {
      const scenario = await tx.select({ projectId: scenarios.projectId }).from(scenarios)
        .where(and(eq(scenarios.id, data.scenarioId), eq(scenarios.orgId, orgId))).limit(1).for("update");
      if (!scenario[0] || scenario[0].projectId !== data.projectId) return null;
    }
    const result = await tx.insert(designBriefs).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getDesignBriefsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(designBriefs).where(eq(designBriefs.projectId, projectId)).orderBy(desc(designBriefs.createdAt));
}

export async function getDesignBriefById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(designBriefs).where(eq(designBriefs.id, id));
  return result[0];
}

export async function getLatestDesignBrief(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(designBriefs)
    .where(eq(designBriefs.projectId, projectId))
    .orderBy(desc(designBriefs.version))
    .limit(1);
  return result[0];
}

// ─── Generated Visuals (V2.8) ───────────────────────────────────────────────

export async function createGeneratedVisual(data: typeof generatedVisuals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(generatedVisuals).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createGeneratedVisualForOrg(data: typeof generatedVisuals.$inferInsert, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!owned[0]) return null;
    if (data.scenarioId !== null && data.scenarioId !== undefined) {
      const scenario = await tx.select({ projectId: scenarios.projectId }).from(scenarios)
        .where(and(eq(scenarios.id, data.scenarioId), eq(scenarios.orgId, orgId))).limit(1).for("update");
      if (!scenario[0] || scenario[0].projectId !== data.projectId) return null;
    }
    const result = await tx.insert(generatedVisuals).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getGeneratedVisualsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedVisuals).where(eq(generatedVisuals.projectId, projectId)).orderBy(desc(generatedVisuals.createdAt));
}

export async function updateGeneratedVisual(id: number, data: Partial<typeof generatedVisuals.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(generatedVisuals).set(data).where(eq(generatedVisuals.id, id));
}

export async function updateGeneratedVisualForOrg(id: number, orgId: number, data: Partial<typeof generatedVisuals.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(generatedVisuals).set(data).where(and(
    eq(generatedVisuals.id, id),
    sql`exists (
      select 1 from ${projects}
      where ${projects.id} = ${generatedVisuals.projectId}
        and ${projects.orgId} = ${orgId}
    )`
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function getGeneratedVisualById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(generatedVisuals).where(eq(generatedVisuals.id, id));
  return result[0];
}

// ─── Material Boards (V2.8) ─────────────────────────────────────────────────

export async function createMaterialBoard(data: typeof materialBoards.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(materialBoards).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createMaterialBoardForOrg(data: typeof materialBoards.$inferInsert, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!owned[0]) return null;
    if (data.scenarioId !== null && data.scenarioId !== undefined) {
      const scenario = await tx.select({ projectId: scenarios.projectId }).from(scenarios)
        .where(and(eq(scenarios.id, data.scenarioId), eq(scenarios.orgId, orgId))).limit(1).for("update");
      if (!scenario[0] || scenario[0].projectId !== data.projectId) return null;
    }
    const result = await tx.insert(materialBoards).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getMaterialBoardsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialBoards).where(eq(materialBoards.projectId, projectId)).orderBy(desc(materialBoards.createdAt));
}

/**
 * One organization-scoped, throwing snapshot for issued report annexes and
 * board-cost enrichment. Left joins intentionally preserve empty boards and
 * missing catalog rows; boardJson is never consulted.
 */
export async function getReportBoardSnapshotForOrg(projectId: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("REPORT_BOARD_RETRIEVAL_FAILED");

  const rows = await db.select({
    boardId: materialBoards.id,
    boardName: materialBoards.boardName,
    boardCreatedAt: materialBoards.createdAt,
    linkId: materialsToBoards.id,
    materialId: materialsCatalog.id,
    name: materialsCatalog.name,
    category: materialsCatalog.category,
    tier: materialsCatalog.tier,
    costLow: materialsCatalog.typicalCostLow,
    costHigh: materialsCatalog.typicalCostHigh,
    costUnit: materialsCatalog.costUnit,
    leadTimeDays: materialsCatalog.leadTimeDays,
    leadTimeBand: materialsCatalog.leadTimeBand,
    supplierName: materialsCatalog.supplierName,
    maintenanceFactor: materialsCatalog.maintenanceFactor,
    quantity: materialsToBoards.quantity,
    unitOfMeasure: materialsToBoards.unitOfMeasure,
    notes: materialsToBoards.notes,
    sortOrder: materialsToBoards.sortOrder,
  })
    .from(materialBoards)
    .innerJoin(projects, eq(projects.id, materialBoards.projectId))
    .leftJoin(materialsToBoards, eq(materialsToBoards.boardId, materialBoards.id))
    .leftJoin(materialsCatalog, eq(materialsCatalog.id, materialsToBoards.materialId))
    .where(and(eq(materialBoards.projectId, projectId), eq(projects.orgId, orgId)))
    .orderBy(
      desc(materialBoards.createdAt),
      desc(materialBoards.id),
      asc(materialsToBoards.sortOrder),
      asc(materialsToBoards.id)
    );

  const boards = new Map<number, {
    boardId: number;
    boardName: string;
    linkedItemCount: number;
    resolvedItems: Array<{
      materialId: number;
      name: string;
      category: string;
      tier: string;
      costLow: number;
      costHigh: number;
      costUnit: string;
      leadTimeDays: number;
      leadTimeBand: string;
      supplierName: string;
      quantity?: number;
      unitOfMeasure?: string;
      notes?: string;
      maintenanceFactor?: number;
    }>;
  }>();

  for (const row of rows) {
    let board = boards.get(row.boardId);
    if (!board) {
      board = {
        boardId: row.boardId,
        boardName: row.boardName,
        linkedItemCount: 0,
        resolvedItems: [],
      };
      boards.set(row.boardId, board);
    }
    if (row.linkId == null) continue;
    board.linkedItemCount += 1;
    if (row.materialId == null || row.name == null || row.category == null || row.tier == null) continue;
    board.resolvedItems.push({
      materialId: row.materialId,
      name: row.name,
      category: row.category,
      tier: row.tier,
      costLow: Number(row.costLow) || 0,
      costHigh: Number(row.costHigh) || 0,
      costUnit: row.costUnit || "AED/unit",
      leadTimeDays: row.leadTimeDays || 30,
      leadTimeBand: row.leadTimeBand || "medium",
      supplierName: row.supplierName || "TBD",
      quantity: row.quantity == null ? undefined : Number(row.quantity),
      unitOfMeasure: row.unitOfMeasure || undefined,
      notes: row.notes || undefined,
      maintenanceFactor: row.maintenanceFactor == null ? undefined : Number(row.maintenanceFactor),
    });
  }

  return Array.from(boards.values());
}

export async function getMaterialBoardById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(materialBoards).where(eq(materialBoards.id, id));
  return result[0];
}

export async function updateMaterialBoard(id: number, data: Partial<typeof materialBoards.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(materialBoards).set(data).where(eq(materialBoards.id, id));
}

export async function deleteMaterialBoard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(materialsToBoards).where(eq(materialsToBoards.boardId, id));
  await db.delete(materialBoards).where(eq(materialBoards.id, id));
}

export async function deleteMaterialBoardForOrg(id: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const boardRows = await tx.select({ id: materialBoards.id }).from(materialBoards)
      .innerJoin(projects, eq(projects.id, materialBoards.projectId))
      .where(and(eq(materialBoards.id, id), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!boardRows[0]) return false;
    await tx.delete(materialsToBoards).where(eq(materialsToBoards.boardId, id));
    const result = await tx.delete(materialBoards).where(and(
      eq(materialBoards.id, id),
      sql`exists (
        select 1 from ${projects}
        where ${projects.id} = ${materialBoards.projectId}
        and ${projects.orgId} = ${orgId}
      )`
    ));
    if (Number(result[0].affectedRows) !== 1) {
      throw new Error("Material board deletion lost authorization");
    }
    return true;
  });
}

export async function createMaterialBoardWithMaterialsForOrg(
  data: Omit<typeof materialBoards.$inferInsert, "boardJson">,
  materialIds: number[],
  orgId: number
) {
  if (new Set(materialIds).size !== materialIds.length) return null;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (!owned[0]) return null;

    if (data.scenarioId !== null && data.scenarioId !== undefined) {
      const scenario = await tx.select({ projectId: scenarios.projectId }).from(scenarios)
        .where(and(
          eq(scenarios.id, data.scenarioId),
          eq(scenarios.orgId, orgId),
        ))
        .limit(1)
        .for("update");
      if (!scenario[0] || scenario[0].projectId !== data.projectId) return null;
    }

    let orderedMaterials: Array<typeof materialsCatalog.$inferSelect> = [];
    if (materialIds.length > 0) {
      const rows = await tx.select().from(materialsCatalog)
        .where(and(
          inArray(materialsCatalog.id, materialIds),
          eq(materialsCatalog.isActive, true),
        ))
        .for("update");
      const materialsById = new Map(rows.map((material: typeof materialsCatalog.$inferSelect) => [
        material.id,
        material,
      ]));
      orderedMaterials = materialIds
        .map(materialId => materialsById.get(materialId))
        .filter((material): material is typeof materialsCatalog.$inferSelect => Boolean(material));
      if (orderedMaterials.length !== materialIds.length) return null;
    }

    const boardResult = await tx.insert(materialBoards).values({
      ...data,
      boardJson: orderedMaterials,
    });
    const boardId = Number(boardResult[0].insertId);
    if (materialIds.length > 0) {
      await tx.insert(materialsToBoards).values(
        materialIds.map((materialId, sortOrder) => ({
          boardId,
          materialId,
          sortOrder,
        }))
      );
    }
    return { id: boardId };
  });
}

// ─── Materials Catalog (V2.8) ───────────────────────────────────────────────

export async function getAllMaterials(category?: string, tier?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(materialsCatalog.isActive, true)];
  if (category) conditions.push(eq(materialsCatalog.category, category as any));
  if (tier) conditions.push(eq(materialsCatalog.tier, tier as any));
  return db.select().from(materialsCatalog).where(and(...conditions)).orderBy(materialsCatalog.name);
}

export async function getMaterialById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(materialsCatalog).where(eq(materialsCatalog.id, id));
  return result[0];
}

export async function createMaterial(data: typeof materialsCatalog.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(materialsCatalog).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateMaterial(id: number, data: Partial<typeof materialsCatalog.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(materialsCatalog).set(data).where(eq(materialsCatalog.id, id));
}

export async function deleteMaterial(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(materialsCatalog).set({ isActive: false }).where(eq(materialsCatalog.id, id));
}

// ─── Materials to Boards (V2.8) ─────────────────────────────────────────────

export async function addMaterialToBoard(data: typeof materialsToBoards.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(materialsToBoards).values(data);
  return { id: Number(result[0].insertId) };
}

export async function addMaterialToBoardForOrg(data: typeof materialsToBoards.$inferInsert, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: materialBoards.id }).from(materialBoards)
      .innerJoin(projects, eq(projects.id, materialBoards.projectId))
      .where(and(eq(materialBoards.id, data.boardId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!owned[0]) return null;
    const material = await tx.select({ id: materialsCatalog.id }).from(materialsCatalog)
      .where(and(
        eq(materialsCatalog.id, data.materialId),
        eq(materialsCatalog.isActive, true),
      ))
      .limit(1)
      .for("update");
    if (!material[0]) return null;
    const result = await tx.insert(materialsToBoards).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getMaterialsByBoard(boardId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialsToBoards).where(eq(materialsToBoards.boardId, boardId)).orderBy(materialsToBoards.sortOrder);
}

export async function getMaterialToBoardById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(materialsToBoards).where(eq(materialsToBoards.id, id)).limit(1);
  return rows[0];
}

export async function removeMaterialFromBoard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(materialsToBoards).where(eq(materialsToBoards.id, id));
}

export async function removeMaterialFromBoardForOrg(id: number, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(materialsToBoards).where(and(
    eq(materialsToBoards.id, id),
    sql`exists (
      select 1
      from ${materialBoards}
      inner join ${projects} on ${projects.id} = ${materialBoards.projectId}
      where ${materialBoards.id} = ${materialsToBoards.boardId}
        and ${projects.orgId} = ${orgId}
    )`
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function updateBoardTile(id: number, data: { specNotes?: string | null; costBandOverride?: string | null; quantity?: string | null; unitOfMeasure?: string | null; notes?: string | null; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates: any = {};
  if (data.specNotes !== undefined) updates.specNotes = data.specNotes;
  if (data.costBandOverride !== undefined) updates.costBandOverride = data.costBandOverride;
  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.unitOfMeasure !== undefined) updates.unitOfMeasure = data.unitOfMeasure;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (Object.keys(updates).length > 0) {
    await db.update(materialsToBoards).set(updates).where(eq(materialsToBoards.id, id));
  }
}

export async function updateBoardTileForOrg(id: number, orgId: number, data: { specNotes?: string | null; costBandOverride?: string | null; quantity?: string | null; unitOfMeasure?: string | null; notes?: string | null; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  if (Object.keys(updates).length === 0) return true;
  const result = await db.update(materialsToBoards).set(updates).where(and(
    eq(materialsToBoards.id, id),
    sql`exists (
      select 1
      from ${materialBoards}
      inner join ${projects} on ${projects.id} = ${materialBoards.projectId}
      where ${materialBoards.id} = ${materialsToBoards.boardId}
        and ${projects.orgId} = ${orgId}
    )`
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function reorderBoardTiles(boardId: number, orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(materialsToBoards).set({ sortOrder: i }).where(eq(materialsToBoards.id, orderedIds[i]));
  }
}

export async function reorderBoardTilesForOrg(boardId: number, orderedIds: number[], orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const boardRows = await tx.select({ id: materialBoards.id }).from(materialBoards)
      .innerJoin(projects, eq(projects.id, materialBoards.projectId))
      .where(and(eq(materialBoards.id, boardId), eq(projects.orgId, orgId))).limit(1);
    if (!boardRows[0]) return false;
    if (orderedIds.length > 0) {
      const joins = await tx.select({ id: materialsToBoards.id }).from(materialsToBoards)
        .where(and(eq(materialsToBoards.boardId, boardId), inArray(materialsToBoards.id, orderedIds)));
      if (joins.length !== orderedIds.length) return false;
    }
    for (let i = 0; i < orderedIds.length; i++) {
      const result = await tx.update(materialsToBoards).set({ sortOrder: i }).where(and(
        eq(materialsToBoards.id, orderedIds[i]),
        eq(materialsToBoards.boardId, boardId),
        sql`exists (
          select 1
          from ${materialBoards}
          inner join ${projects} on ${projects.id} = ${materialBoards.projectId}
          where ${materialBoards.id} = ${materialsToBoards.boardId}
            and ${projects.orgId} = ${orgId}
        )`
      ));
      if (Number(result[0].affectedRows) !== 1) throw new Error("Board tile reorder lost authorization");
    }
    return true;
  });
}

// ─── Prompt Templates (V2.8) ────────────────────────────────────────────────

export async function getAllPromptTemplates(type?: string, orgId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (type) conditions.push(eq(promptTemplates.type, type as any));
  if (orgId) conditions.push(eq(promptTemplates.orgId, orgId));

  let query = db.select().from(promptTemplates);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return query.orderBy(desc(promptTemplates.createdAt));
}

export async function getPromptTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(promptTemplates).where(eq(promptTemplates.id, id)).limit(1);
  return rows[0];
}

export async function getActivePromptTemplate(type: string, orgId?: number) {
  const db = await getDb();
  if (!db) return undefined;

  const conditions = [eq(promptTemplates.type, type as any), eq(promptTemplates.isActive, true)];
  if (orgId) conditions.push(eq(promptTemplates.orgId, orgId));

  let query = db.select().from(promptTemplates).where(and(...conditions)).limit(1);
  const result = await query;
  return result[0];
}

export async function createPromptTemplate(data: typeof promptTemplates.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(promptTemplates).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updatePromptTemplate(id: number, data: Partial<typeof promptTemplates.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(promptTemplates).set(data).where(eq(promptTemplates.id, id));
}

// ─── Comments (V2.8 — Collaboration) ────────────────────────────────────────

export async function createComment(data: typeof comments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(comments).values(data);
  return { id: Number(result[0].insertId) };
}

export async function createCommentForOrg(data: typeof comments.$inferInsert, orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!owned[0]) return null;
    if (data.entityType === "general") {
      if (data.entityId !== null && data.entityId !== undefined) return null;
    } else {
      if (data.entityId === null || data.entityId === undefined) return null;
      let target: Array<{ projectId: number }> = [];
      if (data.entityType === "design_brief") {
        target = await tx.select({ projectId: designBriefs.projectId }).from(designBriefs)
          .where(eq(designBriefs.id, data.entityId)).limit(1).for("update");
      } else if (data.entityType === "material_board") {
        target = await tx.select({ projectId: materialBoards.projectId }).from(materialBoards)
          .where(eq(materialBoards.id, data.entityId)).limit(1).for("update");
      } else if (data.entityType === "visual") {
        target = await tx.select({ projectId: generatedVisuals.projectId }).from(generatedVisuals)
          .where(eq(generatedVisuals.id, data.entityId)).limit(1).for("update");
      }
      if (!target[0] || target[0].projectId !== data.projectId) return null;
    }
    const result = await tx.insert(comments).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getCommentsByEntity(projectId: number, entityType: string, entityId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(comments.projectId, projectId),
    eq(comments.entityType, entityType as any),
  ];
  if (entityId !== undefined) conditions.push(eq(comments.entityId, entityId));
  return db.select().from(comments).where(and(...conditions)).orderBy(desc(comments.createdAt));
}

export async function getCommentsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comments).where(eq(comments.projectId, projectId)).orderBy(desc(comments.createdAt));
}

// ─── Approval State (V2.8) ──────────────────────────────────────────────────

export async function updateProjectApprovalState(projectId: number, approvalState: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projects).set({ approvalState: approvalState as any }).where(eq(projects.id, projectId));
}

export async function updateProjectApprovalStateForOrg(projectId: number, orgId: number, approvalState: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(projects).set({ approvalState: approvalState as any })
    .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)));
  return Number(result[0].affectedRows) === 1;
}

// ─── Logic Versions (V2.10) ──────────────────────────────────────────────────

export async function getPublishedLogicVersion() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(logicVersions)
    .where(eq(logicVersions.status, "published"))
    .orderBy(desc(logicVersions.publishedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listLogicVersions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(logicVersions).orderBy(desc(logicVersions.createdAt));
}

export async function getLogicVersionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(logicVersions).where(eq(logicVersions.id, id));
  return rows[0] ?? null;
}

export async function createLogicVersion(data: { name: string; notes?: string; createdBy?: number }) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(logicVersions).values(data);
  return result.insertId;
}

export async function publishLogicVersion(id: number) {
  const db = await getDb();
  if (!db) return;
  // Archive all currently published
  await db
    .update(logicVersions)
    .set({ status: "archived" })
    .where(eq(logicVersions.status, "published"));
  // Publish this one
  await db
    .update(logicVersions)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(logicVersions.id, id));
}

export async function archiveLogicVersion(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(logicVersions)
    .set({ status: "archived" })
    .where(eq(logicVersions.id, id));
}

// ─── Logic Weights (V2.10) ──────────────────────────────────────────────────

export async function getLogicWeights(logicVersionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(logicWeights)
    .where(eq(logicWeights.logicVersionId, logicVersionId));
}

export async function setLogicWeights(logicVersionId: number, weights: { dimension: string; weight: string }[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(logicWeights).where(eq(logicWeights.logicVersionId, logicVersionId));
  if (weights.length > 0) {
    await db.insert(logicWeights).values(
      weights.map((w) => ({ logicVersionId, dimension: w.dimension, weight: w.weight }))
    );
  }
}

// ─── Logic Thresholds (V2.10) ───────────────────────────────────────────────

export async function getLogicThresholds(logicVersionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(logicThresholds)
    .where(eq(logicThresholds.logicVersionId, logicVersionId));
}

export async function setLogicThresholds(
  logicVersionId: number,
  thresholds: { ruleKey: string; thresholdValue: string; comparator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq"; notes?: string }[]
) {
  const db = await getDb();
  if (!db) return;
  await db.delete(logicThresholds).where(eq(logicThresholds.logicVersionId, logicVersionId));
  if (thresholds.length > 0) {
    await db.insert(logicThresholds).values(
      thresholds.map((t) => ({ logicVersionId, ...t }))
    );
  }
}

// ─── Logic Change Log (V2.10) ───────────────────────────────────────────────

export async function getLogicChangeLog(logicVersionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(logicChangeLog)
    .where(eq(logicChangeLog.logicVersionId, logicVersionId))
    .orderBy(desc(logicChangeLog.createdAt));
}

export async function addLogicChangeLogEntry(data: {
  logicVersionId: number;
  actor: number;
  changeSummary: string;
  rationale: string;
}) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(logicChangeLog).values(data);
  return result.insertId;
}

// ─── Scenario Inputs (V2.11) ────────────────────────────────────────────────

export async function createScenarioInput(data: { scenarioId: number; jsonInput: unknown }) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(scenarioInputs).values({
    scenarioId: data.scenarioId,
    jsonInput: data.jsonInput,
  });
  return result.insertId;
}

export async function createScenarioInputForOrg(
  data: { scenarioId: number; jsonInput: unknown },
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const rows = await tx.select({ id: scenarios.id })
      .from(scenarios)
      .innerJoin(projects, eq(scenarios.projectId, projects.id))
      .where(and(eq(scenarios.id, data.scenarioId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (rows.length !== 1) return null;
    const [result] = await tx.insert(scenarioInputs).values(data);
    return Number(result.insertId);
  });
}

export async function getScenarioInput(scenarioId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(scenarioInputs)
    .where(eq(scenarioInputs.scenarioId, scenarioId))
    .orderBy(desc(scenarioInputs.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Scenario Outputs (V2.11) ───────────────────────────────────────────────

export async function createScenarioOutput(data: {
  scenarioId: number;
  scoreJson: unknown;
  roiJson?: unknown;
  riskJson?: unknown;
  boardCostJson?: unknown;
  benchmarkVersionId?: number;
  logicVersionId?: number;
}) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(scenarioOutputs).values(data);
  return result.insertId;
}

export async function createScenarioOutputForOrg(
  data: Parameters<typeof createScenarioOutput>[0],
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const rows = await tx.select({ id: scenarios.id })
      .from(scenarios)
      .innerJoin(projects, eq(scenarios.projectId, projects.id))
      .where(and(eq(scenarios.id, data.scenarioId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (rows.length !== 1) return null;
    const [result] = await tx.insert(scenarioOutputs).values(data);
    return Number(result.insertId);
  });
}

export async function getScenarioOutput(scenarioId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(scenarioOutputs)
    .where(eq(scenarioOutputs.scenarioId, scenarioId))
    .orderBy(desc(scenarioOutputs.computedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listScenarioOutputs(scenarioIds: number[]) {
  if (scenarioIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scenarioOutputs)
    .where(inArray(scenarioOutputs.scenarioId, scenarioIds))
    .orderBy(desc(scenarioOutputs.computedAt));
}

// ─── Scenario Comparisons (V2.11) ───────────────────────────────────────────

export async function createScenarioComparison(data: {
  projectId: number;
  baselineScenarioId: number;
  comparedScenarioIds: number[];
  decisionNote?: string;
  comparisonResult?: unknown;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(scenarioComparisons).values(data);
  return result.insertId;
}

export async function createScenarioComparisonForOrg(
  data: Parameters<typeof createScenarioComparison>[0],
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const scenarioIds = Array.from(new Set([
    data.baselineScenarioId,
    ...data.comparedScenarioIds,
  ]));
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return null;
    const scenarioRows = await tx.select({ id: scenarios.id })
      .from(scenarios)
      .where(and(
        inArray(scenarios.id, scenarioIds),
        eq(scenarios.projectId, data.projectId),
        eq(scenarios.orgId, orgId)
      ))
      .for("update");
    if (scenarioRows.length !== scenarioIds.length) return null;
    const [result] = await tx.insert(scenarioComparisons).values(data);
    return Number(result.insertId);
  });
}

export async function listScenarioComparisons(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scenarioComparisons)
    .where(eq(scenarioComparisons.projectId, projectId))
    .orderBy(desc(scenarioComparisons.createdAt));
}

export async function getScenarioComparisonById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(scenarioComparisons).where(eq(scenarioComparisons.id, id));
  return rows[0] ?? null;
}

// ─── Project Outcomes (V2.13) ───────────────────────────────────────────────

export async function createProjectOutcome(data: {
  projectId: number;
  // V2.13 fields
  procurementActualCosts?: unknown;
  leadTimesActual?: unknown;
  rfqResults?: unknown;
  adoptionMetrics?: unknown;
  // V5 fields
  actualFitoutCostPerSqm?: string;
  actualTotalCost?: string;
  projectDeliveredOnTime?: boolean;
  reworkOccurred?: boolean;
  reworkCostAed?: string;
  clientSatisfactionScore?: number;
  tenderIterations?: number;
  keyLessonsLearned?: string;
  capturedBy?: number;
}) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(projectOutcomes).values(data);
  return result.insertId;
}

export async function createProjectOutcomeForOrg(
  data: Parameters<typeof createProjectOutcome>[0],
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return null;
    const [result] = await tx.insert(projectOutcomes).values(data);
    return Number(result.insertId);
  });
}

export async function getProjectOutcomes(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectOutcomes)
    .where(eq(projectOutcomes.projectId, projectId))
    .orderBy(desc(projectOutcomes.capturedAt));
}

export async function getProjectOutcomesForOrg(projectId: number, orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows: Array<{ outcome: typeof projectOutcomes.$inferSelect }> =
    await db.select({ outcome: projectOutcomes })
    .from(projectOutcomes)
    .innerJoin(projects, eq(projectOutcomes.projectId, projects.id))
    .where(and(eq(projectOutcomes.projectId, projectId), eq(projects.orgId, orgId)))
    .orderBy(desc(projectOutcomes.capturedAt));
  return rows.map(row => row.outcome);
}

export async function getLatestProjectOutcomeForOrg(projectId: number, orgId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ outcome: projectOutcomes })
    .from(projectOutcomes)
    .innerJoin(projects, eq(projectOutcomes.projectId, projects.id))
    .where(and(eq(projectOutcomes.projectId, projectId), eq(projects.orgId, orgId)))
    .orderBy(desc(projectOutcomes.capturedAt))
    .limit(1);
  return rows[0]?.outcome;
}

export async function getLatestOutcomeComparisonForOrg(projectId: number, orgId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ comparison: outcomeComparisons })
    .from(outcomeComparisons)
    .innerJoin(projects, eq(outcomeComparisons.projectId, projects.id))
    .where(and(eq(outcomeComparisons.projectId, projectId), eq(projects.orgId, orgId)))
    .orderBy(desc(outcomeComparisons.comparedAt))
    .limit(1);
  return rows[0]?.comparison;
}

export async function createOutcomeComparisonForOrg<T extends { projectId: number }>(
  projectId: number,
  orgId: number,
  data: T
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const ownedProject = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (ownedProject.length !== 1 || data.projectId !== projectId) return null;
    const values = data as T & Record<string, unknown>;
    const [result] = await tx.insert(outcomeComparisons).values({
      ...data,
      predictedCostMid: values.predictedCostMid == null ? null : String(values.predictedCostMid),
      actualCost: values.actualCost == null ? null : String(values.actualCost),
      costDeltaPct: values.costDeltaPct == null ? null : String(values.costDeltaPct),
      predictedComposite: String(values.predictedComposite),
      predictedRisk: String(values.predictedRisk),
    } as unknown as typeof outcomeComparisons.$inferInsert);
    return Number(result.insertId);
  });
}

export async function listAllOutcomes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectOutcomes).orderBy(desc(projectOutcomes.capturedAt));
}

// ─── Benchmark Suggestions (V2.13) ──────────────────────────────────────────

export async function createBenchmarkSuggestion(data: {
  basedOnOutcomesQuery?: string;
  suggestedChanges: unknown;
  confidence?: string;
}) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(benchmarkSuggestions).values(data);
  return result.insertId;
}

export async function listBenchmarkSuggestions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(benchmarkSuggestions)
    .orderBy(desc(benchmarkSuggestions.createdAt));
}

export async function reviewBenchmarkSuggestion(
  id: number,
  data: { status: "accepted" | "rejected"; reviewerNotes?: string; reviewedBy: number }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(benchmarkSuggestions)
    .set({ ...data, reviewedAt: new Date() })
    .where(eq(benchmarkSuggestions.id, id));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stage 1 — Market Intelligence Layer V1
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Source Registry ────────────────────────────────────────────────────────

export async function listSourceRegistry() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sourceRegistry).orderBy(desc(sourceRegistry.addedAt));
}

export async function getSourceRegistryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, id));
  return rows[0];
}

export async function createSourceRegistryEntry(data: typeof sourceRegistry.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(sourceRegistry).values(data);
  return { id: Number(result.insertId) };
}

export async function updateSourceRegistryEntry(id: number, data: Partial<typeof sourceRegistry.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sourceRegistry).set(data).where(eq(sourceRegistry.id, id));
}

export async function deleteSourceRegistryEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(sourceRegistry).where(eq(sourceRegistry.id, id));
}

// ─── Evidence Records ───────────────────────────────────────────────────────

export async function listEvidenceRecords(filters?: {
  projectId?: number;
  category?: string;
  reliabilityGrade?: string;
  evidencePhase?: string;
  confidentiality?: string;
  excludeConfidential?: boolean;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.projectId) conditions.push(eq(evidenceRecords.projectId, filters.projectId));
  if (filters?.category) conditions.push(eq(evidenceRecords.category, filters.category as any));
  if (filters?.reliabilityGrade) conditions.push(eq(evidenceRecords.reliabilityGrade, filters.reliabilityGrade as any));
  if (filters?.evidencePhase) conditions.push(eq(evidenceRecords.evidencePhase, filters.evidencePhase as any));
  if (filters?.confidentiality) conditions.push(eq(evidenceRecords.confidentiality, filters.confidentiality as any));
  if (filters?.excludeConfidential) {
    conditions.push(sql`${evidenceRecords.confidentiality} NOT IN ('confidential', 'restricted')`);
  }
  let query = db.select().from(evidenceRecords);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return (query as any).orderBy(desc(evidenceRecords.createdAt)).limit(filters?.limit ?? 100);
}

export async function listOrganizationEvidenceRecords(orgId: number, filters?: {
  projectId?: number;
  category?: string;
  reliabilityGrade?: string;
  evidencePhase?: string;
  confidentiality?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(evidenceRecords.orgId, orgId),
    eq(evidenceRecords.corpusScope, "organization"),
  ];
  if (filters?.projectId !== undefined) conditions.push(eq(evidenceRecords.projectId, filters.projectId));
  if (filters?.category) conditions.push(eq(evidenceRecords.category, filters.category as any));
  if (filters?.reliabilityGrade) conditions.push(eq(evidenceRecords.reliabilityGrade, filters.reliabilityGrade as any));
  if (filters?.evidencePhase) conditions.push(eq(evidenceRecords.evidencePhase, filters.evidencePhase as any));
  if (filters?.confidentiality) conditions.push(eq(evidenceRecords.confidentiality, filters.confidentiality as any));
  return db.select().from(evidenceRecords)
    .where(and(...conditions))
    .orderBy(desc(evidenceRecords.createdAt))
    .limit(filters?.limit ?? 100);
}

export async function listPublicCorpusEvidence(filters?: {
  category?: string;
  reliabilityGrade?: string;
  evidencePhase?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    isNull(evidenceRecords.projectId),
    isNull(evidenceRecords.orgId),
    eq(evidenceRecords.corpusScope, "platform_public"),
  ];
  if (filters?.category) conditions.push(eq(evidenceRecords.category, filters.category as any));
  if (filters?.reliabilityGrade) conditions.push(eq(evidenceRecords.reliabilityGrade, filters.reliabilityGrade as any));
  if (filters?.evidencePhase) conditions.push(eq(evidenceRecords.evidencePhase, filters.evidencePhase as any));
  return db.select().from(evidenceRecords)
    .where(and(...conditions))
    .orderBy(desc(evidenceRecords.createdAt))
    .limit(filters?.limit ?? 100);
}

/** @deprecated Tenant code must use listPublicCorpusEvidence. */
export const listPublicEvidenceRecords = listPublicCorpusEvidence;

export async function getEvidenceRecordById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(evidenceRecords).where(eq(evidenceRecords.id, id));
  return rows[0];
}

export async function createEvidenceRecord(data: typeof evidenceRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(evidenceRecords).values(data);
  return { id: Number(result.insertId) };
}

type ConfidenceDecimalField =
  | "baseConfidence"
  | "recencyAdjustment"
  | "confidenceAfterRecency"
  | "qualityMultiplier"
  | "qualityFloor";

type ConfidenceAssessmentInsert = Omit<
  typeof evidenceConfidenceAssessments.$inferInsert,
  "id" | "evidenceRecordId" | "createdAt" | ConfidenceDecimalField
> & Partial<Record<ConfidenceDecimalField, string | number | null>>;

/**
 * Persist an evidence row and its first confidence assessment atomically.
 * Use this for new computed or operator-asserted evidence. Legacy callers may
 * continue to create rows without provenance, which the API labels legacy_unknown.
 */
export async function createEvidenceRecordWithConfidenceAssessment(
  data: typeof evidenceRecords.$inferInsert,
  assessment: ConfidenceAssessmentInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx: any) => {
    const [recordResult] = await tx.insert(evidenceRecords).values({
      ...data,
      confidencePolicyVersion: assessment.confidencePolicyId,
    });
    const evidenceRecordId = Number(recordResult.insertId);
    const [assessmentResult] = await tx.insert(evidenceConfidenceAssessments).values({
      ...assessment,
      evidenceRecordId,
    });
    const assessmentId = Number(assessmentResult.insertId);
    await tx.update(evidenceRecords)
      .set({ currentConfidenceAssessmentId: assessmentId })
      .where(eq(evidenceRecords.id, evidenceRecordId));
    return { id: evidenceRecordId, assessmentId };
  });
}

export interface PublicEvidenceObservationResult {
  id: number;
  assessmentId: number;
  created: boolean;
  previousConfidenceScore: number | null;
  previousPriceTypical: string | null;
}

/**
 * Latest accepted connector observation wins. Matching and mutation are both
 * restricted to the public platform corpus so a same-key tenant row is never
 * read, locked, or changed. The evidence mutation, append-only assessment, and
 * current pointer update share one transaction.
 */
export async function upsertPublicEvidenceObservation(
  data: typeof evidenceRecords.$inferInsert,
  assessment: ConfidenceAssessmentInsert
): Promise<PublicEvidenceObservationResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.orgId != null || data.projectId != null || data.corpusScope !== "platform_public") {
    throw new Error("Public connector observations must be platform_public with no organization or project");
  }
  const publicObservationKey = createHash("sha256")
    .update(JSON.stringify([data.sourceUrl, data.itemName]))
    .digest("hex");

  return db.transaction(async (tx: any) => {
    const legacyMatches = await tx.select({
      id: evidenceRecords.id,
    })
      .from(evidenceRecords)
      .where(and(
        eq(evidenceRecords.sourceUrl, data.sourceUrl),
        eq(evidenceRecords.itemName, data.itemName),
        isNull(evidenceRecords.orgId),
        isNull(evidenceRecords.projectId),
        eq(evidenceRecords.corpusScope, "platform_public")
      ))
      .orderBy(desc(evidenceRecords.captureDate))
      .limit(1);

    let existing: { id: number; confidenceScore: number; priceTypical: string | null; recordId: string } | undefined;
    let evidenceRecordId: number;
    let created = false;

    if (legacyMatches[0]) {
      const locked = await tx.select({
        id: evidenceRecords.id,
        confidenceScore: evidenceRecords.confidenceScore,
        priceTypical: evidenceRecords.priceTypical,
        recordId: evidenceRecords.recordId,
      }).from(evidenceRecords).where(and(
        eq(evidenceRecords.id, legacyMatches[0].id),
        isNull(evidenceRecords.orgId),
        isNull(evidenceRecords.projectId),
        eq(evidenceRecords.corpusScope, "platform_public")
      )).limit(1).for("update");
      existing = locked[0];
      if (!existing) throw new Error("Public observation disappeared before it could be locked");
      evidenceRecordId = existing.id;
    } else {
      const [insertResult] = await tx.insert(evidenceRecords).values({
        ...data,
        publicObservationKey,
        confidencePolicyVersion: assessment.confidencePolicyId,
      }).onDuplicateKeyUpdate({
        set: { id: sql`LAST_INSERT_ID(${evidenceRecords.id})` },
      });
      evidenceRecordId = Number(insertResult.insertId);
      const locked = await tx.select({
        id: evidenceRecords.id,
        confidenceScore: evidenceRecords.confidenceScore,
        priceTypical: evidenceRecords.priceTypical,
        recordId: evidenceRecords.recordId,
      }).from(evidenceRecords).where(and(
        eq(evidenceRecords.id, evidenceRecordId),
        isNull(evidenceRecords.orgId),
        isNull(evidenceRecords.projectId),
        eq(evidenceRecords.corpusScope, "platform_public"),
        eq(evidenceRecords.publicObservationKey, publicObservationKey)
      )).limit(1).for("update");
      if (!locked[0]) throw new Error("Public observation conflict resolved outside the public corpus");
      created = locked[0].recordId === data.recordId;
      if (!created) existing = locked[0];
    }

    if (!created) {
      const {
        id: _ignoredId,
        recordId: _ignoredRecordId,
        currentConfidenceAssessmentId: _ignoredAssessmentId,
        ...latestObservation
      } = data;
      await tx.update(evidenceRecords).set({
        ...latestObservation,
        publicObservationKey,
        confidencePolicyVersion: assessment.confidencePolicyId,
      }).where(and(
        eq(evidenceRecords.id, evidenceRecordId),
        isNull(evidenceRecords.orgId),
        isNull(evidenceRecords.projectId),
        eq(evidenceRecords.corpusScope, "platform_public")
      ));
    }

    const finalScore = Number(data.confidenceScore);
    const [assessmentResult] = await tx.insert(evidenceConfidenceAssessments).values({
      ...assessment,
      evidenceRecordId,
      previousScore: existing?.confidenceScore ?? null,
      finalScore,
      mergeDecision: existing ? "latest_accepted" : "inserted",
      outcome: "accepted",
    });
    const assessmentId = Number(assessmentResult.insertId);
    await tx.update(evidenceRecords)
      .set({
        currentConfidenceAssessmentId: assessmentId,
        confidencePolicyVersion: assessment.confidencePolicyId,
      })
      .where(and(
        eq(evidenceRecords.id, evidenceRecordId),
        isNull(evidenceRecords.orgId),
        isNull(evidenceRecords.projectId),
        eq(evidenceRecords.corpusScope, "platform_public")
      ));

    return {
      id: evidenceRecordId,
      assessmentId,
      created,
      previousConfidenceScore: existing?.confidenceScore ?? null,
      previousPriceTypical: existing?.priceTypical ?? null,
    };
  });
}

/** Rejected observations have provenance but deliberately create no evidence row. */
export async function recordRejectedConfidenceAssessment(
  assessment: ConfidenceAssessmentInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(evidenceConfidenceAssessments).values({
    ...assessment,
    evidenceRecordId: null,
    outcome: "rejected",
    mergeDecision: "rejected",
  } as any);
  return { id: Number(result.insertId) };
}

export async function listConfidenceAssessmentHistory(evidenceRecordId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evidenceConfidenceAssessments)
    .where(eq(evidenceConfidenceAssessments.evidenceRecordId, evidenceRecordId))
    .orderBy(desc(evidenceConfidenceAssessments.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function createEvidenceRecordForOrg(
  orgId: number,
  projectId: number,
  data: Omit<typeof evidenceRecords.$inferInsert, "orgId" | "projectId" | "corpusScope" | "corpusPolicyVersion">
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const ownedProject = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (ownedProject.length !== 1) return null;
    const [result] = await tx.insert(evidenceRecords).values({
      ...data,
      projectId,
      orgId,
      corpusScope: "organization",
      corpusPolicyVersion: "org-public-v1",
    });
    return { id: Number(result.insertId) };
  });
}

export async function deleteEvidenceRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(evidenceRecords).where(eq(evidenceRecords.id, id));
}

export async function deleteGlobalEvidenceRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(evidenceRecords).where(and(
    eq(evidenceRecords.id, id),
    isNull(evidenceRecords.projectId),
    isNull(evidenceRecords.orgId)
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function getPreviousPublicEvidenceRecord(
  itemName: string,
  sourceRegistryId: number,
  beforeDate: Date
) {
  const db = await getDb();
  if (!db) return undefined;

  const query = db.select()
    .from(evidenceRecords)
    .where(
      and(
        eq(evidenceRecords.itemName, itemName),
        eq(evidenceRecords.sourceRegistryId, sourceRegistryId),
        isNull(evidenceRecords.orgId),
        eq(evidenceRecords.corpusScope, "platform_public"),
        sql`${evidenceRecords.captureDate} < ${beforeDate}`
      )
    )
    .orderBy(desc(evidenceRecords.captureDate))
    .limit(1);

  const rows = await query;
  return rows[0];
}

export async function createPriceChangeEvent(data: typeof priceChangeEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(priceChangeEvents).values(data);
  return { id: Number(result.insertId) };
}

export async function getEvidenceStats() {
  const db = await getDb();
  if (!db) return { total: 0, byCategory: {}, byGrade: {}, avgConfidence: 0 };
  const all = await db.select().from(evidenceRecords);
  const byCategory: Record<string, number> = {};
  const byGrade: Record<string, number> = {};
  let totalConfidence = 0;
  for (const rec of all) {
    byCategory[rec.category] = (byCategory[rec.category] ?? 0) + 1;
    byGrade[rec.reliabilityGrade] = (byGrade[rec.reliabilityGrade] ?? 0) + 1;
    totalConfidence += rec.confidenceScore;
  }
  return {
    total: all.length,
    byCategory,
    byGrade,
    avgConfidence: all.length > 0 ? Math.round(totalConfidence / all.length) : 0,
  };
}

export async function getPublicEvidenceStats() {
  const records = await listPublicEvidenceRecords({ limit: 10_000 });
  const byCategory: Record<string, number> = {};
  const byGrade: Record<string, number> = {};
  let confidenceTotal = 0;
  for (const record of records) {
    byCategory[record.category] = (byCategory[record.category] ?? 0) + 1;
    byGrade[record.reliabilityGrade] =
      (byGrade[record.reliabilityGrade] ?? 0) + 1;
    confidenceTotal += record.confidenceScore;
  }
  return {
    total: records.length,
    byCategory,
    byGrade,
    avgConfidence:
      records.length === 0
        ? 0
        : Math.round(confidenceTotal / records.length),
  };
}

export async function getDataHealthStats() {
  const db = await getDb();
  if (!db) return null;

  // 1. Source Health
  const allSources = await db.select().from(sourceRegistry);
  const activeSources = allSources.filter((s: any) => s.isActive);
  const failingSources = activeSources.filter((s: any) => s.consecutiveFailures > 0);
  const disabledSources = activeSources.filter((s: any) => s.consecutiveFailures >= 5);

  const sourceHealth = {
    total: allSources.length,
    active: activeSources.length,
    failing: failingSources.length,
    disabled: disabledSources.length,
  };

  // 2. Category Freshness & Coverage Gaps
  const allEvidence = await db.select().from(evidenceRecords);
  const categoryStats: Record<string, { count: number, latestCapture: Date | null, avgAgeDays: number }> = {};

  const now = new Date().getTime();

  for (const rec of allEvidence as any[]) {
    if (!categoryStats[rec.category]) {
      categoryStats[rec.category] = { count: 0, latestCapture: null, avgAgeDays: 0 };
    }
    const stat = categoryStats[rec.category];
    stat.count++;

    if (rec.captureDate) {
      if (!stat.latestCapture || rec.captureDate > stat.latestCapture) {
        stat.latestCapture = rec.captureDate;
      }
      const ageDays = (now - rec.captureDate.getTime()) / (1000 * 60 * 60 * 24);
      stat.avgAgeDays += ageDays;
    }
  }

  const coverageGaps = [];
  for (const cat of Object.keys(categoryStats)) {
    const stat = categoryStats[cat];
    if (stat.count > 0) stat.avgAgeDays /= stat.count;

    // Gap criteria: < 10 records OR avg age > 30 days
    if (stat.count < 10 || stat.avgAgeDays > 30) {
      coverageGaps.push({
        category: cat,
        count: stat.count,
        avgAgeDays: Math.round(stat.avgAgeDays),
      });
    }
  }

  // 3. Price Change Feed
  const recentPriceChanges = await db.select().from(priceChangeEvents).orderBy(desc(priceChangeEvents.detectedAt)).limit(20);

  return {
    sourceHealth,
    categoryStats,
    coverageGaps,
    recentPriceChanges,
  };
}

// ─── Benchmark Proposals ────────────────────────────────────────────────────

export async function listBenchmarkProposals(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(benchmarkProposals)
      .where(eq(benchmarkProposals.status, status as any))
      .orderBy(desc(benchmarkProposals.createdAt));
  }
  return db.select().from(benchmarkProposals).orderBy(desc(benchmarkProposals.createdAt));
}

export async function getBenchmarkProposalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(benchmarkProposals).where(eq(benchmarkProposals.id, id));
  return rows[0];
}

export async function createBenchmarkProposal(data: typeof benchmarkProposals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(benchmarkProposals).values(data);
  return { id: Number(result.insertId) };
}

export async function reviewBenchmarkProposal(
  id: number,
  data: { status: "approved" | "rejected"; reviewerNotes?: string; reviewedBy: number }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(benchmarkProposals)
    .set({ ...data, reviewedAt: new Date() })
    .where(eq(benchmarkProposals.id, id));
}

// ─── Benchmark Snapshots ────────────────────────────────────────────────────

export async function listBenchmarkSnapshots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkSnapshots).orderBy(desc(benchmarkSnapshots.createdAt));
}

export async function getBenchmarkSnapshotById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(benchmarkSnapshots).where(eq(benchmarkSnapshots.id, id));
  return rows[0];
}

export async function createBenchmarkSnapshot(data: typeof benchmarkSnapshots.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(benchmarkSnapshots).values(data);
  return { id: Number(result.insertId) };
}

// ─── Competitor Entities ────────────────────────────────────────────────────

export async function listCompetitorEntities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(competitorEntities).orderBy(desc(competitorEntities.createdAt));
}

export async function getCompetitorEntityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(competitorEntities).where(eq(competitorEntities.id, id));
  return rows[0];
}

export async function createCompetitorEntity(data: typeof competitorEntities.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(competitorEntities).values(data);
  return { id: Number(result.insertId) };
}

export async function updateCompetitorEntity(id: number, data: Partial<typeof competitorEntities.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(competitorEntities).set(data).where(eq(competitorEntities.id, id));
}

export async function deleteCompetitorEntity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete associated projects first
  await db.delete(competitorProjects).where(eq(competitorProjects.competitorId, id));
  await db.delete(competitorEntities).where(eq(competitorEntities.id, id));
}

// ─── Competitor Projects ────────────────────────────────────────────────────

export async function listCompetitorProjects(competitorId?: number, segment?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (competitorId) conditions.push(eq(competitorProjects.competitorId, competitorId));
  if (segment) conditions.push(eq(competitorProjects.segment, segment as any));
  let query = db.select().from(competitorProjects);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return (query as any).orderBy(desc(competitorProjects.createdAt));
}

export async function getCompetitorProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(competitorProjects).where(eq(competitorProjects.id, id));
  return rows[0];
}

export async function createCompetitorProject(data: typeof competitorProjects.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(competitorProjects).values(data);
  return { id: Number(result.insertId) };
}

export async function updateCompetitorProject(id: number, data: Partial<typeof competitorProjects.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(competitorProjects).set(data).where(eq(competitorProjects.id, id));
}

export async function deleteCompetitorProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(competitorProjects).where(eq(competitorProjects.id, id));
}

// ─── Trend Tags ─────────────────────────────────────────────────────────────

export async function listTrendTags(category?: string) {
  const db = await getDb();
  if (!db) return [];
  if (category) {
    return db.select().from(trendTags)
      .where(eq(trendTags.category, category as any))
      .orderBy(trendTags.name);
  }
  return db.select().from(trendTags).orderBy(trendTags.name);
}

export async function createTrendTag(data: typeof trendTags.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(trendTags).values(data);
  return { id: Number(result.insertId) };
}

export async function deleteTrendTag(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete associated entity tags first
  await db.delete(entityTags).where(eq(entityTags.tagId, id));
  await db.delete(trendTags).where(eq(trendTags.id, id));
}

// ─── Entity Tags ────────────────────────────────────────────────────────────

export async function createEntityTag(data: typeof entityTags.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(entityTags).values(data);
  return { id: Number(result.insertId) };
}

export async function getEntityTagById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(entityTags)
    .where(eq(entityTags.id, id))
    .limit(1);
  return rows[0];
}

export async function deleteEntityTagIfMatches(
  id: number,
  expected: { entityType: string; entityId: number }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(entityTags).where(and(
    eq(entityTags.id, id),
    eq(entityTags.entityType, expected.entityType as any),
    eq(entityTags.entityId, expected.entityId)
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function deleteEntityTag(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(entityTags).where(eq(entityTags.id, id));
}

export async function getEntityTags(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  const tags = await db.select().from(entityTags)
    .where(and(eq(entityTags.entityType, entityType as any), eq(entityTags.entityId, entityId)));
  // Join with trend_tags to get names
  if (tags.length === 0) return [];
  const tagIds = tags.map((t: any) => t.tagId);
  const tagDetails = await db.select().from(trendTags).where(inArray(trendTags.id, tagIds));
  const tagMap = new Map(tagDetails.map((t: any) => [t.id, t]));
  return tags.map((t: any) => ({
    ...t,
    tag: tagMap.get(t.tagId),
  }));
}

export async function getTaggedEntities(tagId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entityTags).where(eq(entityTags.tagId, tagId));
}

// ─── Intelligence Audit Log ─────────────────────────────────────────────────

export async function createIntelligenceAuditEntry(data: typeof intelligenceAuditLog.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(intelligenceAuditLog).values(data);
}

export async function listIntelligenceAuditLog(runType?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (runType) {
    return db.select().from(intelligenceAuditLog)
      .where(eq(intelligenceAuditLog.runType, runType as any))
      .orderBy(desc(intelligenceAuditLog.startedAt))
      .limit(limit);
  }
  return db.select().from(intelligenceAuditLog)
    .orderBy(desc(intelligenceAuditLog.startedAt))
    .limit(limit);
}

export async function getIntelligenceAuditEntryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(intelligenceAuditLog).where(eq(intelligenceAuditLog.id, id));
  return rows[0];
}

// ─── Evidence References (V2.2) ─────────────────────────────────────────────

export async function listEvidenceReferences(filters?: {
  evidenceRecordId?: number;
  targetType?: string;
  targetId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.evidenceRecordId) conditions.push(eq(evidenceReferences.evidenceRecordId, filters.evidenceRecordId));
  if (filters?.targetType) conditions.push(eq(evidenceReferences.targetType, filters.targetType as any));
  if (filters?.targetId) conditions.push(eq(evidenceReferences.targetId, filters.targetId));
  let query = db.select().from(evidenceReferences);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return (query as any).orderBy(desc(evidenceReferences.addedAt));
}

export async function createEvidenceReference(data: typeof evidenceReferences.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(evidenceReferences).values(data);
  return { id: Number(result.insertId) };
}

export async function getEvidenceReferenceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(evidenceReferences)
    .where(eq(evidenceReferences.id, id))
    .limit(1);
  return rows[0];
}

export async function deleteEvidenceReferenceIfMatches(
  id: number,
  expected: {
    evidenceRecordId: number;
    targetType: string;
    targetId: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(evidenceReferences).where(and(
    eq(evidenceReferences.id, id),
    eq(evidenceReferences.evidenceRecordId, expected.evidenceRecordId),
    eq(evidenceReferences.targetType, expected.targetType as any),
    eq(evidenceReferences.targetId, expected.targetId)
  ));
  return Number(result[0].affectedRows) === 1;
}

export async function deleteEvidenceReference(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(evidenceReferences).where(eq(evidenceReferences.id, id));
}

export async function getEvidenceForTarget(targetType: string, targetId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all references for this target
  const refs = await db.select().from(evidenceReferences)
    .where(and(
      eq(evidenceReferences.targetType, targetType as any),
      eq(evidenceReferences.targetId, targetId),
    ));
  if (refs.length === 0) return [];
  // Join with evidence_records to get full evidence data
  const recordIds = refs.map((r: any) => r.evidenceRecordId);
  const records = await db.select().from(evidenceRecords).where(inArray(evidenceRecords.id, recordIds));
  const recordMap = new Map(records.map((r: any) => [r.id, r]));
  return refs.map((ref: any) => ({
    reference: ref,
    evidence: recordMap.get(ref.evidenceRecordId),
  }));
}

// ─── Connector Health (V3) ──────────────────────────────────────────────────

export async function insertConnectorHealth(data: typeof connectorHealth.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(connectorHealth).values(data);
}

export async function getConnectorHealthByRun(runId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(connectorHealth)
    .where(eq(connectorHealth.runId, runId))
    .orderBy(connectorHealth.sourceId);
}

export async function getConnectorHealthHistory(sourceId: string, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(connectorHealth)
    .where(eq(connectorHealth.sourceId, sourceId))
    .orderBy(desc(connectorHealth.createdAt))
    .limit(limit);
}

export async function getConnectorHealthSummary() {
  const db = await getDb();
  if (!db) return [];
  // Get the latest health record for each sourceId
  // Using a subquery approach: get all records from the last 30 days, group by sourceId
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.select().from(connectorHealth)
    .where(gte(connectorHealth.createdAt, thirtyDaysAgo))
    .orderBy(desc(connectorHealth.createdAt));
}

// ─── Ingestion Runs (V3 helpers) ────────────────────────────────────────────

export async function getIngestionRunById(runId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(ingestionRuns)
    .where(eq(ingestionRuns.runId, runId));
  return rows[0];
}

export async function getIngestionRunHistory(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(limit);
}


// ─── DLD Projects (Phase B.3 — Dubai Land Department Open Data) ─────────────

export async function getDldAreas(): Promise<Array<{ areaId: number; areaNameEn: string; areaNameAr: string; projectCount: number; totalUnits: number }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT area_id as areaId, area_name_en as areaNameEn, area_name_ar as areaNameAr,
           COUNT(*) as projectCount,
           SUM(COALESCE(no_of_units, 0) + COALESCE(no_of_villas, 0)) as totalUnits
    FROM dld_projects
    WHERE area_name_en IS NOT NULL AND area_name_en != ''
    GROUP BY area_id, area_name_en, area_name_ar
    ORDER BY projectCount DESC
  `);
  return (rows as any)?.[0] ?? [];
}

export async function getDldProjectsByArea(areaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dldProjects).where(eq(dldProjects.areaId, areaId));
}

export async function getDldAreaComparison(areaId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.execute(sql`
    SELECT
      project_status as status,
      COUNT(*) as projectCount,
      SUM(COALESCE(no_of_units, 0)) as totalUnits,
      SUM(COALESCE(no_of_villas, 0)) as totalVillas,
      SUM(COALESCE(no_of_buildings, 0)) as totalBuildings,
      AVG(percent_completed) as avgCompletion
    FROM dld_projects
    WHERE area_id = ${areaId}
    GROUP BY project_status
  `);

  const developers = await db.execute(sql`
    SELECT developer_name as name, COUNT(*) as projects,
           SUM(COALESCE(no_of_units, 0) + COALESCE(no_of_villas, 0)) as totalUnits
    FROM dld_projects
    WHERE area_id = ${areaId}
    GROUP BY developer_name
    ORDER BY projects DESC
    LIMIT 10
  `);

  return {
    statusBreakdown: (rows as any)?.[0] ?? [],
    topDevelopers: (developers as any)?.[0] ?? [],
  };
}


// ─── DLD Transactions & Rents (Phase B.3 — Analytics) ───────────────────────

export async function getDldAreaBenchmark(areaId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(dldAreaBenchmarks)
    .where(eq(dldAreaBenchmarks.areaId, areaId))
    .orderBy(desc(dldAreaBenchmarks.computedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDldAreaBenchmarkByName(areaName: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(dldAreaBenchmarks)
    .where(eq(dldAreaBenchmarks.areaNameEn, areaName))
    .orderBy(desc(dldAreaBenchmarks.computedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAllAreaBenchmarks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dldAreaBenchmarks)
    .orderBy(desc(dldAreaBenchmarks.saleTransactionCount));
}

export async function upsertAreaBenchmark(data: typeof dldAreaBenchmarks.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  // Check if record exists for this area + period
  const existing = await db.select({ id: dldAreaBenchmarks.id }).from(dldAreaBenchmarks)
    .where(and(
      eq(dldAreaBenchmarks.areaId, data.areaId),
      eq(dldAreaBenchmarks.period, data.period),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(dldAreaBenchmarks)
      .set({ ...data, computedAt: new Date() })
      .where(eq(dldAreaBenchmarks.id, existing[0].id));
  } else {
    await db.insert(dldAreaBenchmarks).values(data);
  }
}

export async function getDldTransactionCount() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.execute(sql`SELECT COUNT(*) as cnt FROM dld_transactions`);
  return (rows as any)?.[0]?.[0]?.cnt ?? 0;
}

export async function getDldRentCount() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.execute(sql`SELECT COUNT(*) as cnt FROM dld_rents`);
  return (rows as any)?.[0]?.[0]?.cnt ?? 0;
}

// ─── Trend Snapshots (V3 — Analytical Intelligence) ────────────────────────

export async function insertTrendSnapshot(data: typeof trendSnapshots.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(trendSnapshots).values(data);
  return result;
}

export async function insertOrganizationTrendSnapshot(
  orgId: number,
  data: Omit<typeof trendSnapshots.$inferInsert, "orgId" | "corpusScope" | "corpusPolicyVersion">
) {
  return insertTrendSnapshot({
    ...data,
    orgId,
    corpusScope: "organization",
    corpusPolicyVersion: "org-public-v1",
  });
}

export async function insertPublicTrendSnapshot(
  data: Omit<typeof trendSnapshots.$inferInsert, "orgId" | "corpusScope" | "corpusPolicyVersion">
) {
  return insertTrendSnapshot({
    ...data,
    orgId: null,
    corpusScope: "platform_public",
    corpusPolicyVersion: "public-v1",
  });
}

export async function getTrendSnapshots(filters?: {
  category?: string;
  geography?: string;
  direction?: string;
  confidence?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.category) conditions.push(eq(trendSnapshots.category, filters.category));
  if (filters?.geography) conditions.push(eq(trendSnapshots.geography, filters.geography));
  if (filters?.direction) conditions.push(eq(trendSnapshots.direction, filters.direction as any));
  if (filters?.confidence) conditions.push(eq(trendSnapshots.confidence, filters.confidence as any));

  const query = db.select().from(trendSnapshots);
  if (conditions.length > 0) {
    return query.where(and(...conditions))
      .orderBy(desc(trendSnapshots.createdAt))
      .limit(filters?.limit ?? 50);
  }
  return query.orderBy(desc(trendSnapshots.createdAt)).limit(filters?.limit ?? 50);
}

export async function getTrendSnapshotsForOrg(orgId: number, filters?: {
  category?: string;
  geography?: string;
  direction?: string;
  confidence?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [or(
    and(eq(trendSnapshots.corpusScope, "organization"), eq(trendSnapshots.orgId, orgId)),
    and(eq(trendSnapshots.corpusScope, "platform_public"), isNull(trendSnapshots.orgId))
  )!];
  if (filters?.category) conditions.push(eq(trendSnapshots.category, filters.category));
  if (filters?.geography) conditions.push(eq(trendSnapshots.geography, filters.geography));
  if (filters?.direction) conditions.push(eq(trendSnapshots.direction, filters.direction as any));
  if (filters?.confidence) conditions.push(eq(trendSnapshots.confidence, filters.confidence as any));
  return db.select().from(trendSnapshots)
    .where(and(...conditions))
    .orderBy(desc(trendSnapshots.createdAt))
    .limit(filters?.limit ?? 50);
}

export async function getPublicTrendSnapshots(filters?: {
  category?: string;
  geography?: string;
  direction?: string;
  confidence?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(trendSnapshots.corpusScope, "platform_public"),
    isNull(trendSnapshots.orgId),
  ];
  if (filters?.category) conditions.push(eq(trendSnapshots.category, filters.category));
  if (filters?.geography) conditions.push(eq(trendSnapshots.geography, filters.geography));
  if (filters?.direction) conditions.push(eq(trendSnapshots.direction, filters.direction as any));
  if (filters?.confidence) conditions.push(eq(trendSnapshots.confidence, filters.confidence as any));
  return db.select().from(trendSnapshots)
    .where(and(...conditions))
    .orderBy(desc(trendSnapshots.createdAt))
    .limit(filters?.limit ?? 50);
}

export async function getTrendHistoryForOrg(orgId: number, metric: string, geography: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trendSnapshots)
    .where(and(
      eq(trendSnapshots.metric, metric),
      eq(trendSnapshots.geography, geography),
      or(
        and(eq(trendSnapshots.corpusScope, "organization"), eq(trendSnapshots.orgId, orgId)),
        and(eq(trendSnapshots.corpusScope, "platform_public"), isNull(trendSnapshots.orgId))
      )
    ))
    .orderBy(desc(trendSnapshots.createdAt))
    .limit(limit);
}

export async function getAnomaliesForOrg(orgId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trendSnapshots)
    .where(and(
      sql`${trendSnapshots.anomalyCount} > 0`,
      or(
        and(eq(trendSnapshots.corpusScope, "organization"), eq(trendSnapshots.orgId, orgId)),
        and(eq(trendSnapshots.corpusScope, "platform_public"), isNull(trendSnapshots.orgId))
      )
    ))
    .orderBy(desc(trendSnapshots.createdAt))
    .limit(limit);
}

export async function getTrendHistory(metric: string, geography: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trendSnapshots)
    .where(and(
      eq(trendSnapshots.metric, metric),
      eq(trendSnapshots.geography, geography)
    ))
    .orderBy(desc(trendSnapshots.createdAt))
    .limit(limit);
}

export async function getAnomalies(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trendSnapshots)
    .where(sql`${trendSnapshots.anomalyCount} > 0`)
    .orderBy(desc(trendSnapshots.createdAt))
    .limit(limit);
}

// ─── Project Insights (V3 — Analytical Intelligence) ───────────────────────

async function insertProjectInsight(data: typeof projectInsights.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  return db.insert(projectInsights).values(data);
}

export async function insertPublicProjectInsight(
  data: Omit<typeof projectInsights.$inferInsert, "orgId" | "projectId" | "corpusScope" | "corpusPolicyVersion">
) {
  return insertProjectInsight({
    ...data,
    projectId: null,
    orgId: null,
    corpusScope: "platform_public",
    corpusPolicyVersion: "public-v1",
  });
}

export async function insertProjectInsightForOrg(
  data: typeof projectInsights.$inferInsert & { projectId: number },
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return false;
    await tx.insert(projectInsights).values({
      ...data,
      orgId,
      corpusScope: "organization",
      corpusPolicyVersion: "org-public-v1",
    });
    return true;
  });
}

export async function getProjectInsightById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(projectInsights)
    .where(eq(projectInsights.id, id))
    .limit(1);
  return rows[0];
}

export async function getProjectInsights(filters?: {
  projectId?: number;
  insightType?: string;
  severity?: string;
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.projectId) conditions.push(eq(projectInsights.projectId, filters.projectId));
  if (filters?.insightType) conditions.push(eq(projectInsights.insightType, filters.insightType as any));
  if (filters?.severity) conditions.push(eq(projectInsights.severity, filters.severity as any));
  if (filters?.status) conditions.push(eq(projectInsights.status, filters.status as any));

  const query = db.select().from(projectInsights);
  if (conditions.length > 0) {
    return query.where(and(...conditions))
      .orderBy(desc(projectInsights.createdAt))
      .limit(filters?.limit ?? 50);
  }
  return query.orderBy(desc(projectInsights.createdAt)).limit(filters?.limit ?? 50);
}

export async function getProjectInsightsForOrg(
  orgId: number,
  filters: {
    projectId: number;
    insightType?: string;
    severity?: string;
    status?: string;
    limit?: number;
  }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(projectInsights.projectId, filters.projectId),
    eq(projectInsights.orgId, orgId),
    eq(projectInsights.corpusScope, "organization"),
    eq(projects.orgId, orgId),
  ];
  if (filters.insightType) conditions.push(eq(projectInsights.insightType, filters.insightType as any));
  if (filters.severity) conditions.push(eq(projectInsights.severity, filters.severity as any));
  if (filters.status) conditions.push(eq(projectInsights.status, filters.status as any));
  const rows: Array<{ insight: typeof projectInsights.$inferSelect }> =
    await db.select({ insight: projectInsights })
    .from(projectInsights)
    .innerJoin(projects, eq(projectInsights.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(projectInsights.createdAt))
    .limit(filters.limit ?? 50);
  return rows.map(row => row.insight);
}

export async function getGlobalProjectInsights(filters?: {
  insightType?: string;
  severity?: string;
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    isNull(projectInsights.projectId),
    isNull(projectInsights.orgId),
    eq(projectInsights.corpusScope, "platform_public"),
  ];
  if (filters?.insightType) conditions.push(eq(projectInsights.insightType, filters.insightType as any));
  if (filters?.severity) conditions.push(eq(projectInsights.severity, filters.severity as any));
  if (filters?.status) conditions.push(eq(projectInsights.status, filters.status as any));
  return db.select().from(projectInsights)
    .where(and(...conditions))
    .orderBy(desc(projectInsights.createdAt))
    .limit(filters?.limit ?? 50);
}

export async function updateInsightStatus(
  insightId: number,
  status: "active" | "acknowledged" | "dismissed" | "resolved",
  userId?: number
) {
  const db = await getDb();
  if (!db) return;
  const updates: any = { status };
  if (status === "acknowledged" && userId) {
    updates.acknowledgedBy = userId;
    updates.acknowledgedAt = new Date();
  }
  return db.update(projectInsights).set(updates).where(eq(projectInsights.id, insightId));
}

export async function updateInsightStatusForOrg(
  insightId: number,
  orgId: number,
  status: "active" | "acknowledged" | "dismissed" | "resolved",
  userId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const rows = await tx.select({ id: projectInsights.id })
      .from(projectInsights)
      .innerJoin(projects, eq(projectInsights.projectId, projects.id))
      .where(and(
        eq(projectInsights.id, insightId),
        eq(projects.orgId, orgId)
      ))
      .limit(1)
      .for("update");
    if (rows.length !== 1) return false;
    const updates: any = { status };
    if (status === "acknowledged" && userId) {
      updates.acknowledgedBy = userId;
      updates.acknowledgedAt = new Date();
    }
    const result = await tx.update(projectInsights)
      .set(updates)
      .where(eq(projectInsights.id, insightId));
    return Number(result[0].affectedRows) === 1;
  });
}

// ─── V8: Design Intelligence Layer ──────────────────────────────────────────

export async function insertFinishScheduleItem(data: typeof finishScheduleItems.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  return db.insert(finishScheduleItems).values(data);
}

export async function insertProjectColorPalette(data: typeof projectColorPalettes.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  return db.insert(projectColorPalettes).values(data);
}

export async function insertRfqLineItem(data: typeof rfqLineItems.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  return db.insert(rfqLineItems).values(data);
}

export async function insertRfqLineItemForOrg(data: typeof rfqLineItems.$inferInsert, orgId: number) {
  if (data.organizationId !== orgId) return false;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId))).limit(1).for("update");
    if (!owned[0]) return false;
    await tx.insert(rfqLineItems).values(data);
    return true;
  });
}

export async function insertRfqLineItemsForOrg(
  data: (typeof rfqLineItems.$inferInsert)[],
  expected: { projectId: number; briefId: number; orgId: number }
) {
  if (data.length > 1000) return false;
  if (data.some(item =>
    item.organizationId !== expected.orgId ||
    item.projectId !== expected.projectId ||
    item.briefId !== expected.briefId
  )) return false;

  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(
        eq(projects.id, expected.projectId),
        eq(projects.orgId, expected.orgId),
      ))
      .limit(1)
      .for("update");
    if (!owned[0]) return false;

    const brief = await tx.select({ projectId: designBriefs.projectId }).from(designBriefs)
      .where(and(
        eq(designBriefs.id, expected.briefId),
        eq(designBriefs.projectId, expected.projectId),
      ))
      .limit(1)
      .for("update");
    if (!brief[0]) return false;

    if (data.length > 0) await tx.insert(rfqLineItems).values(data);
    return true;
  });
}
export async function insertDmComplianceChecklist(data: typeof dmComplianceChecklists.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  return db.insert(dmComplianceChecklists).values(data);
}

// ─── V11: Cognitive Bias Framework ──────────────────────────────────────────

export async function createBiasAlert(data: typeof biasAlerts.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  return db.insert(biasAlerts).values(data);
}

export async function createBiasAlerts(data: (typeof biasAlerts.$inferInsert)[]) {
  const db = await getDb();
  if (!db) return;
  if (data.length === 0) return;
  return db.insert(biasAlerts).values(data);
}

export async function getBiasAlertsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(biasAlerts)
    .where(eq(biasAlerts.projectId, projectId))
    .orderBy(desc(biasAlerts.createdAt));
}

export async function getBiasAlertById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(biasAlerts)
    .where(eq(biasAlerts.id, id))
    .limit(1);
  return rows[0];
}

export async function getActiveBiasAlerts(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(biasAlerts)
    .where(and(
      eq(biasAlerts.projectId, projectId),
      eq(biasAlerts.dismissed, false),
    ))
    .orderBy(desc(biasAlerts.createdAt));
}

export async function dismissBiasAlert(alertId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  return db.update(biasAlerts)
    .set({ dismissed: true, dismissedBy: userId, dismissedAt: new Date() })
    .where(eq(biasAlerts.id, alertId));
}

export async function dismissBiasAlertForOrg(
  alertId: number,
  orgId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(biasAlerts)
    .set({ dismissed: true, dismissedBy: userId, dismissedAt: new Date() })
    .where(and(eq(biasAlerts.id, alertId), eq(biasAlerts.orgId, orgId)));
  return Number(result[0].affectedRows) === 1;
}

export async function getUserBiasProfile(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(biasProfiles)
    .where(eq(biasProfiles.userId, userId));
}

export async function upsertBiasProfile(
  userId: number,
  orgId: number | null,
  biasType: string,
  severityNumeric: number
) {
  const db = await getDb();
  if (!db) return;
  // Check if profile exists
  const existing = await db.select().from(biasProfiles)
    .where(and(
      eq(biasProfiles.userId, userId),
      eq(biasProfiles.biasType, biasType),
    ));

  if (existing.length > 0) {
    const prev = existing[0];
    const newCount = (prev.occurrenceCount || 0) + 1;
    const prevAvg = Number(prev.avgSeverity || 0);
    const newAvg = ((prevAvg * (newCount - 1)) + severityNumeric) / newCount;
    const trend = newAvg > prevAvg + 0.1 ? "increasing" : newAvg < prevAvg - 0.1 ? "decreasing" : "stable";
    await db.update(biasProfiles)
      .set({
        occurrenceCount: newCount,
        lastDetectedAt: new Date(),
        avgSeverity: String(newAvg.toFixed(2)) as any,
        trend: trend as any,
      })
      .where(eq(biasProfiles.id, prev.id));
  } else {
    await db.insert(biasProfiles).values({
      userId,
      orgId,
      biasType,
      occurrenceCount: 1,
      lastDetectedAt: new Date(),
      avgSeverity: String(severityNumeric.toFixed(2)) as any,
      trend: "stable",
    });
  }
}

export async function getProjectEvaluationHistory(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scoreMatrices)
    .where(eq(scoreMatrices.projectId, projectId))
    .orderBy(desc(scoreMatrices.computedAt));
}

export async function getUserOverrideStats(projectId: number) {
  const db = await getDb();
  if (!db) return { count: 0, netEffect: 0 };
  const overrides = await db.select().from(overrideRecords)
    .where(eq(overrideRecords.projectId, projectId));
  const count = overrides.length;
  const netEffect = overrides.reduce((sum: number, o: any) => {
    const delta = Number(o.newValue || 0) - Number(o.originalValue || 0);
    return sum + delta;
  }, 0);
  return { count, netEffect };
}

// ─── Phase 1: Smart Design Brain DB Functions ───────────────────────────────

export async function getMaterialLibrary() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialLibrary).where(eq(materialLibrary.isActive, true));
}

export async function createSpaceRecommendation(data: typeof spaceRecommendations.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(spaceRecommendations).values(data);
}

export async function clearSpaceRecommendations(projectId: number, orgId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(spaceRecommendations)
    .where(and(
      eq(spaceRecommendations.projectId, projectId),
      eq(spaceRecommendations.orgId, orgId)
    ));
}

export async function replaceSpaceRecommendationsForOrg(
  projectId: number,
  orgId: number,
  recommendations: (typeof spaceRecommendations.$inferInsert)[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (
      project.length !== 1 ||
      recommendations.some(row => row.projectId !== projectId || row.orgId !== orgId)
    ) return false;
    await tx.delete(spaceRecommendations).where(and(
      eq(spaceRecommendations.projectId, projectId),
      eq(spaceRecommendations.orgId, orgId)
    ));
    if (recommendations.length > 0) {
      await tx.insert(spaceRecommendations).values(recommendations);
    }
    return true;
  });
}

export async function getSpaceRecommendations(projectId: number, orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(spaceRecommendations)
    .where(and(
      eq(spaceRecommendations.projectId, projectId),
      eq(spaceRecommendations.orgId, orgId)
    ))
    .orderBy(spaceRecommendations.roomId);
}

export async function createDesignPackage(data: typeof designPackages.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(designPackages).values(data);
  return { id: result[0].insertId };
}

export async function createDesignPackageForOrg(
  projectId: number,
  orgId: number,
  data: typeof designPackages.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1 || data.orgId !== orgId) return null;
    const result = await tx.insert(designPackages).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getDesignPackages(typology?: string, tier?: string) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(designPackages).where(eq(designPackages.isActive, true));
  // Note: additional filtering done in-memory for simplicity
  const results = await query;
  return results.filter((p: any) => {
    if (typology && p.typology !== typology) return false;
    if (tier && p.tier !== tier) return false;
    return true;
  });
}

export async function createAiDesignBrief(data: typeof aiDesignBriefs.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiDesignBriefs).values(data);
}

export async function createAiDesignBriefForOrg(
  data: typeof aiDesignBriefs.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1 || data.orgId !== orgId) return false;
    await tx.insert(aiDesignBriefs).values(data);
    return true;
  });
}

export async function getLatestAiDesignBrief(projectId: number, orgId: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(aiDesignBriefs)
    .where(and(
      eq(aiDesignBriefs.projectId, projectId),
      eq(aiDesignBriefs.orgId, orgId)
    ))
    .orderBy(desc(aiDesignBriefs.generatedAt))
    .limit(1);
  return results[0] || null;
}

/** Phase 5 alias — get the latest brief for a project (no orgId check, for internal use). */
export async function getAiDesignBrief(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(aiDesignBriefs)
    .where(eq(aiDesignBriefs.projectId, projectId))
    .orderBy(desc(aiDesignBriefs.generatedAt))
    .limit(1);
  return results[0] || null;
}

export async function getAiDesignBriefById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(aiDesignBriefs).where(eq(aiDesignBriefs.id, id)).limit(1);
  return rows[0] || null;
}

/** Phase 5 — Store a share token and expiry date on a brief. */
export async function updateAiDesignBriefShareToken(briefId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiDesignBriefs)
    .set({ shareToken: token, shareExpiresAt: expiresAt })
    .where(eq(aiDesignBriefs.id, briefId));
}

export async function updateAiDesignBriefShareTokenForOrg(
  briefId: number,
  projectId: number,
  orgId: number,
  token: string,
  expiresAt: Date
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const rows = await tx.select({ id: aiDesignBriefs.id }).from(aiDesignBriefs)
      .innerJoin(projects, eq(projects.id, aiDesignBriefs.projectId))
      .where(and(
        eq(aiDesignBriefs.id, briefId),
        eq(aiDesignBriefs.projectId, projectId),
        eq(aiDesignBriefs.orgId, orgId),
        eq(projects.id, projectId),
        eq(projects.orgId, orgId),
      ))
      .limit(1)
      .for("update");
    if (!rows[0]) return false;

    const result = await tx.update(aiDesignBriefs)
      .set({ shareToken: token, shareExpiresAt: expiresAt })
      .where(and(
        eq(aiDesignBriefs.id, briefId),
        eq(aiDesignBriefs.projectId, projectId),
        eq(aiDesignBriefs.orgId, orgId),
        sql`exists (
          select 1 from ${projects}
          where ${projects.id} = ${projectId}
            and ${projects.orgId} = ${orgId}
        )`,
      ));
    return Number(result[0].affectedRows) === 1;
  });
}

export async function createFloorPlanAssetAndLinkForOrg(
  data: typeof projectAssets.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: typeof db) => {
    const owned = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (!owned[0]) return null;

    const assetResult = await tx.insert(projectAssets).values(data);
    const assetId = Number(assetResult[0].insertId);
    const projectResult = await tx.update(projects)
      .set({ floorPlanAssetId: assetId })
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)));
    if (Number(projectResult[0].affectedRows) !== 1) {
      throw new Error("Floor-plan project link lost authorization");
    }
    return { id: assetId };
  });
}

/** Phase 5 — Resolve share token → brief row (used by public resolveShareLink endpoint). */
export async function getAiDesignBriefByShareToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(aiDesignBriefs)
    .where(eq(aiDesignBriefs.shareToken, token))
    .limit(1);
  return results[0] || null;
}


// ─── Material Constants (P3 — Structural Analytics) ─────────────────────────

/** Returns all seeded material constants (AED/m², carbon intensity, density). */
export async function getMaterialConstants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialConstants).orderBy(materialConstants.materialType);
}

/** Look up a single material constant by type string, e.g. "concrete", "stone". */
export async function getMaterialConstantByType(materialType: string) {
  const db = await getDb();
  if (!db) return undefined;
  const results = await db.select().from(materialConstants)
    .where(eq(materialConstants.materialType, materialType))
    .limit(1);
  return results[0];
}

// ─── Phase 4: Market Grounding ───────────────────────────────────────────────

/**
 * Get design trends, optionally filtered by style classification and region.
 * Returns established > emerging > declining, sorted by mentionCount.
 */
export async function getDesignTrends(filters?: {
  styleClassification?: string;
  region?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.region) conditions.push(eq(designTrends.region, filters.region));
  if (filters?.styleClassification) conditions.push(eq(designTrends.styleClassification, filters.styleClassification));
  const query = db.select().from(designTrends);
  if (conditions.length > 0) query.where(and(...conditions));
  const rows = await query.orderBy(desc(designTrends.mentionCount)).limit(filters?.limit ?? 30);
  return rows;
}

export async function getPublicDesignTrends(filters?: {
  styleClassification?: string;
  region?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(designTrends.corpusScope, "platform_public")];
  if (filters?.region) conditions.push(eq(designTrends.region, filters.region));
  if (filters?.styleClassification) conditions.push(eq(designTrends.styleClassification, filters.styleClassification));
  return db.select().from(designTrends)
    .where(and(...conditions))
    .orderBy(desc(designTrends.mentionCount))
    .limit(filters?.limit ?? 30);
}

export async function getPublicDecisionPatterns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(decisionPatterns)
    .where(eq(decisionPatterns.corpusScope, "platform_public"))
    .orderBy(decisionPatterns.id);
}

export async function getGovernedAccuracySnapshots(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accuracySnapshots)
    .where(eq(accuracySnapshots.corpusScope, "platform_public"))
    .orderBy(desc(accuracySnapshots.snapshotDate))
    .limit(limit);
}

export async function getGovernedBenchmarkSuggestions(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(benchmarkSuggestions.corpusScope, "platform_public")];
  if (status) conditions.push(eq(benchmarkSuggestions.status, status as any));
  return db.select().from(benchmarkSuggestions)
    .where(and(...conditions))
    .orderBy(desc(benchmarkSuggestions.createdAt));
}

export async function getGovernedLogicChangeLog(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(logicChangeLog.corpusScope, "platform_public")];
  if (status) conditions.push(eq(logicChangeLog.status, status as any));
  return db.select().from(logicChangeLog)
    .where(and(...conditions))
    .orderBy(desc(logicChangeLog.createdAt));
}

/**
 * Find the best-matching benchmark row for a given project typology/location/tier.
 * Falls back progressively if no exact match (relaxes location, then typology).
 */
export async function getBenchmarkForProject(typology: string, location: string, marketTier: string) {
  const db = await getDb();
  if (!db) return null;
  // 1. Exact match
  const exact = await db.select().from(benchmarkData)
    .where(and(
      eq(benchmarkData.typology, typology),
      eq(benchmarkData.location, location),
      eq(benchmarkData.marketTier, marketTier),
    ))
    .limit(1);
  if (exact.length > 0) return exact[0];

  // 2. Relax location
  const noLoc = await db.select().from(benchmarkData)
    .where(and(eq(benchmarkData.typology, typology), eq(benchmarkData.marketTier, marketTier)))
    .limit(1);
  if (noLoc.length > 0) return noLoc[0];

  // 3. Relax typology too — just match tier
  const justTier = await db.select().from(benchmarkData)
    .where(eq(benchmarkData.marketTier, marketTier))
    .limit(1);
  return justTier[0] ?? null;
}

/**
 * Get active, whitelisted source registry entries for competitor context display.
 * Sorts by reliability (A > B > C) then most recently fetched.
 */

export async function getEvidenceWithSources(filters: {
  orgId: number;
  category?: string;
  projectId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  conditions.push(eq(evidenceRecords.orgId, filters.orgId));
  if (filters.category) conditions.push(eq(evidenceRecords.category, filters.category as any));
  if (filters.projectId) conditions.push(eq(evidenceRecords.projectId, filters.projectId));
  // Exclude confidential records from public provenance display
  conditions.push(sql`${evidenceRecords.confidentiality} NOT IN ('confidential', 'restricted')`);

  let query = db
    .select({
      id: evidenceRecords.id,
      recordId: evidenceRecords.recordId,
      category: evidenceRecords.category,
      itemName: evidenceRecords.itemName,
      specClass: evidenceRecords.specClass,
      priceMin: evidenceRecords.priceMin,
      priceTypical: evidenceRecords.priceTypical,
      priceMax: evidenceRecords.priceMax,
      unit: evidenceRecords.unit,
      currencyAed: evidenceRecords.currencyAed,
      reliabilityGrade: evidenceRecords.reliabilityGrade,
      extractedSnippet: evidenceRecords.extractedSnippet,
      captureDate: evidenceRecords.captureDate,
      evidencePhase: evidenceRecords.evidencePhase,
      sourceUrl: evidenceRecords.sourceUrl,
      // Joined source fields
      sourceName: sourceRegistry.name,
      sourceType: sourceRegistry.sourceType,
      sourceReliability: sourceRegistry.reliabilityDefault,
      sourcePageUrl: sourceRegistry.url,
      sourceLastFetch: sourceRegistry.lastSuccessfulFetch,
    })
    .from(evidenceRecords)
    .leftJoin(sourceRegistry, eq(evidenceRecords.sourceRegistryId, sourceRegistry.id));

  if (conditions.length > 0) {
    query = (query as any).where(and(...conditions));
  }

  return (query as any)
    .orderBy(desc(evidenceRecords.captureDate))
    .limit(filters.limit ?? 20);
}

export async function getActiveSourceRegistry(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: sourceRegistry.id,
    name: sourceRegistry.name,
    url: sourceRegistry.url,
    sourceType: sourceRegistry.sourceType,
    reliabilityDefault: sourceRegistry.reliabilityDefault,
    region: sourceRegistry.region,
    lastSuccessfulFetch: sourceRegistry.lastSuccessfulFetch,
    lastScrapedStatus: sourceRegistry.lastScrapedStatus,
    lastRecordCount: sourceRegistry.lastRecordCount,
    notes: sourceRegistry.notes,
  }).from(sourceRegistry)
    .where(and(eq(sourceRegistry.isWhitelisted, true), eq(sourceRegistry.isActive, true)))
    .orderBy(asc(sourceRegistry.reliabilityDefault), desc(sourceRegistry.lastSuccessfulFetch))
    .limit(limit);
  return rows;
}

// ─── PDF Extractions (V4 — Fit-out Oracle) ──────────────────────────────────

export async function createPdfExtraction(data: typeof pdfExtractions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(pdfExtractions).values(data);
  return { id: Number(result.insertId) };
}

export async function createPdfExtractionForOrg(
  data: typeof pdfExtractions.$inferInsert,
  orgId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (project.length !== 1) return null;
    const result = await tx.insert(pdfExtractions).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getPdfExtractionsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pdfExtractions)
    .where(eq(pdfExtractions.projectId, projectId))
    .orderBy(desc(pdfExtractions.createdAt));
}

export async function getPdfExtractionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(pdfExtractions).where(eq(pdfExtractions.id, id));
  return rows[0];
}

export async function updatePdfExtraction(
  id: number,
  data: Partial<{
    status: "pending" | "extracted" | "verified" | "rejected";
    extractedRooms: any;
    totalExtractedArea: string;
    verifiedBy: number;
    verifiedAt: Date;
  }>
) {
  const db = await getDb();
  if (!db) return;
  return db.update(pdfExtractions).set(data as any).where(eq(pdfExtractions.id, id));
}

export async function updatePdfExtractionForOrg(
  id: number,
  orgId: number,
  data: Parameters<typeof updatePdfExtraction>[1]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const extraction = await tx.select({ id: pdfExtractions.id })
      .from(pdfExtractions)
      .innerJoin(projects, eq(pdfExtractions.projectId, projects.id))
      .where(and(eq(pdfExtractions.id, id), eq(projects.orgId, orgId)))
      .limit(1)
      .for("update");
    if (extraction.length !== 1) return false;
    const result = await tx.update(pdfExtractions)
      .set(data as any)
      .where(eq(pdfExtractions.id, id));
    return Number(result[0].affectedRows) === 1;
  });
}

export async function verifyPdfExtractionForOrg(
  id: number,
  projectId: number,
  orgId: number,
  userId: number,
  verifiedArea: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const extraction = await tx.select({ id: pdfExtractions.id })
      .from(pdfExtractions)
      .innerJoin(projects, eq(pdfExtractions.projectId, projects.id))
      .where(and(
        eq(pdfExtractions.id, id),
        eq(pdfExtractions.projectId, projectId),
        eq(projects.orgId, orgId)
      ))
      .limit(1)
      .for("update");
    if (extraction.length !== 1) return false;
    await tx.update(pdfExtractions).set({
      status: "verified",
      verifiedBy: userId,
      verifiedAt: new Date(),
    }).where(eq(pdfExtractions.id, id));
    const result = await tx.update(projects).set({
      fitoutAreaVerified: true,
      totalFitoutArea: String(verifiedArea),
    }).where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)));
    return Number(result[0].affectedRows) === 1;
  });
}

export async function updateProjectVerification(
  projectId: number,
  data: { fitoutAreaVerified?: boolean; totalFitoutArea?: number }
) {
  const db = await getDb();
  if (!db) return;
  const updates: any = {};
  if (data.fitoutAreaVerified !== undefined) updates.fitoutAreaVerified = data.fitoutAreaVerified;
  if (data.totalFitoutArea !== undefined) updates.totalFitoutArea = String(data.totalFitoutArea);
  return db.update(projects).set(updates).where(eq(projects.id, projectId));
}

export async function updateProjectVerificationForOrg(
  projectId: number,
  orgId: number,
  data: { fitoutAreaVerified?: boolean; totalFitoutArea?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updates: any = {};
  if (data.fitoutAreaVerified !== undefined) updates.fitoutAreaVerified = data.fitoutAreaVerified;
  if (data.totalFitoutArea !== undefined) updates.totalFitoutArea = String(data.totalFitoutArea);
  const result = await db.update(projects)
    .set(updates)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)));
  return Number(result[0].affectedRows) === 1;
}

// ─── MIYAR 3.0 Phase A — Material Quantity Intelligence ────────────────────

export async function getMaterialAllocations(projectId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialAllocations)
    .where(and(
      eq(materialAllocations.projectId, projectId),
      eq(materialAllocations.organizationId, organizationId)
    ))
    .orderBy(materialAllocations.roomId, materialAllocations.element);
}

export async function insertMaterialAllocations(data: (typeof materialAllocations.$inferInsert)[]) {
  const db = await getDb();
  if (!db) return;
  if (data.length === 0) return;
  return db.insert(materialAllocations).values(data);
}

export async function replaceMaterialAllocationsForOrg(
  projectId: number,
  organizationId: number,
  data: (typeof materialAllocations.$inferInsert)[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.orgId, organizationId)
      ))
      .limit(1)
      .for("update");
    if (project.length !== 1) return false;
    await tx.delete(materialAllocations).where(and(
      eq(materialAllocations.projectId, projectId),
      eq(materialAllocations.organizationId, organizationId),
      eq(materialAllocations.isLocked, false)
    ));
    if (data.length > 0) {
      if (data.some(row =>
        row.projectId !== projectId ||
        row.organizationId !== organizationId
      )) return false;
      await tx.insert(materialAllocations).values(data);
    }
    return true;
  });
}

export async function deleteMaterialAllocations(projectId: number, organizationId: number, excludeLockedIds?: number[]) {
  const db = await getDb();
  if (!db) return;
  const conditions = [
    eq(materialAllocations.projectId, projectId),
    eq(materialAllocations.organizationId, organizationId),
  ];
  if (excludeLockedIds && excludeLockedIds.length > 0) {
    // Only delete non-locked allocations
    conditions.push(eq(materialAllocations.isLocked, false));
  }
  return db.delete(materialAllocations).where(and(...conditions));
}

export async function updateMaterialAllocation(
  id: number,
  data: Partial<{
    allocationPct: string;
    surfaceAreaM2: string;
    unitCostMin: string;
    unitCostMax: string;
    totalCostMin: string;
    totalCostMax: string;
    isLocked: boolean;
  }>
) {
  const db = await getDb();
  if (!db) return;
  return db.update(materialAllocations).set(data as any).where(eq(materialAllocations.id, id));
}

export async function getMaterialAllocationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(materialAllocations)
    .where(eq(materialAllocations.id, id))
    .limit(1);
  return rows[0];
}

export async function updateMaterialAllocationForOrg(
  id: number,
  organizationId: number,
  data: Partial<{
    allocationPct: string;
    surfaceAreaM2: string;
    unitCostMin: string;
    unitCostMax: string;
    totalCostMin: string;
    totalCostMax: string;
    isLocked: boolean;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(materialAllocations)
    .set(data as any)
    .where(and(
      eq(materialAllocations.id, id),
      eq(materialAllocations.organizationId, organizationId)
    ));
  return Number(result[0].affectedRows) === 1;
}

export async function lockMaterialAllocations(projectId: number, organizationId: number, isLocked: boolean) {
  const db = await getDb();
  if (!db) return;
  return db.update(materialAllocations)
    .set({ isLocked })
    .where(and(
      eq(materialAllocations.projectId, projectId),
      eq(materialAllocations.organizationId, organizationId)
    ));
}

export async function getMaterialSupplierSources(organizationId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId) {
    return db.select().from(materialSupplierSources)
      .where(and(
        eq(materialSupplierSources.isActive, true),
        eq(materialSupplierSources.organizationId, organizationId)
      ))
      .orderBy(materialSupplierSources.supplierName);
  }
  return db.select().from(materialSupplierSources)
    .where(eq(materialSupplierSources.isActive, true))
    .orderBy(materialSupplierSources.supplierName);
}

export async function insertMaterialSupplierSource(data: typeof materialSupplierSources.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(materialSupplierSources).values(data);
  return { id: Number(result.insertId) };
}

export async function updateMaterialSupplierSource(
  id: number,
  data: Partial<{
    lastScrapedAt: Date;
    lastPriceAedMin: string;
    lastPriceAedMax: string;
  }>
) {
  const db = await getDb();
  if (!db) return;
  return db.update(materialSupplierSources).set(data as any).where(eq(materialSupplierSources.id, id));
}

export async function getMaterialSupplierSourceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(materialSupplierSources)
    .where(eq(materialSupplierSources.id, id))
    .limit(1);
  return rows[0];
}

export async function updateMaterialSupplierSourceForOrg(
  id: number,
  organizationId: number,
  data: Partial<{
    lastScrapedAt: Date;
    lastPriceAedMin: string;
    lastPriceAedMax: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(materialSupplierSources)
    .set(data as any)
    .where(and(
      eq(materialSupplierSources.id, id),
      eq(materialSupplierSources.organizationId, organizationId)
    ));
  return Number(result[0].affectedRows) === 1;
}

// ─── MIYAR 3.0 Phase B — Space Program Intelligence ────────────────────────

export async function getSpaceProgramRooms(projectId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(spaceProgramRooms)
    .where(and(
      eq(spaceProgramRooms.projectId, projectId),
      eq(spaceProgramRooms.organizationId, organizationId)
    ))
    .orderBy(spaceProgramRooms.sortOrder);
}

export async function insertSpaceProgramRooms(data: (typeof spaceProgramRooms.$inferInsert)[]) {
  const db = await getDb();
  if (!db) return;
  if (data.length === 0) return;
  return db.insert(spaceProgramRooms).values(data);
}

export async function insertSpaceProgramRoomForOrg(
  data: typeof spaceProgramRooms.$inferInsert,
  organizationId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(
        eq(projects.id, data.projectId),
        eq(projects.orgId, organizationId)
      ))
      .limit(1)
      .for("update");
    if (
      project.length !== 1 ||
      data.organizationId !== organizationId
    ) return false;
    await tx.insert(spaceProgramRooms).values(data);
    return true;
  });
}

export async function getSpaceProgramRoomById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(spaceProgramRooms)
    .where(eq(spaceProgramRooms.id, id))
    .limit(1);
  return rows[0];
}

export async function updateSpaceProgramRoom(
  id: number,
  data: Partial<{
    roomName: string;
    category: string;
    sqm: string;
    floorLevel: string | null;
    isFitOut: boolean;
    fitOutOverridden: boolean;
    fitOutReason: string | null;
    finishGrade: string;
    priority: string;
    budgetPct: string | null;
    sortOrder: number;
    blockName: string;
    blockTypology: string;
  }>
) {
  const db = await getDb();
  if (!db) return;
  return db.update(spaceProgramRooms).set(data as any).where(eq(spaceProgramRooms.id, id));
}

export async function updateSpaceProgramRoomForOrg(
  id: number,
  organizationId: number,
  data: Parameters<typeof updateSpaceProgramRoom>[1]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.update(spaceProgramRooms)
    .set(data as any)
    .where(and(
      eq(spaceProgramRooms.id, id),
      eq(spaceProgramRooms.organizationId, organizationId)
    ));
  return Number(result[0].affectedRows) === 1;
}

export async function deleteSpaceProgramRoom(id: number) {
  const db = await getDb();
  if (!db) return;
  // Also delete associated amenity sub-spaces
  await db.delete(amenitySubSpaces).where(eq(amenitySubSpaces.spaceProgramRoomId, id));
  return db.delete(spaceProgramRooms).where(eq(spaceProgramRooms.id, id));
}

export async function deleteSpaceProgramRoomForOrg(
  id: number,
  organizationId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const rows = await tx.select({ id: spaceProgramRooms.id })
      .from(spaceProgramRooms)
      .where(and(
        eq(spaceProgramRooms.id, id),
        eq(spaceProgramRooms.organizationId, organizationId)
      ))
      .limit(1)
      .for("update");
    if (rows.length !== 1) return false;
    await tx.delete(amenitySubSpaces)
      .where(eq(amenitySubSpaces.spaceProgramRoomId, id));
    const result = await tx.delete(spaceProgramRooms)
      .where(and(
        eq(spaceProgramRooms.id, id),
        eq(spaceProgramRooms.organizationId, organizationId)
      ));
    return Number(result[0].affectedRows) === 1;
  });
}

export async function getAmenitySubSpacesForRoom(spaceProgramRoomId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(amenitySubSpaces)
    .where(eq(amenitySubSpaces.spaceProgramRoomId, spaceProgramRoomId));
}

export async function insertAmenitySubSpaces(data: (typeof amenitySubSpaces.$inferInsert)[]) {
  const db = await getDb();
  if (!db) return;
  if (data.length === 0) return;
  return db.insert(amenitySubSpaces).values(data);
}

export async function replaceSpaceProgramRoomsForOrg(
  projectId: number,
  organizationId: number,
  rooms: (typeof spaceProgramRooms.$inferInsert)[],
  amenities: Array<{
    roomCode: string;
    subSpaces: Array<Omit<typeof amenitySubSpaces.$inferInsert, "spaceProgramRoomId">>;
  }>,
  preserveOverridden = true
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const project = await tx.select({ id: projects.id })
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.orgId, organizationId)
      ))
      .limit(1)
      .for("update");
    if (project.length !== 1) return null;

    const deleteConditions = [
      eq(spaceProgramRooms.projectId, projectId),
      eq(spaceProgramRooms.organizationId, organizationId),
    ];
    if (preserveOverridden) {
      deleteConditions.push(eq(spaceProgramRooms.fitOutOverridden, false));
    }
    const deleting = await tx.select({ id: spaceProgramRooms.id })
      .from(spaceProgramRooms)
      .where(and(...deleteConditions))
      .for("update");
    const deletingIds = deleting.map((row: { id: number }) => row.id);
    if (deletingIds.length > 0) {
      await tx.delete(amenitySubSpaces)
        .where(inArray(amenitySubSpaces.spaceProgramRoomId, deletingIds));
      await tx.delete(spaceProgramRooms).where(and(...deleteConditions));
    }

    if (rooms.some(room =>
      room.projectId !== projectId ||
      room.organizationId !== organizationId
    )) return null;
    if (rooms.length > 0) await tx.insert(spaceProgramRooms).values(rooms);

    const storedRooms = await tx.select().from(spaceProgramRooms)
      .where(and(
        eq(spaceProgramRooms.projectId, projectId),
        eq(spaceProgramRooms.organizationId, organizationId)
      ));
    const roomByCode = new Map<string, typeof spaceProgramRooms.$inferSelect>(
      storedRooms.map((room: typeof spaceProgramRooms.$inferSelect) => [
        room.roomCode,
        room,
      ])
    );
    const subSpaces = amenities.flatMap(amenity => {
      const room = roomByCode.get(amenity.roomCode);
      if (!room) return [];
      return amenity.subSpaces.map(subSpace => ({
        ...subSpace,
        spaceProgramRoomId: room.id,
      }));
    });
    if (subSpaces.length > 0) {
      await tx.insert(amenitySubSpaces).values(subSpaces);
    }
    return storedRooms;
  });
}

export async function insertPortfolioAlertsForOrg(input: {
  portfolioId: number;
  orgId: number;
  alerts: (typeof portfolioAlerts.$inferInsert)[];
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx: any) => {
    const portfolio = await tx.select({ id: portfolios.id })
      .from(portfolios)
      .where(and(
        eq(portfolios.id, input.portfolioId),
        eq(portfolios.organizationId, input.orgId)
      ))
      .limit(1)
      .for("update");
    if (portfolio.length !== 1) return null;

    const links = await tx.select({ projectId: portfolioProjects.projectId })
      .from(portfolioProjects)
      .where(eq(portfolioProjects.portfolioId, input.portfolioId))
      .for("update");
    const projectIds: number[] = Array.from(new Set<number>(
      links.map((row: { projectId: number }) => row.projectId)
    ));
    if (projectIds.length > 0) {
      const ownedProjects = await tx.select({ id: projects.id })
        .from(projects)
        .where(and(
          inArray(projects.id, projectIds),
          eq(projects.orgId, input.orgId)
        ))
        .for("update");
      if (ownedProjects.length !== projectIds.length) return null;
    }

    const valid = input.alerts.every(alert => {
      const affected = Array.isArray(alert.affectedProjectIds)
        ? alert.affectedProjectIds as number[]
        : [];
      return alert.organizationId === input.orgId &&
        alert.portfolioId === input.portfolioId &&
        Boolean(alert.activeDedupKey) &&
        affected.every(id => projectIds.includes(id));
    });
    if (!valid) return null;

    await tx.update(portfolioAlerts)
      .set({ status: "expired", activeDedupKey: null })
      .where(and(
        eq(portfolioAlerts.organizationId, input.orgId),
        eq(portfolioAlerts.portfolioId, input.portfolioId),
        eq(portfolioAlerts.status, "active"),
        sql`${portfolioAlerts.expiresAt} <= now()`
      ));

    const inserted: (typeof portfolioAlerts.$inferSelect)[] = [];
    for (const alert of input.alerts) {
      const result = await tx.insert(portfolioAlerts)
        .ignore()
        .values(alert);
      if (Number(result[0].affectedRows) === 1) {
        const rows = await tx.select().from(portfolioAlerts)
          .where(eq(portfolioAlerts.id, Number(result[0].insertId)))
          .limit(1);
        if (rows[0]) inserted.push(rows[0]);
      }
    }
    return inserted;
  });
}

export async function resetSpaceProgramRooms(
  projectId: number,
  organizationId: number,
  preserveOverridden: boolean = true
) {
  const db = await getDb();
  if (!db) return;

  if (preserveOverridden) {
    // Only delete rooms where fitOutOverridden = false (developer hasn't manually toggled)
    // First, clean up amenity sub-spaces for non-overridden rooms
    const nonOverridden = await db.select({ id: spaceProgramRooms.id }).from(spaceProgramRooms)
      .where(and(
        eq(spaceProgramRooms.projectId, projectId),
        eq(spaceProgramRooms.organizationId, organizationId),
        eq(spaceProgramRooms.fitOutOverridden, false)
      ));
    const idsToDelete = nonOverridden.map((r: { id: number }) => r.id);
    if (idsToDelete.length > 0) {
      for (const roomId of idsToDelete) {
        await db.delete(amenitySubSpaces).where(eq(amenitySubSpaces.spaceProgramRoomId, roomId));
      }
      await db.delete(spaceProgramRooms).where(and(
        eq(spaceProgramRooms.projectId, projectId),
        eq(spaceProgramRooms.organizationId, organizationId),
        eq(spaceProgramRooms.fitOutOverridden, false)
      ));
    }
  } else {
    // Full wipe — delete all rooms and sub-spaces for this project
    const allRooms = await db.select({ id: spaceProgramRooms.id }).from(spaceProgramRooms)
      .where(and(
        eq(spaceProgramRooms.projectId, projectId),
        eq(spaceProgramRooms.organizationId, organizationId)
      ));
    for (const room of allRooms) {
      await db.delete(amenitySubSpaces).where(eq(amenitySubSpaces.spaceProgramRoomId, room.id));
    }
    await db.delete(spaceProgramRooms).where(and(
      eq(spaceProgramRooms.projectId, projectId),
      eq(spaceProgramRooms.organizationId, organizationId)
    ));
  }
}
