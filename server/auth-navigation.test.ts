import { describe, expect, it, vi } from "vitest";
import {
  AUTHENTICATED_ENTRY_PATH,
  enterAuthenticatedApp,
  getPublicEntryPath,
} from "../client/src/lib/auth-navigation";

describe("auth navigation", () => {
  it("sends a completed login to the authenticated dashboard", () => {
    const replace = vi.fn();

    enterAuthenticatedApp({ replace });

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith(AUTHENTICATED_ENTRY_PATH);
    expect(AUTHENTICATED_ENTRY_PATH).toBe("/dashboard");
  });

  it("uses the dashboard as the public-page entry for an existing session", () => {
    expect(getPublicEntryPath(true)).toBe("/dashboard");
    expect(getPublicEntryPath(false)).toBe("/login");
  });
});
