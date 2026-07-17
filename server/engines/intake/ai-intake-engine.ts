/**
 * AI Intake Engine — MIYAR 2.0
 *
 * Pure function engine that processes multimodal assets (images, PDFs, audio,
 * video, URLs, text notes) and returns suggested ProjectInputs with per-field
 * confidence and reasoning.
 *
 * Design:
 * - Calls invokeLLM with multimodal content natively supported by Gemini
 * - Uses outputSchema to force typed JSON matching Partial<ProjectInputs>
 * - Reuses analyzeFloorPlan() for detected floor plan assets
 * - Each field gets confidence (high/medium/low) and reasoning explanation
 * - Pure function: no DB imports, no side effects
 */

import { invokeLLM, type Message, type MessageContent } from "../../_core/llm";
import { AiOperationError, toAiOperationError } from "../../_core/ai-operation";
import { analyzeFloorPlan, type FloorPlanAnalysis } from "../design/floor-plan-analyzer";
import type { ProjectInputs } from "../../../shared/miyar-types";
import type { ValidatedMedia } from "../../_core/media-validation";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IntakeAsset {
    type: "image" | "pdf" | "audio" | "video" | "url" | "text_note";
    /** Binary assets must be read and validated by the server before reaching this engine. */
    media?: ValidatedMedia;
    textContent?: string; // for URLs: scraped content; for text_note: raw text
    fileName?: string;
}

export interface IntakeResult {
    suggestedInputs: Partial<ProjectInputs>;
    confidence: Record<string, "high" | "medium" | "low">;
    reasoning: Record<string, string>;
    extractedInsights: ExtractedInsights;
    warnings: string[];
}

export interface ExtractedInsights {
    detectedStyle?: string;
    detectedMaterials?: string[];
    detectedBrands?: string[];
    detectedTier?: string;
    detectedTypology?: string;
    detectedLocation?: string;
    detectedScale?: string;
    floorPlanAnalysis?: FloorPlanAnalysis;
    supplierInfo?: { name: string; url: string; materials: string[] }[];
    projectDescription?: string;
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are MIYAR's AI Intake Engine — a specialized assistant for UAE luxury real estate and interior design projects.

Your task: Analyze uploaded assets (images, PDFs, voice recordings, URLs, text descriptions) and extract structured project parameters for a design intelligence evaluation.

## Output Structure
You MUST return a JSON object with these fields:

### suggestedInputs (Partial<ProjectInputs>)
Only include fields where you have evidence. Use these exact field names:
- ctx01Typology: "residential_multi" | "residential_single" | "hospitality" | "office" | "mixed_use" | "retail" | "community"
- ctx02Scale: "small" | "medium" | "large" | "mega"
- ctx03Gfa: number (gross floor area in sqm)
- totalFitoutArea: number (sqm)
- ctx04Location: "prime" | "secondary" | "emerging" | "suburban"
- ctx05Horizon: "12_months" | "18_months" | "24_plus"
- city: "Dubai" | "Abu Dhabi"
- sustainCertTarget: "None" | "Estidama 1 Pearl" | "Estidama 2 Pearl" | "LEED Silver" | "LEED Gold" | "LEED Platinum" | "BREEAM Good" | "BREEAM Excellent"
- str01BrandClarity: 1-5 (brand clarity)
- str02Differentiation: 1-5 (differentiation intent)
- str03BuyerMaturity: 1-5 (buyer sophistication)
- mkt01Tier: "Mid" | "Upper-mid" | "Luxury" | "Ultra-luxury"
- mkt02Competitor: 1-5 (competitive pressure)
- mkt03Trend: 1-5 (trend alignment)
- fin01BudgetCap: number (AED)
- fin02Flexibility: 1-5
- fin03ShockTolerance: 1-5
- fin04SalesPremium: 1-5
- des01Style: "Modern" | "Contemporary" | "Minimal" | "Classic" | "Fusion" | "Other"
- des02MaterialLevel: 1-5
- des03Complexity: 1-5
- des04Experience: 1-5
- des05Sustainability: 1-5
- developerType: "Master Developer" | "Private/Boutique" | "Institutional Investor"
- targetDemographic: "HNWI" | "Families" | "Young Professionals" | "Investors"
- salesStrategy: "Sell Off-Plan" | "Sell on Completion" | "Build-to-Rent"
- competitiveDensity: "Low" | "Moderate" | "Saturated"
- projectUsp: "Location/Views" | "Amenities/Facilities" | "Price/Value" | "Design/Architecture"
- targetYield: "< 5%" | "5-7%" | "7-9%" | "> 9%"
- procurementStrategy: "Turnkey" | "Traditional" | "Construction Management"
- materialSourcing: "Local" | "European" | "Asian" | "Global Mix"
- handoverCondition: "Shell & Core" | "Category A" | "Category B" | "Fully Furnished"
- brandedStatus: "Unbranded" | "Hospitality Branded" | "Fashion/Automotive Branded"

### confidence
For each field in suggestedInputs, rate your confidence:
- "high": Clear evidence from assets (text mentions, visible in images, stated in audio)
- "medium": Reasonable inference from context
- "low": Best guess based on limited evidence

### reasoning
For each field, explain WHY you set this value. Keep it under 30 words per field.

### extractedInsights
- detectedStyle: The interior design style detected (e.g., "Japandi", "Art Deco", "Biophilic")
- detectedMaterials: Array of material types spotted (e.g., ["marble", "brushed brass", "teak"])
- detectedBrands: Array of brand names mentioned
- detectedTier: The luxury tier detected
- detectedTypology: The project type
- detectedLocation: The location if mentioned
- detectedScale: The project scale
- projectDescription: A 1-2 sentence summary of what this project appears to be

### warnings
Array of any issues or missing information noticed.

## Context
- Default city: Dubai. Default currency: AED.
- UAE market context: use Dubai/UAE assumptions for all unknowns.
- If a mood board shows high-end finishes (marble, brass, exotic woods), infer Luxury or Ultra-luxury.
- If budget numbers are mentioned, always interpret in AED unless explicitly stated otherwise.
- For floor plans, extract room counts and estimate areas.
`;

// ─── Output Schema for Gemini ────────────────────────────────────────────────

const INTAKE_OUTPUT_SCHEMA = {
    name: "intake_result",
    schema: {
        type: "object",
        properties: {
            suggestedInputs: {
                type: "object",
                description: "Partial ProjectInputs — only include fields with evidence",
            },
            confidence: {
                type: "object",
                description: "Confidence level per field: high, medium, or low",
            },
            reasoning: {
                type: "object",
                description: "Brief explanation per field (under 30 words each)",
            },
            extractedInsights: {
                type: "object",
                properties: {
                    detectedStyle: { type: "string" },
                    detectedMaterials: { type: "array", items: { type: "string" } },
                    detectedBrands: { type: "array", items: { type: "string" } },
                    detectedTier: { type: "string" },
                    detectedTypology: { type: "string" },
                    detectedLocation: { type: "string" },
                    detectedScale: { type: "string" },
                    projectDescription: { type: "string" },
                },
            },
            warnings: {
                type: "array",
                items: { type: "string" },
            },
        },
        required: ["suggestedInputs", "confidence", "reasoning", "extractedInsights", "warnings"],
    },
};

const INTAKE_RESPONSE_SCHEMA = z.object({
    suggestedInputs: z.record(z.string(), z.unknown()).default({}),
    confidence: z.record(z.string(), z.enum(["high", "medium", "low"])).default({}),
    reasoning: z.record(z.string(), z.string()).default({}),
    extractedInsights: z.object({
        detectedStyle: z.string().optional(),
        detectedMaterials: z.array(z.string()).optional(),
        detectedBrands: z.array(z.string()).optional(),
        detectedTier: z.string().optional(),
        detectedTypology: z.string().optional(),
        detectedLocation: z.string().optional(),
        detectedScale: z.string().optional(),
        projectDescription: z.string().optional(),
        supplierInfo: z.array(z.object({ name: z.string(), url: z.string(), materials: z.array(z.string()) })).optional(),
    }).default({}),
    warnings: z.array(z.string()).default([]),
});

function isFloorPlanAsset(asset: IntakeAsset): boolean {
    const name = (asset.fileName || "").toLowerCase();
    const hasFloorPlanKeyword = /floor.?plan|layout|blueprint|plan.?view/i.test(name);
    return hasFloorPlanKeyword && !!asset.media && (asset.type === "image" || asset.type === "pdf");
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

/**
 * Process intake assets through Gemini and return suggested ProjectInputs.
 *
 * @param assets Array of multimodal assets (images, PDFs, audio, URLs, text)
 * @param existingInputs Optional existing inputs to avoid overwriting
 */
export async function processIntakeAssets(
    assets: IntakeAsset[],
    existingInputs?: Partial<ProjectInputs>,
): Promise<IntakeResult> {
    if (assets.length === 0) {
        return {
            suggestedInputs: {},
            confidence: {},
            reasoning: {},
            extractedInsights: {},
            warnings: ["No assets provided for analysis."],
        };
    }

    // ─── Phase 1: Floor Plan Detection ──────────────────────────────────────
    let floorPlanAnalysis: FloorPlanAnalysis | undefined;
    const processingWarnings: string[] = [];
    const floorPlanAssets = assets.filter(isFloorPlanAsset);

    if (floorPlanAssets.length > 0) {
        try {
            const fpAsset = floorPlanAssets[0];
            floorPlanAnalysis = await analyzeFloorPlan(fpAsset.media!);
        } catch (error) {
            toAiOperationError(error, "intake.floor-plan-analysis").report();
            processingWarnings.push("A floor plan could not be analysed. Other valid files were still processed.");
        }
    }

    // ─── Phase 2: Build Multimodal Message Content ──────────────────────────
    const contentParts: MessageContent[] = [];

    // Start with instruction text
    let contextText = "Analyze the following project assets and extract structured parameters:\n\n";

    if (existingInputs && Object.keys(existingInputs).length > 0) {
        contextText += `The user has already entered these values (do NOT override unless you have strong contradictory evidence):\n${JSON.stringify(existingInputs, null, 2)}\n\n`;
    }

    if (floorPlanAnalysis) {
        contextText += `Floor plan analysis already performed. Results:\n${JSON.stringify(floorPlanAnalysis, null, 2)}\n\n`;
    }

    contentParts.push({ type: "text", text: contextText });

    // Add each asset as appropriate content type
    let assetIndex = 0;
    for (const asset of assets) {
        assetIndex++;

        switch (asset.type) {
            case "image":
                if (asset.media) {
                    contentParts.push({
                        type: "media",
                        media: asset.media,
                    });
                    contentParts.push({
                        type: "text",
                        text: `[Asset ${assetIndex}: Image — analyze for style, materials, tier, and design direction]`,
                    });
                }
                break;

            case "pdf":
                if (asset.media) {
                    contentParts.push({
                        type: "media",
                        media: asset.media,
                    });
                    contentParts.push({
                        type: "text",
                        text: `[Asset ${assetIndex}: PDF document — extract project specifications, budgets, and design parameters]`,
                    });
                }
                break;

            case "audio":
                if (asset.media) {
                    contentParts.push({
                        type: "media",
                        media: asset.media,
                    });
                    contentParts.push({
                        type: "text",
                        text: `[Asset ${assetIndex}: Voice recording — transcribe and extract project vision, style preferences, budget mentions]`,
                    });
                }
                break;

            case "video":
                if (asset.media) {
                    contentParts.push({
                        type: "media",
                        media: asset.media,
                    });
                    contentParts.push({
                        type: "text",
                        text: `[Asset ${assetIndex}: Video — analyze for design references, walkthrough data, material specifications]`,
                    });
                }
                break;

            case "url":
                if (asset.textContent) {
                    contentParts.push({
                        type: "text",
                        text: `[Asset ${assetIndex}: Web reference]\nExtracted content:\n${asset.textContent.slice(0, 5000)}`,
                    });
                }
                break;

            case "text_note":
                if (asset.textContent) {
                    contentParts.push({
                        type: "text",
                        text: `[Asset ${assetIndex}: User's project description]\n"${asset.textContent}"`,
                    });
                }
                break;
        }
    }

    // ─── Phase 3: Call Gemini ───────────────────────────────────────────────
    const messages: Message[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
    ];

    const response = await invokeLLM({
        messages,
        outputSchema: INTAKE_OUTPUT_SCHEMA,
        maxTokens: 8192,
    });

    const rawText = response.choices[0]?.message?.content;
    if (!rawText || typeof rawText !== "string") {
        throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: "intake.process-assets" }).report();
    }

    // ─── Phase 4: Parse & Validate ──────────────────────────────────────────
    let parsed: z.infer<typeof INTAKE_RESPONSE_SCHEMA>;
    try {
        parsed = INTAKE_RESPONSE_SCHEMA.parse(JSON.parse(rawText));
    } catch {
        // Try to extract JSON from response
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                parsed = INTAKE_RESPONSE_SCHEMA.parse(JSON.parse(jsonMatch[0]));
            } catch {
                throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: "intake.process-assets" }).report();
            }
        } else {
            throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: "intake.process-assets" }).report();
        }
    }

    // Validate and clean the result
    const result: IntakeResult = {
        suggestedInputs: validateSuggestedInputs(parsed.suggestedInputs || {}),
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        extractedInsights: {
            ...parsed.extractedInsights,
            floorPlanAnalysis,
        },
        warnings: [...parsed.warnings, ...processingWarnings],
    };

    // AI suggestions are never allowed to overwrite an explicit value. The UI
    // can present alternatives, but the existing project input remains source
    // of truth until a user deliberately changes it.
    for (const [field, value] of Object.entries(existingInputs || {})) {
        if (value !== undefined && value !== null && value !== "") {
            delete (result.suggestedInputs as Record<string, unknown>)[field];
            delete result.confidence[field];
            delete result.reasoning[field];
        }
    }

    // Merge floor plan data into suggested inputs
    if (floorPlanAnalysis) {
        if (floorPlanAnalysis.totalEstimatedSqm && !result.suggestedInputs.ctx03Gfa) {
            result.suggestedInputs.ctx03Gfa = floorPlanAnalysis.totalEstimatedSqm;
            result.confidence["ctx03Gfa"] = "medium";
            result.reasoning["ctx03Gfa"] = "Estimated from floor plan analysis";
        }
        if (floorPlanAnalysis.bedroomCount && !result.extractedInsights.detectedScale) {
            result.extractedInsights.detectedScale = floorPlanAnalysis.bedroomCount >= 4 ? "large" : "medium";
        }
    }

    return result;
}

// ─── Validators ──────────────────────────────────────────────────────────────

const VALID_TYPOLOGIES = [
    "residential_multi", "residential_single", "hospitality",
    "office", "mixed_use", "retail", "community",
];

const VALID_SCALES = ["small", "medium", "large", "mega"];

const VALID_LOCATIONS = ["prime", "secondary", "emerging", "suburban"];

const VALID_HORIZONS = ["12_months", "18_months", "24_plus"];

const VALID_TIERS = ["Mid", "Upper-mid", "Luxury", "Ultra-luxury"];

const VALID_STYLES = ["Modern", "Contemporary", "Minimal", "Classic", "Fusion", "Other"];

function validateSuggestedInputs(raw: any): Partial<ProjectInputs> {
    const result: any = {};

    // Validate enums
    if (raw.ctx01Typology && VALID_TYPOLOGIES.includes(raw.ctx01Typology)) {
        result.ctx01Typology = raw.ctx01Typology;
    }
    if (raw.ctx02Scale && VALID_SCALES.includes(raw.ctx02Scale)) {
        result.ctx02Scale = raw.ctx02Scale;
    }
    if (raw.ctx04Location && VALID_LOCATIONS.includes(raw.ctx04Location)) {
        result.ctx04Location = raw.ctx04Location;
    }
    if (raw.ctx05Horizon && VALID_HORIZONS.includes(raw.ctx05Horizon)) {
        result.ctx05Horizon = raw.ctx05Horizon;
    }
    if (raw.mkt01Tier && VALID_TIERS.includes(raw.mkt01Tier)) {
        result.mkt01Tier = raw.mkt01Tier;
    }
    if (raw.des01Style && VALID_STYLES.includes(raw.des01Style)) {
        result.des01Style = raw.des01Style;
    }

    // Validate numbers (1-5 ordinals)
    const ordinalFields = [
        "str01BrandClarity", "str02Differentiation", "str03BuyerMaturity",
        "mkt02Competitor", "mkt03Trend",
        "fin02Flexibility", "fin03ShockTolerance", "fin04SalesPremium",
        "des02MaterialLevel", "des03Complexity", "des04Experience", "des05Sustainability",
        "exe01SupplyChain", "exe02Contractor", "exe03Approvals", "exe04QaMaturity",
    ];
    for (const field of ordinalFields) {
        const val = Number(raw[field]);
        if (!isNaN(val) && val >= 1 && val <= 5) {
            result[field] = Math.round(val);
        }
    }

    // Validate numeric fields
    if (typeof raw.ctx03Gfa === "number" && raw.ctx03Gfa > 0) {
        result.ctx03Gfa = raw.ctx03Gfa;
    }
    if (typeof raw.totalFitoutArea === "number" && raw.totalFitoutArea > 0) {
        result.totalFitoutArea = raw.totalFitoutArea;
    }
    if (typeof raw.fin01BudgetCap === "number" && raw.fin01BudgetCap > 0) {
        result.fin01BudgetCap = raw.fin01BudgetCap;
    }

    // City
    if (raw.city === "Dubai" || raw.city === "Abu Dhabi") {
        result.city = raw.city;
    }

    // V5 optional enums — pass through if present
    const v5Enums: Record<string, string[]> = {
        developerType: ["Master Developer", "Private/Boutique", "Institutional Investor"],
        targetDemographic: ["HNWI", "Families", "Young Professionals", "Investors"],
        salesStrategy: ["Sell Off-Plan", "Sell on Completion", "Build-to-Rent"],
        competitiveDensity: ["Low", "Moderate", "Saturated"],
        projectUsp: ["Location/Views", "Amenities/Facilities", "Price/Value", "Design/Architecture"],
        targetYield: ["< 5%", "5-7%", "7-9%", "> 9%"],
        procurementStrategy: ["Turnkey", "Traditional", "Construction Management"],
        materialSourcing: ["Local", "European", "Asian", "Global Mix"],
        handoverCondition: ["Shell & Core", "Category A", "Category B", "Fully Furnished"],
        brandedStatus: ["Unbranded", "Hospitality Branded", "Fashion/Automotive Branded"],
    };

    for (const [field, validValues] of Object.entries(v5Enums)) {
        if (raw[field] && validValues.includes(raw[field])) {
            result[field] = raw[field];
        }
    }

    return result;
}

// ─── Section-Level AI Assist ─────────────────────────────────────────────────

/** Fields belonging to each form section */
const SECTION_FIELDS: Record<string, string[]> = {
    context: [
        "ctx01Typology", "ctx02Scale", "ctx03Gfa", "ctx04Location",
        "ctx05Horizon", "city", "projectPurpose", "sustainCertTarget",
    ],
    strategy: [
        "str01BrandClarity", "str02Differentiation", "str03BuyerMaturity",
        "targetDemographic", "salesStrategy", "brandedStatus", "salesChannel",
        "lifecycleFocus", "brandStandardConstraints", "developerType",
    ],
    market: [
        "mkt01Tier", "mkt02Competitor", "mkt03Trend",
        "competitiveDensity", "projectUsp", "targetYield",
    ],
    financial: [
        "fin01BudgetCap", "fin02Flexibility", "fin03ShockTolerance", "fin04SalesPremium",
        "procurementStrategy", "targetValueAdd", "timelineFlexibility",
    ],
    design: [
        "des01Style", "des02MaterialLevel", "des03Complexity",
        "des04Experience", "des05Sustainability", "materialSourcing",
        "handoverCondition", "amenityFocus", "techIntegration",
    ],
    execution: [
        "exe01SupplyChain", "exe02Contractor", "exe03Approvals", "exe04QaMaturity",
    ],
};

export interface SectionSuggestion {
    field: string;
    value: any;
    confidence: "high" | "medium" | "low";
    reasoning: string;
}

export interface SectionSuggestResult {
    suggestions: SectionSuggestion[];
    sectionSummary: string;
}

const SECTION_SUGGESTION_RESPONSE_SCHEMA = z.object({
    suggestions: z.array(z.object({
        field: z.string(),
        value: z.unknown(),
        confidence: z.enum(["high", "medium", "low"]),
        reasoning: z.string(),
    })).default([]),
    sectionSummary: z.string().default(""),
});

/**
 * Suggest values for a specific form section using current form state as context.
 * Lightweight text-only AI call — no file processing.
 */
export async function suggestSectionFields(
    section: string,
    currentFormState: Record<string, any>,
): Promise<SectionSuggestResult> {
    const fields = SECTION_FIELDS[section];
    if (!fields) {
        return { suggestions: [], sectionSummary: "Unknown section." };
    }

    // Extract known values to give context
    const knownValues: Record<string, any> = {};
    for (const [key, value] of Object.entries(currentFormState)) {
        if (value !== null && value !== undefined && value !== "" && value !== 0) {
            knownValues[key] = value;
        }
    }

    const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);

    const prompt = `You are MIYAR's AI form assistant for UAE luxury real estate projects.

The user is filling out the "${sectionLabel}" section of a project intake form.

## Current Project State (already filled)
${JSON.stringify(knownValues, null, 2)}

## Fields to Suggest Values For
Only suggest values for these fields: ${JSON.stringify(fields)}

## Field Definitions
- ctx01Typology: "Residential" | "Mixed-use" | "Hospitality" | "Office" | "Villa" | "Gated Community" | "Villa Development"
- ctx02Scale: "Small" | "Medium" | "Large"
- ctx03Gfa: number (gross floor area in sqm)
- ctx04Location: "Prime" | "Secondary" | "Emerging"
- ctx05Horizon: "0-12m" | "12-24m" | "24-36m" | "36m+"
- city: "Dubai" | "Abu Dhabi"
- projectPurpose: "sell_offplan" | "sell_ready" | "rent" | "mixed"
- sustainCertTarget: "none" | "silver" | "gold" | "platinum"
- str01BrandClarity: 1-5
- str02Differentiation: 1-5
- str03BuyerMaturity: 1-5
- mkt01Tier: "Mid" | "Upper-mid" | "Luxury" | "Ultra-luxury"
- mkt02Competitor: 1-5
- mkt03Trend: 1-5
- fin01BudgetCap: number (AED)
- fin02Flexibility: 1-5
- fin03ShockTolerance: 1-5
- fin04SalesPremium: 1-5
- des01Style: "Modern" | "Contemporary" | "Minimal" | "Classic" | "Fusion" | "Other"
- des02MaterialLevel: 1-5
- des03Complexity: 1-5
- des04Experience: 1-5
- des05Sustainability: 1-5
- exe01SupplyChain: 1-5
- exe02Contractor: 1-5
- exe03Approvals: 1-5
- exe04QaMaturity: 1-5
- developerType: "Master Developer" | "Private/Boutique" | "Institutional Investor"
- targetDemographic: "HNWI" | "Families" | "Young Professionals" | "Investors"
- salesStrategy: "Sell Off-Plan" | "Sell on Completion" | "Build-to-Rent"
- competitiveDensity: "Low" | "Moderate" | "Saturated"
- projectUsp: "Location/Views" | "Amenities/Facilities" | "Price/Value" | "Design/Architecture"
- targetYield: "< 5%" | "5-7%" | "7-9%" | "> 9%"
- procurementStrategy: "Turnkey" | "Traditional" | "Construction Management"
- materialSourcing: "Local" | "European" | "Asian" | "Global Mix"
- handoverCondition: "Shell & Core" | "Category A" | "Category B" | "Fully Furnished"
- brandedStatus: "Unbranded" | "Hospitality Branded" | "Fashion/Automotive Branded"
- salesChannel: "Local Brokerage" | "International Roadshows" | "Direct to VIP"
- lifecycleFocus: "Short-term Resale" | "Medium-term Hold" | "Long-term Retention"
- brandStandardConstraints: "High Flexibility" | "Moderate Guidelines" | "Strict Vendor List"
- amenityFocus: string (freeform)
- techIntegration: string (freeform)
- targetValueAdd: string (freeform)
- timelineFlexibility: string (freeform)

## Rules
- Only suggest fields that DON'T already have meaningful values in the Current Project State
- Base suggestions on UAE Dubai market context
- Consider the relationships between fields (e.g., Luxury tier implies higher material level, more HNWI, etc.)
- For ordinal 1-5 fields, always return an integer

Return a JSON object with:
1. "suggestions": array of { "field": string, "value": any, "confidence": "high"|"medium"|"low", "reasoning": string (under 25 words) }
2. "sectionSummary": string (one sentence summarizing your assessment for this section)`;

    const messages: Message[] = [
        { role: "user", content: prompt },
    ];

    const SECTION_OUTPUT_SCHEMA = {
        name: "section_suggestion",
        schema: {
            type: "object" as const,
            properties: {
                suggestions: {
                    type: "array" as const,
                    items: {
                        type: "object" as const,
                        properties: {
                            field: { type: "string" as const },
                            value: {},
                            confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
                            reasoning: { type: "string" as const },
                        },
                        required: ["field", "value", "confidence", "reasoning"],
                    },
                },
                sectionSummary: { type: "string" as const },
            },
            required: ["suggestions", "sectionSummary"],
        },
    };

    try {
        const response = await invokeLLM({
            messages,
            outputSchema: SECTION_OUTPUT_SCHEMA,
            maxTokens: 4096,
        });

        const rawText = response.choices[0]?.message?.content;
        if (!rawText || typeof rawText !== "string") {
            throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: "intake.suggest-section" }).report();
        }

        let parsed: z.infer<typeof SECTION_SUGGESTION_RESPONSE_SCHEMA>;
        try {
            parsed = SECTION_SUGGESTION_RESPONSE_SCHEMA.parse(JSON.parse(rawText));
        } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = SECTION_SUGGESTION_RESPONSE_SCHEMA.parse(JSON.parse(jsonMatch[0]));
            } else {
                throw new AiOperationError("PROVIDER_INVALID_RESPONSE", { operation: "intake.suggest-section" }).report();
            }
        }

        // Validate suggestions against section fields
        const validSuggestions: SectionSuggestion[] = [];
        if (Array.isArray(parsed.suggestions)) {
            for (const s of parsed.suggestions) {
                if (fields.includes(s.field) && s.value !== null && s.value !== undefined) {
                    validSuggestions.push({
                        field: s.field,
                        value: s.value,
                    confidence: s.confidence,
                    reasoning: s.reasoning,
                    });
                }
            }
        }

        return {
            suggestions: validSuggestions,
            sectionSummary: parsed.sectionSummary || "",
        };
    } catch (error) {
        throw toAiOperationError(error, "intake.suggest-section").report();
    }
}
