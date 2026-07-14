# Data Ingestion Recovery Runbook

## Purpose

Contain and recover from connector failure, duplicate ingestion, malformed normalization, poisoned source content, incorrect evidence, or bad benchmark promotion without losing provenance or compounding decision impact.

## Triggers

- Repeated connector/provider failure or zero-record “success”
- Unexpected volume collapse/spike or duplicate explosion
- Unit, currency, geography, date, category, or range corruption
- Prompt injection, malicious content, SSRF, or unauthorized source access
- Incorrect evidence promoted to an authoritative benchmark
- Stale/failed source reported healthy
- Downstream scores, costs, reports, or forecasts affected

## Authority

Containment may disable a failing connector/job under incident policy. Deleting records, rolling back benchmarks, correcting production data, or large production re-ingestion requires data/operations and applicable product/model approval.

## Immediate Containment

1. Identify source, connector, run IDs, provider, time window, environment, and affected dimensions.
2. Stop/disable the connector, scheduler, or promotion path.
3. Prevent suspect evidence/version use when supported.
4. Preserve raw capture, normalized record, audit, logs, proposals, snapshots, and safe samples.
5. Do not delete before blast-radius analysis.
6. Escalate security, tenant, or material decision impact to incident response.

## Failure Classes

| Class | Examples |
|---|---|
| Acquisition | Timeout, outage, blocked/redirected URL, response-size issue |
| Extraction | HTML/PDF drift, schema parse failure, missing content |
| Normalization | Wrong unit/currency/date/category/geography |
| Quality | Outlier, inversion, stale/future date, missing provenance |
| Idempotency | Duplicate rows/proposals, unstable identity |
| Governance | Unapproved promotion, wrong confidence policy |
| Security | SSRF, malicious source, prompt injection, credential exposure |
| Operational | False-green health, scheduler overlap, hidden partial run |

## Blast Radius

Determine runs/records, sources/providers, evidence/proposals/snapshots/benchmarks, consuming projects/evaluations/reports, affected organizations/users, time window, and cached/generated outputs. Record queries/counts without restricted data in Markdown.

## Recovery Strategies

### Connector/provider failure

Keep last verified evidence with stale/degraded state, use only approved visible fallback, repair against fixtures, and rerun from a safe checkpoint.

### Bad extraction/normalization

Freeze suspect records, correct deterministic mapping or validated schema, reprocess preserved raw captures into a new run/version, and compare old/new quality before replacement.

### Duplicate ingestion

Stop writes, identify stable deduplication key, build dry-run cleanup grouped by scope, preserve referenced canonical records, obtain approval/restore readiness, then run twice to prove idempotency.

### Bad benchmark promotion

Freeze affected version, restore/re-publish last approved snapshot, identify outputs created with the bad version, decide invalidate/label/regenerate, and require governance approval for corrected promotion.

### Security or poisoned source

Use `docs/runbooks/incident-response.md`, block source/network path, rotate exposed credentials, audit actions, and treat derivatives as suspect until revalidated.

## Verification After Recovery

- Original connector/fallback failure has regression coverage.
- Acquisition/redirect controls are safe.
- Schema, provenance, units, ranges, and quality pass.
- Repeated runs are idempotent.
- Run counts are plausible and health/freshness truthful.
- Authoritative version is approved/traceable.
- Affected outputs are corrected or visibly invalidated.
- Monitoring detects recurrence.

## Re-Enable

Obtain approval, enable limited scope, inspect quality before promotion, restore schedule gradually, and observe at least one expected run window.

## Required Recovery Record

Incident/recovery ID, owners, source/connector/run/provider/window, root cause, affected records/versions/outputs, containment, recovery commands/approvals, before/after quality/counts, idempotency evidence, re-enabled state, observation, and follow-up controls.

## Terminal States

- `PASS`: trustworthy path restored and affected authority/outputs reconciled.
- `FAILED`: unresolved integrity/security risk remains.
- `BLOCKED`: source, backup, evidence, or environment prevents recovery.
- `NEEDS_HUMAN`: deletion, promotion, rollback, communication, or policy decision required.
- `CANCELLED`: source retired with downstream state safely handled.
