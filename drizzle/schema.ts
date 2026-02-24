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
  password: varchar("password", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  orgId: int("orgId"), // added in V7 for backward compat later to be notNull
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Organizations (V7 - Multi-tenancy) ─────────────────────────────────────────────────────────
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export const organizationMembers = mysqlTable("organization_members", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

export const organizationInvites = mysqlTable("organization_invites", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type InsertOrganizationInvite = typeof organizationInvites.$inferInsert;


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
  orgId: int("orgId"),
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
  budgetFitMethod: varchar("budgetFitMethod", { length: 32 }),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});

export type ScoreMatrix = typeof scoreMatrices.$inferSelect;
export type InsertScoreMatrix = typeof scoreMatrices.$inferInsert;

// ─── Scenarios ───────────────────────────────────────────────────────────────
export const scenarios = mysqlTable("scenarios", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  orgId: int("orgId"),
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
  type: mysqlEnum("type", ["mood", "mood_board", "material_board", "room_render", "kitchen_render", "bathroom_render", "color_palette", "hero"]).notNull(),
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

// ─── Design Trends (V3 — Phase 3 Trend Detection) ───────────────────────────
export const designTrends = mysqlTable("design_trends", {
  id: int("id").autoincrement().primaryKey(),
  trendName: varchar("trendName", { length: 255 }).notNull(),
  trendCategory: mysqlEnum("trendCategory", [
    "style", "material", "color", "layout", "technology", "sustainability", "other",
  ]).notNull(),
  confidenceLevel: mysqlEnum("confidenceLevel", ["emerging", "established", "declining"]).default("emerging").notNull(),
  sourceUrl: text("sourceUrl"),
  sourceRegistryId: int("sourceRegistryId"),
  description: text("description"),
  relatedMaterials: json("relatedMaterials"), // string[] of material names
  styleClassification: varchar("styleClassification", { length: 128 }), // modern, classical, biophilic, japandi, etc.
  region: varchar("region", { length: 64 }).default("UAE"),
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  mentionCount: int("mentionCount").default(1).notNull(),
  runId: varchar("runId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DesignTrend = typeof designTrends.$inferSelect;
export type InsertDesignTrend = typeof designTrends.$inferInsert;

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
  sortOrder: int("sortOrder").default(0).notNull(),
  specNotes: text("specNotes"),
  costBandOverride: varchar("costBandOverride", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MaterialToBoard = typeof materialsToBoards.$inferSelect;
export type InsertMaterialToBoard = typeof materialsToBoards.$inferInsert;

// ─── Prompt Templates (V2.8 — Admin-editable nano banana prompts) ───────────
export const promptTemplates = mysqlTable("prompt_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId"),
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
  orgId: int("orgId"),
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

// ─── Logic Versions (V2.10 — Logic/Policy Registry) ──────────────────────────
export const logicVersions = mysqlTable("logic_versions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  publishedAt: timestamp("publishedAt"),
  notes: text("notes"),
});

export type LogicVersion = typeof logicVersions.$inferSelect;
export type InsertLogicVersion = typeof logicVersions.$inferInsert;

// ─── Logic Weights (V2.10) ───────────────────────────────────────────────────
export const logicWeights = mysqlTable("logic_weights", {
  id: int("id").autoincrement().primaryKey(),
  logicVersionId: int("logicVersionId").notNull(),
  dimension: varchar("dimension", { length: 32 }).notNull(), // sa, ff, mp, ds, er
  weight: decimal("weight", { precision: 6, scale: 4 }).notNull(),
});

export type LogicWeight = typeof logicWeights.$inferSelect;
export type InsertLogicWeight = typeof logicWeights.$inferInsert;

// ─── Logic Thresholds (V2.10) ────────────────────────────────────────────────
export const logicThresholds = mysqlTable("logic_thresholds", {
  id: int("id").autoincrement().primaryKey(),
  logicVersionId: int("logicVersionId").notNull(),
  ruleKey: varchar("ruleKey", { length: 128 }).notNull(),
  thresholdValue: decimal("thresholdValue", { precision: 10, scale: 4 }).notNull(),
  comparator: mysqlEnum("comparator", ["gt", "gte", "lt", "lte", "eq", "neq"]).notNull(),
  notes: text("notes"),
});

export type LogicThreshold = typeof logicThresholds.$inferSelect;
export type InsertLogicThreshold = typeof logicThresholds.$inferInsert;

// ─── Logic Change Log (V2.10) ────────────────────────────────────────────────
export const logicChangeLog = mysqlTable("logic_change_log", {
  id: int("id").autoincrement().primaryKey(),
  logicVersionId: int("logicVersionId").notNull(),
  actor: int("actor").notNull(),
  changeSummary: text("changeSummary").notNull(),
  rationale: text("rationale").notNull(),
  status: mysqlEnum("status", ["applied", "proposed", "rejected"]).default("applied").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LogicChangeLogEntry = typeof logicChangeLog.$inferSelect;
export type InsertLogicChangeLogEntry = typeof logicChangeLog.$inferInsert;

// ─── Pattern Library (V5-07) ──────────────────────────────────────────────────
export const decisionPatterns = mysqlTable("decision_patterns", {
  id: int("id").autoincrement().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", ["risk_indicator", "success_driver", "cost_anomaly"]).notNull(),
  conditions: json("conditions").notNull(), // array of logic defining the pattern
  matchCount: int("matchCount").default(0).notNull(), // times it appeared
  reliabilityScore: decimal("reliabilityScore", { precision: 5, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DecisionPattern = typeof decisionPatterns.$inferSelect;
export type InsertDecisionPattern = typeof decisionPatterns.$inferInsert;

export const projectPatternMatches = mysqlTable("project_pattern_matches", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  patternId: int("patternId").notNull(),
  matchedAt: timestamp("matchedAt").defaultNow().notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).default("1.00").notNull(),
  contextSnapshot: json("contextSnapshot"), // snapshot of scores during match
});

export type ProjectPatternMatch = typeof projectPatternMatches.$inferSelect;
export type InsertProjectPatternMatch = typeof projectPatternMatches.$inferInsert;


// ─── Scenario Inputs (V2.11) ─────────────────────────────────────────────────
export const scenarioInputs = mysqlTable("scenario_inputs", {
  id: int("id").autoincrement().primaryKey(),
  scenarioId: int("scenarioId").notNull(),
  jsonInput: json("jsonInput").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScenarioInput = typeof scenarioInputs.$inferSelect;
export type InsertScenarioInput = typeof scenarioInputs.$inferInsert;

// ─── Scenario Outputs (V2.11) ────────────────────────────────────────────────
export const scenarioOutputs = mysqlTable("scenario_outputs", {
  id: int("id").autoincrement().primaryKey(),
  scenarioId: int("scenarioId").notNull(),
  scoreJson: json("scoreJson").notNull(),
  roiJson: json("roiJson"),
  riskJson: json("riskJson"),
  boardCostJson: json("boardCostJson"),
  benchmarkVersionId: int("benchmarkVersionId"),
  logicVersionId: int("logicVersionId"),
  computedAt: timestamp("computedAt").defaultNow().notNull(),
});

export type ScenarioOutput = typeof scenarioOutputs.$inferSelect;
export type InsertScenarioOutput = typeof scenarioOutputs.$inferInsert;

// ─── Scenario Comparisons (V2.11) ────────────────────────────────────────────
export const scenarioComparisons = mysqlTable("scenario_comparisons", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  baselineScenarioId: int("baselineScenarioId").notNull(),
  comparedScenarioIds: json("comparedScenarioIds").notNull(), // number[]
  decisionNote: text("decisionNote"),
  comparisonResult: json("comparisonResult"), // computed tradeoffs
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScenarioComparison = typeof scenarioComparisons.$inferSelect;
export type InsertScenarioComparison = typeof scenarioComparisons.$inferInsert;

// ─── Project Outcomes (V2.13) ────────────────────────────────────────────────
export const projectOutcomes = mysqlTable("project_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  procurementActualCosts: json("procurementActualCosts"),
  leadTimesActual: json("leadTimesActual"),
  rfqResults: json("rfqResults"),
  adoptionMetrics: json("adoptionMetrics"),

  // V5 Fields
  actualFitoutCostPerSqm: decimal("actualFitoutCostPerSqm", { precision: 10, scale: 2 }),
  actualTotalCost: decimal("actualTotalCost", { precision: 15, scale: 2 }),
  projectDeliveredOnTime: boolean("projectDeliveredOnTime"),
  reworkOccurred: boolean("reworkOccurred"),
  reworkCostAed: decimal("reworkCostAed", { precision: 15, scale: 2 }),
  clientSatisfactionScore: int("clientSatisfactionScore"),
  tenderIterations: int("tenderIterations"),
  keyLessonsLearned: text("keyLessonsLearned"),

  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
  capturedBy: int("capturedBy"),
});

export type ProjectOutcome = typeof projectOutcomes.$inferSelect;
export type InsertProjectOutcome = typeof projectOutcomes.$inferInsert;

export const outcomeComparisons = mysqlTable("outcome_comparisons", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  comparedAt: timestamp("comparedAt").defaultNow().notNull(),

  // Cost accuracy
  predictedCostMid: decimal("predictedCostMid", { precision: 15, scale: 2 }),
  actualCost: decimal("actualCost", { precision: 15, scale: 2 }),
  costDeltaPct: decimal("costDeltaPct", { precision: 10, scale: 4 }),
  costAccuracyBand: mysqlEnum("costAccuracyBand", ["within_10pct", "within_20pct", "outside_20pct", "no_prediction"]).notNull(),

  // Score accuracy
  predictedComposite: decimal("predictedComposite", { precision: 5, scale: 4 }).notNull(),
  predictedDecision: varchar("predictedDecision", { length: 64 }).notNull(),
  actualOutcomeSuccess: boolean("actualOutcomeSuccess").notNull(),
  scorePredictionCorrect: boolean("scorePredictionCorrect").notNull(),

  // Risk accuracy
  predictedRisk: decimal("predictedRisk", { precision: 5, scale: 4 }).notNull(),
  actualReworkOccurred: boolean("actualReworkOccurred").notNull(),
  riskPredictionCorrect: boolean("riskPredictionCorrect").notNull(),

  // Delta summary
  overallAccuracyGrade: mysqlEnum("overallAccuracyGrade", ["A", "B", "C", "insufficient_data"]).notNull(),
  learningSignals: json("learningSignals"),
  rawComparison: json("rawComparison"),
});

export type OutcomeComparison = typeof outcomeComparisons.$inferSelect;
export type InsertOutcomeComparison = typeof outcomeComparisons.$inferInsert;

export const accuracySnapshots = mysqlTable("accuracy_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotDate: timestamp("snapshotDate").defaultNow().notNull(),

  totalComparisons: int("totalComparisons").notNull(),
  withCostPrediction: int("withCostPrediction").notNull(),
  withOutcomePrediction: int("withOutcomePrediction").notNull(),

  // Cost accuracy
  costWithin10Pct: int("costWithin10Pct").notNull(),
  costWithin20Pct: int("costWithin20Pct").notNull(),
  costOutside20Pct: int("costOutside20Pct").notNull(),
  costMaePct: decimal("costMaePct", { precision: 8, scale: 4 }),
  costTrend: mysqlEnum("costTrend", ["improving", "stable", "degrading", "insufficient_data"]).notNull(),

  // Score accuracy
  scoreCorrectPredictions: int("scoreCorrectPredictions").notNull(),
  scoreIncorrectPredictions: int("scoreIncorrectPredictions").notNull(),
  scoreAccuracyRate: decimal("scoreAccuracyRate", { precision: 8, scale: 4 }).notNull(),
  scoreTrend: mysqlEnum("scoreTrend", ["improving", "stable", "degrading", "insufficient_data"]).notNull(),

  // Risk accuracy
  riskCorrectPredictions: int("riskCorrectPredictions").notNull(),
  riskIncorrectPredictions: int("riskIncorrectPredictions").notNull(),
  riskAccuracyRate: decimal("riskAccuracyRate", { precision: 8, scale: 4 }).notNull(),
  riskTrend: mysqlEnum("riskTrend", ["improving", "stable", "degrading", "insufficient_data"]).notNull(),

  overallPlatformAccuracy: decimal("overallPlatformAccuracy", { precision: 8, scale: 4 }).notNull(),
  gradeA: int("gradeA").notNull(),
  gradeB: int("gradeB").notNull(),
  gradeC: int("gradeC").notNull(),
});

export type AccuracySnapshot = typeof accuracySnapshots.$inferSelect;
export type InsertAccuracySnapshot = typeof accuracySnapshots.$inferInsert;

// ─── Benchmark Suggestions (V2.13) ──────────────────────────────────────────
export const benchmarkSuggestions = mysqlTable("benchmark_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  basedOnOutcomesQuery: text("basedOnOutcomesQuery"),
  suggestedChanges: json("suggestedChanges").notNull(),
  confidence: decimal("confidence", { precision: 6, scale: 4 }),
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  reviewerNotes: text("reviewerNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BenchmarkSuggestion = typeof benchmarkSuggestions.$inferSelect;
export type InsertBenchmarkSuggestion = typeof benchmarkSuggestions.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// Stage 1 — Market Intelligence Layer V1
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Source Registry (Stage 1) ──────────────────────────────────────────────
export const sourceRegistry = mysqlTable("source_registry", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  sourceType: mysqlEnum("sourceType", [
    "supplier_catalog",
    "manufacturer_catalog",
    "developer_brochure",
    "industry_report",
    "government_tender",
    "procurement_portal",
    "trade_publication",
    "retailer_listing",
    "aggregator",
    "other",
  ]).notNull(),
  reliabilityDefault: mysqlEnum("reliabilityDefault", ["A", "B", "C"]).default("B").notNull(),
  isWhitelisted: boolean("isWhitelisted").default(true).notNull(),
  region: varchar("region", { length: 64 }).default("UAE"),
  notes: text("notes"),
  addedBy: int("addedBy"),
  isActive: boolean("isActive").default(true).notNull(),
  lastSuccessfulFetch: timestamp("lastSuccessfulFetch"),

  // DFE Fields
  scrapeConfig: json("scrapeConfig"),
  scrapeSchedule: varchar("scrapeSchedule", { length: 64 }),
  scrapeMethod: mysqlEnum("scrapeMethod", [
    "html_llm",
    "html_rules",
    "json_api",
    "rss_feed",
    "csv_upload",
    "email_forward",
  ]).default("html_llm").notNull(),
  scrapeHeaders: json("scrapeHeaders"),
  extractionHints: text("extractionHints"),
  priceFieldMapping: json("priceFieldMapping"),
  lastScrapedAt: timestamp("lastScrapedAt"),
  lastScrapedStatus: mysqlEnum("lastScrapedStatus", ["success", "partial", "failed", "never"]).default("never").notNull(),
  lastRecordCount: int("lastRecordCount").default(0).notNull(),
  consecutiveFailures: int("consecutiveFailures").default(0).notNull(),
  requestDelayMs: int("requestDelayMs").default(2000).notNull(),

  addedAt: timestamp("addedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SourceRegistryEntry = typeof sourceRegistry.$inferSelect;
export type InsertSourceRegistryEntry = typeof sourceRegistry.$inferInsert;

// ─── Evidence Records (Stage 1) ─────────────────────────────────────────────
export const evidenceRecords = mysqlTable("evidence_records", {
  id: int("id").autoincrement().primaryKey(),
  recordId: varchar("recordId", { length: 64 }).notNull().unique(), // MYR-PE-XXXX
  projectId: int("projectId"), // optional: can be global evidence
  orgId: int("orgId"),
  sourceRegistryId: int("sourceRegistryId"), // FK to source_registry
  category: mysqlEnum("category", [
    "floors",
    "walls",
    "ceilings",
    "joinery",
    "lighting",
    "sanitary",
    "kitchen",
    "hardware",
    "ffe",
    "other",
  ]).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  specClass: varchar("specClass", { length: 128 }),
  priceMin: decimal("priceMin", { precision: 12, scale: 2 }),
  priceTypical: decimal("priceTypical", { precision: 12, scale: 2 }),
  priceMax: decimal("priceMax", { precision: 12, scale: 2 }),
  unit: varchar("unit", { length: 32 }).notNull(), // sqm, lm, set, piece, etc.
  currencyOriginal: varchar("currencyOriginal", { length: 8 }).default("AED"),
  currencyAed: decimal("currencyAed", { precision: 12, scale: 2 }), // normalized to AED
  fxRate: decimal("fxRate", { precision: 10, scale: 6 }),
  fxSource: text("fxSource"),
  sourceUrl: text("sourceUrl").notNull(),
  publisher: varchar("publisher", { length: 255 }),
  captureDate: timestamp("captureDate").notNull(),
  reliabilityGrade: mysqlEnum("reliabilityGrade", ["A", "B", "C"]).notNull(),
  confidenceScore: int("confidenceScore").notNull(), // 0-100
  extractedSnippet: text("extractedSnippet"),
  notes: text("notes"),
  // V2.2 metadata fields
  title: varchar("title", { length: 512 }),
  evidencePhase: mysqlEnum("evidencePhase", ["concept", "schematic", "detailed_design", "tender", "procurement", "construction", "handover"]),
  author: varchar("author", { length: 255 }),
  confidentiality: mysqlEnum("confidentiality", ["public", "internal", "confidential", "restricted"]).default("internal"),
  tags: json("tags"), // string[]
  fileUrl: text("fileUrl"), // S3 signed URL for attached evidence file
  fileKey: varchar("fileKey", { length: 512 }), // S3 key for the file
  fileMimeType: varchar("fileMimeType", { length: 128 }),
  runId: varchar("runId", { length: 64 }), // links to intelligence_audit_log
  // V7: Design Intelligence Fields
  finishLevel: mysqlEnum("finishLevel", ["basic", "standard", "premium", "luxury", "ultra_luxury"]),
  designStyle: varchar("designStyle", { length: 255 }),
  brandsMentioned: json("brandsMentioned"), // string[]
  materialSpec: text("materialSpec"),
  intelligenceType: mysqlEnum("intelligenceType", [
    "material_price", "finish_specification", "design_trend",
    "market_statistic", "competitor_positioning", "regulation",
  ]).default("material_price"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvidenceRecord = typeof evidenceRecords.$inferSelect;
export type InsertEvidenceRecord = typeof evidenceRecords.$inferInsert;

// ─── Benchmark Proposals (Stage 1) ──────────────────────────────────────────
export const benchmarkProposals = mysqlTable("benchmark_proposals", {
  id: int("id").autoincrement().primaryKey(),
  benchmarkKey: varchar("benchmarkKey", { length: 255 }).notNull(), // category:tier:unit
  currentTypical: decimal("currentTypical", { precision: 12, scale: 2 }),
  currentMin: decimal("currentMin", { precision: 12, scale: 2 }),
  currentMax: decimal("currentMax", { precision: 12, scale: 2 }),
  proposedP25: decimal("proposedP25", { precision: 12, scale: 2 }).notNull(),
  proposedP50: decimal("proposedP50", { precision: 12, scale: 2 }).notNull(),
  proposedP75: decimal("proposedP75", { precision: 12, scale: 2 }).notNull(),
  weightedMean: decimal("weightedMean", { precision: 12, scale: 2 }).notNull(),
  deltaPct: decimal("deltaPct", { precision: 8, scale: 2 }), // % change from current
  evidenceCount: int("evidenceCount").notNull(),
  sourceDiversity: int("sourceDiversity").notNull(),
  reliabilityDist: json("reliabilityDist").notNull(), // { A: n, B: n, C: n }
  recencyDist: json("recencyDist").notNull(), // { recent: n, mid: n, old: n }
  confidenceScore: int("confidenceScore").notNull(), // 0-100
  impactNotes: text("impactNotes"),
  recommendation: mysqlEnum("recommendation", ["publish", "reject"]).notNull(),
  rejectionReason: text("rejectionReason"),
  // Review workflow
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewerNotes: text("reviewerNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  // Snapshot linking
  benchmarkSnapshotId: int("benchmarkSnapshotId"),
  runId: varchar("runId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BenchmarkProposal = typeof benchmarkProposals.$inferSelect;
export type InsertBenchmarkProposal = typeof benchmarkProposals.$inferInsert;

// ─── Benchmark Snapshots (Stage 1) ──────────────────────────────────────────
export const benchmarkSnapshots = mysqlTable("benchmark_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  benchmarkVersionId: int("benchmarkVersionId"),
  snapshotJson: json("snapshotJson").notNull(), // full benchmark state at time of snapshot
  description: text("description"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BenchmarkSnapshot = typeof benchmarkSnapshots.$inferSelect;
export type InsertBenchmarkSnapshot = typeof benchmarkSnapshots.$inferInsert;

// ─── Competitor Entities (Stage 1) ──────────────────────────────────────────
export const competitorEntities = mysqlTable("competitor_entities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  headquarters: varchar("headquarters", { length: 255 }),
  segmentFocus: mysqlEnum("segmentFocus", [
    "affordable",
    "mid",
    "premium",
    "luxury",
    "ultra_luxury",
    "mixed",
  ]).default("mixed"),
  website: text("website"),
  logoUrl: text("logoUrl"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompetitorEntity = typeof competitorEntities.$inferSelect;
export type InsertCompetitorEntity = typeof competitorEntities.$inferInsert;

// ─── Competitor Projects (Stage 1) ──────────────────────────────────────────
export const competitorProjects = mysqlTable("competitor_projects", {
  id: int("id").autoincrement().primaryKey(),
  competitorId: int("competitorId").notNull(), // FK to competitor_entities
  projectName: varchar("projectName", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  segment: mysqlEnum("segment", [
    "affordable",
    "mid",
    "premium",
    "luxury",
    "ultra_luxury",
  ]),
  assetType: mysqlEnum("assetType", [
    "residential",
    "commercial",
    "hospitality",
    "mixed_use",
  ]).default("residential"),
  positioningKeywords: json("positioningKeywords"), // string[]
  interiorStyleSignals: json("interiorStyleSignals"), // string[]
  materialCues: json("materialCues"), // string[]
  amenityList: json("amenityList"), // string[]
  unitMix: text("unitMix"),
  priceIndicators: json("priceIndicators"), // { currency, min, max, per_unit }
  salesMessaging: json("salesMessaging"), // string[]
  differentiationClaims: json("differentiationClaims"), // string[]
  completionStatus: mysqlEnum("completionStatus", [
    "announced",
    "under_construction",
    "completed",
    "sold_out",
  ]),
  launchDate: varchar("launchDate", { length: 32 }),
  totalUnits: int("totalUnits"),
  architect: varchar("architect", { length: 255 }),
  interiorDesigner: varchar("interiorDesigner", { length: 255 }),
  sourceUrl: text("sourceUrl"),
  captureDate: timestamp("captureDate"),
  evidenceCitations: json("evidenceCitations"), // array of { field, snippet, source_url, capture_date }
  completenessScore: int("completenessScore"), // 0-100
  runId: varchar("runId", { length: 64 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompetitorProject = typeof competitorProjects.$inferSelect;
export type InsertCompetitorProject = typeof competitorProjects.$inferInsert;

// ─── Trend Tags (Stage 1) ───────────────────────────────────────────────────
export const trendTags = mysqlTable("trend_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  category: mysqlEnum("category", [
    "material_trend",
    "design_trend",
    "market_trend",
    "buyer_preference",
    "sustainability",
    "technology",
    "pricing",
    "other",
  ]).notNull(),
  description: text("description"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrendTag = typeof trendTags.$inferSelect;
export type InsertTrendTag = typeof trendTags.$inferInsert;

// ─── Entity Tags (Stage 1 — Join Table) ─────────────────────────────────────
export const entityTags = mysqlTable("entity_tags", {
  id: int("id").autoincrement().primaryKey(),
  tagId: int("tagId").notNull(), // FK to trend_tags
  entityType: mysqlEnum("entityType", [
    "competitor_project",
    "scenario",
    "evidence_record",
    "project",
  ]).notNull(),
  entityId: int("entityId").notNull(),
  addedBy: int("addedBy"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type EntityTag = typeof entityTags.$inferSelect;
export type InsertEntityTag = typeof entityTags.$inferInsert;

// ─── Intelligence Audit Log (Stage 1) ───────────────────────────────────────
export const intelligenceAuditLog = mysqlTable("intelligence_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  runType: mysqlEnum("runType", [
    "price_extraction",
    "competitor_extraction",
    "benchmark_proposal",
    "manual_entry",
  ]).notNull(),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  actor: int("actor"), // userId who triggered
  inputSummary: json("inputSummary"), // config/params used
  outputSummary: json("outputSummary"), // counts, coverage, errors
  sourcesProcessed: int("sourcesProcessed").default(0),
  recordsExtracted: int("recordsExtracted").default(0),
  errors: int("errors").default(0),
  errorDetails: json("errorDetails"),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
});

export type IntelligenceAuditLogEntry = typeof intelligenceAuditLog.$inferSelect;
export type InsertIntelligenceAuditLogEntry = typeof intelligenceAuditLog.$inferInsert;

// ─── Evidence References (V2.2 — Evidence Traceability) ─────────────────────
export const evidenceReferences = mysqlTable("evidence_references", {
  id: int("id").autoincrement().primaryKey(),
  evidenceRecordId: int("evidenceRecordId").notNull(), // FK to evidence_records
  targetType: mysqlEnum("targetType", [
    "scenario",
    "decision_note",
    "explainability_driver",
    "design_brief",
    "report",
    "material_board",
    "pack_section",
  ]).notNull(),
  targetId: int("targetId").notNull(), // ID of the linked entity
  sectionLabel: varchar("sectionLabel", { length: 255 }), // e.g. "Materials Specification", "Cost Assumptions"
  citationText: text("citationText"), // inline citation snippet
  addedBy: int("addedBy"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type EvidenceReference = typeof evidenceReferences.$inferSelect;
export type InsertEvidenceReference = typeof evidenceReferences.$inferInsert;

// ─── Ingestion Runs (V2 — Live Market Ingestion) ──────────────────────────────
export const ingestionRuns = mysqlTable("ingestion_runs", {
  id: int("id").autoincrement().primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  trigger: mysqlEnum("trigger", ["manual", "scheduled", "api"]).notNull(),
  triggeredBy: int("triggeredBy"), // userId or null for scheduled
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  // Counts
  totalSources: int("totalSources").default(0).notNull(),
  sourcesSucceeded: int("sourcesSucceeded").default(0).notNull(),
  sourcesFailed: int("sourcesFailed").default(0).notNull(),
  recordsExtracted: int("recordsExtracted").default(0).notNull(),
  recordsInserted: int("recordsInserted").default(0).notNull(),
  duplicatesSkipped: int("duplicatesSkipped").default(0).notNull(),
  // Detail
  sourceBreakdown: json("sourceBreakdown"), // per-source { sourceId, name, status, extracted, inserted, duplicates, errors }
  errorSummary: json("errorSummary"), // [{ sourceId, error }]
  // Timing
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"),
  // Metadata
  cronExpression: varchar("cronExpression", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type InsertIngestionRun = typeof ingestionRuns.$inferInsert;

// ─── Connector Health (V3 — Source Health Monitoring) ───────────────────────────
export const connectorHealth = mysqlTable("connector_health", {
  id: int("id").autoincrement().primaryKey(),
  runId: varchar("runId", { length: 64 }).notNull(), // FK to ingestion_runs.runId
  sourceId: varchar("sourceId", { length: 64 }).notNull(),
  sourceName: varchar("sourceName", { length: 255 }).notNull(),
  status: mysqlEnum("healthStatus", ["success", "partial", "failed"]).notNull(),
  httpStatusCode: int("httpStatusCode"),
  responseTimeMs: int("responseTimeMs"),
  recordsExtracted: int("recordsExtracted").default(0).notNull(),
  recordsInserted: int("recordsInserted").default(0).notNull(),
  duplicatesSkipped: int("duplicatesSkipped").default(0).notNull(),
  errorMessage: text("errorMessage"),
  errorType: varchar("errorType", { length: 64 }), // "dns_failure", "timeout", "http_error", "parse_error", "llm_error"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConnectorHealth = typeof connectorHealth.$inferSelect;
export type InsertConnectorHealth = typeof connectorHealth.$inferInsert;

// ─── Trend Snapshots (V3 — Analytical Intelligence) ──────────────────────────
export const trendSnapshots = mysqlTable("trend_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  metric: varchar("metric", { length: 255 }).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  geography: varchar("geography", { length: 128 }).notNull(),
  dataPointCount: int("dataPointCount").default(0).notNull(),
  gradeACount: int("gradeACount").default(0).notNull(),
  gradeBCount: int("gradeBCount").default(0).notNull(),
  gradeCCount: int("gradeCCount").default(0).notNull(),
  uniqueSources: int("uniqueSources").default(0).notNull(),
  dateRangeStart: timestamp("dateRangeStart"),
  dateRangeEnd: timestamp("dateRangeEnd"),
  currentMA: decimal("currentMA", { precision: 14, scale: 4 }),
  previousMA: decimal("previousMA", { precision: 14, scale: 4 }),
  percentChange: decimal("percentChange", { precision: 10, scale: 6 }),
  direction: mysqlEnum("direction", ["rising", "falling", "stable", "insufficient_data"]).notNull(),
  anomalyCount: int("anomalyCount").default(0).notNull(),
  anomalyDetails: json("anomalyDetails"), // AnomalyFlag[]
  confidence: mysqlEnum("trendConfidence", ["high", "medium", "low", "insufficient"]).notNull(),
  narrative: text("narrative"),
  movingAverages: json("movingAverages"), // MovingAveragePoint[]
  ingestionRunId: varchar("ingestionRunId", { length: 64 }), // FK to ingestion_runs.runId
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrendSnapshot = typeof trendSnapshots.$inferSelect;
export type InsertTrendSnapshot = typeof trendSnapshots.$inferInsert;

// ─── Project Insights (V3 — Analytical Intelligence) ─────────────────────────
export const projectInsights = mysqlTable("project_insights", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId"), // nullable for system-wide insights
  insightType: mysqlEnum("insightType", [
    "cost_pressure",
    "market_opportunity",
    "competitor_alert",
    "trend_signal",
    "positioning_gap",
  ]).notNull(),
  severity: mysqlEnum("insightSeverity", ["critical", "warning", "info"]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  body: text("body"),
  actionableRecommendation: text("actionableRecommendation"),
  confidenceScore: decimal("confidenceScore", { precision: 5, scale: 4 }),
  triggerCondition: text("triggerCondition"),
  dataPoints: json("dataPoints"),
  status: mysqlEnum("insightStatus", ["active", "acknowledged", "dismissed", "resolved"]).default("active").notNull(),
  acknowledgedBy: int("acknowledgedBy"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectInsight = typeof projectInsights.$inferSelect;
export type InsertProjectInsight = typeof projectInsights.$inferInsert;

export const priceChangeEvents = mysqlTable("price_change_events", {
  id: int("id").autoincrement().primaryKey(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  sourceId: int("sourceId").notNull(),
  previousPrice: decimal("previousPrice", { precision: 12, scale: 2 }).notNull(),
  newPrice: decimal("newPrice", { precision: 12, scale: 2 }).notNull(),
  changePct: decimal("changePct", { precision: 10, scale: 6 }).notNull(),
  changeDirection: mysqlEnum("changeDirection", ["increased", "decreased"]).notNull(),
  severity: mysqlEnum("severity", ["significant", "notable", "minor", "none"]).notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
});

export type PriceChangeEvent = typeof priceChangeEvents.$inferSelect;
export type InsertPriceChangeEvent = typeof priceChangeEvents.$inferInsert;

// ─── Platform Alerts (V6 — Autonomous Intelligence) ─────────────────────────
export const platformAlerts = mysqlTable("platform_alerts", {
  id: int("id").autoincrement().primaryKey(),
  alertType: mysqlEnum("alertType", [
    "price_shock",
    "project_at_risk",
    "accuracy_degraded",
    "pattern_warning",
    "benchmark_drift",
    "market_opportunity"
  ]).notNull(),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "info"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  affectedProjectIds: json("affectedProjectIds"),
  affectedCategories: json("affectedCategories"),
  triggerData: json("triggerData"),
  suggestedAction: text("suggestedAction").notNull(),
  status: mysqlEnum("status", ["active", "acknowledged", "resolved", "expired"]).default("active").notNull(),
  acknowledgedBy: int("acknowledgedBy"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlatformAlert = typeof platformAlerts.$inferSelect;
export type InsertPlatformAlert = typeof platformAlerts.$inferInsert;

// ─── NL Query Log (V7 — Production Hardening) ───────────────────────────────
export const nlQueryLog = mysqlTable("nl_query_log", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  queryText: text("query_text").notNull(),
  sqlGenerated: text("sql_generated"),
  rowsReturned: int("rows_returned").default(0),
  executionMs: int("execution_ms"),
  status: mysqlEnum("status", ["success", "error", "blocked"]).default("success"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NlQueryLog = typeof nlQueryLog.$inferSelect;
export type InsertNlQueryLog = typeof nlQueryLog.$inferInsert;

// ─── V8 - Design Intelligence Layer ───────────────────────────────────────
export const materialLibrary = mysqlTable("material_library", {
  id: int("id").primaryKey().autoincrement(),
  category: mysqlEnum("category", [
    "flooring", "wall_paint", "wall_tile", "ceiling",
    "joinery", "sanitaryware", "fittings", "lighting",
    "hardware", "specialty"
  ]).notNull(),
  tier: mysqlEnum("tier", [
    "affordable", "mid", "premium", "ultra"
  ]).notNull(),
  style: mysqlEnum("style", [
    "modern", "contemporary", "classic",
    "minimalist", "arabesque", "all"
  ]).default("all").notNull(),
  productCode: varchar("product_code", { length: 100 }),
  productName: varchar("product_name", { length: 300 }).notNull(),
  brand: varchar("brand", { length: 150 }).notNull(),
  supplierName: varchar("supplier_name", { length: 200 }).notNull(),
  supplierLocation: varchar("supplier_location", { length: 200 }),
  supplierPhone: varchar("supplier_phone", { length: 50 }),
  unitLabel: varchar("unit_label", { length: 30 }).notNull(),
  priceAedMin: decimal("price_aed_min", { precision: 10, scale: 2 }),
  priceAedMax: decimal("price_aed_max", { precision: 10, scale: 2 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
});

export type MaterialLibrary = typeof materialLibrary.$inferSelect;
export type InsertMaterialLibrary = typeof materialLibrary.$inferInsert;

export const finishScheduleItems = mysqlTable(
  "finish_schedule_items", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  organizationId: int("organization_id").notNull(),
  roomId: varchar("room_id", { length: 10 }).notNull(),
  roomName: varchar("room_name", { length: 100 }).notNull(),
  element: mysqlEnum("element", [
    "floor", "wall_primary", "wall_feature",
    "wall_wet", "ceiling", "joinery", "hardware"
  ]).notNull(),
  materialLibraryId: int("material_library_id"),
  overrideSpec: varchar("override_spec", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FinishScheduleItem = typeof finishScheduleItems.$inferSelect;
export type InsertFinishScheduleItem = typeof finishScheduleItems.$inferInsert;

export const projectColorPalettes = mysqlTable(
  "project_color_palettes", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  organizationId: int("organization_id").notNull(),
  paletteKey: varchar("palette_key", { length: 100 }).notNull(),
  colors: json("colors").notNull(),
  geminiRationale: text("gemini_rationale"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProjectColorPalette = typeof projectColorPalettes.$inferSelect;
export type InsertProjectColorPalette = typeof projectColorPalettes.$inferInsert;

export const rfqLineItems = mysqlTable("rfq_line_items", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  organizationId: int("organization_id").notNull(),
  sectionNo: int("section_no").notNull(),
  itemCode: varchar("item_code", { length: 20 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unitRateAedMin: decimal("unit_rate_aed_min",
    { precision: 10, scale: 2 }),
  unitRateAedMax: decimal("unit_rate_aed_max",
    { precision: 10, scale: 2 }),
  totalAedMin: decimal("total_aed_min",
    { precision: 12, scale: 2 }),
  totalAedMax: decimal("total_aed_max",
    { precision: 12, scale: 2 }),
  supplierName: varchar("supplier_name", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RfqLineItem = typeof rfqLineItems.$inferSelect;
export type InsertRfqLineItem = typeof rfqLineItems.$inferInsert;

export const dmComplianceChecklists = mysqlTable(
  "dm_compliance_checklists", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  organizationId: int("organization_id").notNull(),
  items: json("items").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DmComplianceChecklist = typeof dmComplianceChecklists.$inferSelect;
export type InsertDmComplianceChecklist = typeof dmComplianceChecklists.$inferInsert;

// ─── V9 - Strategic Risk & Economic Modeling ────────────────────────────────

export const projectRoiModels = mysqlTable("project_roi_models", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  scenarioId: int("scenario_id"),
  reworkCostAvoided: decimal("rework_cost_avoided", { precision: 14, scale: 2 }).notNull(),
  programmeAccelerationValue: decimal("programme_acceleration_value", { precision: 14, scale: 2 }).notNull(),
  totalValueCreated: decimal("total_value_created", { precision: 14, scale: 2 }).notNull(),
  netRoiPercent: decimal("net_roi_percent", { precision: 8, scale: 2 }).notNull(),
  confidenceMultiplier: decimal("confidence_multiplier", { precision: 5, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProjectRoiModel = typeof projectRoiModels.$inferSelect;
export type InsertProjectRoiModel = typeof projectRoiModels.$inferInsert;

export const scenarioStressTests = mysqlTable("scenario_stress_tests", {
  id: int("id").primaryKey().autoincrement(),
  scenarioId: int("scenario_id").notNull(),
  stressCondition: varchar("stress_condition", { length: 100 }).notNull(),
  impactMagnitudePercent: decimal("impact_magnitude_percent", { precision: 6, scale: 2 }).notNull(),
  resilienceScore: int("resilience_score").notNull(), // 1-100
  failurePoints: json("failure_points").notNull(), // JSON array of components that fail
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScenarioStressTest = typeof scenarioStressTests.$inferSelect;
export type InsertScenarioStressTest = typeof scenarioStressTests.$inferInsert;

export const riskSurfaceMaps = mysqlTable("risk_surface_maps", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  domain: varchar("domain", { length: 100 }).notNull(),
  probability: int("probability").notNull(), // 0-100
  impact: int("impact").notNull(), // 0-100
  vulnerability: int("vulnerability").notNull(), // 0-100
  controlStrength: int("control_strength").notNull(), // 1-100
  compositeRiskScore: int("composite_risk_score").notNull(), // Calculated via R = (P * I * V) / C
  riskBand: mysqlEnum("risk_band", ["Minimal", "Controlled", "Elevated", "Critical", "Systemic"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RiskSurfaceMap = typeof riskSurfaceMaps.$inferSelect;
export type InsertRiskSurfaceMap = typeof riskSurfaceMaps.$inferInsert;

// ─── V11: Cognitive Bias Framework ──────────────────────────────────────────

export const biasAlerts = mysqlTable("bias_alerts", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("projectId").notNull(),
  scoreMatrixId: int("scoreMatrixId"),
  userId: int("userId").notNull(),
  orgId: int("orgId"),
  biasType: mysqlEnum("biasType", [
    "optimism_bias",
    "anchoring_bias",
    "confirmation_bias",
    "overconfidence",
    "scope_creep",
    "sunk_cost",
    "clustering_illusion",
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  intervention: text("intervention"),
  evidencePoints: json("evidencePoints"),
  mathExplanation: text("mathExplanation"),
  dismissed: boolean("dismissed").default(false),
  dismissedBy: int("dismissedBy"),
  dismissedAt: timestamp("dismissedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BiasAlertRow = typeof biasAlerts.$inferSelect;
export type InsertBiasAlert = typeof biasAlerts.$inferInsert;

export const biasProfiles = mysqlTable("bias_profiles", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  orgId: int("orgId"),
  biasType: varchar("biasType", { length: 64 }).notNull(),
  occurrenceCount: int("occurrenceCount").default(0),
  lastDetectedAt: timestamp("lastDetectedAt"),
  avgSeverity: decimal("avgSeverity", { precision: 3, scale: 2 }),
  trend: mysqlEnum("trend", ["increasing", "stable", "decreasing"]).default("stable"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BiasProfileRow = typeof biasProfiles.$inferSelect;
export type InsertBiasProfile = typeof biasProfiles.$inferInsert;

// ─── Phase 1: Smart Design Brain ────────────────────────────────────────────

export const spaceRecommendations = mysqlTable("space_recommendations", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  orgId: int("org_id").notNull(),
  roomId: varchar("room_id", { length: 10 }).notNull(),
  roomName: varchar("room_name", { length: 100 }).notNull(),
  sqm: decimal("sqm", { precision: 8, scale: 2 }),
  styleDirection: varchar("style_direction", { length: 500 }),
  colorScheme: varchar("color_scheme", { length: 500 }),
  materialPackage: json("material_package"),       // MaterialRec[]
  budgetAllocation: decimal("budget_allocation", { precision: 12, scale: 2 }),
  budgetBreakdown: json("budget_breakdown"),        // BudgetBreakdownItem[]
  aiRationale: text("ai_rationale"),
  specialNotes: json("special_notes"),              // string[]
  kitchenSpec: json("kitchen_spec"),                // KitchenSpec | null
  bathroomSpec: json("bathroom_spec"),              // BathroomSpec | null
  alternatives: json("alternatives"),               // AlternativePackage[]
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export type SpaceRecommendationRow = typeof spaceRecommendations.$inferSelect;
export type InsertSpaceRecommendation = typeof spaceRecommendations.$inferInsert;

export const designPackages = mysqlTable("design_packages", {
  id: int("id").primaryKey().autoincrement(),
  orgId: int("org_id"),
  name: varchar("name", { length: 200 }).notNull(),
  typology: varchar("typology", { length: 100 }).notNull(),
  tier: varchar("tier", { length: 50 }).notNull(),
  style: varchar("style", { length: 100 }).notNull(),
  description: text("description"),
  targetBudgetPerSqm: decimal("target_budget_per_sqm", { precision: 10, scale: 2 }),
  rooms: json("rooms"),                            // SpaceRecommendation[]
  isTemplate: boolean("is_template").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DesignPackageRow = typeof designPackages.$inferSelect;
export type InsertDesignPackage = typeof designPackages.$inferInsert;

export const aiDesignBriefs = mysqlTable("ai_design_briefs", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("project_id").notNull(),
  orgId: int("org_id").notNull(),
  briefData: json("brief_data").notNull(),          // AIDesignBrief
  version: varchar("version", { length: 20 }).default("1.0"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export type AiDesignBriefRow = typeof aiDesignBriefs.$inferSelect;
export type InsertAiDesignBrief = typeof aiDesignBriefs.$inferInsert;
