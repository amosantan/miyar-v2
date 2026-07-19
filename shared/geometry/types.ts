export const GEOMETRY_SCHEMA_VERSION = "MIYAR_GEOM_V1" as const;
export const GEOMETRY_CANONICALIZER_VERSION =
  "miyar-geometry-canonicalizer-v1" as const;
export const GEOMETRY_TOLERANCE_POLICY_VERSION =
  "miyar-geometry-tolerance-v1" as const;
export const ROOM_FLOOR_POLYGON_AREA = "room_floor_polygon_area" as const;

export type GeometrySourceUnit = "m" | "mm";
export type GeometrySnapTransform = "none" | "1mm";
export type SpaceId = string;
export type GeometryAuthorityMode = "legacy" | "shadow" | "canonical";
export type GeometryReviewDecision =
  | "candidate_created"
  | "accepted"
  | "rejected"
  | "clarification_requested"
  | "reconciled";
export type GeometryResultState =
  | "valid"
  | "not_checked"
  | "conflict"
  | "insufficient";
export type MeasurementEvidenceClass =
  | "survey_measured"
  | "geometry_derived"
  | "source_stated"
  | "user_entered"
  | "imported"
  | "estimated"
  | "legacy_unknown";

/** Public logical contracts; database IDs remain implementation details. */
export interface SpaceVersion {
  spaceId: SpaceId;
  version: number;
  geometryVersionId: number;
  roomCode: string | null;
  roomName: string;
  category: string;
  levelId: string;
  zoneId: string | null;
  contentFingerprint: string;
}

export interface GeometryVersion {
  id: number;
  graphId: string;
  version: number;
  parentGeometryVersionId: number | null;
  schemaVersion: typeof GEOMETRY_SCHEMA_VERSION;
  fingerprint: CanonicalGeometryResult["fingerprint"];
  canonicalGeometry: CanonicalGeometryDocument;
}

export interface GeometrySource {
  id: number;
  sourceType: "manual" | "project_asset";
  assetId: number | null;
  acquisitionMethod: "manual_entry" | "dxf";
  sourceUnits: GeometrySourceUnit;
  sourceChecksum: string;
  assetChecksum: string | null;
  adapterVersion: string;
  sourceObservation: unknown;
}

export interface MeasurementRecord {
  id: number;
  spaceId: SpaceId | null;
  geometryVersionId: number | null;
  geometrySourceId: number | null;
  recordKind: "observation" | "derivation";
  measurementBasis: typeof ROOM_FLOOR_POLYGON_AREA | string;
  normalizedValueExact: string | null;
  normalizedUnit: string | null;
  evidenceClass: MeasurementEvidenceClass;
  resultState: GeometryResultState;
  contentFingerprint: string;
}

export interface MeasurementInputEdge {
  derivedMeasurementRecordId: number;
  inputMeasurementRecordId: number;
  inputOrdinal: number;
  inputRole: string;
}

export interface GeometryReviewEvent {
  id: number;
  expectedCurrentGeometryVersionId: number | null;
  candidateGeometryVersionId: number;
  resultGeometryVersionId: number | null;
  decision: GeometryReviewDecision;
  resultState: GeometryResultState;
  note: string;
  createdAt: string;
}

/** Decimal text is used at the boundary so binary floating point is never authoritative. */
export interface GeometryInputPoint {
  x: string;
  y: string;
}

export interface GeometryInputRoom {
  /** Stable project-scoped identity. Codes and display names are deliberately excluded. */
  spaceId: string;
  /** Elevation in the input source unit. */
  levelElevation: string;
  /** Rings must be explicitly closed (the last point repeats the first). */
  outerRing: GeometryInputPoint[];
  holes?: GeometryInputPoint[][];
}

export interface GeometryCanonicalizationInput {
  schemaVersion: typeof GEOMETRY_SCHEMA_VERSION;
  measurementBasis: typeof ROOM_FLOOR_POLYGON_AREA;
  sourceUnit: GeometrySourceUnit;
  /** Snapping is never implicit. Only the versioned 1 mm transform is supported. */
  snapTransform?: GeometrySnapTransform;
  rooms: GeometryInputRoom[];
}

/** Signed base-10 integer micrometres, serialized without a leading plus or zero padding. */
export type CanonicalMicrometre = string;

export interface CanonicalPoint {
  x: CanonicalMicrometre;
  y: CanonicalMicrometre;
}

export interface CanonicalEdge {
  /** Direction-independent SHA-256 identity, stable for shared boundaries. */
  edgeId: string;
  start: CanonicalPoint;
  end: CanonicalPoint;
}

export interface CanonicalRing {
  /** Explicitly closed, canonical start point, and deterministic orientation. */
  points: CanonicalPoint[];
  edges: CanonicalEdge[];
}

export interface CanonicalRoomGeometry {
  spaceId: string;
  levelElevationMicrometres: CanonicalMicrometre;
  outerRing: CanonicalRing;
  holes: CanonicalRing[];
  /** Exact twice-area in square micrometres, after subtracting holes. */
  areaSquareMicrometresTwice: string;
  /** Exact decimal representation of room floor polygon area in square metres. */
  areaSquareMetres: string;
}

export interface CanonicalGeometryDocument {
  schemaVersion: typeof GEOMETRY_SCHEMA_VERSION;
  canonicalizerVersion: typeof GEOMETRY_CANONICALIZER_VERSION;
  tolerancePolicyVersion: typeof GEOMETRY_TOLERANCE_POLICY_VERSION;
  measurementBasis: typeof ROOM_FLOOR_POLYGON_AREA;
  referenceFrame: {
    type: "project_local_xy";
    axisOrder: "xy";
    handedness: "right_handed";
  };
  normalization: {
    sourceUnit: GeometrySourceUnit;
    sourceUnitMicrometres: "1000000" | "1000";
    snapTransform: GeometrySnapTransform;
  };
  rooms: CanonicalRoomGeometry[];
}

export interface CanonicalGeometryResult {
  geometry: CanonicalGeometryDocument;
  canonicalJson: string;
  fingerprint: {
    algorithm: "sha256";
    domain: "MIYAR_GEOM_V1:canonical_geometry";
    value: string;
  };
}

export type AreaReconciliationResult = "equivalent" | "conflict";

export interface AreaReconciliation {
  result: AreaReconciliationResult;
  differenceSquareMicrometresTwice: string;
  toleranceSquareMicrometresTwice: string;
  tolerancePolicyVersion: typeof GEOMETRY_TOLERANCE_POLICY_VERSION;
}

export const DXF_ADAPTER_VERSION = "miyar-ascii-dxf-v1" as const;

export const DXF_BOUNDARY_LIMITS = {
  sourceBytes: 10 * 1024 * 1024,
  entities: 100_000,
  vertices: 100_000,
  layers: 2_000,
  nestingDepth: 32,
  absoluteSourceCoordinate: "1000000000",
  deadlineMilliseconds: 5_000,
  canonicalJsonBytes: 8 * 1024 * 1024,
  overlayLevelBytes: 2 * 1024 * 1024,
} as const;

export type DxfGeometryBoundaryStatus =
  | "imported"
  | "insufficient_information"
  | "conflicting_information"
  | "rejected";

export type DxfGeometryBoundaryIssueCode =
  | "source_too_large"
  | "not_ascii_dxf"
  | "binary_dxf_not_supported"
  | "dwg_not_supported"
  | "spoofed_file"
  | "unknown_source_units"
  | "unsupported_source_units"
  | "source_unit_conflict"
  | "unsupported_curve"
  | "unsupported_bulge"
  | "malformed_topology"
  | "no_closed_room_boundaries"
  | "entity_limit_exceeded"
  | "vertex_limit_exceeded"
  | "layer_limit_exceeded"
  | "nesting_limit_exceeded"
  | "unsupported_block_reference"
  | "coordinate_limit_exceeded"
  | "deadline_exceeded"
  | "processing_capacity_exceeded"
  | "canonical_json_limit_exceeded"
  | "overlay_limit_exceeded"
  | "parse_failed";

export interface DxfGeometrySourceEvidence {
  adapterVersion: typeof DXF_ADAPTER_VERSION;
  fileName: string;
  mediaType: string | null;
  byteLength: number;
  checksum: {
    algorithm: "sha256";
    value: string;
  };
  sourceFormat: "ascii_dxf" | "unknown";
  headerInsUnits: number | null;
  headerUnit: GeometrySourceUnit | null;
  selectedUnit: GeometrySourceUnit | null;
  effectiveUnit: GeometrySourceUnit | null;
}

export interface DxfGeometryInspection {
  entityCount: number;
  vertexCount: number;
  layerCount: number;
  maximumBlockNestingDepth: number;
  closedBoundaryCount: number;
}

export interface DxfGeometryIssue {
  code: DxfGeometryBoundaryIssueCode;
  message: string;
}

export interface DxfGeometryOverlayRoom {
  sourceRoomId: string;
  sourceLayer: string;
  sourcePoints: GeometryInputPoint[];
  normalizedPoints: CanonicalPoint[];
}

export interface DxfGeometryLevelOverlay {
  levelElevationMicrometres: CanonicalMicrometre;
  rooms: DxfGeometryOverlayRoom[];
}

/**
 * Fail-closed result of the deterministic CAD-file boundary. A non-imported
 * result intentionally retains its checksum, unit observations, and counts.
 */
export interface DxfGeometryBoundaryResult {
  status: DxfGeometryBoundaryStatus;
  observationType: "imported";
  evidence: DxfGeometrySourceEvidence;
  inspection: DxfGeometryInspection | null;
  issue: DxfGeometryIssue | null;
  warnings: string[];
  canonical: CanonicalGeometryResult | null;
  levelOverlays: DxfGeometryLevelOverlay[];
}

export interface DxfGeometryBoundaryInput {
  bytes: Uint8Array;
  fileName: string;
  mediaType?: string | null;
  /** Explicit user selection is accepted only when $INSUNITS is absent/zero. */
  selectedUnit?: GeometrySourceUnit;
  /** Declared project-local level elevation, expressed in the effective source unit. */
  levelElevation: string;
  snapTransform?: GeometrySnapTransform;
}
