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
- Next executable step: `TR-05` (`READY`)

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

| Phase                              | Outcome                                                            | Steps | Exit condition                                                                              |
| ---------------------------------- | ------------------------------------------------------------------ | ----: | ------------------------------------------------------------------------------------------- |
| `RM` Roadmap system                | Shared persistent execution memory                                 |     1 | Both agents use one roadmap, task, worklog, and lessons protocol                            |
| `TR` Trust recovery                | Tenant-safe and verifiably releasable baseline                     |    14 | Authorization inventory closed; checks/tests green; critical workflow certified             |
| `BR` Brief operating system        | One governed issued-design-brief workflow                          |     8 | Readiness, typology, version, report, and AI-evaluation contracts operate end to end        |
| `EV` Evidence and procurement moat | Time-versioned UAE cost, source, supplier, and market intelligence |     7 | Displayed claims resolve to governed evidence and procurement comparisons                   |
| `SC` Scale and governance          | Maintainable architecture, enterprise controls, and integrations   |     8 | Operational profiles, privacy, collaboration, commercial controls, and handoff are verified |
| `EX` Experiments                   | Controlled research after trustworthy foundations                  |     2 | Experiments have evaluation thresholds and cannot become numerical authority                |

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
- Residual risk: The eight pooled learning/prediction paths remain under `TR-05`. Migration 0046, the approved ownership backfill, production deployment, and immediate smoke checks are complete. Canonical-main identity (`KF-012`) and GitHub Actions billing (`KF-014`) remain open; continue normal production observation.
- Lessons: `LES-018`
- Reopened and reclosed: 2026-07-16 after an ultra-review found non-atomic report artifact writes and tenant writes to globally governed platform alerts. Fresh remediation and verification supersede the earlier closure evidence.

### TR-05 — Isolate learning and prediction data by organization

- Status: `READY`
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

### TR-09 — Implement decided baseline contracts

- Status: `CLOSED`
- Class / priority: Engine/test / P0
- Dependencies: `TR-07`, `TR-08`
- Human gate: Decisions from `TR-08` must be recorded first.
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

### TR-10 — Certify report integrity and visual rendering

- Status: `PLANNED`
- Class / priority: Report / P1
- Dependencies: `TR-09`
- Human gate: Report contract/branding approval for any changed issued content.
- Evidence: Report generation spans multiple engines and board-annex tests are red.
- Change set:
  - Establish complete, partial, empty, large, Arabic, long-content, and board-heavy fixtures.
  - Assert document identity, evidence, assumptions, disclaimer, version, and annex presence.
  - Render HTML/PDF/DOCX outputs and inspect every page.
  - Record visual defects separately from data-contract defects.
- Done when: Required report variants pass data assertions and visual QA with reproducible fixtures.
- Verification: Targeted report tests, render pipeline, page images/screenshots, link/share checks.
- Expected artifacts: Approved fixtures, rendered QA evidence, report runbook updates.

### TR-11 — Replace unsupported public claims

- Status: `NEEDS_HUMAN`
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

### TR-12 — Safe local and test database profiles

- Status: `PLANNED`
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

### TR-13 — Critical workflow certification

- Status: `PLANNED`
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

### TR-14 — Reconcile migration 0044 and database recovery

- Status: `NEEDS_HUMAN`
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

## Phase BR — Brief Operating System

### BR-01 — Approve the issued-design-brief product contract

- Status: `NEEDS_HUMAN`
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

### BR-02 — Design brief versioning and readiness architecture

- Status: `PLANNED`
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

### BR-03 — Implement deterministic brief readiness

- Status: `PLANNED`
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

- Status: `NEEDS_HUMAN`
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

## Phase SC — Scale and Governance

### SC-01 — Split the design router by bounded domain

- Status: `PLANNED`
- Class / priority: Architecture / P1
- Dependencies: `TR-03`
- Human gate: None if public contracts remain compatible.
- Evidence: `server/routers/design.ts` mixes approximately 55 procedures and many resource families.
- Change set:
  - Split asset, brief, board/visual, material, collaboration, market-context, and sharing routers.
  - Keep shared authorization and validation at composition boundaries.
  - Preserve tRPC public names through compatibility composition where needed.
- Done when: Modules have clear ownership and no behavior or authorization regression.
- Verification: Contract snapshot, router tests, import graph review, full checks.
- Expected artifacts: Bounded routers and architecture update.

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

- Status: `PLANNED`
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

### SC-05 — Reconcile runtimes and add observability

- Status: `PLANNED`
- Class / priority: Operations/architecture / P2
- Dependencies: `TR-12`, `TR-13`
- Human gate: Production topology and monitoring cost approval.
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
| Initial client payload                                | Closed audit implementation; remaining budget in `SC-04`      |
| Design router authorization/change hotspot            | `TR-03`, `SC-01`                                              |
| Source freshness/quality is not a product SLA         | `EV-04`, `EV-05`                                              |
| AI quality has no acceptance baseline                 | `BR-08`                                                       |
| Checklist can be mistaken for assurance               | `TR-11`, `BR-06`                                              |
| No focused monetization/entitlement model             | `SC-07`                                                       |
| No robust BIM/CAD handoff                             | `SC-08`                                                       |
| Boards/renders are not controlled design records      | `SC-02`                                                       |
| RFQ lacks quote comparison/substitution               | `EV-06`                                                       |
| Comments are not a full design-review workflow        | `SC-03`                                                       |
| Deferred performance chunk remains heavy              | `SC-04`                                                       |
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
