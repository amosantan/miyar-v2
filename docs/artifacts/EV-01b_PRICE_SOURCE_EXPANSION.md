# EV-01b — Structured price sources, registry repair, and a truthful benchmark population

- Prepared: 2026-07-23
- Supersedes nothing. Extends `EV-01_SOURCE_CANDIDATE_PACKET.md` (PR #44) and **corrects two of its conclusions**.
- Status: implementation landed behind human gates. **No source acquires anything** until a BR-06 terms decision is recorded per source.

## Why this exists

`EV-01_SOURCE_CANDIDATE_PACKET.md` established that six UAE sources publish live AED prices, correcting an earlier "only 1 of 39 works" conclusion. Following that up produced three findings that changed what the work should be, plus two corrections to the packet itself.

## 1. The bottleneck was the pipeline, not source availability

Arithmetic from the code as it stood:

- `BaseSourceConnector.fetch()` fetches **exactly one URL** — `this.sourceUrl` — with no pagination (`server/engines/ingestion/connector.ts`).
- The shared extraction prompt caps output at **15 items** (`server/engines/ingestion/connectors/index.ts`).
- So a source yields roughly **15 evidence rows per weekly run**.
- `generateBenchmarkProposals` needs **≥5 records and ≥2 distinct sources** per `category:finish:unit` group.

Adding more LLM-scraped sources cannot close that gap at a useful rate. One structured endpoint can: Tile King's `products.json` returns 250 priced variants in a single request, and The Hardware Stop's Store API reports **5,234** priced products.

This is why the first build is a deterministic platform connector family rather than more connectors of the existing kind — and it also removes the LLM from the numeric path, which `AGENTS.md` requires regardless.

## 2. `material_library` has exactly one writer — and it is a seed script

`server/db/seed-material-library.ts` holds the only `insert(materialLibrary)` in the repository. Ingested evidence flows to `materials_catalog` through `syncEvidenceToMaterials`, and **`materials_catalog` has no provenance columns at all** — no source type, source URL, observation date, or confidence.

So the table ingestion can write cannot carry provenance, and the table that carries provenance (post EV-00) cannot receive ingestion. EV-00's provenance work cannot be extended by ingestion as currently wired.

**This packet does not fix that.** It is EV-03's scope (*Consolidate material identity and calculation inputs*). It is recorded here so the gap is not rediscovered a third time.

## 3. Four defects in the benchmark population

All four are fixed in this change; all four were live.

| Defect | Effect |
| --- | --- |
| `orchestrator.ts` hard-defaulted `intelligenceType` to `"material_price"` for every static connector, which never set it | Bayut and PropertyFinder **property listings**, Emaar/DAMAC/Nakheel/Aldar **brochures**, and CBRE/JLL/Knight Frank/Savills **research** were all labelled material prices and pooled into material-price percentiles |
| `generateBenchmarkProposals` passed only `category` to `listEvidenceRecords`, which had no `intelligenceType` filter | Same population leak, at the consuming end |
| No corpus or confidentiality filter in the proposal path | Organization-scoped and confidential evidence could key a **global** benchmark |
| The >10M AED sanity bound existed only in `evidence-to-materials.ts` | The proposal path had **no price bound at all** |

**Open item for the cost consultant:** the inherited 10,000,000 AED ceiling is very loose for a material *unit* price — a AED 4.2m Dubai apartment listing passes it. Tightening it is a decision-threshold change and therefore gated, so this change keeps the inherited number and records the real behaviour in a test (`proposal-generator.test.ts`, "documents that the inherited ceiling does NOT catch a typical property listing") rather than asserting a limit the code does not enforce.

## Corrections to the EV-01 packet

### Dubai Pulse is not retired — its TLS certificate expired

The packet recorded Dubai Pulse as `ROBOTS_UNAVAILABLE`, concluded the portal "has migrated to `data.dubai`", and recommended repointing both connectors there.

Verified 2026-07-23:

```
www.dubaipulse.gov.ae → 91.73.143.12          (resolves)
TLS 1.2, ECDHE-RSA-AES128-SHA256               (negotiates)
subject=C=AE, L=Dubai, O=Government of Dubai, CN=dubaipulse.gov.ae
issuer=C=US, O=DigiCert Inc, ...
Verify return code: 10 (certificate has expired)
```

And the proposed replacement does not exist:

```
data.dubai.gov.ae   → does not resolve
www.data.gov.ae     → does not resolve
```

The site is up; the certificate is expired. The recommended repair would have pointed two Grade-A connectors at a non-existent host. Both rows are now **deactivated with the real diagnosis recorded**, keeping their URLs, and a `registry-consistency.test.ts` case asserts the note says *certificate* and not *migration*. Certificate verification is not relaxed — that would be the other tempting wrong fix.

### Free fit-out cost benchmarks do exist

The packet recorded "No free consultancy fit-out cost benchmark was verified as extractable." Two were verified live on 2026-07-23:

- **Stonehaven** (`stonehaven.ae`, RICS-regulated) — `robots: Allow: /`; `/cost-index` HTTP 200 (weekly GCC index with AED material prices); `UAE_Benchmark_Report_2025.pdf` HTTP 200, 1,680,582 bytes. A PDF connector path already exists (`SCADPdfConnector`).
- **Turner & Townsend UAE Market Intelligence 2025** — free HTML with AED/m² by asset type, Dubai and Abu Dhabi split (5-star hotel 10,500; high-rise residential 5,500; A-grade CBD office 6,200).

**Caveat that must survive into any use of the T&T figures:** they are total construction costs whose fit-out and MEP inclusions are not stated. They are not a fit-out rate without a stated basis.

## Newly verified sources

| Source | Access | Evidence (2026-07-23) | Class / grade |
| --- | --- | --- | --- |
| **The Hardware Stop** `thehardwarestop.com` | WooCommerce Store API | HTTP 200 JSON, `x-wp-total: 5234`, AED in minor units with explicit `currency_minor_unit: 2`, 100+ categories (Paints 3,546 · Home Hardware 417 · Fasteners/Fixings 358 · Electrical & Lighting 168 · Building & Construction 160 · Plumbing & Sanitary 63 · Sheets & Boards 41). robots disallows only `/wp-admin/`, `/cart/`, `/checkout/` for a generic agent | `retail_listed` / C |
| **Homesmiths** `homesmiths.ae` | Shopify `products.json` | HTTP 200 `application/json`, AED prices, `updated_at` present. `product_type` empty → weak category signal. Homeware/FF&E | `retail_listed` / C |
| **Stonehaven** `stonehaven.ae` | HTML + free PDF | See above | `consultancy_benchmark` / B |
| **Turner & Townsend** `marketintelligence.turnerandtownsend.com` | Free HTML | See above | `consultancy_benchmark` / B |

Plus the six from PR #44. **Tile King re-verified**: `products.json` returns priced variants with `sku`, `product_type`, `published_at`, `updated_at`.

The Hardware Stop is the largest verified structured AED catalogue found, and the only source reaching **hardware, fixings, and boards**.

### Still uncovered

**ceilings** and **kitchen** are covered by no verified public source. The Hardware Stop's *Sheets & Boards* partially reaches joinery. These remain a supplier-quote problem, not a scraping problem — the EV-01 packet's conclusion stands.

## What was built

1. **Migrations 0059 / 0060** — additive only. `source_registry` gains `platform`, `termsDecision`, `priceClass`; `evidence_records` gains `priceClass`, `priceBasis`, `packQuantity`, `vatIncluded`, `platformProductKey`, `priceBasisPolicyVersion`, plus a unique `(sourceRegistryId, platformProductKey)`; `benchmark_proposals` gains `priceClassDist`, `priceBasisDist`. Every default leaves existing rows **truthful** (`pending`, `unknown`, null), following the ADR-0009 precedent. This is deliberately a narrow slice and does **not** pre-empt the EV-01 price-observation model.

2. **Deterministic platform connectors** (`server/engines/ingestion/connectors/platform/`) — Shopify `products.json`, WooCommerce Store API, Magento `data-price-amount`. No LLM on the numeric path. Enforced in the family base class so no future family can skip them:
   - **Terms gate** before any network call — an un-decided source issues *zero* requests, and this is asserted on a mocked fetch.
   - **Robots gate before every page**, not just the first, evaluated for the exact user agent sent.
   - Bounded pagination: page budget, item budget, per-request timeout, whole-run wall clock, and a `log`ged warning whenever a bounded read truncates (silent truncation reads as complete coverage).

3. **Price-basis parser** (`platform/basis.ts`, `price-basis-policy-v1`) — resolves only a basis the listing actually states. A title carrying dimensions alone (`"7.5x30 cm, 8 mm"`) returns `unknown`, and `unknown` cannot key a published benchmark. This generalises the packet's open Tile King question instead of answering it per-source.

4. **Registry repairs** — `hafele-uae` deactivated (the EV-00 repair to `/en/` is itself a 404 and the base domain 403s); `rak-ceramics-uae` repointed to the shop subdomain in both registries; Dubai Pulse and DLD deactivated with the certificate diagnosis.

5. **Benchmark population fixes** — the four defects above, plus the retail rule.

## The retail rule

Consumer retail listings are admitted at reliability **C**, labelled `retail_listed`. They populate observations and sanity bands, but a group composed **entirely** of retail-listed evidence is rejected with `Retail-only price class — requires a second price class`. A published benchmark needs a trade quote, an official statistic, or a consultancy benchmark alongside it.

Because these filters change the *population*, they change proposed values — which is why nothing auto-publishes. Proposals remain admin-approved, and the EV-00 cost-consultant gate still applies.

## Verification

| Gate | Result |
| --- | --- |
| `tsc --noEmit` | PASS |
| `DATABASE_URL='' vitest run` | **1,646 passed, 22 skipped, 0 failed** (123 files) |
| Guarded MySQL suite | **9 files / 46 tests PASS**, TR03H evidence regenerated |
| Migrations 0059/0060 on real MySQL | Applied by `drizzle-kit migrate` within the guarded run |
| `audit:authorization` | PASS — 389 procedures, 0 remediation rows |
| `audit:database-safety` | PASS — 123 entrypoints, 2 allowlisted, 0 findings |
| `build` + bundle budgets | PASS; `api/index.js` regenerated |
| `certify:workflow` | **PASS** |

New behavioural coverage: 24 basis-parser cases, 31 platform-connector cases (gates, budgets, currency decoding, pagination, category mapping), 8 intelligence-type cases, 6 benchmark-population cases, 7 registry-state cases.

### One environment note worth keeping

`tsconfig.json` sets `tsBuildInfoFile: "./node_modules/typescript/tsbuildinfo"`. Running `pnpm check` in a **git worktree** — which has no `node_modules` of its own — creates a stub `node_modules/typescript/` directory that then **shadows the real package** for Node's resolution, breaking any test that spawns a script importing `typescript` (`server/routers/design.contract.test.ts` fails with `ERR_MODULE_NOT_FOUND`). Deleting the stub directory restores it. This is a worktree footgun, not a code defect, and it is not caused by any change in this packet.

## Human decisions still required

1. **Per-source terms/licensing decision** for all ten sources, via the BR-06 process. `termsDecision` stays `pending` and every new row is seeded **inactive**; the seeder deliberately never writes `approved` and never overwrites the column on re-run, so a recorded human decision cannot be silently reverted.
2. **Cost-consultant approval** before any benchmark generated under the new population filters is published, and before any value reaches `material_library`.
3. **The material price ceiling** — whether 10,000,000 AED should be tightened, and to what, per unit basis.
4. **Tile King's price unit basis** — per piece, per box, or per m². Until resolved the parser reports `unknown` and the data cannot key a benchmark, which is the safe state but not a permanent one.
5. **`ceilings` and `kitchen`** — whether to source by supplier quote, given no public source covers them.
6. **Shared/production migration apply**, and commit/push/PR/merge/deploy per repository policy.
