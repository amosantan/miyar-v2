// ─── MIYAR Shared Types ──────────────────────────────────────────────────────

export type ProjectTypology = "Residential" | "Mixed-use" | "Hospitality" | "Office";
export type ProjectScale = "Small" | "Medium" | "Large";
export type LocationCategory = "Prime" | "Secondary" | "Emerging";
export type DeliveryHorizon = "0-12m" | "12-24m" | "24-36m" | "36m+";
export type MarketTier = "Mid" | "Upper-mid" | "Luxury" | "Ultra-luxury";
export type DesignStyle = "Modern" | "Contemporary" | "Minimal" | "Classic" | "Fusion" | "Other";
export type ProjectArchetype = "residential_multi" | "office" | "single_villa" | "hospitality" | "community";
export type ProjectCity = "Dubai" | "Abu Dhabi";
export type ProjectStatus = "draft" | "ready" | "processing" | "evaluated" | "locked";
export type DecisionStatus = "validated" | "conditional" | "not_validated";
export type OverrideType = "strategic" | "market_insight" | "risk_adjustment" | "experimental";
export type ReportType = "validation_summary" | "design_brief" | "rfq_pack" | "full_report" | "autonomous_design_brief";
export type BenchmarkSourceType = "synthetic" | "client_provided" | "curated";

// --- V5: Concrete Analytics Types ---
export type DeveloperType = "Master Developer" | "Private/Boutique" | "Institutional Investor";
export type TargetDemographic = "HNWI" | "Families" | "Young Professionals" | "Investors";
export type SalesStrategy = "Sell Off-Plan" | "Sell on Completion" | "Build-to-Rent";
export type CompetitiveDensity = "Low" | "Moderate" | "Saturated";
export type ProjectUsp = "Location/Views" | "Amenities/Facilities" | "Price/Value" | "Design/Architecture";
export type TargetYield = "< 5%" | "5-7%" | "7-9%" | "> 9%";
export type ProcurementStrategy = "Turnkey" | "Traditional" | "Construction Management";
export type AmenityFocus = "Wellness/Spa" | "F&B/Social" | "Minimal/Essential" | "Business/Co-working";
export type TechIntegration = "Basic" | "Smart Home Ready" | "Fully Integrated";
export type MaterialSourcing = "Local" | "European" | "Asian" | "Global Mix";
export type HandoverCondition = "Shell & Core" | "Category A" | "Category B" | "Fully Furnished";
export type BrandedStatus = "Unbranded" | "Hospitality Branded" | "Fashion/Automotive Branded";
export type SalesChannel = "Local Brokerage" | "International Roadshows" | "Direct to VIP";
export type LifecycleFocus = "Short-term Resale" | "Medium-term Hold" | "Long-term Retention";
export type BrandStandardConstraints = "High Flexibility" | "Moderate Guidelines" | "Strict Vendor List";
export type TimelineFlexibility = "Highly Flexible" | "Moderate Contingency" | "Fixed / Zero Tolerance";
export type TargetValueAdd = "Max Capital Appreciation" | "Max Rental Yield" | "Balanced Return" | "Brand Flagship / Trophy";

export interface ProjectInputs {
  // Context
  ctx01Typology: ProjectTypology;
  ctx02Scale: ProjectScale;
  ctx03Gfa: number | null;
  totalFitoutArea: number | null;
  ctx04Location: LocationCategory;
  ctx05Horizon: DeliveryHorizon;
  // City & Sustainability Certification
  city: ProjectCity;
  sustainCertTarget: string;
  // Strategy (1-5)
  str01BrandClarity: number;
  str02Differentiation: number;
  str03BuyerMaturity: number;
  // Market
  mkt01Tier: MarketTier;
  mkt02Competitor: number;
  mkt03Trend: number;
  // Financial
  fin01BudgetCap: number | null;
  fin02Flexibility: number;
  fin03ShockTolerance: number;
  fin04SalesPremium: number;
  // Design
  des01Style: DesignStyle;
  des02MaterialLevel: number;
  des03Complexity: number;
  des04Experience: number;
  des05Sustainability: number;
  // Execution
  exe01SupplyChain: number;
  exe02Contractor: number;
  exe03Approvals: number;
  exe04QaMaturity: number;
  // Add-ons
  add01SampleKit: boolean;
  add02PortfolioMode: boolean;
  add03DashboardExport: boolean;
  // V5: Concrete Analytics
  developerType?: DeveloperType;
  targetDemographic?: TargetDemographic;
  salesStrategy?: SalesStrategy;
  competitiveDensity?: CompetitiveDensity;
  projectUsp?: ProjectUsp;
  targetYield?: TargetYield;
  procurementStrategy?: ProcurementStrategy;
  amenityFocus?: AmenityFocus;
  techIntegration?: TechIntegration;
  materialSourcing?: MaterialSourcing;
  handoverCondition?: HandoverCondition;
  brandedStatus?: BrandedStatus;
  salesChannel?: SalesChannel;
  lifecycleFocus?: LifecycleFocus;
  brandStandardConstraints?: BrandStandardConstraints;
  timelineFlexibility?: TimelineFlexibility;
  targetValueAdd?: TargetValueAdd;

  // Phase 8: Board overrides
  boardMaterialsCost?: number;
  boardMaintenanceVariance?: number;

  // Phase 9: Space efficiency from floor plan analysis
  spaceEfficiencyScore?: number;  // 0-100, from benchmarkSpaceRatios
  spaceCriticalCount?: number;    // number of critical deviations
}

export interface NormalizedInputs {
  str01_n: number;
  str02_n: number;
  str03_n: number;
  mkt02_n: number;
  mkt03_n: number;
  fin02_n: number;
  fin03_n: number;
  fin04_n: number;
  des02_n: number;
  des03_n: number;
  des04_n: number;
  des05_n: number;
  exe01_n: number;
  exe02_n: number;
  exe03_n: number;
  exe04_n: number;
  // Derived
  scaleBand: ProjectScale;
  budgetClass: "Low" | "Mid" | "High" | "Premium";
  differentiationPressure: number;
  executionResilience: number;
  budgetFit: number;
  marketFit: number;
  trendFit: number;
  compatVisionMarket: number;
  compatVisionDesign: number;
  costVolatility: number;
  sustainCertMultiplier: number;
  fitoutRatio: number;
  procurementRiskMultiplier?: number;
  materialSourcingRiskMultiplier?: number;
  handoverRiskMultiplier?: number;
  brandedPremiumMultiplier?: number;
  salesVelocityMultiplier?: number;
  lifecycleOpexMultiplier?: number;
  brandStandardMultiplier?: number;
  timelineRiskMultiplier?: number;
  targetValueMultiplier?: number;
  // Phase 9
  spaceEfficiency_n: number;
}

export interface DimensionScores {
  sa: number; // Strategic Alignment
  ff: number; // Financial Feasibility
  mp: number; // Market Positioning
  ds: number; // Differentiation Strength
  er: number; // Execution Risk
}

export interface DimensionWeights {
  sa: number;
  ff: number;
  mp: number;
  ds: number;
  er: number;
}

export interface Penalty {
  id: string;
  trigger: string;
  effect: number;
  flag?: string;
  description: string;
}

export interface ConditionalAction {
  trigger: string;
  recommendation: string;
  variables: string[];
}

export interface ScoreResult {
  dimensions: DimensionScores;
  dimensionWeights: DimensionWeights;
  compositeScore: number;
  riskScore: number;
  rasScore: number;
  confidenceScore: number;
  decisionStatus: DecisionStatus;
  penalties: Penalty[];
  riskFlags: string[];
  conditionalActions: ConditionalAction[];
  variableContributions: Record<string, Record<string, number>>;
  inputSnapshot: ProjectInputs;
}

export interface ScenarioInput {
  name: string;
  description?: string;
  variableOverrides: Partial<ProjectInputs>;
}

export interface ScenarioResult {
  name: string;
  description?: string;
  scoreResult: ScoreResult;
  rasScore: number;
  isDominant: boolean;
  stabilityScore: number;
}

export interface ROIResult {
  reworkAvoided: number;
  procurementSavings: number;
  timeValueGain: number;
  specEfficiency: number;
  positioningPremium: number;
  totalValue: number;
  fee: number;
  netROI: number;
  roiMultiple: number;
}

export interface SensitivityEntry {
  variable: string;
  sensitivity: number;
  scoreUp: number;
  scoreDown: number;
}

// ─── Phase 10: Sales Premium & Yield Predictor ──────────────────────────────

export interface ScenarioRange {
  conservative: number;
  mid: number;
  aggressive: number;
}

export interface ValueAddInputs {
  currentFitoutPerSqm: number;    // AED/sqm — current or base fitout spend
  proposedFitoutPerSqm: number;   // AED/sqm — proposed upgraded fitout spend
  gfa: number;                     // total fitout area in sqm
  saleMedianPerSqm: number;       // DLD area median sale price AED/sqm
  rentMedianPerSqm?: number;      // DLD area median rent AED/sqm (annual)
  tier: MarketTier;
  handoverCondition?: HandoverCondition;
  transactionCount: number;        // number of DLD comparables in area
}

export type ValueAddConfidence = "high" | "medium" | "low" | "insufficient";

export interface ValueAddResult {
  yieldDelta: ScenarioRange;            // percentage point increase in gross yield
  salePremiumPct: ScenarioRange;        // % sale price uplift vs area median
  salePremiumAed: ScenarioRange;        // absolute AED uplift on total sale value
  paybackMonths: ScenarioRange;         // months to recover incremental fitout cost
  incrementalFitoutCost: number;        // AED total incremental investment
  fitoutRatio: number;                  // proposed fitout / sale price per sqm
  confidence: ValueAddConfidence;
  riskFlag: "OVER_SPEC" | "UNDER_SPEC" | "DIMINISHING_RETURNS" | null;
  riskMessage: string | null;
}

export interface BrandEquityInputs {
  tier: MarketTier;
  targetValueAdd: TargetValueAdd;
  salePerformancePct: number;     // % above area median this project is performing
  brandedStatus: BrandedStatus;
}

export interface BrandEquityResult {
  haloUpliftPct: number;          // uplift on developer's next project (clamped 0–8%)
  haloApplies: boolean;           // whether the halo effect is active
  reasoning: string;              // human-readable explanation
  portfolioImpactAed: ScenarioRange; // estimated AED impact on next project at 3 GFA scenarios
}
