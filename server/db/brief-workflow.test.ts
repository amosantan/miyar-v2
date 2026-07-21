import { describe, expect, it } from "vitest";
import { BRIEF_SECTION_IDS, BriefWorkflowError, assertWorkingBriefVersion, decisionStage, hashBriefRequest, normalizeApplicabilityStage } from "./brief-workflow";

describe("canonical brief workflow foundations", () => {
  it("defines exactly the ten governed section containers", () => {
    expect(BRIEF_SECTION_IDS).toHaveLength(10);
    expect(new Set(BRIEF_SECTION_IDS).size).toBe(10);
  });

  it("hashes semantically identical request objects deterministically", () => {
    expect(hashBriefRequest({ b: 2, a: { y: 2, x: 1 } })).toBe(
      hashBriefRequest({ a: { x: 1, y: 2 }, b: 2 })
    );
  });

  it("binds array ordering into idempotency identity", () => {
    expect(hashBriefRequest({ values: [1, 2] })).not.toBe(
      hashBriefRequest({ values: [2, 1] })
    );
  });

  it("maps the public applicability review action to the persisted stage", () => {
    expect(normalizeApplicabilityStage("accept_review")).toBe("reviewed");
    expect(normalizeApplicabilityStage("withdraw")).toBe("withdrawn");
    expect(normalizeApplicabilityStage("unknown")).toBeNull();
  });

  it("preserves rejected governance outcomes", () => {
    expect(decisionStage("rejected")).toBe("rejected");
    expect(decisionStage("accepted")).toBe("accepted");
  });

  it("fails closed for locked and issued workflow versions", () => {
    expect(() => assertWorkingBriefVersion("locked")).toThrow(BriefWorkflowError);
    expect(() => assertWorkingBriefVersion("issued")).toThrow("Locked brief versions are immutable");
    expect(() => assertWorkingBriefVersion("working")).not.toThrow();
  });
});
