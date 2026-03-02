# MIYAR — Coding Conventions

## LLM Boundary (CRITICAL — never violate)
LLM is permitted ONLY for:
- Extracting structured data from unstructured HTML (ingestion connectors)
- Generating narrative summary text (trend reports, insight bodies)

LLM is NEVER used for:
- Scoring, weighting, or ranking
- Confidence computation or grade assignment
- Any numerical calculation or aggregation
- Benchmark values or threshold decisions

All scoring, normalization, statistics, and thresholds are DETERMINISTIC engines.

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
Run `pnpm test` to verify. Current baseline: 476+ passing.

## Database Migrations
Never manually edit schema without generating a migration: `pnpm db:push`
