# TR-09 Confidence Provenance Migration

Migration `0049_tr09_confidence_provenance.sql` is additive. It does not
recalculate existing confidence scores or fabricate historical assessments.
Existing evidence therefore remains `legacy_unknown` through null provenance
columns.

## Forward order

1. Record the approved application SHA, migration owner, and restorable backup.
2. Apply migration 0049 before deploying the TR-09 application build.
3. Verify the assessment table, source/actor/corpus attribution, both composite
   indexes, three nullable evidence columns, the unique public-observation key,
   and the zero-defaulted ingestion rejection count.
4. Verify the evidence and ingestion-run row counts are unchanged.
5. Deploy the application and run the authorized ingestion/report smoke checks.
6. Confirm accepted observations create an assessment and current pointer in
   one transaction; rejected observations create no evidence row.

Applying this migration to a shared or production database requires explicit
human approval.

## Execution guardrail

Do not use `scripts/apply-migrations.ts` for migration 0049: its current
statement splitter can stop after the first Drizzle breakpoint-delimited
statement. Do not use `pnpm db:push` as a substitute, because it combines
generation and migration against the configured target. Apply the reviewed SQL
through the controlled PlanetScale/provider migration workflow, then run the
forward verification above before deploying the application build.

## Recovery

The default recovery is application rollback while leaving the additive schema
in place. The pre-TR-09 application ignores the new table and columns, while
retained assessments remain useful audit evidence.

Only after the application is fully rolled back, evidence is backed up, and
destructive schema removal is separately approved:

1. Export `evidence_confidence_assessments` and current pointer/policy values.
2. Drop the two assessment indexes and the assessment table.
3. Drop `currentConfidenceAssessmentId`, `confidencePolicyVersion`, and
   `publicObservationKey` (including its unique constraint) from
   `evidence_records`.
4. Drop `recordsRejected` from `ingestion_runs`.
5. Verify evidence and ingestion-run row counts and the prior application.

Never infer or backfill historical clocks during recovery.
