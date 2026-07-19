# Current Task

- ID: DI-01
- Roadmap step: `DI-01`
- Title: Build the canonical room, geometry, and measurement foundation
- Status: NEEDS_HUMAN
- Owner: Codex
- Started: 2026-07-19
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-di01-plan`
- Branch: `codex/di-01-plan`
- Base: exact current `origin/main` commit `fff889996f3655cacf34d9044dd574ec5562b642`
- Classification: Schema/geometry/engine implementation and compatibility
- Risk: Critical — a wrong identity, unit, tolerance, migration, or provenance rule can corrupt quantities, reports, tenant boundaries, and every later design-intelligence feature
- Selected loops: Feature, schema-migration, report/visual-QA, and roadmap-execution loops
- Retry budget: Maximum 3 evidence-based attempts per unchanged failure class; every retry must use a new hypothesis
- Resource budget: One isolated worktree; Stage 0 fixture/inventory gate; pure deterministic geometry; additive local schema/migration; disposable MySQL; compatibility and shadow-mode browser verification; maximum three evidence-based attempts per unchanged failure class
- Human gates: The user approved A1, B1, C1, and the first local manual/DXF verification slice on 2026-07-19. Later that day the user recorded that MIYAR is pre-launch with no real customers and rejected shadow mode as a product rollout strategy. The next implementation must be canonical-first for launch. Professional/aggregate area bases, shared database application, commit/push/merge, deployment, scoring/financial/compliance changes, dependency additions, image/PDF/DWG/IFC authority, consumer cutover, legacy relabeling, and destructive contraction remain separately gated.

## Goal

Implement and verify the approved local DI-01 shadow slice: stable room identity, deterministic planar geometry, truthful measurement lineage, authorized manual/DXF sources, additive tenant-safe persistence, compatibility guards, and a bilingual comparison workflow that does not change legacy numerical authority.

## Plain-English Problem

MIYAR currently represents the same room in several different ways. An AI floor-plan result is stored as JSON, a stored space-program room has a database ID and short code, the older space engine can regenerate another short code from list order, DXF import calculates an area and then drops most of the geometry, and materials/reports refer to short room strings again.

That means “Living Room” can drift between features. More importantly, a wall quantity can look measured even though it was inferred from floor area, an assumed rectangle, a default ceiling height, and a blanket opening deduction. DI-01 creates one versioned source of identity and clearly labels whether each value was measured, imported, entered by a user, or estimated.

## Authorized Scope

- Correct and freeze every current producer, store, transformation, and consumer of room identity, geometry, and area.
- Implement `MIYAR_GEOM_V1` for planar physical-room polygons and internal `room_floor_polygon_area` only.
- Add an authorized ASCII-DXF/manual source boundary, additive local persistence, organization-locked helpers, compatibility guards, and shadow-only APIs/UI.
- Generate and verify an additive migration only against disposable MySQL; preserve all existing formulas and outputs.

## Excluded / Still Human-Gated

- No silent conversion of legacy estimates into measured values.
- No adoption of a proprietary measurement rule or compliance content without licensing and qualified review.
- No professional GFA/fit-out/usable/circulation basis, canonical authority flip, shared migration, commit/push/merge/deploy, BR-02/BR-05 integration, image/PDF/DWG/IFC authority, optimization, detailed BOQ, or later DI work.

## Product Lifecycle Amendment — No Shadow Mode

- Decision date: 2026-07-19.
- Product fact supplied by the owner: MIYAR has not launched and has no real customers.
- Product decision: Do not ship or operate a shadow authority mode. Canonical geometry is the intended launch authority, not a side-by-side customer migration.
- The completed shadow implementation remains local verification evidence and reusable technical scaffolding only; it is not the approved final runtime behavior.
- The next bounded implementation must remove or disable shadow selection and shadow-only wording, define canonical-by-default behavior for fresh projects, and verify downstream numerical authority before launch.
- This decision does not itself authorize code changes, shared migration, data reset, commit/push/merge, or deployment.

## Acceptance Criteria — Planning Increment

- [x] The roadmap and current task consistently name DI-01 as the single active/next step and disclose the dependency re-scope and human gates.
- [x] A machine-reviewable inventory maps every room/area path using the columns `producer_path`, `consumer_path`, `identity_key`, `org_boundary_source`, `area_basis`, `unit`, `source_class`, `mutability`, and `disposition`.
- [x] Frozen fixtures reproduce the existing manual, typology-template, AI/image, PDF, DXF, stored-room, MQI, and report-reconciliation paths without calling external providers.
- [x] The proposed contract defines stable logical IDs, immutable versions, room codes/names, levels/zones, boundaries/openings, coordinate system, source units, canonical units, measurement observations, area bases, confidence, provenance, conflicts, insufficiency, and stale propagation.
- [x] The plan states deterministic unit/tolerance/rounding behavior and never lets an LLM become numerical authority.
- [x] The additive schema proposal keeps `organizationId` at every owned boundary and defines organization-locked final reads/writes, indexes, uniqueness, and legacy-null behavior.
- [x] The compatibility plan covers `projects.floorPlanAnalysis`, `pdf_extractions`, `space_program_rooms`, short `roomId` consumers, manual/locked values, mixed old/new application versions, backfill/dual-read choices, rollback/restore, and eventual contraction.
- [x] The first implementation slice, exact files, tests, command gates, browser/overlay evidence, and stop conditions are bounded and dependency ordered.
- [x] Measurement, tolerance, schema, migration, and legacy decisions are presented with a recommended option, alternatives, impacts, and approving owner.
- [x] Existing targeted baseline tests pass; documentation consistency, formatting, and diff checks pass; independent Codex-agent and Claude review objections are resolved or recorded.

## Approved Local Shadow Slice Acceptance Criteria

- [x] One golden manual plan and deterministic DXF fixtures round-trip through the implemented adapters and persistence with stable room identity and no unexplained area drift.
- [x] Original source geometry/measurements remain preserved; normalized geometry is reproducible and linked to its immutable source/version.
- [x] Incomplete, contradictory, unit-ambiguous, non-planar, malformed, unsupported, oversized, or over-complex input fails closed instead of fabricating a measurement.
- [x] Same-organization use succeeds; viewers, unauthenticated callers, cross-organization asset IDs, and cross-project relationships fail closed at API/database boundaries.
- [x] Legacy and shadow projects remain truthfully writable through guarded compatibility paths; canonical mode blocks independent legacy geometry/area writes.
- [x] MQI, scoring, GFA, fit-out area, report/share paths, and existing numerical formulas remain unchanged during shadow mode; candidate evidence is separately labelled.
- [x] Generated migration `0051` passes SQL review, fresh disposable-MySQL forward application, integrity/CAS/mixed-authority checks, application compatibility, logical restore rehearsal, and strict database cleanup.
- [x] Targeted/property tests, TypeScript, safe full suite, authorization/database audits, build/bundle budgets, responsive bilingual browser overlay, diff checks, and independent review pass.

## Execution Plan

- [x] Create a fresh isolated worktree and fast-forward it to exact current `origin/main`.
- [x] Complete Stage 0: governing guidance, 66-row inventory, exact 55-test legacy baseline, and eight provider-free DI-01 fixtures (63/63 combined).
- [x] Complete Stage 1: deterministic `MIYAR_GEOM_V1` contract and fail-closed ASCII-DXF boundary.
- [x] Complete Stage 2: additive tenant-owned persistence, generated migration, CAS, and idempotency foundations.
- [x] Complete Stage 3: authority-aware compatibility bridge across every legacy geometry/area writer and reader.
- [x] Complete Stage 4: authorized manual/DXF shadow APIs and bilingual comparison workflow.
- [x] Run the complete local verification matrix and independent architecture/test review.
- [x] Ask Claude Opus to review the completed implementation and resolve or record every valid objection.
- [x] Record the owner's pre-launch decision that there will be no shadow-mode rollout and stop for a separately bounded canonical-first implementation plan.

## Current Evidence

- `buildSpaceProgram()` can regenerate IDs from room type and array position and can fall back to fixed typology percentages.
- `projects.floorPlanAnalysis` is unversioned JSON containing AI-estimated room names/types/areas but no stable boundaries or room identity.
- `parseDxf()` calculates area from closed polylines, infers room name from layer, uses a magnitude-based unit heuristic, and does not persist the boundary/coordinate contract.
- `space_program_rooms` stores project/org, room code/name/category, sqm, floor, source, and fit-out fields but no geometry/measurement version or coordinate/source lineage.
- Regenerating a stored programme deletes and reinserts non-overridden room rows, so database IDs change; mixed-use blocks can also create duplicate human room codes.
- `calculateSurfaceAreas()` deterministically estimates rectangular dimensions, wall area, openings, and ceiling area from room sqm and defaults; this remains an estimate, not measured geometry.
- Material allocations and multiple downstream consumers reference short string room IDs independently.
- At baseline, the file-extraction route accepted a storage key after project authorization rather than resolving a project-owned asset identity; the implemented boundary now authorizes the actual asset and bounded bytes.
- At baseline, the space-program read path could update `totalFitoutArea`; it is now read-only, and area-changing mutations explicitly refresh the legacy aggregate through the authority-aware write path.
- Frozen baseline on exact `fff8899`: seven targeted files pass, 55 tests total (`v30-mqi`, `v31-space-program`, multimodal floor-plan contract, `area-utils`, report reconciliation, reconciliation router contract, and PDF reconciliation). Expected MQI warnings expose current heuristic boundary behavior and are not test failures.
- Three read-only Codex agents reviewed roadmap lineage, live architecture, and risk-based verification. Claude Opus returned `APPROVED_WITH_CHANGES`; the plan now covers lifecycle, invariants, decision tables, concurrency, ambiguous legacy links, frozen artifacts, performance, and the expanded approval gates it identified.
- The corrected CSV inventory contains 66 evidence-backed rows: 31 producers/transforms and 35 consumers. Every required field is non-empty, IDs are unique, and every cited repository path exists at the observed baseline.
- Stage 0 passes 63/63 provider-free tests: the exact seven-file 55-test baseline plus eight DI-01 legacy fixtures covering manual, typology, AI/image-shaped JSON, PDF-shaped JSON, explicit/unknown-unit DXF, stored rooms, MQI, and report reconciliation.
- ADR-0006 is accepted for the bounded local shadow slice. Its remaining approval blocks are recorded in `docs/artifacts/DI-01_APPROVAL_PACKAGE.md`; no shared migration, canonical flip, formula change, or production behavior is authorized.
- `MIYAR_GEOM_V1` uses checked `BigInt` micrometres and canonical room-floor polygon area, rejects overlapping/invalid/non-planar topology, and preserves exact DXF coordinate lexemes through half-away-from-zero conversion.
- The hardened CAD boundary accepts only finalized same-project ASCII DXF assets with explicit `m`/`mm`, validated checksum/type/limits, worker deadlines/resource limits, deterministic room IDs, and declared level elevation.
- Additive migration `0051` stores tenant-owned immutable sources, graphs, space identities/versions, measurements/input edges, review events, legacy links, authority state, and artifact snapshot foundations. Decimal projections use `DECIMAL(40,12)` so the accepted coordinate domain fits persistence.
- The guarded MySQL command applies the checked-in migration chain to a freshly created loopback database, passes 24/24 tenant/CAS/authority/domain/restore tests, and drops the database afterward.
- Frozen baseline remains 63/63 (the exact legacy 55 plus eight provider-free fixtures); geometry/CAD and final compatibility/workload regressions pass; the safe suite is 1,349 passed with 22 skipped; TypeScript, authorization 345/0, database-safety 114/2/0, production build/bundle budgets, and diff checks pass.
- Fresh bilingual browser verification on a disposable local database proves explicit unit choice, DXF level input, manual 12 m² preview/commit, persisted source/normalized overlay, admin review controls, 390 px RTL/LTR without overflow, and a clean console. Project GFA stayed 1,000 m², fit-out stayed 100 m², and the saved score stayed 70/30.
- Independent Codex architecture and test reviewers returned `APPROVED`. Claude Opus returned `APPROVED_WITH_NONBLOCKING_NOTES`; its only behavior note exposed the room-area edit aggregate drift window, which was fixed through the authority-aware mutation path and covered by a regression. Its remaining low notes are recorded as future hardening/reserved-foundation observations and do not change the shadow slice.
- Claude's remaining low notes: the legacy comparison leg intentionally reconciles its two-decimal stored/display area against exact candidate geometry within the versioned tolerance; the static DXF worker template must never interpolate user-controlled text; and `artifact_input_snapshots` remains a reserved additive foundation with no writer until a separately approved immutable-artifact slice.

## Next Action

Prepare a bounded canonical-first pre-launch implementation plan when requested. It must remove or disable shadow product behavior, establish the canonical default for fresh projects, and verify every downstream numerical consumer. Until that implementation is explicitly authorized, do not apply migration `0051` to a shared database, change runtime authority, publish Git changes, or deploy.
