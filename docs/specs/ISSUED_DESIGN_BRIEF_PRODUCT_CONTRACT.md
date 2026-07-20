# Issued Design Brief Product Contract

- Contract ID: `BR-01-v1`
- Status: Approved
- Normative language: English
- Product context: UAE; currency AED
- Decision record: [ADR-0007](../decisions/ADR-0007-issued-design-brief-product-contract.md)
- Acceptance evidence: [BR-01 golden walkthroughs](BR-01_GOLDEN_WALKTHROUGHS.md)

## 1. Purpose and Boundary

The **Issued Design Brief** is MIYAR's governed record of project intent, design decisions, deterministic calculations, evidence, assumptions, approvals, and safe-use limitations for a declared issue purpose.

An Issued Design Brief is not merely generated text, a screen, a report file, or a share link. Those are source inputs or presentations until later roadmap steps make them deterministic projections of one immutable issued snapshot.

This contract defines product semantics only. It does not change runtime DTOs, tables, APIs, calculations, reports, or sharing. Technical persistence belongs to `BR-02`, readiness implementation to `BR-03`, typology rule content to `BR-05`/`BR-06`, snapshot/report mechanics to `BR-07`, and AI evaluation to `BR-08`.

## 2. Stable Public Vocabulary

### 2.1 Section identifiers

`BriefSectionId` is the closed v1 set:

1. `intent`
2. `asset_context`
3. `space_programme`
4. `design_direction`
5. `specification_intent`
6. `cost_quantities`
7. `supply`
8. `risk_compliance`
9. `concept_media`
10. `governance`

Every brief version contains all ten section containers. A section may be non-applicable only through an approved applicability decision containing the section, issue purpose, typology/component, rationale, approver, and timestamp. Absence is never equivalent to non-applicability.

### 2.2 Achieved state

`AchievedState` is a monotonic record of the highest completed maturity gate:

`missing → drafted → evidenced → reviewed → approved → issued`

The state does not conceal overlay conditions or make the content safe for purposes beyond the declared issue.

| State       | Meaning                                                                                                             | Minimum evidence                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `missing`   | Required content is absent or unusable.                                                                             | Missing-field reasons are visible.                                                                        |
| `drafted`   | Content exists but is not sufficiently supported.                                                                   | Author, authority labels, and assumptions are recorded.                                                   |
| `evidenced` | Every claim that requires support is linked to eligible evidence or a declared assumption permitted by the purpose. | Evidence identity, provenance, date/version, and confidence are visible.                                  |
| `reviewed`  | An independent reviewer has accepted the content/evidence after all blocking findings were resolved.                | Reviewer acceptance event and resolved findings are recorded. A rejected review remains `evidenced`.      |
| `approved`  | A permitted independent approver accepts the section for the declared purpose.                                      | Approval event, purpose, limitations, and rationale are recorded.                                         |
| `issued`    | The approved content is included in an immutable brief issue.                                                       | Issue identity, issuer, purpose, version, approvals, disclaimer, and reproducibility identity are frozen. |

### 2.3 Overlay conditions

`ReadinessFlag` is independent of achieved state:

- `stale`: a named upstream dependency changed after the state was achieved.
- `blocked`: a named unresolved condition prevents the next transition or issue.

Each flag contains `kind`, reason code, human explanation, affected section, dependency reference, owner, raised timestamp, resolution requirement, and—when resolved—resolver, resolution evidence, and timestamp. An active flag prevents section approval and brief issuance. Resolving a flag does not automatically advance or restore maturity.

### 2.4 Applicability and criticality

Applicability is orthogonal to achieved state:

- `required`: the section must satisfy its purpose profile and cannot be waived.
- `conditional`: an approved profile or project condition decides whether the section is required.
- `not_applicable`: an independent Approver accepted a recorded N/A decision for a conditional section.

A non-applicable section container holds the approved applicability decision as its content. The decision progresses through `drafted → evidenced → reviewed → approved` and becomes `issued` with the brief; the applicability inputs and rationale are its evidence, and it never remains `missing` in an issue. An Author or Section Owner may propose N/A, a Reviewer must confirm the rationale/evidence, and an independent Approver must approve it. The proposer cannot review or approve their own N/A proposal.

Every field or rule used by readiness carries an approved classification:

- requirement: `required | conditional | optional`;
- impact: one or more of `coordination | decision | procurement | professional`;
- source: `BR-01-v1`, an approved typology pack/profile, or a project-specific applicability decision;
- scope: purpose, typology/component, section, and field/rule identifier; and
- authority: classifier, approver, rationale, version, and timestamp.

The BR-01 section/purpose matrix supplies the baseline. Later packs may add stricter requirements but cannot relax BR-01 without a superseding product decision. A project-specific classification may resolve only a `conditional` rule; it cannot waive a baseline `required` rule. Until an applicable rule has an approved classification, readiness fails closed with `blocked: unclassified_requirement`. “Decision-critical” means impact includes `decision`; “procurement-critical” means impact includes `procurement`; a required professional review is a rule whose impact includes `professional`. Classifications freeze with the working version and issue.

### 2.5 Issue purposes

`IssuePurpose` is the closed v1 set:

- `internal_coordination`
- `client_board_approval`
- `tender_rfq`

Purpose is frozen on issue. Reusing content for a stricter purpose requires a successor working version evaluated against the stricter profile.

## 3. Information Authority

Every material field or claim carries exactly one primary authority label and may link supporting records:

| Authority label             | Meaning                                                           | May satisfy evidence?                                                | May be silently replaced?                                                             |
| --------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `explicit_user_input`       | A named person deliberately supplied or confirmed the value.      | Yes, where the contract permits first-party confirmation.            | No.                                                                                   |
| `deterministic_calculation` | Versioned TypeScript derived the value from named inputs.         | Yes, with inputs, formula/engine version, units, and reconciliation. | No; recomputation creates a new result.                                               |
| `governed_evidence`         | A governed internal or external record supports the claim.        | Yes, subject to scope, freshness, reliability, and confidentiality.  | No.                                                                                   |
| `declared_assumption`       | A named person records an unproven working assumption and impact. | Only where the purpose profile permits it.                           | No.                                                                                   |
| `professional_signoff`      | A qualified professional accepts a defined discipline/scope.      | Yes only for that recorded scope and validity period.                | No.                                                                                   |
| `ai_suggestion`             | AI extracted, drafted, summarized, or recommended content.        | No by itself.                                                        | Never overwrites explicit input; a human must accept it into another authority class. |

AI cannot perform a review, approval, issue, professional sign-off, or authoritative numerical decision. Confidence is descriptive evidence metadata, not permission to advance state.

## 4. Canonical Sections

| Section                | Minimum content classes                                                                                                                              | Required reconciliation                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `intent`               | Objectives, desired outcomes, positioning, target users, constraints, success measures, exclusions.                                                  | Constraints and objectives must not contradict approved cost, programme, or risk decisions.    |
| `asset_context`        | UAE city/jurisdiction, typology/subtype, asset scale, project/design stage, source assets, site/unit context.                                        | Typology, location, area basis, and source identity must match downstream applicability.       |
| `space_programme`      | Spaces/units, stable identity where available, area basis, net/gross relationship, occupancy, adjacency, fit-out responsibility, benchmark variance. | Totals and area bases reconcile; unresolved conflicts are insufficient, not averaged silently. |
| `design_direction`     | Narrative, experience principles, style vocabulary, palette, material mood, lighting and spatial direction.                                          | Direction must respect intent, users, constraints, and approved concept lineage.               |
| `specification_intent` | Room/element performance, finish intent, examples, approved alternates, exclusions, durability/maintenance requirements.                             | Each relevant specification links to space/element scope and cost/supply implications.         |
| `cost_quantities`      | Deterministic quantities, units, measurement basis, price basis, AED range, waste, contingency boundary, classification, insufficiency.              | Space/element quantities, specification, price observations, and totals reconcile by version.  |
| `supply`               | Product/supplier/source identity, availability, lead time, MOQ, validity, quote/observation status, substitution strategy.                           | Supply basis aligns with specification and cost lines; estimates cannot appear as quotes.      |
| `risk_compliance`      | Design, cost, schedule, procurement and market risks; jurisdiction-aware evidence checklist; exclusions and required professional review.            | No checklist implies legal assurance; expired or missing sources remain visible.               |
| `concept_media`        | Boards/visuals, room/geometry/material references, generation/manual lineage, status, limitations, approvals.                                        | Media must trace to the applicable brief/material/geometry versions or be marked stale.        |
| `governance`           | Owners, reviewers, approvals, evidence/assumption register, confidence, version, purpose, issue identity, disclaimer, confidentiality/share policy.  | All required approvals, flags, assumptions, disclaimer, and issue metadata reconcile.          |

Professional room, area, typology, regulatory, and compliance rules are not created by this contract. Their governed content requires the later domain gates.

## 5. Functional Roles and Separation of Duties

| Role          | Permitted product actions                                                               | Prohibited actions                                                                                                |
| ------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Author        | Create or edit working content; declare sources and assumptions.                        | Review or approve their own authored section; issue by authorship alone.                                          |
| Section Owner | Assign work, resolve gaps, coordinate dependencies and responses.                       | Convert an AI suggestion or assumption into approval without required evidence/review.                            |
| Reviewer      | Independently accept or reject content/evidence and record findings.                    | Review a section they authored; issue or approve by review alone.                                                 |
| Approver      | Accept an independently reviewed section for one purpose and limitations.               | Approve a section they authored; approve while stale/blocked or with unmet purpose gates.                         |
| Issuer        | Create the brief issue after deterministic gates pass; record distribution/limitations. | Modify frozen content; bypass approval; issue a brief containing their authored section without another approver. |
| Viewer        | Read content allowed by tenant/share policy.                                            | Draft, review, approve, issue, or mutate.                                                                         |

The Issuer must be a named Approver for the brief, but another qualified Approver must independently approve every section the Issuer authored. Reviewer and Approver may be the same person only when that person did not author the section and the issue-purpose profile does not demand a separate discipline reviewer. All exceptions require an explicit policy decision in a later role implementation; none is implied here.

Conceptual mapping to current access is conservative: viewer can map only to Viewer; member may be eligible for Author, Section Owner, or Reviewer; organization admin may be eligible for Approver or Issuer. Authentication role alone never grants functional authority. BR-02 owns exact assignments and enforcement.

### 5.1 Action authority

| Action                    | May perform                                                        | Independence or approval rule                                                                           |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Draft/edit content        | Author; Section Owner                                              | Every change records its author.                                                                        |
| Declare evidence complete | Author proposes; Section Owner submits                             | Reviewer independently validates eligibility before review acceptance.                                  |
| Propose N/A               | Author; Section Owner                                              | Only for `conditional`; proposer cannot review/approve it.                                              |
| Confirm N/A rationale     | Reviewer                                                           | Reviewer cannot be the proposer/author of the applicability decision.                                   |
| Approve N/A               | Approver                                                           | Must be independent of proposer and Reviewer where a professional-impact rule requires separate review. |
| Accept/reject review      | Reviewer                                                           | Cannot have authored the section/revision.                                                              |
| Approve/withdraw approval | Approver                                                           | Cannot have authored the section/revision; purpose-specific.                                            |
| Raise stale/blocker       | Section Owner; Reviewer; Approver; deterministic readiness system  | Automated events name the triggering rule/dependency; AI cannot raise an authoritative flag.            |
| Submit flag resolution    | Author; Section Owner                                              | Cannot resolve by submission alone.                                                                     |
| Accept flag resolution    | Reviewer for evidence/content; Approver for an approval/issue gate | Must be independent of the submitted correction; records resolution evidence.                           |
| Select/upgrade purpose    | Section Owner proposes; Approver authorizes                        | Creates a successor working version; stricter requirements fail closed.                                 |
| Issue/supersede           | Issuer                                                             | All issue gates pass; Issuer is a named brief Approver.                                                 |
| Withdraw issue            | Issuer plus one independent Approver                               | Reason, recipient impact, and required action are recorded; artifact remains immutable.                 |

## 6. Transition Contract

Every transition event records brief working version, section, from/to state, actor, functional role, timestamp, action, rationale, purpose, referenced evidence/findings, and active/resolved flags.

`AchievedState` is monotonic for one **brief-version × section-content-revision × purpose binding**, not across successor bindings. Section content revisions are immutable and may be referenced by more than one binding. Creating a successor brief version deterministically creates bindings and creates or references content revisions:

- unchanged content with identical dependency fingerprint and the same purpose may reference the prior content revision in a new binding and carry its purpose-valid approval lineage; the new working binding starts `approved`, never `issued`;
- changed content or a changed/stale dependency creates a new content revision and binding at `drafted` (or `missing` when required content is absent), and prior maturity remains only on the historical binding;
- a stricter purpose creates a new binding and a new content revision for every newly required or changed field; unchanged eligible content/evidence/review may be referenced, but the new binding is capped at `reviewed` and requires purpose-specific approval;
- a resolved blocker does not change state unless the correction created a new content revision, in which case that revision follows the ordinary gates; and
- the readiness system must report the exact carried, invalidated, and newly required revision/rule identifiers. It cannot infer carry-forward from matching labels or “latest” records.

| Action                       | Preconditions                                                                     | Result                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Draft                        | Required content exists and all values have authority labels.                     | `missing → drafted`.                                                                                                                |
| Evidence complete            | Purpose-required claims have eligible evidence or permitted declared assumptions. | `drafted → evidenced`.                                                                                                              |
| Accept review                | Independent reviewer accepts content and closes findings.                         | `evidenced → reviewed`.                                                                                                             |
| Reject review                | Reviewer records findings and owner.                                              | State remains `evidenced`; a `blocked` flag is raised until resolved.                                                               |
| Approve                      | Independent approver accepts for the named purpose; no active flags.              | `reviewed → approved`.                                                                                                              |
| Withdraw approval            | Approver records reason before issue.                                             | A successor section revision is created at `reviewed`; event history remains.                                                       |
| Issue                        | Every applicable purpose gate passes atomically and no active flag exists.        | Included approved sections become `issued`; immutable issue is created.                                                             |
| Edit approved/issued content | A change is requested or upstream dependency changes.                             | A successor working version and section revision are created under the deterministic carry-forward rules; prior issue is unchanged. |
| Mark stale                   | A traced dependency changes.                                                      | Historical revision/state is preserved and `stale` is raised; successor affected revision starts `drafted` or `missing`.            |
| Resolve blocker/staleness    | Named resolution evidence satisfies the recorded requirement.                     | Flag is resolved; no automatic state advance.                                                                                       |
| Upgrade purpose              | A stricter issue purpose is selected.                                             | Successor working version is checked against the new purpose; no prior approval is assumed sufficient.                              |
| Supersede                    | A successor issue is successfully created.                                        | Prior issue remains immutable and is labelled superseded by the new issue.                                                          |
| Withdraw issue               | Issuer and one independent Approver record reason and distribution impact.        | Issue remains immutable/readable to authorized users and is labelled withdrawn; it is never deleted or silently reactivated.        |

Disallowed transitions include skipping maturity gates, AI review/approval/issue, self-review, self-approval, approval or issue with an active flag, mutating an issue, silently resetting state, using non-applicable to hide missing required content, and treating the latest record as automatically authoritative.

## 7. Issue-Purpose Profiles

All ten containers exist for every purpose. `R` means applicable and required through `approved` before issue. `C` means conditionally applicable through `approved` or explicitly non-applicable with independent approval. No active `stale` or `blocked` flag is allowed.

| Section                | Internal coordination | Client/board approval | Tender/RFQ |
| ---------------------- | :-------------------: | :-------------------: | :--------: |
| `intent`               |           R           |           R           |     R      |
| `asset_context`        |           R           |           R           |     R      |
| `space_programme`      |           R           |           R           |     R      |
| `design_direction`     |           R           |           R           |     R      |
| `specification_intent` |           C           |           R           |     R      |
| `cost_quantities`      |           C           |           R           |     R      |
| `supply`               |           C           |           C           |     R      |
| `risk_compliance`      |           R           |           R           |     R      |
| `concept_media`        |           C           |           C           |     C      |
| `governance`           |           R           |           R           |     R      |

### 7.1 `internal_coordination`

- Minimum content is sufficient for coordinated team decisions, not procurement.
- Labelled assumptions are allowed when their impact, owner, and resolution date are recorded.
- Specification-intent, quantity/cost, supply, and media sections may be non-applicable for an early coordination issue with independent approval.
- The issue states: **For internal coordination only; not authorization for procurement, construction, valuation, or professional compliance reliance.**

### 7.2 `client_board_approval`

- Decision-critical content and evidence must be approved.
- No unresolved decision-critical assumption is allowed; non-critical assumptions show impact and owner.
- Supply may be non-applicable when the board decision does not select products or procurement strategy. Concept media may be non-applicable only with recorded rationale.
- Evidence, confidence, risks, exclusions, financial basis, disclaimer, and decision requested are visible.
- The issue does not imply tender accuracy, valuation certification, or construction information.

### 7.3 `tender_rfq`

- All applicable specifications, deterministic quantities, measurement/price basis, supply validity, substitution rules, risks, and governance are approved.
- No procurement-critical assumption is allowed.
- Concept media may be non-applicable only when written specifications completely define the requested scope and an approver records why media is unnecessary.
- A tender/RFQ issue is a governed request basis, not a supplier award, construction issue, statutory approval, or professional certification.

## 8. Typology Applicability

The six BR-01 profiles are umbrella product contracts, not detailed rule packs. All use the purpose matrix above.

| Profile     | Required emphasis                                                                                                                 | Conditional treatment                                                             | Forward mapping                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Apartment   | Unit/user intent, unit plan and room programme, finish scope, repeatability where relevant.                                       | Shared-building context is recorded only when it affects the unit brief.          | Residential-unit logic; BR-06 supplies apartment pack details.                          |
| Villa       | Household/persona needs, indoor/outdoor interfaces, room/zone relationships, bespoke procurement risks.                           | Landscape/external works require explicit scope rather than assumption.           | Villa pack.                                                                             |
| Office      | Occupancy/workstyle, workplace ratios, accessibility/services interfaces, landlord/tenant responsibility.                         | Base-build services and landlord scope need explicit responsibility.              | Office pack.                                                                            |
| Hospitality | Guest/staff journeys, keys/F&B/public/back-of-house components, operator/brand standards, durability and operational replacement. | Unused hotel/F&B components are explicitly non-applicable.                        | Umbrella for later hotel/serviced-apartment and restaurant/F&B packs.                   |
| Retail      | Brand/customer journey, merchandising/operations, lease/landlord constraints, rollout, lead time and opening-date risk.           | Food-service or specialist operational components require explicit applicability. | Retail pack.                                                                            |
| Mixed-use   | Shared asset context/governance plus a component register and separate readiness for each included typology.                      | Shared sections may be reused only with explicit component applicability.         | Composite of approved component packs; residential-building pack is addressed by BR-06. |

A mixed-use issue cannot pass because one component is ready. Every included component must independently pass all applicable section and purpose gates, and shared decisions must reconcile across components.

## 9. Brief-Level Issue Gate

Issuance is allowed only when all predicates are true:

1. The organization, project, working version, typology/components, and purpose are explicit.
2. Every section container exists and is required/conditional/non-applicable according to approved matrices.
3. Every applicable readiness field/rule has a frozen approved requirement/impact classification; missing classification fails closed.
4. Every applicable section is `approved` for this purpose.
5. Every non-applicable decision completed its review/approval path and is `approved` for this purpose.
6. There is no active `stale` or `blocked` flag.
7. All required evidence, assumptions, professional reviews, and confidence disclosures are current.
8. Space totals/area basis, specification-to-quantity, quantity-to-cost, specification-to-supply, risk/limitation, and concept-media lineage reconcile or report deterministic insufficiency.
9. Authors, reviewers, approvers, and issuer satisfy separation of duties.
10. Current document identity, issue purpose, limitations, bilingual-approved disclaimer content, confidentiality, distribution/share policy, and expiry where relevant are present.
11. The issue freezes exact content and lineage. Later data cannot rewrite it.

Failure returns explicit insufficiency reasons. A percentage alone is never authority to issue.

## 10. Current Artifact Disposition

| Current path/object                             | Current reality                                                                                | BR-01 disposition                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `design_briefs` / `DesignBriefData`             | Deterministic structured JSON with six stored fields and inconsistent “7 section” commentary.  | **Legacy compatibility input.** Candidate source data for canonical sections after BR-02 mapping; never an issued brief by itself.    |
| `ai_design_briefs`                              | Separate AI-advisor narrative with public share token/version.                                 | **Derived/legacy presentation.** AI content remains suggestion/draft; current share is not a canonical issue.                         |
| Autonomous design brief Markdown                | LLM-authored narrative headings.                                                               | **Deprecated as an authority candidate.** It may remain an assisted draft source only if BR-08 evaluation and human acceptance apply. |
| `report_instances` brief report types           | Stored/generated report outputs with multiple brief labels.                                    | **Legacy compatibility presentations.** BR-07 will generate report variants from one snapshot.                                        |
| Project `generateReport` paths                  | Can rebuild a brief from current project data rather than an approved stored brief.            | **Deprecated candidate behavior for issued output.** Preserve runtime compatibility until BR-07 supplies migration/deprecation.       |
| DOCX/PDF/HTML exports                           | Format-specific outputs generated from current inputs.                                         | **Future derived presentations.** They become issued only when byte/content identity traces to the BR-07 snapshot.                    |
| RFQ generation from structured brief            | Uses one current brief shape to create procurement lines.                                      | **Downstream consumer.** Tender/RFQ use must later require an eligible `tender_rfq` issue.                                            |
| Public brief share                              | Read-only, token/expiry guarded, but exposes the latest AI brief and recomputes context.       | **Secure legacy share presentation, not an issue.** BR-07 owns immutable issued sharing while retaining token/privacy controls.       |
| Project approval state                          | Whole-project states unrelated to brief section/version readiness.                             | **Adjacent legacy signal.** It cannot approve or issue a brief; BR-02 defines compatibility.                                          |
| Project evaluation readiness                    | Measures confirmed model inputs, including legacy compatibility.                               | **Separate contract.** It cannot be reused as Brief Readiness.                                                                        |
| Material Board Annex and issued disclaimer/copy | Certified report requirements with truthful empty/error states and approved bilingual wording. | **Preserved downstream constraints.** No BR-01 interpretation may weaken or silently rewrite them.                                    |

No current object is retrospectively declared issued.

## 11. Immutability, Supersession, and Reproducibility

Product invariants:

- An issue is an immutable information container with stable identity, version, purpose, content, authority labels, evidence/assumptions, approvals, disclaimer, and distribution policy.
- Issued content never follows “latest” project, benchmark, price, model, prompt, material, geometry, or media records.
- A later dependency change may mark the issue stale in an external status index, but cannot alter its frozen payload.
- A successor issue records which issue it supersedes and why. Supersession does not erase or rewrite history.
- Withdrawal records status/reason/distribution impact without deleting the issue.
- BR-02 owns storage/API/version architecture. BR-07 owns the canonical snapshot DTO, hashes, rendering reconciliation, and issued share mechanics.

## 12. Preserved Safety and Product Invariants

- Organization authorization remains mandatory; public access remains read-only, token-gated, expiry-aware, concealed on failure, and privacy-header protected.
- Deterministic TypeScript remains numerical authority. No issue contract changes weights, prices, quantities, thresholds, or grades.
- UAE/AED defaults and provenance/assumption labels remain visible.
- Explicit developer inputs are never silently overwritten by AI or regeneration.
- Compliance content is an evidence checklist with exclusions, not legal or professional assurance.
- Existing bilingual issued disclaimers and approved financial/evidence qualifications remain unchanged until separately approved.
- Material Board Annex presence and truthful empty/error behavior remain mandatory where the report contract requires them.

## 13. Acceptance and Change Control

`BR-01-v1` was accepted on 2026-07-20 after:

- the user, acting as product owner, design-domain owner, and report owner, approved this exact contract and its six golden walkthroughs;
- identifier, matrix, transition, negative-path, link, formatting, consumer-trace, diff, and scope checks pass;
- independent Claude review has no unresolved blocking objection; and
- the roadmap/task/worklog/project-state closeout truthfully records the evidence.

Changing section IDs, state semantics, purpose taxonomy, separation of duties, issue gates, or safety limitations requires a superseding approved product decision. Implementation details may evolve under later roadmap steps only while preserving this contract.
