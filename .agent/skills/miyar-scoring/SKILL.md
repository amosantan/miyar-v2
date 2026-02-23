---
name: miyar-scoring
description: >
  Use when modifying the MIYAR scoring engine, normalization functions,
  explainability engine, or any of the 5 dimension computations (SA, FF, MP, DS, ER).
  Also use when changing Logic Registry weights, thresholds, or buildEvalConfig().
---

# MIYAR Scoring Engine Guide

## Files
- server/engines/scoring.ts — 5 dimension functions + penalty system
- server/engines/normalization.ts — normalizeInputs(), costVolatility
- server/engines/explainability.ts — generateExplainabilityReport()
- server/routers/project.ts — evaluate mutation, buildEvalConfig()
- drizzle/schema.ts — scoreMatrices table

## Rules
- Never hardcode weights — always use buildEvalConfig() from Logic Registry
- costVolatility = (1-exe01_n)*0.5 + (1-fin03_n)*0.5 — both terms inverted
- Composite = weighted sum of 5 dimension scores
- RAS = composite - 0.35 × risk
- Tests in: scoring.test.ts, v15-bugfixes.test.ts
