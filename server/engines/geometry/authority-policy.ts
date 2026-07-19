import { TRPCError } from "@trpc/server";

export const GEOMETRY_AUTHORITY_MODES = ["legacy", "canonical"] as const;

export type GeometryAuthorityMode = (typeof GEOMETRY_AUTHORITY_MODES)[number];

/**
 * Canonical authority owns room boundaries and room-floor polygon area. Legacy
 * geometry writers remain available only for explicitly legacy projects.
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
