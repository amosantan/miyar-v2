# Phase 5 (V5): Self-Learning Platform Implementation Plan

The objective of V5 is to close the feedback loop. The platform will compare actual project outcomes against its initial predictions, extracting calibration signals to continuously improve the deterministic scoring engines and benchmarks.

## User Review Required
> [!IMPORTANT]
> **Schema Migrations**: 
> V5 introduces several new tables and modifies existing ones. Specifically:
> - **Updates to `project_outcomes`**: Adding fields like `actualFitoutCostPerSqm`, `reworkOccurred`, `clientSatisfactionScore`, etc.
> - **Updates to `benchmark_suggestions`**: Adding `calibrationSource` to track machine-proposed vs human-proposed suggestions.
> - **Updates to `logic_change_log`**: Adding a `status` field (`applied`, `proposed`, `rejected`) so the machine can propose weight changes.
> - **New tables**: `outcome_comparisons`, `accuracy_snapshots`, `decision_patterns`, `project_pattern_matches`.
> 
> *Are there any concerns about updating these production tables directly via `drizzle-kit push`, or should a specific migration process be followed?*

---

## Proposed Changes

### Priority 1: Outcome Feedback Loop
#### [NEW] [outcome-comparator.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/learning/outcome-comparator.ts)
- Implement `compareOutcomeToPrediction()` to generate comparison metrics (cost, score, risk accuracy).
#### [NEW] [accuracy-ledger.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/learning/accuracy-ledger.ts)
- Implement `computeAccuracyLedger()` to track platform performance over time.

### Priority 2: Benchmark Calibration Engine
#### [NEW] [benchmark-calibrator.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/learning/benchmark-calibrator.ts)
- Implement `proposeBenchmarkCalibrations()` to generate conservative (cap at ±20%, 50% dampening) benchmark adjustment proposals based on outcome data.
#### [NEW] [weight-analyser.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/learning/weight-analyser.ts)
- Implement `analyseWeightSensitivity()` using point-biserial correlation to propose weight adjustments in the Logic Registry.

### Priority 3: Self-Learning Feedback UI
#### [MODIFY] [project_outcomes schema](file:///Users/amrosaleh/Maiyar/miyar-v2/drizzle/schema.ts)
- Add required actuals tracking columns.
#### [NEW] [Learning Dashboard](file:///Users/amrosaleh/Maiyar/miyar-v2/client/src/pages/admin/LearningDashboard.tsx)
- Build the UI to display the Accuracy Timeline, Prediction Performance Table, and Pending Proposals.

### Priority 4: Pattern Library
#### [NEW] [pattern-extractor.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/learning/pattern-extractor.ts)
- Implement `extractPatterns()` with 5 initial deterministic seed patterns (e.g., High Complexity + Low Execution -> Risk Indicator).
- Add new `decision_patterns` and `project_pattern_matches` tables to track these.

### Priority 5: Resilience & Hardening
- Strengthen all functions to handle empty datasets seamlessly.
- Reach minimum 570 passing unit/integration tests with 0 TypeScript errors.

## Verification Plan
1. **Automated Tests**: Comprehensive unit tests covering the exact maths for accuracy calculations, weight sensitivities (sum = 1.0), and calibration factors (dampening & capping).
2. **Integration Test**: An end-to-end outcome entry -> comparison -> proposal generation flow.
3. **Database Audit**: Verify exactly 52 active tables post-migration.
