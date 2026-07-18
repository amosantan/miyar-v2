# TR-13 Critical Workflow Certification

## Record identity

- Terminal status: `PASS`
- Observed: 2026-07-18 in the isolated local TR-13 worktree
- Source commit: `1169fed5e9036bd754cfcb79a7619933515d7f00`
- Branch: `codex/tr-13-critical-workflow`
- Fixture: `tr13-workflow-fixtures-v2` (synthetic only)
- Harness: `tr13-critical-workflow-v1`
- Live-provider result: not certified and not required for deterministic PASS

## Certified journey

The guarded workflow certified login, organization context, project creation, assumption confirmation, deterministic evaluation, space programme, MQI, the structured design brief, the separate AI-advisor brief, stored full-report output, expiring public sharing, mobile read-only access, and project-wide revocation.

The public link exposes only the AI-advisor brief produced by `designAdvisor.generateDesignBrief`. It does not expose the structured `design.generateBrief` artifact or the stored `project.generateReport` output. This certification does not introduce approval, issued-copy, or artifact-unification states.

## Numerical and report evidence

- Composite score: `75`
- Project and room fit-out areas: `20.00 m²` / `20.00 m²`; variance `0.00 m²` (`PASS`)
- Allocation groups: `100.00%` (`PASS`); locked and manual records preserved
- Material-library reconciled project totals: minimum `2,494.70`, midpoint `3,143.38`, maximum `3,792.05` AED
- The stored full report contains document identity, render-input fingerprint, model/benchmark/logic versions, governed evidence, assumptions, disclaimer, deterministic surface totals, allocation reconciliation, and material-library provenance.
- Production-compatible browser rendering and Poppler rasterization produced nine nonblank pages. Every page was visually inspected; pagination, clipping, overflow, identity, and disclaimer checks passed.
- The complete report certification matrix passed `23/23` artifacts after the renderer change.

## Security and runtime evidence

- Organization admin share creation and idempotent project-wide revocation passed.
- Member and viewer sharing controls are absent; viewer mutation is denied.
- Foreign-organization project access is concealed, and unauthenticated protected access is denied.
- Invalid, expired, revoked, and never-issued shares return indistinguishable concealed `404` responses with the same privacy headers in Node and serverless.
- Public first access remains valid under the bounded limiter, and rejected traffic does not consume unrelated-user quota.
- Authenticated brief reads expose `shareStatus` without a token. The generated report, manifest, audit details, browser output, screenshots, and traces contain no share-token value or full share URL; successful certification creates no screenshots and tracing is disabled.
- The Node and serverless critical HTTP/API/security matrix and numerical fingerprint parity passed. The browser journey ran against Node because Node owns the application shell. Static/Vite serving, SSE, API docs, request/performance logging, and schedulers remain intentional Node-only capabilities pending `SC-05`.

## Safety and cleanup

The harness rejected ambient database/server/worker/session configuration, accepted only a loopback `TEST_DATABASE_URL` database named with `miyar_test_tr13_`, used one serial worker with bounded commands, and did not reuse an ambient server. The strict `finally` cleanup passed, and a separate post-cleanup query confirmed the disposable database was absent.

The machine-readable non-secret manifest and raw local artifacts remain ignored under `tmp/tr13-workflow-certification/`.

## Verification record

- `pnpm certify:workflow`: `PASS`, including disposable MySQL, the ordered critical workflow, real Node/serverless application factories, production-compatible report rendering, the serial Node browser journey, and strict cleanup with post-cleanup database-absence proof.
- Hostile-parent ordinary `pnpm test`: `PASS` with 1,253 tests passed and 22 skipped, without contacting the supplied remote database target.
- `pnpm check`, `pnpm audit:authorization` (338 procedures, zero remediation), `pnpm audit:database-safety` (112 entrypoints, two generated-bundle exceptions, zero findings), `pnpm build`, tracked `api/index.js` freshness, `pnpm certify:reports` (23/23), and `git diff --check`: `PASS`.
- Independent high-reasoning authorization/token re-review and final Claude Opus source review: `APPROVED` after all five initial review findings were repaired.

No schema, migration, dependency, scoring weight, financial assumption, compliance policy, shared database/configuration, commit, push, merge, preview, or deployment was part of this local certification.
