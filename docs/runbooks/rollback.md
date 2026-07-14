# Rollback and Recovery Runbook

## Purpose

Restore safe service after a failed release while protecting tenant data, preserving evidence, and avoiding an improvised destructive reversal.

## Trigger Conditions

- Authentication or tenant-isolation regression
- Data corruption, loss, or incompatible migration
- Incorrect scoring, pricing, quantity, compliance, or financial output
- Critical project/report/share workflow unavailable
- Severe error/latency increase
- Secret exposure or compromised integration
- Ingestion promoting corrupted authoritative evidence

## Authority

Production rollback requires the release/incident owner. Emergency containment may occur under the incident policy, but all actions must be recorded.

## First Response

1. Declare rollback/incident owner and communication channel.
2. Stop additional deployments, migrations, backfills, or ingestion that could worsen impact.
3. Preserve logs, deployment IDs, commit IDs, migration IDs, timestamps, and safe samples.
4. Assess tenant, data, and decision-output scope.
5. Choose application rollback, feature disablement, forward fix, data restore, or combined recovery.

## Decision Matrix

| Condition | Preferred response |
|---|---|
| Application regression; schema backward compatible | Roll back application artifact |
| Feature isolated behind flag | Disable feature, then investigate |
| Additive schema migration only | Leave schema; roll back compatible application |
| Destructive/incompatible schema change | Use tested restore/forward-repair plan; do not blindly reverse |
| Bad backfill with preserved source | Stop writer, restore/recompute affected rows with validated script |
| Corrupt benchmark/evidence promotion | Freeze promotion/use, restore snapshot/version, assess affected outputs |
| Secret exposure | Revoke/rotate, contain access, audit use, then redeploy configuration |

## Application Rollback

1. Identify last known good artifact and commit.
2. Confirm it is compatible with the current schema/configuration.
3. Obtain/record authorization.
4. Deploy through the platform's normal controlled path.
5. Run critical smoke checks and monitor.

## Database/Data Recovery

- Prefer point-in-time/branch restore or forward repair when reverse SQL risks losing new data.
- Validate restore in an isolated target when time and severity permit.
- Record affected tables, rows, organizations, and time window.
- Reconcile writes that occurred between release and recovery.
- Run integrity and application checks before reopening traffic/workflows.

## Ingestion/Intelligence Recovery

- Stop affected connectors or scheduled promotion.
- Identify evidence/proposals/benchmarks created during the bad window.
- Restore the last approved benchmark snapshot/version.
- Recalculate or invalidate downstream outputs where required.
- Preserve source/audit evidence for root-cause analysis.

## Verification After Recovery

- Health and error rate normalized
- Authentication and cross-tenant checks pass
- Critical project/evaluation/report paths pass
- Data integrity and counts reconcile
- Incorrect calculations/intelligence are no longer served
- Schedulers and ingestion are intentionally enabled or disabled
- Version and environment identity are correct

## Communication

Communicate verified facts only:

- What is affected
- When it began
- Current containment/recovery state
- User action required, if any
- Next update time

Do not speculate publicly or expose sensitive technical details.

## Closeout

- Record timeline, cause, actions, evidence, and residual risk.
- Create remediation tasks with owners.
- Decide whether customer/partner notification is required.
- Update runbooks, tests, monitoring, or ADRs based on the failure.
- Do not mark closed until data correctness and critical workflows are verified.
