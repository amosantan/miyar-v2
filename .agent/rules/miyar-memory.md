# MIYAR 3.0 — Project Memory

## Versioning
- **MIYAR 2.0** = everything built through Phase 9 (scoring, market intelligence, design visualization)
- **MIYAR 3.0** = all new development from Phase 10A onwards. This is a fundamentally different product:
  - Developer-first: system conforms to developer's natural input, not rigid forms
  - Bottom-up costing: surface areas → material allocations → real cost (not top-down budget guesses)
  - Intelligent intake: developer uploads/speaks/chats → MIYAR fills the form
  - Material Quantity Intelligence: AI-suggested material splits per surface with live pricing

## What MIYAR 3.0 Is
MIYAR (مِعيار) is the UAE Design Decision Intelligence Platform — the Bloomberg terminal of design decisions for property developers.
It helps developers understand whether their design intent is financially viable, market-aligned, and buildable — before a single AED is committed.
It is NOT a property investment tool. It conforms to the developer, not the other way around.

## Phase History: MIYAR 2.0 Complete

| Phase | Name | Status |
|-------|------|--------|
| V1 | Core scoring engine | ✅ |
| V1.5 | Production readiness, bug fixes | ✅ |
| V2 | Live market ingestion engine (12 UAE connectors) | ✅ |
| V3 | Analytical intelligence (trend detection, market positioning, competitor intelligence) | ✅ |
| V4 | Predictive & cost modeling (Monte Carlo, evidence vault, outcome prediction) | ✅ |
| Phase 5 | Export & handover (PDF, DOCX, share links) | ✅ |
| Phase 6 | Deep analytics & scope refinement (7 strategic variables, compounding multipliers) | ✅ |
| Phase A | Evidence chain click-through, data freshness badges | ✅ |
| Phase B | DLD analytics engine (578K+ records), connector health dashboard | ✅ |
| Phase C | Data expansion (150+ benchmarks, SCAD scraper, synthetic generator) | ✅ |
| Phase D | Governance & compliance (Estidama/Al Sa'fat, audit logs, sustainability multipliers) | ✅ |
| Phase E | Portfolio benchmarking, RICS NRM alignment, mobile share views | ✅ |
| Phase 7 | Deep Analytics (trend detection, bias detection, digital twin) | ✅ |
| Phase 8 | Real-World Procurement & Material Intelligence (live supplier catalogs, vendor matching, carbon profiling) | ✅ |
| Phase 9 | AI Design Visualization (mood board generation, space planning & ratios, floor plan analysis) | ✅ |

## MIYAR 3.0 Roadmap

| Phase | Name | Status |
|-------|------|--------|
| **Phase 10A** | **Intelligent Project Intake** (multimodal: images/voice/URL/PDF → form auto-fill) | ⚠️ 95% done — 1 item uncommitted, needs commit |
| **Phase 10B** | **Sales Premium & Yield Predictor Engine** (value-add engine, yield sliders, brand equity) | ✅ DONE — committed `e06022c` |
| **MIYAR 3.0 Phase A** | **Material Quantity Intelligence (MQI)** — surface-area allocation, AI material splits, bottom-up costing, supplier price scraping, material-accurate renders | ✅ DONE — pending commit |

## Phase 10A — What to Build
*Goal: Replace rigid form-first project creation with a flexible multimodal intake. Developer uploads images, voice, PDFs, supplier URLs — MIYAR auto-fills the existing ProjectInputs form. Form stays as source of truth, scoring engine unchanged.*

### Three user paths:
1. **AI-Guided** — developer uploads assets + chats → MIYAR fills form → developer reviews
2. **Expert** — developer goes straight to 7-step wizard (unchanged), AI Assist button on every section
3. **Quick Brief** — voice note or text paragraph → MIYAR fills ~70% → developer completes rest

### New files to build:
- `server/engines/intake/vision-analyzer.ts` — Gemini Vision: images → style/tier/material extraction
- `server/engines/intake/document-analyzer.ts` — wraps existing floor-plan-analyzer + pdf-extraction
- `server/engines/intake/url-analyzer.ts` — wraps existing crawler → supplier/competitor URL analysis
- `server/engines/intake/voice-processor.ts` — audio → transcript → intent extraction (Arabic supported)
- `server/engines/intake/intent-mapper.ts` — THE CORE: all assets + chat → FormSuggestions with confidence
- `server/engines/intake/ai-assist.ts` — contextual help on specific form fields using DLD data
- `server/engines/intake/asset-manager.ts` — upload → S3 → analyze → store (wraps existing upload.ts)
- `server/routers/intake.ts` — 8 tRPC procedures: uploadAsset, addUrl, processVoice, chat, generateSuggestions, getFieldAssist, getProjectAssets, acceptSuggestions
- `client/src/components/IntakeCanvas.tsx` — drag-drop + chat + asset gallery + live form preview
- `client/src/components/AiAssistButton.tsx` — contextual AI help button for ProjectForm sections
- `client/src/components/AssetGallery.tsx` — persistent project asset gallery

### New DB tables:
- `project_assets` — all uploaded files, URLs, voice transcripts (permanent, project-linked)
- `intake_conversations` — chat/voice conversation history per project
- `intake_form_suggestions` — AI suggestions with confidence + reasoning per field

### Key existing files intake reuses (DO NOT rebuild):
- `server/_core/llm.ts` — `invokeLLM()` with image/audio/PDF support already built
- `server/upload.ts` — S3 presigned URL upload
- `server/engines/design/floor-plan-analyzer.ts` — floor plan analysis (Phase 9)
- `server/engines/pdf-extraction.ts` — PDF text extraction
- `server/engines/ingestion/crawler.ts` — HTTP scraping with retry/robots.txt
- `server/engines/dld-analytics.ts` — market data for AI Assist field context

### Full spec: `PHASE_10A_INTELLIGENT_INTAKE_SPEC.md` in project root

## Phase 10B — What to Build (after 10A)
*Goal: Prove to developers that investing in higher quality design directly pays off in final sale or rental yield.*
1. **Value-Add Calculation Engine** — Dynamic ROI bridges: "invest +500 AED/sqm into Fully Furnished → rental yield 6.5% → 8.2%"
2. **DLD Live Cross-Reference** — Link MIYAR design score against live neighborhood transaction data
3. **Brand-Equity Forecasting** — Trophy Asset halo-effect: mathematically justify elastic budgets

### Key existing assets for Phase 10B:
- `server/engines/dld-analytics.ts` — `computeYield()`, `computeMarketPosition()`, `getAreaSaleMedianSqm()` all exist
- `shared/miyar-types.ts` — `ValueAddInputs`, `ValueAddResult`, `BrandEquityInputs`, `BrandEquityResult` types already defined
- 578K+ DLD records in DB

### What's missing for 10B:
- `server/engines/value-add-engine.ts` — core formula (fitout investment delta → yield uplift curve)
- `server/routers/salesPremium.ts` — `getValueAddBridge`, `getBrandEquityForecast` endpoints
- Frontend panel on InvestorSummary with live sliders

## 5 Scoring Dimensions (NEVER change these weights without Logic Registry)
- SA: Strategic Alignment (str01, str02, str03)
- FF: Financial Feasibility (fin01, fin02, fin03, fin04)
- MP: Market Positioning (mkt01, mkt02, mkt03)
- DS: Differentiation Strength (des01–des05)
- ER: Execution Risk (exe01–exe04)

## Decision Thresholds
- validated: composite ≥ 75 AND risk ≤ 45
- not_validated: composite < 60 OR risk ≥ 60
- conditional: everything between

## Phase 10A — Status (MIYAR 3.0 first phase)
*Goal: Multimodal intake. Developer uploads images/voice/PDFs/supplier URLs → MIYAR fills ProjectInputs form automatically.*

### Completed (uncommitted — March 4 2026):
- ✅ GAP 1: `scrapeUrl` tRPC procedure + `handleAddUrl` updated with Fetching indicator
- ✅ GAP 2: Three-card path selector (AI-Guided / Expert / Quick Brief) on project creation
- ✅ GAP 3: Conversational chat panel in intake canvas + `chat` tRPC procedure
- ✅ GAP 4: `fieldConfidence` + `fieldReasoning` props on ProjectForm, colored dot indicators on critical fields
- ✅ GAP 5: Assets tab on ProjectDetail with grid + modal showing AI extraction results
- ⚠️ ONE ITEM REMAINING: Pass `fieldConfidence`/`fieldReasoning` from `ProjectNew.tsx` into `<ProjectForm />` (unchecked in task.md)
- ⚠️ SMALL: Remove old "Switch to form" toggle button (cosmetic, low priority)

### Key files (already built):
- `server/engines/intake/ai-intake-engine.ts` (719 lines) — multimodal Gemini engine
- `server/routers/intake.ts` — scrapeUrl, chat, recordAsset, processAssets, listAssets, suggestSection
- `client/src/pages/ProjectNew.tsx` — full intake canvas with 3-card selector, chat, voice, drag-drop
- `client/src/components/ProjectForm.tsx` — AiSectionAssist + fieldConfidence indicators
- `client/src/pages/ProjectDetail.tsx` — Assets tab added

## Phase 10B — What to Build (after 10A commit)
*Goal: Prove to developers that investing in higher quality design directly pays off in final sale or rental yield.*
1. **Value-Add Calculation Engine** — Dynamic ROI bridges: "invest +500 AED/sqm into Fully Furnished → rental yield 6.5% → 8.2%"
2. **DLD Live Cross-Reference** — Link MIYAR design score against live neighborhood transaction data
3. **Brand-Equity Forecasting** — Trophy Asset halo-effect: mathematically justify elastic budgets

### Key existing assets for Phase 10B:
- `server/engines/dld-analytics.ts` — `computeYield()`, `computeMarketPosition()`, `getAreaSaleMedianSqm()` all exist
- `shared/miyar-types.ts` — `ValueAddInputs`, `ValueAddResult`, `BrandEquityInputs`, `BrandEquityResult` types already defined
- 578K+ DLD records in DB

### What's missing for 10B:
- `server/engines/value-add-engine.ts` — core formula (fitout investment delta → yield uplift curve)
- `server/routers/salesPremium.ts` — `getValueAddBridge`, `getBrandEquityForecast` endpoints
- Frontend panel on InvestorSummary with live sliders

## Phase 10C — Material Quantity Intelligence (MIYAR 3.0 flagship feature)
*Goal: Bottom-up cost intelligence. Surface areas × AI-suggested material splits × live supplier prices = real finish cost. Developer sees exactly whether their material spec can be achieved within budget.*

### Core concept:
- `buildSpaceProgram()` gives rooms with sqm → Phase 10C calculates floor m², wall m², ceiling m² per room
- AI (Gemini) suggests material allocation per surface: "Living floor: 65% marble / 35% timber"
- Each allocation × surface area × unit price (from materialLibrary) = actual cost
- Total finish cost vs. developer's budgetCap = real budget gap or surplus
- Visual: Material Cost Breakdown tab on ProjectDetail with bar-chart splits + AED totals
- Renders: mood boards and room renders updated to show allocation percentages (60% marble floor with 40% timber inlay)

### What already exists (DO NOT rebuild):
- `buildSpaceProgram()` in `server/engines/design/space-program.ts` — rooms with sqm, finishGrade
- `buildFinishSchedule()` in `server/engines/design/finish-schedule.ts` — single material per element (EXTEND, don't replace)
- `material_library` table — priceAedMin/Max per category/tier/style/brand (PRIMARY pricing source)
- `materials_catalog` table — FF&E with typicalCostLow/High
- `material_constants` table — costPerM2 by material type
- `buildBoardAwarePromptContext()` in `visual-gen.ts` — injects material names into image prompts (EXTEND with allocation %)
- `nano-banana-client.ts` — per-room mood board + render prompts (EXTEND with allocation clause)
- `DynamicConnector` + `runSingleConnector` + `cleanHtmlForLLM()` in ingestion — full 6-provider scraping chain (USE for supplier price scraping)
- `market-intelligence` router — `scrapeNow` + `addSource` procedures (EXTEND for material sources)
- `projectAssets` / `boardMaterialsCost` field in ProjectInputs — already exists

### What's missing (build this):
- `server/engines/design/material-quantity-engine.ts` — NEW core engine:
  - `calculateSurfaceAreas(rooms)` → floor/wall/ceiling m² per room (deterministic math)
  - `generateMaterialAllocations(project, rooms, materialLibrary)` → Gemini-suggested splits
  - `buildQuantityCostSummary(allocations, materialLibrary)` → total cost per material + overall
- `server/routers/materialQuantity.ts` — NEW router: generate, update (manual edits), lock, getForProject
- `client/src/components/MaterialAllocationPanel.tsx` — NEW UI: bar charts per surface, AED totals, budget gap/surplus indicator, "Edit Splits" + "Re-run AI" + "Export BOQ" actions
- `drizzle/schema.ts` additions:
  - `material_allocations` mysqlTable — per room/element/material with allocationPct, surfaceAreaM2, unitCostMin/Max, totalCostMin/Max, aiReasoning, isLocked
  - `material_supplier_sources` mysqlTable — supplier URLs with category/tier for automated price scraping
- ProjectDetail: "Material Cost" tab (add AFTER the Assets tab already added in Phase 10A)

### Critical wiring:
- `buildBoardAwarePromptContext()` receives `MaterialQuantityResult` → new `buildMaterialAllocationPromptClause()` helper converts splits to natural language ("65% Calacatta marble floor with 35% oak timber border inlay")
- `boardMaterialsCost` field in ProjectInputs (already exists!) receives `totalFinishCostMid` from MQI result → scoring engine reads it automatically (no scoring changes needed)
- `scrapeUrl` in intake.ts should be upgraded from `fetchBasic()` to `DynamicConnector` (full 6-provider chain) for better supplier site reliability

### Scraping pipeline note (after March 2 overhaul):
The `cleanHtmlForLLM()` function + 6-provider fallback is NOW working properly. Use `DynamicConnector` + `runSingleConnector` for material supplier scraping. Do NOT write new scrapers. Firecrawl credits exhausted — ScrapingAnt is primary provider.

## 5 Scoring Dimensions (NEVER change these weights without Logic Registry)
- SA: Strategic Alignment (str01, str02, str03)
- FF: Financial Feasibility (fin01, fin02, fin03, fin04)
- MP: Market Positioning (mkt01, mkt02, mkt03)
- DS: Differentiation Strength (des01–des05)
- ER: Execution Risk (exe01–exe04)

## Decision Thresholds
- validated: composite ≥ 75 AND risk ≤ 45
- not_validated: composite < 60 OR risk ≥ 60
- conditional: everything between

## Immutable Rules
1. NEVER modify `shared/miyar-types.ts → ProjectInputs` without updating scoring engine
2. NEVER use AI (Gemini) for scoring, weights, or numerical calculations — LLM is for narrative, extraction, and suggestion ONLY
3. NEVER auto-fill `fin01BudgetCap`, `ctx03Gfa`, or `city` without explicit developer input
4. All tRPC procedures must use `orgProcedure` — never `publicProcedure`
5. All scoring is deterministic — `calculateProjectScore()` must never call any LLM

## System Stats (as of Phase A — MIYAR 3.0)
- Database: 85 tables, TiDB (mysql2), Drizzle ORM
- Tech Stack: React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + AWS S3 + Vercel + Gemini 2.5 Flash
- Tests: 770 passing / 800 total (8 pre-existing fail, 22 skip) (vitest)
- Server routers: 23 (added `materialQuantity`)
- Engine modules: 78+
- Client pages: 32+
- tRPC endpoints: 136+ (added 6 MQI endpoints)
- DLD records ingested: 578K+
- Compliance checks: 38 (20 Estidama + 18 Al Sa'fat)
- GitHub: https://github.com/amosantan/miyar-v2
