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
  data: json("data").notNull(),
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

  // Approval gate (V2.8)
  approvalState: mysqlEnum("approvalState", [
    "draft",
    "review",
    "approved_rfq",
    "approved_marketing",
  ]).default("draft"),

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
  costPerSqftLow: decimal("costPerSqftLow", { precision: 10, scale: 2 }),
  costPerSqftMid: decimal("costPerSqftMid", { precision: 10, scale: 2 }),
  costPerSqftHigh: decimal("costPerSqftHigh", { precision: 10, scale: 2 }),
  avgSellingPrice: decimal("avgSellingPrice", { precision: 10, scale: 2 }),
  absorptionRate: decimal("absorptionRate", { precision: 6, scale: 4 }),
  competitiveDensity: int("competitiveDensity"),
  differentiationIndex: decimal("differentiationIndex", { precision: 6, scale: 4 }),
  complexityMultiplier: decimal("complexityMultiplier", { precision: 6, scale: 4 }),
  timelineRiskMultiplier: decimal("timelineRiskMultiplier", { precision: 6, scale: 4 }),
  buyerPreferenceWeights: json("buyerPreferenceWeights"),
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
  costDeltaVsBenchmark: decimal("costDeltaVsBenchmark", { precision: 10, scale: 2 }),
  uniquenessIndex: decimal("uniquenessIndex", { precision: 6, scale: 4 }),
  feasibilityFlags: json("feasibilityFlags"),
  reworkRiskIndex: decimal("reworkRiskIndex", { precision: 6, scale: 4 }),
  procurementComplexity: decimal("procurementComplexity", { precision: 6, scale: 4 }),
  tierPercentile: decimal("tierPercentile", { precision: 6, scale: 4 }),
  styleFamily: varchar("styleFamily", { length: 64 }),
  costBand: varchar("costBand", { length: 32 }),
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
    "marketing_prelaunch",
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
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).default("350").notNull(),
  reworkCostPct: decimal("reworkCostPct", { precision: 6, scale: 4 }).default("0.12").notNull(),
  tenderIterationCost: decimal("tenderIterationCost", { precision: 10, scale: 2 }).default("25000").notNull(),
  designCycleCost: decimal("designCycleCost", { precision: 10, scale: 2 }).default("45000").notNull(),
  budgetVarianceMultiplier: decimal("budgetVarianceMultiplier", { precision: 6, scale: 4 }).default("0.08").notNull(),
  timeAccelerationWeeks: int("timeAccelerationWeeks").default(6),
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
  events: json("events").notNull(),
  fieldMapping: json("fieldMapping"),
  isActive: boolean("isActive").default(true).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastStatus: int("lastStatus"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
});

export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type InsertWebhookConfig = typeof webhookConfigs.$inferInsert;

// ─── Project Assets (V2.8 — Evidence Vault) ────────────────────────────────
export const projectAssets = mysqlTable("project_assets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  storagePath: text("storagePath").notNull(),
  storageUrl: text("storageUrl"),
  checksum: varchar("checksum", { length: 128 }),
  uploadedBy: int("uploadedBy").notNull(),
  category: mysqlEnum("category", [
    "brief",
    "brand",
    "budget",
    "competitor",
    "inspiration",
    "material",
    "sales",
    "legal",
    "mood_image",
    "material_board",
    "marketing_hero",
    "generated",
    "other",
  ]).default("other").notNull(),
  tags: json("tags"), // string[]
  notes: text("notes"),
  isClientVisible: boolean("isClientVisible").default(true).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type ProjectAsset = typeof projectAssets.$inferSelect;
export type InsertProjectAsset = typeof projectAssets.$inferInsert;

// ─── Asset Links (V2.8 — Evidence Traceability) ────────────────────────────
export const assetLinks = mysqlTable("asset_links", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  linkType: mysqlEnum("linkType", [
    "evaluation",
    "report",
    "scenario",
    "material_board",
    "design_brief",
    "visual",
  ]).notNull(),
  linkId: int("linkId").notNull(), // ID of the linked entity
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AssetLink = typeof assetLinks.$inferSelect;
export type InsertAssetLink = typeof assetLinks.$inferInsert;

// ─── Design Briefs (V2.8 — Design Direction Generator) ─────────────────────
export const designBriefs = mysqlTable("design_briefs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scenarioId: int("scenarioId"), // optional: brief for a specific scenario
  version: int("version").default(1).notNull(),
  // 7 sections as JSON
  projectIdentity: json("projectIdentity").notNull(),
  positioningStatement: text("positioningStatement").notNull(),
  styleMood: json("styleMood").notNull(),
  materialGuidance: json("materialGuidance").notNull(),
  budgetGuardrails: json("budgetGuardrails").notNull(),
  procurementConstraints: json("procurementConstraints").notNull(),
  deliverablesChecklist: json("deliverablesChecklist").notNull(),
  // Metadata
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DesignBrief = typeof designBriefs.$inferSelect;
export type InsertDesignBrief = typeof designBriefs.$inferInsert;

// ─── Generated Visuals (V2.8 — nano banana) ────────────────────────────────
export const generatedVisuals = mysqlTable("generated_visuals", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scenarioId: int("scenarioId"),
  type: mysqlEnum("type", ["mood", "material_board", "hero"]).notNull(),
  promptJson: json("promptJson").notNull(),
  modelVersion: varchar("modelVersion", { length: 64 }).default("nano-banana-v1"),
  imageAssetId: int("imageAssetId"), // FK to project_assets
  status: mysqlEnum("status", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedVisual = typeof generatedVisuals.$inferSelect;
export type InsertGeneratedVisual = typeof generatedVisuals.$inferInsert;

// ─── Material Boards (V2.8 — Board Composer) ────────────────────────────────
export const materialBoards = mysqlTable("material_boards", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  scenarioId: int("scenarioId"),
  boardName: varchar("boardName", { length: 255 }).notNull(),
  boardJson: json("boardJson").notNull(), // materials/finishes/ff&e items
  boardImageAssetId: int("boardImageAssetId"), // FK to project_assets
  benchmarkVersionId: int("benchmarkVersionId"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaterialBoard = typeof materialBoards.$inferSelect;
export type InsertMaterialBoard = typeof materialBoards.$inferInsert;

// ─── Materials Catalog (V2.8 — FF&E Library) ────────────────────────────────
export const materialsCatalog = mysqlTable("materials_catalog", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "tile",
    "stone",
    "wood",
    "metal",
    "fabric",
    "glass",
    "paint",
    "wallpaper",
    "lighting",
    "furniture",
    "fixture",
    "accessory",
    "other",
  ]).notNull(),
  tier: mysqlEnum("tier", ["economy", "mid", "premium", "luxury", "ultra_luxury"]).notNull(),
  typicalCostLow: decimal("typicalCostLow", { precision: 10, scale: 2 }),
  typicalCostHigh: decimal("typicalCostHigh", { precision: 10, scale: 2 }),
  costUnit: varchar("costUnit", { length: 32 }).default("AED/sqm"),
  leadTimeDays: int("leadTimeDays"),
  leadTimeBand: mysqlEnum("leadTimeBand", ["short", "medium", "long", "critical"]).default("medium"),
  regionAvailability: json("regionAvailability"), // string[]
  supplierName: varchar("supplierName", { length: 255 }),
  supplierContact: varchar("supplierContact", { length: 255 }),
  supplierUrl: text("supplierUrl"),
  imageUrl: text("imageUrl"),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaterialCatalogItem = typeof materialsCatalog.$inferSelect;
export type InsertMaterialCatalogItem = typeof materialsCatalog.$inferInsert;

// ─── Materials to Boards (V2.8 — Join Table) ────────────────────────────────
export const materialsToBoards = mysqlTable("materials_to_boards", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("boardId").notNull(),
  materialId: int("materialId").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unitOfMeasure: varchar("unitOfMeasure", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MaterialToBoard = typeof materialsToBoards.$inferSelect;
export type InsertMaterialToBoard = typeof materialsToBoards.$inferInsert;

// ─── Prompt Templates (V2.8 — Admin-editable nano banana prompts) ───────────
export const promptTemplates = mysqlTable("prompt_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["mood", "material_board", "hero"]).notNull(),
  templateText: text("templateText").notNull(),
  variables: json("variables").notNull(), // string[] of variable names
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;

// ─── Comments (V2.8 — Collaboration) ────────────────────────────────────────
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  entityType: mysqlEnum("entityType", [
    "design_brief",
    "material_board",
    "visual",
    "general",
  ]).notNull(),
  entityId: int("entityId"),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

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
