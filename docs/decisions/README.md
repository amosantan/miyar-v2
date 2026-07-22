# Architecture Decision Records

Architecture Decision Records capture durable, high-impact decisions and their context. They explain why the system has a boundary; they do not replace current architecture or implementation evidence.

## When an ADR Is Required

Create or supersede an ADR for material changes to:

- Deterministic-versus-AI authority
- Authentication, authorization, tenancy, or public sharing
- Primary database, schema, migration, or data-governance strategy
- Benchmark promotion and learning authority
- Deployment topology or operational ownership
- Public API compatibility
- Report reproducibility and decision authority
- Canonical agent/documentation/state architecture
- Security boundaries with cross-system impact

Routine implementation details and reversible local refactors do not need ADRs.

## Status Values

- `Proposed`: under review; not authoritative.
- `Accepted`: current decision.
- `Deprecated`: retained for context but should not guide new work.
- `Superseded by ADR-NNNN`: replaced by a newer record.
- `Rejected`: considered but not adopted.

## Naming

```text
ADR-0001-short-kebab-case-title.md
```

Numbers are sequential and never reused.

## ADR Template

```md
# ADR-NNNN: Title

- Status: Proposed
- Date: YYYY-MM-DD
- Deciders: names/roles
- Technical area: domain
- Supersedes: none

## Context

What problem, evidence, constraints, and forces require a decision?

## Decision

What is decided? Use testable language.

## Consequences

### Positive

-

### Negative and trade-offs

-

### Risks and mitigations

-

## Alternatives Considered

### Alternative

Why it was not selected.

## Verification

How can an engineer prove the decision is implemented and still valid?

## Migration and Rollback

How is the decision adopted, and how can it be superseded or reversed?

## References

- Relevant code, issues, documents, or evidence.
```

## Maintenance

- ADRs are immutable after acceptance except for spelling, links, and status metadata.
- New reasoning or a changed decision requires a new ADR that supersedes the old one.
- `docs/ARCHITECTURE.md` reflects current accepted decisions; ADRs retain decision history.
- Implementation evidence must still be verified from code and tests.

## Index

| ADR                                                                  | Status   | Decision                                                                         |
| -------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| [ADR-0001](ADR-0001-canonical-agent-documentation.md)                | Accepted | One canonical cross-agent contract with separated live state and history         |
| [ADR-0002](ADR-0002-deterministic-decision-authority.md)             | Accepted | Deterministic code owns authoritative numerical decisions; AI assists            |
| [ADR-0003](ADR-0003-baseline-space-confidence-annex-contracts.md)    | Accepted | Versioned empty-space, ingestion-confidence, and Material Board Annex contracts  |
| [ADR-0004](ADR-0004-render-input-fingerprint.md)                     | Accepted | Issued render inputs use a canonical fingerprint                                 |
| [ADR-0005](ADR-0005-di01-staged-prioritization.md)                   | Accepted | DI-01 starts as a gated planning increment                                       |
| [ADR-0006](ADR-0006-canonical-room-geometry-measurement-contract.md) | Accepted | Canonical room identity, geometry, measurement, and compatibility contract       |
| [ADR-0007](ADR-0007-issued-design-brief-product-contract.md)         | Accepted | Ten-section issued brief lifecycle, purpose, role, and immutability contract     |
| [ADR-0008](ADR-0008-issued-design-brief-versioning-architecture.md)  | Accepted | Tenant-safe brief revisions, workflow events, issue ledger, and migration design |
| [ADR-0009](ADR-0009-material-cost-authority-and-provenance.md)       | Accepted | material_library stays cost authority with labelled-assumption provenance and deterministic tier policy |
| [ADR-0010](ADR-0010-ingestion-robots-and-fetch-posture.md)           | Accepted | Strict RFC 9309 robots gate before every market-ingestion provider              |
