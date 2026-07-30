import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  getOrganizationMemberships: vi.fn(),
  createReportPublicShare: vi.fn(),
  listActiveReportPublicShares: vi.fn(),
  revokeReportPublicShare: vi.fn(),
  resolveReportPublicShare: vi.fn(),
}));

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getOrganizationMemberships: mocks.getOrganizationMemberships,
  };
});

vi.mock("../db/claim-health", async importOriginal => {
  const actual = await importOriginal<typeof import("../db/claim-health")>();
  return {
    ...actual,
    createReportPublicShare: mocks.createReportPublicShare,
    listActiveReportPublicShares: mocks.listActiveReportPublicShares,
    revokeReportPublicShare: mocks.revokeReportPublicShare,
    resolveReportPublicShare: mocks.resolveReportPublicShare,
  };
});

import { ClaimHealthStoreError } from "../db/claim-health";
import { reportShareRouter } from "./report-share";

function context(orgId: number): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "report-share-user",
      password: null,
      name: "Report Share User",
      email: "report-share@example.invalid",
      loginMethod: "test",
      role: "user",
      orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function membership(role: "admin" | "member" | "viewer") {
  return [{ id: 1, userId: 7, orgId: 101, role, createdAt: new Date() }];
}

const claimHealth = {
  claimState: "current",
  evaluatedAt: "2026-07-30T10:00:00.000Z",
  policyVersion: "ev04-claim-health-v1",
  policyManifestDigest: `sha256:${"a".repeat(64)}`,
  requiredCellSchemaVersion: "ev04-required-cell-v1",
  counts: { required: 1, eligible: 1, exact: 1, fallback: 0, optional: 0 },
  reasonCodes: [],
  cells: [],
};

describe("report-backed public shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("allows only an organization admin to create a finite share", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue(membership("member"));
    await expect(
      reportShareRouter
        .createCaller(context(101))
        .create({ reportInstanceId: 501, expiryDays: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createReportPublicShare).not.toHaveBeenCalled();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00.000Z"));
    mocks.getOrganizationMemberships.mockResolvedValue(membership("admin"));
    mocks.createReportPublicShare.mockResolvedValue({
      shareId: 91,
      token: "a".repeat(43),
      expiresAt: new Date("2026-08-06T12:00:00.000Z"),
    });

    await expect(
      reportShareRouter
        .createCaller(context(101))
        .create({ reportInstanceId: 501, expiryDays: 7 })
    ).resolves.toMatchObject({
      shareId: 91,
      token: "a".repeat(43),
      shareUrl: `/report-share/${"a".repeat(43)}`,
      expiresAt: new Date("2026-08-06T12:00:00.000Z"),
    });
    expect(mocks.createReportPublicShare).toHaveBeenCalledWith(
      {
        organizationId: 101,
        reportInstanceId: 501,
        expiresAt: new Date("2026-08-06T12:00:00.000Z"),
      },
      expect.objectContaining({
        kind: "organization_admin",
        organizationId: 101,
        userId: 7,
      })
    );
  });

  it("lists persisted active shares after reload without exposing tokens or hashes", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue(membership("admin"));
    mocks.listActiveReportPublicShares.mockResolvedValue([
      {
        shareId: 91,
        createdAt: new Date("2026-07-30T12:00:00.000Z"),
        expiresAt: new Date("2026-08-06T12:00:00.000Z"),
        revokedAt: null,
        active: true,
        token: "must-not-leak",
        tokenHash: "must-not-leak",
      },
    ]);

    const listed = await reportShareRouter
      .createCaller(context(101))
      .list({ reportInstanceId: 501 });

    expect(mocks.listActiveReportPublicShares).toHaveBeenCalledWith(
      { organizationId: 101, reportInstanceId: 501 },
      expect.objectContaining({
        kind: "organization_admin",
        organizationId: 101,
        userId: 7,
      })
    );
    expect(listed).toEqual([
      {
        shareId: 91,
        createdAt: new Date("2026-07-30T12:00:00.000Z"),
        expiresAt: new Date("2026-08-06T12:00:00.000Z"),
        revokedAt: null,
        active: true,
      },
    ]);
    expect(JSON.stringify(listed)).not.toMatch(/token|hash/i);
  });

  it("requires organization admin and conceals cross-tenant report lists", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue(membership("member"));
    await expect(
      reportShareRouter
        .createCaller(context(101))
        .list({ reportInstanceId: 501 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.listActiveReportPublicShares).not.toHaveBeenCalled();

    mocks.getOrganizationMemberships.mockResolvedValue(membership("admin"));
    mocks.listActiveReportPublicShares.mockRejectedValue(
      new ClaimHealthStoreError("CONCEALED", "foreign report")
    );
    await expect(
      reportShareRouter
        .createCaller(context(101))
        .list({ reportInstanceId: 901 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Report share not found or expired",
    });
  });

  it("conceals cross-organization revocation targets", async () => {
    mocks.getOrganizationMemberships.mockResolvedValue(membership("admin"));
    mocks.revokeReportPublicShare.mockRejectedValue(
      new ClaimHealthStoreError("CONCEALED", "private tenant detail")
    );
    await expect(
      reportShareRouter.createCaller(context(101)).revoke({ shareId: 92 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Report share not found or expired",
    });
  });

  it("returns only minimal report identity and the frozen safe projection", async () => {
    mocks.resolveReportPublicShare.mockResolvedValue({
      report: {
        reportType: "full_report",
        locale: "ar",
        generatedAt: new Date("2026-07-30T10:00:00.000Z"),
      },
      expiresAt: new Date("2026-08-06T12:00:00.000Z"),
      claimHealth,
    });
    const resolved = await reportShareRouter
      .createCaller(context(101))
      .resolve({ token: "z".repeat(43) });

    expect(resolved).toEqual({
      report: {
        reportType: "full_report",
        locale: "ar",
        generatedAt: new Date("2026-07-30T10:00:00.000Z"),
      },
      expiresAt: new Date("2026-08-06T12:00:00.000Z"),
      claimHealth,
    });
    expect(JSON.stringify(resolved)).not.toMatch(
      /organizationId|projectId|storageKey|tokenHash|content|incident|source|actor|provenance/
    );
  });

  it.each([
    ["malformed", null, "short"],
    ["missing", null],
    ["expired", null],
    ["revoked", null],
    [
      "tampered",
      new ClaimHealthStoreError("INVALID", "private digest mismatch"),
    ],
  ])("conceals a %s public share", async (_label, outcome, token) => {
    if (outcome instanceof Error) {
      mocks.resolveReportPublicShare.mockRejectedValue(outcome);
    } else {
      mocks.resolveReportPublicShare.mockResolvedValue(outcome);
    }
    await expect(
      reportShareRouter
        .createCaller(context(101))
        .resolve({ token: token ?? "z".repeat(43) })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Report share not found or expired",
    });
  });
});
