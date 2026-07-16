import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_NOW,
  authorizationFixtures,
} from "../test-utils/authorization-fixtures";

const mocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
  storageDelete: vi.fn(),
  generateImage: vi.fn(),
  runFloorPlanAnalysis: vi.fn(),
  nanoid: vi.fn(),
  db: {
    getOrganizationMemberships: vi.fn(),
    getProjectById: vi.fn(),
    getProjectAssets: vi.fn(),
    getProjectAssetById: vi.fn(),
    getDesignBriefById: vi.fn(),
    getDesignBriefsByProject: vi.fn(),
    getGeneratedVisualById: vi.fn(),
    getMaterialBoardById: vi.fn(),
    getMaterialToBoardById: vi.fn(),
    getScenarioById: vi.fn(),
    getReportById: vi.fn(),
    getScoreMatrixById: vi.fn(),
    getPromptTemplateById: vi.fn(),
    getAssetLinkById: vi.fn(),
    getAssetLinksByAsset: vi.fn(),
    getAssetLinksByEntity: vi.fn(),
    getAiDesignBriefByShareToken: vi.fn(),
    getSpaceRecommendations: vi.fn(),
    getBenchmarkForProject: vi.fn(),
    getDesignTrends: vi.fn(),
    getDldAreaBenchmark: vi.fn(),
    getEvidenceWithSources: vi.fn(),
    reorderBoardTilesForOrg: vi.fn(),
    updateProjectAssetForOrg: vi.fn(),
    createAssetLinkForOrg: vi.fn(),
    createCommentForOrg: vi.fn(),
    createAuditLog: vi.fn(),
    createProjectAssetForOrg: vi.fn(),
    createMaterialBoardWithMaterialsForOrg: vi.fn(),
    insertRfqLineItemsForOrg: vi.fn(),
    updateAiDesignBriefShareTokenForOrg: vi.fn(),
    createFloorPlanAssetAndLinkForOrg: vi.fn(),
    getLatestAiDesignBrief: vi.fn(),
    updateProjectForOrg: vi.fn(),
  },
}));

vi.mock("../db", () => mocks.db);
vi.mock("../storage", () => ({
  storagePut: mocks.storagePut,
  storageDelete: mocks.storageDelete,
}));
vi.mock("../_core/imageGeneration", () => ({
  generateImage: mocks.generateImage,
}));
vi.mock("../engines/design/floor-plan-analyzer", () => ({
  analyzeFloorPlan: mocks.runFloorPlanAnalysis,
}));
vi.mock("nanoid", () => ({ nanoid: mocks.nanoid }));

import { designRouter } from "./design";

const { contexts, projects } = authorizationFixtures;

const assets = {
  orgA: {
    id: 111,
    projectId: projects.orgA.id,
    filename: "a.png",
    mimeType: "image/png",
    storageUrl: "https://example.invalid/a.png",
  },
  orgB: {
    id: 222,
    projectId: projects.orgB.id,
    filename: "b.png",
    mimeType: "image/png",
    storageUrl: "https://example.invalid/b.png",
  },
};

const briefs = {
  orgA: { id: 311, projectId: projects.orgA.id },
  orgB: { id: 322, projectId: projects.orgB.id },
};

const boards = {
  orgA: { id: 411, projectId: projects.orgA.id },
  orgB: { id: 422, projectId: projects.orgB.id },
};

const joins = {
  orgA: { id: 511, boardId: boards.orgA.id },
  orgB: { id: 522, boardId: boards.orgB.id },
};

const promptTemplates = {
  orgA: { id: 611, orgId: projects.orgA.orgId, templateText: "A template" },
  orgB: { id: 622, orgId: projects.orgB.orgId, templateText: "B template" },
  legacyNull: { id: 633, orgId: null, templateText: "Legacy template" },
};

const scenarios = {
  orgA: { id: 711, projectId: projects.orgA.id, orgId: projects.orgA.orgId },
  orgB: { id: 722, projectId: projects.orgB.id, orgId: projects.orgB.orgId },
};

function byId<T extends { id: number }>(...records: T[]) {
  return async (id: number) => records.find(record => record.id === id);
}

describe("design router authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.getOrganizationMemberships.mockImplementation(
      async (userId: number, orgId: number) => [{
        id: userId,
        userId,
        orgId,
        role: "admin",
        createdAt: AUTH_NOW,
      }]
    );
    mocks.db.getProjectById.mockImplementation(
      byId(projects.orgA, projects.orgB, projects.legacyNull)
    );
    mocks.db.getProjectAssetById.mockImplementation(
      byId(assets.orgA, assets.orgB)
    );
    mocks.db.getDesignBriefById.mockImplementation(
      byId(briefs.orgA, briefs.orgB)
    );
    mocks.db.getMaterialBoardById.mockImplementation(
      byId(boards.orgA, boards.orgB)
    );
    mocks.db.getMaterialToBoardById.mockImplementation(
      byId(joins.orgA, joins.orgB)
    );
    mocks.db.getPromptTemplateById.mockImplementation(
      byId(
        promptTemplates.orgA,
        promptTemplates.orgB,
        promptTemplates.legacyNull
      )
    );
    mocks.db.getScenarioById.mockImplementation(
      byId(scenarios.orgA, scenarios.orgB)
    );
    mocks.db.getDesignBriefsByProject.mockResolvedValue([]);
    mocks.db.getProjectAssets.mockResolvedValue([assets.orgA]);
    mocks.db.getAssetLinksByAsset.mockResolvedValue([]);
    mocks.db.getAssetLinksByEntity.mockResolvedValue([]);
    mocks.db.reorderBoardTilesForOrg.mockResolvedValue(true);
    mocks.db.updateProjectAssetForOrg.mockResolvedValue(true);
    mocks.db.createAssetLinkForOrg.mockResolvedValue({ id: 800 });
    mocks.db.createCommentForOrg.mockResolvedValue({ id: 1 });
    mocks.db.createProjectAssetForOrg.mockResolvedValue({ id: 900 });
    mocks.db.createMaterialBoardWithMaterialsForOrg.mockResolvedValue({ id: 901 });
    mocks.db.insertRfqLineItemsForOrg.mockResolvedValue(true);
    mocks.db.updateAiDesignBriefShareTokenForOrg.mockResolvedValue(true);
    mocks.db.createFloorPlanAssetAndLinkForOrg.mockResolvedValue({ id: 902 });
    mocks.db.updateProjectForOrg.mockResolvedValue(true);
    mocks.storagePut.mockResolvedValue({
      key: "projects/11/upload.png",
      url: "https://example.invalid/upload.png",
    });
    mocks.storageDelete.mockResolvedValue(undefined);
    mocks.nanoid.mockReturnValue("share-token-default-123456789012");
  });

  it("requires authentication and organization context before project lookup", async () => {
    const unauthenticated = designRouter.createCaller(contexts.unauthenticated);
    const withoutOrganization = designRouter.createCaller(
      contexts.withoutOrganization
    );

    await expect(
      unauthenticated.listAssets({ projectId: projects.orgA.id })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      withoutOrganization.listAssets({ projectId: projects.orgA.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.db.getProjectById).not.toHaveBeenCalled();
  });

  it("allows same-organization project reads", async () => {
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.listAssets({ projectId: projects.orgA.id })
    ).resolves.toEqual([assets.orgA]);
    expect(mocks.db.getProjectAssets).toHaveBeenCalledWith(
      projects.orgA.id,
      undefined
    );
  });

  it.each([
    ["cross-organization", projects.orgB.id],
    ["missing", 9999],
    ["legacy-null", projects.legacyNull.id],
  ])(
    "conceals a %s project before downstream reads",
    async (_label, projectId) => {
      const caller = designRouter.createCaller(contexts.orgA);

      await expect(caller.listAssets({ projectId })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Project not found",
      });
      expect(mocks.db.getProjectAssets).not.toHaveBeenCalled();
    }
  );

  it("rejects a cross-organization upload before storage", async () => {
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.uploadAsset({
        projectId: projects.orgB.id,
        filename: "secret.png",
        mimeType: "image/png",
        base64Data: "AA==",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.db.createProjectAssetForOrg).not.toHaveBeenCalled();
    expect(mocks.db.createAuditLog).not.toHaveBeenCalled();
  });

  it("keeps design viewers read-only before resource access", async () => {
    mocks.db.getOrganizationMemberships.mockResolvedValue([{
      id: 1,
      userId: contexts.orgA.user!.id,
      orgId: projects.orgA.orgId,
      role: "viewer",
      createdAt: AUTH_NOW,
    }]);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.uploadAsset({
      projectId: projects.orgA.id,
      filename: "blocked.png",
      mimeType: "image/png",
      base64Data: "AA==",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.db.getProjectById).not.toHaveBeenCalled();
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("requires an organization admin for share creation", async () => {
    mocks.db.getOrganizationMemberships.mockResolvedValue([{
      id: 1,
      userId: contexts.orgA.user!.id,
      orgId: projects.orgA.orgId,
      role: "member",
      createdAt: AUTH_NOW,
    }]);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.createShareLink({
      projectId: projects.orgA.id,
      expiryDays: 7,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.db.getProjectById).not.toHaveBeenCalled();
    expect(mocks.db.updateAiDesignBriefShareTokenForOrg).not.toHaveBeenCalled();
  });

  it("retries a share-token collision and succeeds without exposing collision details", async () => {
    const duplicate = Object.assign(new Error("drizzle query failed"), {
      cause: Object.assign(new Error("duplicate unique index token-secret"), {
        code: "ER_DUP_ENTRY",
        errno: 1062,
      }),
    });
    mocks.db.getLatestAiDesignBrief.mockResolvedValue({
      id: 91,
      projectId: projects.orgA.id,
      orgId: projects.orgA.orgId,
    });
    mocks.nanoid
      .mockReturnValueOnce("first-collision-token-1234567890")
      .mockReturnValueOnce("second-valid-token-123456789012");
    mocks.db.updateAiDesignBriefShareTokenForOrg
      .mockRejectedValueOnce(duplicate)
      .mockResolvedValueOnce(true);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.createShareLink({
      projectId: projects.orgA.id,
      expiryDays: 7,
    })).resolves.toMatchObject({
      token: "second-valid-token-123456789012",
      shareUrl: "/share/second-valid-token-123456789012",
    });
    expect(mocks.db.updateAiDesignBriefShareTokenForOrg).toHaveBeenCalledTimes(2);
  });

  it("returns a generic error after five share-token collisions", async () => {
    const duplicate = Object.assign(new Error("duplicate token-secret index-name"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    });
    mocks.db.getLatestAiDesignBrief.mockResolvedValue({
      id: 91,
      projectId: projects.orgA.id,
      orgId: projects.orgA.orgId,
    });
    mocks.db.updateAiDesignBriefShareTokenForOrg.mockRejectedValue(duplicate);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.createShareLink({
      projectId: projects.orgA.id,
      expiryDays: 7,
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to create a unique share link",
    });
    expect(mocks.db.updateAiDesignBriefShareTokenForOrg).toHaveBeenCalledTimes(5);
  });

  it("preserves NOT_FOUND when the final scoped share update loses authorization", async () => {
    mocks.db.getLatestAiDesignBrief.mockResolvedValue({
      id: 91,
      projectId: projects.orgA.id,
      orgId: projects.orgA.orgId,
    });
    mocks.db.updateAiDesignBriefShareTokenForOrg.mockResolvedValue(false);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.createShareLink({
      projectId: projects.orgA.id,
      expiryDays: 7,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("conceals non-duplicate database details during share creation", async () => {
    mocks.db.getLatestAiDesignBrief.mockResolvedValue({
      id: 91,
      projectId: projects.orgA.id,
      orgId: projects.orgA.orgId,
    });
    mocks.db.updateAiDesignBriefShareTokenForOrg.mockRejectedValue(
      new Error("connection sql token-secret")
    );
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.createShareLink({
      projectId: projects.orgA.id,
      expiryDays: 7,
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to create share link",
    });
  });

  it("compensates an explicitly rejected asset persistence", async () => {
    mocks.db.createProjectAssetForOrg.mockResolvedValue(null);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.uploadAsset({
      projectId: projects.orgA.id,
      filename: "rejected.png",
      mimeType: "image/png",
      base64Data: "AA==",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.storageDelete).toHaveBeenCalledWith("projects/11/upload.png");
    expect(mocks.db.createAuditLog).not.toHaveBeenCalled();
  });

  it("does not delete an upload after an indeterminate database exception", async () => {
    mocks.db.createProjectAssetForOrg.mockRejectedValue(new Error("connection lost"));
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.uploadAsset({
      projectId: projects.orgA.id,
      filename: "uncertain.png",
      mimeType: "image/png",
      base64Data: "AA==",
    })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });

  it("rejects duplicate board material IDs before the atomic insert", async () => {
    const caller = designRouter.createCaller(contexts.orgA);
    await expect(caller.createBoard({
      projectId: projects.orgA.id,
      boardName: "Duplicate",
      materialIds: [1, 1],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.db.createMaterialBoardWithMaterialsForOrg).not.toHaveBeenCalled();
  });

  it("conceals cross-organization child resources", async () => {
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.getBrief({ briefId: briefs.orgB.id })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  });

  it("rejects an existing brief with a cross-project scenario association", async () => {
    mocks.db.getDesignBriefsByProject.mockResolvedValue([
      { ...briefs.orgA, scenarioId: scenarios.orgB.id },
    ]);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.listBriefs({ projectId: projects.orgA.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects cross-project polymorphic asset targets", async () => {
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.linkAsset({
        assetId: assets.orgA.id,
        linkType: "material_board",
        linkId: boards.orgB.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.db.createAssetLinkForOrg).not.toHaveBeenCalled();
  });

  it.each([
    ["cross-organization", promptTemplates.orgB.id],
    ["legacy-null", promptTemplates.legacyNull.id],
    ["missing", 9999],
  ])(
    "rejects an explicit %s prompt template before generation",
    async (_label, templateId) => {
      const caller = designRouter.createCaller(contexts.orgA);

      await expect(
        caller.generateVisual({
          projectId: projects.orgA.id,
          type: "mood",
          templateId,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(mocks.generateImage).not.toHaveBeenCalled();
    }
  );

  it("fails closed when a scoped mutation loses authorization", async () => {
    mocks.db.updateProjectAssetForOrg.mockResolvedValue(false);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.updateAsset({
        assetId: assets.orgA.id,
        notes: "changed after authorization",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  });

  it("rejects a mixed-board reorder before the scoped mutation", async () => {
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.reorderBoardTiles({
        boardId: boards.orgA.id,
        orderedJoinIds: [joins.orgA.id, joins.orgB.id],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.db.reorderBoardTilesForOrg).not.toHaveBeenCalled();
  });

  it("rejects a comment target that belongs to another project", async () => {
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.addComment({
        projectId: projects.orgA.id,
        entityType: "design_brief",
        entityId: briefs.orgB.id,
        content: "Do not leak this",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.db.createCommentForOrg).not.toHaveBeenCalled();
  });

  it("scopes organization-wide evidence to the caller organization", async () => {
    mocks.db.getEvidenceWithSources.mockResolvedValue([]);
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(caller.getEvidenceChain({})).resolves.toEqual({
      evidence: [],
    });
    expect(mocks.db.getEvidenceWithSources).toHaveBeenCalledWith({
      orgId: projects.orgA.orgId,
      category: undefined,
      projectId: undefined,
      limit: 20,
    });
  });

  it("rejects a foreign floor-plan asset before analysis", async () => {
    mocks.db.getProjectById.mockImplementation(async (id: number) => {
      if (id === projects.orgA.id) {
        return { ...projects.orgA, floorPlanAssetId: assets.orgB.id };
      }
      if (id === projects.orgB.id) return projects.orgB;
      return undefined;
    });
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.analyzeFloorPlan({ projectId: projects.orgA.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.runFloorPlanAnalysis).not.toHaveBeenCalled();
    expect(mocks.db.updateProjectForOrg).not.toHaveBeenCalled();
    expect(mocks.db.createAuditLog).not.toHaveBeenCalled();
  });

  it("fails visual attachments closed without data access", async () => {
    const caller = designRouter.createCaller(contexts.orgA);

    await expect(
      caller.attachVisualToPack({
        visualId: 1,
        targetType: "pack_section",
        targetId: 2,
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.db.getGeneratedVisualById).not.toHaveBeenCalled();
    expect(mocks.db.createAuditLog).not.toHaveBeenCalled();
  });

  it("rejects an expired public share before downstream reads", async () => {
    mocks.db.getAiDesignBriefByShareToken.mockResolvedValue({
      id: 700,
      projectId: projects.orgA.id,
      orgId: projects.orgA.orgId,
      shareExpiresAt: new Date(AUTH_NOW.getTime() - 1),
    });
    const caller = designRouter.createCaller(contexts.unauthenticated);

    await expect(
      caller.resolveShareLink({ token: "expired-token" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Share link not found or expired",
    });
    expect(mocks.db.getSpaceRecommendations).not.toHaveBeenCalled();
    expect(mocks.db.getBenchmarkForProject).not.toHaveBeenCalled();
    expect(mocks.db.getDesignTrends).not.toHaveBeenCalled();
  });
});
