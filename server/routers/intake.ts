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
import { cleanHtmlForLLM } from "../engines/ingestion/connectors/dynamic";
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

    suggestSection: orgProcedure
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
    scrapeUrl: orgProcedure
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
    chat: orgProcedure
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
