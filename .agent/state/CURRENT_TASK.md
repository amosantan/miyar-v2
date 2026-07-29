# Current Task

- ID: EV-03
- Roadmap step: `EV-03`
- Title: Consolidate material identity and calculation inputs
- Status: ACTIVE
- Owner: Codex
- Started: 2026-07-29
- Base: canonical `origin/main` at `3dcf0dc558186cf0ad1adc09b6fced35863d1714`
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-ev03-comparison-remediation`
- Branch: `codex/ev03-comparison-remediation`
- Classification: Critical — schema/data/engine/report/scoring cutover
- Dependencies: `EV-02` (`CLOSED`, production migration/backfill `PASS`)

## Goal

Make the EV-02 governed resolver the sole numerical authority for material
prices while preserving canonical product/specification identity, deterministic
quantity conversions, tenant-safe provenance, and truthful insufficiency across
MQI, schedules, boards, scoring, RFQs, reports, PDF, and DOCX output.

## Acceptance Criteria

- [x] All authoritative material-price consumers resolve through one typed,
      server-internal batch facade over the EV-02 resolver; no parallel ranking
      logic or public resolver route exists.
- [x] Eligible legacy assumptions retain byte-equivalent AED min/mid/max values
      only through the explicitly labelled unknown-scope compatibility path.
- [x] MQI/material summaries request `supply_only`; RFQs request
      `supply_and_install`; reports inherit scope; no scope is inferred or mixed.
- [x] Optional explicit project price geography selects emirate then UAE;
      missing legacy geography uses UAE and descriptive location text is never
      treated as an emirate.
- [x] Paint quantities use only an approved, versioned coverage profile or the
      owner-approved fallback (10 m2/L/coat, two coats, 10% waste), with exact
      inputs snapshotted and actual supplier pack sizes used for purchasing.
- [x] Non-compatible units and the 43 EV-02 unresolved rows fail closed; missing
      values never become AED 0 or enter issued/scoring totals.
- [x] Durable calculation rows retain canonical product/specification identity,
      resolution state, explicit clock/version, safe provenance, and truthful
      historical `legacy_unverified` state without reconstructed provenance.
- [x] Board catalog prices are browse-only estimates and cannot enter
      authoritative scoring, RFQ, or issued totals without a governed value.
- [x] Material RFQ lines contain no hard-coded unit rates; non-material fees
      remain numerically unchanged in labelled, versioned policy constants.
- [x] Internal confidential provenance is separated from presentation/public
      provenance and cross-organization/private quote data cannot leak.
- [x] Static guards forbid authoritative reads of legacy price columns,
      sustainability `material_constants.costPerM2`, stale snapshots, and
      hard-coded material rates outside explicit compatibility/backfill areas.
- [x] The additive-plus-backward-compatible-nullability migration and
      deterministic identity-only backfill pass dry-run, idempotency,
      two-connection concurrency, restore, and dependency checks on disposable
      MySQL.
- [ ] Targeted tests, safe full suite, TypeScript, authorization/database audits,
      build, workflow certification, rendered report inspection, authenticated
      browser checks, complete diff review, and fresh independent Sol and Claude
      reviews pass.

## Implementation Evidence

- Focused resolver, RFQ, and canonical-allocation regression suite: 36/36
  passed.
- Database-free suite: 1,784 passed with 22 skipped after the final
  provider-runner remediation.
- Guarded disposable MySQL suite: 65/65 passed, including migration 0062,
  exact compatibility for all 242 eligible EV-02 assumptions, identity
  backfill/recovery/idempotency, malformed paint profiles, two-connection
  source/target backfill races, stale-geography standalone/report RFQ races,
  stale bulk-MQI revision/geography rejection, and orphan/private/category
  identity rejection.
  No provider-bound shared/production rehearsal has been executed.
- TypeScript, material-price authority (16 calculation paths), authorization inventory (390/0),
  database-safety audit (138/2/0), report certification (23/23), workflow
  certification, production build, and bundle budgets pass.
- Public application shell and console pass in the in-app browser. The
  authenticated project-form check could not run without a local session key
  and application database; the equivalent project-geography persistence and
  invalidation behavior passed against disposable MySQL.
- The first release-readiness re-review rejected the provider-runner candidate:
  production manifests were not sufficiently minimized, the wrapper nonce
  lacked a mismatch-bound pair, comparison admitted hypothetical
  organization-zero rows, and rollback/deployed-evidence claims exceeded their
  verification. The corrected tree now uses recursively minimized manifests,
  an exact-date CLI/environment nonce pair, a quote-free strict-global
  comparison path, conservative later-write rollback rejection, and
  independently parsed artifact/summary binding. Focused 59/59, disposable
  MySQL 65/65, DB-free 1,784/22, TypeScript, audits, reports, workflow, build,
  and bundle budgets pass. Earlier review approvals do not apply until the
  corrected tree completes fresh Sol and Claude review. The final
  documentation-corrected tree then received `APPROVED / NO OBJECTION` from the
  independent MIYAR Sol reviewer and `APPROVED_NO_OBJECTION` from Claude Opus.
- The first final Sol pass found seven blocking gaps in predictive authority,
  RFQ report persistence, board identity/summary, provenance invalidation,
  private-product concealment, request-specific compare mode, and empty
  completeness. All seven were remediated and covered before the broad gates
  above were rerun.
- The second Sol pass found three further blockers: full reports could persist
  incomplete material reconciliation, project geography changes did not
  invalidate standalone draft RFQs, and compatibility labels were generic.
  Full reports now reject incomplete coverage before persistence; RFQs have
  explicit draft/issued/legacy lifecycle with draft-only invalidation; and MQI,
  reconciliation, PDF, and DOCX use the exact “legacy scope-unknown
  assumption” label.
- A deeper Sol audit then found six release blockers: source-CAS safety,
  in-flight RFQ revision safety, malformed paint fallback, full-report
  reconciliation, invalid price bands, and overstated production-runner
  evidence. All are remediated and covered by the final green gates above.
- The final exact-tree Sol re-review additionally checked bulk-MQI
  revision/geography CAS, canonical joined-product existence/category
  validation, and the allocation-driven joinery boundary. It returned
  `APPROVED / NO OBJECTION`.
- Claude Opus then returned `CHANGES_REQUIRED` after identifying a
  finish-schedule enum migration/schema mismatch. Its claim that EV-03
  contracted the material-allocation wall enum was disproved against base
  `83cae786` (that table already used `walls`), but the underlying
  finish-schedule drift was real: a live report path emits `sanitaryware`.
  Migration 0062 now preserves every legacy finish-schedule wall variant and
  appends only `sanitaryware`; schema, snapshot, pinned migration digest, and a
  regression contract agree. The corrected migration passed a fresh 65/65
  disposable-MySQL run, 1,774/22 DB-free suite, TypeScript, build, and workflow
  certification. The final exact-tree MIYAR reviewer returned
  `APPROVED / NO OBJECTION`, and Claude Opus returned
  `APPROVED_NO_OBJECTION`.
- The owner-authorized comparison-safety remediation now captures the raw
  provider URL only for the `mysql2` connection, exposes its scheme-normalized
  form to database-safety inspection, and rejects any later change to the full
  normalized target. Host, port, credentials, database, query value, query
  insertion/removal, query ordering, and missing-environment drift are covered.
- The provider wrapper writes only to a random owner-only staging path. It
  promotes evidence to the requested final path only after the child succeeds
  and the PASS summary, file ownership/mode, JSON, and evidence digest all bind.
  An executable fake-provider failure test proves a nonzero child leaves neither
  final nor staged evidence.
- Final remediation gates: focused comparison/database-safety tests 85/85;
  disposable MySQL 65/65; database-free suite 1,791 passed with 22 skipped;
  authorization inventory 390/0; database-safety audit 141/2/0; all 98 pinned
  MySQL evidence files current; TypeScript, production build, material-price
  authority, bundle budgets, and `git diff --check` pass.
- The exact remediation diff received `APPROVED / NO OBJECTION` from the
  independent MIYAR Sol reviewer and `APPROVED_NO_OBJECTION` from Claude Opus.
  Hosted checks and the single production comparison remain pending.

## Next Authorized Action

The owner explicitly reset the comparison-safety retry budget on 2026-07-29 for
one bounded remediation and one independently reviewed production comparison
attempt. Preserve final-use validation while normalizing the PlanetScale
`mysql2://` loopback URL at the final-use boundary; add hostile
environment-drift and no-output-on-failure coverage; pass local, hosted, MIYAR
Sol, and Claude review gates; then run exactly one production comparison.
Production remains on `legacy` until valid 242/242 equality evidence exists.

## Production Release Evidence and Blocker

- PR #54 merged the EV-03 application as `6df6f791`; PR #55 merged the
  comparison-reader safety hotfix as `b8302884`. Hosted lint/test,
  MySQL-authorization, and Vercel checks passed on the reviewed heads.
- Restorable backup `aswg05nrzrpf` preceded additive migration 0062. PlanetScale
  deploy requests #16-#21 are complete.
- The production identity backfill applied 51 exact actions (45 allocations and
  six board links), retained 19 explicit ineligible decisions, and a subsequent
  dry-run produced zero actions. Owner-only recovery evidence remains under
  `/Users/amrosaleh/.miyar/recovery`.
- Vercel production deployment `dpl_GVhZd9DmLSqVaQXKDumNpmvRQjS5` is `READY`
  for exact merge SHA `b8302884b137a059c6440ae2914f95d26e2c7999`.
- The final production comparison exited nonzero and created no evidence file.
  Static postmortem confirmed that initial inspection normalizes PlanetScale's
  `mysql2://` tunnel URL, but `assertDatabaseAccess("migrate")` re-reads the raw
  scheme at final use; `inspectDatabaseTarget` accepts only `mysql://`, so the
  guard fails before connection or query.
- Production remains safely on `legacy`: the provider connection was
  reader-only, the wrapper accepts no evidence after a nonzero exit, and no
  compare/governed environment mutation occurred.

## Approved Decisions

- Legacy scope: labelled compatibility fallback; never guess supply/install.
- Consumer scope: MQI/material summaries `supply_only`; RFQ
  `supply_and_install`.
- Geography: optional explicit emirate; missing/legacy falls back to UAE.
- Boards: `materials_catalog` prices are browse-only estimates.
- Paint fallback: 10 m2/L per coat, two coats, 10% application waste; approved
  product technical-data profiles override; litres canonical.

## Non-Goals

- Do not approve or map the 43 ambiguous EV-02 rows.
- Do not change an AED value, scoring weight, tier threshold, or benchmark.
- Do not delete legacy material tables/columns; contraction is a later step.
- Do not reorder or bypass the authorized release gates. Stop if the exact
  target, migration digest, candidate commit, live evidence digest, or recovery
  fingerprints diverge from the approved package.

## Execution and Recovery

- Retry budget: one owner-authorized remediation cycle and one production
  comparison attempt for `KF-020`; no automatic retry.
- Every long-running command requires an explicit timeout or tool bound.
- Sequence: freeze/publish candidate and pass review gates -> backup -> additive
  schema -> production identity-only dry-run and inspect -> fingerprint-bound
  production apply -> post-apply zero-action/idempotency and sealed recovery
  manifest verification -> explicit legacy-mode application deployment ->
  provider-bound live comparison evidence -> compare-mode observation ->
  evidence-digest-bound governed cutover -> production smoke/observation ->
  legacy-read prohibition.
- Recovery clears only EV-03-owned fields after fingerprint and inbound
  dependency checks and refuses when later writes are not old-code representable.

## Human Gates

- Mapping approval for any ambiguous legacy category/unit remains required; no
  ambiguous row is approved by the release authorization.
- Shared/production migration and identity backfill: approved by Amro Saleh on
  2026-07-29 for the exact target and ordered EV-03 release package.
- Comparison deployment, governed cutover, Git publication, merge, and
  deployment: approved by Amro Saleh on 2026-07-29.
- Any newly discovered numerical-policy change.

## Release Preflight

- PlanetScale OAuth is authenticated to `amr-saleh-hotmail`; the stale
  machine-local service-token file is not used.
- Canonical `origin/main` remains exact base `83cae786`.
- No production or remote mutation occurred during preflight.
- Release-runner data-minimization, attestation binding, strict-global
  comparison, rollback compatibility, and artifact verification gaps are
  remediated and locally re-certified. Fresh exact-tree Sol and Claude reviews
  pass. Freeze and publish the immutable candidate for hosted checks before the
  first shared write.

## Baseline

- Focused resolver/MQI/RFQ/reconciliation suite on the pre-worktree checkout:
  6 files, 35 tests passed on 2026-07-29.
- PR #53 merged as canonical `main` commit `83cae78`; re-inventory is required
  before implementing the facade.
