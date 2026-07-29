# Current Task

- ID: EV-02
- Roadmap step: `EV-02`
- Title: Implement the evidence and price schema safely
- Status: PASS
- Owner: Codex
- Started: 2026-07-28
- Base: canonical `origin/main` at `2bce6a94fb779c0f968169689125bda92dae1eed`
- Classification: Schema / data (P1)
- Dependencies: `EV-01` (`CLOSED`, ADR-0011) and `TR-14` (`CLOSED`) — both satisfied.
- Human gates: schema shape approved via ADR-0011; exact-target PlanetScale migration 0061 and production backfill approved by Amro Saleh on 2026-07-28 and completed against `amr-saleh-hotmail/miyar-v2/main`.
- Completed: 2026-07-28

## Goal

Implement the ADR-0011 evidence/price-observation model as a safe, additive, expand-phase schema, with an idempotent backfill and a resolver read-API — changing only where numbers are read from, never any value.

## Scope (from ADR-0011 and `docs/artifacts/EV-01_EVIDENCE_PRICE_MODEL.md` §3, §9)

- New tables: `product` (identity), `specification` (spec key), `supplier_quote` (org-scoped, confidential-by-default).
- Extend `evidence_records` → price observation (`productId`, `specId`, `priceScope`, delivery/MOQ/lead-time, `observationKind`), keeping it append-only.
- Extend `benchmark_proposals` → governed benchmark (`specId`, `sourceKind` `observed | assumption`, `supersedesId`).
- Resolver read-API: `specification → single governed value` carrying its source-ladder rung.
- Idempotent, reversible backfill: `material_library` → assumption governed values (labels preserved); `evidence_records` → observations; `materials_catalog` → deduped products.

## Acceptance Criteria

- [x] Additive migrations only; every default leaves existing rows truthful; no value, weight, threshold, or benchmark changes.
- [x] Observations and quotes append-only; original evidence preserved.
- [x] Uniqueness, unit, date, currency, org/global-scope, and confidentiality constraints per ADR-0011 §5.
- [x] Product/specification identity and assumption migration use deterministic, versioned policies and exact decimal arithmetic.
- [x] Resolver is organization-safe, uses an explicit `asOf` clock, follows the approved ladder, fails closed on ambiguity, and never serves raw observations.
- [x] Legacy assumptions with unknown supply/install scope remain isolated and are available only through an explicitly labelled compatibility fallback.
- [x] Backfill defaults to dry-run, refuses protected targets, runs twice with identical results, emits a rollback manifest, and restores the exact legacy state.
- [x] Safe-target migration + restore rehearsal pass on disposable MySQL with representative legacy data.
- [x] Full gate battery passes: check, DB-free suite, guarded MySQL with regenerated TR03H evidence, authorization, DB-safety, build, critical-workflow certification, diff review, and independent Sol review.

## Retry and Approval Boundary

- Retry budget: three evidence-based attempts per failure class.
- Allowed: local additive migrations, disposable-MySQL verification, reversible backfill rehearsal, scoped local commits.
- Stop before: push, pull request, shared/production migration or backfill, deployment, external publication, or any numerical-policy change.

## Non-Goals

- Cutting MQI / reconciliation / RFQ / reports over to the resolver — that is `EV-03`, where `material_library`'s single-writer dead-end is actually closed. EV-02 only builds the shape.
- Changing any AED value, tier threshold, scoring weight, or benchmark (cost-consultant gate).
- Applying migrations to shared/production databases without explicit exact-target authorization.

## Notes

- Canonical treatments are fixed by ADR-0011 §5: VAT-exclusive; `supply_only`/`supply_and_install` never mixed; emirate geography; the approved source ladder (quote › official stat › consultancy › market-obs benchmark › retail-only sanity › assumption); waste excluded; 3-year observation retention.
- Any ADR-0011 §7 ruling may still be amended by a superseding ADR before implementation locks it in.
- Release evidence: migration SHA-256 `06ce9d537ed5593252234ed44271a5f50ff202b8f67adc3c20ab3fb1ba1691aa` deployed additively through PlanetScale requests #10–#15 after successful backup `lts2fnegcfej`; all requests are `complete`. PR #52 merged the PlanetScale bulk apply/rollback path as `7dbddf2` after hosted CI and independent MIYAR Sol review passed.
- Production backfill applied at `2026-07-28T20:34:26.493Z`: 2,957 products, 24 specifications, 242 unknown-scope governed assumptions, 2,957 legacy links, and 43 explicit insufficiencies (37 unknown unit basis; six incomplete price ranges). A second dry-run inserted zero rows. All links resolve, duplicate/dangling checks are zero, and the 285-row legacy numeric SHA-256 remains `4857602ad093bfb3fe54f095b03cd1ebc8a1fd88f3c3fdffd2d7542f8c8ba31a`.
- Recovery manifest: owner-only `/Users/amrosaleh/.miyar/recovery/ev02-production-backfill-20260728.json`; production rollback additionally requires a verified write-quiescent window. `EV-03` remains the next executable step and owns calculation-consumer cutover.
