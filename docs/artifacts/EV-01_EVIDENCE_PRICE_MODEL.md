# EV-01 — Evidence & Price-Observation Model (`EV-01-v1`, APPROVED)

- Prepared: 2026-07-23
- Status: **APPROVED WITH DEFAULTS, 2026-07-23**, by Amro Saleh acting as schema, cost-policy, procurement, and source/licensing owner. All seven §7 rulings resolved to their recommended defaults (see §7). Ratified as **ADR-0011**, which **supersedes ADR-0009**.
- Implementation is EV-02 (separate step, its own human gate for shared-database apply). Any §7 item may still be amended by a new ADR before EV-02 builds on it. Nothing here changes any number — only where numbers are read from.

---

## 1. What EV-01 decides, and what it does not

EV-01 is a **decision**, not code. Its deliverable is this data specification plus a migration decision. It fixes the structural problem EV-00 and EV-01b both ran into but were scoped out of fixing:

> Three overlapping material models hold prices, and none can represent current commercial truth. `material_library` (285 rows, the authoritative cost source for MQI / reconciliation / RFQ / issued PDFs) has **mutable min/max price columns** and **exactly one writer — a seed script**. `evidence_records` (scraped observations, now with EV-01b price class/basis) is a parallel truth that **cannot reach the authoritative table** because the table ingestion *can* write (`materials_catalog`) has **no provenance columns at all**. So observations and assumptions are two permanent parallel truths.

EV-01 does **not** change any number, weight, threshold, or calculation. It defines the shape that lets EV-02 build the tables and EV-03 rewire the engines onto them.

---

## 2. The model: six separated concepts

Today "a material with a price" conflates six different things. The core decision is to separate them so each has one owner and one lifecycle.

| # | Concept | Answers | Mutable? | Who writes it |
|---|---------|---------|----------|---------------|
| 1 | **Product identity** | *What is this thing?* (brand, code, name, dimensions) | Slowly, corrective only | Manual entry, dedup from scrapes/quotes |
| 2 | **Specification** | *What design requirement does it satisfy?* (category, finish level, unit basis, performance ratings) | Versioned | Deterministic policy |
| 3 | **Price observation** | *What price was seen, when, from where, on what terms?* | **Never** (append-only) | Ingestion, quote import, manual |
| 4 | **Supplier quote** | *What did a supplier actually offer this org, valid until when?* | **Never** (append-only; superseded, not edited) | Procurement / quote import |
| 5 | **Governed benchmark** | *What value does MIYAR use in a calculation?* | Versioned, human-approved | Admin approval of proposals |
| 6 | **Assumption** | *What do we use when there is no observed value?* | Versioned, cost-consultant-owned | Cost consultant |

**The read contract (the whole point):** calculation engines — MQI, reconciliation, RFQ, reports — resolve a **specification → a single governed value**. That governed value is *either* a benchmark promoted from observations *or* a clearly-labelled assumption. Engines never read a raw scrape or a raw observation directly. This is what makes observations and assumptions stop being parallel truths: they become two `source_kind`s feeding one resolver.

```
 WRITE / evidence path                          READ / calculation path
 ─────────────────────                          ───────────────────────
 scrape ─┐                                       specification
 quote ──┼─▶ price_observation ─▶ proposal ─┐        │
 manual ─┘                    (P25/P50/P75)  ├─▶ governed_value ─▶ MQI / reconciliation
                                             │    (benchmark OR        / RFQ / issued report
 cost consultant ─▶ assumption ──────────────┘     assumption,
                                                   source_kind-labelled)
```

This directly retires the EV-01b dead-end: `material_library` rows become **assumptions** (source_kind = `assumption`); `evidence_records` become **price_observations**; the resolver reads whichever governed value wins the source ladder (§5).

---

## 3. Proposed entities and fields

Notation: **bold** = new; *italic* = already exists and is reused/renamed; ⚑ = needs an explicit human ruling (listed in §7).

### 3.1 `product` — identity (new)
Immutable identity, price-free, project-free, org-optional (a product can be platform-global or org-private).

- `id`, `brand`, `manufacturer`, `productCode` (natural key, unique per brand), `productName`, `series`
- `canonicalCategory` (the EV enum: floors, walls, ceilings, joinery, lighting, sanitary, kitchen, hardware, ffe, other)
- `nominalDimensions` (json: e.g. `{w:60,h:120,unit:"cm",thickness_mm:9}`), `materialComposition`, `finish`, `styleTags` (json)
- `originCountry`, `discontinued` (bool)
- provenance: `createdVia` (`manual | scrape_dedup | quote_import`), `sourceRegistryId?`, `createdBy?`, timestamps
- Backfill source: dedup of `materials_catalog` + distinct `evidence_records.itemName`.

### 3.2 `specification` — design-relevant classification (new, small)
What a finish-schedule element *requires* and what a benchmark is *keyed on*. A product **satisfies** a specification; a benchmark is **about** a specification.

- `id`, `category`, `finishLevel` (basic…ultra_luxury, from `tier-policy`), `unitBasis` (per_sqm/per_lm/per_piece/per_pack/per_litre — the EV-01b enum), `geography` (⚑ grain: emirate vs UAE)
- optional performance attributes (json): slip rating, PEI, fire rating, VOC — extensible, non-keying
- `specKey` = deterministic `category:finishLevel:unitBasis:geography` (this *is* the benchmark key, unifying today's `category:finish:unit`)

### 3.3 `price_observation` — refinement of `evidence_records`
`evidence_records` is already ~80% this. EV-02 renames/extends rather than replaces; the table stays **append-only** (an observation is a historical fact).

Reused as-is: priceMin/Typical/Max, unit, currencyOriginal, currencyAed, fxRate, fxSource, sourceUrl, publisher, captureDate, reliabilityGrade, confidenceScore, corpusScope, and the EV-01b columns priceClass, priceBasis, packQuantity, vatIncluded, platformProductKey.

Added:
- `productId?` (link to §3.1 once deduped; nullable for spec-level observations)
- `specId` (link to §3.2)
- ⚑ `priceScope` (`supply_only | supply_and_install`) — **critical**: a retail tile listing and a fit-out installed rate are not comparable
- `deliveryIncluded` (bool, nullable — never assumed), `moqValue`/`moqUnit`, `leadTimeDays`
- `wasteBasis` — **out of the price**, recorded for reference; waste is applied by the quantity engine, not baked into the observation (⚑ confirm)
- `observationKind` (`market_listing | official_statistic | consultancy_benchmark | supplier_quote | manual`)

### 3.4 `supplier_quote` — commercial offer (new, org-scoped, confidential by default)
A supplier's actual offer, distinct from a scraped listing. Feeds RFQ comparison (EV-06). One quote yields one or more `price_observation` rows with `observationKind = supplier_quote`.

- `id`, `orgId` (**always org-scoped** — never platform-global), `supplierName`, `contactRef`, `quoteRef`, `receivedAt`, `validUntil`
- `confidentiality` (default `confidential`), inclusions/exclusions (json), alternates (json)
- links to the `price_observation` rows it produced

### 3.5 `governed_benchmark` — the value MIYAR uses (evolves `benchmark_proposals`)
The versioned, human-approved value keyed by `specKey`. Extends today's proposal → approval flow.

- Reused: proposedP25/P50/P75, weightedMean, evidenceCount, sourceDiversity, reliabilityDist, recencyDist, keyPolicyVersion, recommendation, status, and the EV-01b priceClassDist/priceBasisDist
- Added: `specId`, `sourceKind` (`observed | assumption`), `benchmarkVersionId`, `supersedesId?`
- `sourceKind = assumption` rows are the migrated `material_library` values (§3.6).

### 3.6 `assumption` — labelled internal reference (migrated `material_library`)
Not a new table — a **`sourceKind = assumption` governed_benchmark**, so the read path is uniform. Carries EV-00's provenance labels forward: `source_label = "MIYAR assumption"`, `price_confidence = assumption`. Cost-consultant-owned; changing a value is a cost-policy change requiring a new version. Honors ADR-0009 §8: the empty seed categories (ceiling, joinery, fittings, lighting, hardware, specialty) stay empty until a cost consultant supplies values.

---

## 4. The field set to approve (the EV-01 gate list)

| Field | Proposed canonical treatment | Ruling needed? |
|-------|------------------------------|----------------|
| Unit / pack basis | `per_sqm / per_lm / per_piece / per_pack / per_litre / unknown`; `unknown` cannot key a benchmark (EV-01b parser) | Confirm |
| VAT | Store **VAT-exclusive** as canonical; record `vatIncluded` per observation; UAE VAT = 5% | ⚑ Ruling |
| Delivery | Canonical = **ex-delivery**; `deliveryIncluded` flag, never assumed | ⚑ Ruling |
| Supply vs supply+install | `priceScope` enum; retail = supply_only, consultancy rates often installed — **never mixed in one benchmark** | ⚑ Ruling |
| Waste allowance | **Excluded from price**; applied by the quantity engine as a separate factor | ⚑ Confirm |
| MOQ / lead time | Recorded on observation/quote; informational, non-keying | Confirm |
| Capture date | Required; precision recorded (reuses EV-00 confidence policy) | Confirm |
| Validity | On quotes (`validUntil`); a stale quote is excluded from live comparison | Confirm |
| Geography | Benchmark grain — emirate (Dubai/AD/Sharjah) vs UAE | ⚑ Ruling |
| Confidentiality | `public / internal / confidential / restricted`; quotes default `confidential`, never cross-org | Confirm |
| Source ladder | Priority when multiple governed values exist for a spec (§5) | ⚑ Ruling |

---

## 5. Source ladder ⚑ (needs your ruling)

When more than one governed value exists for a `specKey`, which wins? Proposed order, **most authoritative first**:

1. **`supplier_quote`** (org-scoped, current, validUntil not passed) — a real offer to *this* org
2. **`official_statistic`** (DLD/DSC/SCAD, once reachable)
3. **`consultancy_benchmark`** (Stonehaven, Turner & Townsend)
4. **`market_observation` promoted to benchmark** (≥5 obs, ≥2 sources, EV-01b filters)
5. **`retail_listed`-only** — sanity band only, cannot alone publish (EV-01b rule)
6. **`assumption`** — floor of last resort, always labelled

A resolved value always carries its rung, so a report can say *why* a number is what it is. This is a cost-authority decision, hence your ruling.

---

## 6. Licensing & retention rules ⚑

- **Acquisition** stays gated per-source by the BR-06 `termsDecision` (EV-01b). No change.
- **Consultancy content** (Stonehaven/T&T): store **derived statistics only** (a rate for a spec), never verbatim copyrighted tables or PDFs. ⚑ Confirm this is the licensing posture.
- **Retention**: raw observations retained ⚑ *N* years (proposed 3); supplier quotes retained per org until ⚑ superseded or *M* years; confidential quotes never shared cross-org. Retention windows touch UAE PDPL (roadmap SC-06) — ⚑ legal ruling.
- **Immutability**: observations and quotes are append-only; a correction is a new row that supersedes, never an edit.

---

## 7. Rulings (RESOLVED — approved with defaults 2026-07-23)

These are cost-policy, commercial, or legal, so they required an explicit owner ruling. All seven were approved at their recommended default. Any one may be amended by a superseding ADR before EV-02 implements it.

1. **VAT canonical treatment** — **VAT-exclusive canonical**; `vatIncluded` recorded per observation; UAE VAT = 5%.
2. **Price scope** — `supply_only` and `supply_and_install` tracked separately; **never mixed in one benchmark**.
3. **Geography grain** — **emirate-level** benchmarks (Dubai / Abu Dhabi / Sharjah), falling back to UAE when emirate coverage is insufficient.
4. **Source ladder** (§5) — **approved as ordered**: supplier_quote › official_statistic › consultancy_benchmark › market-observation benchmark › retail-only (sanity band only) › assumption.
5. **Retention windows** (§6) — raw observations **3 years**; supplier quotes retained **until superseded**; confidential quotes never shared cross-org. Subject to reconciliation with UAE PDPL under SC-06 (SC-06 may shorten, not silently extend).
6. **Consultancy licensing posture** — **derived statistics only**; never store verbatim copyrighted tables or PDFs from Stonehaven / Turner & Townsend.
7. **Waste** — **excluded from the stored price**; applied by the quantity engine as a separate factor.

---

## 8. Validation — seven representative materials normalize without information loss

The roadmap's "done when": tile, stone, joinery, paint, sanitaryware, lighting, furniture each fit the model losslessly.

| Material | Product | Specification | Price event | Governed value |
|----------|---------|---------------|-------------|----------------|
| **Porcelain floor tile** 60×120 | brand/code/dims | floors · premium · per_sqm · Dubai | retail_listed obs (Tile King) + consultancy rate | benchmark (obs) or assumption |
| **Calacatta marble slab** | brand/code/slab dims | floors · ultra · per_sqm · UAE; `priceScope = supply_and_install` variant | supplier_quote (fabricated+installed) | quote → benchmark |
| **Joinery / wardrobe** (made-to-order) | spec-only product (no SKU) | joinery · premium · per_lm | supplier_quote only (no public listing) | quote; assumption floor |
| **Paint** (Jotun 3.6 L) | brand/code/volume | walls · standard · per_litre **and** derived per_sqm via coverage | retail_listed obs (per_litre) | benchmark per_litre; per_sqm derived by quantity engine |
| **Sanitaryware** (basin mixer) | brand/code | sanitary · premium · per_piece | retail obs + quote | benchmark or assumption |
| **Lighting** (downlight) | brand/code | lighting · standard · per_piece | retail obs; sometimes per-project | benchmark per_piece |
| **Furniture / FF&E** (sofa) | brand/code | ffe · premium · per_piece | retail obs (Homesmiths) | benchmark or assumption |

Two cases the model must handle and does: **made-to-order joinery** has no product SKU and no public listing — it lives as a spec-only product with quote-only pricing and an assumption floor. **Paint** is bought per litre but consumed per m² — stored per_litre, converted by the quantity engine using coverage, never by inventing a per-m² observation.

---

## 9. Migration decision (what EV-02 will do)

**Expand / contract, additive-first — the EV-00/EV-01b precedent.** No destructive change until every consumer has cut over (EV-03).

1. **Expand**: EV-02 creates `product`, `specification`, `supplier_quote`; extends `evidence_records` (→ observation) and `benchmark_proposals` (→ governed_benchmark) with the §3 columns; adds the resolver read-API.
2. **Backfill** (idempotent, reversible): `material_library` → `assumption` governed values (provenance labels preserved); `evidence_records` → observations linked to deduped products; `materials_catalog` → products.
3. **Cut over** (EV-03): MQI, reconciliation, RFQ, reports read the resolver instead of `material_library` directly.
4. **Contract** (post-EV-03): retire the redundant `material_library`/`materials_catalog` price columns once nothing reads them.

Every schema step is a separate additive migration verified on disposable MySQL; shared/production application stays human-gated (a `NEEDS_HUMAN` per EV-02). No number changes in EV-01 or EV-02 — only where numbers are *read from*.

---

## 10. What approving this unblocks

- **EV-02** (implement the schema safely) → **EV-03** (consolidate; this is where `material_library`'s single-writer dead-end is actually fixed) → **EV-04** (coverage/freshness SLA).
- Downstream: EV-06 (RFQ comparison) gets its `supplier_quote` shape; EV-08 (weekly refresh) gets its promotion target; BR-04C (verified materials) unblocks once EV-03/04/05 land.

---

## 11. How to respond

- **"Approve with defaults, rulings: …"** — answer the seven items in §7 and I ratify ADR-0011 and open EV-02.
- **"Redline: …"** — name the entities/fields to change and I revise `EV-01-v1`.
- **"Split the rulings"** — approve the schema-owner parts now; hold the cost-consultant/legal items (VAT, scope, ladder, retention, licensing) for the specialists; EV-02 can start on the settled parts.
