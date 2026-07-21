# Current Task

- ID: BR-03
- Roadmap step: `BR-03`
- Title: Deterministic design-brief readiness and governed workflow
- Status: PASS
- Owner: Codex
- Started: 2026-07-20
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-br03-brief-fix`
- Branch: `codex/br-03-brief-generation-fix`
- Base: exact fetched `origin/main` commit `afd3961db315194dbdd9820749cb9915bbafb686`
- Classification: Critical schema + high-risk engine/API/UI workflow
- Risk: Tenant authorization, immutable issue history, deterministic readiness, concurrency, and additive migration integrity
- Selected loops: Roadmap execution, schema, feature, API, UI, and independent-review loops
- Retry budget: Three evidence-based attempts per failure class
- Resource budget: One isolated worktree, additive disposable-database migration only, specialist schema/API/UI agents, full applicable verification, and Claude Opus review
- Human gates: Shared/production migration, feature enablement, deployment, push, merge, legacy import, issued report cutover, and public sharing remain unauthorized

## Goal

Implement the approved BR-01/BR-02 canonical brief model, deterministic readiness engine, tenant-safe workflow API, project workspace, and clearly non-issued working preview without changing legacy consumers or shared/production systems.

## Plain-English Problem

MIYAR can generate several objects called a design brief, but none can prove that all ten approved sections are complete, evidenced, independently reviewed, approved, current, and safe for one declared purpose. The existing project-readiness check covers scoring inputs only and cannot authorize a brief issue.

## Acceptance Criteria

- [x] Shared closed contracts and one pure deterministic readiness result cover ten sections, purposes, components, insufficiency reasons, and independent stale/blocked state.
- [x] Additive canonical tables and migration implement non-null organization/project scope, immutable history, monotonic event sequence, scoped indexes, and recovery-safe coexistence with legacy paths.
- [x] Transaction services enforce scope, membership, functional authority, state transitions, separation of duties, AI restrictions, CAS, idempotency, and final-write authorization.
- [x] All approved BR-02 commands and queries plus `brief.getReadiness` are registered with closed validation and concealed cross-tenant behavior.
- [x] Stream creation produces one working version and exactly ten bindings; issue atomically revalidates readiness and freezes exact immutable references.
- [x] The project workspace supports the governed author/reviewer/approver/issuer journey and renders server-owned readiness only.
- [x] The working preview is clearly non-issued and creates no report, artifact, snapshot, export, share, token, or public route.
- [x] Golden unit, router, disposable-MySQL, concurrency, parity, browser, accessibility, RTL/theme, type-check, safe-suite, audit, and build gates pass.
- [x] The complete diff passes independent security/integration review and final Claude Opus review with no unresolved blocker.
- [x] Durable state records verified reality and leaves shared migration/release/import/report cutover separately gated.

## Non-Goals

- Applying a migration or enabling canonical behavior on a shared or production environment.
- Importing/backfilling legacy briefs or inferring evidence, approval, or issue authority.
- BR-07 immutable snapshot hashes, PDF/DOCX/HTML issue exports, issued public shares, or legacy report/RFQ cutover.
- Changing scoring, pricing, quantity, financial, compliance, or existing public-share behavior.
- Closing BR-04 automatically; remaining navigation/onboarding/specialist-tool consolidation must be reconciled separately.

## Verification

- Targeted shared-contract, readiness-engine, router, UI contract, and report-preview parity tests.
- Fresh and upgrade migration execution plus transaction/concurrency/tenant/immutability tests on guarded disposable MySQL 8.
- `DATABASE_URL='' pnpm test`, `pnpm check`, `pnpm build`, bundle budgets, authorization audit, and database-safety audit.
- Authenticated local browser journeys for roles, denial paths, responsive layouts, themes, EN/AR RTL, accessibility, and no-side-effect preview.
- Complete diff/security review by independent agents and Claude Opus.

## Next Action

BR-03 is locally complete. Integrate the reviewed candidate into canonical `main` only with explicit Git authorization; then create BR-04's fresh worktree from that exact refreshed commit. Shared migration, production enablement, Git publication, deployment, legacy import, and report cutover remain unauthorized.

## Completion Evidence

- Targeted brief contract/readiness/database tests: 36/36 PASS.
- Guarded disposable MySQL 8 migration, tenant, concurrency, rollback, and workflow suite: 30/30 PASS with cleanup.
- Authenticated browser: author revision, governed evidence submission, independent reviewer acceptance, independent approver approval, issuer preflight, self-contained non-issued preview, no preview report/share/issue side effects, 360/768/1440 layouts without page overflow, light/dark themes, and EN/AR RTL all verified against disposable local data.
- Browser discovery fixed the `getBriefSection` DTO so bound `revisionId` is serialized consistently with `getBriefVersion`; the ordered workflow then passed.
- TypeScript, production build, all client bundle budgets, authorization inventory 375/0, database-entrypoint audit 116/2/0, and diff checks PASS.
- Clean safe aggregate suite after stopping the browser server: 1,398 PASS and 22 skipped. The preceding loaded run's four five-second timeouts also passed 59/59 in isolation.
- Independent final Claude Opus review: `APPROVED`, with no blocker.
