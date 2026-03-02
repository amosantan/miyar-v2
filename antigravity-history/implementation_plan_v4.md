# MIYAR V4 — The Fit-out Oracle: Implementation Plan

## Goal
Refactor MIYAR from GFA-based to fit-out-area-based pricing, with three architectural archetypes, optional PDF extraction, a developer verification gate, and recalibrated analytics.

---

## Phase A: Schema + Types + Area Utility (Foundation)

### [MODIFY] [schema.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/drizzle/schema.ts)
- Add `totalFitoutArea DECIMAL(12,2)` column to `projects` table
- Add `totalNonFinishArea DECIMAL(12,2)` column
- Add `fitoutAreaVerified BOOLEAN DEFAULT false` column
- Add `projectArchetype` enum: `residential_multi`, `office`, `single_villa`, `hospitality`, `community`
- Extend `status` enum: add `draft_area_verification` between `draft` and `ready`
- Add `pdf_extractions` table for Phase B

### [MODIFY] [miyar-types.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/shared/miyar-types.ts)
- Add `totalFitoutArea: number | null` to `ProjectInputs`
- Add `ProjectArchetype` type
- Add `fitoutRatio` to `NormalizedInputs`

### [NEW] [area-utils.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/area-utils.ts)
- `getPricingArea(inputs) => totalFitoutArea ?? ctx03Gfa ?? 0`
- `getStructuralArea(inputs) => ctx03Gfa ?? 0`
- `computeFitoutRatio(fitout, gfa) => fitout / gfa`
- `NON_FINISH_AREAS` classification constant

### [MODIFY] [project.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/project.ts)
- Extend `projectInputSchema` with `totalFitoutArea`, `totalNonFinishArea`, `projectArchetype`
- Add typed Zod schemas for `unitMix` and `villaSpaces`
- Update `projectToInputs()` to include `totalFitoutArea`
- Add `project.verifyAreas` mutation

---

## Phase B: Adaptive Project Creator UI

### [MODIFY] [ProjectNew.tsx](file:///Users/amrosaleh/Maiyar/miyar-v2/client/src/pages/ProjectNew.tsx)
- Map `ctx01Typology` to archetype (Residential/Mixed-use → `residential_multi`, Office → `office`, Villa → `single_villa`)
- Add conditional step: **Unit Mix Builder** (residential) or **Room List Builder** (villa) or **Shell & Core Toggle** (office)
- Auto-calculate `totalFitoutArea` from the archetype sub-form
- Add `totalFitoutArea` display in the Review step

---

## Phase C: Engine Migration (50+ callsites)

### [MODIFY] [normalization.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/normalization.ts)
- Update `deriveScaleBand()` to use `getPricingArea()` with recalibrated thresholds
- Add `fitoutRatio` derived variable to `normalizeInputs()`

### [MODIFY] [scoring.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/scoring.ts)
- Update `computeROI()`: replace `gfa = inputs.ctx03Gfa ?? 500000` with `getPricingArea(inputs)`

### [MODIFY] [design-brief.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/design-brief.ts)
- Update `generateDesignBrief()`: `gfa` calculation uses `getPricingArea(inputs)`
- Update `PricingAnalytics` JSDoc: `totalFitoutCostAed` = `costPerSqmAvg × fitoutArea`

### [MODIFY] [bias-detector.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/bias/bias-detector.ts)
- Replace `inputs.ctx03Gfa || 500` with `getPricingArea(inputs)`

### [MODIFY] [ai-design-advisor.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/design/ai-design-advisor.ts)
- Update AI prompts: show both `GFA` and `Fitout Area` where applicable

### [MODIFY] [explainability.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/explainability.ts)
- Add `totalFitoutArea` label, add to FF drivers list

### [MODIFY] [pdf-report.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/pdf-report.ts)
- Show both "GFA" and "Interior Fit-out Area" rows

### Routers (all use `getPricingArea()`)
- [design.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/design.ts) — `projectToInputs()`
- [design-advisor.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/design-advisor.ts)
- [portfolio.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/portfolio.ts)
- [scenario.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/scenario.ts)
- [predictive.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/predictive.ts)
- [seed.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/seed.ts)

### Tests (add `totalFitoutArea` to test inputs)
- 9 test files need `totalFitoutArea: null` added to their `ProjectInputs` fixtures

---

## Phase D: Developer Verification Gate (Deferred to after core migration)

### [NEW] `AreaVerification.tsx` — Area audit page
### PDF extraction engine — Gemini vision integration (Phase B of user's plan)

---

## Verification Plan

### Automated Tests
```bash
# Run existing test suite — all tests should pass with the new totalFitoutArea field
npm test

# Specific engine tests that verify GFA → fitout area migration
npx vitest run server/engines/scoring.test.ts
npx vitest run server/engines/v4-explainability.test.ts
npx vitest run server/engines/v15-bugfixes.test.ts
npx vitest run server/engines/credibility-fixes.test.ts
```

### TypeScript Compile Check
```bash
npx tsc --noEmit
```

### Manual Verification
1. Create a new project in the UI — verify the archetype-conditional fields appear
2. Check that `totalFitoutArea` is saved and displayed in the Review step
3. Run project evaluation — verify ROI uses fitout area (check via console logs)
4. Generate a design brief — verify pricing uses fitout area in the budget section
