---
name: miyar-analytics
description: >
  Use when working on trend detection, market positioning, competitor intelligence,
  insight generation, or the Analytics Intelligence Dashboard.
---

# MIYAR Analytics Engine Guide

## Files
- server/engines/analytics/trend-detection.ts — detectTrends(), moving average, anomalies
- server/engines/analytics/market-positioning.ts — computeMarketPosition(), P25/P50/P75/P90 tiers
- server/engines/analytics/competitor-intelligence.ts — HHI, analyseCompetitorLandscape()
- server/engines/analytics/insight-generator.ts — 5 deterministic triggers, generateInsights()

## Insight Trigger Rules (deterministic — no LLM for triggers)
- cost_pressure: material cost rising >10% (30-day MA)
- market_opportunity: <3 competitors + fragmented HHI
- competitor_alert: new competitor project in same segment
- trend_signal: significant direction change detected
- positioning_gap: project outside P25–P75 range

## Confidence Rules
- High: ≥15 data points, ≥2 Grade A sources
- Medium: 8–14 points OR <2 Grade A
- Low: 5–7 points
- Insufficient: <5 points — return insufficient_data, never crash
- Tests in: v3-analytics.test.ts
