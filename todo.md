# MIYAR Platform TODO

## Phase 1: Database Schema & Migrations
- [x] Projects table with all 25+ input variables
- [x] Direction candidates table
- [x] Score matrices table
- [x] Scenarios table
- [x] Model versions table
- [x] Benchmark data table
- [x] Report instances table
- [x] Audit logs table
- [x] Override records table
- [x] Seed default model version (v1.0.0)
- [x] Seed benchmark data (UAE/Dubai synthetic)

## Phase 2: Backend - tRPC Routers & Skill Engines
- [x] Project CRUD router (create, list, get, update, delete)
- [x] Project validation trigger (POST validate)
- [x] Direction candidates router
- [x] Scenarios router with simulation
- [x] Scores router with explainability
- [x] Reports router
- [x] Overrides router
- [x] Admin: benchmarks CRUD
- [x] Admin: model versions CRUD + activate
- [x] Admin: audit logs listing
- [x] Skill Engine 1: Interior Direction Validation
- [x] Skill Engine 2: Budget Compatibility
- [x] Skill Engine 3: Market Positioning Scoring
- [x] Skill Engine 4: ROI Impact Estimation
- [x] Skill Engine 5: Scenario Simulation
- [x] Skill Engine 6: Decision Confidence Index
- [x] Normalization service (ordinal, numeric, derived)
- [x] Penalty system service
- [x] DB helper functions for all tables

## Phase 3: Frontend - Theme, Layout, Project Intake
- [x] Dark theme with MIYAR brand colors (deep navy/teal/gold)
- [x] DashboardLayout with sidebar navigation
- [x] Landing/Home page with login CTA
- [x] Guided project intake wizard (multi-step form)
  - [x] Step 1: Context variables (typology, scale, GFA, location, horizon)
  - [x] Step 2: Strategy variables (brand clarity, differentiation, buyer maturity)
  - [x] Step 3: Market variables (tier, competitor intensity, trend sensitivity)
  - [x] Step 4: Financial variables (budget cap, flexibility, shock tolerance, premium)
  - [x] Step 5: Design variables (style, material level, complexity, experience, sustainability)
  - [x] Step 6: Execution variables (supply chain, contractor, approvals, QA)
  - [x] Step 7: Add-ons & review
- [x] Projects list page

## Phase 4: Frontend - Results Dashboard & Scenarios
- [x] Project results dashboard with composite score
- [x] Dimension radar chart (5 dimensions)
- [x] Risk heatmap visualization
- [x] Budget realism band chart
- [x] Scenario creation interface
- [x] Scenario comparison table/chart
- [x] Sensitivity analysis display
- [x] Decision confidence meter
- [x] Conditional actions display

## Phase 5: Frontend - Admin Panel
- [x] Admin benchmarks management (CRUD + import)
- [x] Admin model versions management (CRUD + activate)
- [x] Admin audit logs viewer
- [x] Override creation form with justification
- [x] Override history viewer

## Phase 6: Testing & Delivery
- [x] Vitest tests for scoring engine
- [x] Vitest tests for normalization
- [x] Vitest tests for penalty system
- [x] Vitest tests for project CRUD
- [x] End-to-end verification
- [x] Save checkpoint and deliver

## Correction Sprint (v1.1)

### Gap 1: Rich Benchmark Data + Health Check
- [x] Expand benchmark_data schema: add differentiation_index, complexity_multiplier, timeline_risk_multiplier, buyer_preference_weights, room_type, source_note columns
- [x] Seed 50+ realistic synthetic UAE/Dubai benchmark rows across all tiers/segments/room types
- [x] Benchmark Health Check admin page: missing values, outlier detection, coverage by tier/segment, version status
- [x] Ensure scoring engine uses benchmark data to produce different believable scores across tiers

### Gap 2: Full PDF Report Pack (End-to-End)
- [x] Server-side HTML report generation engine (pdf-report.ts) with professional styling
- [x] Validation Summary report: executive summary, scores, risk, sensitivity, conditional actions, input summary
- [x] Design Brief report: all above + variable contributions per dimension
- [x] Full Report: all above + ROI economic impact analysis
- [x] Upload reports to S3 via storagePut with unique file keys
- [x] Reports page: iframe preview, external view, download, cloud badge
- [x] Each report includes: cover page, metric grid, dimension table, risk flags, penalties, audit footer

### Gap 3: Explainability ("Why This Score?")
- [x] Contribution waterfall chart (top positive/negative drivers per dimension)
- [x] Sensitivity toggles (change 1-2 assumptions inline, show delta)
- [x] Confidence index explanation panel
- [x] Explainability visible in dashboard AND included in PDF reports

### Gap 4: Decision-Lab Scenario Builder
- [x] Clean scenario builder UI: baseline + 2-3 scenarios
- [x] Each scenario changes: material tier, complexity, positioning, budget band, differentiation
- [x] Comparison table output with all dimensions side-by-side
- [x] Recommended scenario with reasoning narrative
- [x] Trade-off narrative generation

### Gap 5: Remove Fake Completeness
- [x] Hide advanced module screens (Blueprints 18-35) behind admin feature flags (none were built as separate pages)
- [x] Remove generic dashboard screens — Dashboard now uses listWithScores for real data only
- [x] Mark any remaining scaffolds clearly as "Scaffold/Interface only" — all pages show real DB data

### Product Proof Flows
- [x] Seed Project 1: Mid-market residential tower (Al Wasl Residences) with all inputs pre-filled
- [x] Seed Project 2: Premium branded residential (One Palm Residences) with all inputs pre-filled
- [x] Both projects auto-evaluated with full scoring pipeline on seed
- [x] Both projects have scenario comparisons (user can create via Decision Lab)
- [x] Both projects generate full PDF packs (user can generate via Reports page)

### Build Reality Report
- [x] Implementation status table (done/partial/stub for every feature)
- [x] Database schema documentation with relationships
- [x] Benchmark dataset documentation with example values
- [x] Decision engine documentation (variable registry, weights, pipeline, explainability)
- [x] User workflow screenshots (login, create, intake, evaluate, scenarios, dashboard, PDFs)
- [x] Admin capabilities documentation
- [x] Sample PDF screenshots
- [x] Known limitations and prioritized backlog

## V2 Intelligence Layer

### Phase 2.1 — Intelligence Data Foundation
- [x] Benchmark Library V2: benchmark_categories table (materials, finishes, FF&E, procurement, cost bands, tier defs, style families, brand archetypes, risk factors, lead times)
- [x] Benchmark Library V2: benchmark_versions table with publish workflow
- [x] Benchmark Library V2: link benchmark_data to benchmark_version_id
- [x] Project Intelligence Warehouse: project_intelligence table with derived features (cost delta, uniqueness index, feasibility flags, rework-risk, procurement complexity)
- [x] Benchmark Diff & Versioning: admin publish versions, view diffs
- [x] Benchmark change impact preview: show which past projects would change
- [x] Score matrices linked to benchmark_version_id
- [x] Portfolio-level distributions dashboard (by tier, style, cost bands)
- [x] Admin benchmark category management UI
- [x] Admin benchmark version management UI

### Phase 2.2 — ROI Narrative Engine
- [x] ROI model inputs per project (design cycles avoided, tender iterations, rework reduction, budget variance, time-to-brief)
- [x] ROI output: hours saved, cost avoided (AED), budget accuracy gain, decision confidence
- [x] ROI report section with assumptions table, sensitivity, conservative/mid/aggressive scenarios
- [x] ROI dashboard widget with summary card + breakdown chart
- [x] Admin ROI coefficients management

### Phase 2.3 — Scenario Simulation V2
- [x] Scenario templates (Cost Discipline, Market Differentiation, Luxury Upgrade, Fast Delivery, Brand Alignment)
- [x] Tornado chart and ranked sensitivity list
- [x] Constraint solver: user sets hard constraints, system proposes 2-3 best-fit variants
- [x] Recommended scenarios with deterministic reasoning

### Phase 2.4 — Defensibility Layer
- [x] MIYAR 5-Lens Validation framework as first-class artifact
- [x] Framework evidence trace: variables, weights, benchmark refs, penalties, rationale per lens
- [x] Report watermarking + framework attribution
- [x] Usage license language in report footer
- [x] Admin toggle for watermark outputs

### Phase 2.5 — Report Generation V2
- [x] Server-side PDF engine (branded template: cover, exec summary, framework, ROI, scenarios, appendix)
- [x] Executive Pack (6-8 pages)
- [x] Full Technical Report (15-25 pages)
- [x] Tender Brief Pack (RFQ: structured brief + cost assumptions + mood direction)
- [x] Export bundle: PDF + benchmark snapshot JSON + scenario summary CSV

### Phase 2.6 — Integrations V2
- [x] CRM webhook: push report summary + ROI + score (generic, field mapping)
- [x] Admin CSV import pipeline for benchmarks
- [x] Google Drive auto-upload report bundle per project (stub — requires user Google Drive credentials)
- [x] Webhook configuration admin UI

### Phase 2.7 — Intelligence Dashboard V2
- [x] Portfolio dashboard: cross-project comparison (tier, style, cost band, ROI, risk)
- [x] Benchmark compliance heatmap
- [x] Differentiation index distribution
- [x] Common failure patterns (rule-based insights)
- [x] Top 10 improvement levers (deterministic guidance)

### Acceptance Test
- [x] Full end-to-end: create → score → 3 scenario templates → 3 PDF types → webhook → portfolio dashboard
- [x] Every artifact stores benchmark_version_id, logic_version_id, audit trail

## V2.8 Design Enablement Layer

### Phase 1 — Evidence Intake & Attachment System
- [x] project_assets table (id, projectId, filename, mimeType, sizeBytes, storagePath, checksum, uploadedBy, uploadedAt, category enum, tags JSON, notes, isClientVisible)
- [x] asset_links table (assetId → evaluation/report/scenario/materialBoard)
- [x] Evidence Vault UI in Project Detail (upload, tag, preview thumbnails, PDF first-page preview)
- [x] Permission rules: admin-only deletion, client upload if role permits, full audit log
- [x] Attach assets to evaluations, scenarios, reports, material boards
- [x] Evidence trace appears in reports as references list

### Phase 2 — Design Direction Generator
- [x] Design Brief Builder tab in Project Detail (7 sections: identity, positioning, style, materials, budget, procurement, deliverables)
- [x] Brief renders deterministically from project + scenario selection
- [x] Brief Version History (diffable)
- [x] Export Design Brief as PDF
- [x] Audit logs reflect brief changes

### Phase 3 — nano banana Visual Generator
- [x] generated_visuals table (id, projectId, scenarioId, type enum, promptJson, modelVersion, createdBy, createdAt, imageAssetId)
- [x] material_boards table (id, projectId, scenarioId, boardName, boardJson, createdAt, boardImageAssetId)
- [x] Visual Studio tab in Project Detail (inputs: style, tier, unit, room, color temp, materials, do/don't, budget)
- [x] Generate Mood Set button (3-6 concept mood images)
- [x] Generate Material Board button (1-3 boards)
- [x] Generate Marketing Hero button (1 render-style image)
- [x] Admin-editable prompt template system
- [x] Store full prompt_json for auditability
- [x] Watermark generated images (admin toggleable)

### Phase 4 — Material/FF&E Library + Board Composer
- [x] materials_catalog table (category, tier, cost band, lead time, region, notes, supplier fields)
- [x] materials_to_boards join table
- [x] Admin Materials Library page (CRUD)
- [x] Board Composer UI: start from scenario, suggested palette, swap items
- [x] Board export: board_json + board_image + RFQ-ready itemized list
- [x] Board links to benchmark_version_id

### Phase 5 — Developer-Ready Packs
- [x] Update Executive Decision Pack (include Evidence Vault refs + ROI + 5-Lens)
- [x] Design Brief + RFQ Pack (brief, room list, materials list, constraints, procurement, visuals)
- [x] Marketing Pre-Launch Pack (1-2 pages + images: positioning, mood, differentiators, disclaimers)
- [x] Downloadable PDF for each pack
- [x] Shareable link (role-gated — deferred, PDF download available)
- [x] Watermarked + versioned

### Phase 6 — Collaboration & Approvals
- [x] Approval Gate states: Draft → Review → Approved for RFQ → Approved for Marketing
- [x] Commenting on briefs and boards
- [x] Decision rationale required for overrides
- [x] Seed minimal demo data for full workflow demo
