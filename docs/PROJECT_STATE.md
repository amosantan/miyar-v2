# MIYAR Verified Project State

This is the canonical location for current observed repository facts. It is not a roadmap or a completion claim. Re-run commands before relying on this state for a new release or high-risk change.

## Observation Metadata

- Observed: 2026-07-17
- Application release commit: `1f8c97d288ce97315664229049db3db38ec65bb2`
- Branch identity: `codex/tr-05-data-isolation` contains and tracks the deployed application SHA; canonical `origin/main` remains at the completed TR-04 baseline pending a separately authorized merge
- Remote: `https://github.com/amosantan/miyar-v2`
- Package manager declared by repository: `pnpm`
- Production: Vercel deployment `dpl_G7hPvJk7WUqwxYBdrjZN6noNxNFn` reached `READY` from the exact clean TR-05 application release commit and is aliased to `www.miyar.dev`
- Release identity policy: later documentation/state-only commits do not supersede the application release SHA
- Active worktree observation: clean `codex/tr-05-data-isolation` at the deployed application commit before this state-only closeout; migration 0047 and the controlled zero-row production classification are complete

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
| `DATABASE_URL='' pnpm test`     | PASS   | 962 passed and 22 skipped; no shared database connection occurred                                                   |
| Guarded MySQL authorization run | PASS   | Disposable MySQL 8 suite passed 18/18, including TR-05 corpus isolation, scoped derived writes, and prior authorization contracts |
| PlanetScale compatibility       | PASS   | Production Vitess accepted all 23 migration-0047 statements; 19 columns, five indexes, defaults, counts, and post-deploy reads verified |
| `pnpm check`                    | PASS   | Zero TypeScript diagnostics                                                                                         |
| `pnpm audit:authorization`      | PASS   | All 331 application procedures are inventoried with zero remediation rows and current hash-bound scoped-write evidence |
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
- Migration 0047 is complete on production: all 19 expected corpus/ownership columns and all five corpus indexes were verified. A restricted encrypted affected-table recovery snapshot was verified before DDL (SHA-256 `197bfc7ac04f31c44f987bebb2ae8b593011b0ddd064440aded468ded1192977`).
- Controlled classification ran in dry-run, apply, and idempotency modes. It classified zero organization evidence rows and zero seed patterns because production contains no eligible rows. All 1,755 evidence records, 79 project insights, and 548 trend snapshots remain `legacy_unscoped/legacy-v0`; zero records were promoted to `platform_public` because no governed source allowlist exists.
- TR-04 release preflight found 2 null-owned projects, 4 null-owned scenarios, and 8 reports attached to null-owned projects. The user approved the unique organization-1 mapping; one transaction updated the 2 projects and 4 scenarios, and all three post-remediation counts are zero. `KF-015` is closed.
- Production deployment `dpl_7ndQvn6N7NpoJqx13fjBdgU5V8vM` is `READY`. Root and `system.health` return 200, unauthenticated `project.get` returns 401, invalid public shares return concealed 404 with `private, no-store` and `noindex, nofollow, noarchive`, and post-deployment ownership/table/index integrity checks pass.
- TR-05 production deployment `dpl_G7hPvJk7WUqwxYBdrjZN6noNxNFn` is `READY` and Vercel identifies exact commit `1f8c97d288ce97315664229049db3db38ec65bb2`. Root and `system.health` return 200, unauthenticated `project.get` returns 401, invalid shares return concealed 404 with privacy headers, and post-deployment corpus integrity checks pass.
- Canonical main was fast-forwarded through the complete TR-04 history after explicit user authorization. The TR-05 application SHA is pushed on `origin/codex/tr-05-data-isolation` and deployed, but has not been merged into canonical main.

## Environment Uncertainties

- Documentation historically names both PlanetScale and TiDB. Treat the actual `DATABASE_URL` target and deployment configuration as authoritative for a given environment without exposing credentials.
- The ordinary full Vitest command is not database-hermetic. Continue using the explicit safe `DATABASE_URL=''` profile until `KF-008` closes.
- GitHub Actions cannot start while the repository owner account is billing-locked (`KF-014`). TR-05 release evidence therefore uses the user-authorized Vercel hosted clean build on the pushed commit plus recorded disposable MySQL, production PlanetScale DDL/integrity, full-suite, audit, build, browser, and independent-review gates.

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
- `TR-05` and `KF-007` are closed on `codex/tr-05-data-isolation`. Corpus isolation, migration 0047, fail-closed organization/public reads, scheduler disablement, insufficiency contracts, UI states, and enhanced audit enforcement are implemented. Verified gates: disposable MySQL 18/18, safe suite 962 passed with 22 skipped, authorization inventory 331/331 with zero remediation rows, TypeScript/build/diff PASS, in-app browser PASS across analytics, cost forecasting, project prediction, design advisor, and learning administration, and independent Claude Code `APPROVED_NO_OBJECTION`. `TR-10` is the next executable step.

## Refresh Procedure

Update this file only after direct observation:

1. Record date, commit, branch, and relevant environment label.
2. Inspect the worktree without discarding unrelated changes.
3. Run the exact relevant commands.
4. Record exit status and concise evidence.
5. Update `.agent/state/KNOWN_FAILURES.md` for unresolved reproduced failures.
6. Do not copy changing counts into permanent agent instructions.
