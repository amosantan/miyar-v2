import { TRPCError } from "@trpc/server";

export const GEOMETRY_AUTHORITY_MODES = [
  "legacy",
  "shadow",
  "canonical",
] as const;

export type GeometryAuthorityMode = (typeof GEOMETRY_AUTHORITY_MODES)[number];

/**
 * Release-N compatibility rule: canonical candidates are observational while a
 * project is in shadow mode. Existing writers remain authoritative until a
 * separately approved canonical flip.
 */
export function allowsLegacyGeometryWrites(
  mode: GeometryAuthorityMode
): boolean {
  return mode !== "canonical";
}

export function requireLegacyGeometryWriteAuthority(
  mode: GeometryAuthorityMode
): void {
  if (!allowsLegacyGeometryWrites(mode)) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Legacy room and area values are read-only while canonical geometry is authoritative.",
    });
  }
}
