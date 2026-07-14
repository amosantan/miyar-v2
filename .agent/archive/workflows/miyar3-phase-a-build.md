---
description: Step-by-step build workflow for MIYAR 3.0 Phase A — Material Quantity Intelligence
---

# MIYAR 3.0 Phase A Build Workflow

## Pre-flight Checklist (do before touching any code)

- [ ] Read `.agent/prompts/miyar3-phase-a-mqi.md` — full spec with interfaces, Gemini prompts, and acceptance criteria
- [ ] Read `.agent/skills/miyar-materials/SKILL.md` — UAE material domain knowledge, surface area rules, common mistakes
- [ ] Read `.agent/rules/miyar-memory.md` — immutable rules, system stats, what Phase 10B already built
- [ ] Read `server/engines/design/space-program.ts` — understand `buildSpaceProgram()` and `Room` type
- [ ] Read `server/engines/design/finish-schedule.ts` — understand what already exists (you EXTEND it, never replace)
- [ ] Read `drizzle/schema.ts` lines 720–810 and 1599–1680 — understand `material_library`, `finish_schedule_items`, `material_allocations` pattern to follow
- [ ] Read `server/engines/ingestion/connectors/dynamic.ts` — `cleanHtmlForLLM()` and `DynamicConnector`
- [ ] Run `pnpm test` — confirm baseline passes (655+ tests) before starting

---

## Step 1 — DB Schema (MUST be first)

**File:** `drizzle/schema.ts`

Add two tables using `mysqlTable` — match the pattern of existing tables exactly:
1. `material_allocations` — per-room/element/material with allocationPct, surfaceAreaM2, unit costs
2. `material_supplier_sources` — supplier URLs for automated price scraping

After editing schema: `pnpm db:push`

Verify: `grep -c "mysqlTable" drizzle/schema.ts` — count should increase by 2.

**Check:** No other file changes in this step. Schema only.

---

## Step 2 — Core Engine (do in sub-order)

**File:** `server/engines/design/material-quantity-engine.ts` (NEW)

### 2a. `calculateSurfaceAreas(rooms, ceilingHeightM?)` — do first, testable immediately
- Pure math, no imports beyond Room type
- Follow aspect ratio rules from SKILL.md exactly
- Write unit tests immediately after: `server/engines/v15-mqi.test.ts`

### 2b. `generateMaterialAllocations(project, inputs, surfaces, materialLibrary)` — do second
- One Gemini call for the whole project (not per room)
- Use `invokeLLM()` with `outputSchema` for structured JSON
- Pre-filter materialLibrary to matching tier + style before passing to Gemini
- Exclude Grade C rooms from Gemini prompt — set them deterministically (affordable, single material)
- Validate that all percentage arrays sum to 100 — redistribute if not

### 2c. `buildQuantityCostSummary(surfaces, allocations, materialLibrary)` — do last
- Pure math, no LLM
- Cross-reference `materialLibraryId` → look up priceAedMin/Max from materialLibrary
- Calculate `budgetCapAed = project.fin01BudgetCap × project.ctx03Gfa` (handle nulls)
- Set `isOverBudget` and `overBudgetByAed` correctly

**Check:** `pnpm test` after Step 2 — all new tests pass, no regressions.

---

## Step 3 — Router

**File:** `server/routers/materialQuantity.ts` (NEW)

Build procedures in this order:
1. `generate` — the main procedure. Calls Steps 1-3 of engine, stores to DB, writes `boardMaterialsCost`
2. `getForProject` — reads stored allocations, reconstructs result
3. `updateAllocation` — edit a single row, recalculate totals server-side
4. `lockAllocations` — bulk set isLocked
5. `addSupplierSource` — insert into material_supplier_sources
6. `scrapeSupplierSource` — use `DynamicConnector`, extract prices via Gemini, update material_library

**Also in this step:** Upgrade `scrapeUrl` in `server/routers/intake.ts` from `fetchBasic()` to `DynamicConnector`.
This is one line — gives URL scraping the full 6-provider fallback chain.

**Register in `server/routers.ts`:**
```typescript
import { materialQuantityRouter } from "./routers/materialQuantity";
// add:
materialQuantity: materialQuantityRouter,
```

**Check:** `pnpm check` (TypeScript) — no type errors. `pnpm test` — no regressions.

---

## Step 4 — Visual Generation Extension

**File 1:** `server/engines/visual-gen.ts`

Add `buildMaterialAllocationPromptClause(rooms, targetRoomId?)` at bottom of file.
DO NOT modify any existing functions — add only.

**File 2:** `server/engines/design/nano-banana-client.ts`

In `buildRoomMoodBoardPrompt()` and `buildRoomRenderPrompt()`:
- Add optional `allocationClause?: string` parameter
- If provided: replace generic materials line with allocationClause
- If not provided: existing behavior unchanged

**File 3:** `server/routers/design.ts`

In the image generation procedure:
- Try `trpc.materialQuantity.getForProject` (or call DB directly)
- If MQI data exists: generate allocation clause and pass to nano-banana-client
- If no MQI data: proceed as before (no change to existing behavior)

**Check:** Generate a test render for a project WITH and WITHOUT MQI data — both should work.

---

## Step 5 — Wire boardMaterialsCost

In the `generate` procedure (Step 3), after calling `buildQuantityCostSummary()`:

```typescript
// Write bottom-up finish cost to project for scoring engine
await db.update(projects)
  .set({ boardMaterialsCost: result.summary.totalFinishCostMid })
  .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)));
```

That's it. The scoring engine already reads `boardMaterialsCost`. No other scoring changes.

---

## Step 6 — Frontend Panel

**File:** `client/src/components/MaterialAllocationPanel.tsx` (NEW)

Build in this order:
1. Budget status card (total finish cost vs budget cap) — renders from summary
2. Room accordion (shadcn Accordion, collapsed by default)
3. Per-surface bar charts (div with percentage width, two-tone)
4. Edit mode with linked sliders (shadcn Slider, percentages must sum to 100)
5. Lock/Unlock button
6. Re-run AI button
7. "Export BOQ" placeholder toast

**Key rule:** When one slider changes, the other automatically adjusts to keep sum = 100.

**Check:** Render with mock `MaterialQuantityResult` before wiring to real API.

---

## Step 7 — ProjectDetail Tab

**File:** `client/src/pages/ProjectDetail.tsx`

Add ONE tab — "Material Cost" — after the "Assets" tab (which was added in Phase 10A).
Do NOT reorder existing tabs.

Tab content: empty state with "Generate" button, or `MaterialAllocationPanel` when data exists.

**Check:** All existing tabs still render. New tab shows empty state for old projects.

---

## Step 8 — Supplier Admin UI

**File:** `client/src/pages/admin/` or `client/src/pages/MarketIntelligence.tsx`

Add "Material Supplier Sources" section:
- Table of sources with lastScrapedAt + lastPriceAedMin/Max
- "Add Source" inline form
- "Scrape Now" button per row

Seed 5 default sources on first load if table is empty (RAK Ceramics, Porcelanosa, Algedra, Danube Home, Arabian Tile Company).

---

## Step 9 — Tests

**File:** `server/engines/v15-mqi.test.ts`

Required tests:
- `calculateSurfaceAreas`: correct output for 7-room villa (see SKILL.md test fixture)
- `calculateSurfaceAreas`: zero sqm room returns zeros without throwing
- `buildQuantityCostSummary`: single 100% allocation calculates correctly
- `buildQuantityCostSummary`: 60/40 split costs sum correctly
- `buildQuantityCostSummary`: `isOverBudget` fires when cost > budget cap
- `buildQuantityCostSummary`: `budgetUtilizationPct` is null when `fin01BudgetCap` is null
- Integration: `generate` → `getForProject` returns data with correct room count

Run full suite: `pnpm test` — must be 655+ passing, zero regressions.

---

## Post-Build Checklist

- [ ] `pnpm test` passes — note new total count
- [ ] `pnpm check` passes — zero TypeScript errors
- [ ] `pnpm db:push` ran — both new tables exist in DB
- [ ] `material_allocations` table has rows after running `generate` on a test project
- [ ] `boardMaterialsCost` field updated on the project after generating MQI
- [ ] "Material Cost" tab visible in ProjectDetail
- [ ] Empty state shows for projects without MQI data
- [ ] Allocation panel renders with correct room count and surface areas
- [ ] Budget gap/surplus shows correct color (green/amber/red)
- [ ] Room render prompt includes allocation clause when MQI data exists
- [ ] Old room renders (no MQI) still work — no regression
- [ ] Supplier source table shows 5 pre-seeded rows
- [ ] "Scrape Now" updates lastScrapedAt
- [ ] Commit with message: `feat: MIYAR 3.0 Phase A — Material Quantity Intelligence`

---

## Phase Reality Report

After completing the build, generate a Phase Reality Report (follow the format of existing reports in `antigravity-history/`) covering:
1. What was built (files created/modified, line counts)
2. What was NOT built (deferred items)
3. Test results (before/after count)
4. Any deviations from spec and why
5. Open issues or gaps discovered during build
