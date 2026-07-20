# ADR-0007: Issued Design Brief product contract

- Status: Accepted
- Date: 2026-07-20
- Deciders: Product owner; design-domain owner; report owner
- Technical area: Product governance, brief lifecycle, report identity, and human/AI authority
- Supersedes: None

## Context

MIYAR has several incompatible artifacts called a design brief:

- `design_briefs` stores a deterministic structured brief in six JSON fields while nearby commentary calls it seven sections;
- `ai_design_briefs` stores a separate AI-advisor narrative and supplies the current public share;
- autonomous generation produces free-form AI Markdown;
- report routes and format-specific exports can rebuild brief content from current project data;
- RFQ generation consumes the structured brief while sharing consumes the AI brief;
- project approval and project evaluation readiness are whole-project contracts, not section/version brief governance.

None proves one canonical set of sections, evidence, assumptions, roles, purpose, approvals, issue identity, or immutable content. Therefore two outputs called “the brief” can disagree, and generation/export/share can be mistaken for an issued professional record.

The product audit recommends one versioned object with ten governed sections and deterministic maturity. `TR-13` confirmed that the public artifact remains the AI-advisor brief rather than the structured brief or stored report, leaving unification to BR-01/BR-02.

## Decision

MIYAR adopts the product contract in [Issued Design Brief Product Contract](../specs/ISSUED_DESIGN_BRIEF_PRODUCT_CONTRACT.md), subject to exact owner approval.

### Canonical object

An Issued Design Brief is the governed, immutable record of project intent, asset context, space programme, design direction, specification intent, cost and quantities, supply, risk/compliance evidence, concept media, and governance for one declared purpose.

The stable `BriefSectionId` set is `intent`, `asset_context`, `space_programme`, `design_direction`, `specification_intent`, `cost_quantities`, `supply`, `risk_compliance`, `concept_media`, and `governance`.

Existing structured briefs, AI briefs, autonomous narratives, reports, exports, RFQs and share views are not retrospectively canonical or issued. They remain legacy inputs, derived/legacy presentations, downstream consumers, or deprecation candidates according to the specification's disposition matrix.

### Lifecycle and conditions

Each section records the achieved state `missing → drafted → evidenced → reviewed → approved → issued`. `stale` and `blocked` are structured overlay conditions, not destructive replacements for maturity. Either prevents approval and new issue. A dependency change preserves history, identifies affected sections, and requires affected content to be re-evidenced, reviewed and approved in a successor working version.

Issued content is immutable. Supersession and withdrawal add status/history without editing or deleting the issued artifact.

### Human and AI authority

The functional roles are Author, Section Owner, Reviewer, Approver, Issuer and Viewer. Authors cannot review or approve their own sections. The Issuer must be a named brief Approver, and another Approver must independently approve any section authored by the Issuer.

AI may extract, draft, summarize and suggest. It cannot satisfy evidence by itself, review, approve, issue, provide professional sign-off, overwrite explicit user input, or become numerical authority.

### Purpose and typology

The v1 `IssuePurpose` values are `internal_coordination`, `client_board_approval`, and `tender_rfq`. Each has an exact applicability and issue-gate profile; issued never automatically means procurement authorization, construction-ready information, valuation certification, statutory approval or professional compliance assurance.

BR-01 uses apartment, villa, office, hospitality, retail and mixed-use as umbrella profiles. Hospitality covers hotel/F&B only at contract level. BR-06 owns the detailed apartment, villa, residential-building, office, hotel/serviced-apartment, restaurant/F&B, retail and mixed-use rule packs.

### Downstream ownership

- `BR-02`: version, section, event, assignment, approval, issue, compatibility, migration and API architecture.
- `BR-03`: deterministic readiness and explainable insufficiency.
- `BR-04`: unified brief workspace.
- `BR-05`/`BR-06`: framework and professionally reviewed typology rules.
- `BR-07`: immutable snapshot DTO, fingerprints/hashes, format reconciliation and issued sharing.
- `BR-08`: AI fixture, model/prompt and promotion evaluation.

BR-01 does not choose those implementation mechanics.

## Consequences

### Positive

- “Issued Design Brief” has one bounded meaning independent of screen, generator or file format.
- Readiness becomes explainable by section, evidence, purpose, actor and blocker rather than a misleading percentage.
- Human approval and issue authority remain distinct from AI assistance and authentication role.
- Later architecture has stable section, state, condition, purpose and safety contracts.
- Historical issues remain reproducible and cannot drift with live data.

### Negative and trade-offs

- Current brief/report/share paths cannot be labelled canonical issued output until later migrations and compatibility work complete.
- Separation of duties adds workflow and assignment complexity.
- Purpose/typology matrices require continued domain ownership and professional review.
- Existing legacy artifacts need explicit compatibility/deprecation treatment rather than implicit promotion.

### Risks and mitigations

- **Risk:** BR-01 leaks schema or snapshot design into later steps. **Mitigation:** define product semantics only; BR-02 and BR-07 own mechanics.
- **Risk:** “Issued” is mistaken for legal, tender, construction or valuation assurance. **Mitigation:** purpose-specific limitations and preserved disclaimer gates.
- **Risk:** non-applicability hides missing content. **Mitigation:** every container exists and N/A requires independent rationale/approval.
- **Risk:** stale flags rewrite history. **Mitigation:** overlays and external status never mutate issued payloads.
- **Risk:** broad typology labels become unreviewed professional rules. **Mitigation:** BR-05/BR-06 remain human-gated.

## Alternatives Considered

### Promote `design_briefs` as canonical immediately

Rejected because it lacks the ten-section, evidence, role, purpose, issue and immutability contracts, and is incompatible with the public AI brief.

### Promote the AI public brief

Rejected because AI narrative cannot become approval or numerical authority, and the current share recomputes live context rather than resolving one frozen issue.

### Treat every report as an issued brief

Rejected because report types and generators can diverge and current fingerprinting does not by itself establish a canonical persistence/evidence chain.

### Use one universal issue purpose

Rejected because internal coordination, board decisions and tender/RFQ use have materially different evidence, assumption and safe-reliance requirements.

### Make `stale` and `blocked` exclusive lifecycle states

Rejected because it destroys information about the highest achieved maturity and complicates targeted reapproval.

### Let organization admins approve and issue without functional assignments

Rejected because authentication role is not evidence of design/report authority and does not prevent self-approval.

## Verification

- The normative specification defines ten stable section IDs, six achieved states, two overlay conditions, three issue purposes, six umbrella typologies, role/separation rules, issue gates and artifact dispositions.
- [Golden walkthroughs](../specs/BR-01_GOLDEN_WALKTHROUGHS.md) exercise all required positive and negative scenarios with synthetic UAE/AED data.
- Deterministic documentation checks verify identifiers, matrices, transition/negative coverage, links and formatting.
- Diff review proves there is no runtime, schema, migration, API, numerical, compliance or production change.
- Independent Claude Opus review and explicit product/design-domain/report-owner approval are required before changing this ADR to Accepted and closing BR-01.

## Migration and Rollback

This decision creates no runtime or data migration. Adoption begins with `BR-02` architecture after approval.

Before acceptance, rejection requires no rollback beyond leaving this ADR Proposed and BR-01 open. After acceptance, a changed product contract requires a new ADR that supersedes ADR-0007; issued history must never be retroactively rewritten.

## References

- [Issued Design Brief Product Contract](../specs/ISSUED_DESIGN_BRIEF_PRODUCT_CONTRACT.md)
- [BR-01 Golden Walkthroughs](../specs/BR-01_GOLDEN_WALKTHROUGHS.md)
- [MIYAR product audit](../audits/MIYAR_PRODUCT_TECH_AUDIT_2026-07-15.md)
- [ADR-0002 deterministic decision authority](ADR-0002-deterministic-decision-authority.md)
- [ADR-0003 baseline report contracts](ADR-0003-baseline-space-confidence-annex-contracts.md)
- [ADR-0004 render input fingerprint](ADR-0004-render-input-fingerprint.md)
