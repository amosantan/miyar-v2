import { describe, expect, it } from "vitest";
import { buildRateLimitKey } from "./rate-limit";

describe("organization rate-limit identity", () => {
  it("preserves the established prefix:user:path key contract", () => {
    expect(buildRateLimitKey("heavy", 42, "scenario.runMonteCarlo"))
      .toBe("heavy:42:scenario.runMonteCarlo");
    expect(buildRateLimitKey("rl", "anon", "public.health"))
      .toBe("rl:anon:public.health");
  });
});
