# Deployment Runbook

## Purpose

Deploy an approved MIYAR release to a named environment with explicit scope, reproducible artifacts, migration safety, verification, observability, and rollback readiness.

## Authority

Production and shared-environment deployment requires explicit authorization. A request to implement code does not automatically authorize deployment.

## Pre-Deployment Checklist

- [ ] Release owner, approver, target, branch, and commit are recorded.
- [ ] Complete diff from the prior release was reviewed.
- [ ] Required type, test, build, security, and artifact checks pass.
- [ ] Approved exceptions are documented with owner and expiry.
- [ ] Environment variables and external-service prerequisites are confirmed without exposing values.
- [ ] Migrations/backfills have their own approved plan and recovery path.
- [ ] Feature flags and compatibility order are defined.
- [ ] Monitoring, smoke checks, and rollback triggers are ready.

## Build and Candidate Verification

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

If the current repository baseline is red, production deployment requires an explicit exception identifying every failure and replacement evidence. Do not hide failures.

Inspect output for client, Node server, and serverless API bundle. Confirm the release artifact corresponds to the approved commit.

## Configuration Review

Verify presence and scope of required configuration:

- Database target
- JWT/session secrets and cookie environment
- Gemini and optional transcription keys
- S3 bucket/region and access policy
- Maps, email, ingestion, error-monitoring, and cron secrets
- Public application origin and callback URLs

Do not print or copy secret values into release notes or logs.

## Migration Ordering

Follow `docs/runbooks/database-migration.md`. Prefer backward-compatible schema before application switch. Treat migration application and deployment as separate approval/evidence steps even when performed in one maintenance window.

## Deploy

Use the configured hosting platform's reviewed workflow. Record:

- Deployment ID and URL/environment
- Commit SHA
- Start/end time
- Operator and approver
- Migration/backfill IDs

Avoid ad hoc local deployment commands when an established platform pipeline exists.

## Smoke Checks

Run with non-production test data and an authorized test account:

1. Health/API availability and version identity.
2. Login/logout and organization context.
3. Project list/detail access.
4. Representative project evaluation.
5. Space programme and material quantity path if affected.
6. Investor/report generation if affected.
7. Public share valid/invalid/expired behavior if affected.
8. Admin/ingestion/scheduler health if affected.
9. Asset upload/download if affected.

Confirm cross-tenant access remains rejected.

## Observation Window

Monitor:

- HTTP/server error rate
- Latency and timeouts
- Authentication failures and suspicious access
- Database errors and connection pressure
- Report/AI/storage failures
- Ingestion runs, connector health, and scheduled jobs
- Data-quality or benchmark anomalies

Compare with pre-release baseline. Record the agreed observation duration.

## Rollback

If a rollback trigger occurs, follow `docs/runbooks/rollback.md`. Do not improvise a destructive schema rollback under pressure.

## Completion Evidence

- Approved commit and environment
- Verification summary and exceptions
- Configuration/migration readiness confirmation
- Deployment ID and timestamps
- Smoke-check results
- Monitoring observation
- Rollback status
- Follow-up owners

The release decision lifecycle is `docs/loops/release.md`.
