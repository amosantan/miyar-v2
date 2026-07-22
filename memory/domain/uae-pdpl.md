---
title: UAE PDPL — Retention and Data-Subject Obligations
description: Federal Decree-Law No. 45/2021 obligations that bear on MIYAR's retention and data-subject workflows.
tags:
  - type/domain
  - domain/regulatory
  - domain/tenancy
  - project/miyar
  - status/active
  - source/web
type: domain
updated: 2026-07-22
---

# UAE PDPL — Retention and Data-Subject Obligations

> Directly governs `SC-06` (implement UAE PDPL retention and data-subject workflows). Also constrains
> what `memory/` itself may contain.

### Instrument and effective date

- **Fact:** Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data. Effective 2 January 2022.
- **Applies to:** UAE federal.
- **Source:** <https://uaelegislation.gov.ae/en/legislations/1972/download> (primary) ·
  <https://securiti.ai/uae-personal-data-protection-law/>
- **Verified:** 2026-07-22
- **Confidence:** high
- **Affects:** `SC-06`

### Data-subject rights the platform must support

- **Fact:** Data subjects have rights to **portability** (structured, machine-readable format, where
  processing rests on consent or contractual necessity or is automated), **rectification** of inaccurate
  data, **erasure**, and **restriction** of processing.
- **Applies to:** UAE federal.
- **Source:** <https://securiti.ai/uae-personal-data-protection-law/> ·
  <https://www.cookieyes.com/blog/uae-data-protection-law-pdpl/>
- **Verified:** 2026-07-22 (secondary summaries; cross-check against the decree text before implementing)
- **Confidence:** medium–high
- **Affects:** `SC-06` — these four rights are the concrete workflow surface

### Response window

- **Fact:** Controllers must respond to data-subject requests within **30 days**.
- **Applies to:** UAE federal.
- **Source:** <https://securiti.ai/uae-personal-data-protection-law/>
- **Verified:** 2026-07-22 (secondary)
- **Confidence:** medium — confirm against the decree text; this is an SLA that would be built into code
- **Affects:** `SC-06`, `EV-04` (SLA patterns)

### Record of Processing Activities (RoPA)

- **Fact:** Controllers must maintain records covering: what personal data is processed, categories of
  data subjects, purpose, **retention period**, who accesses it, third-party sharing, security measures,
  and whether data leaves the UAE.
- **Applies to:** UAE federal.
- **Source:** <https://securiti.ai/uae-personal-data-protection-law/> ·
  <https://bigid.com/blog/operationalizing-uae-pdpl-compliance-with-bigid/>
- **Verified:** 2026-07-22 (secondary)
- **Confidence:** medium
- **Affects:** `SC-06`. Note the retention-period requirement pairs naturally with MIYAR's existing
  organization-scoped authorization boundary — RoPA is per-controller, and tenant isolation is what makes
  a per-organization answer possible.

---

## Constraint on this repository

PDPL is a reason the anti-drift rule matters operationally: `memory/` is **git-tracked and permanent**.
Personal data written here cannot be erased on request in any meaningful sense, because Git history
retains it. Therefore **no personal data of any data subject may be recorded in `memory/`** — only
Amro's own working preferences, which are his own and stated by him.

---

## Open question for Amro

Does MIYAR currently act as **controller**, **processor**, or both, relative to developer clients' data?
The RoPA and response-window obligations attach differently, and this determines what `SC-06` must build.

---

## Linked notes

- **Index:** [[memory/domain/README|Domain Knowledge]]
- **Related:** [[memory/glossary|Glossary]] (PDPL), `docs/SECURITY.md`
