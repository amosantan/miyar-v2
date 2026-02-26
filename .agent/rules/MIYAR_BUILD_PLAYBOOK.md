# MIYAR Build Playbook — Permanent Agent Rules
<!-- This file is the single source of truth for how to build MIYAR. -->
<!-- The agent MUST read this file at the start of every session involving MIYAR development. -->

> **Last Updated:** 26 February 2026
> **Status:** ~75–80% of core architecture complete. Entering enhancement & expansion phases.

---

## Golden Rules

1. **Always run tests before AND after any code change:** `pnpm vitest run` (655+ baseline).
2. **Never break deterministic scoring.** The 5-dimension engine (`scoring.ts`, `five-lens.ts`) is the foundation. Any change to weights, thresholds, or normalization MUST pass existing tests.
3. **Schema changes require a migration.** Use `pnpm drizzle-kit generate` then `pnpm drizzle-kit push` (see `/db-migrate` workflow).
4. **Commit granularly.** Prefix: `feat()`, `fix()`, `refactor()`, `data()`, `docs()`.
5. **Consult NotebookLM** for UAE market data before hardcoding values. Use the `miyar-uae-market-intelligence-` notebook ID.
6. **Read relevant skills** before working on specific domains: `miyar-scoring`, `miyar-ingestion`, `miyar-analytics`.

---

## Current State Snapshot

### ✅ Working — Do Not Touch Without Tests
- Scoring Engine (`server/engines/scoring.ts`, `five-lens.ts`, `normalization.ts`)
- Explainability (`server/engines/explainability.ts`)
- PDF Reports (`server/engines/pdf-report.ts`)
- Design Brief / DOCX (`server/engines/design-brief.ts`, `docx-brief.ts`)
- Logic Registry (weights, thresholds, versions)
- Evidence Vault (1,493 real records)
- Source Registry + Ingestion Monitor (full CRUD + UI)
- Ingestion Orchestrator (`server/engines/ingestion/orchestrator.ts`)
- Cost Forecasting P15/P50/P85/P95
- Learning Loop (comparator → calibrator → ledger)
- Auth & Multi-Tenancy (org isolation)

### 🟡 Enhancement Queue — Wire Up or Extend
- **Trend Detection** → needs live ingestion runs (3+ cycles)
- **Competitor Intelligence** → needs live sales data, currently NotebookLM-seeded
- **NL Query Engine** → engine exists, needs "Ask MIYAR" UI on dashboard
- **Alert Engine** → engine exists, needs email/Slack/webhook delivery
- **Portfolio Engine** → engine exists, needs dedicated Portfolio page
- **Benchmark Learning** → needs first real post-mortem submission
- **Ingestion Scheduler** → needs deployment as cron/worker

### 🔴 Gaps — Must Be Built
- Live UAE connectors (Bayut, PropertyFinder, DLD APIs)
- Monte Carlo Simulation
- Time-series material price forecasting
- 6-month forward trend projection
- 200+ benchmarks (currently 58)

---

## Phased Build Plan

### Phase A: Production Polish (1 week)
> **Goal:** Make everything that EXISTS actually work end-to-end in production.

| # | Task | Files | Verification |
|---|------|-------|-------------|
| A1 | Deploy ingestion scheduler as cron/worker | `server/engines/ingestion/scheduler.ts` | Verify 3 automatic ingestion runs complete |
| A2 | Wire NL Query UI — add "Ask MIYAR" search bar to Dashboard | `client/src/pages/Dashboard.tsx`, `server/engines/autonomous/nl-engine.ts` | User can type a question, get structured answer |
| A3 | Wire alert delivery (email via Resend or SendGrid) | `server/engines/autonomous/alert-engine.ts` | Trigger a test alert, verify email receipt |
| A4 | Submit first real post-mortem via API | `server/routers/learning.ts` → `submitPostMortem` | `project_outcomes` has ≥1 row, comparator runs |
| A5 | Ensure Gemini API key is in all environments | Vercel env vars | Design Advisor returns results on production |

**How to execute each task:**
1. Read the relevant skill file (e.g., `miyar-ingestion` for A1)
2. Implement the change
3. Run `/run-tests`
4. Commit with descriptive message
5. Push to main, verify Vercel deployment

---

### Phase B: Data Enrichment (1 week)
> **Goal:** Fill database gaps so the UI shows rich, real data everywhere.

| # | Task | Target Table(s) | Source |
|---|------|-----------------|--------|
| B1 | Seed 200+ benchmarks covering all typologies & tiers | `benchmark_data` | NotebookLM + Turner & Townsend reports |
| B2 | Add live UAE property connectors (Bayut scraper) | `evidence_records`, `source_registry` | Build new connector in `server/engines/ingestion/connectors/` |
| B3 | Add PropertyFinder connector | `evidence_records` | Same pattern as Bayut |
| B4 | Run 3+ ingestion cycles to self-populate trend data | `trend_snapshots` | Use scheduler from Phase A1 |
| B5 | Seed 20+ competitor projects with real pricing | `competitor_projects` | NotebookLM or manual research |

**How to execute:**
1. For connectors (B2, B3): extend the `BaseConnector` class in `server/engines/ingestion/connector.ts`
2. Register in `source_registry` with connector type
3. Test via ingestion monitor UI
4. For seeding (B1, B5): create `scripts/seed-*.ts` scripts, run with `npx tsx`

---

### Phase C: Build Portfolio Page (1 week)
> **Goal:** Deliver a monetizable enterprise feature.

| # | Task | Files |
|---|------|-------|
| C1 | Add `portfolios` and `portfolioProjects` tables | `drizzle/schema.ts` → migrate |
| C2 | Extend `portfolio-engine.ts` with aggregation | `server/engines/portfolio.ts` |
| C3 | Add portfolio CRUD endpoints | `server/routers/project.ts` or new `portfolio.ts` router |
| C4 | Build `PortfolioView.tsx` page | `client/src/pages/` |
| C5 | Add portfolio-level PDF report | `server/engines/pdf-report.ts` |
| C6 | Wire portfolio alerts | `server/engines/autonomous/alert-engine.ts` |

---

### Phase D: Risk & Economic Modeling — V9 (3 weeks)
> **Blueprints:** BP 17, 21, 35

| # | Task | Files |
|---|------|-------|
| D1 | Build `stress-test-engine.ts` | `server/engines/risk/` |
| D2 | Implement Programme Acceleration Model | `server/engines/economic/` |
| D3 | Implement Cost Avoidance Modeling | `server/engines/economic/` |
| D4 | Build Risk Surface Map visualization | `client/src/pages/` → `RiskHeatmap.tsx` |
| D5 | Advanced Scenario Ranking algorithm | `server/engines/autonomous/scenario-ranking.ts` |
| D6 | Stress Test UI panel in Scenarios page | `client/src/pages/Scenarios.tsx` |

**Schema tables already exist:** `scenarioStressTests`, `riskSurfaceMaps`, `projectRoiModels`

---

### Phase E: Cognitive Bias Detection — V11 (2 weeks)
> **Blueprint:** BP 26

| # | Task | Files |
|---|------|-------|
| E1 | Extend bias detection engine | `server/engines/bias/` (2 files exist) |
| E2 | Add bias triggers into scoring pipeline | `server/engines/scoring.ts` |
| E3 | Build `BiasReport.tsx` UI panel | `client/src/pages/` |
| E4 | Wire bias alerts to alert engine | `server/engines/autonomous/alert-engine.ts` |

**Schema tables already exist:** `biasAlerts`, `biasProfiles`

---

### Phase F: Monte Carlo & Time-Series — V4 Complete (2 weeks)

| # | Task | Files |
|---|------|-------|
| F1 | Implement Monte Carlo simulation engine | `server/engines/predictive/monte-carlo.ts` (NEW) |
| F2 | Build time-series material price forecasting | `server/engines/predictive/material-forecast.ts` (NEW) |
| F3 | Add 6-month forward trend projection | `server/engines/analytics/trend-detection.ts` |
| F4 | Monte Carlo UI visualization | `client/src/pages/Scenarios.tsx` |

---

### Phase G: Customer Success — V12 (2 weeks)

| # | Task | Files |
|---|------|-------|
| G1 | Add `clientHealthScores`, `interventionEvents` tables | `drizzle/schema.ts` |
| G2 | Build health scoring engine | `server/engines/learning/` (NEW) |
| G3 | Build admin `ClientHealth.tsx` dashboard | `client/src/pages/admin/` |
| G4 | Quarterly PDF value realization reports | `server/engines/pdf-report.ts` |

---

### Phase H: Digital Twin & Sustainability — V13 (4 weeks)

| # | Task | Files |
|---|------|-------|
| H1 | Extend `materialsCatalog` with EPD fields | `drizzle/schema.ts` |
| H2 | Build sustainability scoring engine | `server/engines/design/sustainability.ts` (NEW) |
| H3 | Add sustainability gauge to Design Studio | `client/src/pages/DesignStudio.tsx` |
| H4 | Integrate Estidama / Al Sa'fat standards | `server/engines/design/dm-compliance.ts` |

---

## Key File Locations

| Domain | Path |
|--------|------|
| Schema | `drizzle/schema.ts` (71 tables, 1704 lines) |
| Scoring | `server/engines/scoring.ts`, `five-lens.ts`, `normalization.ts` |
| Ingestion | `server/engines/ingestion/` (orchestrator, connectors, scheduler, DFE) |
| Analytics | `server/engines/analytics/` (trend, competitor, insight, positioning) |
| Learning | `server/engines/learning/` (comparator, calibrator, ledger, weight analyzer) |
| Predictive | `server/engines/predictive/` (cost-range, outcome, scenario) |
| Autonomous | `server/engines/autonomous/` (alerts, NL, portfolio, docs, ranking) |
| Design | `server/engines/design/` (advisor, RFQ, finish, space, compliance, palette) |
| Risk | `server/engines/risk/` |
| Bias | `server/engines/bias/` |
| Routers | `server/routers/` (17 files) |
| Client Pages | `client/src/pages/` (23 core + 9 market-intel + 17 admin) |
| Seeds | `scripts/seed-*.ts` |
| Tests | `server/engines/*.test.ts` (24 files, 655+ tests) |
| Skills | `.agent/skills/miyar-scoring/`, `miyar-ingestion/`, `miyar-analytics/` |
| Workflows | `.agent/workflows/` (`/run-tests`, `/db-migrate`, `/ingestion-run`, `/evaluate-project`) |

---

## Checklists

### Before Starting Any Phase
- [ ] Read this playbook
- [ ] Read relevant skill file(s)
- [ ] Check current test baseline: `pnpm vitest run`
- [ ] Check database state via PlanetScale queries
- [ ] Review schema for existing tables/columns before adding new ones

### Before Committing
- [ ] All tests pass (655+ baseline, 0 new failures)
- [ ] No TypeScript errors
- [ ] Commit message follows convention: `feat(domain): description`
- [ ] Push to main and verify Vercel build

### After Completing a Phase
- [ ] Update this playbook with completion status
- [ ] Run `/evaluate-project` workflow
- [ ] Notify user with summary of what was built
