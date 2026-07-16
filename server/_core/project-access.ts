import { TRPCError } from "@trpc/server";
import * as db from "../db";

type ProjectLookup = typeof db.getProjectById;

/**
 * Resolve a project without revealing whether another organization's project exists.
 * Routers handling project-scoped data should call this before any child-record read/write.
 */
export async function requireProjectForOrg(
  projectId: number,
  orgId: number,
  lookup: ProjectLookup = db.getProjectById
) {
  const project = await lookup(projectId);
  if (!project || project.orgId !== orgId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project;
}
