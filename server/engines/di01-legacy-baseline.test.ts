import { describe, expect, it } from "vitest";
import {
  legacyAiProject,
  legacyDxfMetres,
  legacyDxfMillimetres,
  legacyDxfUnknownUnits,
  legacyLockedAllocations,
  legacyManualProjectAreas,
  legacyMaterialPrices,
  legacyMqiRooms,
  legacyPdfExtraction,
  legacyStoredRooms,
  legacyTemplateProject,
} from "../../tests/fixtures/di01/legacy-geometry-fixtures";
import { buildSpaceProgram } from "./design/space-program";
import { extractSpaceProgram } from "./design/space-program-extractor";
import { calculateSurfaceAreas } from "./design/material-quantity-engine";
import { parseDxf } from "./intake/dwg-parser";
import { buildWorkflowSpaceMqiReconciliation } from "./report-reconciliation";
import { getPricingArea } from "./area-utils";

describe("DI-01 provider-free legacy geometry baseline", () => {
  it("freezes the current residential template path", () => {
    const result = buildSpaceProgram(legacyTemplateProject);
    expect(result.source).toBe("template");
    expect(result.rooms.map(room => [room.id, room.sqm])).toEqual([
      ["LVG", 28], ["MBR", 18], ["MEN", 8], ["KIT", 10], ["BD2", 10],
      ["BD3", 8], ["BTH", 5], ["ENT", 8], ["UTL", 5],
    ]);
    expect(result.totalAllocatedSqm).toBe(100);
  });

  it("freezes manual/stored-room shape without treating its short code as canonical", () => {
    expect(getPricingArea(legacyManualProjectAreas)).toBe(60);
    expect(legacyStoredRooms).toMatchObject([
      { roomCode: "LVG", sqm: "40.00", source: "user_manual" },
      { roomCode: "BTH", sqm: "20.00", source: "typology_default" },
    ]);
    expect(legacyStoredRooms.reduce((sum, room) => sum + Number(room.sqm), 0)).toBe(60);
  });

  it("freezes the current AI/image-shaped project JSON path", () => {
    const result = buildSpaceProgram(legacyAiProject);
    expect(result.source).toBe("floor_plan");
    expect(result.rooms.map(room => [room.id, room.name, room.sqm])).toEqual([
      ["LIV1", "Living", 40],
      ["BAT2", "Bathroom", 20],
    ]);
  });

  it("freezes the provider-free PDF extraction storage shape", () => {
    expect(legacyPdfExtraction.totalExtractedArea).toBe("60.00");
    expect(legacyPdfExtraction.extractedRooms.reduce((sum, room) => sum + room.areaSqm, 0)).toBe(60);
    expect(legacyPdfExtraction.extractedRooms.every(room => room.confidence < 1)).toBe(true);
  });

  it("freezes the current DXF magnitude heuristic for explicit and unknown units", async () => {
    const [metres, millimetres, unknown] = await Promise.all([
      parseDxf(legacyDxfMetres),
      parseDxf(legacyDxfMillimetres),
      parseDxf(legacyDxfUnknownUnits),
    ]);
    expect(metres.rooms[0]?.sqm).toBe(20);
    expect(millimetres.rooms[0]?.sqm).toBe(20);
    expect(unknown.rooms[0]?.sqm).toBe(20);
    expect(metres.rooms[0]?.name).toBe("Living");
  });

  it("freezes the current extractor file path without external providers", async () => {
    const result = await extractSpaceProgram({
      projectId: 101,
      organizationId: 7,
      typology: "residential",
      gfa: 100,
      fileContent: legacyDxfMillimetres,
      fileExtension: "dxf",
      originalFilename: "legacy-plan.dxf",
    });
    expect(result.source).toBe("file_extraction");
    expect(result.rooms).toMatchObject([
      { organizationId: 7, projectId: 101, roomCode: "LVG1", sqm: "20", source: "file_extraction" },
    ]);
  });

  it("freezes MQI surfaces as deterministic estimates", () => {
    const surfaces = calculateSurfaceAreas(legacyMqiRooms, 2.8);
    expect(surfaces).toMatchObject([
      { roomId: "LVG", floorM2: 40, ceilingM2: 38 },
      { roomId: "BTH", floorM2: 20, ceilingM2: 19 },
    ]);
    expect(surfaces.reduce((sum, room) => sum + room.floorM2, 0)).toBe(60);
  });

  it("freezes report reconciliation and locked allocation behavior", () => {
    const result = buildWorkflowSpaceMqiReconciliation({
      projectFitOutAreaM2: 60,
      rooms: legacyStoredRooms,
      allocations: legacyLockedAllocations,
      materialLibrary: legacyMaterialPrices,
    });
    expect(result.spaceProgram).toMatchObject({ fitOutRoomAreaM2: 60, reconciles: true });
    expect(result.allocations).toMatchObject({ lockedRowCount: 2, lockedGroupCount: 1, allGroupsPass100Pct: true });
    expect(result.materialCosts).toMatchObject({ currency: "AED", allAllocationsPriced: true });
  });
});
