# ADR-0011: Evidence and price-observation model

- Status: Accepted
- Date: 2026-07-23
- Deciders: Amro Saleh (schema, cost-policy, procurement, and source/licensing owner)
- Technical area: Material costs, price observations, supplier quotes, governed benchmarks, and assumptions
- Supersedes: ADR-0009 (material cost authority and interim provenance)

## Context

ADR-0009 established an interim: `material_library` stayed the authoritative cost table with additive provenance labels, while full consolidation into an approved evidence/price model was deferred to roadmap `EV-01`–`EV-03`. Its migration note recorded that supersession would require a new ADR "expected from `EV-01`".

Two subsequent releases confirmed the interim's structural cost. EV-00 labelled all 285 `material_library` rows explicit assumptions. EV-01b added deterministic price sources and price class/basis to `evidence_records`, but re-confirmed that the two paths never meet: `material_library` (assumptions, single seed-script writer, mutable min/max) and `evidence_records` (observations) are parallel truths, and `materials_catalog` — the only table ingestion can write — has no provenance columns. Observations cannot reach the authoritative table.

`EV-01` is the decision that ends the parallel truths. Its full specification is `docs/artifacts/EV-01_EVIDENCE_PRICE_MODEL.md` (`EV-01-v1`), approved with defaults on 2026-07-23; this ADR records the accepted decision.

## Decision

1. **Separate six concepts** that "a material with a price" currently conflates: product identity, specification, price observation, supplier quote, governed benchmark, and assumption. Each has one owner and one lifecycle (spec §2).

2. **One read contract.** Calculation engines (MQI, reconciliation, RFQ, issued reports) resolve a *specification* to a single *governed value* — a benchmark promoted from observations, or a clearly-labelled assumption — and never read a raw scrape or raw observation. Observations and assumptions become two `source_kind`s feeding one resolver, not two parallel authorities.

3. **Price observations and supplier quotes are append-only.** An observation is a historical fact; a correction is a new superseding row, never an edit. `evidence_records` is refined into the observation table (reusing its EV-00/EV-01b columns); `supplier_quote` is a new org-scoped, confidential-by-default table feeding EV-06.

4. **Assumptions are `source_kind = assumption` governed benchmarks**, not a separate authority. The migrated `material_library` values keep EV-00's provenance labels. ADR-0009 §8 holds: empty seed categories stay empty until a cost consultant supplies values.

5. **Approved field set and canonical treatments** (spec §7, all at recommended default):
   - VAT stored **exclusive**; `vatIncluded` flagged per observation (UAE VAT 5%).
   - `priceScope` (`supply_only | supply_and_install`) tracked separately; **never mixed in one benchmark**.
   - Benchmark **geography grain is emirate-level**, UAE fallback on insufficient coverage.
   - **Source ladder**: supplier_quote › official_statistic › consultancy_benchmark › market-observation benchmark › retail-only (sanity band only) › assumption. A resolved value always carries its rung.
   - **Waste excluded** from the stored price; applied by the quantity engine.
   - Delivery `ex-delivery` canonical, `deliveryIncluded` never assumed; MOQ, lead time, capture date, validity, confidentiality as specified.

6. **Licensing and retention.** Acquisition stays gated per-source by the BR-06 `termsDecision` (EV-01b). Consultancy content is stored as **derived statistics only**, never verbatim copyrighted tables. Retention: raw observations 3 years; supplier quotes until superseded; confidential quotes never shared cross-org — subject to reconciliation with UAE PDPL under SC-06, which may shorten but not silently extend.

7. **Migration is expand/contract, additive-first** (spec §9). EV-02 creates the new tables and the resolver read-API and backfills idempotently; EV-03 cuts consumers over to the resolver; a later contract phase retires redundant columns. **No number, weight, threshold, or benchmark value changes** in EV-01 or EV-02 — only where numbers are read from. Shared/production application stays separately human-gated per EV-02.

## Consequences

### Positive
- The scrape→observation→benchmark path and the authoritative value converge at one resolver; `material_library`'s single-writer dead-end (recorded in EV-01b) has a defined fix in EV-03.
- Every resolved cost carries its source-ladder rung, so a report can state why a number is what it is.
- Supplier quotes gain a first-class, org-scoped, confidential shape, unblocking EV-06.

### Negative and trade-offs
- The model is larger than two tables; EV-02/EV-03 carry real implementation and cutover cost.
- Emirate-level geography and supply/install separation increase the coverage denominators a benchmark must satisfy before it can publish (governed by EV-04).

### Risks and mitigations
- Risk: a cutover changes a client-facing number. Mitigation: EV-01/EV-02 change only read-source, not values; EV-03 golden reconciliation tests pin equality against the pre-cutover result.
- Risk: retail and installed rates pollute one benchmark. Mitigation: `priceScope` keys separate benchmarks; the source ladder never blends rungs.

## Alternatives considered

- **Keep the ADR-0009 interim.** Rejected: it leaves observations permanently unable to reach the authoritative table.
- **Merge `material_library` and `materials_catalog` directly.** Rejected in ADR-0009 as out of sequence; this ADR supplies the approved model that merge needed.
- **Make raw observations directly readable by engines.** Rejected: it puts unverified, mixed-scope, mixed-basis data on the numerical path, violating the deterministic-authority invariant (ADR-0002).

## Verification

- Representative tile, stone, joinery, paint, sanitaryware, lighting, and furniture examples normalize without information loss (spec §8), including made-to-order joinery (quote-only) and per-litre-vs-per-m² paint.
- EV-02 verification (additive migrations on disposable MySQL, backfill idempotency, resolver contract tests) and EV-03 golden cost-reconciliation equality are defined by those steps.

## Migration and rollback

Adopted through the EV-02 additive migration chain and idempotent backfill, verified on a disposable MySQL target; shared/production application remains separately human-gated. Rollback drops added tables/columns; `material_library` and `materials_catalog` values are untouched until the post-EV-03 contract phase, which is itself separately gated. Supersession requires a new ADR.

## References

- `docs/artifacts/EV-01_EVIDENCE_PRICE_MODEL.md` (`EV-01-v1`, approved 2026-07-23)
- ADR-0009 — Material cost authority and interim provenance (superseded)
- ADR-0002 — Deterministic decision authority
- `.agent/state/ROADMAP.md` — EV-01 … EV-08
- EV-01b release: `docs/artifacts/EV-01b_PRICE_SOURCE_EXPANSION.md`
