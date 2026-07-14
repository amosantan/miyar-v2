# MIYAR Current Roadmap

## Purpose

This file contains current and future priorities only. Completed phase narratives belong in historical reports. Priorities must be revalidated against product evidence, customer needs, and repository health before execution.

## Priority 0 — Restore a Trustworthy Engineering Baseline

### P0.1 Type safety

- Resolve current `pnpm check` failures.
- Keep the newly configured fail-closed CI TypeScript gate green.

Exit criterion: local and CI TypeScript checks exit successfully without suppression.

### P0.2 Test health

- Resolve the reproduced connector, board-report, space-program, and authentication failures.
- Classify skipped market-intelligence tests and establish explicit prerequisites.
- Ensure full-suite reporting distinguishes passed, failed, skipped, flaky, and environment-dependent tests.

Exit criterion: the intended baseline is green, or every non-green test has an approved quarantine owner, reason, expiry, and replacement verification.

### P0.3 Build and critical workflow certification

- Certify production build from a clean checkout.
- Run the complete project-to-investor-output workflow.
- Validate login, organization isolation, project creation, evaluation, space programme, MQI, investor summary, export, and public share behavior.

Exit criterion: evidence is recorded in `docs/PROJECT_STATE.md` and CI enforces required gates.

### P0.4 Migration reconciliation

- Reconcile schema, migration journal, migration SQL, and live environment state.
- Establish environment-specific migration and rollback procedures.
- Remove ambiguity between database provider documentation and actual deployment configuration.

Exit criterion: a new environment can be created reproducibly and a representative migration can be restored safely.

## Priority 1 — Investor Workflow Completion

### P1.1 Report integrity and rendering

- Reconcile material-board annex behavior with report contracts.
- Add visual regression fixtures for investor, design, board, and share outputs.
- Validate empty, partial, large, Arabic, and long-content cases.

### P1.2 Share-link lifecycle

- Provide listing, revocation, renewal, expiry visibility, and auditability.
- Test token scope, expiry, enumeration resistance, and organization boundaries.

### P1.3 Onboarding and guided completion

- Make the next required project action explicit.
- Prevent dead ends when recommendations, space programmes, evidence, or quantities are missing.
- Preserve expert/manual workflows alongside AI guidance.

### P1.4 Board-ready economic evidence

- Reconcile material, room, benchmark, score, risk, sustainability, and ROI numbers across screen, PDF, DOCX, and shared view.
- Ensure all material claims expose provenance and assumption quality.

## Priority 2 — Data Authority and Market Coverage

### P2.1 Source and connector reliability

- Repair connector runtime consistency.
- Define confidence and reliability formulas as versioned, tested policy.
- Track freshness, extraction quality, fallback use, and source failure explicitly.

### P2.2 Benchmark coverage

- Measure exact, fallback, synthetic, stale, and insufficient coverage by project dimension.
- Prioritize high-value UAE geographies, typologies, tiers, materials, and rooms.
- Keep synthetic values visibly qualified and excluded where authoritative evidence is required.

### P2.3 Data-quality operations

- Automate anomaly, duplicate, unit, currency, date, and provenance checks.
- Establish approval and rollback for benchmark promotion.
- Add incident procedures for corrupted or misleading intelligence.

## Priority 3 — Product Reliability and Governance

### P3.1 Security and tenancy

- Expand cross-organization negative tests.
- Review public sharing, uploads, ingestion, secrets, admin roles, and audit coverage.
- Add dependency and secret scanning to CI.

### P3.2 Observability

- Define service-level indicators for API errors, latency, report generation, ingestion, scheduled jobs, and critical workflows.
- Correlate request, organization, project, job, and report identifiers without logging sensitive payloads.
- Document alert ownership and escalation.

### P3.3 Architecture decisions

- Record major existing architecture boundaries as ADRs.
- Require ADRs for high-impact changes.
- Reconcile historical claims into current product and architecture documents.

## Priority 4 — Advanced Intelligence

Execute only after the reliability baseline is trustworthy.

- Outcome-backed benchmark calibration with human approval.
- Portfolio capital-allocation and systemic supply-chain intelligence.
- Improved probabilistic forecasts and calibration reporting.
- Expanded sustainability, embodied-carbon, lifecycle, and compliance evidence.
- Competitive-positioning outputs using current governed evidence.
- Arabic-first report localization.
- Supplier/RFQ workflows with explicit communication and commercial approval gates.

## Prioritization Rules

Rank work by:

1. Safety, tenant isolation, data integrity, and numerical correctness.
2. Ability to complete the core investor/developer workflow.
3. Evidence authority and market freshness.
4. Reproducibility, observability, and operational recovery.
5. User value and commercial differentiation.
6. Convenience and polish.

Do not prioritize feature count over a red verification baseline.

## Roadmap Governance

- Every roadmap item needs an owner before entering implementation.
- Every implementation task uses a loop under `docs/loops/`.
- Acceptance criteria must be observable and include required evidence.
- Completion moves to a dated historical report or release record; it does not remain as a completed section here.
- Changes to product direction require product-owner review.
- Changes to scoring, financial, compliance, or benchmark policy require the relevant human approval gate.
