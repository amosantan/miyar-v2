# Current Task

- ID: BR-01
- Roadmap step: `BR-01`
- Title: Approve the issued-design-brief product contract
- Status: PASS
- Owner: Codex
- Started: 2026-07-20
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-br01-contract`
- Branch: `codex/br-01-issued-brief-contract`
- Base: exact fetched `origin/main` commit `ce5e44a9b46c5a362e8de9ca26c15a0135e795f4`
- Classification: Product contract and documentation foundation
- Risk: High product/report governance; no runtime, schema, numerical, compliance, or production change is authorized
- Selected loops: Documentation decision and roadmap-execution loops
- Retry budget: Three evidence-based attempts per unchanged documentation or review failure
- Resource budget: One fresh isolated worktree, documentation-only diff, deterministic consistency checks, one independent Claude Opus review
- Human gates: The user accepts the product-owner, design-domain-owner, and report-owner roles for BR-01. The exact specification, ADR, and golden walkthroughs still require explicit approval before BR-01 closes. Commit, push, PR, merge, shared operations, and deployment remain separately unauthorized.

## Goal

Define and approve one canonical product meaning for an Issued Design Brief: ten governed sections, deterministic lifecycle and overlay conditions, separated human roles, three issue purposes, six umbrella typology profiles, immutable issue semantics, and golden acceptance examples.

## Plain-English Problem

MIYAR currently calls several different artifacts a design brief. The structured brief, AI-advisor public brief, autonomous narrative, and generated reports do not share one completeness, evidence, approval, issue, or immutability contract. A user can therefore generate, export, or share something called a brief without one agreed rule proving what it contains, who approved it, what it is safe to use for, or whether later source changes altered it.

## Authorized Scope

- Reconcile roadmap state so BR-01 is the sole active step.
- Define the normative issued-design-brief product specification.
- Record the durable decision in ADR-0007.
- Create six synthetic UAE/AED golden walkthroughs and negative transition cases.
- Trace every current brief/report/share path to a future disposition.
- Preserve deterministic numerical authority, explicit user inputs, tenant isolation, public-share protections, bilingual issued copy, Material Board Annex behavior, and report identity requirements.

## Acceptance Criteria

- [x] One canonical Issued Design Brief boundary and a disposition for every existing brief/report/share path are documented.
- [x] All ten stable section IDs, minimum contents, authority labels, applicability rules, and cross-section reconciliations are defined.
- [x] The six achieved states and structured `stale`/`blocked` overlay conditions have complete allowed/denied transition rules.
- [x] Author, Section Owner, Reviewer, Approver, Issuer, and Viewer responsibilities and separation-of-duty rules are explicit.
- [x] `internal_coordination`, `client_board_approval`, and `tender_rfq` have exact issue gates and safe-use limitations.
- [x] Apartment, villa, office, hospitality, retail, and mixed-use umbrella profiles have explicit applicability, including the BR-06 mapping.
- [x] Six golden walkthroughs collectively exercise all required positive and negative scenarios.
- [x] BR-02, BR-03, BR-05/06, BR-07, and BR-08 downstream ownership is unambiguous; BR-01 contains no implementation design that usurps those steps.
- [x] Formatting, link, identifier, coverage, terminology, diff, and scope checks pass.
- [x] Independent Claude Opus review has no unresolved blocking objection.
- [x] The user explicitly approves the exact finished artifacts as product, design-domain, and report owner.

## Non-Goals

- Runtime types, APIs, routers, UI, database schema, migrations, backfills, report generation, or public-share behavior.
- Scoring, pricing, quantities, financial assumptions, typology rules, professional compliance rules, or legal assurance.
- Full Arabic translation; English is normative and labels are bilingual-ready.
- Git publication, protected-branch integration, shared database work, or deployment.

## Verification

- Deterministic identifier and coverage checks across the specification, ADR, and walkthroughs.
- Markdown formatting and internal-link checks.
- Consumer trace against the current structured brief, AI brief, autonomous brief, reports, exports, RFQ, sharing, project approval, and evaluation readiness paths.
- `git diff --check` and documentation-only scope inspection.
- Independent Claude Opus product/contract review.
- Exact human approval of the completed artifacts.

## Next Action

BR-01 is closed at `PASS`. Begin BR-02 in a fresh worktree from the exact canonical base after this uncommitted closeout is published or otherwise made available as an authorized base. Commit/push/PR remain separately unauthorized.

## Verification Evidence

- Exact canonical base/worktree: fetched `origin/main` `ce5e44a`; fresh `/Users/amrosaleh/Maiyar/miyar-v2-br01-contract`; dirty root and stale planning worktree untouched.
- Deterministic checks: all ten IDs occur in the specification, ADR, and every fixture; six states, two flags, three purposes, six walkthroughs, internal links, formatting, status uniqueness, diff, and documentation-only scope pass.
- State reconciliation: BR-01 is the only current roadmap task; UX-01 remains `NEEDS_HUMAN`; merged DI-01 is `CLOSED`; dependency-invalid BR-06 is `PLANNED`; project state reflects canonical merge and remaining shared migration/release gates.
- Independent adversarial review: initial eight findings and two follow-up consistency notes resolved; final result has no product-contract blocker.
- Claude Opus review: `APPROVED`; lifecycle bindings, N/A semantics, classification, roles, purpose gates, fixtures, flags, artifact dispositions, downstream boundaries, and roadmap truth approved.
- Scope: documentation/state only; no runtime, API, schema, migration, calculation, financial, compliance, report, share, database, or production behavior changed.
- Human approval: On 2026-07-20 the user explicitly approved the exact `BR-01-v1` specification, ADR-0007, and golden walkthroughs as product owner, design-domain owner, and report owner.
