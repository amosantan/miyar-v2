/**
 * AI Design Advisor Engine
 * Uses Gemini to generate intelligent per-space design recommendations
 * with kitchen/bathroom specialization and material matching.
 */

import { invokeLLM } from "../../_core/llm";
import { buildSpaceProgram, type Room } from "./space-program";
import type {
    SpaceRecommendation,
    MaterialRec,
    GeminiDesignResponse,
    KitchenSpec,
    BathroomSpec,
    AIDesignBrief,
    SpaceBriefEntry,
} from "./design-types";
import type { ProjectInputs } from "../../../shared/miyar-types";

// ─── Constants ──────────────────────────────────────────────────────────────

const KITCHEN_ROOMS = ["KIT"];
const BATHROOM_ROOMS = ["MEN", "BTH", "ENS"];
const WET_ROOM_IDS = [...KITCHEN_ROOMS, ...BATHROOM_ROOMS, "UTL"];

const TIER_PRICE_MULTIPLIERS: Record<string, number> = {
    "Entry": 0.5,
    "Mid": 0.7,
    "Upper-mid": 1.0,
    "Luxury": 1.6,
    "Ultra-luxury": 2.8,
};

// ─── Main: Generate All Space Recommendations ──────────────────────────────

export async function generateDesignRecommendations(
    project: any,
    inputs: ProjectInputs,
    materialLibrary: any[],
    recentEvidence: any[] = [],
    designTrends: any[] = [],
): Promise<SpaceRecommendation[]> {
    const spaceProgram = buildSpaceProgram(project);
    const rooms = spaceProgram.rooms;
    const totalBudget = spaceProgram.totalFitoutBudgetAed;

    // Build context for Gemini
    const materialSummary = buildMaterialSummary(materialLibrary, inputs);
    const marketIntelSummary = buildMarketIntelSummary(recentEvidence, inputs);
    // Phase 4: Inject trend signals
    const trendContext = buildTrendContext(designTrends, inputs);
    const prompt = buildDesignPrompt(project, inputs, rooms, totalBudget, materialSummary, marketIntelSummary, trendContext);

    // Call Gemini
    const aiResponse = await callGeminiForDesign(prompt);

    // Map AI response to SpaceRecommendation[]
    const recommendations = mapAIResponseToRecommendations(
        aiResponse,
        rooms,
        totalBudget,
        materialLibrary,
        inputs
    );

    return recommendations;
}

// ─── Gemini Prompt Builder ──────────────────────────────────────────────────

function buildDesignPrompt(
    project: any,
    inputs: ProjectInputs,
    rooms: Room[],
    totalBudget: number,
    materialSummary: string,
    marketIntelSummary: string,
    trendContext: string = "",
): string {
    const roomList = rooms
        .map(r => `- ${r.id} "${r.name}": ${r.sqm} sqm, Grade ${r.finishGrade}, Priority ${r.priority}, Budget ${(r.budgetPct * 100).toFixed(0)}%`)
        .join("\n");

    return `You are an expert UAE interior design consultant. Generate detailed per-space design recommendations for this project.

## Project Context
- **Name**: ${project.name || "Untitled Project"}
- **Typology**: ${inputs.ctx01Typology}
- **Scale**: ${inputs.ctx02Scale}
- **GFA**: ${inputs.ctx03Gfa} sqm
- **Location**: ${inputs.ctx04Location}
- **Market Tier**: ${inputs.mkt01Tier}
- **Design Style**: ${inputs.des01Style}
- **Material Level**: ${inputs.des02MaterialLevel}/5
- **Complexity**: ${inputs.des03Complexity}/5
- **Total Fitout Budget**: ${totalBudget.toLocaleString()} AED

## Spaces to Design
${roomList}

## Available Materials (from our library)
${materialSummary}

## Latest Market Intelligence (from recent data)
${marketIntelSummary}
${trendContext ? `
## UAE Design Trends (current market signals — bias your recommendations toward these)
${trendContext}` : ""}
## Instructions
For EACH space, provide:
1. **styleDirection** — A specific design direction (e.g., "Warm minimalism with brass accents and limestone textures")
2. **colorScheme** — Specific colors (e.g., "Warm sand #D4C5A9, Charcoal #3A3A3A, Brass #B8860B")
3. **materials** — For each element (floor, wall_primary, wall_feature, ceiling, joinery, hardware), recommend a specific product with brand and price range
4. **budgetBreakdown** — % allocation per element within the room
5. **rationale** — Why this style fits the project context
6. **specialNotes** — Tips for the interior designer

For KITCHEN spaces (${KITCHEN_ROOMS.join(", ")}), also provide kitchenSpec with:
- layoutType, cabinetStyle, cabinetFinish, countertopMaterial, backsplash, sinkType
- applianceLevel ("standard"/"premium"/"professional"), applianceBrands, storageFeatures

For BATHROOM spaces (${BATHROOM_ROOMS.join(", ")}), also provide bathroomSpec with:
- showerType, vanityStyle, vanityWidth, tilePattern, wallTile, floorTile
- fixtureFinish, fixtureBrand, mirrorType, luxuryFeatures

Match materials to the "${inputs.mkt01Tier}" market tier. Use UAE-available brands and realistic AED pricing.

Respond in JSON format matching GeminiDesignResponse schema:
{
  "spaces": [...],
  "overallDesignNarrative": "...",
  "designPhilosophy": "..."
}`;
}

function buildMaterialSummary(materials: any[], inputs: ProjectInputs): string {
    if (!materials || materials.length === 0) {
        return "No materials in library — recommend based on market knowledge.";
    }

    // Group by category, show top items per tier
    const grouped: Record<string, any[]> = {};
    for (const m of materials.filter(m => m.isActive)) {
        const key = m.category;
        if (!grouped[key]) grouped[key] = [];
        if (grouped[key].length < 3) {
            grouped[key].push(m);
        }
    }

    return Object.entries(grouped)
        .map(([cat, items]) => {
            const list = items.map(m =>
                `  • ${m.productName} (${m.brand}) — ${m.tier} — ${m.priceAedMin || "?"}–${m.priceAedMax || "?"} AED/${m.unitLabel}`
            ).join("\n");
            return `**${cat}**:\n${list}`;
        })
        .join("\n");
}

function buildMarketIntelSummary(recentEvidence: any[], inputs: ProjectInputs): string {
    if (!recentEvidence || recentEvidence.length === 0) {
        return "No recent market intelligence available.";
    }

    // Filter evidence somewhat relevant to project's tier/style
    const relevant = recentEvidence.filter(e => {
        if (!e.finishLevel && !e.designStyle) return true;
        const matchesTier = e.finishLevel?.toLowerCase() === inputs.mkt01Tier.toLowerCase();
        const matchesStyle = e.designStyle?.toLowerCase().includes(inputs.des01Style.toLowerCase());
        return matchesTier || matchesStyle;
    }).slice(0, 20); // Top 20 relevant insights

    if (relevant.length === 0) {
        return "Market intelligence exists, but no specific matches for this tier/style currently dominating.";
    }

    return relevant.map(e => {
        let line = `- **${e.itemName}**`;
        if (e.designStyle) line += ` (${e.designStyle})`;
        if (e.finishLevel) line += ` [${e.finishLevel} finish]`;
        if (e.brandsMentioned && e.brandsMentioned.length > 0) line += ` — brands: ${e.brandsMentioned.join(", ")}`;
        if (e.priceMin || e.priceMax) line += ` — Price: ${e.priceMin || "?"}-${e.priceMax || "?"} ${e.unit || "AED"}`;
        return line;
    }).join("\n");
}

/**
 * Phase 4: Build a concise trend context block to inject into the Gemini prompt.
 * Prioritises established > emerging trends, groups by category.
 */
function buildTrendContext(trends: any[], inputs: ProjectInputs): string {
    if (!trends || trends.length === 0) return "";
    // Filter to match project style if available, else use all
    const filtered = trends.filter(t =>
        !t.styleClassification ||
        t.styleClassification.toLowerCase() === inputs.des01Style.toLowerCase()
    );
    const top = (filtered.length > 0 ? filtered : trends)
        .sort((a, b) => {
            const order: Record<string, number> = { established: 0, emerging: 1, declining: 2 };
            return (order[a.confidenceLevel] ?? 1) - (order[b.confidenceLevel] ?? 1);
        })
        .slice(0, 12);
    if (top.length === 0) return "";
    // Group by category
    const grouped: Record<string, typeof top> = {};
    for (const t of top) {
        const cat = t.trendCategory ?? "other";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(t);
    }
    return Object.entries(grouped).map(([cat, items]) => {
        const lines = items.map(t => {
            let s = `  - **${t.trendName}** [${t.confidenceLevel}]`;
            if (t.description) s += `: ${t.description.substring(0, 100)}`;
            if (t.relatedMaterials && Array.isArray(t.relatedMaterials) && t.relatedMaterials.length > 0)
                s += ` (materials: ${(t.relatedMaterials as string[]).slice(0, 4).join(", ")})`;
            return s;
        }).join("\n");
        return `**${cat.toUpperCase()}**:\n${lines}`;
    }).join("\n");
}

// ─── Gemini API Call ────────────────────────────────────────────────────────

async function callGeminiForDesign(prompt: string): Promise<GeminiDesignResponse> {
    const result = await invokeLLM({
        messages: [
            {
                role: "system",
                content: "You are an expert interior design AI specializing in UAE luxury and mid-market projects. Always respond with valid JSON.",
            },
            { role: "user", content: prompt },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 8000,
    });

    const text = typeof result.choices[0]?.message?.content === "string"
        ? result.choices[0].message.content
        : "";

    try {
        return JSON.parse(text) as GeminiDesignResponse;
    } catch {
        console.error("[DesignAdvisor] Failed to parse Gemini response:", text.substring(0, 500));
        throw new Error("AI design recommendation generation failed — invalid response format");
    }
}

// ─── Response Mapper ────────────────────────────────────────────────────────

function mapAIResponseToRecommendations(
    aiResponse: GeminiDesignResponse,
    rooms: Room[],
    totalBudget: number,
    materialLibrary: any[],
    inputs: ProjectInputs
): SpaceRecommendation[] {
    return rooms.map(room => {
        const aiSpace = aiResponse.spaces.find(s => s.roomId === room.id);
        const roomBudget = totalBudget * room.budgetPct;

        if (!aiSpace) {
            // Fallback if AI didn't cover this room
            return buildFallbackRecommendation(room, roomBudget, inputs);
        }

        // Match AI material suggestions to library
        const materialPackage: MaterialRec[] = (aiSpace.materials || []).map(m => {
            const libraryMatch = findBestMaterialMatch(materialLibrary, m.element, m.brand, m.productName);
            return {
                materialLibraryId: libraryMatch?.id ?? null,
                productName: libraryMatch?.productName || m.productName,
                brand: libraryMatch?.brand || m.brand,
                category: libraryMatch?.category || m.element,
                element: m.element,
                priceRangeAed: libraryMatch
                    ? `${libraryMatch.priceAedMin}–${libraryMatch.priceAedMax} AED/${libraryMatch.unitLabel}`
                    : m.priceRange,
                aiRationale: m.rationale,
            };
        });

        // Budget breakdown
        const budgetBreakdown = (aiSpace.budgetBreakdown || []).map(b => ({
            element: b.element,
            amount: Math.round(roomBudget * (b.percentage / 100)),
            percentage: b.percentage,
        }));

        // Kitchen/bathroom specialization
        let kitchenSpec: KitchenSpec | undefined;
        let bathroomSpec: BathroomSpec | undefined;

        if (KITCHEN_ROOMS.includes(room.id) && aiSpace.kitchenSpec) {
            const tierMult = TIER_PRICE_MULTIPLIERS[inputs.mkt01Tier] || 1.0;
            kitchenSpec = {
                ...aiSpace.kitchenSpec,
                estimatedCostAed: Math.round(roomBudget * 0.6 * tierMult),
            };
        }

        if (BATHROOM_ROOMS.includes(room.id) && aiSpace.bathroomSpec) {
            const tierMult = TIER_PRICE_MULTIPLIERS[inputs.mkt01Tier] || 1.0;
            bathroomSpec = {
                ...aiSpace.bathroomSpec,
                estimatedCostAed: Math.round(roomBudget * 0.55 * tierMult),
            };
        }

        return {
            roomId: room.id,
            roomName: room.name,
            sqm: room.sqm,
            styleDirection: aiSpace.styleDirection,
            colorScheme: aiSpace.colorScheme,
            materialPackage,
            budgetAllocation: Math.round(roomBudget),
            budgetBreakdown,
            aiRationale: aiSpace.rationale,
            specialNotes: aiSpace.specialNotes || [],
            alternatives: [],
            kitchenSpec,
            bathroomSpec,
        };
    });
}

// ─── Material Matching ──────────────────────────────────────────────────────

function findBestMaterialMatch(
    library: any[],
    element: string,
    brand: string,
    productName: string
): any | null {
    if (!library || library.length === 0) return null;

    const categoryMap: Record<string, string> = {
        floor: "flooring",
        wall_primary: "wall_paint",
        wall_feature: "wall_tile",
        wall_wet: "wall_tile",
        ceiling: "ceiling",
        joinery: "joinery",
        hardware: "hardware",
    };

    const category = categoryMap[element] || element;

    // Try exact brand + product match
    let match = library.find(
        m => m.category === category &&
            m.brand.toLowerCase() === brand.toLowerCase() &&
            m.isActive
    );

    // Fallback: same category, any brand
    if (!match) {
        match = library.find(m => m.category === category && m.isActive);
    }

    return match || null;
}

// ─── Fallback (when AI doesn't cover a room) ───────────────────────────────

function buildFallbackRecommendation(
    room: Room,
    roomBudget: number,
    inputs: ProjectInputs
): SpaceRecommendation {
    return {
        roomId: room.id,
        roomName: room.name,
        sqm: room.sqm,
        styleDirection: `${inputs.des01Style} — standard finish`,
        colorScheme: "Neutral palette",
        materialPackage: [],
        budgetAllocation: Math.round(roomBudget),
        budgetBreakdown: [
            { element: "floor", amount: Math.round(roomBudget * 0.30), percentage: 30 },
            { element: "wall_primary", amount: Math.round(roomBudget * 0.20), percentage: 20 },
            { element: "ceiling", amount: Math.round(roomBudget * 0.10), percentage: 10 },
            { element: "joinery", amount: Math.round(roomBudget * 0.25), percentage: 25 },
            { element: "hardware", amount: Math.round(roomBudget * 0.15), percentage: 15 },
        ],
        aiRationale: "Fallback recommendation — AI did not generate specific guidance for this space.",
        specialNotes: [],
        alternatives: [],
    };
}

// ─── AI Design Brief Generator ──────────────────────────────────────────────

export async function generateAIDesignBrief(
    project: any,
    inputs: ProjectInputs,
    recommendations: SpaceRecommendation[]
): Promise<AIDesignBrief> {
    const spaceSummary = recommendations
        .map(r => `- **${r.roomName}** (${r.sqm}sqm): ${r.styleDirection}. Budget: ${r.budgetAllocation.toLocaleString()} AED. Key materials: ${r.materialPackage.map(m => m.productName).join(", ") || "TBD"}`)
        .join("\n");

    const prompt = `Generate a professional interior design brief for this project. This brief will be handed to an interior designer.

## Project
- Name: ${project.name}
- Typology: ${inputs.ctx01Typology}
- Location: ${inputs.ctx04Location}
- Market Tier: ${inputs.mkt01Tier}
- Style: ${inputs.des01Style}
- GFA: ${inputs.ctx03Gfa} sqm

## Space Recommendations (Already Generated)
${spaceSummary}

## Instructions
Write a professional, actionable design brief with:
1. **executiveSummary** — 3-4 sentences positioning the project
2. **designDirection** — overall style, color strategy, material philosophy, lighting approach, key differentiators
3. **spaceBySpaceGuide** — for each space: designIntent (2-3 sentences), keyMaterials, moodKeywords, doList (3 items), dontList (2 items)
4. **deliverables** — what the designer should produce
5. **qualityGates** — acceptance criteria
6. **notes** — important considerations

Write in professional consultancy tone. Be specific — use actual material names, colors, and dimensions.

Respond in JSON format.`;

    const result = await invokeLLM({
        messages: [
            {
                role: "system",
                content: "You are a senior interior design consultant preparing a professional design brief. Respond with valid JSON.",
            },
            { role: "user", content: prompt },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 6000,
    });

    const text = typeof result.choices[0]?.message?.content === "string"
        ? result.choices[0].message.content
        : "";

    let parsed: any;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("AI design brief generation failed — invalid response");
    }

    // Build the full brief
    const totalBudget = recommendations.reduce((sum, r) => sum + r.budgetAllocation, 0);

    return {
        projectName: project.name,
        preparedFor: project.clientName || project.name,
        generatedAt: new Date().toISOString(),
        version: "1.0",

        executiveSummary: parsed.executiveSummary || "",
        designDirection: {
            overallStyle: parsed.designDirection?.overallStyle || inputs.des01Style,
            colorStrategy: parsed.designDirection?.colorStrategy || "",
            materialPhilosophy: parsed.designDirection?.materialPhilosophy || "",
            lightingApproach: parsed.designDirection?.lightingApproach || "",
            keyDifferentiators: parsed.designDirection?.keyDifferentiators || [],
        },

        spaceBySpaceGuide: (parsed.spaceBySpaceGuide || []).map((s: any) => ({
            roomId: s.roomId || "",
            roomName: s.roomName || "",
            designIntent: s.designIntent || "",
            keyMaterials: s.keyMaterials || [],
            moodKeywords: s.moodKeywords || [],
            doList: s.doList || [],
            dontList: s.dontList || [],
        })) as SpaceBriefEntry[],

        budgetSummary: {
            totalFitoutBudget: totalBudget,
            costPerSqm: Math.round(totalBudget / (Number(inputs.ctx03Gfa) || 1)),
            allocationBySpace: recommendations.map(r => ({
                room: r.roomName,
                amount: r.budgetAllocation,
                pct: Math.round((r.budgetAllocation / totalBudget) * 100),
            })),
            contingency: Math.round(totalBudget * 0.10),
        },

        materialSpecifications: {
            primary: recommendations.flatMap(r =>
                r.materialPackage.filter(m => ["floor", "wall_primary"].includes(m.element))
            ),
            secondary: recommendations.flatMap(r =>
                r.materialPackage.filter(m => ["ceiling", "joinery"].includes(m.element))
            ),
            accent: recommendations.flatMap(r =>
                r.materialPackage.filter(m => ["wall_feature", "hardware"].includes(m.element))
            ),
        },

        supplierDirectory: extractSuppliers(recommendations),
        deliverables: parsed.deliverables || [
            "Concept design package with mood boards",
            "Material specification sheets",
            "Furniture layout drawings",
            "Lighting plan",
            "3D visualizations (key spaces)",
        ],
        qualityGates: parsed.qualityGates || [
            "Client sign-off on concept direction",
            "Material sample approval",
            "Budget alignment confirmation",
        ],
        notes: parsed.notes || [],
    };
}

function extractSuppliers(recs: SpaceRecommendation[]): { name: string; categories: string[] }[] {
    const supplierMap: Record<string, Set<string>> = {};
    for (const r of recs) {
        for (const m of r.materialPackage) {
            if (m.brand) {
                if (!supplierMap[m.brand]) supplierMap[m.brand] = new Set();
                supplierMap[m.brand].add(m.category);
            }
        }
    }
    return Object.entries(supplierMap).map(([name, cats]) => ({
        name,
        categories: Array.from(cats),
    }));
}
