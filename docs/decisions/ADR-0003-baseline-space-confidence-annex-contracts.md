# ADR-0003: Baseline Space, Confidence, and Annex Contracts

- Status: Accepted
- Date: 2026-07-17
- Deciders: Amro Saleh, Product Owner and acting Data/Decision-model and Design/Report approver for this bounded decision
- Technical area: Space intelligence, evidence ingestion, and issued reports
- Supersedes: none
- Policy bundle: `TR-08-v1`
- Effective implementation: 2026-07-16 at commit `db362540dbccdc621faf38ef74c3270ebee6370b`

## Context

TR-08 resolved three disagreements between tests and implementation: the result for an AI floor-plan analysis with no rooms, the deterministic source-confidence formula, and the required presence of the Material Board Annex. The approved behaviors were implemented under TR-09 and verified, but TR-08 closed without the promised durable record of owners, rationale, accepted examples, affected consumers, limitations, and effective versions.

That omission makes a future test or implementation change look like a local repair even when it changes product policy, evidence authority, or issued-report content. This ADR records the already-approved behavior. It does not repair the downstream ambiguities identified during recertification; those are assigned to a separately reopened TR-09.

## Decision

### 1. Empty AI floor-plan analysis — `space-empty-v1`

When `benchmarkSpaceRatios` receives a `FloorPlanAnalysis` whose `rooms` array is empty, it returns:

- `overallEfficiencyScore: 50` as the approved neutral fallback;
- `recommendations: []`;
- `totalCritical: 0` as a present field;
- `totalAdvisory: 0` as a present field;
- `totalOptimal: 0` as a present field.

The engine must not invent room recommendations or deviations without rooms. This contract applies specifically to the empty AI floor-plan room list consumed by the space-ratio benchmark engine; it does not define the persisted space-program router's empty-read contract.

The value 50 is the existing neutral numerical fallback, not proof that a layout was measured at 50/100. Current consumers do not carry that distinction explicitly. TR-09 must address the ambiguity without changing this ADR in place.

### 2. Connector initial confidence — `ingestion-confidence-v1`

Connector-derived initial confidence remains deterministic TypeScript. The current `computeConfidence` policy is:

| Reliability grade | Base confidence |
| ----------------- | --------------: |
| A                 |            0.85 |
| B                 |            0.70 |
| C                 |            0.55 |

Publication age is evaluated in whole days with `Math.floor((fetchedAt - publishedDate) / 86,400,000)`:

- age at or below 90 days: add 0.10;
- age from 91 through 365 days: no adjustment;
- age above 365 days: subtract 0.15;
- missing publication date: subtract 0.15;
- final result: clamp to the inclusive range 0.20–1.00.

The clamp is a defensive bound. With the current three grades and single adjustment, reachable results are 0.40–0.95; no current combination activates the 0.20 floor or 1.00 cap.

RICS is currently assigned Grade A through the deterministic source registry. A named source's grade assignment is numerical policy and requires a superseding ADR with the same approval discipline as changing a base or threshold. All callers must provide the evaluation time to `computeConfidence`; tests use an explicit fixed `fetchedAt` so wall-clock time cannot change expected results.

This policy defines the initial confidence returned by connectors, not every final stored evidence score. The orchestrator can reduce connector confidence for quality flags to as low as 0.10, and an update retains the maximum of the new and existing stored scores. Consequently, a newly quality-reduced score cannot lower an older higher score, while a later higher score can replace an older lower score; the stored number does not preserve that interaction. CSV ingestion bypasses `computeConfidence` and currently assigns 0.90 to Grade A and 0.70 to Grades B and C. Those transformations and alternate paths do not carry a policy-chain identity.

The current function treats future publication dates as age below 90 and therefore applies the recency bonus; a valid future date passes ingestion validation and can become a future capture date. Dynamic and crawler extraction can also construct an invalid `Date` from unvalidated text, but the orchestrator's schema validation silently filters that entire evidence item before normalization or persistence. If `computeConfidence` is called directly without that validation, comparisons with an invalid date's `NaN` age are false and the function returns the unadjusted base. These are documented limitations tracked by KF-016, not approved evidence semantics. TR-09 owns invalid/future-date handling, rejection visibility, clock provenance, policy-chain identity, quality adjustment, update merge, and non-connector ingestion behavior.

### 3. Material Board Annex — `material-board-annex-v1`

The Material Board Annex is mandatory in both supported issued-output paths:

- design brief HTML;
- full evaluation report HTML.

When board summaries exist, the annex renders the board names and summary information. When the supplied board-summary collection is absent or empty, the annex still renders with the explicit no-board message. The annex is not made conditional on whether boards exist.

This decision does not extend the annex to validation summaries, autonomous design briefs, or other output types. Adding it to another output requires a separately approved report-contract change.

The current report route converts a board-retrieval failure into the same empty collection used for a genuine no-board state. An existing board with zero resolved items is omitted from the summary and can produce the same message. A partially resolved board is rendered using only its resolved items, without identifying the missing items. Those ambiguities are not approved report semantics; TR-09 must distinguish retrieval failure and unresolved, partially resolved, or empty existing boards from true absence before TR-10 performs full issued-artifact certification.

## Accepted Examples and Boundaries

| Contract                  | Input                           | Required result                                                                   |
| ------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `space-empty-v1`          | `rooms: []`                     | Score 50, no recommendations, all severity counts zero                            |
| `space-empty-v1`          | One or more rooms               | Calculate the measured result through the existing deterministic benchmark engine |
| `ingestion-confidence-v1` | Connector Grade A, age 90 days  | Initial confidence 0.95                                                           |
| `ingestion-confidence-v1` | Connector Grade A, age 91 days  | Initial confidence 0.85                                                           |
| `ingestion-confidence-v1` | Connector Grade A, age 365 days | Initial confidence 0.85                                                           |
| `ingestion-confidence-v1` | Connector Grade A, age 366 days | Initial confidence 0.70                                                           |
| `ingestion-confidence-v1` | Connector Grade B, missing date | Initial confidence 0.55                                                           |
| `ingestion-confidence-v1` | Connector Grade C, missing date | Initial confidence 0.40; the defensive floor is not activated                     |
| `material-board-annex-v1` | Populated summaries             | Annex heading and board summaries in design and full reports                      |
| `material-board-annex-v1` | Empty summaries                 | Annex heading and explicit no-board state in design and full reports              |

## Decision-to-Consumer Trace

| Contract                  | Authoritative implementation                  | Current consumers                                                                                                                    | Recertification limitation                                                                                                                                               |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `space-empty-v1`          | `server/engines/design/space-benchmarking.ts` | Project evaluation, normalization/scoring, ROI, Space Planner, and Investor Summary                                                  | Neutral fallback is indistinguishable from a measured score and can be presented as DLD-backed                                                                           |
| `ingestion-confidence-v1` | `server/engines/ingestion/connector.ts`       | Static, dynamic, PDF, and crawler connectors provide initial confidence; the orchestrator adjusts/merges before evidence persistence | Stored evidence lacks the full policy-chain identity; max-merge can mask a new quality reduction; CSV uses a different formula; future/invalid-date policy is incomplete |
| `material-board-annex-v1` | `server/engines/pdf-report.ts`                | Organization-guarded report generation for design briefs and full reports                                                            | Load failure, empty/zero-resolved boards, and genuine no-board state converge; partial resolution is rendered without disclosure                                         |

## TR-09 Remediation Boundary

TR-09 is reopened after this decision record closes. Its acceptance package is prose and behavioral boundaries only at this stage; this ADR does not prescribe TypeScript types, API shapes, schema columns, migrations, or UI components.

TR-09 must produce independently approved and tested behavior for:

1. distinguishing the empty neutral fallback from measured space evidence across presentation, scoring, and ROI;
2. retaining the full confidence-policy chain across connector calculation, quality adjustment, update merge, and non-connector ingestion, while deciding clock provenance plus invalid/future-date and rejection-visibility handling;
3. distinguishing a genuine no-board state, board-retrieval failure, and existing boards with zero, partially resolved, or wholly unresolvable items across design-brief and full-report generation.

TR-10 remains planned until this remediation is closed, then certifies the complete report fixture and rendering matrix.

## Consequences

### Positive

- Tests and future changes have an explicit product authority and versioned reference.
- Numerical policy remains deterministic and cannot be recalibrated as a test repair.
- Issued reports retain the approved annex requirement even when no boards exist.
- Known downstream ambiguity is visible rather than being silently normalized as intended behavior.

### Negative and trade-offs

- The neutral value 50 remains consumable as a number until TR-09 adds an approved distinction.
- Existing evidence rows cannot identify which confidence-policy chain produced their final score or whether max-merge masked a later quality reduction.
- Report generation can currently misdescribe a board-load failure or existing zero-resolved board as a no-board state and does not disclose partial resolution.

### Risks and mitigations

- Risk: a future engineer treats 50 as measured evidence. Mitigation: this ADR labels it a neutral fallback and KF-016 blocks closure until consumers distinguish it.
- Risk: confidence values become historically irreproducible after a formula change or merge masks a quality reduction. Mitigation: connector-initial values are frozen as `ingestion-confidence-v1`; TR-09 owns retained identity and semantics for the full calculation chain.
- Risk: an issued report makes a false no-board claim or silently omits unresolved board content. Mitigation: KF-016 records the failure and TR-09 precedes TR-10 certification.

## Alternatives Considered

### Block empty floor-plan analysis as insufficient

Not selected for `space-empty-v1`. The product owner reaffirmed the existing neutral 50 fallback. A future insufficiency contract requires a superseding decision and impact analysis across scoring, ROI, and UI consumers.

### Generate fallback room recommendations

Rejected because recommendations without rooms would imply evidence the engine does not possess.

### Recalibrate confidence values or thresholds during recertification

Rejected because no new calibration evidence or domain approval supports a numerical policy change. Recalibration requires a superseding ADR and old-versus-new result evidence.

### Omit an empty Material Board Annex

Rejected because annex presence is part of the approved design-brief and full-report contract; explicit emptiness is more truthful than silent omission.

### Repair downstream interfaces inside TR-08

Rejected because TR-08 is a decision recertification. Mixing runtime, schema, and report changes would obscure the human policy gate and exceed the approved scope.

## Verification

- Empty-room characterization asserts score 50, no recommendations, and zero severity counts.
- Confidence characterization asserts connector-initial Grade A/B/C bases, fixed-time 90/91 and 365/366 boundaries, missing-date penalty, current reachable bounds, and the defensive clamp invariant.
- Annex characterization asserts populated and empty states in both design-brief and full-report HTML.
- Safe full suite, TypeScript, authorization audit, production build, documentation formatting, and diff review must pass.
- Independent Claude review must find no unresolved policy or interface choice hidden inside TR-08.

## Migration and Rollback

This ADR records existing behavior and requires no runtime, data, schema, API, dependency, deployment, or database migration. Reverting the characterization/decision change would remove governance evidence but would not change application behavior.

Accepted ADRs are not edited to change policy. Any change to these values, boundaries, report scope, or authority requires a new ADR that supersedes this one, names its effective version, compares old and new results, and records the required product/domain approval.

## References

- `.agent/state/ROADMAP.md` (`TR-08`, `TR-09`, and `TR-10`)
- `.agent/state/KNOWN_FAILURES.md` (`KF-016`)
- `server/engines/v9-space.test.ts`
- `server/engines/v2-connectors.test.ts`
- `server/engines/board-pdf.test.ts`
- `docs/decisions/ADR-0002-deterministic-decision-authority.md`
