---
name: miyar-materials
description: >
  Use when working on material quantity intelligence, surface area calculations,
  material allocations, finish schedules, material library pricing, supplier scraping,
  or any visual generation that references materials. This is the domain skill for
  MIYAR 3.0 Phase A (Material Quantity Intelligence).
---

# MIYAR Materials & Quantity Intelligence Guide

## The Mental Model

MIYAR 3.0 Phase A adds a bottom-up cost layer on top of the existing top-down scoring:

```
EXISTING (top-down)                    NEW (bottom-up)
───────────────────────                ────────────────────────────────
Developer states budget cap            MIYAR calculates what the spec COSTS
System scores it against benchmarks    Surface areas × material splits × unit prices
Validates: "Is AED 2,800 realistic?"  Answers: "Your spec costs AED 2.1M — here's why"
```

These two approaches run in parallel. Bottom-up does NOT replace top-down scoring.

---

## Key Files — Read These Before Working on Materials

| File | Purpose |
|------|---------|
| `server/engines/design/space-program.ts` | `buildSpaceProgram()` → rooms with sqm, finishGrade, budgetPct |
| `server/engines/design/finish-schedule.ts` | `buildFinishSchedule()` → one material per element (EXTEND, never replace) |
| `server/engines/design/material-quantity-engine.ts` | NEW — surface area math + Gemini allocation + cost summary |
| `server/routers/materialQuantity.ts` | NEW — tRPC procedures for MQI |
| `drizzle/schema.ts` | `material_library`, `materials_catalog`, `material_constants`, `material_allocations`, `material_supplier_sources` |
| `server/engines/visual-gen.ts` | `buildBoardAwarePromptContext()` — extend with allocation clause |
| `server/engines/design/nano-banana-client.ts` | Room render + mood board prompts — inject material splits |

---

## Material Category System

MIYAR uses TWO parallel material systems. Understand both before writing any material code:

### System 1: `material_library` (primary pricing source for MQI)
Granular room-element matching. Fields: `category`, `tier`, `style`, `brand`, `productName`, `priceAedMin`, `priceAedMax`.

| category | Covers | Typical unit |
|----------|--------|-------------|
| `flooring` | All floor finishes: marble, porcelain, timber, carpet | AED/sqm |
| `wall_paint` | Paint, Venetian plaster, textured finishes | AED/sqm |
| `wall_tile` | Ceramic/porcelain wall tiles (wet areas) | AED/sqm |
| `ceiling` | Gypsum board, plaster, stretch ceiling | AED/sqm |
| `joinery` | Kitchen units, wardrobes, door frames, custom cabinetry | AED/lm or AED/sqm |
| `sanitaryware` | Toilets, basins, showers, brassware | AED/set |
| `fittings` | Door handles, hinges, hooks, towel rails | AED/set |
| `lighting` | Downlights, pendants, strip lighting | AED/point or AED/sqm |
| `hardware` | Kitchen/wardrobe handles, drawer systems | AED/set |
| `specialty` | Wallpaper, acoustic panels, feature materials | AED/sqm |

### System 2: `materials_catalog` (FF&E library)
Broader catalog with `typicalCostLow/High`. Used for furniture, fixtures, accessories. NOT used for surface area calculations — use `material_library` for that.

### System 3: `material_constants` (sustainability engine)
Scientific constants (carbonIntensity, density, costPerM2). Used for sustainability scoring, NOT for MQI cost calculations.

**Rule:** For MQI surface cost calculations, ALWAYS use `material_library.priceAedMin/Max`. Never use `material_constants.costPerM2` for client-facing pricing — it's a carbon reference, not a market price.

---

## UAE Material Cost Reference (2024–2025 AED/sqm)

Use these as sanity checks when evaluating Gemini outputs or writing test fixtures:

### Flooring
| Material | Affordable | Mid | Premium | Ultra |
|----------|-----------|-----|---------|-------|
| Basic ceramic tile | 60–80 | – | – | – |
| Standard porcelain | – | 90–140 | – | – |
| Large-format porcelain (60×120+) | – | – | 150–250 | – |
| Engineered timber | – | 120–180 | 200–320 | – |
| Natural stone (local) | – | – | 180–280 | – |
| Calacatta/Statuario marble | – | – | – | 350–600 |
| Onyx / Quartzite | – | – | – | 500–900 |

### Wall Finishes
| Finish | Affordable | Mid | Premium | Ultra |
|--------|-----------|-----|---------|-------|
| Standard paint | 15–25 | – | – | – |
| Premium paint (Jotun/Dulux) | – | 30–50 | – | – |
| Venetian plaster | – | – | 80–140 | – |
| Wall tile (ceramic) | 40–70 | – | – | – |
| Wall tile (porcelain) | – | 80–130 | 140–220 | – |
| Natural stone cladding | – | – | – | 300–550 |

### Ceiling
| Finish | Cost Range |
|--------|-----------|
| Basic gypsum board | 35–60 AED/sqm |
| Decorated gypsum with coves | 80–150 AED/sqm |
| Stretch ceiling | 120–200 AED/sqm |
| Custom coffered/tray ceiling | 200–400 AED/sqm |

### Joinery (indicative — highly variable)
| Type | Range |
|------|-------|
| Kitchen units (mid) | 800–1,500 AED/lm |
| Kitchen units (premium) | 2,000–5,000 AED/lm |
| Wardrobes (mid) | 600–1,000 AED/lm |
| Wardrobes (premium) | 1,500–3,500 AED/lm |

---

## Surface Area Calculation Rules

`calculateSurfaceAreas()` must follow these rules exactly:

### Ceiling height defaults
- Standard residential: **2.8m**
- Hospitality / commercial: **3.2m**
- If `floorPlanAnalysis.ceilingHeight` exists → use that value
- Never assume less than 2.4m or more than 5m (flag as error)

### Aspect ratio by room type (for wall area estimation)
```
Living / Dining / Lobby:  1.6  (longer than wide)
Master Bedroom:           1.4
Bedroom 2/3:              1.3
Kitchen:                  1.4
Bathroom / Ensuite:       1.0  (near-square)
Corridor / Hallway:       2.5  (very long)
Office / Meeting:         1.5
Back-of-House / Utility:  1.8
Default:                  1.4
```

### Wall area formula
```
perimeter = 2 × (√(sqm × ratio) + √(sqm / ratio))
rawWallM2 = perimeter × ceilingHeight
wallM2 = rawWallM2 × 0.85  ← 15% deduction for door/window openings
```

### Ceiling area
```
ceilingM2 = sqm × 0.95  ← 5% deduction for structural elements
```

### Floor area
```
floorM2 = sqm  ← no deduction
```

### Validation
- `floorM2 + wallM2 + ceilingM2` for a typical 800sqm villa should be ~4,200–4,800 sqm total
- Wall area should always be ~2.0–2.5× floor area for typical residential
- If ratio is outside 1.5–3.5, something is wrong — log a warning

---

## Material Allocation Rules

When writing the Gemini prompt or validating allocations:

### What goes where
| Surface | Allowed Materials | Never Use |
|---------|-------------------|-----------|
| Floor (dry rooms) | flooring: marble, porcelain, timber, carpet | wall_tile, wall_paint |
| Floor (wet rooms: bathrooms, kitchen) | wall_tile (anti-slip), flooring (anti-slip porcelain) | timber, carpet |
| Walls (dry rooms) | wall_paint, specialty (wallpaper, plaster) | wall_tile, flooring |
| Walls (wet: bathrooms, kitchen splashback) | wall_tile | wall_paint (not on wet walls) |
| Walls (feature wall only, Grade A rooms) | flooring (stone cladding), specialty | – |
| Ceiling (all rooms) | ceiling category only | flooring, wall_tile |
| Joinery | joinery category | – |

### UAE climate rules
- **Never specify solid wood flooring in wet areas** — humidity damage guaranteed
- **Marble flooring in bathrooms requires anti-slip treatment** — note this
- **Dark stone in west-facing spaces absorbs heat** — flag for premium projects
- **Carpet in master bedrooms is common in high-end UAE residential** — not unusual

### Split logic (max 2 materials per surface)
- Grade A rooms (living, master suite, lobby): 1–2 materials, can split
- Grade B rooms (secondary bedrooms): usually 1 material
- Grade C rooms (utility, back-of-house, corridors): always 1 material, always affordable tier
- Ceiling: almost always 1 material. Split ceiling ONLY in Grade A + ultra tier (e.g. painted + stretch)
- When splitting: natural breaks make sense (e.g. marble inlay border on timber floor, feature wall in stone)

### Percentages must sum to 100
- Never return 60% + 30% = 90%. Always 100%.
- If Gemini returns a non-100 sum, redistribute proportionally on the server before storing

---

## Integration with Existing Systems

### `buildSpaceProgram()` → feeds surface calculations
Always call `buildSpaceProgram(project)` first to get rooms. MQI uses the same room list.
- If `project.floorPlanAnalysis` exists → rooms come from AI floor plan analysis (Phase 9)
- Otherwise → rooms come from typology templates (residential/commercial/hospitality)
- The `room.finishGrade` (A/B/C) drives material tier selection

### `buildFinishSchedule()` → still runs independently
The finish schedule assigns ONE material per element. MQI adds SPLITS on top.
- DO NOT modify `buildFinishSchedule()` — it continues to produce single-material assignments
- MQI `material_allocations` table is separate from `finish_schedule_items` table
- Both can coexist on a project. The design brief uses finish schedule; MQI uses allocations.

### `boardMaterialsCost` in ProjectInputs
After MQI generates `totalFinishCostMid`, write it to the project:
```typescript
await db.update(projects)
  .set({ boardMaterialsCost: result.summary.totalFinishCostMid })
  .where(eq(projects.id, projectId));
```
The scoring engine already reads `boardMaterialsCost` for financial feasibility. No scoring changes needed.

### Visual generation — allocation clause format
The `buildMaterialAllocationPromptClause()` function should produce natural language like:
```
"Floor: 65% Calacatta marble with 35% natural oak timber inlay border.
 Walls: 80% Venetian plaster in warm ivory, 20% book-matched marble feature panel.
 Ceiling: painted gypsum with integrated cove lighting."
```
Rules for the clause:
- Lead with the dominant material (highest %)
- Use the exact brand/product name if `materialLibraryId` resolves to a real row
- If generic (no library match), use the material name + category context
- Max 1 sentence per surface element
- If single material (100%), just: "Floor: Calacatta marble throughout."

---

## Common Mistakes to Avoid

### 1. Using `material_constants.costPerM2` for market pricing
That table has scientific averages for carbon calculations. AED 45/sqm for "stone" is NOT a market price — Calacatta marble is AED 350–600/sqm. Always use `material_library.priceAedMin/Max`.

### 2. Applying MQI budget split to the full project budget
`fin01BudgetCap × gfa` = TOTAL project budget (structure + MEP + fit-out + FF&E).
Finish materials are typically 35–50% of total fitout, which is ~15–20% of total project cost.
The MQI result shows finish cost only — don't compare it to the full project budget. Compare to `fin01BudgetCap × gfa × 0.35` as the fitout budget portion.

### 3. Replacing `buildFinishSchedule()` with MQI
These are parallel systems. Finish schedule = single material per element for design brief and RFQ. MQI = split allocations for cost intelligence and visual gen. Both run independently.

### 4. Running Gemini allocation on Grade C rooms
Grade C rooms (utility, maid's, back-of-house) should always be affordable/mid with no splits. Set them deterministically before calling Gemini, then exclude them from the Gemini prompt to reduce token usage.

### 5. Forgetting wet room rules in Gemini prompt
Always explicitly tell Gemini the wet room IDs (BTH, MEN, ENS, KIT) in the prompt and remind it: "Wet room walls must use wall_tile, never wall_paint."

### 6. Wrong surface area totals
For a 100 sqm luxury apartment: floor ~100m², walls ~230–260m², ceiling ~95m². Total ~430m².
If your calculation returns 150m² total for 100 sqm, something is wrong — likely forgot to multiply wall area by ceiling height.

---

## Supplier Scraping Notes

The `material_supplier_sources` table uses the existing `DynamicConnector` from the ingestion engine:
- `cleanHtmlForLLM()` is already built — HTML is cleaned before Gemini extraction
- 6-provider fallback: Firecrawl → ScrapingAnt → ScrapingDog → Apify → ParseHub → Native
- Firecrawl credits exhausted (as of March 2026) — ScrapingAnt is primary
- Most UAE supplier sites (RAK Ceramics, Porcelanosa, Danube Home) are accessible via ScrapingAnt
- If a site uses heavy JS rendering, ScrapingDog with `dynamic=true` is the right fallback

Price extraction prompt for Gemini (after scraping supplier URL):
```
"Extract all product pricing from this content. Return an array of:
{ productName, category, priceAedMin, priceAedMax, unit, brand }
Only include items with AED pricing. Return empty array if no prices found."
```

Update `material_library` rows on successful scrape:
- Match by `supplierName` + `category` + `tier`
- Update `priceAedMin` and `priceAedMax` if new values are in range (±50% of existing — flag larger swings for admin review)

---

## Test Fixtures

```typescript
// Standard test project for surface calculations
const testRooms: Room[] = [
  { id: "LVG", name: "Living & Dining", sqm: 45, finishGrade: "A", priority: "high", budgetPct: 0.28 },
  { id: "MBR", name: "Master Bedroom", sqm: 25, finishGrade: "A", priority: "high", budgetPct: 0.22 },
  { id: "MEN", name: "Master Ensuite", sqm: 10, finishGrade: "A", priority: "high", budgetPct: 0.14 },
  { id: "KIT", name: "Kitchen", sqm: 18, finishGrade: "A", priority: "high", budgetPct: 0.16 },
  { id: "BD2", name: "Bedroom 2", sqm: 18, finishGrade: "B", priority: "medium", budgetPct: 0.07 },
  { id: "BTH", name: "Bathroom", sqm: 6, finishGrade: "B", priority: "medium", budgetPct: 0.05 },
  { id: "UTL", name: "Utility", sqm: 5, finishGrade: "C", priority: "low", budgetPct: 0.01 },
];
// Expected: floor ≈ 127 sqm, walls ≈ 280–320 sqm, ceiling ≈ 121 sqm, total ≈ 520–560 sqm

// Valid allocation (sums to 100)
const validFloorAllocation = [
  { materialName: "Calacatta Marble", percentage: 65 },
  { materialName: "Natural Oak Timber", percentage: 35 },
];

// Over-budget scenario
const overBudgetResult = {
  totalFinishCostMid: 3_200_000,
  budgetCapAed: 2_800_000,
  isOverBudget: true,
  overBudgetByAed: 400_000,
  budgetUtilizationPct: 114,
};
```
