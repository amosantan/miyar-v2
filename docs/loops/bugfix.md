---
id: loop-bugfix
version: 1
owner: engineering
risk: medium
max_iterations: 5
---

# Defect Repair Loop

## Goal and Non-Goals

Reproduce a defect, identify its causal layer, add evidence that detects it, make the smallest correct repair, and prove surrounding behavior remains intact.

## Trigger

User report, failed test/CI, monitoring signal, review finding, or observed contract inconsistency.

## Required Context and Inputs

- Symptom, expected behavior, affected environment/user, and safe reproduction data
- Logs, screenshots, errors, last-known-good release, and recent Git history
- Current product/API/data contract, code, tests, schema, and known failures

## Scope

The causal defect, regression evidence, directly affected contracts, and necessary recovery/communication.

## Non-Goals

- Speculative unrelated fixes
- Test weakening
- Broad refactoring without causal evidence
- Production remediation without incident/release authority

## Permissions and Safety Constraints

- Preserve user data and unrelated work.
- Repair the causal layer rather than mask the symptom.
- Do not call an unreproduced or still-failing issue resolved.
- Do not hide failures with skips, retries, ignores, or `|| true`.

## Preconditions

- [ ] Security/incident data is handled under `docs/SECURITY.md`.
- [ ] Branch/worktree and known failures inspected.
- [ ] Symptom is separated from assumptions about cause.
- [ ] Expected behavior has an identifiable authority.

## Human Approval Gates

Escalate for ambiguous material behavior, production/data correction, destructive recovery, customer communication, security containment, policy changes, or protected-branch/deployment actions.

## Execution Steps

1. Reproduce before editing whenever safe.
2. Minimize to the smallest failing component, engine, router, query, fixture, or environment condition.
3. Record an evidence-backed causal hypothesis and discriminating check.
4. Add regression evidence and confirm it catches old behavior when practical.
5. Implement the smallest causal repair.
6. Run regression, surrounding, static, build, and workflow checks as applicable.
7. Re-exercise the original symptom and review the complete diff.
8. Persist cause, evidence, residual risk, and prevention.

## Verification Ladder

- Reproduction command/procedure captured verbatim
- `pnpm vitest run <regression-test>`
- Related test files, then `pnpm test` when shared behavior is affected
- `pnpm check` and `pnpm build` as applicable
- Browser/artifact/data integrity verification for the original failure mode

## Acceptance Criteria

- [ ] Defect reproduced or inability is explicitly evidenced.
- [ ] Root cause is supported by evidence.
- [ ] Regression evidence detects old behavior.
- [ ] Minimal repair passes targeted and surrounding checks.
- [ ] Original workflow no longer fails.
- [ ] No test was weakened to fit implementation.
- [ ] Historical data/outputs and residual risk are addressed.

## Failure Classification

Implementation regression, test defect, specification conflict, environment/configuration, data-specific failure, flaky/nondeterministic behavior, external dependency, or security incident.

## Recovery and Rollback

- Failed hypothesis: record new observation and change hypothesis.
- Flaky behavior: control seed/time/network and gather repeated evidence.
- Test/spec conflict: resolve authoritative behavior; use `NEEDS_HUMAN` if material.
- Data defect: separate code repair, data correction, and backfill approvals.
- Security/production incident: switch to `docs/runbooks/incident-response.md`.

## Retry Policy

Maximum 5 iterations and 3 attempts per unchanged hypothesis/failure class. No identical speculative retry. Exhaustion becomes `BLOCKED`.

## Resource Budget

- Maximum loop iterations: 5.
- Set task-specific time, tool-call, cost, and environment limits before execution.
- Stop at the first exhausted hard limit and transition to `BLOCKED` or `NEEDS_HUMAN`.

## Terminal States

- `PASS`: old defect no longer reproduces and regression evidence passes.
- `FAILED`: repair is incorrect, incomplete, or unsafe.
- `BLOCKED`: evidence/environment/retry limits prevent resolution.
- `NEEDS_HUMAN`: expected behavior or remediation requires authority.
- `CANCELLED`: task withdrawn or superseded.

## Required Evidence

- Reproduction steps and actual/expected result
- Root-cause hypothesis and proof
- Changed files/diff
- Regression and broader command results
- Original workflow/manual evidence
- Historical-data impact and remaining risks

## Persistent State Updates

Update the active task and worklog for persisted work. Add/remove a known failure only with reproduction/fix evidence. Add a durable rule only when it prevents a recurring concrete failure class.
