# MIYAR — Project Memory

## What MIYAR Is
MIYAR is a design decision intelligence platform for UAE property developers and interior designers.
It scores and validates design briefs before procurement begins.
It is NOT a property investment tool. It is a tool for developers and designers.

## Current State: Phase 9 Complete — Phase 10 Next

| Phase | Name | Status |
|-------|------|--------|
| V1 | Core scoring engine | ✅ |
| V1.5 | Production readiness, bug fixes | ✅ |
| V2 | Live market ingestion engine (12 UAE connectors) | ✅ |
| V3 | Analytical intelligence (trend detection, market positioning, competitor intelligence) | ✅ |
| V4 | Predictive & cost modeling (Monte Carlo, evidence vault, outcome prediction) | ✅ |
| Phase 5 | Export & handover (PDF, DOCX, share links) | ✅ |
| Phase 6 | Deep analytics & scope refinement (7 strategic variables, compounding multipliers) | ✅ |
| Phase A | Evidence chain click-through, data freshness badges | ✅ |
| Phase B | DLD analytics engine (578K+ records), connector health dashboard | ✅ |
| Phase C | Data expansion (150+ benchmarks, SCAD scraper, synthetic generator) | ✅ |
| Phase D | Governance & compliance (Estidama/Al Sa'fat, audit logs, sustainability multipliers) | ✅ |
| Phase E | Portfolio benchmarking, RICS NRM alignment, mobile share views | ✅ |
| Phase 7 | Deep Analytics (trend detection, bias detection, digital twin) | ✅ |
| Phase 8 | Real-World Procurement & Material Intelligence (live supplier catalogs, vendor matching, carbon profiling) | ✅ |
| Phase 9 | AI Design Visualization (mood board generation, space planning & ratios, floor plan analysis) | ✅ |
| **Phase 10** | **Sales Premium & Yield Predictor Engine** | 🔴 NEXT |

## Phase 10 — What to Build
*Goal: Prove to developers that investing in higher quality design directly pays off in final sale or rental yield.*
1. **DLD Live Integration** — Cross-reference project's MIYAR design score against live neighborhood transaction data
2. **Value-Add Calculation Engine** — Dynamic ROI bridges: "invest +500 AED/sqm into Fully Furnished → rental yield 6.5% → 8.2%"
3. **Brand-Equity Forecasting** — Trophy Asset halo-effect: mathematically justify elastic budgets via portfolio valuation analysis

### Key existing assets for Phase 10:
- `server/engines/dld-analytics.ts` — `computeYield()`, `computeMarketPosition()`, `getAreaSaleMedianSqm()`, `computeFitoutCalibration()` all exist
- 578K+ DLD records (transactions + rents + projects) already in DB
- `server/engines/roi.ts` — cost avoidance ROI engine (different angle — platform ROI, not fitout investment ROI)
- `server/routers/economics.ts` — ROI calculator, risk evaluator, stress tester, scenario ranking

### What's missing:
- `server/engines/value-add-engine.ts` — the core Phase 10 formula (fitout investment → yield uplift curve)
- `server/routers/salesPremium.ts` — `getValueAddBridge`, `getBrandEquityForecast` endpoints
- Frontend panel on InvestorSummary showing dynamic ROI bridge with sliders

## 5 Scoring Dimensions (NEVER change these weights without Logic Registry)
- SA: Strategic Alignment (str01, str02, str03)
- FF: Financial Feasibility (fin01, fin02, fin03, fin04)
- MP: Market Positioning (mkt01, mkt02, mkt03)
- DS: Differentiation Strength (des01–des05)
- ER: Execution Risk (exe01–exe04)

## Decision Thresholds
- validated: composite ≥ 75 AND risk ≤ 45
- not_validated: composite < 60 OR risk ≥ 60
- conditional: everything between

## System Stats (as of Phase 9 complete)
- Database: 82+ tables, TiDB (mysql2), Drizzle ORM
- Tech Stack: React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + AWS S3
- Tests: 476+ passing (vitest)
- Server routers: 20
- Engine modules: 40+
- Client pages: 32
- tRPC endpoints: 120+
- DLD records ingested: 578K+
- Compliance checks: 38 (20 Estidama + 18 Al Sa'fat)
- GitHub: https://github.com/amosantan/miyar-v2
