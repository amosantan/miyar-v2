# ADR-0008: Issued Design Brief versioning architecture

- Status: Accepted
- Date: 2026-07-20
- Deciders: User acting as schema owner and breaking-contract approver
- Technical area: Tenant-scoped brief persistence, workflow, issue identity, compatibility, and migration
- Supersedes: None

## Context

The accepted `BR-01-v1` product contract defines ten governed sections, purpose-specific applicability, achieved maturity, independent stale/blocked conditions, separated functional roles, and immutable issue semantics. The current application cannot persist that contract:

- `design_briefs` stores six mutable JSON columns and a project-local integer version;
- `ai_design_briefs` stores a separate AI narrative and owns the current public share token;
- reports, DOCX, investor HTML, RFQs, boards, evidence, and workspace views consume different live objects;
- project approval and evaluation readiness are not brief-section approval or issue authority; and
- no object freezes exact content, dependency, role, approval, and issue identity together.

Promoting any current object would falsely infer governance and allow live data or unrelated roles to appear authoritative. BR-02 must define an additive architecture that can coexist with these paths until later roadmap steps implement and cut over each consumer.

## Decision

MIYAR adopts the normative [BR-02 technical contract](../specs/ISSUED_DESIGN_BRIEF_ARCHITECTURE.md).

### Aggregate and version identity

One stable brief stream exists for each non-null organization, project, scope, and issue purpose. Scope is exactly one whole project or one scenario owned by that project. Content may be reused by reference, but purpose-specific governance is never reused implicitly.

Immutable section content revisions are scoped above purpose streams by organization, project, project/scenario scope, and section. Every working version binds all ten section containers to exact reusable revisions and freezes purpose-specific applicability, requirement/impact classifications, typology/component scope, achieved state, and stale/blocked conditions. A missing binding alone may have no revision. Editing creates a new revision and successor binding; it never updates content used by an issue.

### Workflow authority and history

Functional authority and workflow facts are immutable grant/revoke, finding/resolution, applicability-stage, approval/withdrawal, condition raise/resolve, transition, issue, supersede, and withdrawal events. Current state is derived or cached only as a non-authoritative projection. Organization access makes a user eligible; only an active functional grant authorizes a brief action. Self-review and self-approval are prohibited, and issuer-authored content requires another independent approver.

Every canonical row carries non-null organization and project identity. Composite scoped relationships or same-transaction predicates prevent a child ID from crossing its tenant, project, stream, version, section, or issue boundary.

### Issue boundary

Issuing is one organization-locked transaction. It revalidates the stream, project/scope, exact version, ten bindings, classifications, conditions, dependencies, approvals, role separation, disclaimer/distribution metadata, and idempotent operation request hash; allocates the next issue number; locks the exact section, approval, applicability, dependency, and lineage references; and appends ordered issue events. Issued references and history are immutable. Supersession and withdrawal append status events without editing or deleting prior content.

BR-02 owns this issue ledger and locked-reference boundary. `BR-07` owns the canonical snapshot DTO, fingerprints/hashes, rendered formats, and issued public sharing.

### Compatibility and adoption

The canonical tables are additive. Feature-gated canonical writers write only to them; legacy writers remain unchanged. Compatibility readers prefer canonical data only when their consumer gate is enabled and a canonical stream exists, otherwise they return the existing legacy contract. There is no dual-write, inferred synchronization, or retrospective approval/issue.

Legacy structured and AI briefs may be imported idempotently as explicitly labelled draft provenance. Reports, exports, RFQs, shares, boards, assets, and evidence retain their current authority until their owning roadmap steps deliberately cut them over.

## Consequences

### Positive

- Tenant, project, purpose, content, workflow, and issue identity become independently auditable.
- Immutable content reuse avoids copying large JSON while purpose-specific bindings preserve governance.
- Staleness can identify affected successor work without rewriting historical issues.
- Additive, feature-gated adoption permits old and new application versions to coexist and roll back safely.

### Negative and trade-offs

- The normalized model has more tables and transaction invariants than the current JSON records.
- Functional assignment and separation of duties add deliberate workflow friction.
- Consumers remain mixed during adoption and require explicit adapter/cutover evidence.
- MySQL does not provide deferred cross-table invariants; issue-time validation requires a locked service transaction.

### Risks and mitigations

- **Cross-tenant child IDs:** repeat organization/project scope on every row and revalidate composite identity at the final transaction boundary.
- **Two active drafts:** serialize stream version allocation and require expected revision plus idempotency keys.
- **False legacy authority:** backfill sets `origin=legacy_import`, never creates approval/issue events, and emits rejections instead of guessing.
- **Stale history mutation:** dependency changes create conditions/successor work; issued bindings remain unchanged.
- **BR-07 overlap:** issue rows lock references only; snapshot serialization, hash, formats, and sharing remain outside BR-02.

## Alternatives Considered

### Extend `design_briefs` in place

Rejected because six JSON columns cannot safely represent reusable content revisions, ten purpose-bound containers, functional history, dependency lineage, and immutable issues without a breaking rewrite.

### Promote `ai_design_briefs`

Rejected because AI cannot approve or issue and current sharing recomputes live context.

### Store one complete JSON document per version

Rejected because it obscures section-level authority, findings, approvals, dependency impact, and safe reuse. BR-07 may later serialize a locked issue into one snapshot DTO.

### Dual-write legacy and canonical records

Rejected because partial failure and semantic mismatch would create two competing authorities. Consumer cutover is feature-gated and one-way.

### One project-wide stream for all purposes

Rejected because BR-01 purpose profiles have different gates and limitations. Shared content is referenced explicitly while purpose governance stays isolated.

## Verification

- The technical contract maps every BR-01 identifier and current producer/consumer.
- Schema relationships prove non-null tenant/project scope and define uniqueness, concurrency, idempotency, and immutability invariants.
- API operations define authorization, validation, error concealment, and transaction boundaries.
- Synthetic walkthroughs cover tenancy, scenario scope, concurrent revision, retry, issue atomicity, separation of duties, N/A, stale dependencies, legacy import, supersession, and withdrawal.
- Documentation, link, identifier, scope, independent architecture, Claude Opus, schema-owner, and breaking-contract reviews pass before acceptance.

## Migration and Rollback

BR-02 changes documentation only. Later implementation follows expand, feature-gated canonical write, idempotent import, consumer-by-consumer read cutover, and eventual legacy retirement. Application rollback disables canonical gates while additive tables remain. Backfill repair is forward-only from preserved legacy sources; it never deletes canonical issues or rewrites legacy data. Shared application and production changes require separate approval.

## References

- [BR-02 technical contract](../specs/ISSUED_DESIGN_BRIEF_ARCHITECTURE.md)
- [BR-01 product contract](../specs/ISSUED_DESIGN_BRIEF_PRODUCT_CONTRACT.md)
- [ADR-0007](ADR-0007-issued-design-brief-product-contract.md)
- [ADR-0002](ADR-0002-deterministic-decision-authority.md)
- [ADR-0004](ADR-0004-render-input-fingerprint.md)
- [Database migration runbook](../runbooks/database-migration.md)
