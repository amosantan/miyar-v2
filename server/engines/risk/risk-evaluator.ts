/**
 * BP 35: Integrated Risk Scoring Model
 * R = (P × I × V) / C
 * 
 * P = Probability of occurrence (0-100)
 * I = Impact magnitude (0-100)
 * V = System vulnerability level (0-100)
 * C = Control strength (1-100)
 */

export interface RiskInputParams {
    domain: "Model" | "Operational" | "Commercial" | "Technology" | "Data" | "Behavioural" | "Strategic" | "Regulatory";
    tier: string;
    horizon: string;
    location: string;
    complexityScore: number;
}

export function evaluateRiskSurface(params: RiskInputParams) {
    const { domain, tier, horizon, location, complexityScore } = params;

    let baseProbability = 50;
    let baseImpact = 50;
    let baseVulnerability = 50;
    let controlStrength = 60; // Default solid control

    // Adjustments based on domain
    switch (domain) {
        case "Commercial":
            // Commercial risk scales heavily with tier and complexity
            baseProbability = tier === "Ultra-luxury" ? 80 : tier === "Luxury" ? 65 : 40;
            baseImpact = complexityScore > 75 ? 90 : 60;
            baseVulnerability = horizon.includes("36m") ? 85 : 50; // Longer timescale = higher vulnerability to inflation/market shift
            controlStrength = 70; // Pre-agreed budgets act as controls
            break;

        case "Operational":
            // Supply chain and procurement risk
            baseProbability = location === "Emerging" ? 75 : 45;
            baseImpact = tier.includes("luxury") ? 85 : 55;
            baseVulnerability = complexityScore;
            controlStrength = 55; // Harder to control external suppliers
            break;

        case "Strategic":
            baseProbability = tier === "Mid" ? 70 : 40; // Mid tier faces more extreme market saturation
            baseImpact = 95; // Strategic failure is always high impact
            baseVulnerability = horizon.includes("36m") ? 80 : 40; // Forecasting 36m out is vulnerable
            controlStrength = 40; // Hard to control macroeconomic shifts
            break;

        default:
            baseProbability = 50;
            baseImpact = 50;
            baseVulnerability = 50;
    }

    // Calculate R
    const rUnbounded = (baseProbability * baseImpact * baseVulnerability) / controlStrength;

    // Normalize to 100
    // Max possible numerator is 100*100*100 = 1,000,000. Min control is 1.
    // We need a sensible curve to map this into 1-100.
    // A typical "very bad" score is (80*80*80)/40 = 12,800.
    // A typical "good" score is (40*40*40)/80 = 800.
    // We'll divide by 200 and cap at 100.
    let compositeRiskScore = Math.floor(rUnbounded / 200);
    if (compositeRiskScore > 100) compositeRiskScore = 100;
    if (compositeRiskScore < 1) compositeRiskScore = 1;

    let riskBand: "Minimal" | "Controlled" | "Elevated" | "Critical" | "Systemic";
    if (compositeRiskScore <= 20) riskBand = "Minimal";
    else if (compositeRiskScore <= 40) riskBand = "Controlled";
    else if (compositeRiskScore <= 60) riskBand = "Elevated";
    else if (compositeRiskScore <= 80) riskBand = "Critical";
    else riskBand = "Systemic";

    return {
        domain,
        probability: baseProbability,
        impact: baseImpact,
        vulnerability: baseVulnerability,
        controlStrength: controlStrength,
        compositeRiskScore,
        riskBand,
    };
}
