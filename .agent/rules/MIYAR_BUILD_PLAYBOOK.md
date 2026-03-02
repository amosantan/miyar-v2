# MIYAR Build Playbook — Permanent Agent Rules
<!-- This file is the single source of truth for how to build MIYAR. -->
<!-- The agent MUST read this file at the start of every session involving MIYAR development. -->

> **Last Updated:** 02 March 2026
> **Status:** Phase 9 complete. Entering Phase 10 — Sales Premium & Yield Predictor Engine.

---

## Golden Rules

1. **Always run tests before AND after any code change:** `pnpm vitest run` (476+ baseline).
2. **Never break deterministic scoring.** The 5-dimension engine (`scoring.ts`, `five-lens.ts`) is the foundation. Any change to weights, thresholds, or normalization MUST pass existing tests.
3. **Schema changes require a migration.** Use `pnpm drizzle-kit generate` then `pnpm drizzle-kit push` (see `/db-migrate` workflow).
4. **Commit granularly.** Prefix: `feat()`, `fix()`, `refactor()`, `data()`, `docs()`.
5. **Consult NotebookLM** for UAE market data before hardcoding values. Use the `miyar-uae-market-intelligence-` notebook ID.
6. **Read relevant skills** before working on specific domains: `miyar-scoring`, `miyar-ingestion`, `miyar-analytics`.

---

## Current State Snapshot

### ✅ Complete — Do Not Touch Without Tests
- Scoring Engine (`server/engines/scoring.ts`, `five-lens.ts`, `normalization.ts`)
- Explainability (`server/engines/explainability.ts`)
- PDF Reports (`server/engines/pdf-report.ts`)
- Design Brief / DOCX (`server/engines/design-brief.ts`, `docx-brief.ts`)
- Logic Registry (weights, thresholds, versions)
- Evidence Vault + Evidence References + Evidence Chain Drawer
- Source Registry + Ingestion Monitor (full CRUD + UI)
- Ingestion Orchestrator + 12 UAE connectors + Vercel cron scheduler
- Cost Forecasting P15/P50/P85/P95 (Monte Carlo)
- Learning Loop (comparator → calibrator → ledger)
- Auth & Multi-Tenancy (org isolation)
- DLD Analytics Engine (578K+ records: transactions, rents, projects)
- Benchmark pipeline (150+ benchmarks, SCAD scraper, synthetic generator)
- Estidama/Al Sa'fat compliance checklists (38 checks) + certification-aware pricing
- RICS NRM cost classification alignment (30+ materials, 24 space types)
- Portfolio benchmarking dashboard (11-column comparison table)
- Bias detection engine + bias alerts
- Digital twin (embodied carbon, operational energy, lifecycle cost)
- Autonomous alerts (price shocks, benchmark drift, portfolio risk)
- Material Board Composer + Board PDF export
- Investor PDF + DOCX + 7-day token share links
- AI Design Visualization (mood board generation via Gemini image API)
- Space Planning & Ratios engine (floor plan analysis → spatial psychology insights)
- ROI engine extended with `spaceEfficiencyScore` (Phase 9)

### 🔴 Next — Phase 10: Sales Premium & Yield Predictor Engine
- `server/engines/value-add-engine.ts` — NEW: fitout investment → yield uplift formula
- `server/routers/salesPremium.ts` — NEW: `getValueAddBridge`, `getBrandEquityForecast`
- Phase 10 frontend panel on InvestorSummary (sliders + dynamic ROI bridge)
- Brand-equity forecasting for Trophy Asset / halo-effect portfolio valuation

### 📋 Phases 11–12 Planned (do not build until Phase 10 is complete)
- **Phase 11:** Developer Portfolio Optimization & Fleet Tracking (cross-project aggregation, supply chain vulnerability alerts, execution tracking with invoice ingestion)
- **Phase 12:** Cognitive Bias & Decision Guardrails (anchoring/optimism alerts, 3-scenario auto-compromise before export)

---

## Active Build Plan

### Phase 10: Sales Premium & Yield Predictor Engine
> **Goal:** Prove to developers that investing in higher quality design directly pays off in final sale or rental yield.

| # | Task | Files | Verification |
|---|------|-------|-------------|
| 10-1 | Build `value-add-engine.ts` — core formula: fitout investment → yield uplift curve using DLD comparables | `server/engines/value-add-engine.ts` (NEW) | Unit tests: given area median + current fitout AED/sqm → returns yield delta, sale premium, payback months |
| 10-2 | Build `salesPremium` tRPC router with `getValueAddBridge` + `getBrandEquityForecast` endpoints | `server/routers/salesPremium.ts` (NEW) | Endpoints return structured data, registered in `server/routers.ts` |
| 10-3 | Add `SalesPremiumPanel.tsx` to InvestorSummary — sliders for fitout investment delta, live yield recalc | `client/src/pages/InvestorSummary.tsx` | Slider moves → yield % and sale premium AED update in real time |
| 10-4 | Brand-Equity Forecasting — Trophy Asset halo model | `server/engines/value-add-engine.ts` | Trophy/Ultra-luxury tier shows portfolio valuation uplift calculation |
| 10-5 | Write Phase 10 Reality Report | `V10_PHASE_REALITY_REPORT.md` | All 10-1 to 10-4 items verified, tests passing |

**Key assets already available:**
- `dld-analytics.ts`: `computeYield()`, `computeMarketPosition()`, `getAreaSaleMedianSqm()`, `computeFitoutCalibration()` — reuse directly
- 578K+ DLD records with `grossYield` and `absorptionRate` per area already computed
- `roi.ts`: existing cost-avoidance ROI engine (platform ROI — different from fitout investment ROI)
- Read `miyar-sales-premium` skill before starting

**How to execute:**
1. Read `.agent/skills/miyar-sales-premium/SKILL.md`
2. Run `/run-tests` to confirm baseline (476+ passing)
3. Build engine → router → frontend in sequence
4. Run `/run-tests` after each step
5. Commit: `feat(phase10): description`
6. Push to main, verify Vercel build

---

### Phase 11: Developer Portfolio Optimization & Fleet Tracking
> **Do not start until Phase 10 is complete and reality report is written.**

| # | Task | Notes |
|---|------|-------|
| 11-1 | Cross-project aggregation dashboard (10+ projects) | Extend existing `PortfolioPage.tsx` |
| 11-2 | Systemic vulnerability alerts (supply chain at scale) | New alert type in `alert-engine.ts` |
| 11-3 | Execution tracking — transition projects to "Execution" status, ingest real invoices | New project status + invoice ingestion pipeline |

---

### Phase 12: Cognitive Bias & Decision Guardrails
> **Do not start until Phase 11 is complete.**

| # | Task | Notes |
|---|------|-------|
| 12-1 | Anchoring & optimism alerts with data-backed severity levels | Extend existing `server/engines/bias/` |
| 12-2 | 3-scenario auto-compromise before impossible brief export | Intercept export flow in `DesignBrief.tsx` / `InvestorSummary.tsx` |

---

## Key File Locations

| Domain | Path |
|--------|------|
| Schema | `drizzle/schema.ts` (82+ tables) |
| Scoring | `server/engines/scoring.ts`, `five-lens.ts`, `normalization.ts` |
| Ingestion | `server/engines/ingestion/` (orchestrator, connectors, scheduler, DFE) |
| DLD Analytics | `server/engines/dld-analytics.ts` (computeYield, computeMarketPosition, getFitoutCalibration) |
| Analytics | `server/engines/analytics/` (trend, competitor, insight, positioning) |
| Learning | `server/engines/learning/` (comparator, calibrator, ledger, weight analyzer) |
| Predictive | `server/engines/predictive/` (cost-range, outcome, scenario, monte-carlo) |
| Autonomous | `server/engines/autonomous/` (alerts, NL, portfolio, docs, ranking) |
| Design | `server/engines/design/` (advisor, RFQ, finish, space, compliance, palette) |
| Risk | `server/engines/risk/` (risk-evaluator, stress-tester) |
| Economics | `server/engines/economic/` (roi-calculator, cost-avoidance, programme-acceleration) + `server/routers/economics.ts` |
| Procurement | `server/engines/procurement/` (vendor-matching — Phase 8) |
| Customer | `server/engines/customer/` (health-score) |
| Bias | `server/engines/bias/` |
| Sustainability | `server/engines/sustainability/` (compliance-checklists, digital-twin, multipliers) |
| ROI | `server/engines/roi.ts` (cost avoidance, Phase 9 space efficiency driver) |
| Value-Add | `server/engines/value-add-engine.ts` (Phase 10 — to be built) |
| Routers | `server/routers/` (20 files) |
| Client Pages | `client/src/pages/` (32 pages) |
| Tests | `server/engines/*.test.ts` (476+ tests) |
| Skills | `.agent/skills/miyar-scoring/`, `miyar-ingestion/`, `miyar-analytics/`, `miyar-sales-premium/` |
| Workflows | `.agent/workflows/` (`/run-tests`, `/db-migrate`, `/ingestion-run`, `/evaluate-project`, `/phase10-build`) |

---

## Checklists

### Before Starting Any Phase
- [ ] Read this playbook
- [ ] Read relevant skill file(s)
- [ ] Check current test baseline: `pnpm vitest run`
- [ ] Check database state via PlanetScale queries
- [ ] Review schema for existing tables/columns before adding new ones

### Before Committing
- [ ] All tests pass (476+ baseline, 0 new failures)
- [ ] No TypeScript errors
- [ ] Commit message follows convention: `feat(domain): description`
- [ ] Push to main and verify Vercel build

### After Completing a Phase
- [ ] Update this playbook with completion status
- [ ] Run `/evaluate-project` workflow
- [ ] Notify user with summary of what was built
