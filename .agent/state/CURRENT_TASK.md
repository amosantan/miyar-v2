# Current Task

- ID: BR-06
- Roadmap step: `BR-06`
- Title: Dubai regulatory sources and validated typology-pack candidates
- Status: NEEDS_HUMAN
- Owner: Codex
- Started: 2026-07-21
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-br06-dubai-packs`
- Branch: `codex/br-06-dubai-typology-packs`
- Base: exact fetched canonical `origin/main` commit `beaa90b87682e7d214cffe38739629b22308290c`
- Classification: Critical regulatory ingestion/schema/design-intelligence work
- Risk: SSRF and terms/robots safety, regulatory provenance and temporal validity, tenant/public concealment, deterministic numerical authority, immutable release identity, and professional approval boundaries.
- Retry budget: Three evidence-based attempts per unchanged failure class.
- Resource budget: One isolated worktree; at most three concurrent bounded agents; no shared database writes, push, merge, deployment, or external publication.
- Human gates: Named Dubai/UAE architecture-interiors, cost, compliance, and product approvals are required before any pack promotion. Shared schema application, Git publication, merge, deployment, and production enablement remain separately gated.

## Goal

Add a fail-closed regulatory-document acquisition and provenance path for the approved Dubai source catalogue, then produce deterministic source-linked typology-pack v2 candidates without exposing or promoting unapproved regulatory meaning.

## Acceptance Criteria

- [x] Regulatory retrieval is direct-host, allowlisted, robots/terms/retention aware, redirect/SSRF safe, size/MIME bounded, and never uses third-party scraping proxies.
- [x] Additive regulatory source/version/capture/clause/relation/assertion persistence retains exact document and temporal provenance outside market/material evidence records.
- [x] The mandatory Dubai Municipality, Dubai Civil Defence, Dubai Legislation Portal/DET, accessibility, sustainability, food-safety, and authority-scope catalogue is versioned and monitored; unsupported special jurisdictions fail closed.
- [x] Typology-pack v2 preserves v1 compatibility while adding eight closed families, immutable variants/composition, exact per-datum source references, canonical decimal semantics, undirected adjacency, requirements/responsibilities, and platform-only release envelopes.
- [x] Candidate packs, raw captures, clause text, storage/licensing details, and reviewer-private metadata cannot reach runtime production resolution, tenant APIs, serverless/client output, or public shares.
- [x] Tenant overrides remain organization-scoped and cannot impersonate platform regulatory or professional authority.
- [x] Deterministic golden fixtures and negative paths cover every family/variant, source integrity, temporal validity, mixed-use failure, promotion denial, v1 compatibility, authorization, and public-safe projection.
- [x] Targeted tests, disposable MySQL migration/workflow tests, safe full suite, TypeScript, authorization/database audits, build/budgets, diff review, independent Sol review, and usable Claude review pass, or the exact external review blocker is recorded without claiming completion.

## Non-Goals

- Approving or promoting any Dubai typology rule before the named professional gate.
- Changing scoring, pricing, financial assumptions, BR-03 readiness policy, issued-report/share semantics, or legacy market connector authority.
- Treating a scraper, LLM extraction, source grade, tenant admin, or source assertion as professional approval.
- Applying migrations to a shared/production database or pushing, merging, deploying, or publishing externally.

## Baseline

- Fresh worktree created from exact canonical `beaa90b`; BR-05 commit `2052b17` is an ancestor and the root checkout remains untouched.
- `DATABASE_URL='' pnpm vitest run server/engines/typology-pack.test.ts server/engines/v2-connectors.test.ts server/engines/v2-resilience.test.ts server/engines/ingestion/confidence-policy.test.ts server/engines/ingestion/freshness-health.test.ts`: PASS, 5 files / 128 tests.

## Next Action

Obtain and record the official terms, licensing and artifact-retention decisions; acquire and authenticate the exact current documents and clause locators; then obtain separate named architecture/interiors, cost, compliance, and product approvals over the exact source-linked pack fingerprints. The initial official-source review packet is recorded at `docs/artifacts/BR-06_SOURCE_REVIEW_PACKET.md`; its policy and professional fields remain pending. Until then, production source-authority and pack-release registries remain empty. Shared migration application, Git publication, merge, deployment, and production enablement require separate authorization.

## Verification Evidence

- Focused regulatory, pack, router, and compatibility suites: PASS, 7 files / 48 tests.
- Database-free suite: PASS, 1,472 tests with 22 skipped across 112 passed files and one skipped file.
- Disposable MySQL migration/workflow suite: PASS, 7 files / 41 tests; migration 0055 applied only to the disposable target and cleanup succeeded.
- TypeScript: `pnpm check` PASS.
- Authorization audit: 389 procedures, zero remediation findings.
- Database-safety audit: 121 entrypoints, two exact allowlisted generated-bundle entries, zero findings.
- Build and client bundle budgets: PASS; tracked `api/index.js` regenerated from the final source and schema.
- Diff whitespace/scope review: PASS; no shared database, production, publication, or deployment action occurred.
- Independent Sol review: final `PASS` after live-source, typed-assertion, child-document, multi-authority, and mixed-use production-resolution blockers were remediated.
- Claude Opus independently reviewed the finished diff read-only and returned `PASS`.
