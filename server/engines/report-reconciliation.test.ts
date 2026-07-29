import { describe, expect, it } from "vitest";
import { MATERIAL_RESOLUTION_POLICY_VERSION } from "../../shared/material-calculations";
import { governedMaterialLibrarySnapshot } from "../../tests/fixtures/material-price-snapshots";
import { buildWorkflowSpaceMqiReconciliation } from "./report-reconciliation";

describe("workflow/space/MQI report reconciliation", () => {
  it("reconciles stored fit-out rooms, deterministic surfaces, 100% groups, locks, and library prices", () => {
    const result = buildWorkflowSpaceMqiReconciliation({
      projectFitOutAreaM2: "30.00",
      rooms: [
        {
          roomCode: "LVG",
          roomName: "Living",
          sqm: "20.00",
          source: "user_manual",
          isFitOut: true,
          finishGrade: "A",
          priority: "high",
          budgetPct: "0.60",
        },
        {
          roomCode: "BTH",
          roomName: "Bathroom",
          sqm: "10.00",
          source: "typology_default",
          isFitOut: true,
          finishGrade: "B",
          priority: "medium",
          budgetPct: "0.40",
        },
        {
          roomCode: "PKG",
          roomName: "Parking",
          sqm: "50.00",
          source: "typology_default",
          isFitOut: false,
          finishGrade: "C",
          priority: "low",
          budgetPct: "0",
        },
      ],
      allocations: [
        {
          roomId: "LVG",
          roomName: "Living",
          element: "floor",
          materialLibraryId: 1,
          allocationPct: "60.00",
          surfaceAreaM2: "12.00",
          isLocked: true,
        },
        {
          roomId: "LVG",
          roomName: "Living",
          element: "floor",
          materialLibraryId: 2,
          allocationPct: "40.00",
          surfaceAreaM2: "8.00",
          isLocked: true,
        },
        {
          roomId: "BTH",
          roomName: "Bathroom",
          element: "floor",
          materialLibraryId: 1,
          allocationPct: "100.00",
          surfaceAreaM2: "10.00",
          isLocked: false,
        },
      ],
      priceSnapshots: [
        governedMaterialLibrarySnapshot({ legacyId: 1, priceMin: 100, priceMax: 200 }),
        governedMaterialLibrarySnapshot({ legacyId: 2, priceMin: 50, priceMax: 150 }),
      ],
    });

    expect(result.spaceProgram).toEqual({
      storedRoomCount: 3,
      fitOutRoomCount: 2,
      manualRoomCount: 1,
      projectFitOutAreaM2: 30,
      fitOutRoomAreaM2: 30,
      varianceM2: 0,
      reconciles: true,
    });
    expect(result.surfaces).toEqual({
      formulaVersion: "mqi-surface-area-v1",
      ceilingHeightM: 2.8,
      floorM2: 30,
      wallsM2: 73.86,
      ceilingM2: 28.5,
      totalM2: 132.36,
    });
    expect(result.allocations).toMatchObject({
      rowCount: 3,
      groupCount: 2,
      lockedRowCount: 2,
      lockedGroupCount: 1,
      allGroupsPass100Pct: true,
      allGroupsSurfaceReconcile: true,
      groups: [
        { roomId: "BTH", element: "floor", allocationPctTotal: 100, passes100Pct: true, surfaceAreaM2Total: 10, expectedSurfaceAreaM2: 10, surfaceVarianceM2: 0, surfaceReconciles: true },
        { roomId: "LVG", element: "floor", allocationPctTotal: 100, passes100Pct: true, surfaceAreaM2Total: 20, expectedSurfaceAreaM2: 20, surfaceVarianceM2: 0, surfaceReconciles: true },
      ],
    });
    expect(result.materialCosts).toEqual({
      currency: "AED",
      source: "EV-02 governed material-price resolver",
      pricedAllocationCount: 3,
      unpricedAllocationCount: 0,
      allAllocationsPriced: true,
      min: 2600,
      mid: 4100,
      max: 5600,
      coverage: {
        state: "complete",
        totalItemCount: 3,
        pricedItemCount: 3,
        insufficientItemCount: 0,
        reasons: {},
      },
      basis: {
        policyVersion: MATERIAL_RESOLUTION_POLICY_VERSION,
        label: "Legacy scope-unknown assumption",
        assumptionRowCount: 2,
        observedRowCount: 0,
      },
    });
  });

  it("exposes allocation and pricing gaps without inventing values", () => {
    const result = buildWorkflowSpaceMqiReconciliation({
      projectFitOutAreaM2: null,
      rooms: [],
      allocations: [{
        roomId: "LVG",
        roomName: "Living",
        element: "walls",
        materialLibraryId: null,
        allocationPct: "90.00",
        surfaceAreaM2: "20.00",
        isLocked: false,
      }],
      priceSnapshots: [],
    });

    expect(result.spaceProgram.reconciles).toBeNull();
    expect(result.allocations.groups).toEqual([{
      roomId: "LVG",
      roomName: "Living",
      element: "walls",
      allocationPctTotal: 90,
      passes100Pct: false,
      surfaceAreaM2Total: 20,
      expectedSurfaceAreaM2: null,
      surfaceVarianceM2: null,
      surfaceReconciles: false,
    }]);
    expect(result.allocations.allGroupsPass100Pct).toBe(false);
    expect(result.allocations.allGroupsSurfaceReconcile).toBe(false);
    expect(result.materialCosts).toMatchObject({
      pricedAllocationCount: 0,
      unpricedAllocationCount: 1,
      allAllocationsPriced: false,
      min: null,
      mid: null,
      max: null,
      coverage: {
        state: "insufficient",
        reasons: { identity_not_found: 1 },
      },
    });
  });

  it("does not report vacuous allocation or pricing passes", () => {
    const result = buildWorkflowSpaceMqiReconciliation({
      projectFitOutAreaM2: 0,
      rooms: [],
      allocations: [],
      priceSnapshots: [],
    });

    expect(result.allocations.allGroupsPass100Pct).toBe(false);
    expect(result.allocations.allGroupsSurfaceReconcile).toBe(false);
    expect(result.materialCosts.allAllocationsPriced).toBe(false);
    expect(result.materialCosts.coverage).toMatchObject({
      state: "insufficient",
      totalItemCount: 0,
      pricedItemCount: 0,
      insufficientItemCount: 0,
    });
  });

  it("fails the allocation-surface check when stored area is stale", () => {
    const result = buildWorkflowSpaceMqiReconciliation({
      projectFitOutAreaM2: 10,
      rooms: [{
        roomCode: "LVG",
        roomName: "Living",
        sqm: 10,
        source: "user_manual",
        isFitOut: true,
        finishGrade: "C",
        priority: "high",
        budgetPct: 1,
      }],
      allocations: [{
        roomId: "LVG",
        roomName: "Living",
        element: "floor",
        materialLibraryId: 1,
        allocationPct: 100,
        surfaceAreaM2: 9,
        isLocked: false,
      }],
      priceSnapshots: [
        governedMaterialLibrarySnapshot({ legacyId: 1, priceMin: 100, priceMax: 150 }),
      ],
    });

    expect(result.allocations.groups[0]).toMatchObject({
      surfaceAreaM2Total: 9,
      expectedSurfaceAreaM2: 10,
      surfaceVarianceM2: -1,
      surfaceReconciles: false,
    });
    expect(result.allocations.allGroupsSurfaceReconcile).toBe(false);
  });
});
