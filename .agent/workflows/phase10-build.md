# Workflow: /phase10-build — Sales Premium & Yield Predictor Engine

**Trigger:** When starting or resuming Phase 10 development.

---

## Pre-flight Checklist

Before writing any code:
- [ ] Read `.agent/rules/miyar-memory.md` — confirm Phase 9 is complete, Phase 10 is next
- [ ] Read `.agent/skills/miyar-sales-premium/SKILL.md` — domain knowledge for this phase
- [ ] Run `pnpm vitest run` — confirm 476+ tests passing, 0 failures
- [ ] Run `pnpm check` (tsc --noEmit) — confirm 0 TypeScript errors
- [ ] Review `server/engines/dld-analytics.ts` — understand `computeYield()`, `computeMarketPosition()`, `computeFitoutCalibration()` before building the new engine

---

## Build Sequence

### Step 1 — Value-Add Engine (server)
**File:** `server/engines/value-add-engine.ts` (NEW)

Build a pure function engine (no DB calls — accept data arrays, return typed results):

```typescript
computeValueAddBridge(inputs: ValueAddInputs): ValueAddResult
// inputs: currentFitoutPerSqm, proposedFitoutPerSqm, handoverCondition, tier, areaStats (from DLD)
// outputs: yieldDelta (%), salePricePremium (AED), paybackMonths, confidenceLevel

computeBrandEquityForecast(inputs: BrandEquityInputs): BrandEquityResult
// inputs: tier, targetValueAdd, portfolioProjectCount, currentAvgScore
// outputs: haloUpliftPct, estimatedPortfolioValueAdd (AED), narrative
```

Write unit tests in `server/engines/v10-sales-premium.test.ts` covering:
- Positive yield delta when fitout increases from Mid to Premium range
- Zero delta at OVER_SPEC threshold (fitout already above market max)
- Trophy tier brand equity multiplier is higher than Luxury
- Edge cases: zero area stats, negative delta, extreme GFA

---

### Step 2 — tRPC Router (server)
**File:** `server/routers/salesPremium.ts` (NEW)

```typescript
salesPremium.getValueAddBridge  // query, protected
salesPremium.getBrandEquityForecast  // query, protected
```

Register in `server/routers.ts`:
```typescript
import { salesPremiumRouter } from "./routers/salesPremium";
// add to appRouter: salesPremium: salesPremiumRouter
```

---

### Step 3 — Frontend Panel (client)
**File:** `client/src/pages/InvestorSummary.tsx` — add new Section F

Add a "Sales Premium" panel with:
- Slider: current fitout AED/sqm (pre-populated from project data)
- Slider: proposed fitout AED/sqm (draggable — triggers live recalc)
- Output: yield delta %, sale price premium AED, payback period in months
- For Trophy/Ultra-luxury: brand equity halo panel showing portfolio uplift

Use `trpc.salesPremium.getValueAddBridge.useQuery()` — debounce slider at 300ms.

---

### Step 4 — Phase 10 Reality Report
**File:** `V10_PHASE_REALITY_REPORT.md` (root of project)

Must contain:
1. What was built
2. Algorithms implemented (formulas with variables)
3. New DB tables (if any)
4. New API endpoints
5. Test coverage (new tests + total baseline)
6. Known limitations
7. What Phase 11 needs from Phase 10

---

## Post-build Checklist

- [ ] `pnpm vitest run` — all 476+ tests pass + new Phase 10 tests added
- [ ] `pnpm check` — 0 TypeScript errors
- [ ] Dev server running without errors: `pnpm dev`
- [ ] InvestorSummary `/projects/:id/investor-summary` — slider interaction works
- [ ] Commit: `feat(phase10): Sales Premium & Yield Predictor Engine`
- [ ] Push to main, verify Vercel build passes
- [ ] Update `miyar-memory.md` — mark Phase 10 complete, set Phase 11 as NEXT

---

## Key Files Reference

| File | Role in Phase 10 |
|------|-----------------|
| `server/engines/dld-analytics.ts` | Source of `computeYield()`, `computeMarketPosition()` — reuse, do not duplicate |
| `server/engines/roi.ts` | Reference for engine pattern (pure functions, typed I/O) |
| `server/routers/economics.ts` | Reference for router pattern |
| `client/src/pages/InvestorSummary.tsx` | Where the Phase 10 panel is added |
| `shared/miyar-types.ts` | Add `ValueAddInputs`, `ValueAddResult`, `BrandEquityInputs`, `BrandEquityResult` types here |
