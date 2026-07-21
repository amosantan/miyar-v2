# Current Task

- ID: BR-04
- Roadmap step: `BR-04`
- Title: Guided Studio Foundation
- Status: PASS
- Owner: Codex
- Started: 2026-07-21
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-br04-brief-studio`
- Branch: `codex/br-04-brief-studio`
- Base: exact fetched canonical `origin/main` commit `4712e220bccd39fcf5cf8472caf65730d78ff883`
- Classification: Cross-layer UI/workflow feature with deterministic budget normalization
- Risk: Tenant authorization, immutable workflow integrity, explicit-input preservation, numerical unit correctness, compatibility, accessibility, and preview side effects
- Selected loops: Roadmap execution and feature delivery
- Retry budget: Three evidence-based attempts per unchanged failure class; five feature-loop iterations maximum
- Resource budget: One isolated worktree, no shared database writes, bounded parallel read-only audits, proportional full verification, and independent Claude review
- Human gates: Push, merge, BR-03 shared migration verification, and the bounded BR-04 production rollout were authorized and completed on 2026-07-21. Numerical-policy change beyond the approved BR-04 contract, production dependency, legacy cutover, report issue/share cutover, and BR-04B–E remain separately gated.

## Goal

Turn BR-03's governed but technical workspace into a guided ten-section design-brief studio backed by typed, versioned section content, one tenant-safe aggregate API, deterministic AED/area normalization, authorized references, recoverable workflow actions, and a side-effect-free non-issued preview.

## Plain-English Problem

The current workflow proves governance, but authors still edit raw JSON and paste database IDs. Important facts are spread across several queries, and budget values do not yet have one enforceable area/unit contract. A user cannot comfortably build or review a defensible brief without understanding the database model.

## Acceptance Criteria

- [x] A discriminated, schema-versioned `BriefSectionContentV1` union validates structured content for every approved section and remains compatible with readable BR-03/legacy JSON.
- [x] `brief.reviseSection` validates content against the selected section, preserves explicit user inputs, and rejects mismatched, incomplete, or unsafe payloads without changing workflow state.
- [x] `cost_quantities` deterministically preserves as-entered values and normalizes AED totals, AED/m² or AED/ft² rates, named area basis, and area using one shared conversion and rounding contract; ambiguous legacy values fail closed.
- [x] `brief.getStudio` returns exact stream/version identity, typed sections, server readiness, assignments, assumptions, evidence, findings, conditions, issue history, and server-authoritative permitted actions without cross-tenant disclosure.
- [x] Guided editors cover all ten sections and show owner, maturity, evidence, assumptions, findings, stale/blocked conditions, dependencies, and next permitted action without raw JSON or raw user/event/dependency entry.
- [x] Authorized user/evidence/reference pickers, role/action inbox, assumption register, specialist links, and conflict/CAS recovery retain the canonical project/brief/version/section/return context.
- [x] Proposal, evidence, review, approval, resolution, and issue remain separate immutable actions by authorized actors; the UI never presents an action the server does not permit.
- [x] Working preview remains visibly non-issued and opening/editing it creates no report, export, share, token, public artifact, or issue event.
- [x] Empty, loading, error, unauthorized, stale, blocked, conditional-N/A, conflict, idempotency, and recovery states are covered as applicable.
- [x] Targeted unit/router/UI tests, guarded disposable MySQL, safe full suite, TypeScript, authorization/database audits, build/budgets, authenticated responsive EN/AR theme/RTL browser journeys, visual review, and independent review pass.

## Non-Goals

- Applying migration 0052 or any new migration to a shared or production database.
- Composing AI-authored briefs, typology rules, market/material intelligence, audience views, controlled boards, or production image generation; these remain BR-04B–E and their dependencies.
- Changing scoring, pricing policy, financial assumptions, compliance conclusions, issue/export/share contracts, or legacy report behavior.
- Automatically promoting legacy content or ambiguous budget values into authoritative structured content.
- Pushing, merging, deploying, or contracting legacy routes without explicit follow-up authorization.

## Verification

- Focused shared-contract and deterministic budget fixtures, including m²/ft² conversion, round-trip, precision, missing area/basis, and legacy-unspecified cases.
- Router/service tests for section-aware validation, aggregate shape, server-permitted actions, authorization concealment, asset/evidence scope, CAS, idempotency, and ordered actor separation.
- Guided-studio component/router tests for all sections plus empty/loading/error/unauthorized/conflict and recovery states.
- Guarded disposable MySQL workflow and migration compatibility; `DATABASE_URL='' pnpm test`; `pnpm check`; authorization and database-safety audits; `pnpm build` and bundle budgets.
- Authenticated browser journeys at 360/768/1440 for author/reviewer/approver/issuer, keyboard/accessibility, light/dark, EN/AR RTL, and preview side-effect assertions.
- Complete diff/security/numerical review and final Claude review.

## Assumptions

- Canonical currency is AED and canonical area is m²; ft² remains an accepted input/display unit.
- One canonical brief supplies all later audience views; BR-04 does not create independent documents.
- Structured content is additive inside the existing schema-versioned JSON revision payload, so this slice should not require a schema migration.
- Existing untyped BR-03 and legacy content remains readable and visibly legacy; only a human-created validated revision becomes `BR-04-v1` structured content.

## Next Action

BR-04 is complete, merged, and deployed at `PASS`; its BR-03 migration prerequisite is verified in production. The next executable roadmap step is `BR-05`; start it only in a new worktree from then-current canonical `main`.

## Completion Evidence

- Typed ten-section contract and deterministic budget normalization: 16 engine fixtures; final focused BR-04 suite 36/36.
- Real persistence/authorization: guarded fresh MySQL chain 31/31 with CAS, idempotency, concurrency, tenant concealment, and cleanup.
- Broad gates: safe suite 1,424 passed/22 skipped; TypeScript; authorization inventory 376/0; database audit 117 entrypoints/two exact generated exceptions/zero findings; production build and all bundle budgets.
- Authenticated browser: separate author, reviewer, approver, and issuer; keyboard; light/dark; EN/AR RTL; 360/768/1440; preview DB counts unchanged for events, issues, reports, and share tokens.
- Independent review: Claude Opus returned `APPROVED_WITH_CHANGES`; all three low findings were fixed and its follow-up verdict was `APPROVED`.
- Release: implementation commit `d8a3b7a` passed PR #27 checks and merged to canonical `main` as `b68c341`; production deployment `dpl_BTcfrGZ6px4iHvJfiETrK8zP8s5F` is `READY` for that exact source commit at `www.miyar.dev`.
- BR-03 migration 0052 was already deployed through PlanetScale deploy request #6 (`vtmwg38gazrv`, deployment `rbiqc0atmv02`) after successful backup `kqthto1vk2jl`; production verification found all 19 canonical brief tables, 247 columns, 70 table/index pairs, and zero workflow rows. It was not applied twice.
- Production rollout is limited to organization 1 and consumer `project_workspace`; the compiled Studio flag is enabled. Root/login, three health checks, unauthenticated brief rejection, and invalid-share privacy headers pass. The authenticated project rendered the Governed Brief tab; a final browser-control timeout prevented one last post-allowlist DOM assertion, so no stronger authenticated claim is recorded.
