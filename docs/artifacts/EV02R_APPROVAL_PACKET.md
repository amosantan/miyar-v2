# EV-02R Approval Packet — 43 Unresolved Legacy Rows

Status: `DECIDED / CLOSED_WITH_RESIDUAL_INSUFFICIENCY`
Prepared: 2026-07-30
Production inventory packet SHA-256:
`6c2e244d3fb5f6d8d53e253c3b7a767ed9f8d0cc1a18d4db22c79240a50271ce`
Human decision packet SHA-256:
`662c3933f10d651e77ac9b233bf8c021311feee25d49b560bd258c80c9f84160`

## Recorded human decision

On 2026-07-30, Amro Saleh accepted the Data owner and
Decision-model/Product owner roles for EV-02R and approved the recommended
`reject` decisions for rows 36, 37, 38, 106–111, 226, 227, and 229–241.
Approval reference:
`user-approved:2026-07-30:ev02r-24-rejections`.

The remaining 19 rows stay `needs_evidence`. No row was approved as a governed
material mapping or price. Consequently, the authorized backfill set is empty:
there is no production database write to execute for this decision.

On 2026-07-30, the owner approved this terminal EV-02R disposition. Closure
does not convert the 19 residual rows into valid material prices; they remain
insufficient until a future evidence-backed packet is separately approved.

## Remaining decision required

The ownership gate is resolved for this packet. The 19 remaining rows require
the evidence or contract work described below before a future row-level
approval can authorize governed benchmark promotion or production backfill.

The production inventory was reader-only. All 43 rows have zero linked material
allocations, finish-schedule items, RFQ lines, or board links. Therefore there
is no current governed-total change in those four inventoried consumer classes.
This does not establish the absence of every possible historical reference, and
it does not mean that any missing price is AED 0.

Recommended disposition:

- 24 rows: `reject` because the source row is a property, commercial, or market
  metric rather than a material price.
- 6 rows: `needs_evidence` because a current supplier quote or approved
  non-retail benchmark is required.
- 9 rows: unit/specification proven, but `needs_evidence` until the original
  official data file is captured with a document digest and the mapping is
  approved.
- 4 rows: unit proven, but `needs_evidence` because the canonical price contract
  cannot represent per-cubic-metre or per-tonne values.
- 0 rows are presently authorized for backfill.

## Evidence register

| Ref | Authority and captured evidence | SHA-256 / status |
|---|---|---|
| E-DANUBE | [Danube Properties home page](https://danubeproperties.com/); confirms 1% monthly payments, up to 80 months, and 40+ amenities | `662f215408bb3d40677935683801fe552416861b5ba005e224d8cf41f13307db` |
| E-NAKHEEL | [Nakheel home page](https://www.nakheel.com/); confirms three/four buildings, 76 residences, and 700-metre beach metrics | `e94019a71776e6b87c01774af813e972d8e9f3e72eaf05a5ca31baa6a20fc754` |
| E-KF-FNB | [Knight Frank F&B research](https://www.knightfrank.ae/research/sectors/food-and-beverage); confirms 39.8m, 136.6%, US$185.9bn and US$94bn metrics | `47a30e51980a4c88f9e1af56f71947dbd548c1d3274578238f13cc142fabd686` |
| E-KF-LUX | [Knight Frank 8 July 2025 article](https://www.knightfrank.ae/newsroom/article/2025/7/dubais-us-10-million-homes-market-hits-all-time-high); confirms US$2.6bn Q2 2025 luxury-home sales | `6bcc1d12411dd310a783adc03e3cddceab3a505d8180cd1ff648ad84455ee6bc` |
| E-GRANITI-STD | [Graniti UAE live standard-size catalog](https://www.granitiuae.com/product-category/tiles-slabs/standard-size/); retail listings include Verenne White AED158, Bloomy Off White AED110–290/m² and Zesty Light Gray AED105–345/m² | `d7f45e559401a6f03ff64d1013b99020884e48836d10fa788bffc37bc9242786` |
| E-GRANITI-WOOD | [Graniti UAE wood-look catalog](https://www.granitiuae.com/effect/wood-look); confirms the Amazonia Eclipse family but not the exact legacy row and governed range | `d93c1027c4989202fc4e24cd3c4745645e15591c73b6a63dd6c402084696ee4c` |
| E-PORTOBELLO | [Portobello manufacturer Aeterna catalog](https://www.portobello.com.br/en/coatings/line/aeterna?changeLanguage=1); confirms Avorio/Bianco product identity but not a UAE supplier price | `5873ef8bd1fc6f6c63cc8f4a5589f5070a351900346d43f36dddff19b9e65021` |
| E-DSC-2024 | [Dubai Statistics Center, “Average Construction Material Prices 2024”](https://www.dsc.gov.ae/Report/Avg-BMP-2024.pdf); search/browser evidence proves Q3 values and quantities | Official URL verified, but the source now redirects command-line retrieval to authenticated Data Dubai. No raw-document digest was accepted. |

Captured files are owner-only under
`/Users/amrosaleh/.miyar/recovery/ev02r-source-evidence-20260730/`.
The production inventory remains owner-only at
`/Users/amrosaleh/.miyar/recovery/ev02r-production-inventory-20260730.json`.
The recorded human decision remains owner-only at
`/Users/amrosaleh/.miyar/recovery/ev02r-approved-decisions-20260730.json`.

## Row decisions

Every row below has current downstream impact `no linked consumers; no current
authoritative total changes`.

| ID | Original row and legacy value | Exact finding / proposed mapping | Evidence | Recommended decision |
|---:|---|---|---|---|
| 36 | Monthly Payment Percentage — `percent`, AED 1–1 | Commercial payment-plan percentage; not a material, product specification, or material price | E-DANUBE | Reject: `non_material_metric` |
| 37 | Number of Amenities — `Amenities`, AED 40–40 | Property amenity count; not a material price | E-DANUBE | Reject: `non_material_metric` |
| 38 | Payment Plan Duration — `Months`, AED 80–80 | Commercial payment duration; not a material price | E-DANUBE | Reject: `non_material_metric` |
| 106 | elegant buildings — `buildings`, AED 3–3 | Property-building count; not a material price | E-NAKHEEL | Reject: `non_material_metric` |
| 107 | beach length — `metre`, AED 700–700 | Development beach length; not a priced linear material | E-NAKHEEL | Reject: `non_material_metric` |
| 108 | private residences — `residences`, AED 76–76 | Property-unit count; not a material price | E-NAKHEEL | Reject: `non_material_metric` |
| 109 | interconnected buildings — `buildings`, AED 4–4 | Property-building count; not a material price | E-NAKHEEL | Reject: `non_material_metric` |
| 110 | DLD Waiver — `%`, AED 4–4 | Time/project-specific sales incentive; not a material price; exact original offer evidence unavailable | Legacy row only | Reject: `non_material_metric` |
| 111 | Rental Guarantee — `%`, AED 8–8 | Time/project-specific investment offer; not a material price; exact original offer evidence unavailable | Legacy row only | Reject: `non_material_metric` |
| 129 | Amazonia Eclipse St Wood Look Tile — `m²`, no price | Product family partly confirmed; exact SKU, finish, size and current UAE price not proven | E-GRANITI-WOOD | Needs evidence: exact supplier quote/approved benchmark |
| 161 | Aeterna Avorio Tile 120×270 — `sqm`, no price | Manufacturer identity and 120×270 family confirmed; no current UAE supplier price | E-PORTOBELLO | Needs evidence: exact supplier quote/approved benchmark |
| 162 | Aeterna Bianco Tile — `sqm`, no price | Manufacturer identity confirmed; size/finish and current UAE supplier price not fixed | E-PORTOBELLO | Needs evidence: exact supplier quote/approved benchmark |
| 173 | Verenne White Tile — `sqm`, no price | Live Graniti retail listing AED158; proposed identity is still missing exact size/finish and retail-only evidence cannot govern issued totals | E-GRANITI-STD | Needs evidence: supplier quote or approved non-retail benchmark |
| 174 | Bloomy Off White Tile — `sqm`, no price | Live Graniti retail range AED110–290/m²; variants are not fixed and retail-only evidence cannot govern issued totals | E-GRANITI-STD | Needs evidence: exact specification and supplier quote |
| 175 | Zesty Light Gray ST Tile — `sqm`, no price | Live Graniti retail range AED105–345/m²; variants are not fixed and retail-only evidence cannot govern issued totals | E-GRANITI-STD | Needs evidence: exact specification and supplier quote |
| 226 | Number of buildings — `buildings`, AED 3–3 | Property-building count; not a material price | E-NAKHEEL | Reject: `non_material_metric` |
| 227 | Number of residences — `residences`, AED 76–76 | Property-unit count; not a material price | E-NAKHEEL | Reject: `non_material_metric` |
| 229 | Years of experience — `years`, AED 20–20 | Corporate history metric; not a material price | Legacy row only | Reject: `non_material_metric` |
| 230 | Sales offices — `offices`, AED 20–20 | Corporate operating metric; not a material price | Legacy row only | Reject: `non_material_metric` |
| 231 | Luxury sales advisors — `advisors`, AED 110–110 | Staffing metric; not a material price | Legacy row only | Reject: `non_material_metric` |
| 232 | Master communities developed — `communities`, AED 8–8 | Property-development count; not a material price | Legacy row only | Reject: `non_material_metric` |
| 233 | Homes in planning/progress — `Homes`, AED 54,000–54,000 | Property pipeline count; not a material price | Legacy row only | Reject: `non_material_metric` |
| 234 | Homes delivered — `Homes`, AED 50,000–50,000 | Property delivery count; not a material price | Legacy row only | Reject: `non_material_metric` |
| 235 | US$10m+ home sales value — `billion USD`, AED 2.6–2.6 | Q2 2025 market metric in USD billions; not a material price | E-KF-LUX | Reject: `non_material_metric` |
| 236 | F&B sector value — `billion USD`, AED 185.9–185.9 | 2023 sector-size metric; not a material price | E-KF-FNB | Reject: `non_material_metric` |
| 237 | Tourist visitor numbers — `million`, AED 39.8–39.8 | Tourism volume metric; not a material price | E-KF-FNB | Reject: `non_material_metric` |
| 238 | Tourist visitor surge — `percent`, AED 136.6–136.6 | Tourism growth metric; not a material price | E-KF-FNB | Reject: `non_material_metric` |
| 239 | F&B market value — `billion USD`, AED 94–94 | Sector-size metric; not a material price | E-KF-FNB | Reject: `non_material_metric` |
| 240 | Tourism visitor growth — `%`, AED 136.6–136.6 | Duplicate growth metric; not a material price | E-KF-FNB | Reject: `non_material_metric` |
| 241 | Total tourism visitors — `person`, AED 39,800,000–39,800,000 | Duplicate tourism volume metric; not a material price | E-KF-FNB | Reject: `non_material_metric` |
| 246 | Ready-mix normal concrete N40 — `cum`, AED 252.81–252.81 | Proven Q3 2024 unit: per m³; Dubai; supply-only official statistic. Canonical contract has no per-m³ unit | E-DSC-2024 | Needs evidence/contract: `per_cubic_metre` unsupported |
| 247 | Sulphate-resistant ready-mix N40 — `cum`, AED 254.52–254.52 | Proven Q3 2024 unit: per m³; Dubai; supply-only official statistic. Canonical contract has no per-m³ unit | E-DSC-2024 | Needs evidence/contract: `per_cubic_metre` unsupported |
| 248 | Steel bars 6–8 mm — `ton`, AED 2,532.43–2,532.43 | Proven Q3 2024 unit: per tonne; Dubai; supply-only official statistic. Canonical contract has no per-tonne unit | E-DSC-2024 | Needs evidence/contract: `per_tonne` unsupported |
| 249 | Steel bars 10–25 mm — `ton`, AED 2,424.40–2,424.40 | Proven Q3 2024 unit: per tonne; Dubai; supply-only official statistic. Canonical contract has no per-tonne unit | E-DSC-2024 | Needs evidence/contract: `per_tonne` unsupported |
| 254 | Aggregates 3/16 — `load`, AED 1,370–1,370 | Proven quantity: 20 m³ bulk load; candidate `per_pack` with explicit 20 m³ pack; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 255 | White sand — `load`, AED 770.58–770.58 | Proven quantity: 20 m³ bulk load; candidate `per_pack` with explicit 20 m³ pack; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 256 | Black sand — `load`, AED 1,083.33–1,083.33 | Proven quantity: 20 m³ bulk load; candidate `per_pack` with explicit 20 m³ pack; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 257 | Red sand — `load`, AED 586.11–586.11 | Proven quantity: 20 m³ bulk load; candidate `per_pack` with explicit 20 m³ pack; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 261 | Aggregates 3/4 — `load`, AED 1,190.83–1,190.83 | Proven quantity: 20 m³ bulk load; candidate `per_pack` with explicit 20 m³ pack; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 262 | Aggregates 3/8 — `load`, AED 1,190.83–1,190.83 | Proven quantity: 20 m³ bulk load; candidate `per_pack` with explicit 20 m³ pack; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 263 | Sulphate-resistant cement — `bag`, AED 15.49–15.49 | Proven quantity: 50 kg bag; candidate `per_pack`; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 264 | Portland cement — `bag`, AED 13.13–13.13 | Proven quantity: 50 kg bag; candidate `per_pack`; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |
| 265 | White cement — `bag`, AED 34.83–34.83 | Proven quantity: 50 kg bag; candidate `per_pack`; Dubai; supply-only; Q3 2024 | E-DSC-2024 | Needs evidence: raw official record digest + approval |

## Remaining approval fields

For any future approval among the remaining 19 rows, the authorized reviewer
must record:

1. For each affected row ID: `approve`, `reject`, or `needs_evidence`.
2. For any approval: exact product/specification, unit basis, scope, geography,
   effective date, evidence digest, and approval reference.
3. Whether a new canonical `per_cubic_metre` / `per_tonne` contract is approved
   as a separate roadmap change. This packet does not authorize that expansion.

Until then, those 19 rows remain insufficient. The 24 rejected rows remain
ineligible for material pricing; rejection does not delete their legacy source
records.
