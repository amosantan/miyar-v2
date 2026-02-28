/**
 * Design Brief Generator Engine (V2.8) - Dubai Market Edition
 * Deterministic design brief generation from project data + evaluation results.
 * Produces a highly actionable 6-section structured interior design brief.
 */

import type { ProjectInputs } from "../../shared/miyar-types";
import type { CategoryPricing } from "./pricing-engine";
import { getPricingArea } from "./area-utils";

export interface PricingAnalytics {
  /** Weighted average AED/m² across all specified material types */
  costPerSqmAvg: number;
  /** Total estimated fitout cost in AED (costPerSqmAvg * GFA) */
  totalFitoutCostAed: number;
  /** Total estimated carbon footprint (kg CO²) */
  totalCarbonKg: number;
  /** Weighted average maintenance factor (1–5 scale) */
  avgMaintenanceFactor: number;
  /** Sustainability grade A–E derived from avg carbon intensity */
  sustainabilityGrade: string;
  /** Per-material type breakdown */
  materialBreakdown: {
    materialType: string;
    allocatedSqm: number;
    costPerSqm: number;
    lineCostAed: number;
    carbonKg: number;
    maintenanceFactor: number;
  }[];
  /** Source of pricing data */
  pricingSource: "material_constants" | "live_benchmarks" | "project_budget" | "none";
  /** Estimated sales premium AED from design tier */
  designPremiumAed: number;
  /** Premium % for market tier */
  designPremiumPct: number;
  /** Fitout-to-sale price ratio (Phase B.3 — DLD integration) */
  fitoutRatio: number | null;
  /** Over/under-specification warning */
  overSpecWarning: string | null;
  /** Source of sale price data */
  salePriceSource: "dld_transactions" | "hardcoded_fallback";
  /** Area median sale price AED/sqm used for calculation */
  areaSalePricePerSqm: number;
}

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
  designNarrative: {
    positioningStatement: string;
    primaryStyle: string;
    moodKeywords: string[];
    colorPalette: string[];
    textureDirection: string;
    lightingApproach: string;
    spatialPhilosophy: string;
  };
  materialSpecifications: {
    tierRequirement: string;
    approvedMaterials: string[];
    prohibitedMaterials: string[];
    finishesAndTextures: string[];
    sustainabilityMandate: string;
    qualityBenchmark: string;
  };
  boqFramework: {
    totalEstimatedSqm: number | null;
    coreAllocations: {
      category: string;
      percentage: number;
      estimatedCostLabel: string;
      notes: string;
    }[];
  };
  detailedBudget: {
    costPerSqmTarget: string;
    totalBudgetCap: string;
    costBand: string;
    flexibilityLevel: string;
    contingencyRecommendation: string;
    valueEngineeringMandates: string[];
  };
  designerInstructions: {
    phasedDeliverables: {
      conceptDesign: string[];
      schematicDesign: string[];
      detailedDesign: string[];
    };
    authorityApprovals: string[];
    coordinationRequirements: string[];
    procurementAndLogistics: {
      leadTimeWindow: string;
      criticalPathItems: string[];
      importDependencies: string[];
    };
  };
  /** Phase 3: Structural cost analytics from material_constants */
  pricingAnalytics?: PricingAnalytics;
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

const TIER_MATERIALS: Record<string, { primary: string[]; finishes: string[]; avoid: string[]; quality: string }> = {
  Mid: {
    primary: ["Engineered stone countertops", "Large-format porcelain floor tiles (60x60cm)", "Laminate wood flooring for bedrooms", "Painted MDF joinery"],
    finishes: ["Powder-coated aluminum", "Matte black or brushed nickel hardware", "Commercial-grade vinyl wallcoverings"],
    avoid: ["Natural marble slabs", "Solid hardwood flooring", "Bespoke brass or copper metalwork", "Silk or delicate natural fabrics"],
    quality: "Good quality commercial-grade materials with high durability and consistent mass-produced finish.",
  },
  "Upper-mid": {
    primary: ["Quartz composite surfaces", "Large-format porcelain (120x60cm)", "Engineered oak flooring", "Lacquered or wood-veneer joinery"],
    finishes: ["Brushed brass or nickel accents", "Textured ceramic wall tiles", "Performance blend fabrics"],
    avoid: ["Ultra-premium exotic stone (Calacatta, Onyx)", "Fully bespoke loose furniture", "Exotic solid hardwoods"],
    quality: "Premium commercial-grade bridging standard residential build with select residential-quality feature elements.",
  },
  Luxury: {
    primary: ["Natural marble (Carrara, Statuario)", "Solid European hardwood", "Custom-built joinery with integrated lighting", "Natural travertine or slate"],
    finishes: ["Satin brass or bronze fixtures", "Silk and wool blend fabrics", "Hand-blown glass lighting", "Full-grain leather upholstery"],
    avoid: ["Laminate surfaces", "Vinyl flooring", "Standard-grade sanitary ware", "Visible MDF edges"],
    quality: "Residential luxury grade — hand-selected materials with visible artisan craftsmanship and texture.",
  },
  "Ultra-luxury": {
    primary: ["Book-matched marble slabs", "Rare exotic hardwood", "Bespoke architectural metalwork", "Artisan venetian plaster"],
    finishes: ["24k gold leaf details", "Murano glass", "Cashmere wallcoverings", "Mother of pearl inlay"],
    avoid: ["Any mass-produced finish or synthetic imitation", "Standard catalog hardware", "Printed porcelain mimicking stone"],
    quality: "Museum-grade — one-of-a-kind pieces, master craftsman execution, provenance documented for every major surface.",
  },
};

// Generic Dubai standard BOQ allocation percentages
const BOQ_DISTRIBUTION: Record<string, { category: string; percentage: number; notes: string }[]> = {
  Residential: [
    { category: "Civil & MEP Works (Flooring, Ceilings, Partitions)", percentage: 35, notes: "Includes demolition, AC modifications, smart home cabling." },
    { category: "Fixed Joinery (Kitchens, Wardrobes, Doors)", percentage: 25, notes: "High impact area. Focus on veneer matching and hardware quality." },
    { category: "Sanitaryware & Wet Areas", percentage: 15, notes: "Waterproofing and high-grade imported fixtures." },
    { category: "FF&E (Loose Furniture, Lighting, Art)", percentage: 25, notes: "Sourced locally or imported depending on timeline." },
  ],
  Commercial: [
    { category: "Civil & MEP Works (Partitions, HVAC, Data)", percentage: 45, notes: "Heavy focus on IT infrastructure and acoustics." },
    { category: "Workstations & Loose Furniture", percentage: 30, notes: "Ergonomic seating and adaptive desking." },
    { category: "Pantry & Washrooms", percentage: 10, notes: "Durable, high-traffic finishes." },
    { category: "Feature Joinery & Reception", percentage: 15, notes: "Brand identity focal points." },
  ],
  Hospitality: [
    { category: "Civil & MEP Works", percentage: 30, notes: "Acoustic separation and complex integrated lighting." },
    { category: "FF&E (Custom Furniture, Drapery, Rugs)", percentage: 40, notes: "High durability textiles, fire-rated materials." },
    { category: "Fixed Joinery & Millwork", percentage: 15, notes: "Bespoke casegoods." },
    { category: "Sanitaryware & Specialized Equipment", percentage: 15, notes: "Luxury hotel-grade fixtures." },
  ]
};

// Maps market tier to typical primary material types in material_constants
const TIER_MATERIAL_TYPES: Record<string, string[]> = {
  "Mid": ["concrete", "ceramic", "paint"],
  "Upper-mid": ["concrete", "stone", "paint", "glass"],
  "Luxury": ["stone", "glass", "steel", "wood"],
  "Ultra-luxury": ["stone", "glass", "steel", "aluminum", "wood"],
};

const TIER_PREMIUM_PCT: Record<string, number> = {
  "Entry": 0, "Mid": 3, "Upper-mid": 8, "Luxury": 18, "Ultra-luxury": 30,
};

export function generateDesignBrief(
  project: { name: string; description: string | null },
  inputs: ProjectInputs,
  scoreResult: { compositeScore: number; decisionStatus: string; dimensions: Record<string, number> },
  livePricing?: Record<string, CategoryPricing>,
  materialConstants?: Array<{ materialType: string; costPerM2: string | number; carbonIntensity: string | number; maintenanceFactor: string | number }>,
  /** Phase B.3: DLD area median sale price AED/sqm. If provided, replaces hardcoded 25K fallback. */
  areaSalePricePerSqm?: number,
  /** Phase B.3: Project purpose — affects material quality & durability recommendations */
  projectPurpose?: "sell_offplan" | "sell_ready" | "rent" | "mixed",
): DesignBriefData {
  const style = inputs.des01Style || "Modern";
  const tier = inputs.mkt01Tier || "Upper-mid";
  const mood = STYLE_MOOD_MAP[style] || STYLE_MOOD_MAP.Other;
  const purpose = projectPurpose || "sell_ready";

  // Purpose-adjusted material tier: rent downgrades, offplan upgrades
  const PURPOSE_TIER_ADJUST: Record<string, number> = {
    sell_offplan: 1,   // one tier up (showroom quality)
    sell_ready: 0,     // as-is
    rent: -1,          // one tier down (durability focus)
    mixed: 0,          // balanced
  };
  const tierOrder = ["Mid", "Upper-mid", "Luxury", "Ultra-luxury"];
  const baseTierIdx = tierOrder.indexOf(tier);
  const adjustedTierIdx = Math.max(0, Math.min(tierOrder.length - 1, baseTierIdx + (PURPOSE_TIER_ADJUST[purpose] || 0)));
  const effectiveMaterialTier = tierOrder[adjustedTierIdx];
  const materials = TIER_MATERIALS[effectiveMaterialTier] || TIER_MATERIALS["Upper-mid"];

  const gfa = getPricingArea(inputs);
  const budget = inputs.fin01BudgetCap ? Number(inputs.fin01BudgetCap) : null;
  const totalBudgetCap = budget && gfa ? budget * gfa : null;

  // Determine cost band — use live pricing if available, else static bands
  let costBand = "Standard (Fit-out)";
  let dynamicCostPerSqm: number | null = null;
  if (livePricing && Object.keys(livePricing).length > 0) {
    // Bottom-up: sum weighted means across all available categories
    const totalPerSqm = Object.values(livePricing).reduce((sum, cp) => sum + cp.weightedMean, 0);
    dynamicCostPerSqm = totalPerSqm;
    if (totalPerSqm > 8000) costBand = "Ultra-Premium Luxury (Market-Verified)";
    else if (totalPerSqm > 4500) costBand = "Premium High-End (Market-Verified)";
    else if (totalPerSqm > 2500) costBand = "Upper-Standard Modern (Market-Verified)";
    else costBand = "Standard Fit-out (Market-Verified)";
  } else if (budget) {
    if (budget > 8000) costBand = "Ultra-Premium Luxury";
    else if (budget > 4500) costBand = "Premium High-End";
    else if (budget > 2500) costBand = "Upper-Standard Modern";
  }

  // Flexibility mapping
  const flexMap: Record<number, string> = {
    1: "Strictly fixed. Value engineering required immediately to meet target.",
    2: "Constrained. Submittals must provide cheaper alternatives.",
    3: "Moderate. Upgrades allowed only if offset by savings elsewhere.",
    4: "Flexible. Room to upgrade hero areas (e.g. reception, master bed).",
    5: "Open. Unconstrained budget for ultra-luxury specifications.",
  };

  // Lead time based on horizon
  const horizonLeadMap: Record<string, string> = {
    "0-12m": "0-12 Months (Aggressive) — Zero tolerance for long-lead imports. Focus on locally stocked materials in the UAE.",
    "12-24m": "12-24 Months (Standard) — Safely import European lighting and hardware. Monitor shipping delays.",
    "24-36m": "24-36 Months (Comfortable) — Full global sourcing available. Phase procurement.",
    "36m+": "36 Months+ (Extended) — Opportunity for bespoke Italian/European factory commissions.",
  };

  // Sustainability notes (Dubai Green Building Regulations focus)
  const sustainNotes = inputs.des05Sustainability >= 4
    ? "High Priority: Must exceed Dubai Green Building (Al Sa'fat) Gold standards. Specify low-VOC, locally manufactured materials, and ultra-efficient MEP."
    : inputs.des05Sustainability >= 3
      ? "Moderate Priority: Adhere to baseline Al Sa'fat regulations. Prefer sustainable materials if cost-neutral."
      : "Standard Compliance: Meet minimum Dubai Municipality building codes and basic Al Sa'fat requirements.";

  // Positioning statement
  const purposeLabel: Record<string, string> = {
    sell_offplan: "positioned for off-plan sales with showroom-quality finishes",
    sell_ready: "positioned for ready-to-move sales with durable premium finishes",
    rent: "designed for rental yield optimisation with high-durability, cost-efficient materials",
    mixed: "designed for a mixed-use strategy balancing resale appeal and rental durability",
  };
  const positioningParts: string[] = [];
  positioningParts.push(`The ${project.name} is a ${tier.toLowerCase()} ${inputs.ctx01Typology.toLowerCase()} internal fit-out`);
  positioningParts.push(`located in a ${inputs.ctx04Location.toLowerCase()} area of Dubai,`);
  positioningParts.push(`${purposeLabel[purpose] || purposeLabel.sell_ready},`);
  positioningParts.push(`embracing a ${style.toLowerCase()} design language.`);
  if (inputs.projectUsp) {
    positioningParts.push(`Its primary Unique Selling Proposition (USP) is anchored in ${inputs.projectUsp.toLowerCase()}.`);
  }
  if (inputs.amenityFocus) {
    positioningParts.push(`The amenity programming prioritizes ${inputs.amenityFocus.toLowerCase()} spaces.`);
  }
  if (effectiveMaterialTier !== tier) {
    positioningParts.push(`Material specifications adjusted to ${effectiveMaterialTier.toLowerCase()} quality level based on project purpose.`);
  }
  if (scoreResult.decisionStatus === "validated") {
    positioningParts.push(`MIYAR validates this direction with a high composite feasible score of ${scoreResult.compositeScore.toFixed(1)}/100.`);
  } else if (scoreResult.decisionStatus === "conditional") {
    positioningParts.push(`MIYAR conditionally validates this direction (Score: ${scoreResult.compositeScore.toFixed(1)}/100). The interior team must actively mitigate flagged constraints during schematic design.`);
  } else {
    positioningParts.push(`MIYAR flags this brief for revision (Score: ${scoreResult.compositeScore.toFixed(1)}/100). Severe discrepancies exist between the budget and the target material luxury tiers.`);
  }

  // Critical path items
  const criticalPath: string[] = [];
  if (inputs.des02MaterialLevel >= 4) criticalPath.push("Dry-lay approval for natural stone slabs at local UAE yards.");
  if (inputs.des03Complexity >= 4) criticalPath.push("Shop drawing approvals for complex architectural metalwork/joinery.");
  if (inputs.des04Experience >= 4) criticalPath.push("AV/IT and Smart Home automation rough-in coordination.");
  if (tier === "Ultra-luxury") criticalPath.push("Procurement of limited-edition or custom-commissioned FF&E.");
  if (inputs.exe01SupplyChain <= 2) criticalPath.push("Customs clearance and shipping buffers for all imported finishing materials.");
  if (criticalPath.length === 0) criticalPath.push("Standard interior fit-out mobilization and procurement.");

  // Import dependencies
  const importDeps: string[] = [];
  if (inputs.des02MaterialLevel >= 4) importDeps.push("Italian/Spanish Natural Marble (10-14 weeks lead).");
  if (tier === "Luxury" || tier === "Ultra-luxury") importDeps.push("European sanitaryware & brassware (8-12 weeks).");
  if (inputs.des03Complexity >= 4) importDeps.push("European architectural lighting tracks and drivers (10-12 weeks).");
  if (importDeps.length === 0) importDeps.push("100% locally stocked building materials.");

  // Value engineering
  const veNotes: string[] = [];
  if (inputs.fin02Flexibility <= 2) {
    veNotes.push("Restrict Class A natural stone strictly to primary visual axes (Main Entrance, Feature Walls).");
    veNotes.push("Substitute hidden joinery carcasses (wardrobe internals, back-of-house) with standard melamine.");
    veNotes.push("Specify large-format porcelain instead of marble for secondary washrooms.");
  }
  veNotes.push("Continuously evaluate sub-contractor BOQs against the MIYAR budget cap during the tender phase.");
  if (gfa && gfa > 2000) veNotes.push("Leverage the large floor plate for bulk discount negotiations on flooring and ceiling tiles.");

  // BOQ Math — Bottom-up from live pricing when available, top-down fallback
  const distroList = BOQ_DISTRIBUTION[inputs.ctx01Typology] || BOQ_DISTRIBUTION.Commercial;

  // Map BOQ distribution categories to evidence categories for live pricing lookup
  const boqToEvidenceCat: Record<string, string[]> = {
    "Civil & MEP Works (Flooring, Ceilings, Partitions)": ["floors", "ceilings", "walls"],
    "Civil & MEP Works (Partitions, HVAC, Data)": ["floors", "ceilings", "walls"],
    "Civil & MEP Works": ["floors", "ceilings", "walls"],
    "Fixed Joinery (Kitchens, Wardrobes, Doors)": ["joinery"],
    "Feature Joinery & Reception": ["joinery"],
    "Fixed Joinery & Millwork": ["joinery"],
    "Sanitaryware & Wet Areas": ["sanitary"],
    "Sanitaryware & Specialized Equipment": ["sanitary"],
    "Pantry & Washrooms": ["sanitary", "kitchen"],
    "FF&E (Loose Furniture, Lighting, Art)": ["ffe", "lighting"],
    "FF&E (Custom Furniture, Drapery, Rugs)": ["ffe", "lighting"],
    "Workstations & Loose Furniture": ["ffe"],
  };

  const coreAllocations = distroList.map((d) => {
    let estCostStr = "TBD";
    let usedLive = false;

    if (livePricing && gfa) {
      // Try bottom-up: sum average costs for each mapped evidence category
      const mappedCats = boqToEvidenceCat[d.category] || [];
      let catSqmCost = 0;
      let matched = 0;
      for (const ec of mappedCats) {
        if (livePricing[ec]) {
          catSqmCost += livePricing[ec].weightedMean;
          matched++;
        }
      }
      if (matched > 0) {
        const catTotal = catSqmCost * gfa;
        estCostStr = `AED ${Math.round(catTotal).toLocaleString()} (market-verified)`;
        usedLive = true;
      }
    }

    // Fallback: top-down from budget cap
    if (!usedLive && totalBudgetCap) {
      const catTotal = (d.percentage / 100) * totalBudgetCap;
      estCostStr = `AED ${Math.round(catTotal).toLocaleString()}`;
    }

    return {
      category: d.category,
      percentage: d.percentage,
      estimatedCostLabel: estCostStr,
      notes: usedLive ? `${d.notes} [Pricing source: Live market benchmarks]` : d.notes,
    };
  });

  // ─── Phase 3: Compute pricingAnalytics from material_constants ───────────────
  let pricingAnalytics: PricingAnalytics | undefined;
  if (materialConstants && materialConstants.length > 0 && gfa) {
    const constLookup = new Map(materialConstants.map(c => [c.materialType, c]));
    const tierTypes = TIER_MATERIAL_TYPES[tier] || TIER_MATERIAL_TYPES["Upper-mid"];
    // Distribute GFA equally across tier-relevant material types present in constants
    const matchedTypes = tierTypes.filter(t => constLookup.has(t));
    const sqmPerType = matchedTypes.length > 0 ? gfa / matchedTypes.length : 0;

    let totalCostAed = 0;
    let totalCarbonKg = 0;
    let weightedMaintenanceSum = 0;
    const materialBreakdown: PricingAnalytics["materialBreakdown"] = [];

    for (const mt of matchedTypes) {
      const c = constLookup.get(mt)!;
      const costPerSqm = Number(c.costPerM2 ?? 0);
      const carbonIntensity = Number(c.carbonIntensity ?? 0);
      const maintenanceFactor = Number(c.maintenanceFactor ?? 3);
      const lineCost = costPerSqm * sqmPerType;
      const lineCarbonKg = carbonIntensity * sqmPerType;
      totalCostAed += lineCost;
      totalCarbonKg += lineCarbonKg;
      weightedMaintenanceSum += maintenanceFactor * sqmPerType;
      materialBreakdown.push({
        materialType: mt,
        allocatedSqm: Math.round(sqmPerType),
        costPerSqm,
        lineCostAed: Math.round(lineCost),
        carbonKg: Math.round(lineCarbonKg),
        maintenanceFactor,
      });
    }

    const costPerSqmAvg = matchedTypes.length > 0 ? totalCostAed / gfa : 0;
    const avgMaintenanceFactor = gfa > 0 && matchedTypes.length > 0 ? weightedMaintenanceSum / gfa : 3;
    const avgCarbonPerSqm = gfa > 0 ? totalCarbonKg / gfa : 0;
    const sustainabilityGrade =
      avgCarbonPerSqm < 30 ? "A" :
        avgCarbonPerSqm < 60 ? "B" :
          avgCarbonPerSqm < 100 ? "C" :
            avgCarbonPerSqm < 150 ? "D" : "E";

    const designPremiumPct = TIER_PREMIUM_PCT[tier] ?? 8;
    // Phase B.3: Use DLD area median if available, else fallback to 25K/sqm
    const baseSalePrice = areaSalePricePerSqm ?? 25000;
    const salePriceSource: "dld_transactions" | "hardcoded_fallback" = areaSalePricePerSqm ? "dld_transactions" : "hardcoded_fallback";
    const designPremiumAed = Math.round(gfa * baseSalePrice * designPremiumPct / 100);

    // Fitout-to-sale ratio analysis
    const fitoutRatio = baseSalePrice > 0 ? costPerSqmAvg / baseSalePrice : null;
    const FITOUT_RATIOS: Record<string, { min: number; max: number }> = {
      "Mid": { min: 0.08, max: 0.12 },
      "Upper-mid": { min: 0.12, max: 0.18 },
      "Luxury": { min: 0.18, max: 0.28 },
      "Ultra-luxury": { min: 0.25, max: 0.35 },
    };
    const ratioLimits = FITOUT_RATIOS[tier] ?? { min: 0.12, max: 0.18 };
    let overSpecWarning: string | null = null;
    if (fitoutRatio !== null) {
      if (fitoutRatio > ratioLimits.max) {
        overSpecWarning = `⚠️ Fitout at ${(fitoutRatio * 100).toFixed(0)}% of sale price exceeds ${tier} norm of ${(ratioLimits.max * 100)}%. Consider reducing specification.`;
      } else if (fitoutRatio < ratioLimits.min) {
        overSpecWarning = `⚠️ Fitout at ${(fitoutRatio * 100).toFixed(0)}% of sale price is below ${tier} minimum of ${(ratioLimits.min * 100)}%. May not meet buyer expectations.`;
      }
    }

    pricingAnalytics = {
      costPerSqmAvg: Math.round(costPerSqmAvg),
      totalFitoutCostAed: Math.round(totalCostAed),
      totalCarbonKg: Math.round(totalCarbonKg),
      avgMaintenanceFactor: Math.round(avgMaintenanceFactor * 10) / 10,
      sustainabilityGrade,
      materialBreakdown,
      pricingSource: "material_constants",
      designPremiumAed,
      designPremiumPct,
      fitoutRatio,
      overSpecWarning,
      salePriceSource,
      areaSalePricePerSqm: baseSalePrice,
    };
  }

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
    designNarrative: {
      positioningStatement: positioningParts.join(" "),
      primaryStyle: style,
      moodKeywords: mood.keywords,
      colorPalette: mood.colors,
      textureDirection: mood.texture,
      lightingApproach: mood.lighting,
      spatialPhilosophy: mood.spatial,
    },
    materialSpecifications: {
      tierRequirement: tier,
      approvedMaterials: materials.primary,
      prohibitedMaterials: materials.avoid,
      finishesAndTextures: materials.finishes,
      sustainabilityMandate: sustainNotes,
      qualityBenchmark: materials.quality,
    },
    boqFramework: {
      totalEstimatedSqm: gfa,
      coreAllocations,
    },
    detailedBudget: {
      costPerSqmTarget: dynamicCostPerSqm
        ? `AED ${Math.round(dynamicCostPerSqm).toLocaleString()}/sqm (market-verified)`
        : budget ? `AED ${budget.toLocaleString()}/sqm` : "Not specified",
      totalBudgetCap: totalBudgetCap ? `AED ${totalBudgetCap.toLocaleString()}` : "Not specified",
      costBand,
      flexibilityLevel: flexMap[inputs.fin02Flexibility] || flexMap[3],
      contingencyRecommendation: inputs.fin03ShockTolerance <= 2 ? "Allocate 15-20% Contractor Contingency" : "Allocate 10% Contractor Contingency",
      valueEngineeringMandates: veNotes,
    },
    designerInstructions: {
      phasedDeliverables: {
        conceptDesign: [
          "Mood boards, spatial narratives, and initial 3D masses.",
          "High-level space planning layouts (Block Plans).",
          "Initial material palette look-and-feel.",
        ],
        schematicDesign: [
          "Developed 3D renderings for key spaces.",
          "Preliminary RCPs (Reflected Ceiling Plans) and MEP overlays.",
          "Preliminary Material Schedule & Finishes Legend.",
        ],
        detailedDesign: [
          "IFC (Issued for Construction) drawing package.",
          "Fully detailed BOQ (Bill of Quantities) ready for tender.",
          "Finalised FF&E Matrix with exact supplier quotes.",
        ]
      },
      authorityApprovals: [
        "Dubai Municipality (DM) - Architectural & Fit-out Approvals.",
        "Dubai Civil Defense (DCD) - Fire safety & sprinkler modifications.",
        "Developer/Landlord NOCs (Emaar, Nakheel, DMCC, etc.) before site mobilization."
      ],
      coordinationRequirements: [
        "MEP Contractor: Coordinate AC grill placements with seamless ceiling details.",
        "Lighting Consultant: Align decorative fixture dimming protocols with main automation system.",
        "Acoustic Consultant: Soundproofing details for partitions meeting Dubai luxury standards."
      ],
      procurementAndLogistics: {
        leadTimeWindow: horizonLeadMap[inputs.ctx05Horizon] || horizonLeadMap["12-24m"],
        criticalPathItems: criticalPath,
        importDependencies: importDeps,
      }
    },
    pricingAnalytics,
  };
}
