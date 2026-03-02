/**
 * MIYAR — Design Trend Extraction Pipeline
 *
 * Scrapes design-focused sources (Dezeen, ArchDaily, CID) and extracts
 * trend signals — material preferences, color palettes, style directions —
 * storing them as evidence records with intelligenceType = 'design_trend'.
 *
 * Also enriches the designTrends table with emerging/declining signals.
 */

import { invokeLLM } from "../../_core/llm";

// ─── Types ───────────────────────────────────────────────────────

export interface ExtractedTrend {
    trendName: string;
    category: "material" | "color" | "style" | "spatial" | "technology" | "sustainability";
    confidence: "established" | "emerging" | "declining" | "speculative";
    relevanceToUAE: "high" | "medium" | "low";
    description: string;
    relatedMaterials: string[];
    relatedBrands: string[];
    sourceUrl: string;
    sourceName: string;
}

export interface TrendExtractionResult {
    trends: ExtractedTrend[];
    totalArticlesAnalyzed: number;
    extractedAt: Date;
}

// ─── Trend Extraction Prompt ─────────────────────────────────────

const TREND_EXTRACTION_PROMPT = `You are MIYAR's Design Trend Intelligence Engine, specializing in UAE luxury interior design.

Analyze the following article/content and extract design trends relevant to the UAE luxury real estate market.

**Source:** {sourceName} ({sourceUrl})
**Content:**
{content}

**Extract trends in these categories:**
- material: New or trending material choices (marble types, tiles, wood species, metals)
- color: Color palette shifts (earth tones, bold colors, neutrals)
- style: Design style movements (minimalism, maximalism, japandi, biophilic)
- spatial: Space planning trends (open plan, flexible spaces, wellness rooms)
- technology: Smart home, lighting tech, material innovations
- sustainability: Green materials, EPD considerations, LEED/Estidama alignment

**Rules:**
- Focus on trends relevant to UAE/GCC luxury residential and hospitality
- Rate UAE relevance: "high" (already seen in Dubai projects), "medium" (adopted in similar markets), "low" (global only)
- Classify confidence: "established" (widely adopted), "emerging" (growing), "declining" (fading), "speculative" (very new)
- Include specific material/brand names when mentioned

Return JSON array:
[{
  "trendName": "...",
  "category": "material" | "color" | "style" | "spatial" | "technology" | "sustainability",
  "confidence": "established" | "emerging" | "declining" | "speculative",
  "relevanceToUAE": "high" | "medium" | "low",
  "description": "2-3 sentence description",
  "relatedMaterials": ["material1", "material2"],
  "relatedBrands": ["brand1", "brand2"]
}]`;

// ─── Helper: Call LLM with simple prompt ────────────────────────

async function askLLM(prompt: string): Promise<string> {
    const result = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
    });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : JSON.stringify(content);
}

// ─── Main Extraction Function ────────────────────────────────────

/**
 * Extract design trends from article content using Gemini AI.
 */
export async function extractDesignTrends(options: {
    content: string;
    sourceName: string;
    sourceUrl: string;
}): Promise<TrendExtractionResult> {
    const { content, sourceName, sourceUrl } = options;

    // Truncate content to avoid token limits
    const truncatedContent = content.substring(0, 8000);

    const prompt = TREND_EXTRACTION_PROMPT
        .replace("{sourceName}", sourceName)
        .replace("{sourceUrl}", sourceUrl)
        .replace("{content}", truncatedContent);

    try {
        const response = await askLLM(prompt);

        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return {
                trends: [],
                totalArticlesAnalyzed: 1,
                extractedAt: new Date(),
            };
        }

        const rawTrends = JSON.parse(jsonMatch[0]) as Array<{
            trendName: string;
            category: string;
            confidence: string;
            relevanceToUAE: string;
            description: string;
            relatedMaterials: string[];
            relatedBrands: string[];
        }>;

        const trends: ExtractedTrend[] = rawTrends
            .filter((t) => t.trendName && t.category && t.description)
            .map((t) => ({
                trendName: t.trendName,
                category: t.category as ExtractedTrend["category"],
                confidence: (t.confidence as ExtractedTrend["confidence"]) || "speculative",
                relevanceToUAE: (t.relevanceToUAE as ExtractedTrend["relevanceToUAE"]) || "medium",
                description: t.description,
                relatedMaterials: t.relatedMaterials || [],
                relatedBrands: t.relatedBrands || [],
                sourceUrl,
                sourceName,
            }));

        return {
            trends,
            totalArticlesAnalyzed: 1,
            extractedAt: new Date(),
        };
    } catch (err) {
        return {
            trends: [],
            totalArticlesAnalyzed: 1,
            extractedAt: new Date(),
        };
    }
}

// ─── Developer Project Intelligence Prompt ───────────────────────

const DEVELOPER_INTEL_PROMPT = `You are MIYAR's Developer Project Intelligence Engine for UAE real estate.

Analyze this developer's project page/brochure content and extract:
1. Project name, location, and developer
2. Interior design specifications (material types, finish levels, brands)
3. Approximate fitout spec level (basic/standard/premium/luxury/ultra_luxury)
4. Key interior features mentioned
5. Any pricing or cost information

**Source:** {sourceName} ({sourceUrl})
**Content:**
{content}

Return JSON:
{
  "projectName": "...",
  "developer": "...",
  "location": "...",
  "finishLevel": "basic" | "standard" | "premium" | "luxury" | "ultra_luxury",
  "interiorSpecs": [
    { "area": "kitchen" | "bathroom" | "living" | "bedroom" | "common", "materials": ["..."], "brands": ["..."], "notes": "..." }
  ],
  "designStyle": "...",
  "keyFeatures": ["..."],
  "estimatedFitoutRange": { "min": 0, "max": 0, "unit": "AED/sqft" }
}`;

/**
 * Extract developer project intelligence from project page content.
 */
export async function extractDeveloperIntelligence(options: {
    content: string;
    sourceName: string;
    sourceUrl: string;
}): Promise<{
    projectName: string;
    developer: string;
    location: string;
    finishLevel: string;
    interiorSpecs: Array<{
        area: string;
        materials: string[];
        brands: string[];
        notes: string;
    }>;
    designStyle: string;
    keyFeatures: string[];
    estimatedFitoutRange: { min: number; max: number; unit: string } | null;
} | null> {
    const { content, sourceName, sourceUrl } = options;
    const truncatedContent = content.substring(0, 8000);

    const prompt = DEVELOPER_INTEL_PROMPT
        .replace("{sourceName}", sourceName)
        .replace("{sourceUrl}", sourceUrl)
        .replace("{content}", truncatedContent);

    try {
        const response = await askLLM(prompt);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        return JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }
}
