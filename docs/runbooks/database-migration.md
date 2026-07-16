# Database Migration Runbook

## Purpose

Generate, inspect, test, apply, and recover Drizzle migrations safely. Applying to a shared or production target is human-gated.

## Inputs

- Approved schema requirement
- Exact target environment/provider/branch
- Current `drizzle/schema.ts`
- Current `drizzle/meta/_journal.json`, snapshots, and SQL files
- Data-volume and compatibility assessment
- Backup/restore or rollback plan

## Preflight

```bash
git branch --show-current
git status --short
git diff -- drizzle/schema.ts drizzle/meta drizzle
```

Then:

1. Confirm target identity without exposing credentials.
2. Inspect pending/untracked migration files.
3. Compare the latest migration index/tag to the journal.
4. Determine whether existing data needs a backfill.
5. Determine deployment order and mixed-version compatibility.
6. Identify destructive operations and recovery strategy.

Stop if the target or migration history is ambiguous.

## Authoring

1. Edit `drizzle/schema.ts` using established `mysqlTable` patterns.
2. Preserve organization ownership, indexes, precision, nullability, defaults, and timestamps.
3. Prefer additive, backward-compatible changes.
4. Use an expand/backfill/switch/contract sequence for breaking shape changes.
5. Keep data backfills separate and idempotent when practical.

## Generate

The repository script generates and applies migrations:

```bash
pnpm db:push
```

Because this command can mutate the configured target, run it only when the target is an explicitly selected safe environment. If generation-only behavior is required, use the appropriate Drizzle command after verifying the installed CLI version and configuration.

## Inspect Generated Output

Review:

- Migration number and ordering
- SQL operation type and affected tables
- Unexpected drops, renames, type changes, or default changes
- Index and constraint definitions
- Long-running locks/table rewrites
- Snapshot and journal consistency
- Unrelated schema drift

Do not edit migration metadata casually to force alignment.

## Safe-Target Validation

1. Seed representative pre-migration data.
2. Apply migration.
3. Verify columns, types, indexes, constraints, defaults, and nullability.
4. Run integrity queries and compare counts.
5. Run backfill twice if applicable to prove idempotency.
6. Run affected tests, `pnpm check`, and `pnpm build`.
7. Exercise old/new application read and write paths as deployment order requires.

## Shared/Production Application

Requires explicit approval naming the target and migration. Before applying:

- Confirm backup/restore point.
- Confirm application version compatibility.
- Confirm maintenance/lock expectations.
- Confirm rollback owner and decision threshold.
- Confirm monitoring and smoke queries.

Apply through the established deployment platform, record timestamps, then run integrity and application checks immediately.

## TR-03H Migration 0045

Migration 0045 is additive but security-sensitive:

1. Confirm migration 0044 is complete before continuing.
2. Run `pnpm db:preflight:tr03h` against the approved target.
3. Any duplicate membership pair, duplicate non-null share token, or absent/partial 0044 result is `NEEDS_HUMAN`; never repair production data automatically.
4. Treat the duplicate preflight as advisory because old application instances may still write between the query and DDL. Use a brief write freeze or stop old writers before applying 0045.
5. The unique-index DDL result is authoritative. A duplicate-key DDL failure is `NEEDS_HUMAN`, not a retry or an invitation to delete records.
6. Applying 0045 remains a separate production-database approval from application deployment.

## Recovery Patterns

Choose and document one:

- Application rollback while additive schema remains
- Forward repair migration
- Reverse migration when safe and tested
- Point-in-time restore/database branch restore
- Backfill correction from preserved source data

Never drop new data merely to make an old application version start.

## Required Evidence

- Requirement and schema diff
- Migration SQL and metadata diff
- Target environment label
- Safe-target result
- Data integrity/count results
- Application verification
- Backfill/idempotency result
- Recovery procedure and owner
- Approval for shared application

## Terminal Conditions

- `PASS`: safe application, integrity, compatibility, and required approvals are evidenced.
- `NEEDS_HUMAN`: shared target, destructive SQL, policy decision, or ambiguous data transformation requires authority.
- `BLOCKED`: schema drift, unavailable target, or recovery limitation prevents safe progress.
- `FAILED`: migration or recovery validation proves the design unsafe.

The controlling lifecycle is `docs/loops/schema-migration.md`.
