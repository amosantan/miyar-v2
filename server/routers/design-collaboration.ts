/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  requireDesignCommentTarget,
  requireDesignProject,
  requireSameDesignProject,
  requireScopedDesignInsert,
  requireScopedDesignMutation,
} from "../_core/design-resource-access";
import {
  designOrgAdminProcedure,
  designOrgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";

export const designCollaborationRouter = router({
  addComment: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        entityType: z.enum([
          "design_brief",
          "material_board",
          "visual",
          "general",
        ]),
        entityId: z.number().optional(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (input.entityType === "general") {
        if (input.entityId !== undefined)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "General comments cannot have an entity target",
          });
      } else {
        if (input.entityId === undefined)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Entity comments require a target",
          });
        const target = await requireDesignCommentTarget(
          input.entityType,
          input.entityId,
          ctx.orgId
        );
        requireSameDesignProject(input.projectId, target.value.project.id);
      }
      return requireScopedDesignInsert(
        await db.createCommentForOrg(
          {
            projectId: input.projectId,
            entityType: input.entityType,
            entityId: input.entityId,
            userId: ctx.user.id,
            content: input.content,
          },
          ctx.orgId
        )
      );
    }),

  listComments: orgProcedure
    .input(
      z.object({
        projectId: z.number(),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      if (input.entityType === "general" && input.entityId !== undefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "General comments cannot have an entity target",
        });
      }
      if (
        input.entityType &&
        input.entityType !== "general" &&
        input.entityId !== undefined
      ) {
        const target = await requireDesignCommentTarget(
          input.entityType,
          input.entityId,
          ctx.orgId
        );
        requireSameDesignProject(input.projectId, target.value.project.id);
      }
      if (input.entityType) {
        return db.getCommentsByEntity(
          input.projectId,
          input.entityType,
          input.entityId
        );
      }
      return db.getCommentsByProject(input.projectId);
    }),

  updateApprovalState: designOrgAdminProcedure
    .input(
      z.object({
        projectId: z.number(),
        approvalState: z.enum([
          "draft",
          "review",
          "approved_rfq",
          "approved_marketing",
        ]),
        rationale: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      requireScopedDesignMutation(
        await db.updateProjectApprovalStateForOrg(
          input.projectId,
          ctx.orgId,
          input.approvalState
        )
      );
      await db.createAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "approval.update",
        entityType: "project",
        entityId: input.projectId,
        details: {
          approvalState: input.approvalState,
          rationale: input.rationale,
        },
      });
      return { success: true };
    }),
});
