# MIYAR Skill: Sales Premium & Yield Predictor (Phase 10)

**Domain:** Fitout investment → rental yield uplift → sale price premium → brand equity
**Phase:** 10
**Status:** Active build target

---

## What This Skill Covers

Phase 10 bridges the gap between *what a developer spends on interior design* and *what that investment returns in rental yield and sale price*. The core proposition: "Invest +500 AED/sqm into Fully Furnished finishes → your rental yield increases from 6.5% to 8.2% based on comparable DLD transactions."

---

## Domain Knowledge

### UAE Fitout-to-Yield Relationship (Key Market Facts)

| Handover Condition | Typical Rental Premium vs Shell & Core |
|-------------------|----------------------------------------|
| Shell & Core | Baseline (0%) |
| Category A (basic fit) | +5–10% rental premium |
| Category B (fully fitted) | +15–25% rental premium |
| Fully Furnished | +30–50% rental premium |

**Source:** Cavendish Maxwell, JLL UAE, DLD transaction data

### UAE Fitout-to-Sale Relationship

| Material Level vs Area Median | Sale Price Impact |
|-------------------------------|------------------|
| Under-spec (fitout < 10% of sale price) | −5 to −15% vs comparable |
| In-spec (10–18% of sale price) | Neutral / market rate |
| Premium spec (18–28% of sale price) | +5 to +12% vs comparable |
| Over-spec (>28% of sale price) | Diminishing returns; payback >7 years |

### Brand Equity / Trophy Asset Logic

For `targetValueAdd = "Brand Flagship / Trophy"` or `tier = "Ultra-luxury"`:
- A halo effect applies across the developer's portfolio when a flagship project performs well
- Industry rule of thumb: a trophy project that sells at 15%+ premium above area median lifts the developer's next project by 3–8% in perceived value
- Model this as: `haloUpliftPct = (salePerformancePct - 10) * 0.35` clamped at 8%

### Payback Period Formula

```
paybackMonths = (incrementalFitoutCost) / (annualRentalPremium / 12)

where:
  incrementalFitoutCost = (proposedFitoutPerSqm - currentFitoutPerSqm) * gfa
  annualRentalPremium = salePrice * (newGrossYield - currentGrossYield) / 100
```

---

## Existing Assets to Reuse (Do Not Rebuild)

### `server/engines/dld-analytics.ts`

```typescript
computeYield(salePrice, annualRent, operatingCostPct?)
// → { grossYield, netYield, operatingCost }

computeMarketPosition(fitoutCostPerSqm, salePricePerSqm, tier, areaP25?, areaP75?)
// → { score, label, percentile, fitoutRatio, riskFlag, riskMessage }

computeFitoutCalibration(stats: AreaPriceStats[])
// → { lowAedPerSqm, midAedPerSqm, highAedPerSqm } per area

getAreaSaleMedianSqm(areaId)
// → median AED/sqm for the DLD area (async, uses DB)
```

### `server/engines/roi.ts`

Reference for:
- Pure function pattern (no DB calls inside engine; pass data in as parameters)
- Conservative/mid/aggressive scenario output structure
- Driver-based breakdown pattern

### `shared/miyar-types.ts`

Add new types here (not in the engine file):
```typescript
export interface ValueAddInputs { ... }
export interface ValueAddResult { ... }
export interface BrandEquityInputs { ... }
export interface BrandEquityResult { ... }
```

---

## Engine Design Principles for Phase 10

1. **Pure functions only** — `value-add-engine.ts` must have zero DB imports. Accept data arrays, return typed results. DB calls belong in the tRPC router or a separate DB helper.

2. **Three scenarios** — always output conservative / mid / aggressive, consistent with existing ROI engine pattern. Users are presenting to boards — ranges are more defensible than point estimates.

3. **Confidence levels** — match the pattern from `predictive/cost-range.ts`:
   - `high`: ≥15 comparable DLD transactions in area
   - `medium`: 8–14 comparables
   - `low`: 3–7 comparables
   - `insufficient`: <3 comparables (show warning, do not show yield delta)

4. **No LLM in calculations** — yield delta, payback period, and sale premium are deterministic math. Gemini is only used if a narrative summary is requested (clearly labelled as AI-generated).

5. **AED everywhere** — all monetary outputs in AED, formatted with `fmtAed()` helper. Percentages to 1 decimal place.

---

## Test Patterns

```typescript
// value-add-engine.test.ts — required scenarios

describe('computeValueAddBridge', () => {
  it('returns positive yield delta when upgrading from Category A to Fully Furnished')
  it('returns zero delta when already at OVER_SPEC threshold')
  it('returns insufficient confidence when < 3 DLD comparables')
  it('payback period is finite and positive')
  it('handles zero GFA gracefully')
  it('handles missing area stats with Dubai average fallback')
})

describe('computeBrandEquityForecast', () => {
  it('Ultra-luxury tier returns higher haloUpliftPct than Luxury')
  it('haloUpliftPct is clamped at 8%')
  it('non-Trophy targetValueAdd returns zero halo effect')
})
```

---

## Router Pattern

```typescript
// server/routers/salesPremium.ts
import { router, orgProcedure } from "../_core/trpc";
import { computeValueAddBridge, computeBrandEquityForecast } from "../engines/value-add-engine";
import { getAreaSaleMedianSqm, computeYield } from "../engines/dld-analytics";

export const salesPremiumRouter = router({
  getValueAddBridge: orgProcedure
    .input(ValueAddInputsSchema)
    .query(async ({ input, ctx }) => {
      // 1. Fetch area DLD stats
      // 2. Call computeValueAddBridge(input, areaStats)
      // 3. Return result
    }),

  getBrandEquityForecast: orgProcedure
    .input(BrandEquityInputsSchema)
    .query(({ input }) => {
      return computeBrandEquityForecast(input);
    }),
});
```

Register in `server/routers.ts` and add to the `AppRouter` type.
