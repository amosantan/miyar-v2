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
- [ ] Save checkpoint and deliver (in progress)
