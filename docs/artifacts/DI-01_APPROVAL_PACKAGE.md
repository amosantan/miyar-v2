# DI-01 Minimal Approval Package

- Status: `CANONICAL_FIRST_LOCAL_IMPLEMENTATION_ACTIVE`
- Prepared: 2026-07-19
- Implementation base: verified local DI-01 foundation `738dfc6ed0ed8654000727c8f80adc2b7e3aeb2a`
- Scope: The owner authorized the local canonical-first conversion: no shadow runtime authority, fresh projects canonical by default, immutable manual/DXF drafts, explicit admin approval, corrected unshared migration 0051, measurement-basis-safe downstream resolution, and an internal-data strategy. Shared migration, destructive reset execution, Git publication, and deployment remain unauthorized.
- Safe default: If any block is not approved, DI-01 remains paused and production behavior does not change

## Why approval is required

MIYAR currently combines explicit, estimated, imported, derived, and reviewed area values into project and room fields that are consumed by scoring, quantities, costs, reports, and shares without one stable room/measurement version. Fixing this safely requires professional measurement choices, customer-truth decisions, and a tenant-safe schema/rollout contract. Agents may prepare the options but cannot approve those policies.

The complete proposal is [ADR-0006](../decisions/ADR-0006-canonical-room-geometry-measurement-contract.md). The current-path evidence is in [the machine inventory](DI-01_ROOM_GEOMETRY_INVENTORY.csv).

## Approval block A — Geometry and measurement semantics

**Approvers:** Architect/BIM lead and qualified measurement/QS owner.

Approve or amend these recommendations as one coherent rule set:

1. Project-local Cartesian reference frame; preserve original source coordinates/units and any reviewed geodetic transform.
2. Canonical coordinates serialized as fixed six-decimal metre strings; any 1 mm snap is an explicit recorded transform.
3. DXF units require explicit metadata or reviewer selection; unknown/conflicting units produce `not_checked` and never use magnitude guessing as authority.
4. Polygon/MultiPolygon invariants, holes, non-overlap for physical rooms, exact opening-to-boundary/elevation binding, and explicit insufficiency for unsupported curves/bulges.
5. Display area precision `0.01 m²`; proposed reconciliation tolerance `max(0.01 m², 0.1%)`, versioned by basis and purpose.
6. SHA-256 canonical geometry fingerprint over versioned deterministic JSON; separate raw-source digest.
7. Initial area-basis framework records an authority/rule version and distinguishes room-floor, net internal, usable, fit-out, circulation, GFA, wall gross/net finish, ceiling plan, and legacy-unspecified area.

**Options:**

- **A1 — Approve recommendations (recommended):** Enables a falsifiable DI-GEOM-v1 contract.
- **A2 — Approve with amendments:** Record exact changed units, tolerances, invariants, bases, or fingerprint rules before implementation.
- **A3 — Do not approve:** DI-01 stops; current outputs remain legacy estimates/guidance.

**Decision:** A1 approved by the user on 2026-07-19. Broader professional area-basis meaning remains reserved for qualified QS review.

## Approval block B — Authority, lifecycle, and customer truth

**Approvers:** Product/design owner and report owner.

Approve or amend:

1. Stable opaque space identity; immutable versions; explicit rename, split, merge, tombstone, clone, supersession, and stale-dependency behavior.
2. Four independent state dimensions:
   - acquisition method;
   - evidence class (`survey_measured`, `geometry_derived`, `source_stated`, `estimated`, `legacy_unknown`);
   - review state;
   - result state.
3. No “latest wins” or unconditional source precedence; conflicts remain visible and manual/locked values are not overwritten.
4. Existing ambiguous short room links remain `unresolved_legacy_link`; destroyed provenance becomes `original_observation_lost`/`not_checked`.
5. Existing MQI walls/openings/ceilings remain explicitly labelled deterministic estimates for legacy-authority projects. Canonical-authority MQI fails closed until reviewed stable-space finish scope exists; approved floor polygons alone are insufficient.
6. Current public brief shares are classified `legacy_live_projection`, because they reread mutable data. New geometry-aware issues bind immutable artifact-input snapshots and fail closed when missing.
7. Approve the required customer wording/communication before relabelling existing MQI or report outputs.

**Options:**

- **B1 — Approve recommendations (recommended):** Preserves truthful lineage and prevents silent authority upgrades.
- **B2 — Approve with amendments:** Record exact lifecycle, labels, precedence, and communication changes.
- **B3 — Do not approve:** DI-01 stops before customer-facing or consumer behavior changes.

**Decision:** B1 approved by the user on 2026-07-19.

## Approval block C — Schema, tenancy, rollout, and recovery

**Approvers:** Architecture/schema owner, security/tenant owner, and data/migration owner.

Approve or amend:

1. Additive hybrid persistence: relational identity/ownership/version/state/measurement/event rows plus size-bounded validated immutable canonical geometry JSON.
2. Non-null `organizationId` and `projectId` on every owned canonical row, with established organization/project authorization revalidated in the final transaction.
3. Imports accept an authorized finalized project `assetId`, validated bytes/checksum/type/limits, and never a caller-controlled storage key/URL.
4. Optimistic concurrency uses `expectedCurrentVersionId`, project/root row locks, and final organization/project/current-version compare-and-swap.
5. Project authority modes are `legacy` and `canonical`; draft/review is a separate lifecycle. Fresh projects start canonical, and legacy area writers cannot independently mutate canonical projects.
6. Deterministic-only dry-run backfill with source-row digests/run IDs; ambiguous, org-null, or lost-provenance rows remain unresolved.
7. Application rollback leaves additive tables and immutable observations intact; after canonical writes, old independent writers are not reactivated. Recovery uses forward repair or a verified recovery point.
8. Destructive contraction is a future separately approved roadmap step.

**Options:**

- **C1 — Approve recommendations (recommended):** Accepts the additive schema/tenancy/rollout contract; the separate first-local-slice authorization below is still required, and shared application remains excluded.
- **C2 — Approve with amendments:** Record exact table/ownership/concurrency/cutover/recovery changes first.
- **C3 — Do not approve:** DI-01 stops with no schema or runtime work.

**Decision:** C1 approved by the user on 2026-07-19.

**Pre-launch lifecycle amendment:** On 2026-07-19 the owner confirmed there are no real customers and the application has not launched. Shadow mode is therefore rejected as product/runtime rollout behavior. The authorized canonical-first implementation removes it from runtime authority, API, and UI contracts while retaining earlier verification records only as historical evidence.

Any A2, B2, or C2 response requires ADR-0006 and this package to be revised and re-approved before the separate first-local-slice authorization can be effective. Partial approval never authorizes implementation of the unamended remainder.

## Separate authorization after A+B+C

All three blocks and the first local implementation slice were approved by the user on 2026-07-19:

- shared TypeScript contracts and deterministic geometry validator/canonicalizer;
- additive local schema and organization-locked helpers;
- explicit manual geometry plus deterministic DXF normalization from an authorized asset;
- one compatibility read view and source-versus-normalized overlay;
- provider-free/property/tenant/concurrency/migration/restore evidence.

This authorization would still exclude image/PDF/DWG authority, broad consumer cutover, shared database migration, commit/push/merge, deployment, IFC, adjacency, detailed BOQ, compliance, carbon, and later DI work.

## Response format

The smallest sufficient response is:

```text
A: A1 / A2 with amendments / A3
B: B1 / B2 with amendments / B3
C: C1 / C2 with amendments / C3
First local implementation slice after approval: authorize / do not authorize
```
