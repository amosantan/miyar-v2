MIYAR Technical Blueprint 14
 Computational Specification & Variable Registry (Build-Executable)
This document converts MIYAR’s methodology into an engineering-complete specification: field-level data dictionary,
normalization rules, scoring equations, thresholds, penalties, scenario logic, and deterministic output mapping. All computations
are designed to be reproducible and versionable.
1. Computation Pipeline Overview
[Input Capture] -> [Schema Validation] -> [Normalization] -> [Feature Engineering]
     -> [Dimension Scoring] -> [Penalty & Risk Layer] -> [Composite Scoring]
     -> [Stability/Sensitivity] -> [Scenario Ranking] -> [Narrative + Report Render]
All scoring is deterministic: identical inputs under the same model version must produce identical outputs.
2. Variable Registry Structure
Variables are grouped into: (A) Project Context, (B) Strategic Intent, (C) Market Positioning, (D) Financial/Budget, (E) Design
Direction Attributes, (F) Execution/Delivery Constraints, (G) Optional Add-ons. Each variable has: ID, type, allowed values/range,
unit, default, required flag, validation rules, and transformation rules.
2.1 Core Variable Dictionary (Minimum Viable Registry)
 Var ID
Name
Type
Allowed / Range
Unit
Required
Default
Validation / Notes
CTX_01
Project typology
enum
{Residential, Mixed-use, Hospitality, Office}
-
Y
Residential
Drives weight profile
CTX_02
Project scale
enum
{Small, Medium, Large}
-
Y
Medium
Derived from GFA bands
CTX_03
Gross floor area (GFA)
number
10,000–5,000,000
sqft
Y
-
Must be >0
CTX_04
Location category
enum
{Prime, Secondary, Emerging}
-
Y
Secondary
Used in market expectation
CTX_05
Delivery horizon
enum
{0-12m, 12-24m, 24-36m, 36m+}
-
Y
12-24m
Affects risk
STR_01
Brand/vision clarity
ordinal
1–5
score
Y
3
1=unclear, 5=explicit
STR_02
Differentiation ambition
ordinal
1–5
score
Y
3
Higher increases risk tolerance needs
STR_03
Target buyer profile maturity
ordinal
1–5
score
Y
3
How well-defined target is
MKT_01
Market tier
enum
{Mid, Upper-mid, Luxury, Ultra-luxury}
-
Y
Upper-mid
Affects benchmarks
MKT_02
Competitor intensity
ordinal
1–5
score
Y
3
Higher means need differentiation
MKT_03
Trend sensitivity
ordinal
1–5
score
N
3
Used for design freshness weight
FIN_01
Interior budget cap
number
50–1,500
AED/sqft
Y
-
Client-provided or estimate
FIN_02
Budget flexibility
ordinal
1–5
score
Y
3
1 fixed, 5 flexible
FIN_03
Cost shock tolerance
ordinal
1–5
score
N
3
Risk layer
FIN_04
Target sales premium
ordinal
1–5
score
N
3
Expected uplift from interiors
DES_01
Design style family
enum
{Modern, Contemporary, Minimal, Classic, Fusion, Other}
-
Y
Modern
Input to benchmarks
DES_02
Material specification level
ordinal
1–5
score
Y
3
1=basic, 5=high-end
DES_03
Complexity index
ordinal
1–5
score
Y
3
Joinery, custom elements, MEP complexity
DES_04
Experience intensity
ordinal
1–5
score
N
3
Hospitality-like feel
DES_05
Sustainability emphasis
ordinal
1–5
score
N
2
Used in SDG narrative
EXE_01
Supply chain risk
ordinal
1–5
score
N
3
Imported materials lead time
EXE_02
Contractor capability level
ordinal
1–5
score
Y
3
1 weak, 5 strong
EXE_03
Approvals complexity
ordinal
1–5
score
N
2
Impacts schedule risk
EXE_04
QA maturity
ordinal
1–5
score
N
3
Controls execution variance
ADD_01
Physical sample kit
boolean
{True, False}
-
N
False
Adds cost and trust
ADD_02
Portfolio standardization
boolean
{True, False}
-
N
False
Changes weights to consistency


ADD_03
Dashboard export
boolean
{True, False}
-
N
True
Admin only toggle
3. Validation Rules & Missing Data Handling

Required variables must be present; otherwise evaluation cannot run.

For ordinal variables, missing values default to '3' (neutral) unless project policy overrides.

Out-of-range numeric values trigger validation errors and block run.

Enums must match allowed set; otherwise mapped to 'Other' with penalty (see Penalty Layer).

All units are normalized: budget must be AED/sqft; GFA must be sqft; conversions are logged.
4. Normalization & Feature Engineering
4.1 Ordinal normalization:
For any ordinal x in [1..5], normalized value x_norm = (x - 1) / 4  ∈ [0..1].
4.2 Numeric normalization (bounded):
For numeric v with min=a and max=b:
v_norm = clamp((v - a) / (b - a), 0, 1).
4.3 Derived features:
- ScaleBand = f(GFA): Small (<250k sqft), Medium (250k–800k), Large (>800k).
- BudgetClass = f(FIN_01): Low (<200), Mid (200–450), High (450–800), Premium (>800) AED/sqft.
- DifferentiationPressure = mean(MKT_02_norm, STR_02_norm).
- ExecutionResilience = mean(EXE_02_norm, EXE_04_norm).


5. Dimension Scoring (Deterministic Equations)
Four dimension scores are computed in [0..100]. Each is the weighted sum of normalized inputs, then scaled.
Let w_i be weights per dimension, sum(w_i)=1 for each dimension.
Strategic Alignment (SA):
SA_raw = 0.35*STR_01_norm + 0.25*STR_03_norm + 0.25*compat(Vision, Market) + 0.15*compat(Vision, Design)
Financial Feasibility (FF):
FF_raw = 0.45*budget_fit + 0.20*FIN_02_norm + 0.20*ExecutionResilience + 0.15*(1 - cost_volatility)
Market Positioning (MP):
MP_raw = 0.35*market_fit + 0.25*DifferentiationPressure + 0.20*DES_04_norm + 0.20*trend_fit
Execution Risk (ER) is reversed (higher is better):
ER_raw = 0.35*ExecutionResilience + 0.25*(1 - EXE_01_norm) + 0.20*(1 - DES_03_norm) + 0.20*(1 - approvals_risk)
Scaled:
SA = round(100*SA_raw)
FF = round(100*FF_raw)
MP = round(100*MP_raw)
ER = round(100*ER_raw)
5.1 Subfunctions and Compatibility Operators
compat(A,B) ∈ [0..1]
Default: compat = 1 - |A - B|
Where A and B are normalized indicators representing intent vs expectation.
budget_fit:
Compute expected budget band for (Market tier, Spec level, Complexity, Location):
expected = benchmark_budget(MKT_01, DES_02, DES_03, CTX_04)
budget_fit = 1 - clamp(|FIN_01 - expected| / tolerance, 0, 1)
tolerance = expected * (0.15 + 0.05*FIN_02_norm)   # higher flexibility -> larger tolerance
market_fit:
market_fit = compat(DES_02_norm, expected_spec_level(MKT_01))
trend_fit:
trend_fit = compat(MKT_03_norm, DES_freshness_index)  # if trend sensitivity used
cost_volatility:
cost_volatility = mean(EXE_01_norm, DES_03_norm)
approvals_risk:
approvals_risk = EXE_03_norm (default 0.25 if missing)
5.2 Benchmark Budget Function (Starter Table)
Market tier
Spec level 1-2
Spec level 3
Spec level 4
Spec level 5
Mid
140–220
220–320
320–420
420–520
Upper-mid
200–280
280–420
420–550
550–700
Luxury
280–380
380–520
520–700
700–950
Ultra-luxury
380–520
520–750
750–1,000
1,000–1,350
Values are indicative starter bands used until MIYAR’s internal benchmark database accumulates sufficient local projects to
calibrate.
6. Penalty Layer, Flags, and Risk Scoring
Penalty triggers produce deductions on composite score and generate risk flags.
Penalty types:
P1: Data quality penalty (missing non-required > 30%): -5
P2: Enum mismatch mapped to Other (any critical enum): -3 each (max -9)
P3: Budget mismatch severe (budget_fit < 0.4): -10 and risk flag FIN_SEVERE
P4: Execution fragility (ExecutionResilience < 0.35): -8 and risk flag EXE_FRAGILE
P5: Over-complexity (DES_03_norm > 0.8 and contractor < 0.5): -12 and risk flag COMPLEXITY_MISMATCH
Risk score (0..100):


Risk = round( 40*(1-FF_raw) + 35*(1-ER_raw) + 25*(1-SA_raw) )
Risk bands:
0–29 Low | 30–59 Moderate | 60–100 High


7. Composite Score & Decision Outcome
Dimension weights depend on project typology and market tier.
Default weights (Residential):
w_SA=0.30, w_FF=0.30, w_MP=0.25, w_ER=0.15
Luxury modifier:
If MKT_01 in {Luxury, Ultra-luxury}: w_MP += 0.05, w_FF -= 0.05
Portfolio standardization modifier:
If ADD_02=True: w_SA +=0.05, w_MP -=0.05
Composite (0..100):
Score_raw = w_SA*SA + w_FF*FF + w_MP*MP + w_ER*ER
Score = clamp(Score_raw - total_penalties, 0, 100)
Decision thresholds:
Score >= 75 and Risk <= 45  -> VALIDATED
Score 60–74 or Risk 46–59   -> CONDITIONAL (requires mitigation actions)
Score < 60 or Risk >= 60    -> NOT VALIDATED
7.1 Conditional Decision Actions (Auto-Generated)
Trigger
Auto Recommendation
Primary Variable(s)
FIN_SEVERE
Adjust spec level or budget range; provide 2 alternative material tiers
FIN_01, DES_02
EXE_FRAGILE
Simplify complexity or upgrade contractor capability plan
DES_03, EXE_02
COMPLEXITY_MISMATCH
Reduce custom joinery; modularize details; phase high-complexity zones
DES_03, EXE_02
Low SA (<60)
Clarify target user & brand narrative; tighten design intent statement
STR_01, STR_03
Low MP (<60)
Reposition experience intensity; adjust differentiation features within budget
MKT_02, DES_04
8. Scenario Engine Specification
Scenario = alternative set of {DES_01..DES_05, FIN_01/FIN_02, optional EXE inputs}.
Rules:
- A project can hold N scenarios; one is 'Current'.
- Scenario comparison uses same weights and thresholds.
- Rank by: (1) Risk-adjusted score, (2) Stability, (3) Market positioning.
Risk-adjusted score:
RAS = Score - 0.35*Risk
Scenario dominance:
Scenario A dominates B if:
RAS_A >= RAS_B AND Risk_A <= Risk_B AND (SA_A or MP_A) >= (SA_B or MP_B)
9. Stability & Sensitivity Analysis
Sensitivity tests perturb critical inputs +/- 10% (or +/-1 ordinal step) to estimate robustness.
Critical variables:
FIN_01, DES_02, DES_03, EXE_02, STR_01, MKT_02
For each perturbation k:
compute Score_k
Variance = var(Score_k)
StabilityIndex = 1 - clamp(Variance / 250, 0, 1)   # 250 chosen so typical variance maps sensibly
Interpretation:
>=0.75 High stability
0.50–0.74 Medium stability
<0.50 Low stability (recommend additional validation or simplification)


10. Output Mapping (What the System Must Produce)
Output Artifact
Format
Generated From
Must Include
Validation Summary
Dashboard + PDF
Score, Risk, Decision
Decision badge, rationale, top 5 drivers
Dimension Radar
Chart
SA, FF, MP, ER
Values + benchmark overlay
Risk Heatmap
Chart + table
Risk flags + contributors
Severity, probability proxy, mitigations
Budget Realism Band
Chart
FIN_01 vs expected
Expected band, tolerance, delta
Scenario Comparison
Table + chart
All scenarios
RAS, Risk, Stability, recommended
Design Brief Extract
Doc/PDF
Validated direction
Scope notes, key constraints, do/don’t list
Procurement Prep (RFQ Pack)
Doc/PDF/ZIP
Material tiers, spec level
Category list, alternates, assumptions
11. Error States, Edge Cases, and Determinism Rules
Error Code
Condition
System Response
User Message
E_REQ_MISSING
Any required field missing
Block run; highlight fields
Complete required fields to proceed.
E_RANGE
Numeric out of allowed range
Block run; show bounds
Value out of range. Please adjust.
E_UNIT
Unit mismatch/unconvertible
Block run; request unit
Unit invalid. Provide AED/sqft.
E_ENUM
Enum invalid
Auto-map to Other + penalty OR block if critical
Selection invalid; mapped to Other.
E_VERSION_LOCK
Model version locked for project
Block changes; allow scenario copy
Project locked. Create a new scenario to test changes.
12. Admin-Only Controls (Operational Constraints)
Admin-only settings:
- Enable/disable dashboard export per tenant (ADD_03 gating)
- Adjust benchmark budget table and tolerance multipliers
- Approve and publish model versions
- Override penalties in audited exceptional cases
- Manage partner integrations and reference datasets
Non-admin users cannot change weights, thresholds, or penalties.
13. Acceptance Criteria (Build Completion Tests)

Given a complete valid dataset, system produces identical outputs across 3 reruns (same version).

Given missing required data, system blocks run and highlights the exact fields.

Given budget mismatch, system flags FIN_SEVERE and reduces score according to penalty rules.

Scenario ranking matches RAS rule and tie-breakers consistently.

Report PDFs include mandatory sections and charts, and show model version ID on cover.

All outputs link to audit log entries with timestamp and user ID.
