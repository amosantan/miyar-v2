import { describe, expect, it, vi } from "vitest";

import {
  GEOMETRY_SCHEMA_VERSION,
  ROOM_FLOOR_POLYGON_AREA,
  type GeometryCanonicalizationInput,
  type GeometryInputPoint,
} from "../../../shared/geometry";
import {
  canonicalizeGeometry,
  decimalCoordinateToMicrometres,
  GeometryDeadlineError,
  reconcileRoomFloorAreas,
} from "./canonical-geometry";

function points(values: Array<[string, string]>): GeometryInputPoint[] {
  return values.map(([x, y]) => ({ x, y }));
}

const squareMetres = points([
  ["0", "0"],
  ["4", "0"],
  ["4", "3"],
  ["0", "3"],
  ["0", "0"],
]);

function input(
  outerRing: GeometryInputPoint[] = squareMetres,
  overrides: Partial<GeometryCanonicalizationInput> = {}
): GeometryCanonicalizationInput {
  return {
    schemaVersion: GEOMETRY_SCHEMA_VERSION,
    measurementBasis: ROOM_FLOOR_POLYGON_AREA,
    sourceUnit: "m",
    rooms: [{ spaceId: "space-001", levelElevation: "0", outerRing }],
    ...overrides,
  };
}

function reverseClosed(ring: GeometryInputPoint[]): GeometryInputPoint[] {
  const open = ring.slice(0, -1).reverse();
  return [...open, open[0]];
}

function rotateClosed(
  ring: GeometryInputPoint[],
  amount: number
): GeometryInputPoint[] {
  const open = ring.slice(0, -1);
  const offset = ((amount % open.length) + open.length) % open.length;
  const rotated = [...open.slice(offset), ...open.slice(0, offset)];
  return [...rotated, rotated[0]];
}

describe("MIYAR_GEOM_V1 decimal normalization", () => {
  it.each([
    ["1.2345674", "m", 1_234_567n],
    ["1.2345675", "m", 1_234_568n],
    ["-1.2345675", "m", -1_234_568n],
    ["0.0000005", "m", 1n],
    ["-0.0000005", "m", -1n],
    ["1234.5674", "mm", 1_234_567n],
    ["1234.5675", "mm", 1_234_568n],
  ] as const)(
    "converts %s %s to micrometres half away from zero",
    (value, unit, expected) => {
      expect(decimalCoordinateToMicrometres(value, unit)).toBe(expected);
    }
  );

  it("rejects exponential, non-finite, excessive, and out-of-bound coordinates", () => {
    for (const value of [
      "1e3",
      "NaN",
      "Infinity",
      "",
      "1.2.3",
      "1000000000.0000001",
    ]) {
      expect(() => decimalCoordinateToMicrometres(value, "m")).toThrow(
        /Invalid MIYAR geometry/
      );
    }
    expect(() =>
      decimalCoordinateToMicrometres(
        "1234567890123456789012345678901234567",
        "mm"
      )
    ).toThrow(/precision/);
  });
});

describe("MIYAR_GEOM_V1 canonical room polygons", () => {
  it("fails closed when a caller's normalization deadline is exhausted", () => {
    expect(() =>
      canonicalizeGeometry(input(), { deadlineAtMilliseconds: 0 })
    ).toThrow(GeometryDeadlineError);
  });

  it("checks the deadline while removing redundant vertices", () => {
    const now = vi.spyOn(Date, "now");
    let checks = 0;
    now.mockImplementation(() => (checks++ < 3 ? 0 : 2));
    try {
      expect(() =>
        canonicalizeGeometry(
          input(
            points([
              ["0", "0"],
              ["1", "0"],
              ["2", "0"],
              ["2", "1"],
              ["0", "1"],
              ["0", "0"],
            ])
          ),
          { deadlineAtMilliseconds: 1 }
        )
      ).toThrow(GeometryDeadlineError);
    } finally {
      now.mockRestore();
    }
  });

  it("produces an exact deterministic room-floor area and domain-separated fingerprint", () => {
    const result = canonicalizeGeometry(input());

    expect(result.geometry.rooms[0].areaSquareMetres).toBe("12");
    expect(result.geometry.rooms[0].areaSquareMicrometresTwice).toBe(
      "24000000000000"
    );
    expect(result.geometry.rooms[0].outerRing.points).toEqual(
      points([
        ["0", "0"],
        ["4000000", "0"],
        ["4000000", "3000000"],
        ["0", "3000000"],
        ["0", "0"],
      ])
    );
    expect(result.fingerprint).toEqual({
      algorithm: "sha256",
      domain: "MIYAR_GEOM_V1:canonical_geometry",
      value: "034ff6194361c4b6739a5f544b5ee2aeb619d131462e892949f34848df4f8239",
    });
    expect(JSON.parse(result.canonicalJson)).toEqual(result.geometry);
    expect(canonicalizeGeometry(input()).fingerprint.value).toBe(
      result.fingerprint.value
    );
  });

  it("canonicalizes winding, start point, duplicate points, and collinear vertices", () => {
    const noisy = points([
      ["4", "3"],
      ["2", "3"],
      ["0", "3"],
      ["0", "0"],
      ["0", "0"],
      ["2", "0"],
      ["4", "0"],
      ["4", "3"],
    ]);
    const canonical = canonicalizeGeometry(input(squareMetres));
    const normalized = canonicalizeGeometry(input(reverseClosed(noisy)));

    expect(normalized.canonicalJson).toBe(canonical.canonicalJson);
    expect(normalized.fingerprint.value).toBe(canonical.fingerprint.value);
  });

  it("sorts rooms and holes independently of input order", () => {
    const outer = points([
      ["0", "0"],
      ["10", "0"],
      ["10", "10"],
      ["0", "10"],
      ["0", "0"],
    ]);
    const holeA = points([
      ["1", "1"],
      ["2", "1"],
      ["2", "2"],
      ["1", "2"],
      ["1", "1"],
    ]);
    const holeB = points([
      ["7", "7"],
      ["9", "7"],
      ["9", "9"],
      ["7", "9"],
      ["7", "7"],
    ]);
    const roomA = {
      spaceId: "space-a",
      levelElevation: "0",
      outerRing: outer,
      holes: [holeB, holeA],
    };
    const roomB = {
      spaceId: "space-b",
      levelElevation: "0",
      outerRing: points([
        ["12", "0"],
        ["16", "0"],
        ["16", "3"],
        ["12", "3"],
        ["12", "0"],
      ]),
    };
    const first = canonicalizeGeometry(input(outer, { rooms: [roomB, roomA] }));
    const second = canonicalizeGeometry(
      input(outer, {
        rooms: [
          {
            ...roomA,
            outerRing: reverseClosed(outer),
            holes: [reverseClosed(holeA), reverseClosed(holeB)],
          },
          roomB,
        ],
      })
    );

    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.geometry.rooms.map(room => room.spaceId)).toEqual([
      "space-a",
      "space-b",
    ]);
    expect(first.geometry.rooms[0].areaSquareMetres).toBe("95");
  });

  it("keeps area invariant under exact translations and quarter-turn rotations", () => {
    const translations: Array<[bigint, bigint]> = [
      [0n, 0n],
      [17n, -22n],
      [-1_000_000n, 2_000_000n],
    ];
    const base: Array<[bigint, bigint]> = [
      [0n, 0n],
      [7n, 0n],
      [7n, 3n],
      [2n, 5n],
      [0n, 3n],
    ];
    const baseline = canonicalizeGeometry(
      input(
        points([...base, base[0]].map(([x, y]) => [x.toString(), y.toString()]))
      )
    ).geometry.rooms[0].areaSquareMicrometresTwice;

    for (const [dx, dy] of translations) {
      for (let turns = 0; turns < 4; turns += 1) {
        const transformed = base.map(([initialX, initialY]) => {
          let x = initialX;
          let y = initialY;
          for (let turn = 0; turn < turns; turn += 1) [x, y] = [-y, x];
          return [x + dx, y + dy] as const;
        });
        const ring = points(
          [...transformed, transformed[0]].map(([x, y]) => [
            x.toString(),
            y.toString(),
          ])
        );
        expect(
          canonicalizeGeometry(input(rotateClosed(ring, turns))).geometry
            .rooms[0].areaSquareMicrometresTwice
        ).toBe(baseline);
      }
    }
  });

  it("normalizes equivalent metre and millimetre geometry to identical coordinates and area", () => {
    const metres = canonicalizeGeometry(input());
    const millimetres = canonicalizeGeometry(
      input(
        points([
          ["0", "0"],
          ["4000", "0"],
          ["4000", "3000"],
          ["0", "3000"],
          ["0", "0"],
        ]),
        { sourceUnit: "mm" }
      )
    );

    expect(millimetres.geometry.rooms[0]).toEqual(metres.geometry.rooms[0]);
    expect(millimetres.geometry.normalization.sourceUnit).toBe("mm");
    expect(millimetres.fingerprint.value).not.toBe(metres.fingerprint.value);
  });

  it("applies the optional 1 mm snap explicitly and half away from zero", () => {
    const snapped = canonicalizeGeometry(
      input(
        points([
          ["-0.0005", "-0.0005"],
          ["1.0004", "-0.0005"],
          ["1.0004", "1.0004"],
          ["-0.0005", "1.0004"],
          ["-0.0005", "-0.0005"],
        ]),
        { snapTransform: "1mm" }
      )
    );

    expect(snapped.geometry.rooms[0].outerRing.points[0]).toEqual({
      x: "-1000",
      y: "-1000",
    });
    expect(snapped.geometry.normalization.snapTransform).toBe("1mm");
  });

  it("subtracts holes exactly, including half-square-micrometre results", () => {
    const tiny = points([
      ["0", "0"],
      ["0.000001", "0"],
      ["0", "0.000001"],
      ["0", "0"],
    ]);
    expect(
      canonicalizeGeometry(input(tiny)).geometry.rooms[0].areaSquareMetres
    ).toBe("0.0000000000005");

    const result = canonicalizeGeometry(
      input(
        points([
          ["0", "0"],
          ["5", "0"],
          ["5", "5"],
          ["0", "5"],
          ["0", "0"],
        ]),
        {
          rooms: [
            {
              spaceId: "space-001",
              levelElevation: "0",
              outerRing: points([
                ["0", "0"],
                ["5", "0"],
                ["5", "5"],
                ["0", "5"],
                ["0", "0"],
              ]),
              holes: [
                points([
                  ["1", "1"],
                  ["2", "1"],
                  ["2", "3"],
                  ["1", "3"],
                  ["1", "1"],
                ]),
              ],
            },
          ],
        }
      )
    );
    expect(result.geometry.rooms[0].areaSquareMetres).toBe("23");
  });

  it("assigns direction-independent stable IDs to shared edges at the same elevation", () => {
    const result = canonicalizeGeometry(
      input(squareMetres, {
        rooms: [
          { spaceId: "left", levelElevation: "0", outerRing: squareMetres },
          {
            spaceId: "right",
            levelElevation: "0",
            outerRing: points([
              ["4", "0"],
              ["8", "0"],
              ["8", "3"],
              ["4", "3"],
              ["4", "0"],
            ]),
          },
        ],
      })
    );
    const [left, right] = result.geometry.rooms;
    const shared = left.outerRing.edges.find(
      edge => edge.start.x === "4000000" && edge.end.x === "4000000"
    );
    const reverse = right.outerRing.edges.find(
      edge => edge.start.x === "4000000" && edge.end.x === "4000000"
    );

    expect(shared?.edgeId).toBe(reverse?.edgeId);
    expect(shared?.edgeId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects duplicate and overlapping room footprints on the same level", () => {
    expect(() =>
      canonicalizeGeometry(
        input(squareMetres, {
          rooms: [
            { spaceId: "room-a", levelElevation: "0", outerRing: squareMetres },
            { spaceId: "room-b", levelElevation: "0", outerRing: squareMetres },
          ],
        })
      )
    ).toThrow(/duplicate the same room boundary/);

    expect(() =>
      canonicalizeGeometry(
        input(squareMetres, {
          rooms: [
            { spaceId: "room-a", levelElevation: "0", outerRing: squareMetres },
            {
              spaceId: "room-b",
              levelElevation: "0",
              outerRing: points([
                ["2", "-1"],
                ["6", "-1"],
                ["6", "2"],
                ["2", "2"],
                ["2", "-1"],
              ]),
            },
          ],
        })
      )
    ).toThrow(/overlap|cross one another/);

    expect(() =>
      canonicalizeGeometry(
        input(squareMetres, {
          rooms: [
            {
              spaceId: "room-a",
              levelElevation: "0",
              outerRing: points([
                ["0", "0"],
                ["10", "0"],
                ["10", "1"],
                ["0", "1"],
                ["0", "0"],
              ]),
            },
            {
              spaceId: "room-b",
              levelElevation: "0",
              outerRing: points([
                ["5", "0"],
                ["15", "0"],
                ["15", "1"],
                ["5", "1"],
                ["5", "0"],
              ]),
            },
          ],
        })
      )
    ).toThrow(/overlap/);
  });

  it.each([
    [
      "open ring",
      points([
        ["0", "0"],
        ["2", "0"],
        ["2", "2"],
        ["0", "2"],
      ]),
    ],
    [
      "self intersection",
      points([
        ["0", "0"],
        ["2", "2"],
        ["0", "2"],
        ["2", "0"],
        ["0", "0"],
      ]),
    ],
    [
      "zero area",
      points([
        ["0", "0"],
        ["1", "0"],
        ["2", "0"],
        ["0", "0"],
      ]),
    ],
  ])("rejects %s", (_label, ring) => {
    expect(() => canonicalizeGeometry(input(ring))).toThrow(
      /Invalid MIYAR geometry/
    );
  });

  it("rejects holes outside, touching, crossing, overlapping, or nested", () => {
    const outer = points([
      ["0", "0"],
      ["10", "0"],
      ["10", "10"],
      ["0", "10"],
      ["0", "0"],
    ]);
    const invalidHoleSets = [
      [
        points([
          ["11", "1"],
          ["12", "1"],
          ["12", "2"],
          ["11", "2"],
          ["11", "1"],
        ]),
      ],
      [
        points([
          ["0", "1"],
          ["2", "1"],
          ["2", "2"],
          ["0", "2"],
          ["0", "1"],
        ]),
      ],
      [
        points([
          ["9", "1"],
          ["11", "1"],
          ["11", "2"],
          ["9", "2"],
          ["9", "1"],
        ]),
      ],
      [
        points([
          ["1", "1"],
          ["5", "1"],
          ["5", "5"],
          ["1", "5"],
          ["1", "1"],
        ]),
        points([
          ["4", "4"],
          ["7", "4"],
          ["7", "7"],
          ["4", "7"],
          ["4", "4"],
        ]),
      ],
      [
        points([
          ["1", "1"],
          ["8", "1"],
          ["8", "8"],
          ["1", "8"],
          ["1", "1"],
        ]),
        points([
          ["2", "2"],
          ["3", "2"],
          ["3", "3"],
          ["2", "3"],
          ["2", "2"],
        ]),
      ],
    ];

    for (const holes of invalidHoleSets) {
      expect(() =>
        canonicalizeGeometry(
          input(outer, {
            rooms: [
              {
                spaceId: "space-001",
                levelElevation: "0",
                outerRing: outer,
                holes,
              },
            ],
          })
        )
      ).toThrow(/Invalid MIYAR geometry/);
    }
  });

  it("rejects duplicate room identities and unsupported authority inputs", () => {
    expect(() =>
      canonicalizeGeometry(
        input(squareMetres, {
          rooms: [
            {
              spaceId: "duplicate",
              levelElevation: "0",
              outerRing: squareMetres,
            },
            {
              spaceId: "duplicate",
              levelElevation: "3",
              outerRing: squareMetres,
            },
          ],
        })
      )
    ).toThrow(/duplicate spaceId/);
    expect(() =>
      canonicalizeGeometry({ ...input(), sourceUnit: "ft" as "m" })
    ).toThrow(/source unit/);
    expect(() =>
      canonicalizeGeometry({
        ...input(),
        measurementBasis: "gross_floor_area" as typeof ROOM_FLOOR_POLYGON_AREA,
      })
    ).toThrow(/measurement basis/);
  });

  it("accepts a 64-character space identity and rejects a 65-character identity", () => {
    expect(
      canonicalizeGeometry(
        input(squareMetres, {
          rooms: [
            {
              spaceId: "a".repeat(64),
              levelElevation: "0",
              outerRing: squareMetres,
            },
          ],
        })
      ).geometry.rooms[0].spaceId
    ).toHaveLength(64);
    expect(() =>
      canonicalizeGeometry(
        input(squareMetres, {
          rooms: [
            {
              spaceId: "a".repeat(65),
              levelElevation: "0",
              outerRing: squareMetres,
            },
          ],
        })
      )
    ).toThrow(/1-64 character/);
  });
});

describe("MIYAR_GEOM_V1 area reconciliation tolerance", () => {
  it("uses max(0.01 m2, 0.1%) and includes the exact boundary", () => {
    const oneSquareMetreArea2 = 2_000_000_000_000n;
    const fixedTolerance = 20_000_000_000n;
    expect(
      reconcileRoomFloorAreas(
        oneSquareMetreArea2.toString(),
        (oneSquareMetreArea2 + fixedTolerance).toString()
      )
    ).toMatchObject({
      result: "equivalent",
      toleranceSquareMicrometresTwice: fixedTolerance.toString(),
    });
    expect(
      reconcileRoomFloorAreas(
        oneSquareMetreArea2.toString(),
        (oneSquareMetreArea2 + fixedTolerance + 1n).toString()
      ).result
    ).toBe("conflict");

    const hundredSquareMetresArea2 = 200_000_000_000_000n;
    const relativeTolerance = 200_200_200_200n;
    const atBoundaryRight = hundredSquareMetresArea2 + 200_200_200_200n;
    expect(
      reconcileRoomFloorAreas(
        hundredSquareMetresArea2.toString(),
        atBoundaryRight.toString()
      )
    ).toMatchObject({
      result: "equivalent",
      toleranceSquareMicrometresTwice: relativeTolerance.toString(),
    });
    expect(
      reconcileRoomFloorAreas(
        hundredSquareMetresArea2.toString(),
        (atBoundaryRight + 1n).toString()
      ).result
    ).toBe("conflict");
  });

  it("rejects malformed twice-area inputs", () => {
    expect(() => reconcileRoomFloorAreas("-1", "2")).toThrow(
      /non-negative integer/
    );
    expect(() => reconcileRoomFloorAreas("1.5", "2")).toThrow(
      /non-negative integer/
    );
  });
});
