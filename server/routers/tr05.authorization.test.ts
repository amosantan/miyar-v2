import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  getProjectById: vi.fn(),
  listOrganizationEvidenceRecords: vi.fn(),
  listPublicCorpusEvidence: vi.fn(),
  getTrendSnapshotsForOrg: vi.fn(),
  getMaterialBoardsByProject: vi.fn(),
  getProjectInsightsForOrg: vi.fn(),
  getGlobalProjectInsights: vi.fn(),
  getScoreMatricesByProject: vi.fn(),
  getComparableScoreMatricesForOrg: vi.fn(),
  insertOrganizationTrendSnapshot: vi.fn(),
  insertPublicTrendSnapshot: vi.fn(),
  getMaterialLibrary: vi.fn(),
  getPublicDesignTrends: vi.fn(),
  getAllScoreMatrices: vi.fn(),
  listEvidenceRecords: vi.fn(),
  getTrendSnapshots: vi.fn(),
  getDesignTrends: vi.fn(),
}));

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, ...mocks };
});

import { predictiveRouter } from "./predictive";
import { analyticsRouter } from "./analytics";
import { designAdvisorRouter } from "./design-advisor";
import { startLearningScheduler } from "../engines/learning/scheduler";

function context(
  orgId: number,
  platformRole: "user" | "admin" = "user"
): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "tr05-user",
      password: null,
      name: "TR-05 User",
      email: "tr05@example.invalid",
      loginMethod: "test",
      role: platformRole,
      orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function membership(orgId: number) {
  return {
    id: 1,
    userId: 7,
    orgId,
    role: "member",
    createdAt: new Date(),
  };
}

function evidence(id: number, price: number) {
  return {
    id,
    priceMin: String(price),
    priceTypical: String(price),
    priceMax: String(price),
    unit: "sqm",
    reliabilityGrade: "A",
    confidenceScore: 90,
    captureDate: new Date("2026-01-01"),
    category: "floors",
  };
}

describe("TR-05 organization-isolated learning contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationMemberships.mockResolvedValue([membership(101)]);
    mocks.getProjectById.mockImplementation(async (id: number) => {
      if (id === 11) {
        return {
          id,
          orgId: 101,
          ctx01Typology: "Residential",
          mkt01Tier: "Mid",
          ctx04Location: "UAE",
        };
      }
      if (id === 22) return { id, orgId: 202 };
      return undefined;
    });
    mocks.listOrganizationEvidenceRecords.mockResolvedValue([
      evidence(1, 100),
      evidence(2, 110),
      evidence(3, 120),
    ]);
    mocks.listPublicCorpusEvidence.mockResolvedValue([]);
    mocks.getTrendSnapshotsForOrg.mockResolvedValue([]);
    mocks.getMaterialBoardsByProject.mockResolvedValue([]);
    mocks.getProjectInsightsForOrg.mockResolvedValue([]);
    mocks.getGlobalProjectInsights.mockResolvedValue([]);
    mocks.getScoreMatricesByProject.mockResolvedValue([
      {
        projectId: 11,
        compositeScore: "70",
        decisionStatus: "validated",
        variableContributions: {},
      },
    ]);
    mocks.getComparableScoreMatricesForOrg.mockResolvedValue([]);
    mocks.insertOrganizationTrendSnapshot.mockResolvedValue(undefined);
    mocks.insertPublicTrendSnapshot.mockResolvedValue(undefined);
    mocks.getMaterialLibrary.mockResolvedValue([]);
    mocks.getPublicDesignTrends.mockResolvedValue([]);
  });

  it("conceals another organization's project before predictive data reads", async () => {
    const caller = predictiveRouter.createCaller(context(101));
    await expect(
      caller.getCostRange({ projectId: 22, category: "floors" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.listOrganizationEvidenceRecords).not.toHaveBeenCalled();
    expect(mocks.listPublicCorpusEvidence).not.toHaveBeenCalled();
  });

  it("uses only organization and governed-public evidence for cost prediction", async () => {
    const caller = predictiveRouter.createCaller(context(101));
    const result = await caller.getCostRange({
      projectId: 11,
      category: "floors",
    });
    expect(result.status).toBe("ok");
    expect(result.p50).toBe(110);
    expect(result.organizationSampleCount).toBe(3);
    expect(result.publicSampleCount).toBe(0);
    expect(mocks.getAllScoreMatrices).not.toHaveBeenCalled();
    expect(mocks.listEvidenceRecords).not.toHaveBeenCalled();
    expect(mocks.getTrendSnapshots).not.toHaveBeenCalled();
  });

  it("returns explicit insufficiency without cross-organization comparables", async () => {
    const result = await predictiveRouter
      .createCaller(context(101))
      .getOutcomePrediction({ projectId: 11 });
    expect(result.comparableCount).toBe(0);
    expect(result.corpusPolicyVersion).toBe("org-public-v1");
    expect(result.insufficiencyReason).toBe("no_same_organization_comparables");
    expect(mocks.getAllScoreMatrices).not.toHaveBeenCalled();
  });

  it("does not present a scenario forecast without governed trend data", async () => {
    const result = await predictiveRouter
      .createCaller(context(101))
      .getScenarioProjection({ projectId: 11 });
    expect(result).toMatchObject({
      status: "insufficient_data",
      corpusPolicyVersion: "org-public-v1",
      organizationSampleCount: 0,
      publicSampleCount: 0,
      insufficiencyReason: "no_governed_trend_data",
    });
  });

  it("stores tenant trend detection as organization-owned", async () => {
    const result = await analyticsRouter
      .createCaller(context(101))
      .runTrendDetection({
        category: "floors",
        geography: "UAE",
        windowDays: 30,
        generateNarrative: false,
      });
    expect(result.corpusPolicyVersion).toBe("org-public-v1");
    expect(mocks.insertOrganizationTrendSnapshot).toHaveBeenCalled();
    expect(mocks.insertPublicTrendSnapshot).not.toHaveBeenCalled();
  });

  it("reads project insights only through the organization-scoped helper", async () => {
    await analyticsRouter
      .createCaller(context(101))
      .getProjectInsights({ projectId: 11, limit: 20 });
    expect(mocks.getProjectInsightsForOrg).toHaveBeenCalledWith(101, {
      projectId: 11,
      insightType: undefined,
      severity: undefined,
      status: undefined,
      limit: 20,
    });
  });

  it("requires platform admin for public trend creation", async () => {
    await expect(
      analyticsRouter.createCaller(context(101)).runPublicTrendDetection({
        category: "floors",
        geography: "UAE",
        windowDays: 30,
        generateNarrative: false,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.insertPublicTrendSnapshot).not.toHaveBeenCalled();
  });

  it("does not invoke design recommendation generation without safe context", async () => {
    mocks.listOrganizationEvidenceRecords.mockResolvedValue([]);
    const result = await designAdvisorRouter
      .createCaller(context(101))
      .generateRecommendations({ projectId: 11 });
    expect(result).toMatchObject({
      status: "insufficient_data",
      count: 0,
      corpusPolicyVersion: "org-public-v1",
    });
    expect(mocks.getDesignTrends).not.toHaveBeenCalled();
    expect(mocks.listEvidenceRecords).not.toHaveBeenCalled();
  });

  it("hard-disables the pooled weekly learning scheduler", () => {
    expect(startLearningScheduler()).toEqual({
      started: false,
      reason: "pooled_learning_disabled",
    });
  });

  it("removes post-mortem derived evidence emission and unscoped helpers", () => {
    const source = readFileSync(
      new URL("./learning.ts", import.meta.url),
      "utf8"
    );
    expect(source).not.toContain("generatePostMortemEvidence");
    expect(source).not.toContain("createEvidenceRecord(");
    expect(source).not.toContain("getAllScoreMatrices");
    expect(source).not.toContain("listEvidenceRecords");
    expect(source).not.toContain("getTrendSnapshots(");
  });

  it("classifies admin-created evidence as governed platform-public data", () => {
    const source = readFileSync(
      new URL("./market-intelligence.ts", import.meta.url),
      "utf8"
    );
    const publicScopeWrites = source.match(/corpusScope: "platform_public"/g) ?? [];
    const publicPolicyWrites = source.match(/corpusPolicyVersion: "public-v1"/g) ?? [];
    expect(publicScopeWrites.length).toBeGreaterThanOrEqual(2);
    expect(publicPolicyWrites.length).toBeGreaterThanOrEqual(2);
  });

  it("does not render zero platform accuracy when no governed snapshot exists", () => {
    const source = readFileSync(
      new URL("../../client/src/pages/admin/LearningDashboard.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("No governed accuracy snapshot");
    expect(source).not.toContain('lData ? Number(lData.overallPlatformAccuracy).toFixed(1) : "0.0"');
  });
});
