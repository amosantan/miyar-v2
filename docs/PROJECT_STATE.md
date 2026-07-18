# MIYAR Verified Project State

This is the canonical location for current observed repository facts. It is not a roadmap or a completion claim. Re-run commands before relying on this state for a new release or high-risk change.

## Observation Metadata

- Observed: 2026-07-18
- Production source commit: `d0c84da5292193aa90b68a315a8c1eeaa8db4394` on canonical `main`, merging TR-11 PR #14.
- Branch identity: canonical `origin/main` contains runtime application release `d0c84da5292193aa90b68a315a8c1eeaa8db4394`; later commits may record state only and do not change the runtime release identity.
- Remote: `https://github.com/amosantan/miyar-v2`
- Package manager declared by repository: `pnpm`
- Production: Vercel target `ExfGpuVC4UQ83Jy46i6xQnSKdJDP` completed for exact source commit `d0c84da`; three root/health/evidence observations return 200, unauthenticated project access returns 401, and invalid shares return concealed 404 with privacy headers.
- Release identity policy: later documentation/state-only commits do not supersede the application release SHA
- Roadmap state: `TR-11` is released and closed at `PASS`; `TR-12` is the sole next executable step.

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
| `DATABASE_URL='' pnpm test`     | PASS   | 1,138 passed and 22 skipped; no database connection attempt occurred                                                                    |
| Guarded MySQL authorization run | PASS   | Disposable MySQL 8 verification passed migration, concurrency, rollback, tenant-collision, and authorization contracts                 |
| PlanetScale compatibility       | PASS   | Production applied additive migration 0050 after backup; `report_instances.storageKey` is nullable `TEXT`, all 29 rows remain, and no row was backfilled |
| `pnpm check`                    | PASS   | Zero TypeScript diagnostics                                                                                                             |
| `pnpm audit:authorization`      | PASS   | All 337 application procedures are inventoried with zero remediation rows and current hash-bound scoped-write evidence                  |
| `pnpm build`                    | PASS   | Client, Node server, and generated serverless bundle pass                                                                               |

Reproduced groups and exit criteria live in `.agent/state/KNOWN_FAILURES.md`.

## Documentation State

- `AGENTS.md` is the canonical cross-agent engineering contract.
- `CLAUDE.md` imports `AGENTS.md`.
- `GEMINI.md` points to the same contract.
- `LOOP_ENGINEERING.md` defines lifecycle, retry, evidence, and terminal states.
- Current/future priorities live in `docs/ROADMAP.md`.
- Historical reports are non-authoritative unless reverified.

## TR-10 Release Observation

These facts describe the reviewed TR-10 implementation merged through PR #12 and released from canonical commit `55917a145a87c218c34457e054850326fc1e1a1a`.

- The targeted report/share/storage/localization/migration suites pass 156/156; the release-candidate safe suite passes 1,114 tests with 22 skipped.
- TypeScript, report-output auditing, the authorization inventory (336/336 with zero remediation), and all build targets pass.
- Disposable MySQL 8 verifies additive migration 0050 forward application, legacy-null compatibility, stable-key updates, application rollback compatibility, and column rollback. Production migration 0050 is applied and independently verified.
- The explicitly authorized sixth post-fix certification iteration passed 23/23 artifacts through browser-print PDF and production DOCX/LibreOffice paths; all 83/83 pages were inspected with no remaining defect.
- A fail-closed, loopback-only synthetic MySQL/application environment verified login, authenticated English/Arabic selectors and previews across every report surface, and valid/invalid public shares. Browser QA found and drove fixes for successful authentication returning to the public homepage, project route wiring, optional display-label crashes, the legacy project-less comparison URL, and the duplicate/misdirected room-render action. Live recheck proves sign-in reaches `/dashboard`.
- The browser safety policy blocked generated download/print/new-page clicks and forbade alternate automation; the task owner explicitly waived those remaining UI clicks before release.
- Independent high-reasoning security/integration review and Claude Opus review returned `APPROVED`. On 2026-07-18 the product/report owner approved the exact bilingual issued legal/disclaimer/financial copy and authorized one sixth post-fix render plus a safe synthetic authenticated browser environment.

## TR-11 Release Observation

These facts describe the reviewed TR-11 implementation merged through PR #14 and released from canonical commit `d0c84da5292193aa90b68a315a8c1eeaa8db4394`.

- The release implements a bilingual governed claim registry and a read-only cached/rate-limited `system.marketEvidenceSnapshot` that exposes only official DLD source identity, indexed-subset counts, and observed-through record dates, failing closed when evidence is empty, unavailable, or malformed.
- Home, Methodology, public shares, customer surfaces, and generated brief/DOCX copy distinguish official DLD observations from MIYAR guidelines, assumptions, estimates, targets, and proxies. Legal pages remain unpublished, and no weekly/live claim is enabled.
- Focused verification passes 103/103; `DATABASE_URL='' pnpm test` passes 1,138 with 22 skipped; `pnpm check`, authorization inventory 337/337 with zero remediation, all build targets, and `git diff --check` pass.
- English/Arabic browser QA passed the evidence unavailable state and Methodology at 1280px with correct LTR/RTL behavior, no horizontal overflow, and no console errors. Independent security/design review and Claude Opus returned `APPROVED`.
- PR #14 merged reviewed commit `e26e07e` as `d0c84da`; Vercel target `ExfGpuVC4UQ83Jy46i6xQnSKdJDP` completed for that exact merge SHA, and canonical-main CI run `29645745114` passed both `lint-and-test` and isolated `mysql-authorization` jobs.
- Three production observations passed with root, health, and market-evidence HTTP 200; unauthenticated project reads returned 401 and invalid share resolution returned concealed 404 with `private, no-store` and `noindex, nofollow, noarchive`. The evidence snapshot currently fails closed as `{available:false}` and exposes no operational fields.
- Production English/Arabic Home and Methodology render at 1280px with correct LTR/RTL direction, no horizontal overflow, no fixed-weight or former live/verified claim, and no browser errors.
- No schema, migration, dependency, formula, scoring, financial-policy, benchmark-promotion, report-catalog, ingestion-cadence, database write, or backfill occurred. `EV-08` records the future weekly governed refresh and report-evidence binding gate.

## Production Database Observation

- Migration 0044 was verified complete before TR-03H release.
- Duplicate preflight found zero duplicate membership pairs and zero duplicate non-null share tokens.
- Backup `6168hbonz89d` completed successfully before migration 0045.
- Migration 0045 is complete: `organization_members_org_user_unique` and `ai_design_briefs_share_token_unique` are present as unique indexes.
- Migration 0046 is complete: `portfolio_alerts` has 16 expected columns, a primary key, and unique `(organization_id, active_dedup_key)`.
- Migration 0047 is complete on production: all 19 expected corpus/ownership columns and all five corpus indexes were verified. A restricted encrypted affected-table recovery snapshot was verified before DDL (SHA-256 `197bfc7ac04f31c44f987bebb2ae8b593011b0ddd064440aded468ded1192977`).
- Migration 0048 is complete on production: `projects.inputProvenance` is nullable JSON with no default, project count remained 11, and all 11 legacy rows remain null for explicit legacy-compatible readiness. The encrypted affected-table recovery snapshot was decrypted and verified before DDL (SHA-256 `913e526c6dc68e5f793a65ce2e6b40793930224d2719f98ede3251f97f2324ef`).
- Migration 0049 is complete on production: restorable backup `jqb2igl1ebgl` succeeded before sequential application of eight reviewed additive statements. `evidence_confidence_assessments` has 31 columns and its primary/composite indexes; `evidence_records` has nullable current-assessment/policy/public-observation fields and a unique public-observation index; `ingestion_runs.recordsRejected` is non-null default zero. Evidence and ingestion-run counts remained 1,755 and 368, zero assessments were backfilled, and all legacy provenance fields remain null.
- Migration 0050 is complete on production: restorable backup `q0zq6eqznlcq` succeeded before the reviewed additive statement. `report_instances.storageKey` is nullable `TEXT` with default `NULL`; report count remained 29 and all 29 legacy rows remain null with no backfill.
- Controlled classification ran in dry-run, apply, and idempotency modes. It classified zero organization evidence rows and zero seed patterns because production contains no eligible rows. All 1,755 evidence records, 79 project insights, and 548 trend snapshots remain `legacy_unscoped/legacy-v0`; zero records were promoted to `platform_public` because no governed source allowlist exists.
- TR-04 release preflight found 2 null-owned projects, 4 null-owned scenarios, and 8 reports attached to null-owned projects. The user approved the unique organization-1 mapping; one transaction updated the 2 projects and 4 scenarios, and all three post-remediation counts are zero. `KF-015` is closed.
- Production deployment `dpl_7ndQvn6N7NpoJqx13fjBdgU5V8vM` is `READY`. Root and `system.health` return 200, unauthenticated `project.get` returns 401, invalid public shares return concealed 404 with `private, no-store` and `noindex, nofollow, noarchive`, and post-deployment ownership/table/index integrity checks pass.
- TR-05 production deployment `dpl_G7hPvJk7WUqwxYBdrjZN6noNxNFn` is `READY` and Vercel identifies exact commit `1f8c97d288ce97315664229049db3db38ec65bb2`. Root and `system.health` return 200, unauthenticated `project.get` returns 401, invalid shares return concealed 404 with privacy headers, and post-deployment corpus integrity checks pass.
- TR-07 test-only release commit `85f98db305e5fe983a9ab578f6d129592fa6cfc7` deployed successfully as Vercel target `FTnLtBnDYeRkqu5rYeKiKrAowRuU`. Post-deployment root/health, unauthenticated tenant rejection, invalid-share privacy, rendered homepage, and a three-observation health window pass. No database or schema operation was part of the release.
- TR-08 test/documentation release commit `e49029d566fa032862c91fa7c0ce00c14aa8ef45` deployed successfully as Vercel target `dpl_5wEjCcgpCVH2boFmgwA7nMxRMe5M` after exact-commit preview `dpl_7vTDyhEv63paho4xkw426BjVdATH` passed. Root/health, unauthenticated tenant rejection, invalid-share privacy, and a three-observation health window pass. No runtime source, schema, migration, dependency, configuration, database, numerical, authorization, API, or report-rendering change was part of the release.
- TR-09 release commit `bd09c3fdafca885d40b564eafe94ecc67197c7ad` deployed successfully as Vercel target `GQyoYH8hnMXwPRMYmzdsCgTg6wNV`. Root/health, unauthenticated tenant rejection, invalid-share privacy, a three-observation health window, unchanged counts, and zero orphan assessment/current-pointer/duplicate-public-key integrity failures pass.
- TR-10 release commit `55917a145a87c218c34457e054850326fc1e1a1a` deployed successfully as Vercel target `8A9iDiHwfT3wnXsYXFwqQWLtpPB2`. Canonical-main CI run `29641839449`, three root/login/health observations, unauthenticated tenant rejection, English/Arabic invalid-share privacy, and post-deployment migration 0050 integrity pass.
- TR-11 release commit `d0c84da5292193aa90b68a315a8c1eeaa8db4394` deployed successfully as Vercel target `ExfGpuVC4UQ83Jy46i6xQnSKdJDP`. Canonical-main CI run `29645745114`, three production observations, tenant/share negative checks, endpoint minimization, and bilingual rendered-claim checks pass; no database operation was required or performed.
- Canonical `main` contains the reviewed TR-11 production release.

## Environment Uncertainties

- Documentation historically names both PlanetScale and TiDB. Treat the actual `DATABASE_URL` target and deployment configuration as authoritative for a given environment without exposing credentials.
- The ordinary full Vitest command is not database-hermetic. Continue using the explicit safe `DATABASE_URL=''` profile until `KF-008` closes.
- GitHub Actions billing was restored on 2026-07-18. Rerun `29633531305` executed real job steps, revealing and confirming a separate duplicate pnpm-version setup error. After CI workflow commit `18da870`, hosted run `29634762518` passed both the unit/type/build and MySQL authorization jobs on canonical `main`; `KF-014` is closed.

## CI Configuration in the Current Worktree

- CI configuration uses pnpm and the committed lockfile, with fail-closed TypeScript, test, build, and isolated MySQL jobs.
- GitHub now executes both required jobs normally. The workflow resolves pnpm from the repository `packageManager` field, avoiding a competing workflow-level version.
- The observed local TypeScript, safe full-suite, authorization, build, isolated MySQL, and PlanetScale compatibility gates are green.

## Authorization Foundation

- `TR-01` inventory extraction now covers all 329 application procedures.
- `TR-02` provides typed organization-resource and public-share authorization primitives with 49 passing targeted tests.
- `TR-03` closes all 39 design-router remediation paths with organization-locked resource operations and fail-closed public shares.
- `TR-03H` closes live membership, design roles, scoped final writes, composite atomicity, rejected-upload compensation, public-share privacy, real-SQL evidence, and canonical release identity.
- `TR-04` closes all 93 remaining project-router authorization/global-governance paths, including the later ultra-review remediation for atomic report persistence and tenant-owned portfolio alerts. The live inventory has zero `TR-04` and exactly eight pooled-data rows under `TR-05`; targeted, disposable MySQL, safe full-suite, TypeScript, audit, build, diff, and independent-review gates pass.
- `TR-05` and `KF-007` are closed on `codex/tr-05-data-isolation`. Corpus isolation, migration 0047, fail-closed organization/public reads, scheduler disablement, insufficiency contracts, UI states, and enhanced audit enforcement are implemented. Verified gates: disposable MySQL 18/18, safe suite 962 passed with 22 skipped, authorization inventory 331/331 with zero remediation rows, TypeScript/build/diff PASS, in-app browser PASS across analytics, cost forecasting, project prediction, design advisor, and learning administration, and independent Claude Code `APPROVED_NO_OBJECTION`.
- `UX-01` is merged into canonical main through commit `029f5c1`. Its implementation and prior authenticated verification remain recorded, but an authenticated browser session was unavailable during the independent TR-07 release smoke; the roadmap retains that explicit UX-01 human gate.
- `TR-08` is reclosed with accepted ADR-0003 and policy bundle `TR-08-v1`. `TR-09` implemented and released the resulting truthful space, confidence-provenance, tenant-safe public-upsert, and board-annex contracts; `KF-016` and `KF-017` are closed. TR-10 and TR-11 are released; `TR-12` is the sole next executable step.

## Refresh Procedure

Update this file only after direct observation:

1. Record date, commit, branch, and relevant environment label.
2. Inspect the worktree without discarding unrelated changes.
3. Run the exact relevant commands.
4. Record exit status and concise evidence.
5. Update `.agent/state/KNOWN_FAILURES.md` for unresolved reproduced failures.
6. Do not copy changing counts into permanent agent instructions.
