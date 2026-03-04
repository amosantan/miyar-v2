# MIYAR V3 — Analytical Intelligence Engine: Phase Reality Report

**Date:** 2026-02-21
**Phase:** V3 (Analytical Intelligence)
**Status:** All 11 gated tasks complete
**Test Count:** 357 passing (target ≥ 350)
**TypeScript Errors:** 0

---

## 1. Scope Delivered

V3 transforms MIYAR from a data-collection platform into an analytical intelligence system. Where V2 built the ingestion pipeline (12 UAE connectors, orchestrator, scheduler), V3 adds four analytics engines that consume ingested evidence and produce actionable insights. The phase also upgrades V2's mock connectors to real HTTP scraping with LLM extraction, adds source health monitoring, and implements incremental ingestion.

| Task | Description | Status |
|------|-------------|--------|
| V3-01 | Replace mock data with real HTTP scraping in all 12 connectors | Complete |
| V3-02 | Per-connector source health monitoring table + UI | Complete |
| V3-03 | Incremental ingestion with lastSuccessfulFetch | Complete |
| V3-04 | Trend Detection Engine (moving average, direction, anomalies) | Complete |
| V3-05 | Trend Detection tRPC endpoints + trendSnapshots table | Complete |
| V3-06 | Market Positioning Analytics Engine (percentiles, tiers) | Complete |
| V3-07 | Competitor Intelligence Analytics Engine (HHI, threat levels) | Complete |
| V3-08 | Insight Generation Engine (5 deterministic triggers) | Complete |
| V3-09 | Integrate insights into project evaluation flow | Complete |
| V3-10 | Analytics Intelligence Dashboard UI (4-panel layout) | Complete |
| V3-11 | Full V3 test suite (80 new tests, 357 total) | Complete |

---

## 2. Architecture

### 2.1 Analytics Engine Layer

Four independent engines live under `server/engines/analytics/`, each consuming evidence records from the database and producing structured output. No engine depends on another engine's output — they can run independently or be composed in a pipeline.

```
Evidence Vault (DB)
       │
       ├──▶ Trend Detection Engine
       │      computeMovingAverage() → detectDirectionChange() → flagAnomalies()
       │      assessConfidence() → generateNarrative() [LLM optional]
       │
       ├──▶ Market Positioning Engine
       │      computePercentiles() → assignTier() → computePercentileRank()
       │      computeMarketPosition()
       │
       ├──▶ Competitor Intelligence Engine
       │      computeHHI() → classifyConcentration()
       │      analyseCompetitorLandscape() → generateNarrative() [LLM optional]
       │
       └──▶ Insight Generation Engine
              5 deterministic triggers → generateInsights()
              LLM for body + recommendation only [optional]
```

### 2.2 LLM Boundary (Unchanged from V2)

LLM is permitted only for:
- Extracting structured data from unstructured HTML (connectors)
- Generating narrative summaries (trend detection, competitor analysis)
- Writing insight body + actionable recommendation text

LLM is never used for: scoring, weighting, ranking, confidence computation, tier assignment, HHI calculation, or any numerical operation.

### 2.3 Database Schema (47 Tables)

V3 added 3 new tables to the existing 44:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `connector_health` | Per-connector success/failure tracking per run | sourceId, runId, status, responseTimeMs, errorMessage |
| `trend_snapshots` | Persisted trend analysis results | metric, category, geography, direction, confidence, snapshotData |
| `project_insights` | Generated insights linked to projects | projectId, type, severity, title, body, confidenceScore, status |

Additionally, `source_registry` gained two new columns: `last_successful_fetch` (timestamp) and `is_active` (boolean).

---

## 3. Engine Specifications

### 3.1 Trend Detection Engine (390 lines)

Computes time-series trends from evidence records using deterministic moving average analysis.

| Function | Purpose | Key Parameters |
|----------|---------|----------------|
| `computeMovingAverage()` | Rolling average over configurable window | window = 30 days (default) |
| `detectDirectionChange()` | Compares current vs prior window MA | threshold = 5% |
| `flagAnomalies()` | Points > 2σ from moving average | σ threshold = 2.0 |
| `assessConfidence()` | Deterministic confidence from data quality | high ≥15pts + ≥2 Grade A |
| `detectTrends()` | Full orchestration with optional LLM narrative | — |

Direction classification: **rising** (>+5%), **falling** (>-5%), **stable** (±5%), **insufficient_data** (<2 points).

Confidence levels: **high** (≥15 points + ≥2 Grade A), **medium** (8–14 points), **low** (5–7 points), **insufficient** (<5 points).

### 3.2 Market Positioning Engine (206 lines)

Positions a target budget against the market distribution of fitout rates.

| Function | Purpose | Output |
|----------|---------|--------|
| `computePercentiles()` | P25/P50/P75/P90 from value array | PercentilesResult |
| `assignTier()` | Budget → tier based on percentile boundaries | budget / mid_range / premium / ultra_premium |
| `computePercentileRank()` | Where target sits in the distribution | 0–100 |
| `computeMarketPosition()` | Full positioning with price gaps | MarketPositionResult |

Tier boundaries: **budget** (<P25), **mid_range** (P25–P50), **premium** (P50–P75), **ultra_premium** (>P75).

The 650 AED/sqm test case from the authorization document is covered by a dedicated test that verifies correct tier assignment and percentile ranking against a 20-point dataset.

### 3.3 Competitor Intelligence Engine (294 lines)

Analyses the competitive landscape using Herfindahl-Hirschman Index and developer market share.

| Function | Purpose | Output |
|----------|---------|--------|
| `computeHHI()` | Sum of squared market shares | 0.0–1.0 |
| `classifyConcentration()` | HHI → concentration label | fragmented / moderate / concentrated |
| `analyseCompetitorLandscape()` | Full analysis with developer profiles | CompetitorLandscapeResult |

Concentration thresholds: **fragmented** (HHI < 0.15), **moderate** (0.15–0.25), **concentrated** (> 0.25).

Threat levels per developer: **high** (≥15% market share), **medium** (5–15%), **low** (<5%).

### 3.4 Insight Generation Engine (395 lines)

Produces actionable insights from analytics results using 5 deterministic triggers.

| Insight Type | Trigger Condition | Severity |
|-------------|-------------------|----------|
| `cost_pressure` | Material cost rising >10% | warning (>10%) / critical (>20%) |
| `market_opportunity` | <3 competitors OR fragmented market + rising trends | info |
| `competitor_alert` | ≥1 high-threat developer detected | warning (<3) / critical (≥3) |
| `trend_signal` | Any non-stable direction with >5% change | info (rising) / warning (falling) |
| `positioning_gap` | Target below P25 or above P75 | info (below) / warning (above) |

Each insight includes: type, severity, title, body (LLM-optional), actionableRecommendation (LLM-optional), confidenceScore, triggerCondition, and dataPoints.

---

## 4. Ingestion Upgrades (V3-01 through V3-03)

### 4.1 Real HTTP Scraping (V3-01)

All 12 connectors now make real HTTP GET requests to their target URLs. A shared `HTMLSourceConnector` base class provides:
- `extractViaLLM()`: sends truncated HTML (first 8,000 chars) to LLM with a structured extraction prompt
- JSON schema enforcement in LLM response for reliable parsing
- Graceful fallback when LLM returns malformed JSON

URL reachability audit (8 of 12 reachable from sandbox):

| Source | Status | Fallback |
|--------|--------|----------|
| RAK Ceramics | 200 OK | — |
| Porcelanosa | 200 OK | — |
| Emaar Properties | 200 OK | — |
| DAMAC Properties | 200 OK | — |
| Nakheel Properties | 200 OK | — |
| JLL MENA | 200 OK | — |
| Dubai Statistics Center | 200 OK | — |
| Hafele UAE | 200 OK | — |
| DERA Interiors | DNS failure | Error captured, orchestrator continues |
| Dragon Mart | Connection refused | Error captured, orchestrator continues |
| RICS | 403 Forbidden | Error captured, orchestrator continues |
| GEMS Building Materials | DNS failure | Error captured, orchestrator continues |

### 4.2 Source Health Monitoring (V3-02)

The `connectorHealth` table records one row per connector per ingestion run, tracking:
- HTTP status code and response time (ms)
- Success/failure status with error messages
- Records extracted count

Three tRPC endpoints expose health data: `getRunHealth`, `getSourceHealth`, `getHealthSummary`. The Ingestion Monitor UI displays a Source Health Dashboard card with success rates and average response times.

### 4.3 Incremental Ingestion (V3-03)

The `lastSuccessfulFetch` column on `sourceRegistry` enables incremental ingestion:
- Before each connector run, the orchestrator reads the timestamp and sets it on the connector
- The LLM extraction prompt includes a "only extract data published after {date}" instruction
- After a successful run, the timestamp is updated
- Combined with existing duplicate detection (SHA-256 hash), this minimizes redundant evidence

---

## 5. UI Additions

### 5.1 Analytics Intelligence Dashboard (641 lines)

A new page at `/market-intel/analytics` with 4 tabbed panels:

| Panel | Content | Data Source |
|-------|---------|-------------|
| Market Trends | Category cards with direction arrows, magnitude, confidence badges | `analytics.getTrends` |
| Market Position | Tier visualization, percentile bar, price gap table | `analytics.getMarketPosition` |
| Competitor Landscape | HHI gauge, developer share table, threat badges, price distribution | `analytics.getCompetitorLandscape` |
| Insight Feed | Filterable insight cards with severity badges, acknowledge/dismiss actions | `analytics.getProjectInsights` |

All panels include proper loading skeletons and empty-state messages.

### 5.2 Ingestion Monitor Enhancements (607 lines)

The existing Ingestion Monitor gained a Source Health Dashboard card showing per-connector success rates and response times, with color-coded health indicators.

---

## 6. Test Coverage

V3 added 80 new tests in `v3-analytics.test.ts`, bringing the total to 357 across 13 test files.

| Test File | Tests | Focus |
|-----------|-------|-------|
| `v3-analytics.test.ts` | 80 | All 4 analytics engines + freshness + E2E pipeline |
| `v2-connectors.test.ts` | 43 | Connector registry, extraction, normalization |
| `v2-resilience.test.ts` | 51 | Orchestrator resilience, freshness, scheduler |
| `market-intelligence.test.ts` | 48 | Market intel tRPC procedures |
| `scoring.test.ts` | 45 | Scoring engine |
| `validation.test.ts` | 24 | Validation engine |
| `project.test.ts` | 20 | Project CRUD |
| `auth.logout.test.ts` | 1 | Auth baseline |
| Other test files | 45 | Competitor, evidence vault, etc. |
| **Total** | **357** | — |

V3 test breakdown by engine:

| Engine | Tests | Key Scenarios |
|--------|-------|---------------|
| Trend Detection | 21 | MA computation, direction (rising/falling/stable/insufficient), anomaly detection, confidence levels |
| Market Positioning | 16 | Percentile computation, all 4 tier assignments, 650 AED/sqm test case, edge cases |
| Competitor Intelligence | 14 | HHI (monopoly/duopoly/fragmented), concentration classification, threat levels, price distribution |
| Insight Generation | 21 | All 5 triggers + no-trigger cases, combined scenarios, severity ordering |
| Freshness Integration | 8 | Fresh/aging/stale boundaries, weight multipliers, string input |

---

## 7. Metrics Summary

| Metric | Value |
|--------|-------|
| Total lines of code (project) | 44,487 |
| V3 engine code | 1,285 lines (4 engines) |
| V3 router code | 669 lines (analytics + ingestion) |
| V3 test code | 1,224 lines |
| V3 UI code | 1,248 lines (2 pages) |
| Database tables | 47 |
| Database migrations | 15 |
| tRPC endpoints (analytics) | 10 |
| Connectors (live HTTP) | 12 |
| Tests passing | 357 / 357 |
| TypeScript errors | 0 |
| Test files | 13 |

---

## 8. Known Limitations

1. **node-cron v4 `getNextRun()` bug**: The `getNextRun()` method returns incorrect dates for day-of-week expressions. The scheduled task fires correctly; only the "next run" display in the UI may show an inaccurate date. A manual computation fallback is in place.

2. **4 unreachable sources**: DERA Interiors, Dragon Mart, RICS, and GEMS Building Materials are unreachable from the sandbox (DNS/403). The orchestrator handles these gracefully — they log errors and continue without crashing. In production with proper DNS, some may become reachable.

3. **LLM extraction quality**: Real HTML extraction via LLM depends on page structure. Pages with heavy JavaScript rendering (SPAs) may return minimal content. The 8,000-character truncation may miss relevant data on very long pages.

4. **Insight generation is synchronous**: The `generateInsights()` call in `project.evaluate` runs inline (wrapped in try/catch). For projects with large evidence vaults, this could add latency. Consider moving to a background job if evaluation time exceeds 5 seconds.

---

## 9. Recommended Next Steps (V4 Candidates)

1. **Real-time WebSocket updates** — Push ingestion progress and new insights to the dashboard without polling.
2. **Scenario modeling** — "What-if" analysis: adjust budget/geography/typology parameters and see how positioning and insights change.
3. **Historical trend comparison** — Compare current trends against 6-month and 12-month historical baselines.
4. **PDF report generation** — Export analytics dashboard as a branded PDF for stakeholder distribution.
5. **Notification triggers** — Send owner notifications when critical insights are generated (cost_pressure critical, competitor_alert critical).
