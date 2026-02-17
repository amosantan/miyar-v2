import { eq, and, desc, sql } from "drizzle-orm";
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
  reportInstances,
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
  // Deactivate all existing
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
  if (benchmarks.length === 0) return 400; // default fallback
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
