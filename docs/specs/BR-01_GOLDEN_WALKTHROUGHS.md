# BR-01 Golden Issued-Brief Walkthroughs

- Fixture set: `BR-01-golden-v1`
- Status: Approved
- Contract: [Issued Design Brief Product Contract](ISSUED_DESIGN_BRIEF_PRODUCT_CONTRACT.md)
- Data policy: wholly synthetic UAE projects; AED; no customer or production data

## How to Read the Fixtures

Each fixture demonstrates product rules, not a runtime payload. `A` means approved and eligible to become `issued` atomically. `N/A` means independently approved non-applicability. All ten containers exist even when non-applicable.

Named people are fictional. AI is never a functional actor. Every fixture assumes organization authorization, a versioned working brief, recorded transition events, and current approved disclaimer text.

## 1. Apartment — Internal Coordination

- **Project:** Al Safa Two-Bedroom Show Unit, Dubai
- **Purpose:** `internal_coordination`
- **Safe use:** Coordinate developer and designer direction only; no procurement, construction, valuation, or compliance reliance.

| Section                | Result | Authority/evidence and decision                                                                                       |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `intent`               | A      | Developer-confirmed target residents, leasing outcome, AED budget ceiling, and explicit exclusions.                   |
| `asset_context`        | A      | User-confirmed Dubai location/unit subtype plus source plan identity; area basis labelled source-stated.              |
| `space_programme`      | A      | Living, kitchen, two bedrooms and support spaces; source-stated areas with a declared survey-confirmation assumption. |
| `design_direction`     | A      | Human-accepted warm contemporary direction; AI mood words retained only as accepted draft content.                    |
| `specification_intent` | A      | Performance-level finish intent without selected products.                                                            |
| `cost_quantities`      | N/A    | Early coordination issue does not authorize quantities/cost plan; approver records rationale.                         |
| `supply`               | N/A    | No product selection or procurement decision.                                                                         |
| `risk_compliance`      | A      | Area verification, landlord approvals, lead-time and budget risks; evidence checklist expressly not assurance.        |
| `concept_media`        | A      | One mood board traces to the working direction/material references and is approved for coordination only.             |
| `governance`           | A      | Purpose, assumptions, roles, version, disclaimer, distribution and limitation recorded.                               |

**Actors:** Noor (Author), Kareem (Section Owner), Lina (Reviewer), Mariam (Approver and Issuer). Mariam authored no section.

**Positive path:** Missing → drafted → evidenced → reviewed → approved for every applicable section; deterministic issue gate passes; the immutable issue records approved N/A decisions.

**Negative paths:**

- An AI-generated palette cannot move `design_direction` from drafted to evidenced or reviewed.
- Noor attempts to approve `intent`, which she authored; the transition is denied as self-approval.
- A missing source-plan identity keeps `asset_context` at drafted and blocks issue rather than being hidden by the 90% complete UI.

## 2. Villa — Client/Board Approval

- **Project:** Jumeirah Family Villa Refurbishment, Dubai
- **Purpose:** `client_board_approval`
- **Decision requested:** Approve spatial/design direction and AED investment range for detailed design.

| Section                | Result | Authority/evidence and decision                                                                            |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `intent`               | A      | Household personas, entertaining/privacy outcomes and budget tolerance explicitly confirmed.               |
| `asset_context`        | A      | Villa, Dubai jurisdiction, refurbishment stage, source survey and indoor/outdoor scope.                    |
| `space_programme`      | A      | Reviewed family/guest/service zones; professional survey areas retained separately from fit-out scope.     |
| `design_direction`     | A      | Board-facing experience principles, palette and material mood aligned to intent.                           |
| `specification_intent` | A      | Durability/performance intent and bespoke/standard scope, without tender product commitments.              |
| `cost_quantities`      | A      | Deterministic AED range with area/price basis, contingency boundary and stated insufficiencies.            |
| `supply`               | N/A    | Board decision excludes product/supplier selection; independently approved rationale.                      |
| `risk_compliance`      | A      | Existing-condition, programme, authority, cost and procurement risks with required professional follow-up. |
| `concept_media`        | A      | Approved board and visuals with source-room/material lineage.                                              |
| `governance`           | A      | Decision, evidence/assumption register, confidence, disclaimer and named approvals frozen.                 |

**Actors:** Hamad (Author), Sara (Section Owner), Reem (Reviewer), Fatima (Approver), Omar (Issuer and named brief Approver). Omar authored no section.

**Rejected review:** Reem rejects `cost_quantities` because the external-works boundary is absent. The section remains evidenced and gains `blocked: unresolved_scope_boundary`. After Hamad adds the boundary and evidence, Reem closes the finding; Fatima approves. No rejection is erased.

**Stale dependency:** After issue, the confirmed source survey changes the kitchen area. The issued artifact remains byte/content immutable. An external status records the affected `space_programme`, `specification_intent`, `cost_quantities`, and `concept_media` dependencies as stale. A successor working version re-evidences only affected sections, receives fresh review/approval, and becomes issue 2; issue 1 is labelled superseded, not rewritten.

**Complete stale record:** `kind=stale`; `reasonCode=source_survey_superseded`; explanation “Kitchen boundary changed in survey revision S-03”; `section=space_programme`; `dependency=survey:S-02→S-03`; owner Kareem; raised `2026-07-20T09:00:00+04:00`; resolution requirement “Reconcile S-03 areas and trace affected specification, cost, and media revisions.” Kareem submits the reconciled successor revisions; Reem independently accepts evidence `reconciliation:VILLA-S03-01`; Fatima resolves the approval gate at `2026-07-20T15:30:00+04:00`. The historical section revision remains issued; the successor affected revision starts drafted and follows the ordinary gates.

## 3. Office — Tender/RFQ

- **Project:** DIFC Professional Services Office Fit-Out, Dubai
- **Purpose:** `tender_rfq`
- **Safe use:** Governed RFQ basis; not supplier award, construction issue, statutory approval, or professional certification.

| Section                | Result | Authority/evidence and decision                                                                             |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `intent`               | A      | Occupancy, hybrid-work, client experience, programme, operational and cost objectives.                      |
| `asset_context`        | A      | Tenancy/floor, landlord requirements, source records, fit-out responsibility and design stage.              |
| `space_programme`      | A      | Stable spaces, occupancy, adjacency and reconciled area bases.                                              |
| `design_direction`     | A      | Approved workplace principles and palette linked to client-facing/internal zones.                           |
| `specification_intent` | A      | Element-level performance and alternates linked to space/finish scope.                                      |
| `cost_quantities`      | A      | Deterministic quantities and AED ranges linked by stable scope, formula/engine, units and price basis.      |
| `supply`               | A      | Supplier/product identity, availability, MOQ, lead time, quote/observation validity and substitution rules. |
| `risk_compliance`      | A      | Landlord, authority, accessibility, programme, procurement and services risks with exclusions.              |
| `concept_media`        | N/A    | Written specification fully defines RFQ scope; independent approver records that imagery is unnecessary.    |
| `governance`           | A      | Tender purpose, approvals, confidentiality/distribution, disclaimer, assumptions and issue identity.        |

**Actors:** Daniel (Author), Aisha (Section Owner), Youssef (Reviewer), Salma (Approver), Khalid (Issuer and named brief Approver). Khalid authored no section.

**Procurement-critical assumption:** A provisional imported-stone lead time is labelled assumption. Because it affects tender comparison, `supply` remains blocked. It cannot be waived through a confidence score. A governed supplier observation or approved substitution is required before review/approval and issue.

**Denied issue:** Khalid attempts issue while the supply blocker is active; the deterministic gate returns the exact section, reason, owner and resolution requirement. Once resolved, the complete brief issues atomically.

**Complete blocked record:** `kind=blocked`; `reasonCode=procurement_critical_assumption`; explanation “Imported-stone lead time lacks an eligible dated supplier observation”; `section=supply`; `dependency=supply-line:STONE-04`; owner Aisha; raised `2026-07-20T10:15:00+04:00`; resolution requirement “Provide a governed in-scope supplier observation or approve a compliant substitution.” Daniel submits observation `supplier-observation:SO-204`; Youssef independently accepts its scope/validity; Salma accepts the resolution at `2026-07-20T13:40:00+04:00`. Resolution removes the flag but does not advance state automatically.

## 4. Hospitality — Client/Board Approval

- **Project:** Ras Al Khaimah Boutique Resort Concept, UAE
- **Purpose:** `client_board_approval`
- **Hospitality components:** guest rooms, public areas and back-of-house; restaurant design is excluded from this issue.

| Section                | Result | Authority/evidence and decision                                                           |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `intent`               | A      | Guest proposition, operator outcomes, key count, experience and investment constraints.   |
| `asset_context`        | A      | RAK jurisdiction, resort subtype, stage, component register and source files.             |
| `space_programme`      | A      | Guest/staff/service journeys, keys/public/BOH scope and reconciled programme.             |
| `design_direction`     | A      | Experience principles and differentiated guest/public-area directions.                    |
| `specification_intent` | A      | Durability, maintenance, housekeeping and replacement intent.                             |
| `cost_quantities`      | A      | Board-level AED range with component/area basis and explicit uncertainty.                 |
| `supply`               | N/A    | Product sourcing is outside the concept decision; rationale independently approved.       |
| `risk_compliance`      | A      | Operator, fire/life-safety referral, programme, coastal durability and procurement risks. |
| `concept_media`        | A      | Component-specific boards and visuals with approved lineage/status.                       |
| `governance`           | A      | Restaurant/F&B marked excluded—not silently absent—and issue limitations recorded.        |

**Actors:** Maya (Author), Rashid (Section Owner), Leila (Reviewer), Nasser (Approver), Huda (Issuer and named brief Approver). Huda authored no section.

**Umbrella applicability:** Hospitality covers hotel/serviced-apartment and F&B at contract level. This fixture does not invent detailed room, operator, F&B or compliance rules; BR-06 owns those packs.

**Denied shortcut:** A high-confidence AI summary of an operator standard remains `ai_suggestion`; without the governed source and human review it cannot evidence or approve `specification_intent`.

## 5. Retail — Tender/RFQ

- **Project:** Dubai Mall Fashion Flagship Refresh, Dubai
- **Purpose:** `tender_rfq`
- **Critical date:** Synthetic seasonal opening date.

| Section                | Result | Authority/evidence and decision                                                         |
| ---------------------- | ------ | --------------------------------------------------------------------------------------- |
| `intent`               | A      | Brand, customer journey, merchandising, operational and opening-date objectives.        |
| `asset_context`        | A      | Unit/lease constraints, landlord manual identity, stage and source survey.              |
| `space_programme`      | A      | Sales, fitting, cashwrap, stock, staff and display zones with reconciled scope.         |
| `design_direction`     | A      | Approved brand expression and journey principles.                                       |
| `specification_intent` | A      | High-wear performance, display flexibility, lighting intent, alternates and exclusions. |
| `cost_quantities`      | A      | Deterministic measured scope and AED range, with waste/contingency boundaries.          |
| `supply`               | A      | Availability, lead times, MOQ, validity and substitution rules tied to opening risk.    |
| `risk_compliance`      | A      | Landlord, authority referral, programme, logistics, procurement and operational risks.  |
| `concept_media`        | A      | Approved elevations/boards linked to current layout and specification versions.         |
| `governance`           | A      | Tender/RFQ limitation, approvals, confidentiality, issue/distribution and disclaimer.   |

**Actors:** Zain (Author), Priya (Section Owner), Ahmed (Reviewer), Dana (Approver), Tarek (Issuer and named brief Approver). Tarek authored no section.

**Purpose upgrade:** An earlier `internal_coordination` issue allowed a labelled display-system cost assumption. Selecting `tender_rfq` creates a successor version and reevaluates every tender requirement. The prior approval does not carry forward automatically; the display scope must gain governed evidence, review and approval.

**Supersession:** Tender issue 2 supersedes coordination issue 1 for tender use. Issue 1 remains available as historical coordination evidence and is not retroactively labelled tender-ready.

## 6. Mixed-Use — Internal Coordination Upgraded to Board

- **Project:** Abu Dhabi Waterfront Mixed-Use Podium, UAE
- **Components:** residential apartments, retail podium and hospitality lobby
- **Initial purpose:** `internal_coordination`
- **Successor purpose:** `client_board_approval`

| Section                | Shared/component treatment                                                  | Initial result |
| ---------------------- | --------------------------------------------------------------------------- | -------------- |
| `intent`               | Shared development objectives plus component-specific outcomes.             | A              |
| `asset_context`        | Shared site/jurisdiction/stage and explicit component register.             | A              |
| `space_programme`      | Separate component readiness plus reconciled shared circulation/interfaces. | A              |
| `design_direction`     | Shared public-realm principles plus component directions.                   | A              |
| `specification_intent` | Component scopes; hospitality lobby draft is incomplete.                    | Blocked        |
| `cost_quantities`      | Component bases and shared-cost allocation; retail evidence incomplete.     | Blocked        |
| `supply`               | N/A for initial coordination with approved rationale.                       | N/A            |
| `risk_compliance`      | Shared and component risk registers; responsibility boundaries.             | A              |
| `concept_media`        | Shared podium board plus traced component boards.                           | A              |
| `governance`           | Component owners/readiness and shared decisions visible.                    | A              |

**Actors:** Layla (Author), Faisal (Section Owner), Rania and Victor (component Reviewers), Amal (Approver), Saeed (Issuer and named brief Approver). Saeed authored no section.

**Mixed-use partial-readiness denial:** Residential is ready, but hospitality specification intent and retail cost evidence are incomplete. The whole mixed-use brief cannot issue. Shared readiness cannot average or hide the blocked components.

**Blocker resolution:** Component owners supply eligible evidence; the affected sections proceed through review and approval. The internal issue then passes.

**Board upgrade:** Selecting `client_board_approval` creates a successor. `supply` is evaluated against the board decision and remains N/A only because no product/procurement choice is requested; Amal independently approves the rationale. Decision-critical assumptions are resolved, component and shared approvals are current, and the board issue succeeds. The internal issue remains immutable and is superseded for board-decision use.

## Scenario Coverage Matrix

| Required scenario                    | Fixture evidence                                     |
| ------------------------------------ | ---------------------------------------------------- |
| Self-approval denied                 | Apartment                                            |
| AI approval/evidence shortcut denied | Apartment; Hospitality                               |
| Missing evidence blocks maturity     | Apartment; Retail                                    |
| Rejected review and resolution       | Villa                                                |
| Active blocker prevents issue        | Office; Mixed-use                                    |
| Stale dependency after issue         | Villa                                                |
| Critical assumption policy           | Office; Retail                                       |
| Purpose upgrade                      | Retail; Mixed-use                                    |
| Successor version and reapproval     | Villa; Retail; Mixed-use                             |
| Supersession without mutation        | Villa; Retail; Mixed-use                             |
| Approved non-applicability           | Apartment, Villa, Office, Hospitality, and Mixed-use |
| Mixed-use partial readiness denied   | Mixed-use                                            |
| Issue withdrawal semantics           | Contract transition table; exercise below            |

## Cross-Fixture Withdrawal Exercise

After the Office tender issue is distributed, the landlord publishes a superseding fit-out manual. The Issuer and one independent Approver record the issue as withdrawn with reason, affected recipients and required action. The artifact remains immutable and readable to authorized users; it is not deleted, edited, or automatically reactivated. A successor working version raises stale flags on `asset_context`, `specification_intent`, `cost_quantities`, `risk_compliance`, and `governance`, then follows the ordinary evidence/review/approval/issue path.

## Acceptance Checklist

- All ten `BriefSectionId` values appear in every fixture.
- All six `AchievedState` values are exercised across positive/negative paths.
- Both `stale` and `blocked` contain explicit cause and resolution behavior.
- All three `IssuePurpose` values are exercised.
- Apartment, villa, office, hospitality, retail and mixed-use applicability is explicit.
- No AI action is treated as review, approval, issue or numerical authority.
- No fixture introduces real customer data, professional compliance rules, runtime schema/API design, or unapproved financial policy.
