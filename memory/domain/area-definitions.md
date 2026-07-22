---
title: UAE Area Definitions — GFA, BUA, NFA
description: What the area terms mean in Dubai practice and why the distinction is load-bearing for MIYAR's quantities and costs.
tags:
  - type/domain
  - domain/regulatory
  - domain/materials
  - project/miyar
  - status/unverified
  - source/web
type: domain
updated: 2026-07-22
---

# UAE Area Definitions — GFA, BUA, NFA

> **Why this matters more than it looks.** MIYAR derives space programmes, material quantities, and
> costs from areas. If the platform and a client mean different things by "area", every downstream number
> is wrong while looking perfectly defensible. This is a definitional risk, not a calculation risk.

> ⚠️ **`status/unverified`.** The entries below come from secondary sources (property-market
> commentary), not from Dubai Municipality's own regulation text. They are directionally useful for
> orientation and **must not** be treated as authority for a calculation until confirmed against the
> primary source. Recorded this way deliberately — an unsourced assumption is worse than a gap.

### GFA — Gross Floor Area

- **Fact:** Sum of gross floor areas of all storeys, measured from exterior walls (or centre lines of
  shared walls). Typically includes enclosed habitable space, corridors, internal service zones and
  enclosed common areas; typically excludes open terraces and uncovered balconies. Defined by Dubai
  Municipality and used with plot ratios to determine maximum permitted construction and building
  approvals.
- **Applies to:** Dubai; villas and apartments alike.
- **Source:** <https://springfieldproperties.ae/blog/bua-gfa-nfa-explained-whats-the-key-difference/> ·
  <https://skylark.ae/understanding-gfa-villa-plot-owners-duba/>
- **Verified:** 2026-07-22 (secondary sources only)
- **Confidence:** **low–medium** — the *concept* is reliable; the precise inclusion/exclusion list is not
- **Affects:** `DI-01` (room, geometry and measurement foundation), MQI surface areas

### BUA vs GFA vs NFA

- **Fact:** These are not interchangeable. BUA (Built-Up Area) is the broader marketing/sales measure;
  GFA is the narrower regulatory measure and excludes certain non-habitable areas; NFA (Net Floor Area)
  is narrower still. FAR (Floor Area Ratio) is a *ratio*, not an area — it is often conflated with GFA
  in conversation.
- **Applies to:** Dubai.
- **Source:** <https://www.drivenproperties.com/blog/bua-vs-gfa-in-dubai-real-estate> ·
  <https://www.drivenproperties.com/blog/floor-area-ratio-far-dubai-guide>
- **Verified:** 2026-07-22 (secondary sources only)
- **Confidence:** medium
- **Affects:** `DI-01`, MQI, any client-facing area figure

### Per-community variation

- **Fact:** GFA limits vary by community, driven by zoning and master-plan rules rather than a single
  city-wide number.
- **Applies to:** Dubai.
- **Source:** <https://skylark.ae/understanding-gfa-villa-plot-owners-duba/>
- **Verified:** 2026-07-22 (secondary source)
- **Confidence:** medium
- **Affects:** typology packs (`BR-05`, `BR-06`) — a pack asserting a single GFA rule across Dubai would
  be wrong

---

## What to do before relying on this

1. Obtain the Dubai Municipality area-calculation standard as a **primary** document.
2. Confirm which measure MIYAR's engines actually consume today (read the code — do not assume).
3. Confirm which measure appears on client-facing outputs, and whether the two agree.

Until then, treat every entry here as orientation, and keep this note tagged `status/unverified`.

---

## Open question for Amro

Which area basis does MIYAR treat as authoritative for quantities and cost — GFA, BUA, or NFA — and is
that the same basis your clients use when they challenge a number?

---

## Linked notes

- **Index:** [[memory/domain/README|Domain Knowledge]]
- **Related:** [[memory/glossary|Glossary]] (GFA, BOQ, MQI)
