# Current Task

- ID: EV-02
- Roadmap step: `EV-02`
- Title: Implement the evidence and price schema safely
- Status: READY (not yet started; awaiting an implementation session)
- Owner: unassigned
- Started: —
- Base: canonical `origin/main` on the EV-01 merge lineage (`1b270f2` or later)
- Classification: Schema / data (P1)
- Dependencies: `EV-01` (`CLOSED`, ADR-0011) and `TR-14` (`CLOSED`) — both satisfied.
- Human gates: the schema shape is approved via ADR-0011; **shared/production-database application remains separately human-gated** and must stop at `NEEDS_HUMAN` until an exact-target approval is recorded (the EV-00/EV-01b precedent).

## Goal

Implement the ADR-0011 evidence/price-observation model as a safe, additive, expand-phase schema, with an idempotent backfill and a resolver read-API — changing only where numbers are read from, never any value.

## Scope (from ADR-0011 and `docs/artifacts/EV-01_EVIDENCE_PRICE_MODEL.md` §3, §9)

- New tables: `product` (identity), `specification` (spec key), `supplier_quote` (org-scoped, confidential-by-default).
- Extend `evidence_records` → price observation (`productId`, `specId`, `priceScope`, delivery/MOQ/lead-time, `observationKind`), keeping it append-only.
- Extend `benchmark_proposals` → governed benchmark (`specId`, `sourceKind` `observed | assumption`, `supersedesId`).
- Resolver read-API: `specification → single governed value` carrying its source-ladder rung.
- Idempotent, reversible backfill: `material_library` → assumption governed values (labels preserved); `evidence_records` → observations; `materials_catalog` → deduped products.

## Acceptance Criteria (to be expanded at task start)

- [ ] Additive migrations only; every default leaves existing rows truthful; no value, weight, threshold, or benchmark changes.
- [ ] Observations and quotes append-only; original evidence preserved.
- [ ] Uniqueness, unit, date, currency, org/global-scope, and confidentiality constraints per ADR-0011 §5.
- [ ] Backfill runs twice with identical result (idempotent) and has a documented rollback.
- [ ] Safe-target migration + restore rehearsal pass on disposable MySQL with representative legacy data.
- [ ] Full gate battery (check, DB-free suite, guarded MySQL with regenerated TR03H evidence, authorization, DB-safety, build).

## Non-Goals

- Cutting MQI / reconciliation / RFQ / reports over to the resolver — that is `EV-03`, where `material_library`'s single-writer dead-end is actually closed. EV-02 only builds the shape.
- Changing any AED value, tier threshold, scoring weight, or benchmark (cost-consultant gate).
- Applying migrations to shared/production databases without explicit exact-target authorization.

## Notes

- Canonical treatments are fixed by ADR-0011 §5: VAT-exclusive; `supply_only`/`supply_and_install` never mixed; emirate geography; the approved source ladder (quote › official stat › consultancy › market-obs benchmark › retail-only sanity › assumption); waste excluded; 3-year observation retention.
- Any ADR-0011 §7 ruling may still be amended by a superseding ADR before implementation locks it in.
