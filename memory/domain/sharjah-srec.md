---
title: Sharjah Real Estate Regulation — SREC / SRERD
description: Sharjah's development, escrow, and off-plan framework, and how it diverges from Dubai's.
tags:
  - type/domain
  - domain/regulatory
  - domain/market
  - project/miyar
  - status/active
  - source/web
type: domain
updated: 2026-07-22
---

# Sharjah Real Estate Regulation — SREC / SRERD

> **The load-bearing point:** Sharjah is a **separate regulatory regime**, not a Dubai variant. Any
> typology pack, benchmark, or compliance claim that silently assumes Dubai rules will be wrong in
> Sharjah. This is a correctness issue for `BR-05` / `BR-06`, not a nicety.

### Governing instrument

- **Fact:** Executive Council Resolution No. (37) of 2024 is the most recent comprehensive framework
  regulating real estate development in Sharjah. The Sharjah Real Estate Registration Department
  (SRERD, also referenced as SREC) holds expanded regulatory functions.
- **Applies to:** Sharjah.
- **Source:** <https://www.tamimi.com/law-update-articles/real-estate-development-in-the-emirate-of-sharjah/> ·
  <https://www.tamimi.com/news/sharjah-enacts-new-laws-and-resolutions-aimed-at-enhancing-the-real-estate-sector/>
- **Verified:** 2026-07-22 (law-firm commentary — credible secondary; obtain the Resolution text before
  asserting specifics)
- **Confidence:** medium–high
- **Affects:** `BR-06` and any Sharjah typology pack

### Escrow is mandatory, per project

- **Fact:** Articles 6–8 require developers to open a dedicated **escrow account for each project**,
  governed by an escrow agreement with a department-approved financial trustee. Funds may be used solely
  for that project's development.
- **Applies to:** Sharjah; off-plan development.
- **Source:** <https://www.tamimi.com/law-update-articles/real-estate-development-in-the-emirate-of-sharjah/>
- **Verified:** 2026-07-22 (secondary)
- **Confidence:** medium–high
- **Affects:** any MIYAR output touching developer cashflow or feasibility in Sharjah

### Payments track certified construction progress

- **Fact:** Off-plan purchaser payments must be **proportional to construction progress**, with valuation
  linked to progress certified by licensed engineering consultants — explicitly to prevent overvaluation
  and ensure proportional disbursement.
- **Applies to:** Sharjah; off-plan.
- **Source:** <https://www.tamimi.com/law-update-articles/real-estate-development-in-the-emirate-of-sharjah/> ·
  <https://www.bsalaw.com/insight/sharjahs-real-estate-reform-a-new-era-for-property-investment/>
- **Verified:** 2026-07-22 (secondary)
- **Confidence:** medium
- **Affects:** phasing and cashflow assumptions in any Sharjah feasibility output
- **Design implication:** a payment plan is not a free commercial variable in Sharjah — it is
  constrained by certified progress. A generated plan that ignores this is not merely suboptimal, it is
  non-compliant.

### Developer and project registration is gated

- **Fact:** Stringent registration conditions apply to developers and projects; SRERD regulates developer
  licensing, project registration, marketing and sales. A unified digital registration system for leasing
  and disputes launched December 2024, alongside rent controls.
- **Applies to:** Sharjah.
- **Source:** <https://www.tamimi.com/news/sharjah-enacts-new-laws-and-resolutions-aimed-at-enhancing-the-real-estate-sector/>
- **Verified:** 2026-07-22 (secondary)
- **Confidence:** medium
- **Affects:** `BR-06` source governance

---

## Contrast with Dubai

| | Dubai | Sharjah |
| --- | --- | --- |
| Registry / regulator | DLD, with RERA as regulatory arm | SRERD / SREC |
| Open transaction data | Dubai Pulse open dataset + API Gateway | **No equivalent public feed identified** |
| Off-plan payments | — | Must track **certified** construction progress |

The asymmetry in **data availability** is the practical problem: MIYAR's evidence and provenance
invariants are far easier to satisfy in Dubai than in Sharjah. A Sharjah benchmark may have to be
labelled an assumption where the Dubai equivalent can cite a source. `EV-04`'s insufficiency state is the
right mechanism for that, and it should be exercised rather than worked around.

---

## Open questions for Amro

1. Does MIYAR need Sharjah parity now, or is Dubai the near-term commercial focus?
2. Given no public Sharjah transaction feed was found — what does SANZEN actually use for Sharjah
   benchmarks today? That is first-hand knowledge no public source can supply.

---

## Linked notes

- **Index:** [[memory/domain/README|Domain Knowledge]]
- **Related:** [[memory/domain/dld-market-data|DLD Market Data]], [[memory/glossary|Glossary]]
