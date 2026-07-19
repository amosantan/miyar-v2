import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  getProjectById: vi.fn(),
  updateProjectForOrg: vi.fn(),
  updateProjectWithLegacyGeometryAuthorityForOrg: vi.fn(),
  getProjectGeometryAuthorityModeForOrg: vi.fn(),
  deleteProjectForOrg: vi.fn(),
  createAuditLog: vi.fn(),
  getScenarioById: vi.fn(),
  deleteScenarioForOrg: vi.fn(),
  storagePut: vi.fn(),
  storageGet: vi.fn(),
  getReportsByProject: vi.fn(),
}));

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    ...mocks,
  };
});

vi.mock("../storage", () => ({
  storagePut: mocks.storagePut,
  storageGet: mocks.storageGet,
  storageDelete: vi.fn(),
}));

import { projectRouter } from "./project";
import { scenarioRouter } from "./scenario";
import { portfolioRouter } from "./portfolio";

function context(
  orgId: number,
  role: "admin" | "member" | "viewer"
): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "tr04-user",
      password: null,
      name: "TR-04 User",
      email: "tr04@example.invalid",
      loginMethod: "test",
      role: "user",
      orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function membership(orgId: number, role: "admin" | "member" | "viewer") {
  return {
    id: 1,
    userId: 7,
    orgId,
    role,
    createdAt: new Date(),
  };
}

describe("TR-04 project and scenario authorization contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectById.mockImplementation(async (id: number) => {
      if (id === 11) return { id, orgId: 101, userId: 7, status: "draft" };
      if (id === 22) return { id, orgId: 202, userId: 7, status: "draft" };
      if (id === 33) return { id, orgId: null, userId: 7, status: "draft" };
      return undefined;
    });
    mocks.getScenarioById.mockImplementation(async (id: number) => {
      if (id === 71) return { id, projectId: 11, orgId: 101 };
      if (id === 72) return { id, projectId: 22, orgId: 202 };
      return undefined;
    });
    mocks.updateProjectForOrg.mockResolvedValue(true);
    mocks.updateProjectWithLegacyGeometryAuthorityForOrg.mockResolvedValue(
      "updated"
    );
    mocks.getProjectGeometryAuthorityModeForOrg.mockResolvedValue("legacy");
    mocks.deleteProjectForOrg.mockResolvedValue(true);
    mocks.deleteScenarioForOrg.mockResolvedValue(true);
    mocks.getReportsByProject.mockResolvedValue([]);
    mocks.storageGet.mockResolvedValue({ key: "reports/11/report.html", url: "https://signed.example/report" });
  });

  it.each([
    ["cross-organization", 22],
    ["legacy-null", 33],
    ["missing", 999],
  ])("conceals %s projects even from their legacy creator", async (_label, id) => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "member"),
    ]);
    const caller = projectRouter.createCaller(context(101, "member"));
    await expect(caller.get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  });

  it("rejects viewers before project mutation side effects", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "viewer"),
    ]);
    const caller = projectRouter.createCaller(context(101, "viewer"));
    await expect(caller.update({ id: 11, name: "Blocked" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getProjectById).not.toHaveBeenCalled();
    expect(mocks.updateProjectForOrg).not.toHaveBeenCalled();
  });

  it("allows members to update an owned project through the scoped write", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "member"),
    ]);
    const caller = projectRouter.createCaller(context(101, "member"));
    await expect(caller.update({ id: 11, name: "Owned" }))
      .resolves.toEqual({ success: true });
    expect(mocks.updateProjectForOrg).toHaveBeenCalledWith(
      11,
      101,
      expect.objectContaining({ name: "Owned" })
    );
  });

  it("fails an area update closed when authority becomes canonical at the final write", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "member"),
    ]);
    mocks.getProjectGeometryAuthorityModeForOrg
      .mockResolvedValueOnce("legacy")
      .mockResolvedValueOnce("canonical");
    mocks.updateProjectWithLegacyGeometryAuthorityForOrg.mockResolvedValue(
      "canonical"
    );

    await expect(
      projectRouter.createCaller(context(101, "member")).update({
        id: 11,
        totalFitoutArea: 25,
      })
    ).rejects.toThrow(
      "Legacy room and area values are read-only while canonical geometry is authoritative."
    );
    expect(
      mocks.updateProjectWithLegacyGeometryAuthorityForOrg
    ).toHaveBeenCalledWith(
      11,
      101,
      expect.objectContaining({ totalFitoutArea: "25" })
    );
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("requires organization admin for project deletion", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "member"),
    ]);
    await expect(
      projectRouter.createCaller(context(101, "member")).delete({ id: 11 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.deleteProjectForOrg).not.toHaveBeenCalled();

    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "admin"),
    ]);
    await expect(
      projectRouter.createCaller(context(101, "admin")).delete({ id: 22 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.deleteProjectForOrg).not.toHaveBeenCalled();
  });

  it("rejects cross-organization scenario deletion before the final write", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "member"),
    ]);
    const caller = scenarioRouter.createCaller(context(101, "member"));
    await expect(caller.delete({ id: 72 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.deleteScenarioForOrg).not.toHaveBeenCalled();
  });

  it("rejects report generation before storage or report persistence", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "member"),
    ]);
    await expect(
      projectRouter.createCaller(context(101, "member")).generateReport({
        projectId: 22,
        reportType: "validation_summary",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("re-signs stable report keys only after authorization and never exposes them", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([membership(101, "member")]);
    mocks.getReportsByProject.mockResolvedValue([{
      id: 501,
      projectId: 11,
      scoreMatrixId: 91,
      reportType: "full_report",
      fileUrl: null,
      storageKey: "reports/11/report.html",
      bundleUrl: null,
      content: {},
      benchmarkVersionId: 2,
      modelVersionId: 3,
      generatedAt: new Date(),
      generatedBy: 7,
    }, {
      id: 502,
      projectId: 11,
      scoreMatrixId: 90,
      reportType: "validation_summary",
      fileUrl: "https://legacy.example/report",
      storageKey: null,
      bundleUrl: null,
      content: {},
      benchmarkVersionId: null,
      modelVersionId: null,
      generatedAt: new Date(),
      generatedBy: 7,
    }]);

    const reports = await projectRouter.createCaller(context(101, "member")).listReports({ projectId: 11 });
    expect(mocks.storageGet).toHaveBeenCalledWith("reports/11/report.html");
    expect(reports[0]).toMatchObject({ id: 501, fileUrl: "https://signed.example/report" });
    expect(reports[0]).not.toHaveProperty("storageKey");
    expect(reports[1]).toMatchObject({ id: 502, fileUrl: "https://legacy.example/report" });
    expect(reports[1]).not.toHaveProperty("storageKey");

    await expect(projectRouter.createCaller(context(101, "member")).listReports({ projectId: 22 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getReportsByProject).toHaveBeenCalledTimes(1);
    expect(mocks.storageGet).toHaveBeenCalledTimes(1);
  });

  it("rejects viewers before tenant portfolio-alert calculation or persistence", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue([
      membership(101, "viewer"),
    ]);
    await expect(
      portfolioRouter.createCaller(context(101, "viewer")).checkAlerts({ id: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not let tenant project evaluation invoke the global alert engine", () => {
    const source = readFileSync(new URL("./project.ts", import.meta.url), "utf8");
    expect(source).not.toContain("triggerAlertEngine");
    expect(source).not.toContain("platformAlerts");
  });
});
