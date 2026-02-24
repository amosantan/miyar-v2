import { Project } from "../../db";

export type DesignVocabulary = {
    styleFamily: string;
    materialTier: "affordable" | "mid" | "premium" | "ultra";
    paletteKey: string;
    complexityLabel: string;
    finishTone: string;
    joinery: string;
    hardwareFinish: string;
    floorPrimary: string;
    floorWet: string;
    ceilingType: string;
    lightingMood: string;
    sustainNote: string;
};

export function buildDesignVocabulary(project: any): DesignVocabulary {
    const cap = Number(project.fin01BudgetCap || 0);
    const styleRaw = (project.des01Style || "modern").toLowerCase();

    // Normalize style
    let style = styleRaw;
    if (!["modern", "minimalist", "arabesque", "classic", "contemporary"].includes(style)) {
        style = "modern";
    }

    const des03_n = Number(project.des03Complexity || 0);
    const des04_n = Number(project.des04Experience || 0);
    const des05_n = Number(project.des05Sustainability || 0);
    const mkt01Tier = (project.mkt01Tier || "mid").toLowerCase();

    // 1. Material Tier
    let materialTier: "affordable" | "mid" | "premium" | "ultra" = "mid";
    if (cap < 200) materialTier = "affordable";
    else if (cap < 300) materialTier = "mid";
    else if (cap < 450) materialTier = "premium";
    else materialTier = "ultra";

    // Deterministically set finishTone
    const finishTone = des04_n >= 0.5 ? "warm" : "cool";

    // 2. Palette Key
    let paletteKey = "warm_minimalism";
    if (["modern", "minimalist"].includes(style)) {
        if (finishTone === "warm") {
            paletteKey = "warm_minimalism";
        } else {
            paletteKey = "cool_minimalism";
        }
    } else if (["arabesque", "classic"].includes(style)) {
        if (style === "classic" && ["premium", "ultra"].includes(materialTier)) {
            paletteKey = "classic_marble";
        } else {
            paletteKey = "arabesque_warmth";
        }
    } else {
        paletteKey = "warm_minimalism"; // default fallback for contemporary
    }

    // 3. Hardware Finish
    let hardwareFinish = "Brushed Chrome";
    if (["modern", "minimalist"].includes(style)) hardwareFinish = "Brushed Chrome";
    else if (style === "arabesque") hardwareFinish = "Polished Brass";
    else if (style === "classic") hardwareFinish = "Polished Chrome";
    else if (style === "contemporary") hardwareFinish = "Matte Black";

    // 4. Ceiling Type
    let ceilingType = "Standard Gypsum";
    if (des03_n > 0.7) {
        ceilingType = "Feature Coffered Ceiling";
    } else if (des03_n >= 0.4) {
        ceilingType = "Gypsum with Cove Lighting Detail";
    }

    // 5. Lighting Mood
    let lightingMood = "Warm White 2700K";
    if (["ultra", "premium"].includes(mkt01Tier)) {
        // Exact mapping from logic dictates ultra/premium checks
    } // We will do it in order:

    if (["ultra", "premium"].includes(mkt01Tier)) {
        lightingMood = "Layered Lighting 2700–4000K";
    } else if (style === "arabesque") {
        lightingMood = "Warm Accent 2700K";
    } else {
        lightingMood = "Warm White 2700K";
    }

    // Other deterministics based on mapping
    const styleFamily = `${mkt01Tier.charAt(0).toUpperCase() + mkt01Tier.slice(1)} ${style.charAt(0).toUpperCase() + style.slice(1)}`;

    let complexityLabel = "Standard";
    if (des03_n < 0.3) complexityLabel = "Simplified";
    else if (des03_n > 0.7) complexityLabel = "Bespoke";
    else complexityLabel = "Rich";

    let joinery = "Standard MDF / Laminate";
    if (materialTier === "ultra" || materialTier === "premium") joinery = "Custom Wood Veneer & PU Paint";

    let floorPrimary = "Porcelain Tile / SPC Vinyl";
    if (materialTier === "ultra") floorPrimary = "Natural Stone / Marble";
    else if (materialTier === "premium") floorPrimary = "Engineered Hardwood";

    let floorWet = "Anti-slip Ceramic";
    if (materialTier === "ultra" || materialTier === "premium") floorWet = "Textured Porcelain / Marble";

    let sustainNote = "Standard building compliance.";
    if (des05_n > 0.6) {
        sustainNote = "Focus on sustainable materials, LEED/Al Sa'fat alignment.";
    }

    return {
        styleFamily,
        materialTier,
        paletteKey,
        complexityLabel,
        finishTone: finishTone === "warm" ? "Warm Neutrals" : "Cool Greys",
        joinery,
        hardwareFinish,
        floorPrimary,
        floorWet,
        ceilingType,
        lightingMood,
        sustainNote
    };
}
