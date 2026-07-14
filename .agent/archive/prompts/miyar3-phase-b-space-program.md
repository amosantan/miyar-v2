# MIYAR 3.0 Phase B — Typology-Aware Space Program Intelligence

## Mandatory Pre-Read
Before starting ANY work, read:
1. `GEMINI.md` — master context
2. `.agent/rules/miyar-memory.md` — full phase history and immutable rules
3. `PROGRESS.md` — current task status
4. `.agent/skills/miyar-materials/SKILL.md` — MQI integration rules

---

## The Problem Phase A Has Right Now

Phase A's `generateMaterialAllocations()` calls `buildSpaceProgram()` to get rooms, then runs MQI on ALL of them.

For a 50,000 sqm office building, this prices every sqm — which is wrong. The office floors are shell and core (tenants fit them out). Only the lobby (~800 sqm), toilet cores (~1,200 sqm), and amenities (~2,000 sqm) get MIYAR's fit-out cost calculation. Pricing 50,000 sqm inflates the cost by ~10×.

Phase B fixes this by adding a persistent, editable Space Program layer that knows which rooms are fit-out vs. shell & core — before MQI runs.

---

## What You Are Building

A full typology-aware space program pipeline:

1. **Typology Fit-Out Rules engine** — deterministic: given typology + room category → default fit-out flag
2. **Amenity Sub-Space Taxonomy** — seeded: each amenity type has fixed sub-spaces with sqm ratios
3. **DXF/DWG Parser** — parse floor plan files → extract rooms with sqm
4. **Space Program Extractor** — orchestrates file parse OR GFA generation → stores to DB with fit-out tags
5. **Space Program Router** — 8 `orgProcedure` tRPC endpoints
6. **Space Program Editor UI** — room table with fit-out toggles, amenity expander, block tabs for mixed-use
7. **Phase A MQI integration** — `materialQuantity.generate` reads fit-out rooms from DB instead of calling `buildSpaceProgram()` inline

---

## Step 1 — DB Schema

Add to `drizzle/schema.ts` using `mysqlTable` (TiDB — never pgTable):

```typescript
export const spaceProgramRooms = mysqlTable('space_program_rooms', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  organizationId: varchar('organization_id', { length: 36 }).notNull(),
  // Block support for mixed-use
  blockName: varchar('block_name', { length: 100 }).default('Main'),     // e.g. "Residential Tower", "Retail Podium"
  blockTypology: varchar('block_typology', { length: 50 }).notNull(),    // see Typology enum below
  // Room identity
  name: varchar('name', { length: 150 }).notNull(),                      // e.g. "Master Bedroom", "Ground Floor Lobby"
  roomCategory: varchar('room_category', { length: 50 }).notNull(),      // see RoomCategory enum below
  sqm: decimal('sqm', { precision: 10, scale: 2 }).notNull(),
  level: int('level').default(0),                                         // floor number (0 = ground)
  // Source tracking
  source: mysqlEnum('source', ['generated', 'vision_analysis', 'dwg_geometry']).default('generated'),
  // Fit-out classification
  fitOut: boolean('fit_out').notNull(),                                   // true = MIYAR prices this; false = shell & core
  fitOutOverridden: boolean('fit_out_overridden').default(false),         // true = developer manually toggled (don't reset on re-apply defaults)
  // Amenity expansion
  isAmenity: boolean('is_amenity').default(false),
  amenityType: varchar('amenity_type', { length: 50 }),                  // see AmenityType enum below
  parentRoomId: varchar('parent_room_id', { length: 36 }),               // populated for amenity sub-spaces
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const amenitySubSpaces = mysqlTable('amenity_sub_spaces', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`(UUID())`),
  amenityType: varchar('amenity_type', { length: 50 }).notNull(),        // FK to AMENITY_TAXONOMY key
  subSpaceName: varchar('sub_space_name', { length: 100 }).notNull(),
  roomCategory: varchar('room_category', { length: 50 }).notNull(),
  sqmRatio: decimal('sqm_ratio', { precision: 5, scale: 4 }).notNull(), // fraction of parent sqm (must sum to 1.0 per amenityType)
  fitOut: boolean('fit_out').notNull(),
  sortOrder: int('sort_order').default(0),
});
```

Run `pnpm db:push` after adding these — new baseline: **87 tables**.

---

## Step 2 — Core Engines

### 2a. `server/engines/design/typology-fitout-rules.ts`

Pure TypeScript, zero DB, zero LLM. Deterministic rules only.

```typescript
export type Typology =
  | 'villa'
  | 'townhouse'
  | 'apartment'
  | 'serviced_apartment'
  | 'restaurant'
  | 'cafe_bar'
  | 'office_building'
  | 'retail_commercial'
  | 'hotel'
  | 'resort'
  | 'clinic_medical'
  | 'mixed_use';

export type RoomCategory =
  | 'living_room'
  | 'dining_room'
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'home_office'
  | 'corridor_hallway'
  | 'lobby_reception'
  | 'common_corridor'
  | 'toilet_wc'
  | 'amenity'
  | 'office_floor'
  | 'retail_unit'
  | 'clinical_room'
  | 'commercial_kitchen'
  | 'dining_area'
  | 'bar_area'
  | 'back_of_house'
  | 'guestroom'
  | 'meeting_room'
  | 'parking'
  | 'plant_mechanical'
  | 'service_loading'
  | 'store_room';

// Returns true = fit-out (MIYAR prices this), false = shell & core (excluded from MQI)
export function getDefaultFitOutFlag(typology: Typology, roomCategory: RoomCategory): boolean {
  const ALWAYS_SHELL: RoomCategory[] = ['parking', 'plant_mechanical', 'service_loading'];
  if (ALWAYS_SHELL.includes(roomCategory)) return false;

  switch (typology) {
    case 'villa':
    case 'townhouse':
      // Store rooms are shell; garages are shell
      return !(['store_room'] as RoomCategory[]).includes(roomCategory);

    case 'apartment':
    case 'serviced_apartment':
      // All interior rooms fit-out; building common areas (lobby, corridors) also fit-out
      return !(['store_room'] as RoomCategory[]).includes(roomCategory);

    case 'restaurant':
    case 'cafe_bar':
      // Everything gets fit-out including commercial kitchen
      return true;

    case 'office_building':
      // Only common areas fit-out; office floors are tenant shell & core
      const officeFitOut: RoomCategory[] = [
        'lobby_reception', 'common_corridor', 'toilet_wc', 'amenity', 'meeting_room',
      ];
      return officeFitOut.includes(roomCategory);

    case 'retail_commercial':
      // Common areas fit-out; individual retail units are tenant shell & core
      const retailFitOut: RoomCategory[] = [
        'lobby_reception', 'common_corridor', 'toilet_wc', 'amenity', 'dining_area',
      ];
      return retailFitOut.includes(roomCategory);

    case 'hotel':
    case 'resort':
      // Virtually everything fit-out except back-of-house plant
      return !(['back_of_house', 'store_room'] as RoomCategory[]).includes(roomCategory);

    case 'clinic_medical':
      // Reception and common areas fit-out; clinical rooms are specialist shell
      const clinicFitOut: RoomCategory[] = [
        'lobby_reception', 'common_corridor', 'toilet_wc', 'amenity', 'meeting_room',
      ];
      return clinicFitOut.includes(roomCategory);

    case 'mixed_use':
      // Mixed-use has no default — developer must specify per block.
      // Fallback: fit-out for common areas only.
      const mixedDefault: RoomCategory[] = [
        'lobby_reception', 'common_corridor', 'toilet_wc', 'amenity',
      ];
      return mixedDefault.includes(roomCategory);

    default:
      return true; // Unknown typology: default to fit-out (safer for pricing)
  }
}

// Human-readable label for UI
export function getFitOutRuleDescription(typology: Typology): string {
  const descriptions: Record<Typology, string> = {
    villa: 'Full fit-out — all interior rooms',
    townhouse: 'Full fit-out — all interior rooms',
    apartment: 'Full fit-out — all interior rooms + building common areas',
    serviced_apartment: 'Full fit-out — all rooms including common areas',
    restaurant: 'Full fit-out — including commercial kitchen',
    cafe_bar: 'Full fit-out — including prep areas',
    office_building: 'Partial — lobby, corridors, toilets, amenities only. Office floors = shell & core.',
    retail_commercial: 'Partial — common areas, lobby, toilets, food court. Retail units = shell & core.',
    hotel: 'Full fit-out — all guestrooms, F&B, public areas',
    resort: 'Full fit-out — all areas except plant rooms',
    clinic_medical: 'Partial — reception, waiting, toilets. Clinical rooms = shell & core.',
    mixed_use: 'Mixed — configure per block. Common areas default to fit-out.',
  };
  return descriptions[typology] ?? 'Apply fit-out rules per room category';
}
```

### 2b. `server/engines/design/amenity-taxonomy.ts`

Pure TypeScript constants. No DB, no LLM. These are the seeded definitions.

```typescript
export type AmenityType =
  | 'gym'
  | 'swimming_pool'
  | 'spa'
  | 'coworking'
  | 'lobby_reception'
  | 'rooftop_amenity'
  | 'kids_play'
  | 'cinema'
  | 'conference_events';

export interface AmenitySubSpace {
  subSpaceName: string;
  roomCategory: string;
  sqmRatio: number;   // Must sum to 1.0 per amenity type
  fitOut: boolean;
}

// CRITICAL: sqmRatios within each amenity type MUST sum exactly to 1.0
export const AMENITY_TAXONOMY: Record<AmenityType, AmenitySubSpace[]> = {
  gym: [
    { subSpaceName: 'Equipment Floor',           roomCategory: 'amenity', sqmRatio: 0.40, fitOut: true },
    { subSpaceName: 'Group Class Studio',         roomCategory: 'amenity', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Male Changing + Showers',    roomCategory: 'bathroom', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Female Changing + Showers',  roomCategory: 'bathroom', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Reception Desk',             roomCategory: 'lobby_reception', sqmRatio: 0.08, fitOut: true },
    { subSpaceName: 'Storage / Utility',          roomCategory: 'store_room', sqmRatio: 0.07, fitOut: false },
  ],
  swimming_pool: [
    { subSpaceName: 'Pool Deck / Surround',       roomCategory: 'amenity', sqmRatio: 0.45, fitOut: true },
    { subSpaceName: 'Male Changing + Showers',    roomCategory: 'bathroom', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Female Changing + Showers',  roomCategory: 'bathroom', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Plant / Mechanical Room',    roomCategory: 'plant_mechanical', sqmRatio: 0.15, fitOut: false },
    { subSpaceName: 'Towel Counter / Reception',  roomCategory: 'lobby_reception', sqmRatio: 0.10, fitOut: true },
  ],
  spa: [
    { subSpaceName: 'Treatment Rooms',            roomCategory: 'amenity', sqmRatio: 0.35, fitOut: true },
    { subSpaceName: 'Relaxation Lounge',          roomCategory: 'amenity', sqmRatio: 0.20, fitOut: true },
    { subSpaceName: 'Reception',                  roomCategory: 'lobby_reception', sqmRatio: 0.10, fitOut: true },
    { subSpaceName: 'Male Changing + Showers',    roomCategory: 'bathroom', sqmRatio: 0.12, fitOut: true },
    { subSpaceName: 'Female Changing + Showers',  roomCategory: 'bathroom', sqmRatio: 0.12, fitOut: true },
    { subSpaceName: 'Sauna / Steam Room',         roomCategory: 'amenity', sqmRatio: 0.11, fitOut: true },
  ],
  coworking: [
    { subSpaceName: 'Open Hot Desks',             roomCategory: 'amenity', sqmRatio: 0.35, fitOut: true },
    { subSpaceName: 'Private Pods',               roomCategory: 'amenity', sqmRatio: 0.20, fitOut: true },
    { subSpaceName: 'Meeting Rooms',              roomCategory: 'meeting_room', sqmRatio: 0.25, fitOut: true },
    { subSpaceName: 'Phone Booths',               roomCategory: 'amenity', sqmRatio: 0.08, fitOut: true },
    { subSpaceName: 'Pantry / Kitchen',           roomCategory: 'kitchen', sqmRatio: 0.07, fitOut: true },
    { subSpaceName: 'Storage',                    roomCategory: 'store_room', sqmRatio: 0.05, fitOut: false },
  ],
  lobby_reception: [
    { subSpaceName: 'Main Reception Desk',        roomCategory: 'lobby_reception', sqmRatio: 0.25, fitOut: true },
    { subSpaceName: 'Waiting / Seating Area',     roomCategory: 'lobby_reception', sqmRatio: 0.40, fitOut: true },
    { subSpaceName: 'Concierge',                  roomCategory: 'lobby_reception', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Security Desk',              roomCategory: 'lobby_reception', sqmRatio: 0.12, fitOut: true },
    { subSpaceName: 'Mail Room',                  roomCategory: 'store_room', sqmRatio: 0.08, fitOut: false },
  ],
  rooftop_amenity: [
    { subSpaceName: 'Lounge Seating',             roomCategory: 'amenity', sqmRatio: 0.35, fitOut: true },
    { subSpaceName: 'BBQ / Outdoor Kitchen',      roomCategory: 'kitchen', sqmRatio: 0.20, fitOut: true },
    { subSpaceName: 'Bar / Service Counter',      roomCategory: 'bar_area', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Soft Landscaping Zone',      roomCategory: 'amenity', sqmRatio: 0.20, fitOut: true },
    { subSpaceName: 'Utility / Storage',          roomCategory: 'store_room', sqmRatio: 0.10, fitOut: false },
  ],
  kids_play: [
    { subSpaceName: 'Active Play Zone',           roomCategory: 'amenity', sqmRatio: 0.45, fitOut: true },
    { subSpaceName: 'Quiet / Study Zone',         roomCategory: 'amenity', sqmRatio: 0.20, fitOut: true },
    { subSpaceName: 'Supervisor Station',         roomCategory: 'lobby_reception', sqmRatio: 0.10, fitOut: true },
    { subSpaceName: 'Toilets',                    roomCategory: 'toilet_wc', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'Storage',                    roomCategory: 'store_room', sqmRatio: 0.10, fitOut: false },
  ],
  cinema: [
    { subSpaceName: 'Seating Area',               roomCategory: 'amenity', sqmRatio: 0.55, fitOut: true },
    { subSpaceName: 'Lobby / Snacks Counter',     roomCategory: 'lobby_reception', sqmRatio: 0.20, fitOut: true },
    { subSpaceName: 'Projection Room',            roomCategory: 'plant_mechanical', sqmRatio: 0.15, fitOut: false },
    { subSpaceName: 'Toilets',                    roomCategory: 'toilet_wc', sqmRatio: 0.10, fitOut: true },
  ],
  conference_events: [
    { subSpaceName: 'Main Hall',                  roomCategory: 'amenity', sqmRatio: 0.50, fitOut: true },
    { subSpaceName: 'Breakout Rooms',             roomCategory: 'meeting_room', sqmRatio: 0.20, fitOut: true },
    { subSpaceName: 'Registration / Lobby',       roomCategory: 'lobby_reception', sqmRatio: 0.15, fitOut: true },
    { subSpaceName: 'AV / Tech Room',             roomCategory: 'plant_mechanical', sqmRatio: 0.10, fitOut: false },
    { subSpaceName: 'Storage',                    roomCategory: 'store_room', sqmRatio: 0.05, fitOut: false },
  ],
};

// Validate ratios sum to 1.0 (call in tests)
export function validateTaxonomy(): void {
  for (const [type, spaces] of Object.entries(AMENITY_TAXONOMY)) {
    const sum = spaces.reduce((acc, s) => acc + s.sqmRatio, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(`Amenity taxonomy '${type}' ratios sum to ${sum}, must equal 1.0`);
    }
  }
}
```

### 2c. `server/engines/intake/dwg-parser.ts`

DXF geometry parsing with DWG→vision fallback. Install: `npm install dxf-parser` (check package.json first — may already be present).

```typescript
import DxfParser from 'dxf-parser';
import { invokeLLM } from '../_core/llm';

export interface ExtractedRoom {
  name: string;
  sqm: number;
  level: number;
  source: 'dwg_geometry' | 'vision_analysis';
  confidence: number; // 0–1
}

export interface DwgParseResult {
  rooms: ExtractedRoom[];
  source: 'dwg_geometry' | 'vision_analysis' | 'mixed';
  totalSqm: number;
  parseWarning?: string;
}

export async function parseFloorPlanFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<DwgParseResult> {
  const ext = fileName.toLowerCase().split('.').pop();

  // DXF: parse geometry directly
  if (ext === 'dxf') {
    return parseDxfGeometry(fileBuffer.toString('utf-8'));
  }

  // DWG: attempt DXF interpretation first, then fall back to vision
  if (ext === 'dwg') {
    try {
      const dxfText = fileBuffer.toString('utf-8');
      // DWG files exported from older AutoCAD sometimes parse as DXF
      if (dxfText.includes('SECTION') && dxfText.includes('ENTITIES')) {
        return parseDxfGeometry(dxfText);
      }
    } catch {
      // Not parseable as DXF — fall through to vision
    }
    return parseViaVision(fileBuffer, 'dwg');
  }

  // PDF / PNG / JPEG: use existing vision analysis
  return parseViaVision(fileBuffer, mimeType);
}

function parseDxfGeometry(dxfText: string): DwgParseResult {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfText);

  const rooms: ExtractedRoom[] = [];

  // Extract closed LWPOLYLINE entities (room boundaries)
  const entities = dxf?.entities ?? [];
  const textEntities = entities.filter((e: any) =>
    e.type === 'TEXT' || e.type === 'MTEXT'
  );

  for (const entity of entities) {
    if (entity.type !== 'LWPOLYLINE' || !entity.closed) continue;
    if (!entity.vertices || entity.vertices.length < 3) continue;

    // Shoelace formula for polygon area
    const sqm = Math.abs(shoelaceArea(entity.vertices)) / 1_000_000; // mm² → m²
    if (sqm < 1) continue; // Skip tiny entities (walls, furniture)

    // Find nearest TEXT entity as room label
    const centroid = computeCentroid(entity.vertices);
    const label = findNearestText(centroid, textEntities) ?? 'Unnamed Room';

    rooms.push({
      name: label,
      sqm: Math.round(sqm * 100) / 100,
      level: entity.layer?.match(/\d+/)?.[0] ? parseInt(entity.layer.match(/\d+/)![0]) : 0,
      source: 'dwg_geometry',
      confidence: 0.85,
    });
  }

  return {
    rooms,
    source: 'dwg_geometry',
    totalSqm: rooms.reduce((sum, r) => sum + r.sqm, 0),
    parseWarning: rooms.length === 0 ? 'No closed room boundaries found in DXF. Try exporting as PDF.' : undefined,
  };
}

async function parseViaVision(fileBuffer: Buffer, fileType: string): Promise<DwgParseResult> {
  const base64 = fileBuffer.toString('base64');
  const mimeType = fileType === 'dwg' ? 'application/octet-stream' : fileType;

  const result = await invokeLLM({
    prompt: `You are analyzing an architectural floor plan. Extract ALL rooms/spaces visible.
For each room return: name (as labeled on drawing), estimated area in square meters, floor level (0=ground).
If no area label is visible, estimate from visual proportion relative to the overall plan.
Focus on interior spaces only — ignore walls, dimensions, annotations.`,
    outputSchema: {
      type: 'object',
      properties: {
        rooms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              sqm: { type: 'number' },
              level: { type: 'number' },
            },
            required: ['name', 'sqm', 'level'],
          },
        },
        totalGfaSqm: { type: 'number' },
      },
      required: ['rooms'],
    },
    imageData: { data: base64, mimeType },
  });

  const rooms: ExtractedRoom[] = (result.rooms ?? []).map((r: any) => ({
    name: r.name,
    sqm: r.sqm,
    level: r.level ?? 0,
    source: 'vision_analysis' as const,
    confidence: 0.70,
  }));

  return {
    rooms,
    source: 'vision_analysis',
    totalSqm: rooms.reduce((sum, r) => sum + r.sqm, 0),
  };
}

// Shoelace formula (returns area in same units as vertex coordinates)
function shoelaceArea(vertices: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

function computeCentroid(vertices: Array<{ x: number; y: number }>): { x: number; y: number } {
  const x = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
  const y = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
  return { x, y };
}

function findNearestText(
  point: { x: number; y: number },
  textEntities: any[],
): string | null {
  let nearest: string | null = null;
  let minDist = Infinity;
  for (const t of textEntities) {
    const tx = t.position?.x ?? t.insertionPoint?.x ?? 0;
    const ty = t.position?.y ?? t.insertionPoint?.y ?? 0;
    const dist = Math.hypot(tx - point.x, ty - point.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = t.text ?? t.string ?? null;
    }
  }
  return nearest;
}
```

### 2d. `server/engines/design/space-program-extractor.ts`

Orchestrator: file → normalised space program with fit-out tags.

```typescript
import { getDefaultFitOutFlag, Typology } from './typology-fitout-rules';
import { AMENITY_TAXONOMY, AmenityType } from './amenity-taxonomy';
import { parseFloorPlanFile, ExtractedRoom } from '../intake/dwg-parser';
import { buildSpaceProgram } from './space-program'; // existing — keep as fallback
import { db } from '../../db';

export interface SpaceProgramRoom {
  name: string;
  roomCategory: string;
  sqm: number;
  level: number;
  source: 'generated' | 'vision_analysis' | 'dwg_geometry';
  fitOut: boolean;
  fitOutOverridden: boolean;
  isAmenity: boolean;
  amenityType?: AmenityType;
  blockName: string;
  blockTypology: Typology;
}

// Generate space program from GFA + typology (no file upload)
export async function generateFromGfa(
  projectId: string,
  orgId: string,
  typology: Typology,
  gfaSqm: number,
  finishGrade: string,
  blocks?: Array<{ name: string; typology: Typology; gfaSqm: number }>,
): Promise<SpaceProgramRoom[]> {
  const targetBlocks = blocks ?? [{ name: 'Main', typology, gfaSqm }];
  const allRooms: SpaceProgramRoom[] = [];

  for (const block of targetBlocks) {
    // Use existing buildSpaceProgram (it handles room distribution logic)
    const generated = buildSpaceProgram({ typology: block.typology, gfaSqm: block.gfaSqm, finishGrade });
    for (const room of generated.rooms) {
      allRooms.push({
        name: room.name,
        roomCategory: room.type,
        sqm: room.sqm,
        level: room.level ?? 0,
        source: 'generated',
        fitOut: getDefaultFitOutFlag(block.typology, room.type as any),
        fitOutOverridden: false,
        isAmenity: room.type === 'amenity',
        amenityType: room.amenityType as AmenityType | undefined,
        blockName: block.name,
        blockTypology: block.typology,
      });
    }
  }

  return expandAmenitySubSpaces(allRooms, typology);
}

// Extract from uploaded floor plan file
export async function extractFromFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  typology: Typology,
  blockName: string,
): Promise<SpaceProgramRoom[]> {
  const parseResult = await parseFloorPlanFile(fileBuffer, fileName, mimeType);

  return parseResult.rooms.map((room: ExtractedRoom) => ({
    name: room.name,
    roomCategory: inferRoomCategory(room.name),
    sqm: room.sqm,
    level: room.level,
    source: room.source,
    fitOut: getDefaultFitOutFlag(typology, inferRoomCategory(room.name) as any),
    fitOutOverridden: false,
    isAmenity: isAmenityRoom(room.name),
    amenityType: detectAmenityType(room.name),
    blockName,
    blockTypology: typology,
  }));
}

// Expand amenity rooms into sub-spaces based on taxonomy
export function expandAmenitySubSpaces(
  rooms: SpaceProgramRoom[],
  defaultTypology: Typology,
): SpaceProgramRoom[] {
  const result: SpaceProgramRoom[] = [];

  for (const room of rooms) {
    if (room.isAmenity && room.amenityType && AMENITY_TAXONOMY[room.amenityType]) {
      // Replace the parent amenity with sub-spaces
      result.push({ ...room }); // Keep parent for reference
      const subSpaces = AMENITY_TAXONOMY[room.amenityType];
      for (const sub of subSpaces) {
        result.push({
          name: sub.subSpaceName,
          roomCategory: sub.roomCategory,
          sqm: Math.round(room.sqm * sub.sqmRatio * 100) / 100,
          level: room.level,
          source: room.source,
          fitOut: sub.fitOut,
          fitOutOverridden: false,
          isAmenity: false,
          blockName: room.blockName,
          blockTypology: room.blockTypology,
        });
      }
    } else {
      result.push(room);
    }
  }

  return result;
}

// Heuristic: infer room category from room name string
function inferRoomCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('lobby') || n.includes('reception')) return 'lobby_reception';
  if (n.includes('bedroom') || n.includes('bed ')) return 'bedroom';
  if (n.includes('bathroom') || n.includes('bath') || n.includes('shower')) return 'bathroom';
  if (n.includes('toilet') || n.includes('wc') || n.includes('restroom')) return 'toilet_wc';
  if (n.includes('kitchen')) return 'kitchen';
  if (n.includes('living') || n.includes('lounge') || n.includes('sitting')) return 'living_room';
  if (n.includes('dining')) return 'dining_room';
  if (n.includes('corridor') || n.includes('hallway') || n.includes('passage')) return 'common_corridor';
  if (n.includes('office') && !n.includes('back')) return 'office_floor';
  if (n.includes('retail') || n.includes('shop') || n.includes('unit')) return 'retail_unit';
  if (n.includes('parking') || n.includes('garage')) return 'parking';
  if (n.includes('plant') || n.includes('mechanical') || n.includes('electrical')) return 'plant_mechanical';
  if (n.includes('gym') || n.includes('fitness') || n.includes('pool') || n.includes('spa')) return 'amenity';
  return 'amenity'; // Default unknown rooms to amenity (fit-out)
}

function isAmenityRoom(name: string): boolean {
  const amenityKeywords = ['gym', 'fitness', 'pool', 'spa', 'co-work', 'cowork', 'business centre',
    'rooftop', 'play', 'cinema', 'screening', 'conference', 'events', 'lobby'];
  return amenityKeywords.some(kw => name.toLowerCase().includes(kw));
}

function detectAmenityType(name: string): AmenityType | undefined {
  const n = name.toLowerCase();
  if (n.includes('gym') || n.includes('fitness')) return 'gym';
  if (n.includes('pool') || n.includes('swimming')) return 'swimming_pool';
  if (n.includes('spa')) return 'spa';
  if (n.includes('co-work') || n.includes('cowork') || n.includes('business centre')) return 'coworking';
  if (n.includes('lobby') || n.includes('reception')) return 'lobby_reception';
  if (n.includes('rooftop')) return 'rooftop_amenity';
  if (n.includes('play') || n.includes('kids')) return 'kids_play';
  if (n.includes('cinema') || n.includes('screening')) return 'cinema';
  if (n.includes('conference') || n.includes('events') || n.includes('ballroom')) return 'conference_events';
  return undefined;
}
```

---

## Step 3 — Router: `server/routers/spaceProgram.ts`

8 `orgProcedure` endpoints. All use `orgProcedure` — no exceptions.

```typescript
import { z } from 'zod';
import { orgProcedure, router } from '../trpc';
import { generateFromGfa, extractFromFile } from '../engines/design/space-program-extractor';
import { getDefaultFitOutFlag } from '../engines/design/typology-fitout-rules';
import { db } from '../db';
// DB functions to add in db.ts (see Step 5)

export const spaceProgramRouter = router({

  // Generate space program from GFA + typology rules (no file)
  // For mixed-use: pass blocks array
  generate: orgProcedure
    .input(z.object({
      projectId: z.string(),
      blocks: z.array(z.object({
        name: z.string().default('Main'),
        typology: z.string(),
        gfaSqm: z.number(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const project = await db.getProjectById(input.projectId, ctx.orgId);
      const blocks = input.blocks ?? [{ name: 'Main', typology: project.typology, gfaSqm: project.ctx03Gfa }];
      const rooms = await generateFromGfa(
        input.projectId, ctx.orgId,
        project.typology, project.ctx03Gfa, project.finishGrade,
        blocks,
      );
      await db.upsertSpaceProgramRooms(input.projectId, ctx.orgId, rooms);
      return { rooms, fitOutSqm: sumFitOut(rooms), totalSqm: rooms.reduce((s, r) => s + r.sqm, 0) };
    }),

  // Extract from uploaded floor plan (PDF / DXF / DWG)
  extractFromFile: orgProcedure
    .input(z.object({
      projectId: z.string(),
      fileKey: z.string(),   // S3 key
      fileName: z.string(),
      mimeType: z.string(),
      blockName: z.string().default('Main'),
      typology: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const fileBuffer = await downloadFromS3(input.fileKey);
      const rooms = await extractFromFile(
        fileBuffer, input.fileName, input.mimeType,
        input.typology as any, input.blockName,
      );
      await db.upsertSpaceProgramRooms(input.projectId, ctx.orgId, rooms, input.blockName);
      return { rooms, parseSource: rooms[0]?.source, fitOutSqm: sumFitOut(rooms) };
    }),

  // Read stored space program for a project
  getForProject: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      const rooms = await db.getSpaceProgramRooms(input.projectId, ctx.orgId);
      return {
        rooms,
        fitOutSqm: sumFitOut(rooms),
        shellCoreSqm: rooms.filter(r => !r.fitOut).reduce((s, r) => s + r.sqm, 0),
        totalSqm: rooms.reduce((s, r) => s + r.sqm, 0),
        blocks: [...new Set(rooms.map(r => ({ name: r.blockName, typology: r.blockTypology })))],
      };
    }),

  // Edit a single room
  updateRoom: orgProcedure
    .input(z.object({
      roomId: z.string(),
      projectId: z.string(),
      name: z.string().optional(),
      sqm: z.number().optional(),
      roomCategory: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.updateSpaceProgramRoom(input.roomId, input.projectId, ctx.orgId, {
        name: input.name,
        sqm: input.sqm,
        roomCategory: input.roomCategory,
      });
    }),

  // Toggle fit-out flag on one or many rooms
  // If developer overrides, set fitOutOverridden = true so typology reset doesn't revert it
  toggleFitOut: orgProcedure
    .input(z.object({
      projectId: z.string(),
      roomIds: z.array(z.string()),
      fitOut: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.toggleSpaceProgramFitOut(input.projectId, ctx.orgId, input.roomIds, input.fitOut);
    }),

  // Add a room manually
  addRoom: orgProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string(),
      roomCategory: z.string(),
      sqm: z.number(),
      level: z.number().default(0),
      blockName: z.string().default('Main'),
      blockTypology: z.string(),
      fitOut: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.addSpaceProgramRoom(input.projectId, ctx.orgId, input);
    }),

  // Delete a room
  deleteRoom: orgProcedure
    .input(z.object({ roomId: z.string(), projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return db.deleteSpaceProgramRoom(input.roomId, input.projectId, ctx.orgId);
    }),

  // Reset fit-out flags to typology defaults (skips rooms where fitOutOverridden = true)
  resetToTypologyDefaults: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const rooms = await db.getSpaceProgramRooms(input.projectId, ctx.orgId);
      const updates = rooms
        .filter(r => !r.fitOutOverridden)
        .map(r => ({
          id: r.id,
          fitOut: getDefaultFitOutFlag(r.blockTypology as any, r.roomCategory as any),
        }));
      await db.bulkUpdateFitOutFlags(input.projectId, ctx.orgId, updates);
      return { resetCount: updates.length };
    }),
});

function sumFitOut(rooms: any[]): number {
  return rooms.filter(r => r.fitOut).reduce((s, r) => s + r.sqm, 0);
}
```

Register in `server/routers/routers.ts`:
```typescript
import { spaceProgramRouter } from './spaceProgram';
// Add to router object:
spaceProgram: spaceProgramRouter,
```

---

## Step 4 — Update `materialQuantity.ts` Router

The `generate` procedure in Phase A's `materialQuantity.ts` calls `buildSpaceProgram()` inline. Update it to check for a stored space program first:

```typescript
// In the generate mutation, BEFORE calling calculateSurfaceAreas:
const storedRooms = await db.getSpaceProgramRooms(input.projectId, ctx.orgId);
const rooms = storedRooms.length > 0
  ? storedRooms.filter(r => r.fitOut)            // Phase B: use stored fit-out rooms
  : buildSpaceProgram(project).rooms;             // Phase A fallback: generate from GFA

// Then pass `rooms` to calculateSurfaceAreas as before
```

This is backward compatible — existing projects with no space program still work via `buildSpaceProgram()`.

---

## Step 5 — DB Functions in `server/db.ts`

Add these 7 named exported async functions:

```typescript
// Get all rooms for a project
export async function getSpaceProgramRooms(projectId: string, orgId: string)

// Insert or replace full space program (delete existing non-overridden rooms for a block, insert new)
export async function upsertSpaceProgramRooms(projectId: string, orgId: string, rooms: SpaceProgramRoom[], blockName?: string)

// Update single room fields
export async function updateSpaceProgramRoom(roomId: string, projectId: string, orgId: string, fields: Partial<SpaceProgramRoom>)

// Toggle fit-out on multiple rooms + set fitOutOverridden = true
export async function toggleSpaceProgramFitOut(projectId: string, orgId: string, roomIds: string[], fitOut: boolean)

// Add single room manually
export async function addSpaceProgramRoom(projectId: string, orgId: string, room: Omit<SpaceProgramRoom, 'id'>)

// Delete single room
export async function deleteSpaceProgramRoom(roomId: string, projectId: string, orgId: string)

// Bulk update fit-out flags (for reset to defaults — skipping overridden)
export async function bulkUpdateFitOutFlags(projectId: string, orgId: string, updates: Array<{ id: string; fitOut: boolean }>)
```

---

## Step 6 — Seed Amenity Taxonomy

Create `drizzle/seed-amenity-taxonomy.ts`:

```typescript
// Insert all AMENITY_TAXONOMY entries into amenity_sub_spaces table
// Run with: npx tsx -r dotenv/config drizzle/seed-amenity-taxonomy.ts
// Total rows: 9 amenity types × avg 5 sub-spaces = ~45 rows
import { AMENITY_TAXONOMY, validateTaxonomy } from '../server/engines/design/amenity-taxonomy';
validateTaxonomy(); // Fail fast if ratios don't sum to 1.0
// Insert ...
```

---

## Step 7 — Frontend: `SpaceProgramEditor.tsx`

New component. Used in ProjectDetail "Space Program" tab.

**Layout:**
```
┌─ Space Program ────────────────────────────────────────────────────────┐
│ [Block tabs: Main ▸ Residential Tower ▸ Retail Podium] [+ Add Block]   │
│                                                                         │
│ Fit-Out: 4,200 sqm  │  Shell & Core: 45,800 sqm  │  Total: 50,000 sqm │
│ [Progress bar: 8% fit-out shown in green]                               │
│                                                                         │
│ [Extract from floor plan ↑] [Re-generate from GFA ↺] [Add room +]      │
│ [Reset to typology defaults ↩]   Typology: Office Building              │
│                                                                         │
│ Room Name          │ Category      │ sqm    │ Level │ Source │ Fit-Out  │
│ Ground Floor Lobby │ lobby         │ 820    │ 0     │ gen    │ ✅       │
│ ▶ Gym              │ amenity       │ 600    │ 1     │ gen    │ ✅       │ (expandable)
│   Equipment Floor  │ amenity       │ 240    │ 1     │ gen    │ ✅       │
│   Male Changing    │ bathroom      │ 90     │ 1     │ gen    │ ✅       │
│   Female Changing  │ bathroom      │ 90     │ 1     │ gen    │ ✅       │
│   Reception        │ lobby         │ 48     │ 1     │ gen    │ ✅       │
│   Storage          │ store         │ 42     │ 1     │ gen    │ ❌       │ (shell)
│ Floor 2 – Office   │ office_floor  │ 4,800  │ 2     │ gen    │ ❌       │ (shell, grayed)
│ Floor 3 – Office   │ office_floor  │ 4,800  │ 3     │ gen    │ ❌       │
│                                                                         │
│ [Generate Material Cost Analysis →] (passes fit-out rooms to MQI)      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Fit-out toggle: green chip = FIT_OUT, gray chip = SHELL_CORE. Click to toggle. Sets `fitOutOverridden = true` in DB.
- Amenity rows are expandable (shadcn `Accordion`) showing sub-spaces
- Shell & core rows are grayed out but remain visible so developer can see the full program
- "Reset to typology defaults" button only resets rooms where `fitOutOverridden = false`
- File upload triggers `extractFromFile` mutation — shows progress spinner, then refreshes table
- "Generate Material Cost Analysis" button navigates to Material Cost tab (or triggers MQI generate)
- Mixed-use: block tabs at top, each block shows its typology label and rule description

---

## Step 8 — ProjectDetail.tsx

Add "Space Program" tab immediately BEFORE "Material Cost" tab:
```tsx
// Existing tabs: Overview | Evaluation | Assets | [INSERT HERE] | Material Cost
{ id: 'space-program', label: 'Space Program', icon: LayoutGrid }
```

Empty state (no space program yet):
```
┌─────────────────────────────────────────────────┐
│         📐 No space program yet                 │
│                                                  │
│  Upload a floor plan or generate from your       │
│  project parameters to start.                    │
│                                                  │
│  [Upload Floor Plan]  [Generate from GFA]        │
└─────────────────────────────────────────────────┘
```

---

## Step 9 — Tests: `v31-space-program.test.ts`

```typescript
describe('typology-fitout-rules', () => {
  it('office_building: office_floor is shell & core', ...)
  it('office_building: lobby is fit-out', ...)
  it('office_building: toilet_wc is fit-out', ...)
  it('villa: all rooms default to fit-out', ...)
  it('retail_commercial: retail_unit is shell & core', ...)
  it('hotel: guestroom is fit-out', ...)
  it('always shell: parking regardless of typology', ...)
  it('always shell: plant_mechanical regardless of typology', ...)
});

describe('amenity-taxonomy', () => {
  it('validateTaxonomy: all amenity types sum to 1.0', ...)
  it('gym: expands into 6 sub-spaces totalling original sqm', ...)
  it('swimming_pool: plant room sub-space has fitOut=false', ...)
  it('spa: relaxation lounge has fitOut=true', ...)
});

describe('space-program-extractor', () => {
  it('generateFromGfa: 10,000 sqm office — lobby+toilets fit-out, floors shell', ...)
  it('expandAmenitySubSpaces: 600sqm gym expands correctly', ...)
  it('fitOut totals: office building 50,000 sqm → ~8% fit-out', ...)
});

describe('MQI integration', () => {
  it('materialQuantity.generate uses stored space program when available', ...)
  it('materialQuantity.generate falls back to buildSpaceProgram when no stored program', ...)
});
```

---

## Post-Build Checklist

Before marking Phase B complete:

- [ ] `pnpm db:push` — verify 87 tables
- [ ] `npx tsx -r dotenv/config drizzle/seed-amenity-taxonomy.ts` — verify ~45 seed rows
- [ ] `pnpm test` — new baseline should be 785+ passing
- [ ] `pnpm check` — zero TypeScript errors
- [ ] Manual test: create office building project, generate space program, confirm office floors are ❌
- [ ] Manual test: toggle office floor to fit-out → "Reset to defaults" → confirm reverts only non-overridden
- [ ] Manual test: existing project (no space program) → generate MQI → still works via buildSpaceProgram fallback
- [ ] Update `PROGRESS.md`, `miyar-memory.md`, `GEMINI.md` with Phase B complete stats
- [ ] Commit: `feat: MIYAR 3.0 Phase B — Typology-Aware Space Program Intelligence`
