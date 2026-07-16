# MIYAR Verified Project State

This is the canonical location for current observed repository facts. It is not a roadmap or a completion claim. Re-run commands before relying on this state for a new release or high-risk change.

## Observation Metadata

- Observed: 2026-07-16
- Commit: `a15424b` plus uncommitted roadmap, authorization, audit, runtime-safety, tenant-guard, and client-performance changes
- Branch: `codex/loop-engineering-architecture`
- Remote: `https://github.com/amosantan/miyar-v2`
- Package manager declared by repository: `pnpm`

## Technology Observed

- React 19, TypeScript, Vite, Wouter, TanStack Query/tRPC
- Express and tRPC server
- Drizzle ORM with a MySQL-compatible schema
- Vitest and Playwright
- Gemini integration, optional OpenAI transcription, AWS S3, Google Maps, and ingestion tooling
- Node server and serverless API build targets

## Repository Shape Observed

- Canonical schema: `drizzle/schema.ts`
- Client: `client/src/`
- API composition: `server/routers.ts`
- Domain engines: `server/engines/`
- Database helpers: `server/db.ts`
- Shared contracts: `shared/`
- Serverless source entry: `server/serverless/index.ts`
- Historical documentation: `docs/archive/` and `.agent/archive/`
- Project artifacts: `docs/artifacts/`

## Health Observation

At the observation above:

| Command      | Result | Evidence summary                                                                                             |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------ |
| `pnpm test`  | FAIL   | With `DATABASE_URL=''`: 849 passed, 9 failed, 22 skipped out of 880 tests; the same nine baseline cases fail |
| `pnpm check` | FAIL   | Same 52 recorded TypeScript diagnostics; no errors in TR-02 authorization files                              |
| `pnpm build` | PASS   | Client, Node server, and serverless bundle pass; entry JS is 678 KB / 199 KB gzip                            |

Reproduced groups and exit criteria live in `.agent/state/KNOWN_FAILURES.md`.

## Documentation State

- `AGENTS.md` is the canonical cross-agent engineering contract.
- `CLAUDE.md` imports `AGENTS.md`.
- `GEMINI.md` points to the same contract.
- `LOOP_ENGINEERING.md` defines lifecycle, retry, evidence, and terminal states.
- Current/future priorities live in `docs/ROADMAP.md`.
- Historical reports are non-authoritative unless reverified.

## Working Tree Caution

The observed worktree includes user-owned migration `0044` files and metadata that were not modified by the organization task. Local Word/Excel working artifacts now live under ignored `docs/artifacts/` categories, and the local PlanetScale CLI lives under ignored `.local/bin/`. Agents must continue to inspect `git status`; untracked does not mean disposable.

## Environment Uncertainties

- Documentation historically names both PlanetScale and TiDB. Treat the actual `DATABASE_URL` target and deployment configuration as authoritative for a given environment without exposing credentials.
- The full Vitest suite is not database-hermetic: the auth logout test can initialize the configured database and attempt an audit-log write. See `KF-008`; use a dedicated safe test profile before treating local test execution as externally non-mutating.

## CI Configuration in the Current Worktree

- CI has been changed to use pnpm and the committed pnpm lockfile.
- TypeScript, tests, and build are configured as fail-closed mandatory gates.
- Because the observed TypeScript and test baseline is red, CI is expected to remain red until the failures in `.agent/state/KNOWN_FAILURES.md` are fixed.

## Authorization Foundation

- `TR-01` inventories all 327 router procedures and assigns 140 remediation paths.
- `TR-02` provides typed organization-resource and public-share authorization primitives with 49 passing targeted tests.
- Production router adoption remains open under `TR-03` through `TR-05`.

## Refresh Procedure

Update this file only after direct observation:

1. Record date, commit, branch, and relevant environment label.
2. Inspect the worktree without discarding unrelated changes.
3. Run the exact relevant commands.
4. Record exit status and concise evidence.
5. Update `.agent/state/KNOWN_FAILURES.md` for unresolved reproduced failures.
6. Do not copy changing counts into permanent agent instructions.
