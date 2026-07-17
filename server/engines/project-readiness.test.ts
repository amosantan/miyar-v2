import { describe, expect, it } from "vitest";
import { createInitialProvenance, EVALUATION_REQUIRED_FIELDS, getProjectReadiness } from "../../shared/project-readiness";

function completeProject() {
  return Object.fromEntries(EVALUATION_REQUIRED_FIELDS.map(field => [field, field === "ctx03Gfa" || field === "fin01BudgetCap" ? 100 : "value"]));
}

describe("project input readiness", () => {
  it("keeps legacy projects evaluation-compatible", () => {
    expect(getProjectReadiness({ name: "Legacy" })).toMatchObject({ canEvaluate: true, policyVersion: "legacy-compatible-v1" });
  });

  it("blocks assumed quick-start values", () => {
    const project = { ...completeProject(), inputProvenance: createInitialProvenance({ name: "explicit", ctx01Typology: "explicit" }) };
    const result = getProjectReadiness(project);
    expect(result.canEvaluate).toBe(false);
    expect(result.unconfirmedAssumptions).toContain("mkt01Tier");
  });

  it("separates missing values from unconfirmed assumptions", () => {
    const provenance = Object.fromEntries(EVALUATION_REQUIRED_FIELDS.map(field => [field, "confirmed"]));
    const result = getProjectReadiness({ ...completeProject(), ctx03Gfa: null, inputProvenance: provenance });
    expect(result.missingInputs).toEqual(["ctx03Gfa"]);
    expect(result.canEvaluate).toBe(false);
  });

  it("allows evaluation after every required value is confirmed", () => {
    const provenance = Object.fromEntries(EVALUATION_REQUIRED_FIELDS.map(field => [field, "confirmed"]));
    expect(getProjectReadiness({ ...completeProject(), inputProvenance: provenance }).canEvaluate).toBe(true);
  });
});
