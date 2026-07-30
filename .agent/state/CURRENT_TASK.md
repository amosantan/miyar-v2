# Current Task

- ID: EV-04
- Roadmap step: `EV-04`
- Title: Source coverage, freshness, and insufficiency SLA
- Status: PASS
- Owner: Codex
- Started: 2026-07-30
- Base: canonical `origin/main` at `f0405344a218529a28f15a8198ac4aac244ee99c`
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-ev04-plan`
- Branch: `codex/ev04-plan`
- Classification: Critical — tenant-scoped evidence, deterministic claim
  authority, additive schema, stored reports, future issued consumers, and
  public shares
- Dependencies: `EV-02`, `EV-03`, and `EV-02R` (`CLOSED`)

## Goal

Create one versioned, deterministic, tenant-safe contract that decides whether
MIYAR may describe evidence as current, qualified, stale, incident-affected, or
insufficient. Coverage, freshness, operational cadence, quality, confidence,
authority, and incidents remain separate facts. Issued artifacts retain a
frozen safe snapshot rather than recomputing mutable health.

## Acceptance Criteria

- [x] Amro Saleh approves a versioned source strategy and SLA defining finite
      coverage denominators, eligible authority classes, source-run cadence,
      observation-age and quote-validity rules, permitted fallbacks, incident
      behavior, retention, and public/report projections.
- [x] A pure deterministic TypeScript engine with an injected clock and policy
      version returns orthogonal dimensional-match, authority, freshness,
      cadence, quality, confidence, and incident states plus a fail-closed
      customer claim state.
- [x] Empty or unknown required sets, unauthorized corpora, pending/rejected
      source terms, inactive or unwhitelisted sources, raw/unapproved evidence,
      invalid dates, foreign-organization evidence, confidential public data,
      and consumer-ineligible fallback/synthetic evidence cannot produce a
      `current` claim.
- [x] Organization evaluation uses only same-organization evidence plus
      governed `platform_public` evidence. Operational source names, raw
      connector errors, run identifiers, confidential quote metadata, and
      unsafe URLs remain admin-only and are absent from public/report DTOs.
- [x] Additive policy, health-snapshot, source-incident, and incident-event
      persistence has explicit versioning, input/content digests, append-only
      history, actor/reason evidence, idempotency, concurrency protection,
      retention, audit behavior, and a verified recovery path.
- [x] Existing benchmark freshness weights, proposal numerics, resolver
      ranking, governed prices, scoring, and ingestion scheduler triggers do
      not change under EV-04.
- [x] Customer and admin APIs replace divergent health calculations without
      treating failed/partial attempts as successful fetches or all-empty data
      as healthy.
- [x] Dashboard, brief, investor, data-health, report, PDF/DOCX, stored-report,
      and public-share surfaces agree for the same inputs and clock, expose
      explicit insufficiency/fallback states, and never make an unapproved
      `current`, `live`, or completeness claim.
- [x] In-scope stored project reports transactionally bind the policy version,
      required-cell schema version, evaluation clock, safe results/provenance,
      and canonical content digest without gaining issue/approval authority.
      Legacy artifacts remain readable and show health as unavailable/legacy
      rather than recomputing it.
- [x] Focused deterministic, authorization, redaction, incident, report, and
      compatibility tests pass; disposable-MySQL forward/recovery and
      concurrency tests pass; TypeScript, DB-free suite, guarded MySQL,
      authorization/database-safety audits, build/bundle, relevant workflow
      certification, browser/artifact QA, diff review, and independent Sol
      review pass.

## Non-Goals

- Do not change scoring, governed price values, price weights, benchmark
  proposal formulas, resolver ranking, or material-cost rollout behavior.
- Do not change current stale-source scheduler triggers without a separately
  approved operational-policy decision and regression comparison.
- Do not promote a benchmark, approve source terms, enable an ingestion source,
  or infer missing evidence.
- Do not implement EV-05 DLD comparable methodology or EV-06 RFQ workflows.
- Do not apply a shared/production migration, write production data, deploy,
  publish, merge, or send external communication without its separate gate.

## Human Gates

1. **Source strategy and SLA:** approve
   `docs/artifacts/EV-04_SOURCE_COVERAGE_FRESHNESS_SLA.md` and proposed
   `ADR-0013` before policy-dependent implementation. **Approved with
   technical defaults by Amro Saleh on 2026-07-30.**
2. **Numerical/operational policy:** any change to benchmark weights, proposal
   logic, resolver ranking, or scheduler triggers is excluded and requires a
   separate owner decision.
3. **Shared data and release:** migration application, production writes,
   deployment, smoke, Git publication, PR, and merge remain separately gated.

## Execution Controls

- Retry budget: three evidence-based attempts per failure class.
- Tests, providers, migrations, builds, browser workflows, and review commands
  require explicit bounded timeouts.
- Use an injected clock for every policy result and test fixture.
- Stop immediately for tenant leakage, confidential-source exposure, invented
  thresholds, numerical drift, migration/recovery ambiguity, or a mutable
  health result entering a bound stored or issued artifact.

## Current Evidence

- Canonical manifest digest:
  `sha256:6da6e3982c97b8ce645945fc3af3cdc2b22d02ccf4ae6140fc0eaac63adb1c9b`.
- Database-free suite: 1,945 passed and 22 skipped.
- Guarded disposable MySQL: 84/84 across 12 files; all 112 pinned evidence
  files are current. Forward migration, canonical seed, drift rejection,
  recovery refusal/reapply, report snapshots, and public shares pass.
- TypeScript, production build, bundle budgets, material-price authority,
  authorization inventory 395/0, database safety 144/2/0, report
  certification 23/23, TR-13 workflow/browser certification, and diff hygiene
  pass.
- Definitive independent MIYAR review and Claude Opus delta review both return
  `PASS` with no blocker.
- No shared/production migration, database write, deployment, Git publication,
  pull request, merge, or external communication was performed.

## Next Action

Begin `EV-05` in a fresh worktree as the single next executable roadmap step.
Before any EV-04 release, separately authorize an exact PlanetScale branch
apply, the `seed` database operation, migration/deployment, Git publication,
and production smoke. Incident-event retention remains a separate SC-06/PDPL
gate, and production incident-history writes remain fail-closed.

## Handover Evidence

- The manifest owns the closed catalogue, total projection, source and quote
  eligibility, incident catalogue/composition/transitions, authority identity,
  artifact binding, and retention rules. Runtime behavior derives from it.
- Report persistence locks and revalidates the complete allocation set,
  proposal approval/supersession, quote supersession, source governance, and
  incident revisions before storing one immutable snapshot.
- Migration 0063 is additive and trigger-free. Canonical policy seeding is a
  separate idempotent `seed` operation with exact byte/digest verification.
- Stored reports distrust embedded health content. Public report shares store
  only token hashes, are admin-managed, expiring, revocable, read-only,
  privacy-header protected, and expose only frozen safe projections.
- Legacy reports remain readable and render explicit unavailable/legacy
  health. DLD indexed cells remain fail-closed pending EV-05 methodology.
- Incident-event retention remains separately gated by SC-06/PDPL; the runtime
  permits incident-history persistence only on named disposable localhost test
  targets.
