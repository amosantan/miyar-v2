# Current Task

- ID: TR-09
- Roadmap step: `TR-09`
- Title: Truthful baseline provenance and issued-report states
- Status: PASS
- Owner: Codex
- Started: 2026-07-18
- Branch: `codex/tr-09-baseline-provenance`
- Base: `e49029d566fa032862c91fa7c0ce00c14aa8ef45`
- Risk: Critical cross-layer scoring, ingestion, schema, tenant-isolation, financial-claim, and issued-report change
- Selected loops: Defect, scoring/pricing, ingestion, schema-migration, feature, and report-visual-QA loops
- Retry budget: 3 evidence-based attempts per unchanged failure class
- Resource budget: One isolated worktree, one additive migration, three bounded implementation streams, one disposable-MySQL verification cycle, and one independent-review cycle
- Human gates: The user authorized the shared migration, protected merge, production deployment, and production smoke on 2026-07-18; all completed with recorded verification.

## Goal

Make empty-space results, evidence confidence, and Material Board Annex states truthful and reproducible without changing the approved neutral score or confidence boundaries, weakening tenant isolation, or issuing reports whose mandatory board data could not be verified.

## Approved Behavioral Defaults

- Empty room analysis remains numeric 50 and normalized 0.5, is labelled `neutral_fallback`, and cannot create space-derived ROI savings.
- Confidence uses explicit clocks, visible invalid/future-date rejection, latest-accepted-observation merge, common connector/CSV calculation, registry grades for dynamic sources, and labelled manual assertions.
- Design briefs and full reports fail before side effects when board retrieval cannot be verified; partial and unresolvable boards remain issuable only with explicit resolved-item disclosures.

## Acceptance Criteria

- [x] A fresh worktree and review branch were created from exact TR-08 commit `e49029d`; the dirty primary checkout remains untouched.
- [x] `pnpm install --frozen-lockfile` and the pre-change 80-test characterization baseline pass with `DATABASE_URL=''`.
- [x] Empty and measured space results carry typed provenance through evaluation snapshots, scoring/explainability, sensitivity, ROI/five-lens, API, and affected UI without changing approved numerical results.
- [x] Only measured space evidence can create space-derived ROI savings; fallback, absent, and legacy-unknown states are explicit and non-financial.
- [x] Every new computed or asserted confidence has deterministic policy/clock provenance; invalid/future/malformed items are visibly rejected; current records use latest accepted confidence.
- [x] Connector upsert matches and locks only null-owned `platform_public` evidence; same-key organization evidence is never read or modified.
- [x] Additive migration 0049 retains append-only confidence assessments, current pointers, and rejection counts with legacy-compatible reads and no fabricated backfill.
- [x] Material Board Annex distinguishes no-board, empty, complete, partial, unresolvable, and retrieval-failure states in both issued paths; retrieval failure occurs before report side effects.
- [x] Targeted, safe full-suite, TypeScript, authorization, build, disposable MySQL, provider compatibility, browser, rendered-artifact, migration-integrity, diff, and independent-review gates pass.
- [x] Shared migration 0049, protected merge, production deployment, and production smoke completed with verified recovery and integrity evidence.

## Non-Goals

- Changing scoring weights, thresholds, the neutral 50/0.5 values, Grade A/B/C bases, or the 90/91 and 365/366 confidence boundaries.
- Backfilling historical confidence chains or space provenance from current mutable data.
- Changing evidence corpus governance, promoting CSV/manual rows, or enabling pooled learning.
- Expanding the board annex to validation, autonomous, DOCX, or other report types.
- Performing further shared-environment writes without a scoped authorization.

## Baseline Evidence

- `pnpm install --frozen-lockfile`: PASS from the committed lockfile.
- `DATABASE_URL='' pnpm vitest run server/engines/v9-space.test.ts server/engines/v2-connectors.test.ts server/engines/board-pdf.test.ts`: PASS, 80/80; expected unauthorized-provider diagnostics exercised existing fallbacks and no database connection occurred.
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-tr09` on `codex/tr-09-baseline-provenance` at `e49029d`.

## Execution Plan

- [x] Implement and regress space evidence, snapshot, financial, explainability, and presentation contracts.
- [x] Implement deterministic confidence policy, assessment persistence, atomic public-only upsert, rejection visibility, and migration 0049.
- [x] Implement organization-scoped Board Annex state loading, rendering, and fail-closed report behavior.
- [x] Run the full verification ladder, rendered inspection, and independent reviews.
- [x] Complete the user-authorized shared migration and release workflow with recovery, deployment, and smoke evidence.

## Verification Evidence

- Safe full suite: 1,074 passed, 22 database-gated tests intentionally skipped with `DATABASE_URL=''`.
- `pnpm check`, `pnpm audit:authorization` (336 procedures, zero remediation rows), `pnpm build`, and `git diff --check`: PASS.
- Disposable MySQL: migration 0049 applied over the exact base schema; concurrent same-key writes produced one public row and two assessments; the tenant collision stayed unchanged; an assessment failure rolled back the evidence insert.
- Browser: truthful changed states passed at 1440×900 and 390×844 without page overflow.
- Reports: three-page mixed-board design brief and five-page no-board full report rendered through the production HTML-to-PDF path; all eight A4 pages were inspected without clipping, overflow, blank pages, or false state copy.
- Independent reviews: space/scoring, confidence/security, and board/report specialists returned `APPROVED`; the final Claude Sonnet completion review returned `APPROVED`.
- Release: User-authorized migration 0049 ran sequentially against PlanetScale production after restorable backup `jqb2igl1ebgl` succeeded. All eight reviewed statements applied; the assessment table has 31 columns, the three nullable evidence fields, zero-defaulted `recordsRejected`, required indexes, and legacy-null integrity. Counts remained 1,755 evidence records, 368 ingestion runs, and zero assessments.
- Deployment: PR #7 merged as canonical-main commit `bd09c3fdafca885d40b564eafe94ecc67197c7ad`; Vercel deployment `GQyoYH8hnMXwPRMYmzdsCgTg6wNV` is READY. Root returned 200, timestamped health returned 200 in three observations, unauthenticated project access returned 401, and invalid shares returned concealed 404 with privacy headers. Post-deployment database counts and orphan/pointer/duplicate-key integrity checks remained zero.
- Hosted-CI replacement: On 2026-07-18, the user approved the documented replacement evidence: frozen install, 1,074/22 safe suite, type-check, 336/0 authorization audit, production build, diff check, disposable-MySQL migration/concurrency/rollback, Vercel preview, and independent reviews.

## Recovery

- Application rollback retains additive migration 0049 and reads existing `confidenceScore` fields.
- No historical row is recomputed or deleted.
- Any possible tenant-boundary, data-integrity, scoring-policy, or report-publication regression stops execution immediately.

## Next Action

`TR-09` is closed. Begin `TR-10`, now the sole `READY` roadmap step, under its report-integrity and visual-rendering scope.
