---
title: Domain Knowledge Index — UAE Market and Regulation
description: Canonical home for durable UAE market, regulatory, and cost knowledge learned while building MIYAR.
tags:
  - type/domain
  - domain/regulatory
  - domain/market
  - project/miyar
  - status/active
type: index
updated: 2026-07-22
---

# Domain Knowledge — UAE Market and Regulation

> **This folder is canonical.** Durable knowledge *about the UAE market and its regulators* has no other
> home in the repository. Code and specs describe how MIYAR models the domain; this folder records what we
> have learned about the domain itself.

## What belongs here

- Regulator structure, remit, and which body governs which emirate.
- Durable market facts and where they can be sourced.
- Cost and benchmark conventions that keep recurring across projects.
- Interpretation of a rule that took real effort to establish, with its source.

## What does **not** belong here

- Anything numerical that feeds a calculation. Deterministic TypeScript owns that — a number copied here
  will drift and then contradict the engine.
- Live prices, indices, or counts. Record **where to source them** and the freshness rule instead.
- Anything already asserted by `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, or a typology pack. Link to it.

## Entry format

```markdown
### <Topic>
- **Fact:**
- **Applies to:** emirate / typology / discipline
- **Source:** URL, document, or regulator reference (required)
- **Verified:** YYYY-MM-DD
- **Confidence:** high | medium | low
- **Affects:** which roadmap family or engine cares
```

An entry without a source is an assumption and must be tagged `status/unverified` and labelled as such.
This mirrors the provenance invariant in `AGENTS.md`.

## Regulator orientation

Baseline only — established from repository usage, and expanded as work proves specifics.

| Body | Emirate | Remit in MIYAR's context |
| --- | --- | --- |
| **DLD** — Dubai Land Department | Dubai | Land registry and the governed market-data pipeline (`EV-05`) |
| **RERA** — Real Estate Regulatory Agency | Dubai | Regulatory arm operating under DLD |
| **SREC** — Sharjah Real Estate Registration Department | Sharjah | Sharjah registration and regulation |
| **PDPL** — Federal Decree-Law No. 45/2021 | Federal | Personal data protection; retention and data-subject workflows (`SC-06`) |

DLD is by far the most referenced external authority in this repository, which is why its pipeline has a
dedicated governed roadmap step rather than being treated as an ordinary connector.

## Recorded knowledge

| Note | Covers | Confidence | Affects |
| --- | --- | --- | --- |
| [[memory/domain/dld-market-data\|DLD Market Data]] | Dubai Pulse open data, DLD API Gateway, resellers | medium | `EV-05`, `EV-04` |
| [[memory/domain/sharjah-srec\|Sharjah SREC/SRERD]] | Resolution 37/2024, escrow, progress-linked payments | medium–high | `BR-06`, typology packs |
| [[memory/domain/uae-pdpl\|UAE PDPL]] | Data-subject rights, 30-day window, RoPA | medium–high | `SC-06` |
| [[memory/domain/area-definitions\|Area Definitions]] | GFA vs BUA vs NFA vs FAR | **low–medium** ⚠️ | `DI-01`, MQI |

**Read the confidence column before using any of this.** Everything above was seeded on 2026-07-22 from
public sources, and most of it rests on credible *secondary* commentary rather than the regulator's own
text. Area definitions in particular are tagged `status/unverified` and must not back a calculation until
confirmed against Dubai Municipality's primary standard.

### Still needed — first-hand knowledge no public source can supply

Each note ends with an "Open questions" section. The recurring themes:

1. Which DLD channel is MIYAR's **approved** source of record, and is a reseller acceptable as primary?
2. Which area basis (GFA / BUA / NFA) is authoritative for MIYAR's quantities and costs?
3. Is MIYAR controller, processor, or both, under PDPL?
4. Does Sharjah need parity now — and what does SANZEN use for Sharjah benchmarks today, given no public
   transaction feed was found?

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Project:** [[memory/projects/miyar|MIYAR]]
- **Related:** [[memory/glossary|Glossary]], [[memory/research/README|Research Index]]
