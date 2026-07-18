# Current Task

- ID: TR-13
- Roadmap step: `TR-13`
- Title: Critical workflow certification
- Status: PASS
- Owner: Codex
- Started: 2026-07-18
- Branch: `codex/tr-13-critical-workflow`
- Base: `1169fed5e9036bd754cfcb79a7619933515d7f00` (closed TR-12 implementation, stacked on canonical `origin/main`)
- Risk: Critical end-to-end authorization, numerical reconciliation, report, sharing, and operational-safety certification
- Selected loops: Feature, defect, report visual QA, security, and workflow certification
- Retry budget: Maximum 3 evidence-based attempts per unchanged failure class; every retry must use a new hypothesis
- Resource budget: One isolated worktree, one disposable loopback MySQL target, deterministic synthetic fixtures, bounded Node/serverless/browser processes, and one final independent-review cycle
- Human gates: Shared database/configuration, schema or migration, dependency, scoring/financial/compliance policy, issued-copy/branding, Git publication, preview, and production deployment remain separately gated

## Goal

Prove the complete current MIYAR journey from a clean safe environment: login, organization, project readiness and evaluation, space programme, deterministic MQI, both existing brief contracts, stored report output, public sharing, and project-wide revocation, including role and cross-organization negatives and Node/serverless parity.

## Acceptance Criteria

- [x] One fresh synthetic user carries the same UI-created project through organization context, readiness, deterministic versioned evaluation, space programme, MQI, both briefs, stored report, share, and revoke.
- [x] Space programme, fit-out area, MQI surface quantities, 100% allocations, locked/manual behavior, AED min/mid/max costs, score inputs, API values, and report values reconcile.
- [x] The structured design brief, shareable AI-advisor brief, and stored report are certified as separate current contracts without implying an issued/approved state.
- [x] A full report persists and renders with identity, fingerprint, versions, evidence, assumptions, disclaimer, and exact source-value reconciliation.
- [x] Organization admins can create expiring public links and idempotently revoke all project links; audit and API results expose counts/status but never token values.
- [x] Invalid, expired, revoked, and never-issued share states are indistinguishable concealed 404s with identical privacy headers in Node and serverless.
- [x] Public resolution is bounded by the existing limiter without rejecting legitimate first access or letting rejected per-key traffic consume unrelated quota.
- [x] The developer/admin and designer/member paths behave as approved; viewers are read-only; foreign and unauthenticated callers cannot read, write, influence, share, or revoke protected data.
- [x] Authenticated brief reads and all logs, screenshots, traces, reports, audits, and durable evidence contain no share token or full share URL.
- [x] A guarded `pnpm certify:workflow` run accepts only loopback `TEST_DATABASE_URL` databases prefixed `miyar_test_tr13_`, never reuses ambient servers, keeps workers disabled, and fails if cleanup is incomplete.
- [x] Node and serverless API/report fingerprints agree; browser workflow passes against the Node shell at required desktop/mobile coverage with no unexpected page, console, request, or overflow failures.
- [x] Targeted tests, guarded MySQL integration, DB-free full suite, TypeScript, authorization/database audits, build/bundle freshness, artifact inspection, diff review, and independent reviews pass after the final fixes.
- [x] The fresh non-secret manifest fingerprint, certification record, correctly named runbook, project state, roadmap, worklog, and proven lessons reflect only executed final evidence.

## Approved Decisions and Assumptions

- Project-wide revocation intentionally clears every active AI-brief share for the authorized project; a new share is the recovery path.
- Developer persona maps to organization `admin`, designer maps to `member`, and `viewer` remains read-only; no schema roles are added.
- The public link exposes the AI-advisor brief, not the structured design brief or stored report. BR-01/BR-02 own future canonical issued-artifact design.
- Browser MQI uses the real no-provider Grade-C branch; representative Grade-A/B and AI narrative parsing use Vitest-only provider mocks with real routers/MySQL.
- Live-provider smoke is optional, separately authorized, and never a deterministic closure gate.

## Non-Goals

- No schema, migration, dependency, scoring weight, financial assumption, compliance policy, issued-copy, branding, shared database/configuration, push, merge, preview, or production deployment.
- No production AI fixture switch, no provider backdoor, and no unification of the two brief pipelines.
- No public runtime-capability API; SC-05 retains that architecture scope.

## Recovery and Stop Conditions

- All changes are reversible application/test/documentation changes on the isolated branch.
- Stop immediately for possible token/credential exposure, tenant leakage, shared-target contact, numerical-policy ambiguity, incomplete cleanup, or any requested human-gated expansion.
- A persistent blocker after three evidence-based attempts becomes `BLOCKED`; missing authority becomes `NEEDS_HUMAN`.

## Execution Plan

- [x] Create and verify the isolated worktree from exact TR-12 commit before any edit.
- [x] Implement bounded revocation, public-rate-limit, sanitization, and role-aware UI repairs with regression coverage.
- [x] Implement deterministic fixtures, guarded MySQL/runtime/browser orchestration, parity checks, and evidence artifacts.
- [x] Run the complete verification ladder and independent security/Claude reviews after the final review fixes.
- [x] Close or hand over TR-13 with exact terminal evidence and no unexplained artifacts.

## Initial Evidence

- The worktree was created first at `/Users/amrosaleh/Maiyar/miyar-v2-tr13` on `codex/tr-13-critical-workflow`; `HEAD` and merge-base both equal `1169fed5e9036bd754cfcb79a7619933515d7f00`, and initial `git status --short` was empty.
- The previous `e2e/core.spec.ts` contains only shallow public/unauthenticated checks and can reuse an ambient server.
- Existing code creates and resolves AI-brief share tokens but has no explicit revocation operation.
- `designAdvisor.getDesignBrief` currently returns the raw AI-brief row including `shareToken`; public sharing is separate from structured design briefs and stored reports.
- TR-12 provides the mandatory fail-closed database profile and disposable-test foundation used by this task.

## Closure Evidence

- `pnpm certify:workflow` passes the full ordered disposable-MySQL, Node/serverless, report-render, Node-browser, secret-scan, and strict-cleanup lifecycle. The final manifest records fixture `tr13-workflow-fixtures-v2`, terminal `PASS`, matching runtime fingerprints/reconciliations, and database absence after cleanup.
- Reconciled evidence is score `75`, fit-out area `20.00 m²`, room total `20.00 m²`, allocation `100.00%`, one locked allocation, two manual rooms, and AED `2,494.70` / `3,143.38` / `3,792.05` minimum/midpoint/maximum project totals.
- The hostile-parent ordinary suite passes 1,253 tests with 22 skipped; `pnpm check`, authorization 338/0, database-safety 112/2/0, build, stable tracked serverless bundle, 23/23 report artifacts, nine-page visual inspection, and diff checks pass.
- The initial independent review returned `CHANGES_REQUIRED`; every finding was repaired. The fresh high-reasoning security re-review and the final Claude Opus source review both returned `APPROVED`.
- No schema, migration, dependency, numerical-policy, shared database/configuration, Git publication, preview, or deployment action occurred.

## Next Action

Begin `SC-01` in a new worktree only when requested. It is the single next executable roadmap step; `BR-01`, `TR-14`, Git publication, and every shared/production action remain human-gated.
