# MIYAR 3.0 Phase A — Material Quantity Intelligence (MQI)
## Antigravity Build Prompt

---

## Context — Read These First

Before writing a single line of code, read:

1. `.agent/rules/miyar-memory.md` — full platform context and immutable rules
2. `server/engines/design/space-program.ts` — `buildSpaceProgram()`, `Room` type, room templates
3. `server/engines/design/finish-schedule.ts` — `buildFinishSchedule()` — you will EXTEND this
4. `server/engines/visual-gen.ts` — `buildBoardAwarePromptContext()` — you will EXTEND this
5. `server/engines/design/nano-banana-client.ts` — mood board prompt builder — you will EXTEND this
6. `drizzle/schema.ts` — understand `material_library`, `materials_catalog`, `material_constants`, `project_assets` tables and the `mysqlTable` pattern before adding new tables
7. `server/engines/ingestion/connectors/dynamic.ts` — `cleanHtmlForLLM()` + `DynamicConnector`
8. `server/routers/market-intelligence.ts` — existing `scrapeNow` + `addSource` procedures
9. `client/src/pages/ProjectDetail.tsx` — the Assets tab was just added (Phase 10A). "Material Cost" tab goes AFTER it.

---

## What Phase 10B Already Built (DO NOT rebuild)

Phase 10B is complete (`e06022c`):
- ✅ `server/engines/value-add-engine.ts` — `computeValueAddBridge`, `computeBrandEquityForecast`
- ✅ `server/routers/salesPremium.ts` — `getValueAddBridge`, `getBrandEquityForecast`
- ✅ `client/src/pages/InvestorSummary.tsx` — Section F with dual sliders + live KPIs
- ✅ 24 tests in `v10-sales-premium.test.ts`

---

## What MIYAR 3.0 Phase A Builds

**The core idea:** A developer uploads a floor plan, sets their style (Modern Luxury) and material level (4/5). MIYAR currently assigns ONE material per room surface. Phase A adds the missing layer: it calculates the actual square metres of every surface (floor, walls, ceiling) per room, asks Gemini to suggest how those surfaces should be split across materials (e.g. 65% Calacatta marble / 35% timber on the living room floor), then prices each split using real `material_library` unit costs. The result: a bottom-up finish cost the developer can compare against their budget cap — and mood boards that visually reflect the actual material split.

This does NOT replace the scoring engine, the form, or any existing engine. It layers on top.

---

## Step 1 — DB Schema (do this first, run migration)

Add two new tables to `drizzle/schema.ts` using `mysqlTable`. Follow the exact pattern of existing tables.

### Table 1: `material_allocations`

Stores the AI-suggested (or manually edited) material split per room × surface element.

```typescript
export const materialAllocations = mysqlTable("material_allocations", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("projectId").notNull(),
  organizationId: int("organizationId").notNull(),
  roomId: varchar("roomId", { length: 20 }).notNull(),          // e.g. "LVG", "MBR"
  roomName: varchar("roomName", { length: 100 }).notNull(),
  element: mysqlEnum("element", [
    "floor", "walls", "ceiling", "joinery", "hardware"
  ]).notNull(),
  materialLibraryId: int("materialLibraryId"),                  // FK to material_library (nullable — fallback to name)
  materialName: varchar("materialName", { length: 300 }).notNull(), // display name
  allocationPct: decimal("allocationPct", { precision: 5, scale: 2 }).notNull(), // 0-100.00
  surfaceAreaM2: decimal("surfaceAreaM2", { precision: 10, scale: 2 }).notNull(),
  unitCostMin: decimal("unitCostMin", { precision: 10, scale: 2 }),  // AED/m² from material_library
  unitCostMax: decimal("unitCostMax", { precision: 10, scale: 2 }),
  totalCostMin: decimal("totalCostMin", { precision: 12, scale: 2 }), // surfaceAreaM2 × allocationPct/100 × unitCostMin
  totalCostMax: decimal("totalCostMax", { precision: 12, scale: 2 }),
  aiReasoning: text("aiReasoning"),
  isLocked: boolean("isLocked").default(false).notNull(),        // developer locked this allocation
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaterialAllocation = typeof materialAllocations.$inferSelect;
export type InsertMaterialAllocation = typeof materialAllocations.$inferInsert;
```

### Table 2: `material_supplier_sources`

Links supplier URLs to automated price scraping via the existing DynamicConnector pipeline.

```typescript
export const materialSupplierSources = mysqlTable("material_supplier_sources", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organizationId"),                         // null = global/system source
  supplierName: varchar("supplierName", { length: 200 }).notNull(),
  supplierUrl: text("supplierUrl").notNull(),
  materialCategory: mysqlEnum("materialCategory", [
    "flooring", "wall_paint", "wall_tile", "ceiling",
    "joinery", "sanitaryware", "fittings", "lighting", "hardware", "specialty"
  ]).notNull(),
  tier: mysqlEnum("tier", ["affordable", "mid", "premium", "ultra"]).notNull(),
  notes: text("notes"),
  lastScrapedAt: timestamp("lastScrapedAt"),
  lastPriceAedMin: decimal("lastPriceAedMin", { precision: 10, scale: 2 }),
  lastPriceAedMax: decimal("lastPriceAedMax", { precision: 10, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaterialSupplierSource = typeof materialSupplierSources.$inferSelect;
export type InsertMaterialSupplierSource = typeof materialSupplierSources.$inferInsert;
```

After adding both tables, run `pnpm db:push` to apply the migration.

---

## Step 2 — Core Engine: `material-quantity-engine.ts`

Create `server/engines/design/material-quantity-engine.ts`.

This engine has three functions. NONE of them touch the scoring engine. NONE modify `ProjectInputs`.

### Function 1: `calculateSurfaceAreas(rooms: Room[], ceilingHeightM?: number): RoomSurfaces[]`

Pure deterministic math. No DB calls, no LLM.

```typescript
export interface RoomSurfaces {
  roomId: string;
  roomName: string;
  floorM2: number;       // = room.sqm
  wallM2: number;        // estimated from sqm + aspect ratio + height
  ceilingM2: number;     // = room.sqm × 0.95
}
```

Wall area estimation formula:
- `ceilingHeight` = param or 2.8m default
- `aspectRatio` by room type:
  - Living / Dining / Lobby: 1.6
  - Master bedroom: 1.4
  - Bedroom 2/3: 1.3
  - Kitchen: 1.4
  - Bathroom / Ensuite: 1.0
  - Corridors / Utility: 2.0 (long and narrow)
  - Default: 1.4
- `perimeter` = 2 × (√(sqm × ratio) + √(sqm / ratio))
- `wallM2` = perimeter × ceilingHeight × 0.85  (15% deduction for door/window openings)

### Function 2: `generateMaterialAllocations(project, inputs, surfaces, materialLibrary): Promise<AllocationResult>`

This is the Gemini call. Uses `invokeLLM()` with a structured output schema.

**System prompt to pass to Gemini:**

```
You are a UAE interior design cost consultant. Your job is to suggest how the surfaces of a project should be split across materials, based on the project's design style, market tier, and available material library.

PROJECT:
- Typology: {ctx01Typology}
- Style: {des01Style}
- Market Tier: {mkt01Tier}
- Material Level: {des02MaterialLevel}/5
- Purpose: {projectPurpose}
- Developer Intake Notes: {intakeNotes} (if any — from freeformDescription or chat messages)

ROOMS AND SURFACES:
{for each room: roomId, roomName, floorM2, wallM2, ceilingM2, finishGrade}

AVAILABLE MATERIAL LIBRARY (filtered to matching tier and style):
{materialId, category, tier, style, brand, productName, priceAedMin, priceAedMax, unitLabel}

RULES:
1. For each room × element, provide 1 OR 2 materials with percentages summing to exactly 100.
2. Max 2 materials per surface — more than 2 is unbuildable.
3. Use materials from the library when possible (reference by materialLibraryId). If no exact match, use a generic name.
4. Grade A rooms (high priority) get premium finishes. Grade C rooms get affordable/mid.
5. Wet elements (wall_wet in bathrooms/kitchens) always get tile, not paint or stone.
6. Ceiling is almost always single material (gypsum or plaster). Only split ceiling if Grade A + luxury tier.
7. For each allocation, write one sentence of reasoning (max 15 words).
8. Never suggest materials that conflict with UAE climate (e.g. solid wood flooring in wet areas).
```

**Output schema (structured JSON via `invokeLLM` `outputSchema` param):**

```typescript
interface AllocationResult {
  rooms: Array<{
    roomId: string;
    floor: Array<{ materialLibraryId: number | null; materialName: string; percentage: number; reasoning: string }>;
    walls: Array<{ materialLibraryId: number | null; materialName: string; percentage: number; reasoning: string }>;
    ceiling: Array<{ materialLibraryId: number | null; materialName: string; percentage: number; reasoning: string }>;
    joinery: Array<{ materialLibraryId: number | null; materialName: string; percentage: number; reasoning: string }>;
  }>;
  designRationale: string;  // 2-sentence summary of material strategy
  estimatedQualityLabel: string;  // e.g. "Premium Contemporary with Marble Accents"
}
```

**Important:** Call `invokeLLM` once for the whole project, not per room. Pass the full room list in a single prompt. This keeps token usage manageable.

### Function 3: `buildQuantityCostSummary(surfaces, allocations, materialLibrary): MaterialQuantityResult`

Pure math. No LLM.

```typescript
export interface MaterialQuantityResult {
  rooms: RoomCostBreakdown[];
  summary: {
    totalFloorM2: number;
    totalWallM2: number;
    totalCeilingM2: number;
    totalSurfaceM2: number;
    materialBreakdown: Array<{
      materialName: string;
      totalAreaM2: number;
      totalCostMin: number;
      totalCostMax: number;
      pctOfTotalSurface: number;
    }>;
    totalFinishCostMin: number;
    totalFinishCostMax: number;
    totalFinishCostMid: number;      // (min + max) / 2
    budgetCapAed: number | null;     // fin01BudgetCap × ctx03Gfa
    budgetUtilizationPct: number | null;  // totalFinishCostMid / budgetCapAed × 100
    isOverBudget: boolean;
    overBudgetByAed: number;         // 0 if under budget
    qualityLabel: string;            // from Gemini designRationale
  };
  generatedAt: string;
}
```

For each allocation slice:
```
actualAreaM2 = surfaceAreaM2 × (allocationPct / 100)
totalCostMin = actualAreaM2 × unitCostMin
totalCostMax = actualAreaM2 × unitCostMax
```

---

## Step 3 — Router: `materialQuantity.ts`

Create `server/routers/materialQuantity.ts` with these procedures (all `orgProcedure`):

### `generate`
```typescript
// Input: { projectId }
// 1. Fetch project + inputs from DB
// 2. Call buildSpaceProgram(project) → rooms
// 3. Call calculateSurfaceAreas(rooms) → surfaces
// 4. Fetch material_library filtered by project tier + style
// 5. Call generateMaterialAllocations(project, inputs, surfaces, materialLibrary)
// 6. Call buildQuantityCostSummary(surfaces, allocationResult, materialLibrary)
// 7. Write all allocations to material_allocations table (delete old ones for this project first)
// 8. Return MaterialQuantityResult
```

### `getForProject`
```typescript
// Input: { projectId }
// Fetch all material_allocations for projectId, reconstruct MaterialQuantityResult
// Return null if no allocations exist yet
```

### `updateAllocation`
```typescript
// Input: { allocationId, allocationPct, materialLibraryId?, materialName? }
// Update a single allocation row
// Recalculate totalCostMin/Max on the server after update
// Return updated allocation
```

### `lockAllocations`
```typescript
// Input: { projectId, locked: boolean }
// Set isLocked = locked on all allocations for this project
```

### `addSupplierSource`
```typescript
// Input: { supplierName, supplierUrl, materialCategory, tier, notes? }
// Insert into material_supplier_sources
// Org-scoped
```

### `scrapeSupplierSource`
```typescript
// Input: { sourceId }
// Fetch the material_supplier_sources row
// Use DynamicConnector (same as market-intelligence scrapeNow) to fetch + clean the URL
// Extract price range via invokeLLM with a targeted prompt:
//   "Extract the price per sqm or per unit in AED from this content. Return { priceAedMin, priceAedMax, currency, unit }."
// Update material_supplier_sources.lastScrapedAt, lastPriceAedMin, lastPriceAedMax
// Also update matching material_library rows (same supplierName + category + tier) with new prices
```

Register in `server/routers.ts`:
```typescript
import { materialQuantityRouter } from "./routers/materialQuantity";
// add to appRouter:
materialQuantity: materialQuantityRouter,
```

---

## Step 4 — Extend Visual Generation

### `server/engines/visual-gen.ts`

Add a new helper function at the bottom (do NOT modify `buildBoardAwarePromptContext`):

```typescript
/**
 * Converts material allocations into a natural language clause for image prompts.
 * Called when MaterialQuantityResult is available for a project.
 */
export function buildMaterialAllocationPromptClause(
  rooms: RoomCostBreakdown[],
  targetRoomId?: string  // if provided, filter to just this room
): string {
  // Example output:
  // "Floor: 65% Calacatta marble with 35% natural oak timber border inlay.
  //  Walls: 80% Venetian plaster with 20% book-matched marble feature wall.
  //  Ceiling: painted gypsum with integrated cove lighting recess."
}
```

### `server/engines/design/nano-banana-client.ts`

In `buildRoomMoodBoardPrompt()` and `buildRoomRenderPrompt()`, add an optional `allocationClause?: string` parameter.

If provided, replace the generic `"Key materials: ${materials}"` line with the allocation clause. This turns:
- Before: `"Materials: Calacatta marble, oak timber"`
- After: `"Floor: 65% Calacatta marble with 35% natural oak timber border inlay. Walls: 80% Venetian plaster with 20% book-matched marble feature panel."`

The `allocationClause` is generated by `buildMaterialAllocationPromptClause()` above and passed in from the design router when generating images. If no allocation exists (project was created the old way), fall back to existing behavior.

Update `generateProjectVisuals()` in `server/routers/design.ts` to:
1. Try to fetch `materialQuantity.getForProject` for the project
2. If result exists, call `buildMaterialAllocationPromptClause(result.rooms, roomId)` and pass it into `buildRoomMoodBoardPrompt` / `buildRoomRenderPrompt`
3. If not, proceed as before

---

## Step 5 — Wire `boardMaterialsCost` to Scoring

The `ProjectInputs` type already has `boardMaterialsCost?: number`. The scoring engine already reads it for the financial feasibility dimension.

After generating a `MaterialQuantityResult`:
- Call `db.updateProjectInputs(projectId, { boardMaterialsCost: result.summary.totalFinishCostMid })`
- This is the ONLY change needed to connect MQI to the scoring engine — no scoring formula changes

---

## Step 6 — Frontend: `MaterialAllocationPanel.tsx`

Create `client/src/components/MaterialAllocationPanel.tsx`.

This component receives `MaterialQuantityResult` and renders:

```
┌──────────────────────────────────────────────────────────────────┐
│  Material Cost Breakdown           [Re-run AI]  [Export BOQ]     │
│  "Premium Contemporary with Marble Accents"                      │
│                                                                  │
│  ┌── Budget Status ───────────────────────────────────────────┐  │
│  │  Total Finish Cost     AED 1,840,000 – 2,310,000           │  │
│  │  Budget Cap (stated)   AED 2,800,000         ✅ Under       │  │
│  │  Remaining for MEP/FFE AED 490,000 – 960,000               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ▼  Living & Dining (45 m²)                                      │
│  Floor                                                           │
│   ████████████████████░░░░░░░░░░  65%  Calacatta Marble         │
│   ░░░░░░░░░░░░░░░░░░░░██████████  35%  Natural Oak Timber       │
│   29.3 m² marble · 15.8 m² timber · AED 18,400–23,100          │
│                                                                  │
│  Walls                                                           │
│   ████████████████████████░░░░░░  80%  Venetian Plaster        │
│   ░░░░░░░░░░░░░░░░░░░░░░░░██████  20%  Marble Feature Wall     │
│   54.2 m² plaster · 13.5 m² marble · AED 22,800–28,900         │
│                                                                  │
│  [Lock Allocations]  [Edit]                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation notes:**

- Progress bars: use `div` with `width: X%` in the project's existing color scheme (emerald for primary, stone for secondary)
- Use shadcn `Accordion` for room sections (collapsed by default, expand on click)
- "Edit" opens an inline edit mode: each allocation row shows a shadcn `Slider` (0–100) to adjust the percentage split. Percentages must sum to 100 — if one goes up, the other goes down automatically (linked sliders)
- On blur of any slider, call `trpc.materialQuantity.updateAllocation.mutate(...)` immediately
- "Re-run AI" calls `trpc.materialQuantity.generate.mutate({ projectId })` and refetches
- "Export BOQ" — for now show a toast: "BOQ export coming in Phase B" (placeholder)
- "Lock Allocations" button calls `trpc.materialQuantity.lockAllocations.mutate({ projectId, locked: true })`
- When locked, all sliders are disabled and show a 🔒 icon

**Budget status color logic:**
- `budgetUtilizationPct < 70%` → green "Well within budget"
- `budgetUtilizationPct 70–90%` → amber "Tight — limited MEP/FF&E headroom"
- `budgetUtilizationPct > 90%` → red "⚠️ Over budget — review material spec"

---

## Step 7 — ProjectDetail: Material Cost Tab

In `client/src/pages/ProjectDetail.tsx`, add a "Material Cost" tab AFTER the existing "Assets" tab (which was added in Phase 10A).

```tsx
<TabsTrigger value="material-cost">Material Cost</TabsTrigger>

// In TabsContent:
<TabsContent value="material-cost">
  <MaterialCostTabContent projectId={projectId} project={project} inputs={inputs} />
</TabsContent>
```

Create `MaterialCostTabContent` as an inline component or import from `MaterialAllocationPanel.tsx`:

```tsx
function MaterialCostTabContent({ projectId, project, inputs }) {
  const { data: mqi, isLoading } = trpc.materialQuantity.getForProject.useQuery({ projectId });
  const generate = trpc.materialQuantity.generate.useMutation({ onSuccess: () => refetch() });

  if (isLoading) return <LoadingSpinner />;

  if (!mqi) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          No material cost analysis yet for this project.
        </p>
        <Button onClick={() => generate.mutate({ projectId })} disabled={generate.isPending}>
          {generate.isPending ? "Analyzing..." : "Generate Material Cost Analysis"}
        </Button>
      </div>
    );
  }

  return <MaterialAllocationPanel result={mqi} projectId={projectId} />;
}
```

---

## Step 8 — Supplier Source Admin UI

In the existing Market Intelligence admin page (or a new section within it), add a simple "Material Supplier Sources" card:

- Table listing all `material_supplier_sources` for the org
- "Add Source" button → inline form: supplierName, supplierUrl, category (dropdown), tier (dropdown)
- "Scrape Now" button per row → calls `trpc.materialQuantity.scrapeSupplierSource.mutate({ sourceId })`
- Shows `lastScrapedAt` and `lastPriceAedMin/Max` per row

Pre-seed 5 default sources via a DB seed function (call `db.seedMaterialSupplierSources()` if the table is empty):
```
1. RAK Ceramics UAE      | https://www.rakceramics.com/ae/    | flooring | mid
2. Porcelanosa UAE       | https://www.porcelanosa.com/ae/    | flooring | premium
3. Algedra Interior      | https://www.algedra.ae/materials   | flooring | ultra
4. Danube Home UAE       | https://www.danubehome.com/ae/     | flooring | affordable
5. Arabian Tile Company  | https://www.arabiantile.com/       | wall_tile | mid
```

---

## Step 9 — Tests

Create `server/engines/v15-mqi.test.ts` (follow naming convention of existing tests):

```typescript
// Tests to write:

// calculateSurfaceAreas
// - Villa (800 sqm, 9 rooms): verify total floor ≈ 800, walls ≈ 2.4× floor, ceiling ≈ 760
// - Single room (40 sqm living room, 2.8m ceiling): verify formula outputs
// - Zero sqm room: returns zeros without throwing

// buildQuantityCostSummary
// - Single allocation 100% marble: totalCostMid = area × midPrice
// - Split 60/40 marble/timber: costs sum correctly
// - Over-budget flag: set when totalFinishCostMid > budgetCapAed

// computeValueAddBridge (already tested in v10) — just verify no regression

// Integration: generate → getForProject returns consistent data
```

Run `pnpm test` after each step. Zero regressions allowed.

---

## Build Order

Follow strictly:

1. **Schema** (Step 1) → `pnpm db:push`
2. **Core engine** (Step 2) — calculateSurfaceAreas first (testable immediately), then generateMaterialAllocations, then buildQuantityCostSummary
3. **Router** (Step 3) — `generate` + `getForProject` first, then `updateAllocation`, `lockAllocations`, last the supplier scraping procedures
4. **Visual gen extension** (Step 4) — `buildMaterialAllocationPromptClause` helper + nano-banana-client changes
5. **boardMaterialsCost wire** (Step 5) — one line in the generate procedure
6. **Frontend panel** (Step 6) — `MaterialAllocationPanel.tsx`
7. **ProjectDetail tab** (Step 7) — add the tab last, after panel is working
8. **Supplier admin UI** (Step 8) — lowest priority, do last
9. **Tests** (Step 9) — write alongside steps 2–3

---

## Critical Rules — Must Follow

1. **NEVER modify `calculateProjectScore()` or any scoring sub-calculator.** The only scoring connection is writing `boardMaterialsCost` to the project record, which the engine already reads.
2. **NEVER modify `shared/miyar-types.ts → ProjectInputs`** — `boardMaterialsCost` already exists there.
3. **NEVER call Gemini inside `calculateSurfaceAreas()` or `buildQuantityCostSummary()`** — these must be pure deterministic math functions. LLM is ONLY in `generateMaterialAllocations()`.
4. **NEVER auto-fill `fin01BudgetCap` or `ctx03Gfa` from MQI results.** These are developer-owned fields.
5. **All tRPC procedures use `orgProcedure`.**
6. **The `buildFinishSchedule()` function is NOT replaced** — it continues to work exactly as before. MQI is an additional layer, not a replacement.
7. **The intake `scrapeUrl` procedure currently uses `fetchBasic()`.** Upgrade it to use `DynamicConnector` instead — this is a one-line change that gives supplier URLs the full 6-provider fallback chain. Do this as part of Step 3.
8. **Do not touch `ProjectDetail.tsx` tabs order except to add "Material Cost" after "Assets".** The existing 10 tabs stay in their current order.

---

## Acceptance Criteria

- [ ] `calculateSurfaceAreas()` for a 800 sqm villa returns floor ≈ 800 m², wall ≈ 1,900–2,200 m², ceiling ≈ 760 m²
- [ ] `generate` procedure returns `MaterialQuantityResult` with correct totals for a test project
- [ ] Material allocations per room sum to exactly 100% per surface element
- [ ] `totalFinishCostMid` is written to `boardMaterialsCost` on the project record
- [ ] `isOverBudget` flag correctly fires when finish cost > budget cap × GFA
- [ ] ProjectDetail "Material Cost" tab renders the allocation panel for a project with MQI data
- [ ] "Generate" empty state renders for projects without MQI data
- [ ] Room mood board and render prompts for projects with MQI data include the allocation clause ("65% marble floor with 35% timber inlay")
- [ ] Supplier source table renders in admin; "Scrape Now" updates lastPriceAedMin/Max
- [ ] `pnpm test` passes with zero regressions
