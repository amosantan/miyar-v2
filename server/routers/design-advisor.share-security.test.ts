import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  getProjectById: vi.fn(),
  getLatestAiDesignBrief: vi.fn(),
}));

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, ...mocks };
});

import { designAdvisorRouter } from "./design-advisor";

function context(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "advisor-share-user",
      password: null,
      name: "Advisor Share User",
      email: "advisor-share@example.invalid",
      loginMethod: "test",
      role: "user",
      orgId: 101,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("designAdvisor.getDesignBrief share metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationMemberships.mockResolvedValue([{
      id: 1,
      userId: 7,
      orgId: 101,
      role: "member",
      createdAt: new Date(),
    }]);
    mocks.getProjectById.mockResolvedValue({ id: 11, orgId: 101 });
  });

  it("omits the active token and raw expiry while exposing safe active status", async () => {
    const shareToken = "SENTINEL-ACTIVE-SHARE-TOKEN";
    const shareExpiresAt = new Date("2099-01-02T03:04:05.000Z");
    mocks.getLatestAiDesignBrief.mockResolvedValue({
      id: 71,
      projectId: 11,
      orgId: 101,
      briefData: { executiveSummary: "Preserved" },
      version: "1.0",
      shareToken,
      shareExpiresAt,
      generatedAt: new Date("2026-07-18T00:00:00.000Z"),
    });

    const result = await designAdvisorRouter.createCaller(context())
      .getDesignBrief({ projectId: 11 });

    expect(result).toMatchObject({
      id: 71,
      projectId: 11,
      briefData: { executiveSummary: "Preserved" },
      shareStatus: {
        active: true,
        expiresAt: shareExpiresAt.toISOString(),
      },
    });
    expect(result).not.toHaveProperty("shareToken");
    expect(result).not.toHaveProperty("shareExpiresAt");
    expect(JSON.stringify(result)).not.toContain(shareToken);
  });

  it("reports expired and malformed metadata as inactive without exposing secrets", async () => {
    mocks.getLatestAiDesignBrief
      .mockResolvedValueOnce({
        id: 72,
        projectId: 11,
        orgId: 101,
        briefData: {},
        shareToken: "SENTINEL-EXPIRED-TOKEN",
        shareExpiresAt: new Date("2020-01-02T03:04:05.000Z"),
      })
      .mockResolvedValueOnce({
        id: 73,
        projectId: 11,
        orgId: 101,
        briefData: {},
        shareToken: "SENTINEL-MALFORMED-TOKEN",
        shareExpiresAt: "not-a-date",
      });
    const caller = designAdvisorRouter.createCaller(context());

    const expired = await caller.getDesignBrief({ projectId: 11 });
    const malformed = await caller.getDesignBrief({ projectId: 11 });
    expect(expired?.shareStatus).toEqual({
      active: false,
      expiresAt: "2020-01-02T03:04:05.000Z",
    });
    expect(malformed?.shareStatus).toEqual({ active: false, expiresAt: null });
    expect(JSON.stringify({ expired, malformed })).not.toMatch(
      /SENTINEL|shareToken|shareExpiresAt/,
    );
  });

  it("returns null for a never-issued brief lookup", async () => {
    mocks.getLatestAiDesignBrief.mockResolvedValue(null);
    await expect(designAdvisorRouter.createCaller(context()).getDesignBrief({
      projectId: 11,
    })).resolves.toBeNull();
  });

  it("conceals a cross-organization project before reading its brief", async () => {
    mocks.getProjectById.mockResolvedValue({ id: 22, orgId: 202 });
    await expect(designAdvisorRouter.createCaller(context()).getDesignBrief({
      projectId: 22,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getLatestAiDesignBrief).not.toHaveBeenCalled();
  });
});
