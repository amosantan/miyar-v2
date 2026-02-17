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
