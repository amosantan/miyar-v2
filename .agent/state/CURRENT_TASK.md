# Current Task

- ID: TR-03
- Roadmap step: `TR-03`
- Title: Authorize the design-domain router
- Status: PASS
- Owner: Codex
- Started: 2026-07-16
- Risk: High API/security change across project resources, public shares, storage, generation, exports, and evidence reads
- Selected loop: API/security defect loop from `LOOP_ENGINEERING.md`
- Retry budget: 3 evidence-based attempts per failure class
- Approval gates: no schema migration, shared database access, deployment, commit, push, or protected-branch action

## Goal

Ensure every design-domain authenticated procedure proves organization ownership before project data access or side effects, while preserving read-only public shares behind a fail-closed token and expiry boundary.

## Locked Decisions

- `attachVisualToPack` fails closed until a typed attachment model is approved.
- Evidence requests without a project return only records explicitly owned by the caller's organization.
- Null-owned evidence and prompt templates are not treated as governed global data.
- Missing, cross-organization, orphaned, inconsistent, and legacy-null resources use indistinguishable `NOT_FOUND` responses.

## Acceptance Criteria

- [x] All authenticated TR-03 procedures require organization context and an authorized project/resource.
- [x] Composite, polymorphic, nested, and batch operations prove every resource belongs to the same authorized project before side effects.
- [x] Organization-scoped database mutations reject zero affected rows and prevent partial cross-project batch writes.
- [x] Rejected requests do not call storage, image/floor-plan generation, document export, RFQ insertion, audit logging, or mutation helpers.
- [x] `getEvidenceChain` returns only authorized project evidence or caller-organization evidence.
- [x] `resolveShareLink` uses the canonical active-share resolver and remains read-only.
- [x] `attachVisualToPack` performs no data access or side effect and returns `PRECONDITION_FAILED`.
- [x] The semantic design-router review finds no incorrectly classified guarded path.
- [x] Targeted authorization tests, `pnpm audit:authorization`, `pnpm check`, safe full tests, and build pass.
- [x] Existing user-owned migration, runtime-safety, client, learning-router, and generated-bundle changes remain preserved.

## Baseline Evidence

- Branch: `codex/loop-engineering-architecture` at `d6f7940` plus existing uncommitted work.
- Existing dirty files: `api/index.js`, `client/src/App.tsx`, `drizzle/meta/_journal.json`, `server/_core/index.ts`, `server/routers/learning.ts`, migration `0044`, and runtime-safety files.
- `pnpm audit:authorization`: PASS; 327 procedures and 140 remediation rows, including 39 assigned to TR-03.
- TR-02 authorization suite: PASS; 49 tests.
- `pnpm check`: PASS.

## Plan

- [x] Add named design-resource authorization resolvers and organization-scoped database helpers.
- [x] Guard project, asset, brief, visual, board, comment, floor-plan, evidence, DLD, and share procedures.
- [x] Validate composite and polymorphic resource consistency before downstream work.
- [x] Add router contract and side-effect suppression tests.
- [x] Regenerate authorization evidence, run the full verification ladder, perform adversarial review, and close durable state.

## Completion Evidence

- `pnpm audit:authorization`: PASS; 327 procedures, zero `TR-03` rows, 93 `TR-04` rows, and eight `TR-05` rows.
- Authorization suites: PASS; 68 tests across the design router and TR-02 primitives.
- `pnpm check`: PASS with zero diagnostics.
- `DATABASE_URL='' pnpm test`: PASS; 886 passed and 22 skipped across 40 files, with no database connection.
- Client, Node, and serverless builds: PASS; serverless output was directed to `/tmp` so the pre-existing user-owned `api/index.js` remained untouched.
- Scoped diff check: PASS.
- Independent adversarial review: `APPROVED_NO_OBJECTION` after two requested-change rounds were resolved.
- No schema migration, shared database action, deployment, commit, or push was performed.

## Next Action

Start `TR-04 — Authorize remaining project routers`.
