# Current Task

- ID: TR-06
- Roadmap step: `TR-06` with user-authorized `TR-07` and `TR-09` baseline repairs
- Title: Restore green TypeScript and test baselines
- Status: PASS
- Owner: Codex
- Started: 2026-07-16
- Risk: High, spanning client contracts, ingestion, deterministic confidence, authentication tests, and reports
- Selected loops: Defect loop, ingestion loop, and report loop from `LOOP_ENGINEERING.md`
- Retry budget: 3 evidence-based attempts per failure class
- Approval gates: no schema/migration application, shared database access, scoring-policy changes beyond the approved RICS rule, commit, push, deployment, or protected-branch action

## Goal

Resolve all 52 reproduced TypeScript diagnostics and all nine reproduced test failures without broad suppression, weakened assertions, external database access, or disturbance to unrelated worktree changes.

## Locked Decisions

- Empty floor plans return a neutral score of 50 with no recommendations and zero counts.
- RICS confidence remains Grade A base 0.85 plus 0.10 for publications no older than 90 days, with deterministic test time.
- Material Board Annex appears in design briefs and full reports, including an explicit empty state.

## Acceptance Criteria

- [x] `pnpm check` exits 0 without ignores or broad casts introduced to silence diagnostics.
- [x] SCAD PDF connector resolves under ESM and uses the typed `pdf-parse` API.
- [x] Ingestion extraction utilities safely normalize union message content and Set/source iteration.
- [x] Outcome decimal values and seeded design briefs match persistence contracts.
- [x] Connector, board-report, space-program, and authentication regression tests pass.
- [x] `DATABASE_URL='' pnpm test` exits 0 without an external database connection.
- [x] Production build passes while preserving the pre-task `api/index.js` worktree content.
- [x] Populated and empty design-brief PDFs render without annex layout defects.
- [x] Existing migration, runtime-safety, authorization, client-performance, learning-router, and generated-bundle changes remain preserved.
- [x] Roadmap, known failures, project state, worklog, and lessons reflect only verified results.

## Baseline Evidence

- Branch: `codex/loop-engineering-architecture` at `a7b1510` plus existing uncommitted work.
- `pnpm check`: FAIL, 52 diagnostics.
- `DATABASE_URL='' pnpm test`: FAIL, 9 tests; 854 passed and 22 skipped.
- Existing dirty files before this task: `api/index.js`, `client/src/App.tsx`, `drizzle/meta/_journal.json`, `server/_core/index.ts`, `server/routers/learning.ts`, migration `0044`, and runtime-safety files.

## Plan

- [x] Repair server/data/ingestion contracts and the nine failing tests.
- [x] Repair causal tRPC/database output typing and remaining client render boundaries.
- [x] Run targeted and full verification plus PDF visual QA.
- [x] Review the complete diff and update durable state from evidence.

## Completion Evidence

- `pnpm check`: PASS with zero diagnostics.
- `DATABASE_URL='' pnpm test`: PASS; 867 passed and 22 skipped across 39 files, with no database connection.
- `pnpm build`: PASS for client, Node server, and serverless targets; the pre-task `api/index.js` was restored after verification.
- `pnpm audit:authorization`: PASS; 327 procedures and 140 remediation rows after refreshing source locations.
- Targeted SCAD connector tests: PASS for typed PDF extraction, parser cleanup, and HTML fallback.
- Populated and empty design-brief PDFs rendered as two-page A4 artifacts and all four PNG pages passed visual inspection for annex content, clipping, spacing, disclaimer, provenance, and footer.
- Scoped `git diff --check` excluding the recorded user-owned dirty files: PASS.
- No commit, push, deployment, migration application, or shared database action was performed.

## Next Action

Resume `TR-03 — Authorize the design-domain router`.
