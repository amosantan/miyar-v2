/**
 * Visual Generation Engine (V2.8 — nano banana)
 * Builds prompts from templates + project data, dispatches to image generation,
 * stores results as project assets.
 */

import type { ProjectInputs } from "../../shared/miyar-types";

export interface PromptContext {
  typology: string;
  location: string;
  style: string;
  tier: string;
  materialLevel: string;
  materialCount?: string;
  accentColor?: string;
}

/**
 * Build a prompt context from project inputs
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

/**
 * Interpolate template variables with context values
 */
export function interpolateTemplate(template: string, context: PromptContext): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/**
 * Generate a default prompt when no template is available
 */
export function generateDefaultPrompt(type: "mood" | "material_board" | "hero", context: PromptContext): string {
  switch (type) {
    case "mood":
      return `Create a sophisticated interior design mood board for a ${context.tier} ${context.typology} project in ${context.location}. Design style: ${context.style}. Material level: ${context.materialLevel}. The mood board should convey the project's design direction through carefully curated images of materials, textures, colors, lighting, and spatial arrangements. Professional presentation with clean layout.`;
    case "material_board":
      return `Generate a detailed material and finish board for a ${context.tier} ${context.typology} interior. Style: ${context.style}. Show 8 key material swatches arranged in a professional grid: natural stone, wood flooring, metal hardware, fabric upholstery, wall finish, ceiling treatment, lighting fixture, and accent piece. Each swatch labeled with material name. Clean white background, architectural presentation style.`;
    case "hero":
      return `Create a photorealistic marketing hero image for a ${context.tier} ${context.typology} development in ${context.location}. Show a stunning interior living space with ${context.style} design aesthetic. Natural light streaming through floor-to-ceiling windows. High-end ${context.materialLevel} finishes and designer furniture. Aspirational lifestyle photography, warm color temperature, professional real estate marketing quality.`;
  }
}

/**
 * Validate that a prompt is safe and appropriate
 */
export function validatePrompt(prompt: string): { valid: boolean; reason?: string } {
  if (prompt.length < 20) return { valid: false, reason: "Prompt too short — minimum 20 characters" };
  if (prompt.length > 2000) return { valid: false, reason: "Prompt too long — maximum 2000 characters" };
  
  // Basic content safety check
  const blockedTerms = ["nsfw", "explicit", "violent", "weapon", "gore"];
  const lower = prompt.toLowerCase();
  for (const term of blockedTerms) {
    if (lower.includes(term)) return { valid: false, reason: `Blocked content term detected: ${term}` };
  }
  
  return { valid: true };
}
