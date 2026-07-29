import { calculateSurfaceAreas } from "./design/material-quantity-engine";
import {
  MATERIAL_RESOLUTION_POLICY_VERSION,
  type MaterialAggregateCoverage,
  type MaterialPriceInsufficiencyReason,
  type MaterialPriceSnapshot,
} from "../../shared/material-calculations";
import { resolveQuantityForUnitBasis } from "./material-pricing/quantity-policy";

const RECONCILIATION_VERSION = "workflow-space-mqi-reconciliation-v1" as const;
const SURFACE_FORMULA_VERSION = "mqi-surface-area-v1" as const;
const DEFAULT_CEILING_HEIGHT_M = 2.8;
const RECONCILIATION_TOLERANCE = 0.01;

export interface ReportSpaceProgramRoom {
  roomCode: string;
  roomName: string;
  sqm: unknown;
  source: string;
  isFitOut: boolean;
  finishGrade: "A" | "B" | "C";
  priority: "high" | "medium" | "low";
  budgetPct: unknown;
}

export interface ReportMaterialAllocation {
  roomId: string;
  roomName: string;
  element: string;
  materialLibraryId: number | null;
  allocationPct: unknown;
  surfaceAreaM2: unknown;
  explicitQuantity?: unknown;
  explicitQuantityUnit?: "sqm" | "lm" | "piece" | "pack" | "litre" | null;
  isLocked: boolean;
}

export interface WorkflowSpaceMqiReconciliation {
  version: typeof RECONCILIATION_VERSION;
  sourceTables: readonly [
    "projects",
    "space_program_rooms",
    "material_allocations",
    "governed_material_values",
  ];
  spaceProgram: {
    storedRoomCount: number;
    fitOutRoomCount: number;
    manualRoomCount: number;
    projectFitOutAreaM2: number | null;
    fitOutRoomAreaM2: number;
    varianceM2: number | null;
    reconciles: boolean | null;
  };
  surfaces: {
    formulaVersion: typeof SURFACE_FORMULA_VERSION;
    ceilingHeightM: number;
    floorM2: number;
    wallsM2: number;
    ceilingM2: number;
    totalM2: number;
  };
  allocations: {
    rowCount: number;
    groupCount: number;
    lockedRowCount: number;
    lockedGroupCount: number;
    allGroupsPass100Pct: boolean;
    allGroupsSurfaceReconcile: boolean;
    groups: Array<{
      roomId: string;
      roomName: string;
      element: string;
      allocationPctTotal: number;
      passes100Pct: boolean;
      surfaceAreaM2Total: number;
      expectedSurfaceAreaM2: number | null;
      surfaceVarianceM2: number | null;
      surfaceReconciles: boolean;
    }>;
  };
  materialCosts: {
    currency: "AED";
    source: "EV-02 governed material-price resolver";
    pricedAllocationCount: number;
    unpricedAllocationCount: number;
    allAllocationsPriced: boolean;
    min: number | null;
    mid: number | null;
    max: number | null;
    coverage: MaterialAggregateCoverage;
    basis: {
      policyVersion: typeof MATERIAL_RESOLUTION_POLICY_VERSION;
      label: string;
      assumptionRowCount: number;
      observedRowCount: number;
    };
  };
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value: unknown): number {
  return finiteNumber(value) ?? 0;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Builds the exact workflow/space/MQI values rendered by a full report.
 * This function is deterministic and never uses stored allocation cost fields:
 * authoritative AED bounds come only from governed EV-02 resolver snapshots.
 */
export function buildWorkflowSpaceMqiReconciliation(input: {
  projectFitOutAreaM2: unknown;
  rooms: readonly ReportSpaceProgramRoom[];
  allocations: readonly ReportMaterialAllocation[];
  priceSnapshots: readonly MaterialPriceSnapshot[];
}): WorkflowSpaceMqiReconciliation {
  const fitOutRooms = input.rooms.filter(room => room.isFitOut);
  const roomAreaM2 = round2(fitOutRooms.reduce(
    (total, room) => total + numberOrZero(room.sqm),
    0,
  ));
  const projectArea = finiteNumber(input.projectFitOutAreaM2);
  const varianceM2 = projectArea === null ? null : round2(projectArea - roomAreaM2);

  const surfaces = calculateSurfaceAreas(
    fitOutRooms.map(room => ({
      id: room.roomCode,
      name: room.roomName,
      sqm: numberOrZero(room.sqm),
      budgetPct: numberOrZero(room.budgetPct),
      priority: room.priority,
      finishGrade: room.finishGrade,
    })),
    DEFAULT_CEILING_HEIGHT_M,
  );
  const floorM2 = round2(surfaces.reduce((total, room) => total + room.floorM2, 0));
  const wallsM2 = round2(surfaces.reduce((total, room) => total + room.wallM2, 0));
  const ceilingM2 = round2(surfaces.reduce((total, room) => total + room.ceilingM2, 0));

  const allocationGroups = new Map<string, {
    roomId: string;
    roomName: string;
    element: string;
    allocationPctTotal: number;
    surfaceAreaM2Total: number;
    locked: boolean;
  }>();
  const surfacesByRoomId = new Map(surfaces.map(surface => [surface.roomId, surface]));
  for (const allocation of input.allocations) {
    const key = `${allocation.roomId}\u0000${allocation.element}`;
    const group = allocationGroups.get(key) ?? {
      roomId: allocation.roomId,
      roomName: allocation.roomName,
      element: allocation.element,
      allocationPctTotal: 0,
      surfaceAreaM2Total: 0,
      locked: false,
    };
    group.allocationPctTotal += numberOrZero(allocation.allocationPct);
    group.surfaceAreaM2Total += numberOrZero(allocation.surfaceAreaM2);
    group.locked ||= allocation.isLocked;
    allocationGroups.set(key, group);
  }
  const groups = Array.from(allocationGroups.values())
    .map(group => {
      const allocationPctTotal = round2(group.allocationPctTotal);
      const surfaceAreaM2Total = round2(group.surfaceAreaM2Total);
      const roomSurfaces = surfacesByRoomId.get(group.roomId);
      const expectedSurfaceAreaM2 = roomSurfaces === undefined
        ? null
        : group.element === "floor"
          ? round2(roomSurfaces.floorM2)
          : group.element === "walls"
            ? round2(roomSurfaces.wallM2)
            : group.element === "ceiling"
              ? round2(roomSurfaces.ceilingM2)
              : group.element === "joinery"
                ? 0
                : null;
      const surfaceVarianceM2 = expectedSurfaceAreaM2 === null
        ? null
        : round2(surfaceAreaM2Total - expectedSurfaceAreaM2);
      return {
        roomId: group.roomId,
        roomName: group.roomName,
        element: group.element,
        allocationPctTotal,
        passes100Pct: Math.abs(allocationPctTotal - 100) <= RECONCILIATION_TOLERANCE,
        surfaceAreaM2Total,
        expectedSurfaceAreaM2,
        surfaceVarianceM2,
        surfaceReconciles: surfaceVarianceM2 !== null
          && Math.abs(surfaceVarianceM2) <= RECONCILIATION_TOLERANCE,
      };
    })
    .sort((left, right) =>
      left.roomId.localeCompare(right.roomId)
      || left.element.localeCompare(right.element)
      || left.roomName.localeCompare(right.roomName)
    );

  const priceByLibraryId = new Map(
    input.priceSnapshots
      .filter(snapshot => snapshot.reference.source === "material_library")
      .map(snapshot => [snapshot.reference.legacyId, snapshot]),
  );
  let pricedAllocationCount = 0;
  let unpricedAllocationCount = 0;
  let min = 0;
  let max = 0;
  const reasons: MaterialAggregateCoverage["reasons"] = {};
  const pricedSnapshotKeys = new Set<string>();
  for (const allocation of input.allocations) {
    const snapshot = allocation.materialLibraryId === null
      ? undefined
      : priceByLibraryId.get(allocation.materialLibraryId);
    let insufficiencyReason: MaterialPriceInsufficiencyReason | undefined;
    if (snapshot === undefined) {
      insufficiencyReason = "identity_not_found";
    } else if (snapshot.state === "insufficient") {
      insufficiencyReason = snapshot.reason;
    }
    const quantity = snapshot?.state === "resolved"
      ? resolveQuantityForUnitBasis({
          unitBasis: snapshot.unitBasis,
          surfaceAreaM2:
            allocation.element === "floor" ||
            allocation.element === "walls" ||
            allocation.element === "ceiling"
              ? numberOrZero(allocation.surfaceAreaM2)
              : undefined,
          explicitQuantity:
            allocation.explicitQuantity === undefined ||
            allocation.explicitQuantity === null
              ? undefined
              : numberOrZero(allocation.explicitQuantity),
          explicitQuantityUnit:
            allocation.explicitQuantityUnit ?? undefined,
          paintCoverageState: snapshot.paintCoverageState,
          paintCoverageProfile: snapshot.paintCoverageProfile
            ? { status: "approved", ...snapshot.paintCoverageProfile }
            : undefined,
          asOf: new Date(snapshot.resolverAsOf),
        })
      : undefined;
    if (quantity?.state === "insufficient") {
      insufficiencyReason = quantity.reason;
    }
    if (snapshot?.state !== "resolved" || quantity?.state !== "resolved") {
      unpricedAllocationCount += 1;
      const reason = insufficiencyReason ?? "no_governed_value";
      reasons[reason] = (reasons[reason] ?? 0) + 1;
      continue;
    }
    pricedAllocationCount += 1;
    pricedSnapshotKeys.add(`${snapshot.productId}:${snapshot.specificationId}`);
    min += quantity.quantity * Number(snapshot.priceMin);
    max += quantity.quantity * Number(snapshot.priceMax);
  }
  min = round2(min);
  max = round2(max);

  let assumptionRowCount = 0;
  let legacyCompatibilityRowCount = 0;
  let observedRowCount = 0;
  for (const snapshot of input.priceSnapshots) {
    if (
      snapshot.state !== "resolved"
      || !pricedSnapshotKeys.has(`${snapshot.productId}:${snapshot.specificationId}`)
    ) continue;
    if (snapshot.provenance.sourceLadderRung === "assumption") {
      assumptionRowCount += 1;
      if (snapshot.provenance.compatibilityFallback) {
        legacyCompatibilityRowCount += 1;
      }
    } else observedRowCount += 1;
  }
  const ordinaryAssumptionRowCount =
    assumptionRowCount - legacyCompatibilityRowCount;
  const pricedRowCount = assumptionRowCount + observedRowCount;
  const basisLabel =
    legacyCompatibilityRowCount === pricedRowCount
      && legacyCompatibilityRowCount > 0
      ? "Legacy scope-unknown assumption"
      : legacyCompatibilityRowCount > 0
        ? `Mixed (${[
          "legacy scope-unknown assumption",
          ordinaryAssumptionRowCount > 0 ? "MIYAR assumption" : null,
          observedRowCount > 0 ? "observed" : null,
        ].filter(Boolean).join(" + ")})`
        : observedRowCount === 0
          ? "MIYAR assumption"
          : assumptionRowCount === 0
            ? "Observed market data"
            : "Mixed (MIYAR assumption + observed)";

  return {
    version: RECONCILIATION_VERSION,
    sourceTables: [
      "projects",
      "space_program_rooms",
      "material_allocations",
      "governed_material_values",
    ],
    spaceProgram: {
      storedRoomCount: input.rooms.length,
      fitOutRoomCount: fitOutRooms.length,
      manualRoomCount: input.rooms.filter(room => room.source === "user_manual").length,
      projectFitOutAreaM2: projectArea === null ? null : round2(projectArea),
      fitOutRoomAreaM2: roomAreaM2,
      varianceM2,
      reconciles: varianceM2 === null
        ? null
        : Math.abs(varianceM2) <= RECONCILIATION_TOLERANCE,
    },
    surfaces: {
      formulaVersion: SURFACE_FORMULA_VERSION,
      ceilingHeightM: DEFAULT_CEILING_HEIGHT_M,
      floorM2,
      wallsM2,
      ceilingM2,
      totalM2: round2(floorM2 + wallsM2 + ceilingM2),
    },
    allocations: {
      rowCount: input.allocations.length,
      groupCount: groups.length,
      lockedRowCount: input.allocations.filter(allocation => allocation.isLocked).length,
      lockedGroupCount: Array.from(allocationGroups.values()).filter(group => group.locked).length,
      allGroupsPass100Pct: groups.length > 0 && groups.every(group =>
        Math.abs(round2(group.allocationPctTotal) - 100) <= RECONCILIATION_TOLERANCE
      ),
      allGroupsSurfaceReconcile: groups.length > 0
        && groups.every(group => group.surfaceReconciles),
      groups,
    },
    materialCosts: {
      currency: "AED",
      source: "EV-02 governed material-price resolver",
      pricedAllocationCount,
      unpricedAllocationCount,
      allAllocationsPriced: input.allocations.length > 0 && unpricedAllocationCount === 0,
      min: unpricedAllocationCount === 0 && input.allocations.length > 0 ? min : null,
      mid: unpricedAllocationCount === 0 && input.allocations.length > 0
        ? round2((min + max) / 2)
        : null,
      max: unpricedAllocationCount === 0 && input.allocations.length > 0 ? max : null,
      coverage: {
        state:
          input.allocations.length === 0 || pricedAllocationCount === 0
            ? "insufficient"
            : unpricedAllocationCount === 0
              ? "complete"
              : "partial",
        totalItemCount: input.allocations.length,
        pricedItemCount: pricedAllocationCount,
        insufficientItemCount: unpricedAllocationCount,
        reasons,
      },
      basis: {
        policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
        label: basisLabel,
        assumptionRowCount,
        observedRowCount,
      },
    },
  };
}
