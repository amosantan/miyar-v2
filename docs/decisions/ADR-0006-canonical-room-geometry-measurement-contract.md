# ADR-0006: Canonical room, geometry, and measurement contract

- Status: Accepted with pre-launch canonical-first amendment
- Date: 2026-07-19
- Deciders: Product owner; architecture/schema owner; architect/BIM lead; qualified measurement/QS reviewer; security/tenant owner; report owner
- Technical area: Spatial identity, deterministic geometry, measurement provenance, schema, and compatibility
- Supersedes: None

## Context

MIYAR currently has several incompatible representations of the same interior space:

- project-level `ctx03Gfa`, `totalFitoutArea`, `fitoutAreaVerified`, and unversioned `floorPlanAnalysis` JSON;
- PDF extraction rows with room arrays, aggregate area, and a verification status;
- stored space-program rows with a replaceable numeric ID, short room code, aggregate sqm, floor label, and coarse source;
- older in-memory space programmes that derive room codes from type and array order or fixed typology percentages;
- DXF extraction that calculates polygon area, guesses units from magnitude, and discards vertices and entity identity;
- image, PDF, and DWG extraction that produces AI-estimated rooms rather than authoritative geometry;
- finish, material, recommendation, visual, report, and share records that link through short room strings rather than a stable space/version contract;
- deterministic MQI surfaces that estimate walls, openings, and ceilings from floor sqm and default assumptions.

At project level, the same `totalFitoutArea` field can originate from explicit user input, form heuristics, AI floor-plan totals, verified PDF extraction, or a sum of stored rooms. `getPricingArea()` then prefers that value for scoring, normalization, ROI, sales-premium, sustainability, prediction, scenario, design, and reporting paths without retaining its measurement basis or source version.

The result is useful early-stage guidance, but MIYAR cannot prove that two consumers reference the same room, geometry, measurement basis, or observation. An estimate can also appear measured after its provenance is collapsed.

This ADR defines the contract and additive architecture approved for the bounded local manual/DXF shadow slice. It does not approve professional measurement rules, shared schema application, customer relabeling, canonical authority, publication, or production behavior.

## Decision

If accepted, MIYAR will adopt the following contract.

### Pre-launch lifecycle amendment — no shadow mode

On 2026-07-19 the product owner confirmed MIYAR has not launched and has no real customers. The owner rejected shadow mode as a product rollout strategy. Therefore:

- canonical geometry is the intended launch authority for fresh projects;
- there will be no customer-facing shadow pilot or shadow authority phase;
- the already implemented shadow path is technical verification scaffolding, not approved final runtime behavior;
- the next bounded change must remove or disable shadow selection and shadow-only UI/API semantics before launch;
- legacy compatibility may remain only where required for deterministic fixture migration or internal data recovery, not as the default product authority;
- downstream scoring, MQI, costs, reports, and shares must be explicitly verified against canonical inputs before launch;
- this amendment does not authorize shared migration, data reset, Git publication, or deployment.

### 1. Separate identity, version, acquisition, evidence, review, and result

- A space receives one opaque, project-scoped stable identity. Room code and name are editable attributes and never foreign keys.
- Space attributes are immutable versions. Rename/recode creates a new version on the same identity.
- Split retires one identity and creates two or more new identities with explicit supersession edges.
- Merge retires every input identity and creates one new identity linked to all sources.
- Delete tombstones the identity; historical references remain resolvable.
- Project duplication creates fresh tenant-owned identities and records provenance to the source version.
- Acquisition method, evidence class, review state, and result state are orthogonal. Proposed acquisition methods are `manual_entry`, `dxf`, `pdf_text`, `image_ai`, `dwg_ai`, `typology_template`, `derived`, and `migration`. Proposed evidence classes are `survey_measured`, `geometry_derived`, `source_stated`, `estimated`, and `legacy_unknown`. Proposed review states are `unreviewed`, `accepted`, `rejected`, and `needs_clarification`; proposed result states are `valid`, `not_checked`, `conflict`, and `insufficient`.
- `pdf_text` is a reserved acquisition method, not evidence that such a writer exists today. It remains vacant until a deterministic PDF text-layer path is implemented and verified; current live PDF extraction is AI-estimated.
- Import does not imply measurement, and manual entry does not imply authority. Review never upgrades estimated evidence to measured evidence. A new measured observation must be created from eligible evidence.

The state dimensions are approved for the local slice. Professional/aggregate area-basis meaning remains separately gated.

### 2. Preserve observations and derive measurements deterministically

- Original values, units, coordinates, source asset/record, actor/model, adapter/version, capture time, confidence, and hashes are retained without destructive normalization.
- A normalized geometry or derived measurement records its exact source IDs, canonicalization/formula version, tolerance policy, and result fingerprint.
- Supersession is append-only. Retracting a later observation does not reactivate an older observation automatically; a new reviewer event selects the current observation or leaves it `not_checked`.
- Conflicting observations outside the approved, versioned tolerance remain visible. There is no unconditional “manual beats imported” or “latest wins” rule.
- AI may propose candidate observations. Deterministic TypeScript validates geometry and calculates lengths, areas, surfaces, and reconciliation results.

### 3. Use a versioned project-local geometry contract

Approved A1 defaults for the local slice:

- Preserve source coordinates and units exactly.
- Normalize interior geometry to project-local checked `BigInt` micrometres serialized as six-decimal metre-compatible strings; report lengths in metres and areas in square metres. Conversion is half-away-from-zero. Any snap is a separately recorded transform, not an implicit consequence of storage precision.
- Accept DXF units only from explicit source metadata or a recorded reviewer selection. Unknown units produce `not_checked`; magnitude guessing is retired as authority.
- Canonical rings are closed, non-self-intersecting, deterministically oriented, and stably ordered. Holes lie within one outer ring and do not overlap. Unsupported arcs, bulges, transforms, or invalid topology produce explicit insufficiency.
- Each boundary belongs to one immutable project geometry version, level/reference frame, and space version.
- Each opening links to its host boundary segment and vertical interval. A scalar room height or blanket deduction remains an estimate, not measured wall geometry.
- Geometry canonicalization records unit conversion, precision, ring orientation/start point, stable ordering, serialization version, and domain-separated SHA-256 over canonical UTF-8 JSON.
- Normalization defaults are an explicit optional 1 mm vertex/elevation snap transform, display area rounded to 0.01 m², and area equivalence of `max(0.01 m², 0.1%)`, all versioned by purpose.
- V1 supports planar physical-room polygons in one project-local XY frame and declared level elevation. The only selectable basis is internal `room_floor_polygon_area` under `MIYAR_GEOM_V1`; professional and aggregate bases remain reserved.

### 4. Bind every consumer to exact input versions

Every new mutable downstream calculation or design record will bind:

- stable space identity;
- exact space version;
- exact project geometry version;
- exact measurement observation(s) or deterministic derivation identity;
- calculation/formula version and input fingerprint.

Consumers that use only project-level aggregate area still bind the exact aggregate measurement observation and basis. Issued reports and public shares retain their bound snapshot; a later geometry change cannot alter them. Mutable drafts become stale when a bound upstream version changes.

### 5. Adopt an additive hybrid persistence model

The proposed physical model keeps queryable identity, tenancy, status, and lineage relational while storing the validated canonical graph as versioned JSON. Exact names may change during schema review.

| Proposed relation                | Purpose and minimum fields                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_geometry_authorities`   | Org/project authority mode (`legacy`, `shadow`, `canonical`), current geometry version ID, and revision/CAS token                                                                                       |
| `spatial_graph_versions`         | Immutable graph snapshot; graph/org/project IDs, version, canonical geometry JSON, schema/canonicalization/tolerance/fingerprint versions, reference frame, fingerprint, creator/time, lifecycle state  |
| `space_identities`               | Stable room/space identity; org/project/graph IDs, opaque public ID, lifecycle state, tombstone time                                                                                                    |
| `space_versions`                 | Immutable name/code/category/level/zone/containment and graph-version binding; supersession metadata and content fingerprint                                                                            |
| `geometry_sources`               | Original project asset or observation identity, acquisition/evidence classes, adapter/model/version, original units/reference/transform, content hash, confidence and capture metadata                  |
| `measurement_records`            | Typed observation or derivation with org/project/space/version binding, basis/authority version, original and normalized values/units, acquisition/evidence/review/result states, geometry/formula/source identity, confidence, supersession |
| `measurement_input_edges`        | Ordered many-input lineage from each derived measurement record to its exact source records                                                                                                           |
| `geometry_reconciliation_events` | Append-only base/candidate fingerprints, variance/tolerance, decision, reviewer, reason, and time                                                                                                       |
| `legacy_space_links`             | Old table/row/string key to canonical identity with `mapped`, `unresolved_legacy_link`, `original_observation_lost`, or `retired` disposition and evidence                                              |
| `artifact_input_snapshots`       | Immutable issued/share inputs: exact space/geometry/measurement/formula/renderer/copy/locale/storage bindings and snapshot digest                                                                       |

Every organization-owned relation carries `organizationId` and `projectId` even when derivable. Unique/index contracts include graph/project identity, `(spaceIdentityId, version)`, `(graphId, version)`, content fingerprints, source asset/adapter idempotency keys, and legacy source keys. Database helpers must verify the project and every related asset/space/version under the same organization in the final transaction.

The canonical JSON schema must be versioned, size-bounded, validated before persistence, and deterministic to serialize. It is not an escape from relational authorization or indexes.

### 6. Enforce asset authorization and optimistic concurrency at the final boundary

- Import APIs accept an authorized project asset ID, never a caller-controlled storage key or URL as authority.
- ASCII-DXF bytes use a separate deterministic project-CAD boundary with size/type/signature/encoding/checksum/entity/vertex/layer/nesting/coordinate/time controls. AI media validation remains unchanged.
- The final transaction locks or revalidates project, organization, asset, graph, space, and current-version claims.
- A writer supplies `expectedCurrentVersionId`. The final transaction locks the project and graph pointer, revalidates organization/project/current-version identity, creates the immutable version, and advances the pointer with a compare-and-swap. A fingerprint proves canonical content identity but is not the concurrency token. A stale writer receives a conflict and must reconcile.
- Reconciliation decisions are append-only reviewer events. Reads and reconciliation previews never mutate project or aggregate area fields.
- Public identifiers are opaque; missing and cross-organization resources remain indistinguishable.

### 7. Expand first and preserve truthful legacy behavior

- Existing project, PDF extraction, space-program, allocation, finish, recommendation, report, and share fields remain in place during expansion.
- The implemented schema currently represents `legacy`, `shadow`, and `canonical` for compatibility testing. Under the pre-launch amendment, product runtime must not expose or select `shadow`; fresh launch projects are intended to use `canonical`. Legacy room/area writers reject mutations for canonical projects rather than racing the canonical pointer.
- No bulk backfill invents geometry, measurement basis, units, or stable links. Only deterministic, uniquely evidenced links may be populated.
- Duplicate or ambiguous short room codes become `unresolved_legacy_link`; no name/order/typology heuristic may silently choose a target.
- Rows whose original observation was destroyed or cannot be reconstructed become `original_observation_lost` with result `not_checked`.
- Existing MQI wall/ceiling/opening calculations remain available only as explicitly versioned estimates until a consumer is approved for exact geometry.
- Manual/locked allocations and explicit developer inputs remain authoritative user decisions and are never overwritten by imported or AI suggestions.
- Legacy MQI/report relabeling and customer communication require product/report-owner approval before UI or artifact changes.
- Destructive contraction is a later roadmap step with separate compatibility evidence and approval.

Current public design-brief shares are not frozen geometry snapshots: resolution rereads mutable project, floor-plan, recommendation, benchmark, and trend data. Existing links must be classified `legacy_live_projection`. New geometry-aware issuance must bind an immutable artifact-input snapshot; if that snapshot is missing, public resolution fails closed rather than falling forward to current project data. Implementing the broader canonical issued-report model remains coordinated with BR-07.

### 8. Original bounded verification slice and required canonical-first follow-up

After all required approvals, the first implementation slice will cover:

1. shared contract and deterministic geometry validators/canonicalizer;
2. additive persistence and organization-locked helpers;
3. a compatibility bridge that makes every legacy writer authority-aware before canonical mode can ever be enabled;
4. explicit manual geometry and deterministic ASCII-DXF import from an authorized finalized asset, initially implemented in local shadow mode for verification;
5. source-versus-normalized reconciliation and overlay;
6. provider-free fixtures, property tests, tenant/concurrency tests, safe migration/restore, and mixed old/new application evidence.

Image/PDF/DWG candidate extraction, broad consumer cutover, IFC, adjacency, BOQ, compliance, carbon, and later DI work remain outside the slice.

The pre-launch amendment supersedes shadow rollout. A separate implementation must convert this verified foundation to canonical-first launch behavior and prove all downstream consumers before release.

## Consequences

### Positive

- Room, geometry, and measurement lineage becomes reproducible across features.
- Estimates, imports, user inputs, and measurements remain truthfully distinct.
- Stable identities survive rename/reorder while split/merge/delete remain auditable.
- Tenant and asset boundaries are enforced at both API and final database mutation.
- Existing projects can remain readable while canonical geometry is introduced additively.
- Later adjacency, quantities, compliance, carbon, coordination, and report work can depend on explicit versions instead of short strings.

### Negative and trade-offs

- The additive model creates more rows, indexes, storage, and reconciliation UX.
- Whole-graph immutable JSON is simple to fingerprint and restore but duplicates geometry across versions; explicit performance/storage budgets are required.
- Fixed-scale metre serialization is deterministic but may be insufficient for some source models; source coordinates remain preserved, and any snap transform and precision policy are explicit and versioned.
- Legacy ambiguous links will stay unresolved instead of producing superficially complete migrations.
- Consumer cutover must be incremental and may temporarily maintain old and new representations.

### Risks and mitigations

- **Schema/tenant risk:** all owned rows repeat organization/project identity and are revalidated in final transactions; real MySQL cross-org/concurrency tests are mandatory.
- **False-authority risk:** acquisition, evidence, review, and result states are separate, and unknown units/topology yield `not_checked`.
- **Data-loss risk:** source observations and additive tables remain intact during application rollback; no automatic reverse migration deletes new observations.
- **Artifact drift risk:** issued reports/shares bind frozen input versions and fail closed if the snapshot cannot be resolved.
- **Scale risk:** small/medium/large storage, import, API read, browser overlay, and bundle budgets must be approved and measured before rollout.
- **Standards/licensing risk:** each area basis records its authority/version; proprietary rule content is not embedded without licensing and qualified review.

## Alternatives Considered

### Keep `space_program_rooms` as the canonical table

Rejected as the long-term contract because rows are replaced, codes can repeat, geometry/version/provenance are absent, and downstream string links are ambiguous. It remains a compatibility source during expansion.

### Store only one mutable geometry JSON field on `projects`

Rejected because it cannot provide immutable versions, stable space lifecycle, per-observation provenance, append-only reconciliation, or safe issued-artifact bindings.

### Fully normalize every coordinate, edge, opening, and vertex into relational rows

Deferred. It improves queryability but substantially increases schema and migration complexity before access/query requirements are proven. The proposed hybrid retains relational identity/lineage and a validated, versioned canonical graph.

### Prefer the latest or manually reviewed value automatically

Rejected. Recency and review do not prove measurement authority, and automatic precedence would overwrite conflicts and explicit developer intent.

### Backfill canonical rooms by code, name, or array position

Rejected for ambiguous cases. Those fields are not stable identities and already collide or change.

### Make AI floor-plan output authoritative geometry

Rejected. AI extraction may create candidate estimated observations; deterministic validation and eligible measured/imported evidence remain numerical authority.

## Verification

Before this ADR can move to `Accepted`, reviewers must approve the decision package in `docs/artifacts/DI-01_APPROVAL_PACKAGE.md`.

After approval, implementation evidence must include:

- golden manual/DXF round trips with stable identities and deterministic fingerprints;
- translation, rotation, winding/order, unit-scaling, holes, openings, multi-polygons, invalid topology, unknown-unit, tolerance-boundary, and large-coordinate properties;
- idempotent import keyed by source asset/content hash/adapter version;
- same-org positives and unauthenticated, cross-org, missing, legacy-null, asset-confusion, lost-ownership, concurrent-write, and rollback negatives on disposable MySQL;
- additive migration SQL review, forward apply, row/hash/count integrity, mixed old/new application reads/writes, application rollback, and database restore rehearsal;
- legacy JSON, PDF extraction, stored-room, duplicate-code, allocations, current/legacy report, and issued-share fixtures;
- current project changes mark mutable consumers stale while issued reports/shares retain the frozen version;
- MQI and selected reports reconcile to the same identity and versions without silently changing approved formulas;
- small/medium/large storage, import, API read, client payload, and overlay budgets;
- TypeScript, targeted/property tests, authorization/database audits, safe full suite, build, browser/visual overlay, bilingual artifact QA, and independent review.

## Migration and Rollback

### Expand

1. Generate additive tables/indexes only after ADR/schema approval.
2. Apply and verify on disposable MySQL and the provider-compatibility profile.
3. Ship new writes behind an application capability/feature flag while old reads remain supported.
4. Create canonical records only from new explicit/manual/DXF workflows or deterministic legacy links.
5. Add consumer reads one bounded family at a time with old/new reconciliation evidence.

### Application rollback

Disable canonical reads/writes and deploy the previous compatible application. Leave additive tables and immutable observations intact. Do not drop data to make old code work.

### Bad import or rule version

Stop the writer, retain source/version/fingerprint and reconciliation evidence, mark affected mutable outputs stale or blocked, and create a corrected version. Do not edit an immutable geometry version in place.

### Bad deterministic backfill

Stop the run, preserve the run manifest and source evidence, then forward-repair or restore from the verified recovery point. Never run blind reverse SQL or infer missing provenance.

### Contraction

Removing legacy fields/tables or old read compatibility requires a new roadmap step, zero unresolved supported consumers, verified backups, mixed-version evidence, and separate human approval.

## Approval Boundary

`Proposed` means this document is an approval package, not implementation authority. Acceptance requires the named owners to approve the exact decisions or record amendments. Shared migration, production rollout, scoring/financial/compliance changes, commit/push/merge, and deployment remain separately authorized even after ADR acceptance.

## References

- `.agent/state/CURRENT_TASK.md`
- `.agent/state/ROADMAP.md`
- `docs/specs/DI-01_CANONICAL_GEOMETRY_PLAN.md`
- `docs/artifacts/DI-01_ROOM_GEOMETRY_INVENTORY.csv`
- `docs/artifacts/DI-01_APPROVAL_PACKAGE.md`
- `docs/decisions/ADR-0002-deterministic-decision-authority.md`
- `docs/decisions/ADR-0004-render-input-fingerprint.md`
- `docs/SECURITY.md`
- `docs/VERIFICATION.md`
