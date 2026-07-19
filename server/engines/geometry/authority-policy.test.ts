import { describe, expect, it } from "vitest";

import {
  GEOMETRY_AUTHORITY_MODES,
  allowsLegacyGeometryWrites,
  requireLegacyGeometryWriteAuthority,
} from "./authority-policy";

describe("DI-01 geometry authority compatibility", () => {
  it("exposes only legacy and canonical runtime authority choices", () => {
    expect(GEOMETRY_AUTHORITY_MODES).toEqual(["legacy", "canonical"]);
  });

  it("keeps legacy geometry writers available only for legacy projects", () => {
    expect(allowsLegacyGeometryWrites("legacy")).toBe(true);
    expect(() => requireLegacyGeometryWriteAuthority("legacy")).not.toThrow();
  });

  it("fails closed when an old writer reaches a canonical project", () => {
    expect(allowsLegacyGeometryWrites("canonical")).toBe(false);
    expect(() => requireLegacyGeometryWriteAuthority("canonical")).toThrow(
      /read-only while canonical geometry is authoritative/
    );
  });
});
