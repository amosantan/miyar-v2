import { describe, expect, it } from "vitest";
import { getPricingArea, getStructuralArea } from "./area-utils";

describe("area utilities decimal boundary", () => {
  it.each([
    [{ totalFitoutArea: 0, ctx03Gfa: 1200 }, 0],
    [{ totalFitoutArea: "1250.50", ctx03Gfa: "2000.00" }, 1250.5],
    [{ totalFitoutArea: null, ctx03Gfa: "9999999999.99" }, 9999999999.99],
    [{ totalFitoutArea: undefined, ctx03Gfa: 0.01 }, 0.01],
  ])("preserves pricing values for %o", (input, expected) => {
    expect(getPricingArea(input)).toBe(expected);
  });

  it("preserves the structural GFA value independently of fit-out area", () => {
    expect(getStructuralArea({ totalFitoutArea: "600.25", ctx03Gfa: "900.75" })).toBe(900.75);
  });

  it("fails malformed decimal input closed to zero instead of propagating NaN", () => {
    expect(getPricingArea({ totalFitoutArea: "not-a-decimal", ctx03Gfa: "900.75" })).toBe(0);
    expect(getStructuralArea({ ctx03Gfa: "not-a-decimal" })).toBe(0);
  });
});
