import * as db from "../db";
import { requireLegacyGeometryWriteAuthority } from "../engines/geometry/authority-policy";

/** Route-level compatibility guard for legacy project-area writers. */
export async function requireLegacyGeometryWriterForProject(
  projectId: number,
  organizationId: number
): Promise<void> {
  const mode = await db.getProjectGeometryAuthorityModeForOrg(
    projectId,
    organizationId
  );
  requireLegacyGeometryWriteAuthority(mode);
}
