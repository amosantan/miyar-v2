# Security and Reliability Incident Response

## Purpose

Provide a consistent process for security, tenant, data-integrity, numerical-integrity, availability, and external-integration incidents.

## Incident Examples

- Cross-organization data exposure
- Credential or token exposure
- Unauthorized admin or public-share access
- Data corruption or destructive migration
- Incorrect scores, prices, quantities, financial outputs, or compliance claims at material scale
- Compromised or poisoned ingestion source
- Significant service outage or report-generation failure
- Malicious upload, SSRF, prompt injection, or unsafe model/tool action

## Severity

| Severity | Definition | Response |
|---|---|---|
| SEV-1 | Active broad tenant/security/data loss or critical outage | Immediate containment and owner escalation |
| SEV-2 | Material limited-scope exposure, incorrect decisions, or major degradation | Urgent coordinated response |
| SEV-3 | Contained low-scope issue with workaround | Scheduled remediation with monitoring |
| SEV-4 | Near miss or control weakness | Backlog with owner and due date |

When uncertain, start at the higher severity until evidence narrows impact.

## Roles

- Incident commander: owns decisions and timeline.
- Technical lead: diagnosis, containment, and recovery.
- Data/security lead: impact, evidence, access, and integrity analysis.
- Communications owner: internal/external updates.
- Scribe: immutable timeline, actions, and evidence references.

One person may hold multiple roles for a small team, but ownership must be explicit.

## Response Loop

### 1. Detect and Declare

- Record time, reporter, environment, symptom, and initial severity.
- Open a private incident record/channel.
- Identify possibly affected organizations, data, outputs, and time window.

### 2. Contain

Choose the least destructive effective action:

- Disable affected feature/connector/job.
- Revoke/rotate exposed credentials or tokens.
- Block malicious source/destination.
- Freeze benchmark promotion or report publication.
- Roll back application when compatible.
- Restrict access while preserving forensic evidence.

Do not destroy logs or affected records during containment.

### 3. Preserve Evidence

Capture:

- Commit, deployment, environment, request/job/report IDs
- Relevant safe logs and timestamps
- Migration/backfill/ingestion IDs
- Access/audit records
- Reproduction steps using sanitized data
- Configuration identity without secret values

Control access to incident evidence.

### 4. Assess Impact

- Confidentiality: what data could be seen and by whom?
- Integrity: what data/calculations/reports changed or became unreliable?
- Availability: what workflows failed and for how long?
- Tenancy: which organizations/projects are affected?
- Decision impact: were financial, scoring, compliance, or investor outputs used?
- Regulatory/contractual: does notification or preservation apply?

### 5. Eradicate and Recover

- Fix the causal control failure.
- Rotate/revoke credentials and sessions where relevant.
- Restore data/benchmark/version from trusted state.
- Use `docs/runbooks/rollback.md` for release recovery.
- Add regression and abuse-case evidence.
- Re-enable systems gradually with monitoring.

### 6. Verify

- Original exploit/failure no longer reproduces.
- Cross-tenant and negative-path tests pass.
- Data and numerical integrity reconcile.
- Monitoring detects recurrence.
- Credentials/tokens are invalidated and replaced.
- Critical workflows and outputs are correct.

### 7. Communicate

Updates include severity, verified impact, containment, current risk, next action, owner, and next update time. External communication requires authorized review.

### 8. Learn

Within the agreed review window:

- Produce a blameless timeline and root-cause analysis.
- Separate triggering event, contributing conditions, and missing detection.
- Assign remediation owners and due dates.
- Update tests, monitoring, runbooks, architecture, and security policy.
- Track remediation to verified completion.

## Stop and Escalate Conditions

Immediately escalate when:

- Tenant boundary may be compromised.
- Secrets or production data may be public.
- Destructive data change is ongoing.
- Legal/regulatory notification may apply.
- The team cannot determine blast radius.
- Recovery risks additional data loss.

## Incident Record Minimum

- Incident ID, severity, status, owners
- Start/detection/containment/recovery times
- Affected systems, tenants, data, and outputs
- Evidence references
- Actions and approvals
- Communication log
- Root cause and remediation
- Verification and closure decision
