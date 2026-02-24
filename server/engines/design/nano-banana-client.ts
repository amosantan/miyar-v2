/**
 * Nano Banana Client — Per-Space Visual Generation
 * Uses Gemini native image generation API (same as Imagen 3 / Gemini Flash Image).
 * Generates mood boards, material boards, kitchen renders, bathroom renders, and hero images.
 */

import { generateImage } from "../../_core/imageGeneration";
import type { SpaceRecommendation, KitchenSpec, BathroomSpec } from "./design-types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type VisualType =
    | "mood_board"
    | "material_board"
    | "room_render"
    | "kitchen_render"
    | "bathroom_render"
    | "hero_image"
    | "color_palette";

export interface VisualGenerationRequest {
    projectId: number;
    roomId?: string;
    type: VisualType;
    prompt?: string;       // Custom override
    resolution?: "standard" | "high";
}

export interface VisualGenerationResult {
    type: VisualType;
    roomId?: string;
    imageUrl: string;
    prompt: string;
    generatedAt: string;
}

// ─── Prompt Templates ───────────────────────────────────────────────────────

interface ProjectContext {
    projectName: string;
    typology: string;
    location: string;
    tier: string;
    style: string;
    gfa: number;
}

function buildRoomMoodBoardPrompt(ctx: ProjectContext, rec: SpaceRecommendation): string {
    const materials = rec.materialPackage
        .map(m => `${m.productName} by ${m.brand}`)
        .join(", ");

    return `Create a professional interior design mood board for a ${rec.roomName} in a ${ctx.tier} ${ctx.typology} project in ${ctx.location}.

Design direction: ${rec.styleDirection}
Color scheme: ${rec.colorScheme}
Key materials: ${materials || "High-quality finishes"}
Room size: ${rec.sqm} sqm

The mood board should include:
- Material swatches and texture samples
- Color palette with hex codes
- Furniture and decor inspiration
- Lighting atmosphere references
- Spatial arrangement concepts

Professional architectural presentation style. Clean white background with elegant grid layout. No text overlays. High-end design magazine quality.`;
}

function buildRoomRenderPrompt(ctx: ProjectContext, rec: SpaceRecommendation): string {
    const materials = rec.materialPackage
        .slice(0, 4)
        .map(m => m.productName)
        .join(", ");

    return `Create a photorealistic interior render of a ${rec.roomName} (${rec.sqm} sqm) in a ${ctx.tier} ${ctx.typology} home in ${ctx.location}.

Design style: ${rec.styleDirection}
Colors: ${rec.colorScheme}
Materials: ${materials || "Premium finishes"}

Show a beautifully designed space with natural daylight from large windows. Include contemporary furniture appropriate for the ${ctx.tier} market segment. Warm, inviting atmosphere. Professional architectural visualization quality. Camera at eye level with slight wide-angle lens. No people in the image.`;
}

function buildMaterialBoardPrompt(ctx: ProjectContext, rec: SpaceRecommendation): string {
    const materialDetails = rec.materialPackage
        .map(m => `${m.element}: ${m.productName} (${m.brand}) — ${m.priceRangeAed}`)
        .join("\n");

    return `Create a professional material and finish specification board for a ${rec.roomName} in a ${ctx.tier} ${ctx.typology} project.

Design style: ${rec.styleDirection}
Materials to show:
${materialDetails || "Premium flooring, wall finish, joinery, hardware"}

Present as a flat-lay product photography board:
- Each material swatch cleanly arranged on a white/light grey surface
- Show actual material textures (stone grain, wood grain, metal finish, fabric weave)
- Arrange in an aesthetically pleasing grid or diagonal composition
- 6-8 material samples visible
- Professional product photography lighting
- No text labels, just the materials themselves
- Architectural specification board style`;
}

function buildKitchenRenderPrompt(ctx: ProjectContext, rec: SpaceRecommendation, kitchen: KitchenSpec): string {
    return `Create a photorealistic kitchen interior render for a ${ctx.tier} ${ctx.typology} home in ${ctx.location}.

Kitchen specifications:
- Layout: ${kitchen.layoutType}
- Cabinets: ${kitchen.cabinetStyle}, ${kitchen.cabinetFinish} finish
- Countertop: ${kitchen.countertopMaterial}
- Backsplash: ${kitchen.backsplash}
- Sink: ${kitchen.sinkType}
- Appliance level: ${kitchen.applianceLevel} (${kitchen.applianceBrands?.join(", ") || "Premium"})
- Storage features: ${kitchen.storageFeatures?.join(", ") || "Modern"}

Design style: ${rec.styleDirection}
Color scheme: ${rec.colorScheme}

Show a beautifully designed modern kitchen with natural light. Include pendant lighting above the island/counter. Show the full kitchen layout with all elements visible. Professional architectural visualization. Warm, lived-in atmosphere. No people.`;
}

function buildBathroomRenderPrompt(ctx: ProjectContext, rec: SpaceRecommendation, bathroom: BathroomSpec): string {
    return `Create a photorealistic luxury bathroom interior render for a ${ctx.tier} ${ctx.typology} home in ${ctx.location}.

Bathroom specifications:
- Shower: ${bathroom.showerType} with frameless glass
- Vanity: ${bathroom.vanityStyle}, ${bathroom.vanityWidth} wide
- Wall tile: ${bathroom.wallTile}
- Floor tile: ${bathroom.floorTile}
- Tile pattern: ${bathroom.tilePattern}
- Fixtures: ${bathroom.fixtureFinish} finish by ${bathroom.fixtureBrand}
- Mirror: ${bathroom.mirrorType}
- Luxury features: ${bathroom.luxuryFeatures?.join(", ") || "Premium fixtures"}

Design style: ${rec.styleDirection}
Color scheme: ${rec.colorScheme}

Spa-like atmosphere with soft natural light and warm ambient lighting. Show all key elements: vanity, shower, mirror, and fixtures. Professional architectural visualization quality. Serene and luxurious mood. No people.`;
}

function buildHeroImagePrompt(ctx: ProjectContext): string {
    return `Create a stunning hero marketing image for a ${ctx.tier} ${ctx.typology} development called "${ctx.projectName}" in ${ctx.location}.

Show a breathtaking interior living space with ${ctx.style} design aesthetic. Natural light streaming through floor-to-ceiling windows with a view. Premium finishes and designer furniture. The image should convey luxury, sophistication, and aspiration.

Professional real estate marketing photography quality. Warm golden hour lighting. Wide-angle architectural lens. Magazine cover quality. No people, no text overlays.`;
}

function buildColorPalettePrompt(ctx: ProjectContext, rec: SpaceRecommendation): string {
    return `Create a clean, professional color palette visualization for an interior design project.

Color scheme: ${rec.colorScheme}
Design style: ${rec.styleDirection}

Show 5-7 color swatches arranged horizontally on a pure white background. Each swatch should be a clean rectangle or circle. Include complementary accent colors. The palette should feel cohesive and sophisticated, appropriate for a ${ctx.tier} ${ctx.typology} interior.

Minimalist design, no text, no labels, just beautiful color harmony. Professional design tool aesthetic.`;
}

// ─── Main Generation Functions ──────────────────────────────────────────────

export async function generateSpaceVisual(
    ctx: ProjectContext,
    rec: SpaceRecommendation,
    type: VisualType
): Promise<VisualGenerationResult> {
    let prompt: string;

    switch (type) {
        case "mood_board":
            prompt = buildRoomMoodBoardPrompt(ctx, rec);
            break;
        case "material_board":
            prompt = buildMaterialBoardPrompt(ctx, rec);
            break;
        case "room_render":
            prompt = buildRoomRenderPrompt(ctx, rec);
            break;
        case "kitchen_render":
            if (!rec.kitchenSpec) throw new Error("No kitchen specification available for this space");
            prompt = buildKitchenRenderPrompt(ctx, rec, rec.kitchenSpec);
            break;
        case "bathroom_render":
            if (!rec.bathroomSpec) throw new Error("No bathroom specification available for this space");
            prompt = buildBathroomRenderPrompt(ctx, rec, rec.bathroomSpec);
            break;
        case "color_palette":
            prompt = buildColorPalettePrompt(ctx, rec);
            break;
        case "hero_image":
            prompt = buildHeroImagePrompt(ctx);
            break;
        default:
            throw new Error(`Unknown visual type: ${type}`);
    }

    const result = await generateImage({ prompt });

    return {
        type,
        roomId: rec.roomId,
        imageUrl: result.url || "",
        prompt,
        generatedAt: new Date().toISOString(),
    };
}

export async function generateHeroVisual(
    ctx: ProjectContext
): Promise<VisualGenerationResult> {
    const prompt = buildHeroImagePrompt(ctx);
    const result = await generateImage({ prompt });

    return {
        type: "hero_image",
        imageUrl: result.url || "",
        prompt,
        generatedAt: new Date().toISOString(),
    };
}

export async function generateBatchVisuals(
    ctx: ProjectContext,
    recommendations: SpaceRecommendation[],
    types: VisualType[] = ["mood_board"]
): Promise<VisualGenerationResult[]> {
    const results: VisualGenerationResult[] = [];

    for (const rec of recommendations) {
        for (const type of types) {
            // Skip kitchen/bathroom renders for non-applicable rooms
            if (type === "kitchen_render" && !rec.kitchenSpec) continue;
            if (type === "bathroom_render" && !rec.bathroomSpec) continue;

            try {
                const visual = await generateSpaceVisual(ctx, rec, type);
                results.push(visual);
            } catch (error) {
                console.error(`[NanoBanana] Failed to generate ${type} for ${rec.roomId}:`, error);
                // Continue with other visuals, don't fail the entire batch
            }
        }
    }

    return results;
}
