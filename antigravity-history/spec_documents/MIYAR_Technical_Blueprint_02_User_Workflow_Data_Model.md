MIYAR Technical Blueprint — Part 2
User Workflow, Data Architecture, and Input Schema
1. Operational User Workflow Overview
MIYAR operates through a structured sequential workflow designed to transform development
intent into validated interior positioning. The workflow enforces logical progression and prevents
premature evaluation. Processing stages: 1. Project creation 2. Strategic definition 3. Financial
boundary definition 4. Market positioning definition 5. Spatial configuration input 6. Direction
candidate selection 7. Validation execution 8. Scenario simulation 9. Output synthesis 10. Report
export
2. System Workflow Diagram (Conceptual)
[Create Project] ↓ [Define Strategic Intent] ↓ [Define Financial Limits] ↓ [Define Target Market] ↓
[Input Spatial Structure] ↓ [Select Direction Candidates] ↓ [Run Validation Engine] ↓ [Run Scenario
Simulation] ↓ [Generate Decision Outputs] ↓ [Export Structured Reports]
3. Workflow Stage Definitions
 Stage
Purpose
User Action
System Response
Project Creation
Initialize structured record
Enter project identity
Create database container
Strategic Definition
Define positioning intent
Select positioning variables
Encode strategy profile
Financial Boundaries
Define economic constraints
Enter budget ranges
Set cost tolerance model
Market Definition
Define buyer segment
Select market profile
Load expectation matrix
Spatial Configuration
Define physical structure
Enter unit mix and areas
Normalize spatial variables
Direction Candidates
Define interior pathways
Select possible positioning directions
Prepare evaluation objects
Validation Execution
Compute alignment scores
Trigger validation
Run multi-dimensional scoring
Scenario Simulation
Test alternative constraints
Adjust variables
Generate comparative results
Output Generation
Produce structured results
Confirm reporting
Generate decision package
4. Input Data Architecture Overview
MIYAR uses structured data objects grouped into five primary domains. Each domain feeds specific
evaluation dimensions. Data domains:  Strategic intent  Financial constraints  Market positioning
 Spatial configuration  Differentiation objectives
5. Core Input Schema
Domain
Variable
Type
Example
Used In Evaluation
Strategic
Project positioning tier
Categorical
Upper-mid
Market fit, differentiation
Strategic
Brand ambition level
Ordinal
High
Differentiation score
Financial
Interior budget per sqm
Numeric
650 AED
Financial compatibility
Financial
Cost tolerance
Range
±10%
Scenario simulation
Market
Target buyer profile
Categorical
Investor-driven
Market fit


Market
Competitive intensity
Ordinal
High
Differentiation
Spatial
Unit mix ratio
Vector
1BR 60% / 2BR 40%
Execution feasibility
Spatial
Amenity tier
Ordinal
Premium
Strategic alignment
Differentiation
Uniqueness ambition
Ordinal
Moderate
Differentiation score
6. Input Validation Rules
All inputs must satisfy structural validity before evaluation. Validation rules:  Numeric values must
fall within predefined industry ranges  Categorical values must map to system ontology  Budget
data must include tolerance range  Market segment must include pricing band  Spatial input must
sum to 100% distribution Invalid records cannot proceed to evaluation.
7. Data Normalization Logic
Input variables are transformed into normalized computational scales. Normalization methods: 
Range scaling (0–1)  Ordinal mapping  Category embedding  Weighted vector encoding
Normalization ensures comparability across heterogeneous variables.
8. Internal Data Object Model
 Object
Purpose
Persistence
Project Profile
Full structured project definition
Stored
Direction Candidate
Evaluated positioning path
Stored
Score Matrix
Dimension results
Stored
Scenario Set
Alternative outcomes
Stored
Report Instance
Generated output
Stored
Model Version
Evaluation parameters
Stored
9. User Roles and Permissions
 Role
Access Rights
Project User
Create and manage projects
Analyst User
Run validation and scenarios
Administrator
Modify weights and thresholds
System Owner
Model governance and versioning
10. Data Processing Sequence
1. Input capture 2. Validation check 3. Normalization 4. Variable mapping 5. Evaluation execution 6.
Scenario modeling 7. Output synthesis 8. Report generation 9. Data storage
