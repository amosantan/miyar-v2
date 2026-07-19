# DI-01 Room, Geometry, and Area Inventory Notes

- Machine-readable ledger: `DI-01_ROOM_GEOMETRY_INVENTORY.csv`
- Observed against: `fff889996f3655cacf34d9044dd574ec5562b642`
- Observed: 2026-07-19
- Scope: Current producers, persistence paths, transforms, downstream calculations, artifacts, shares, and primary UI consumers for room identity, geometry, GFA, fit-out area, room sqm, and derived surfaces

## Inventory contract

The CSV contains the required columns:

- `producer_path`
- `consumer_path`
- `identity_key`
- `org_boundary_source`
- `area_basis`
- `unit`
- `source_class`
- `mutability`
- `disposition`

It also contains a stable row `id` and exact `evidence_refs` for review. `source_class` describes current observed behavior only. ADR-0006 deliberately replaces this collapsed concept for future canonical records with independent acquisition method, evidence class, review state, and result state.

## Completeness method

The trace combined:

1. schema searches for project areas, floor-plan JSON, PDF extractions, room IDs/codes, stored room sqm, allocations, schedules, recommendations, visuals, reports, and shares;
2. router-to-engine-to-database traces for project creation/update, intake, design assets, PDF extraction/verification, stored space programmes, MQI, briefs, reports, and public shares;
3. direct and shared-utility consumers of `ctx03Gfa`, `totalFitoutArea`, `getPricingArea`, room IDs, room codes, and surface-area calculations;
4. client paths that create, edit, review, or display the same values;
5. independent architecture and Stage 0 audits, including a follow-up trace of direct project displays, explainability, demo seeds, and dormant write helpers.

Rows intentionally group consumers only when they share the same producer, area-basis behavior, authorization boundary, and disposition. Material-board/catalog quantities remain separate because they are user/catalog quantities, not room geometry.

## Confirmed gaps

- Two independent AI floor-plan pipelines exist: project `floorPlanAnalysis` and `pdf_extractions`.
- No stable room foreign key spans stored rooms, material allocations, finish schedules, recommendations, visuals, RFQs, briefs, reports, or shares.
- Mixed-use room codes can collide; amenity insertion maps by non-unique room code.
- Stored programme regeneration changes numeric room IDs and may delete manual rows unless an unrelated override flag happens to preserve them.
- DXF unit inference is heuristic and source vertices/entity identity are discarded.
- The file-extraction route accepts a caller-controlled storage key rather than an authorized finalized project asset.
- A query mutates `projects.totalFitoutArea`; `updateRoom` can conversely leave that aggregate stale.
- Existing `sqm` and `totalFitoutArea` values do not retain one provable basis/source/version.
- Design-brief floor-plan and DOCX field/unit contracts do not match the current analyzer output.
- Current public brief shares are token/expiry/tenant safe but recompute from mutable project data rather than a frozen artifact-input snapshot.
- MQI and legacy RFQ surfaces are deterministic estimates, not measured geometry.
- Visual allocation mapping has room-name/string-link and percentage-field contract risks.

## Explicit unknown or absent paths

- No repository client caller for `spaceProgram.extractFromFile` was found; the origin of its `s3Key` is unknown.
- No active writer for `pdf_extractions.extractionMethod = text_layer` or `manual` was found.
- The PDF extraction schema comment permits polygons, but the active extraction engine emits no polygon geometry.
- No persisted DXF `$INSUNITS`, transform, level elevation, ring/hole/curve/opening, or source-entity contract exists.
- DWG analysis passes binary content through an AI image-style request and remains an estimate; no deterministic DWG geometry parser is present.
- Current reports/shares have no canonical geometry/measurement snapshot binding.

These are recorded as absent/unknown rather than guessed. The corrected inventory contains 31 producer/transform rows and 35 consumer rows for live paths found in the current checkout. Future code or the uncommitted broader DI roadmap must be retraced before implementation.
