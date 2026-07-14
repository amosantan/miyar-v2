# MIYAR V4 Phase Reality Report — Evidence & Predictive Intelligence

**Date:** 2026-02-21  
**Phase:** V4 (V4-01 through V4-15)  
**Status:** Complete  
**Test Suite:** 476 tests passing, 0 TypeScript errors  
**Database:** 48 tables, 16 migrations applied  

---

## 1. What Was Built

### V4-01 — Evidence Vault Schema
- `evidence_records` table with 20+ columns: title, category, geography, priceMin/priceTypical/priceMax, unit, reliabilityGrade, confidenceScore, captureDate, sourceUrl, extractedFrom, methodology, notes
- `evidence_references` table linking evidence to scenarios, decision notes, explainability drivers, and pack sections
- Full CRUD endpoints: `evidence.create`, `evidence.list`, `evidence.getById`, `evidence.update`, `evidence.delete`

### V4-02 — Evidence Vault UI
- Evidence Vault page with filterable table, category/geography/reliability filters
- Add/Edit evidence dialog with full field validation
- Evidence detail view with all metadata fields
- Bulk import capability

### V4-03 — Evidence References System
- `evidence_references` join table supporting 5 entity link types (scenario, decision_note, explainability_driver, pack_section, board)
- `addEvidenceReference` / `removeEvidenceReference` / `getEvidenceReferences` endpoints
- Bidirectional linking: view which evidence supports which entities

### V4-04 — Executive Decision Pack with Evidence Annexes
- `renderEvidenceReferences()` function generating inline citations in all 3 report types
- `renderDisclaimer()` function adding "concept only — subject to detailed design" disclaimers
- Reproducibility block with logic_version_id, benchmark_version_id, timestamp
- Procurement constraints annex in RFQ Pack

### V4-05 — Visual Studio with AI Image Generation
- `generated_visuals` table with prompt_json (immutable), scenario_id, board_id, createdBy, status, image_url
- Prompt template system resolved from project/scenario context
- Visual Studio UI page with generate, view history, and attach-to-pack workflows
- Integration with platform image generation API

### V4-06 — Material Board Composer V2
- Added `sortOrder`, `specNotes`, `costBandOverride` columns to `materials_to_boards` join table
- `updateBoardTile` endpoint for inline editing of notes, cost band, and sort order
- `reorderBoardTiles` endpoint for drag-to-reorder
- Board PDF export engine (`board-pdf.ts`) generating A4 landscape HTML with tile grid, cost summary, RFQ lines
- `exportBoardPdf` tRPC endpoint uploading to S3
- `renderBoardAnnex()` function added to all 3 report types (Design Brief, RFQ Pack, Full Report)
- Enhanced BoardComposer UI with inline tile editing, reorder controls, spec notes, cost bands, PDF export button

### V4-07 — Housekeeping & Source Toggle
- Closed 12 legacy open items from V2/V3 audit
- Wired `isActive` toggle for source connectors via `updateSource` endpoint
- SourceCard component with Heart/HeartOff toggle icons in Ingestion Monitor
- Final open item count = 0 for pre-V4-08 items

### V4-08 — Cost Range Prediction Engine
- `predictCostRange()` function computing P15/P50/P85/P95 percentiles from evidence data points
- Weighted percentile computation: Grade A sources get 3x weight, Grade B 2x, Grade C 1x
- Recency bonus: data within 6 months gets 1.5x weight
- Trend adjustment: applies category-specific trend percentage to shift percentiles
- UAE-wide fallback: when local data < 3 points, falls back to all UAE evidence
- Confidence rules: high (≥15 points + ≥2 Grade A), medium (8-14), low (3-7), insufficient (<3)
- `predictive.getCostRange` tRPC endpoint

### V4-09 — Design Outcome Prediction Engine
- `predictOutcome()` function with comparability filtering (typology → tier → geography relaxation)
- Deterministic success likelihood formula: `baseLikelihood = (composite/100) * 60 + 20`, `comparableBonus = (validatedRate - 50) * 0.2`
- Key risk/success factor extraction from variable contributions (top 5 each, sorted by magnitude)
- Confidence levels: high (≥10 comparables + ≥10 contributions), medium (≥5), low (≥1), insufficient (0)
- `predictive.getOutcomePrediction` tRPC endpoint

### V4-10 — Scenario Cost Projection Engine
- `projectScenarioCost()` function with compounding formula: `projectedCost = baseCost × (1 + monthlyRate)^months × marketFactor`
- Monthly rate conversion: `monthlyRate = (1 + annualRate)^(1/12) - 1`
- Market condition factors: tight (1.05), balanced (1.00), soft (0.95)
- Three scenarios: low (0.9x base), mid (1.0x), high (1.15x)
- Projections at milestones: months 3, 6, 12, and user-defined horizon
- Horizon capped at 120 months, defaults to 18
- `predictive.getScenarioProjection` tRPC endpoint

### V4-11 — Budget Feasibility Score
- `budgetFitMethod` column added to `score_matrices` table (migration 0016)
- `project.evaluate` mutation now checks evidence count: ≥20 records → "evidence_backed", otherwise "benchmark_static"
- Evidence-backed scoring uses P50 from predictCostRange instead of static benchmark

### V4-12 — Predictive Intelligence Panel
- New "Predictive" tab on Project Detail page
- Cost Range Forecast card: gradient bar with P15/P50/P85/P95 markers, trend adjustment indicator
- Outcome Prediction card: SVG circle gauge (0-100%), risk/success factor lists, comparable count
- Cost-Over-Time Projection chart: 3-line projection (low/mid/high) with summary table
- All cards have empty states for insufficient data
- Market condition selector (tight/balanced/soft) and horizon slider

### V4-13 — Cost Forecasting Panel on Analytics Dashboard
- New "Cost Forecasting" tab on Analytics Intelligence page
- UAE-wide cost range table by 9 categories (floors, walls, ceilings, joinery, lighting, sanitary, kitchen, hardware, ffe)
- P15/P50/P85/P95 columns with confidence badges
- 6-month trend-adjusted outlook computed from monthly compounding rate
- `predictive.getUaeCostRanges` tRPC endpoint

### V4-14 — Comprehensive Test Suite
- 65 new predictive engine tests covering:
  - Cost range: percentile computation, confidence rules, trend adjustment, UAE fallback, category/geography filtering
  - Outcome prediction: success likelihood formula, comparability filtering, risk/success factors, confidence levels, rate computation
  - Scenario projection: compounding formula, market factors, three scenarios, monthly rate conversion
  - Edge cases: empty vault, zero outcomes, zero trends, large GFA, division by zero, negative prices, extreme trends, horizon bounds

### V4-15 — Phase Reality Report
- This document
- 476 tests passing (target: ≥420)
- 0 TypeScript errors
- 48 database tables confirmed

---

## 2. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Pure functions for all predictive engines | Enables deterministic testing without database mocking; engines accept data arrays and return typed results |
| Weighted percentile computation | Grade A sources (government, institutional) are more reliable than Grade C (user-submitted); recency bonus prevents stale data from dominating |
| Three-tier fallback for comparability | Exact match (typology+tier+geography) → relax geography → relax tier → use all; ensures predictions even with sparse data |
| Compounding formula for projections | `(1 + monthlyRate)^months` is financially standard and produces realistic cost curves; market factor is multiplicative |
| budgetFitMethod as column, not computed | Stored at evaluation time so historical evaluations preserve their method; avoids retroactive reclassification |
| Board PDF as HTML-to-S3 | Same pattern as existing report generation; A4 landscape with CSS print styles; no server-side PDF binary dependency |

---

## 3. Database Schema (V4 Additions)

| Table | Purpose | Migration |
|-------|---------|-----------|
| `evidence_records` | Cost/market evidence with reliability grading | 0012 |
| `evidence_references` | Links evidence to entities (scenarios, packs, boards) | 0013 |
| `generated_visuals` | AI-generated images with prompt history | 0014 |
| `materials_to_boards` (updated) | Added sortOrder, specNotes, costBandOverride | 0015 |
| `score_matrices` (updated) | Added budgetFitMethod column | 0016 |

**Total tables:** 48

---

## 4. Test Coverage

| Test File | Tests | Focus |
|-----------|-------|-------|
| `predictive.test.ts` | 65 | V4-08/09/10/11/14 predictive engines + edge cases |
| `board-pdf.test.ts` | 26 | V4-06 board composer, PDF generation, report annexes |
| `v4-explainability.test.ts` | 30 | V4-01/02/03/04 evidence vault, references, citations |
| `v3-analytics.test.ts` | 35 | V3 analytics, trends, competitors |
| `v2-connectors.test.ts` | 5 | V2 connector extraction |
| Other test files | 315 | V1/V2/V3 scoring, resilience, benchmarks, credibility |
| **Total** | **476** | |

---

## 5. API Surface (V4 New Endpoints)

| Endpoint | Type | Auth | Purpose |
|----------|------|------|---------|
| `evidence.create` | mutation | protected | Create evidence record |
| `evidence.list` | query | protected | List/filter evidence records |
| `evidence.getById` | query | protected | Get single evidence record |
| `evidence.update` | mutation | protected | Update evidence record |
| `evidence.delete` | mutation | protected | Delete evidence record |
| `evidence.addReference` | mutation | protected | Link evidence to entity |
| `evidence.removeReference` | mutation | protected | Unlink evidence from entity |
| `evidence.getReferences` | query | protected | Get references for entity |
| `design.updateBoardTile` | mutation | protected | Edit tile notes/cost band/order |
| `design.reorderBoardTiles` | mutation | protected | Reorder board tiles |
| `design.exportBoardPdf` | mutation | protected | Generate board PDF → S3 |
| `predictive.getCostRange` | query | protected | Cost range prediction |
| `predictive.getOutcomePrediction` | query | protected | Outcome prediction |
| `predictive.getScenarioProjection` | query | protected | Scenario cost projection |
| `predictive.getUaeCostRanges` | query | protected | UAE-wide cost ranges |

---

## 6. Known Limitations & Future Work

| Item | Status | Notes |
|------|--------|-------|
| Predictive engines use in-memory computation | By design | No ML model training; deterministic formulas only |
| UAE-wide fallback pools all geographies | Acceptable | Could be refined with emirate-level weighting |
| Board PDF uses HTML/CSS, not binary PDF | By design | Consistent with existing report pattern; browser print produces PDF |
| Evidence reliability grading is manual | By design | Could be automated with source-type heuristics in future |
| Scenario comparison matrix UI | Placeholder | Side-by-side comparison table exists in Scenarios page; dedicated matrix deferred |
| Cost projection assumes constant trend | Simplification | Could model trend decay or acceleration in future |

---

## 7. Verification Checklist

- [x] 476 tests passing (`npx vitest run`)
- [x] 0 TypeScript errors (`npx tsc --noEmit`)
- [x] 48 database tables confirmed
- [x] All V4 todo items marked complete
- [x] Dev server running without errors
- [x] Dashboard screenshot captured and verified
- [x] All predictive engines are pure functions with no external dependencies
- [x] All new endpoints are protected (require authentication)
- [x] Board PDF export uploads to S3 and returns URL
- [x] Evidence references support all 5 entity link types
- [x] Home page updated with V4 version history
