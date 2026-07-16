# Known Reproduced Failures

Known does not mean accepted. A failure remains open until its exit criterion is verified. Never use this file to describe a failing full suite as green.

## KF-006 — Project and child-resource authorization gaps

- Status: OPEN
- Observed: 2026-07-16 at `a15424b` plus the TR-01 inventory worktree.
- Command: `pnpm audit:authorization`
- Evidence: `docs/security/resource-authorization-inventory.json` inventories all 327 router procedures. `TR-03` closed all 39 design-domain rows; 93 remaining authorization/global-governance/legacy-user rows are assigned to `TR-04`.
- Impact: authenticated callers can reach project, asset, brief, scenario, report, board, visual, room, allocation, evidence, or polymorphic records without every path proving the organization boundary; some global mutations also lack appropriate governance.
- Owner: Canonical resolver foundation closed in `TR-02` and design-router adoption closed in `TR-03`; remaining router remediation is owned by `TR-04`.
- Exit criterion: every `TR-04` inventory row is reclassified with proven organization, token, admin, or governed-global authorization; same-org, cross-org, missing, legacy-null, and polymorphic-target tests pass.

## KF-007 — Cross-organization evidence and learning contamination

- Status: OPEN
- Observed: 2026-07-16 at `a15424b` plus the TR-01 inventory worktree.
- Command: `pnpm audit:authorization`
- Evidence: Eight procedures are assigned to `TR-05`: analytics market position/trend detection, design-advisor recommendations, learning comparison/post-mortem, and predictive cost/outcome/UAE-range paths. They read unscoped evidence, scores, projects, or comparables that can include organization-owned or confidential records.
- Impact: one organization's data can influence another organization's recommendations, predictions, trends, or post-mortem comparisons even where target-project access is guarded.
- Owner: Roadmap `TR-05`.
- Exit criterion: organization-only data is the safe default, insufficient-data behavior is explicit, and two-organization fixtures prove no cross-organization record influence; any pooled cohort requires separate governance approval.

## KF-008 — Full test suite is not database-hermetic

- Status: OPEN
- Observed: 2026-07-16 at `a15424b` plus the TR-01 inventory worktree.
- Command: `pnpm test`
- Evidence: `server/auth.logout.test.ts` inherited the configured remote `DATABASE_URL`, connected to the remote service, and attempted an audit-log insert. The write failed because the remote branch was missing or sleeping; the test itself passed after logging the failure. On 2026-07-16, `env -u DATABASE_URL pnpm test` remained unsafe because `dotenv/config` restored the local value; `DATABASE_URL='' pnpm test` prevented the connection and reproduced the same nine application failures.
- Impact: ordinary local verification can contact or attempt writes to a shared database, violating safe-test expectations and making results environment-dependent.
- Owner: Roadmap `TR-07` and `TR-12`.
- Exit criterion: test configuration forces a dedicated isolated database or mocked data layer, fails before contacting protected/shared targets, and the full suite produces no external database connection or write attempt.

## KF-009 — Organization context does not prove current membership or design role

- Status: OPEN
- Observed: 2026-07-16 at `1f972f4`.
- Evidence: `orgProcedure` trusts `users.orgId` without resolving `organization_members`, and design mutations do not distinguish viewer, member, and organization-admin roles.
- Impact: stale membership can retain tenant access, and viewers can invoke design mutations.
- Owner: `TR-03H`.
- Exit criterion: exactly one live membership is required per request; removed/duplicate/stale memberships fail closed; design viewer/member/admin contracts pass.

## KF-010 — TR-03 final-write and transaction guarantees are incomplete

- Status: OPEN
- Observed: 2026-07-16 at `1f972f4`.
- Evidence: share-token update is raw-ID scoped; board/RFQ/floor-plan composite operations span separate statements or transactions; scoped SQL is mocked by router tests.
- Impact: ownership changes or partial failures can modify the wrong final resource, leave partial records, or escape the claimed rollback boundary.
- Owner: `TR-03H`.
- Exit criterion: final writes are organization/project scoped, composite mutations are atomic, and real isolated MySQL tests prove affected-row and rollback behavior.

## KF-011 — Rejected uploads and public-share responses lack operational containment

- Status: OPEN
- Observed: 2026-07-16 at `1f972f4` and the production deployment.
- Evidence: storage upload precedes final scoped persistence without compensation; public-share responses do not set `no-store` or `noindex`.
- Impact: lost authorization can leave orphaned storage objects, and expired public content can remain stored or indexed.
- Owner: `TR-03H`.
- Exit criterion: explicit rejected persistence deletes its object, indeterminate outcomes emit critical reconciliation telemetry, and share API/page headers pass Node, serverless, and production checks.

## KF-012 — Canonical main does not identify the production release

- Status: OPEN
- Observed: 2026-07-16 after deployment of `1f972f4`.
- Evidence: production was deployed from `codex/loop-engineering-architecture`; `origin/main` remains nine commits behind.
- Impact: a future main-based deployment can silently remove the authorization and runtime fixes; rollback and attribution are ambiguous.
- Owner: `TR-03H` release closeout.
- Exit criterion: the complete reviewed branch is fast-forwarded to canonical `main`, the deployed SHA equals main, and release evidence records the identity.

## KF-013 — RFQ generation retries are intentionally non-idempotent

- Status: OPEN
- Observed: 2026-07-16 during `TR-03H`.
- Evidence: the atomic RFQ helper inserts one complete batch per successful request and preserves order and duplicates, but it has no request key or prior-batch replacement contract.
- Impact: a client retry after an uncertain response can append a second complete RFQ batch even though each individual transaction is atomic.
- Owner: Later RFQ workflow/idempotency step; outside the bounded TR-03H authorization hardening scope.
- Exit criterion: RFQ generation accepts a stable idempotency key or uses an approved replace/version contract, with retry and uncertain-response integration tests proving one intended result.

## Handling Protocol

1. Reproduce a failure before adding it.
2. Record command, commit, environment limitation, impact, and evidence.
3. Assign an owner and target when remediation is scheduled.
4. State an objective exit criterion.
5. For flaky behavior, include repeated-run evidence and quarantine expiry.
6. Remove only after a passing command and fixing commit are recorded in `WORKLOG.md`.
