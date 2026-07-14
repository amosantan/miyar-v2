# MIYAR Ownership and Approval Map

## Purpose

Define role-based responsibility for product decisions, technical domains, verification, operations, and high-impact approvals. “Owner” means accountable for decision and evidence, not necessarily sole implementer.

## Roles

| Role | Responsibility | Current assignee |
|---|---|---|
| Repository owner | Repository/protected-branch authority | Repository owner |
| Product owner | Users, outcomes, roadmap, report contracts, policy trade-offs | Unassigned |
| Engineering owner | Architecture, quality, CI, releases | Unassigned |
| Security owner | Auth, tenancy, secrets, incidents | Unassigned |
| Data owner | Sources, ingestion, quality, benchmark governance | Unassigned |
| Decision-model owner | Scoring, thresholds, financial/pricing policy, explainability | Unassigned |
| Design/report owner | Design intelligence, visuals, report quality | Unassigned |
| Operations/release owner | Environments, deployment, rollback, monitoring | Unassigned |
| Incident commander | Time-bounded incident coordination | Assigned per incident |

An unassigned role is a delivery risk. Critical action cannot proceed until an authorized human accepts the required role.

## Domain Ownership

| Domain | Primary paths | Accountable role | Required review |
|---|---|---|---|
| Product/roadmap | `docs/PRODUCT.md`, `docs/ROADMAP.md` | Product | Engineering feasibility |
| Architecture/contracts | architecture, `shared/`, router composition | Engineering | Domain owner; ADR if material |
| Authentication/tenancy | auth/core/organization paths | Security | Engineering + negative tenant tests |
| Scoring/explainability | scoring, normalization, logic registry | Decision-model | Product + independent deterministic review |
| Pricing/economics/risk | pricing/economic/ROI/risk/predictive | Decision-model | Data + product |
| Market/evidence | ingestion, DLD, evidence/benchmarks | Data | Security for network/source |
| Materials/MQI/space | design/material/space domains | Design/report | Decision-model for costs |
| Reports/sharing | reports, PDF/DOCX, share views | Design/report | Security + product |
| Frontend | `client/src/` | Engineering | Product/design + visual/accessibility QA |
| Database/migrations | `drizzle/`, DB helpers/scripts | Engineering + data | Operations for shared apply |
| CI/deployment | `.github/`, build and runbooks | Operations | Engineering + security |
| Agent governance | agents/adapters/loops/state | Engineering | Repository owner for authority changes |

## Approval Matrix

| Action | Required approval |
|---|---|
| Local reversible implementation | Current task authority |
| New production dependency | Engineering; security/licensing proportional to impact |
| Auth/tenant change | Security + engineering |
| Scoring weight/threshold/status | Product + decision-model |
| Pricing/financial/compliance assumption | Product + decision-model/data |
| Benchmark promotion/rollback | Data; product/model if decision impact |
| Migration generation/test | Engineering within task scope |
| Shared migration application | Operations + engineering/data |
| Production migration/backfill | Operations + engineering/data; product if semantics change |
| Public API breaking change | Engineering + product with migration/deprecation plan |
| Report/disclaimer contract | Product + report; legal/compliance when applicable |
| Protected-branch merge/push | Repository owner/configured reviewer policy |
| Production deploy/rollback | Operations/release owner + designated approver |
| External communication | Authorized business/product communications owner |
| Destructive data/secret rotation | Security/operations + affected domain owner |

## Verification Independence

High/critical authentication, tenant, scoring, pricing, compliance, migration, benchmark, sharing, release, and incident work needs a distinct review pass. Prefer a reviewer who did not author the change. If staffing prevents this, use a separate review context, fixed/adversarial tests, explicit approval, and document the limitation.

## Escalation and Maintenance

Use `NEEDS_HUMAN` when ownership/authority is unassigned or ambiguous. Assign names through review when roles are established. Ownership cannot override safety policy, required evidence, or user scope.
