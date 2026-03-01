import { getDb } from "../../db";
import { materialsCatalog, projects } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

interface MatchOptions {
    projectId: number;
    maxItems?: number;
    category?: string;
    tier?: string;
}

/**
 * Vendor Matching Engine (Phase 8)
 * Strict filtering of catalog materials based on project brand standard constraints.
 */
export async function matchVendorsForProject(options: MatchOptions) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 1. Fetch Project to get brand constraints
    const projectRows = await db.select().from(projects).where(eq(projects.id, options.projectId)).limit(1);
    if (projectRows.length === 0) throw new Error(`Project ${options.projectId} not found`);

    const project = projectRows[0];
    const constraints = project.brandStandardConstraints || "none";

    // 2. Map constraint to allowed approval statuses
    let allowedStatuses: string[] = ["open_market", "approved_vendor", "preferred_brand"];

    if (constraints === "strict_vendor_list") {
        allowedStatuses = ["preferred_brand"]; // Only exact brand matches
    } else if (constraints === "moderate_guidelines") {
        allowedStatuses = ["approved_vendor", "preferred_brand"]; // Quality & Brands
    } else if (constraints === "open_market" || constraints === "none") {
        allowedStatuses = ["open_market", "approved_vendor", "preferred_brand"]; // Anything
    }

    // 3. Fetch full catalog (with optional category/tier filters before fetching)
    // For simplicity and speed in V8, we fetch all and filter in memory, but this could be SQLized.
    const allMaterials = await db.select().from(materialsCatalog).where(eq(materialsCatalog.isActive, true));

    // 4. Apply Brand Matching Logic
    let matchedMaterials = allMaterials.filter((m: any) =>
        allowedStatuses.includes(m.brandStandardApproval || "open_market")
    );

    // 5. Apply Optional Filters
    if (options.category) {
        matchedMaterials = matchedMaterials.filter((m: any) => m.category === options.category);
    }

    // If no tier is requested, but the project has one, default to it
    const targetTier = options.tier || project.mkt01Tier || "upper_mid";

    const tierMap: Record<string, string[]> = {
        "Economy": ["economy"],
        "Mid": ["economy", "mid"],
        "Upper-mid": ["mid", "premium"],
        "Luxury": ["premium", "luxury"],
        "Ultra-luxury": ["luxury", "ultra_luxury"],
        // Handle camel/snake case variants
        "economy": ["economy"],
        "mid": ["economy", "mid"],
        "upper_mid": ["mid", "premium"],
        "luxury": ["premium", "luxury"],
        "ultra_luxury": ["luxury", "ultra_luxury"],
    };

    const allowedTiers = tierMap[targetTier] || ["mid", "premium"];
    matchedMaterials = matchedMaterials.filter((m: any) => allowedTiers.includes(m.tier));

    // 6. Sort by highest standard first, then lowest carbon
    matchedMaterials.sort((a: any, b: any) => {
        // Sort logic:
        // preferred_brand (3) > approved_vendor (2) > open_market (1)
        const scoreMap: Record<string, number> = {
            "preferred_brand": 3,
            "approved_vendor": 2,
            "open_market": 1
        };

        const aScore = scoreMap[a.brandStandardApproval || "open_market"] || 1;
        const bScore = scoreMap[b.brandStandardApproval || "open_market"] || 1;

        if (aScore !== bScore) {
            return bScore - aScore; // Descending
        }

        // Tie breaker: lowest embodied carbon wins
        const aCarbon = parseFloat(String(a.embodiedCarbon || "999"));
        const bCarbon = parseFloat(String(b.embodiedCarbon || "999"));
        return aCarbon - bCarbon;
    });

    return matchedMaterials.slice(0, options.maxItems || 20);
}
