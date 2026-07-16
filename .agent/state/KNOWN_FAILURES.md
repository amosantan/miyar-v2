# Known Reproduced Failures

Known does not mean accepted. A failure remains open until its exit criterion is verified. Never use this file to describe a failing full suite as green.

## KF-006 — Project and child-resource authorization gaps

- Status: OPEN
- Observed: 2026-07-16 at `a15424b` plus the TR-01 inventory worktree.
- Command: `pnpm audit:authorization`
- Evidence: `docs/security/resource-authorization-inventory.json` inventories all 327 router procedures and assigns 39 design-domain rows to `TR-03` plus 93 remaining authorization/global-governance/legacy-user rows to `TR-04`. A disposable mocked `design.listAssets` probe expected `NOT_FOUND` but received the other-project asset list.
- Impact: authenticated callers can reach project, asset, brief, scenario, report, board, visual, room, allocation, evidence, or polymorphic records without every path proving the organization boundary; some global mutations also lack appropriate governance.
- Owner: Canonical resolver foundation closed in `TR-02`; remaining router remediation is owned by `TR-03` and `TR-04`.
- Exit criterion: every `TR-03`/`TR-04` inventory row is reclassified with proven organization, token, admin, or governed-global authorization; same-org, cross-org, missing, legacy-null, and polymorphic-target tests pass.

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

## Handling Protocol

1. Reproduce a failure before adding it.
2. Record command, commit, environment limitation, impact, and evidence.
3. Assign an owner and target when remediation is scheduled.
4. State an objective exit criterion.
5. For flaky behavior, include repeated-run evidence and quarantine expiry.
6. Remove only after a passing command and fixing commit are recorded in `WORKLOG.md`.
