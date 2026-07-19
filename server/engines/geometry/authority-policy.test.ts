import { describe, expect, it } from "vitest";

import {
  allowsLegacyGeometryWrites,
  requireLegacyGeometryWriteAuthority,
} from "./authority-policy";

describe("DI-01 geometry authority compatibility", () => {
  it.each(["legacy", "shadow"] as const)(
    "keeps existing numerical writers authoritative in %s mode",
    mode => {
      expect(allowsLegacyGeometryWrites(mode)).toBe(true);
      expect(() => requireLegacyGeometryWriteAuthority(mode)).not.toThrow();
    }
  );

  it("fails closed when an old writer reaches a canonical project", () => {
    expect(allowsLegacyGeometryWrites("canonical")).toBe(false);
    expect(() => requireLegacyGeometryWriteAuthority("canonical")).toThrow(
      /read-only while canonical geometry is authoritative/
    );
  });
});
