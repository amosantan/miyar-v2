# MIYAR 3.0 Phase A — MQI Build Task Tracker

## Step 1 — DB Schema
- [ ] Add `material_allocations` table to `drizzle/schema.ts`
- [ ] Add `material_supplier_sources` table to `drizzle/schema.ts`
- [ ] Run `pnpm db:push` — verify tables created

## Step 2 — Core Engine (`material-quantity-engine.ts`)
- [ ] Create `calculateSurfaceAreas()` — pure deterministic math
- [ ] Write unit tests for `calculateSurfaceAreas()` immediately
- [ ] Create `generateMaterialAllocations()` — Gemini suggestion engine
- [ ] Create `buildQuantityCostSummary()` — pure cost math
- [ ] Write unit tests for `buildQuantityCostSummary()`

## Step 3 — Router (`materialQuantity.ts`)
- [ ] Create `generate` procedure
- [ ] Create `getForProject` procedure
- [ ] Create `updateAllocation` procedure
- [ ] Create `lockAllocations` procedure
- [ ] Create `addSupplierSource` procedure
- [ ] Create `scrapeSupplierSource` procedure
- [ ] Register router in `server/routers.ts`
- [ ] Upgrade `scrapeUrl` in `intake.ts` to use `DynamicConnector`

## Step 4 — Visual Generation Extension
- [ ] Add `buildMaterialAllocationPromptClause()` to `visual-gen.ts`
- [ ] Extend `nano-banana-client.ts` with `allocationClause` parameter
- [ ] Update `design.ts` router to pass allocation clause when MQI data exists

## Step 5 — Wire `boardMaterialsCost`
- [ ] Write `totalFinishCostMid` to project's `boardMaterialsCost` in `generate` procedure

## Step 6 — Frontend Panel (`MaterialAllocationPanel.tsx`)
- [ ] Budget status card
- [ ] Room accordion with per-surface bar charts
- [ ] Edit mode with linked sliders
- [ ] Lock/Unlock + Re-run AI + Export BOQ placeholder

## Step 7 — ProjectDetail Tab
- [ ] Add "Material Cost" tab after "Assets" tab

## Step 8 — Supplier Admin UI
- [ ] Supplier sources table + Add Source form + Scrape Now button
- [ ] Seed 5 default supplier sources

## Step 9 — Final Verification
- [ ] `pnpm test` passes — record new baseline (670+)
- [ ] `pnpm check` — zero TypeScript errors
- [ ] Update `PROGRESS.md` + `miyar-memory.md` + `GEMINI.md`
- [ ] Commit: `feat: MIYAR 3.0 Phase A — Material Quantity Intelligence`
