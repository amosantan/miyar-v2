# MIYAR — TODO Roadmap

> **Frame**: Every item is prioritized by **investor impact** — does it help close a deal, win a board, or defend a number?

Last updated: 2026-02-28 · Post Phase 5

---

## Priority Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 | Critical — blocks investor from completing their workflow |
| 🟠 | High — significantly improves investor experience |
| 🟡 | Medium — enhances product quality or coverage |
| 🟢 | Nice-to-have — future differentiation |

---

## 🔴 Critical (Do Next)

### C-1 · Run Outstanding DB Migration
```bash
npm run db:push  # Applies share_token + share_expires_at to ai_design_briefs
```
> Status: Schema updated in code but `drizzle migrate` fails because it replays all migrations. Fixed by running the two SQL statements directly (done in Phase 5). Verify with `SHOW COLUMNS FROM ai_design_briefs`.

### C-2 · Wire `/projects/:id/investor-summary` into ProjectDetail Navigation
- The Investor Summary page exists but the link from `ProjectDetail.tsx` should be prominent
- Add a dedicated **"Investor Brief"** CTA card in the project hub, not just a header button
- Target: investor clicks a project, sees "Generate Investor Brief" as the #1 action

### C-3 · End-to-End Flow Smoke Test
Test the full investor workflow:
1. Create project → enter 6 parameters
2. Generate design recommendations (AI Advisor)
3. View Investor Summary (A–E sections + Section E market intelligence)
4. Click "Export PDF" → printable brief opens in new tab
5. Click "Share Link" → token link copied
6. Open `/share/:token` in incognito → full read-only brief loads

---

## 🟠 High Priority

### H-1 · DOCX Export Enhancement (`docx-brief.ts`)
The current DOCX includes 6 narrative sections but **no cost tables or numbers**. Investors need the numbers in Word too.
- Add **material cost table** (product / brand / AED/m² / room)
- Add **budget summary table** (space / allocation % / AED)
- Add benchmark comparison row in the budget section
- Add MIYAR Score snapshot in the appendix

### H-2 · Share Link Management UI
Currently users can generate a share link but can't see, revoke, or renew existing ones.
- Add "Active share links" panel in project settings
- Show: token preview, created date, expiry, link URL
- Add "Revoke" and "Extend 7 days" actions
- `design.revokeShareLink` + `design.extendShareLink` tRPC mutations needed

### H-3 · Project Onboarding → Auto-Brief Generation
New users don't know they need to run AI Advisor before seeing results.
- After project creation, show a guided checklist: "Generate Recommendations → View Investor Summary → Export"
- Auto-trigger `generateRecommendations` on first project visit if no recs exist

### H-4 · Investor Summary PDF Watermark Branding
The PDF currently shows "MIYAR Document ID: MYR-INV-xxxx". For enterprise clients:
- Allow org-level logo upload → embedded in PDF cover
- Allow custom watermark text (e.g., "INTERNAL — Not for Distribution")
- Store in `organizations` table (`logoUrl`, `pdfBranding` columns)

### H-5 · Benchmark Data Coverage Expansion
Currently `benchmarkData` has limited rows. The benchmark overlay in BriefEditor often falls back to generic data.
- Run ingestion pipeline to populate more rows for: Dubai Marina, Palm Jumeirah, DIFC, Downtown Dubai, Al Barari, Jumeirah Bay
- Add `npm run ingestion:run` cron for weekly refresh
- Goal: 95%+ of project combinations get an exact benchmark match (no fallback)

---

## 🟡 Medium Priority

### M-1 · MIYAR Score → Investor Summary Integration
The scoring engine (`scoring.ts`) computes SA/FF/MP/DS/ER scores but they're **not shown in the Investor Summary**.
- Add "Section F — MIYAR Score" with 5-dimension radar/bar chart
- Each score dimension with explainability text (pulled from `explainability_drivers`)
- Risk flags (FIN_SEVERE, COMPLEXITY_MISMATCH) shown as red warning banners

### M-2 · Space-Level Budget → Bar Chart Visualization
The BriefEditor sidebar and Investor Summary both show budget by space, but only as text. Add a proper horizontal bar chart component (using Recharts or pure SVG — no new deps if possible).

### M-3 · Market Intelligence Auto-Refresh Indicator
The "Market Data Sources" panel in Section E shows source names but not freshness.
- Add `lastScraped` timestamp badge per source
- Show green/amber/red freshness indicator based on age vs. expected cadence
- Warn if any A-grade source hasn't refreshed in 30+ days

### M-4 · Evidence Vault Search
`client/src/pages/EvidenceVault.tsx` — add full-text search across evidence records by keyword, material type, source, price range.
- Backed by `evidenceRecords` table which already has `extractedSnippet`, `tags`, `intelligenceType`
- Investor use case: "show me all evidence for marble pricing in Dubai Marina"

### M-5 · Portfolio Benchmarking View
Multi-asset investors have several projects — they want to compare MIYAR Scores and budgets across their portfolio.
- Enhance `PortfolioPage.tsx` with:
  - Table: project / tier / fitout budget / cost/sqm / MIYAR Score / trend
  - Aggregate stats: avg cost/sqm, best/worst score per dimension
  - Export portfolio summary as PDF

### M-6 · AI Design Brief v2 — Style Mood Board Section
Add an 8th section to `generateDesignBrief()`: **Visual Direction**
- Gemini generates 3-4 mood board reference descriptions (no actual images needed)
- List: key visual references, material textures to specify, lighting mood, comparable projects
- Added to DOCX export automatically

---

## 🟢 Nice to Have (Future Differentiation)

### N-1 · Competitive Positioning Report
Auto-generated comparison: "How does this project compare to [3 comparable launches] in [same area]?"
- Uses `competitorProjects` + `competitor_entities` tables (already seeded)
- One-click from InvestorSummary → opens a ComparativeAnalysis page

### N-2 · Real-Time Supplier Quote Integration
Allow investors to submit an RFQ directly from the material board to select UAE suppliers.
- Today: RFQ table is generated (in `BoardComposer`), but it's just exported as PDF/DOCX
- Future: direct WhatsApp/email integration with supplier contacts from `materialLibrary.supplierPhone`

### N-3 · Predictive Sales Timeline Model
Add a "When will this project sell?" projection to the ROI Bridge, using:
- Absorption rate from `benchmarkData.absorptionRate`
- Competitive density from `benchmarkData.competitiveDensity`
- Historical sell-through data from `competitorProjects`

### N-4 · Multi-Language Output (Arabic)
Export design briefs and investor summaries in Arabic for Gulf client presentations.
- MIYAR is literally Arabic (مِعيار) — the brand speaks to Arabic-first investors
- Use Gemini's Arabic generation capability for the narrative sections

### N-5 · DM Compliance Checklist Integration
The `dm_compliance_checklists` table exists but is not surfaced in any client page.
- Add a "Compliance" tab in ProjectDetail showing DM authority requirements per typology
- Link to authority approval sections in the DOCX design brief

### N-6 · Signed PDF Generation (Legal)
For 50M+ AED deals, the investor may need a digitally signed document.
- Add PDF signing via a third-party API (DocuSign or equivalent)
- Watermark becomes legally binding when signed

---

## 🛠️ Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| `drizzle-kit migrate` fails on existing tables | 🔴 | Use direct SQL for new columns instead of `npm run db:push` until fixed |
| `db.getSpaceRecommendations` requires orgId but called internally | 🟡 | Add an internal overload that skips org check |
| `ShareView.tsx` has no rate limiting on `resolveShareLink` | 🟠 | Add Redis-based rate limiter (10 req/min per token) |
| `exportInvestorPdf` assembles data in the router | 🟡 | Move assembly logic to `server/engines/investor-pdf-assembler.ts` |
| `investor-pdf.ts` doesn't escape HTML in user inputs | 🟠 | Sanitize `projectName`, `execSummary` etc. to prevent XSS in the blob URL |
| `publicProcedure` in `design.ts` — no rate limit or bot protection | 🟠 | Add IP-based rate limiting on `resolveShareLink` |

---

## 📋 Phase Summary

| Phase | Status | Commit |
|-------|--------|--------|
| Phase 1 — Audit & Connect | ✅ Complete | `a6da478` |
| Phase 2 — Investor Dashboard | ✅ Complete | `a6da478` |
| Phase 3 — Brief → Numbers | ✅ Complete | `ca40d00` |
| Phase 4 — Market Grounding | ✅ Complete | `6278c62` |
| Phase 5 — Export & Handover | ✅ Complete | `296f743` |
| Phase 6 — MIYAR Score Integration | 🎯 Next | — |
| Phase 7 — Product Polish & Portfolio | 📋 Planned | — |

---

## 🚀 MIYAR v3 — The Authority Engine

| Phase | Status | Notes |
|-------|--------|-------|
| Phase A — Wire What We Have | ✅ Complete | NL query, stress test viz, evidence chains, freshness badges |
| Phase B — Infrastructure for Live Data | ✅ Complete | Scheduler, connector health, DLD API integration |
| Phase C — Data Expansion | ✅ Complete | SCAD PDF scraper, benchmark scaling, synthetic gap-fill |
| Phase D — Governance & Compliance | ✅ Complete | Estidama/Al Sa'fat, audit trails, methodology page, cert-aware pricing |
| Phase E — Scale Features | ✅ Complete | Portfolio benchmarking, mobile share views, RICS NRM alignment |

