MIYAR — Master File for Manus
What we are building, why it matters, who it serves, and how it must be
implemented
Purpose: This document is the single, explicit, authoritative narrative and build-intent reference for Manus. It
complements the MIYAR Technical Blueprints by explaining the underlying problem, product boundaries, customer
reality, workflow logic, commercial intent, governance requirements, and the expected quality bar for the
implementation.
Audience

Manus build agent and engineers implementing MIYAR

MIYAR founders and reviewers validating build fidelity

Internal admin/operators who will run MIYAR for clients
Non-negotiable build principle
MIYAR is a decision intelligence product. It must be deterministic, explainable, auditable, and governed. It must not
behave like an ad hoc consultancy workflow or an aesthetic design tool. The platform’s value is in structured
validation and controlled decision logic that produces consistent, defensible outputs.


Table of Contents
1
1. Product Identity & Category Definition
2
2. Problem, Market Context, and Opportunity
3
3. Target Customers and Buying Reality
4
4. MIYAR Value Proposition and ROI Narrative
5
5. What MIYAR Is (and Is Not)
6
6. Core Workflow: From Intake to Output
7
7. Inputs: Data Schema and Validation Philosophy
8
8. Decision Engine: Variables, Scoring, Confidence
9
9. Outputs: Report, Dashboard, Export Artifacts
10
10. Benchmark Intelligence: Data Compounding Strategy
11
11. Governance & Control: Versioning, Overrides, Audit
12
12. Commercial Model: Packages, Control, Expansion Logic
13
13. Risk & Compliance Positioning
14
14. Implementation Plan for Manus
15
15. Acceptance Criteria and Definition of Done
16
Appendix A. Key Terminology
17
Appendix B. Document Map (Blueprint Index)


1. Product Identity & Category Definition
MIYAR is a pre-design interior decision intelligence platform for real estate developers. It converts early-stage
project intent (brand positioning, target segment, budget envelope, and constraints) into structured, validated interior
direction outputs that can be used to brief designers, plan budgets, and support early marketing narratives.
Attribute
MIYAR Definition
Reason (Why this matters)
Category
Interior Design Validation Toolkit (Decision Intelligence)
Creates a distinct market space; avoids being seen as a design firm
Primary outcome
Validated direction + briefing clarity + cost alignment
Developers need usable direction, not mood-board ambiguity
Core mechanism
Structured variables + scenario modelling + scoring + explainability
Ensures repeatability and trust
Boundary
Upstream of design execution
Avoids regulated design obligations and scope confusion
Value engine
Time saved + rework avoided + clearer tendering + reduced budget variance
Provides a concrete ROI narrative


2. Problem, Market Context, and Opportunity
In competitive UAE real estate markets, interior decisions are not optional details—they influence positioning, sales
velocity, buyer perception, and cost performance. However, many small-to-mid developers lack the internal
capability to convert a project vision into a structured interior brief early enough to control outcomes. The common
substitute is subjective mood-board selection and fragmented advice, which often leads to misalignment, inefficient
tendering, late revisions, and avoidable cost escalation.
Observed failure pattern (what happens today)
1) Developer selects images/mood boards without structured constraints.
2) Designers receive vague/contradictory direction; scope expands during exploration.
3) Budget assumptions are weak; procurement becomes reactive.
4) Tender/RFQ results are inconsistent; re-tendering or redesign occurs.
5) Schedule slip + cost variance + weakened marketing narrative.
MIYAR’s opportunity
MIYAR inserts a structured validation layer before design engagement. It helps developers decide: (a) what design
direction fits the target segment and positioning, (b) what is feasible within budget, (c) what differentiation is
credible, and (d) what decision trade-offs are acceptable. This turns a subjective choice into an auditable decision.


3. Target Customers and Buying Reality
MIYAR is built primarily for small-to-mid real estate developers and development managers in the UAE who deliver
one to three projects annually and do not have a full in-house interior strategy team. A secondary segment includes
investors and portfolio managers who require consistency across multiple assets.
Buying psychology (critical)
Many developers—especially entrants from other industries—believe they already know what to do. This creates
two adoption risks: (1) rejection of ‘advice’ framed as consultancy; (2) misuse of outputs as aesthetic preference
confirmation. MIYAR must therefore be positioned as a ‘decision validation toolkit’ with tangible ROI metrics, not as
an advisory opinion.
Buyer concern
What they fear
MIYAR response (design of product + messaging)
Losing control
Being told what to do
Provide options + explain trade-offs; keep final choice with developer
Paying for “common sense”
Tool feels abstract
Quantify time saved, rework avoided, budget variance reduction
Scope creep
Consultants keep charging
Fixed packages with clear deliverables + change control
Market acceptance uncertainty
Unique design may not sell
Market-fit scoring + benchmarking + scenario testing
Cost uncertainty
Interiors blow budgets
Cost-alignment scoring + range-based cost model + sensitivity analysis


4. MIYAR Value Proposition and ROI Narrative
MIYAR’s value proposition is structured validation: aligning interior direction with strategic intent, budget, and
market expectations before committing to design execution or procurement decisions.
ROI narrative (what the client can measure)

Time saved: fewer exploratory cycles before briefing a designer; faster alignment among stakeholders.

Cost avoided: reduced redesign and re-tendering; fewer late specification changes.

Budget predictability: earlier, defensible cost ranges integrated into cash flow planning.

Marketing readiness: earlier narrative + interior positioning used for initial sales kits and renders direction.

Decision confidence: quantified scenario trade-offs reduce intuition-driven swings.
ROI Lever
Baseline (typical pain)
MIYAR mechanism
Evidence captured by system
Design iterations
Multiple brief revisions
Validated direction profile + constraints
Iteration count reduction
Tender variance
Wide RFQ spread
Spec strategy + budget banding
Variance metrics per RFQ
Late changes
Spec changes during execution
Risk flags + sensitivity analysis
Change log + reasons
Internal alignment
Stakeholders disagree
Scenario comparison dashboard
Convergence score + audit


5. What MIYAR Is (and Is Not)
MIYAR IS
MIYAR IS NOT
A decision-support toolkit
An interior design studio
A validation and alignment layer
A generator of creative concepts
A structured scoring framework
A substitute for licensed design services
A briefing accelerator
A construction documentation provider
A benchmarking and intelligence system
A taste/beauty judgement engine
Scope boundary statement (client-facing)
MIYAR provides structured validation outputs intended to support early-stage decision-making. It does not produce
construction drawings, detailed design documentation, or regulatory submissions. Design execution remains the
responsibility of appropriately licensed professionals.


6. Core Workflow: From Intake to Output
End-to-end workflow (high-level):
A) Account setup (Admin) -> roles, permissions, project creation
B) Project intake (Client/Admin) -> guided data capture + completeness score
C) Scenario builder -> generate interior strategy options based on inputs
D) Decision engine -> score, rank, compute confidence, produce reason codes
E) Review layer (Admin/Analyst) -> sanity checks, overrides (logged)
F) Output generation -> dashboard + PDF report + export packs
G) Post-delivery -> feedback capture + benchmarking updates + ROI tracking
                +-------------------+
                |   Project Intake  |
                +---------+---------+
                          |
                          v
                 +--------+--------+
                 |  Data Validation |
                 +--------+--------+
                          |
                          v
+-------------+    +------+-------+     +------------------+
| Benchmark DB|<---| Scenario Gen |---->| Decision Engine   |
+------+------+    +------+-------+     +----+-------------+
       ^                  |                  |
       |                  v                  v
       |           +------+-------+    +------+-------+
       +-----------| Review/Override|  | Report Builder|
                   +------+-------+    +------+-------+
                          |                  |
                          v                  v
                    +-----+------------------+-----+
                    | Dashboard + Exports + Audit |
                    +-----------------------------+


7. Inputs: Data Schema and Validation Philosophy
MIYAR relies on structured inputs. Inputs must be validated for completeness, plausibility, and internal consistency.
The system must score data quality and reflect uncertainty in confidence metrics. Where clients provide incomplete
data, MIYAR should (a) request missing fields, or (b) proceed with explicit assumptions logged and surfaced in the
output.
Input group
Examples
Validation checks
Why it matters
Project identity
Area, asset type, size band
Required fields, range checks
Defines benchmark context
Target customer
End-user vs investor, segment
Category consistency
Determines market-fit scoring
Positioning intent
Luxury, wellness, branded, etc.
Conflict checks
Drives differentiation logic
Budget envelope
Target PPSF, fit-out range
Bounds, sensitivity
Cost alignment
Constraints
Timeline, procurement method
Feasibility checks
Operational risk scoring


8. Decision Engine: Variables, Scoring, Confidence
The decision engine evaluates scenarios through a multi-criteria scoring model. It must produce: (1) a total score,
(2) component scores per dimension, (3) reason codes explaining results, (4) confidence metrics reflecting data
quality and benchmark strength, and (5) sensitivity views showing which variables drive the score most.
Scoring structure (conceptual):
TotalScore = Σ (Weight_i × DimensionScore_i)  for i in {MarketFit, CostAlignment, Differentiation, Feasibility, Risk}
DimensionScore is computed from normalized variables:
DimensionScore = f( normalized_variables, constraint_penalties, scenario_modifiers )
ConfidenceScore = g( input_completeness, benchmark_density, model_stability, override_rate )
All computations are versioned. Any override must be logged with:
- actor, timestamp
- reason code
- changed variables/weights
- acceptance of risk (if applicable)
Dimension
What it measures
Typical drivers
Market Fit
Alignment with target segment and context
Segment fit, trend alignment, amenity narrative
Cost Alignment
Feasibility within budget envelope
Spec level, material mix, unit counts, cost bands
Differentiation
Credible uniqueness vs competitors
Signature elements, consistency, brand cues
Feasibility
Operational deliverability
Timeline, procurement, supplier availability
Risk
Downside exposure and uncertainty
Data gaps, volatility, scope complexity


9. Outputs: Report, Dashboard, Export Artifacts
MIYAR must output both executive-level clarity and implementation-ready assets. Outputs are structured across: (a)
dashboards for exploration, (b) PDF reports for formal decision records, and (c) export packs for downstream
marketing and procurement workflows.
Output
Format
Primary users
Purpose
Executive dashboard
Web
Developer leadership
Quick understanding of best scenario + trade-offs
Scenario matrix
Web + export
Analyst/Admin
Compare options across dimensions
Validated direction profile
PDF + JSON
Design/PM team
Briefing foundation
Cost band + sensitivity
PDF + spreadsheet
Finance/Commercial
Budget discipline + risk awareness
RFQ-ready brief pack
PDF/Doc export
Procurement
Tendering with clarity
Physical board spec
Export list
Vendors
Optional material board production
Audit log
Export
Governance
Traceable decisions


10. Benchmark Intelligence: Data Compounding Strategy
MIYAR’s defensibility improves as the benchmark database grows. Each project creates structured records: inputs,
scenario selections, scores, overrides, and observed outcomes. Over time, MIYAR builds a benchmarking layer that
improves confidence bands and enables portfolio analytics.
Benchmark loop:
Project delivered -> store structured attributes -> store selected scenario -> store client feedback/outcome ->
update benchmark density -> recalibrate confidence intervals (only in controlled windows) -> improved future outputs
Benchmark asset
Examples
Governance requirement
Cost benchmarks
Fit-out cost ranges by spec level and typology
Data Steward approval + source lineage
Trend benchmarks
Design trend adoption signals
Refresh cadence + drift monitoring
Performance benchmarks
Time saved, rework avoided
ROI evidence pipeline
Portfolio benchmarks
Consistency metrics across assets
Client permission controls


11. Governance & Control: Versioning, Overrides, Audit
MIYAR’s credibility depends on governance. Scoring logic, benchmark data, and client-facing claims must be
controlled. Every change must be traceable to an owner and rationale. Overrides must exist (humans remain
accountable) but they must be logged, exportable, and reviewable.
Governance spine:
Change Request -> Review -> Validation Pack -> Approval Gate -> Staging -> Production -> Monitoring -> Rollback if needed
Audit trail always-on:
- inputs versioned
- model versioned
- outputs versioned
- overrides logged
Control area
Mechanism
Minimum requirement
Model versioning
Semantic versions + frozen releases
Determinism per version
Override governance
Role-based permissions
Reason + actor + affected fields
Change control
RACI + approval gates
No unilateral production changes
Compliance scope
Non-design positioning
No regulated design claims
Data governance
Lineage + drift checks
Source validation


12. Commercial Model: Packages, Control, Expansion Logic
MIYAR is sold primarily as fixed-scope packages per project, with add-ons and an enterprise pathway. Commercial
control is enforced through margin guardrails, discount governance, and cost-to-serve monitoring.
Tier
Target client
Core deliverables
Commercial control
Basic
Small developers
Validated direction + standard report
Strict scope; limited iterations
Pro
Mid developers
Scenario matrix + sensitivity + expanded outputs
CTS cap; controlled customization
Enterprise
Portfolio operators
Portfolio analytics + dashboards + benchmarking
Governance + SLA; higher margin
Add-ons
Optional
Physical board kit, workshops, RFQ pack
Priced separately; margin check
Funding positioning (business plan alignment)
Initial funding requirement: AED 250,000–350,000 for setup and early operations. The majority is founder-funded; a
minority portion may be raised later from angel or strategic investors to support market expansion and product
refinement. Institutional VC is not assumed at early stage.


13. Risk & Compliance Positioning
MIYAR must be careful with legal claims and scope. It supports decisions; it does not certify designs. Key risks
include adoption friction, key-person dependency, data quality variance, and competitive imitation. The platform
mitigates these through standardized decision logic, explainability, auditability, and benchmarking compounding.
Risk
Why it matters
Platform mitigation
Adoption skepticism
Developers unfamiliar with ‘validation tools’
ROI narrative + concrete outputs
Key-person dependency
Founder judgment seen as core
Documented decision logic + versioned models
Data quality variation
Client inputs incomplete
Completeness scoring + assumptions log
Competitive imitation
Consultants replicate informally
Proprietary framework + benchmarking + brand/category
Scope confusion
Seen as design firm
Clear boundary language + deliverables design


14. Implementation Plan for Manus
Manus must implement MIYAR phase-by-phase with measurable completion criteria. Build order is: foundation ->
decision engine -> outputs -> interface -> intelligence layer -> governance -> commercial controls -> deployment.
Phase 1: Foundation
 - Auth + RBAC + project CRUD
 - Database schema + variable registry
Phase 2: Decision Engine
 - Normalization + scoring + confidence
 - Scenario generation + sensitivity analysis
Phase 3: Outputs
 - PDF report generator + exports
 - Dashboard views
Phase 4: Intelligence
 - Benchmark DB writes + retrieval
 - Controlled calibration windows
Phase 5: Governance
 - Audit logs + versioning + override control
 - Change control hooks
Phase 6: Commercial
 - Package enforcement + usage tracking
 - Discount governance integration
Phase 7: Deployment
 - Staging/production environments
 - Monitoring + rollback


15. Acceptance Criteria and Definition of Done
Capability
Minimum acceptance test
Intake workflow
User completes intake; completeness score computed; data stored
Scenario builder
System generates scenarios and allows comparison
Decision engine
Scores computed with reason codes and confidence metrics
Overrides
Admin override changes output; audit log records who/why/what
Reports
PDF generated with required sections; exports produced
Dashboard
Executive view shows top scenario, trade-offs, and ROI estimate
Benchmarking
Project stored; benchmark retrieval works; no uncontrolled drift
Security
RBAC enforced; tenant separation; audit export available
Governance
Model version shown on outputs; rollback path exists


Appendix A. Key Terminology
Term
Meaning in MIYAR
Validation
Structured evaluation against criteria; not a design output
Scenario
A candidate interior direction pathway with defined variable settings
Reason codes
Machine-readable explanations for scores and ranking
Confidence
Quantified uncertainty based on data quality + benchmark density
Override
Human-authorized adjustment to inputs/logic, always logged
Benchmark
Stored reference data used to contextualize scoring ranges
Package
Commercial scope boundary controlling outputs and iterations


Appendix B. Document Map (Blueprint Index)
This master file sits above the MIYAR Technical Blueprints. Manus should treat this as the narrative and intent
layer. For implementation details, consult the full blueprint set already provided (Architecture, Workflow/Data Model,
Decision Engine, Reporting, Infra, Governance, Commercial Controls, Compliance, etc.).
Blueprint cluster
What it contains
01–05 Core architecture
System architecture, workflow, decision model, reporting, tech infrastructure
06–12 Governance + ops + roadmap
Model governance, deployment lifecycle, security, analytics, integrations, ops playbook, QA/roadmap
13–17 Methodology + UX + ROI
Validation handbook, variable registry, PRD, UX state machine, ROI model
19–25 Intelligence layer
Data acquisition, explainability, simulations, portfolio intelligence, learning, human-AI control, market intelligence
26–31 Strategy/standards/orchestration
Behavioral framework, capital allocation, compliance engine, digital twin, scaling orchestration, ecosystem economics
32–35 Control architecture
Governance charter, commercial control, customer success intelligence, risk resilience
