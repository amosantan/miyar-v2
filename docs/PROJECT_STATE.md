# MIYAR Verified Project State

This is the canonical location for current observed repository facts. It is not a roadmap or a completion claim. Re-run commands before relying on this state for a new release or high-risk change.

## Observation Metadata

- Observed: 2026-07-16
- Application release commit: `9e5d1e395ab7486fdfc73943d279820d5a91d53c`
- Branch: `main`; local and `origin/main` matched at the application release observation
- Remote: `https://github.com/amosantan/miyar-v2`
- Package manager declared by repository: `pnpm`
- Production: Vercel deployment `dpl_HQ6mnWadr46VhfjS3GhGQnxi48Ng` reached `READY` from the exact application release commit
- Release identity policy: later documentation/state-only commits do not supersede the application release SHA
- Active worktree observation: `codex/tr-04-authorization` at pushed application commit `92847f3`; migration 0046 and the approved production ownership remediation are complete

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

| Command                         | Result | Evidence summary                                                                                                    |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL='' pnpm test`     | PASS   | 950 passed and 22 skipped; no shared database connection occurred                                                   |
| Guarded MySQL authorization run | PASS   | Disposable MySQL 8 suite passed 13/13, including report and portfolio-alert rollback, locking, ownership races, expiry, uniqueness, and scoped writes |
| PlanetScale compatibility       | HISTORICAL PASS | TR-03H disposable branch passed 6/6 applicable tests; not rerun for the uncommitted TR-04 worktree            |
| `pnpm check`                    | PASS   | Zero TypeScript diagnostics                                                                                         |
| `pnpm audit:authorization`      | PASS   | All 329 application procedures are inventoried and hash-bound scoped-write evidence is current                      |
| `pnpm build`                    | PASS   | Client, Node server, and generated serverless bundle pass                                                           |

Reproduced groups and exit criteria live in `.agent/state/KNOWN_FAILURES.md`.

## Documentation State

- `AGENTS.md` is the canonical cross-agent engineering contract.
- `CLAUDE.md` imports `AGENTS.md`.
- `GEMINI.md` points to the same contract.
- `LOOP_ENGINEERING.md` defines lifecycle, retry, evidence, and terminal states.
- Current/future priorities live in `docs/ROADMAP.md`.
- Historical reports are non-authoritative unless reverified.

## Production Database Observation

- Migration 0044 was verified complete before TR-03H release.
- Duplicate preflight found zero duplicate membership pairs and zero duplicate non-null share tokens.
- Backup `6168hbonz89d` completed successfully before migration 0045.
- Migration 0045 is complete: `organization_members_org_user_unique` and `ai_design_briefs_share_token_unique` are present as unique indexes.
- Migration 0046 is complete: `portfolio_alerts` has 16 expected columns, a primary key, and unique `(organization_id, active_dedup_key)`.
- TR-04 release preflight found 2 null-owned projects, 4 null-owned scenarios, and 8 reports attached to null-owned projects. The user approved the unique organization-1 mapping; one transaction updated the 2 projects and 4 scenarios, and all three post-remediation counts are zero. `KF-015` is closed.
- Production smoke checks were read-only and did not print tokens or credentials.

## Environment Uncertainties

- Documentation historically names both PlanetScale and TiDB. Treat the actual `DATABASE_URL` target and deployment configuration as authoritative for a given environment without exposing credentials.
- The ordinary full Vitest command is not database-hermetic. Continue using the explicit safe `DATABASE_URL=''` profile until `KF-008` closes.
- GitHub Actions cannot start while the repository owner account is billing-locked (`KF-014`). For this TR-03H release only, the user approved Vercel hosted clean builds on pushed commits plus the recorded local MySQL, PlanetScale, full-suite, audit, build, and independent-review evidence.

## CI Configuration in the Current Worktree

- CI configuration uses pnpm and the committed lockfile, with fail-closed TypeScript, test, build, and isolated MySQL jobs.
- GitHub did not execute those jobs because of `KF-014`; the approved bounded substitute was Vercel's hosted clean build on every pushed release commit.
- The observed local TypeScript, safe full-suite, authorization, build, isolated MySQL, and PlanetScale compatibility gates are green.

## Authorization Foundation

- `TR-01` inventory extraction now covers all 329 application procedures.
- `TR-02` provides typed organization-resource and public-share authorization primitives with 49 passing targeted tests.
- `TR-03` closes all 39 design-router remediation paths with organization-locked resource operations and fail-closed public shares.
- `TR-03H` closes live membership, design roles, scoped final writes, composite atomicity, rejected-upload compensation, public-share privacy, real-SQL evidence, and canonical release identity.
- `TR-04` closes all 93 remaining project-router authorization/global-governance paths, including the later ultra-review remediation for atomic report persistence and tenant-owned portfolio alerts. The live inventory has zero `TR-04` and exactly eight pooled-data rows under `TR-05`; targeted, disposable MySQL, safe full-suite, TypeScript, audit, build, diff, and independent-review gates pass.
- `TR-05` is the next executable step.

## Refresh Procedure

Update this file only after direct observation:

1. Record date, commit, branch, and relevant environment label.
2. Inspect the worktree without discarding unrelated changes.
3. Run the exact relevant commands.
4. Record exit status and concise evidence.
5. Update `.agent/state/KNOWN_FAILURES.md` for unresolved reproduced failures.
6. Do not copy changing counts into permanent agent instructions.
