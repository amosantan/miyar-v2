# DI-01 Canonical Room, Geometry, and Measurement Plan

## Pre-launch amendment — no shadow mode

On 2026-07-19 the product owner confirmed MIYAR has not launched and has no real customers. Shadow mode is not the rollout strategy. References below to the completed shadow slice describe historical local verification and reusable scaffolding only. The local implementation is now canonical-first for fresh launch projects and removes shadow product behavior. Shared migration, data reset, Git publication, and deployment remain separately authorized.

- Status: Canonical-first local implementation active
- Implementation base: verified local DI-01 foundation `738dfc6ed0ed8654000727c8f80adc2b7e3aeb2a` on 2026-07-19

## Outcome

MIYAR needs one room identity and one explicit measurement lineage shared by intake, space planning, materials, reports, visuals, and future BIM exchange. The owner authorized the canonical-first local implementation on 2026-07-19: fresh projects start with canonical authority, manual/DXF input is an immutable draft, and only explicit admin approval selects it. Shared migration, destructive reset, publication, deployment, and professional area rules remain excluded.

## Canonical-first implementation decision

- Runtime authority choices are `legacy` and `canonical`; there is no shadow choice.
- Fresh project creation atomically creates canonical authority with no selected geometry. That empty state is explicit insufficiency, not permission to invent room area.
- `saveGeometryDraft`, `reviewGeometryDraft`, and `getGeometryReviewState` replace shadow-specific APIs and separate workflow state from authority.
- Only accepted, valid `room_floor_polygon_area` records on the selected canonical graph are available to downstream resolvers.
- MQI remains insufficient for canonical rooms until stable finish-scope mappings exist. No name, room-code, layer, or array-order guess is allowed. Walls, ceilings, openings, and even floor-finish coverage remain estimates under their own formulas.
- GFA, fit-out, usable, circulation, pricing, scoring, ROI, reports, and shares retain their explicit existing bases and are never overwritten by polygon acceptance.
- Internal/disposable DI-01 data should be safely reset and recreated after migration 0051 is corrected. Retained internal projects remain legacy until geometry is recreated and approved. No reset is performed without separate authorization.

## Why This Is a Real Product Problem

Today a room is reconstructed repeatedly:

1. Image/PDF analysis produces an estimated name, type, area, and confidence in project JSON.
2. The legacy space engine creates a short room ID from type and array position, or from a typology template.
3. The stored space programme creates another database row with a code and one sqm value.
4. DXF import computes polygon area but does not retain a canonical boundary, explicit source units, or stable room identity.
5. MQI estimates wall and ceiling quantities from floor area, assumed proportions, default height, and blanket deductions.
6. Allocations, finishes, recommendations, reports, and visuals use short room strings with no shared measurement version.
7. Programme regeneration can delete and reinsert room rows, changing numeric IDs, while mixed-use blocks can repeat the same short room codes.

Each step is individually useful, but together they cannot prove that two outputs refer to the same room or measurement. DI-01 fixes the foundation before adjacency, detailed quantities, compliance, carbon, or coordination are built on top.

## Design Principles

- Stable identity is separate from the editable room code and name.
- Source observations are preserved; normalization creates a new version and never rewrites history.
- Acquisition method, evidence class, review state, and result state are orthogonal. For example, an AI-imported estimate may be reviewed without becoming measured evidence.
- Ambiguous units, open boundaries, conflicting observations, or missing height/openings yield explicit insufficiency or estimate states.
- Authoritative geometry and calculations remain deterministic TypeScript. AI may propose candidate extraction only.
- Every owned row and final mutation remains organization-scoped.
- Issued artifacts keep their original geometry/measurement version; newer input makes drafts stale rather than rewriting issued history.
- Compatibility is expand-first. Existing JSON, stored rooms, and short room IDs remain readable until contraction is separately approved.

## Approved Bounded Contract

ADR-0006 defines the following concepts. The local slice implements only planar physical-room geometry and the internal `room_floor_polygon_area` basis under `MIYAR_GEOM_V1`; other area-basis names remain reserved until qualified QS review.

| Concept                 | Required meaning                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Space identity          | Stable logical project-scoped identity; editable code/name are attributes, not keys                                                    |
| Space version           | Immutable snapshot of room classification, containment, level/zone, and applicable geometry                                            |
| Geometry source         | Original asset/observation, adapter and version, source units/coordinates, capture time, actor/model, and confidence                   |
| Geometry version        | Normalized boundaries, openings, elevations/heights, coordinate/reference system, tolerance policy, transform, and content fingerprint |
| Measurement observation | Original value, unit, basis, acquisition/evidence classes, provenance, confidence/reviewer, and supersession relationship              |
| Derived measurement     | Deterministic formula/version plus exact input IDs; never confused with an observation                                                 |
| Area basis              | Explicit room floor, usable, fit-out, circulation, gross/internal/component, wall, ceiling, or other approved basis                    |
| Acquisition method      | Proposed `manual_entry`, `dxf`, `pdf_text`, `image_ai`, `dwg_ai`, `typology_template`, `derived`, or `migration`                       |
| Evidence class          | Proposed `survey_measured`, `geometry_derived`, `source_stated`, `estimated`, or `legacy_unknown`                                      |
| Review state            | Proposed `unreviewed`, `accepted`, `rejected`, or `needs_clarification`                                                                |
| Result state            | Proposed `valid`, `not_checked`, `conflict`, or `insufficient`                                                                         |
| Reconciliation          | Differences between observations/bases, tolerance used, result, explanation, and reviewer decision                                     |
| Staleness               | Dependency edge from source/version to every mutable downstream draft                                                                  |

### Space lifecycle

- Rename/recode keeps the stable space identity and creates an immutable new space version.
- Split retires the parent identity and creates new identities connected by explicit supersession edges.
- Merge retires every input identity and creates one new identity connected to each source.
- Delete is a tombstone; referenced history is retained and cannot be reassigned silently.
- Project duplication creates fresh identities and a provenance link to the source project/version; it never reuses tenant-owned IDs.
- Supersession is an append-only directed history. Retracting a later observation does not reactivate an earlier one automatically; a new review event selects the current observation or leaves the result `not_checked`.

### Geometry invariants to approve and test

- Every boundary belongs to one geometry version, level/reference frame, and stable space version.
- Closed rings must be explicitly closed, non-self-intersecting, and deterministically oriented; holes must lie within one outer ring and may not overlap one another.
- Multi-polygons, internal voids, shared boundaries, and containment have explicit semantics; unsupported arcs/bulges/curves produce insufficiency rather than silent flattening.
- Every opening links to an exact host boundary segment and height/elevation interval; scalar room height cannot stand in for varying wall/ceiling geometry without an estimate label.
- Transforms, source units, project-local origin, level elevation, and any geodetic reference are versioned and reproducible.
- Geometry is canonicalized before fingerprinting by approved unit conversion, precision, ring orientation/start point, stable ordering, and serialization rules.
- Downstream mutable records bind the stable space identity plus the exact space, geometry, and measurement versions they consume. Issued snapshots retain those bindings.
- A write supplies `expectedCurrentVersionId`; the final transaction locks the project/graph pointer and advances it only when the organization, project, and current version still match. A fingerprint proves content identity but is not the concurrency token. Reconciliation decisions are append-only reviewer events.

## Approved Decisions and Remaining Gates

### 1. Stable identity and versioning

Recommended: use a stable opaque space identity, keep `roomCode` mutable and human-readable, and create immutable versions for geometry and measurements. Do not use array position, name, or code as the long-term foreign key.

Approval owner: architecture/schema owner plus product owner.

### 2. Canonical and preserved units

Preserve source units and coordinates exactly; reject or quarantine ambiguous DXF units instead of magnitude guessing. A1 approves the following defaults for the local slice:

| Decision            | Recommended default                                                                          | Alternative/impact                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Normalized length   | Project-local fixed-scale decimal metres with six decimal places; report metres              | Integer units are simpler but can conceal precision loss unless the scale is explicit |
| Derived area        | Calculate from normalized geometry; retain full deterministic result; display to `0.01 m²`   | A different reporting precision changes reconciliation and must be versioned          |
| DXF units           | Accept explicit drawing units or an explicit reviewed import choice; otherwise `not_checked` | Magnitude guessing is forbidden as authority                                          |
| Vertex snap         | `1 mm` only during an explicit normalization operation                                       | Larger values can erase design intent; zero tolerance can preserve drafting noise     |
| Area equivalence    | Proposed `max(0.01 m², 0.1%)`                                                                | Must be approved by measurement owner and versioned by purpose/basis                  |
| Elevation snap      | Proposed `1 mm` within one declared level/reference frame                                    | Cross-level snapping is forbidden                                                     |
| Opening subtraction | Exact normalized host geometry; no blanket deduction on measured paths                       | Legacy blanket deductions remain labelled estimates                                   |

Approval owner: architect/BIM lead and measurement owner.

### 3. Area bases

Never collapse GFA, fit-out, usable, circulation, component, room-floor, wall, and ceiling area into one `sqm`. The local slice persists only MIYAR's internal `room_floor_polygon_area`; all professional and aggregate bases remain ineligible for canonical selection until their authority, licensing, and inclusion/exclusion matrix is approved.

Approval owner: product, architect, and qualified measurement/QS reviewer.

### 4. Source precedence and conflict

Recommended: no unconditional precedence chain. A reviewed measurement may supersede another observation only through an explicit decision that preserves both. Disagreement outside the approved tolerance becomes `conflict`.

Approval owner: product and design-domain owner.

### 4a. Coordinate reference and fingerprinting

Recommended: normalize interior geometry in a project-local reference frame, preserve every source transform/reference, and add geodetic linkage only when supplied and reviewed. Fingerprints must use a named algorithm over the approved canonical serialization and record algorithm/version; changing either creates a new geometry version.

Approval owner: architect/BIM lead, architecture/schema owner, and security/reproducibility reviewer.

### 5. Legacy rollout

Recommended: additive schema first; freeze representative legacy JSON/rows; create read adapters that label legacy sqm and MQI surfaces truthfully; backfill only stable links that are deterministic; keep ambiguous records unresolved; rehearse mixed-version operation and restore before shared application.

Rows whose source observation was overwritten or cannot be reconstructed become `original_observation_lost` with result `not_checked`. Duplicate short room codes or multiple plausible targets become `unresolved_legacy_link`; heuristic linking is forbidden. Relabelling prior MQI/report surfaces as estimates requires product/report-owner approval and an approved customer-communication approach.

Approval owner: schema/data owner and product owner.

### 6. First vertical slice

Implement explicit manual geometry plus deterministic ASCII-DXF normalization first. Both are provider-free. Image/PDF/DWG authority and IFC remain later gated adapters.

### Local CAD and performance limits

- Accept ASCII DXF only, with explicit source units of metres or millimetres; binary DXF, DWG, unknown units, curves, and bulges return explicit insufficiency.
- Resolve a finalized same-project `assetId`; never accept a caller-controlled storage key or URL as geometry authority.
- Enforce 10 MiB source bytes, 100,000 entities, 100,000 vertices, 2,000 layers, nesting depth 32, absolute source coordinate `1e9`, a five-second worker deadline, 8 MiB canonical JSON, and 2 MiB per-level overlay responses.
- Canonical coordinates are checked `BigInt` micrometres serialized as decimal strings, converted half-away-from-zero; optional 1 mm snapping is an explicit versioned transform.
- Fingerprints are domain-separated SHA-256 over versioned canonical UTF-8 JSON. Idempotency includes organization/project, asset checksum, adapter, units, transform/reference frame, schema, canonicalizer, and tolerance versions.

Approval owner: product and design-domain owner.

## Absorbed and Deferred Dependencies

The user reprioritized DI-01, but did not close DI-00, BR-02, or BR-05 wholesale.

| Source step | Absorbed into this planning package                                                                                  | Explicitly deferred                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| DI-00 draft | Geometry-specific source/review states, calculation/version identity, units, insufficiency, and deterministic replay | Inventory/policy for cost, compliance, carbon, lifecycle, value, and every non-geometry calculation |
| BR-02       | Proposed room/geometry version identity, stale dependency, and issued-snapshot bindings needed to avoid rework       | Canonical brief schema, approvals, issue model, full backfill, and report-version implementation    |
| BR-05       | Neutral room/level/zone and applicability hooks required by the geometry contract                                    | Typology rules, adjacency, required rooms, pack content, domain validation, and pack authoring      |

No absorbed item becomes approved merely because it is specified here. If later work needs a deferred item, DI-01 stops at the relevant gate.

## Dependency-Ordered Delivery

### Stage 0 — Inventory and freeze

- Trace `projects.floorPlanAnalysis`, `pdf_extractions`, `space_program_rooms`, `amenity_sub_spaces`, `material_allocations`, finish schedules, recommendations, visuals, report reconciliation, public shares, every area helper, and every route accepting a storage key or URL for geometry-bearing content.
- Record `producer_path`, `consumer_path`, `identity_key`, `org_boundary_source`, `area_basis`, `unit`, `source_class`, `mutability`, and `disposition`.
- Add provider-free fixtures for typology, manual, stored-room, AI-shaped JSON, PDF-shaped JSON, DXF, the file-extraction route, MQI, and report paths.
- Preserve the exact seven-file 55-test baseline and the provider-free DI-01 legacy suite.
- Enforce the approved CAD/storage/parse/API bounds above.

Exit: no unknown producer or consumer remains, and current behavior is reproducible.

### Stage 1 — Shared contract and deterministic CAD boundary

- Decide stable identity/version rules, coordinate/unit representation, geometry primitives, measurement vocabulary, content fingerprints, conflicts, insufficiency, and staleness.
- Define a shared TypeScript contract and deterministic validators/calculators without yet switching production consumers.
- Decide lifecycle, geometry invariants, canonicalization/fingerprint, concurrency, and downstream version binding explicitly.

Exit: reviewers can falsify every contract with fixtures; no policy choice is hidden in implementation.

### Stage 2 — Additive local persistence

- Propose tables/indexes/foreign-key relationships or justified JSON boundaries.
- Put organization identity on every owned boundary and require organization-locked final reads/writes.
- Resolve an authorized project asset and bounded validated bytes at the adapter boundary; never accept a caller-controlled storage key as geometry authority.
- Keep reads pure. Reconciliation may propose a change, but only an explicit validated mutation may persist it.
- Define additive migration, deterministic-only backfill, mixed-version reads, application rollback, data restore, and later contraction.
- Define project geometry authority as `legacy` or `canonical`. Fresh projects receive canonical authority atomically; once a project is canonical, legacy area writers reject writes rather than race the canonical version pointer.
- Treat any eventual destructive contraction as a new roadmap step with separate human approval.

Exit: generated additive SQL passes review, disposable-MySQL forward/restore evidence, and tenant-safe helper tests. Shared application remains forbidden.

### Stage 3 — Compatibility bridge

- Make all legacy readers dual-mode and every legacy geometry/area writer authority-aware before any canonical mode is possible.
- Cover `project.update`, AI floor-plan analysis, PDF verification, all space-program mutations, and the read-side fit-out-area write.
- Define release N as the future rollback floor: no project may become canonical until every pre-N instance is drained and absence is verified.

Exit: the complete endpoint/mode matrix proves legacy compatibility, canonical writer protection, and independent draft/review behavior.

### Stage 4 — Manual/DXF draft and canonical review workflow

- Persist stable spaces and versioned manual/DXF geometry as immutable drafts under project authority.
- Preserve source identity, units, transform, normalized geometry, formula/version, fingerprint, and append-only review/reconciliation.
- Expose organization-authorized preview, draft-save, admin review, and comparison APIs and the bilingual source-versus-normalized overlay.
- Select a draft as canonical only through an explicit organization-admin acceptance guarded by the current-version compare-and-swap.
- Do not change GFA, total fit-out area, scoring, reports, shares, or their existing numerical bases. Legacy-authority MQI remains unchanged; canonical-authority MQI fails closed with labelled insufficiency until every stable space has an explicit reviewed finish-scope mapping, because room-floor polygon area alone cannot authorize floor finishes, walls, ceilings, openings, or fit-out scope.

Exit: a golden plan round-trips idempotently with stable identities, an accepted room-floor measurement is selected canonically, and every incompatible legacy/professional output remains unchanged.

### Stage 5 — Shared migration and release decision (not authorized)

- Return DI-01 to `NEEDS_HUMAN` for the target/snapshot/count-controlled internal reset, shared migration, professional area-basis rules, additional consumer integration, and release decisions.
- Image/PDF/DWG/IFC authority and later DI work remain separately scoped.

Exit: no action without the named approvals.

### Stage-to-gate map

| Stage                     | May proceed now?                                       | Gate to exit                                                                |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| 0 — Inventory/freeze      | Yes                                                    | Corrected trace, exact 55-test baseline, provider-free fixtures              |
| 1 — Contract/CAD          | Yes                                                    | Pure deterministic tests and fail-closed CAD bounds                         |
| 2 — Local persistence     | Yes, disposable MySQL only                             | Additive migration, tenant helpers, restore evidence                        |
| 3 — Compatibility bridge | Yes, local only                                        | Complete legacy/canonical writer matrix and draft lifecycle                  |
| 4 — Draft/review workflow | Yes, local only                                        | APIs/UI/browser, explicit admin acceptance, unchanged incompatible outputs  |
| 5 — Shared release        | No                                                     | Targeted reset/shared migration/release approval                             |

## Likely Files and Ownership

| Area             | Existing paths to inspect                                              | Stage A action                                         | Post-approval action                                                    |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Shared contracts | `shared/`, `server/engines/design/design-types.ts`                     | Trace current identities/DTOs                          | Canonical geometry/measurement contracts                                |
| Intake/adapters  | Floor-plan analyzer, `dwg-parser.ts`, `space-program-extractor.ts`     | Trace units, storage inputs, fallbacks, discarded data | Candidate observations and deterministic normalization                  |
| Persistence      | `drizzle/schema.ts`, `server/db.ts`                                    | Trace rows, keys, mutations, org scope                 | Additive versions and org-locked helpers                                |
| API              | `server/routers/spaceProgram.ts`, design asset/brief routers           | Inventory asset/key/URL and read/write boundaries      | Validated organization-authorized operations                            |
| Calculations     | `space-program.ts`, `material-quantity-engine.ts`, `area-utils.ts`     | Freeze current formulas and labels                     | Explicit input versions and source/result states                        |
| Consumers        | MQI, finish schedule, advisor, visuals, reconciliation, PDF/DOCX/share | Map identity/version expectations                      | Stable version bindings and stale/compatibility labels                  |
| Client           | Space editor/planner, Area Verification, Material Allocation, reports  | Capture current states/performance                     | Review, overlay, conflict/insufficiency UI                              |
| Tests            | Current v31/v30/intake/reconciliation, MySQL/browser fixtures          | Freeze legacy/provider-free baseline                   | Round-trip, property, migration, tenant, compatibility, visual evidence |

## Verification Matrix

| Risk                     | Required proof                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity drift           | Reorder/rename/reimport fixtures retain stable logical IDs; duplicate/conflicting matches fail explicitly                                                                             |
| Unit/area drift          | mm/m and approved source-unit fixtures, polygon orientation, holes/openings, rounding/tolerance boundaries, deterministic fingerprints                                                |
| False authority          | Estimated/image/manual/imported/measured states remain distinct through API, database, UI, report, and share                                                                          |
| Tenant leakage           | Same-org positive; cross-org/missing/legacy-null/concurrent final-write negatives on real MySQL                                                                                       |
| Asset confusion          | Caller-controlled, foreign-org, missing, tampered, unfinalized, malformed, and oversized asset inputs fail before parsing                                                             |
| Legacy breakage          | Versioned fixtures for project JSON, stored rooms, allocations, current and legacy reports, mixed application versions                                                                |
| Frozen artifact fidelity | Advance the project geometry after issue; unexpired public share and PDF/DOCX render the bound snapshot, expired token fails closed, and missing snapshot storage never falls forward |
| Data loss                | Additive forward migration, row/count/hash integrity, application rollback, database restore, no ambiguous backfill                                                                   |
| Downstream mismatch      | Space, MQI, report, and selected visual/finish consumers name the same room and measurement version                                                                                   |
| User trust               | Desktop/mobile overlay and conflict/insufficiency states; bilingual report/share wording; no hidden overwrite                                                                         |
| Performance/scale        | Approved small/medium/large storage, import, API-read, client-payload, and overlay budgets pass without bypassing SC-04 budgets                                                       |
| Regression               | Targeted/property tests, `pnpm check`, safe full suite, authorization/database audits, proposed-schema disposable MySQL, `pnpm build`, diff review                                    |

## Stop Conditions

Stop immediately and preserve evidence if any proposal would:

- silently convert an estimate into a measurement;
- overwrite an original observation or a manual/locked value;
- accept ambiguous drawing units as authoritative;
- guess an ambiguous legacy room link or conceal `original_observation_lost`;
- create an organization-owned row without an enforced tenant boundary;
- use a schema/restore design that cannot preserve immutable geometry and reconciliation history;
- require a breaking contraction or shared migration without explicit approval;
- change scoring, prices, compliance, or financial policy as a side effect;
- exceed three evidence-based attempts for one unchanged blocker.

## Review Objections and Dispositions

| Reviewer                           | Result                                                                                                                                | Disposition                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Three read-only Codex agents       | Dependency, architecture, security, migration, and verification corrections                                                           | Incorporated into staged scope, evidence, gates, and verification matrix                |
| Claude Opus, high/medium reasoning | `APPROVED_WITH_CHANGES`; identified lifecycle, invariants, unit decisions, concurrency, legacy, frozen-artifact, scale, and gate gaps | Incorporated in this revision; no reviewer substitutes for named professional approvals |
