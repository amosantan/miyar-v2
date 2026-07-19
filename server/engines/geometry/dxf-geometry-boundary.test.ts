import { describe, expect, it } from "vitest";

import { DXF_BOUNDARY_LIMITS } from "../../../shared/geometry";
import {
  BoundedDxfWorkerScheduler,
  DXF_WORKER_CONCURRENCY_LIMIT,
  DXF_WORKER_PENDING_LIMIT,
  DXF_WORKER_RESOURCE_LIMITS,
  inspectDxfGeometry,
} from "./dxf-geometry-boundary";

function ascii(source: string): Uint8Array {
  return Buffer.from(source, "ascii");
}

function rectangleDxf(
  options: {
    insUnits?: number;
    width?: string;
    height?: string;
    bulge?: string;
    extraEntity?: string;
  } = {}
): string {
  const {
    insUnits,
    width = "4",
    height = "3",
    bulge,
    extraEntity = "",
  } = options;
  const header =
    insUnits === undefined
      ? ""
      : `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${insUnits}\n0\nENDSEC\n`;
  const firstBulge = bulge === undefined ? "" : `42\n${bulge}\n`;
  return `${header}0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n5\nA1\n8\nRooms\n90\n4\n70\n1\n10\n0\n20\n0\n${firstBulge}10\n${width}\n20\n0\n10\n${width}\n20\n${height}\n10\n0\n20\n${height}\n${extraEntity}0\nENDSEC\n0\nEOF\n`;
}

function boundaryInput(source: string, selectedUnit?: "m" | "mm") {
  return {
    bytes: ascii(source),
    fileName: "rooms.dxf",
    mediaType: "application/dxf",
    sourceLineageId: "drawing-lineage-001",
    selectedUnit,
    levelElevation: "0",
  } as const;
}

function polylineEntity(
  vertices: Array<[string, string]>,
  layer: string,
  handle: string
): string {
  return `0\nLWPOLYLINE\n5\n${handle}\n8\n${layer}\n90\n${vertices.length}\n70\n1\n${vertices
    .map(([x, y]) => `10\n${x}\n20\n${y}\n`)
    .join("")}`;
}

function entitiesDxf(entities: string[]): string {
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities.join("")}0\nENDSEC\n0\nEOF\n`;
}

describe("DI-01 deterministic ASCII DXF boundary", () => {
  it("uses bounded worker concurrency and V8 memory resources", () => {
    expect(DXF_WORKER_CONCURRENCY_LIMIT).toBe(2);
    expect(DXF_WORKER_PENDING_LIMIT).toBe(8);
    expect(DXF_WORKER_RESOURCE_LIMITS).toEqual({
      maxOldGenerationSizeMb: 128,
      maxYoungGenerationSizeMb: 32,
      codeRangeSizeMb: 16,
      stackSizeMb: 4,
    });
  });

  it("rejects saturated work immediately and releases timed-out pending closures", async () => {
    const scheduler = new BoundedDxfWorkerScheduler(1, 1);
    let releaseActive: (() => void) | undefined;
    const active = scheduler.schedule(
      1_000,
      () =>
        new Promise<void>(resolve => {
          releaseActive = resolve;
        })
    );
    const pending = scheduler.schedule(5, async () => undefined);

    await expect(
      scheduler.schedule(1_000, async () => undefined)
    ).rejects.toThrow("capacity is full");
    await expect(pending).rejects.toThrow("exceeded its deadline");

    const replacement = scheduler.schedule(1_000, async () => "replacement");
    releaseActive?.();
    await expect(active).resolves.toBeUndefined();
    await expect(replacement).resolves.toBe("replacement");
  });

  it("imports an explicit metre DXF without guessing units", async () => {
    const result = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6 }))
    );

    expect(result.status).toBe("imported");
    expect(result.issue).toBeNull();
    expect(result.evidence).toMatchObject({
      sourceFormat: "ascii_dxf",
      headerInsUnits: 6,
      headerUnit: "m",
      selectedUnit: null,
      effectiveUnit: "m",
      byteLength: expect.any(Number),
      checksum: {
        algorithm: "sha256",
        value: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(result.inspection).toMatchObject({
      closedBoundaryCount: 1,
      vertexCount: 4,
    });
    expect(result.canonical?.geometry.rooms[0].areaSquareMetres).toBe("12");
    expect(result.levelOverlays).toHaveLength(1);
    expect(result.levelOverlays[0].rooms[0].sourcePoints).toHaveLength(5);
  });

  it("normalizes explicit millimetre coordinates deterministically", async () => {
    const result = await inspectDxfGeometry(
      boundaryInput(
        rectangleDxf({ insUnits: 4, width: "4000", height: "3000" })
      )
    );

    expect(result.status).toBe("imported");
    expect(result.evidence.effectiveUnit).toBe("mm");
    expect(result.canonical?.geometry.rooms[0].areaSquareMetres).toBe("12");
  });

  it("preserves exact coordinate lexemes through half-away micrometre rounding", async () => {
    const source = rectangleDxf({
      insUnits: 6,
      width: "1.00000049999999999",
      height: "1",
    });
    const result = await inspectDxfGeometry(boundaryInput(source));

    expect(result.status).toBe("imported");
    expect(result.levelOverlays[0].rooms[0].sourcePoints[1].x).toBe(
      "1.00000049999999999"
    );
    expect(result.levelOverlays[0].rooms[0].normalizedPoints[1].x).toBe(
      "1000000"
    );
  });

  it("keeps room identity stable across checksum, entity order, winding, start point, and layer changes", async () => {
    const roomA: Array<[string, string]> = [
      ["0", "0"],
      ["4", "0"],
      ["4", "3"],
      ["0", "3"],
    ];
    const roomB: Array<[string, string]> = [
      ["10", "0"],
      ["12", "0"],
      ["12", "2"],
      ["10", "2"],
    ];
    const first = await inspectDxfGeometry(
      boundaryInput(
        entitiesDxf([
          polylineEntity(roomA, "Rooms A", "A1"),
          polylineEntity(roomB, "Rooms B", "B1"),
        ])
      )
    );
    const second = await inspectDxfGeometry(
      boundaryInput(
        entitiesDxf([
          polylineEntity([roomB[2], roomB[1], roomB[0], roomB[3]], "Renamed B", "B1"),
          polylineEntity([roomA[2], roomA[1], roomA[0], roomA[3]], "Renamed A", "A1"),
        ])
      )
    );

    expect(first.status).toBe("imported");
    expect(second.status).toBe("imported");
    expect(first.evidence.checksum.value).not.toBe(
      second.evidence.checksum.value
    );
    const firstIds = first.levelOverlays
      .flatMap(level => level.rooms.map(room => room.sourceRoomId))
      .sort();
    const secondIds = second.levelOverlays
      .flatMap(level => level.rooms.map(room => room.sourceRoomId))
      .sort();
    expect(secondIds).toEqual(firstIds);
    expect(firstIds.every(id => id.length <= 64)).toBe(true);
  });

  it("keeps identity across boundary revisions when the DXF entity handle is stable", async () => {
    const first = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6, width: "4" }))
    );
    const revised = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6, width: "5" }))
    );

    expect(first.status).toBe("imported");
    expect(revised.status).toBe("imported");
    expect(revised.levelOverlays[0].rooms[0].sourceRoomId).toBe(
      first.levelOverlays[0].rooms[0].sourceRoomId
    );
    expect(revised.canonical?.fingerprint.value).not.toBe(
      first.canonical?.fingerprint.value
    );
  });

  it("keeps identical handles in unrelated drawing lineages as different rooms", async () => {
    const first = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6 }))
    );
    const unrelated = await inspectDxfGeometry({
      ...boundaryInput(rectangleDxf({ insUnits: 6 })),
      sourceLineageId: "drawing-lineage-002",
    });

    expect(unrelated.levelOverlays[0].rooms[0].sourceRoomId).not.toBe(
      first.levelOverlays[0].rooms[0].sourceRoomId
    );
  });

  it("rejects missing or duplicate DXF entity handles as non-canonical identity", async () => {
    const missing = await inspectDxfGeometry(
      boundaryInput(
        rectangleDxf({ insUnits: 6 }).replace("5\nA1\n", "")
      )
    );
    const duplicate = await inspectDxfGeometry(
      boundaryInput(
        entitiesDxf([
          polylineEntity([["0", "0"], ["1", "0"], ["1", "1"], ["0", "1"]], "A", "AA"),
          polylineEntity([["2", "0"], ["3", "0"], ["3", "1"], ["2", "1"]], "B", "AA"),
        ])
      )
    );

    expect(missing.issue?.code).toBe("missing_stable_entity_identity");
    expect(duplicate.issue?.code).toBe("duplicate_stable_entity_identity");
  });

  it("honours the declared level elevation", async () => {
    const result = await inspectDxfGeometry({
      ...boundaryInput(rectangleDxf({ insUnits: 6 })),
      levelElevation: "2.5",
    });

    expect(result.status).toBe("imported");
    expect(result.canonical?.geometry.rooms[0].levelElevationMicrometres).toBe(
      "2500000"
    );
    expect(result.levelOverlays[0].levelElevationMicrometres).toBe("2500000");
  });

  it("preserves unknown units as insufficiency until a unit is explicitly selected", async () => {
    const source = rectangleDxf();
    const unknown = await inspectDxfGeometry(boundaryInput(source));
    const selected = await inspectDxfGeometry(boundaryInput(source, "m"));

    expect(unknown).toMatchObject({
      status: "insufficient_information",
      issue: { code: "unknown_source_units" },
      evidence: { headerUnit: null, selectedUnit: null, effectiveUnit: null },
    });
    expect(unknown.inspection?.closedBoundaryCount).toBe(1);
    expect(selected.status).toBe("imported");
    expect(selected.evidence).toMatchObject({
      selectedUnit: "m",
      effectiveUnit: "m",
    });
  });

  it("does not allow a selected unit to override conflicting or unsupported header units", async () => {
    const conflict = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6 }), "mm")
    );
    const inches = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 1 }), "m")
    );

    expect(conflict).toMatchObject({
      status: "conflicting_information",
      issue: { code: "source_unit_conflict" },
    });
    expect(inches).toMatchObject({
      status: "insufficient_information",
      issue: { code: "unsupported_source_units" },
    });
  });

  it.each([
    ["drawing.dwg", rectangleDxf({ insUnits: 6 }), "dwg_not_supported"],
    ["drawing.txt", rectangleDxf({ insUnits: 6 }), "spoofed_file"],
    ["drawing.dxf", "this is not a drawing", "spoofed_file"],
    [
      "drawing.dxf",
      "AutoCAD Binary DXF\r\n\u001a\u0000",
      "binary_dxf_not_supported",
    ],
  ])(
    "rejects spoofed or binary sources (%s)",
    async (fileName, source, code) => {
      const result = await inspectDxfGeometry({
        bytes: Buffer.from(source, "binary"),
        fileName,
        levelElevation: "0",
      });
      expect(result).toMatchObject({ status: "rejected", issue: { code } });
      expect(result.evidence.checksum.value).toMatch(/^[a-f0-9]{64}$/);
    }
  );

  it("rejects a DXF-shaped payload carrying a conflicting media type", async () => {
    const result = await inspectDxfGeometry({
      ...boundaryInput(rectangleDxf({ insUnits: 6 })),
      mediaType: "image/png",
    });
    expect(result).toMatchObject({
      status: "rejected",
      issue: { code: "spoofed_file" },
    });
  });

  it("rejects unsupported curves and polyline bulges instead of flattening them", async () => {
    const arc = "0\nARC\n8\nDoors\n10\n2\n20\n2\n40\n1\n50\n0\n51\n90\n";
    const curved = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6, extraEntity: arc }))
    );
    const bulged = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6, bulge: "0.25" }))
    );

    expect(curved).toMatchObject({
      status: "rejected",
      issue: { code: "unsupported_curve" },
    });
    expect(bulged).toMatchObject({
      status: "rejected",
      issue: { code: "unsupported_bulge" },
    });
  });

  it("rejects malformed polygon topology", async () => {
    const bowTie = rectangleDxf({ insUnits: 6 }).replace(
      "10\n4\n20\n0\n10\n4\n20\n3\n10\n0\n20\n3",
      "10\n4\n20\n3\n10\n4\n20\n0\n10\n0\n20\n3"
    );
    const result = await inspectDxfGeometry(boundaryInput(bowTie));
    expect(result).toMatchObject({
      status: "rejected",
      issue: { code: "malformed_topology" },
    });
  });

  it("rejects non-planar room polylines instead of flattening entity Z", async () => {
    const source = rectangleDxf({ insUnits: 6 }).replace(
      "90\n4\n70\n1",
      "90\n4\n70\n1\n38\n0.25"
    );
    const result = await inspectDxfGeometry(boundaryInput(source));

    expect(result).toMatchObject({
      status: "rejected",
      issue: { code: "malformed_topology" },
    });
  });

  it("enforces the coordinate bound from exact source lexemes", async () => {
    const result = await inspectDxfGeometry(
      boundaryInput(
        rectangleDxf({ insUnits: 6, width: "1000000000.00000000001" })
      )
    );

    expect(result).toMatchObject({
      status: "rejected",
      issue: { code: "coordinate_limit_exceeded" },
    });
  });

  it("rejects sources above the byte limit before parsing", async () => {
    const bytes = new Uint8Array(DXF_BOUNDARY_LIMITS.sourceBytes + 1);
    bytes.fill(65);
    const result = await inspectDxfGeometry({
      bytes,
      fileName: "large.dxf",
      levelElevation: "0",
    });
    expect(result).toMatchObject({
      status: "rejected",
      issue: { code: "source_too_large" },
    });
    expect(result.inspection).toBeNull();
  });

  it.each([
    [{ entityCount: 100_001 }, "entity_limit_exceeded"],
    [{ vertexCount: 100_001 }, "vertex_limit_exceeded"],
    [{ layerCount: 2_001 }, "layer_limit_exceeded"],
    [{ maximumBlockNestingDepth: 33 }, "nesting_limit_exceeded"],
    [{ exceedsCoordinateLimit: true }, "coordinate_limit_exceeded"],
  ])(
    "fails closed when structural inspection exceeds a limit",
    async (change, code) => {
      const inspected = {
        headerInsUnits: 6,
        entityCount: 1,
        vertexCount: 4,
        layerCount: 1,
        maximumBlockNestingDepth: 0,
        closedBoundaryCount: 1,
        boundaries: [],
        unsupportedCurveType: null,
        hasUnsupportedBulge: false,
        hasNonFiniteCoordinate: false,
        exceedsCoordinateLimit: false,
        hasNonPlanarCoordinate: false,
        hasUnsupportedBlockReference: false,
        ...change,
      };
      const result = await inspectDxfGeometry(
        boundaryInput(rectangleDxf({ insUnits: 6 })),
        {
          inspect: async () => inspected,
        }
      );
      expect(result).toMatchObject({ status: "rejected", issue: { code } });
      expect(result.inspection).not.toBeNull();
    }
  );

  it("rejects block-contained geometry rather than ignoring INSERT transforms", async () => {
    const inspected = {
      headerInsUnits: 6,
      entityCount: 2,
      vertexCount: 4,
      layerCount: 1,
      maximumBlockNestingDepth: 1,
      closedBoundaryCount: 1,
      boundaries: [],
      unsupportedCurveType: null,
      hasUnsupportedBulge: false,
      hasNonFiniteCoordinate: false,
      exceedsCoordinateLimit: false,
      hasNonPlanarCoordinate: false,
      hasUnsupportedBlockReference: true,
    };
    const result = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6 })),
      { inspect: async () => inspected }
    );
    expect(result).toMatchObject({
      status: "rejected",
      issue: { code: "unsupported_block_reference" },
    });
  });

  it("terminates an injected stalled inspection at the bounded deadline", async () => {
    const result = await inspectDxfGeometry(
      boundaryInput(rectangleDxf({ insUnits: 6 })),
      {
        inspect: () => new Promise(() => undefined),
        deadlineMilliseconds: 2,
      }
    );
    expect(result).toMatchObject({
      status: "rejected",
      issue: { code: "deadline_exceeded" },
    });
  });
});
