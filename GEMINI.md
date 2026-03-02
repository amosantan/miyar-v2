# MIYAR — Gemini Project Intelligence File

> **This file is the single source of truth for any AI assistant working on this codebase.**
> Read this entirely before making any changes. Every decision must align with the product principles below.
>
> **Current Phase:** Phase 9 complete. Building Phase 10 — Sales Premium & Yield Predictor Engine.
> **Last Updated:** 02 March 2026

---

## What Is MIYAR?

**MIYAR** (مِعيار — Arabic for "standard" or "benchmark") is an AI-powered **Design Intelligence Engine** for the UAE luxury real estate and interior design market.

It helps developers, investors, and interior designers make faster, better-informed decisions about high-value property fitouts and design briefs — backed by live UAE market data, Gemini AI, and a deterministic scoring framework.

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

## AI Integration

- **Model:** Gemini 2.0 Flash (via `invokeLLM` wrapper)
- **Key prompts:** Design brief generation, space recommendations, design advisor, trend synthesis
- **Image generation:** Gemini image API (via `visual-gen.ts`)
- **Trend injection:** `buildTrendContext()` in `ai-design-advisor.ts` injects UAE market trends into every Gemini prompt
- **Guardrails:** AI output is always validated against market constants; cost numbers are overridden by DB data

---

## Coding Conventions

- All new tRPC procedures go in `server/routers/` — use `orgProcedure` for authenticated, `publicProcedure` for public endpoints
- All new DB queries go in `server/db.ts` as named exported async functions
- Schema changes: edit `drizzle/schema.ts` → run `npm run db:push` (uses drizzle-kit generate + migrate)
- Currency: always AED, always format with `toLocaleString()`, use `fmtAed()` helper for M/K abbreviation
- All export engines go in `server/engines/` — HTML-template approach preferred (see `board-pdf.ts`, `investor-pdf.ts`)
- Client pages use `trpc.[router].[procedure].useQuery/useMutation` — never raw fetch
- `publicProcedure` must be explicitly imported in any router file that uses it

---

## Git Workflow

- Branch: `main`
- Remote: `https://github.com/amosantan/miyar-v2`
- Commit style: `feat: Phase N — Short description` (see existing commits for pattern)
- After schema changes: always run `npm run db:push` and confirm columns with `SHOW COLUMNS FROM table_name`
