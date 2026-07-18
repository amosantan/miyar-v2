import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/InvestorSummary.tsx"), "utf8");

describe("TR-13 investor share controls", () => {
  it("derives project sharing authority from the active organization membership", () => {
    expect(source).toContain("trpc.organization.myOrgs.useQuery");
    expect(source).toContain("const projectOrgId = project?.orgId");
    expect(source).not.toContain("project?.orgId ?? user?.orgId");
    expect(source).toContain("organizations?.find(({ org }) => org.id === projectOrgId)");
    expect(source).toContain('activeOrgMembership?.role === "admin"');
  });

  it("keeps share affordances absent and mutation handlers guarded for non-admins", () => {
    expect(source).toContain("{isProjectOrgAdmin && (");
    expect(source).toContain("if (!isProjectOrgAdmin) return;");
    expect(source).toContain('data-share-controls');
    expect(source).toContain("Revoke all project share links");
  });

  it("refreshes sanitized status and copies, but never displays or logs, the share URL", () => {
    expect(source).toContain("utils.designAdvisor.getDesignBrief.invalidate({ projectId })");
    expect(source.match(/utils\.designAdvisor\.getDesignBrief\.invalidate\(\{ projectId \}\)/g)).toHaveLength(2);
    expect(source).toContain("navigator.clipboard.writeText(full)");
    expect(source).toContain("brief?.shareStatus");
    expect(source).not.toContain("shareToken");
    expect(source).not.toContain("${full}");
    expect(source).not.toMatch(/console\.(log|info|warn).*share/i);
  });
});
