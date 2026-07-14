---
id: loop-name
version: 1
owner: engineering
risk: medium
max_iterations: 5
---

# Loop: Name

## Goal and Non-Goals

State one observable outcome. Describe what is true when the loop succeeds, not merely what files are edited.

## Trigger

Name the signal that starts the loop: explicit request, approved issue, failed check, alert, scheduled event, or review feedback.

## Required Context and Inputs

| Input | Authority | Freshness requirement |
|---|---|---|
| User requirement | Current task/request | Current |
| Repository contract | `AGENTS.md` | Current checkout |
| Product/architecture/state | Relevant current docs and live code | Reverify material facts |

## Scope

List included systems, users, files, data, environments, and artifacts.

## Non-Goals

List explicitly excluded work and actions that require a separate authorization.

## Permissions and Safety Constraints

- Product, security, tenant, data, numerical, and compatibility rules that must remain true.

## Preconditions

- [ ] Current branch and worktree inspected.
- [ ] Baseline behavior observed.
- [ ] Acceptance criteria are testable.
- [ ] Risk and approval gates identified.
- [ ] Required tools/environment available.

## Human Approval Gates

List irreversible, shared, production, policy, financial, schema, deployment, merge, publication, or external actions that require an authorized human.

## Execution Steps

1. Perceive current state and collect evidence.
2. Frame the bounded task and assumptions.
3. Plan the smallest dependency-ordered change.
4. Implement one coherent increment.
5. Verify with deterministic evidence.
6. Review the complete diff and risks.
7. Persist state and handover.

## Verification Ladder

| Gate | Command/procedure | Pass condition |
|---|---|---|
| Static | `pnpm check` | Exit 0 without suppression |
| Targeted | `pnpm vitest run <file>` | Relevant behavior passes |
| Broader | Select from `docs/VERIFICATION.md` | Required level passes |

## Acceptance Criteria

- [ ] Each criterion maps to objective evidence.
- [ ] Applicable verification gates pass.
- [ ] Important failure paths are handled.
- [ ] Diff scope is intentional.
- [ ] Required approvals are recorded.

## Failure Classification

Classify failures as implementation regression, pre-existing failure, environment/configuration, flaky behavior, specification conflict, missing authority, external dependency, or security/data-integrity risk.

## Recovery and Rollback

| Failure class | Recovery |
|---|---|
| Implementation | Repair/revert smallest causal change and rerun targeted evidence |
| Environment | Correct prerequisites; do not patch product behavior to hide it |
| Specification | Resolve authority; use `NEEDS_HUMAN` when material |
| Security/data | Stop, preserve evidence, and escalate |

## Retry Policy

- Maximum iterations: 5.
- Maximum attempts per unchanged failure class: 3.
- Every retry needs a new evidence-backed hypothesis.
- Do not repeat the same change/command cycle unchanged.
- Exhausted budget transitions to `BLOCKED`.

## Resource Budget

- Maximum loop iterations: 5.
- Set task-specific time, tool-call, cost, and environment limits before execution.
- Stop at the first exhausted hard limit and transition to `BLOCKED` or `NEEDS_HUMAN`.

## Terminal States

- `PASS`: all acceptance criteria and gates are evidenced.
- `FAILED`: verification proves the requested outcome is not achieved.
- `BLOCKED`: retry budget is exhausted or a dependency prevents progress.
- `NEEDS_HUMAN`: an authorized decision or approval is required.
- `CANCELLED`: the task was withdrawn or replaced.

## Required Evidence

- Changed files
- Diff summary
- Commands executed and exit results
- Test results
- Manual/browser/artifact verification
- Security/data/migration evidence where applicable
- Remaining risks and known failures
- Approvals and terminal state

## Persistent State Updates

- Update `.agent/state/CURRENT_TASK.md` for persisted work.
- Update `.agent/state/KNOWN_FAILURES.md` only from reproduced evidence.
- Append a concise `.agent/state/WORKLOG.md` handover.
- Update `docs/PROJECT_STATE.md` only when verified facts change.
- Use Git as the detailed history.
