# Release Operations Checklist

This runbook is the operational companion to `docs/loops/release.md` and `docs/runbooks/deployment.md`.

## Release Record

- Release/version:
- Commit:
- Target environment:
- Release owner:
- Approver:
- Window:
- Prior release/commit:
- Migration/backfill IDs:

## Preflight

- [ ] Diff and included commits reviewed.
- [ ] Release artifact maps to the recorded commit.
- [ ] `pnpm install --frozen-lockfile` completed in a clean release environment.
- [ ] `pnpm check` passed without suppression.
- [ ] `pnpm test` passed or every exception is explicitly approved.
- [ ] `pnpm build` passed.
- [ ] Security, secret, and dependency checks passed.
- [ ] Browser and artifact verification completed where applicable.
- [ ] Configuration and external-service prerequisites are present and scoped.
- [ ] Migration and recovery evidence approved.
- [ ] Rollback artifact, procedure, triggers, and owner confirmed.
- [ ] Monitoring and smoke account/data are ready.

## Risk Review

- User/tenant scope:
- Data/schema impact:
- Scoring/pricing/report impact:
- External dependencies:
- Compatibility:
- Rollback complexity:
- Approved exceptions:

## Deployment

- Deployment ID:
- Start/end time:
- Application result:
- Migration result:
- Backfill result:
- Feature-flag state:
- Operator:

## Smoke Evidence

- [ ] Health/version identity
- [ ] Login/logout
- [ ] Organization context and cross-tenant rejection
- [ ] Project read/write
- [ ] Evaluation/result
- [ ] Space programme/MQI path if affected
- [ ] Report/export/share if affected
- [ ] Admin/ingestion/scheduler if affected
- [ ] Asset storage if affected

## Observation

- Observation window:
- Error rate:
- Latency:
- Database health:
- External providers:
- Scheduled jobs/ingestion:
- Data-quality signals:
- Security signals:

## Decision

- Terminal state: `PASS` / `FAILED` / `BLOCKED` / `NEEDS_HUMAN` / `CANCELLED`
- Rollback required:
- Decision owner:
- Residual issues and owners:
- Next review time:

## Closeout

- [ ] Release evidence stored without secrets.
- [ ] `docs/PROJECT_STATE.md` refreshed if this is the new certified baseline.
- [ ] Known failures updated from direct evidence.
- [ ] Release notes published through the approved channel.
- [ ] Follow-up work has owners and exit criteria.
