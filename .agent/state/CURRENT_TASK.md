# Current Task

- ID: TR-05
- Roadmap step: `TR-05`
- Title: Isolate learning and prediction data by organization
- Status: PASS
- Owner: Codex
- Started: 2026-07-16
- Closed: 2026-07-17
- Branch: `codex/tr-05-data-isolation`
- Base: `7b3866b`
- Risk: Critical tenant data-influence, derived-data provenance, API, schema, and background-job work
- Selected loop: Data/security defect loop with deterministic and real-SQL isolation verification
- Retry budget: 3 evidence-based attempts per failure class
- Resource budget: One bounded roadmap step; stop before production migration, data promotion, deployment, or pooled-cohort activation
- Approval gates: shared/production migration, data classification or public promotion, deployment, push/merge, and any pooled learning activation require separate approval

## Goal

Ensure organization calculations use only records owned by the current organization plus explicitly governed platform-public UAE evidence. Other-organization and legacy-unscoped records must have zero influence on predictions, comparisons, recommendations, and derived trends.

## Locked Decisions

- Corpus scopes are `organization`, `platform_public`, and `legacy_unscoped`.
- Tenant calculations use policy `org-public-v1`; governed shared evidence uses `public-v1`; historical unknown rows use `legacy-v0`.
- Null ownership does not prove public governance.
- Tenant trend detection remains available but writes organization-owned snapshots. Platform-public trend generation is admin/ingestion-only.
- Insufficient safe data is returned explicitly; MIYAR does not silently pool tenants.
- Pooled anonymized learning is hard-disabled. A future implementation requires consent, anonymization, at least 10 organizations and 30 projects, policy/version identity, and separate approval.
- Scoring weights, prediction formulas, financial assumptions, and confidence thresholds do not change.
- Historical unscoped data is retained but hidden from tenant calculations.
- The post-mortem derived-evidence writer is removed for this release.

## Non-Goals

- Production schema application, data backfill, public-evidence promotion, deployment, or release.
- Enabling anonymized or pooled learning.
- Changing deterministic scoring, pricing, prediction, or confidence policy.
- Repairing unrelated ingestion, UI, or reporting behavior.

## Acceptance Criteria

- [x] Corpus metadata exists on evidence and every tenant-visible or policy-influencing derived-data table named in the approved plan.
- [x] Existing rows default to `legacy_unscoped`; only explicit organization rows and exact seed-pattern allowlists receive deterministic local classification tooling.
- [x] Tenant evidence, score, outcome, project, trend, design-trend, and pattern reads use fail-closed scoped helpers.
- [x] The eight canonical TR-05 procedures cannot read or derive from another organization's records.
- [x] Predictive project routes authorize the target project before any side effect or data read.
- [x] Tenant trend snapshots are organization-owned; public trend writes require global administration or ingestion governance.
- [x] Post-mortem comparison writes are organization-locked and no derived evidence is emitted.
- [x] Pooled weekly learning reads and writes are disabled.
- [x] Insufficient-data responses expose corpus policy and safe sample counts without revealing excluded tenant data.
- [x] Authorization audit rejects tenant use of unscoped learning helpers and tenant writes to platform-public derived data.
- [x] Two-organization fixtures prove other-organization inserts and changes cannot alter the current organization's deterministic outputs.
- [x] Targeted tests, disposable MySQL isolation, safe full suite, TypeScript, authorization audit, build, diff review, browser checks, and independent Claude Code review pass.
- [x] `KF-007` closes only with objective evidence and durable roadmap/worklog/lesson updates.

## Planned Verification

- `pnpm vitest run server/routers/tr05.authorization.test.ts`
- `pnpm test:authorization:mysql`
- `pnpm audit:authorization`
- `DATABASE_URL='' pnpm test`
- `pnpm check`
- `pnpm build`
- `git diff --check`
- Browser verification of predictive, analytics, cost forecasting, design advisor, and learning administration insufficiency states
- Independent Claude Code adversarial review

## Baseline

- Live base is `7b3866b`, which includes the complete released TR-04 history and later state-only release records.
- Authorization inventory contains exactly eight `TR-05` procedures.
- `KF-007` is open.
- Production/shared mutations are not authorized by this task.

## Verification Evidence

- `DATABASE_URL='' pnpm vitest run --reporter=dot`: PASS, 962 passed and 22 skipped.
- `pnpm test:authorization:mysql`: PASS, 18/18 against disposable MySQL 8; cleanup and evidence hashes refreshed.
- `pnpm audit:authorization`: PASS, 331 procedures and zero remediation rows after clean regeneration.
- `pnpm check`: PASS.
- `pnpm build`: PASS across Vite, Node bundle, and serverless bundle.
- `git diff --check`: PASS.
- Migration 0047 and the classification script were applied to disposable MySQL; a second classification dry run reported zero changes and null-owned legacy rows remained unpromoted.
- Independent Claude Code review initially returned `CHANGES_REQUIRED`; the project-insight leak, outcome read hardening, admin evidence classification, public change-detection boundary, audit coverage, and adjacent intelligence outcome read were remediated. Focused re-review returned `APPROVED_NO_OBJECTION`.
- In-app browser verification: PASS against a disposable local MySQL 8 environment. Analytics showed governed-data insufficiency instead of a market tier; UAE cost forecasting showed nine insufficient categories and the own-plus-public corpus label; project cost, outcome, and cost-over-time prediction cards showed explicit insufficiency without zero forecasts; design advisor abstained without calling the LLM; learning administration showed no governed accuracy snapshot instead of `0.0%`. Browser review found and drove fixes for the cost-over-time zero table and learning-dashboard zero accuracy cards before the final PASS.

## Next Action

TR-05 is closed. Begin bounded planning for `TR-10`, the next dependency-valid roadmap step. Production migration, classification, promotion, deployment, commit, push, and merge remain separately gated.
