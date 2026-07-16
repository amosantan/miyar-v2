# Current Task

- ID: TR-04
- Roadmap step: `TR-04`
- Title: Authorize remaining project routers
- Status: PASS
- Owner: Codex
- Started: 2026-07-16
- Risk: Critical API authorization, tenant isolation, transaction, and global-governance work
- Selected loop: API/security defect loop with real-SQL verification
- Retry budget: 3 evidence-based attempts per failure class
- Resource budget: One bounded roadmap step implemented in five router batches; stop if a batch exposes ambiguous ownership or a new schema/data policy.
- Approval gates: production null-owner queries beyond read-only counts, data repair/backfill, shared migrations, push, deployment, and release exceptions require separate approval

## Goal

Close the 93 `TR-04` authorization inventory rows across 18 non-design routers without changing numerical policy or crossing the eight-row `TR-05` pooled-data boundary.

## Locked Decisions

- `orgProcedure` permits reads for current viewers, members, and organization admins.
- `orgMutationProcedure` permits ordinary mutations for members and organization admins; viewers are read-only.
- `orgAdminProcedure` is required for project deletion and organization-level destructive actions.
- Rate-limited organization reads and mutations preserve the existing rate-limit key and add the appropriate organization/role boundary.
- `adminProcedure` is reserved for platform-wide governance and does not bypass tenant authorization on organization-owned resources.
- Legacy `project.userId` ownership and user fallbacks are removed. Null, orphaned, and inconsistent organization ownership fails closed.
- Single-row writes use organization/project predicates and affected-row validation. Composite and race-sensitive writes use transactions and parent locking.
- TR-05 rows, RFQ idempotency, scoring/pricing policy, production data repair, deployment, and release are outside this task.

## Baseline Evidence

- Branch: `codex/tr-04-authorization` from `3bfc990`.
- `pnpm audit:authorization`: PASS, 329 application procedures, 93 `TR-04` rows, 8 `TR-05` rows.
- Core membership/resource/design authorization baseline: PASS, 75 tests.
- Exact TR-04 procedure keys remain canonical in `docs/security/resource-authorization-inventory.json`; this task does not create a duplicate inventory.

## Acceptance Criteria

- [x] Generic organization read, mutation, admin, rate-limited read, and heavy-mutation procedures are defined with compatibility aliases for design routes.
- [x] All 93 baseline TR-04 keys are reclassified with semantic route-to-final-write evidence.
- [x] Project and child reads reject cross-organization, missing, null-owner, orphaned, and inconsistent-parent resources with the established concealed `NOT_FOUND`.
- [x] Viewers cannot invoke ordinary mutations; project deletion requires organization admin.
- [x] No tenant mutation trusts a caller-controlled organization identifier or legacy `project.userId` fallback.
- [x] Single-row writes are organization/project scoped at final SQL; composite writes are atomic.
- [x] Storage, AI, report, PDF, webhook, and calculation side effects do not start after rejected authorization.
- [x] Platform alerts and global seed operations require global admin; portfolio insights are organization scoped.
- [x] TR-05 retains exactly its eight baseline rows unless a separately reviewed live-code addition changes the inventory.
- [x] Targeted router contracts, real MySQL tests, authorization audit, safe full tests, TypeScript, build, public-share regressions, and independent review pass.
- [x] `KF-006` and durable roadmap state close only with objective evidence.

## Execution Batches

1. Foundation and inventory evidence.
2. Project roots, admin overrides, customer success, and bias: 25 paths.
3. Scenario and intelligence: 26 paths.
4. Space programme, intake, material quantity, portfolio, and design advisor: 16 paths.
5. Market intelligence, analytics, predictive, sales premium, and sustainability: 18 paths.
6. Autonomous and seed governance: 8 paths.

## Completion Evidence

- `pnpm audit:authorization`: PASS; 329 procedures inventoried, zero `TR-04` rows, exactly eight `TR-05` rows, no read-only organization mutations, and current hash-bound scoped-write evidence.
- Targeted organization, market-resource, rate-limit, and TR-04 router contracts: PASS, 29/29.
- `pnpm test:authorization:mysql`: PASS, 13/13 on disposable MySQL 8 with cleanup; report ownership races and rollback, portfolio-alert concurrent deduplication/expiry, public-share expiry, membership roles, and representative scoped writes execute against the real engine.
- `DATABASE_URL='' pnpm test`: PASS, 950 passed and 22 skipped; no shared database connection.
- `pnpm check`: PASS.
- `pnpm build`: PASS for client, Node server, and serverless bundle.
- `git diff --check`: PASS.
- Public-share access/header regression suites passed within the safe full suite.
- Claude Code's reopened ultra-review first returned `CHANGES_REQUIRED` for tenant-triggered global platform alerts through `project.evaluate`. The call was removed, a router-source regression and audit prohibition were added, and the fresh review returned `APPROVED_NO_OBJECTION`.
- Migration `0046_far_blob.sql` was generated, verified against disposable local MySQL, and applied to the approved production PlanetScale database. Post-DDL inspection confirms all 16 columns, the primary key, and unique `(organization_id, active_dedup_key)` index.
- Production release preflight found 2 null-organization projects, 4 null-organization scenarios, and 8 reports whose project was null-owned. The user approved the deterministic mapping to organization 1; one transaction updated the 2 projects and 4 scenarios, and post-backfill project/scenario/report legacy-null counts are all zero.

## Reopened Remediation

- Reopened: 2026-07-16
- Reason: A later Claude Code ultra-review identified two valid TR-04 gaps: project design-brief report artifacts were persisted through raw non-atomic helpers after the initial guard, and `portfolio.checkAlerts` allowed tenant members to write the global `platform_alerts` table.
- Required closeout: atomic organization-locked report persistence, an organization-owned portfolio-alert model, strengthened audit/evidence controls, fresh disposable MySQL evidence, and a new independent review.

## Residual Risk / Next Action

- The eight pooled learning/prediction paths remain intentionally assigned to `TR-05`.
- Production ownership remediation is complete and `KF-015` is closed. The application release may proceed, subject to the remaining deployment and smoke gates.
- Application commit `3d0e26068b3c96237dc20605923280c76e548152` was deployed to Vercel production as `dpl_7ndQvn6N7NpoJqx13fjBdgU5V8vM` and reached `READY`.
- Production smoke checks pass for site/API health, unauthenticated tenant rejection, invalid-share concealment/privacy headers, migration structure, and zero remaining legacy-null ownership counts.
- Production identifies application SHA `3d0e260`, and canonical `origin/main` now contains that exact application commit plus state-only release records. `KF-012` is closed.
- PlanetScale compatibility was not rerun for this uncommitted TR-04 worktree; the disposable MySQL 8 reference gate is current. Any future release must re-evaluate provider compatibility and `KF-014`.
- Next executable roadmap step: `TR-05`.
