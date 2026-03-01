/**
 * MIYAR Sensitivity Analysis Engine
 * Performs one-at-a-time perturbation to identify which variables
 * most influence the composite score.
 */
import type { ProjectInputs, SensitivityEntry } from "../../shared/miyar-types";
import { evaluate, type EvaluationConfig } from "./scoring";

const PERTURBABLE_FIELDS: { key: keyof ProjectInputs; step: number; type: "ordinal" | "numeric" }[] = [
  { key: "str01BrandClarity", step: 1, type: "ordinal" },
  { key: "str02Differentiation", step: 1, type: "ordinal" },
  { key: "str03BuyerMaturity", step: 1, type: "ordinal" },
  { key: "mkt02Competitor", step: 1, type: "ordinal" },
  { key: "mkt03Trend", step: 1, type: "ordinal" },
  { key: "fin02Flexibility", step: 1, type: "ordinal" },
  { key: "fin03ShockTolerance", step: 1, type: "ordinal" },
  { key: "fin04SalesPremium", step: 1, type: "ordinal" },
  { key: "des02MaterialLevel", step: 1, type: "ordinal" },
  { key: "des03Complexity", step: 1, type: "ordinal" },
  { key: "des04Experience", step: 1, type: "ordinal" },
  { key: "des05Sustainability", step: 1, type: "ordinal" },
  { key: "exe01SupplyChain", step: 1, type: "ordinal" },
  { key: "exe02Contractor", step: 1, type: "ordinal" },
  { key: "exe03Approvals", step: 1, type: "ordinal" },
  { key: "exe04QaMaturity", step: 1, type: "ordinal" },
  { key: "fin01BudgetCap", step: 50, type: "numeric" },
  { key: "spaceEfficiencyScore", step: 10, type: "numeric" },  // Phase 9: floor plan quality
];

export function runSensitivityAnalysis(
  baseInputs: ProjectInputs,
  config: EvaluationConfig
): SensitivityEntry[] {
  const baseResult = evaluate(baseInputs, config);
  const baseScore = baseResult.compositeScore;
  const entries: SensitivityEntry[] = [];

  for (const field of PERTURBABLE_FIELDS) {
    const currentVal = baseInputs[field.key] as number | null;
    if (currentVal === null || currentVal === undefined) continue;

    // Perturb up
    const upInputs = { ...baseInputs };
    const upVal = field.type === "ordinal"
      ? Math.min(5, (currentVal as number) + field.step)
      : (currentVal as number) + field.step;
    (upInputs as Record<string, unknown>)[field.key] = upVal;
    const upResult = evaluate(upInputs, config);

    // Perturb down
    const downInputs = { ...baseInputs };
    const downVal = field.type === "ordinal"
      ? Math.max(1, (currentVal as number) - field.step)
      : Math.max(0, (currentVal as number) - field.step);
    (downInputs as Record<string, unknown>)[field.key] = downVal;
    const downResult = evaluate(downInputs, config);

    const sensitivity = Math.abs(upResult.compositeScore - downResult.compositeScore);

    entries.push({
      variable: field.key,
      sensitivity: Math.round(sensitivity * 100) / 100,
      scoreUp: Math.round(upResult.compositeScore * 100) / 100,
      scoreDown: Math.round(downResult.compositeScore * 100) / 100,
    });
  }

  return entries.sort((a, b) => b.sensitivity - a.sensitivity);
}
