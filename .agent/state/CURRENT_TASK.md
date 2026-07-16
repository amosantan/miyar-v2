# Current Task

- ID: TR-03H
- Roadmap step: `TR-03H`
- Title: Design authorization hardening
- Status: ACTIVE
- Owner: Codex
- Started: 2026-07-16
- Risk: Critical authentication, tenant isolation, transaction, migration, storage, public-share, and release work
- Selected loop: API/security defect loop plus schema and release verification
- Retry budget: 3 evidence-based attempts per failure class
- Approval gates: applying migration 0045 to a shared target, pushing `main`, production deployment, and production smoke writes require separate approval

## Goal

Close the authorization guarantees that remained unproven after TR-03: live organization membership, design-role enforcement, final scoped share writes, atomic composite mutations, rejected-upload cleanup, public-share cache/index controls, real MySQL evidence, and canonical-main release identity.

## Locked Decisions

- Every organization-scoped request requires exactly one current membership row; global admins do not bypass membership.
- Design viewers are read-only; members and organization admins may perform normal design mutations; approval and share creation require organization admin.
- Migration 0045 adds unique membership and public-share-token indexes; duplicate production data fails closed for human resolution.
- Direct upload rejection uses compensating storage deletion; indeterminate commit outcomes are alerted rather than deleted blindly.
- The canonical-main PR includes all nine existing branch commits plus TR-03H and is reviewed as one complete release diff.

## Acceptance Criteria

- [x] Removed, missing, duplicate, and stale memberships are rejected before handler access.
- [x] Design viewers cannot mutate; organization-admin-only operations reject members and viewers.
- [x] Share-token creation is organization/project scoped, collision-safe, and database-unique.
- [x] Board deletion, board creation, RFQ insertion, and floor-plan asset linking are atomic.
- [x] Explicit rejected asset/floor-plan persistence removes the uploaded object in unit contracts.
- [x] Public-share API and page responses are `no-store` and `noindex` in application/header contracts.
- [x] Real isolated MySQL tests exercise every named TR-03 scoped helper and rollback path.
- [x] Authorization inventory covers the full 329-procedure app router with hash-bound final-write evidence.
- [x] Unit tests, MySQL integration, authorization audit, TypeScript, build, and independent security review pass.
- [ ] Authorized PlanetScale development-branch compatibility run passes.
- [x] Canonical-main and production release remain stopped at their explicit human gates until separately authorized.

## Baseline Evidence

- Branch created from `1f972f4`.
- `pnpm audit:authorization`: PASS but covers 327 router-directory procedures and omits two system procedures.
- Targeted authorization suite: 68 passing tests.
- `pnpm check`: PASS.
- Production currently runs the feature-branch release rather than canonical `main`.

## Current Verification Evidence

- `DATABASE_URL='' pnpm test`: PASS, 930 passed and 22 skipped.
- `pnpm check`: PASS.
- `pnpm audit:authorization`: PASS, 329 procedures.
- `pnpm build`: PASS for client, Node server, and generated serverless bundle.
- Membership, design-role, public-share-header, upload-compensation, and design authorization contracts: 63 passing targeted tests.
- Guarded MySQL launcher rejects caller-provided `DATABASE_URL` and non-local `TEST_DATABASE_URL`.
- First guarded MySQL 8 run exposed Drizzle-wrapped duplicate-key handling; the retry detector was corrected to inspect the error cause chain.
- Final guarded MySQL 8 run: PASS, 7/7 serial real-SQL tests; transaction rollback triggers, two-connection ownership locking, unique indexes, and scoped writes passed.
- Runner-finally cleanup was independently queried at zero remaining fixture rows; the disposable container was removed.
- MySQL evidence is bound to SHA-256 hashes of the tested schema, migration, helpers, router, runner/config, cleanup script, and test source; the authorization audit downgrades stale hashes.
- Complete-diff Claude review ended `APPROVED_NO_OBJECTION` after verifying evidence hash binding in normal audit check mode.
- Draft PR `#1` contains the complete ten-commit release diff. GitHub Actions did not start either job because the repository owner account is locked for a billing issue; no CI step executed.

## Next Action

Resolve the GitHub Actions billing lock and rerun both required jobs, then obtain separate authorization for the PlanetScale compatibility run before any canonical-main, shared-migration, or deployment action.
