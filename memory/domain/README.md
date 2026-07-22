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

*No verified entries yet.* Seeded structure only — entries are added as work establishes them, with
sources. Do not backfill this file speculatively.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Project:** [[memory/projects/miyar|MIYAR]]
- **Related:** [[memory/glossary|Glossary]], [[memory/research/README|Research Index]]
