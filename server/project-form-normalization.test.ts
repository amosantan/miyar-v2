import { describe, expect, it } from "vitest";
import {
  normalizeProjectFormInitialData,
  normalizeProjectFormValue,
} from "../client/src/lib/project-form-normalization";

describe("project form normalization", () => {
  it("normalizes nullable database text and decimal strings", () => {
    expect(
      normalizeProjectFormInitialData({ description: null, ctx03Gfa: "12500.5" })
    ).toEqual({ description: "", ctx03Gfa: 12500.5 });
  });

  it("drops invalid numeric suggestions instead of submitting strings", () => {
    expect(normalizeProjectFormValue("ctx03Gfa", "not-a-number")).toBeUndefined();
  });
});
