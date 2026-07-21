# MIYAR Execution Roadmap

This is the canonical, persistent execution ledger derived from `docs/audits/MIYAR_PRODUCT_TECH_AUDIT_2026-07-15.md`. Codex, Claude Code, and human engineers use it to select and close one bounded step at a time.

## Roadmap Contract

- Roadmap version: `1.0`
- Created: 2026-07-16
- Source audit: `docs/audits/MIYAR_PRODUCT_TECH_AUDIT_2026-07-15.md`
- Strategic priorities: `docs/ROADMAP.md`
- Execution protocol: `docs/runbooks/roadmap-execution.md`
- Active task: `.agent/state/CURRENT_TASK.md`
- Durable lessons: `.agent/state/LESSONS.md`
- Completion history: `.agent/state/WORKLOG.md` and Git
- Next executable step: `BR-03` (`ACTIVE`)

Repository state is the durable memory. Conversation history and agent auto-memory are conveniences only. These files persist across Codex and Claude Code sessions; Git commits make the history durable across machines and checkouts.

## Status Model

| Status        | Meaning                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `PLANNED`     | Defined but a dependency, priority, or earlier step prevents execution.          |
| `READY`       | Dependencies are closed and no approval is needed to begin bounded planning.     |
| `ACTIVE`      | This is the one step copied into `CURRENT_TASK.md` and currently being executed. |
| `NEEDS_HUMAN` | A named decision or approval is required before implementation.                  |
| `BLOCKED`     | Reproduced technical or external blocker remains after the retry protocol.       |
| `CLOSED`      | Acceptance criteria and verification are evidenced; the task ended `PASS`.       |
| `CANCELLED`   | Deliberately removed from scope with a recorded reason.                          |

Rules:

1. There may be only one `ACTIVE` step and it must match `CURRENT_TASK.md`.
2. There must be only one `Next executable step`.
3. A step is not `CLOSED` because code exists; it closes only after its listed evidence passes.
4. When a step closes, update its status, completion evidence, `WORKLOG.md`, `LESSONS.md`, and the next executable step in the same change.
5. Human-gated work may be researched and specified, but implementation stops at `NEEDS_HUMAN` until the named approval is recorded.
6. Do not renumber step IDs. Superseded steps become `CANCELLED` and link to their replacements.

## Phase Summary

| Phase                               | Outcome                                                            | Steps | Exit condition                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------ | ----: | ------------------------------------------------------------------------------------------------ |
| `RM` Roadmap system                 | Shared persistent execution memory                                 |     1 | Both agents use one roadmap, task, worklog, and lessons protocol                                 |
| `TR` Trust recovery                 | Tenant-safe and verifiably releasable baseline                     |    14 | Authorization inventory closed; checks/tests green; critical workflow certified                  |
| `UX` Product experience             | A simpler, credible, workflow-first application experience         |     1 | Core journey, compatibility, readiness, accessibility, and browser verification pass             |
| `BR` Brief operating system         | One governed issued-design-brief workflow                          |     8 | Readiness, typology, version, report, and AI-evaluation contracts operate end to end             |
| `DI` Design intelligence foundation | One canonical room, geometry, and measurement authority            |     1 | Stable room identity, truthful measurement lineage, and legacy-safe reconciliation are certified |
| `EV` Evidence and procurement moat  | Time-versioned UAE cost, source, supplier, and market intelligence |     8 | Displayed claims resolve to governed evidence and procurement comparisons                        |
| `SC` Scale and governance           | Maintainable architecture, enterprise controls, and integrations   |     8 | Operational profiles, privacy, collaboration, commercial controls, and handoff are verified      |
| `EX` Experiments                    | Controlled research after trustworthy foundations                  |     2 | Experiments have evaluation thresholds and cannot become numerical authority                     |

## Phase RM — Shared Roadmap System

### RM-00 — Persistent Codex and Claude Code roadmap

- Status: `CLOSED`
- Class / priority: Documentation foundation / P0
- Dependencies: None
- Human gate: None
- Evidence: The audit has a prioritized matrix, but no canonical step ledger or durable lessons register existed.
- Change set:
  - Create this dependency-ordered roadmap with stable IDs and one next executable step.
  - Create the shared execution runbook and append-only lessons register.
  - Link the protocol from `AGENTS.md`, `CLAUDE.md`, and `docs/ROADMAP.md`.
- Done when:
  - Every audit matrix gap maps to at least one roadmap step.
  - Both agents have explicit start, close, block, and handover instructions.
  - Documentation consistency checks pass.
- Verification: Link/path checks, ID uniqueness, one `ACTIVE` step, one next step, diff review.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: 40 unique dependency-ordered roadmap steps; all 24 audit gaps trace to steps or already-delivered controls; one next executable step (`TR-01`); one shared runbook; six initial proven lessons; documentation formatting, path, status, and diff checks pass.
- Residual risk: The files are durable in the working tree, but cross-machine permanence requires an authorized Git commit.
- Lessons: `LES-006`

## Phase TR — Trust Recovery

### TR-01 — Project-resource ownership inventory

- Status: `CLOSED`
- Class / priority: Security analysis / P0
- Dependencies: `RM-00`
- Human gate: None
- Evidence: `protectedProcedure` authenticates identity but does not guarantee organization ownership; raw resource IDs occur across routers.
- Change set:
  - Inventory every tRPC procedure and database helper that reads or writes project-owned resources.
  - Define the ownership chain for project, brief, asset, room, scenario, report, board, visual, comment, evidence, outcome, and share records.
  - Classify each path as guarded, public-token guarded, global-governed, legacy-null, or unsafe.
  - Create a machine-reviewable checklist grouped by router and resource.
- Done when: Every project-scoped procedure has an owner boundary and remediation disposition; no unknown raw-ID path remains.
- Verification: Static search plus manual route-to-helper trace; sample same-org/cross-org probes; independent diff review.
- Expected artifacts: Security inventory, prioritized remediation batches, updated `KNOWN_FAILURES.md` if new reproducible leaks are confirmed.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: At the historical TR-01 baseline, the AST-backed inventory validated all 327 then-present router procedures exactly once; 107 unsafe, 29 legacy-user, 38 organization-guarded, 43 governed-global, 90 admin-governed, 19 non-project, and one public-token path. Remediation assigned 39 rows to `TR-03`, 93 to `TR-04`, and eight pooled-data paths to `TR-05`. Same-org/cross-org/missing/legacy-null helper tests passed; a disposable mocked route probe confirmed an unsafe path; independent review ended `APPROVED_NO_OBJECTION`. Live procedure counts are maintained only in the generated authorization inventory.
- Residual risk: The inventory documents rather than fixes the 140 remediation rows. The full test suite remains red and is not database-hermetic; Claude Code review could not run because its OAuth token was expired.
- Lessons: `LES-007`, `LES-008`, `LES-009`, `LES-010`, `LES-011`

### TR-02 — Canonical organization-resource authorization layer

- Status: `CLOSED`
- Class / priority: API/security / P0
- Dependencies: `TR-01`
- Human gate: Legacy-null ownership policy if data cannot be safely denied.
- Evidence: `server/_core/project-access.ts` proves the pattern for projects but does not cover all child resources.
- Change set:
  - Define typed project/resource resolvers returning only organization-authorized records.
  - Use indistinguishable missing/cross-org errors.
  - Centralize public-share token authorization separately from authenticated access.
  - Add reusable negative-path fixtures for two organizations and legacy-null records.
- Done when: Routers can require an authorized resource without reimplementing ownership logic.
- Verification: Unit and router contract tests for unauthenticated, same-org, cross-org, missing, expired share, and legacy-null cases.
- Expected artifacts: Authorization helpers, fixtures, security contract documentation.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: Typed direct, nested, organization, combined, batch, and closed-registry polymorphic authorization helpers plus a separate expiring public-share resolver; 49/49 targeted tests pass; authorization inventory and formatting pass; build passes; safe full-suite run reproduces the same nine known failures with no database connection; TypeScript reproduces the same 52 diagnostics with none in TR-02 files.
- Residual risk: The helpers are intentionally not wired into production routers. The 140 inventory remediation rows remain owned by `TR-03`–`TR-05`; public-share fail-closed behavior remains unshipped until `TR-03`. Commit `4b81bab` pushed the scoped TR-01/TR-02 foundation; preview deployment is blocked by the red mandatory type/test gates.
- Lessons: `LES-012`

### TR-03 — Authorize the design-domain router

- Status: `CLOSED`
- Class / priority: API/security / P0
- Dependencies: `TR-02`
- Human gate: None unless a legacy resource has ambiguous ownership.
- Evidence: `server/routers/design.ts` combines approximately 55 procedures and accepts many raw resource IDs.
- Change set:
  - Apply canonical guards to assets, briefs, boards, visuals, materials, comments, floor plans, shares, and DLD-context operations.
  - Require organization identity in downstream database helpers.
  - Preserve token-gated read-only public views.
  - Add same-org and cross-org tests per resource family.
- Done when: No design-domain authenticated procedure reaches project data without a resource guard.
- Verification: Router contract suite, static raw-ID audit, share expiry/read-only tests, full surrounding tests.
- Expected artifacts: Guarded procedures, negative tests, updated inventory.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: All 39 TR-03 inventory rows were reclassified, leaving zero design-domain remediation rows and 101 rows assigned to `TR-04`/`TR-05`; named project/resource resolvers, organization-locked insert/update/delete helpers, composite scenario/link/comment checks, organization-only evidence reads, fail-closed public shares, and a disabled invalid visual-attachment path are shipped in the worktree. The targeted authorization suite passes 68 tests, the safe full suite passes 886 with 22 skipped, TypeScript and all three build targets pass, and independent adversarial review ended `APPROVED_NO_OBJECTION`.
- Residual risk: `attachVisualToPack` intentionally returns `PRECONDITION_FAILED` until a typed attachment model is approved. Independent post-release review found that live membership, final share-token writes, real MySQL semantics, composite atomicity, upload compensation, public-share cache controls, and canonical-main identity require the bounded `TR-03H` hardening step below.
- Lessons: `LES-014`

### TR-03H — Design authorization hardening

- Status: `CLOSED`
- Class / priority: API/security/schema/release / P0
- Dependencies: `TR-03`
- Human gate: Shared migration application, canonical-main push, production deployment, and production smoke writes
- Evidence: Post-release adversarial review found stale-membership access, an unscoped share-token update, mocked-only scoped SQL, non-atomic composite operations, storage orphans after lost authorization, cacheable public shares, and production/main drift.
- Change set:
  - Validate exactly one live organization membership and enforce design viewer/member/admin roles.
  - Add unique membership/share-token indexes and a final organization/project-scoped share update.
  - Make board, RFQ, and floor-plan composite writes atomic.
  - Compensate explicitly rejected direct uploads and add public-share no-store/noindex controls.
  - Run scoped helpers against isolated MySQL 8 and verify provider compatibility before release.
  - Correct inventory coverage and durable release evidence.
- Done when: Every acceptance criterion in `.agent/state/CURRENT_TASK.md` has objective evidence and the reviewed canonical-main SHA is the release candidate.
- Verification: Membership/role contracts, real MySQL rollback/concurrency suite, authorization audit, safe full tests, type-check, build, public-header checks, independent review, and release gates.
- Expected artifacts: Hardened middleware/helpers/routes, migration 0045, isolated integration harness, corrected inventory/state, and reviewed PR/release evidence.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: Live membership and design-role enforcement, scoped share writes, atomic board/RFQ/floor-plan helpers, upload compensation, and public-share privacy controls shipped; `DATABASE_URL='' pnpm test` passes 930 tests with 22 skipped; TypeScript, authorization audit, and all build targets pass; isolated MySQL 8 passes 7/7 and PlanetScale passes 6/6 applicable compatibility tests with the MySQL-only trigger fault injection explicitly excluded; migration 0045 unique indexes are present in production; canonical `main` application release SHA `9e5d1e3` reached Vercel `READY`; production read-only smoke and share-header checks pass; independent review ended `APPROVED_NO_OBJECTION`.
- Residual risk: RFQ retries remain deliberately non-idempotent (`KF-013`). GitHub Actions remains unavailable due the owner billing lock (`KF-014`); the user approved Vercel hosted clean builds as the bounded release substitute. Ordinary full-suite database hermeticity remains tracked by `KF-008`.
- Lessons: `LES-015`, `LES-016`, `LES-017`

### TR-04 — Authorize remaining project routers

- Status: `CLOSED`
- Class / priority: API/security / P0
- Dependencies: `TR-02`, `TR-03`, `TR-03H`
- Human gate: None unless ambiguous legacy ownership is found.
- Evidence: Audit identified the same structural pattern in scenario, analytics, reporting, learning, and related routers.
- Change set:
  - Remediate each unsafe path from `TR-01` outside the design domain.
  - Require organization-scoped helper signatures.
  - Remove caller-controlled organization identifiers where context can supply them.
  - Add a regression inventory test or lintable pattern where practical.
- Done when: The ownership inventory contains no unsafe or unknown authenticated project path.
- Verification: Cross-org negative suite across every router family; targeted integration tests; full test suite.
- Expected artifacts: Closed authorization inventory and security evidence report.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: All 93 baseline rows are closed; the live inventory covers 329 procedures with zero `TR-04` and exactly eight `TR-05` rows. The reopened remediation adds organization-locked atomic report persistence, tenant-owned portfolio alerts through migration `0046`, concurrent active-alert deduplication, explicit tenant/global-alert separation, exhaustive asset-link dispatch, classification acknowledgements, and stronger audit/evidence contracts. Targeted contracts pass 29/29, disposable MySQL 8 passes 13/13 with rollback and ownership/concurrency evidence, the safe full suite passes 950 with 22 skipped, TypeScript/audit/build/diff checks pass, and the final independent Claude Code review ended `APPROVED_NO_OBJECTION`.
- Residual risk: The eight pooled learning/prediction paths remain under `TR-05`. Migration 0046, the approved ownership backfill, production deployment, immediate smoke checks, and canonical-main reconciliation are complete. GitHub Actions billing (`KF-014`) remains open; continue normal production observation.
- Lessons: `LES-018`
- Reopened and reclosed: 2026-07-16 after an ultra-review found non-atomic report artifact writes and tenant writes to globally governed platform alerts. Fresh remediation and verification supersede the earlier closure evidence.

### TR-05 — Isolate learning and prediction data by organization

- Status: `CLOSED`
- Class / priority: Data/security / P0
- Dependencies: `TR-02`
- Human gate: Required before any pooled, anonymized, or global learning cohort is enabled.
- Evidence: `server/routers/learning.ts` reads all evidence and scores across organizations for comparable data.
- Change set:
  - Change the safe default to organization-only evidence, scores, outcomes, and projects.
  - Make insufficient same-organization data explicit rather than silently pooling.
  - Specify a future governed cohort policy with consent, anonymization, minimum cohort size, and version identity.
  - Add two-organization fixtures proving stable isolated results.
- Done when: One organization's records cannot affect another organization's comparisons or predictions under the default policy.
- Verification: Isolation fixtures, deterministic result comparison, query review, no pooled mode without recorded approval.
- Expected artifacts: Scoped queries, insufficiency state, policy decision request for optional pooled learning.
- Closed: 2026-07-17
- Terminal task state: `PASS`
- Completion evidence: Corpus policy and migration 0047 are implemented; safe organization/public database helpers cover evidence, comparables, outcomes, trends, design trends, patterns, and insights; all eight canonical procedures and adjacent consumers are scoped; pooled scheduling is hard-disabled; authorization inventory is 331/331 with zero remediation rows; disposable MySQL passes 18/18; safe suite passes 962 with 22 skipped; TypeScript/build/diff checks pass; final Claude Code review is `APPROVED_NO_OBJECTION`. In-app browser verification passed analytics, UAE cost forecasting, project prediction, design advisor, and learning administration against disposable local MySQL; it also exposed and verified fixes for two misleading zero-value states.
- Production release: Migration 0047 is applied and verified; controlled classification changed zero rows; application commit `1f8c97d` is deployed `READY` as `dpl_G7hPvJk7WUqwxYBdrjZN6noNxNFn` with passing health, authorization, share-privacy, and corpus-integrity smoke checks.
- Residual risk: Production has no approved public-evidence source allowlist, so all 1,755 null-owned evidence rows remain retained as `legacy_unscoped` and excluded. Any future `platform_public` promotion or pooled cohort remains a separate governed human gate.
- Lessons: `LES-020`

### TR-06 — Resolve TypeScript failures by contract group

- Status: `CLOSED`
- Class / priority: Engineering baseline / P0
- Dependencies: `TR-04` recommended; may run earlier only in non-overlapping files.
- Human gate: Stop if a type error exposes an ambiguous product or financial contract.
- Evidence: `KF-001`; the last verified `pnpm check` had 49 errors.
- Change set:
  - Reproduce and classify errors into UI contracts, ingestion utilities, router decimals/contracts, and seed brief contracts.
  - Fix one causal group at a time without broad casts, ignores, or weakened validation.
  - Add tests where the type mismatch represents runtime behavior.
  - Record any intended-contract decision separately.
- Done when: `pnpm check` exits 0 without suppression.
- Verification: Targeted tests after each group, final `pnpm check`, `pnpm test`, and `pnpm build`.
- Expected artifacts: Green type gate and closed `KF-001`.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: Fixing commit `db36254`; all 52 diagnostics were resolved by typed shared entity contracts, ingestion narrowing, decimal serialization, and current design-brief persistence shape; `pnpm check`, the safe full suite, build, and authorization audit pass.
- Lessons: `LES-013`

### TR-07 — Repair unambiguous baseline tests

- Status: `CLOSED`
- Class / priority: Test health / P0
- Dependencies: `RM-00`
- Human gate: None for mocks/import paths; do not choose ambiguous product behavior.
- Evidence: `KF-004` includes invalid normalization imports; `KF-005` auth mocks omit `getDb`.
- Change set:
  - Update auth mocks to reflect the real database module contract.
  - Correct invalid space-program test imports.
  - Prove repaired tests fail against the broken harness, not only the final code.
- Done when: The two auth failures and invalid-path space failures pass without changing product behavior.
- Verification: Targeted Vitest files, surrounding auth/space tests, full suite delta.
- Expected artifacts: Correct test harnesses and updated known-failure evidence.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: Fixing commit `db36254`; authentication mocks include `getDb`, normalization tests use the valid static import, and the safe full suite passes without connecting to a database.
- Reopened: 2026-07-17 at the user's direction for a bounded re-audit of authentication database/audit isolation, typed deterministic fixtures, and the existing static ESM normalization import. Systemic test-environment protection remains under `KF-008`/`TR-12`.
- Reclosed: 2026-07-17 with terminal state `PASS` after schema-derived deterministic user fixtures, type-checked database mocks, isolated audit assertions, and three restored causal mutation proofs. Targeted/surrounding tests pass 49/49; the safe full suite passes 1,021 with 22 skipped and no auth/logout database attempt; TypeScript, the 335-procedure authorization audit, production builds, and diff checks pass.
- Production release: Candidate `15d29c5` merged through PR `#5` as canonical-main commit `85f98db`; Vercel target `FTnLtBnDYeRkqu5rYeKiKrAowRuU` completed successfully, public/negative-path production smoke passed, and three follow-up health observations remained 200. The release contained no runtime or schema change.
- Residual risk: `KF-008` remains open because auth-specific isolation does not provide the fail-closed environment profiles owned by `TR-12`.
- Lessons: `LES-022`

### TR-08 — Decide ambiguous baseline contracts

- Status: `CLOSED`
- Class / priority: Product/data/report decision / P0
- Dependencies: `RM-00`
- Human gate: Product owner and relevant domain owner.
- Evidence: Empty space-program behavior, RICS confidence expectation, and Material Board Annex contract differ between tests and implementation.
- Decision package:
  - Specify empty-space response: empty result, recommendation fallback, or blocking insufficiency.
  - Approve the versioned connector-confidence rule; no numerical policy change by an agent alone.
  - Confirm when the Material Board Annex is mandatory, conditional, or omitted.
- Done when: Each decision has owner, rationale, accepted examples, and effective version.
- Verification: Decision record reviewed against current UI/report/data consumers.
- Expected artifacts: ADR or product decision record feeding `TR-09` and `TR-10`.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: The user approved a neutral empty-space result, retained the versioned Grade A confidence rule with deterministic time, and required the Material Board Annex in both design briefs and full reports with an explicit empty state.
- Reopened: 2026-07-17 at the product owner's direction to create the missing durable decision record, recertify exact boundary behavior, trace current consumers, and hand verified runtime gaps to a separately bounded `TR-09` remediation.
- Current scope: Decision documentation and characterization tests only. No production logic, numerical policy, API, schema, authorization, or report-rendering change is authorized under this reopening.
- Reclosed: 2026-07-17 with terminal state `PASS` after accepted ADR-0003 established policy bundle `TR-08-v1`, characterization strengthened all three contracts without production-source changes, and `KF-016` captured the verified downstream ambiguity.
- Recertification evidence: Targeted contracts pass 80/80; the safe full suite passes 1,023 with 22 skipped; TypeScript, the 335-procedure authorization audit, all build targets, scoped documentation formatting, link/status checks, and diff checks pass; independent code review and Claude Sonnet both returned `APPROVED`.
- Lessons: `LES-023`
- Production release: User-authorized candidate `e49029d` was pushed to `origin/codex/tr-08-contract-recertification`; Vercel preview `dpl_7vTDyhEv63paho4xkw426BjVdATH` and production deployment `dpl_5wEjCcgpCVH2boFmgwA7nMxRMe5M` reached `READY` for the exact commit. Root/health, unauthenticated tenant rejection, invalid-share privacy, and a three-observation health window passed. The release changes tests and durable records only.

### TR-09 — Implement decided baseline contracts

- Status: `CLOSED`
- Class / priority: Engine/test / P0
- Dependencies: `TR-07`, `TR-08`
- Human gate: Cleared by the user's 2026-07-18 authorization for shared migration 0049, protected merge/deployment, and production smoke.
- Evidence: `KF-002`, `KF-003`, and remaining behavior portion of `KF-004`.
- Change set:
  - Implement approved empty-space behavior and edge cases.
  - Repair connector module/runtime resolution.
  - Implement the approved confidence rule as deterministic, versioned TypeScript.
  - Implement the approved board-annex contract.
- Done when: All nine recorded baseline failures are resolved without weakened assertions.
- Verification: Targeted regression suites, full `pnpm test`, type-check, build.
- Expected artifacts: Green test gate; closed `KF-002` through `KF-005` as applicable.
- Closed: 2026-07-16
- Terminal task state: `PASS`
- Completion evidence: Fixing commit `db36254`; SCAD uses the typed ESM PDF parser, RICS recency is deterministic with 90/91-day coverage, empty space analysis is neutral, and design briefs always render the board annex; targeted and full tests plus PDF visual QA pass.
- Reopened: 2026-07-17 after TR-08 recertification verified the unresolved consumer and provenance gaps recorded in `KF-016`. The original closure evidence above remains valid for the behavior it delivered.
- Remediation acceptance boundary:
  - Distinguish an empty neutral fallback from measured space evidence across presentation, scoring, and ROI.
  - Retain and explain the full confidence-policy chain across connector calculation, quality adjustment, update merge, and non-connector ingestion, including clock, invalid/future-date, and rejection-visibility semantics.
  - Distinguish genuine no-board, retrieval failure, and zero, partial, or wholly unresolvable existing-board states in both issued-report paths.
- Reclosed: 2026-07-18 with terminal state `PASS` after the user authorized the controlled production release.
- Completion evidence: PlanetScale production target `miyar-v2/main` was confirmed at the TR-08 schema. Restorable backup `jqb2igl1ebgl` completed, then all eight statements of reviewed additive migration 0049 applied sequentially. The 31-column assessment table, three nullable evidence fields, zero-defaulted rejection count, primary/composite/unique indexes, and legacy-null integrity verified; evidence and run counts remained 1,755 and 368. PR #7 merged as canonical-main commit `bd09c3fdafca885d40b564eafe94ecc67197c7ad`; Vercel deployment `GQyoYH8hnMXwPRMYmzdsCgTg6wNV` reached READY. Root/health, tenant rejection, invalid-share privacy, three health observations, and post-deployment orphan/pointer/unique-key checks passed. The user-approved `KF-014` replacement evidence was bounded to this release and was later superseded by successful hosted CI on canonical `main`.
- Lessons: `LES-024`

### TR-10 — Certify report integrity and visual rendering

- Status: `CLOSED`
- Class / priority: Report / P1
- Dependencies: `TR-09`
- Human gate: Report contract/branding approval for any changed issued content.
- Evidence: Report generation spans multiple engines; the former annex-boundary gap, issued-copy approval, post-fix rendering, and browser-policy gate are now closed with objective or owner-approved evidence.
- Change set:
  - Establish complete, partial, empty, large, Arabic, long-content, and board-heavy fixtures.
  - Assert document identity, evidence, assumptions, disclaimer, version, and annex presence.
  - Render HTML/PDF/DOCX outputs and inspect every page.
  - Record visual defects separately from data-contract defects.
- Done when: Required report variants pass data assertions and visual QA with reproducible fixtures.
- Verification: Targeted report tests, render pipeline, page images/screenshots, link/share checks.
- Expected artifacts: Approved fixtures, rendered QA evidence, report runbook updates.
- Activated: 2026-07-18 on `codex/tr-10-report-certification` from canonical base `18da870` after TR-09 closure and release.
- Implementation evidence: Locale controls/contracts, deterministic bilingual catalogs, output-safety boundaries, per-artifact identity and fingerprinting, stable-key signing, share privacy, fixtures, and the real render harness are implemented. Targeted suites pass 156/156; the release-candidate safe suite passes 1,114 with 22 skipped; TypeScript, report-output audit, the 336/0 authorization audit, build, disposable-MySQL migration 0050 forward/rollback, and independent security/Claude reviews pass.
- Visual evidence: The owner-authorized sixth post-fix iteration passed 23/23 artifacts; all 83/83 browser-PDF and LibreOffice-rendered pages were inspected with no remaining defect.
- Browser evidence and closure: A loopback-only synthetic authenticated environment verified login, every English/Arabic selector, inline preview, stored artifact, project-specific route, and valid/invalid public-share authorization path. It exposed and drove fixes for the post-login homepage redirect, route wiring, fail-hard optional display labels, and the room-render quick action. Login now reaches `/dashboard`. The browser safety policy blocked automated generated download/print/new-page clicks and explicitly forbade an automation workaround; the task owner explicitly waived that remaining UI-click gate on 2026-07-18.
- Closed: 2026-07-18
- Terminal task state: `PASS`
- Completion evidence: Targeted suites pass 156/156; the release-candidate safe suite passes 1,114/22; TypeScript, report-output, 336/0 authorization, build, disposable migration 0050, 23/23 artifacts, 83/83 inspected pages, authenticated bilingual browser workflows, security review, and Claude Opus review pass; issued bilingual copy and the final UI-click waiver are owner-approved.
- Production release: Restorable backup `q0zq6eqznlcq` completed before additive migration 0050. Production retained 29 report rows; `storageKey` is nullable `TEXT`, default `NULL`, with zero backfilled values. PR #12 merged as `55917a145a87c218c34457e054850326fc1e1a1a`; canonical-main CI `29641839449` passed, Vercel target `8A9iDiHwfT3wnXsYXFwqQWLtpPB2` completed for the exact merge commit, and three production root/login/health/tenant/share observations plus post-deploy schema verification passed.
- Residual risk: Authenticated production report generation was not exercised because no production test credential was placed in scope; local authenticated workflows and production unauthenticated tenant/share boundaries passed.

### TR-11 — Replace unsupported public claims

- Status: `CLOSED`
- Class / priority: Product/commercial/legal / P0
- Dependencies: Verified capability/freshness inventory from `TR-13` and `EV-04`, or conservative interim copy.
- Human gate: Product owner and legal/commercial reviewer.
- Evidence: Landing page claims real-time daily pricing, direct/live DLD, compliance assurance, 50+ variations, and unsupported counts.
- Decision package and change set:
  - Map every public quantitative or assurance claim to a live metric, source, owner, and freshness rule.
  - Replace unsupported claims with measured capability or clearly qualified language.
  - Add privacy, terms, disclaimer, and compliance-position links after legal approval.
  - Prevent UI labels such as “live” when coverage/freshness is insufficient.
- Done when: Every public claim has runtime evidence or approved qualification.
- Verification: Copy-to-source matrix, browser review, legal/product approval, automated check for governed counters where practical.
- Expected artifacts: Approved claim registry and revised public pages.
- Activated: 2026-07-18 on `codex/tr-11-public-claims` from canonical base `ee4b134`; the owner approved the conservative interim-copy path and explicitly kept legal publication behind named bilingual product/legal approval.
- Closed: 2026-07-18
- Terminal task state: `PASS`
- Completion evidence: A bilingual claim registry, fail-closed cached/rate-limited public DLD indexed-subset snapshot, qualified Home/Methodology/share/customer/report copy, unknown freshness state, and future `EV-08` contract are implemented without schema, dependency, formula, benchmark, cadence, or legal-publication changes. Targeted tests pass 103/103; the safe suite passes 1,138 with 22 skipped; TypeScript, authorization inventory (337/337, zero remediation), all build targets, diff checks, English/Arabic browser QA, independent security/design review, and Claude Opus review pass.
- Production release: PR #14 merged reviewed commit `e26e07e` as `d0c84da`; canonical-main CI `29645745114`, Vercel target `ExfGpuVC4UQ83Jy46i6xQnSKdJDP`, three production smoke observations, tenant/share negatives, endpoint minimization, and English/Arabic rendered-claim checks pass. No migration, dependency, scheduler, database write, or backfill was required or performed.
- Residual risk: The production evidence snapshot currently fails closed as unavailable, so MIYAR truthfully shows no indexed counts until governed evidence is available. “Monitored weekly refresh” remains prohibited until `EV-08` closes and runtime health satisfies its approved SLA; legal pages remain unpublished pending exact bilingual product/legal approval.
- Lessons: `LES-027`, `LES-028`

### TR-12 — Safe local and test database profiles

- Status: `CLOSED`
- Class / priority: Operations/security / P0
- Dependencies: `RM-00`
- Human gate: Infrastructure approval only if shared deployment configuration changes.
- Evidence: Local development used whichever `DATABASE_URL` was configured and previously started workers automatically.
- Change set:
  - Define explicit local, test, preview, and production environment profiles.
  - Fail safely when a local command points to a protected/shared target unless explicitly authorized.
  - Keep background jobs opt-in outside production.
  - Document seed/reset boundaries without exposing credentials.
- Done when: Ordinary local/test commands cannot silently mutate a shared environment.
- Verification: Configuration tests, dry startup logs, test-database smoke, runbook review.
- Expected artifacts: Environment contract and updated local-development runbook.
- Scheduling note: Restored as the sole next executable step after verified local closure of `TR-11`.
- Activated: 2026-07-18 on `codex/tr-12-safe-db-profiles` in the new worktree `/Users/amrosaleh/Maiyar/miyar-v2-tr12` from exact `origin/main` commit `ee6c834`.
- Closed: 2026-07-18
- Terminal task state: `PASS`
- Completion evidence: Central pre-dotenv profile/target/operation policy; final-use connection assertion; guarded Node, serverless, Drizzle, migration, seed, reset, import, backfill, and ingestion paths; DB-free Vitest; disposable integration; sanitized `env:check`; and a fail-closed AST inventory are implemented. Focused tests pass 74/74; hostile-parent full suite passes 1,206/22; disposable MySQL passes 19/19 with cleanup; TypeScript, authorization 337/0, database-entrypoint audit 106/2/0, build, stale-bundle CI check, startup matrix, and diff checks pass. Independent GPT-5.6 security and Claude Opus reviews approve.
- Production release: Reviewed candidate `1169fed` merged through PR #17 as canonical-main commit `43e5019`; canonical-main CI run `29654957839` passed both required jobs, and Vercel target `4ixzzXRp886bet8XDRhc439czfWd` completed for the exact merge commit. Three root/health observations, unauthenticated tenant rejection, invalid-share privacy, and rendered landing-page browser verification pass. No schema, migration, dependency, shared configuration, or database operation was required or performed.
- Residual risk: Command-scoped approval is a technical acknowledgement, not organizational authority; shared mutations, preview binding changes, and migrations remain separately gated. The generated serverless bundle has two exact owner-qualified audit exceptions and is protected by a post-build stale-output check.
- Lessons: `LES-029`

### TR-13 — Critical workflow certification

- Status: `CLOSED`
- Class / priority: End-to-end / P0
- Dependencies: `TR-04`, `TR-06`, `TR-09`, `TR-10`, `TR-12`
- Human gate: None for local/preview verification; deployment remains separately gated.
- Evidence: No current end-to-end certification covers the full project-to-issued-output journey.
- Change set:
  - Build deterministic fixtures for login, organization, project, evaluation, space programme, MQI, brief, report, share, and revocation.
  - Exercise developer and designer roles plus cross-org negative paths.
  - Record capability differences between Node and serverless profiles.
- Done when: The complete critical journey passes from a clean safe environment with reproducible evidence.
- Verification: Full check/test/build, browser/API workflow, report artifacts, security negatives.
- Expected artifacts: Certification report and refreshed `PROJECT_STATE.md`.
- Activated: 2026-07-18 in `/Users/amrosaleh/Maiyar/miyar-v2-tr13` on `codex/tr-13-critical-workflow` from exact closed-TR-12 commit `1169fed5e9036bd754cfcb79a7619933515d7f00`; the stale dirty root checkout is excluded.
- Closed: 2026-07-18
- Terminal task state: `PASS`
- Completion evidence: Project-wide admin revocation, non-secret brief status, concealed/rate-limited public shares, deterministic report reconciliation, one canonical versioned synthetic fixture, an ordered disposable-MySQL critical journey, real Node/serverless application-factory parity, and one same-project serial Node browser journey are implemented. `pnpm certify:workflow`, hostile-parent full suite (1,253/22), TypeScript, authorization inventory (338/338, zero remediation), database-safety inventory (112 entrypoints, two generated-bundle exceptions, zero findings), build/bundle freshness, report matrix (23/23), nine-page visual inspection, diff/security/scope review, independent high-reasoning authorization re-review, and Claude Opus source review pass; strict cleanup proves the disposable database is absent.
- Residual risk: The public artifact remains the AI-advisor brief, not the structured brief or stored report. `BR-01`/`BR-02` own future issued-artifact unification; `SC-05` owns runtime capability/observability design. Git publication and every shared/production action remain separately gated.
- Lessons: `LES-030`

### TR-14 — Reconcile migration 0044 and database recovery

- Status: `CLOSED`
- Class / priority: Schema/operations / P0
- Dependencies: User direction on the existing migration working files; `TR-12`
- Human gate: Owner of migration `0044`; shared-database application is separately gated.
- Evidence: SQL, snapshot, and journal changes exist as user-owned work and were excluded from the audit.
- Decision package and change set:
  - Identify intended schema state and ownership of `0044`.
  - Reconcile schema, journal, SQL, snapshots, and environment state without discarding user work.
  - Test forward creation and documented recovery in a safe database only.
- Done when: A clean environment can reproduce the intended schema and recovery evidence exists.
- Verification: Migration inspection, safe-target application, integrity checks, rollback/restore rehearsal.
- Expected artifacts: Migration decision, runbook evidence, updated project state.

## Phase UX — Product Experience

### UX-01 — Simplify the developer journey and establish the warm architectural interface

- Status: `NEEDS_HUMAN`
- Class / priority: UI/workflow/schema / P0
- Dependencies: `TR-05`; approved interaction direction supersedes the UI slice of `BR-04` and conservative copy satisfies the interim path of `TR-11`.
- Human gate: Shared/production schema application, deployment, and removal of compatibility routes remain separately gated.
- Evidence: The live application exposes 39 navigation destinations, 13 project tabs, a seven-step form that submits unconfirmed defaults, dark-only presentation, and unsupported public claims.
- Change set:
  - Establish light-first warm architectural tokens, optional dark mode, print-safe output, responsive navigation, Arabic/RTL foundations, and a separate admin shell.
  - Replace public, dashboard, onboarding, intake, and project-workspace journeys while preserving legacy routes and server authorization.
  - Add project input provenance and deterministic readiness so assumed values cannot silently authorize evaluation.
  - Preserve existing scoring, financial, prediction, tenant-isolation, report identity, and sharing contracts.
- Done when: The approved workflow works for new and existing users; route compatibility, authorization, readiness, accessibility, responsive behavior, reports, tests, builds, and authenticated browser journeys pass.
- Verification: Targeted router/component tests, migration review and disposable apply, authorization audit, safe full suite, type-check, build, diff review, and in-app browser verification at desktop/tablet/mobile widths.
- Expected artifacts: Semantic design system, simplified shells and workspace, quick-start/readiness contract, compatibility tests, browser evidence, and durable handover.
- Closed: 2026-07-17
- Terminal task state: `PASS`
- Completion evidence: Warm light/dark semantic themes, simplified application and admin shells, six-field quick start, persisted provenance/readiness gating, four-section workspace, conservative homepage/dashboard/onboarding, and route compatibility are implemented; disposable MySQL passed 19/19, safe suite 971/22, targeted UX/readiness 9/9, authorization audit 333/0, TypeScript/build/diff checks pass, authenticated in-app browser checks passed at 360/390/768/1440 plus themes/RTL/admin/readiness, and Claude Code returned a corrected no-blocker `APPROVE_WITH_CHANGES` verdict.
- Residual risk: Migration 0048, production deployment, route removal, commit/push/merge, and issued-report page certification remain separately gated; `TR-10` is next.
- Reopened: 2026-07-17 for the user-authorized migration 0048, compatibility-route contraction, protected-branch integration, and production deployment gates.
- Current gate: PR `#2` is merged at `029f5c1`, the Vercel commit status is successful, and public root/health checks pass. Neither available browser has a signed-in MIYAR session, so the required authenticated production smoke cannot be reverified autonomously. The user selected independent `TR-07` as the next active step while this gate remains explicit.

## Phase BR — Brief Operating System

### BR-01 — Approve the issued-design-brief product contract

- Status: `CLOSED`
- Class / priority: Product foundation / P1
- Dependencies: `TR-13`
- Human gate: Product owner, design-domain owner, report owner.
- Evidence: MIYAR has many capabilities but no canonical completeness, approval, or issue contract.
- Decision package:
  - Approve the ten brief sections defined by the audit.
  - Approve deterministic states: `missing`, `drafted`, `evidenced`, `reviewed`, `approved`, `issued`, plus `stale` and `blocked`.
  - Define required sections and roles per typology and issue purpose.
- Done when: Golden brief examples and transition rules are approved.
- Verification: Walkthroughs for apartment, villa, office, hospitality, retail, and mixed-use.
- Expected artifacts: Product specification and decision record.
- Activated: 2026-07-20 in fresh worktree `/Users/amrosaleh/Maiyar/miyar-v2-br01-contract` on branch `codex/br-01-issued-brief-contract` from exact fetched `origin/main` commit `ce5e44a`; the dirty root and stale planning worktree remain untouched.
- Decision package evidence: Proposed contract `BR-01-v1`, ADR-0007, and six synthetic UAE/AED walkthroughs define the canonical object, ten sections, achieved-state bindings, overlay flags, classification/applicability, action authority, three purposes, six umbrella typologies, artifact dispositions, issue gates, and downstream boundaries. Deterministic documentation/scope checks pass; independent adversarial review has no remaining product blocker; Claude Opus returned `APPROVED`.
- Closed: 2026-07-20
- Terminal task state: `PASS`
- Completion evidence: The user explicitly approved the exact `BR-01-v1` specification, accepted ADR-0007, and six golden walkthroughs as product owner, design-domain owner, and report owner. Ten-section, lifecycle/binding, overlay, applicability/classification, action authority, purpose, typology, artifact-disposition, issue-gate, immutability, and downstream-boundary contracts are decision complete. Deterministic documentation/scope checks pass; adversarial findings are resolved; Claude Opus returned `APPROVED`; no runtime/schema/production behavior changed.
- Residual risk: Runtime enforcement does not yet exist. BR-02 owns versioning/schema/API/compatibility architecture; BR-03 owns deterministic readiness; BR-05/06 own domain rules; BR-07 owns issued snapshot/report mechanics; BR-08 owns AI evaluation.

### BR-02 — Design brief versioning and readiness architecture

- Status: `CLOSED`
- Class / priority: Architecture/schema / P1
- Dependencies: `BR-01`
- Human gate: Schema and breaking-contract approval before implementation.
- Evidence: Existing brief, project, board, evidence, and report objects do not provide one immutable issued snapshot.
- Change set:
  - Specify versioned brief, section, approval, issue, stale-dependency, and calculation/generation lineage contracts.
  - Map existing tables and compatibility path.
  - Define forward migration, backfill, and rollback/restore plan.
- Done when: ADR, schema proposal, API contracts, and migration plan are approved.
- Verification: Contract review against all current consumers and representative legacy records.
- Expected artifacts: ADR and schema design package.
- Activated: 2026-07-20 in fresh worktree `/Users/amrosaleh/Maiyar/miyar-v2-br02-architecture` on `codex/br-02-brief-versioning` from exact fetched `origin/main` commit `27c0fb4`; the dirty root and all existing worktrees remain untouched.
- Decision package: Proposed ADR-0008 and `BR-02-v1` specify the tenant-scoped relational model, typed API contracts, immutable issue-reference ledger, exact consumer compatibility, conservative legacy import, additive migration/cutover/recovery, and verification walkthroughs. Deterministic documentation/scope checks pass; independent engineering and Claude Opus reviews return `APPROVED`.
- Closed: 2026-07-20
- Terminal task state: `PASS`
- Completion evidence: The user explicitly approved `BR-02-v1` and accepted ADR-0008 as schema owner and breaking-contract approver. The decision-complete package defines tenant-scoped stream/content/version identity, provider-safe uniqueness, append-only functional workflow, exact immutable issue references, twenty typed commands, nine typed queries, typed lineage, consumer-specific compatibility, conservative legacy import, and additive migration/recovery. Deterministic documentation/scope checks pass; independent engineering and Claude Opus reviews return `APPROVED`; no runtime/schema/database behavior changed.
- Residual risk: The approved architecture is not implemented. `BR-03` owns deterministic readiness; schema generation/application, consumer cutovers, BR-07 snapshots/sharing, shared database work, and deployment remain separately gated.
- Lessons: `LES-038`
- Successor selected: `BR-03`

### BR-03 — Implement deterministic brief readiness

- Status: `ACTIVE`
- Class / priority: Engine/API / P1
- Dependencies: `BR-02`
- Human gate: Approved schema/contract; shared application remains gated.
- Evidence: Users cannot tell what is complete, assumed, stale, or blocked.
- Change set:
  - Implement deterministic readiness from section requirements and evidence state.
  - Expose insufficiency reasons and stale dependency traces.
  - Ensure AI suggestions cannot approve or issue.
- Done when: UI, API, and report compute identical readiness for golden fixtures.
- Verification: Unit fixtures per typology/state transition, router tests, explainability checks.
- Expected artifacts: Readiness engine, contracts, API endpoints.

### BR-04 — Build the unified brief workspace

- Status: `PLANNED`
- Class / priority: UI/workflow / P1
- Dependencies: `BR-03`
- Human gate: Approved interaction/design direction.
- Evidence: Global and project routes fragment completion and approval context.
- Change set:
  - Present the brief sections, readiness, owner, evidence, assumptions, and next required action in one project workspace.
  - Preserve expert/manual editing and explicit user inputs.
  - Link specialist tools without losing brief context.
- Done when: A developer and designer can complete, review, approve, and issue a brief without route dead ends.
- Verification: Role-based browser journeys, accessibility, responsive and visual review.
- Expected artifacts: Unified workspace and onboarding guidance.

### BR-05 — Build the typology-pack framework

- Status: `PLANNED`
- Class / priority: Product/engine / P1
- Dependencies: `BR-01`, `BR-03`
- Human gate: Domain approval for rule content, not framework mechanics.
- Evidence: Current typologies are largely labels and generic templates; retail is not first-class.
- Change set:
  - Define versioned pack contracts for objectives, personas, rooms, area rules, adjacency, fit-out, FF&E, compliance prompts, risks, and deliverables.
  - Separate deterministic rules from narrative guidance.
  - Add pack provenance, owner, review date, and applicability.
- Done when: A new pack can be added without router/UI branching.
- Verification: Schema/contract tests and a neutral sample pack.
- Expected artifacts: Pack engine, validator, authoring template.

### BR-06 — Validate priority UAE typology packs

- Status: `PLANNED`
- Class / priority: Design intelligence / P1
- Dependencies: `BR-05`
- Human gate: UAE architects/interior designers, cost consultant, and relevant compliance reviewer.
- Evidence: Apartment, villa, residential building, office, hospitality, retail, and mixed-use require different programmes and outputs.
- Change set:
  - Author and validate packs for apartment, villa, residential building, office, hotel/serviced apartment, restaurant/F&B, retail, and mixed-use.
  - Record assumptions and benchmark sources.
- Done when: Golden briefs reconcile areas, responsibilities, and required sections for every pack.
- Verification: Domain review plus deterministic golden fixtures.
- Expected artifacts: Approved versioned typology packs.

### BR-07 — Canonical issued-report snapshot

- Status: `PLANNED`
- Class / priority: Report/data / P1
- Dependencies: `BR-02`, `BR-03`, `TR-10`
- Human gate: Report identity and issue-purpose approval.
- Evidence: Screens and report engines can diverge; reproducibility metadata is incomplete.
- Change set:
  - Create one immutable snapshot DTO containing brief/project versions, inputs, evidence, engine/benchmark/model/prompt IDs, assumptions, approvals, disclaimer, and issue status.
  - Generate designer, board, DOCX, PDF, HTML, and share variants from the same snapshot.
- Done when: All variants reconcile exactly and a later data change cannot alter an issued artifact.
- Verification: Cross-format assertions, snapshot hash, rendered visual QA, expiry/share tests.
- Expected artifacts: Snapshot contract and unified report pipeline.

### BR-08 — Establish the AI quality evaluation gate

- Status: `PLANNED`
- Class / priority: AI/design intelligence / P1
- Dependencies: `TR-06`; product fields from `BR-01`
- Human gate: Fixture licensing/consent and evaluation thresholds.
- Evidence: Tests cover parsing and failure but not field accuracy, conflicts, abstention, or visual consistency.
- Change set:
  - Build consented golden multimodal fixtures.
  - Measure exact-field precision/recall, conflict preservation, abstention, hallucination, recommendation acceptance, and override.
  - Register prompt, model, schema, and evaluation versions.
  - Block promotion when thresholds regress.
- Done when: Every production AI workflow has a versioned evaluation report and promotion rule.
- Verification: Repeatable evaluation command, baseline report, deliberate-regression test.
- Expected artifacts: Eval harness, registry, promotion runbook.

## Phase DI — Deterministic Design Intelligence Foundation

### DI-01 — Build the canonical room, geometry, and measurement foundation

- Status: `CLOSED`
- Class / priority: Schema/geometry/engine / P1
- Dependencies: `TR-13` is closed. The active planning increment absorbs only the geometry-specific calculation-authority work needed to specify this foundation. `BR-02` and `BR-05` remain integration gates rather than blockers to the bounded ADR/compatibility package.
- Prioritization decision: On 2026-07-19 the user selected `DI-01` as the single next executable step. This changes execution order, not the human approval requirements below.
- Human gate: On 2026-07-19 the owner authorized the bounded canonical-first local implementation, the exact local Docker reset for `miyar_auth_test_tr10_browser`, and then commit/push/draft-PR publication with CI and complete-diff review. The reset and PR #22 merge are complete. Shared database application, deployment, professional GFA/fit-out rules, image/PDF/DWG/IFC authority, scoring/financial/compliance changes, and new material dependencies remain gated.
- Plain-English outcome: Every room, boundary, opening, level, zone, and area will eventually have one stable identity and one explicit measurement basis instead of being recreated differently by each feature.
- Evidence: Live code currently stores AI floor-plan output in unversioned project JSON, regenerates room codes from type and array order, reduces DXF polygons to area using a unit heuristic, stores separate short room IDs in downstream tables, and estimates walls/openings/ceilings from room area assumptions.
- Active change set:
  - Inventory every room/area producer, persistence path, and consumer, then freeze truthful legacy fixtures.
  - Define the canonical identity, version, geometry, measurement, source/provenance, confidence, conflict, insufficiency, and stale-state contracts.
  - Define distinct measured, imported, user-entered, and estimated paths; no class may be silently promoted.
  - Specify area-basis reconciliation, coordinate/unit handling, tolerance/rounding, additive schema, tenant-safe access, compatibility adapters, migration/restore, and mixed-version operation.
  - Replace the verified shadow scaffolding with a canonical-first draft/review/accept workflow for pre-launch projects.
- Done when for the approved implementation slice: Runtime authority contains no shadow choice; fresh projects start canonical; manual/DXF drafts become selected canonical geometry only by explicit admin review; migration 0051 is corrected before sharing; only valid room-floor consumers use accepted polygon measurements; professional GFA/fit-out assumptions remain explicit; and the full local verification/review matrix passes.
- Done when for eventual implementation: One golden plan round-trips without identity or unexplained area drift; incomplete or conflicting geometry yields explicit insufficiency; legacy projects remain truthfully readable; manual locks survive; and organization isolation, migration/restore, downstream reconciliation, visual overlay, and full applicable gates pass.
- Verification: Existing geometry/space/MQI/report baseline; contract/property/unit/tolerance/import/replay/idempotency tests; legacy-null and mixed-version fixtures; two-organization isolation; safe MySQL migration/restore; downstream and rendered-report reconciliation; visual overlay; TypeScript, safe full suite, authorization/database audits, build, browser, diff, and independent review.
- Expected artifacts: `docs/specs/DI-01_CANONICAL_GEOMETRY_PLAN.md`, geometry ADR/schema proposal, producer/consumer inventory, frozen fixture pack, compatibility adapters, canonical room graph, and measurement reconciliation report.
- Local shadow implementation evidence: The corrected inventory records 31 producers/transforms and 35 consumers. The frozen baseline passes 63/63; deterministic geometry/CAD and final compatibility/workload regressions pass; checked-in migration `0051` plus tenant/CAS/domain/restore verification passes 24/24 on disposable MySQL with current hash binding and cleanup; the safe suite passes 1,349 with 22 skipped; TypeScript, authorization 345/0, database-safety 114/2/0, build/bundle budgets, diff checks, and responsive bilingual browser QA pass. Independent architecture/test reviewers approved. Claude Opus returned `APPROVED_WITH_NONBLOCKING_NOTES`; its behavior note was resolved and reverified. Legacy GFA, fit-out, scoring, reports, and shares remain authoritative and unchanged in `shadow` mode.
- Lifecycle amendment: The verified shadow slice is retained as local evidence/scaffolding, not approved launch behavior. There will be no shadow pilot or shadow-mode rollout because the product has not launched and has no real customers.
- Canonical-first implementation evidence: Runtime authority is now only `legacy | canonical`, fresh projects atomically start canonical with no selected geometry, and manual/DXF inputs remain immutable drafts until explicit organization-admin review. Migration 0051 and its snapshot contain the corrected canonical defaults and composite tenant foreign keys. Accepted polygon measurements resolve only through exact graph/source/identity/version/formula/cardinality evidence; canonical MQI fails closed until finish-scope mapping exists, while professional GFA and fit-out remain separate. The final legacy aggregate write is transactionally authority-checked and a real concurrent-review regression proves it cannot land after canonical acceptance. The provider-free suite passes 1,358 with 22 skipped; a fresh disposable MySQL chain passes 25/25 with cleanup and current hash binding; TypeScript, authorization 345/0, database safety 114/2/0, build/budgets, diff checks, and desktop bilingual/role browser journeys pass. Three specialist reviewers and Claude Opus returned `APPROVED`.
- Activated: 2026-07-19 in fresh worktree `/Users/amrosaleh/Maiyar/miyar-v2-di01-canonical` on branch `codex/di-01-canonical-first` from verified local foundation commit `738dfc6`.
- Internal-data operation evidence: The exact loopback-only target `miyar_auth_test_tr10_browser` was snapshotted before reset (89 tables, 42 synthetic/internal rows; restore verified; owner-only snapshot SHA-256 `bd88414571b3115bfa832623bd7febfef2701f83e853c3f7d69fee682369d6f5`), dropped/recreated, and migrated through corrected 0051. The retained target has 100 tables, 52 migration entries, all ten empty DI-01 tables, zero checked application rows, and an idempotent second migration pass. Migration journal entry 52 exactly matches the checked-in 0051 SHA-256 `f3871aee5deefecae6b905850e306afac3e13760da78bd6f9ba0ef954d4f8e92`.
- Publication evidence: Commit `deba8b3` was pushed to `codex/di-01-canonical-first` and draft PR [#22](https://github.com/amosantan/miyar-v2/pull/22) targets `main`. CI run `29691153359` passed lint/test and MySQL authorization; Vercel preview and Preview Comments passed. The complete two-commit branch diff against `main` was reviewed with no unresolved blocker.
- Current scope: The bounded canonical-first implementation, local verification, exact authorized internal reset, Git publication, PR CI/review, and merge through canonical commit `ce5e44a` are complete. Shared migration and release remain unauthorized and require separate human approval.
- Closed: 2026-07-20
- Terminal task state: `PASS`
- Completion evidence: PR #22 merged the reviewed canonical-first geometry implementation through exact canonical commit `ce5e44a`; its previously recorded CI, preview, deterministic geometry, tenant, migration, MySQL, TypeScript, authorization, database-safety, build, browser, specialist, and Claude review evidence remains authoritative.
- Residual risk: Shared migration 0051 and production release remain separately gated; professional GFA/fit-out rules and additional import authority remain outside DI-01.

## Phase EV — Evidence and Procurement Moat

### EV-01 — Approve the evidence and price-observation model

- Status: `NEEDS_HUMAN`
- Class / priority: Data/schema/commercial / P1
- Dependencies: `BR-02`
- Human gate: Schema owner, cost consultant, procurement owner, source/licensing owner.
- Evidence: Three overlapping material models and mutable min/max prices cannot represent current commercial truth.
- Decision package:
  - Separate product identity, specification, price observation, supplier offer/quote, governed benchmark, and assumption.
  - Approve unit/pack, VAT, delivery, supply/install, waste, MOQ, lead time, capture, validity, geography, confidentiality, and source-ladder fields.
  - Approve licensing and retention rules.
- Done when: Representative tile, stone, joinery, paint, sanitaryware, lighting, and furniture examples normalize without information loss.
- Verification: Domain walkthrough and sample observation/quote fixtures.
- Expected artifacts: Data specification and migration decision.

### EV-02 — Implement evidence and price schema safely

- Status: `PLANNED`
- Class / priority: Schema/data / P1
- Dependencies: `EV-01`, `TR-14`
- Human gate: Schema approval; shared-database apply requires separate authorization.
- Evidence: Approved model from `EV-01`.
- Change set:
  - Generate forward migration and compatibility/backfill path.
  - Keep observations append-only and preserve original evidence.
  - Add uniqueness, unit, date, currency, organization/global-scope, and confidentiality constraints.
- Done when: Safe-target migration and restore pass with representative legacy data.
- Verification: Migration review, safe apply, integrity queries, rollback/restore rehearsal.
- Expected artifacts: Migration, backfill/dry-run script, recovery plan.

### EV-03 — Consolidate material identity and calculation inputs

- Status: `PLANNED`
- Class / priority: Data/engine / P1
- Dependencies: `EV-02`
- Human gate: Mapping approval for ambiguous legacy categories/units.
- Evidence: `materials_catalog`, `material_library`, and `material_constants` can drift.
- Change set:
  - Define canonical category/unit identifiers and compatibility adapters.
  - Resolve quantities to product/specification identity and prices to observations/benchmarks.
  - Preserve provenance for every conversion and fallback.
- Done when: MQI, schedules, boards, reports, and RFQs use the same canonical identities.
- Verification: Golden quantity/cost reconciliation and legacy compatibility tests.
- Expected artifacts: Canonical mapping and deterministic adapters.

### EV-04 — Source coverage, freshness, and insufficiency SLA

- Status: `PLANNED`
- Class / priority: Data/product / P1
- Dependencies: `EV-02`
- Human gate: Source strategy and SLA approval.
- Evidence: Capture dates/confidence exist, but client-facing coverage and freshness are not governed.
- Change set:
  - Define coverage denominators by category, geography, tier, unit, and source class.
  - Calculate freshness and quality separately from confidence.
  - Expose insufficient/stale states and source incidents.
- Done when: “Current” or “live” labels appear only when approved SLA conditions pass.
- Verification: Fresh/stale/missing/fallback fixtures, dashboard/report agreement, incident simulation.
- Expected artifacts: Coverage engine, health API, client indicators.

### EV-05 — Govern the DLD market-data pipeline

- Status: `PLANNED`
- Class / priority: Data/analytics / P1
- Dependencies: `EV-04`
- Human gate: Methodology approval before investment or premium claims.
- Evidence: Official DLD/Dubai Pulse data is valuable but does not directly validate design premiums.
- Change set:
  - Version source snapshots, transformations, geography/typology mappings, and quality checks.
  - Define comparable selection and insufficiency without causal overclaiming.
  - Separate official transaction facts from inferred design conclusions.
- Done when: Every displayed market comparable traces to source version and deterministic selection logic.
- Verification: Reproducible ingestion fixture, mapping tests, freshness/coverage checks, methodology review.
- Expected artifacts: Governed pipeline and methodology document.

### EV-06 — Structured RFQ comparison and substitutions

- Status: `PLANNED`
- Class / priority: Procurement/product / P2
- Dependencies: `EV-03`, `EV-04`
- Human gate: Outbound supplier communication and commercial policy approval.
- Evidence: RFQ generation exists, but quote normalization and substitution workflow do not.
- Change set:
  - Define an RFQ package tied to issued brief/specification versions.
  - Import supplier offers without sending externally by default.
  - Normalize units, inclusions, VAT, delivery, validity, lead time, MOQ, alternates, and exclusions.
  - Flag non-comparable offers deterministically.
- Done when: A three-quote fixture produces a reproducible comparison and substitution decision record.
- Verification: Unit normalization, missing-term, alternate, expiry, and cross-org tests.
- Expected artifacts: RFQ/offer contracts and comparison UI.

### EV-07 — Cost and information-standard mappings

- Status: `PLANNED`
- Class / priority: Interoperability/data / P2
- Dependencies: `EV-03`, `BR-07`
- Human gate: Qualified cost/information-management review before conformity claims.
- Evidence: RICS NRM, ICMS, ISO 19650, and openBIM can improve handoff and comparability.
- Change set:
  - Map MIYAR interior categories beneath approved NRM/ICMS classifications.
  - Define issued artifacts as versioned information containers without overstating certification.
  - Export mappings with exclusions and applicability.
- Done when: A representative brief/cost plan round-trips classifications without losing MIYAR detail.
- Verification: Mapping fixtures and qualified reviewer sign-off.
- Expected artifacts: Versioned classification maps and export notes.

### EV-08 — Weekly governed refresh and report-evidence binding

- Status: `PLANNED`
- Class / priority: Data/report/operations / P1
- Dependencies: `TR-12`, `EV-03`, `EV-04`, `EV-05`, `BR-07`
- Downstream consumer: `TR-11` future “monitored weekly refresh” public claim.
- Human gates: Source terms/access, production cadence and cost budget, evidence-promotion policy, report stale/issue policy, and production cron deployment.
- Evidence: Node and Vercel currently select scheduled connectors differently, and a successful cron does not prove that a report used fresh, governed evidence.
- Change set:
  - Establish one versioned critical-source manifest used by Node and Vercel, with a Monday 06:00 UTC attempt for approved Tier-A government/DLD and critical market-price sources; retain approved source-specific schedules for restricted, commercial, fragile, or lower-value sources.
  - Define per-source terms/licensing, cadence/volume, bounded acquisition, units/currency/geography/category mappings, deduplication/retention, freshness, and anomaly policies. Prefer official APIs/downloads; allow documented, permitted, SSRF-safe bounded HTML acquisition only when necessary.
  - Persist immutable run manifests with connector/source/policy versions, trigger/times, raw-capture identity/hash, observed-through dates, outcome counts, deterministic quality result, and per-source success/degraded/failed state.
  - Treat required-source failure, unexpected zero, anomaly, invalid mapping, stale coverage, partial timeout, or incomplete run as non-green. Version deterministic thresholds so replaying the same capture/policy produces the same promotion decision.
  - Automatically promote qualifying Tier-A snapshots only to `evidence_eligible` under a human-approved deterministic policy. Quarantine LLM-extracted, commercial, restricted, anomalous, or incomplete evidence. Never automatically change calculations, scores, prices, assumptions, or benchmark versions.
  - Bind each new report draft to report-eligible source snapshots, ingestion runs, observed-through dates, benchmark version, freshness/insufficiency state, and fallback/omission reason. Issued artifacts remain immutable.
  - Enforce deterministic report states: `current` when every mandatory contract/SLA passes; `degraded` when only non-mandatory evidence is stale/insufficient and unsupported numbers are suppressed; `blocked` when mandatory evidence lacks a current source or approved fallback, preventing issue/share/board-ready presentation.
  - Permit stale fallback only when the report contract explicitly allows the last human-approved benchmark and displays its version, observed-through date, and stale/assumption label. Propagate freshness/insufficiency to private views and public shares.
  - Alert on missed runs, required-source failures, unexpected zero/anomaly, quarantine backlog, SLA breach, stale mandatory report use, overlap, and timeout exhaustion. Default weekly SLA is eight days after the last successful required-source run unless EV-04 approves a superseding versioned threshold.
- Done when:
  - Four consecutive scheduled production windows record truthful outcomes; required sources meet SLA or expose a visible incident; and a real failure or non-writing production-path synthetic canary proves degraded/failed behavior.
  - Repeated ingestion is idempotent; Node and Vercel select identical required sources/policies; recovery rehearsal passes.
  - Fresh evidence updates report provenance without changing scores, prices, assumptions, or benchmarks; stale evidence deterministically produces the correct degraded/blocked state and public-share behavior.
  - Independent data, security, tenant-isolation, and report reviews approve the implementation.
- Verification: Valid/empty/malformed/redirect/timeout/blocked-destination/duplicate/mixed-unit/missing-source/stale/anomaly/partial-failure fixtures; provenance, deterministic-quality, policy-version, idempotency and promote/quarantine tests; Node/Vercel parity; report current/degraded/blocked/fallback/immutability/share tests; cross-organization snapshot-binding tests; safe full suite, type-check, authorization audit, build, bilingual report QA, four-week observation, failure canary, and recovery evidence.
- Public wording gate: Only after closure may TR-11 say “monitored weekly refresh,” and only while the runtime satisfies the approved eight-day SLA. A miss must automatically say “refresh delayed” and show the last observed-through date; it may never continue saying “live.”

## Phase SC — Scale and Governance

### SC-01 — Split the design router by bounded domain

- Status: `CLOSED`
- Class / priority: Architecture / P1
- Dependencies: `TR-03`
- Human gate: None if public contracts remain compatible.
- Evidence: The pre-split `server/routers/design.ts` mixed 63 procedures across many resource families.
- Change set:
  - Split asset, brief, board/visual, material, collaboration, market-context, and sharing routers.
  - Keep shared authorization and validation at composition boundaries.
  - Preserve tRPC public names through compatibility composition where needed.
- Done when: Modules have clear ownership and no behavior or authorization regression.
- Verification: Contract snapshot, router tests, import graph review, full checks.
- Expected artifacts: Bounded routers and architecture update.
- Activated: 2026-07-19 in `/Users/amrosaleh/Maiyar/miyar-v2-sc01` on `codex/sc-01-split-design-router`, stacked from the reviewed uncommitted TR-13 candidate without modifying its worktree.
- Completion evidence: Eight bounded routers own all 63 procedures exactly once behind a 21-line flat compatibility facade. An immutable AST/runtime/middleware baseline, source and owner-identity contracts, authorization inventory 338/0, focused 98 tests, DB-free suite 1,257/22, guarded MySQL 21/21, complete TR-13 workflow certification, TypeScript, database audit 112/2/0, build/freshness, diff review, and independent security/architecture reviews pass with no behavior, authorization, schema, dependency, formula, or public-contract change.

### SC-02 — Make boards and renders controlled design records

- Status: `PLANNED`
- Class / priority: Product/design intelligence / P2
- Dependencies: `BR-02`, `BR-07`, `BR-08`
- Human gate: Approval-state terminology and professional disclaimer.
- Evidence: Generated media lacks a complete room/material/source/prompt/version lineage contract.
- Change set:
  - Record geometry/source, room, allocation, palette, references, prompt/model, seed, output, safety, acceptance, and issue state.
  - Mark outputs stale when upstream brief or material versions change.
  - Separate inspiration, controlled concept, design-development reference, and non-contractual render.
- Done when: Every board/render explains exactly what generated it and whether it is current/approved.
- Verification: Lineage and stale-state tests, browser review, report inclusion checks.
- Expected artifacts: Concept lineage model and UI.

### SC-03 — Complete the design-review workflow

- Status: `PLANNED`
- Class / priority: Collaboration / P2
- Dependencies: `BR-03`, `BR-04`
- Human gate: Notification and approval-role policy.
- Evidence: Comments and approval states exist, but ownership, issue resolution, and immutable transmittal are shallow.
- Change set:
  - Add section assignments, due dates, issues, review decisions, close reasons, and issue transmittals.
  - Preserve an immutable audit trail.
  - Ensure roles cannot approve outside authority.
- Done when: A brief moves from draft through review, resolved issues, approval, and issue with complete accountability.
- Verification: Role matrix, cross-org negatives, end-to-end workflow, audit assertions.
- Expected artifacts: Review workflow and audit events.

### SC-04 — Enforce client performance budgets

- Status: `CLOSED`
- Class / priority: Performance / P2
- Dependencies: Current lazy-route improvement; may execute after `TR-06`.
- Human gate: None.
- Evidence: Initial entry improved to approximately 199 KB gzip, but a deferred shared chunk remains approximately 911 KB.
- Change set:
  - Analyze heavy shared dependencies.
  - Isolate Markdown/diagram/report tooling behind component-level imports.
  - Add entry and route budgets to CI.
- Done when: Initial entry is below the approved budget, heavy routes are deferred, and no critical-flow regression occurs.
- Verification: Repeatable bundle report, build budget, desktop/mobile browser smoke.
- Expected artifacts: Bundle budget and optimization evidence.
- Activated: 2026-07-19 in `/Users/amrosaleh/Maiyar/miyar-v2-sc04` on `codex/sc-04-client-performance-budgets` from exact canonical-main commit `a319d47b77771665c9add390a2befd5a883a7dbb`.
- Closed: 2026-07-19 with terminal state `PASS`.
- Completion evidence: Versioned Vite-manifest budgets enforce entry, CSS, per-chunk, route-closure, forbidden-static, required-dynamic, exception-reason, and expiry contracts in local and Vercel output profiles. Entry is 138,121 gzip bytes; authenticated dashboard fell from 450,808 to 220,257 gzip bytes; all eight route/feature closures pass. Assistant, rich Markdown/diagram/syntax, portfolio briefing, and inline report rendering are interaction-deferred without removing supported behavior. Six checker tests, ordinary suite 1,264/22, TypeScript, authorization 338/0, database-safety 112/2/0, build/freshness, exact desktop/mobile-width guarded workflow, strict cleanup, diff review, and independent high-reasoning review pass. PR `#20` merged the reviewed candidate as `1bad9d666d71a0b010a27433ca196c842b4e546f`; PR and canonical-main hosted CI passed; Vercel production deployment `dpl_EfNS4qwEXLRXHPNKPi6isHG41BuE` is `READY` for that exact SHA. Authenticated report/share/revoke smoke, public 200 privacy headers, and byte-identical revoked/never-issued concealed 404 responses pass.
- Residual risk: The governed Markdown renderer remains approximately 883 KB raw / 267 KB gzip when intentionally opened; its sole bounded exception expires 2026-10-31. Generic Vite large-chunk warnings remain visible. Production smoke reproduced malformed labels in a legacy February 2026 stored report; `KF-018` owns that pre-existing compatibility defect.
- Lessons: `LES-032`, `LES-033`.

### SC-05 — Reconcile runtimes and add observability

- Status: `NEEDS_HUMAN`
- Class / priority: Operations/architecture / P2
- Dependencies: `TR-12`, `TR-13`
- Human gate: Production topology and monitoring cost approval.
- Decision required: The product/operations owner must select the canonical Node/serverless capability topology, name SLO and alert owners, and approve any monitoring provider/cost. The safe default is no implementation or production telemetry change.
- Evidence: Node and serverless entries expose different capabilities; traceability from request to evidence/report is incomplete.
- Change set:
  - Define explicit runtime capability profiles and health output.
  - Externalize or clearly assign workers and cron ownership.
  - Correlate request, organization, project, job, calculation, generation, and artifact IDs without sensitive payload logging.
  - Define SLOs and alert ownership.
- Done when: Each deployment profile declares and tests its capabilities, and a critical workflow is traceable end to end.
- Verification: Contract/smoke tests for both builds, health checks, trace fixture, alert dry run.
- Expected artifacts: Runtime ADR, health contract, observability runbook.

### SC-06 — Implement UAE PDPL retention and data-subject workflows

- Status: `NEEDS_HUMAN`
- Class / priority: Privacy/security / P2
- Dependencies: Data inventory from `TR-01`; architecture from `BR-02`
- Human gate: Legal/privacy owner, provider-region and retention decisions.
- Evidence: Assets, audio, transcripts, generated media, prompts, and personal data exist without a verified retention/DSR workflow.
- Decision package and change set:
  - Inventory purpose, lawful basis, location, processor, retention, export, and deletion behavior.
  - Implement tenant-safe export/delete and retention dry runs after approval.
  - Record cross-border/provider decisions.
- Done when: Approved DSR and retention workflows pass without orphaned or cross-tenant data.
- Verification: Export/delete fixtures, retention dry run, restoration/hold cases, privacy review.
- Expected artifacts: Data inventory, privacy decision, DSR/retention implementation.

### SC-07 — Define commercial packages and entitlements

- Status: `NEEDS_HUMAN`
- Class / priority: Commercial/product / P1
- Dependencies: `BR-01`; cost telemetry from AI/data operations.
- Human gate: Commercial owner, pricing/margin approval.
- Evidence: No billing or entitlement domain supports the proposed Brief, Intelligence, and Portfolio packages.
- Decision package and change set:
  - Validate target segments, packaging, pricing basis, AI/render/data usage costs, and service boundaries.
  - Define deterministic entitlements and enterprise add-ons.
  - Instrument time-saved, completion, conversion, and unit-economics metrics.
- Done when: Packages have approved economics and access rules enforced consistently.
- Verification: Entitlement matrix/tests and pilot metrics review.
- Expected artifacts: Commercial decision record, entitlement contracts, unit-economics dashboard.

### SC-08 — Pilot BIM/IFC/Autodesk handoff

- Status: `NEEDS_HUMAN`
- Class / priority: Integration / P2
- Dependencies: `BR-07`, `EV-03`, `EV-07`
- Human gate: Partner/API credentials, licensing/cost, pilot client.
- Evidence: A DXF parser exists, but no robust Revit/IFC/common-data handoff preserves identities and versions.
- Decision package and change set:
  - Select Autodesk Data Exchange/AEC Data Model or IFC/IDS pilot scope.
  - Map room, finish, material, quantity, issue, and version identities.
  - Produce rejected-field and reconciliation reports.
- Done when: A representative model round-trip preserves IDs, quantities, versions, and exceptions.
- Verification: Golden exchange fixture and designer review.
- Expected artifacts: Pilot adapter, mapping specification, reconciliation report.

## Phase EX — Controlled Experiments

### EX-01 — Research outcome-backed premium and yield calibration

- Status: `NEEDS_HUMAN`
- Class / priority: Experimental/financial / P3
- Dependencies: `EV-05`, governed outcomes, sufficient sample.
- Human gate: Financial assumptions, licensed data, qualified valuation review.
- Evidence: Existing premium/yield logic has limited observed calibration and must not make causal claims.
- Research scope:
  - Define cohorts, design-quality labels, leakage controls, calibration/error metrics, bias/segment analysis, and minimum sample.
  - Keep results research-only until independently reviewed.
- Done when: Out-of-sample evidence supports a bounded claim or the hypothesis is rejected.
- Verification: Pre-registered methodology, holdout evaluation, calibration report, qualified review.
- Expected artifacts: Research report; no production numerical change without a new approved step.

### EX-02 — Evaluate constrained generative design variants

- Status: `PLANNED`
- Class / priority: Experimental/design intelligence / P3
- Dependencies: `BR-08`, `SC-02`
- Human gate: Evaluation threshold and approved brief constraints.
- Evidence: Generating many variations can increase review burden; current public “50+” claim lacks a decision-quality measure.
- Change set:
  - Generate a small diverse set constrained by approved brief, room, material, cost, and compliance evidence.
  - Rank only with deterministic adherence checks plus human selection.
  - Measure rework, selection time, adherence, and useful diversity.
- Done when: The experiment beats the baseline without increasing unsupported or stale outputs.
- Verification: Versioned visual evaluation and user-study results.
- Expected artifacts: Evaluation report; production promotion requires a separate approved step.

## Audit Gap Traceability

| Audit gap                                             | Roadmap steps                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Project resources lack mandatory tenant authorization | `TR-01`–`TR-04`                                               |
| Cross-tenant learning/prediction contamination        | `TR-05`                                                       |
| Red type/test gates                                   | `TR-06`–`TR-09`                                               |
| Unsafe local jobs and fail-open cron                  | Closed audit implementation; retained and expanded by `TR-12` |
| Unsupported public promises                           | `TR-11`, `EV-04`                                              |
| No canonical Brief Readiness contract                 | `BR-01`–`BR-04`                                               |
| Mutable/unprovenanced material prices                 | `EV-01`–`EV-04`                                               |
| Typology coverage is labels, not rule packs           | `BR-05`, `BR-06`                                              |
| Report reproducibility incomplete                     | `TR-10`, `BR-07`                                              |
| Initial client payload                                | Closed by `SC-04`; CI-enforced entry and route budgets        |
| Design router authorization/change hotspot            | `TR-03`, `SC-01`                                              |
| Source freshness/quality is not a product SLA         | `EV-04`, `EV-05`                                              |
| AI quality has no acceptance baseline                 | `BR-08`                                                       |
| Checklist can be mistaken for assurance               | `TR-11`, `BR-06`                                              |
| No focused monetization/entitlement model             | `SC-07`                                                       |
| No robust BIM/CAD handoff                             | `SC-08`                                                       |
| Boards/renders are not controlled design records      | `SC-02`                                                       |
| RFQ lacks quote comparison/substitution               | `EV-06`                                                       |
| Comments are not a full design-review workflow        | `SC-03`                                                       |
| Deferred performance chunk remains heavy              | Governed by expiring `SC-04` exception                        |
| Node/serverless capability drift                      | `SC-05`                                                       |
| No verified retention/DSR workflow                    | `SC-06`                                                       |
| Premium/yield under-evidenced                         | `EX-01`                                                       |
| Generative option explosion                           | `EX-02`                                                       |

## Completion Record Template

When closing a step, replace its completion line or append:

```text
- Closed: YYYY-MM-DD
- Terminal task state: PASS
- Evidence: exact commands, outputs, artifacts, and commit/worktree reference
- Residual risk: remaining limitations that do not invalidate acceptance
- Lessons: LES-###, LES-###
- Successor selected: XX-##
```
