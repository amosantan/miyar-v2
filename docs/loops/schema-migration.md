---
id: loop-schema-migration
version: 1
owner: engineering-and-data
risk: critical
max_iterations: 5
---

# Schema Migration Loop

## Goal and Non-Goals

Produce a reviewed, compatible migration with safe-target evidence, data integrity, deployment ordering, and a credible rollback or restore path.

## Trigger

An approved feature, defect, performance, retention, tenancy, or data-governance requirement needs schema evolution.

## Required Context and Inputs

- Approved data contract and compatibility requirement
- `drizzle/schema.ts`, migration SQL, snapshots, and journal
- Exact target provider/environment/branch and observed live shape when authorized
- Data volume, backfill needs, deployment plan, restore capability
- `docs/runbooks/database-migration.md`

## Scope

Schema definition, migration artifacts, required backfill, compatibility, integrity verification, and target-specific application evidence.

## Non-Goals

- Unapproved shared/production application
- Unrelated schema cleanup
- Blind metadata editing to force alignment
- Destructive data correction hidden inside migration approval

## Permissions and Safety Constraints

- Organization ownership and access boundaries remain intact.
- Historical evaluations retain logic/data identity.
- Existing data is preserved or transformed by an approved, validated rule.
- Currency, precision, timezone, nullability, defaults, and indexes are explicit.
- Rollback never discards new valid data merely to restore old code.

## Preconditions

- [ ] Target identity is confirmed without exposing credentials.
- [ ] Worktree, schema, journal, snapshots, and pending migrations inspected.
- [ ] User-owned migration files preserved.
- [ ] Backfill and mixed-version compatibility assessed.
- [ ] Restore/rollback strategy and owner identified.

## Human Approval Gates

Explicit approval is required for shared/staging/production application, destructive SQL, ambiguous data transformation, long-lock operations, data deletion, provider branch changes, and recovery execution.

## Execution Steps

1. Specify old/new data contract and deployment order.
2. Inspect code and safe live state for drift.
3. Prefer expand -> compatible deploy -> idempotent backfill -> switch -> later contract.
4. Edit `drizzle/schema.ts` using established MySQL-compatible patterns.
5. Generate migration against an explicitly selected safe target.
6. Inspect SQL/metadata for unintended changes.
7. Apply to isolated representative data; verify integrity and compatibility.
8. After approval, apply to named shared target and observe.

## Verification Ladder

- `git diff -- drizzle/schema.ts drizzle/`
- `pnpm db:push` only against the confirmed safe/approved target
- Integrity queries for shape, constraints, indexes, counts, and transformed values
- Backfill twice where idempotency is required
- Targeted tests, `pnpm check`, `pnpm test`, and `pnpm build` as applicable
- Old/new application read/write smoke checks

## Acceptance Criteria

- [ ] Data contract and rollout order documented.
- [ ] Generated SQL and metadata match intent.
- [ ] Safe-target application succeeds.
- [ ] Integrity, idempotency, and compatibility checks pass.
- [ ] Recovery strategy is credible and proportional.
- [ ] Shared application has explicit target-specific approval.
- [ ] Post-apply health and data checks pass.

## Failure Classification

Schema/history drift, SQL generation defect, provider limitation, data incompatibility, non-idempotent backfill, application compatibility regression, target ambiguity, or recovery gap.

## Recovery and Rollback

- Additive schema regression: roll back compatible application while schema remains.
- Invalid migration design: repair before shared application.
- Bad data/backfill: stop writer, restore/recompute from preserved source under separate approval.
- Destructive/incompatible change: use tested restore or forward repair, never improvise blind reverse SQL.
- History drift: stop and reconcile evidence before editing the journal.

## Retry Policy

Maximum 5 design/validation iterations and 3 attempts per unchanged failure class. Shared/production application is never auto-retried after failure; transition to incident/recovery ownership.

## Resource Budget

- Maximum loop iterations: 5.
- Set task-specific time, tool-call, cost, and environment limits before execution.
- Stop at the first exhausted hard limit and transition to `BLOCKED` or `NEEDS_HUMAN`.

## Terminal States

- `PASS`: safe and approved application with integrity/recovery evidence.
- `FAILED`: design/application is unsafe or corrupts compatibility/data.
- `BLOCKED`: drift, target, provider, or recovery prevents safe progress.
- `NEEDS_HUMAN`: application, destructive behavior, or data rule needs approval.
- `CANCELLED`: migration withdrawn/superseded.

## Required Evidence

- Schema/migration diff and migration identifier
- Target label and approval
- Safe-apply result and integrity queries
- Backfill/idempotency evidence
- Application tests/build/smoke checks
- Recovery plan, owner, and post-apply observation

## Persistent State Updates

Update active task/worklog, project state only after observation, architecture/ADR for durable strategy changes, and known failures for unresolved reproduced drift. Never duplicate migration counts into permanent instructions.
