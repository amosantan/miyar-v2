# Roadmap Execution Runbook

## Purpose

This runbook tells Codex, Claude Code, and human engineers how to execute `.agent/state/ROADMAP.md` one bounded step at a time while preserving decisions, verification, failures, and lessons across sessions.

## Memory Model

| Need                                | Canonical file                   |
| ----------------------------------- | -------------------------------- |
| Durable rules                       | `AGENTS.md`                      |
| Strategic product priorities        | `docs/ROADMAP.md`                |
| Ordered executable steps and status | `.agent/state/ROADMAP.md`        |
| One active bounded task             | `.agent/state/CURRENT_TASK.md`   |
| Current verified repository facts   | `docs/PROJECT_STATE.md`          |
| Reproduced unresolved failures      | `.agent/state/KNOWN_FAILURES.md` |
| Durable reusable learning           | `.agent/state/LESSONS.md`        |
| Concise completed handovers         | `.agent/state/WORKLOG.md`        |
| Permanent detailed history          | Git commits                      |
| Terms, acronyms, shorthand          | `memory/glossary.md`             |
| People, directives, working style   | `memory/people/`                 |
| UAE market and regulatory knowledge | `memory/domain/`                 |
| External research provenance        | `memory/research/`               |
| Decision rationale and alternatives | `memory/decisions/README.md`     |
| Session narrative                   | `memory/journal/`                |

The rows above the divider are execution state; the `memory/` rows are the second memory, which holds the durable context those files never had a home for. It is context, never authority, and it never restates a fact owned by a canonical file. See `docs/runbooks/memory-sync.md`.

No chat session can promise “forever” memory. Repository state persists across Codex and Claude Code sessions; committed Git history is the durable cross-machine record.

## Starting the Next Step

1. Read `AGENTS.md`, `docs/PROJECT_STATE.md`, `.agent/state/KNOWN_FAILURES.md`, `.agent/state/ROADMAP.md`, and `.agent/state/LESSONS.md`.
2. Inspect Git status, branch, recent commits, and user-owned changes.
3. Find the single `Next executable step`.
4. Confirm its dependencies are `CLOSED`.
5. If its status is `NEEDS_HUMAN`, prepare the smallest decision package and stop; do not implement the gated change.
6. Copy the roadmap step into `.agent/state/CURRENT_TASK.md`:
   - preserve the roadmap ID;
   - add bounded goal/non-goals;
   - convert “Done when” into checkable acceptance criteria;
   - name exact verification commands/artifacts;
   - set risk, retry budget, and approval gates.
7. Change the roadmap step from `READY` to `ACTIVE`.
8. Do not change the next executable pointer until the active step closes, blocks, needs a human, or is cancelled.

## Planning in Codex or Claude Code

The plan must:

- begin with current repository evidence, not the audit's historical counts;
- address only one roadmap step unless the user explicitly authorizes a combined increment;
- order work by causal dependency;
- identify likely files/contracts before editing;
- include relevant negative-path, tenant, data, browser, report, or migration verification;
- state which durable lessons affect the plan;
- distinguish safe implementation from human-gated decisions.

When Plan mode is available, the roadmap step is the planning input—not permission to implement unrelated later steps.

## Executing a Step

1. Establish the smallest live baseline.
2. Implement one coherent increment.
3. After each failed attempt, record a new hypothesis in `CURRENT_TASK.md`.
4. Stop after three attempts for the same blocker and use `BLOCKED`.
5. Stop immediately for possible tenant leakage, data loss, secrets, or ambiguous irreversible action.
6. Preserve all unrelated and user-owned working files.

## Learning During Execution

When an issue is discovered:

1. Record the symptom and evidence in `CURRENT_TASK.md`.
2. Determine whether it is:
   - part of the active step;
   - a reproduced known failure;
   - a new roadmap dependency;
   - an unrelated observation.
3. If it changes future work, update the affected roadmap step without silently expanding the active task.
4. After the cause and effective fix are proven, append a lesson to `.agent/state/LESSONS.md`.
5. Reference the lesson ID from the active step's completion record.

A failed idea can be a lesson if it invalidates a reusable hypothesis. Do not record speculative advice as learned fact.

## Closing a Step

A step closes only when all listed acceptance criteria have objective evidence.

In the same change:

1. Set `CURRENT_TASK.md` to `PASS` and include exact evidence.
2. Set the roadmap step to `CLOSED`.
3. Add close date, terminal state, verification, residual risk, and lesson IDs to the step.
4. Append one concise row to `WORKLOG.md`.
5. Update `KNOWN_FAILURES.md` only for reproduced failures that opened or closed.
6. Update `PROJECT_STATE.md` only when current verified facts changed.
7. Append durable lessons.
8. Select exactly one dependency-valid next step:
   - set it to `READY` if actionable;
   - or leave it `NEEDS_HUMAN` and name the decision required.
9. Update `Next executable step`.
10. Review the full diff and ensure no unexplained artifacts remain.

## Blocking, Human Gates, and Cancellation

### BLOCKED

- Set `CURRENT_TASK.md` terminal state to `BLOCKED` only after the retry rule is exhausted.
- Set the roadmap step to `BLOCKED`.
- Record attempts, evidence, and the smallest unblock condition.
- Choose another next step only if it is independent and the user accepts the reprioritization.

### NEEDS_HUMAN

- Set the roadmap step to `NEEDS_HUMAN`.
- State the exact owner, question, options, impacts, and safe default.
- Do not treat user silence as approval.
- An independent safe step may become next only when dependencies allow it.

### CANCELLED

- Record who cancelled it, why, and whether any partial changes remain.
- Never delete the roadmap ID or its history.

## Handover Checklist

- [ ] Roadmap and current task agree on the active/terminal step.
- [ ] Exactly one next executable step is named.
- [ ] Acceptance evidence is reproducible.
- [ ] Baseline failures and new regressions are separated.
- [ ] New lessons include proof and a reuse rule.
- [ ] Human gates remain explicit.
- [ ] User-owned migration and unrelated changes are preserved.
- [ ] No secrets or production data were recorded.
- [ ] Git status contains no unexplained agent-created files.
