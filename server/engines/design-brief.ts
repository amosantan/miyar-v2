/**
 * Design Brief Generator Engine (V2.8)
 * Deterministic design brief generation from project data + evaluation results.
 * Produces 7-section structured brief with versioning.
 */

import type { ProjectInputs } from "../../shared/miyar-types";

export interface DesignBriefData {
  projectIdentity: {
    projectName: string;
    typology: string;
    scale: string;
    gfa: number | null;
    location: string;
    horizon: string;
    marketTier: string;
    style: string;
  };
  positioningStatement: string;
  styleMood: {
    primaryStyle: string;
    moodKeywords: string[];
    colorPalette: string[];
    textureDirection: string;
    lightingApproach: string;
    spatialPhilosophy: string;
  };
  materialGuidance: {
    tierRecommendation: string;
    primaryMaterials: string[];
    accentMaterials: string[];
    avoidMaterials: string[];
    sustainabilityNotes: string;
    qualityBenchmark: string;
  };
  budgetGuardrails: {
    costPerSqftTarget: string;
    costBand: string;
    flexibilityLevel: string;
    contingencyRecommendation: string;
    valueEngineeringNotes: string[];
  };
  procurementConstraints: {
    leadTimeWindow: string;
    criticalPathItems: string[];
    localSourcingPriority: string;
    importDependencies: string[];
    riskMitigations: string[];
  };
  deliverablesChecklist: {
    phase1: string[];
    phase2: string[];
    phase3: string[];
    qualityGates: string[];
  };
}

const STYLE_MOOD_MAP: Record<string, { keywords: string[]; colors: string[]; texture: string; lighting: string; spatial: string }> = {
  Modern: {
    keywords: ["clean lines", "open plan", "minimalist", "functional elegance", "geometric"],
    colors: ["warm white", "charcoal", "natural oak", "matte black", "soft grey"],
    texture: "Smooth surfaces with selective tactile contrast — polished concrete, matte lacquer, brushed metal",
    lighting: "Layered ambient + task lighting with concealed LED strips and statement pendants",
    spatial: "Open-plan living with defined zones through material transitions rather than walls",
  },
  Contemporary: {
    keywords: ["curated luxury", "refined", "timeless", "sophisticated", "bespoke"],
    colors: ["ivory", "champagne gold", "deep navy", "warm taupe", "bronze"],
    texture: "Rich layering — marble, silk, velvet, hand-finished metals, natural stone",
    lighting: "Dramatic accent lighting with warm ambient base, sculptural fixtures as focal points",
    spatial: "Generous proportions with intimate conversation areas, seamless indoor-outdoor flow",
  },
  Minimal: {
    keywords: ["essential", "serene", "restrained", "zen", "purposeful"],
    colors: ["pure white", "pale grey", "natural linen", "warm concrete", "muted sage"],
    texture: "Monolithic surfaces — seamless plaster, raw timber, natural stone with minimal joints",
    lighting: "Diffused natural light maximized, architectural lighting integrated into surfaces",
    spatial: "Uncluttered volumes where each element earns its place, negative space as design tool",
  },
  Classic: {
    keywords: ["heritage", "ornamental", "symmetrical", "grand", "traditional craftsmanship"],
    colors: ["cream", "burgundy", "forest green", "antique gold", "rich walnut"],
    texture: "Ornate plasterwork, carved wood, damask fabrics, polished brass, veined marble",
    lighting: "Chandeliers and sconces with warm incandescent tones, layered drapery for light control",
    spatial: "Formal room hierarchy with enfilade circulation, proportional ceiling heights",
  },
  Fusion: {
    keywords: ["eclectic", "cultural blend", "unexpected pairings", "artisanal", "narrative"],
    colors: ["terracotta", "indigo", "saffron", "olive", "raw umber"],
    texture: "Handcrafted meets industrial — zellige tiles, raw steel, woven textiles, reclaimed wood",
    lighting: "Mix of artisan pendants, lanterns, and modern track systems",
    spatial: "Layered spaces with cultural references, discovery moments, and curated collections",
  },
  Other: {
    keywords: ["custom", "experimental", "site-specific", "innovative", "boundary-pushing"],
    colors: ["project-specific palette", "contextual response", "material-driven", "site-inspired", "bespoke"],
    texture: "Custom material palette responding to project narrative and site context",
    lighting: "Bespoke lighting design responding to program and spatial character",
    spatial: "Innovative spatial organization driven by project-specific requirements",
  },
};

const TIER_MATERIALS: Record<string, { primary: string[]; accent: string[]; avoid: string[]; quality: string }> = {
  Mid: {
    primary: ["Engineered stone", "Porcelain tile", "Laminate wood", "Painted MDF"],
    accent: ["Stainless steel", "Glass mosaic", "Vinyl fabric"],
    avoid: ["Natural marble (cost)", "Solid hardwood (budget)", "Custom metalwork"],
    quality: "Good quality commercial-grade materials with consistent finish",
  },
  "Upper-mid": {
    primary: ["Quartz composite", "Large-format porcelain", "Engineered oak", "Lacquered joinery"],
    accent: ["Brushed nickel", "Ceramic tile", "Performance fabric"],
    avoid: ["Ultra-premium stone", "Bespoke furniture", "Exotic hardwoods"],
    quality: "Premium commercial-grade with select residential-quality feature elements",
  },
  Luxury: {
    primary: ["Natural marble", "Solid hardwood", "Custom joinery", "Natural stone"],
    accent: ["Brushed brass", "Silk fabric", "Hand-blown glass", "Leather"],
    avoid: ["Laminate surfaces", "Vinyl", "Standard-grade fixtures"],
    quality: "Residential luxury grade — hand-selected materials with visible craftsmanship",
  },
  "Ultra-luxury": {
    primary: ["Book-matched marble", "Exotic hardwood", "Bespoke metalwork", "Artisan plaster"],
    accent: ["24k gold leaf", "Murano glass", "Cashmere", "Mother of pearl"],
    avoid: ["Any mass-produced finish", "Standard hardware", "Synthetic materials"],
    quality: "Museum-grade — one-of-a-kind pieces, master craftsman execution, provenance documented",
  },
};

export function generateDesignBrief(
  project: { name: string; description: string | null },
  inputs: ProjectInputs,
  scoreResult: { compositeScore: number; decisionStatus: string; dimensions: Record<string, number> },
): DesignBriefData {
  const style = inputs.des01Style || "Modern";
  const tier = inputs.mkt01Tier || "Upper-mid";
  const mood = STYLE_MOOD_MAP[style] || STYLE_MOOD_MAP.Other;
  const materials = TIER_MATERIALS[tier] || TIER_MATERIALS["Upper-mid"];

  const gfa = inputs.ctx03Gfa ? Number(inputs.ctx03Gfa) : null;
  const budget = inputs.fin01BudgetCap ? Number(inputs.fin01BudgetCap) : null;

  // Determine cost band
  let costBand = "Standard";
  if (budget) {
    if (budget > 700) costBand = "Ultra-Premium";
    else if (budget > 450) costBand = "Premium";
    else if (budget > 250) costBand = "Upper-Standard";
  }

  // Flexibility mapping
  const flexMap: Record<number, string> = {
    1: "Very tight — minimal room for specification upgrades",
    2: "Constrained — value engineering required for any upgrades",
    3: "Moderate — selective upgrades possible in high-impact areas",
    4: "Flexible — room for specification enhancements across key areas",
    5: "Open — full creative freedom within quality parameters",
  };

  // Lead time based on horizon
  const horizonLeadMap: Record<string, string> = {
    "0-12m": "Aggressive — prioritize locally stocked materials, minimize custom orders",
    "12-24m": "Standard — balance between custom and ready-made, plan long-lead items early",
    "24-36m": "Comfortable — full custom palette available, phase procurement strategically",
    "36m+": "Extended — opportunity for bespoke commissions and artisan collaborations",
  };

  // Sustainability notes
  const sustainNotes = inputs.des05Sustainability >= 4
    ? "High sustainability priority — specify recycled content, low-VOC, FSC-certified wood, local sourcing preferred"
    : inputs.des05Sustainability >= 3
    ? "Moderate sustainability consideration — prefer eco-friendly options where cost-neutral"
    : "Standard compliance — meet local building code requirements for sustainability";

  // Positioning statement
  const positioningParts: string[] = [];
  positioningParts.push(`${project.name} is a ${tier.toLowerCase()} ${inputs.ctx01Typology.toLowerCase()} project`);
  positioningParts.push(`positioned in a ${inputs.ctx04Location.toLowerCase()} location`);
  positioningParts.push(`with a ${style.toLowerCase()} design direction`);
  if (scoreResult.decisionStatus === "validated") {
    positioningParts.push(`that has been validated by MIYAR with a composite score of ${scoreResult.compositeScore.toFixed(1)}`);
  } else if (scoreResult.decisionStatus === "conditional") {
    positioningParts.push(`with conditional validation (score: ${scoreResult.compositeScore.toFixed(1)}) — specific adjustments recommended`);
  } else {
    positioningParts.push(`requiring design direction revision (score: ${scoreResult.compositeScore.toFixed(1)})`);
  }

  // Critical path items based on complexity and material level
  const criticalPath: string[] = [];
  if (inputs.des02MaterialLevel >= 4) criticalPath.push("Natural stone selection and slab reservation");
  if (inputs.des03Complexity >= 4) criticalPath.push("Custom joinery shop drawings and prototyping");
  if (inputs.des04Experience >= 4) criticalPath.push("Smart home system integration and programming");
  if (tier === "Ultra-luxury") criticalPath.push("Bespoke furniture commissioning");
  if (inputs.exe01SupplyChain <= 2) criticalPath.push("Import logistics for specialty materials");
  if (criticalPath.length === 0) criticalPath.push("Standard procurement timeline applies");

  // Import dependencies
  const importDeps: string[] = [];
  if (inputs.des02MaterialLevel >= 4) importDeps.push("Italian marble (8-12 week lead)");
  if (tier === "Luxury" || tier === "Ultra-luxury") importDeps.push("European hardware and fixtures (6-10 weeks)");
  if (inputs.des03Complexity >= 4) importDeps.push("Custom lighting from European manufacturers (10-14 weeks)");
  if (importDeps.length === 0) importDeps.push("Primarily local/regional sourcing feasible");

  // Risk mitigations
  const riskMits: string[] = [];
  if (inputs.exe01SupplyChain <= 2) riskMits.push("Pre-order critical materials immediately upon brief approval");
  if (inputs.fin03ShockTolerance <= 2) riskMits.push("Lock material prices with supplier agreements before design freeze");
  riskMits.push("Identify 2-3 alternative materials for each critical specification");
  riskMits.push("Schedule mock-up reviews at 30% and 60% completion milestones");

  // Value engineering notes
  const veNotes: string[] = [];
  if (inputs.fin02Flexibility <= 2) {
    veNotes.push("Focus premium materials on high-visibility areas (lobby, master suite, kitchen)");
    veNotes.push("Use cost-effective alternatives in secondary spaces (storage, utility, corridors)");
  }
  veNotes.push("Consider material substitution matrix for budget flexibility");
  if (gfa && gfa > 300000) veNotes.push("Bulk procurement discounts available at this scale — negotiate early");

  return {
    projectIdentity: {
      projectName: project.name,
      typology: inputs.ctx01Typology,
      scale: inputs.ctx02Scale,
      gfa,
      location: inputs.ctx04Location,
      horizon: inputs.ctx05Horizon,
      marketTier: tier,
      style,
    },
    positioningStatement: positioningParts.join(" ") + ".",
    styleMood: {
      primaryStyle: style,
      moodKeywords: mood.keywords,
      colorPalette: mood.colors,
      textureDirection: mood.texture,
      lightingApproach: mood.lighting,
      spatialPhilosophy: mood.spatial,
    },
    materialGuidance: {
      tierRecommendation: tier,
      primaryMaterials: materials.primary,
      accentMaterials: materials.accent,
      avoidMaterials: materials.avoid,
      sustainabilityNotes: sustainNotes,
      qualityBenchmark: materials.quality,
    },
    budgetGuardrails: {
      costPerSqftTarget: budget ? `${budget} AED/sqft` : "Not specified",
      costBand,
      flexibilityLevel: flexMap[inputs.fin02Flexibility] || flexMap[3],
      contingencyRecommendation: inputs.fin03ShockTolerance <= 2 ? "15-20% contingency recommended" : "10-15% contingency recommended",
      valueEngineeringNotes: veNotes,
    },
    procurementConstraints: {
      leadTimeWindow: horizonLeadMap[inputs.ctx05Horizon] || horizonLeadMap["12-24m"],
      criticalPathItems: criticalPath,
      localSourcingPriority: inputs.exe01SupplyChain >= 4 ? "Strong local supply chain — prioritize regional materials" : "Mixed sourcing — balance local availability with specification requirements",
      importDependencies: importDeps,
      riskMitigations: riskMits,
    },
    deliverablesChecklist: {
      phase1: [
        "Mood board (approved)",
        "Material palette board",
        "Color scheme presentation",
        "Spatial concept diagrams",
        "Budget allocation matrix",
      ],
      phase2: [
        "Detailed material specifications",
        "FF&E schedule with pricing",
        "Lighting design concept",
        "Sample kit assembly",
        "Supplier shortlist with lead times",
      ],
      phase3: [
        "Final specification book",
        "Procurement schedule",
        "Quality control checklist",
        "Installation guidelines",
        "Handover documentation",
      ],
      qualityGates: [
        "Design direction sign-off (before Phase 2)",
        "Material sample approval (before procurement)",
        "Mock-up review (before mass production)",
        "Final walkthrough (before handover)",
      ],
    },
  };
}
