# MIYAR Verified Project State

This is the canonical location for current observed repository facts. It is not a roadmap or a completion claim. Re-run commands before relying on this state for a new release or high-risk change.

## Observation Metadata

- Observed: 2026-07-14
- Commit: `422fbe0`
- Branch: `main`
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
- Historical documentation: `docs/reports/` and `antigravity-history/`

## Health Observation

At the observation above:

| Command | Result | Evidence summary |
|---|---|---|
| `pnpm test` | FAIL | 799 passed, 9 failed, 22 skipped out of 830 tests |
| `pnpm check` | FAIL | TypeScript errors in client pages, ingestion utilities, and server router contracts |
| `pnpm build` | NOT CERTIFIED | Not used to override the red mandatory health gates |

Reproduced groups and exit criteria live in `.agent/state/KNOWN_FAILURES.md`.

## Documentation State

- `AGENTS.md` is the canonical cross-agent engineering contract.
- `CLAUDE.md` imports `AGENTS.md`.
- `GEMINI.md` points to the same contract.
- `LOOP_ENGINEERING.md` defines lifecycle, retry, evidence, and terminal states.
- Current/future priorities live in `docs/ROADMAP.md`.
- Historical reports are non-authoritative unless reverified.

## Working Tree Caution

The observed worktree included user-owned uncommitted migration metadata, migration files, documents, spreadsheets, and local artifacts. Agents must inspect `git status` and preserve unrelated work. Untracked does not mean disposable.

## Environment Uncertainties

- Documentation historically names both PlanetScale and TiDB. Treat the actual `DATABASE_URL` target and deployment configuration as authoritative for a given environment without exposing credentials.

## CI Configuration in the Current Worktree

- CI has been changed to use pnpm and the committed pnpm lockfile.
- TypeScript, tests, and build are configured as fail-closed mandatory gates.
- Because the observed TypeScript and test baseline is red, CI is expected to remain red until the failures in `.agent/state/KNOWN_FAILURES.md` are fixed.

## Refresh Procedure

Update this file only after direct observation:

1. Record date, commit, branch, and relevant environment label.
2. Inspect the worktree without discarding unrelated changes.
3. Run the exact relevant commands.
4. Record exit status and concise evidence.
5. Update `.agent/state/KNOWN_FAILURES.md` for unresolved reproduced failures.
6. Do not copy changing counts into permanent agent instructions.
