# ADR-0009: Material cost authority and interim provenance

- Status: Accepted
- Date: 2026-07-23
- Deciders: Amro Saleh (product, schema, and cost-policy owner)
- Technical area: Material costs, benchmarks, and ingestion-to-report provenance
- Supersedes: none

## Context

A read-only source-to-output audit of the cost path found two independent material-cost paths that never meet:

- A governed live path: scraped `evidence_records` (full provenance and versioned confidence) → deterministic benchmark proposals → human approval → design-brief BOQ cost labels.
- An ungoverned authoritative path: `material_library` — 35 hard-coded seed rows whose only writer deletes the table and re-inserts an array — feeding the MQI cost summary, the design-brief `mqiSummary`, `report-reconciliation.ts`, and the issued PDF. The table has no source, observation date, or confidence columns, so the `AGENTS.md` invariant "every material cost … must expose provenance or a clearly labelled assumption" fails exactly where costs reach clients.

Related defects: RFQ line items were stamped `market-verified` by string-matching a BOQ section label produced by a different number; the MQI engine silently substituted the first library row in a category for unpriced allocations while report reconciliation refused to; an LLM classified `finishLevel`, the price tier that keys benchmarks; and an unreviewed AED ladder inside the ingestion mapper assigned catalog tiers.

## Decision

1. `material_library` remains the authoritative table for MQI, reconciliation, and issued-report material costs. `materials_catalog` remains scrape-fed staging and must not silently become numerical authority. Full consolidation into the approved evidence/price model is deferred to roadmap `EV-01`–`EV-03`.
2. `material_library` gains additive provenance columns: `source_type` (`miyar_assumption | supplier_quote | market_observation | manual_entry`, default `miyar_assumption`), `source_label` (default `MIYAR assumption`), `source_url`, `price_observed_at`, `price_confidence` (`assumption | indicative | quoted`, default `assumption`), `provenance_policy_version` (default `material-library-provenance-v1`), plus a unique `product_code` index. Defaults make the migration backfill-free: every existing row becomes an explicitly labelled assumption.
3. Every rendering of authoritative material costs must carry the cost basis: the reconciliation output (`materialCosts.basis`), the issued PDF, the DOCX brief budget table, and the client MQI summary. Basis labels are computed from row `source_type` values ("MIYAR assumption", "Mixed (MIYAR assumption + observed)", or "Observed market data") and must avoid the wording the public-claims contract forbids ("verified", "live").
4. Deterministic engines must not invent prices. The MQI first-row-in-category fallback is removed; an allocation without a resolvable priced library row is counted and surfaced as unpriced, matching report reconciliation's semantics.
5. Tier and finish classification is deterministic through `server/engines/tier-policy.ts` (`material-tier-policy-v1`). The v1 thresholds and maps are copied unchanged from the previously ungoverned in-line code. LLM-suggested `finishLevel` is demoted to metadata (`modelSuggestedFinishLevel`) and never keys a benchmark. Changing any threshold or mapping value requires cost-consultant approval and a new policy version.
6. RFQ `pricingSource` derives only from the quoted rate's own provenance (`source_type === "market_observation"` → `market-verified`); it must never derive from label text. Until observed rows exist, every generated line is `estimated`.
7. Benchmark key disposition: proposals generated before deterministic keying keep `keyPolicyVersion "legacy-v0"` and remain served; new proposals are stamped `benchmark-key-v2`. Administrators supersede legacy keys by re-reviewing v2 proposals; no approved row is deleted or mutated.
8. No new AED seed value may be invented. The empty seed categories (`ceiling`, `joinery`, `fittings`, `lighting`, `hardware`, `specialty`) remain empty until a cost consultant supplies values under `EV-01`; until then those elements surface as unpriced.
9. `libraryTiersForMkt01Tier` v1 preserves the legacy filter behavior (Mid → mid+affordable; all higher tiers → mid only). The proposed richer mapping (Upper-mid → premium+mid; Luxury/Ultra-luxury → ultra+premium) is recorded here as PENDING cost-consultant approval and must not ship without it.

## Consequences

### Positive

- Issued documents stop implying market provenance for hand-typed numbers; the provenance invariant is satisfiable by labelling.
- One versioned policy module owns every tier/finish decision; the LLM boundary matches ADR-0002.
- The scrape→evidence→benchmark path and the authoritative table gain a defined convergence point (`source_type = market_observation`) instead of two permanent parallel truths.

### Negative and trade-offs

- MQI totals drop for projects whose allocations previously borrowed invented fallback prices; unpriced counts make this visible rather than silently wrong.
- Client-facing copy now says "MIYAR assumption" where it previously implied more; this is the honest cost of the interim.

### Risks and mitigations

- Risk: consumers assume `material_library` rows are observations once columns exist. Mitigation: defaults label everything an assumption; only an explicit human write can claim observation.
- Risk: legacy benchmark keys and v2 keys coexist. Mitigation: `keyPolicyVersion` distinguishes eras; admin re-review supersedes.

## Alternatives Considered

### Promote `materials_catalog` to authority

It already carries supplier URL and timestamps, but its categories are mis-derived from pooled evidence, its tiers come from the ungoverned ladder, and rewiring MQI/reconciliation/reports to its shape is a large blast radius for no provenance gain over labelled assumptions. Rejected for the interim; revisited by `EV-03`.

### Merge both tables now

Pre-implements `EV-03` without the approved `EV-01` evidence/price model and its human gates (schema owner, cost consultant, procurement owner). Rejected as out of sequence.

## Verification

- `server/engines/tier-policy.test.ts` pins every v1 boundary value and map.
- Reconciliation/PDF/DOCX/client tests assert the basis label renders and forbidden public-claim substrings are absent.
- RFQ tests assert `pricingSource` derives from provenance and never from label text.
- Disposable-MySQL migration verification applies the checked-in migration chain forward.

## Migration and Rollback

Adopted through additive migration(s) starting at 0056 (provenance columns + unique `product_code`), verified on a disposable MySQL target; shared/production application remains separately human-gated. Rollback drops the added columns/index; original columns and values are untouched. Supersession requires a new ADR (expected from `EV-01`).

## References

- Source-to-output ingestion audit (session artifact `07357419`, 2026-07-23)
- `AGENTS.md` — Product Invariants (provenance, deterministic numerical authority)
- ADR-0002 — Deterministic decision authority
- `server/db/seed-material-library.ts`, `server/engines/design/material-quantity-engine.ts`, `server/engines/report-reconciliation.ts`, `server/engines/pdf-report.ts`, `server/engines/tier-policy.ts`, `server/engines/design/rfq-generator.ts`
