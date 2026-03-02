# MIYAR V7 Implementation Plan: Production Hardening & Multi-Tenancy

## Goal Description
Transform MIYAR into a multi-tenant SaaS platform with robust data isolation, comprehensive audit logging, health monitoring, and resolution of V6 carryover defects, paving the way for a real UAE production launch.

## Proposed Changes

### Priority 0: V6 Carryover Fixes
*   **Alert Scheduler**: Create `server/engines/autonomous/alert-scheduler.ts` to run `evaluateAlerts()` every 15 mins. Invoke `startAlertScheduler()` inside `server/_core/index.ts`.
*   **NL Query Log**: Add `nlQueryLog` table to `drizzle/schema.ts`. Create migration `0021`. Update `nl-engine.ts` to log queries. Enforce 20 queries/hour rate limit in autonomous router `processNlQuery`.
*   **Report Rendering Bugs**:
    *   Fix 5-Lens labels and evidence stringification in `server/engines/five-lens.ts` and `pdf-report.ts`.
    *   Fix ROI zero values in `server/engines/roi.ts` (ensure correct input mapping).
    *   Ensure evidence records are properly queried and inserted into report parameters. Seed sample data if none exists for the test project.

### Priority 1: Multi-Tenancy Foundation
*   **Schema & Migrations**:
    *   Add `organizations`, `organization_members`, `organization_invites` tables. (Migration `0022`)
    *   Add `currentOrgId` to `users` and `organizationId` to `projects`. (Migration `0023`)
*   **Data Isolation**:
    *   Implement `orgProcedure` in `server/_core/trpc.ts` enforcing membership checks and role hierarchy (owner > admin > analyst > viewer).
    *   Apply `organizationId` filters to all queries targeting projects, alerts, and design briefs across all routers.
*   **Organization Management**:
    *   Build `server/routers/organization.ts` handling org creation, invites, member removal, and context switching.

### Priority 2: Audit & Compliance Layer
*   **Audit Subsystem**: Implement `server/_core/audit.ts` exporting `auditLog()`. Wrap it in safe execution blocks (never throw).
*   **Integration Points**: Wire `auditLog()` into auth (login/register/logout), project mutations, org management, alert management, and logic weight changes.
*   **Admin Dashboard**: Add `admin.getAuditLog` procedure and a new "Audit Log" tab in the Admin UI.

### Priority 3: Operational Resilience
*   **Health Checks**: Add `admin.healthCheck` displaying status for DB, LLM, and schedulers, alongside key metrics. Build UI indicator in the Admin header.
*   **Error Handling**: Attach global unhandled rejection/exception handlers in `index.ts`. Ensure schedulers use strict try/catch blocks. Gracefully fall back on LLM invocation or DB connection failures without crashing the Node process.

### Priority 4: Test Suite Certification
*   **New Test Coverage**: Add extensive test suites for the alert scheduler, NL engine safety and rate limiting, organization router isolation, and system hardening mechanisms.
*   **Regression Guard**: Ensure the current 502 test functions remain intact, scaling total coverage to >580 passing specs with zero TypeScript errors.

## Verification Plan

### Automated Tests
Run Vitest specifications aiming for 100% pass rate:
```bash
pnpm test
```
Verify tests cover all isolated Multi-tenant access controls, rate limiting logic, and graceful degradation handlers.

### Manual Verification
*   Start the server and confirm `[AlertScheduler] Started` logs correctly.
*   Log into the UI, create a new Organization, invite a member, and switch contexts.
*   Generate a full report and observe non-undefined 5-Lens sections and non-zero ROI calculations.
*   Trigger an NL query to verify audit table logging, then deliberately exceed the limit to hit the 429 TRPCError.
*   Navigate to the Admin Panel to review live Audit Logs and the Health Monitoring widget.
