import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Test Context Helpers ─────────────────────────────────────────────────

function createAdminContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@miyar.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return { ctx };
}

function createUserContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: 2,
      openId: "regular-user",
      email: "user@miyar.com",
      name: "Regular User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return { ctx };
}

// ─── Source Registry Tests ────────────────────────────────────────────────

describe("marketIntel.sources", () => {
  it("seedDefaults creates default UAE sources", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.sources.seedDefaults();
    expect(result).toHaveProperty("created");
    expect(typeof result.created).toBe("number");
  });

  it("list returns all registered sources", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const sources = await caller.marketIntel.sources.list();
    expect(Array.isArray(sources)).toBe(true);
  });

  it("create adds a new source with correct fields", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.sources.create({
      name: "Test Source",
      url: "https://test-source.example.com",
      sourceType: "supplier_catalog",
      reliabilityDefault: "B",
      isWhitelisted: true,
      region: "UAE",
      notes: "Test source for validation",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });
});

// ─── Evidence Records Tests ───────────────────────────────────────────────

describe("marketIntel.evidence", () => {
  it("create adds an evidence record with reliability grading", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.evidence.create({
      category: "floors",
      itemName: "Porcelain Tile 60x60 Grade 1",
      specClass: "Grade 1",
      priceMin: 45,
      priceTypical: 65,
      priceMax: 90,
      unit: "per sqm",
      currencyOriginal: "AED",
      sourceUrl: "https://www.rakceramics.com/ae/tiles",
      publisher: "RAK Ceramics",
      captureDate: "2026-02-01",
      reliabilityGrade: "A",
      confidenceScore: 85,
      extractedSnippet: "Porcelain tiles starting from AED 45/sqm",
      notes: "Official manufacturer catalog price",
    });

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("recordId");
    expect(typeof result.recordId).toBe("string");
    expect(result.recordId.length).toBeGreaterThan(0);
  });

  it("list returns evidence records with filters", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const records = await caller.marketIntel.evidence.list({
      category: "floors",
      limit: 10,
    });

    expect(Array.isArray(records)).toBe(true);
  });

  it("stats returns aggregate statistics", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.marketIntel.evidence.stats();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("byCategory");
    expect(stats).toHaveProperty("byGrade");
    expect(stats).toHaveProperty("avgConfidence");
    expect(typeof stats.total).toBe("number");
  });

  it("bulkImport creates multiple records at once", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.evidence.bulkImport({
      records: [
        {
          category: "walls",
          itemName: "Gypsum Board 12.5mm",
          unit: "per sqm",
          currencyOriginal: "AED",
          sourceUrl: "https://example.com/gypsum",
          captureDate: "2026-02-01",
          reliabilityGrade: "B",
          confidenceScore: 60,
          priceTypical: 18,
        },
        {
          category: "walls",
          itemName: "Cement Plaster",
          unit: "per sqm",
          currencyOriginal: "AED",
          sourceUrl: "https://example.com/plaster",
          captureDate: "2026-02-01",
          reliabilityGrade: "B",
          confidenceScore: 55,
          priceTypical: 25,
        },
      ],
    });

    expect(result).toHaveProperty("imported");
    expect(result.imported).toBe(2);
  });
});

// ─── Benchmark Proposals Tests ────────────────────────────────────────────

describe("marketIntel.proposals", () => {
  it("list returns proposals with optional status filter", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const proposals = await caller.marketIntel.proposals.list({});
    expect(Array.isArray(proposals)).toBe(true);
  });

  it("generate creates proposals from evidence records", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.proposals.generate({
      benchmarkKey: "floors_porcelain_per_sqm",
      currentValue: 70,
    });

    expect(result).toHaveProperty("proposals");
    expect(Array.isArray(result.proposals)).toBe(true);
  });
});

// ─── Competitor Intelligence Tests ────────────────────────────────────────

describe("marketIntel.competitors", () => {
  it("createEntity adds a competitor developer", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.competitors.createEntity({
      name: "Emaar Properties",
      headquarters: "Dubai, UAE",
      segmentFocus: "luxury",
      website: "https://www.emaar.com",
      notes: "Largest developer in UAE",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("listEntities returns all competitor entities", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create one first
    await caller.marketIntel.competitors.createEntity({ name: "Test Entity", segmentFocus: "luxury" });
    const entities = await caller.marketIntel.competitors.listEntities();
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThan(0);
  });

  it("createProject adds a competitor project with positioning data", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const entity = await caller.marketIntel.competitors.createEntity({ name: "Project Test Entity", segmentFocus: "luxury" });
    const entityId = entity.id;

    const result = await caller.marketIntel.competitors.createProject({
      competitorId: entityId,
      projectName: "Dubai Creek Harbour Tower",
      location: "Dubai Creek",
      segment: "ultra_luxury",
      assetType: "residential",
      positioningKeywords: ["waterfront", "branded residences", "smart home"],
      interiorStyleSignals: ["minimalist", "contemporary"],
      materialCues: ["marble", "engineered wood"],
      amenityList: ["infinity pool", "private beach", "concierge"],
      completionStatus: "under_construction",
      sourceUrl: "https://www.emaar.com/creek-harbour",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("compare returns side-by-side comparison with overlap analysis", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create a second entity and project for comparison
    const entity2 = await caller.marketIntel.competitors.createEntity({
      name: "DAMAC Properties",
      headquarters: "Dubai, UAE",
      segmentFocus: "luxury",
    });

    const project2 = await caller.marketIntel.competitors.createProject({
      competitorId: entity2.id,
      projectName: "DAMAC Hills Villa",
      location: "DAMAC Hills",
      segment: "luxury",
      assetType: "residential",
      positioningKeywords: ["golf course", "branded residences", "family"],
      interiorStyleSignals: ["contemporary", "warm tones"],
      materialCues: ["marble", "porcelain", "timber"],
      amenityList: ["golf course", "gym", "concierge"],
      completionStatus: "completed",
    });

    const projects = await caller.marketIntel.competitors.listProjects({});
    const projectIds = projects.slice(0, 2).map((p: any) => p.id);

    if (projectIds.length >= 2) {
      const comparison = await caller.marketIntel.competitors.compare({ projectIds });
      expect(comparison).toHaveProperty("projects");
      expect(comparison.projects.length).toBe(2);
      expect(comparison).toHaveProperty("matrix");
    }
  });
});

// ─── Trend Tags Tests ─────────────────────────────────────────────────────

describe("marketIntel.tags", () => {
  it("create adds a trend tag with controlled vocabulary", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.tags.create({
      name: `biophilic-design-${Date.now()}`,
      category: "design_trend",
      description: "Integration of natural elements into interior spaces",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("list returns tags filtered by category", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create one first
    await caller.marketIntel.tags.create({ name: `test-tag-list-${Date.now()}`, category: "design_trend" });
    const tags = await caller.marketIntel.tags.list({ category: "design_trend" });
    expect(Array.isArray(tags)).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
  });

  it("attach links a tag to an entity", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const tag = await caller.marketIntel.tags.create({ name: `attach-test-tag-${Date.now()}`, category: "material_trend" });
    const entity = await caller.marketIntel.competitors.createEntity({ name: "Tag Attach Entity", segmentFocus: "mid" });

    const result = await caller.marketIntel.tags.attach({
      tagId: tag.id,
      entityType: "competitor_project",
      entityId: entity.id,
    });

    expect(result).toHaveProperty("id");
  });
});

// ─── Audit Log Tests ──────────────────────────────────────────────────────

describe("marketIntel.auditLog", () => {
  it("list returns audit entries from intelligence operations", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const logs = await caller.marketIntel.auditLog.list({ limit: 50 });
    expect(Array.isArray(logs)).toBe(true);
    // Previous operations should have created audit entries
    expect(logs.length).toBeGreaterThan(0);
  });

  it("audit entries contain required fields", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const logs = await caller.marketIntel.auditLog.list({ limit: 1 });
    if (logs.length > 0) {
      const entry = logs[0];
      expect(entry).toHaveProperty("runType");
      expect(entry).toHaveProperty("startedAt");
      expect(entry).toHaveProperty("sourcesProcessed");
      expect(entry).toHaveProperty("recordsExtracted");
    }
  });
});

// ─── Benchmark Snapshots Tests ────────────────────────────────────────────

describe("marketIntel.snapshots", () => {
  it("createManual creates a manual benchmark snapshot", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketIntel.snapshots.create({
      description: "Test manual snapshot for validation",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("list returns all benchmark snapshots", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create one first so list is not empty
    await caller.marketIntel.snapshots.create({ description: "Test snapshot" });
    const snapshots = await caller.marketIntel.snapshots.list();
    expect(Array.isArray(snapshots)).toBe(true);
    expect(snapshots.length).toBeGreaterThan(0);
  });
});

// ─── Access Control Tests ─────────────────────────────────────────────────

describe("marketIntel access control", () => {
  it("regular users can read evidence records", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const records = await caller.marketIntel.evidence.list({});
    expect(Array.isArray(records)).toBe(true);
  });

  it("regular users cannot create sources (admin only)", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.marketIntel.sources.create({
        name: "Unauthorized Source",
        url: "https://unauthorized.com",
        sourceType: "other",
        reliabilityDefault: "C",
        isWhitelisted: false,
      })
    ).rejects.toThrow();
  });
});
