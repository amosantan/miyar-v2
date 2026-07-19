# Current Task

- ID: DI-01
- Roadmap step: `DI-01`
- Title: Canonical-first room geometry launch foundation
- Status: NEEDS_HUMAN
- Owner: Codex
- Started: 2026-07-19
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-di01-canonical`
- Branch: `codex/di-01-canonical-first`
- Base: local verified DI-01 foundation commit `738dfc6ed0ed8654000727c8f80adc2b7e3aeb2a`
- Classification: Schema/geometry/engine implementation, tenant boundary, UI, migration, and downstream measurement integration
- Risk: Critical — authority or area-basis mistakes can corrupt quantities, reports, scoring, or tenant ownership
- Selected loops: Feature, schema-migration, report/visual-QA, and roadmap-execution loops
- Retry budget: Maximum three evidence-based attempts per unchanged failure class
- Resource budget: One fresh isolated worktree, no new production dependency, disposable MySQL only, bounded browser verification, three independent specialist reviews, and Claude review
- Human gates: The exact local internal database reset was separately authorized and completed. On 2026-07-19 the owner authorized committing this verified DI-01 change set, pushing `codex/di-01-canonical-first`, opening a draft PR, running CI, and reviewing the published diff. Merge, shared database write, deployment, production dependency, and professional GFA/fit-out rule adoption still require separate authorization.

## Goal

Replace the locally verified shadow scaffolding with a canonical-first pre-launch workflow. Fresh projects use canonical geometry authority; manual or DXF input is saved as an immutable draft and becomes the selected canonical room geometry only after an explicit organization-admin review action.

## Plain-English Problem

The first DI-01 slice proved geometry could be captured safely, but it deliberately left old room areas in control under a temporary `shadow` mode. MIYAR has not launched and has no customers, so shipping that migration mechanism would add a second source of truth for no benefit. The launch contract needs one authority policy, a clear draft/review lifecycle, and strict limits on what room-floor polygons are allowed to drive.

## Authorized Scope

- Remove `shadow` from runtime authority types, schema, migration 0051, repository helpers, APIs, tests, and user-facing language.
- Make canonical geometry authority the default created with every fresh project.
- Rename the persistence/API/UI workflow to draft, review, and canonical concepts.
- Keep drafts non-authoritative; only an explicit organization-admin acceptance may select a canonical geometry version.
- Update unshared migration 0051 and its snapshot before any shared application.
- Connect accepted `room_floor_polygon_area` only to downstream room-floor quantities when stable identity and finish scope are explicit; otherwise return labelled insufficiency.
- Keep GFA, fit-out, usable, circulation, wall, ceiling, opening, pricing, scoring, ROI, and report assumptions explicit and separate.
- Execute the separately authorized snapshot/reset/reapply operation only against the exact local internal target `miyar_auth_test_tr10_browser`.

## Acceptance Criteria

- [x] Runtime authority has no `shadow` option; new projects atomically receive `canonical` authority with no selected geometry.
- [x] Manual/DXF save creates an immutable draft and cannot select authority or change downstream results.
- [x] Admin acceptance is append-only, CAS-controlled, tenant-scoped, updates draft/review state, and selects the accepted canonical version atomically.
- [x] Rejection and clarification do not select geometry; replay and concurrent writers remain deterministic and fail closed.
- [x] Public tRPC and bilingual UI use draft/review/canonical language with viewer/member/admin permissions preserved.
- [x] Migration 0051 and its snapshot match the canonical-first schema and pass fresh disposable-MySQL application/restore/integrity tests.
- [x] Accepted room floor polygon measurements feed only compatible floor-area consumers with exact stable-space linkage and explicit provenance; missing scope/linkage is insufficient, never guessed by name/code.
- [x] Professional GFA/fit-out and estimated wall/ceiling/opening calculations remain distinct, labelled, and regression-protected.
- [x] Internal development data strategy is recorded with rationale; the exact local target was snapshotted, restore-tested, reset, and migrated only after explicit authorization.
- [x] Tenant, geometry/property, MySQL, report, scoring, safe full-suite, TypeScript, authorization/database audits, build, browser LTR/RTL, and diff verification pass.
- [x] Independent architecture, measurement, and verification reviewers plus Claude review have no unresolved blocking objection.

## Data Strategy Decision

Decision: safely reset disposable/internal DI-01 development data, after taking a target-specific snapshot and confirming row counts, then reapply the corrected unshared migration 0051. Do not heuristically migrate legacy room codes, names, array positions, GFA, or fit-out values into canonical identities or polygon measurements. This is appropriate because MIYAR is pre-launch, has no real customers, migration 0051 has never been shared, and ambiguous legacy records cannot prove stable identity or measurement basis.

On 2026-07-19 the owner separately authorized this operation for the exact loopback-only Docker database `miyar_auth_test_tr10_browser` in container `miyar-tr10-browser-safe-20260718`; no other target was authorized. Before reset it had 89 tables, 42 synthetic/internal rows across 25 non-empty tables, and no DI-01 tables. An owner-only snapshot was written to `/Users/amrosaleh/Maiyar/miyar-v2-di01-canonical/tmp/di01-internal-reset/miyar_auth_test_tr10_browser-before-di01-20260719T142320Z.sql` (265,456 bytes; SHA-256 `bd88414571b3115bfa832623bd7febfef2701f83e853c3f7d69fee682369d6f5`) and restore-tested into temporary database `miyar_auth_test_di01_snapshot_verify`, reproducing all 89 tables and 42 rows before that temporary database was removed. The exact target was then dropped, recreated, and the complete checked-in migration chain reapplied. A second idempotent migration run passed. The retained target now has 100 tables, 52 migration-journal entries, zero rows in the checked application and DI-01 tables, all ten DI-01 tables, and migration entry 52 hash `f3871aee5deefecae6b905850e306afac3e13760da78bd6f9ba0ef954d4f8e92`, exactly matching migration 0051. Only the 42 synthetic/internal rows were removed, and they remain recoverable from the verified snapshot.

## Next Action

Git publication is complete at commit `deba8b30b4db94aafd2da104c19eb3eb18b3d5a9` on `codex/di-01-canonical-first` and draft PR [#22](https://github.com/amosantan/miyar-v2/pull/22). CI run `29691153359` passed lint/test and MySQL authorization; Vercel preview and Preview Comments also passed. The complete two-commit diff against `main` was reviewed with no unresolved blocker. Obtain separate explicit human approval before merge; only after merge identify and authorize an exact shared migration target, and authorize release separately after migration and production verification.
