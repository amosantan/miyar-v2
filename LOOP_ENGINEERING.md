# MIYAR Closed-Loop Engineering System

## Purpose

This document defines how Codex, Claude Code, and human engineers repeatedly discover, execute, verify, recover, and hand over work without losing context or declaring success prematurely.

The loop is a control system. The model proposes actions; repository evidence decides whether those actions succeeded.

## Core Model

```text
TRIGGER
  -> PERCEIVE
  -> FRAME
  -> PLAN
  -> ACT
  -> VERIFY
  -> REVIEW
  -> PERSIST
  -> PASS or NEXT ITERATION

Any stage may transition to:
  NEEDS_HUMAN | BLOCKED | FAILED | CANCELLED
```

### 1. Trigger

A loop starts from an explicit signal:

- User request
- Bug report
- Failed test or CI run
- Approved roadmap item
- Data-quality alert
- Scheduled maintenance event
- Review feedback

The trigger does not automatically authorize deployment, data mutation, merging, or external communication.

### 2. Perceive

Build a current world model from evidence:

- Read the canonical instructions and active task.
- Inspect Git branch, status, diff, and recent history.
- Locate relevant implementation, tests, types, schema, and documentation.
- Reproduce the reported behavior when possible.
- Mark facts with source and freshness.
- Separate observed facts from assumptions and hypotheses.

Required output: a concise problem statement and evidence inventory.

### 3. Frame

Convert the trigger into a bounded contract:

- Goal
- Non-goals
- Acceptance criteria
- Invariants
- Risk class
- Required approvals
- Verification level
- Retry budget
- Expected artifacts

If acceptance cannot be tested or observed, the task is not ready for autonomous implementation.

### 4. Plan

Create the smallest dependency-ordered plan. A good plan:

- Starts with the causal layer, not the visible symptom.
- Identifies affected contracts and downstream consumers.
- Names verification after each risky step.
- Preserves rollback points.
- Avoids unrelated cleanup.

For simple tasks, the plan may be only two or three internal steps. Persist it in `.agent/state/CURRENT_TASK.md` when work is long-running, high-risk, or crosses sessions.

### 5. Act

Implement one coherent increment:

- Prefer reversible, localized changes.
- Preserve existing user work.
- Keep deterministic logic separate from generative AI.
- Add evidence-producing tests alongside behavior changes.
- Do not change tests merely to match a faulty implementation.
- Do not mutate shared external systems unless authorized.

### 6. Verify

Run the verification ladder defined in `docs/VERIFICATION.md`.

Verification must be:

- Objective: based on commands, outputs, rendered artifacts, or direct behavior.
- Relevant: exercises the changed behavior.
- Reproducible: another engineer can repeat it.
- Proportional: higher risk requires stronger evidence.
- Honest: failures remain failures even when believed to be pre-existing.

### 7. Review

Perform a distinct review pass after tests:

- Re-read the request and acceptance criteria.
- Inspect the complete diff.
- Look for regressions, hidden scope, tenant leaks, unsafe defaults, stale types, and missing error handling.
- Confirm tests would fail without the intended behavior.
- Confirm no evidence was fabricated or inferred from documentation alone.

For high-risk work, prefer an independent reviewer or a separate review context.

### 8. Persist

Leave durable, minimal state:

- Update `.agent/state/CURRENT_TASK.md` with terminal status and evidence.
- Update `.agent/state/KNOWN_FAILURES.md` only for reproduced unresolved failures.
- Update `docs/PROJECT_STATE.md` only for newly verified repository facts.
- Append a short `.agent/state/WORKLOG.md` handover for multi-session work.
- Update architecture, runbooks, or ADRs when a durable contract changed.
- Use Git commits as the detailed historical record.

Never copy the same changing count or phase status into multiple instruction files.

## Task Classification

| Class | Examples | Default risk | Minimum verification |
|---|---|---:|---|
| Explain | Architecture brief, diagnosis | Low | Source inspection and evidence citations |
| Docs | Runbook, specification | Low | Link, command, and consistency checks |
| UI | Component, page, responsive fix | Medium | Type-check, targeted tests, browser and visual check |
| Engine | Scoring, pricing, quantity logic | High | Unit, regression, edge cases, type-check, build |
| API | Router, auth, validation | High | Contract, authorization, integration, negative-path tests |
| Data | Import, ingestion, backfill | High | Dry run, counts, quality checks, idempotency, recovery |
| Schema | Table or column migration | Critical | Generate, inspect, apply in safe target, integrity, rollback |
| Report | PDF, DOCX, investor output | High | Data assertions plus rendered visual inspection |
| Release | Merge, deploy, production config | Critical | Full gates, approval, health checks, rollback readiness |

## Verification Ladder

Use the lowest levels that fully cover the risk; critical work normally requires all applicable levels.

1. **L0 — Inspection:** paths, imports, schemas, configuration, diff.
2. **L1 — Static:** TypeScript, formatting, linting where configured.
3. **L2 — Unit:** pure functions, edge cases, deterministic fixtures.
4. **L3 — Integration:** router, database, authorization, engine composition.
5. **L4 — Build:** production bundle and packaging.
6. **L5 — Workflow:** end-to-end browser or API user journey.
7. **L6 — Artifact:** screenshot, PDF, DOCX, spreadsheet, or generated-output inspection.
8. **L7 — Operational:** migration dry run, deployment health, monitoring, rollback.
9. **L8 — Independent:** separate reviewer, adversarial checks, or production owner approval.

## Failure Classification and Recovery

Every failed verification must be classified before retrying:

| Failure | Response |
|---|---|
| Implementation regression | Revert or repair the smallest causal change; rerun targeted check |
| Pre-existing reproducible failure | Record exact evidence; prove no regression; do not call the full suite green |
| Environment/configuration | Verify prerequisites and configuration; do not patch product logic to hide it |
| Flaky/non-deterministic | Reproduce repeatedly, isolate randomness/time/network, document stability evidence |
| Test/spec conflict | Stop and resolve intended behavior; do not choose whichever is easier |
| Missing authority | Transition to `NEEDS_HUMAN` with the precise requested approval |
| External dependency unavailable | Use a documented safe fallback or transition to `BLOCKED` |
| Security/data-integrity risk | Stop immediately and preserve evidence |

### Retry Rules

- Default: at most 3 attempts for one failure class.
- Each attempt must state a new hypothesis supported by new evidence.
- Do not repeat the same command/change cycle without learning.
- Widen scope only when evidence shows the cause lies outside the original boundary.
- Exhausted retries transition to `BLOCKED`, not endless exploration.

## Terminal States

### PASS

All acceptance criteria are evidenced and applicable verification gates pass. Any unrelated known failures are explicitly disclosed.

### FAILED

The requested outcome was attempted but is incorrect or verification proves it did not succeed. Revert unsafe partial work when possible.

### BLOCKED

Progress cannot continue because a reproducible dependency, environment, missing input, or repeated technical blocker remains. Include evidence, attempts, and the smallest unblock condition.

### NEEDS_HUMAN

A decision, approval, credential, product choice, or irreversible action must come from an authorized human.

### CANCELLED

The user replaced or withdrew the task. Preserve unrelated work and clearly identify any partial changes.

## Human Gates

Human approval is mandatory before:

- Production deployment or rollback.
- Shared/production database migration or destructive write.
- Merge to a protected branch or external publication.
- Material scoring, pricing, compliance, or financial-policy change.
- Secret rotation or permission expansion.
- Irreversible deletion.
- Acceptance of a known security or tenant-isolation regression.

## Memory Design

Use four different memory layers:

1. **Invariant memory:** `AGENTS.md`; durable rules that rarely change.
2. **Operational state:** `docs/PROJECT_STATE.md`; generated or verified current facts.
3. **Task memory:** `.agent/state/CURRENT_TASK.md`; one active bounded objective.
4. **Historical memory:** Git and archived reports; never loaded as current truth by default.

Claude auto-memory and conversation context are advisory conveniences. They never override repository evidence.

## MIYAR-Specific Closed Loops

### Feature Loop

Specify user outcome -> map affected layers -> add failing evidence when practical -> implement -> targeted verification -> full applicable gates -> browser/artifact review -> handover.

### Defect Loop

Reproduce -> minimize -> identify causal layer -> add regression test -> repair -> prove the test catches the old behavior -> run surrounding regression -> document residual risk.

### Schema Loop

Inspect current schema and journal -> define forward and recovery paths -> generate migration -> review SQL -> test in a safe target -> verify data integrity and application compatibility -> request approval before shared application.

### Ingestion Loop

Select source -> verify authorization and robots/terms constraints -> capture raw evidence -> normalize -> validate quality and provenance -> test idempotency -> stage proposals -> require approval before authoritative benchmark promotion.

### Scoring/Pricing Loop

Freeze fixtures -> document intended formula and authority -> implement deterministic function -> test boundaries and monotonicity -> compare old/new results -> verify explainability and stored version -> require approval for policy changes.

### Report Loop

Build fixture -> generate report -> assert required sections and evidence -> render final artifact -> visually inspect pagination, overflow, branding, numbers, and disclaimers -> verify sharing/access behavior.

### Release Loop

Clean branch -> full required gates -> review migrations and configuration -> human approval -> deploy -> smoke and health checks -> monitor -> close only after rollback window criteria are satisfied.

## Anti-Patterns

- Declaring completion from documentation or test counts without running checks.
- Asking the same agent to judge subjective quality without objective evidence.
- Updating several “source of truth” files manually with duplicated facts.
- Treating historical plans as current requirements.
- Hiding failures with `|| true`, broad ignores, skipped tests, or weakened assertions.
- Running full suites repeatedly without first using targeted feedback.
- Continuing after retry budget exhaustion.
- Letting an LLM invent authoritative prices, scores, or compliance decisions.
- Mixing implementation, migration application, deployment, and publication into one implicit permission.

## System Maintenance

Review this system when:

- An agent repeats the same mistake twice.
- Review identifies a missing invariant.
- A command, architecture boundary, or deployment path changes.
- A loop repeatedly terminates incorrectly.
- Verification produces false positives or cannot reproduce production behavior.

Modify the smallest authoritative file. Avoid adding a new rule when an existing rule can be clarified or mechanically enforced.
