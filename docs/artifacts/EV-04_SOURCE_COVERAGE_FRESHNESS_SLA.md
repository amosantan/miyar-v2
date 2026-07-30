# EV-04 — Source Coverage, Freshness, and Insufficiency SLA

- Policy candidate: `ev04-claim-health-v1`
- Required-cell schema candidate: `ev04-required-cell-v1`
- Prepared: 2026-07-30
- Status: **APPROVED WITH TECHNICAL DEFAULTS, 2026-07-30**, by Amro Saleh
  acting as Data / product / source-policy owner. Incident-event retention
  remains separately gated by SC-06/PDPL.
- Proposed ADR: `ADR-0013`
- Owner required: Data / product / source-policy owner

## 1. Purpose

EV-04 defines when MIYAR may truthfully describe evidence as **current** and
when it must instead expose a qualified fallback, aging or stale evidence, an
active source incident, unknown health, or insufficiency.

This is a claim-governance contract, not a new confidence score and not a
pricing-policy change. It keeps seven facts separate:

1. whether the requested dimensions match;
2. whether the evidence is an eligible authority for the consumer;
3. how old the observation is;
4. whether the required source operation ran successfully on time;
5. whether deterministic quality checks passed;
6. the existing evidence confidence assessment; and
7. whether a blocking source incident is active.

No LLM may decide these states, thresholds, denominators, or labels.

## 2. Why this decision is required

The current checkout contains several incompatible ideas of freshness:

| Surface                | Current rule                                                      | Problem                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Customer freshness API | source fetch at most 7 days = fresh; at most 30 days = aging      | Hard-coded, unversioned, source-wide, and unrelated to the requested evidence dimensions                                  |
| Data Health            | category has fewer than 10 rows or average age over 30 days = gap | Reads all evidence without the established organization/public-corpus boundary                                            |
| Evidence freshness     | at most 90 days = fresh; at most 365 days = aging                 | Also supplies benchmark proposal weights and scheduler behavior, so changing it would change numerical/operational policy |
| Public DLD snapshot    | observed-through dates only                                       | Correctly refuses to claim completeness or live/current health, but has no approved SLA                                   |

Additional gaps:

- a failed or partial connector attempt can be mistaken for a successful fetch;
- all-empty or all-unknown inputs can appear healthy in compatibility surfaces;
- coverage is counted by category rather than by the consumer's actual required
  category, geography, tier, unit, price scope, and source authority;
- `connector_health` is per-run telemetry, not an incident lifecycle;
- reports and public shares do not bind a frozen claim-health snapshot; and
- operational source names, errors, and run identifiers are not appropriate
  customer/public provenance.

## 3. Boundaries

### EV-04 owns

- the required-cell catalogue and denominator semantics;
- the customer claim-health state machine;
- source/authority eligibility for a claim-health result;
- versioned freshness, cadence, and incident policy;
- tenant-safe evaluation inputs and safe projections;
- durable evaluated snapshots and source incidents;
- customer/admin health APIs and indicators; and
- frozen report/share health evidence.

### EV-04 does not own

- scoring or financial-policy changes;
- governed price values or source-ladder ranking;
- benchmark proposal weights or population formulas;
- the EV-03 resolver ranking or rollout;
- current stale-source scheduler triggers;
- per-source terms approval or source enablement;
- EV-05 DLD comparable selection or causal methodology; or
- EV-06 RFQ comparison and outbound supplier communication.

The existing 90/365-day evidence weighting and scheduler behavior remain
unchanged. A later decision may align them, but it requires separate numerical
and operational approval plus regression comparison.

## 4. Core vocabulary

### 4.1 Required coverage cell

A finite, versioned statement of evidence that a particular consumer needs.
It is not the cartesian product of every enum value.

The candidate key is:

```text
consumer
  : domain
  : category
  : geography
  : finishTier
  : unitBasis
  : priceScope
  : requiredAuthorityClass
```

Dimensions that genuinely do not apply use an explicit `not_applicable`
sentinel. They are never omitted and never inferred.

Supported v1 consumers:

- `project_workspace`
- `material_cost`
- `design_brief`
- `investor_summary`
- `stored_project_report`
- `public_share`
- `market_evidence`
- `admin_operations`

Supported v1 domains:

- `material_price`
- `market_transaction`
- `market_rent`
- `project_pipeline`
- `regulatory_evidence`
- `source_operations`

Each required-cell record also declares:

- `required | optional`;
- exact-match requirements;
- permitted dimensional fallbacks;
- permitted authority classes;
- permitted confidentiality;
- freshness and cadence policy references;
- whether an incident blocks the cell;
- customer/public projection rules; and
- the required-cell schema version.

#### v1 required-cell catalogue

The v1 catalogue is closed. An engineer may not add a required cell without a
new required-cell schema version.

| Catalogue ID                    | Consumer/domain                                                                             | Finite required set and denominator                                                                                                                                                                                                                                                                   | Key dimensions                                                                                                                                                 | Eligible authority                                                                                          | v1 fallback                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `material-project-v1`           | `project_workspace`, `material_cost`, `design_brief`, `investor_summary` / `material_price` | Exactly one cell for every canonical material allocation that the existing EV-03 material coverage contract marks required for the selected project snapshot. Empty allocation input is an empty required set and therefore insufficient.                                                             | Allocation category, canonical specification finish tier and unit basis, explicit project price geography, and the consumer's fixed `supply_only` price scope. | The exact EV-03 resolver result and its governed source identity; raw evidence is never evaluated directly. | Existing resolver emirate-to-UAE fallback only; it remains visible as fallback. No unit, price-scope, or tier fallback. |
| `project-report-material-v1`    | `stored_project_report` / `material_price`                                                  | The exact frozen `material-project-v1` cells used by a `project.generateReport` stored report instance. Its denominator cannot change after report creation. This binding conveys no issue, approval, or canonical-brief authority. Existing stricter full-material-report coverage remains blocking. | Identical to the bound project material cells.                                                                                                                 | Identical governed resolver results captured by the report operation.                                       | Identical to the project material snapshot and explicitly labelled.                                                     |
| `report-public-share-v1`        | `public_share` / bound report domains                                                       | The exact safe cells already bound to the shared report instance; no live cells are generated when the share is viewed. A legacy report with no EV-04 snapshot has a legacy state.                                                                                                                    | Inherited from the report snapshot.                                                                                                                            | Frozen safe projection only.                                                                                | Inherited and labelled; never recomputed.                                                                               |
| `dld-indexed-transactions-v1`   | `market_evidence` / `market_transaction`                                                    | One required cell for the indexed transaction dataset.                                                                                                                                                                                                                                                | All material dimensions `not_applicable`; geography `dubai`; authority `official_observation`.                                                                 | Governed `platform_public` DLD snapshot.                                                                    | None. SLA is deliberately unconfigured until EV-05, so v1 renders `unknown`, not Current.                               |
| `dld-indexed-rents-v1`          | `market_evidence` / `market_rent`                                                           | One required cell for the indexed rent-contract dataset.                                                                                                                                                                                                                                              | All material dimensions `not_applicable`; geography `dubai`; authority `official_observation`.                                                                 | Governed `platform_public` DLD snapshot.                                                                    | None. SLA is deliberately unconfigured until EV-05, so v1 renders `unknown`, not Current.                               |
| `dld-indexed-projects-v1`       | `market_evidence` / `project_pipeline`                                                      | One required cell for the indexed project dataset.                                                                                                                                                                                                                                                    | All material dimensions `not_applicable`; geography `dubai`; authority `official_observation`.                                                                 | Governed `platform_public` DLD snapshot.                                                                    | None. SLA is deliberately unconfigured until EV-05, so v1 renders `unknown`, not Current.                               |
| `required-source-operations-v1` | `admin_operations` / `source_operations`                                                    | One cell per source explicitly listed as required in the approved policy version. The initial v1 required-source list is empty because EV-04 does not approve source terms or enable sources. Optional source telemetry is shown separately and cannot create global Current health.                  | Source identity and configured cadence; all material dimensions `not_applicable`.                                                                              | Successful governed connector run for the exact source.                                                     | None. Empty required list returns insufficient for a global claim.                                                      |

Clarifications:

- Working design-brief and investor views reuse `material-project-v1`; EV-04
  does not create a separate hidden denominator for each page.
- BR-07 owns future canonical brief issuance. EV-04 supplies a safe snapshot DTO
  for later BR-07 consumption but does not alter the BR-07 issue ledger.
- EV-08 owns broad report-evidence binding. EV-04 binds only the claim-health
  snapshot for existing `project.generateReport` report instances and their
  report-backed shares; it does not refactor unrelated legacy design shares.
- A new domain, source requirement, report family, or brief-issue consumer
  requires `ev04-required-cell-v2` or later.

### 4.2 Match state

- `exact`: every requested key dimension matches.
- `approved_fallback`: a versioned consumer policy explicitly permits the
  fallback.
- `missing`: no eligible candidate exists.
- `invalid`: contradictory, malformed, or unrepresentable dimensions.

An approved fallback is never displayed as exact.

### 4.3 Authority state

- `governed_benchmark`
- `approved_assumption`
- `official_observation`
- `current_supplier_quote`
- `approved_synthetic`
- `raw_observation`
- `ineligible`

Authority is orthogonal to dimensional match. For example, synthetic evidence
may match every dimension exactly while remaining ineligible for an
authoritative cost claim.

### 4.4 Freshness state

- `current`
- `aging`
- `stale`
- `unknown`
- `not_applicable`

Freshness is evaluated from the observation or governed-value effective date,
not from an HTTP attempt time.

### 4.5 Cadence state

- `on_time`
- `due`
- `breached`
- `unknown`
- `not_applicable`

Cadence is evaluated from the last **successful required-source run**. A failed
or partial attempt does not reset it.

### 4.6 Quality state

- `pass`
- `warning`
- `blocking`
- `unknown`

Quality is a deterministic validation result. It is not confidence, and
confidence does not erase a quality failure.

### 4.7 Incident state

- `none`
- `advisory`
- `blocking`
- `unknown`

Incident state is derived from append-only incident events as of the evaluation
clock.

### 4.8 Customer claim state

- `current`
- `current_with_fallback`
- `qualified`
- `aging`
- `stale`
- `incident`
- `insufficient`
- `unknown`
- `legacy`

This presentation state is a deterministic projection of the orthogonal facts.
It is not a score.

## 5. Eligibility gate

Evidence may influence a customer claim-health result only when all applicable
conditions pass.

### 5.1 Corpus and tenancy

- Organization evaluation may read:
  - `corpusScope = organization` with the caller's exact organization; and
  - `corpusScope = platform_public` with no organization owner.
- `legacy_unscoped` is never eligible.
- Another organization's evidence is never eligible, including evidence marked
  public at the row level.
- Organization quotes remain confidential and same-organization only.

### 5.2 Source governance

For registry-backed evidence:

- `termsDecision = approved`;
- source is active;
- source is whitelisted;
- the captured source identity matches the governed registry identity; and
- the evidence carries the required source-policy version.

Pending or rejected terms produce an ineligible reason. They are not treated as
missing metadata.

For supplier quotes:

- the quote belongs to the caller's organization;
- the quote is not superseded;
- its validity is known and unexpired;
- the requested product/specification and price scope match; and
- the consumer is permitted to see the quote's confidentiality class.

### 5.3 Evidence governance

- Raw observations cannot directly make an authoritative customer claim.
- A governed benchmark must be approved, effective at the evaluation clock,
  unsuperseded, tenant-visible, and complete for its key.
- An assumption may support a labelled estimate but never a claim of current
  market evidence.
- Synthetic evidence is eligible only for a consumer that explicitly permits
  it and must remain labelled synthetic.
- Missing, invalid, or future observation dates cannot become current.

### 5.4 Consumer authority

Eligibility is consumer-specific:

- material calculations continue to use the EV-03 governed resolver;
- an issued material-cost total requires its existing complete authoritative
  coverage contract;
- a general report may still be produced with an explicit insufficiency state
  unless that report type already requires complete authoritative evidence;
- public shares receive only the frozen safe projection; and
- admin operational health may expose source/run details that customer
  projections cannot.

## 6. Deterministic claim rule

Plain `current` is permitted only when:

1. the required-cell set is non-empty;
2. every required cell has an eligible candidate;
3. every required cell is an exact match;
4. every required authority is allowed for the consumer;
5. freshness is `current` or `not_applicable`;
6. cadence is `on_time` or `not_applicable`;
7. quality is `pass`;
8. incident state is `none`; and
9. all required clocks, policy versions, and provenance identities are known.

`current_with_fallback` uses the same rule except one or more cells have an
explicitly approved fallback. The UI must name the fallback and may not shorten
the state to plain Current.

The aggregate projection is total and uses the first matching row:

| Priority | Deterministic condition                                                                                                                                                                                                | Customer claim state    |
| -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
|        1 | Persisted artifact has no EV-04 snapshot, or its policy/required-cell schema version is unsupported                                                                                                                    | `legacy`                |
|        2 | Any required cell has an active blocking incident                                                                                                                                                                      | `incident`              |
|        3 | Required set is empty; any cell is missing/invalid/ineligible; required observation date or quote validity is missing/future; no successful required run exists; confidentiality/tenancy fails; or quality is blocking | `insufficient`          |
|        4 | Any required observation is stale, any required quote is expired, or any required-source cadence is breached                                                                                                           | `stale`                 |
|        5 | Any required observation is aging or any required-source cadence is due                                                                                                                                                | `aging`                 |
|        6 | A required source/dataset SLA is unconfigured, telemetry cannot establish a required state, or quality/incident state is unknown without a more severe condition above                                                 | `unknown`               |
|        7 | Any required cell uses an approved assumption or approved synthetic authority, or has a quality warning or advisory incident                                                                                           | `qualified`             |
|        8 | Every other gate passes and at least one cell uses an approved dimensional fallback                                                                                                                                    | `current_with_fallback` |
|        9 | Every gate passes and every required cell is exact                                                                                                                                                                     | `current`               |

Normalization before projection is also fixed:

- a quote with missing `validUntil` is insufficient;
- an otherwise eligible quote past `validUntil` is stale;
- a missing/future required observation date is insufficient;
- `due` cadence maps to aging and `breached` cadence maps to stale;
- an advisory incident maps to qualified unless stale, aging, unknown, or a
  more severe condition already applies;
- only an event explicitly marked blocking maps to incident; being a required
  source does not automatically make every advisory incident blocking; and
- an unconfigured official/consultancy publication SLA maps to unknown.

An empty required set returns `insufficient`, never Current by vacuous truth.
No insufficient numeric input becomes AED 0.

## 7. Candidate SLA defaults requiring approval

These values are recommendations, not authority.

### 7.1 Operational cadence

| Source cadence         | Candidate `on_time`                  | Candidate `due`                | Candidate `breached` |
| ---------------------- | ------------------------------------ | ------------------------------ | -------------------- |
| Weekly required source | within 7 days of last successful run | more than 7 and at most 8 days | more than 8 days     |
| Other cadence          | source-policy interval               | interval plus approved grace   | after approved grace |

The eight-day weekly breach matches EV-08's current conservative default.
Failed and partial attempts never reset the successful-run clock.

### 7.2 Observation freshness

| Authority                             | Candidate treatment                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current supplier quote                | Current only through `validUntil`; missing validity is insufficient; expired deterministically maps to stale and is excluded from Current resolution |
| Governed market-observation benchmark | Candidate: current through 90 days, aging 91–365 days, stale after 365 days                                                                          |
| Consultancy benchmark                 | Source/publication-specific SLA plus supersession checks; unknown until configured                                                                   |
| Official statistic                    | Source/dataset-specific publication SLA plus grace; unknown until configured                                                                         |
| Approved assumption                   | Freshness `not_applicable`; presentation remains qualified assumption, never current market evidence                                                 |
| Approved synthetic                    | Policy-specific; always qualified synthetic, never plain Current                                                                                     |
| Raw observation                       | Ineligible for an authoritative customer claim regardless of age                                                                                     |

The market-observation candidate deliberately mirrors current date boundaries
for customer explanation without changing the existing confidence adjustment,
proposal weight, or scheduler logic. Approval of this table does not approve a
numerical change elsewhere.

### 7.3 Coverage

- Every required cell counts once in the denominator.
- Plain Current requires `eligible exact required cells / required cells =
100%`.
- Optional cells are reported separately and cannot improve the required ratio.
- A fallback cell remains in the denominator and is shown as fallback.
- Coverage percentages use exact integer counts; no weighted coverage score.

## 8. Initial fallback recommendations

| Domain                       | Candidate fallback                                                                   | Presentation                                                |
| ---------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Material price geography     | Emirate to UAE only when the existing resolver policy permits it                     | `current_with_fallback` or a non-current state; never exact |
| Material unit or price scope | None                                                                                 | `insufficient`                                              |
| Finish tier                  | None without a separately approved tier mapping                                      | `insufficient`                                              |
| Supplier quote               | Governed benchmark/assumption only through the existing resolver and consumer policy | Name the actual authority used                              |
| Official market dataset      | No cross-emirate substitution                                                        | `insufficient` or `unknown`                                 |
| Missing observation date     | None                                                                                 | `insufficient`                                              |
| Synthetic evidence           | Only where the consumer explicitly permits it                                        | `qualified`, visibly synthetic                              |

## 9. Source incidents

Connector telemetry is evidence for an incident, not the incident itself.

### 9.1 Candidate incident types

- required run missed;
- repeated source failure;
- source authorization or terms revoked;
- unexpected zero or anomalous extraction;
- corrupted or drifted source content;
- provenance/digest mismatch;
- quality quarantine backlog;
- confidentiality or tenant-boundary concern; and
- stale mandatory evidence used by a consumer.

### 9.2 Lifecycle

An incident has a stable key and append-only events:

```text
absent --opened--> open --acknowledged--> acknowledged
                    |                         |
                    +--------resolved-------->+
                                              |
resolved ----------------reopened------------> open
```

Every event carries:

- incident and source scope;
- severity and blocking effect;
- actor and reason;
- policy version;
- relevant run/evidence/snapshot references;
- idempotency key;
- event time and effective time; and
- audit identity.

No event is edited or deleted to rewrite history. The current state is derived
deterministically from events.

The transition/actor matrix is closed:

| Prior state  | Event          | Result state | Platform incident actor                                                                                      | Tenant incident actor                      |
| ------------ | -------------- | ------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| absent       | `opened`       | open         | Platform administrator, or a server-owned versioned detector using identity `system:<detectorPolicyVersion>` | Authorized organization administrator only |
| open         | `acknowledged` | acknowledged | Platform administrator                                                                                       | Authorized organization administrator      |
| open         | `resolved`     | resolved     | Platform administrator                                                                                       | Authorized organization administrator      |
| acknowledged | `resolved`     | resolved     | Platform administrator                                                                                       | Authorized organization administrator      |
| resolved     | `reopened`     | open         | Platform administrator, or the same class of server-owned detector after the blocking condition recurs       | Authorized organization administrator      |

All other transitions fail with a conflict and append no event. A server-owned
detector cannot acknowledge or resolve an incident, cannot create tenant
incidents, and cannot change scope. Repeating the same transition with the same
actor-bound idempotency key returns the original event only when its complete
canonical payload matches; key reuse with a different payload fails closed.
Human transitions require a live session, the exact scope-specific procedure,
and final-boundary authorization in the same transaction as the event append.

### 9.3 Scope and authorization

Every incident has exactly one scope:

| Scope            | Required identity                                                            | Permitted references                                                        | Mutation boundary                              | Influence                                                             |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| `platform`       | `orgId = null`, platform source or dataset identity                          | Platform-public source, connector run, evidence, and policy references only | `adminProcedure` platform administrator        | May affect only `platform_public` cells that name that source/dataset |
| `organization`   | Exact `orgId`; no project or quote identity                                  | Same-organization evidence/source references only                           | `orgAdminProcedure` for that organization      | May affect only that organization's cells                             |
| `project`        | Exact `orgId` and project ID proven through `requireProjectForOrg`           | Same-project/same-organization snapshot and evidence references only        | `orgAdminProcedure` plus project authorization | May affect only that project                                          |
| `supplier_quote` | Exact `orgId` and quote ID proven through the quote's organization ownership | Same-quote observations and snapshots only                                  | `orgAdminProcedure` plus quote authorization   | May affect only consumers authorized for that quote                   |

Database constraints and final-boundary helpers must reject mixed scopes,
foreign references, null organization identity on tenant incidents, or tenant
identity on platform incidents. Platform administrators do not gain
organization evidence access merely by transitioning a platform incident.
Organization administrators cannot open or transition platform incidents.

### 9.4 Severity

- `advisory`: visible qualification; does not alone block Current unless the
  required-cell policy says it does.
- `blocking`: forces the affected claim to `incident`.
- security, confidentiality, tenant-boundary, or corrupt-authority concerns are
  always blocking.

## 10. Persistence candidate

Implementation should add the minimum durable structures that preserve the
approved contract:

### `claim_health_policy_version`

- stable version and required-cell schema version;
- status (`draft | approved | superseded`);
- effective interval;
- canonical policy digest;
- approver and approval time; and
- supersession reference.

### `claim_health_snapshot`

- organization/project/consumer scope where applicable;
- evaluation clock;
- policy and required-cell schema versions;
- canonical required-cell inputs and results;
- safe provenance projection;
- input digest and content digest;
- creation actor/time; and
- immutable report/share binding identity where applicable.

Snapshots are append-only. A new evaluation creates a new snapshot.

### `source_incident`

- stable incident key, source/scope/type, opened time, and immutable identity.

### `source_incident_event`

- append-only transition, severity, blocking effect, actor, reason, effective
  time, policy/run/evidence references, idempotency key, and audit identity.

Exact SQL, indexes, foreign keys, and retention enforcement are implementation
details, but the migration must be additive-first and rollback must refuse when
later artifacts depend on a snapshot, policy, or incident.

## 11. API and projection contract

### Customer/project projection

May expose:

- customer claim state;
- evaluated-at time;
- policy version;
- required/eligible/exact/fallback counts;
- per-cell safe labels and reason codes;
- observed-through date where safe;
- assumption/synthetic/fallback qualification; and
- safe incident summary.

Must not expose:

- organization IDs;
- connector or run IDs;
- raw connector errors;
- confidential quote references, contacts, or commercial terms;
- internal source notes;
- private URLs or storage keys;
- source-policy internals that enable access probing; or
- another tenant's existence.

### Admin operational projection

May expose governed source identity, run telemetry, incident transitions, error
taxonomy, and remediation controls behind the established admin boundary.

### Public/report projection

Uses only the frozen safe snapshot. It never calls mutable live health at view
time and never carries tenant or confidential operational metadata.

## 12. Report, brief, and public-share ownership

EV-04 owns:

- the claim-health engine, policy version, required-cell schema, durable
  snapshot, safe projection, and canonical health digests;
- binding one health snapshot to each existing `project.generateReport` report
  instance in the same report-creation transaction; and
- making a report-backed public share read that report instance's frozen safe
  projection.

EV-04 does not take ownership from:

- BR-07 for canonical brief issuance, immutable brief snapshot DTOs, or its
  issue/share ledger; or
- EV-08 for broader evidence binding across all report families and scheduled
  refresh operations.

Working brief surfaces may display the project material snapshot. A future
BR-07 issue flow may consume the EV-04 safe DTO, but EV-04 does not change that
schema now. Legacy design-advisor shares that are not backed by a project report
must not display an EV-04 Current label; their broader evidence binding remains
with BR-07/EV-08.

### Binding time

For the in-scope project report, binding occurs exactly once when the report
instance is persisted, not when a PDF is rendered and not when a share token is
created or viewed.

At stored project-report generation:

1. evaluate claim health once using the same operation clock as the report;
2. persist the complete internal snapshot and canonical input/content digests;
3. bind the snapshot identity and safe projection to the report transaction;
4. include policy and required-cell schema versions in the stored report
   content without conferring issue or approval authority;
5. render PDF, DOCX, stored report, and public share from the frozen projection;
6. never reinterpret an unknown old policy version; render it as `legacy`; and
7. keep existing stricter material/report completeness gates unchanged.

The current `renderInputFingerprint` remains a render/debug fingerprint. It is
not renamed or treated as the issued health snapshot contract.

Legacy artifacts with no EV-04 snapshot remain readable and display
`Health unavailable for this legacy artifact`. They do not query current data.

## 13. Migration and recovery

- Generate an additive migration only after the policy rulings below are
  approved.
- Review every SQL statement and schema default. Unknown legacy state must
  remain unknown; no existing row is stamped with an unexecuted policy.
- Prove forward apply, empty-state compatibility, idempotency, append-only
  enforcement, transition concurrency, digest stability, report bindings, and
  rollback refusal when dependencies exist on disposable MySQL.
- Shared/production application requires an exact-target approval, restorable
  backup, dry run, recovery manifest/plan, the canonical EV-04 policy seed
  immediately after schema migration, and post-write integrity checks. The
  seed requires exact `seed@<target>` authority, or canonical combined
  `seed+migrate@<target>` authority when one approval covers both operations;
  migration-only authority cannot authorize the seed.
- Code must remain backward-compatible while legacy reports and compatibility
  callers exist.

## 14. Verification contract

### Deterministic engine

- exact, fallback, missing, invalid, empty, future-date, quote-expired,
  all-unknown, quality-warning/blocking, advisory/blocking incident, and policy
  version mismatch fixtures;
- boundary instants at every approved SLA threshold;
- same inputs and clock produce byte-stable canonical results; and
- changing any required-cell input changes the input/content digest.

### Authority and tenancy

- pending/rejected terms, inactive/unwhitelisted source, raw/unapproved,
  `legacy_unscoped`, foreign-organization, confidential-public, disallowed
  synthetic/fallback, and unsafe URL fixtures fail closed;
- admin/customer/public projections expose only their allowed fields; and
- compatibility adapters cannot downgrade insufficiency to a warning.

### Non-regression

- existing freshness weights, benchmark proposal outputs, resolver ranking,
  governed prices, scheduler triggers, and public DLD qualification remain
  unchanged.

### Cross-surface agreement

- engine, API, UI view model, stored report, PDF, DOCX, and public share agree
  for the same inputs and clock;
- bound stored reports remain unchanged after a later source failure or policy
  supersession; and
- legacy artifacts render the explicit legacy state.

### Repository gates

- targeted unit/router/report tests;
- disposable-MySQL migration/recovery and authorization tests, with
  `pnpm exec tsx scripts/seed-ev04-claim-health-policy.ts` run exactly once
  after the checked-in migration chain and before application or test traffic;
- `pnpm check`;
- DB-free suite;
- `pnpm audit:authorization`;
- `pnpm audit:database-safety`;
- `pnpm build` and bundle budgets;
- relevant critical workflow certification;
- English/Arabic, RTL, light/dark, 360/768/1440 browser and console QA;
- PDF/DOCX visual inspection;
- complete diff/security/scope review; and
- independent MIYAR Sol review.

## 15. Owner rulings

The recommended technical defaults below were approved by Amro Saleh on
2026-07-30. Incident-event retention remains separately gated and was not
approved by this decision.

|   # | Decision                   | Recommended default                                                                                                                                                                                |
| --: | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Required-cell model        | Approve the closed v1 catalogue in §4.1, including project-derived material cells, three static DLD indexed-subset cells, report inheritance, and an initially empty required-source list          |
|   2 | Plain Current              | Require a non-empty 100% exact eligible required set, current freshness, on-time cadence, passing quality, no blocking incident, and known policy/provenance                                       |
|   3 | Fallback label             | Permit only listed consumer fallbacks; show `current_with_fallback`, never plain Current or exact                                                                                                  |
|   4 | Source eligibility         | Require exact tenant/public corpus, approved terms where registry-backed, active/whitelisted source, consumer authority, confidentiality eligibility, and governed status                          |
|   5 | Weekly cadence             | `on_time` through day 7, `due` after day 7 through day 8, `breached` after day 8 from last successful required run                                                                                 |
|   6 | Observation-age candidates | Market observation 90/365; quotes through `validUntil`; consultancy and official statistics source/publication-specific and unknown until configured; assumptions/synthetic never plain Current    |
|   7 | Incident policy            | Dedicated append-only scoped incident/event lifecycle; security, tenant, confidentiality, and corrupt-authority incidents block; other incidents block only when explicitly classified blocking    |
|   8 | Insufficient reports       | General reports may render frozen insufficiency; existing artifact-specific complete-authority gates remain blocking                                                                               |
|   9 | Snapshot contract          | Persist policy + required-cell schema versions, full evaluated inputs/results, safe projection, input/content digests; bound stored-report/share views never recompute and gain no issue authority |
|  10 | Snapshot retention         | Health snapshots and safe projections remain for the life of their bound artifacts; deletion follows the artifact's approved retention/deletion lifecycle                                          |

### Separate privacy/legal retention gate

Incident-event retention is not part of the technical-default approval.
Before actor-, evidence-, quote-, project-, or organization-linked incident
history is persisted outside disposable development tests, the SC-06/PDPL owner
must approve:

- retention duration by incident scope;
- data-subject deletion and correction handling;
- legal-hold behavior;
- whether incident identity may outlive a deleted source, quote, project, user,
  or organization; and
- the minimum redacted tombstone needed for bound artifact reproducibility.

### Approval response

- **Approve EV-04 technical SLA with defaults** — accepts all ten technical
  recommendations and permits ADR-0013 acceptance plus implementation that
  does not persist privacy-gated incident history outside disposable tests.
- **Approve EV-04 incident retention:** provide the SC-06/PDPL retention,
  deletion, correction, legal-hold, and tombstone rulings separately.
- **Redline:** name the ruling number and replacement.
- **Split approval:** identify approved rulings; EV-04 remains at the human gate
  for dependent behavior.

Approval of this artifact does not authorize a shared/production migration,
production data write, source enablement, deployment, Git publication, PR, or
merge.

## 16. References

- `.agent/state/ROADMAP.md` — EV-04 and EV-08
- `docs/PRODUCT.md` — evidence-before-assertion and tenant safety
- `docs/ARCHITECTURE.md` — governed material price path and report boundaries
- `docs/VERIFICATION.md` — data, report, tenant, and release verification
- `docs/decisions/ADR-0002-deterministic-decision-authority.md`
- `docs/decisions/ADR-0011-evidence-and-price-observation-model.md`
- `server/engines/ingestion/freshness.ts`
- `server/engines/ingestion/confidence-policy.ts`
- `server/engines/ingestion/freshness-health.ts`
- `server/routers/design-market-context.ts`
- `server/db.ts`
- `shared/public-claims.ts`
- `server/engines/report-render-context.ts`
- `server/routers/project.ts`
- `server/routers/design-sharing.ts`
