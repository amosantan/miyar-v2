import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("../_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { processIntakeAssets } from "./intake/ai-intake-engine";

describe("AI intake result contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves explicit project inputs even when the model suggests another value", async () => {
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      suggestedInputs: { ctx01Typology: "hospitality", ctx02Scale: "large" },
      confidence: { ctx01Typology: "high", ctx02Scale: "medium" },
      reasoning: { ctx01Typology: "model guess", ctx02Scale: "document evidence" },
      extractedInsights: {},
      warnings: [],
    }) } }] });

    const result = await processIntakeAssets(
      [{ type: "text_note", textContent: "A large development" }],
      { ctx01Typology: "residential_multi" },
    );

    expect(result.suggestedInputs).toEqual({ ctx02Scale: "large" });
    expect(result.confidence.ctx01Typology).toBeUndefined();
    expect(result.reasoning.ctx01Typology).toBeUndefined();
  });

  it("rejects malformed structured output with the shared safe code", async () => {
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });

    await expect(processIntakeAssets([{ type: "text_note", textContent: "x" }]))
      .rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });
});
