# EV-02 Evidence and Price Migration

## Scope and approval boundary

Migration `0061_ev02_evidence_price_schema.sql` is additive. It creates the
singular SQL entities `product`, `specification`, and `supplier_quote`, extends
legacy evidence and proposal tables with nullable governed-value fields, and
adds resolver indexes. It does not remove or reinterpret an existing price.

Applying the migration or backfill to PlanetScale, production, preview, or any
shared database is a separate `NEEDS_HUMAN` action. This runbook authorizes only
a disposable loopback MySQL rehearsal.

## Disposable rehearsal

1. Set `TEST_DATABASE_URL` to a localhost MySQL database whose name begins with
   `miyar_auth_test`. Do not set `DATABASE_URL`.
2. Run `pnpm test:authorization:mysql`. The guarded runner recreates the
   database, applies the complete checked-in migration chain, runs the
   hash-bound MySQL suite, records evidence, and removes the database.
3. Run `pnpm check:mysql-evidence` and verify it reports fresh evidence.

## Backfill behavior

`scripts/ev02-backfill.ts` accepts only a loopback MySQL URL. It defaults to a
transactional dry run:

```sh
DATABASE_URL='mysql://…@127.0.0.1:3306/miyar_auth_test_ev02' \
  DATABASE_SSL_DISABLED=1 NODE_ENV=development \
  pnpm exec tsx scripts/ev02-backfill.ts
```

Applying requires both an explicit flag and a new rollback-manifest path:

```sh
pnpm exec tsx scripts/ev02-backfill.ts --apply --manifest /secure/path/ev02-manifest.json
```

The manifest is created with owner-only permissions and records inserted IDs
and every prior legacy link. Do not commit it; it may reveal local data shape.
The command refuses non-loopback targets and refuses to overwrite a manifest.

## Guarded rollback

```sh
pnpm exec tsx scripts/ev02-backfill.ts --rollback --manifest /secure/path/ev02-manifest.json
```

Rollback refuses a target mismatch or any link that diverged after apply. It
restores recorded link values, deletes only manifest-owned governed values, and
deletes manifest-owned specifications/products only when no references remain.
Original legacy price columns are never changed by apply or rollback.

## Production handoff

Before a separately approved production action, identify the exact PlanetScale
organization, database, branch, deploy request, migration digest, operator,
maintenance window, backup/restore point, and rollback owner. Re-run the
disposable evidence suite against the exact commit. Stop if any field is
ambiguous; neither this document nor a passing local rehearsal grants authority
to mutate production.
