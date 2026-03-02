/**
 * Intake Router — MIYAR 2.0 Intelligent Intake
 *
 * Handles file uploads, asset management, and AI intake processing.
 * Uses existing storage.ts (S3) and project_assets table via db.ts helpers.
 */
import { z } from "zod";
import { router, orgProcedure } from "../_core/trpc";
import { storagePut } from "../storage";
import * as db from "../db";
import { processIntakeAssets, type IntakeAsset, type IntakeResult } from "../engines/intake/ai-intake-engine";
import crypto from "crypto";

// ─── Router ──────────────────────────────────────────────────────────────────

export const intakeRouter = router({
    /**
     * Generate a presigned S3 upload URL for direct client upload.
     * Client uploads directly to S3, then calls `recordAsset` to register it.
     */
    getUploadUrl: orgProcedure
        .input(z.object({
            fileName: z.string(),
            contentType: z.string(),
            sizeBytes: z.number().max(50 * 1024 * 1024), // 50MB limit
        }))
        .mutation(async ({ input, ctx }) => {
            const fileKey = `intake/${ctx.orgId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}/${input.fileName}`;
            const result = await storagePut(fileKey, Buffer.alloc(0), input.contentType);

            return {
                uploadUrl: result.url,
                fileKey,
                storageUrl: result.url,
            };
        }),

    /**
     * Register an uploaded asset in the project_assets table.
     * Called after client uploads to S3.
     */
    recordAsset: orgProcedure
        .input(z.object({
            projectId: z.number().optional(),
            fileName: z.string(),
            mimeType: z.string(),
            sizeBytes: z.number(),
            storagePath: z.string(),
            storageUrl: z.string(),
            category: z.enum([
                "brief", "brand", "budget", "competitor", "inspiration",
                "material", "sales", "legal", "mood_image", "material_board",
                "marketing_hero", "floor_plan", "voice_note", "generated", "other",
            ]).default("other"),
            assetType: z.enum(["image", "pdf", "audio", "video", "url", "text_note"]).default("image"),
        }))
        .mutation(async ({ input, ctx }) => {
            const assetId = await db.createProjectAsset({
                projectId: input.projectId ?? 0,
                filename: input.fileName,
                mimeType: input.mimeType,
                sizeBytes: input.sizeBytes,
                storagePath: input.storagePath,
                storageUrl: input.storageUrl,
                category: input.category,
                assetType: input.assetType,
                uploadedBy: ctx.user.id,
            });

            return { assetId };
        }),

    /**
     * List assets for a project.
     */
    listAssets: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input }) => {
            return db.getProjectAssets(input.projectId);
        }),

    /**
     * Process uploaded assets through the AI Intake Engine.
     * Returns suggested ProjectInputs with per-field confidence and reasoning.
     */
    processAssets: orgProcedure
        .input(z.object({
            projectId: z.number().optional(),
            assets: z.array(z.object({
                type: z.enum(["image", "pdf", "audio", "video", "url", "text_note"]),
                url: z.string(),
                mimeType: z.string().optional(),
                textContent: z.string().optional(),
                fileName: z.string().optional(),
                assetId: z.number().optional(),
            })),
            freeformDescription: z.string().optional(),
        }))
        .mutation(async ({ input }): Promise<IntakeResult> => {
            // Build IntakeAsset array
            const intakeAssets: IntakeAsset[] = input.assets.map(a => ({
                type: a.type,
                url: a.url,
                mimeType: a.mimeType,
                textContent: a.textContent,
            }));

            // Add freeform description as a text_note asset
            if (input.freeformDescription?.trim()) {
                intakeAssets.push({
                    type: "text_note",
                    url: "",
                    textContent: input.freeformDescription,
                });
            }

            // Call the AI intake engine
            const result = await processIntakeAssets(intakeAssets);

            // Store AI extraction results back on assets that have IDs
            for (const asset of input.assets) {
                if (asset.assetId) {
                    await db.updateProjectAsset(asset.assetId, {
                        aiExtractionResult: result.extractedInsights,
                        aiContributions: Object.keys(result.suggestedInputs),
                    });
                }
            }

            return result;
        }),

    /**
     * Link orphaned assets to a project (after project creation).
     */
    linkAssetsToProject: orgProcedure
        .input(z.object({
            assetIds: z.array(z.number()),
            projectId: z.number(),
        }))
        .mutation(async ({ input }) => {
            for (const assetId of input.assetIds) {
                await db.updateProjectAsset(assetId, { projectId: input.projectId });
            }
            return { linked: input.assetIds.length };
        }),
});
