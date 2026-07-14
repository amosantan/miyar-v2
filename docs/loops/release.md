---
id: loop-release
version: 1
owner: release-owner
risk: critical
max_iterations: 5
---

# Release Decision Loop

## Goal and Non-Goals

Make an evidence-based release decision, deploy only with explicit target-specific authorization, verify critical behavior/monitoring, and retain a tested rollback path.

## Trigger

An approved commit or release candidate is proposed for a shared environment or production.

## Required Context and Inputs

- Exact candidate commit, prior release, target, owner, and approver
- CI/local verification, release diff, migrations/backfills, config/dependency changes
- `docs/runbooks/release.md`, `deployment.md`, `rollback.md`, and `incident-response.md`
- Monitoring baseline and critical smoke journeys

## Scope

Candidate assembly, verification, risk/approval decision, deployment, smoke checks, observation, rollback decision, and release evidence.

## Non-Goals

- Feature implementation during release
- Silent exception acceptance
- Ad hoc secret/config changes
- Bundling unapproved data correction with deployment

## Permissions and Safety Constraints

- Release artifact maps to approved commit.
- Mandatory checks fail closed.
- Secrets are not exposed to untrusted steps/logs.
- Migration and application order are compatible.
- Tenant, numerical, and decision integrity outrank release schedule.
- Rollback/containment remains available.

## Preconditions

- [ ] Owner, approver, target, candidate, prior release, and window recorded.
- [ ] Diff and required gates reviewed.
- [ ] Exceptions have owner, reason, evidence, and expiry.
- [ ] Config, migrations, backfills, flags, monitoring, smoke data, and rollback ready.

## Human Approval Gates

Shared/production deployment, migration, backfill, exception acceptance, rollback, external release communication, and protected-branch merge each require appropriate authorization.

## Execution Steps

1. Assemble immutable candidate and release notes.
2. Run all risk-appropriate verification levels.
3. Assess user/tenant, data, numerical, dependency, compatibility, and rollback risk.
4. Present evidence and obtain target-specific approval.
5. Deploy through established platform workflow.
6. Run health, auth, tenancy, project, evaluation, report/share, ingestion, and storage smoke checks as affected.
7. Observe error, latency, database, external provider, job, security, and quality signals.
8. Decide PASS, rollback, BLOCKED, or NEEDS_HUMAN.

## Verification Ladder

- Clean install: `pnpm install --frozen-lockfile`
- Mandatory: `pnpm check`, `pnpm test`, `pnpm build`
- Security/dependency/secret checks configured by CI
- Applicable Playwright/browser/artifact and migration safe-target checks
- Environment health/version and critical smoke procedures

## Acceptance Criteria

- [ ] Candidate identity and scope are exact.
- [ ] Required checks pass without suppression or approved exception is explicit.
- [ ] Migration/config/dependency/rollback readiness verified.
- [ ] Target-specific approval recorded.
- [ ] Deployment and critical smoke checks pass.
- [ ] Observation window has no rollback trigger.
- [ ] Release evidence and follow-up ownership are complete.

## Failure Classification

Candidate mismatch, verification failure, unapproved exception, migration/config incompatibility, deployment/platform failure, smoke regression, monitoring anomaly, security/tenant/data/numerical incident.

## Recovery and Rollback

- Pre-deploy failure: do not deploy; return to relevant feature/bugfix/migration loop.
- Platform transient: retry only within approved platform procedure and evidence.
- Smoke/monitoring trigger: follow rollback runbook.
- Security/data incident: incident response and containment.
- Ambiguous exception: `NEEDS_HUMAN`.

## Retry Policy

Maximum 5 pre-deployment decision iterations. A failed production deployment, migration, or rollback trigger is not autonomously retried; transfer to release/incident owner.

## Resource Budget

- Maximum loop iterations: 5.
- Set task-specific time, tool-call, cost, and environment limits before execution.
- Stop at the first exhausted hard limit and transition to `BLOCKED` or `NEEDS_HUMAN`.

## Terminal States

- `PASS`: approved deployment is stable and observed.
- `FAILED`: candidate/deployment is incorrect or unsafe.
- `BLOCKED`: environment/platform/evidence prevents safe decision.
- `NEEDS_HUMAN`: approval/exception/rollback decision required.
- `CANCELLED`: release withdrawn.

## Required Evidence

- Candidate/prior commit, diff, target, owner, approver
- Commands and CI results/exceptions
- Migration/config/dependency evidence
- Deployment ID/timestamps
- Smoke and observation results
- Rollback state and follow-up owners

## Persistent State Updates

Complete the release record, update project state only after certification, record known failures honestly, append worklog handover, and use incident/rollback records for adverse events.
