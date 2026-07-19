# Known Reproduced Failures

Known does not mean accepted. A failure remains open until its exit criterion is verified. Never use this file to describe a failing full suite as green.

Policy-enforced human interaction gates are not repository failures and remain in `.agent/state/CURRENT_TASK.md#Human Gate`; record their resolution in the append-only worklog rather than inventing a `KF` entry.

## KF-006 — Project and child-resource authorization gaps

- Status: CLOSED
- Observed: 2026-07-16 at `a15424b` plus the TR-01 inventory worktree.
- Command: `pnpm audit:authorization`
- Evidence: `docs/security/resource-authorization-inventory.json` inventories all 327 router procedures. `TR-03` closed all 39 design-domain rows; 93 remaining authorization/global-governance/legacy-user rows are assigned to `TR-04`.
- Impact: authenticated callers can reach project, asset, brief, scenario, report, board, visual, room, allocation, evidence, or polymorphic records without every path proving the organization boundary; some global mutations also lack appropriate governance.
- Owner: Canonical resolver foundation closed in `TR-02` and design-router adoption closed in `TR-03`; remaining router remediation is owned by `TR-04`.
- Exit criterion: every `TR-04` inventory row is reclassified with proven organization, token, admin, or governed-global authorization; same-org, cross-org, missing, legacy-null, and polymorphic-target tests pass.
- Closed evidence: `TR-04` closes all 93 baseline rows across 18 routers. The regenerated 329-procedure inventory has zero `TR-04` and exactly eight `TR-05` rows; stale classifications cannot survive regeneration and tenant-relevant `adminProcedure` paths fail audit unless explicitly governed. Targeted contracts pass 25/25, disposable MySQL 8 passes 9/9 with representative real router-chain, scoped-write, rollback, and concurrency evidence, the safe full suite passes 946 with 22 skipped, TypeScript/audit/build pass, and independent Claude Code review returned `APPROVED_NO_OBJECTION`.
- Reopened evidence: A later full TR-01–TR-04 ultra-review traced `project.generateReport` to raw multi-table writes outside an organization-locked transaction and `portfolio.checkAlerts` to tenant-triggered writes against the global `platform_alerts` table. Exit now additionally requires atomic report persistence and organization-owned portfolio alerts.
- Reclosed evidence: Report artifacts now persist through one organization-locked transaction with ownership recheck, rollback, RFQ brief linkage, and upload compensation/reconciliation. Portfolio alerts now use the organization-owned `portfolio_alerts` table with locked ownership validation, expiry, and unique active deduplication. Tenant project evaluation no longer invokes the global alert engine, and the authorization audit rejects any organization procedure that reaches global platform alerts. Targeted tests pass 29/29, disposable MySQL passes 13/13, the safe suite passes 950 with 22 skipped, check/audit/build/diff gates pass, and Claude Code returned `APPROVED_NO_OBJECTION`.

## KF-007 — Cross-organization evidence and learning contamination

- Status: CLOSED
- Observed: 2026-07-16 at `a15424b` plus the TR-01 inventory worktree.
- Command: `pnpm audit:authorization`
- Evidence: Eight procedures are assigned to `TR-05`: analytics market position/trend detection, design-advisor recommendations, learning comparison/post-mortem, and predictive cost/outcome/UAE-range paths. They read unscoped evidence, scores, projects, or comparables that can include organization-owned or confidential records.
- Impact: one organization's data can influence another organization's recommendations, predictions, trends, or post-mortem comparisons even where target-project access is guarded.
- Owner: Roadmap `TR-05`.
- Exit criterion: organization-only data is the safe default, insufficient-data behavior is explicit, and two-organization fixtures prove no cross-organization record influence; any pooled cohort requires separate governance approval.
- Closed: 2026-07-17 by `TR-05`.
- Closure evidence: Explicit organization/public/legacy corpus policy; fail-closed tenant reads and derived writes; hard-disabled pooled learning; two-organization invariance and negative fixtures; disposable MySQL 18/18; safe suite 962/22; authorization inventory 331/331 with zero remediation rows; TypeScript/build/diff PASS; in-app browser verification across all five affected surfaces; independent Claude Code `APPROVED_NO_OBJECTION`.

## KF-008 — Full test suite is not database-hermetic

- Status: CLOSED
- Observed: 2026-07-16 at `a15424b` plus the TR-01 inventory worktree.
- Command: `pnpm test`
- Evidence: `server/auth.logout.test.ts` inherited the configured remote `DATABASE_URL`, connected to the remote service, and attempted an audit-log insert. The write failed because the remote branch was missing or sleeping; the test itself passed after logging the failure. On 2026-07-16, `env -u DATABASE_URL pnpm test` remained unsafe because `dotenv/config` restored the local value; `DATABASE_URL='' pnpm test` prevented the connection and reproduced the same nine application failures.
- Impact: ordinary local verification can contact or attempt writes to a shared database, violating safe-test expectations and making results environment-dependent.
- Owner: Roadmap `TR-07` and `TR-12`.
- Exit criterion: test configuration forces a dedicated isolated database or mocked data layer, fails before contacting protected/shared targets, and the full suite produces no external database connection or write attempt.
- TR-07 progress: On 2026-07-17, the auth and logout harnesses were re-certified with type-checked database mocks, explicit null `getDb`, isolated audit mocks, and success/rejection assertions. `DATABASE_URL='' pnpm test` passed 1,021 tests with 22 skipped and emitted no auth/logout database attempt. The failure remains open because ordinary invocation still lacks the systemic protected-target guard and explicit environment profiles owned by `TR-12`.
- Closed: 2026-07-18 by `TR-12`.
- Closure evidence: Standard Vitest now forces the `test`/`unit-test` contract and an explicit empty `DATABASE_URL` before modules load, so dotenv cannot restore a hostile parent or file value. The central guard rechecks the current target before pool creation and denies unit-test database access. A hostile-parent ordinary `pnpm test` passes 1,206 tests with 22 skipped and no database connection attempt; constructor-denial tests cover both pool and direct connection paths; disposable MySQL remains isolated behind `TEST_DATABASE_URL` and passes 19/19 with cleanup.

## KF-009 — Organization context does not prove current membership or design role

- Status: CLOSED
- Observed: 2026-07-16 at `1f972f4`.
- Evidence: `orgProcedure` trusts `users.orgId` without resolving `organization_members`, and design mutations do not distinguish viewer, member, and organization-admin roles.
- Impact: stale membership can retain tenant access, and viewers can invoke design mutations.
- Owner: `TR-03H`.
- Exit criterion: exactly one live membership is required per request; removed/duplicate/stale memberships fail closed; design viewer/member/admin contracts pass.
- Closed evidence: `orgProcedure` now resolves exactly one current membership on every request, design viewer/member/admin levels are enforced, migration 0045 makes `(orgId, userId)` unique, targeted role contracts pass, and real MySQL verifies membership uniqueness and role resolution.

## KF-010 — TR-03 final-write and transaction guarantees are incomplete

- Status: CLOSED
- Observed: 2026-07-16 at `1f972f4`.
- Evidence: share-token update is raw-ID scoped; board/RFQ/floor-plan composite operations span separate statements or transactions; scoped SQL is mocked by router tests.
- Impact: ownership changes or partial failures can modify the wrong final resource, leave partial records, or escape the claimed rollback boundary.
- Owner: `TR-03H`.
- Exit criterion: final writes are organization/project scoped, composite mutations are atomic, and real isolated MySQL tests prove affected-row and rollback behavior.
- Closed evidence: Share-token mutation locks and scopes the brief/project write; board, RFQ, and floor-plan composites use transactions; isolated MySQL 8 passes all 7 serial SQL/rollback/locking tests and PlanetScale passes all 6 applicable compatibility tests.

## KF-011 — Rejected uploads and public-share responses lack operational containment

- Status: CLOSED
- Observed: 2026-07-16 at `1f972f4` and the production deployment.
- Evidence: storage upload precedes final scoped persistence without compensation; public-share responses do not set `no-store` or `noindex`.
- Impact: lost authorization can leave orphaned storage objects, and expired public content can remain stored or indexed.
- Owner: `TR-03H`.
- Exit criterion: explicit rejected persistence deletes its object, indeterminate outcomes emit critical reconciliation telemetry, and share API/page headers pass Node, serverless, and production checks.
- Closed evidence: Direct asset and floor-plan uploads compensate explicit rejected persistence with bounded deletion retries, indeterminate outcomes emit reconciliation telemetry, application/header contracts pass, and production invalid/malformed share responses carry the required no-store/noindex headers.

## KF-012 — Canonical main does not identify the production release

- Status: CLOSED
- Observed: 2026-07-16 after deployment of `1f972f4`.
- Evidence: production was deployed from `codex/loop-engineering-architecture`; `origin/main` remains nine commits behind.
- Impact: a future main-based deployment can silently remove the authorization and runtime fixes; rollback and attribution are ambiguous.
- Owner: `TR-03H` release closeout.
- Exit criterion: the complete reviewed application branch is fast-forwarded to canonical `main`, the production deployment source equals that canonical application release SHA, and release evidence records the identity. Later state-only commits do not change the application release identity.
- Closed evidence: The complete reviewed application history was fast-forwarded to local and remote `main`; Vercel production deployment `dpl_HQ6mnWadr46VhfjS3GhGQnxi48Ng` reached `READY` from canonical application release SHA `9e5d1e395ab7486fdfc73943d279820d5a91d53c`. This closeout changes repository state records only and does not alter the deployed application.
- Reopened evidence: TR-04 application commit `3d0e26068b3c96237dc20605923280c76e548152` was deployed successfully from `codex/tr-04-authorization`, while `origin/main` remains at the prior release lineage. Production is healthy, but canonical release identity is again divergent until an explicitly authorized reviewed fast-forward or merge updates `main`.
- Reclosed evidence: The user authorized protected-main integration, and `origin/main` was fast-forwarded without a merge from `3bfc990` through the complete reviewed TR-04 history at `5edb26d`. Canonical main contains deployed application SHA `3d0e26068b3c96237dc20605923280c76e548152`; later commits record release state only.

## KF-013 — RFQ generation retries are intentionally non-idempotent

- Status: OPEN
- Observed: 2026-07-16 during `TR-03H`.
- Evidence: the atomic RFQ helper inserts one complete batch per successful request and preserves order and duplicates, but it has no request key or prior-batch replacement contract.
- Impact: a client retry after an uncertain response can append a second complete RFQ batch even though each individual transaction is atomic.
- Owner: Later RFQ workflow/idempotency step; outside the bounded TR-03H authorization hardening scope.
- Exit criterion: RFQ generation accepts a stable idempotency key or uses an approved replace/version contract, with retry and uncertain-response integration tests proving one intended result.

## KF-014 — GitHub Actions cannot start because the owner account is billing-locked

- Status: CLOSED
- Observed: 2026-07-16 on draft PR `#1`, run `29511289388`.
- Evidence: both `lint-and-test` and `mysql-authorization` completed with zero steps; GitHub check annotations say the jobs were not started because the account is locked due to a billing issue.
- Impact: required hosted CI gates cannot become green even though equivalent local TypeScript, unit, build, authorization, and disposable MySQL 8 checks pass.
- Owner: Repository owner / GitHub billing administrator.
- Approved release exception: for the TR-03H release only, the user selected Vercel’s hosted build check on each pushed commit as the external gate, combined with the recorded local MySQL, PlanetScale, full-suite, audit, build, and Claude evidence.
- TR-07 release disposition: The user explicitly authorized final smoke, commit, push, canonical-main merge, and production deployment. Run `29604504677` again created both jobs with zero steps and the billing-lock annotation. The release proceeded with a clean frozen install, passing TypeScript, safe 1,021/22 suite, 335/0 authorization audit, production build, successful Vercel preview/production builds, and passing production smoke. This bounded disposition does not close or normalize the CI failure.
- TR-09 release preparation: The latest draft-PR run again created both required jobs with zero steps and no failed-job log, while Vercel Preview Comments passed. A production release needs an explicit owner-approved replacement-evidence disposition; this recurrence does not close or normalize the CI failure.
- TR-09 disposition: On 2026-07-18, the user approved the documented local, disposable-MySQL, Vercel-preview, and independent-review evidence as the bounded release replacement while hosted CI was unavailable.
- Closed evidence: After the user restored GitHub billing, rerun `29633531305` executed actual job steps and exposed a duplicate pnpm-version setup error. Commit `57f2471` removed the redundant workflow versions; PR #10 merged as `18da870`. Hosted run `29634694233` passed both jobs on the PR, and post-merge run `29634762518` passed both `lint-and-test` and `mysql-authorization` jobs on canonical `main`.
- Exit criterion: Met. GitHub Actions eligibility is restored and successful hosted Actions checks are recorded; future releases return to the ordinary hosted CI gate.

## KF-015 — Production contains legacy null-organization resources

- Status: CLOSED
- Observed: 2026-07-16 during the approved TR-04 production release preflight.
- Command: Read-only production ownership-count queries against the Vercel `DATABASE_URL` target.
- Evidence: Production contains 2 `projects` rows with null `orgId`, 4 `scenarios` rows with null `orgId`, and 8 `report_instances` rows whose project is missing or null-owned. Portfolios contain zero null organization owners.
- Impact: The fail-closed TR-04 application will conceal these legacy records. Assigning them automatically could create tenant leakage; retaining user-owner fallback would reopen the authorization vulnerability.
- Owner: Product/data owner must choose and approve a deterministic mapping, archival, or explicit abandonment policy.
- Exit criterion: Every affected row receives an approved deterministic disposition, a reversible/idempotent remediation is verified on a safe target, production counts reach zero or approved archival scope, and post-remediation tenant checks pass.
- Closed evidence: The user approved mapping projects 1 and 2 and scenarios 1–4 to organization 1 after read-only evidence showed a single current creator membership and matching parent-project ownership. One production transaction updated 2 projects and 4 scenarios; post-transaction null-owner counts are zero for projects and scenarios, and zero reports remain attached to missing or null-owned projects.
- Release gate: Cleared. Migration 0046 and the deterministic ownership remediation are complete.

## KF-016 — Baseline contract provenance and failure states are incomplete

- Status: CLOSED
- Observed: 2026-07-17 at canonical-main state `1736129` during TR-08 consumer recertification.
- Evidence:
  - `benchmarkSpaceRatios` returns the neutral fallback 50 for an empty room list, while project evaluation, normalization/scoring, ROI, Space Planner, and Investor Summary can consume or present it without distinguishing it from a measured DLD-backed score.
  - `computeConfidence` deterministically produces connector initial confidence, but the orchestrator can quality-adjust it to as low as 0.10 and retains the maximum of new and existing confidence on update, so a newly reduced score cannot lower an older higher score. CSV ingestion separately assigns 0.90 to Grade A and 0.70 to Grades B and C. Evidence records retain only grade and final score, not the full policy chain. Valid future publication dates receive the recency bonus and can become future capture dates. Invalid dates constructed by dynamic/crawler extraction cause the evidence item to be silently filtered by schema validation before persistence, while a direct unvalidated `computeConfidence` call returns the base score.
  - Report generation converts board-summary retrieval failures to an empty list. An existing board with zero resolved items is also omitted from summaries, while a partially resolved board includes only resolved items without disclosing omissions. The renderer emits the genuine no-board message when no summaries remain in both issued-output paths.
- Impact: A neutral fallback can look like measured evidence and influence derived value, historical confidence scores cannot identify or reproduce their full calculation path or masked quality reductions, and an issued report can falsely claim that no material boards exist or silently omit unresolved board content.
- Owner: Reopened roadmap step `TR-09`.
- Closed evidence: The user-authorized release applied migration 0049 sequentially after restorable backup `jqb2igl1ebgl` completed. Production verified the 31-column assessment table, provenance fields, indexes, legacy-null records, and unchanged 1,755 evidence / 368 ingestion-run counts. PR #7 merged as `bd09c3fdafca885d40b564eafe94ecc67197c7ad`; Vercel deployment `GQyoYH8hnMXwPRMYmzdsCgTg6wNV` is READY, public smoke and post-deploy database integrity passed, and the local numerical, rendered-artifact, authorization, migration, and independent-review evidence remains green.
- Scope boundary: TR-08 records only behavioral acceptance boundaries. It does not prescribe TypeScript interfaces, API shapes, schema columns, migrations, UI components, or report failure mechanisms.
- Exit criterion:
  - Empty and measured space results are distinguishable across presentation, scoring, and ROI without changing the approved neutral fallback silently.
  - Every newly computed confidence score retains an approved policy-chain identity and clock provenance across connector calculation, quality adjustment, update merge, and non-connector ingestion, with approved invalid/future-date and rejection-visibility behavior plus migration/backward-compatibility evidence where applicable.
  - Genuine no-board state, board-retrieval failure, and existing boards with zero, partial, or wholly unresolvable items produce distinct approved behavior in design briefs and full reports, with organization authorization and artifact tests passing.
  - Targeted, safe full-suite, TypeScript, authorization, build, rendered-artifact, migration/integrity where applicable, and independent-review gates pass.

## KF-017 — Public ingestion upsert can collide with tenant evidence

- Status: CLOSED
- Observed: 2026-07-18 at TR-09 baseline `e49029d` during confidence-chain tracing.
- Evidence: `findExistingRecord` in `server/engines/ingestion/orchestrator.ts` matches only `sourceUrl + itemName`, and `updateExistingRecord` writes the returned row without requiring `orgId IS NULL` and `corpusScope = platform_public` in the lookup, lock, or final update.
- Impact: A platform connector can pair public-ingestion confidence, capture date, snippet, run identity, or prices with an organization-owned same-key record, violating tenant isolation and evidence provenance.
- Owner: Roadmap `TR-09`.
- Closed evidence: The released application enforces null organization/project ownership and `platform_public`, uses a unique observation key and atomic transaction, and passed simultaneous-write, tenant-collision, rollback, and authorization verification on disposable MySQL. Production migration 0049 created the unique public-observation key; post-deployment integrity found zero duplicate keys, orphan assessments, or invalid current pointers, with all legacy records still null-provenance.
- Exit criterion: Connector insert/update and confidence-assessment persistence execute atomically against only null-owned `platform_public` rows; same-key organization and legacy-unscoped rows are invariant; disposable MySQL concurrency/rollback evidence and the authorization audit pass.

## KF-018 — Legacy stored reports can render malformed 5-Lens labels

- Status: OPEN
- Observed: 2026-07-19 during the SC-04 production report smoke on exact application release `1bad9d666d71a0b010a27433ca196c842b4e546f`.
- Evidence: Opening an existing February 2026 validation-summary report through `/reports` rendered the stored document identity, scores, evidence trace, disclaimer, and input tables, but its 5-Lens section displayed repeated `undefined` labels/descriptions and `[object Object]` evidence text. The current synthetic report certification passes; the defect is specific to at least one legacy stored payload shape and predates SC-04's lazy-loading boundary.
- Impact: A user can open a historically stored report successfully but see malformed legacy fields, reducing readability and defensibility. Rolling back SC-04 would not repair the stored payload or renderer compatibility.
- Owner: Report compatibility follow-up; coordinate with `BR-02` before any broader issued-artifact model change.
- Exit criterion: Reproduce the affected legacy payload shape in a versioned fixture; render meaningful labels/evidence or an explicit legacy-unavailable state without changing stored evidence; verify current and legacy report previews, exports, document identity, tenant authorization, full report certification, and production-compatible browser rendering.

## Handling Protocol

1. Reproduce a failure before adding it.
2. Record command, commit, environment limitation, impact, and evidence.
3. Assign an owner and target when remediation is scheduled.
4. State an objective exit criterion.
5. For flaky behavior, include repeated-run evidence and quarantine expiry.
6. Remove only after a passing command and fixing commit are recorded in `WORKLOG.md`.
