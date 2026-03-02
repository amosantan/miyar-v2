MIYAR Technical Blueprint — Part 3
Decision Engine Architecture, Scoring Logic, and Evaluation
Mathematics
1. Decision Engine Purpose
The MIYAR decision engine is a deterministic multi-layer evaluation system designed to compute
interior positioning viability under structured project constraints. The engine transforms normalized
project inputs into quantified validation outcomes through multi-dimensional scoring, constraint
penalties, and synthesis logic. The engine does not generate design recommendations. It evaluates
the structural validity of proposed positioning directions.
2. Core Evaluation Dimensions
Dimension
Purpose
Primary Variables
Strategic Alignment
Consistency with development intent
Positioning tier, brand ambition
Financial Compatibility
Fit within economic envelope
Budget per sqm, cost tolerance
Market Fit
Suitability to target buyer
Buyer profile, price band, competitive density
Differentiation Strength
Competitive uniqueness
Design ambition, market saturation
Execution Feasibility
Implementability at scale
Material tier, spatial complexity
3. Multi-Criteria Evaluation Model
Each candidate interior direction is evaluated independently across all dimensions. The system
applies weighted scoring under constraint enforcement. Evaluation structure:  Variable-level
scoring  Dimension aggregation  Constraint penalty application  Composite synthesis Evaluation
is threshold-driven rather than preference-driven.
4. Scoring Formula Structure
Let: V = normalized variable score W = variable weight D = dimension score P = penalty factor C =
composite viability score Dimension score: D = Σ (V × W) Penalty adjustment: D_adjusted = D × (1
− P) Composite score: C = Σ (D_adjusted × Dimension Weight) Validation condition: C ≥ Validation
Threshold → Direction Validated C < Validation Threshold → Direction Not Validated
5. Dimension Weight Allocation
 Dimension
Weight Range
Adjustment Authority
Strategic Alignment
20–30%
Admin configurable
Financial Compatibility
20–30%
Admin configurable
Market Fit
15–25%
Admin configurable
Differentiation Strength
10–20%
Admin configurable
Execution Feasibility
10–20%
Admin configurable
6. Constraint Penalty System


Constraint Type
Penalty Trigger
Effect
Budget Breach
Cost exceeds tolerance
Financial score reduction
Market Mismatch
Positioning above affordability
Market score reduction
Over-Differentiation
Uniqueness beyond absorption capacity
Differentiation penalty
Execution Complexity
Material level exceeds supply feasibility
Execution penalty
7. Scenario Simulation Logic
Scenario simulation tests direction robustness under controlled variable variation. Simulation types:
 Budget compression or expansion  Market shift scenarios  Differentiation intensity adjustment 
Material tier substitution  Spatial density variation Each simulation produces comparative
dimension deltas.
8. Sensitivity Analysis Model
Sensitivity analysis measures how strongly composite viability responds to individual variable
changes. Sensitivity coefficient: S = ΔC / ΔVariable High sensitivity variables represent structural
risk drivers.
9. Confidence Scoring
Confidence is calculated based on input completeness, data reliability, and scenario stability.
Confidence components:  Input completeness ratio  Constraint stability index  Scenario volatility
range Confidence Score Range: 0–100
10. Decision Engine Processing Flow
[Normalized Inputs] ↓ [Variable Scoring] ↓ [Dimension Aggregation] ↓ [Penalty Application] ↓
[Composite Score Calculation] ↓ [Validation Threshold Check] ↓ [Scenario Simulation] ↓
[Confidence Calculation] ↓ [Final Decision Output]
11. Model Governance
All scoring parameters are version-controlled. Governed components:  Variable weights 
Dimension weights  Penalty thresholds  Validation threshold  Scenario ranges Changes require
administrative authorization and audit logging.
12. Evaluation Integrity Principle
Every validation outcome must be mathematically reproducible. No stochastic decision paths are
permitted in core evaluation.
