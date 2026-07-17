import { describe, expect, it } from "vitest";
import { allowedVendorStatuses } from "./vendor-matching";

describe("vendor constraint mapping", () => {
  it.each([
    ["Strict Vendor List", ["preferred_brand"]],
    ["Moderate Guidelines", ["approved_vendor", "preferred_brand"]],
    ["High Flexibility", ["open_market", "approved_vendor", "preferred_brand"]],
    [null, ["open_market", "approved_vendor", "preferred_brand"]],
  ] as const)("maps %s to its allowed catalog statuses", (constraint, expected) => {
    expect(allowedVendorStatuses(constraint)).toEqual(expected);
  });
});
