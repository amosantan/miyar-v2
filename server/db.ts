import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
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
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  if (benchmarks.length === 0) return 400;
  const avg = benchmarks.reduce((sum, b) => sum + Number(b.costPerSqftMid ?? 400), 0) / benchmarks.length;
  return avg;
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
  const oldKeys = new Set(oldData.map(d => `${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`));
  const newKeys = new Set(newData.map(d => `${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`));
  let added = 0, removed = 0, changed = 0;
  newKeys.forEach(k => { if (!oldKeys.has(k)) added++; });
  oldKeys.forEach(k => { if (!newKeys.has(k)) removed++; });
  // For shared keys, compare cost mid values
  const oldMap = new Map(oldData.map(d => [`${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`, d]));
  const newMap = new Map(newData.map(d => [`${d.typology}-${d.location}-${d.marketTier}-${d.materialLevel}`, d]));
  oldKeys.forEach(k => {
    if (newKeys.has(k)) {
      const o = oldMap.get(k);
      const n = newMap.get(k);
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
  return all.filter(w => {
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
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
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
