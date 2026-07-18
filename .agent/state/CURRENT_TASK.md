# Current Task

- ID: TR-12
- Roadmap step: `TR-12`
- Title: Safe local and test database profiles
- Status: PASS
- Owner: Codex
- Started: 2026-07-18
- Branch: `codex/tr-12-safe-db-profiles`
- Base: `ee6c834` (`origin/main` TR-11 release-state commit; runtime application release remains `d0c84da`)
- Risk: High operational and tenant-safety risk: an ordinary local command must not connect to or write a protected/shared database.
- Selected loops: Operations/security, defect, configuration, and documentation
- Retry budget: Maximum 3 evidence-based attempts per unchanged failure class
- Resource budget: One isolated worktree; configuration guard, profile contract, focused tests/dry startup evidence, and documentation only. No schema, migration, dependency, shared-database write, deployment, or production configuration mutation.
- Human gates: Any shared deployment configuration change, remote/shared database connection or write, migration, seed/reset, production worker change, deployment, merge, or publication requires separate named human authorization. Command-scoped remote-database approval must never be persisted in `.env` or committed.

## Goal

Make local, test, preview, and production database behavior explicit and fail closed so ordinary developer and test commands cannot silently contact or mutate a protected/shared environment.

## Acceptance Criteria

- [x] The runtime recognizes `local`, `test`, `preview`, and `production`, rejects invalid or contradictory profile signals, and treats a missing selector as untrusted `local` rather than inferring trust from a configured URL.
- [x] Local and test profiles accept only loopback/disposable database targets by default; protected/shared remote targets fail before a connection is opened.
- [x] A remote database is permitted only for a single explicitly authorized command, with approval absent from `.env`, examples, source control, startup defaults, and child-process inheritance where applicable.
- [x] Ordinary `pnpm test` is database-free and cannot inherit a dotenv-restored shared `DATABASE_URL`; guarded database integration uses a separately named disposable test target.
- [x] Preview and production profiles remain explicit operational profiles; their database access and worker behavior are not enabled by a local default.
- [x] Background ingestion, learning, and alert workers stay disabled outside production unless explicitly enabled for an approved isolated workflow; workers never start as a side effect of test commands.
- [x] `.env.example`, the local-development runbook, security requirements, and architecture state the profile, database-free-test, guarded-integration, command-scoped approval, worker, seed/reset, and human-gate contract without credentials or approval values.
- [x] Focused configuration tests, DB-free full-suite evidence, guarded disposable-database smoke, dry startup logs, runbook consistency review, and diff review provide objective evidence; `KF-008` is closed because its exit criterion is verified.

## Assumptions and Approved Decisions

- `MIYAR_RUNTIME_PROFILE` is a process/deployment profile selector that is intentionally ignored in dotenv files. `local` is the safe default; `test`, `preview`, and `production` must be intentionally selected by their invoking command or deployment configuration.
- `MIYAR_DATABASE_APPROVAL` is a command-scoped binding only after named human authorization. Its canonical value is `sorted-operation-list@host:port/database`, for example `serve+ingest@dev.example:3306/miyar_dev`; it is intentionally absent from `.env.example` and must not be stored in `.env`.
- `MIYAR_DEPLOYMENT_DATABASE_TARGET` is an optional managed-preview target binding. It requires infrastructure approval and is intentionally absent from `.env.example`.
- `TEST_DATABASE_URL` names a disposable integration target and is never a fallback for ordinary unit tests.
- A loopback host is necessary but not sufficient proof of safety: seed/reset, migration, and other writes remain separately gated by target verification and human approval when required.

## Non-Goals

- No schema, migration, seed/reset, backfill, shared/production database write, deployment, production configuration mutation, dependency change, formula/policy change, commit, push, merge, or publication.
- No attempt to close `KF-008` from documentation alone.
- No stored approval token, credential, remote URL, production secret, or claim that a remote target is safe merely because an environment label says so.

## Recovery

All profile and documentation changes must be reversible. Stop immediately if a command could connect to a shared/protected database without named authorization, a worker could write outside an approved isolated workflow, or a credential/approval value could be persisted or exposed.

## Execution Plan

- [x] Establish the current safety baseline, review `KF-008`, existing worker behavior, and the prior dotenv inheritance evidence.
- [x] Implement the profile and connection guard with focused configuration tests.
- [x] Make ordinary tests DB-free and preserve guarded disposable-database integration coverage.
- [x] Document profile, worker, seed/reset, remote-approval, and human-gate operations.
- [x] Run the proportionate verification ladder and close `KF-008` only from its proven exit criterion.

## Initial Evidence

- `KF-008` is open: historical ordinary `pnpm test` inherited a remote `DATABASE_URL`, while `DATABASE_URL='' pnpm test` was database-free because dotenv treats an explicit empty value differently from an unset value.
- `scripts/run-guarded-mysql-tests.ts` already rejects caller-provided `DATABASE_URL` and requires `TEST_DATABASE_URL` for its disposable MySQL integration path.
- The Node runtime starts workers by default in production and otherwise requires `ENABLE_BACKGROUND_JOBS=true`; the profile contract must preserve that fail-safe posture.
- TR-11 closed at `PASS`; `.agent/state/ROADMAP.md` identifies TR-12 as the sole dependency-valid next step.

## Verified Evidence

- The worktree was created first at `/Users/amrosaleh/Maiyar/miyar-v2-tr12` on `codex/tr-12-safe-db-profiles` from exact `origin/main` commit `ee6c834`; the stale dirty root checkout was not modified.
- The focused database policy, runtime, and AST-audit suites pass 74/74. They cover malformed and loopback targets, exact approvals, hostile dotenv controls, partial deployment signals, current-target rechecks, both MySQL constructor families, unit/integration separation, ingestion operation separation, worker decisions, and unreachable audit preflights.
- A hostile parent `DATABASE_URL`, profile, approval, preview binding, Vercel signals, and worker opt-in cannot escape the ordinary Vitest configuration: `pnpm test` passes 1,206 tests with 22 skipped and emits no database connection attempt.
- The guarded disposable MySQL 8 workflow passes 19/19 against `miyar_auth_test_tr12_final`; its cleanup passes and the bounded Docker container is removed. An initial setup-only attempt omitted database creation, failed with `ER_BAD_DB_ERROR`, and was corrected without changing product code.
- `pnpm check`, `pnpm audit:authorization` (337 procedures, zero remediation), `pnpm audit:database-safety` (106 inventoried entrypoints, two exact generated-bundle exceptions, zero findings), `pnpm build`, and `git diff --check` pass.
- Bounded startup checks prove local DB-free startup, remote denial before listen, complete production/preview signal handling, and worker authorization failure exiting status 1 with sanitized logs that exclude credentials and approval values.
- The tracked serverless bundle was regenerated from the guarded source; CI rebuilds it and fails if `api/index.js` is stale.
- Independent GPT-5.6 security review returned `APPROVED`; final Claude Opus implementation review returned `APPROVED`.
- At implementation closure, no schema, migration, dependency, shared/production database write, deployment, shared configuration mutation, commit, push, PR, or merge had been performed.
- The owner subsequently authorized publication and deployment. Candidate `1169fed` merged through PR #17 as canonical-main commit `43e5019`; canonical-main CI run `29654957839` passed, Vercel target `4ixzzXRp886bet8XDRhc439czfWd` completed, and three root/health observations plus tenant/share negative checks and rendered landing-page browser verification pass. No database, schema, migration, dependency, or shared-configuration operation was required.

## Next Action

TR-12 is complete at `PASS`. Begin `TR-13`, the sole next executable step, in a new worktree when authorized.
