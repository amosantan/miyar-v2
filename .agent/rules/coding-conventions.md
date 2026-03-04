# MIYAR 3.0 — Coding Conventions

## LLM Boundary (CRITICAL — never violate)
LLM (Gemini) is permitted ONLY for:
- Extracting structured data from unstructured HTML (ingestion connectors, supplier scraping)
- Generating narrative summary text (trend reports, insight bodies, design briefs)
- Multimodal intake analysis: interpreting images/PDFs/audio/URLs → form field suggestions with confidence scores
- Design advisor: per-room material, style, and spatial recommendations
- Material allocation suggestions: Gemini suggests material splits per surface (e.g. 65% marble / 35% timber) — these are SUGGESTIONS only, developer can override, cost math runs separately in TypeScript
- Conversational chat: intake assistant responding to developer messages (max 2–3 sentences)
- Supplier price extraction: parsing scraped HTML → extracting AED price ranges

LLM is NEVER used for:
- Scoring, weighting, or ranking (scoring engine is always deterministic TypeScript)
- Grade assignment (A/B/C finish grades are rule-based, not AI)
- Any numerical calculation or aggregation (cost totals, surface areas, yield math = pure TypeScript)
- Benchmark values or threshold decisions (Logic Registry only)
- Overriding explicit developer inputs (fin01BudgetCap, ctx03Gfa, city — developer owns these always)

All scoring, normalization, statistics, surface area calculations, and cost math are DETERMINISTIC engines. Gemini provides SUGGESTIONS and TRANSLATIONS — never final computed values.

## Logic Registry Rule
NEVER hardcode scoring weights or decision thresholds.
Always read published Logic Version via `buildEvalConfig()` in project.ts.
All evaluations must store logic_version_id in scoreMatrices.

## costVolatility Formula (verified fix — do not revert)
const costVolatility = ((1 - exe01_n) * 0.5 + (1 - fin03_n) * 0.5);
High supply chain readiness REDUCES volatility. Both terms must be inverted.

## No localStorage
Never use localStorage or sessionStorage. Use React state only.

## Type Safety
No `any` types on scoring, normalization, explainability, or analytics engine interfaces.
Run `pnpm check` (tsc --noEmit) before declaring any task complete.

## Test Requirement
Every new engine function requires unit tests.
Run `pnpm test` to verify. Current baseline: 800 passing / 830 total (8 pre-existing fail, 22 skip) as of MIYAR 3.0 Phase B.

## Database Migrations
Never manually edit schema without generating a migration: `pnpm db:push`
