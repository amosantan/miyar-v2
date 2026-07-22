---
title: DLD Market Data — Sources and Access
description: Where Dubai Land Department transaction and rental data actually comes from, and what governs its use in MIYAR.
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

# DLD Market Data — Sources and Access

> Relevant to `EV-05` (govern the DLD market-data pipeline) and to every provenance claim that rests on
> transaction evidence. DLD is the most-referenced external authority in this repository.

### Dubai Pulse open data — the primary public channel

- **Fact:** DLD publishes a `dld_transactions-open` dataset covering all types of real estate
  transactions through the Dubai Pulse government open-data portal. It is refreshed periodically
  (observed update: 2026-02-03).
- **Applies to:** Dubai; all typologies.
- **Source:** <https://www.dubaipulse.gov.ae/data/dld-transactions/dld_transactions-open> ·
  <https://dubailand.gov.ae/en/open-data/>
- **Verified:** 2026-07-22 (search result metadata; dataset not yet fetched and schema not yet inspected)
- **Confidence:** medium — existence high, refresh cadence unconfirmed
- **Affects:** `EV-05`, `EV-04` (freshness/coverage SLA)

### DLD API Gateway — the integration channel

- **Fact:** DLD operates an API Gateway exposing integrations with Ejari (leasing), Mollak (service
  charges) and Trakheesi (advertising/listing permits). Trakheesi includes a Listing Validation API and
  a Delisting API. A rental index API provides rental price data.
- **Applies to:** Dubai.
- **Source:** <https://dubailand.gov.ae/en/eservices/api-gateway/>
- **Verified:** 2026-07-22
- **Confidence:** medium — endpoint list and access terms not yet confirmed against DLD directly
- **Affects:** `EV-05`, ingestion connectors

### Third-party resellers exist — treat with care

- **Fact:** Commercial APIs (e.g. BayutAPI) resell DLD-registered sale and rental transactions as JSON
  without requiring DLD business registration.
- **Applies to:** Dubai.
- **Source:** <https://bayutapi.dev/blog/dubai-land-department-dld-data-api>
- **Verified:** 2026-07-22
- **Confidence:** medium
- **Affects:** `EV-05` source-policy decision
- **⚠️ Governance note:** a reseller is **not** a primary source. Under the provenance invariant in
  `AGENTS.md`, any benchmark derived from a reseller must record the reseller *and* the underlying DLD
  origin, or be labelled an assumption. This is precisely the kind of source-policy decision `BR-06`
  is gated on.

---

## Open questions for Amro

These cannot be answered from public sources and are exactly the `NEEDS_HUMAN` gate on `BR-06`:

1. Which DLD channel is MIYAR's **approved** source of record — Dubai Pulse open data, the official API
   Gateway, or a commercial reseller?
2. Is a reseller acceptable as a primary source, or only as corroboration?
3. What refresh cadence does the business consider "fresh enough" for a client-facing benchmark?

---

## Linked notes

- **Index:** [[memory/domain/README|Domain Knowledge]]
- **Related:** [[memory/glossary|Glossary]], [[memory/projects/miyar|MIYAR]]
