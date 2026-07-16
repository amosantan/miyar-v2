import { describe, expect, it, vi } from "vitest";
import { requireActivePublicShare } from "./public-share-access";
import {
  AUTH_NOW,
  authorizationFixtures,
} from "../test-utils/authorization-fixtures";

const { projects, shares } = authorizationFixtures;

function expectShareNotFound(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({
    code: "NOT_FOUND",
    message: "Share link not found or expired",
  });
}

function resolveShare(
  brief: (typeof shares)[keyof typeof shares] | undefined,
  project: (typeof projects)[keyof typeof projects] | undefined
) {
  return requireActivePublicShare("test-token", {
    lookupBrief: vi.fn(async () => brief),
    lookupProject: vi.fn(async () => project),
    now: () => AUTH_NOW,
  });
}

describe("requireActivePublicShare", () => {
  it("returns an active share with an internally consistent project", async () => {
    await expect(resolveShare(shares.active, projects.orgA)).resolves.toEqual({
      brief: shares.active,
      project: projects.orgA,
    });
  });

  it.each([
    ["missing token", undefined, projects.orgA],
    ["expired token", shares.expired, projects.orgA],
    ["exact-boundary expiry", shares.exactBoundary, projects.orgA],
    ["null expiry", shares.nullExpiry, projects.orgA],
    ["legacy-null brief ownership", shares.nullOrg, projects.orgA],
    ["orphaned brief", shares.orphaned, undefined],
    [
      "brief/project organization mismatch",
      shares.mismatchedOrg,
      projects.orgA,
    ],
    ["legacy-null project ownership", shares.active, projects.legacyNull],
  ])("conceals a %s", async (_label, brief, project) => {
    await expectShareNotFound(resolveShare(brief, project));
  });

  it("conceals an invalid expiry value", async () => {
    await expectShareNotFound(
      requireActivePublicShare("test-token", {
        lookupBrief: vi.fn(async () => ({
          ...shares.active,
          shareExpiresAt: "not-a-date",
        })),
        lookupProject: vi.fn(async () => projects.orgA),
        now: () => AUTH_NOW,
      })
    );
  });

  it("does not look up a project when the token is missing", async () => {
    const lookupProject = vi.fn();

    await expectShareNotFound(
      requireActivePublicShare("missing-token", {
        lookupBrief: vi.fn(async () => undefined),
        lookupProject,
        now: () => AUTH_NOW,
      })
    );
    expect(lookupProject).not.toHaveBeenCalled();
  });
});
