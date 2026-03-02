MIYAR Technical Blueprint 32
 Product Governance & Decision Authority Charter
0. Executive Intent
This charter defines the decision authority, governance mechanisms, and control boundaries for MIYAR’s validation
logic, data assets, pricing rules, and release lifecycle. It is designed to prevent uncontrolled model drift, inconsistent
scoring behavior, and ad hoc commercial changes. The governance model is explicitly built for a human-supervised
decision product where computational outputs are high-impact inputs into real estate development decisions.
1. Scope of Governance
Governed Asset
Examples
Why Governance is Required
Minimum Control
Decision Model & Weights
Variable weights, scoring thresholds, penalties
Avoid strategic inconsistency and bias
Change-control + validation tests
Validation Rules
Eligibility rules, compliance gates, constraint checks
Prevent legal/feasibility errors
Dual approval + audit log
Benchmark Datasets
Cost benchmarks, market indices, spec libraries
Protect data quality and drift
Source validation + versioning
Product Packages
Tier definitions, included outputs, limits
Prevent scope creep and margin erosion
Commercial sign-off
Pricing & Discounts
Price ranges, promo rules, partner rates
Avoid revenue leakage
Discount governance policy
Release Management
Feature releases, hotfixes, rollbacks
Maintain stability and uptime
Staging + rollback authority
Access & Permissions
Role access, override rights
Prevent misuse and accountability loss
Role-based controls
Learning/Adaptation
Calibration updates, feedback learning
Avoid uncontrolled changes
Bounded learning + freeze windows
2. Governance Principles

Determinism: identical inputs must yield identical outputs for a declared model version.

Traceability: every change must be tied to a change request, owner, and rationale.

Auditability: decision trails and overrides are immutable and exportable for audit.

Separation of duties: no single individual can unilaterally change core model logic in production.

Safety over speed: stability and correctness supersede feature velocity.

Reversibility: all changes must be rollback-capable to a last-known-good release.

Calibration discipline: learning updates are bounded and executed only within controlled windows.
3. Decision Authority Roles
Role
Primary Responsibilities
Approval Rights
Examples of Decisions
Founder / Product Owner
Vision, positioning, final arbitration
Final approval for major changes
Approve new tier, approve weight framework
Model Steward
Model integrity, calibration, validation tests
Approve model/weight changes
Adjust penalty functions, freeze model
Data Steward
Benchmark sourcing, data quality, lineage
Approve dataset changes
Accept new cost dataset, deprecate vendor feed
Commercial Lead
Packaging, pricing governance, margin control
Approve commercial changes
Discount policy, partner revenue share
Engineering Lead
Deployment, reliability, security controls
Approve release to production
Rollback, feature flag strategy
Compliance Reviewer
Scope boundaries, claims discipline, client terms
Veto compliance-risk changes
Terminology control, disclaimers
Client Success Lead
Delivery quality, onboarding protocols, feedback
Propose improvements
Pilot learnings, workflow friction
Admin Operator (System)
Operational execution
No policy approval
User provisioning, audit exports


4. Authority Matrix (RACI for High-Impact Changes)
Change Type
R (Responsible)
A (Accountable)
C (Consulted)
I (Informed)
Model weights/thresholds
Model Steward
Founder/Product Owner
Data Steward, Compliance
Commercial, CS, Eng
New validation rule
Model Steward
Founder/Product Owner
Compliance, Eng
Commercial, CS
Benchmark dataset update
Data Steward
Founder/Product Owner
Model Steward, Compliance
Eng, Commercial, CS
New pricing tier/package
Commercial Lead
Founder/Product Owner
CS, Compliance, Model Steward
Eng, Data Steward
Discount exception
Commercial Lead
Founder/Product Owner
Compliance
Finance/CS
Production release
Engineering Lead
Engineering Lead
Model Steward, Data Steward
Founder, CS, Commercial
Emergency rollback
Engineering Lead
Engineering Lead
Model Steward
All stakeholders
Learning calibration update
Model Steward
Founder/Product Owner
Data Steward
Eng, CS, Commercial
5. Change Control Workflow
[CR-01 Change Request]
        |
        v
[Impact Triage] --(LOW)--> [Fast Track: Feature Flag + Staging Test] --> [Release]
        |
       (MED/HIGH)
        v
[Design Review: Model/Data/Commercial/Compliance]
        |
        v
[Validation Pack]
 - unit tests
 - regression suite
 - benchmark drift checks
 - fairness/bias scan (where applicable)
        |
        v
[Approval Gate]
 - Accountable sign-off
 - Compliance veto check
        |
        v
[Staging Deployment]
        |
        v
[Production Release]
        |
        v
[Post-Release Monitoring]
 - drift alarms
 - error rate
 - decision stability
        |
        v
[Rollback if thresholds exceeded]
6. Validation Pack Requirements (Non-Negotiable)
Validation Component
Applies To
Minimum Standard
Pass/Fail Rule
Unit tests
All changes
Coverage for modified functions
No failing tests
Regression suite
Model/rules/data
Golden-case set
Output deltas within tolerance
Benchmark drift check
Data updates
Distribution comparison
No unexplained drift
Stress test
Performance/release
Latency + concurrency
SLO not violated
Explainability check
Model updates
Reason codes remain coherent
No missing reasons
Security review
Auth/data changes
Access controls validated
No privilege escalation
Compliance language check
Client-facing outputs
Terminology and disclaimers
No prohibited claims


7. Model Freeze Windows & Calibration Rules
MIYAR operates with explicit model freeze windows. Outside defined calibration periods, model weights, thresholds,
and penalties cannot change in production. This ensures stable behavior for clients during active decision cycles
and prevents hidden shifts that undermine trust.
Window Type
Frequency
Allowed Changes
Constraints
Operational Freeze
Always during active client delivery week
Bug fixes only
No scoring logic change
Calibration Window
Monthly or quarterly (as governance decides)
Weights/thresholds within bounds
Requires validation pack
Emergency Patch
As needed
Hotfix for errors
Rollback-ready, post-mortem required
Major Version Upgrade
Planned releases
Schema + model changes
Migration plan + client notice
8. Override Governance (Human Control)
Override Level
Who Can Use
What It Can Change
Mandatory Logging
Parameter Adjust
Client Admin / Internal Analyst
Inputs within allowed bounds
Reason + affected variables
Structured Override
Internal Analyst
Select alternative validated pathway
Reason code + narrative
Executive Override
Founder/Product Owner
Final decision selection beyond model preference
Executive rationale + risk acceptance
Governance Lock
Founder + Engineering Lead
Freeze outputs / restrict access
Incident ticket + audit trail
9. Audit, Escalation & Incident Handling
Incident Types:
  A) Output anomaly (unexpected scores)
  B) Data anomaly (benchmark drift)
  C) Security anomaly (access misuse)
  D) Compliance anomaly (scope/claims)
Escalation Ladder:
  1) Detect -> create incident ticket
  2) Contain -> feature flag / governance lock
  3) Diagnose -> root cause analysis
  4) Remediate -> patch or rollback
  5) Verify -> rerun validation pack
  6) Document -> post-mortem + prevention controls
10. Governance Metrics (Continuous Oversight)
Metric
Definition
Target/Alert
Model stability
Std dev of key scores over time (same cohort)
Alert if drift > tolerance
Override rate
Overrides / total decisions
Alert if exceeds threshold
Rollback frequency
Rollbacks per quarter
Investigate if > 1
Benchmark freshness
Median age of benchmark data
Refresh cadence compliance
Decision latency
Time from input completion to validated output
SLO threshold
Incident severity
Weighted incident score per month
Downward trend required
11. Charter Adoption & Sign-Off
This charter is binding for MIYAR internal operation. It must be adopted prior to any multi-client production
deployment. Any deviation requires explicit documented approval by the Founder/Product Owner and Engineering
Lead, with Compliance review for scope and claims.
