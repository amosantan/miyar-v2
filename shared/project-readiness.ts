export const INPUT_PROVENANCE_STATUSES = ["explicit", "assumed", "ai_suggested", "confirmed"] as const;
export type InputProvenanceStatus = (typeof INPUT_PROVENANCE_STATUSES)[number];
export type InputProvenance = Record<string, InputProvenanceStatus>;

export const EVALUATION_REQUIRED_FIELDS = [
  "name",
  "ctx01Typology",
  "ctx02Scale",
  "ctx03Gfa",
  "ctx04Location",
  "ctx05Horizon",
  "projectPurpose",
  "str01BrandClarity",
  "str02Differentiation",
  "str03BuyerMaturity",
  "mkt01Tier",
  "mkt02Competitor",
  "mkt03Trend",
  "fin01BudgetCap",
  "fin02Flexibility",
  "fin03ShockTolerance",
  "fin04SalesPremium",
  "des01Style",
  "des02MaterialLevel",
  "des03Complexity",
  "des04Experience",
  "des05Sustainability",
  "exe01SupplyChain",
  "exe02Contractor",
  "exe03Approvals",
  "exe04QaMaturity",
] as const;

export type EvaluationRequiredField = (typeof EVALUATION_REQUIRED_FIELDS)[number];

export const EVALUATION_FIELD_LABELS: Record<EvaluationRequiredField, string> = {
  name: "Project name",
  ctx01Typology: "Typology",
  ctx02Scale: "Project scale",
  ctx03Gfa: "Gross floor area",
  ctx04Location: "Location class",
  ctx05Horizon: "Delivery horizon",
  projectPurpose: "Project purpose",
  str01BrandClarity: "Brand clarity",
  str02Differentiation: "Differentiation",
  str03BuyerMaturity: "Buyer maturity",
  mkt01Tier: "Market tier",
  mkt02Competitor: "Competitive position",
  mkt03Trend: "Trend alignment",
  fin01BudgetCap: "Budget cap",
  fin02Flexibility: "Budget flexibility",
  fin03ShockTolerance: "Cost-shock tolerance",
  fin04SalesPremium: "Target sales premium",
  des01Style: "Design style",
  des02MaterialLevel: "Material level",
  des03Complexity: "Design complexity",
  des04Experience: "Experience ambition",
  des05Sustainability: "Sustainability ambition",
  exe01SupplyChain: "Supply-chain readiness",
  exe02Contractor: "Contractor readiness",
  exe03Approvals: "Approvals readiness",
  exe04QaMaturity: "Quality-assurance maturity",
};

export type ProjectReadiness = {
  status: "ready" | "incomplete";
  policyVersion: "input-readiness-v1" | "legacy-compatible-v1";
  confirmedFields: EvaluationRequiredField[];
  unconfirmedAssumptions: EvaluationRequiredField[];
  missingInputs: EvaluationRequiredField[];
  canEvaluate: boolean;
  completionPercent: number;
};

function isMissing(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function getProjectReadiness(project: Record<string, unknown>): ProjectReadiness {
  const raw = project.inputProvenance;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      status: "ready",
      policyVersion: "legacy-compatible-v1",
      confirmedFields: [...EVALUATION_REQUIRED_FIELDS],
      unconfirmedAssumptions: [],
      missingInputs: [],
      canEvaluate: true,
      completionPercent: 100,
    };
  }

  const provenance = raw as InputProvenance;
  const missingInputs: EvaluationRequiredField[] = [];
  const confirmedFields: EvaluationRequiredField[] = [];
  const unconfirmedAssumptions: EvaluationRequiredField[] = [];

  for (const field of EVALUATION_REQUIRED_FIELDS) {
    if (isMissing(project[field])) {
      missingInputs.push(field);
      continue;
    }
    const status = provenance[field] ?? "assumed";
    if (status === "explicit" || status === "confirmed") confirmedFields.push(field);
    else unconfirmedAssumptions.push(field);
  }

  const canEvaluate = missingInputs.length === 0 && unconfirmedAssumptions.length === 0;
  return {
    status: canEvaluate ? "ready" : "incomplete",
    policyVersion: "input-readiness-v1",
    confirmedFields,
    unconfirmedAssumptions,
    missingInputs,
    canEvaluate,
    completionPercent: Math.round((confirmedFields.length / EVALUATION_REQUIRED_FIELDS.length) * 100),
  };
}

export function createInitialProvenance(supplied: Partial<InputProvenance> = {}): InputProvenance {
  return Object.fromEntries(
    EVALUATION_REQUIRED_FIELDS.map(field => [field, supplied[field] ?? (field === "name" ? "explicit" : "assumed")])
  ) as InputProvenance;
}
