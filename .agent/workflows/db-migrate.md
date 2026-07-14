---
description: How to apply database schema migrations
---
# Database Migration

> Canonical loop: `docs/loops/schema-migration.md`. Operational procedure: `docs/runbooks/database-migration.md`.

1. Confirm the exact database environment/provider/branch without exposing credentials.
2. Inspect Git status, `drizzle/schema.ts`, migration SQL, snapshots, and journal; preserve unrelated migrations.
3. Define forward compatibility, backfill, deployment order, integrity checks, and rollback/restore strategy.
4. Edit `drizzle/schema.ts` using established `mysqlTable` patterns.
5. Generate/apply only against an explicitly selected safe target; inspect all generated SQL and metadata.
6. Verify shape, constraints, indexes, data integrity, idempotency, application compatibility, tests, type-check, and build.
7. Obtain explicit approval before applying to any shared or production target.
8. Record evidence in the active task/worklog and verified project state rather than duplicating table counts.
