# MIYAR — Progress Log

> **Frame**: Every feature is described from the **investor's perspective** —  
> *how does it help a UAE luxury real estate developer or investor go from project parameters to a board-ready investment decision?*

Last updated: 2026-02-28 · Codebase at commit `296f743`

---

## ✅ Phase 1 — Audit & Connect · `a6da478`

### What This Unlocked for the Investor

Before this phase, the `material_constants` table existed in PlanetScale with real UAE AED/m² prices — but **nothing in the app ever used it**. The investor had no way to see material-level cost breakdowns.

### What Was Built

| Component | Impact |
|-----------|--------|
| `getMaterialConstants()` DB function | Makes 9 seeded material types queryable (stone, glass, steel, aluminum, concrete, ceramic, wood, paint, insulation) |
| `design.getMaterialConstants` tRPC endpoint | Frontend can now display UAE market prices per material |
| `design.calculateSpec` mutation | Input: material type + area → Output: total cost AED, total CO₂, sustainability grade (A–E), maintenance factor |

### Investor Outcome
> Investor can now see **what specific materials cost in the UAE market** and get an instant sustainability grade for any material mix — in seconds, without hiring a quantity surveyor.

---

## ✅ Phase 2 — Investor Dashboard · `a6da478`

### What This Built for the Investor

The **Investor Summary page** (`/projects/:id/investor-summary`) — the central product output. A professional, board-presentable view of a project's full design and financial intelligence.

### Sections

| Section | Investor Value |
|---------|----------------|
| **A · Design Identity** | Confirms typology, style, tier, executive summary - the narrative investors present to boards |
| **B · Material Specification** | Line-by-line material list from AI recommendations + AED/m² reference table (so investors can validate supplier quotes) |
| **C · Budget Synthesis** | Total fitout budget, cost/sqm, visual budget bar chart by room — the key number investors need |
| **D · ROI Bridge** | Sustainability grade + premium sale uplift estimate — the answer to "what does this design investment return?" |

### Investor Outcome
> An investor who enters 6 parameters (typology, GFA, tier, style, location, horizon) can now walk into a board meeting with a structured, branded summary that answers: **how much does this fitout cost, and what does it earn back?**

---

## ✅ Phase 3 — Brief → Numbers · `ca40d00`

### What This Built for the Investor

Connected the **AI design brief** to real AED costs. Before this, the 7-section brief was text only. Now every brief carries `pricingAnalytics` — a structured cost envelope derived from UAE market constants.

Added the **Brief Editor** — an interactive material cost calculator where investors can adjust their material mix and see costs recalculate in real time.

### What Was Built

| Component | Investor Value |
|-----------|----------------|
| `PricingAnalytics` in design brief | Every brief now includes: total fitout AED, cost/sqm avg, carbon kg CO₂, sustainability grade A–E, design premium AED |
| `BriefEditor.tsx` | 9 material toggles + area sliders → live cost/carbon/grade recalc via tRPC mutation |
| ROI Bridge mini-panel | Shows maintenance indicator, sustainability grade, sales premium — positioned right next to the cost tool |
| Market Constants sidebar | UAE AED/m² reference table always visible while the investor is working through costs |

### Investor Outcome
> An investor can now **stress-test their material budget** interactively — toggle from "Italian marble" to "engineered stone," watch the cost and sustainability grade update live, and understand the trade-off before talking to any contractor.

---

## ✅ Phase 4 — Market Grounding · `6278c62`

### What This Built for the Investor

Connected three live UAE market data sources into the product workflow:
1. **Design Trends** → injected directly into Gemini AI prompts so every recommendation reflects current UAE market direction
2. **Benchmark Data** → overlaid on cost estimates so the investor knows exactly how their budget compares to the market
3. **Source Registry** → surfaces where all intelligence comes from, giving the data defensibility for board presentations

### What Was Built

| Component | Investor Value |
|-----------|----------------|
| Design trends → Gemini prompt injection | AI recommendations now reference "established UAE trends" (e.g., organic minimalism, biophilic design) rather than generic global aesthetics |
| Benchmark Overlay in BriefEditor | Shows Low/Mid/High AED/sqm from `benchmarkData` alongside the investor's working estimate — with a live ✓/↑ indicator |
| Section E — Market Intelligence in InvestorSummary | UAE Design Trends grid (confidence-coded: established/emerging/declining) + Market Data Sources panel with reliability grades (A/B/C) |

### Investor Outcome
> An investor can now confidently answer **"is my budget in line with the market?"** and **"are my material choices on-trend for this tier?"** — both backed by traceable UAE data sources they can name to a board.

---

## ✅ Phase 5 — Export & Handover · `296f743`

### What This Built for the Investor

Closed the loop from insight to **deliverable**. Three export modes now exist, matching how luxury real estate deals actually move (emails, board packs, investor forwards).

### What Was Built

| Component | Investor Value |
|-----------|----------------|
| `investor-pdf.ts` HTML PDF engine | Professional A4 investor brief (Cover + 5 sections) — equivalent to a consultant's deliverable, generated in seconds |
| `design.exportInvestorPdf` tRPC endpoint | One click → printable HTML opens in new tab → Print as PDF |
| `design.createShareLink` + `resolveShareLink` | Generates a 7-day, token-gated link to the investor brief — no login required for recipients |
| `ShareView.tsx` — `/share/:token` | Recipients see a branded, read-only version of the investor brief |
| Export DOCX button | Existing Word document export (6-section design brief) |
| Share Link button | Creates and copies the public URL in one click |

### Investor Outcome
> After completing a project analysis, the investor clicks **"Share Link"** and forwards a URL to their board, their client, or their JV partner. The recipient sees a professional, watermarked investor brief — without needing a MIYAR account. The investor looks like they hired a consulting firm. **It took 60 seconds total.**

---

## 🏗️ Platform Infrastructure (Built Across All Phases)

These aren't features — they're the foundation everything runs on:

| System | Tables / Files | What It Enables |
|--------|---------------|-----------------|
| **MIYAR Score Engine** | `scoring.ts`, `score_matrices` | 5-dimension score (SA/FF/MP/DS/ER) with explainability trace |
| **Market Ingestion Pipeline** | `ingestion/`, `ingestion_runs`, `connector_health` | Live scraping + evidence extraction from UAE sources |
| **Benchmark Pipeline** | `benchmark_proposals`, `benchmark_snapshots` | Reviewed, approved cost benchmarks from evidence records |
| **Explainability Engine** | `explainability.ts`, `explainability_drivers` | Trace *why* any score is what it is |
| **Bias Detection** | `bias/`, `bias_alerts`, `bias_profiles` | Flags optimism bias, anchoring, overconfidence in project inputs |
| **Monte Carlo Simulation** | `predictive/`, `monte_carlo_simulations` | Probabilistic cost range modeling (P5–P95) |
| **Portfolio Intelligence** | `portfolio.ts`, `portfolios` | Cross-project analytics for multi-asset investors |
| **Digital Twin** | `sustainability/`, `digital_twin_models` | Embodied carbon, operational energy, lifecycle cost modeling |
| **Autonomous Alerts** | `autonomous/`, `platform_alerts` | Platform-initiated alerts for price shocks, benchmark drift, portfolio risk |
| **Board Composer** | `board-composer.ts`, `board-pdf.ts` | Material board builder with RFQ-ready procurement schedule |
| **Scenario Engine** | `scenario.ts`, `scenarios` | Multiple scenario comparison with sensitivity analysis |

---

## Metrics at a Glance

| Metric | Value |
|--------|-------|
| Database tables | 78 |
| Server routers | 20 |
| Engine modules | 30+ |
| Client pages | 29 |
| tRPC endpoints (approx.) | 100+ |
| Export formats | 3 (DOCX, HTML/PDF, Share link) |
| Phases complete | 5 of 5 |
| Last commit | `296f743` |
