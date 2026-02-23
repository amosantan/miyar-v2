---
name: miyar-ingestion
description: >
  Use when working on market data ingestion, source connectors, the orchestrator,
  scheduler, evidence records, freshness logic, or connector health monitoring.
---

# MIYAR Ingestion Engine Guide

## Files
- server/engines/ingestion/connector.ts — BaseSourceConnector, fetch with retry
- server/engines/ingestion/connectors/index.ts — 12 UAE source connectors
- server/engines/ingestion/orchestrator.ts — parallel execution, duplicate detection
- server/engines/ingestion/scheduler.ts — node-cron weekly (Monday 06:00 UTC)
- server/engines/ingestion/freshness.ts — green/amber/red staleness logic

## Rules
- LLM used ONLY in extractViaLLM() for HTML parsing — never for grade/confidence
- Grade assignment: A = government/research, B = trade supplier, C = design firm
- Confidence: base A=0.85, B=0.70, C=0.55 ± recency adjustments
- Max 3 concurrent connectors in orchestrator
- Duplicate detection: sourceId + sourceUrl + DATE(captureDate)
- Tests in: v2-connectors.test.ts, v2-resilience.test.ts
