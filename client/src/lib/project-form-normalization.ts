const NUMERIC_PROJECT_FIELDS = new Set([
  "ctx03Gfa",
  "dldAreaId",
  "fin01BudgetCap",
  "officeCustomRatio",
  "str01BrandClarity",
  "str02Differentiation",
  "str03BuyerMaturity",
  "mkt02Competitor",
  "mkt03Trend",
  "fin02Flexibility",
  "fin03ShockTolerance",
  "fin04SalesPremium",
  "des02MaterialLevel",
  "des03Complexity",
  "des04Experience",
  "des05Sustainability",
  "exe01SupplyChain",
  "exe02Contractor",
  "exe03Approvals",
  "exe04QaMaturity",
]);

export function normalizeProjectFormValue(field: string, value: unknown): unknown {
  if (field === "description") return value == null ? "" : String(value);
  if (!NUMERIC_PROJECT_FIELDS.has(field)) return value;
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function normalizeProjectFormInitialData(
  input: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!input) return {};
  return Object.fromEntries(
    Object.entries(input).flatMap(([field, value]) => {
      const normalized = normalizeProjectFormValue(field, value);
      return normalized === undefined ? [] : [[field, normalized]];
    })
  );
}
