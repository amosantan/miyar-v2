# Known Reproduced Failures

Known does not mean accepted. A failure remains open until its exit criterion is verified. Never use this file to describe a failing full suite as green.

## KF-001 — TypeScript check is red

- Status: OPEN
- Observed: 2026-07-14 at `422fbe0`
- Command: `pnpm check`
- Evidence: non-zero exit with errors across client administration/market pages, ingestion utilities, and server router type contracts.
- Impact: the repository cannot claim type-safe completion; fail-closed CI will reject the current baseline until corrected.
- Owner: Unassigned
- Exit criterion: `pnpm check` exits 0 without suppression and CI requires the check.

## KF-002 — Connector tests

- Status: OPEN
- Command: `pnpm test`
- Failures: connector registry cannot resolve the SCAD PDF connector in the test runtime; RICS confidence expectation differs from implementation.
- Owner: Unassigned
- Exit criterion: connector tests pass with the intended module/runtime strategy and a documented, versioned confidence rule.

## KF-003 — Board PDF annex tests

- Status: OPEN
- Command: `pnpm test`
- Failures: two design-brief HTML tests expect a Material Board Annex that is not rendered.
- Owner: Unassigned
- Exit criterion: intended report contract is confirmed and both tests pass without weakening required report content.

## KF-004 — Space-program tests

- Status: OPEN
- Command: `pnpm test`
- Failures: empty-room behavior differs from the test; two tests use an invalid normalization module path.
- Owner: Unassigned
- Exit criterion: intended empty-state behavior is specified, module paths are correct, and all three tests pass.

## KF-005 — Authentication tests

- Status: OPEN
- Command: `pnpm test`
- Failures: two auth tests mock `server/db.ts` without the newer `getDb` export.
- Owner: Unassigned
- Exit criterion: mocks represent the real contract and both tests pass without weakening organization creation or isolation behavior.

## Handling Protocol

1. Reproduce a failure before adding it.
2. Record command, commit, environment limitation, impact, and evidence.
3. Assign an owner and target when remediation is scheduled.
4. State an objective exit criterion.
5. For flaky behavior, include repeated-run evidence and quarantine expiry.
6. Remove only after a passing command and fixing commit are recorded in `WORKLOG.md`.
