import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("../_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { analyzeFloorPlan } from "./design/floor-plan-analyzer";
import { extractRoomsFromMedia } from "./pdf-extraction";
import type { ValidatedMedia } from "../_core/media-validation";

const media: ValidatedMedia = {
  buffer: Buffer.from("validated-pdf"),
  mimeType: "application/pdf",
  kind: "pdf",
  sizeBytes: 13,
  checksum: "f".repeat(64),
};

describe("validated multimodal floor-plan contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends server-validated PDF media to both floor-plan paths without a URL", async () => {
    mocks.invokeLLM
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        rooms: [{ name: "Living", type: "living", estimatedSqm: 30, percentOfTotal: 100, finishGrade: "A" }],
        bedroomCount: 0, bathroomCount: 0, unitType: "Studio", analysisConfidence: "high", rawNotes: "" ,
      }) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        rooms: [{ name: "Living", areaSqm: 30, confidence: 0.9, category: "living" }], totalArea: 30,
      }) } }] });

    await expect(analyzeFloorPlan(media)).resolves.toMatchObject({ totalEstimatedSqm: 30, rooms: [{ name: "Living" }] });
    await expect(extractRoomsFromMedia(media)).resolves.toMatchObject({ totalArea: 30, rooms: [{ name: "Living" }] });

    for (const [params] of mocks.invokeLLM.mock.calls) {
      expect(JSON.stringify(params)).not.toContain("file_url");
      expect(JSON.stringify(params)).not.toContain("image_url");
      expect(JSON.stringify(params)).toContain("application/pdf");
    }
  });

  it("turns malformed model output into a stable provider-invalid-response error", async () => {
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: "not-json" } }] });

    await expect(analyzeFloorPlan(media)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
    await expect(extractRoomsFromMedia(media)).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });
});
