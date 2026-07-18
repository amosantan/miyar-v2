# MIYAR Verified Project State

This is the canonical location for current observed repository facts. It is not a roadmap or a completion claim. Re-run commands before relying on this state for a new release or high-risk change.

## Observation Metadata

- Observed: 2026-07-17
- Production source commit: `e49029d566fa032862c91fa7c0ce00c14aa8ef45` on `codex/tr-08-contract-recertification`; its diff from the runtime application release contains characterization tests and durable records only.
- Branch identity: canonical `origin/main` is state commit `1736129bc3733356b5d105669d8adb53a46d80af`; runtime application release identity remains `85f98db305e5fe983a9ab578f6d129592fa6cfc7`.
- Remote: `https://github.com/amosantan/miyar-v2`
- Package manager declared by repository: `pnpm`
- Production: Vercel deployment `dpl_5wEjCcgpCVH2boFmgwA7nMxRMe5M` is `READY` for exact source commit `e49029d`; root and health return 200, unauthenticated project access returns 401, invalid shares return concealed 404 with privacy headers, and three follow-up health observations return 200.
- Release identity policy: later documentation/state-only commits do not supersede the application release SHA
- Active worktree observation: The pushed TR-09 release candidate is on `codex/tr-09-baseline-provenance` with draft PR #7; migration 0049 and deployment remain human-gated.

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

| Command                         | Result | Evidence summary                                                                                                                        |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL='' pnpm test`     | PASS   | 1,023 passed and 22 skipped; no database connection attempt occurred                                                                    |
| Guarded MySQL authorization run | PASS   | Disposable MySQL 8 suite passed 19/19, adding UX-01 stored-provenance, organization confirmation, concealment, and role-denial evidence |
| PlanetScale compatibility       | PASS   | Production Vitess accepted all 23 migration-0047 statements; 19 columns, five indexes, defaults, counts, and post-deploy reads verified |
| `pnpm check`                    | PASS   | Zero TypeScript diagnostics                                                                                                             |
| `pnpm audit:authorization`      | PASS   | All 335 application procedures are inventoried with zero remediation rows and current hash-bound scoped-write evidence                  |
| `pnpm build`                    | PASS   | Client, Node server, and generated serverless bundle pass                                                                               |

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
- Migration 0048 is complete on production: `projects.inputProvenance` is nullable JSON with no default, project count remained 11, and all 11 legacy rows remain null for explicit legacy-compatible readiness. The encrypted affected-table recovery snapshot was decrypted and verified before DDL (SHA-256 `913e526c6dc68e5f793a65ce2e6b40793930224d2719f98ede3251f97f2324ef`).
- Controlled classification ran in dry-run, apply, and idempotency modes. It classified zero organization evidence rows and zero seed patterns because production contains no eligible rows. All 1,755 evidence records, 79 project insights, and 548 trend snapshots remain `legacy_unscoped/legacy-v0`; zero records were promoted to `platform_public` because no governed source allowlist exists.
- TR-04 release preflight found 2 null-owned projects, 4 null-owned scenarios, and 8 reports attached to null-owned projects. The user approved the unique organization-1 mapping; one transaction updated the 2 projects and 4 scenarios, and all three post-remediation counts are zero. `KF-015` is closed.
- Production deployment `dpl_7ndQvn6N7NpoJqx13fjBdgU5V8vM` is `READY`. Root and `system.health` return 200, unauthenticated `project.get` returns 401, invalid public shares return concealed 404 with `private, no-store` and `noindex, nofollow, noarchive`, and post-deployment ownership/table/index integrity checks pass.
- TR-05 production deployment `dpl_G7hPvJk7WUqwxYBdrjZN6noNxNFn` is `READY` and Vercel identifies exact commit `1f8c97d288ce97315664229049db3db38ec65bb2`. Root and `system.health` return 200, unauthenticated `project.get` returns 401, invalid shares return concealed 404 with privacy headers, and post-deployment corpus integrity checks pass.
- TR-07 test-only release commit `85f98db305e5fe983a9ab578f6d129592fa6cfc7` deployed successfully as Vercel target `FTnLtBnDYeRkqu5rYeKiKrAowRuU`. Post-deployment root/health, unauthenticated tenant rejection, invalid-share privacy, rendered homepage, and a three-observation health window pass. No database or schema operation was part of the release.
- TR-08 test/documentation release commit `e49029d566fa032862c91fa7c0ce00c14aa8ef45` deployed successfully as Vercel target `dpl_5wEjCcgpCVH2boFmgwA7nMxRMe5M` after exact-commit preview `dpl_7vTDyhEv63paho4xkw426BjVdATH` passed. Root/health, unauthenticated tenant rejection, invalid-share privacy, and a three-observation health window pass. No runtime source, schema, migration, dependency, configuration, database, numerical, authorization, API, or report-rendering change was part of the release.
- Canonical `main` contains the reviewed TR-05, UX-01, TR-06H, and TR-07 histories through application release commit `85f98db`.

## Environment Uncertainties

- Documentation historically names both PlanetScale and TiDB. Treat the actual `DATABASE_URL` target and deployment configuration as authoritative for a given environment without exposing credentials.
- The ordinary full Vitest command is not database-hermetic. Continue using the explicit safe `DATABASE_URL=''` profile until `KF-008` closes.
- GitHub Actions cannot start while the repository owner account is billing-locked (`KF-014`). TR-07 run `29604504677` and the latest TR-09 draft-PR run both created failing jobs with zero steps and no failed-job log. The user-authorized TR-07 release used clean frozen local gates plus successful Vercel preview/production builds and production smoke; the underlying CI failure remains open.

## CI Configuration in the Current Worktree

- CI configuration uses pnpm and the committed lockfile, with fail-closed TypeScript, test, build, and isolated MySQL jobs.
- GitHub did not execute those jobs because of `KF-014`; the TR-07 release disposition and replacement evidence are recorded in `.agent/state/KNOWN_FAILURES.md` and `.agent/state/CURRENT_TASK.md`.
- The observed local TypeScript, safe full-suite, authorization, build, isolated MySQL, and PlanetScale compatibility gates are green.

## Authorization Foundation

- `TR-01` inventory extraction now covers all 329 application procedures.
- `TR-02` provides typed organization-resource and public-share authorization primitives with 49 passing targeted tests.
- `TR-03` closes all 39 design-router remediation paths with organization-locked resource operations and fail-closed public shares.
- `TR-03H` closes live membership, design roles, scoped final writes, composite atomicity, rejected-upload compensation, public-share privacy, real-SQL evidence, and canonical release identity.
- `TR-04` closes all 93 remaining project-router authorization/global-governance paths, including the later ultra-review remediation for atomic report persistence and tenant-owned portfolio alerts. The live inventory has zero `TR-04` and exactly eight pooled-data rows under `TR-05`; targeted, disposable MySQL, safe full-suite, TypeScript, audit, build, diff, and independent-review gates pass.
- `TR-05` and `KF-007` are closed on `codex/tr-05-data-isolation`. Corpus isolation, migration 0047, fail-closed organization/public reads, scheduler disablement, insufficiency contracts, UI states, and enhanced audit enforcement are implemented. Verified gates: disposable MySQL 18/18, safe suite 962 passed with 22 skipped, authorization inventory 331/331 with zero remediation rows, TypeScript/build/diff PASS, in-app browser PASS across analytics, cost forecasting, project prediction, design advisor, and learning administration, and independent Claude Code `APPROVED_NO_OBJECTION`.
- `UX-01` is merged into canonical main through commit `029f5c1`. Its implementation and prior authenticated verification remain recorded, but an authenticated browser session was unavailable during the independent TR-07 release smoke; the roadmap retains that explicit UX-01 human gate.
- `TR-08` is reclosed with accepted ADR-0003 and policy bundle `TR-08-v1`. Characterization passes 80/80, the safe suite passes 1,023 with 22 skipped, check/audit/build/documentation/diff gates pass, and independent code plus Claude Sonnet reviews approved. `KF-016` records the unresolved consumer/provenance/report-state gaps; reopened `TR-09` is the sole next executable step and `TR-10` remains planned.

## Refresh Procedure

Update this file only after direct observation:

1. Record date, commit, branch, and relevant environment label.
2. Inspect the worktree without discarding unrelated changes.
3. Run the exact relevant commands.
4. Record exit status and concise evidence.
5. Update `.agent/state/KNOWN_FAILURES.md` for unresolved reproduced failures.
6. Do not copy changing counts into permanent agent instructions.
