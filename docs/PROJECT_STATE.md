# MIYAR Verified Project State

This is the canonical location for current observed repository facts. It is not a roadmap or a completion claim. Re-run commands before relying on this state for a new release or high-risk change.

## Observation Metadata

- Observed: 2026-07-21; production source commit and branch identity re-observed 2026-07-23 after the KF-019 release.
- Production source commit: `81082684333d6844bdcd3e447abc79197089547e` on canonical `main`, merging KF-019 PR #40 (`4a7bea7`). This release changed tests, the certification harness, and documentation only, so runtime application behavior matches the prior release lineage. Observed via GitHub production deployment `5568677902` in `success` state for the exact merge SHA.
- Branch identity: canonical `origin/main` is `81082684333d6844bdcd3e447abc79197089547e`, including the KF-019 TR-13 recertification.
- Remote: `https://github.com/amosantan/miyar-v2`
- Package manager declared by repository: `pnpm`
- Production: Vercel target `dpl_BTcfrGZ6px4iHvJfiETrK8zP8s5F` is `READY` for exact source commit `b68c341`; BR-04 is compiled into the production workspace and narrowly enabled for organization 1 and consumer `project_workspace`. Root/login, three health observations, unauthenticated brief rejection, and concealed-share privacy headers pass.
- Release identity policy: later documentation/state-only commits do not supersede the application release SHA
- Roadmap state: `BR-01` through `BR-04` are closed at `PASS`; BR-04 is merged and deployed. `BR-05` is the single next executable step. `BR-04B`–`BR-04E` remain dependency-gated successors. `DI-01` remains merged and closed through canonical commit `ce5e44a`; its shared migration and production release remain separately gated. `SC-05` and UX-01's independent authenticated-production recheck remain `NEEDS_HUMAN`; `KF-018` remains a separate pre-existing legacy-report compatibility defect.

## BR-04 Release Observation

- Implementation commit `d8a3b7a` passed PR #27 review and checks and merged as `b68c341`. Vercel deployment `dpl_BTcfrGZ6px4iHvJfiETrK8zP8s5F` is `READY` for that exact merge source.
- `BR-04-v1` provides strict typed content for all ten brief sections. Cost quantities retain original AED/m²/ft² inputs, normalize with exact decimal/BigInt arithmetic and `1 m² = 10.7639 ft²`, require a named area basis for unit rates, and leave ambiguous legacy values unusable for affordability claims.
- The guided studio uses one tenant-scoped aggregate, authorized evidence/member pickers, server-issued references, separate immutable actor actions, conflict recovery, assumptions/inbox/specialist context, and a visibly non-issued side-effect-free preview.
- Final evidence: focused 36/36; guarded MySQL 31/31; safe full suite 1,424/22; TypeScript; authorization 376/0; database audit 117/2/0; production build/bundle budgets; authenticated author/reviewer/approver/issuer, keyboard, themes, EN/AR RTL, responsive layouts, and unchanged preview artifact counts; Claude Opus final `APPROVED`.
- BR-03 migration 0052 was already safely deployed through PlanetScale request #6 after backup `kqthto1vk2jl`; production contains all 19 expected brief tables and no workflow rows. The release workflow verified this state and did not duplicate the migration.

## BR-03 Release Observation

- PR #26 integrated BR-03 into canonical `main` at `4712e22`. Its additive migration 0052 was deployed through PlanetScale request #6 (`vtmwg38gazrv`, deployment `rbiqc0atmv02`) after successful backup `kqthto1vk2jl`.
- The ten-section deterministic readiness engine, tenant-scoped immutable workflow, additive migration, and non-issued project preview pass targeted 36/36 and guarded disposable-MySQL 30/30 verification.
- An authenticated disposable-browser journey exercised author revision, governed evidence, independent review, independent approval, issuer preflight, 360/768/1440 layouts, light/dark themes, EN/AR RTL, and preview side-effect checks. It exposed and verified a fix for inconsistent bound-revision serialization between the section and version APIs.
- TypeScript, production build and client bundle budgets, authorization inventory 375/0, database-entrypoint audit 116/2/0, and final diff checks pass. A clean safe aggregate suite passed 1,398 tests with 22 skipped after the browser server stopped; the preceding loaded run's four five-second timeouts passed 59/59 in isolation.
- Final independent Claude Opus review returned `APPROVED`. Git publication, integration, shared migration, and bounded BR-04 production enablement are complete; legacy import and report/share cutover remain separately gated.

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
- Design API composition: `server/routers/design.ts` flat-merges eight bounded routers while preserving the 63 existing `design.*` procedures.
- Domain engines: `server/engines/`
- Database helpers: `server/db.ts`
- Shared contracts: `shared/`
- Serverless source entry: `server/serverless/index.ts`
- Historical documentation: `docs/archive/` and `.agent/archive/`
- Project artifacts: `docs/artifacts/`

## Health Observation

At the observation above:

| Command                      | Result | Evidence summary                                                                                                                                         |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hostile-parent `pnpm test`   | PASS   | 1,264 passed and 22 skipped; no database connection attempt occurred                                                                                     |
| `pnpm certify:workflow`      | PASS   | Disposable MySQL ordered workflow, Node/serverless parity, report rendering, serial Node browser journey, secret scans, and strict cleanup               |
| PlanetScale compatibility    | PASS   | Production applied additive migration 0050 after backup; `report_instances.storageKey` is nullable `TEXT`, all 29 rows remain, and no row was backfilled |
| `pnpm check`                 | PASS   | Zero TypeScript diagnostics                                                                                                                              |
| `pnpm audit:authorization`   | PASS   | All 338 application procedures are inventoried with zero remediation rows and current hash-bound scoped-write evidence                                   |
| `pnpm audit:database-safety` | PASS   | 112 entrypoints, two exact generated-bundle exceptions, and zero findings                                                                                |
| `pnpm build`                 | PASS   | Client, Node server, and generated serverless bundle pass                                                                                                |
| Design contract checker      | PASS   | All 63 names, operations, access primitives, classifications, initializers, middleware chains, and unique owner identities match the pre-split baseline  |

Reproduced groups and exit criteria live in `.agent/state/KNOWN_FAILURES.md`.

## KF-019 Certification Remediation Observation

- Observed: 2026-07-23 in worktree `claude/suspicious-jepsen-1cb0fd` on canonical base `8cd7e0a`.
- On untouched `8cd7e0a`, `pnpm certify:workflow` failed at `serial-node-browser-journey`: the TR-13 browser journey still exercised the pre-DI-01 legacy space-programme/MQI flow, which fresh canonical-authority projects refuse by design, so the earlier `PASS` row above does not hold for post-DI-01 canonical commits.
- After the KF-019 remediation (sanitized persisted journey log, surfaced tRPC error envelopes, and a journey re-pointed at the approved canonical-first contract), two consecutive `pnpm certify:workflow` runs terminate `PASS` with strict cleanup and matching provenance; `pnpm check` and `pnpm check:mysql-evidence` pass in the same worktree. Details: `KF-019` and `LES-047`.
- Released 2026-07-23: PR #40 passed `lint-and-test`, `mysql-authorization`, and the Vercel preview build, and merged `4a7bea7` as `8108268`. GitHub production deployment `5568677902` reached `success` for the exact merge SHA. Production smoke passed: home and login return 200, unauthenticated `auth.me` returns the null-user envelope, and an invalid share resolves 404 with `private, no-store` and `noindex, nofollow, noarchive` headers.

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

## TR-13 Local Certification Observation

These facts describe the uncommitted local TR-13 implementation in `/Users/amrosaleh/Maiyar/miyar-v2-tr13`, stacked on exact closed-TR-12 commit `1169fed5e9036bd754cfcb79a7619933515d7f00`.

- Organization admins can create expiring AI-advisor brief links and idempotently revoke every link for their project. Authenticated brief reads expose only non-secret share status; public resolution is concealed, read-only, privacy-header protected, and rate-limited without letting rejected probes consume unrelated users' global quota.
- The certification distinguishes `design.generateBrief`, `designAdvisor.generateDesignBrief`, and `project.generateReport`. The public link exposes the AI-advisor brief only; no issued/approved/unified artifact state was introduced.
- One versioned synthetic journey reconciles score `75`, `20.00 m²` project/room fit-out area, 100% allocation groups, deterministic surfaces, preserved locked/manual records, and material-library project totals of AED `2,494.70` / `3,143.38` / `3,792.05` across MySQL, routers, Node/serverless applications, the application UI, stored report, and nine-page rendered artifact.
- Final repository gates pass: hostile-parent full suite 1,253/22, focused contracts 78/78, TypeScript, authorization 338/0, database-safety 112/2/0, build and byte-stable tracked serverless bundle, report rendering 23/23, nine-page visual inspection, and diff/security/scope checks. The initial independent findings were repaired; high-reasoning authorization/token re-review and Claude Opus source review returned `APPROVED`.
- The harness rejects unsafe database/server/worker/session inputs, uses no ambient server, keeps one serial worker, emits only non-secret ignored local evidence, treats cleanup failure as failure, and proves the disposable database is absent afterward.
- No schema, migration, dependency, scoring/financial/compliance policy, shared database/configuration, commit, push, merge, preview, or deployment occurred.

## SC-01 Local Architecture Observation

These facts describe the uncommitted local SC-01 implementation in `/Users/amrosaleh/Maiyar/miyar-v2-sc01`, stacked on the reviewed TR-13 candidate and exact Git commit `1169fed5e9036bd754cfcb79a7619933515d7f00`.

- The former 2,156-line design router exposed 63 procedures. Eight bounded asset, brief, board, collaboration, market-context, material, sharing, and visual routers now own every procedure exactly once; `server/routers/design.ts` is a 21-line flat compatibility facade.
- No procedure initializer changed semantically. A checked-in pre-split baseline and ordinary Vitest contract verify every name, query/mutation kind, access primitive, authorization classification, complete initializer, runtime middleware chain, and owner reference. `design.resolveShareLink` remains the only public design procedure and retains the bounded public rate limiter and active-share resolver.
- Verification passes: focused security/contracts 98, ordinary DB-free suite 1,257/22, guarded MySQL 21/21, complete TR-13 workflow certification, TypeScript, authorization inventory 338/0, database safety 112/2/0, three production build targets, byte-stable tracked serverless output, and diff/import/scope checks. All disposable MySQL containers and their databases were removed.
- Independent high-reasoning security and architecture reviews returned `APPROVED_NO_OBJECTION`; final Claude Opus review is recorded in the task/worklog evidence.
- No schema, migration, dependency, client behavior, engine, formula, numerical assumption, API path, response shape, database write, Git publication, preview, or deployment was introduced by SC-01.

## SC-04 Release Observation

These facts describe SC-04 merged through PR #20 as exact canonical-main application release `1bad9d666d71a0b010a27433ca196c842b4e546f` and deployed as Vercel `dpl_EfNS4qwEXLRXHPNKPi6isHG41BuE`.

- Production Vite output now has a source-owned manifest contract. Versioned budgets cover entry JavaScript/CSS, all JavaScript chunks, public Home/Login/Share, authenticated Dashboard/Project/Reports, pre-briefing Portfolio, assistant-with-Markdown, forbidden static dependencies, and four required dynamic boundaries.
- Entry JavaScript is 138,121 gzip bytes. The authenticated dashboard static closure fell from 450,808 to 220,257 gzip bytes. All eight closures pass bounded thresholds; the remaining approximately 883 KB raw / 267 KB gzip Markdown renderer is optional and governed by one exception expiring 2026-10-31.
- `pnpm build` enforces the budgets before Node/serverless packaging in both local `dist/public/` and Vercel `dist/` profiles. CI therefore fails on missing artifacts, entry/route/chunk regressions, lost lazy boundaries, or expired/unreasoned exceptions.
- The guarded workflow passes desktop public and critical admin views plus mobile-width public share, authenticated dashboard/assistant/project/reports, and inline report preview. It proves assistant/Markdown and report-renderer loading occur only after interaction, records zero unexpected browser failures, scans secrets, and removes the disposable MySQL database.
- Final gates pass: six checker tests, ordinary suite 1,264/22, TypeScript, authorization 338/0, database safety 112/2/0, build and tracked-serverless freshness, local/Vercel budgets, workflow certification, diff checks, and independent GPT-5.6 Sol high-reasoning review. The hostile hosted `NODE_ENV=test` build initially proved the production mode was ambient; commit `8fe98ea` made the Vite subprocess explicit without relaxing budgets, and PR/main hosted CI passed.
- Production smoke passed root/health/login availability, authenticated dashboard/session and existing stored-report preview, temporary admin share creation, public page/API 200 with `private, no-store`, project-wide revocation, and byte-identical revoked/never-issued concealed 404 responses with identical privacy headers. The temporary URL was removed from browser memory, clipboard, and local temporary files.
- The stored legacy report opened successfully but reproduced malformed 5-Lens labels from its February 2026 payload. `KF-018` records this pre-existing compatibility defect; it is not caused by SC-04's lazy import boundary and is not repaired by rollback.
- No schema, migration, dependency, API, authorization, numerical formula, scoring/financial/compliance assumption, production configuration, or shared database migration occurred. The only production data mutation was one temporary project-9 share link immediately revoked during the authorized smoke.

## BR-06 Local Regulatory and Typology-Pack Observation

These facts describe the uncommitted BR-06 implementation in `/Users/amrosaleh/Maiyar/miyar-v2-br06-dubai-packs`, based on exact canonical `origin/main` commit `beaa90b87682e7d214cffe38739629b22308290c` with BR-05 commit `2052b17` in its ancestry.

- A direct, fail-closed regulatory fetch path is separate from market/material evidence ingestion. It resolves immutable registered official sources, enforces robots/terms/retention, HTTPS host and redirect restrictions, SSRF defenses, MIME/size/rate/deadline limits, and immutable capture fingerprints without third-party scraping proxies.
- Acquisition is gated per official host: competing requests for one host are serialized on an independent chain and each reserves its next rate slot before awaiting, so concurrent callers cannot observe the same last-request value and burst together. A reserved slot beyond the operation deadline fails closed with `TIMEOUT` instead of sleeping into expiry, the gate is released on success, failure, timeout, and cancellation alike, and body streaming stays outside the gate. Different approved hosts do not block each other. Measured with five concurrent acquisitions at a 1,000 ms interval: request offsets `5007/6009/7009/8010/9011 ms`, spread 4,004 ms across four full intervals; the pre-remediation build produced offsets `1005/2005/2005/2006/2006 ms` with a 1,001 ms spread.
- Migration 0055 adds six regulatory provenance tables for source identity, versions, immutable captures, clause candidates, clause-scoped temporal relations, and platform source assertions. It was applied and verified only against a disposable local MySQL target.
- The candidate catalogue covers 29 Dubai Municipality, Civil Defence, Dubai Legislation Portal/DET, accessibility, sustainability, food-safety, legislative-currency, and unsupported special-authority records. DDA, Trakhees/PCFC, DIFC, and Dubai South fail closed without approved overlays.
- Typology-pack v2 defines eight families and nine immutable candidates, including distinct hotel and serviced-apartment variants. Every promotable datum must resolve an exact permitted source fingerprint and locator plus current temporal/source assertions; mixed use pins exact non-nested components; v1 remains compatible.
- Production source-authority and pack-release registries are intentionally empty. Candidates, raw artifacts/clause text, licensing/storage details, and private review metadata are not exposed through tenant or public projections. Tenant administrators cannot perform platform releases.
- Verification passes: focused 48/48, database-free 1,472 with 22 skipped, disposable MySQL 41/41 with cleanup, TypeScript, authorization 389/0, database safety 121/2/0, build/budgets, tracked serverless freshness, diff review, and final independent Sol and Claude Opus `PASS` reviews.
- Post-merge remediation (observed 2026-07-22 from `origin/main` commit `dd45741679129c8d280b20eafd88e61738d28664`) closes two defects found by independent verification: the per-host acquisition gate above, and stale MySQL authorization evidence. Commit `d91c356` had edited `scripts/run-guarded-mysql-tests.ts` without regenerating `.agent/state/TR03H_MYSQL_EVIDENCE.json`, so its recorded hash no longer matched and `pnpm audit:authorization` exited 1 with 25 findings. Hash comparison confirms BR-06 at `b570486` was internally consistent and the CI-timeout merge introduced the drift. Evidence was regenerated only through `pnpm test:authorization:mysql` against a disposable loopback-only MySQL 8.0 target; the audit now reports 389 procedures with zero remediation rows.
- Remediation verification passes: focused 52/52 (four new acquisition-gate tests), database-free 1,476 with 22 skipped, disposable MySQL 41/41 with confirmed cleanup, TypeScript, authorization 389/0, database safety 121/2/0, build and client bundle budgets, and `git diff --check`.
- `pnpm check:mysql-evidence` guards the evidence contract directly: it compares all 73 pinned files against `.agent/state/TR03H_MYSQL_EVIDENCE.json`, needs no database, and names drifted files instead of leaving `pnpm audit:authorization` to report one stale hash plus a tail of unrelated drift rows. Verified to report current state, to exit 1 naming the exact file when a pinned file is perturbed, and to return to 0 once restored. Vitest now also collects `scripts/**/*.test.ts`.
- Human-gate scaffolding is prepared but unfilled: `docs/artifacts/BR-06_SOURCE_POLICY_DECISION_RECORD.md` is a blank per-source decision form covering all 29 registrations plus the capture, five-assertion, clause-locator, and four-discipline release-envelope templates, and `docs/runbooks/regulatory-source-acquisition.md` sequences the six stage gates from source-policy decision to production registry. Neither creates, implies, or substitutes for any approval; every decision cell is empty.
- BR-06 remains `NEEDS_HUMAN` for source-use decisions, exact current artifacts and clauses, and separate named architecture/interiors, cost, compliance, and product approval. No shared migration, commit, push, merge, deployment, or production enablement occurred.
- The source review packet at `docs/artifacts/BR-06_SOURCE_REVIEW_PACKET.md` records current official page/document evidence and keeps all licensing, retention, artifact-fingerprint, clause, and four-discipline approval fields explicitly pending.

## EV-00 Local Cost-Path Remediation Observation

These facts describe the uncommitted-to-main EV-00 implementation on branch `claude/cost-path-audit-material-library-2bb482` (commits `8a91472`→`6f1e119` from exact canonical `origin/main` base `8cd7e0a`), observed 2026-07-23.

- ADR-0009 (material cost authority + labelled-assumption provenance) and ADR-0010 (strict RFC 9309 robots posture before every market-ingestion provider) are accepted. `server/engines/tier-policy.ts` owns the tier/finish ladders verbatim as `material-tier-policy-v1`; `server/engines/ingestion/robots-policy.ts` owns the fail-closed robots gate as `ingestion-robots-v1`.
- Additive migrations 0056–0058 exist and were verified only against disposable loopback MySQL targets: material_library provenance columns with backfill-free assumption defaults plus unique `product_code`; `evidence_records.modelSuggestedFinishLevel` and `benchmark_proposals.keyPolicyVersion` (default `legacy-v0`); unique `source_registry.slug`.
- Truthfulness fixes: RFQ `pricingSource` derives only from the material row's `sourceType` (label-string stamping removed); the MQI no longer invents category-fallback prices and reports `unpricedAllocationCount` plus a cost-basis block; reconciliation output, issued PDF (EN/AR), DOCX budget table, and the client MQI card all carry the "MIYAR assumption" basis label; `PricingAnalytics.pricingSource` states its only real value and `detailedBudget.costBasis` discloses the live-vs-static path; evidence `finishLevel` is deterministic from price+unit with the model's suggestion demoted to metadata; static-connector evidence carries per-item categories instead of pooling into floors; the orchestrator resolves `source_registry` rows by id/slug so `sourceRegistryId`, `lastSuccessfulFetch`, and `consecutiveFailures` are truthfully recorded (proven on real MySQL); `insertRfqLineItemsForOrg` is a replace contract closing `KF-013`.
- Registry hygiene: dera-interiors and gems-building-materials connectors removed with their dead domains (seed rows deactivated with dated notes); hafele-uae points at the UAE storefront; all seed entries carry slugs with nine new rows for previously seedless static connectors; the Graniti UAE connector is registered at grade B and its live robots.txt returns `ROBOTS_ALLOWED` under the strict gate.
- Verification at `6f1e119`: `DATABASE_URL='' pnpm test` 1,567/22; `pnpm test:authorization:mysql` 9 files/46 tests with regenerated TR03H evidence and confirmed cleanup; authorization inventory 389/0; database safety 123/2/0; TypeScript and build (regenerated tracked serverless bundle) pass. After merging main's KF-019 recertification (merge `bb200bb`), `pnpm certify:workflow` terminates `PASS` on this branch with strict cleanup; the original browser-journey failure was recorded as `KF-019` (reproduced at untouched base `8cd7e0a`) and closed upstream by PR #40.
- Human gates: PR #39 merge; shared/production application of migrations 0056–0058 and the production seeder runs; cost-consultant sign-off for the proposed richer `libraryTiersForMkt01Tier` mapping (the shipped v1 preserves legacy behavior).

## EV-00 Release Observation

These facts describe the EV-00 cost-path truthfulness release, observed 2026-07-23.

- Application release: PR #39 merged as canonical `main` commit `91829c48b041660c2d5853a8a2772967747f5755` after hosted `lint-and-test`, `mysql-authorization`, and both Vercel checks passed. Canonical-main CI run for that exact SHA concluded `success`. GitHub production deployment `5570204857` reached `success` for the same SHA.
- Production smoke (unauthenticated): root `200`; unauthenticated `project.get` returns `401`; invalid `design.resolveShareLink` returns a concealed `404` with `private, no-store` and `noindex, nofollow, noarchive`; the invalid `/share/<token>` page carries the same privacy headers.
- Restorable backup `6uu5kivdqk06` (`2026.07.23 09:57:07.800`, 218.6 MB, one-month retention) completed successfully on branch `main` before any schema change.
- Pre-migration preflight: `material_library` 285 rows with 285 distinct non-null `product_code` values (no duplicate blocking the unique index); `source_registry` 90 rows; `evidence_records` 1,781; `benchmark_proposals` 1,935; `rfq_line_items` 0. `__drizzle_migrations` is empty on production, consistent with every prior release applying statements outside the Drizzle journal.
- Schema application used the established PlanetScale safe-migrations flow: branch `ev00-0056-0058-20260723` from `main`, the nine additive statements of migrations 0056–0058 applied there with statement-breakpoint markers stripped, schema verified on the branch, then deploy request #8 into `main`. Its diff was purely additive — nine columns and two unique keys, with no drop, rename, or type change — and it deployed to `deploy state: complete_pending_revert` (live with the revert window open).
- Post-migration production verification: all 285 `material_library` rows now read `source_type = miyar_assumption`, `price_confidence = assumption`, and `source_label = "MIYAR assumption"`, so every authoritative material cost is explicitly labelled an assumption; zero rows received a fabricated `source_url` or `price_observed_at`; `material_library_product_code_unique` is present and unique; all 1,935 `benchmark_proposals` rows carry `keyPolicyVersion = legacy-v0`; all 1,781 `evidence_records` rows have a null `modelSuggestedFinishLevel`; `source_registry.slug` exists with its unique index and zero populated values.
- Material-library seeding was deliberately **not** run. A full comparison proved all 35 seed rows already exist in production with byte-identical prices, and migration 0056's defaults had already applied the provenance labels to all 285 rows, so the seeder would have rewritten identical values for no benefit.
- Source-registry slug seeding is **complete**. The tested seeder ran against the production target `aws.connect.psdb.cloud:3306/miyar-v2` under an exact-operation approval token and reported 9 created, 24 updated, 0 errors. Post-run verification: `source_registry` holds 99 rows with 33 populated slugs and zero duplicate slugs; `gems-building-materials` and `pan-marble-dubai` are inactive as intended; connector rows including `graniti-uae`, `rak-ceramics-uae`, `scad-pdf-materials`, and `dld-transactions` are active and resolvable. `material_library` remains 285 rows with all 285 labelled MIYAR assumptions and zero fabricated source URLs, and all 1,935 benchmark proposals remain `legacy-v0`. Static connectors can now resolve their registry rows, so the F4/F5 freshness and evidence-linkage fix is live. Pre-run analysis of the overwrite was confirmed by the result: Analysis of production shows 24 of the 33 seed entries match existing rows by exact URL with no duplicates among them, and the remaining nine (`nakheel-properties`, `rics-market-reports`, `dubai-statistics-center`, `dubai-pulse-materials`, `scad-abu-dhabi`, `scad-pdf-materials`, `dld-transactions`, `savills-me-research`, `property-monitor-dubai`) have no production row and would be inserted. The overwrite is lossless: 22 of the 24 matched rows are byte-identical to the seed across extraction hints, notes, and request delay, zero rows differ in extraction hints, and the only two differences are the dated deactivation notes deliberately added for the dead domains `gems-bm.com` and `pansidubai.com`. Until the seeder runs, `source_registry.slug` stays null, so static connectors cannot resolve their registry rows and the F4/F5 freshness/linkage fix remains inert in production; the orchestrator logs each unresolved connector and skips its health update rather than failing.

## EV-00 Follow-up Release Observation

These facts describe the robots/category remediation and the EV-01 source packet, observed 2026-07-23.

- PR #43 merged as `709bcf2` and PR #44 as canonical `main` `c92ce085e58f0b1d6a2e0ff53b0e35ad19b04e33`. Canonical-main CI concluded `success` for that exact SHA, and GitHub production deployment `5576361368` reached `success` for it.
- Production smoke passed: root `200`, login `200`, unauthenticated `project.get` `401`, and invalid `design.resolveShareLink` returning a concealed `404` with `private, no-store` and `noindex, nofollow, noarchive`.
- Two defects found by the first production ingestion on the EV-00 code (`ING-27a2ab20`) are fixed. Both were regressions introduced by EV-00 itself.
  - Robots over-strictness: the policy rejected any 200 robots.txt not declared `text/plain` and failed closed on the first transient error, blocking five sources of which four were false negatives against Tier-A official hosts. A 200 body is now parsed whatever its content type, and a transiently unavailable robots.txt is retried once; an established verdict is never retried, so a disallow cannot be retried into an allow. Live verification after the fix: `dsc.gov.ae`, `scad.gov.ae`, and `rics.org` resolve `ROBOTS_ALLOWED`, while genuinely unreachable `dubaipulse.gov.ae` still fails closed. ADR-0010 records the amended semantics and the evidence behind them.
  - Category plumbing: `extractViaLLM` built a whitelisted item object that dropped the per-item `category`, so the prompt asked for a field discarded before the consumer read it and all 54 records in that run fell to `other`. The field now survives, and `mapCategory` additionally maps near-miss answers onto the evidence vocabulary; genuinely unknown values still resolve to an honest `other`.
- Release verification: `pnpm check`, database-free suite 1,572 passed with 22 skipped, `pnpm check:mysql-evidence` current, authorization inventory 389/0, database safety 123/2/0, build, and `pnpm certify:workflow` PASS.
- `docs/artifacts/EV-01_SOURCE_CANDIDATE_PACKET.md` records six sources verified to publish real, currently-visible AED prices in server-side HTML — Tile King, Danube Home, Graniti UAE, Fepy, ACE UAE, and the RAK Ceramics shop subdomain — none requiring a JavaScript rendering proxy. It also records the negative results (no official per-item AED price source confirmed; no free fit-out benchmark extractable; `ceilings`, `joinery`, and `kitchen` uncovered by any public source) and three indicated registry repairs, including that EV-00's `hafele.ae/en/` repair is itself a 404 and should become a deactivation. Every source remains evidence only pending a recorded terms decision under the `BR-06` process.

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
- TR-12 release commit `43e5019c02c0f25848c31df0d1dfa2158b076723` deployed successfully as Vercel target `4ixzzXRp886bet8XDRhc439czfWd`. PR #17, canonical-main CI run `29654957839`, three production root/health observations, tenant/share negative checks, and rendered landing-page browser verification pass; no schema, migration, dependency, shared configuration, or database operation was required or performed.
- SC-04 release commit `1bad9d666d71a0b010a27433ca196c842b4e546f` deployed successfully as Vercel target `dpl_EfNS4qwEXLRXHPNKPi6isHG41BuE`. PR #20, canonical-main CI run `29675827338`, authenticated report/share/revoke smoke, unauthenticated tenant rejection, and concealed-share privacy checks pass; no schema, migration, dependency, shared configuration, or database migration was required.
- Canonical `main` contains the reviewed SC-04 production release.

## Environment Uncertainties

- Documentation historically names both PlanetScale and TiDB. Treat the actual `DATABASE_URL` target and deployment configuration as authoritative for a given environment without exposing credentials.
- TR-12 makes the ordinary full Vitest command database-hermetic: the standard configuration selects the test/unit-test contract and explicitly blanks `DATABASE_URL` before modules load, while disposable MySQL remains exclusively behind the guarded `TEST_DATABASE_URL` runner. `KF-008` is closed.
- GitHub Actions billing was restored on 2026-07-18. Rerun `29633531305` executed real job steps, revealing and confirming a separate duplicate pnpm-version setup error. After CI workflow commit `18da870`, hosted run `29634762518` passed both the unit/type/build and MySQL authorization jobs on canonical `main`; `KF-014` is closed.

## CI Configuration in the Current Worktree

- CI configuration uses pnpm and the committed lockfile, with fail-closed TypeScript, test, build, and isolated MySQL jobs.
- GitHub now executes both required jobs normally. The workflow resolves pnpm from the repository `packageManager` field, avoiding a competing workflow-level version.
- The observed local TypeScript, safe full-suite, authorization, build, isolated MySQL, and PlanetScale compatibility gates are green.
- TR-12 adds a centralized fail-closed database profile/operation/target policy, final-use target rechecks, guarded database entrypoints, and a CI-enforced AST inventory. A hostile-parent full suite passes 1,206/22, the rebased release suite passes 1,210/22, the inventory reports 106 entrypoints with two exact generated-bundle exceptions and zero findings, and disposable MySQL passes 19/19 with cleanup.

## Authorization Foundation

- `TR-01` inventory extraction now covers all 329 application procedures.
- `TR-02` provides typed organization-resource and public-share authorization primitives with 49 passing targeted tests.
- `TR-03` closes all 39 design-router remediation paths with organization-locked resource operations and fail-closed public shares.
- `SC-01` preserves those authorization guarantees while moving all 63 design procedures into eight bounded owner routers behind a flat compatibility facade; the immutable semantic contract and current authorization audit both pass.
- `TR-03H` closes live membership, design roles, scoped final writes, composite atomicity, rejected-upload compensation, public-share privacy, real-SQL evidence, and canonical release identity.
- `TR-04` closes all 93 remaining project-router authorization/global-governance paths, including the later ultra-review remediation for atomic report persistence and tenant-owned portfolio alerts. The live inventory has zero `TR-04` and exactly eight pooled-data rows under `TR-05`; targeted, disposable MySQL, safe full-suite, TypeScript, audit, build, diff, and independent-review gates pass.
- `TR-05` and `KF-007` are closed on `codex/tr-05-data-isolation`. Corpus isolation, migration 0047, fail-closed organization/public reads, scheduler disablement, insufficiency contracts, UI states, and enhanced audit enforcement are implemented. Verified gates: disposable MySQL 18/18, safe suite 962 passed with 22 skipped, authorization inventory 331/331 with zero remediation rows, TypeScript/build/diff PASS, in-app browser PASS across analytics, cost forecasting, project prediction, design advisor, and learning administration, and independent Claude Code `APPROVED_NO_OBJECTION`.
- `UX-01` is merged into canonical main through commit `029f5c1`. Its implementation and prior authenticated verification remain recorded, but an authenticated browser session was unavailable during the independent TR-07 release smoke; the roadmap retains that explicit UX-01 human gate.
- `TR-08` is reclosed with accepted ADR-0003 and policy bundle `TR-08-v1`. `TR-09` implemented and released the resulting truthful space, confidence-provenance, tenant-safe public-upsert, and board-annex contracts; `KF-016` and `KF-017` are closed. TR-10, TR-11, TR-12, TR-13, SC-01, SC-04, DI-01, and BR-01 are closed; `BR-02` is the sole `READY` next step, while `SC-05` remains dependency-valid but human-gated.

## Refresh Procedure

Update this file only after direct observation:

1. Record date, commit, branch, and relevant environment label.
2. Inspect the worktree without discarding unrelated changes.
3. Run the exact relevant commands.
4. Record exit status and concise evidence.
5. Update `.agent/state/KNOWN_FAILURES.md` for unresolved reproduced failures.
6. Do not copy changing counts into permanent agent instructions.
