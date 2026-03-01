/**
 * Visual Generation Engine (Phase 9 — Material-Deterministic Renders)
 *
 * Builds prompts from project data + EXACT Material Board selections.
 * Replaces generic "luxury flooring" with "Cosentino Dekton Trilium large-format porcelain".
 * Falls back to generic prompts only when no board is attached.
 */

import type { ProjectInputs } from "../../shared/miyar-types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PromptContext {
  typology: string;
  location: string;
  style: string;
  tier: string;
  materialLevel: string;
  materialCount?: string;
  accentColor?: string;
  // Phase 9: Board-aware fields
  materialSpec?: string;       // Exact material specification string from board
  carbonGrade?: string;        // Sustainability grade (A–E)
  brandStandard?: string;      // Brand standard constraint
}

export interface BoardMaterialSpec {
  name: string;
  category: string;
  tier: string;
  supplierName: string | null;
  costUnit: string | null;
  costLow: number;
  costHigh: number;
  embodiedCarbon: number | null;
  maintenanceFactor: number | null;
  brandStandardApproval: string | null;
}

// ─── Category Grouping ───────────────────────────────────────────────────────

const CATEGORY_DISPLAY: Record<string, string> = {
  tile: "Flooring/Tiling",
  stone: "Stone (Wall/Floor)",
  wood: "Wood/Timber",
  metal: "Metal Hardware",
  fabric: "Soft Furnishings",
  glass: "Glass/Mirrors",
  paint: "Paint/Coating",
  wallpaper: "Wall Covering",
  lighting: "Lighting",
  furniture: "Furniture",
  fixture: "Sanitaryware/Fixtures",
  accessory: "Accessories/Hardware",
  other: "Other Finishes",
};

// ─── Generic Context Builder (Legacy Fallback) ───────────────────────────────

/**
 * Build a prompt context from project inputs (no board materials)
 */
export function buildPromptContext(inputs: ProjectInputs): PromptContext {
  const materialLevelMap: Record<number, string> = {
    1: "basic/economy",
    2: "standard/mid-range",
    3: "premium/upper-mid",
    4: "luxury/high-end",
    5: "ultra-luxury/bespoke",
  };

  const locationMap: Record<string, string> = {
    Prime: "Dubai prime waterfront",
    Secondary: "Dubai urban",
    Emerging: "Dubai emerging district",
  };

  return {
    typology: inputs.ctx01Typology,
    location: locationMap[inputs.ctx04Location] || inputs.ctx04Location,
    style: inputs.des01Style,
    tier: inputs.mkt01Tier,
    materialLevel: materialLevelMap[inputs.des02MaterialLevel] || "premium",
    materialCount: "8",
    accentColor: inputs.des01Style === "Minimal" ? "warm brass" : "deep emerald",
  };
}

// ─── Phase 9: Board-Aware Context Builder ────────────────────────────────────

/**
 * Build a prompt context enriched with exact board material specifications.
 * This is the Phase 9 upgrade — renders will reference real vendor materials.
 */
export function buildBoardAwarePromptContext(
  inputs: ProjectInputs,
  boardMaterials: BoardMaterialSpec[],
  brandStandardConstraints?: string | null
): PromptContext {
  const base = buildPromptContext(inputs);

  if (!boardMaterials || boardMaterials.length === 0) {
    return base; // Fall back to generic
  }

  // Group materials by category and build specification string
  const grouped = new Map<string, BoardMaterialSpec[]>();
  for (const mat of boardMaterials) {
    const category = mat.category || "other";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(mat);
  }

  const specParts: string[] = [];
  for (const [category, mats] of Array.from(grouped.entries())) {
    const categoryLabel = CATEGORY_DISPLAY[category] || category;
    const matNames = mats
      .map((m: BoardMaterialSpec) => {
        const supplier = m.supplierName && m.supplierName !== "TBD" && m.supplierName !== "Market Data"
          ? ` by ${m.supplierName}`
          : "";
        return `${m.name}${supplier}`;
      })
      .join(", ");
    specParts.push(`${categoryLabel}: ${matNames}`);
  }

  const materialSpec = specParts.join(". ");

  // Calculate carbon grade
  const carbons = boardMaterials
    .map((m) => m.embodiedCarbon)
    .filter((c): c is number => c != null && c > 0);
  let carbonGrade = "C";
  if (carbons.length > 0) {
    const avg = carbons.reduce((a, b) => a + b, 0) / carbons.length;
    if (avg < 5) carbonGrade = "A";
    else if (avg < 15) carbonGrade = "B";
    else if (avg < 30) carbonGrade = "C";
    else if (avg < 50) carbonGrade = "D";
    else carbonGrade = "E";
  }

  return {
    ...base,
    materialSpec,
    carbonGrade,
    brandStandard: brandStandardConstraints || undefined,
    materialCount: String(boardMaterials.length),
  };
}

// ─── Phase 9: Room-Specific Prompt Context ───────────────────────────────────

/**
 * Build a prompt context for a specific room, filtering materials to that room's category.
 */
export function buildRoomPromptContext(
  inputs: ProjectInputs,
  roomName: string,
  roomType: string,
  roomSqm: number,
  boardMaterials: BoardMaterialSpec[],
  brandStandardConstraints?: string | null
): PromptContext {
  // Filter materials relevant to this room type
  const roomCategories = getRoomRelevantCategories(roomType);
  const filteredMaterials = boardMaterials.filter((m) =>
    roomCategories.includes(m.category)
  );

  // If no specific materials match, use all board materials
  const materialsToUse = filteredMaterials.length > 0 ? filteredMaterials : boardMaterials;

  const context = buildBoardAwarePromptContext(inputs, materialsToUse, brandStandardConstraints);

  // Override with room-specific details
  context.typology = `${roomSqm} sqm ${roomName} in a ${inputs.ctx01Typology} unit`;

  return context;
}

/**
 * Map room types to relevant material categories
 */
function getRoomRelevantCategories(roomType: string): string[] {
  switch (roomType) {
    case "bathroom":
      return ["tile", "stone", "fixture", "glass", "accessory", "lighting"];
    case "kitchen":
      return ["stone", "tile", "metal", "fixture", "accessory", "lighting"];
    case "bedroom":
    case "living":
    case "dining":
      return ["wood", "stone", "tile", "fabric", "lighting", "furniture", "paint", "wallpaper"];
    case "corridor":
    case "lobby":
      return ["tile", "stone", "lighting", "paint", "wallpaper"];
    case "balcony":
      return ["tile", "stone", "furniture"];
    default:
      return ["tile", "stone", "wood", "paint", "lighting"];
  }
}

// ─── Template Interpolation ──────────────────────────────────────────────────

/**
 * Interpolate template variables with context values
 */
export function interpolateTemplate(template: string, context: PromptContext): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
  }
  return result;
}

// ─── Prompt Generation ───────────────────────────────────────────────────────

/**
 * Generate a default prompt. Phase 9: injects exact material specifications when available.
 */
export function generateDefaultPrompt(
  type: "mood" | "material_board" | "hero",
  context: PromptContext
): string {
  const materialClause = context.materialSpec
    ? `\n\nMATERIAL SPECIFICATION (use these EXACT materials in the render):\n${context.materialSpec}`
    : "";

  const carbonClause = context.carbonGrade
    ? ` Sustainability grade: ${context.carbonGrade}.`
    : "";

  const brandClause = context.brandStandard
    ? ` Brand standard: ${context.brandStandard}.`
    : "";

  switch (type) {
    case "mood":
      return `Create a sophisticated interior design mood board for a ${context.tier} ${context.typology} project in ${context.location}. Design style: ${context.style}. Material level: ${context.materialLevel}.${carbonClause}${brandClause} The mood board should convey the project's design direction through carefully curated images of materials, textures, colors, lighting, and spatial arrangements. Professional presentation with clean layout.${materialClause}`;

    case "material_board":
      return `Generate a detailed material and finish board for a ${context.tier} ${context.typology} interior. Style: ${context.style}.${carbonClause}${brandClause} Show ${context.materialCount || "8"} key material swatches arranged in a professional grid. Each swatch labeled with exact material name and supplier. Clean white background, architectural presentation style.${materialClause}`;

    case "hero":
      return `Create a photorealistic marketing hero image for a ${context.tier} ${context.typology} development in ${context.location}. Show a stunning interior living space with ${context.style} design aesthetic.${carbonClause}${brandClause} Natural light streaming through floor-to-ceiling windows. Aspirational lifestyle photography, warm color temperature, professional real estate marketing quality.${materialClause}`;
  }
}

/**
 * Generate a room-specific render prompt (Phase 9).
 */
export function generateRoomRenderPrompt(
  context: PromptContext,
  roomName: string,
  roomSqm: number,
  finishGrade: string
): string {
  const gradeLabel =
    finishGrade === "A" ? "premium showcase-quality"
      : finishGrade === "B" ? "high-quality standard"
        : "functional utility-grade";

  const materialClause = context.materialSpec
    ? `\n\nMATERIAL SPECIFICATION (use these EXACT materials in the render):\n${context.materialSpec}`
    : "";

  return `Create a photorealistic interior render of a ${roomSqm} sqm ${roomName} in a ${context.tier} ${context.typology} in ${context.location}. Design style: ${context.style}. Finish grade: ${gradeLabel}. This is a ${context.tier} project — every detail must reflect the quality tier. Natural lighting, professional architectural photography quality, 8K resolution feel. Show furniture placement, material textures, and lighting design.${materialClause}`;
}

// ─── Prompt Validation ───────────────────────────────────────────────────────

/**
 * Validate that a prompt is safe and appropriate
 */
export function validatePrompt(prompt: string): { valid: boolean; reason?: string } {
  if (prompt.length < 20) return { valid: false, reason: "Prompt too short — minimum 20 characters" };
  if (prompt.length > 4000) return { valid: false, reason: "Prompt too long — maximum 4000 characters" };

  // Basic content safety check
  const blockedTerms = ["nsfw", "explicit", "violent", "weapon", "gore"];
  const lower = prompt.toLowerCase();
  for (const term of blockedTerms) {
    if (lower.includes(term)) return { valid: false, reason: `Blocked content term detected: ${term}` };
  }

  return { valid: true };
}
