import { calculateSurfaceAreas } from "./design/material-quantity-engine";

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
  isLocked: boolean;
}

export interface ReportMaterialLibraryPrice {
  id: number;
  priceAedMin: unknown;
  priceAedMax: unknown;
}

export interface WorkflowSpaceMqiReconciliation {
  version: typeof RECONCILIATION_VERSION;
  sourceTables: readonly [
    "projects",
    "space_program_rooms",
    "material_allocations",
    "material_library",
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
    source: "material_library.priceAedMin/priceAedMax";
    pricedAllocationCount: number;
    unpricedAllocationCount: number;
    allAllocationsPriced: boolean;
    min: number;
    mid: number;
    max: number;
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
 * authoritative AED bounds come only from material_library.
 */
export function buildWorkflowSpaceMqiReconciliation(input: {
  projectFitOutAreaM2: unknown;
  rooms: readonly ReportSpaceProgramRoom[];
  allocations: readonly ReportMaterialAllocation[];
  materialLibrary: readonly ReportMaterialLibraryPrice[];
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

  const libraryById = new Map(input.materialLibrary.map(material => [material.id, material]));
  let pricedAllocationCount = 0;
  let unpricedAllocationCount = 0;
  let min = 0;
  let max = 0;
  for (const allocation of input.allocations) {
    const material = allocation.materialLibraryId === null
      ? undefined
      : libraryById.get(allocation.materialLibraryId);
    const priceMin = finiteNumber(material?.priceAedMin);
    const priceMax = finiteNumber(material?.priceAedMax);
    if (priceMin === null || priceMax === null) {
      unpricedAllocationCount += 1;
      continue;
    }
    const areaM2 = numberOrZero(allocation.surfaceAreaM2);
    pricedAllocationCount += 1;
    min += areaM2 * priceMin;
    max += areaM2 * priceMax;
  }
  min = round2(min);
  max = round2(max);

  return {
    version: RECONCILIATION_VERSION,
    sourceTables: [
      "projects",
      "space_program_rooms",
      "material_allocations",
      "material_library",
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
      source: "material_library.priceAedMin/priceAedMax",
      pricedAllocationCount,
      unpricedAllocationCount,
      allAllocationsPriced: input.allocations.length > 0 && unpricedAllocationCount === 0,
      min,
      mid: round2((min + max) / 2),
      max,
    },
  };
}
