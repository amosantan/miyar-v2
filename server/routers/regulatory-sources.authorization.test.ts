import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { regulatorySourceRouter } from "./regulatory-sources";

const context = (role: "user" | "admin" | null): TrpcContext => ({
  user: role ? {
    id: role === "admin" ? 1 : 2,
    openId: `${role}-reg-source-test`, password: null, name: role, email: null,
    loginMethod: "test", role, orgId: 42, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } : null,
  req: { headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("regulatory source platform authorization", () => {
  it.each([null, "user"] as const)("conceals governance from %s callers", async role => {
    const caller = regulatorySourceRouter.createCaller(context(role));
    const denied = [
      caller.catalogue(), caller.list(), caller.versions({ sourceKey: "dm.dubai-building-code" }),
      caller.registerCatalogueSource({ sourceKey: "dm.dubai-building-code" }),
      caller.assertVersion({ sourceVersionId: 1, assertionType: "authenticity", decision: "accepted", reason: "Independent platform source review", validFrom: "2026-07-21T00:00:00.000Z" }),
      caller.relateVersions({ sourceVersionId: 1, targetSourceVersionId: 2, relationType: "amends", clauseScope: ["5.2"] }),
    ];
    await Promise.all(denied.map(operation => expect(operation).rejects.toMatchObject({ code: "FORBIDDEN" })));
  });

  it("allows platform administrators to view only registration metadata", async () => {
    const catalogue = await regulatorySourceRouter.createCaller(context("admin")).catalogue();
    expect(catalogue.length).toBeGreaterThan(0);
    expect(JSON.stringify(catalogue)).not.toContain("storageReference");
    expect(JSON.stringify(catalogue)).not.toContain("candidateSummary");
  });
});
