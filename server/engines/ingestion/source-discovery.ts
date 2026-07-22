/**
 * MIYAR — Source Discovery Engine
 *
 * Uses Gemini AI to discover new UAE market data sources by analyzing
 * existing sources and searching for complementary ones.
 * 
 * Generates candidate source_registry entries for admin review.
 */

import { invokeLLM } from "../../_core/llm";

// ─── Types ───────────────────────────────────────────────────────

export interface DiscoveredSource {
    name: string;
    url: string;
    category: "material_supplier" | "developer" | "market_research" | "government" | "design_trend" | "auction_platform";
    dataTypes: string[];
    estimatedReliability: "A" | "B" | "C";
    rationale: string;
    suggestedFrequency: "daily" | "weekly" | "biweekly" | "monthly";
}

export interface DiscoveryResult {
    discoveredSources: DiscoveredSource[];
    searchQueries: string[];
    analysisNotes: string;
}

// ─── Discovery Prompt Templates ──────────────────────────────────

const DISCOVERY_PROMPT = `You are MIYAR's Market Intelligence Source Discovery Engine for the UAE luxury real estate and interior design market.

Your task: Analyze the existing source registry and suggest NEW, complementary data sources that would fill coverage gaps.

**Existing Sources:**
{existingSources}

**Categories needing more coverage:**
{coverageGaps}

**Discover sources that provide:**
1. Material pricing data (tiles, marble, sanitary ware, lighting, joinery, hardware, kitchen)
2. UAE developer project portfolios with interior design specifications
3. Design trend signals (international and UAE-specific)
4. Construction cost benchmarks (fitout rates, MEP rates)
5. Government data (DLD transactions, building permits, regulations)
6. Supplier catalogs with AED pricing

**Rules:**
- Only suggest UAE-specific or UAE-relevant sources
- Prefer sources with machine-readable content (structured pages, not just PDFs)
- Include the full URL to the most data-rich page
- Justify why each source adds value vs existing coverage
- Suggest at least 5 and at most 15 sources

Return as JSON array:
[{
  "name": "Source Name",
  "url": "https://...",
  "category": "material_supplier" | "developer" | "market_research" | "government" | "design_trend" | "auction_platform",
  "dataTypes": ["material_prices", "project_specs", "market_trends"],
  "estimatedReliability": "A" | "B" | "C",
  "rationale": "Why this source is valuable",
  "suggestedFrequency": "weekly" | "biweekly" | "monthly"
}]`;

// ─── Helper: Call LLM with simple prompt ────────────────────────

async function askLLM(prompt: string): Promise<string> {
    const result = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
    });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : JSON.stringify(content);
}

// ─── Main Discovery Function ────────────────────────────────────

export async function discoverNewSources(options: {
    existingSources: Array<{ name: string; url: string; category: string }>;
    coverageGaps: string[];
}): Promise<DiscoveryResult> {
    const existingList = options.existingSources
        .map((s) => `- ${s.name} (${s.category}): ${s.url}`)
        .join("\n");

    const gapsList = options.coverageGaps.length > 0
        ? options.coverageGaps.join(", ")
        : "General expansion needed across all categories";

    const prompt = DISCOVERY_PROMPT
        .replace("{existingSources}", existingList)
        .replace("{coverageGaps}", gapsList);

    try {
        const response = await askLLM(prompt);

        // Parse the AI response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return {
                discoveredSources: [],
                searchQueries: [],
                analysisNotes: "AI response did not contain valid JSON array.",
            };
        }

        const parsed = JSON.parse(jsonMatch[0]) as DiscoveredSource[];

        // Validate and deduplicate against existing sources
        const existingUrls = new Set(options.existingSources.map((s) => s.url.toLowerCase().replace(/\/$/, "")));
        const validSources = parsed.filter((s) => {
            const normalizedUrl = s.url?.toLowerCase().replace(/\/$/, "");
            return normalizedUrl && !existingUrls.has(normalizedUrl) && s.name && s.category;
        });

        return {
            discoveredSources: validSources,
            searchQueries: [
                "UAE luxury interior design material suppliers 2025",
                "Dubai developer project brochure fitout specifications",
                "UAE construction cost benchmark AED per sqm",
                "Dubai design trends luxury residential 2025",
                "MENA building materials wholesale pricing",
            ],
            analysisNotes: `Discovered ${validSources.length} unique new sources from ${parsed.length} candidates.`,
        };
    } catch (err) {
        return {
            discoveredSources: [],
            searchQueries: [],
            analysisNotes: `Discovery failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}

// ─── Known High-Value UAE Sources Not Yet In Registry ────────────
// These are pre-vetted and can be added directly via admin UI or seed script.
// EV-00 (2026-07-23): entries duplicating now-registered sources were pruned;
// this list holds only genuinely missing suggestions.

export const KNOWN_MISSING_SOURCES: DiscoveredSource[] = [
    {
        name: "Al Murad UAE",
        url: "https://www.almurad.com/",
        category: "material_supplier",
        dataTypes: ["tiles", "stone", "sanitary", "bathroom_fittings"],
        estimatedReliability: "B",
        rationale: "Largest UAE-based tile & stone retailer, multiple branches, competitive pricing benchmark",
        suggestedFrequency: "biweekly",
    },
    {
        name: "MERAAS / Dubai Holding",
        url: "https://www.meraas.com/en",
        category: "developer",
        dataTypes: ["luxury_projects", "interior_design_specs", "brand_partnerships"],
        estimatedReliability: "A",
        rationale: "Dubai Holding subsidiary behind City Walk, Bluewaters — ultra-luxury segment data",
        suggestedFrequency: "biweekly",
    },
    {
        name: "Hansgrohe Middle East",
        url: "https://www.hansgrohe.ae/",
        category: "material_supplier",
        dataTypes: ["sanitary_pricing", "bathroom_fittings", "luxury_taps"],
        estimatedReliability: "B",
        rationale: "Premium bathroom fittings brand, structured product catalog with UAE pricing",
        suggestedFrequency: "monthly",
    },
    {
        name: "Artemide Middle East",
        url: "https://www.artemide.com/en-ae",
        category: "material_supplier",
        dataTypes: ["lighting_fixtures", "designer_lighting", "architectural_lighting"],
        estimatedReliability: "B",
        rationale: "Italian luxury lighting brand with UAE presence, prices designer lighting fixtures",
        suggestedFrequency: "monthly",
    },
    {
        name: "Bulthaup UAE",
        url: "https://www.bulthaup.com/en-ae/",
        category: "material_supplier",
        dataTypes: ["kitchen_systems", "luxury_kitchens", "countertops"],
        estimatedReliability: "B",
        rationale: "Ultra-luxury German kitchen brand, relevant price data for top-tier fitout benchmarks",
        suggestedFrequency: "monthly",
    },
];
