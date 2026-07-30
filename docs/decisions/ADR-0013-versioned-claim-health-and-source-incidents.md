# ADR-0013: Versioned claim health and source incidents

- Status: Accepted
- Date: 2026-07-30
- Deciders: Amro Saleh (data, product, and source-policy owner)
- Technical area: Evidence coverage, freshness, source operations, reports,
  public sharing, and tenant-safe provenance
- Extends: ADR-0002 and ADR-0011

## Context

MIYAR records observation dates, source reliability, connector runs, connector
health, confidence, and data-quality information, but it has no single governed
contract for a customer-facing claim that evidence is current.

The current implementation contains incompatible hard-coded thresholds:
customer freshness uses 7/30-day source-fetch boundaries, Data Health treats
fewer than ten category rows or average age above 30 days as a gap, while the
ingestion evidence path uses 90/365-day boundaries that also affect benchmark
proposal weights and stale-source scheduling. Those rules have different
purposes and cannot safely be merged by choosing one number.

The current Data Health aggregate reads all evidence rather than the
established same-organization plus `platform_public` corpus. Connector telemetry
also cannot represent an acknowledged/resolved incident, and stored project
reports and public shares do not bind a frozen health result.

The full proposed policy and owner rulings are in
`docs/artifacts/EV-04_SOURCE_COVERAGE_FRESHNESS_SLA.md`.

## Decision

The EV-04 technical rulings were approved with defaults on 2026-07-30.
Incident-event retention remains separately gated by SC-06/PDPL.

1. Customer claim health is a deterministic, versioned TypeScript policy with
   an explicit evaluation clock. An LLM cannot choose coverage, thresholds,
   incidents, or presentation state.

2. Required coverage is a finite, versioned catalogue of cells keyed by the
   applicable consumer, domain, category, geography, finish tier, unit basis,
   price scope, and required authority class. It is never an implicit cartesian
   product and never complete by vacuous truth.

3. The closed v1 catalogue contains project-derived EV-03 material-allocation
   cells reused by working project/design/investor views, the same cells frozen
   for current project report instances, report-backed public-share
   inheritance, three static DLD indexed-subset cells that remain Unknown until
   EV-05 supplies dataset SLAs, and an initially empty required-source
   operations list. New consumers or required sources require a new
   required-cell schema version.

4. Dimensional match, evidence authority, observation freshness, successful-run
   cadence, quality, existing confidence, and incident state remain orthogonal.
   The customer state is a deterministic projection, not a composite score.

5. Plain Current requires a non-empty, fully exact and eligible required set,
   current observation state, on-time successful-source cadence, passing
   quality, no blocking incident, and known policy/provenance. Approved
   fallbacks remain explicitly labelled and cannot become plain Current.

6. The complete projection table in the EV-04 specification defines one output
   for every aggregate condition. In priority order it resolves legacy,
   blocking incident, insufficiency, stale/breached/expired, aging/due, unknown
   SLA or state, qualified warning/advisory/assumption/synthetic, approved
   fallback, then exact Current. Missing required dates/quote validity and a
   missing successful required run are insufficient rather than ambiguous.

7. Evidence eligibility fails closed. Organization evaluation may use only
   same-organization evidence and governed `platform_public` evidence.
   `legacy_unscoped`, foreign-organization, raw/unapproved, terms-pending or
   rejected, inactive/unwhitelisted, confidential-for-consumer, invalid-date,
   and consumer-ineligible evidence cannot make a Current claim.

8. EV-04 does not change existing benchmark freshness weights, proposal
   numerics, resolver ranking, governed prices, scoring, or stale-source
   scheduler triggers. Those remain separately governed numerical/operational
   policies.

9. Claim-health policy versions and evaluated snapshots are durable.
   Snapshots are append-only and bind the policy version, required-cell schema
   version, evaluation clock, canonical inputs/results, safe projection, and
   input/content digests.

10. Source incidents use a dedicated append-only incident/event lifecycle.
    Per-run `connector_health` remains telemetry. Platform incidents use null
    organization identity and `adminProcedure`; organization, project, and
    supplier-quote incidents require exact organization ownership,
    `orgAdminProcedure`, and resource authorization. Scope-inconsistent or
    foreign references fail closed. Transitions record actor, reason, effective
    time, idempotency, audit, and relevant policy/run/evidence references. The
    closed transition matrix permits absent→open, open→acknowledged,
    open/acknowledged→resolved, and resolved→reopened only. Versioned
    server-owned detectors may open/reopen platform incidents but cannot mutate
    tenant incidents or acknowledge/resolve any incident.

11. EV-04 binds one frozen claim-health snapshot when a current
    `project.generateReport` report instance is persisted and makes only a
    report-backed share inherit that safe projection. This is a stored-report
    binding and grants no issue, approval, or canonical-brief authority. EV-04
    does not take canonical brief issuance from BR-07 or broader
    report-evidence binding from EV-08, and it does not retrofit unrelated
    legacy design shares. Views never reinterpret an unknown old policy version
    or recompute mutable current health. The existing render-input fingerprint
    remains a rendering/debug contract rather than an issuance snapshot.

12. Customer/public projections exclude tenant identifiers, connector/run
    details, raw errors, confidential quote metadata, private URLs, and
    operational internals. Admin operational projections remain behind the
    established admin boundary.

13. Health snapshots follow their bound artifact's approved
    retention/deletion lifecycle. Retention of actor-, tenant-, evidence-, or
    quote-linked incident events is a separate SC-06/PDPL decision; it is not
    authorized by technical SLA approval and cannot be persisted outside
    disposable tests until that decision is recorded.

## Consequences

### Positive

- Current, fallback, stale, incident, and insufficient labels become
  reproducible and explainable.
- Missing or unauthorized evidence cannot be hidden behind an overall health
  score.
- Tenant and confidential source boundaries apply to the corpus used to derive
  health, not only to the target project.
- Issued artifacts remain historically truthful after later source or policy
  changes.
- Operational incidents gain an auditable lifecycle distinct from telemetry.

### Negative and trade-offs

- A finite required-cell catalogue needs explicit owner maintenance as product
  consumers and supported markets expand.
- Additive policy, snapshot, incident, and event persistence increases schema
  and operational complexity.
- More customer surfaces will show qualified or insufficient states until
  source strategy and evidence coverage improve.
- Legacy artifacts cannot be retroactively labelled Current and must show
  health unavailable/legacy.

### Risks and mitigations

- **Risk: claim health silently changes pricing.** Mitigation: regression tests
  pin existing freshness weights, proposal outputs, resolver ranking, governed
  values, and scheduler behavior.
- **Risk: health calculation leaks another tenant's evidence.** Mitigation:
  closed corpus helpers, cross-organization negative tests, and redacted DTOs.
- **Risk: a failed connector attempt refreshes the SLA clock.** Mitigation:
  cadence uses only the last successful required-source run.
- **Risk: old reports are reinterpreted under a new policy.** Mitigation:
  persist policy and required-cell schema versions plus canonical digests;
  unknown versions render legacy.
- **Risk: incident history is rewritten.** Mitigation: append-only events,
  guarded transitions, idempotency, concurrency tests, and audit evidence.

## Alternatives considered

### Keep the existing three freshness calculations

Rejected because they disagree, serve different purposes, and allow customer
labels without a versioned source strategy.

### Reuse confidence as health

Rejected because confidence does not prove coverage, current observation,
successful operational cadence, quality, authorization, or absence of a
blocking incident.

### Create one weighted health score

Rejected because a high score can hide a missing required cell, unauthorized
source, tenant leak, stale mandatory evidence, or blocking incident.

### Reuse `connector_health` as the incident table

Rejected because per-run telemetry has no stable incident identity, lifecycle,
actor/reason transitions, idempotency, or report-binding semantics.

### Recompute health whenever a report or share is viewed

Rejected because a stored or issued artifact would change meaning after
creation/issuance and could expose current operational or confidential state.

## Verification

- Deterministic boundary, empty, fallback, authority, freshness, cadence,
  quality, incident, and policy-version fixtures.
- Explicit non-regression proof for benchmark weights/proposals, resolver,
  governed prices, scoring, and scheduler behavior.
- Organization/public-corpus, terms, source status, confidentiality,
  cross-organization, and redaction negative tests.
- Additive migration, append-only/idempotency/concurrency, integrity, and
  recovery tests on disposable MySQL.
- Engine/API/UI/stored report/PDF/DOCX/public-share agreement for identical
  inputs and clock.
- Frozen bound reports and any future issued consumers remain unchanged after
  later source or policy state changes.
- Full applicable repository and independent-review gates from
  `docs/VERIFICATION.md`.

## Migration and rollback

Adoption is additive-first after the owner approves the EV-04 policy rulings.
Legacy health APIs remain compatibility adapters that delegate to the approved
engine until their callers migrate. Existing reports remain readable.

Shared/production migration requires exact-target approval, backup, dry run,
recovery evidence, and post-write integrity checks. Rollback must refuse when a
later report, share, policy, snapshot, or incident event depends on a row it
would remove. A changed policy requires a new immutable version; a changed
architecture decision requires a superseding ADR.

## References

- `docs/artifacts/EV-04_SOURCE_COVERAGE_FRESHNESS_SLA.md`
- ADR-0002 — Deterministic decision authority
- ADR-0011 — Evidence and price-observation model
- `.agent/state/ROADMAP.md` — EV-04 and EV-08
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/VERIFICATION.md`
