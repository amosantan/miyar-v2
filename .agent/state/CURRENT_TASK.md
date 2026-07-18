# Current Task

- ID: TR-11
- Roadmap step: `TR-11`
- Title: Replace unsupported public claims with evidence-backed qualification
- Status: PASS
- Owner: Codex
- Started: 2026-07-18
- Branch: `codex/tr-11-public-claims`
- Base: `ee4b134` (`origin/main`)
- Risk: High public trust, evidence, localization, API exposure, and public-share interpretation
- Selected loops: Feature, ingestion/evidence, security, browser verification
- Retry budget: Maximum 5 loop iterations and 3 evidence-based attempts per unchanged failure class
- Resource budget: One isolated worktree, no schema/dependency change, one bounded public snapshot endpoint, one claim registry, focused UI repairs, and one independent final-review cycle
- Human gates: Legal pages remain unpublished until exact bilingual copy and named product/legal approval; release, production scheduler changes, shared database writes, and benchmark/financial/scoring policy changes require separate authorization

## Goal

Make MIYAR's public and customer-facing evidence claims truthful: identify the official DLD source, show only the indexed subset and its observed-through date, qualify estimates and targets, and prevent unavailable evidence from being presented as live/current/healthy.

## Acceptance Criteria

- [x] A bilingual machine-readable registry owns fixed public/share/customer claim wording and its evidence/qualification requirements.
- [x] `system.marketEvidenceSnapshot` is read-only, cached, rate-limited, and returns only official source identity/link, transaction/rent/project counts, coverage dates, explicit `indexed_subset` scope, and a fail-closed availability state.
- [x] The endpoint exposes no tenant, project, benchmark value, connector-health, run, or internal operational data; empty, unavailable, or malformed evidence returns `available: false`.
- [x] Home renders the official-source indexed subset and “observed through” wording in English and Arabic without claiming complete DLD coverage, daily refresh, or live data.
- [x] Methodology retains the five deterministic scoring dimensions but removes unapproved fixed weights and separates official DLD observations from MIYAR fit-out assumptions and professional certification/conformity claims.
- [x] Public shares remove the default Silver badge, present sustainability/certification only as explicit targets or proxies, qualify costs/premiums/yields/assumptions beside values, and show DLD-backed wording only for positive transaction evidence with explicit provenance.
- [x] Customer-facing Design Studio and DLD insight copy uses observed/approved/indexed wording rather than live/current/market-verified absolutes.
- [x] Zero-source and all-unknown freshness resolve to `unknown`, never `healthy`.
- [x] Legal pages remain unpublished and TR-11 does not change schema, migrations, dependencies, formulas, scoring, financial policy, benchmark promotion, report catalog, or ingestion cadence.
- [x] EV-08 is recorded as the future governed weekly refresh and report-evidence binding step with the approved operational, promotion, report-state, tenant, and four-week gates.
- [x] Targeted tests, safe full suite, `pnpm check`, authorization audit, build, English/Arabic browser review, diff/security/tenant/numerical review, and independent review provide objective evidence.

## Assumptions and Approved Decisions

- The checked-in/queried DLD corpus is an indexed subset, not a completeness claim.
- “Observed through” describes record coverage; it is not an ingestion-success timestamp.
- Fixed scoring weights appear publicly only when sourced from an approved versioned contract; TR-11 does not create that contract.
- DLD transaction facts do not validate fit-out assumptions or establish causal design premiums.
- EV-08 is roadmap documentation only during TR-11; no cadence or production ingestion mutation is authorized.

## Non-Goals

- No legal boilerplate, clickwrap, DSR, retention promise, or compliance assurance.
- No schema, migration, package, formula, scoring threshold/weight, financial assumption, authoritative benchmark, report-catalog, or scheduler change.
- No production deployment, shared database write, commit, push, merge, or publication without separate authorization.

## Recovery

All runtime changes are additive or copy-level and can be reverted without data migration. Any tenant leakage, numerical-authority change, invented provenance, or legal/compliance overclaim stops work immediately.

## Execution Plan

- [x] Establish the targeted baseline and inventory governed claims.
- [x] Implement the registry, fail-closed evidence snapshot, and public/customer UI corrections.
- [x] Add contract, endpoint, share, freshness, and localization tests.
- [x] Run the full verification ladder and independent/Claude review.
- [x] Close durable state only from verified evidence.

## Verified Evidence

- Fresh worktree `/Users/amrosaleh/Maiyar/miyar-v2-tr11` was created first on `codex/tr-11-public-claims`, then fetched and fast-forward checked against `origin/main`; base is `ee4b134` and the worktree was clean before edits.
- Mechanical claim inventory found fixed Methodology weights/absolutes, the public-share default Silver badge and unqualified figures, customer “live/verified” labels, and the zero/all-unknown freshness defect.
- The ingestion skill constrains EV-08 to governed, bounded, provenance-preserving evidence with no silent benchmark promotion; runtime scheduling remains out of TR-11 scope.
- Focused endpoint, rate-limit, cache, share, scoring, freshness, claim, and bilingual DOCX tests pass 103/103.
- `DATABASE_URL='' pnpm test` passes 1,138 tests with 22 skipped; `pnpm check` passes with zero diagnostics.
- The regenerated authorization inventory validates all 337 procedures with zero remediation rows; `pnpm build` and `git diff --check` pass.
- English/Arabic Home and Methodology browser QA passed in LTR/RTL at 1280px without horizontal overflow or console errors; unavailable evidence rendered fail-closed.
- Independent security/design review returned `APPROVED` after the final generated-output correction; Claude Opus returned `APPROVED` on the final implementation boundaries.
- No schema, migration, package, formula, scoring weight/threshold, financial-policy, benchmark-promotion, report-catalog, scheduler, legal-page, database, or production change was made.

## Next Action

TR-11 is locally verified at `PASS`. Begin `TR-12` in a new worktree when authorized; do not publish “monitored weekly refresh” until `EV-08` closes and runtime health satisfies its approved SLA.
