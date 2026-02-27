import { eq, and, desc, asc, sql, inArray, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import {
  InsertUser,
  users,
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
  benchmarkSuggestions,
  sourceRegistry,
  evidenceRecords,
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;

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
        ssl: { rejectUnauthorized: true },
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

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projects).where(eq(projects.id, id));
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

// ─── Scenarios ───────────────────────────────────────────────────────────────

export async function createScenarioRecord(data: typeof scenarios.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(scenarios).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getScenariosByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scenarios).where(eq(scenarios.projectId, projectId));
}

export async function deleteScenario(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(scenarios).where(eq(scenarios.id, id));
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

export async function updateProjectAsset(id: number, data: Partial<typeof projectAssets.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projectAssets).set(data).where(eq(projectAssets.id, id));
}

// ─── Asset Links (V2.8) ─────────────────────────────────────────────────────

export async function createAssetLink(data: typeof assetLinks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(assetLinks).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getAssetLinksByAsset(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetLinks).where(eq(assetLinks.assetId, assetId));
}

export async function getAssetLinksByEntity(linkType: string, linkId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetLinks).where(
    and(eq(assetLinks.linkType, linkType as any), eq(assetLinks.linkId, linkId))
  );
}

export async function deleteAssetLink(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(assetLinks).where(eq(assetLinks.id, id));
  return { success: true };
}

// ─── Design Briefs (V2.8) ───────────────────────────────────────────────────

export async function createDesignBrief(data: typeof designBriefs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(designBriefs).values(data);
  return { id: Number(result[0].insertId) };
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

export async function getMaterialBoardsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialBoards).where(eq(materialBoards.projectId, projectId)).orderBy(desc(materialBoards.createdAt));
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

export async function getMaterialsByBoard(boardId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(materialsToBoards).where(eq(materialsToBoards.boardId, boardId)).orderBy(materialsToBoards.sortOrder);
}

export async function removeMaterialFromBoard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(materialsToBoards).where(eq(materialsToBoards.id, id));
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

export async function reorderBoardTiles(boardId: number, orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(materialsToBoards).set({ sortOrder: i }).where(eq(materialsToBoards.id, orderedIds[i]));
  }
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

export async function getProjectOutcomes(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectOutcomes)
    .where(eq(projectOutcomes.projectId, projectId))
    .orderBy(desc(projectOutcomes.capturedAt));
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

export async function deleteEvidenceRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(evidenceRecords).where(eq(evidenceRecords.id, id));
}

export async function getPreviousEvidenceRecord(itemName: string, sourceRegistryId: number, beforeDate: Date) {
  const db = await getDb();
  if (!db) return undefined;

  const query = db.select()
    .from(evidenceRecords)
    .where(
      and(
        eq(evidenceRecords.itemName, itemName),
        eq(evidenceRecords.sourceRegistryId, sourceRegistryId),
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

// ─── Trend Snapshots (V3 — Analytical Intelligence) ────────────────────────

export async function insertTrendSnapshot(data: typeof trendSnapshots.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(trendSnapshots).values(data);
  return result;
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

export async function insertProjectInsight(data: typeof projectInsights.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  return db.insert(projectInsights).values(data);
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

/** Phase 5 — Store a share token and expiry date on a brief. */
export async function updateAiDesignBriefShareToken(briefId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiDesignBriefs)
    .set({ shareToken: token, shareExpiresAt: expiresAt })
    .where(eq(aiDesignBriefs.id, briefId));
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
  category?: string;
  projectId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
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
