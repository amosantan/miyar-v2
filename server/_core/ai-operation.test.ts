import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AiOperationError, toAiOperationFailure } from "./ai-operation";
import { formatAiOperationError, withReference } from "../../client/src/lib/ai-operation-error";

const root = path.resolve(import.meta.dirname, "../..");

describe("AI operation error contract", () => {
  it("maps provider causes to a safe message and correlation reference", () => {
    const failure = toAiOperationFailure(new AiOperationError("PROVIDER_REJECTED_INPUT", {
      operation: "test",
      correlationId: "reference-123",
      cause: new Error("Gemini key=secret and provider-body"),
    }), "test");

    expect(failure).toEqual(expect.objectContaining({
      code: "PROVIDER_REJECTED_INPUT",
      retryable: false,
      referenceId: "reference-123",
    }));
    expect(failure.message).not.toContain("secret");
    expect(withReference(formatAiOperationError({ data: { aiCode: failure.code, correlationId: failure.referenceId } }, "fallback")))
      .toContain("Reference: reference-123");
  });
});

describe("AI/media architecture guardrails", () => {
  it("allows direct Gemini REST endpoints only inside the shared operation boundary", async () => {
    const files = [
      "server/_core/llm.ts",
      "server/_core/imageGeneration.ts",
      "server/engines/design/ai-design-advisor.ts",
      "server/engines/intake/ai-intake-engine.ts",
      "server/routers/intake.ts",
      "server/routers/design-assets.ts",
      "server/routers/design-boards.ts",
      "server/routers/design-briefs.ts",
      "server/routers/design-collaboration.ts",
      "server/routers/design-market-context.ts",
      "server/routers/design-materials.ts",
      "server/routers/design-sharing.ts",
      "server/routers/design-visuals.ts",
    ];
    const endpointOwners: string[] = [];
    for (const file of files) {
      const source = await readFile(path.join(root, file), "utf8");
      if (source.includes("generativelanguage.googleapis.com")) endpointOwners.push(file);
    }
    expect(endpointOwners).toEqual([
      "server/_core/llm.ts",
      "server/_core/imageGeneration.ts",
    ]);
  });

  it("does not permit customer AI surfaces to render raw operation errors", async () => {
    const customerSurfaces = [
      "client/src/components/AiAssistantPanel.tsx",
      "client/src/components/PageErrorBoundary.tsx",
      "client/src/components/ProjectForm.tsx",
      "client/src/pages/Dashboard.tsx",
      "client/src/pages/DesignAdvisor.tsx",
      "client/src/pages/DesignBrief.tsx",
      "client/src/pages/DesignStudio.tsx",
      "client/src/pages/VisualStudio.tsx",
      "client/src/pages/market-intel/AnalyticsDashboard.tsx",
    ];
    for (const file of customerSurfaces) {
      const source = await readFile(path.join(root, file), "utf8");
      expect(source, file).not.toMatch(/\b(?:err|error)\.message\b|\bresult\.error\b/);
    }
  });

  it("does not reintroduce provider-bound caller URLs into multimedia intake", async () => {
    const mediaBoundaryFiles = [
      "server/engines/intake/ai-intake-engine.ts",
      "server/engines/design/floor-plan-analyzer.ts",
      "server/engines/pdf-extraction.ts",
    ];
    for (const file of mediaBoundaryFiles) {
      const source = await readFile(path.join(root, file), "utf8");
      expect(source, file).not.toMatch(/\b(?:imageUrl|fileUrl|assetUrl)\b|type:\s*["'](?:image_url|file_url)["']/);
    }
  });
});
