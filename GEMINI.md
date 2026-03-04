# MIYAR 3.0 — Gemini Project Intelligence File

> **This file is the single source of truth for any AI assistant working on this codebase.**
> Read this entirely before making any changes. Every decision must align with the product principles below.
>
> **Current Version:** MIYAR 3.0
> **Active Phase:** MIYAR 3.0 Phase A — Material Quantity Intelligence (MQI)
> **Last Updated:** 04 March 2026

---

## ⚡ MANDATORY: Do This Before ANY Work

**Every session, every task, no exceptions:**

1. Read `.agent/rules/miyar-memory.md` — current phase status, what's built, what's next, immutable rules
2. Read `.agent/rules/coding-conventions.md` — LLM boundary rules, type safety, test baseline
3. Read `PROGRESS.md` (this folder root) — live task tracker showing exactly what is done vs pending

**Before working on a specific domain, also read the relevant skill:**
- Materials / MQI / surface areas / allocations → `.agent/skills/miyar-materials/SKILL.md`
- Scoring engine / normalization / explainability → `.agent/skills/miyar-scoring/SKILL.md`
- Intake / multimodal upload / Gemini analysis → `.agent/skills/miyar-intake/SKILL.md`
- Ingestion / scraping / connectors / orchestrator → `.agent/skills/miyar-ingestion/SKILL.md`
- Sales premium / yield / brand equity → `.agent/skills/miyar-sales-premium/SKILL.md`

**Before starting a build phase, read the workflow:**
- MIYAR 3.0 Phase A (MQI) → `.agent/workflows/miyar3-phase-a-build.md`
- DB schema changes → `.agent/workflows/db-migrate.md`
- Running tests → `.agent/workflows/run-tests.md`

---

## ⚡ MANDATORY: Do This After ANY Task Completes

**Every task, no exceptions:**

1. Update `PROGRESS.md` — mark completed items, add any new discovered items
2. Update `.agent/rules/miyar-memory.md` — if phase status changed, files were added, or stats changed
3. Update `GEMINI.md` (this file) — if "Active Phase" or "Current Version" changed
4. If a new engine, router, or major file was created — add a row to the Architecture tables below
5. Run `pnpm test` — record new test count in `PROGRESS.md`
6. Commit with format: `feat: MIYAR 3.0 Phase X — Short description`

**If you skip these updates, the next session starts with wrong context and breaks the build chain.**

---

## What Is MIYAR 3.0?

**MIYAR** (مِعيار — Arabic for "standard" or "benchmark") is the UAE Design Decision Intelligence Platform — the Bloomberg terminal of design decisions for property developers.

**MIYAR 2.0** (Phases 1–9) was a scoring and validation engine: developer fills forms, system scores them.

**MIYAR 3.0** (Phase 10A onwards) conforms to the developer: they express their vision naturally (images, voice, chat, supplier links), the system understands it, prices it from the ground up, and tells them whether it's buildable before a single AED is committed.

---

## Target User

| Dimension | Detail |
|-----------|--------|
| **Primary** | UAE real estate developers, investors, and interior designers working on luxury/ultra-luxury residential and hospitality projects |
| **Deal Size** | Fitout budgets typically 5M–200M+ AED; sale values 20M–500M+ AED |
| **Geography** | Dubai (primary), Abu Dhabi (secondary), wider GCC |
| **Pain** | No reliable, fast source of truth for interior design cost benchmarks, material specs, and ROI projections at the luxury tier |
| **Goal** | Cut feasibility and design briefing from weeks to minutes, with defensible market data behind every number |

---

## Product Principles

These are non-negotiable. Every new feature must serve at least one of these.

### 1. 🏗️ Numbers Must Be Defensible
Every cost estimate, benchmark, and ROI projection must be traceable to a real data source. The user is presenting to boards and investors — vague AI hallucinations are unacceptable. Use the `source_registry`, `evidence_records`, and `benchmarkData` tables to back every number shown.

### 2. 🎯 UAE Market Context First
Default all assumptions to UAE/Dubai market conditions. Use AED as the primary currency. Reference DM (Dubai Municipality) regulations, UAE VAT, local lead times, and UAE-specific material suppliers. Never use generic global benchmarks without a UAE-specific override.

### 3. ⚡ From Input to Insight in < 60 Seconds
The user fills in 6–8 project parameters (typology, GFA, tier, style, location) and should receive: a full design brief, space-by-space budget breakdown, sustainability grade, ROI bridge, and market benchmark overlay — in a single session with no waiting.

### 4. 📤 Board-Ready Output by Default
Every output (design brief, investor summary, material board) should be presentable to a property board without modification. Professional formatting, watermarks, document IDs, and disclaimers are mandatory. PDF export and DOCX export are first-class features, not afterthoughts.

### 5. 🧠 AI Is the Engine, Data Is the Authority
Gemini AI generates narratives, style directions, and recommendations. But it does not set prices. Prices come from `benchmarkData`, `materialConstants`, and `evidenceRecords`. AI is a co-pilot — the market data is the captain.

### 6. 🔗 Shareable Without Friction
Investors don't always log in. Any key output (investor summary, design brief) should be shareable via a token-gated link without requiring the recipient to create an account. Share links are time-boxed (7 days default) and read-only.

### 7. 📊 Score Everything, Explain Everything
Every project gets a 5-dimension MIYAR Score (SA/FF/MP/DS/ER). Every score must have an explainability trace. Users should always understand *why* a score is what it is, not just *what* the score is.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Wouter (routing) + TanStack Query |
| **UI** | shadcn/ui + Lucide React + Tailwind 4 |
| **API** | tRPC v11 (type-safe, end-to-end) |
| **Backend** | Node.js / Express 4 |
| **Database** | TiDB (mysql2 driver) |
| **ORM** | Drizzle ORM |
| **AI** | Google Gemini (via `invokeLLM`) — generation + image synthesis |
| **File Storage** | AWS S3 |
| **Auth** | Session-based, org-scoped via `orgProcedure` |
| **Export** | docx (Word), HTML blob (PDF via browser print), structured JSON |
| **Hosting** | Vercel (frontend + API + cron jobs) |

---

## Architecture: Key Files

### Server
| File | Purpose |
|------|---------|
| `server/db.ts` | All database query functions |
| `server/routers/design.ts` | Main design intelligence API (brief, space recs, benchmarks, PDF export, share links) |
| `server/routers/design-advisor.ts` | Gemini AI recommendation generation |
| `server/routers/salesPremium.ts` | Phase 10 — Value-add bridge + brand equity forecasting (to be built) |
| `server/engines/scoring.ts` | 5-dimension MIYAR Score (SA/FF/MP/DS/ER) |
| `server/engines/design-brief.ts` | 7-section AI design brief generator |
| `server/engines/investor-pdf.ts` | HTML PDF engine for investor brief |
| `server/engines/docx-brief.ts` | DOCX Word document brief generator |
| `server/engines/board-pdf.ts` | Material board HTML PDF generator |
| `server/engines/pricing-engine.ts` | Live AED cost estimation from benchmark proposals |
| `drizzle/schema.ts` | All 82+ database table definitions |

### Client
| File | Purpose |
|------|---------|
| `client/src/pages/InvestorSummary.tsx` | Investor-facing 5-section summary (main product output) |
| `client/src/pages/BriefEditor.tsx` | Material-by-material cost calculator with live recalc |
| `client/src/pages/DesignAdvisor.tsx` | AI recommendation generation UI |
| `client/src/pages/DesignBrief.tsx` | 7-section AI design brief viewer + DOCX export |
| `client/src/pages/ShareView.tsx` | **Public** (no auth) read-only investor brief at `/share/:token` |
| `client/src/pages/BoardComposer.tsx` | Material board builder + PDF export |

---

## Database: Core Tables

| Table | What It Stores |
|-------|---------------|
| `projects` | All user projects (42 columns — typology, GFA, tier, style, location, etc.) |
| `ai_design_briefs` | Generated 7-section design briefs (JSON) + share token |
| `space_recommendations` | Per-room AI recommendations (materials, budget, style) |
| `benchmarkData` | UAE cost benchmarks (AED/sqft by typology/location/tier) |
| `materialConstants` | 9 material types with AED/m², carbon intensity, maintenance factors |
| `designTrends` | UAE design trend signals (confidence: established/emerging/declining) |
| `sourceRegistry` | Whitelisted data sources with reliability grades (A/B/C) |
| `evidenceRecords` | Intelligence records with snippets, source URLs, and reliability grades |
| `scoreMatrices` | MIYAR Score results (SA/FF/MP/DS/ER per project) |
| `platformAlerts` | Autonomous alerts for price shocks, project risk, benchmark drift |

---

## MIYAR Score: 5 Dimensions

| Code | Dimension | What It Measures |
|------|-----------|-----------------|
| **SA** | Strategic Alignment | How well the design matches market positioning and investor goals |
| **FF** | Financial Feasibility | Cost/sqm vs benchmarks, budget realism, contingency adequacy |
| **MP** | Market Positioning | Competitor density, differentiation, tier fit |
| **DS** | Design Suitability | Style-to-tier alignment, material specification quality |
| **ER** | Execution Risk | Lead time risk, authority approval complexity, procurement risk |

Score range: 0–100 per dimension. Risk flags: `FIN_SEVERE`, `COMPLEXITY_MISMATCH`, `LOW_SA`, `LOW_MP`.

---

## MIYAR 3.0 Phase Status

| Phase | Name | Status |
|-------|------|--------|
| Phases 1–9 | MIYAR 2.0 full platform | ✅ Complete |
| Phase 10A | Intelligent Project Intake (multimodal → form auto-fill) | ✅ Complete — committed |
| Phase 10B | Sales Premium & Yield Predictor | ✅ Complete — committed `e06022c` |
| **MIYAR 3.0 Phase A** | **Material Quantity Intelligence (MQI)** | ✅ Complete — pending commit |

---

## AI Integration

- **Model:** Gemini 2.5 Flash (via `invokeLLM` wrapper in `server/_core/llm.ts`)
- **Key uses:** Design brief, space recommendations, intake analysis, material allocation suggestions, design advisor, trend synthesis, supplier price extraction
- **Image generation:** Gemini image API (via `visual-gen.ts` + `nano-banana-client.ts`)
- **LLM boundary:** Gemini suggests and translates. It NEVER scores, prices, or calculates. See `.agent/rules/coding-conventions.md` for full rules.
- **Guardrails:** Cost numbers always come from `material_library`, `benchmarkData`, `evidenceRecords` — never from AI output

---

## Coding Conventions (Summary — full rules in `.agent/rules/coding-conventions.md`)

- All new tRPC procedures: `server/routers/` — always use `orgProcedure` (never `publicProcedure` for org data)
- All new DB queries: `server/db.ts` as named exported async functions
- Schema changes: edit `drizzle/schema.ts` → run `pnpm db:push` — always use `mysqlTable` (TiDB, not pgTable)
- Currency: always AED. Use `fmtAed()` helper for M/K formatting
- Test baseline: 770+ passing (800 total including 8 pre-existing fail + 22 skip). Run `pnpm test` before and after every change
- TypeScript: run `pnpm check` before declaring any task complete — zero errors required

---

## Git Workflow

- Branch: `main`
- Remote: `https://github.com/amosantan/miyar-v2`
- Commit style: `feat: MIYAR 3.0 Phase X — Short description`
- After schema changes: run `pnpm db:push`
- After any phase: update `PROGRESS.md` + `miyar-memory.md` + this file
