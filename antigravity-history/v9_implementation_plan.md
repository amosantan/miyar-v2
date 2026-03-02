# MIYAR V9 Implementation Plan: Strategic Risk & Economic Modeling

## Goal Description
Implement the **Strategic Risk & Economic Modeling** layer as specified in Blueprints 17 and 35. This phase elevates MIYAR from a passive validation tool to an active financial quantification engine. It calculates tangible ROI (Cost Avoidance, Programme Acceleration) and executes macroeconomic stress tests using the `R = (P × I × V) / C` formula to measure project resilience.

## Proposed Changes

---
### Database Layer

#### [MODIFY] [schema.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/drizzle/schema.ts)
Add three new tables to store the outputs of the economic and risk engines:

1. **`projectRoiModels`** (Stores automated financial benefit calculations per project/scenario)
   - `id`: serial
   - `projectId`: int (fk)
   - `scenarioId`: int (fk, optional)
   - `reworkCostAvoided`: decimal (Financial value of error caught before construction)
   - `programmeAccelerationValue`: decimal (Financial value of days saved via rapid validation)
   - `totalValueCreated`: decimal (Sum of the above)
   - `netRoiPercent`: decimal (Value ratio vs service fee)
   - `confidenceMultiplier`: decimal (Adjustment based on project complexity)

2. **`scenarioStressTests`** (Stores results of macro-economic shock simulations)
   - `id`: serial
   - `scenarioId`: int (fk)
   - `stressCondition`: varchar (e.g., 'supply_chain_shock', 'inflation_spike', 'demand_collapse')
   - `impactMagnitudePercent`: decimal (e.g., +15% cost)
   - `resilienceScore`: int (1-100, How well this specific design scenario absorbs the shock)
   - `failurePoints`: json (Component layers that fail under stress)

3. **`riskSurfaceMaps`** (Consolidated risk taxonomy map per project)
   - `id`: serial
   - `projectId`: int (fk)
   - `domain`: varchar (e.g., 'Commercial', 'Operational', 'Technological')
   - `probability`: int (0-100)
   - `impact`: int (0-100)
   - `vulnerability`: int (0-100)
   - `controlStrength`: int (1-100, divisor)
   - `compositeRiskScore`: int (Calculated via `R = (P * I * V) / C`)
   - `riskBand`: varchar ('Minimal', 'Controlled', 'Elevated', 'Critical', 'Systemic')

---
### Engine Layer

#### [NEW] [roi-calculator.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/economic/roi-calculator.ts)
Calculates base Cost Avoidance (Probability × Cost × Scope) and Programme Acceleration (Days Saved × Carry Cost). Aggregates them into a standardized ROI response object.

#### [NEW] [stress-tester.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/risk/stress-tester.ts)
The simulation logic that takes a validated `designBrief` or `scoreMatrix` and artificially introduces external shocks (e.g., marking imported Italian marble up by 30% to see if the project budget survives).

#### [NEW] [risk-evaluator.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/risk/risk-evaluator.ts)
Implements the `R = (P × I × V) / C` equation. It maps inputs (tier, size, location) to generic probabilities and controls, returning the normalized composite risk score (1-100) and severity band.

---
### API Routing Layer

#### [MODIFY] [project.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/project.ts)
Add endpoints/mutations to expose the new engines to the client:
- `generateRoiModel`: Triggers the ROI calculator for a project.
- `runStressTest`: Executes a simulated shock on a given scenario.
- `calculateRiskSurface`: Updates the PxIxV map for the project.

## Verification Plan
1. **Automated Unit Tests (`server/engines/v9-economics.test.ts`):** 
   - Verify that the ROI addition logic calculates exact multi-decimal values correctly.
   - Verify that the Risk equation strictly caps out at exactly 100 on the normalized scale, regardless of extreme input multipliers.
2. **Backwards Compatibility:**
   - Execute the 628-test baseline suite to ensure adding the new schema engines does not break V4 Explainability or V6 Data Freshness layers.
3. **Database Types:**
   - Run `pnpm run db:push` / `pnpm run generate` locally to confirm Drizzle compiles the schema perfectly.
