import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

import {
  DXF_ADAPTER_VERSION,
  DXF_BOUNDARY_LIMITS,
  GEOMETRY_SCHEMA_VERSION,
  ROOM_FLOOR_POLYGON_AREA,
  type DxfGeometryBoundaryInput,
  type DxfGeometryBoundaryResult,
  type DxfGeometryInspection,
  type DxfGeometryIssue,
  type DxfGeometryLevelOverlay,
  type GeometryInputPoint,
  type GeometrySourceUnit,
} from "../../../shared/geometry";
import {
  canonicalizeGeometry,
  GeometryDeadlineError,
} from "./canonical-geometry";

interface WorkerVertex {
  x: string;
  y: string;
  z?: number;
  bulge?: number;
}

interface WorkerBoundary {
  entityIndex: number;
  handle: string | null;
  layer: string;
  vertices: WorkerVertex[];
}

interface WorkerInspection extends DxfGeometryInspection {
  headerInsUnits: number | null;
  boundaries: WorkerBoundary[];
  unsupportedCurveType: string | null;
  hasUnsupportedBulge: boolean;
  hasNonFiniteCoordinate: boolean;
  exceedsCoordinateLimit: boolean;
  hasNonPlanarCoordinate: boolean;
  hasUnsupportedBlockReference: boolean;
}

interface BoundaryRuntime {
  /** Test seam; production always uses the terminating worker implementation. */
  inspect?: (source: string) => Promise<WorkerInspection>;
  deadlineMilliseconds?: number;
}

const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require("node:worker_threads");

function sourceCoordinateLexemes(source) {
  const lines = source.split(/\r\n|\n|\r/);
  const pairs = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    pairs.push({ code: Number(lines[index].trim()), value: lines[index + 1].trim() });
  }

  let entitiesStart = -1;
  for (let index = 0; index + 1 < pairs.length; index += 1) {
    if (
      pairs[index].code === 0 && pairs[index].value === "SECTION" &&
      pairs[index + 1].code === 2 && pairs[index + 1].value === "ENTITIES"
    ) {
      entitiesStart = index + 2;
      break;
    }
  }
  if (entitiesStart < 0) return [];

  const boundaries = [];
  let index = entitiesStart;
  while (index < pairs.length) {
    const marker = pairs[index];
    if (marker.code !== 0) {
      index += 1;
      continue;
    }
    if (marker.value === "ENDSEC") break;

    if (marker.value === "LWPOLYLINE") {
      index += 1;
      let flags = 0;
      let elevation = "0";
      const vertices = [];
      while (index < pairs.length && pairs[index].code !== 0) {
        const pair = pairs[index];
        if (pair.code === 70) flags = Number(pair.value);
        if (pair.code === 38) elevation = pair.value;
        if (pair.code === 10) vertices.push({ x: pair.value, y: null, z: null });
        if (pair.code === 20 && vertices.length > 0 && vertices[vertices.length - 1].y === null) {
          vertices[vertices.length - 1].y = pair.value;
        }
        if (pair.code === 30 && vertices.length > 0) vertices[vertices.length - 1].z = pair.value;
        index += 1;
      }
      if ((flags & 1) === 1 && vertices.length >= 3 && vertices.every(vertex => vertex.y !== null)) {
        boundaries.push({ vertices, elevation });
      }
      continue;
    }

    if (marker.value === "POLYLINE") {
      index += 1;
      let flags = 0;
      let elevation = "0";
      while (index < pairs.length && pairs[index].code !== 0) {
        if (pairs[index].code === 70) flags = Number(pairs[index].value);
        if (pairs[index].code === 30) elevation = pairs[index].value;
        index += 1;
      }
      const vertices = [];
      while (index < pairs.length && pairs[index].code === 0 && pairs[index].value === "VERTEX") {
        index += 1;
        let x = null;
        let y = null;
        let z = null;
        while (index < pairs.length && pairs[index].code !== 0) {
          if (pairs[index].code === 10) x = pairs[index].value;
          if (pairs[index].code === 20) y = pairs[index].value;
          if (pairs[index].code === 30) z = pairs[index].value;
          index += 1;
        }
        if (x !== null && y !== null) vertices.push({ x, y, z });
      }
      if (index < pairs.length && pairs[index].code === 0 && pairs[index].value === "SEQEND") {
        index += 1;
        while (index < pairs.length && pairs[index].code !== 0) index += 1;
      }
      if ((flags & 1) === 1 && vertices.length >= 3) boundaries.push({ vertices, elevation });
      continue;
    }

    index += 1;
    while (index < pairs.length && pairs[index].code !== 0) index += 1;
  }
  return boundaries;
}

function isExactZero(value) {
  return /^[+-]?(?:0+(?:\.0*)?|\.0+)(?:[eE][+-]?\d+)?$/.test(String(value).trim());
}

function maxBlockDepth(blocks) {
  const blockMap = blocks && typeof blocks === "object" ? blocks : {};
  const memo = new Map();
  const visiting = new Set();
  function visit(name, depth) {
    if (depth > 32) return depth;
    if (memo.has(name)) return depth + memo.get(name);
    if (visiting.has(name)) return 33;
    visiting.add(name);
    const entities = Array.isArray(blockMap[name]?.entities) ? blockMap[name].entities : [];
    let relativeMaximum = 0;
    for (const entity of entities) {
      if (entity?.type === "INSERT" && typeof entity.name === "string") {
        relativeMaximum = Math.max(relativeMaximum, visit(entity.name, 1));
      }
    }
    visiting.delete(name);
    memo.set(name, relativeMaximum);
    return depth + relativeMaximum;
  }
  let maximum = 0;
  for (const name of Object.keys(blockMap)) maximum = Math.max(maximum, visit(name, 1));
  return maximum;
}

function allEntities(dxf) {
  const result = Array.isArray(dxf.entities) ? [...dxf.entities] : [];
  for (const block of Object.values(dxf.blocks || {})) {
    if (Array.isArray(block?.entities)) result.push(...block.entities);
  }
  return result;
}

(async () => {
  try {
    const imported = await import("dxf-parser");
    const DxfParser = imported.default?.default || imported.default;
    const dxf = new DxfParser().parseSync(workerData.source);
    if (!dxf || !Array.isArray(dxf.entities)) throw new Error("DXF has no entity section");
    const entities = allEntities(dxf);
    const hasUnsupportedBlockReference = entities.some(entity => entity?.type === "INSERT") ||
      Object.values(dxf.blocks || {}).some(block => Array.isArray(block?.entities) && block.entities.length > 0);
    const layerNames = new Set();
    const tableLayers = dxf.tables?.layer?.layers;
    if (tableLayers && typeof tableLayers === "object") {
      for (const name of Object.keys(tableLayers)) layerNames.add(name);
    }
    let vertexCount = 0;
    let hasUnsupportedBulge = false;
    let hasNonFiniteCoordinate = false;
    let exceedsCoordinateLimit = false;
    let hasNonPlanarCoordinate = false;
    let unsupportedCurveType = null;
    const boundaries = [];
    const coordinateLexemes = sourceCoordinateLexemes(workerData.source);
    let coordinateBoundaryIndex = 0;
    const curveTypes = new Set(["ARC", "CIRCLE", "ELLIPSE", "SPLINE", "HELIX"]);
    for (let entityIndex = 0; entityIndex < entities.length; entityIndex += 1) {
      const entity = entities[entityIndex] || {};
      if (typeof entity.layer === "string") layerNames.add(entity.layer);
      if (curveTypes.has(entity.type) && unsupportedCurveType === null) unsupportedCurveType = entity.type;
      const vertices = Array.isArray(entity.vertices) ? entity.vertices : [];
      if (
        (typeof entity.elevation === "number" && entity.elevation !== 0) ||
        entity.is3dPolyline === true ||
        (typeof entity.depth === "number" && entity.depth !== 0) ||
        (typeof entity.thickness === "number" && entity.thickness !== 0) ||
        (entity.extrusionDirectionX !== undefined &&
          (entity.extrusionDirectionX !== 0 || entity.extrusionDirectionY !== 0 || entity.extrusionDirectionZ !== 1)) ||
        (entity.extrusionDirection !== undefined &&
          (entity.extrusionDirection.x !== 0 || entity.extrusionDirection.y !== 0 || entity.extrusionDirection.z !== 1))
      ) hasNonPlanarCoordinate = true;
      vertexCount += vertices.length;
      for (const vertex of vertices) {
        const coordinateValues = [vertex?.x, vertex?.y, vertex?.z].filter(value => value !== undefined);
        if (coordinateValues.some(value => typeof value !== "number" || !Number.isFinite(value))) {
          hasNonFiniteCoordinate = true;
        }
        if (coordinateValues.some(value => Math.abs(value) > 1000000000)) {
          exceedsCoordinateLimit = true;
        }
        if (typeof vertex?.z === "number" && vertex.z !== 0) hasNonPlanarCoordinate = true;
        if (typeof vertex?.bulge === "number" && vertex.bulge !== 0) hasUnsupportedBulge = true;
      }
      if (
        (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") &&
        entity.shape === true &&
        vertices.length >= 3
      ) {
        const isTopLevelEntity = entityIndex < dxf.entities.length;
        const lexicalBoundary = isTopLevelEntity
          ? coordinateLexemes[coordinateBoundaryIndex++]
          : {
              elevation: "0",
              vertices: vertices.map(vertex => ({ x: String(vertex.x), y: String(vertex.y), z: null })),
            };
        const lexicalVertices = lexicalBoundary?.vertices;
        if (!lexicalVertices || lexicalVertices.length !== vertices.length) {
          throw new Error("DXF coordinate lexemes do not match parsed boundary vertices");
        }
        if (
          !isExactZero(lexicalBoundary.elevation) ||
          lexicalVertices.some(vertex => vertex.z !== null && !isExactZero(vertex.z))
        ) hasNonPlanarCoordinate = true;
        boundaries.push({
          entityIndex,
          handle: entity.handle === undefined ? null : String(entity.handle),
          layer: typeof entity.layer === "string" ? entity.layer : "0",
          vertices: vertices.map((vertex, vertexIndex) => ({
            x: lexicalVertices[vertexIndex].x,
            y: lexicalVertices[vertexIndex].y,
            ...(vertex.z === undefined ? {} : { z: vertex.z }),
            ...(vertex.bulge === undefined ? {} : { bulge: vertex.bulge }),
          })),
        });
      }
    }
    if (coordinateBoundaryIndex !== coordinateLexemes.length) {
      throw new Error("DXF coordinate lexemes do not match parsed closed boundaries");
    }
    parentPort.postMessage({ ok: true, value: {
      headerInsUnits: Number.isInteger(dxf.header?.$INSUNITS) ? dxf.header.$INSUNITS : null,
      entityCount: entities.length,
      vertexCount,
      layerCount: layerNames.size,
      maximumBlockNestingDepth: maxBlockDepth(dxf.blocks),
      closedBoundaryCount: boundaries.length,
      boundaries,
      unsupportedCurveType,
      hasUnsupportedBulge,
      hasNonFiniteCoordinate,
      exceedsCoordinateLimit,
      hasNonPlanarCoordinate,
      hasUnsupportedBlockReference,
    }});
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
})();
`;

export const DXF_WORKER_CONCURRENCY_LIMIT = 2;
export const DXF_WORKER_PENDING_LIMIT = 8;
export const DXF_WORKER_RESOURCE_LIMITS = {
  maxOldGenerationSizeMb: 128,
  maxYoungGenerationSizeMb: 32,
  codeRangeSizeMb: 16,
  stackSizeMb: 4,
} as const;

export class DxfCapacityError extends Error {
  constructor() {
    super("DXF inspection capacity is full");
  }
}

/**
 * Bounds both active work and retained pending closures. Queue deadlines remove
 * their callback immediately so a timed-out request cannot retain a large DXF.
 */
export class BoundedDxfWorkerScheduler {
  private active = 0;
  private readonly pending: Array<() => void> = [];

  constructor(
    private readonly concurrencyLimit: number,
    private readonly pendingLimit: number
  ) {}

  schedule<T>(
    deadlineMilliseconds: number,
    run: (remainingMilliseconds: number) => Promise<T>
  ): Promise<T> {
    if (
      this.active >= this.concurrencyLimit &&
      this.pending.length >= this.pendingLimit
    ) {
      return Promise.reject(new DxfCapacityError());
    }

    const deadlineAt = Date.now() + deadlineMilliseconds;
    return new Promise((resolve, reject) => {
      let started = false;
      let settled = false;
      let start: (() => void) | null = null;
      const finish = (
        callback: () => void,
        releaseWorkerSlot: boolean
      ): void => {
        if (settled) return;
        settled = true;
        clearTimeout(queueTimer);
        if (releaseWorkerSlot) {
          this.active -= 1;
          this.drain();
        }
        callback();
      };
      const queueTimer = setTimeout(() => {
        if (started) return;
        if (start) {
          const index = this.pending.indexOf(start);
          if (index >= 0) this.pending.splice(index, 1);
          start = null;
        }
        finish(() => reject(new DxfDeadlineError()), false);
        this.drain();
      }, deadlineMilliseconds);

      start = () => {
        if (settled) return;
        start = null;
        started = true;
        this.active += 1;
        const remaining = deadlineAt - Date.now();
        if (remaining <= 0) {
          finish(() => reject(new DxfDeadlineError()), true);
          return;
        }
        run(remaining).then(
          value => finish(() => resolve(value), true),
          error => finish(() => reject(error), true)
        );
      };

      if (this.active < this.concurrencyLimit) start();
      else this.pending.push(start);
    });
  }

  private drain(): void {
    while (this.active < this.concurrencyLimit && this.pending.length > 0) {
      this.pending.shift()?.();
    }
  }
}

const dxfWorkerScheduler = new BoundedDxfWorkerScheduler(
  DXF_WORKER_CONCURRENCY_LIMIT,
  DXF_WORKER_PENDING_LIMIT
);

function runInspectionWorker(
  source: string,
  deadlineMilliseconds: number
): Promise<WorkerInspection> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { source },
      resourceLimits: DXF_WORKER_RESOURCE_LIMITS,
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      finish(() => {
        void worker.terminate();
        reject(new DxfDeadlineError());
      });
    }, deadlineMilliseconds);
    worker.once("message", message => {
      finish(() => {
        void worker.terminate();
        if (message?.ok) resolve(message.value as WorkerInspection);
        else reject(new Error(String(message?.error || "DXF parse failed")));
      });
    });
    worker.once("error", error => finish(() => reject(error)));
    worker.once("exit", code => {
      if (code !== 0)
        finish(() => reject(new Error(`DXF worker exited with code ${code}`)));
    });
  });
}

function inspectInWorker(
  source: string,
  deadlineMilliseconds: number
): Promise<WorkerInspection> {
  return dxfWorkerScheduler.schedule(deadlineMilliseconds, remaining =>
    runInspectionWorker(source, remaining)
  );
}

class DxfDeadlineError extends Error {
  constructor() {
    super("DXF inspection exceeded its deadline");
  }
}

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function issue(
  code: DxfGeometryIssue["code"],
  message: string
): DxfGeometryIssue {
  return { code, message };
}

function headerUnit(insUnits: number | null): GeometrySourceUnit | null {
  return insUnits === 4 ? "mm" : insUnits === 6 ? "m" : null;
}

function isUnknownUnitCode(insUnits: number | null): boolean {
  return insUnits === null || insUnits === 0;
}

function coordinateLexemeToPlainDecimal(source: string): string {
  const text = source.trim();
  const match =
    /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match)
    throw new TypeError(`coordinate '${source}' is not finite decimal text`);
  const [
    ,
    signText,
    wholeText,
    fractionAfterWhole = "",
    fractionOnly = "",
    exponentText = "0",
  ] = match;
  const whole = wholeText ?? "0";
  const fraction = wholeText === undefined ? fractionOnly : fractionAfterWhole;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) {
    throw new TypeError(`coordinate '${source}' has an unsupported exponent`);
  }
  const negative = signText === "-";
  const digits = `${whole}${fraction}`;
  const decimalIndex = whole.length + exponent;
  const expanded =
    decimalIndex <= 0
      ? `0.${"0".repeat(-decimalIndex)}${digits}`
      : decimalIndex >= digits.length
        ? `${digits}${"0".repeat(decimalIndex - digits.length)}`
        : `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  const normalized =
    expanded
      .replace(/^0+(?=\d)/, "")
      .replace(/\.0*$/, "")
      .replace(/(\.\d*?)0+$/, "$1") || "0";
  return negative && normalized !== "0" ? `-${normalized}` : normalized;
}

function coordinateLexemeExceedsLimit(source: string): boolean {
  try {
    const plain = coordinateLexemeToPlainDecimal(source).replace(/^-/, "");
    const [whole, fraction = ""] = plain.split(".");
    const integer = BigInt(whole);
    return (
      integer > BigInt(DXF_BOUNDARY_LIMITS.absoluteSourceCoordinate) ||
      (integer === BigInt(DXF_BOUNDARY_LIMITS.absoluteSourceCoordinate) &&
        /[1-9]/.test(fraction))
    );
  } catch {
    return true;
  }
}

const DXF_ROOM_ID_DOMAIN = "MIYAR_DXF_ROOM_ID_V1";

function stableDxfRoomId(
  outerRing: GeometryInputPoint[],
  levelElevation: string,
  sourceUnit: GeometrySourceUnit,
  snapTransform: "none" | "1mm",
  deadlineAtMilliseconds: number
): string {
  const isolated = canonicalizeGeometry(
    {
      schemaVersion: GEOMETRY_SCHEMA_VERSION,
      measurementBasis: ROOM_FLOOR_POLYGON_AREA,
      sourceUnit,
      snapTransform,
      rooms: [
        {
          spaceId: "dxf-room-identity-placeholder",
          levelElevation,
          outerRing,
        },
      ],
    },
    { deadlineAtMilliseconds }
  );
  const room = isolated.geometry.rooms[0];
  const identityPayload = JSON.stringify({
    referenceFrame: isolated.geometry.referenceFrame,
    levelElevationMicrometres: room.levelElevationMicrometres,
    outerRing: room.outerRing.points,
    holes: room.holes.map(hole => hole.points),
  });
  const digest = createHash("sha256")
    .update(DXF_ROOM_ID_DOMAIN, "utf8")
    .update("\0", "utf8")
    .update(identityPayload, "utf8")
    .digest("hex");
  // Persistence currently allows 64 characters for a public space identity.
  return `cad:${digest.slice(0, 60)}`;
}

function asInspection(value: WorkerInspection): DxfGeometryInspection {
  return {
    entityCount: value.entityCount,
    vertexCount: value.vertexCount,
    layerCount: value.layerCount,
    maximumBlockNestingDepth: value.maximumBlockNestingDepth,
    closedBoundaryCount: value.closedBoundaryCount,
  };
}

function asciiDxfPreflight(
  bytes: Uint8Array,
  fileName: string
): DxfGeometryIssue | null {
  if (/\.dwg$/i.test(fileName))
    return issue(
      "dwg_not_supported",
      "DWG is outside the deterministic DXF boundary."
    );
  if (!/\.dxf$/i.test(fileName))
    return issue(
      "spoofed_file",
      "The source filename must use the .dxf extension."
    );
  const prefix = Buffer.from(
    bytes.subarray(0, Math.min(bytes.length, 64))
  ).toString("ascii");
  if (/AutoCAD Binary DXF/i.test(prefix)) {
    return issue(
      "binary_dxf_not_supported",
      "Binary DXF is not supported; provide ASCII DXF."
    );
  }
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    const allowedControl = byte === 9 || byte === 10 || byte === 13;
    if ((!allowedControl && byte < 32) || byte > 126) {
      return issue(
        "not_ascii_dxf",
        "The source contains non-ASCII or binary bytes."
      );
    }
  }
  const text = Buffer.from(bytes).toString("ascii");
  if (
    !/(?:^|\r?\n)\s*SECTION\s*(?:\r?\n|$)/.test(text) ||
    !/(?:^|\r?\n)\s*EOF\s*(?:\r?\n|$)/.test(text)
  ) {
    return issue(
      "spoofed_file",
      "The source does not contain the required ASCII DXF structure."
    );
  }
  return null;
}

function mediaTypeIssue(
  mediaType: string | null | undefined
): DxfGeometryIssue | null {
  if (!mediaType) return null;
  const normalized = mediaType.split(";", 1)[0].trim().toLowerCase();
  const accepted = new Set([
    "application/dxf",
    "application/x-dxf",
    "application/octet-stream",
    "image/vnd.dxf",
    "image/x-dxf",
    "text/plain",
  ]);
  return accepted.has(normalized)
    ? null
    : issue(
        "spoofed_file",
        `Media type '${normalized}' is not a DXF media type.`
      );
}

function withDeadline<T>(
  promise: Promise<T>,
  milliseconds: number
): Promise<T> {
  return new Promise((resolve, rejectPromise) => {
    const timer = setTimeout(
      () => rejectPromise(new DxfDeadlineError()),
      milliseconds
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        rejectPromise(error);
      }
    );
  });
}

function resultBase(
  input: DxfGeometryBoundaryInput,
  sourceChecksum: string,
  sourceFormat: "ascii_dxf" | "unknown",
  inspection: WorkerInspection | null,
  effectiveUnit: GeometrySourceUnit | null
) {
  const insUnits = inspection?.headerInsUnits ?? null;
  return {
    observationType: "imported" as const,
    evidence: {
      adapterVersion: DXF_ADAPTER_VERSION,
      fileName: input.fileName,
      mediaType: input.mediaType ?? null,
      byteLength: input.bytes.byteLength,
      checksum: { algorithm: "sha256" as const, value: sourceChecksum },
      sourceFormat,
      headerInsUnits: insUnits,
      headerUnit: headerUnit(insUnits),
      selectedUnit: input.selectedUnit ?? null,
      effectiveUnit,
    },
    inspection: inspection ? asInspection(inspection) : null,
    warnings:
      inspection && inspection.entityCount > inspection.closedBoundaryCount
        ? [
            "Entities that were not supported closed room polylines were preserved in the source asset but not measured.",
          ]
        : ([] as string[]),
    canonical: null,
    levelOverlays: [] as DxfGeometryLevelOverlay[],
  };
}

function rejected(
  base: ReturnType<typeof resultBase>,
  problem: DxfGeometryIssue,
  status:
    | "rejected"
    | "insufficient_information"
    | "conflicting_information" = "rejected"
): DxfGeometryBoundaryResult {
  return { ...base, status, issue: problem };
}

/**
 * Inspect and canonicalize one finalized DXF asset's bytes. Callers must resolve
 * authorization/finalization/checksum before supplying bytes; this boundary never
 * accepts a storage key or URL and never guesses source units.
 */
export async function inspectDxfGeometry(
  input: DxfGeometryBoundaryInput,
  runtime: BoundaryRuntime = {}
): Promise<DxfGeometryBoundaryResult> {
  const sourceChecksum = checksum(input.bytes);
  let base = resultBase(input, sourceChecksum, "unknown", null, null);
  if (input.bytes.byteLength > DXF_BOUNDARY_LIMITS.sourceBytes) {
    return rejected(
      base,
      issue("source_too_large", "DXF source exceeds the 10 MiB byte limit.")
    );
  }
  const mismatchedMediaType = mediaTypeIssue(input.mediaType);
  if (mismatchedMediaType) return rejected(base, mismatchedMediaType);
  if (
    input.selectedUnit !== undefined &&
    input.selectedUnit !== "m" &&
    input.selectedUnit !== "mm"
  ) {
    return rejected(
      base,
      issue(
        "unsupported_source_units",
        "Selected units must be explicit metres or millimetres."
      ),
      "insufficient_information"
    );
  }
  const preflightIssue = asciiDxfPreflight(input.bytes, input.fileName);
  if (preflightIssue) return rejected(base, preflightIssue);

  const source = Buffer.from(input.bytes).toString("ascii");
  const requestedDeadline =
    runtime.deadlineMilliseconds ?? DXF_BOUNDARY_LIMITS.deadlineMilliseconds;
  const deadlineMilliseconds = Math.max(
    1,
    Math.min(requestedDeadline, DXF_BOUNDARY_LIMITS.deadlineMilliseconds)
  );
  const deadlineAtMilliseconds = Date.now() + deadlineMilliseconds;
  let inspected: WorkerInspection;
  try {
    const inspector =
      runtime.inspect ?? (text => inspectInWorker(text, deadlineMilliseconds));
    inspected = await withDeadline(inspector(source), deadlineMilliseconds);
  } catch (error) {
    const problem =
      error instanceof DxfDeadlineError
        ? issue(
            "deadline_exceeded",
            "DXF inspection exceeded the five-second deadline."
          )
        : error instanceof DxfCapacityError
          ? issue(
              "processing_capacity_exceeded",
              "DXF inspection capacity is full; retry after current geometry work finishes."
            )
          : issue(
              "parse_failed",
              `DXF parser rejected the source: ${error instanceof Error ? error.message : String(error)}`
            );
    return rejected(
      { ...base, evidence: { ...base.evidence, sourceFormat: "ascii_dxf" } },
      problem
    );
  }

  base = resultBase(input, sourceChecksum, "ascii_dxf", inspected, null);
  if (inspected.entityCount > DXF_BOUNDARY_LIMITS.entities) {
    return rejected(
      base,
      issue("entity_limit_exceeded", "DXF exceeds the 100,000 entity limit.")
    );
  }
  if (inspected.vertexCount > DXF_BOUNDARY_LIMITS.vertices) {
    return rejected(
      base,
      issue("vertex_limit_exceeded", "DXF exceeds the 100,000 vertex limit.")
    );
  }
  if (inspected.layerCount > DXF_BOUNDARY_LIMITS.layers) {
    return rejected(
      base,
      issue("layer_limit_exceeded", "DXF exceeds the 2,000 layer limit.")
    );
  }
  if (inspected.maximumBlockNestingDepth > DXF_BOUNDARY_LIMITS.nestingDepth) {
    return rejected(
      base,
      issue("nesting_limit_exceeded", "DXF block nesting exceeds depth 32.")
    );
  }
  if (inspected.hasUnsupportedBlockReference) {
    return rejected(
      base,
      issue(
        "unsupported_block_reference",
        "DXF block references or block-contained geometry require transforms that v1 does not apply."
      )
    );
  }
  const exactCoordinateLimitExceeded = inspected.boundaries.some(boundary =>
    boundary.vertices.some(
      vertex =>
        coordinateLexemeExceedsLimit(vertex.x) ||
        coordinateLexemeExceedsLimit(vertex.y)
    )
  );
  if (
    inspected.hasNonFiniteCoordinate ||
    inspected.exceedsCoordinateLimit ||
    exactCoordinateLimitExceeded
  ) {
    return rejected(
      base,
      issue(
        "coordinate_limit_exceeded",
        "DXF contains invalid coordinates or coordinates beyond 1e9 source units."
      )
    );
  }
  if (inspected.hasNonPlanarCoordinate) {
    return rejected(
      base,
      issue(
        "malformed_topology",
        "DXF room boundaries must be planar at entity Z=0; nonzero, mixed, or 3D polyline coordinates are unsupported."
      )
    );
  }
  if (inspected.unsupportedCurveType) {
    return rejected(
      base,
      issue(
        "unsupported_curve",
        `DXF contains unsupported ${inspected.unsupportedCurveType} curve geometry.`
      )
    );
  }
  if (inspected.hasUnsupportedBulge) {
    return rejected(
      base,
      issue(
        "unsupported_bulge",
        "DXF contains a curved polyline bulge, which v1 cannot measure."
      )
    );
  }
  if (inspected.closedBoundaryCount === 0) {
    return rejected(
      base,
      issue(
        "no_closed_room_boundaries",
        "DXF contains no supported closed room polylines."
      ),
      "insufficient_information"
    );
  }

  const observedUnit = headerUnit(inspected.headerInsUnits);
  if (!observedUnit && !isUnknownUnitCode(inspected.headerInsUnits)) {
    return rejected(
      base,
      issue(
        "unsupported_source_units",
        `DXF $INSUNITS=${inspected.headerInsUnits} is not metres or millimetres.`
      ),
      "insufficient_information"
    );
  }
  if (
    observedUnit &&
    input.selectedUnit &&
    observedUnit !== input.selectedUnit
  ) {
    return rejected(
      base,
      issue(
        "source_unit_conflict",
        "Selected units conflict with the explicit DXF $INSUNITS value."
      ),
      "conflicting_information"
    );
  }
  const effectiveUnit = observedUnit ?? input.selectedUnit ?? null;
  base = resultBase(
    input,
    sourceChecksum,
    "ascii_dxf",
    inspected,
    effectiveUnit
  );
  if (!effectiveUnit) {
    return rejected(
      base,
      issue(
        "unknown_source_units",
        "DXF has no explicit metre or millimetre unit; select units before import."
      ),
      "insufficient_information"
    );
  }

  let rooms: Array<{
    sourceRoomId: string;
    sourceLayer: string;
    input: {
      spaceId: string;
      levelElevation: string;
      outerRing: GeometryInputPoint[];
    };
  }>;
  let canonical;
  try {
    rooms = inspected.boundaries.map(boundary => {
      const points: GeometryInputPoint[] = boundary.vertices.map(vertex => ({
        x: coordinateLexemeToPlainDecimal(vertex.x),
        y: coordinateLexemeToPlainDecimal(vertex.y),
      }));
      points.push({ ...points[0] });
      const sourceRoomId = stableDxfRoomId(
        points,
        input.levelElevation,
        effectiveUnit,
        input.snapTransform ?? "none",
        deadlineAtMilliseconds
      );
      return {
        sourceRoomId,
        sourceLayer: boundary.layer,
        input: {
          spaceId: sourceRoomId,
          levelElevation: input.levelElevation,
          outerRing: points,
        },
      };
    });

    canonical = canonicalizeGeometry(
      {
        schemaVersion: GEOMETRY_SCHEMA_VERSION,
        measurementBasis: ROOM_FLOOR_POLYGON_AREA,
        sourceUnit: effectiveUnit,
        snapTransform: input.snapTransform ?? "none",
        rooms: rooms.map(room => room.input),
      },
      { deadlineAtMilliseconds }
    );
  } catch (error) {
    if (error instanceof GeometryDeadlineError) {
      return rejected(
        base,
        issue(
          "deadline_exceeded",
          "DXF geometry normalization exceeded the five-second deadline."
        )
      );
    }
    return rejected(
      base,
      issue(
        "malformed_topology",
        error instanceof Error ? error.message : String(error)
      )
    );
  }
  if (
    Buffer.byteLength(canonical.canonicalJson, "utf8") >
    DXF_BOUNDARY_LIMITS.canonicalJsonBytes
  ) {
    return rejected(
      base,
      issue(
        "canonical_json_limit_exceeded",
        "Canonical geometry exceeds the 8 MiB JSON limit."
      )
    );
  }

  const overlaysByElevation = new Map<string, DxfGeometryLevelOverlay>();
  const sourceRoomsById = new Map(
    rooms.map(room => [room.sourceRoomId, room] as const)
  );
  canonical.geometry.rooms.forEach(canonicalRoom => {
    const sourceRoom = sourceRoomsById.get(canonicalRoom.spaceId);
    if (!sourceRoom) {
      throw new Error("Canonical DXF room lost its stable source identity");
    }
    const elevation = canonicalRoom.levelElevationMicrometres;
    const overlay = overlaysByElevation.get(elevation) ?? {
      levelElevationMicrometres: elevation,
      rooms: [],
    };
    overlay.rooms.push({
      sourceRoomId: sourceRoom.sourceRoomId,
      sourceLayer: sourceRoom.sourceLayer,
      sourcePoints: sourceRoom.input.outerRing,
      normalizedPoints: canonicalRoom.outerRing.points,
    });
    overlaysByElevation.set(elevation, overlay);
  });
  const levelOverlays = Array.from(overlaysByElevation.values());
  if (
    levelOverlays.some(
      overlay =>
        Buffer.byteLength(JSON.stringify(overlay), "utf8") >
        DXF_BOUNDARY_LIMITS.overlayLevelBytes
    )
  ) {
    return rejected(
      base,
      issue(
        "overlay_limit_exceeded",
        "A per-level overlay exceeds the 2 MiB response limit."
      )
    );
  }

  return {
    ...base,
    status: "imported",
    issue: null,
    canonical,
    levelOverlays,
  };
}
