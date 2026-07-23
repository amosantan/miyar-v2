# EV-01 Source Candidate Packet — UAE Material Pricing

- Prepared: 2026-07-23
- Scope requested by the product owner: free/public sources only; material unit prices first, fit-out benchmarks second; recommend only sources that clearly permit automated access.
- Status: **evidence only.** Nothing here is approved for ingestion. Per the `BR-06` precedent, each source still needs a recorded terms/licensing decision before a connector is enabled.

## Why this packet exists

The 2026-07-23 cost-path audit found that MIYAR's authoritative material costs are 285 hand-typed rows now labelled "MIYAR assumption". Replacing those labels with real observations needs sources that actually publish AED prices. An earlier probe of 39 candidates found only one. This packet re-tests that conclusion with two independent methods.

## Method

Two independent verifications, deliberately kept separate so they could disagree:

1. **Direct probe** — each candidate fetched through MIYAR's own `ingestion-robots-v1` gate, then a plain unrendered `GET`, counting only **non-zero** AED/Dhs amounts. Zero-value placeholders (`AED 0.00`) are not evidence and are excluded; an early version of the probe over-counted them, and a second defect flagged ordinary CDN references as bot walls. Both were corrected before the numbers below were produced.
2. **Deep research fan-out** — parallel web research with adversarial verification (25 claims verified, 11 confirmed, 14 refuted), fetching candidates live rather than trusting reputation.

Where the two disagreed, the probe was treated as authoritative for gate/reachability because it exercises the exact policy and fetch path production uses.

## Verified usable sources

All verdicts below are from live fetches on 2026-07-23. "Gate" is MIYAR's real robots verdict, not a generic assessment.

| Source | URL probed | Gate | Real prices | Units | Categories | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Tile King** | `tileking.ae/collections/floor-tiles` | ALLOWED | 60 | 30 | floors, walls | Shopify; **structured JSON endpoint**; `Allow: /` in robots |
| **Danube Home** | `danubehome.com/ae/en/c/tiles-and-bricks` | ALLOWED | 84 | 12 | floors, walls, sanitary, ffe | Server-rendered; also exposes data links |
| **ACE UAE** | `aceuae.com/en/category/paints-supplies/paints` | ALLOWED | 20 | 4 | walls (paint), hardware | Explicit `Allow: /en/category/`, `/en/products/` |
| **Fepy** | `fepy.com/sanitary-ware-supplies` | ALLOWED | 41 | 1 | sanitary | ~567 items; React SSR, no JS needed |
| **Graniti UAE** | `granitiuae.com` | ALLOWED | 391 | 1 | floors (stone/tile) | Already a live connector |
| **RAK Ceramics shop** | `onlineshop.rakceramics.com/ae_en/tiles.html` | ALLOWED | see note | — | floors, walls | Magento `data-price-amount` attributes; the probe's currency-prefix regex cannot see them, research counted 24 |

**None of these requires a JavaScript rendering proxy** — every one serves prices in server-side HTML. That materially lowers running cost, since the native fetch path suffices.

### Correction to a research caveat

The research flagged that Danube, Fepy and RAK are permitted only by RFC 9309 *default-allow* and "would fail a literal-Allow parser". **That does not apply to MIYAR.** Our gate accepts a target when `isAllowed(...) === true`, which the parser returns when no `Disallow` matches. All were verified ALLOWED against the real policy.

## Recommended first build: Tile King

The strongest candidate by a wide margin, because it is the only one offering structured access:

- Endpoint: `https://www.tileking.ae/collections/<collection>/products.json?limit=250&page=N`
- Verified live: HTTP 200, `application/json`, 250 products returned, **250/250 variants priced**, range **AED 39.00–2,228.00**, median **AED 221.40** — correct magnitude for tiles, not placeholders.
- Per-product fields: `title`, `product_type`, `vendor`, `tags`, `published_at`, `updated_at`. Per-variant: `sku`, `price`, `updated_at`.
- `published_at`/`updated_at` give a genuine observation date, which the confidence policy needs and HTML scraping rarely provides.
- `product_type` (e.g. "Decorative Tiles") gives a real category signal instead of relying on model classification.
- A sitemap index is available for discovery.

**Open question before building:** whether the listed price is per piece, per box, or per m². Titles carry dimensions (e.g. "15x15 cm, 8 mm"), so a per-m² rate is derivable, but the unit basis must be confirmed — a wrong unit corrupts every downstream benchmark. Treat the research's "explicit AED/sqm" claim as unconfirmed; it passed only 2-1.

## Category coverage and gaps

- **Covered:** floors (Tile King, Graniti, Danube, RAK), walls (ACE paint, Danube, RAK), sanitary (Fepy, Danube), FF&E (Danube), hardware (ACE, partially).
- **Not covered by any verified source:** **ceilings, joinery, kitchen** — and these are exactly three of the six `material_library` categories that currently hold no seed prices at all. Scraping alone will not close them.

## Government open data — negative result

No official per-item AED price source was confirmed in this pass:

- **Dubai Pulse** (`dubaipulse.gov.ae`) — unreachable through the gate (`ROBOTS_UNAVAILABLE`); the portal has migrated to `data.dubai`, whose robots is allow-all with a 53-child sitemap index, but the Construction Cost Index dataset slug was not retrievable.
- **SCAD (Abu Dhabi)** — unresolved rather than eliminated. Every negative claim about it was itself refuted during verification, so it warrants a dedicated follow-up rather than a conclusion.
- **DSC, Dubai Municipality, u.ae, bayanat.ae** — reachable, but no prices or dataset links on the pages probed.
- **FCSC** — HTTP 403.

The two Dubai Pulse connectors currently in the registry point at the retired domain, which explains their production failures.

## Fit-out cost benchmarks — negative result

No free consultancy fit-out cost benchmark was verified as extractable. The consultancy research pages in the registry (RICS, Savills, CBRE, Knight Frank, JLL) either 404 or publish narrative reports without machine-readable rates. Cost-band validation should not be planned around these.

## Dead ends — do not re-attempt

Verified unusable, with the reason, so this is not re-litigated:

- **Bot-walled / refused:** `hafele.ae` (403), `acehardware.ae` (robots unreachable), `homecentre.com`, `geberit.ae`, `tradeling.com`, `sharafdg.com`.
- **No prices published:** `ikea.com/ae`, `jysk.ae`, `nationalpaintsgroup.com`, `cosentino.com`, `blum.com`, `hettich.com`, `jotun.com`, `carrefouruae.com`, `rakceramics.com` (the corporate site — the *shop* subdomain does have prices).
- **Broken URLs in the current registry:** `rakceramics.com/ae/`, `jotun.com/ae/en/`, `hettich.com/en_AE/` all 404.

## Registry repairs indicated

1. `hafele-uae` — the EV-00 "repair" to `hafele.ae/en/` is itself a 404, and the base domain is bot-walled. **Deactivate rather than repair.**
2. `rak-ceramics-uae` — repoint from the corporate site to `onlineshop.rakceramics.com`, which actually carries prices.
3. `dubai-pulse-materials` and `dld-transactions` — repoint from the retired `dubaipulse.gov.ae` to `data.dubai` once the dataset slugs are confirmed.

## Suggested build order

1. **Tile King** — structured JSON, dated records, real category signal, explicit robots allow. Highest value, lowest maintenance.
2. **Danube Home** — broadest category span (floors, walls, sanitary, FF&E) and the highest price count observed.
3. **Fepy** — closes `sanitary` with roughly 567 items.
4. **ACE UAE** — closes `walls` (paint) and contributes `hardware`; robots grants explicit path allows.
5. **RAK Ceramics shop** — confirm the Magento attribute extraction first, then add for `floors`/`walls`.

Graniti already runs and needs no work beyond the category fix already merged.

## Human decisions still required

- Per-source terms/licensing acceptance, following the `BR-06` process. Robots permission is a technical signal, not a commercial licence.
- Confirmation of Tile King's price unit basis before any of its data influences a benchmark.
- Whether `ceilings`, `joinery` and `kitchen` should be sourced by supplier quote rather than scraping, given no public source covers them.
