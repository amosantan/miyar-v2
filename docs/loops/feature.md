---
id: loop-feature
version: 1
owner: engineering
risk: medium
max_iterations: 5
---

# Feature Delivery Loop

## Goal and Non-Goals

Deliver one coherent user outcome with verified primary, failure, permission, and presentation behavior and no unrelated regression.

## Trigger

An explicit user request, approved issue, or approved roadmap item requests new behavior.

## Required Context and Inputs

- Current request and acceptance criteria
- `AGENTS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, and `docs/PROJECT_STATE.md`
- Relevant implementation, tests, types, schema, ADRs, and comparable UX
- Applicable domain skill and verification/runbook documents

## Scope

The smallest cross-layer slice required for the approved user outcome: contracts, engine, data, API, UI, reports, tests, and documentation as applicable.

## Non-Goals

- Unrelated cleanup or redesign
- Silent breaking changes
- Production deployment, merge, or migration application without separate authority
- Scoring, pricing, benchmark, or compliance policy changes not explicitly approved

## Permissions and Safety Constraints

- Deterministic code remains numerical authority.
- Organization data remains server-authorized and isolated.
- Explicit user input is not silently overwritten by AI.
- Provenance, units, qualifiers, and report identity remain intact.
- Existing supported contracts remain compatible unless change is authorized.

## Preconditions

- [ ] User outcome and non-goals are clear.
- [ ] Existing behavior and nearest pattern were inspected.
- [ ] Acceptance criteria cover primary, empty, loading, invalid, error, unauthorized, and insufficient states as relevant.
- [ ] Risk, migration, security, and approval impact are identified.
- [ ] The smallest relevant baseline was run.

## Human Approval Gates

Require approval for production/shared mutation, new material dependency, breaking API/schema behavior, scoring/financial/compliance policy, protected-branch integration, deployment, publication, or external communication.

## Execution Steps

1. Trace the current user journey and data flow.
2. Frame measurable acceptance criteria and edge states.
3. Design contracts before implementation; create an ADR for durable boundary changes.
4. Implement in dependency order: shared types, deterministic engine, data, router, client, outputs.
5. Add evidence-producing tests alongside behavior.
6. Verify each risky increment, then the complete journey.
7. Review accessibility, performance, security, tenancy, numerical integrity, and diff scope.
8. Persist verified state and handover.

## Verification Ladder

- Targeted: `pnpm vitest run <affected-test-file>`
- Static: `pnpm check`
- Regression: `pnpm test` when shared behavior changes
- Build: `pnpm build`
- UI: Playwright/browser checks with responsive, empty, error, and console review
- Report/output: follow `docs/loops/report-visual-qa.md`
- Schema: follow `docs/loops/schema-migration.md`

## Acceptance Criteria

- [ ] Authorized user can complete the intended journey.
- [ ] Important alternative and failure states are handled.
- [ ] Data is validated and organization-scoped.
- [ ] Authoritative numbers use governed deterministic logic.
- [ ] Tests cover success and critical failures.
- [ ] Browser/artifact behavior is directly verified where applicable.
- [ ] Compatibility, migration, observability, and documentation impact are addressed.

## Failure Classification

Classify as requirement ambiguity, contract mismatch, engine regression, data/schema issue, authorization failure, UI/rendering defect, external dependency, environment, or pre-existing repository failure.

## Recovery and Rollback

- Requirement ambiguity: present concrete options and transition to `NEEDS_HUMAN` when material.
- Targeted failure: return to the causal layer before widening scope.
- Contract break: restore compatibility or request breaking-change approval.
- External service unavailable: verify local/deterministic behavior and report blocked integration evidence.
- Unrelated baseline failure: reproduce, record, prove no regression, and keep the full gate red.

## Retry Policy

Maximum 5 loop iterations and 3 attempts per unchanged failure class. Every retry needs new evidence. Exhaustion results in `BLOCKED`.

## Resource Budget

- Maximum loop iterations: 5.
- Set task-specific time, tool-call, cost, and environment limits before execution.
- Stop at the first exhausted hard limit and transition to `BLOCKED` or `NEEDS_HUMAN`.

## Terminal States

- `PASS`: all acceptance criteria and required verification levels pass.
- `FAILED`: delivered behavior is incorrect or unsafe.
- `BLOCKED`: dependency or retry exhaustion prevents completion.
- `NEEDS_HUMAN`: product/approval decision is required.
- `CANCELLED`: request was withdrawn or replaced.

## Required Evidence

- Changed files and diff summary
- Acceptance-criteria mapping
- Commands and test/build results
- Browser/artifact evidence
- Security, tenancy, numerical, and migration review
- Remaining risks, known failures, and approvals

## Persistent State Updates

Update `.agent/state/CURRENT_TASK.md` and `WORKLOG.md` for multi-session work, `KNOWN_FAILURES.md` only from reproduction, relevant ADR/architecture when contracts change, and `docs/PROJECT_STATE.md` only after direct verification.
