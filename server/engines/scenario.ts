/**
 * MIYAR Scenario Simulation Engine
 * Runs multiple what-if scenarios by applying variable overrides
 * and identifies the dominant (best-performing) scenario.
 */
import type { ProjectInputs, ScenarioInput, ScenarioResult } from "../../shared/miyar-types";
import { evaluate, type EvaluationConfig } from "./scoring";

export function runScenario(
  baseInputs: ProjectInputs,
  scenario: ScenarioInput,
  config: EvaluationConfig
): ScenarioResult {
  // Apply overrides
  const scenarioInputs: ProjectInputs = {
    ...baseInputs,
    ...scenario.variableOverrides,
  };

  const scoreResult = evaluate(scenarioInputs, config);

  return {
    name: scenario.name,
    description: scenario.description,
    scoreResult,
    rasScore: scoreResult.rasScore,
    isDominant: false,
    stabilityScore: 0,
  };
}

export function runScenarioComparison(
  baseInputs: ProjectInputs,
  scenarios: ScenarioInput[],
  config: EvaluationConfig
): ScenarioResult[] {
  // Run all scenarios
  const results = scenarios.map((s) => runScenario(baseInputs, s, config));

  // Find dominant scenario (highest RAS)
  let maxRas = -Infinity;
  let dominantIdx = 0;
  results.forEach((r, i) => {
    if (r.rasScore > maxRas) {
      maxRas = r.rasScore;
      dominantIdx = i;
    }
  });

  // Calculate stability: how close each scenario is to the dominant
  results.forEach((r, i) => {
    if (i === dominantIdx) {
      r.isDominant = true;
      r.stabilityScore = 100;
    } else {
      const diff = Math.abs(r.rasScore - maxRas);
      r.stabilityScore = Math.max(0, Math.round((1 - diff / 100) * 100 * 100) / 100);
    }
  });

  return results;
}
