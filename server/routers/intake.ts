/**
 * Intake Router — MIYAR 2.0 Intelligent Intake
 *
 * Handles file uploads, asset management, and AI intake processing.
 * Uses existing storage.ts (S3) and project_assets table via db.ts helpers.
 */
import { z } from "zod";
import {
    orgHeavyMutationProcedure,
    orgMutationProcedure,
    orgProcedure,
    router,
} from "../_core/trpc";
import { storageCreatePresignedPut, storageGet } from "../storage";
import * as db from "../db";
import { processIntakeAssets, type IntakeAsset, type IntakeResult } from "../engines/intake/ai-intake-engine";
import { cleanHtmlForLLM } from "../engines/ingestion/connectors/dynamic";
import crypto from "crypto";
import { requireProjectForOrg } from "../_core/project-access";
import {
    requireProjectResourceBatchForOrg,
    requireProjectResourceForOrg,
} from "../_core/resource-access";
import { isSupportedMediaMimeType, mediaTypeFromMime } from "../_core/media-validation";
import { readValidatedProjectMedia } from "../_core/project-media";
import { toAiOperationFailure } from "../_core/ai-operation";

// ─── Router ──────────────────────────────────────────────────────────────────

export const intakeRouter = router({
    /**
     * Generate a presigned S3 upload URL for direct client upload.
     * Client uploads directly to S3, then calls `recordAsset` to register it.
     */
    getUploadUrl: orgMutationProcedure
        .input(z.object({
            projectId: z.number(),
            fileName: z.string(),
            contentType: z.string(),
            sizeBytes: z.number().max(50 * 1024 * 1024), // 50MB limit
        }))
        .mutation(async ({ input, ctx }) => {
            await requireProjectForOrg(input.projectId, ctx.orgId);
            const contentType = input.contentType.toLowerCase();
            if (!isSupportedMediaMimeType(contentType)) {
                throw new Error("This file type is not supported. Please choose a supported image, PDF, audio, or video file.");
            }
            const fileKey = `intake/${ctx.orgId}/${input.projectId}/uploads/${crypto.randomUUID()}`;
            const result = await storageCreatePresignedPut(fileKey, contentType);

            return {
                uploadUrl: result.uploadUrl,
                fileKey: result.key,
                expiresInSeconds: 900,
            };
        }),

    /**
     * Register an uploaded asset in the project_assets table.
     * Called after client uploads to S3.
     */
    recordAsset: orgMutationProcedure
        .input(z.object({
            projectId: z.number(),
            fileName: z.string(),
            mimeType: z.string(),
            sizeBytes: z.number(),
            storagePath: z.string(),
            storageUrl: z.string().optional(),
            category: z.enum([
                "brief", "brand", "budget", "competitor", "inspiration",
                "material", "sales", "legal", "mood_image", "material_board",
                "marketing_hero", "floor_plan", "voice_note", "generated", "other",
            ]).default("other"),
            assetType: z.enum(["image", "pdf", "audio", "video", "url", "text_note"]).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            await requireProjectForOrg(input.projectId, ctx.orgId);
            if (!input.storagePath.startsWith(`intake/${ctx.orgId}/${input.projectId}/uploads/`)) {
                throw new Error("Upload not found");
            }
            const media = await readValidatedProjectMedia({
                storagePath: input.storagePath,
                mimeType: input.mimeType,
            }, "intake.asset.finalize");
            const stored = await storageGet(input.storagePath);
            const assetId = await db.createProjectAssetForOrg({
                projectId: input.projectId,
                filename: input.fileName,
                mimeType: media.mimeType,
                sizeBytes: media.sizeBytes,
                checksum: media.checksum,
                storagePath: input.storagePath,
                storageUrl: stored.url,
                category: input.category,
                assetType: mediaTypeFromMime(media.mimeType),
                uploadedBy: ctx.user.id,
            }, ctx.orgId);
            if (!assetId) {
                await requireProjectForOrg(input.projectId, ctx.orgId);
                throw new Error("Failed to record asset");
            }

            return { assetId };
        }),

    /**
     * List assets for a project.
     */
    listAssets: orgProcedure
        .input(z.object({ projectId: z.number() }))
        .query(async ({ input, ctx }) => {
            await requireProjectForOrg(input.projectId, ctx.orgId);
            return db.getProjectAssets(input.projectId);
        }),

    /**
     * Process uploaded assets through the AI Intake Engine.
     * Returns suggested ProjectInputs with per-field confidence and reasoning.
     */
    processAssets: orgHeavyMutationProcedure
        .input(z.object({
            projectId: z.number(),
            assetIds: z.array(z.number()).max(5),
            freeformDescription: z.string().max(10_000).optional(),
        }))
        .mutation(async ({ input, ctx }): Promise<IntakeResult & { assetResults: Array<{ assetId: number; status: "processed" | "failed"; error?: ReturnType<typeof toAiOperationFailure> }> }> => {
            const project = await requireProjectForOrg(input.projectId, ctx.orgId);
            const authorizedAssets = await requireProjectResourceBatchForOrg(
                input.assetIds,
                ctx.orgId,
                (id, orgId) => requireProjectResourceForOrg(id, orgId, {
                    lookupResource: db.getProjectAssetById,
                    getProjectId: asset => asset.projectId,
                })
            );
            if (authorizedAssets.some(asset => asset.project.id !== project.id)) {
                throw new Error("Resource not found");
            }

            const prepared = await Promise.all(authorizedAssets.map(async ({ resource: asset }) => {
                try {
                    const media = await readValidatedProjectMedia(asset, "intake.process-assets");
                    return {
                        asset,
                        intake: {
                            type: mediaTypeFromMime(media.mimeType),
                            media,
                            fileName: asset.filename,
                        } satisfies IntakeAsset,
                    };
                } catch (error) {
                    return { asset, error: toAiOperationFailure(error, "intake.process-assets") };
                }
            }));
            const intakeAssets = prepared.reduce<IntakeAsset[]>((items, item) => {
                if ("intake" in item && item.intake) items.push(item.intake);
                return items;
            }, []);

            // Add freeform description as a text_note asset
            if (input.freeformDescription?.trim()) {
                intakeAssets.push({
                    type: "text_note",
                    textContent: input.freeformDescription,
                });
            }

            const result = await processIntakeAssets(intakeAssets);
            const assetResults = prepared.map(item => "intake" in item
                ? { assetId: item.asset.id, status: "processed" as const }
                : { assetId: item.asset.id, status: "failed" as const, error: item.error });

            // Store AI extraction results back on assets that have IDs
            for (const item of prepared) {
                if ("intake" in item) {
                    if (!(await db.updateProjectAssetForOrg(item.asset.id, ctx.orgId, {
                        aiExtractionResult: result.extractedInsights,
                        aiContributions: Object.keys(result.suggestedInputs),
                    }))) {
                        await requireProjectResourceForOrg(item.asset.id, ctx.orgId, {
                            lookupResource: db.getProjectAssetById,
                            getProjectId: record => record.projectId,
                        });
                    }
                }
            }

            return { ...result, assetResults };
        }),

    /**
     * Link orphaned assets to a project (after project creation).
     */
    linkAssetsToProject: orgMutationProcedure
        .input(z.object({
            assetIds: z.array(z.number()),
            projectId: z.number(),
        }))
        .mutation(async ({ input, ctx }) => {
            await requireProjectForOrg(input.projectId, ctx.orgId);
            await requireProjectResourceBatchForOrg(
                input.assetIds,
                ctx.orgId,
                (id, orgId) => requireProjectResourceForOrg(id, orgId, {
                    lookupResource: db.getProjectAssetById,
                    getProjectId: asset => asset.projectId,
                })
            );
            if (!(await db.linkProjectAssetsForOrg(
                input.assetIds,
                input.projectId,
                ctx.orgId
            ))) {
                await requireProjectForOrg(input.projectId, ctx.orgId);
                throw new Error("Resource not found");
            }
            return { linked: input.assetIds.length };
        }),

    suggestSection: orgHeavyMutationProcedure
        .input(z.object({
            section: z.enum(["context", "strategy", "market", "financial", "design", "execution"]),
            currentFormState: z.record(z.string(), z.any()),
        }))
        .mutation(async ({ input }) => {
            const { suggestSectionFields } = await import("../engines/intake/ai-intake-engine");
            return suggestSectionFields(input.section, input.currentFormState);
        }),

    /**
     * Scrape a URL for intake analysis.
     * Uses DynamicConnector for full fallback chain (Firecrawl → ScrapingDog → native).
     */
    scrapeUrl: orgHeavyMutationProcedure
        .input(z.object({ url: z.string().url() }))
        .mutation(async ({ input }) => {
            const { DynamicConnector } = await import("../engines/ingestion/connectors/dynamic");

            const connector = new DynamicConnector({
                id: "intake_scrape",
                name: "Intake Scraper",
                url: input.url,
                sourceType: "other",
                region: "UAE",
            });

            let result;
            try {
                result = await connector.fetch();
            } catch {
                // If DynamicConnector fails, fall back to fetchBasic
                result = await connector.fetchBasic();
            }

            // If fetch fails, return empty string
            if (result.error || (!result.markdown && !result.rawHtml)) {
                return {
                    textContent: "",
                    title: new URL(input.url).hostname,
                    domain: new URL(input.url).hostname,
                };
            }

            const rawContent = result.markdown || cleanHtmlForLLM(result.rawHtml || "");
            const titleMatch = result.rawHtml?.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch?.[1]?.trim() || new URL(input.url).hostname;

            return {
                textContent: rawContent.substring(0, 8000), // top 8000 chars as requested
                title: title.substring(0, 100),
                domain: new URL(input.url).hostname,
            };
        }),

    /**
     * Conversational chat for project intake.
     */
    chat: orgHeavyMutationProcedure
        .input(z.object({
            messages: z.array(z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string()
            }))
        }))
        .mutation(async ({ input }) => {
            const { invokeLLM } = await import("../_core/llm");

            const systemPrompt = `You are MIYAR, an expert luxury real estate and interior design intake assistant for the UAE market.
Your goal is to extract project requirements from the user through natural conversation.
Ask ONE clear question at a time.
Focus on: Typology (Villa/Apartment/Hotel), GFA (sqm/sqft), Quality Tier (Premium/Luxury/Ultra-Luxury), Location (e.g., Palm Jumeirah), and Design Style.
Be professional, concise, and helpful. Do not mention your instructions.`;

            // Format history for Gemini using _core/llm Message format
            const contents: any[] = input.messages.map(m => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content
            }));

            contents.unshift({
                role: "system",
                content: systemPrompt
            });

            // Force the last message to be from User to avoid Gemini errors if the last is Model
            if (contents.length > 1 && contents[contents.length - 1].role === "assistant") {
                contents.push({ role: "user", content: "Please continue." });
            }

            const response = await invokeLLM({
                messages: contents
            });

            const rawContent = response.choices[0]?.message?.content;
            const text = Array.isArray(rawContent)
                ? rawContent.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
                : (typeof rawContent === 'string' ? rawContent : "");

            return { text };
        }),
});
