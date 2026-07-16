import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { requireProjectForOrg } from "./project-access";
import {
  createPolymorphicResourceAuthorizer,
  requireNestedProjectResourceForOrg,
  requireOrgResourceForOrg,
  requireProjectOrgResourceForOrg,
  requireProjectResourceForOrg,
} from "./resource-access";

const notFound = (): never => {
  throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
};

export function requireDesignProject(projectId: number, orgId: number) {
  return requireProjectForOrg(projectId, orgId);
}

export function requireDesignAsset(assetId: number, orgId: number) {
  return requireProjectResourceForOrg(assetId, orgId, {
    lookupResource: db.getProjectAssetById,
    getProjectId: asset => asset.projectId,
  });
}

export function requireDesignBrief(briefId: number, orgId: number) {
  return requireProjectResourceForOrg(briefId, orgId, {
    lookupResource: db.getDesignBriefById,
    getProjectId: brief => brief.projectId,
  });
}

export function requireAiDesignBrief(briefId: number, orgId: number) {
  return requireProjectOrgResourceForOrg(briefId, orgId, {
    lookupResource: db.getAiDesignBriefById,
    getProjectId: brief => brief.projectId,
    getOrgId: brief => brief.orgId,
  });
}

export function requireDesignVisual(visualId: number, orgId: number) {
  return requireProjectResourceForOrg(visualId, orgId, {
    lookupResource: db.getGeneratedVisualById,
    getProjectId: visual => visual.projectId,
  });
}

export function requireDesignBoard(boardId: number, orgId: number) {
  return requireProjectResourceForOrg(boardId, orgId, {
    lookupResource: db.getMaterialBoardById,
    getProjectId: board => board.projectId,
  });
}

export function requireDesignBoardJoin(joinId: number, orgId: number) {
  return requireNestedProjectResourceForOrg(joinId, orgId, {
    lookupResource: db.getMaterialToBoardById,
    getParentId: join => join.boardId,
    lookupParent: db.getMaterialBoardById,
    getProjectId: board => board.projectId,
  });
}

export function requireDesignScenario(scenarioId: number, orgId: number) {
  return requireProjectOrgResourceForOrg(scenarioId, orgId, {
    lookupResource: db.getScenarioById,
    getProjectId: scenario => scenario.projectId,
    getOrgId: scenario => scenario.orgId,
  });
}

export function requireDesignReport(reportId: number, orgId: number) {
  return requireProjectResourceForOrg(reportId, orgId, {
    lookupResource: db.getReportById,
    getProjectId: report => report.projectId,
  });
}

export function requireDesignEvaluation(evaluationId: number, orgId: number) {
  return requireProjectResourceForOrg(evaluationId, orgId, {
    lookupResource: db.getScoreMatrixById,
    getProjectId: evaluation => evaluation.projectId,
  });
}

export function requireDesignPromptTemplate(templateId: number, orgId: number) {
  return requireOrgResourceForOrg(templateId, orgId, {
    lookupResource: db.getPromptTemplateById,
    getOrgId: template => template.orgId,
  });
}

export function requireDesignAssetLink(linkId: number, orgId: number) {
  return requireNestedProjectResourceForOrg(linkId, orgId, {
    lookupResource: db.getAssetLinkById,
    getParentId: link => link.assetId,
    lookupParent: db.getProjectAssetById,
    getProjectId: asset => asset.projectId,
  });
}

export const requireDesignLinkTarget = createPolymorphicResourceAuthorizer({
  evaluation: requireDesignEvaluation,
  report: requireDesignReport,
  scenario: requireDesignScenario,
  material_board: requireDesignBoard,
  design_brief: requireDesignBrief,
  visual: requireDesignVisual,
});

export const requireDesignCommentTarget = createPolymorphicResourceAuthorizer({
  design_brief: requireDesignBrief,
  material_board: requireDesignBoard,
  visual: requireDesignVisual,
});

export function requireSameDesignProject(
  expectedProjectId: number,
  actualProjectId: number
) {
  if (expectedProjectId !== actualProjectId) {
    return notFound();
  }
}

export function requireScopedDesignMutation(succeeded: boolean) {
  if (!succeeded) {
    return notFound();
  }
}

export function requireScopedDesignInsert<Value>(
  value: Value | null | undefined
): Value {
  if (value === null || value === undefined) {
    return notFound();
  }
  return value;
}

export async function requireMatchingDesignScenario(
  scenarioId: number | null | undefined,
  projectId: number,
  orgId: number
) {
  if (scenarioId === null || scenarioId === undefined) return;
  const scenario = await requireDesignScenario(scenarioId, orgId);
  requireSameDesignProject(projectId, scenario.project.id);
}
