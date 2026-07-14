## Phase 1: Planning and Research
- [x] Analyze `evidence_records` and `benchmark_proposals` to understand live market data flow.
- [x] Analyze `server/engines/design-brief.ts` BOQ cost generation logic.
- [x] Analyze `server/engines/design/rfq-generator.ts` material pricing logic.
- [x] Create `v4_cost_modeling_implementation_plan.md` outlining dynamic pricing engine.

## Phase 2: Building the Dynamic Pricing Engine
- [x] Create `server/engines/pricing-engine.ts`.
- [x] Implement `getLiveCategoryPricing(finishLevel: string)` to query approved `benchmark_proposals`.
- [x] Implement `syncMaterialsWithBenchmarks()` to bulk-update `materials.priceAedMin` and `priceAedMax` from approved benchmarks.

## Phase 3: Wiring Market Data to Output Briefs
- [x] Refactor `server/engines/design-brief.ts` to calculate `boq.coreAllocations` bottom-up using dynamic prices from `getLiveCategoryPricing`.
- [x] Ensure `budget.costPerSqmTarget` is derived from real dynamic prices rather than static mappings.

## Phase 4: Admin Endpoints and Testing
- [x] Add `syncMaterialPricing` TRPC endpoint in `server/routers/admin.ts`.
- [x] Add `previewLive` TRPC query in `server/routers/admin.ts`.
- [x] Wire `getLiveCategoryPricing` into `server/routers/design.ts` createDesignBrief mutation.
- [ ] Validate v28 tests pass with the new optional `livePricing` parameter.
- [ ] Commit and push changes.
