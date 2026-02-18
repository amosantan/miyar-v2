import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Model Versions ─────────────────────────────────────────────────────────
export const modelVersions = mysqlTable("model_versions", {
  id: int("id").autoincrement().primaryKey(),
  versionTag: varchar("versionTag", { length: 32 }).notNull().unique(),
  dimensionWeights: json("dimensionWeights").notNull(),
  variableWeights: json("variableWeights").notNull(),
  penaltyConfig: json("penaltyConfig").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  notes: text("notes"),
});

export type ModelVersion = typeof modelVersions.$inferSelect;
export type InsertModelVersion = typeof modelVersions.$inferInsert;

// ─── Benchmark Versions (V2) ───────────────────────────────────────────────
export const benchmarkVersions = mysqlTable("benchmark_versions", {
  id: int("id").autoincrement().primaryKey(),
  versionTag: varchar("versionTag", { length: 64 }).notNull().unique(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  publishedBy: int("publishedBy"),
  recordCount: int("recordCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
});

export type BenchmarkVersion = typeof benchmarkVersions.$inferSelect;
export type InsertBenchmarkVersion = typeof benchmarkVersions.$inferInsert;

// ─── Benchmark Categories (V2) ─────────────────────────────────────────────
export const benchmarkCategories = mysqlTable("benchmark_categories", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", [
    "materials",
    "finishes",
    "ffe",
    "procurement",
    "cost_bands",
    "tier_definitions",
    "style_families",
    "brand_archetypes",
    "risk_factors",
    "lead_times",
  ]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  market: varchar("market", { length: 64 }).default("UAE").notNull(),
  submarket: varchar("submarket", { length: 64 }).default("Dubai"),
  projectClass: mysqlEnum("projectClass", ["mid", "upper", "luxury", "ultra_luxury"]).notNull(),
  validFrom: timestamp("validFrom"),
  validTo: timestamp("validTo"),
  confidenceLevel: mysqlEnum("confidenceLevel", ["high", "medium", "low"]).default("medium"),
  sourceType: mysqlEnum("sourceType", ["manual", "admin", "imported", "curated"]).default("admin"),
  benchmarkVersionId: int("benchmarkVersionId"),
  // Data payload (flexible JSON for category-specific fields)
  data: json("data").notNull(),
  // Metadata
  versionTag: varchar("versionTag", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});

export type BenchmarkCategory = typeof benchmarkCategories.$inferSelect;
export type InsertBenchmarkCategory = typeof benchmarkCategories.$inferInsert;

// ─── Projects ────────────────────────────────────────────────────────────────
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", [
    "draft",
    "ready",
    "processing",
    "evaluated",
    "locked",
  ])
    .default("draft")
    .notNull(),

  // Context variables
  ctx01Typology: mysqlEnum("ctx01Typology", [
    "Residential",
    "Mixed-use",
    "Hospitality",
    "Office",
  ]).default("Residential"),
  ctx02Scale: mysqlEnum("ctx02Scale", ["Small", "Medium", "Large"]).default(
    "Medium"
  ),
  ctx03Gfa: decimal("ctx03Gfa", { precision: 12, scale: 2 }),
  ctx04Location: mysqlEnum("ctx04Location", [
    "Prime",
    "Secondary",
    "Emerging",
  ]).default("Secondary"),
  ctx05Horizon: mysqlEnum("ctx05Horizon", [
    "0-12m",
    "12-24m",
    "24-36m",
    "36m+",
  ]).default("12-24m"),

  // Strategy variables (1-5)
  str01BrandClarity: int("str01BrandClarity").default(3),
  str02Differentiation: int("str02Differentiation").default(3),
  str03BuyerMaturity: int("str03BuyerMaturity").default(3),

  // Market variables
  mkt01Tier: mysqlEnum("mkt01Tier", [
    "Mid",
    "Upper-mid",
    "Luxury",
    "Ultra-luxury",
  ]).default("Upper-mid"),
  mkt02Competitor: int("mkt02Competitor").default(3),
  mkt03Trend: int("mkt03Trend").default(3),

  // Financial variables
  fin01BudgetCap: decimal("fin01BudgetCap", { precision: 10, scale: 2 }),
  fin02Flexibility: int("fin02Flexibility").default(3),
  fin03ShockTolerance: int("fin03ShockTolerance").default(3),
  fin04SalesPremium: int("fin04SalesPremium").default(3),

  // Design variables
  des01Style: mysqlEnum("des01Style", [
    "Modern",
    "Contemporary",
    "Minimal",
    "Classic",
    "Fusion",
    "Other",
  ]).default("Modern"),
  des02MaterialLevel: int("des02MaterialLevel").default(3),
  des03Complexity: int("des03Complexity").default(3),
  des04Experience: int("des04Experience").default(3),
  des05Sustainability: int("des05Sustainability").default(2),

  // Execution variables
  exe01SupplyChain: int("exe01SupplyChain").default(3),
  exe02Contractor: int("exe02Contractor").default(3),
  exe03Approvals: int("exe03Approvals").default(2),
  exe04QaMaturity: int("exe04QaMaturity").default(3),

  // Add-on variables
  add01SampleKit: boolean("add01SampleKit").default(false),
  add02PortfolioMode: boolean("add02PortfolioMode").default(false),
  add03DashboardExport: boolean("add03DashboardExport").default(true),

  modelVersionId: int("modelVersionId"),
  benchmarkVersionId: int("benchmarkVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lockedAt: timestamp("lockedAt"),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Direction Candidates ────────────────────────────────────────────────────
export const directionCandidates = mysqlTable("direction_candidates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isPrimary: boolean("isPrimary").default(false),
  des01Style: mysqlEnum("des01Style", [
    "Modern",
    "Contemporary",
    "Minimal",
    "Classic",
    "Fusion",
    "Other",
  ]),
  des02MaterialLevel: int("des02MaterialLevel"),
  des03Complexity: int("des03Complexity"),
  des04Experience: int("des04Experience"),
  fin01BudgetCap: decimal("fin01BudgetCap", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DirectionCandidate = typeof directionCandidates.$inferSelect;
export type InsertDirectionCandidate = typeof directionCandidates.$inferInsert;

// ─── Score Matrices ──────────────────────────────────────────────────────────
export const scoreMatrices = mysqlTable("score_matrices", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  directionId: int("directionId"),
  modelVersionId: int("modelVersionId").notNull(),
  benchmarkVersionId: int("benchmarkVersionId"),
  saScore: decimal("saScore", { precision: 6, scale: 2 }).notNull(),
  ffScore: decimal("ffScore", { precision: 6, scale: 2 }).notNull(),
  mpScore: decimal("mpScore", { precision: 6, scale: 2 }).notNull(),
  dsScore: decimal("dsScore", { precision: 6, scale: 2 }).notNull(),
  erScore: decimal("erScore", { precision: 6, scale: 2 }).notNull(),
  compositeScore: decimal("compositeScore", {
    precision: 6,
    scale: 2,
  }).notNull(),
  riskScore: decimal("riskScore", { precision: 6, scale: 2 }).notNull(),
  rasScore: decimal("rasScore", { precision: 6, scale: 2 }).notNull(),
  confidenceScore: decimal("confidenceScore", {
    precision: 6,
    scale: 2,
  }).notNull(),
  decisionStatus: mysqlEnum("decisionStatus", [
    "validated",
    "conditional",
    "not_validated",
  ]).notNull(),
  penalties: json("penalties"),
  riskFlags: json("riskFlags"),
  dimensionWeights: json("dimensionWeights").notNull(),
  variableContributions: json("variableContributions").notNull(),
  conditionalActions: json("conditionalActions"),
  inputSnapshot: json("inputSnapshot").notNull(),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});

export type ScoreMatrix = typeof scoreMatrices.$inferSelect;
export type InsertScoreMatrix = typeof scoreMatrices.$inferInsert;

// ─── Scenarios ───────────────────────────────────────────────────────────────
export const scenarios = mysqlTable("scenarios", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  variableOverrides: json("variableOverrides"),
  isTemplate: boolean("isTemplate").default(false),
  templateKey: varchar("templateKey", { length: 64 }),
  scoreMatrixId: int("scoreMatrixId"),
  rasScore: decimal("rasScore", { precision: 6, scale: 2 }),
  isDominant: boolean("isDominant").default(false),
  stabilityScore: decimal("stabilityScore", { precision: 6, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = typeof scenarios.$inferInsert;

// ─── Benchmark Data (Expanded) ──────────────────────────────────────────────
export const benchmarkData = mysqlTable("benchmark_data", {
  id: int("id").autoincrement().primaryKey(),
  typology: varchar("typology", { length: 64 }).notNull(),
  location: varchar("location", { length: 64 }).notNull(),
  marketTier: varchar("marketTier", { length: 64 }).notNull(),
  materialLevel: int("materialLevel").notNull(),
  roomType: varchar("roomType", { length: 64 }).default("General"),
  // Cost benchmarks
  costPerSqftLow: decimal("costPerSqftLow", { precision: 10, scale: 2 }),
  costPerSqftMid: decimal("costPerSqftMid", { precision: 10, scale: 2 }),
  costPerSqftHigh: decimal("costPerSqftHigh", { precision: 10, scale: 2 }),
  avgSellingPrice: decimal("avgSellingPrice", { precision: 10, scale: 2 }),
  // Market benchmarks
  absorptionRate: decimal("absorptionRate", { precision: 6, scale: 4 }),
  competitiveDensity: int("competitiveDensity"),
  differentiationIndex: decimal("differentiationIndex", { precision: 6, scale: 4 }),
  // Risk multipliers
  complexityMultiplier: decimal("complexityMultiplier", { precision: 6, scale: 4 }),
  timelineRiskMultiplier: decimal("timelineRiskMultiplier", { precision: 6, scale: 4 }),
  // Buyer preferences
  buyerPreferenceWeights: json("buyerPreferenceWeights"),
  // Provenance
  sourceType: mysqlEnum("sourceType", [
    "synthetic",
    "client_provided",
    "curated",
  ]).default("synthetic"),
  sourceNote: text("sourceNote"),
  dataYear: int("dataYear"),
  region: varchar("region", { length: 64 }).default("UAE"),
  benchmarkVersionId: int("benchmarkVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BenchmarkData = typeof benchmarkData.$inferSelect;
export type InsertBenchmarkData = typeof benchmarkData.$inferInsert;

// ─── Project Intelligence Warehouse (V2) ───────────────────────────────────
export const projectIntelligence = mysqlTable("project_intelligence", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scoreMatrixId: int("scoreMatrixId").notNull(),
  benchmarkVersionId: int("benchmarkVersionId"),
  modelVersionId: int("modelVersionId"),
  // Derived features
  costDeltaVsBenchmark: decimal("costDeltaVsBenchmark", { precision: 10, scale: 2 }),
  uniquenessIndex: decimal("uniquenessIndex", { precision: 6, scale: 4 }),
  feasibilityFlags: json("feasibilityFlags"),
  reworkRiskIndex: decimal("reworkRiskIndex", { precision: 6, scale: 4 }),
  procurementComplexity: decimal("procurementComplexity", { precision: 6, scale: 4 }),
  // Portfolio analytics
  tierPercentile: decimal("tierPercentile", { precision: 6, scale: 4 }),
  styleFamily: varchar("styleFamily", { length: 64 }),
  costBand: varchar("costBand", { length: 32 }),
  // Snapshot
  inputSnapshot: json("inputSnapshot"),
  scoreSnapshot: json("scoreSnapshot"),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});

export type ProjectIntelligence = typeof projectIntelligence.$inferSelect;
export type InsertProjectIntelligence = typeof projectIntelligence.$inferInsert;

// ─── Report Instances ────────────────────────────────────────────────────────
export const reportInstances = mysqlTable("report_instances", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scoreMatrixId: int("scoreMatrixId").notNull(),
  reportType: mysqlEnum("reportType", [
    "executive_pack",
    "full_technical",
    "tender_brief",
    "executive_decision_pack",
    "design_brief_rfq",
    "marketing_starter",
    "validation_summary",
    "design_brief",
    "rfq_pack",
    "full_report",
  ]).notNull(),
  fileUrl: text("fileUrl"),
  bundleUrl: text("bundleUrl"),
  content: json("content"),
  benchmarkVersionId: int("benchmarkVersionId"),
  modelVersionId: int("modelVersionId"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  generatedBy: int("generatedBy"),
});

export type ReportInstance = typeof reportInstances.$inferSelect;
export type InsertReportInstance = typeof reportInstances.$inferInsert;

// ─── ROI Configurations (V2) ───────────────────────────────────────────────
export const roiConfigs = mysqlTable("roi_configs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  // Coefficients
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).default("350").notNull(),
  reworkCostPct: decimal("reworkCostPct", { precision: 6, scale: 4 }).default("0.12").notNull(),
  tenderIterationCost: decimal("tenderIterationCost", { precision: 10, scale: 2 }).default("25000").notNull(),
  designCycleCost: decimal("designCycleCost", { precision: 10, scale: 2 }).default("45000").notNull(),
  budgetVarianceMultiplier: decimal("budgetVarianceMultiplier", { precision: 6, scale: 4 }).default("0.08").notNull(),
  timeAccelerationWeeks: int("timeAccelerationWeeks").default(6),
  // Scenario multipliers
  conservativeMultiplier: decimal("conservativeMultiplier", { precision: 6, scale: 4 }).default("0.60").notNull(),
  aggressiveMultiplier: decimal("aggressiveMultiplier", { precision: 6, scale: 4 }).default("1.40").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
});

export type RoiConfig = typeof roiConfigs.$inferSelect;
export type InsertRoiConfig = typeof roiConfigs.$inferInsert;

// ─── Webhook Configurations (V2) ───────────────────────────────────────────
export const webhookConfigs = mysqlTable("webhook_configs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 255 }),
  events: json("events").notNull(), // e.g., ["project.evaluated", "report.generated"]
  fieldMapping: json("fieldMapping"), // maps MIYAR fields to CRM fields
  isActive: boolean("isActive").default(true).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastStatus: int("lastStatus"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
});

export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type InsertWebhookConfig = typeof webhookConfigs.$inferInsert;

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  details: json("details"),
  benchmarkVersionId: int("benchmarkVersionId"),
  modelVersionId: int("modelVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Override Records ────────────────────────────────────────────────────────
export const overrideRecords = mysqlTable("override_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  overrideType: mysqlEnum("overrideType", [
    "strategic",
    "market_insight",
    "risk_adjustment",
    "experimental",
  ]).notNull(),
  authorityLevel: int("authorityLevel").notNull(),
  originalValue: json("originalValue").notNull(),
  overrideValue: json("overrideValue").notNull(),
  justification: text("justification").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OverrideRecord = typeof overrideRecords.$inferSelect;
export type InsertOverrideRecord = typeof overrideRecords.$inferInsert;
