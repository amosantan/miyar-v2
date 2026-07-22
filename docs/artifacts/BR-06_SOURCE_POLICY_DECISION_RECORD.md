# BR-06 Source-Policy Decision Record

Status: `AWAITING_HUMAN_DECISION`
Prepared: 2026-07-22
Catalogue observed from: `shared/regulatory-sources.ts` at `origin/main` `c7054c0` — 29 registrations

This is a **blank decision form**, not a decision. Every cell below is unfilled because no
source-policy decision has been made. Nothing in this file approves retrieval, retention,
citation, authenticity, currency, or regulatory meaning, and no authority may be inferred
from its existence. It exists so the decision-maker fills in blanks instead of inventing a
schema, and so each decision maps 1:1 onto a field the code actually reads.

Companion documents: `BR-06_SOURCE_REVIEW_PACKET.md` (evidence gathered so far),
`BR-06_SOURCE_TERMS_RESEARCH_MEMO.md` (published terms read per host — research input only, not
evidence), and `docs/runbooks/regulatory-source-acquisition.md` (what happens once these decisions
land).

Before completing section 2, read the research memo. It records that every official host reserving a
copyright line reserves **all** rights, that the Dubai Legislation Portal explicitly prohibits
redistribution and requires written authorization for commercial use, that the Dubai Civil Defence
`canonicalUrl` for five registrations is dead, and that the DET host refuses automated access.

---

## 1. What each decision controls in code

Three independent decisions per source. All three must be affirmative before the fetcher
will issue a single HTTP request — `assertSourcePolicy` in
`server/engines/ingestion/regulatory-document-fetcher.ts` throws otherwise.

| Decision | Code field | Values | Question being answered |
| --- | --- | --- | --- |
| Terms | `termsStatus` | `approved` / `pending_review` / `denied` | May MIYAR retrieve this document directly from the authority's own host, under that authority's published terms of use? |
| Retention | `retentionPolicy` | `artifact_permitted` / `metadata_only` / `prohibited` / `pending_review` | May MIYAR store the raw bytes, or only the hash, HTTP metadata and derived locators? |
| Licensing | `licensingStatus` | `permitted` / `restricted` / `prohibited` / `pending_review` | May MIYAR cite this internally, to tenants, and in public share views? |

Two independent gates must agree before retention or licensing is effective:
`buildRegisteredRegulatorySource` requires **both** the reviewer's acquisition policy flag
**and** the checked-in catalogue registration to be permissive. A policy checkbox cannot
override a catalogue entry that forbids storage or use.

A fourth field, `coverageStatus`, is a **platform scope decision**, not a legal one: it
records whether MIYAR intends to support the jurisdiction at all. The four
`authority_overlay` rows are deliberately `unsupported` and should stay that way until an
approved overlay exists.

---

## 2. Decision table — 29 sources

Fill `Terms`, `Retention`, `Licensing`, `Decided by`, and `Decided at` (ISO-8601 UTC).
Leave a row untouched to keep it fail-closed. Current state for **every** row is
`pending_review` / `pending_review` / `candidate`.

### Dubai Municipality — building code and permits

| # | Source key | Class | Terms | Retention | Licensing | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `dm.dubai-building-code` | building_code | | | | | |
| 2 | `dm.dbc-calculation-schedules` | building_code | | | | | |
| 3 | `dm.building-regulation-amendments` | amendment_index | | | | | |
| 4 | `dm.building-planning-circulars` | circular_index | | | | | |

### Dubai Civil Defence — fire and life safety

| # | Source key | Class | Terms | Retention | Licensing | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | `dcd.fire-life-safety-code` | fire_life_safety | | | | | |
| 6 | `dcd.active-annexures-index` | amendment_index | | | | | |
| 7 | `dcd.drawing-submission-requirements` | fire_life_safety | | | | | |
| 8 | `dcd.material-requirements` | fire_life_safety | | | | | |
| 9 | `dcd.stakeholder-responsibilities` | fire_life_safety | | | | | |

### Dubai Municipality — accessibility

| # | Source key | Class | Terms | Retention | Licensing | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | `dm.universal-design-code` | accessibility | | | | | |
| 11 | `dm.accessibility-guide` | accessibility | | | | | |
| 12 | `dm.universal-design-villa-guidance` | accessibility | | | | | |

### Dubai Municipality — sustainability

| # | Source key | Class | Terms | Retention | Licensing | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 13 | `dm.al-safat` | sustainability | | | | | |
| 14 | `dm.al-safat-practice-amendments` | amendment_index | | | | | |

### Dubai Municipality — food safety

Layout and operational guidance are deliberately separate source classes. Operational
guidance cannot create a room-area rule; keep the distinction when deciding licensing.

| # | Source key | Class | Terms | Retention | Licensing | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 15 | `dm.food-establishment-layout` | food_layout | | | | | |
| 16 | `dm.food-code` | food_layout | | | | | |
| 17 | `dm.food-activity-requirements` | food_layout | | | | | |
| 18 | `dm.food-kitchen-guidance` | food_operations | | | | | |
| 19 | `dm.food-operations` | food_operations | | | | | |

### Dubai Legislation Portal — hospitality and holiday homes

| # | Source key | Class | Terms | Retention | Licensing | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | `dlp.hotel-establishment-decree-17-2013` | hospitality_legislation | | | | | |
| 21 | `dlp.hotel-classification-resolution-1-2018` | hospitality_legislation | | | | | |
| 22 | `dlp.holiday-home-decree-41-2013` | hospitality_legislation | | | | | |
| 23 | `dlp.holiday-home-resolution-1-2020` | hospitality_legislation | | | | | |
| 24 | `dlp.legislative-currency-index` | amendment_index | | | | | |

Portal appearance or disappearance never establishes repeal. Currency is resolved only
through a recorded relation plus assertions.

### Department of Economy and Tourism — hotel classification

| # | Source key | Class | Terms | Retention | Licensing | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | `det.hotel-classification-current` | hospitality_classification | | | | | |

Both hospitality typology candidates are explicitly blocked until an exact current DET
hotel/hotel-apartment classification document is captured from an authorized official
source. Deciding this row does not unblock them by itself.

### Special authorities — recorded scope only, currently `unsupported`

Do **not** mark these `supported` as part of a source-policy decision. Each needs its own
approved overlay, which is a separate scope decision.

| # | Source key | Jurisdiction | Coverage decision | Decided by | Decided at |
| --- | --- | --- | --- | --- | --- |
| 26 | `dda.authority-overlay` | Dubai Development Authority | | | |
| 27 | `trakhees-pcfc.authority-overlay` | Trakhees/PCFC | | | |
| 28 | `difc.authority-overlay` | DIFC | | | |
| 29 | `dubai-south.authority-overlay` | Dubai South | | | |

---

## 3. Per-version capture record

One block per captured document version. The capture pipeline produces most of these
values mechanically; the decision-maker supplies only edition and effective dates.

```
sourceKey            :
canonicalUrl         :   # exact artifact, not a landing page
versionKey           :
edition              :
publicationDate      :   # YYYY-MM-DD
effectiveFrom        :   # YYYY-MM-DD
effectiveTo          :   # blank if open-ended
contentFingerprint   :   # SHA-256, produced by the fetcher receipt
retrievedAt          :   # produced by the fetcher receipt
httpStatus / mimeType / byteLength / etag / lastModified  : # produced by the receipt
parserVersion        :   # produced by the fetcher receipt
storageReference     :   # only if retention is artifact_permitted; otherwise leave blank
```

## 4. The five source assertions

Recorded per **version**, by a named platform administrator, through
`regulatorySources.assertVersion`. The database stamps the acting user id; do not record
these on someone else's behalf.

| Assertion | What the assertor is attesting |
| --- | --- |
| `document_identity` | These bytes are the document they claim to be — correct instrument, edition, and issuing authority. |
| `authenticity` | The bytes came from the authority's own official host and are unaltered. |
| `temporal_status` | The stated publication and effective interval are correct as at the assertion date. |
| `jurisdiction` | The document governs the jurisdiction and authority scope recorded against it. |
| `permitted_use` | The recorded terms, retention, and licensing decisions cover the intended use. |

Each needs a `reason` of at least 10 characters and a `validFrom`; add `validTo` when the
attestation should expire. A version becomes `asserted` only when all five are current.

## 5. Clause locator record

One row per candidate rule. Extraction may be assisted; **interpretation may not be.**
Every row lands as a candidate for professional review.

| Field | Notes |
| --- | --- |
| `clauseKey` | Stable identifier for the rule |
| `locator` | Exact clause reference, e.g. `cl. 5.2.3` |
| `pageLocator` | Exact page in the captured artifact |
| `candidateSummary` | Plain restatement of what the clause says — no inference |
| `extractionMethod` | `deterministic` / `ai_extracted_candidate` / `human_transcription` |
| `reviewStatus` | Starts `candidate`; only a reviewer moves it |

## 6. Professional release envelope

Four approvals, four distinct named people, none of whom authored the pack. Bound to an
exact pack version and content fingerprint. Matches
`typologyPackV2ReleaseEnvelopeSchema` in `shared/typology-pack-v2.ts`.

```jsonc
{
  "schemaVersion": "typology-pack/v2",
  "packId": "",
  "version": "",              // semver, e.g. 1.0.0
  "contentFingerprint": "",   // 64 hex chars; recomputed and compared at release
  "releaseFingerprint": "",   // binds this exact approval set
  "status": "approved",
  "platformReleaseOwner": "",
  "approvedAt": "",           // must not precede any signature below
  "approvals": [
    { "discipline": "architecture_interiors", "reviewerId": "", "signedAt": "", "expiresAt": "", "decision": "approved" },
    { "discipline": "cost",                   "reviewerId": "", "signedAt": "", "expiresAt": "", "decision": "approved" },
    { "discipline": "compliance",             "reviewerId": "", "signedAt": "", "expiresAt": "", "decision": "approved" },
    { "discipline": "product",                "reviewerId": "", "signedAt": "", "expiresAt": "", "decision": "approved" }
  ]
}
```

Enforced automatically, so a malformed envelope cannot release: exactly four approvals, all
four disciplines present once, reviewer ids mutually distinct, no reviewer equal to
`authoredBy`, no signature after `approvedAt`, no expired signature, and a
`contentFingerprint` that still matches the pack when recomputed.

| Discipline | Approves |
| --- | --- |
| Architecture/interiors | Spatial interpretation, applicability, adjacency, room and responsibility meaning. |
| Cost | Cost and FF&E responsibility implications. |
| Compliance | Regulatory interpretation, jurisdiction, clause precedence, enforcement basis. |
| Product/platform | Release envelope and tenant/public projection behaviour. |

---

## 7. Standing rules

- No authority is inferred from a URL, a successful fetch, an AI extraction, a passing test
  suite, a merged pull request, a tenant administrator, or this document.
- Recording a decision here changes nothing on its own. The catalogue in
  `shared/regulatory-sources.ts` and the acquisition policy are the enforced surfaces.
- Sections 2 → 3 → 4 → 5 → 6 are strictly ordered. Nothing downstream may be recorded
  before the step above it is complete.
- The production registries `CHECKED_IN_TYPOLOGY_PACK_V2_RELEASES` and
  `CHECKED_IN_REGULATORY_SOURCE_AUTHORITIES` stay empty until section 6 is complete for a
  given pack. Populating them is a reviewed code change, not a runtime action.
