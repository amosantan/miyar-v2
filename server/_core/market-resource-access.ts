import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  requireDesignBoard,
  requireDesignBrief,
  requireDesignReport,
  requireDesignScenario,
} from "./design-resource-access";
import { requireProjectForOrg } from "./project-access";
import { createPolymorphicResourceAuthorizer } from "./resource-access";

function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
}

export async function requireEvidenceRecordForOrg(
  evidenceId: number,
  orgId: number
) {
  const evidence = await db.getEvidenceRecordById(evidenceId);
  if (!evidence) return notFound();

  if (evidence.projectId !== null) {
    let project;
    try {
      project = await requireProjectForOrg(evidence.projectId, orgId);
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") {
        return notFound();
      }
      throw error;
    }
    if (evidence.orgId !== orgId) return notFound();
    return { evidence, project };
  }

  if (evidence.orgId === orgId) return { evidence, project: null };
  if (
    evidence.orgId === null &&
    evidence.confidentiality === "public"
  ) {
    return { evidence, project: null };
  }
  return notFound();
}

async function requireGlobalCompetitorProject(id: number) {
  const record = await db.getCompetitorProjectById(id);
  return record ?? notFound();
}

export const requireMarketTagTargetForOrg =
  createPolymorphicResourceAuthorizer({
    project: requireProjectForOrg,
    scenario: requireDesignScenario,
    evidence_record: async (id: number, orgId: number) =>
      requireEvidenceRecordForOrg(id, orgId),
    competitor_project: async (id: number) =>
      requireGlobalCompetitorProject(id),
  });

export const requireEvidenceReferenceTargetForOrg =
  createPolymorphicResourceAuthorizer({
    scenario: requireDesignScenario,
    design_brief: requireDesignBrief,
    report: requireDesignReport,
    material_board: requireDesignBoard,
  });

export async function requireTaggedEntitiesForOrg(
  tagId: number,
  orgId: number
) {
  const links = await db.getTaggedEntities(tagId);
  const authorized = [];
  for (const link of links) {
    try {
      await requireMarketTagTargetForOrg(
        link.entityType,
        link.entityId,
        orgId
      );
      authorized.push(link);
    } catch (error) {
      if (!(error instanceof TRPCError) || error.code !== "NOT_FOUND") {
        throw error;
      }
    }
  }
  return authorized;
}
