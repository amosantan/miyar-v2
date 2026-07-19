import type { ReportMaterialAllocation, ReportSpaceProgramRoom } from "../../../server/engines/report-reconciliation";
import type { Room } from "../../../server/engines/design/space-program";
import type { FloorPlanAnalysis } from "../../../server/engines/design/floor-plan-analyzer";
import type { PdfExtraction, Project } from "../../../drizzle/schema";

export const legacyTemplateProject = {
  id: 101,
  orgId: 7,
  ctx01Typology: "Residential",
  ctx03Gfa: "100",
  totalFitoutArea: null,
  fin01BudgetCap: "400",
  floorPlanAnalysis: null,
};

export const legacyManualProjectAreas = {
  id: 103,
  orgId: 7,
  ctx03Gfa: "100.00",
  totalFitoutArea: "60.00",
  fitoutAreaVerified: true,
} satisfies Pick<Project, "id" | "orgId" | "ctx03Gfa" | "totalFitoutArea" | "fitoutAreaVerified">;

export const legacyAiProject = {
  ...legacyTemplateProject,
  id: 102,
  floorPlanAnalysis: {
    totalEstimatedSqm: 60,
    bedroomCount: 0,
    bathroomCount: 1,
    balconyPercentage: 0,
    circulationPercentage: 0,
    unitType: "Studio",
    analysisConfidence: "medium",
    rawNotes: "Provider-free legacy fixture",
    rooms: [
      { name: "Living", type: "living", estimatedSqm: 40, percentOfTotal: 66.67, finishGrade: "A" },
      { name: "Bathroom", type: "bathroom", estimatedSqm: 20, percentOfTotal: 33.33, finishGrade: "B" },
    ],
  } satisfies FloorPlanAnalysis,
};

export const legacyPdfExtraction = {
  id: 501,
  projectId: 101,
  assetId: 901,
  extractionMethod: "vision_ai",
  extractedRooms: [
    { name: "Living", areaSqm: 40, category: "living", confidence: 0.91 },
    { name: "Bathroom", areaSqm: 20, category: "bathroom", confidence: 0.84 },
  ],
  totalExtractedArea: "60.00",
  status: "extracted",
} satisfies Pick<PdfExtraction, "id" | "projectId" | "assetId" | "extractionMethod" | "extractedRooms" | "totalExtractedArea" | "status">;

function rectangleDxf(width: number, height: number, insUnits?: 4 | 6): string {
  const header = insUnits
    ? `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${insUnits}\n0\nENDSEC\n`
    : "";
  return `${header}0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nLiving\n90\n4\n70\n1\n10\n0\n20\n0\n10\n${width}\n20\n0\n10\n${width}\n20\n${height}\n10\n0\n20\n${height}\n0\nENDSEC\n0\nEOF\n`;
}

// AutoCAD $INSUNITS: 4 = millimetres, 6 = metres.
export const legacyDxfMetres = rectangleDxf(5, 4, 6);
export const legacyDxfMillimetres = rectangleDxf(5_000, 4_000, 4);
export const legacyDxfUnknownUnits = rectangleDxf(5, 4);

export const legacyStoredRooms: ReportSpaceProgramRoom[] = [
  {
    roomCode: "LVG",
    roomName: "Living",
    sqm: "40.00",
    source: "user_manual",
    isFitOut: true,
    finishGrade: "A",
    priority: "high",
    budgetPct: "0.67",
  },
  {
    roomCode: "BTH",
    roomName: "Bathroom",
    sqm: "20.00",
    source: "typology_default",
    isFitOut: true,
    finishGrade: "B",
    priority: "medium",
    budgetPct: "0.33",
  },
];

export const legacyMqiRooms: Room[] = legacyStoredRooms.map(room => ({
  id: room.roomCode,
  name: room.roomName,
  sqm: Number(room.sqm),
  budgetPct: Number(room.budgetPct),
  priority: room.priority,
  finishGrade: room.finishGrade,
}));

export const legacyLockedAllocations: ReportMaterialAllocation[] = [
  {
    roomId: "LVG",
    roomName: "Living",
    element: "floor",
    materialLibraryId: 1,
    allocationPct: "60.00",
    surfaceAreaM2: "24.00",
    isLocked: true,
  },
  {
    roomId: "LVG",
    roomName: "Living",
    element: "floor",
    materialLibraryId: 2,
    allocationPct: "40.00",
    surfaceAreaM2: "16.00",
    isLocked: true,
  },
  {
    roomId: "BTH",
    roomName: "Bathroom",
    element: "floor",
    materialLibraryId: 1,
    allocationPct: "100.00",
    surfaceAreaM2: "20.00",
    isLocked: false,
  },
];

export const legacyMaterialPrices = [
  { id: 1, priceAedMin: "100.00", priceAedMax: "200.00" },
  { id: 2, priceAedMin: "50.00", priceAedMax: "150.00" },
];
