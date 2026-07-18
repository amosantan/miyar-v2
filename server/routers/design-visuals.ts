/**
 * Design Enablement Router (V2.8)
 * Evidence Vault, Design Brief, Visual Generation, Board Composer, Materials, Collaboration
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { toAiOperationFailure } from "../_core/ai-operation";
import {
  requireDesignAsset,
  requireDesignProject,
  requireDesignPromptTemplate,
  requireDesignScenario,
  requireMatchingDesignScenario,
  requireSameDesignProject,
  requireScopedDesignInsert,
  requireScopedDesignMutation,
} from "../_core/design-resource-access";
import { generateImage } from "../_core/imageGeneration";
import {
  adminProcedure,
  designOrgMutationProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import {
  buildBoardAwarePromptContext,
  buildMaterialAllocationPromptClause,
  buildPromptContext,
  buildRoomPromptContext,
  generateDefaultPrompt,
  generateRoomRenderPrompt,
  interpolateTemplate,
  validatePrompt,
  type MqiAllocation,
} from "../engines/visual-gen";

import { projectToInputs } from "./design-router-shared";

export const designVisualsRouter = router({
  generateVisual: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        type: z.enum(["mood", "material_board", "hero"]),
        scenarioId: z.number().optional(),
        customPrompt: z.string().optional(),
        templateId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);
      let selectedTemplate:
        | Awaited<ReturnType<typeof requireDesignPromptTemplate>>
        | undefined;
      if (input.scenarioId !== undefined) {
        const scenario = await requireDesignScenario(
          input.scenarioId,
          ctx.orgId
        );
        requireSameDesignProject(project.id, scenario.project.id);
      }
      if (input.templateId !== undefined) {
        selectedTemplate = await requireDesignPromptTemplate(
          input.templateId,
          ctx.orgId
        );
      }

      let inputs = projectToInputs(project);

      // V4-05: When scenarioId is provided, overlay scenario overrides onto project inputs
      if (input.scenarioId) {
        const scenarioInput = await db.getScenarioInput(input.scenarioId);
        if (scenarioInput?.jsonInput) {
          const overrides =
            typeof scenarioInput.jsonInput === "string"
              ? JSON.parse(scenarioInput.jsonInput)
              : scenarioInput.jsonInput;
          inputs = { ...inputs, ...overrides };
        }
      }

      // Phase 9: Try to use board-aware context for material-deterministic renders
      let context;
      const boards = await db.getMaterialBoardsByProject(input.projectId);
      if (boards && boards.length > 0) {
        const activeBoard = boards[0];
        const boardMaterials = await db.getMaterialsByBoard(activeBoard.id);
        const enrichedMaterials = [];
        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            enrichedMaterials.push({
              name: mat.name,
              category: mat.category,
              tier: mat.tier,
              supplierName: mat.supplierName,
              costUnit: mat.costUnit,
              costLow: Number(mat.typicalCostLow) || 0,
              costHigh: Number(mat.typicalCostHigh) || 0,
              embodiedCarbon: mat.embodiedCarbon
                ? parseFloat(String(mat.embodiedCarbon))
                : null,
              maintenanceFactor: mat.maintenanceFactor
                ? parseFloat(String(mat.maintenanceFactor))
                : null,
              brandStandardApproval: mat.brandStandardApproval || null,
            });
          }
        }
        context = buildBoardAwarePromptContext(
          inputs,
          enrichedMaterials,
          project.brandStandardConstraints
        );
        console.log(
          `[Visual] Using board-aware context with ${enrichedMaterials.length} materials for project ${input.projectId}`
        );
      } else {
        context = buildPromptContext(inputs);
      }

      // Phase A (MQI): Fetch material allocations and inject allocationClause
      try {
        const allocations = await db.getMaterialAllocations(
          input.projectId,
          ctx.orgId
        );
        if (allocations && allocations.length > 0) {
          const mqiAllocs: MqiAllocation[] = allocations.map((a: any) => ({
            roomId: a.roomId,
            roomName: a.roomName,
            element: a.element,
            materialName: a.materialName,
            percentage: Number(a.percentage) || 100,
          }));
          const clause = buildMaterialAllocationPromptClause(mqiAllocs);
          if (clause) {
            context.materialSpec = (context.materialSpec || "") + clause;
            console.log(
              `[Visual] Injected MQI allocation clause with ${mqiAllocs.length} allocations`
            );
          }
        }
      } catch (e) {
        console.warn(
          "[Visual] MQI allocation fetch failed, continuing without:",
          e
        );
      }

      // Build prompt
      let prompt: string;
      if (input.customPrompt) {
        prompt = input.customPrompt;
      } else if (selectedTemplate) {
        prompt = interpolateTemplate(selectedTemplate.templateText, context);
      } else {
        // Use active template or default
        const tmpl = await db.getActivePromptTemplate(input.type, ctx.orgId);
        prompt = tmpl
          ? interpolateTemplate(tmpl.templateText, context)
          : generateDefaultPrompt(input.type, context);
      }

      // Validate prompt
      const validation = validatePrompt(prompt);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.reason,
        });
      }

      // Create visual record
      const visualResult = requireScopedDesignInsert(
        await db.createGeneratedVisualForOrg(
          {
            projectId: input.projectId,
            scenarioId: input.scenarioId,
            type: input.type,
            promptJson: { prompt, context, templateId: input.templateId },
            status: "generating",
            createdBy: ctx.user.id,
          },
          ctx.orgId
        )
      );

      // Generate image asynchronously (but we await it for simplicity)
      try {
        const generated = await generateImage({ prompt });
        const url = generated.url;

        // Create asset record
        const assetResult = requireScopedDesignInsert(
          await db.createProjectAssetForOrg(
            {
              projectId: input.projectId,
              filename: `${input.type}-${Date.now()}.png`,
              mimeType: generated.mimeType,
              sizeBytes: generated.sizeBytes,
              checksum: generated.checksum,
              storagePath: generated.storageKey,
              storageUrl: url,
              uploadedBy: ctx.user.id,
              category:
                input.type === "mood"
                  ? "mood_image"
                  : input.type === "material_board"
                    ? "material_board"
                    : "marketing_hero",
            },
            ctx.orgId
          )
        );

        // Update visual record
        requireScopedDesignMutation(
          await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, {
            status: "completed",
            imageAssetId: assetResult.id,
          })
        );

        await db.createAuditLog({
          orgId: ctx.orgId,
          userId: ctx.user.id,
          action: "visual.generate",
          entityType: "generated_visual",
          entityId: visualResult.id,
          details: { type: input.type, projectId: input.projectId },
        });

        return {
          id: visualResult.id,
          assetId: assetResult.id,
          url,
          status: "completed" as const,
        };
      } catch (error) {
        const failure = toAiOperationFailure(error, "design.visual-generation");
        requireScopedDesignMutation(
          await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, {
            status: "failed",
            errorMessage: failure.message,
          })
        );
        return {
          id: visualResult.id,
          assetId: null,
          url: null,
          status: "failed" as const,
          error: failure.message,
          referenceId: failure.referenceId,
        };
      }
    }),

  listVisuals: orgProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireDesignProject(input.projectId, ctx.orgId);
      const visuals = await db.getGeneratedVisualsByProject(input.projectId);
      // Join with project_assets to get image URLs
      const enriched = await Promise.all(
        visuals.map(async (v: any) => {
          await requireMatchingDesignScenario(
            v.scenarioId,
            v.projectId,
            ctx.orgId
          );
          let imageUrl: string | null = null;
          if (v.imageAssetId) {
            const { resource: asset, project: assetProject } =
              await requireDesignAsset(v.imageAssetId, ctx.orgId);
            requireSameDesignProject(input.projectId, assetProject.id);
            imageUrl = asset?.storageUrl ?? null;
          }
          return { ...v, imageUrl };
        })
      );
      return enriched;
    }),

  attachVisualToPack: designOrgMutationProcedure
    .input(
      z.object({
        visualId: z.number(),
        targetType: z.enum([
          "report",
          "design_brief",
          "material_board",
          "pack_section",
        ]),
        targetId: z.number(),
        sectionLabel: z.string().optional(),
      })
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Visual attachments are unavailable until a typed attachment model is configured",
      });
    }),

  listPromptTemplates: orgProcedure
    .input(z.object({ type: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getAllPromptTemplates(input.type, ctx.orgId);
    }),

  createPromptTemplate: adminProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.enum(["mood", "material_board", "hero"]),
        templateText: z.string(),
        variables: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.createPromptTemplate({
        ...input,
        createdBy: ctx.user.id,
        orgId: ctx.user.orgId ?? undefined,
      });
    }),

  updatePromptTemplate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        templateText: z.string().optional(),
        variables: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updatePromptTemplate(id, updates);
      return { success: true };
    }),

  generateRoomRender: designOrgMutationProcedure
    .input(
      z.object({
        projectId: z.number(),
        roomName: z.string(),
        roomType: z.string(),
        roomSqm: z.number(),
        finishGrade: z.enum(["A", "B", "C"]).default("A"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireDesignProject(input.projectId, ctx.orgId);

      const inputs = projectToInputs(project);

      // Fetch board materials for material-accurate renders
      const boards = await db.getMaterialBoardsByProject(input.projectId);
      const enrichedMaterials: any[] = [];
      if (boards && boards.length > 0) {
        const boardMaterials = await db.getMaterialsByBoard(boards[0].id);
        for (const bm of boardMaterials) {
          const mat = await db.getMaterialById(bm.materialId);
          if (mat) {
            enrichedMaterials.push({
              name: mat.name,
              category: mat.category,
              tier: mat.tier,
              supplierName: mat.supplierName,
              costUnit: mat.costUnit,
              costLow: Number(mat.typicalCostLow) || 0,
              costHigh: Number(mat.typicalCostHigh) || 0,
              embodiedCarbon: mat.embodiedCarbon
                ? parseFloat(String(mat.embodiedCarbon))
                : null,
              maintenanceFactor: mat.maintenanceFactor
                ? parseFloat(String(mat.maintenanceFactor))
                : null,
              brandStandardApproval: mat.brandStandardApproval || null,
            });
          }
        }
      }

      const context = buildRoomPromptContext(
        inputs,
        input.roomName,
        input.roomType,
        input.roomSqm,
        enrichedMaterials,
        project.brandStandardConstraints
      );

      const prompt = generateRoomRenderPrompt(
        context,
        input.roomName,
        input.roomSqm,
        input.finishGrade
      );

      const validation = validatePrompt(prompt);
      if (!validation.valid)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.reason,
        });

      const visualResult = requireScopedDesignInsert(
        await db.createGeneratedVisualForOrg(
          {
            projectId: input.projectId,
            type: "room_render" as any,
            promptJson: {
              prompt,
              context,
              roomName: input.roomName,
              roomType: input.roomType,
            },
            status: "generating",
            createdBy: ctx.user.id,
          },
          ctx.orgId
        )
      );

      try {
        const generated = await generateImage({ prompt });
        const url = generated.url;

        const assetResult = requireScopedDesignInsert(
          await db.createProjectAssetForOrg(
            {
              projectId: input.projectId,
              filename: `room-render-${input.roomName.replace(/\s+/g, "-")}-${Date.now()}.png`,
              mimeType: generated.mimeType,
              sizeBytes: generated.sizeBytes,
              checksum: generated.checksum,
              storagePath: generated.storageKey,
              storageUrl: url,
              uploadedBy: ctx.user.id,
              category: "mood_image",
            },
            ctx.orgId
          )
        );

        requireScopedDesignMutation(
          await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, {
            status: "completed",
            imageAssetId: assetResult.id,
          })
        );

        return {
          id: visualResult.id,
          assetId: assetResult.id,
          url,
          status: "completed" as const,
        };
      } catch (error) {
        const failure = toAiOperationFailure(error, "design.room-render");
        requireScopedDesignMutation(
          await db.updateGeneratedVisualForOrg(visualResult.id, ctx.orgId, {
            status: "failed",
            errorMessage: failure.message,
          })
        );
        return {
          id: visualResult.id,
          assetId: null,
          url: null,
          status: "failed" as const,
          error: failure.message,
          referenceId: failure.referenceId,
        };
      }
    }),
});
