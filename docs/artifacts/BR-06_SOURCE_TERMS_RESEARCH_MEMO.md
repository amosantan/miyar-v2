# BR-06 Source Terms Research Memo

Status: `RESEARCH_INPUT_ONLY`
Observed: 2026-07-22
Method: ordinary web reads of publicly reachable official pages, performed **outside** the governed regulatory acquisition path.

## What this document is not

This is **not** a capture, **not** evidence, and **not** an approval. It was gathered with a general
web tool at the owner's explicit direction, so it carries none of the guarantees the governed
fetcher provides: no host-pinned direct retrieval, no robots check, no byte fingerprint, no
retrieval receipt, no parser version, no authenticity or currency assertion.

Nothing here may be copied into `regulatory_source_captures`, `regulatory_source_versions`, or any
assertion. It may **only** inform a human filling in section 2 of
`BR-06_SOURCE_POLICY_DECISION_RECORD.md`. Any document MIYAR actually relies on must be re-acquired
through `createDubaiRegulatoryDocumentFetcher` after the policy decision, per
`docs/runbooks/regulatory-source-acquisition.md`.

Quoted text is short and attributed, for the purpose of assessing permitted use.

---

## 1. Findings by official host

The catalogue's 29 registrations span 8 hosts. Terms of use are published per site, not per
document, so the host is the meaningful unit for a licensing decision.

| Host | Sources | Copyright line | Stated reuse position |
| --- | --- | --- | --- |
| `www.dm.gov.ae` | 14 | "Copyright © 2026 Dubai Municipality, all rights reserved"; "(Copyrights belong to the Government of Dubai – All Rights Reserved)" | All rights reserved; no explicit grant found |
| `www.dcd.gov.ae` | 5 | "Copyright © 2026 The General Command of Dubai Civil Defense, All Rights Reserved." | All rights reserved; T&C linked but not retrieved |
| `dlp.dubai.gov.ae` | 5 | © 2020 General Secretariat of the Supreme Legislative Committee | **Explicit prohibition — see §2** |
| `www.dubaitourism.gov.ae` | 1 | not retrieved | **HTTP 403 to automated access** |
| `dda.gov.ae` | 1 | "© 2026 Dubai Development Authority. All Rights Reserved." | All rights reserved |
| `www.trakhees.ae` | 1 | not retrieved | **301 redirect off-host — see §4** |
| `www.difc.com` | 1 | none displayed | no codes found on landing page |
| `www.dubaisouth.ae` | 1 | none displayed | `/en/terms-of-use` exists, not retrieved |

**Every host that displays a copyright line reserves all rights.** None publishes an open licence.
The default posture is therefore restrictive, and permitted use for a commercial platform is a
decision that likely needs written confirmation from each authority rather than inference.

## 2. Dubai Legislation Portal — the most restrictive, and the most consequential

The DLP terms page states, in Arabic:

> "لا يجوز لكم إعادة نشر أو بث أو توزيع تلك المواد" — republishing, broadcasting, or distributing
> those materials is not permitted.

Further recorded on that page:

- Download is permitted **for personal or research purposes** only, absent explicit written
  permission from the Legislative Committee.
- Exploitation "in any form for commercial purposes" requires **prior written authorization**.
- The Committee gives **no warranty** that materials are free from defects, shortcomings, or errors,
  and disclaims liability for accuracy.

This bears directly on five sources — `dlp.hotel-establishment-decree-17-2013`,
`dlp.hotel-classification-resolution-1-2018`, `dlp.holiday-home-decree-41-2013`,
`dlp.holiday-home-resolution-1-2020`, `dlp.legislative-currency-index`.

MIYAR is a commercial product that would cite these in tenant-facing outputs and public share views.
On the face of the published terms that is not covered by the personal/research allowance, and the
no-warranty clause also sits awkwardly with presenting the text as authoritative. **Recommended
decision input: treat DLP licensing as `restricted` or `prohibited` until written authorization is
obtained.** That is a legal judgement, not mine to make.

## 3. Dubai Civil Defence — the catalogue URL is dead

`https://www.dcd.gov.ae/portal/en/preventive-safety/rules-regulations/faq-uae-fire-and-life-safety-code-of-practice?limit=20&limitstart=0`
returns **404 "Oops! Page not found."** It is the `canonicalUrl` for **five** registrations:
`dcd.fire-life-safety-code`, `dcd.active-annexures-index`, `dcd.drawing-submission-requirements`,
`dcd.material-requirements`, `dcd.stakeholder-responsibilities`.

The working page is:

- `https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp`
  → links **UAE Fire and Life Safety Code of Practice, September 2018**, PDF, at
  `/portal/portal/eng/UAEFIRECODE_ENG_SEPTEMBER_2018.pdf`

Two things follow. First, this is a **catalogue defect, not a repeal** — the instrument plainly still
exists; only MIYAR's pointer is stale. It needs a code fix to `shared/regulatory-sources.ts`, and it
is a good illustration of why a disappearing page is modelled as `disappeared_candidate` rather than
withdrawal. Second, **only the 2018 code itself was visible on the working page — no annexures,
drawing-submission, material-requirement, or stakeholder-responsibility documents were listed.** The
four registrations that assume those artifacts may be pointing at material that is not published at
that location, and the annexure the earlier review packet cited (`ANNEXUREA121CLADDING.pdf`) was not
reachable from it. Locating those is a prerequisite to capturing them.

## 4. Trakhees — redirects off the approved host

`https://www.trakhees.ae/` issues a **301 to `https://www.pcfc.ae/`**, a host outside the approved
list for `trakhees-pcfc.authority-overlay` (`www.trakhees.ae`, `trakhees.ae`).

The governed fetcher would refuse this with `REDIRECT_DENIED` — correct behaviour, and a useful live
confirmation that the redirect control does real work. If Trakhees is ever supported, `pcfc.ae` must
be added deliberately after review, not inherited by following a redirect.

## 5. Department of Economy and Tourism — blocked to automated access

`https://www.dubaitourism.gov.ae/` returns **HTTP 403 Forbidden** to automated retrieval.

This is the source that currently blocks both hospitality candidates. A 403 suggests the governed
fetcher would also fail, so obtaining current hotel and hotel-apartment classification criteria will
likely need a non-automated route — a manual download by an authorised person, or a direct request to
DET. `det.hotel-classification-current` should stay a discovery entry until that is resolved.

## 6. Dubai Municipality — artifacts confirmed present

The Dubai Building Code page lists **Dubai Building Code_English_2021 Edition_compressed.pdf** plus
Excel schedules (U-Value calculation, glazed schedule 617 KB, AC unit schedule 625 KB, solar power
calculator 234 KB) and six villa thermal-insulation PDFs. The page states a 40 MB cap on downloadable
files, comfortably inside the fetcher's 20 MB default — which would itself need raising for large
artifacts, deliberately rather than reactively.

Note the site's own Terms & Conditions were **not** located: the obvious path redirects to an
unrelated consumer-products-testing document. The governing site terms for `dm.gov.ae` — the host
behind 14 of 29 sources — remain unread and should be obtained before deciding licensing.

---

## 7. Open items for the decision-maker

1. **DLP licensing** — obtain written authorization, or record `restricted`/`prohibited`. Affects 5 sources and both holiday-home and hotel-legislation paths.
2. **DM site terms** — locate and read the actual `dm.gov.ae` terms; 14 sources depend on them.
3. **DCD catalogue URL** — ~~correct the stale `canonicalUrl`~~ **done 2026-07-22**: all five DCD registrations now point at `https://www.dcd.gov.ae/portal/preventive-safety/uae-fire-and-life-safety-code-of-practice.jsp`, with the observation recorded in each `notes` field. The host is unchanged, so `approvedHosts` and the SSRF/redirect surface are untouched, and no status moved. **Still open:** locate the annexure, drawing-submission, material-requirement and stakeholder-responsibility documents the other four DCD registrations assume — they are not published at the corrected page.
4. **DET access** — establish a lawful non-automated route, or leave hospitality blocked.
5. **DCD site terms** — linked in the footer, not yet read.
6. **Unsupported overlays** — no action needed while `coverageStatus` stays `unsupported`.

## 8. Standing limits

Nothing in this memo changes `retentionPolicy`, `licensingStatus`, or `coverageStatus` for any
source; all 29 remain `pending_review` / `candidate` / `unsupported`. No capture was recorded, no
fingerprint computed, no assertion made, and no approval created or implied. The production
registries remain empty.
