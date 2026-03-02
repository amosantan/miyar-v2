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

export const KNOWN_MISSING_SOURCES: DiscoveredSource[] = [
    {
        name: "Porcelanosa UAE",
        url: "https://www.porcelanosa.com/ae/",
        category: "material_supplier",
        dataTypes: ["tiles", "sanitary", "kitchens", "countertops"],
        estimatedReliability: "B",
        rationale: "Major European tile/bath brand with UAE showrooms, structured product catalog with pricing tiers",
        suggestedFrequency: "monthly",
    },
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
        name: "DERA (Dubai Economic & Regulatory Authority)",
        url: "https://www.dubaipulse.gov.ae/",
        category: "government",
        dataTypes: ["building_permits", "construction_statistics", "economic_indicators"],
        estimatedReliability: "A",
        rationale: "Dubai government open data portal with construction activity indicators",
        suggestedFrequency: "monthly",
    },
    {
        name: "Dezeen Middle East",
        url: "https://www.dezeen.com/tag/united-arab-emirates/",
        category: "design_trend",
        dataTypes: ["design_trends", "project_showcases", "material_innovations"],
        estimatedReliability: "B",
        rationale: "Leading global design publication with dedicated UAE/ME content section",
        suggestedFrequency: "weekly",
    },
    {
        name: "Commercial Interior Design (CID) ME",
        url: "https://www.commercialinteriordesign.com/",
        category: "design_trend",
        dataTypes: ["design_trends", "project_briefs", "supplier_news", "awards"],
        estimatedReliability: "B",
        rationale: "Middle East's premier interiors magazine, covers luxury hospitality & residential projects",
        suggestedFrequency: "weekly",
    },
    {
        name: "Aldar Properties",
        url: "https://www.aldar.com/en/explore-aldar/businesses/aldar-development",
        category: "developer",
        dataTypes: ["project_portfolios", "interior_specifications", "pricing_ranges"],
        estimatedReliability: "A",
        rationale: "Abu Dhabi's largest developer, complements Dubai-focused Emaar/DAMAC/Nakheel data",
        suggestedFrequency: "biweekly",
    },
    {
        name: "Nakheel Projects",
        url: "https://www.nakheel.com/en/communities",
        category: "developer",
        dataTypes: ["project_portfolios", "community_specs", "pricing_ranges"],
        estimatedReliability: "A",
        rationale: "Major Dubai developer (Palm Jumeirah, Dragon City), interior design specs in brochures",
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
    {
        name: "ArchDaily Middle East",
        url: "https://www.archdaily.com/tag/united-arab-emirates",
        category: "design_trend",
        dataTypes: ["architectural_trends", "project_specs", "material_innovations"],
        estimatedReliability: "B",
        rationale: "World's most-visited architecture portal, UAE project archives with material specs",
        suggestedFrequency: "weekly",
    },
];
