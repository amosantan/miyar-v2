# Current Task

- ID: TR-08
- Roadmap step: `TR-08`
- Title: Recertify ambiguous baseline contracts
- Status: PASS
- Owner: Codex
- Product and domain approver: Amro Saleh, acting as Product Owner and Data/Decision-model and Design/Report approver for this bounded decision
- Started: 2026-07-17
- Closed: 2026-07-17
- Branch: `codex/tr-08-contract-recertification`
- Base: `1736129bc3733356b5d105669d8adb53a46d80af` (`origin/main` after fetch)
- Risk: Medium product/data/report governance; characterization tests only
- Selected loops: Defect, ingestion, scoring/pricing, and report loops from `LOOP_ENGINEERING.md`
- Retry budget: 3 evidence-based attempts per failure class
- Resource budget: One decision record, three characterization groups, and one repository verification pass
- Approval gates: No production logic, numerical policy, API, shared type, schema, authorization, dependency, deployment, database, commit, push, or pull-request action

## Goal

Create the durable decision record originally required by TR-08, prove that the three approved baseline contracts still match current behavior, and route verified downstream ambiguity to a separately bounded TR-09 remediation without changing runtime behavior.

## Approved Contracts

- `space-empty-v1`: an empty AI floor-plan room list returns a neutral score of 50, no recommendations, and zero critical, advisory, and optimal counts.
- `ingestion-confidence-v1`: connector-derived initial confidence uses Grade A/B/C bases of 0.85/0.70/0.55; publication age through day 90 adds 0.10; days 91–365 have no adjustment; day 366 onward or a missing date subtracts 0.15; the function output is bounded to 0.20–1.00. Later quality adjustment, update merge, and non-connector ingestion remain distinct live behaviors.
- `material-board-annex-v1`: the Material Board Annex is mandatory in design briefs and full reports and renders either board content or an explicit no-board state.

The policy bundle is `TR-08-v1`, effective 2026-07-16 at verified implementation commit `db362540dbccdc621faf38ef74c3270ebee6370b` and reaffirmed by the product owner on 2026-07-17.

## Acceptance Criteria

- [x] A fresh worktree and review branch were created from current `origin/main` before task mutation; the dirty primary checkout remains untouched.
- [x] The frozen install and pre-change targeted baseline pass with 78 tests and no database connection.
- [x] TR-08 was the sole active/next step during execution and its historical closure evidence remains intact.
- [x] Accepted ADR-0003 records owners, rationale, exact examples/boundaries, affected consumers, limitations, effective versions, rejected alternatives, and supersession rules.
- [x] The ADR index references ADR-0003 and all links resolve.
- [x] Characterization tests lock the exact empty result, 90/91 and 365/366 confidence boundaries, missing-date penalty, and populated/empty annex in both design and full reports.
- [x] No production source, numerical policy, API, shared type, schema, authorization, dependency, or report-rendering behavior changes.
- [x] Reproduced downstream gaps are recorded under `KF-016` with prose-only TR-09 acceptance boundaries.
- [x] Targeted, safe full-suite, TypeScript, authorization-audit, production-build, formatting, and diff gates pass.
- [x] Independent code review and Claude Sonnet review find no unresolved blocker or hidden policy/interface choice.
- [x] Roadmap, current task, known failures, worklog, lessons, and project state reflect only verified evidence; TR-09 is the sole next step and TR-10 waits in `PLANNED`.

## Non-Goals

- Do not change the neutral value of 50 or any confidence value, grade, threshold, date boundary, cap, or floor.
- Do not add an insufficiency status, change ROI/scoring/UI behavior, or decide its eventual interface.
- Do not add confidence-policy columns or decide how initial confidence, quality adjustment, update merge, non-connector ingestion, or rejected evidence will be versioned, persisted, or presented.
- Do not change report retrieval or rendering behavior or decide its eventual API shape.
- Do not perform TR-09 remediation or TR-10 artifact certification.

## Verified Baseline

- `pnpm install --frozen-lockfile` completed from the committed lockfile.
- `DATABASE_URL='' pnpm vitest run server/engines/v9-space.test.ts server/engines/v2-connectors.test.ts server/engines/board-pdf.test.ts` passed 78/78 tests. Expected unauthorized-provider diagnostics exercised the existing rule-based fallback; no database connection occurred.
- `git cat-file -t db36254` returned `commit`.

## Plan

- [x] Add and index the accepted ADR with a decision-to-consumer trace.
- [x] Add characterization assertions without changing production code.
- [x] Record the bounded TR-09 remediation and known failure.
- [x] Run the full verification ladder and independent review.
- [x] Close durable state from verified evidence only.

## Verification Evidence

- Targeted characterization: 80/80 passed.
- Safe full suite: 1,023 passed and 22 skipped with `DATABASE_URL=''`.
- `pnpm check`, `pnpm audit:authorization` (335 procedures, zero remediation), and `pnpm build`: passed.
- Scoped documentation formatting, ADR/index/path checks, roadmap uniqueness checks, `git diff --check`, and scoped-diff review: passed.
- Independent code reviewer: `APPROVED` after exact confidence-chain, invalid-date, and board-resolution corrections.
- Claude Sonnet: `APPROVED` after the ADR explicitly recorded reachable clamp bounds, named-source grade governance, max-merge masking, and partial-board resolution.

## Delivered Scope

- Accepted and indexed ADR-0003 for `TR-08-v1` at implementation commit `db362540dbccdc621faf38ef74c3270ebee6370b`.
- Strengthened characterization only; no production source or runtime contract changed.
- Opened `KF-016` and returned TR-09 to `READY` with prose-only behavioral acceptance boundaries.
- Kept TR-10 `PLANNED` until TR-09 closes.

## Next Action

Plan reopened TR-09 as the sole next executable roadmap step. Its first gate is an approved behavioral design for the distinctions recorded in KF-016; TR-08 does not choose implementation interfaces.
