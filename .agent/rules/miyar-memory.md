# MIYAR — Project Memory

## What MIYAR Is
MIYAR is a design decision intelligence platform for UAE property developers and interior designers.
It scores and validates design briefs before procurement begins.
It is NOT a property investment tool. It is a tool for developers and designers.

## Current State: V3 Complete
- V1: Core scoring engine ✅
- V1.5: Production readiness, bug fixes ✅
- V2: Live market ingestion engine (12 UAE connectors) ✅
- V3: Analytical intelligence (trend detection, market positioning, competitor intelligence, insights) ✅
- V4: Predictive & cost modeling — NEXT

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

## Database: 47 tables, TiDB (mysql2), Drizzle ORM
## Tech Stack: React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + AWS S3
## Tests: 357 passing (vitest)
## GitHub: https://github.com/amosantan/miyar-v2
