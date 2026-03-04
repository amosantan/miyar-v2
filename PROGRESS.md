# MIYAR 3.0 — Live Progress Tracker

> **This file is the live source of truth for what is done vs. pending.**
> **Every task must update this file before marking complete. No exceptions.**
>
> Last Updated: 04 March 2026

---

## ✅ MIYAR 3.0 Phase B — Typology-Aware Space Program Intelligence — COMPLETE

### Phase B Build Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| B1 | DB Schema: `space_program_rooms` table (`mysqlTable`) | ✅ Done | `drizzle/schema.ts` |
| B2 | DB Schema: `amenity_sub_spaces` table (`mysqlTable`) | ✅ Done | Same migration |
| B3 | `pnpm db:push` — verify 87 tables | ✅ Done | After B1+B2 |
| B4 | `typology-fitout-rules.ts` — deterministic fit-out matrix | ✅ Done | 15 typology entries × 16 room categories |
| B5 | `amenity-taxonomy.ts` — 9 amenity types + `validateTaxonomy()` | ✅ Done | All ratios sum to 1.0 |
| B6 | `dwg-parser.ts` — DXF geometry parser + DWG→vision fallback | ✅ Done | `dxf-parser` npm package |
| B7 | `space-program-extractor.ts` — orchestrator (file OR GFA → SpaceProgramRoom[]) | ✅ Done | Depends on B4, B5, B6 |
| B8 | +7 DB functions in `server/db.ts` | ✅ Done | Depends on B1 |
| B9 | `server/routers/spaceProgram.ts` — 8 `orgProcedure` endpoints | ✅ Done | Depends on B7, B8 |
| B10 | Register `spaceProgramRouter` in `routers.ts` | ✅ Done | After B9 |
| B11 | Update `materialQuantity.ts` — stored-rooms-first, `buildSpaceProgram()` fallback | ✅ Done | BACKWARD COMPATIBLE |
| B12 | `drizzle/seed-amenity-taxonomy.ts` — N/A (pure function, runtime generation) | ✅ Done | No seed script needed |
| B13 | `SpaceProgramEditor.tsx` — room table, fit-out toggles, amenity accordion, block tabs | ✅ Done | shadcn Accordion |
| B14 | Add "Space Program" tab to `ProjectDetail.tsx` (BEFORE "Material Cost") | ✅ Done | Tab order verified |
| B15 | `v31-space-program.test.ts` — typology rules + amenity taxonomy + MQI integration | ✅ Done | 30 tests (target was 15+) |
| B16 | `pnpm test` passes — new baseline recorded | ✅ Done | 800 passing / 830 total |
| B17 | `pnpm check` — zero TypeScript errors | ✅ Done | |
| B18 | Manual: office building 50,000 sqm → office floors = shell & core ❌ | ✅ Done | Verified via extractor |
| B19 | Manual: fit-out toggle → override → reset → confirm non-overridden rooms revert | ✅ Done | B19 manual test script passed all 6 steps |
| B20 | Manual: existing project with no space program → MQI still generates via fallback | ✅ Done | Legacy fallback confirmed |
| B21 | Update `PROGRESS.md` + `miyar-memory.md` + `GEMINI.md` | ✅ Done | This update |
| B22 | Commit: `feat: MIYAR 3.0 Phase B — Typology-Aware Space Program Intelligence` | ✅ Done | |

**Phase B Acceptance Criteria — ALL MET:**
- [x] Office building 50,000 sqm: only ~4,000–7,500 sqm (lobby + toilets + amenities) flagged fit-out
- [x] Gym amenity 600 sqm → expands to 6 sub-spaces, sub-sqm totals = 600 sqm
- [x] All amenity taxonomy sqmRatios sum to 1.0 (enforced by `validateTaxonomy()`)
- [x] Developer toggles office floor to fit-out → `fitOutOverridden=true` → reset preserves override
- [x] Existing project with no space program → `materialQuantity.generate` still works
- [x] DXF file with closed polylines → rooms extracted with sqm from shoelace formula
- [x] Mixed-use project: Residential block + Office block → each has independent fit-out rules

### Post-Phase-B Bug Fixes

| Bug | File | Fix | Status |
|-----|------|-----|--------|
| Reset Defaults creates duplicate rooms when overridden rooms exist | `server/routers/spaceProgram.ts` | After reset, fetch overridden roomCodes, filter them out of regenerated defaults before insertion | ✅ Fixed |
| MQI `generateMaterialAllocations()` fails with Gemini 500 — union type `["number", "null"]` | `server/engines/design/material-quantity-engine.ts` | Changed all 4 `materialLibraryId` schema entries to `type: "number"` (not required, Gemini omits when null) | ✅ Fixed |
| Mixed-use projects fall through to residential room template | `server/engines/design/typology-fitout-rules.ts` | Added mixed-use template: lobby 10%, retail 30%, residential 25%, F&B 10%, amenities 5%, corridors 8%, parking 7%, utility 5% | ✅ Fixed |
| No UI to define blocks for multi-block mixed-use projects | `client/src/components/SpaceProgramEditor.tsx` | Added block builder form in empty state for mixed-use typology — each block gets name, typology, GFA%. `handleGenerate` passes blocks to mutation | ✅ Fixed |

### Post-Phase-B Integration Gap Fixes

| Gap | File | Fix | Status |
|-----|------|-----|--------|
| Gap 1: AI Advisor stale rows | `server/routers/design-advisor.ts` | Clear `space_recommendations` in `getSpaceProgram` when stored rooms exist | ✅ Fixed |
| Gap 2: `totalFitoutArea` stale on read | `server/routers/spaceProgram.ts` | Sync `totalFitoutArea` via `updateProjectVerification` in `getForProject` read path | ✅ Fixed |
| Gap 3: 5-Lens contributions all 0.00 | `server/engines/five-lens.ts` | Proxy-based remapper from scoring engine keys (`str01_n`, `budgetFit`) to project field names (`mkt01Tier`, `fin01BudgetCap`) | ✅ Fixed |
| Gap 4: ROI rework/variance ≈ 0 AED | `server/engines/roi.ts` | Compute `totalBudget = budgetCap × gfa` (prefers fitOutArea via `getPricingArea`) for Drivers 3/4/6 | ✅ Fixed |
| Gap 5a: AMN/BTH show 0 AED | `server/engines/design/material-quantity-engine.ts` | Category-based fallback when `materialLibraryId` is null — matches element category (floor→flooring, walls→wall_paint/wall_tile etc.) with `.toLowerCase()` normalization | ✅ Fixed |
| Gap 5b: Blank sqm for ALL rooms | `client/src/components/MaterialAllocationPanel.tsx` | Field name mismatch: `alloc.actualAreaM2` → `alloc.surfaceAreaM2` | ✅ Fixed |

---

## ✅ MIYAR 3.0 Phase A — Material Quantity Intelligence (MQI) — COMPLETE

### Phase A Build Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| A1 | DB Schema: `material_allocations` table (`mysqlTable`) | ✅ Done | `drizzle/schema.ts` |
| A2 | DB Schema: `material_supplier_sources` table (`mysqlTable`) | ✅ Done | Same migration run |
| A3 | Run `drizzle-kit push` — verify 85 tables | ✅ Done | `drizzle-kit push --force` applied |
| A4 | `calculateSurfaceAreas(rooms)` — deterministic math engine | ✅ Done | `server/engines/design/material-quantity-engine.ts` |
| A5 | `generateMaterialAllocations()` — Gemini suggestion engine | ✅ Done | Same file. Gemini suggests ONLY — no pricing in LLM |
| A6 | `buildQuantityCostSummary()` — pure TypeScript cost math | ✅ Done | Same file |
| A7 | `server/routers/materialQuantity.ts` — 6 tRPC procedures | ✅ Done | generate, getForProject, updateAllocation, lockAllocations, addSupplierSource, scrapeSupplierSource |
| A8 | Upgrade `scrapeUrl` in `intake.ts`: `fetchBasic()` → `DynamicConnector` | ✅ Done | `server/routers/intake.ts` |
| A9 | `buildMaterialAllocationPromptClause()` helper in `visual-gen.ts` | ✅ Done | Natural language clause for image prompts |
| A10 | Wire `boardMaterialsCost` ← `totalFinishCostMid` on generate | ✅ Done | In materialQuantity router |
| A11 | `client/src/components/MaterialAllocationPanel.tsx` | ✅ Done | Bar charts, AED totals, budget gap/surplus |
| A12 | Add "Material Cost" tab to `ProjectDetail.tsx` | ✅ Done | After Space Program tab (Phase B) |
| A13 | Supplier admin UI — add/scrape supplier URLs | ✅ Done | In MaterialAllocationPanel |
| A14 | Unit tests for `calculateSurfaceAreas()` | ✅ Done | 5 tests in `v30-mqi.test.ts` |
| A15 | Unit tests for `buildQuantityCostSummary()` | ✅ Done | 5 tests in `v30-mqi.test.ts` |
| A16 | `pnpm test` passes — new baseline recorded | ✅ Done | 770 pass / 8 fail (pre-existing) / 22 skip = 800 total |
| A17 | Budget formula fix — named constants | ✅ Done | `SQFT_TO_SQM=10.764`, `FINISH_BUDGET_RATIO=0.35` |
| A18 | Update `PROGRESS.md` + `miyar-memory.md` + `GEMINI.md` | ✅ Done | This update |
| A19 | Seed 5 UAE supplier sources | ✅ Done | `npx tsx -r dotenv/config drizzle/seed-materials.ts` |

**Phase A Acceptance Criteria — ALL MET:**
- [x] 100sqm apartment: floor ~100m², walls ~230–260m², ceiling ~95m²
- [x] All allocation percentages sum to 100% per surface
- [x] Wet room walls always `wall_tile`, never `wall_paint`
- [x] `totalFinishCostMid` writes to `boardMaterialsCost` and affects FF score
- [x] Visual gen prompts include material allocation clause
- [x] Supplier scrape uses `DynamicConnector` (not `fetchBasic`)
- [x] Budget gap/surplus shown in AED and %

### Test Count Explanation (655 → 800)

The baseline increased from 655 to 800 (145 new tests) due to:
- **Phase 10A** tests committed with structure reorganization: `v10-sales-premium.test.ts` (24), `credibility-fixes.test.ts` (15)
- **Phase 10B** ingestion tests: `dfe-test-suite.test.ts` (56)
- **Phase 9** tests: `digital-twin.test.ts` (30)
- **Phase A (MQI)**: `v30-mqi.test.ts` (10)
- **Phase B**: `v31-space-program.test.ts` (30)
- Other test files reorganized during structure cleanup: ~10 additional

### Pre-existing Failures (8 — NOT Phase A/B regressions)

Verified via `git stash` comparison — identical results before/after Phase A:
- `auth.test.ts` (2) — bcrypt tests require live DB session
- `board-pdf.test.ts` (2) — `renderBoardAnnex` function not yet exported
- `v2-connectors.test.ts` (1) — `getAllConnectors` registry test
- `v9-space.test.ts` (3) — `require('./normalization')` module resolution

22 tests are **skipped** (not failed) in `market-intelligence.test.ts` — intentionally skipped.

---

## ✅ Completed Phases

### Phase 10A — Intelligent Project Intake
**Commit:** Uncommitted (changes in working tree) — needs commit

| Task | Status | Notes |
|------|--------|-------|
| GAP 1: `scrapeUrl` tRPC procedure + URL input with Fetching indicator | ✅ Done | `server/routers/intake.ts` |
| GAP 2: Three-card path selector (AI-Guided / Expert / Quick Brief) | ✅ Done | `client/src/pages/ProjectNew.tsx` |
| GAP 3: Conversational chat panel + `chat` tRPC procedure | ✅ Done | IntakeCanvas + intake.ts |
| GAP 4: `fieldConfidence` + `fieldReasoning` props + colored dot indicators | ✅ Done | `client/src/components/ProjectForm.tsx` |
| GAP 5: Assets tab on ProjectDetail with grid + modal | ✅ Done | `client/src/pages/ProjectDetail.tsx` |
| Pass `fieldConfidence`/`fieldReasoning` from `ProjectNew.tsx` → `<ProjectForm />` | ✅ Done | Already passed at `ProjectNew.tsx:353-354` |
| Remove old "Switch to form" toggle button | ⚠️ Low priority | Cosmetic only |

---

### Phase 10B — Sales Premium & Yield Predictor
**Commit:** `e06022c` ✅ Fully committed

| Task | Status | Notes |
|------|--------|-------|
| `server/engines/value-add-engine.ts` — ROI bridge formulas | ✅ Done | 312 lines |
| `server/routers/salesPremium.ts` — `getValueAddBridge` + `getBrandEquityForecast` | ✅ Done | |
| InvestorSummary Section F — dual yield sliders | ✅ Done | `client/src/pages/InvestorSummary.tsx` |

---

### MIYAR 2.0 — Phases 1–9
**Status:** ✅ All complete. See `.agent/rules/miyar-memory.md` for full phase history.

---

## 📋 Agent File Update Log

> Every session should append a line here when files are updated.

| Date | Session Task | Files Updated |
|------|-------------|---------------|
| 2026-03-04 | MIYAR 3.0 versioning + MQI design | `GEMINI.md`, `miyar-memory.md`, `coding-conventions.md`, `run-tests.md`, `db-migrate.md`, created `miyar-materials/SKILL.md`, `miyar3-phase-a-build.md`, `miyar3-phase-a-mqi.md` (prompt), `PROGRESS.md` (this file), `.agent/rules/update-protocol.md` |
| 2026-03-04 | Phase A build (MQI engine + visual gen) | `material-quantity-engine.ts`, `space-program.ts`, `v30-mqi.test.ts`, `visual-gen.ts`, `nano-banana-client.ts`, `design.ts`, `intake.ts`, `materialQuantity.ts`, `MaterialAllocationPanel.tsx`, `ProjectDetail.tsx`, `schema.ts`, `db.ts`, `routers.ts`, `seed-materials.ts` |
| 2026-03-04 | Phase A closure — fixes + audit | `material-quantity-engine.ts` (budget fix), `space-program.ts` (budget fix), `v30-mqi.test.ts` (test update), `visual-gen.ts` (allocationClause), `nano-banana-client.ts` (allocationClause), `design.ts` (MQI fetch), `intake.ts` (DynamicConnector), `PROGRESS.md`, `miyar-memory.md`, `GEMINI.md` |
| 2026-03-04 | Phase B build + verification | `typology-fitout-rules.ts`, `amenity-taxonomy.ts`, `dwg-parser.ts`, `space-program-extractor.ts`, `spaceProgram.ts`, `SpaceProgramEditor.tsx`, `v31-space-program.test.ts`, `schema.ts`, `db.ts`, `routers.ts`, `materialQuantity.ts`, `ProjectDetail.tsx`, `PROGRESS.md`, `miyar-memory.md`, `GEMINI.md`, `coding-conventions.md`, `run-tests.md`, `db-migrate.md` |
| 2026-03-04 | Post-Phase-B bug fixes — commit `55c65ea` | `material-quantity-engine.ts` (Gemini union type fix: `["number","null"]` → `"number"`), `spaceProgram.ts` (Reset Defaults duplicate room fix — filter overridden roomCodes before inserting defaults), `PROGRESS.md` |
| 2026-03-04 | Post-Phase-B gap fixes — commit `b327204` | `typology-fitout-rules.ts` (added mixed-use 8-room template: lobby/retail/residential/F&B/amenities/corridors/parking/utility), `SpaceProgramEditor.tsx` (added block builder form for mixed-use empty state — 3 default blocks, GFA% → absolute sqm, passed to mutation), `PROGRESS.md`, `GEMINI.md`, `miyar-memory.md` |

---

## 🔢 System Stats Snapshot

| Metric | Value | As Of |
|--------|-------|-------|
| DB Tables | 87 | Phase B |
| Tests | 800 passing (830 total, 8 pre-existing fail, 22 skip) | Phase B |
| Server Routers | 24 (added `spaceProgram`) | Phase B |
| Engine Modules | 80+ | Phase B |
| tRPC Endpoints | 144+ (added 8 Space Program endpoints) | Phase B |
| DLD Records | 578K+ | Phase B |

> Update these numbers after each phase in this file AND in `miyar-memory.md`.
