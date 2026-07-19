import { createHash } from "node:crypto";

import {
  GEOMETRY_CANONICALIZER_VERSION,
  GEOMETRY_SCHEMA_VERSION,
  GEOMETRY_TOLERANCE_POLICY_VERSION,
  ROOM_FLOOR_POLYGON_AREA,
  type AreaReconciliation,
  type CanonicalEdge,
  type CanonicalGeometryDocument,
  type CanonicalGeometryResult,
  type CanonicalMicrometre,
  type CanonicalPoint,
  type CanonicalRing,
  type CanonicalRoomGeometry,
  type GeometryCanonicalizationInput,
  type GeometryInputPoint,
  type GeometrySnapTransform,
  type GeometrySourceUnit,
} from "../../../shared/geometry";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const FIVE = BigInt(5);
const ONE_THOUSAND = BigInt(1_000);
const MICROMETRES_PER_METRE = BigInt(1_000_000);
const MICROMETRES_PER_MILLIMETRE = BigInt(1_000);
const ONE_MILLIMETRE_MICROMETRES = BigInt(1_000);
const SQUARE_METRE_AREA2 = BigInt(2_000_000_000_000);
const MIN_RECONCILIATION_AREA2 = BigInt(20_000_000_000); // 0.01 m2, expressed as twice-area.
const MAX_SOURCE_COORDINATE = BigInt(1_000_000_000);
const MAX_DECIMAL_DIGITS = 36;
const EDGE_FINGERPRINT_DOMAIN = "MIYAR_GEOM_V1:canonical_edge";
const GEOMETRY_FINGERPRINT_DOMAIN = "MIYAR_GEOM_V1:canonical_geometry";

interface IntegerPoint {
  x: bigint;
  y: bigint;
}

interface IntegerRing {
  points: IntegerPoint[];
  area2: bigint;
}

export class GeometryDeadlineError extends Error {
  constructor() {
    super("Geometry canonicalization exceeded its deadline");
  }
}

function checkDeadline(deadlineAtMilliseconds?: number): void {
  if (
    deadlineAtMilliseconds !== undefined &&
    Date.now() > deadlineAtMilliseconds
  ) {
    throw new GeometryDeadlineError();
  }
}

function fail(message: string): never {
  throw new TypeError(`Invalid MIYAR geometry: ${message}`);
}

function absolute(value: bigint): bigint {
  return value < ZERO ? -value : value;
}

function sign(value: bigint): -1 | 0 | 1 {
  return value < ZERO ? -1 : value > ZERO ? 1 : 0;
}

function formatInteger(value: bigint): CanonicalMicrometre {
  return value === ZERO ? "0" : value.toString();
}

/** Convert decimal source text to micrometres without using binary floating point. */
export function decimalCoordinateToMicrometres(
  source: string,
  unit: GeometrySourceUnit
): bigint {
  if (typeof source !== "string") fail("coordinates must be decimal strings");
  const value = source.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) fail(`coordinate '${source}' is not a plain decimal`);

  const [, signText, integerText, fractionText = ""] = match;
  if (integerText.length + fractionText.length > MAX_DECIMAL_DIGITS) {
    fail(`coordinate '${source}' exceeds the supported decimal precision`);
  }

  const sourceInteger = BigInt(integerText);
  if (
    sourceInteger > MAX_SOURCE_COORDINATE ||
    (sourceInteger === MAX_SOURCE_COORDINATE && /[1-9]/.test(fractionText))
  ) {
    fail(`coordinate '${source}' exceeds 1e9 source units`);
  }

  const scale =
    unit === "m" ? MICROMETRES_PER_METRE : MICROMETRES_PER_MILLIMETRE;
  const scaleDigits = unit === "m" ? 6 : 3;
  const retained = fractionText.slice(0, scaleDigits).padEnd(scaleDigits, "0");
  let magnitude = sourceInteger * scale + BigInt(retained || "0");

  const discarded = fractionText.slice(scaleDigits);
  if (discarded.length > 0 && discarded[0] >= "5") magnitude += ONE;

  if (magnitude > MAX_SOURCE_COORDINATE * scale) {
    fail(`coordinate '${source}' exceeds 1e9 source units`);
  }
  return signText === "-" && magnitude !== ZERO ? -magnitude : magnitude;
}

function roundToIncrementHalfAwayFromZero(
  value: bigint,
  increment: bigint
): bigint {
  const magnitude = absolute(value);
  const quotient = magnitude / increment;
  const remainder = magnitude % increment;
  const rounded =
    (remainder * TWO >= increment ? quotient + ONE : quotient) * increment;
  return value < ZERO ? -rounded : rounded;
}

function normalizeCoordinate(
  source: string,
  unit: GeometrySourceUnit,
  snapTransform: GeometrySnapTransform
): bigint {
  const micrometres = decimalCoordinateToMicrometres(source, unit);
  return snapTransform === "1mm"
    ? roundToIncrementHalfAwayFromZero(micrometres, ONE_MILLIMETRE_MICROMETRES)
    : micrometres;
}

function pointsEqual(left: IntegerPoint, right: IntegerPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function pointKey(point: IntegerPoint): string {
  return `${formatInteger(point.x)},${formatInteger(point.y)}`;
}

function comparePoints(left: IntegerPoint, right: IntegerPoint): number {
  return left.x < right.x
    ? -1
    : left.x > right.x
      ? 1
      : left.y < right.y
        ? -1
        : left.y > right.y
          ? 1
          : 0;
}

function cross(a: IntegerPoint, b: IntegerPoint, c: IntegerPoint): bigint {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function between(a: bigint, b: bigint, c: bigint): boolean {
  return b >= (a < c ? a : c) && b <= (a > c ? a : c);
}

function pointOnSegment(
  point: IntegerPoint,
  start: IntegerPoint,
  end: IntegerPoint
): boolean {
  return (
    cross(start, end, point) === ZERO &&
    between(start.x, point.x, end.x) &&
    between(start.y, point.y, end.y)
  );
}

function signedArea2(
  points: IntegerPoint[],
  deadlineAtMilliseconds?: number
): bigint {
  let total = ZERO;
  for (let index = 0; index < points.length - 1; index += 1) {
    if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
    const current = points[index];
    const next = points[index + 1];
    total += current.x * next.y - next.x * current.y;
  }
  return total;
}

function removeRedundantVertices(
  points: IntegerPoint[],
  deadlineAtMilliseconds?: number
): IntegerPoint[] {
  const uniqueConsecutive: IntegerPoint[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
    const point = points[index];
    if (
      !uniqueConsecutive.length ||
      !pointsEqual(point, uniqueConsecutive.at(-1)!)
    ) {
      uniqueConsecutive.push(point);
    }
  }

  let current = uniqueConsecutive;
  let changed = true;
  while (changed && current.length >= 3) {
    changed = false;
    const next: IntegerPoint[] = [];
    for (let index = 0; index < current.length; index += 1) {
      if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
      const previous = current[(index - 1 + current.length) % current.length];
      const point = current[index];
      const following = current[(index + 1) % current.length];
      if (
        cross(previous, point, following) === ZERO &&
        between(previous.x, point.x, following.x) &&
        between(previous.y, point.y, following.y)
      ) {
        changed = true;
      } else {
        next.push(point);
      }
    }
    current = next;
  }
  return current;
}

function segmentsIntersect(
  a: IntegerPoint,
  b: IntegerPoint,
  c: IntegerPoint,
  d: IntegerPoint
): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  if (abC === ZERO && pointOnSegment(c, a, b)) return true;
  if (abD === ZERO && pointOnSegment(d, a, b)) return true;
  if (cdA === ZERO && pointOnSegment(a, c, d)) return true;
  if (cdB === ZERO && pointOnSegment(b, c, d)) return true;
  return sign(abC) !== sign(abD) && sign(cdA) !== sign(cdB);
}

function assertSimpleRing(
  points: IntegerPoint[],
  label: string,
  deadlineAtMilliseconds?: number
): void {
  const edgeCount = points.length - 1;
  for (let first = 0; first < edgeCount; first += 1) {
    if ((first & 127) === 0) checkDeadline(deadlineAtMilliseconds);
    for (let second = first + 1; second < edgeCount; second += 1) {
      if ((second & 127) === 0) checkDeadline(deadlineAtMilliseconds);
      const adjacent =
        second === first + 1 || (first === 0 && second === edgeCount - 1);
      if (adjacent) continue;
      if (
        segmentsIntersect(
          points[first],
          points[first + 1],
          points[second],
          points[second + 1]
        )
      ) {
        fail(`${label} is self-intersecting or self-touching`);
      }
    }
  }
}

function rotateToStableStart(
  openPoints: IntegerPoint[],
  deadlineAtMilliseconds?: number
): IntegerPoint[] {
  let start = 0;
  for (let index = 1; index < openPoints.length; index += 1) {
    if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
    if (comparePoints(openPoints[index], openPoints[start]) < 0) start = index;
  }
  return [...openPoints.slice(start), ...openPoints.slice(0, start)];
}

function canonicalizeRing(
  input: GeometryInputPoint[],
  unit: GeometrySourceUnit,
  snapTransform: GeometrySnapTransform,
  orientation: "counterclockwise" | "clockwise",
  label: string,
  deadlineAtMilliseconds?: number
): IntegerRing {
  if (!Array.isArray(input) || input.length < 4)
    fail(`${label} must contain at least four explicitly closed points`);
  const converted = input.map((point, index) => {
    if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
    if (!point || typeof point !== "object")
      fail(`${label} contains an invalid point`);
    return {
      x: normalizeCoordinate(point.x, unit, snapTransform),
      y: normalizeCoordinate(point.y, unit, snapTransform),
    };
  });
  if (!pointsEqual(converted[0], converted.at(-1)!))
    fail(`${label} must be explicitly closed`);

  let openPoints = removeRedundantVertices(converted, deadlineAtMilliseconds);
  if (openPoints.length < 3)
    fail(`${label} has fewer than three distinct non-collinear vertices`);
  let closed = [...openPoints, openPoints[0]];
  assertSimpleRing(closed, label, deadlineAtMilliseconds);

  let area2 = signedArea2(closed, deadlineAtMilliseconds);
  if (area2 === ZERO) fail(`${label} has zero area`);
  const mustBePositive = orientation === "counterclockwise";
  if (area2 > ZERO !== mustBePositive) openPoints = [...openPoints].reverse();
  openPoints = rotateToStableStart(openPoints, deadlineAtMilliseconds);
  closed = [...openPoints, openPoints[0]];
  area2 = signedArea2(closed, deadlineAtMilliseconds);
  return { points: closed, area2 };
}

function pointInRing(
  point: IntegerPoint,
  ring: IntegerPoint[],
  deadlineAtMilliseconds?: number
): "inside" | "outside" | "boundary" {
  let winding = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
    const start = ring[index];
    const end = ring[index + 1];
    if (pointOnSegment(point, start, end)) return "boundary";
    if (start.y <= point.y) {
      if (end.y > point.y && cross(start, end, point) > ZERO) winding += 1;
    } else if (end.y <= point.y && cross(start, end, point) < ZERO) {
      winding -= 1;
    }
  }
  return winding === 0 ? "outside" : "inside";
}

function ringsIntersect(
  first: IntegerPoint[],
  second: IntegerPoint[],
  deadlineAtMilliseconds?: number
): boolean {
  for (let left = 0; left < first.length - 1; left += 1) {
    if ((left & 127) === 0) checkDeadline(deadlineAtMilliseconds);
    for (let right = 0; right < second.length - 1; right += 1) {
      if ((right & 127) === 0) checkDeadline(deadlineAtMilliseconds);
      if (
        segmentsIntersect(
          first[left],
          first[left + 1],
          second[right],
          second[right + 1]
        )
      )
        return true;
    }
  }
  return false;
}

function assertValidHoles(
  outer: IntegerRing,
  holes: IntegerRing[],
  label: string,
  deadlineAtMilliseconds?: number
): void {
  for (let index = 0; index < holes.length; index += 1) {
    checkDeadline(deadlineAtMilliseconds);
    const hole = holes[index];
    if (ringsIntersect(outer.points, hole.points, deadlineAtMilliseconds))
      fail(`${label} hole ${index} touches or crosses the outer ring`);
    for (const point of hole.points.slice(0, -1)) {
      if (pointInRing(point, outer.points, deadlineAtMilliseconds) !== "inside")
        fail(`${label} hole ${index} is not strictly inside the outer ring`);
    }

    for (let other = 0; other < index; other += 1) {
      const previous = holes[other];
      if (ringsIntersect(previous.points, hole.points, deadlineAtMilliseconds))
        fail(`${label} holes overlap or touch`);
      if (
        pointInRing(hole.points[0], previous.points, deadlineAtMilliseconds) !==
          "outside" ||
        pointInRing(previous.points[0], hole.points, deadlineAtMilliseconds) !==
          "outside"
      ) {
        fail(`${label} holes overlap or contain one another`);
      }
    }
  }
}

function hash(domain: string, payload: string): string {
  return createHash("sha256")
    .update(domain, "utf8")
    .update("\0", "utf8")
    .update(payload, "utf8")
    .digest("hex");
}

function canonicalPoint(point: IntegerPoint): CanonicalPoint {
  return { x: formatInteger(point.x), y: formatInteger(point.y) };
}

function edgeIdentity(
  start: IntegerPoint,
  end: IntegerPoint,
  elevation: bigint
): string {
  const ordered = comparePoints(start, end) <= 0 ? [start, end] : [end, start];
  return hash(
    EDGE_FINGERPRINT_DOMAIN,
    `${formatInteger(elevation)}|${pointKey(ordered[0])}|${pointKey(ordered[1])}`
  );
}

function canonicalRing(ring: IntegerRing, elevation: bigint): CanonicalRing {
  const points = ring.points.map(canonicalPoint);
  const edges: CanonicalEdge[] = [];
  for (let index = 0; index < ring.points.length - 1; index += 1) {
    edges.push({
      edgeId: edgeIdentity(
        ring.points[index],
        ring.points[index + 1],
        elevation
      ),
      start: points[index],
      end: points[index + 1],
    });
  }
  return { points, edges };
}

function compareIntegerRings(left: IntegerRing, right: IntegerRing): number {
  const leftKey = left.points.map(pointKey).join(";");
  const rightKey = right.points.map(pointKey).join(";");
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

export function twiceSquareMicrometresToSquareMetres(area2: bigint): string {
  const whole = area2 / SQUARE_METRE_AREA2;
  const remainder = area2 % SQUARE_METRE_AREA2;
  if (remainder === ZERO) return whole.toString();
  // area2 / 2e12 has at most 13 decimal places because area2 is integral.
  const scaledFraction = remainder * FIVE;
  const fraction = scaledFraction
    .toString()
    .padStart(13, "0")
    .replace(/0+$/, "");
  return `${whole}.${fraction}`;
}

function canonicalizeRoom(
  room: GeometryCanonicalizationInput["rooms"][number],
  unit: GeometrySourceUnit,
  snapTransform: GeometrySnapTransform,
  deadlineAtMilliseconds?: number
): CanonicalRoomGeometry {
  if (!room || typeof room !== "object") fail("room must be an object");
  if (
    typeof room.spaceId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(room.spaceId)
  ) {
    fail("spaceId must be a stable 1-64 character opaque identifier");
  }
  const elevation = normalizeCoordinate(
    room.levelElevation,
    unit,
    snapTransform
  );
  const outer = canonicalizeRing(
    room.outerRing,
    unit,
    snapTransform,
    "counterclockwise",
    `${room.spaceId} outer ring`,
    deadlineAtMilliseconds
  );
  const holes = (room.holes ?? []).map((hole, index) =>
    canonicalizeRing(
      hole,
      unit,
      snapTransform,
      "clockwise",
      `${room.spaceId} hole ${index}`,
      deadlineAtMilliseconds
    )
  );
  assertValidHoles(outer, holes, room.spaceId, deadlineAtMilliseconds);
  holes.sort(compareIntegerRings);

  const area2 =
    outer.area2 - holes.reduce((sum, hole) => sum + absolute(hole.area2), ZERO);
  if (area2 <= ZERO)
    fail(`${room.spaceId} holes consume the complete outer area`);

  return {
    spaceId: room.spaceId,
    levelElevationMicrometres: formatInteger(elevation),
    outerRing: canonicalRing(outer, elevation),
    holes: holes.map(hole => canonicalRing(hole, elevation)),
    areaSquareMicrometresTwice: area2.toString(),
    areaSquareMetres: twiceSquareMicrometresToSquareMetres(area2),
  };
}

function canonicalPointToInteger(point: CanonicalPoint): IntegerPoint {
  return { x: BigInt(point.x), y: BigInt(point.y) };
}

function canonicalRingToIntegers(ring: CanonicalRing): IntegerPoint[] {
  return ring.points.map(canonicalPointToInteger);
}

function properSegmentsCross(
  a: IntegerPoint,
  b: IntegerPoint,
  c: IntegerPoint,
  d: IntegerPoint
): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return (
    sign(abC) !== 0 &&
    sign(abD) !== 0 &&
    sign(cdA) !== 0 &&
    sign(cdB) !== 0 &&
    sign(abC) !== sign(abD) &&
    sign(cdA) !== sign(cdB)
  );
}

function roomRings(room: CanonicalRoomGeometry): IntegerPoint[][] {
  return [
    canonicalRingToIntegers(room.outerRing),
    ...room.holes.map(canonicalRingToIntegers),
  ];
}

function pointInsidePreparedRoomFloor(
  point: IntegerPoint,
  rings: IntegerPoint[][],
  deadlineAtMilliseconds?: number
): boolean {
  if (pointInRing(point, rings[0], deadlineAtMilliseconds) !== "inside") {
    return false;
  }
  return rings
    .slice(1)
    .every(
      hole => pointInRing(point, hole, deadlineAtMilliseconds) === "outside"
    );
}

function collinearSegmentsOverlapOnSameInteriorSide(
  a: IntegerPoint,
  b: IntegerPoint,
  c: IntegerPoint,
  d: IntegerPoint
): boolean {
  if (cross(a, b, c) !== ZERO || cross(a, b, d) !== ZERO) return false;

  const useX = a.x !== b.x;
  const [aStart, aEnd] = useX
    ? [a.x < b.x ? a.x : b.x, a.x > b.x ? a.x : b.x]
    : [a.y < b.y ? a.y : b.y, a.y > b.y ? a.y : b.y];
  const [cStart, cEnd] = useX
    ? [c.x < d.x ? c.x : d.x, c.x > d.x ? c.x : d.x]
    : [c.y < d.y ? c.y : d.y, c.y > d.y ? c.y : d.y];
  const overlapStart = aStart > cStart ? aStart : cStart;
  const overlapEnd = aEnd < cEnd ? aEnd : cEnd;
  if (overlapStart >= overlapEnd) return false;

  // Every canonical room-floor ring is oriented with occupied floor on its
  // left side (outer rings CCW, holes CW). Same-direction collinear edges
  // therefore put both occupied interiors on the same side and overlap.
  const dot = (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y);
  return dot > ZERO;
}

function assertRoomsDoNotOverlap(
  rooms: CanonicalRoomGeometry[],
  deadlineAtMilliseconds?: number
): void {
  for (let leftIndex = 0; leftIndex < rooms.length; leftIndex += 1) {
    if ((leftIndex & 31) === 0) checkDeadline(deadlineAtMilliseconds);
    const left = rooms[leftIndex];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < rooms.length;
      rightIndex += 1
    ) {
      if ((rightIndex & 31) === 0) checkDeadline(deadlineAtMilliseconds);
      const right = rooms[rightIndex];
      if (left.levelElevationMicrometres !== right.levelElevationMicrometres) {
        continue;
      }

      const leftOuter = canonicalRingToIntegers(left.outerRing);
      const rightOuter = canonicalRingToIntegers(right.outerRing);
      const leftRings = roomRings(left);
      const rightRings = roomRings(right);
      if (
        leftOuter.map(pointKey).join(";") === rightOuter.map(pointKey).join(";")
      ) {
        fail(
          `${left.spaceId} and ${right.spaceId} duplicate the same room boundary`
        );
      }
      if (
        leftOuter.slice(0, -1).some((point, index) => {
          if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
          return pointInsidePreparedRoomFloor(
            point,
            rightRings,
            deadlineAtMilliseconds
          );
        }) ||
        rightOuter.slice(0, -1).some((point, index) => {
          if ((index & 127) === 0) checkDeadline(deadlineAtMilliseconds);
          return pointInsidePreparedRoomFloor(
            point,
            leftRings,
            deadlineAtMilliseconds
          );
        })
      ) {
        fail(`${left.spaceId} and ${right.spaceId} overlap`);
      }

      for (const leftRing of leftRings) {
        for (const rightRing of rightRings) {
          for (
            let leftEdge = 0;
            leftEdge < leftRing.length - 1;
            leftEdge += 1
          ) {
            if ((leftEdge & 127) === 0) checkDeadline(deadlineAtMilliseconds);
            for (
              let rightEdge = 0;
              rightEdge < rightRing.length - 1;
              rightEdge += 1
            ) {
              if ((rightEdge & 127) === 0)
                checkDeadline(deadlineAtMilliseconds);
              if (
                collinearSegmentsOverlapOnSameInteriorSide(
                  leftRing[leftEdge],
                  leftRing[leftEdge + 1],
                  rightRing[rightEdge],
                  rightRing[rightEdge + 1]
                )
              ) {
                fail(`${left.spaceId} and ${right.spaceId} overlap`);
              }
              if (
                properSegmentsCross(
                  leftRing[leftEdge],
                  leftRing[leftEdge + 1],
                  rightRing[rightEdge],
                  rightRing[rightEdge + 1]
                )
              ) {
                fail(`${left.spaceId} and ${right.spaceId} cross one another`);
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Canonicalize planar room-floor polygons under MIYAR_GEOM_V1.
 *
 * The returned JSON is the only fingerprint payload. It contains no timestamps,
 * display names, inferred areas, or floating-point values.
 */
export function canonicalizeGeometry(
  input: GeometryCanonicalizationInput,
  runtime: { deadlineAtMilliseconds?: number } = {}
): CanonicalGeometryResult {
  if (!input || typeof input !== "object") fail("input must be an object");
  if (input.schemaVersion !== GEOMETRY_SCHEMA_VERSION)
    fail("unsupported geometry schema version");
  if (input.measurementBasis !== ROOM_FLOOR_POLYGON_AREA)
    fail("unsupported measurement basis");
  if (input.sourceUnit !== "m" && input.sourceUnit !== "mm")
    fail("source unit must be explicit metres or millimetres");
  const snapTransform = input.snapTransform ?? "none";
  if (snapTransform !== "none" && snapTransform !== "1mm")
    fail("unsupported snap transform");
  if (!Array.isArray(input.rooms) || input.rooms.length === 0)
    fail("at least one physical room is required");

  const rooms = input.rooms.map(room => {
    checkDeadline(runtime.deadlineAtMilliseconds);
    return canonicalizeRoom(
      room,
      input.sourceUnit,
      snapTransform,
      runtime.deadlineAtMilliseconds
    );
  });
  assertRoomsDoNotOverlap(rooms, runtime.deadlineAtMilliseconds);
  rooms.sort((left, right) =>
    left.spaceId < right.spaceId ? -1 : left.spaceId > right.spaceId ? 1 : 0
  );
  for (let index = 1; index < rooms.length; index += 1) {
    if (rooms[index - 1].spaceId === rooms[index].spaceId)
      fail(`duplicate spaceId '${rooms[index].spaceId}'`);
  }

  const geometry: CanonicalGeometryDocument = {
    schemaVersion: GEOMETRY_SCHEMA_VERSION,
    canonicalizerVersion: GEOMETRY_CANONICALIZER_VERSION,
    tolerancePolicyVersion: GEOMETRY_TOLERANCE_POLICY_VERSION,
    measurementBasis: ROOM_FLOOR_POLYGON_AREA,
    referenceFrame: {
      type: "project_local_xy",
      axisOrder: "xy",
      handedness: "right_handed",
    },
    normalization: {
      sourceUnit: input.sourceUnit,
      sourceUnitMicrometres: input.sourceUnit === "m" ? "1000000" : "1000",
      snapTransform,
    },
    rooms,
  };
  const canonicalJson = JSON.stringify(geometry);
  return {
    geometry,
    canonicalJson,
    fingerprint: {
      algorithm: "sha256",
      domain: GEOMETRY_FINGERPRINT_DOMAIN,
      value: hash(GEOMETRY_FINGERPRINT_DOMAIN, canonicalJson),
    },
  };
}

/** Compare exact room-floor areas using max(0.01 m2, 0.1% of the larger area). */
export function reconcileRoomFloorAreas(
  leftAreaSquareMicrometresTwice: string,
  rightAreaSquareMicrometresTwice: string
): AreaReconciliation {
  if (
    !/^\d+$/.test(leftAreaSquareMicrometresTwice) ||
    !/^\d+$/.test(rightAreaSquareMicrometresTwice)
  ) {
    fail(
      "reconciliation areas must be non-negative integer twice-area strings"
    );
  }
  const left = BigInt(leftAreaSquareMicrometresTwice);
  const right = BigInt(rightAreaSquareMicrometresTwice);
  const difference = absolute(left - right);
  const larger = left > right ? left : right;
  // Differences are integral area2 quanta, so floor preserves the exact <= 0.1% boundary.
  const relativeTolerance = larger / ONE_THOUSAND;
  const tolerance =
    relativeTolerance > MIN_RECONCILIATION_AREA2
      ? relativeTolerance
      : MIN_RECONCILIATION_AREA2;
  return {
    result: difference <= tolerance ? "equivalent" : "conflict",
    differenceSquareMicrometresTwice: difference.toString(),
    toleranceSquareMicrometresTwice: tolerance.toString(),
    tolerancePolicyVersion: GEOMETRY_TOLERANCE_POLICY_VERSION,
  };
}
