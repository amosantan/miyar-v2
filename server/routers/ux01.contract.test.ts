import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildWorkspaceAliasUrl } from "../../client/src/lib/workspace-routes";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("UX-01 compatibility and safety contracts", () => {
  it("keeps every legacy project specialist route registered", () => {
    const app = read("client/src/App.tsx");
    for (const route of [
      "/projects/:id", "/projects/:id/evidence", "/projects/:id/brief",
      "/projects/:id/design-studio", "/projects/:id/boards",
      "/projects/:id/scenario-compare", "/projects/:id/collaboration",
      "/projects/:id/design-advisor", "/projects/:id/investor-summary",
      "/projects/:id/brief-editor", "/projects/:id/explainability",
      "/projects/:id/outcomes", "/projects/:id/verify-areas", "/projects/:id/space-planner",
    ]) expect(app).toContain(`path="${route}"`);
  });

  it("contracts only workspace-equivalent specialist implementations into redirects", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('<ProjectWorkspaceAlias section="evidence" view="evidence" />');
    expect(app).toContain('<ProjectWorkspaceAlias section="decision" view="explainability" />');
    expect(app).toContain('<ProjectWorkspaceAlias section="design" view="spaceProgram" />');
    expect(app).not.toContain('import("./pages/EvidenceVault")');
    expect(app).not.toContain('import("./pages/Explainability")');
    expect(app).not.toContain('import("./pages/SpacePlanner")');
  });

  it("preserves unrelated query parameters through workspace redirects", () => {
    expect(
      buildWorkspaceAliasUrl("7", "design", "spaceProgram", "?source=email&section=decision")
    ).toBe("/projects/7?source=email&section=design&view=spaceProgram");
  });

  it("keeps the legacy project-less scenario comparison URL safe", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('<Route path="/scenarios/compare">');
    expect(app).toContain('<Redirect to="/scenarios" />');
  });

  it("sends successful authentication to the organization workspace", () => {
    const login = read("client/src/pages/Login.tsx");
    expect(login.match(/setLocation\("\/dashboard"\)/g)).toHaveLength(2);
    expect(login).not.toContain('setLocation("/")');
  });

  it("uses separate application and admin shells without weakening admin guards", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("<AdminLayout>");
    expect(app).toContain("<RequireAdmin>");
    expect(read("client/src/components/DashboardLayout.tsx")).toContain('label: "Overview"');
    expect(read("client/src/components/AdminLayout.tsx")).toContain('label: "Data & Sources"');
  });

  it("guards evaluation readiness before model or corpus reads", () => {
    const router = read("server/routers/project.ts");
    const evaluateStart = router.indexOf("evaluate: orgHeavyMutationProcedure");
    const readinessGuard = router.indexOf("getProjectReadiness", evaluateStart);
    const modelRead = router.indexOf("db.getActiveModelVersion", evaluateStart);
    expect(readinessGuard).toBeGreaterThan(evaluateStart);
    expect(readinessGuard).toBeLessThan(modelRead);
    expect(router.slice(readinessGuard, modelRead)).toContain("PRECONDITION_FAILED");
  });

  it("ships light-first semantic themes with no remote decorative backgrounds", () => {
    const app = read("client/src/App.tsx");
    const css = read("client/src/index.css");
    expect(app).toContain('<ThemeProvider defaultTheme="light" switchable>');
    for (const token of ["--canvas", "--surface", "--text", "--text-muted", "--focus"]) expect(css).toContain(token);
    expect(css).not.toContain("images.unsplash.com");
    expect(css).toContain("@media print");
  });

  it("removes unsupported public counters and assurance copy", () => {
    const home = read("client/src/pages/Home.tsx");
    for (const claim of ["578K", "updated daily", "Live DLD", "50+", "Compliance Checks"]) expect(home).not.toContain(claim);
    expect(home).toContain("Make defensible design decisions before committing capital.");
  });
});
