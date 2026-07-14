MIYAR Technical Blueprint — Part 7
System Deployment Architecture, Access Control, Client
Lifecycle, Licensing, and Commercial Usage Logic
1. Deployment Architecture Objective
The MIYAR deployment architecture governs how the system is provisioned, accessed, licensed,
and operationally delivered to clients. Deployment design must satisfy:  controlled system access 
scalable client onboarding  project-based processing capacity  usage traceability  commercial
enforcement  secure tenant separation Deployment structure ensures that the system functions
simultaneously as a computational platform and a commercial product.
2. Multi-Tenant Deployment Model
[Global System Infrastructure] ↓ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■
Tenant Isolation Layer ■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ↓ ↓ [Developer
Tenant A] [Developer Tenant B] ↓ ↓ Project Instances Project Instances
3. Tenant Structure Definition
 Tenant Element
Purpose
Isolation Level
Organization Profile
Legal entity using system
Fully isolated
User Accounts
Individual access credentials
Role-based
Project Database
Project-specific data
Fully isolated
Evaluation Records
Computation results
Fully isolated
Report Archive
Generated outputs
Fully isolated
4. Client Lifecycle Flow
Client Registration ↓ Organization Verification ↓ Tenant Creation ↓ User Role Assignment ↓ Project
Creation ↓ Evaluation Usage ↓ Report Generation ↓ Project Closure or Archive ↓ Renewal /
Additional Projects
5. User Role Hierarchy
Role
Permissions
Typical Holder
Organization Owner
Full tenant control
Developer principal
Project Manager
Project creation and execution
Development manager
Analyst User
Run validation and simulations
Strategy team
Viewer
Read-only reports
Investors / stakeholders
System Administrator
Model configuration
MIYAR operator
6. Access Control Logic
Access control operates on three layers: Identity authentication → confirms user identity Role
authorization → determines permitted actions Project scope enforcement → restricts data visibility


Access rule example: IF user_role = Analyst AND project_permission = TRUE THEN evaluation
execution allowed ELSE access denied
7. Licensing Model Structure
License Type
Scope
Usage Limit
Per Project License
Single development project
Fixed evaluation volume
Multi■Project Bundle
Portfolio developer
Multiple projects
Enterprise Access
Large development group
Unlimited internal projects
Advisory Partner License
Consultant usage
Restricted tenant scope
8. Usage Metering Logic
System usage is measured through evaluation events. Metered units:  validation executions 
scenario simulations  report generations  data storage volume Usage tracking formula: Total
Usage Units = V + S + R Where: V = validation runs S = scenario simulations R = report exports
9. Billing Trigger Logic
 Trigger
Condition
Billing Action
Project Activation
New project created
License allocation
Evaluation Threshold
Usage exceeds plan
Overage charge
Renewal Date
License expiry
Renewal invoice
Storage Limit
Data exceeds allocation
Storage fee
10. Project Lifecycle Management
Each project progresses through defined states: Draft → Active → Evaluated → Closed → Archived
State transition rules enforce data integrity and commercial usage tracking.
11. Data Retention Policy
 Data Type
Retention Period
Purpose
Active Project Data
Full lifecycle
Operational use
Archived Projects
Long-term storage
Benchmarking
Deleted Projects
Recovery window
Compliance
Usage Logs
Permanent
Audit and billing
12. Physical Output Fulfilment Logic
Digital validation complete ↓ Physical kit eligibility check ↓ Material specification extraction ↓
Production vendor dispatch ↓ Quality verification ↓ Client delivery tracking
13. Deployment Integrity Principle
No user may access project data outside tenant scope. No computation may occur without valid
license. All commercial usage must be traceable to metered events.
