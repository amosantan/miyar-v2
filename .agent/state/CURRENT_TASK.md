# Current Task

- ID: BR-02
- Roadmap step: `BR-02`
- Title: Design brief versioning and readiness architecture
- Status: PASS
- Owner: Codex
- Started: 2026-07-20
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-br02-architecture`
- Branch: `codex/br-02-brief-versioning`
- Base: exact fetched `origin/main` commit `27c0fb43266bdc697b9f0df6efa5d1469b200a31`
- Classification: Architecture/schema design and compatibility planning
- Risk: Critical future tenant/schema/report contract; documentation-only work is authorized and no runtime, migration, database, or production mutation is in scope
- Selected loops: Roadmap execution, architecture decision, and schema-migration design loops
- Retry budget: Three evidence-based attempts per unchanged contract, consistency, or review failure
- Resource budget: One isolated worktree, documentation/state-only diff, deterministic contract checks, one independent adversarial review, and one bounded Claude Opus review
- Human gates: Schema-owner and breaking-contract approval are required before BR-02 can close; migration generation/application, runtime implementation, Git publication, shared operations, and deployment remain separately unauthorized

## Goal

Define the tenant-safe persistence, version, section-binding, workflow-event, issue-identity, lineage, API, compatibility, migration, backfill, and recovery architecture that implements the approved `BR-01-v1` product semantics without changing application or database behavior.

## Plain-English Problem

MIYAR stores several unrelated artifacts under the name “design brief.” None can prove one immutable chain from exact section content and dependencies through independent review, approval, and issue. Current exports and shares may also recompute from live data, so they cannot yet serve as reproducible issued records.

## Acceptance Criteria

- [x] An ADR chooses one stable brief-stream identity and separates immutable content revisions, working versions, section bindings, assignments/events, and issue identity.
- [x] The schema proposal gives every canonical record non-null organization/project scope and specifies provider-compatible constraints, indexes, concurrency, idempotency, and immutable-issued behavior.
- [x] All ten BR-01 sections retain applicability, frozen rule classifications, typology/component scope, achieved state, and independent stale/blocked overlays.
- [x] Functional roles, findings, applicability decisions, approvals/withdrawals, transitions, issue/supersede/withdraw events, and separation of duties have enforceable contracts.
- [x] Typed API contracts cover creation, revision, assignment, review, approval, issue, withdrawal, history, and dependency status without changing current public APIs.
- [x] Every current producer/consumer has an explicit legacy disposition and feature-gated cutover sequence with no dual-write or inferred canonical status.
- [x] The additive migration/backfill/restore plan is deterministic, idempotent, tenant-safe, mixed-version compatible, and never retrospectively approves or issues legacy data.
- [x] Representative positive, negative, concurrency, tenancy, immutability, stale, N/A, legacy, and failure walkthroughs are documented.
- [x] Documentation/link/identifier/schema-reference/scope checks pass; the diff contains no runtime, schema, migration, dependency, or production behavior change.
- [x] Independent adversarial review and Claude Opus review have no unresolved blocker.
- [x] The schema owner and breaking-contract approver approve the finished package.

## Non-Goals

- Editing `drizzle/schema.ts`, generating migration SQL, applying/backfilling any database, or enabling canonical writes.
- Implementing readiness (`BR-03`), workspace behavior (`BR-04`), typology rules (`BR-05`/`BR-06`), snapshot/render/share mechanics (`BR-07`), or AI evaluation (`BR-08`).
- Retrospectively treating any structured brief, AI brief, report, export, RFQ, or share as approved or issued.
- Changing scoring, pricing, quantity, financial, compliance, authorization, public-share, or report behavior.

## Verification

- Deterministic vocabulary, table/relationship, operation, consumer, migration-phase, and scenario coverage checks across the ADR and design package.
- Internal Markdown link and referenced live-path validation.
- Complete consumer trace against schema, database helpers, routers, engines, report/export/share paths, assets/evidence, and workspace reads.
- `git diff --check`, documentation/state-only path inspection, and complete diff review.
- Independent high-reasoning architecture/security review and bounded read-only Claude Opus review.
- Explicit schema-owner and breaking-contract approval.

## Next Action

BR-02 is closed at `PASS`. `BR-03` is the sole `READY` successor. Publish this documentation/state-only closeout through the authorized commit, push, PR, and merge workflow; no application deployment is required.

## Decision Package Evidence

- Base/worktree: exact fetched `origin/main` `27c0fb4`; isolated `/Users/amrosaleh/Maiyar/miyar-v2-br02-architecture`; dirty root and other worktrees untouched.
- Architecture: proposed ADR-0008 and `BR-02-v1` define stable stream cardinality, provider-safe scope identity, reusable immutable revisions, ten purpose bindings, append-only authority/workflow facts, atomic issue references, typed lineage, and BR-03/BR-07 boundaries.
- Compatibility/migration: exact consumer-keyed fallback, no dual-write, conservative six-field legacy mapping, sequential renumber provenance, no imported authority, additive expand/import/cutover/restore sequence.
- API: twenty typed commands plus nine typed queries cover bootstrap, revision, evidence, role, finding, N/A, condition, review, approval, issue, supersession, withdrawal, dependency, and history behavior.
- Deterministic checks: 21 normative identifiers, 20 typed commands, 13 required tables, internal links, Prettier, `git diff --check`, documentation/state-only scope, and one-active/one-next roadmap consistency pass.
- Reviews: independent high-reasoning architecture review `APPROVED`; bounded read-only Claude Opus review `APPROVED`.
- Scope: no application source, schema, migration, dependency, generated runtime artifact, database, shared system, or production behavior changed.
- Human approval: On 2026-07-20 the user explicitly approved `BR-02-v1` and ADR-0008 as schema owner and breaking-contract approver.
- Completion: ADR-0008 is Accepted, `BR-02-v1` is Approved, BR-02 closes at `PASS`, and BR-03 becomes the sole `READY` successor. Runtime/schema implementation and every shared database action remain separately gated.
