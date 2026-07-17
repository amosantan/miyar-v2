# TR-05 Corpus Migration

Migration `0047_sharp_grandmaster.sql` is additive. It classifies all existing
rows as `legacy_unscoped` and does not promote or delete data.

## Forward order

1. Back up the target and record the application SHA.
2. Apply migration 0047 before deploying TR-05 application code.
3. Verify every added column and index from the migration file.
4. Deploy the application.
5. Confirm tenant reads return only `organization` and `platform_public` rows.
6. Run `scripts/classify-tr05-corpus.ts` without `--apply`.
7. Apply classification only after separate production-data approval.
8. Rerun the script without `--apply`; both pending counts must be zero.

## Recovery

The immediate recovery is an application rollback. Leave the additive columns
and indexes in place; the previous application ignores them. Do not drop corpus
metadata while TR-05 code may still be serving traffic.

If the application has been fully rolled back and schema removal is explicitly
approved:

1. Restore classified values to `legacy_unscoped` if the classification itself
   is being reversed.
2. Drop the five corpus indexes created by migration 0047.
3. Drop `orgId` from `trend_snapshots` and `project_insights`.
4. Drop `corpusScope` and `corpusPolicyVersion` from the eight changed tables.
5. Verify the prior application build and targeted authorization tests.

Never promote null-owned evidence during recovery. Classification is
idempotent, but public-evidence promotion is a separate governed operation.
