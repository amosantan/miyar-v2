# MIYAR v2 — Comprehensive Gap Analysis Report

**Date**: 26 Feb 2026 · **Scope**: Full-stack audit of engines, routers, schema, pages, tests, infra

---

## Platform Inventory

| Layer | Count | Details |
|-------|-------|---------|
| **Schema tables** | ~40+ | 1,802 lines in `schema.ts` |
| **DB functions** | 256 | `db.ts` (2,062 lines) |
| **Engine dirs** | 11 | analytics, autonomous, bias, customer, design, economic, ingestion, learning, predictive, risk, sustainability |
| **Standalone engines** | 15+ | scoring, normalization, explainability, portfolio, ROI, pricing, sensitivity, etc. |
| **Routers** | 20 | All registered in `routers.ts` |
| **Frontend pages** | 29 | + 17 admin + 9 market-intel sub-pages |
| **Routes** | 57 | All wired in `App.tsx` |
| **UI components** | 53 | shadcn/ui library |
| **Test files** | 27 | All server-side |
| **Migrations** | 32 | `0000`–`0031` in drizzle/ |

---

## 1. Schema & Database Migrations 🔴

### Missing Migrations (P0 — Critical)
Tables defined in `schema.ts` but **never generated as migrations** — they don't exist in the live database:

| Table | Phase | Status |
|-------|-------|--------|
| `riskSurfaceMaps` | D | ❌ No migration |
| `stressTestResults` | D | ❌ No migration |
| `biasProfiles` | E | ❌ No migration |
| `biasAlerts` | E | ❌ No migration |
| `portfolioProjects` | C6 | ❌ No migration |
| `monteCarloSimulations` | F | ❌ No migration |
| `customerHealthScores` | G | ❌ No migration |
| `digitalTwinModels` | H | ❌ No migration |

> [!CAUTION]
> **These 8 tables exist in code but NOT in production.** Any deployed version hitting these tables will crash. You must run `npx drizzle-kit generate` and then push to PlanetScale.

### Missing Foreign Keys & Indexes
- No foreign key constraints anywhere in schema (Drizzle MySQL style)
- No indexes on frequently queried columns: `userId`, `projectId`, `orgId`, `createdAt`
- No composite indexes for common query patterns (e.g., `userId + createdAt`)

---

## 2. Engine Coverage & Quality 🟡

### Phase D–H Engines — No Unit Tests
| Engine | File | Lines | Tests |
|--------|------|-------|-------|
| Risk Evaluator | `risk/risk-evaluator.ts` | 90 | ❌ None |
| Stress Tester | `risk/stress-tester.ts` | 60 | ❌ None |
| Bias Detector | `bias/bias-detector.ts` | ~250 | ❌ None (v11 test covers old version) |
| Monte Carlo | `predictive/monte-carlo.ts` | 220 | ❌ None |
| Health Score | `customer/health-score.ts` | 208 | ❌ None |
| Digital Twin | `sustainability/digital-twin.ts` | 320 | ❌ None |

### Hardcoded Data Concerns
- **Digital Twin**: Material carbon intensities hardcoded (ICE v3). Should be database-driven for updatability.
- **Health Score**: Scoring thresholds (30 days, dimension weights) hardcoded. Should be configurable.
- **Monte Carlo**: Box-Muller sampling is correct but only supports normal/uniform distributions.
- **Bias Detector**: Bias taxonomy is static; no mechanism to add new bias types.

### Missing Engines
- No **notification engine** — alerts exist but no email/push delivery
- No **scheduling engine** for recurring tasks (e.g., nightly health score refresh)
- No **export engine** for bulk data export (CSV/Excel for sustainability reports, simulations)

---

## 3. Router & API Layer 🟡

### Security Gaps
- **No rate limiting** on any endpoint — computationally expensive mutations (`runMonteCarlo`, `computeTwin`, `calculateHealth`) are vulnerable to abuse
- **No input sanitization middleware** — relies solely on Zod but no HTML/XSS sanitization
- **Inconsistent error handling** — some routers throw raw errors, others wrap in custom messages
- **`any` type annotations** — `ctx: any`, `input: any` used extensively in Phase D–H routers instead of proper TRPC type inference

### Missing API Endpoints
- No **pagination** on new query endpoints (`getActivityFeed`, `getTwinModels`)
- No **bulk operations** (batch evaluate projects, batch compute twins)
- No **webhook endpoints** for external integrations (CRM, Slack, email)
- No **export endpoints** (download simulation results as CSV, sustainability report as PDF)

---

## 4. Frontend & UX 🟡

### Auth & Route Protection
- **No auth guards** on any route — all 57 routes are accessible without login. The `protectedProcedure` on backend prevents data access, but users can navigate to pages and see empty/broken states.
- No **role-based access** — admin pages at `/admin/*` have no frontend permission checks

### Loading & Error States
- Phase D–H pages lack **skeleton loading states** — they show empty state or nothing while data loads
- No **error boundary per page** — only a global `ErrorBoundary` exists
- No **offline/connection-lost handling**

### UX Gaps
- **No onboarding flow** — new users land on Dashboard with no guidance
- **No project selector** on global pages (Customer Success, Sustainability should have contextual project view)
- **Sidebar is very long** (18 items in analysis section) — needs grouping or collapsing
- **No search/command palette** — with 57+ pages, users need quick navigation
- **No responsive mobile design** — sidebar layout doesn't adapt to mobile
- **No dark/light theme toggle visible** — `ThemeProvider` exists but no UI toggle

### Accessibility
- No ARIA labels on custom SVG visualizations (health gauge, score ring)
- No keyboard navigation support for interactive charts
- No skip-to-content links

---

## 5. Test Coverage 🔴

### Current State
27 test files exist, **all covering pre-Phase-D code**:
- ✅ Scoring engine, normalization, explainability
- ✅ Predictive engine (pre-Monte Carlo)
- ✅ Learning engines (ledger, calibrator, comparator)
- ✅ Auth, bias (v11), design advisor
- ✅ Market intelligence, ingestion, connectors

### Missing Tests (Phase D–H)
| Component | Type | Priority |
|-----------|------|----------|
| `risk-evaluator.ts` | Unit | P1 |
| `stress-tester.ts` | Unit | P1 |
| `monte-carlo.ts` | Unit | P0 |
| `health-score.ts` | Unit | P1 |
| `digital-twin.ts` | Unit | P0 |
| `customer-success.ts` router | Integration | P1 |
| `sustainability.ts` router | Integration | P1 |
| `portfolio.ts` router | Integration | P2 |
| `bias.ts` router | Integration | P2 |
| All new pages | E2E/Component | P2 |

### No Frontend Tests
- **Zero** component tests, E2E tests, or visual regression tests
- No Playwright/Cypress setup

---

## 6. Data & Intelligence 🟡

### No Real LLM Integration
- **AI Design Advisor**: Uses Gemini via `nano-banana-client.ts` — but prompt engineering is minimal
- **Ask MIYAR**: No unified conversational AI interface despite the search bar in UI
- **NL Engine**: `autonomous/nl-engine.ts` exists but isn't connected to any user-facing feature
- **Insight Generator**: `analytics/insight-generator.ts` generates insights but display is limited

### Static Data vs Live Data
| Feature | Current | Should Be |
|---------|---------|-----------|
| Material carbon DB | Hardcoded (9 materials) | Database-driven from EPD sources |
| Climate factors | Hardcoded (5 locations) | Weather API or configurable |
| Benchmark data | Database-driven ✅ | Good |
| Source registry | Database-driven ✅ | Good |
| Material costs | Hardcoded per engine | Should pull from benchmark DB/market intel |

### Missing Analytics
- No **trend analysis over time** — health scores, sustainability scores computed once but not tracked historically
- No **cross-project comparisons** — e.g., "your carbon efficiency vs portfolio average"
- No **anomaly detection** — unusual cost patterns, scoring outliers

---

## 7. Deployment & DevOps 🔴

### CI/CD
- **No CI pipeline** — no GitHub Actions, no automated testing on push
- **No staging environment** — Vercel deploys directly to production
- **No preview deployments** for PRs

### Monitoring & Observability
- **No error tracking** (Sentry, Bugsnag, etc.)
- **No performance monitoring** (response times, slow queries)
- **No structured logging** — server logs go to stdout only
- **No health check endpoint** beyond TRPC's system router

### Database Operations
- **No backup strategy** documented
- **No migration CI** — migrations must be manually generated and pushed
- 8 pending tables need migration before next deploy

---

## 8. Security 🔴

### Authentication
- Session-based auth using HTTP-only cookies ✅
- **No token rotation** — sessions don't expire based on inactivity
- **No 2FA support**
- **No password complexity rules** (local auth)

### Authorization
- `protectedProcedure` exists but **no RBAC enforcement**
- Any authenticated user can access any project (no `userId` check on many queries)
- Admin routes have no admin-role check at API level
- **No CSRF protection** beyond SameSite cookies

### Data Protection
- **No data encryption at rest** (relies on PlanetScale)
- **No PII handling policy** — user emails stored in plain text
- **No audit trail for data deletions**

---

## Priority Matrix

### P0 — Ship-blockers (Must fix before any deploy)
1. Generate DB migrations for 8 Phase D–H tables
2. Push migrations to PlanetScale
3. Add auth guards on frontend routes
4. Add admin role checks on `/admin/*` endpoints

### P1 — High Priority (Next sprint)
5. Write unit tests for Monte Carlo + Digital Twin engines
6. Add rate limiting on expensive mutations
7. Set up CI/CD (GitHub Actions + test runner)
8. Add error tracking (Sentry)
9. Fix `any` type annotations in Phase D–H routers

### P2 — Medium Priority (2-4 weeks)
10. Add frontend component tests (Vitest + Testing Library)
11. Build user onboarding flow
12. Make sidebar collapsible / add command palette
13. Add data export functionality (CSV/PDF)
14. Historical tracking for health scores + sustainability
15. Add indexes on frequently queried columns
16. Mobile responsive layout

### P3 — Nice to Have (Backlog)
17. E2E test suite (Playwright)
18. Move hardcoded material data to database
19. Real-time notifications via WebSocket
20. 2FA support
21. API documentation (OpenAPI/Swagger equivalent)
22. i18n / localization support
23. Performance monitoring + structured logging

---

## Summary

| Dimension | Grade | Notes |
|-----------|-------|-------|
| **Feature Completeness** | A- | All 8 phases shipped (D–H), rich engine layer |
| **Schema & Migrations** | D | 8 tables without migrations = deploy hazard |
| **Test Coverage** | C- | 27 tests but 0 for new phases, 0 frontend tests |
| **Security** | C | Auth works, but no RBAC, rate limiting, or CSRF |
| **Frontend Polish** | B- | Good UX but missing auth guards, mobile, accessibility |
| **DevOps** | D | No CI/CD, no monitoring, no staging |
| **Data Quality** | B | Most data DB-driven, but carbon/energy data hardcoded |

> [!IMPORTANT]
> **Top 3 immediate actions:**
> 1. 🗄️ Generate + push the 8 missing DB migrations
> 2. 🔒 Add auth guards + admin role checks
> 3. 🧪 Write unit tests for Monte Carlo + Digital Twin (most complex engines)
