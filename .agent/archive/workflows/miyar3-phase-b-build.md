---
description: Build workflow for MIYAR 3.0 Phase B — Typology-Aware Space Program Intelligence
---

# MIYAR 3.0 Phase B — Build Order

## Pre-Flight Checklist
- [ ] Read `GEMINI.md`, `miyar-memory.md`, `PROGRESS.md`
- [ ] Read `.agent/skills/miyar-materials/SKILL.md`
- [ ] Read `.agent/prompts/miyar3-phase-b-space-program.md` (full spec)
- [ ] Confirm on branch `miyar-3.0`
- [ ] Run `pnpm test` — confirm baseline is 770 pass / 800 total before starting

## Build Order (must follow — dependencies are real)

### Step 1: DB Schema
- Add `space_program_rooms` table to `drizzle/schema.ts`
- Add `amenity_sub_spaces` table to `drizzle/schema.ts`
- Both must use `mysqlTable` (never pgTable)
- Run `pnpm db:push` → confirm 87 tables

### Step 2: Pure Logic Engines (no dependencies)
- 2a: `server/engines/design/typology-fitout-rules.ts` — deterministic matrix
- 2b: `server/engines/design/amenity-taxonomy.ts` — fixed constants + `validateTaxonomy()`
- These have ZERO dependencies — pure TypeScript exports

### Step 3: DWG/DXF Parser
- Install `dxf-parser` if not present: `npm install dxf-parser @types/dxf-parser`
- Create `server/engines/intake/dwg-parser.ts`
- Depends on: `invokeLLM` (for vision fallback only)

### Step 4: Space Program Extractor
- Create `server/engines/design/space-program-extractor.ts`
- Depends on: Steps 2a, 2b, 3, and existing `buildSpaceProgram()`

### Step 5: DB Functions
- Add 7 new functions to `server/db.ts`
- Depends on: Step 1 (tables must exist in schema)

### Step 6: Router
- Create `server/routers/spaceProgram.ts`
- Register in `server/routers/routers.ts`
- Depends on: Steps 4 + 5

### Step 7: Update materialQuantity.ts
- Add stored-rooms-first logic to the `generate` procedure
- BACKWARD COMPATIBLE: falls back to `buildSpaceProgram()` if no stored program
- Depends on: Step 5 (db.getSpaceProgramRooms)

### Step 8: Seed Script
- Create `drizzle/seed-amenity-taxonomy.ts`
- Run it: `npx tsx -r dotenv/config drizzle/seed-amenity-taxonomy.ts`
- Verify ~45 rows inserted in `amenity_sub_spaces`

### Step 9: Frontend
- Create `client/src/components/SpaceProgramEditor.tsx`
  - shadcn Accordion for amenity expansion
  - Block tabs for mixed-use
  - Fit-out toggle (green/gray chip)
  - File upload trigger
- Add "Space Program" tab to `ProjectDetail.tsx` (BEFORE "Material Cost" tab)
- Empty state with two CTA buttons

### Step 10: Tests
- Create `server/engines/v31-space-program.test.ts`
- Must cover: typology rules (8 assertions), amenity taxonomy validation, sqm totals
- Run full suite: `pnpm test` — target 785+ passing

### Step 11: Type Check + Commit
- `pnpm check` → zero errors
- Update `PROGRESS.md` + `miyar-memory.md` + `GEMINI.md`
- Commit: `feat: MIYAR 3.0 Phase B — Typology-Aware Space Program Intelligence`

## Key Constraints
- NEVER modify `calculateProjectScore()` — scoring engine is untouched by Phase B
- NEVER remove the `buildSpaceProgram()` fallback from `materialQuantity.generate` — backward compat is mandatory
- `fitOutOverridden = true` rooms must survive `resetToTypologyDefaults` calls
- All sub-space sqmRatios per amenity type must sum to exactly 1.0 — enforce in `validateTaxonomy()`
