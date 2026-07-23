# Durable Lessons

This is the append-only learning register shared by Codex, Claude Code, and human engineers. It records reusable engineering knowledge discovered while executing roadmap steps.

## Rules

1. Add a lesson only after evidence identifies a real issue, cause, effective fix, or invalidated hypothesis.
2. Never rewrite an old lesson to make history cleaner. Add a superseding lesson and link both IDs.
3. A lesson must contain the context, observed symptom, cause, fix or decision, proof, and reuse rule.
4. Do not store secrets, credentials, personal data, full logs, or transient counts here.
5. Lessons inform future plans but never override live code, current instructions, or verified command output.
6. Reference lesson IDs when closing roadmap steps and when the lesson changes a later plan.

## Lesson Template

### LES-### — Short reusable title

- Date / roadmap step:
- Context:
- Observed:
- Cause:
- Fix or decision:
- Proof:
- Reuse rule:
- Supersedes / related:

## Recorded Lessons

### LES-001 — Authentication is not resource authorization

- Date / roadmap step: 2026-07-15 / audit implementation
- Context: Project-scoped tRPC procedures used `protectedProcedure`.
- Observed: An authenticated caller could supply project/resource IDs without every path proving organization ownership.
- Cause: Identity authentication and resource authorization were composed as separate optional concerns.
- Fix or decision: Introduce mandatory organization-bound resource resolvers and indistinguishable missing/cross-org errors.
- Proof: `project-access` boundary tests cover same-org, cross-org, missing, and legacy-null projects.
- Reuse rule: Every organization-owned router path must begin from an authorized resource resolver; never treat `protectedProcedure` alone as tenant isolation.
- Supersedes / related: Drives `TR-01`–`TR-04`.

### LES-002 — Local startup must not imply shared-environment writes

- Date / roadmap step: 2026-07-15 / audit implementation
- Context: Starting the development server with a configured database URL.
- Observed: Development connected to the configured remote database and automatically started ingestion, learning, and alert workers.
- Cause: Runtime mode controlled server startup but did not distinguish safe local work from scheduled operational jobs.
- Fix or decision: Disable background jobs by default outside production and require explicit opt-in.
- Proof: Runtime policy unit tests and development smoke log showed workers disabled.
- Reuse rule: Every local, test, preview, and production profile must declare external-write behavior explicitly; defaults outside production must be non-mutating.
- Supersedes / related: Drives `TR-12` and `SC-05`.

### LES-003 — Secrets must fail closed

- Date / roadmap step: 2026-07-15 / audit implementation
- Context: Cron authorization.
- Observed: The prior conditional check accepted requests when `CRON_SECRET` was missing.
- Cause: Secret presence was treated as optional configuration rather than an authorization prerequisite.
- Fix or decision: Missing, wrong, or absent authorization now denies execution.
- Proof: Six runtime-safety tests include missing and wrong-secret cases.
- Reuse rule: Security controls that depend on configuration must deny access when configuration is absent or invalid.
- Supersedes / related: Retained by `TR-12` and `SC-05`.

### LES-004 — A green build does not establish a healthy contract baseline

- Date / roadmap step: 2026-07-15 / audit
- Context: Repository verification.
- Observed: Production build passed while TypeScript had 49 errors and the test suite had nine failures.
- Cause: Bundling can transpile or package code without proving all type and behavior contracts.
- Fix or decision: Report build, type-check, tests, workflow, and artifact verification independently.
- Proof: Audit baseline and final verification preserved the red gates rather than calling the repository green.
- Reuse rule: Never use a passing build to waive a failing type-check or test suite; classify and disclose every gate separately.
- Supersedes / related: Drives `TR-06`–`TR-10`.

### LES-005 — Optimize the import boundary before rewriting features

- Date / roadmap step: 2026-07-15 / audit implementation
- Context: Large initial client payload.
- Observed: All pages and the authenticated shell were eagerly imported.
- Cause: Route composition, not an individual feature, forced unrelated code into the entry bundle.
- Fix or decision: Lazy-load pages and the authenticated shell.
- Proof: Initial JavaScript fell from 4.763 MB / 936.86 KB gzip to 677.84 KB / 199.24 KB gzip while browser smoke passed.
- Reuse rule: Measure and repair loading boundaries before invasive feature-level optimization; retain bundle budgets to prevent regression.
- Supersedes / related: Drives `SC-04`.

### LES-006 — Repository files are the shared memory boundary

- Date / roadmap step: 2026-07-16 / `RM-00`
- Context: Coordinating Codex, Claude Code, and future sessions.
- Observed: Conversation context and agent auto-memory are not guaranteed to be shared or permanent.
- Cause: Each agent/session has separate transient context.
- Fix or decision: Store roadmap status, active task, known failures, verified facts, worklog, and lessons in canonical repository files; use Git as permanent history.
- Proof: `AGENTS.md` is loaded by both agents through `CLAUDE.md`, and the roadmap protocol points both to the same state files.
- Reuse rule: If future work must be remembered by both agents, persist it in the designated repository file during the same verified change.
- Supersedes / related: Governs all roadmap steps.

### LES-007 — Mechanical coverage does not prove authorization semantics

- Date / roadmap step: 2026-07-16 / `TR-01`
- Context: The AST checker enumerated all router procedures and initially passed its structural checks.
- Observed: Independent review still found incorrect classifications for polymorphic tags, portfolio links, simulations, pooled evidence, invite membership, and nullable share expiry.
- Cause: Access primitives, input names, and helper calls reveal candidates but cannot decide the meaning or ownership of every resource.
- Fix or decision: Combine AST completeness with manual router-to-helper-to-schema tracing and independent semantic review; validate annotation drift as well as procedure count.
- Proof: Review moved multiple rows between global, organization-guarded, unsafe, and pooled-data remediation categories before reaching `APPROVED_NO_OBJECTION`.
- Reuse rule: Automation may prove inventory coverage, never security correctness by itself; high-risk classifications require semantic trace and adversarial review.
- Supersedes / related: Applies to `TR-02`–`TR-05`.

### LES-008 — Child IDs require the entire ownership chain

- Date / roadmap step: 2026-07-16 / `TR-01`
- Context: Mutations accepted board-join, room, allocation, simulation, tag-target, asset-link, and similar child IDs.
- Observed: Several helpers updated or deleted child records directly by ID, while the organization boundary existed only through one or more parent records.
- Cause: Database helpers optimized for direct IDs without carrying organization or parent ownership into their signatures.
- Fix or decision: Record explicit chains such as join → board → project → organization and simulation → project → organization, then require resource resolvers in later remediation.
- Proof: The final inventory contains no placeholder chains and the checker rejects incomplete ownership annotations.
- Reuse rule: Never authorize a child resource from its ID alone; resolve and verify every parent needed to reach the organization boundary before the first read/write.
- Supersedes / related: Drives `TR-02`–`TR-04`.

### LES-009 — Confirm vulnerabilities without normalizing them in tests

- Date / roadmap step: 2026-07-16 / `TR-01`
- Context: TR-01 needed behavioral evidence for an unsafe route but could not leave the suite asserting insecure behavior as correct.
- Observed: A mocked `design.listAssets` caller returned another project ID's asset list instead of rejecting.
- Cause: The procedure passed the caller-supplied project ID directly to the database helper without an ownership check.
- Fix or decision: Run a disposable rejection expectation, record its failure as evidence, then remove the probe; permanent regression tests belong with the remediation.
- Proof: The isolated probe failed because the promise resolved with the mocked asset list, and no probe file remains in the worktree.
- Reuse rule: Use disposable or deliberately failing characterization to prove a vulnerability; commit only the secure regression expectation alongside the fix.
- Supersedes / related: Applies to security analysis and `TR-03`.

### LES-010 — Nullable security metadata can turn checks into fail-open behavior

- Date / roadmap step: 2026-07-16 / `TR-01`
- Context: Public design-brief share tokens use a nullable expiry field.
- Observed: The router rejects an expired non-null date but accepts a valid token when expiry is null.
- Cause: Token and expiry nullability are independent, while the runtime check treats missing expiry as unrestricted.
- Fix or decision: Inventory the path as high-severity remediation under `TR-03`; later behavior should fail closed or use an explicitly approved non-expiring policy.
- Proof: `design.resolveShareLink` source and schema trace are recorded in the inventory, including query-only behavior and the nullable-expiry caveat.
- Reuse rule: When authorization depends on metadata, missing metadata must be an explicit policy state; never silently interpret null as unlimited access.
- Supersedes / related: Applies to shares, invitations, API tokens, and expiring approvals.

### LES-011 — A test command is not safe merely because it is local

- Date / roadmap step: 2026-07-16 / `TR-01`
- Context: The required full-suite baseline was run after the inventory work.
- Observed: The auth logout test inherited the configured remote database URL and attempted an audit-log write; it failed only because the remote branch was unavailable.
- Cause: Test setup did not isolate database configuration or fully mock the audit path.
- Fix or decision: Record the suite as non-hermetic and route remediation to `TR-07`/`TR-12`; future test profiles must reject shared targets before connection.
- Proof: The full-suite log recorded the remote host connection and failed insert while preserving the same nine baseline test failures.
- Reuse rule: Before running tests that may initialize application infrastructure, verify the test environment cannot resolve to a shared database; mocks must include side-effect paths such as audit logging.
- Supersedes / related: Extends `LES-002`; tracked as `KF-008`.

### LES-012 — Unsetting an environment variable may let dotenv restore it

- Date / roadmap step: 2026-07-16 / `TR-02`
- Context: Running the full suite without allowing its audit path to resolve the configured shared database.
- Observed: `env -u DATABASE_URL pnpm test` still connected because importing `dotenv/config` loaded `DATABASE_URL` from the local environment file.
- Cause: Removing the process variable made it eligible for dotenv population; unset and explicitly empty have different behavior.
- Fix or decision: Use `DATABASE_URL=''` for the current safe verification command until `TR-12` provides a dedicated test profile that rejects shared targets.
- Proof: The unset run attempted the remote audit insert; the explicitly empty logout test and full suite reported `DATABASE_URL set: false` and made no connection attempt.
- Reuse rule: For dotenv-based applications, verify the effective runtime configuration rather than assuming `env -u` disables a setting; use an explicit safe profile or fail-closed sentinel.
- Supersedes / related: Extends `LES-011`; tracked by `KF-008` and roadmap `TR-12`.

### LES-013 — An `any` data boundary collapses client contract inference

- Date / roadmap step: 2026-07-16 / `TR-06`
- Context: tRPC query callbacks across administration, reporting, scenarios, and market intelligence were reported as implicit `any`.
- Observed: The UI callbacks were not independently untyped; database helpers returning through an `any` handle erased router output inference across many consumers.
- Cause: Runtime database initialization was intentionally loose, but no concrete shared entity contract was restored at the client boundary.
- Fix or decision: Export schema-derived entity types through `shared/` and narrow affected query results once at their consumption boundary; keep JSON fields explicitly unknown until validated.
- Proof: The same callback set compiles with zero diagnostics without callback-level `any`, ignores, or weakening strict mode.
- Reuse rule: When many tRPC consumers simultaneously lose inference, inspect the earliest `any` boundary before annotating individual callbacks; publish concrete cross-layer types from `shared/`.
- Supersedes / related: Extends `LES-004`; applies to future router and database contract work.

### LES-014 — Composite authorization belongs at the mutation boundary

- Date / roadmap step: 2026-07-16 / `TR-03`
- Context: Design routes linked projects, scenarios, briefs, visuals, assets, boards, comments, and polymorphic targets.
- Observed: Router guards prevented ordinary cross-organization IDs, but independent review found check-then-write windows and legacy inconsistent associations.
- Cause: Raw insert/update helpers carried authorized IDs without revalidating every related resource in the same database operation.
- Fix or decision: Use closed typed resolvers at the router boundary and organization-locked transactions or predicates at the database boundary; validate both ends of polymorphic links and optional scenario associations on creation and read.
- Proof: Zero TR-03 inventory rows, 68 passing authorization tests, safe full suite and builds, and final independent review `APPROVED_NO_OBJECTION`.
- Reuse rule: For multi-resource operations, authorization is complete only when every ownership claim is revalidated at the final read/write boundary; a prior router check alone is not sufficient evidence.
- Supersedes / related: Extends `LES-007` and `LES-008`; applies to `TR-04`.

### LES-015 — Real SQL exposes error contracts that mocks conceal

- Date / roadmap step: 2026-07-16 / `TR-03H`
- Context: Share-token collision handling passed mocked contracts but initially failed against MySQL.
- Observed: Drizzle wrapped the duplicate-key error in a cause chain, so checking only the top-level error did not recognize a retryable collision.
- Cause: The mocked error shape represented the database driver directly rather than the ORM-wrapped runtime shape.
- Fix or decision: Traverse bounded error causes when classifying known database errors and require real isolated SQL coverage for scoped mutation helpers.
- Proof: The guarded MySQL 8 suite passes 7/7, including uniqueness and collision handling.
- Reuse rule: Mocked database tests prove orchestration, not driver/ORM error semantics; critical constraint handling needs a real-engine contract.
- Supersedes / related: Extends `LES-014`; applies to `TR-04` database boundaries.

### LES-016 — Provider compatibility needs an explicit capability profile

- Date / roadmap step: 2026-07-16 / `TR-03H`
- Context: The mandatory MySQL suite used a trigger solely to inject a late transaction failure.
- Observed: PlanetScale rejected trigger DDL even though all application SQL and transaction behavior under test were compatible.
- Cause: A test-only fault-injection mechanism was treated as if it were part of the provider application contract.
- Fix or decision: Keep full MySQL 8 semantics mandatory and define a narrow provider profile that skips only unsupported test machinery, never application behavior.
- Proof: MySQL passes 7/7 including trigger rollback; PlanetScale passes 6/6 applicable tests with the trigger-only case explicitly identified and excluded.
- Reuse rule: Provider compatibility exclusions must name the unsupported mechanism and retain equivalent semantic evidence on the mandatory reference engine.
- Supersedes / related: Applies to future provider-compatibility gates.

### LES-017 — Migration tooling must not execute statement markers

- Date / roadmap step: 2026-07-16 / `TR-03H`
- Context: Applying migration 0045 through a bounded production script.
- Observed: The first unique index succeeded, then the script sent Drizzle's `--> statement-breakpoint` marker as SQL before the second index.
- Cause: The ad hoc runner split the file without stripping migration metadata.
- Fix or decision: Stop immediately, inspect the exact partial schema, rerun duplicate preflight, and apply only the missing additive statement; future runners must parse or strip recognized migration markers before execution.
- Proof: Both production unique indexes are present, unique, and duplicate preflight remains zero after the controlled completion.
- Reuse rule: After partial DDL, never replay blindly; inspect applied state, verify data invariants again, and execute only the exact missing idempotent-safe statement.
- Supersedes / related: Applies to all manual or provider-specific migration runners.

### LES-018 — Regenerated security inventories must not preserve prior verdicts

- Date / roadmap step: 2026-07-16 / `TR-04`
- Context: The authorization inventory merged live AST facts with previously rendered annotations.
- Observed: Removing one hardcoded safe-key list was insufficient because the merge still preserved old safe classifications; an adversarial rerender reopened 22 paths, including real design-advisor and evidence authorization gaps.
- Cause: Historical annotations were treated as authoritative across source changes, and `adminProcedure` was initially assumed to prove governance without examining tenant resource relevance.
- Fix or decision: Recompute classifications from live code on every render, make global governance explicit by procedure key, classify tenant-relevant admin paths unsafe unless separately authorized, and bind critical integration evidence to current file hashes.
- Proof: A clean rerender inventories 329 procedures with zero `TR-04`, exactly eight `TR-05`, and 21 current executed MySQL evidence rows; Claude Code independently verified that stale classifications cannot survive and returned `APPROVED_NO_OBJECTION`.
- Reuse rule: Generated security ledgers may preserve descriptive history only when it cannot override live classification; access primitives and old annotations are evidence inputs, never final authorization verdicts.
- Supersedes / related: Extends `LES-007`, `LES-014`, and `LES-015`.

### LES-019 — Tenant workflows must not piggyback global side effects

- Date / roadmap step: 2026-07-16 / `TR-04`
- Context: Tenant project evaluation and portfolio health checks historically invoked platform-wide alert behavior.
- Observed: Moving portfolio alerts to an organization-owned table was insufficient while `project.evaluate` still called the global alert engine, allowing ordinary tenant members to create global-admin-visible records containing cross-tenant pattern context.
- Cause: Authorization review classified the router's direct database calls but did not initially follow an imported engine into its global reads and writes.
- Fix or decision: Remove tenant-triggered global alert generation, keep platform alerts behind global-admin/scheduler governance, and make the authorization audit reject organization procedures that reference the global alert engine or `platformAlerts`.
- Proof: The router regression rejects either symbol, the live inventory passes with zero TR-04 rows, the safe suite passes 950 tests, and the final Claude Code adversarial review returned `APPROVED_NO_OBJECTION`.
- Reuse rule: Trace imported engines and external side-effect helpers as part of the authorization path; a tenant-scoped router may not inherit global-write authority through an indirect call.
- Supersedes / related: Extends `LES-007`, `LES-014`, and `LES-018`.

### LES-020 — Ownership checks do not make derived data trustworthy

- Date / roadmap step: 2026-07-16 / `TR-05`
- Context: Tenant projects were access-controlled, but prediction and learning paths consumed evidence, trends, outcomes, patterns, and insights whose source corpus was global, null-owned, or historically unclassified.
- Observed: A caller could be authorized for its own project while another organization's records still changed the caller's forecast or recommendation; independent review also found that legacy project-insight rows survived a project ownership check.
- Cause: Resource authorization and analytical corpus authorization were treated as the same boundary, and null ownership was implicitly treated as public governance.
- Fix or decision: Classify every policy-influencing record as `organization`, `platform_public`, or `legacy_unscoped`; require organization joins or explicit governed-public predicates at the final read/write boundary; return insufficiency instead of pooling; make the authorization audit reject unscoped learning helpers.
- Proof: Disposable MySQL passes 18/18 including owned/foreign/legacy/public influence fixtures; the safe suite passes 962 tests, the 331-procedure authorization audit has zero remediation rows, in-app browser verification passes all five affected surfaces after correcting two misleading zero states, and Claude Code's final verdict is `APPROVED_NO_OBJECTION`.
- Reuse rule: Tenant access to a target resource never authorizes the data corpus used to calculate its result; derived and historical data need an independently explicit ownership/provenance policy.
- Supersedes / related: Extends `LES-014`, `LES-018`, and `LES-019`; applies to all future learning, analytics, recommendation, and prediction work.

### LES-021 — Semantic token migrations require rendered contrast checks

- Date / roadmap step: 2026-07-17 / `UX-01`
- Context: MIYAR moved from a dark-only palette to light-first semantic themes while preserving a large legacy component surface.
- Observed: TypeScript, unit contracts, and build passed, but the first in-app browser capture showed the public headline nearly invisible because a late global heading rule still forced the former dark-theme text color.
- Cause: The new semantic foreground token was correct, but a more specific legacy base rule bypassed it with a hard-coded color.
- Fix or decision: Replace the hard-coded heading color with `text-foreground`, then verify the rendered light and dark surfaces at real breakpoints; keep print tokens fixed independently.
- Proof: The before/after browser captures changed the headline from `rgb(240, 235, 227)` on the warm light canvas to the governed foreground, and authenticated checks passed at 360, 390, 768, and 1440 pixels with no overflow.
- Reuse rule: A token migration is incomplete until representative rendered pages are inspected in every supported theme; search for late global rules and hard-coded colors even when compilation and component contracts are green.
- Supersedes / related: Applies to future theme, typography, RTL, chart, report, and accessibility work.

### LES-022 — Timed-out async tests can contaminate the next mock assertion

- Date / roadmap step: 2026-07-17 / `TR-07`
- Context: One authentication test performed registration, successful login, and rejected login, each requiring cost-12 bcrypt work, while the full suite and build competed for CPU.
- Observed: The combined test crossed Vitest's five-second timeout and continued far enough to record an audit call during the following legacy-password test, making the next test report an impossible extra call.
- Cause: Multiple expensive cryptographic behaviors shared one timeout boundary; timeout failure did not cancel already-running asynchronous work.
- Fix or decision: Split rejected-password behavior into a focused case with a fixed valid bcrypt fixture, keep success and legacy-upgrade contracts separately bounded, and preserve the default timeout rather than hiding the issue with a larger limit.
- Proof: The focused auth suite, 49-test surrounding suite, and safe full suite with 1,021 passing tests all complete without timeout spill or cross-test audit contamination.
- Reuse rule: Keep expensive password or crypto behaviors in independently bounded tests; when a later mock assertion gains unexplained calls, check for unfinished asynchronous work from a timed-out predecessor before weakening isolation or assertions.
- Supersedes / related: Extends test-isolation guidance from `TR-07`; `KF-008` remains the separate environment-profile risk.

### LES-023 — Human policy approval is incomplete until its durable decision artifact exists

- Date / roadmap step: 2026-07-17 / `TR-08`
- Context: The product owner had approved the empty-space fallback, connector confidence formula, and mandatory report annex, and the implementation tests were green, but the roadmap step closed without the required decision record.
- Observed: Live behavior could be characterized, yet future engineers had no authoritative record separating approved policy from downstream limitations or naming what required new human approval.
- Cause: Passing implementation evidence was treated as a substitute for the owner, rationale, versions, boundaries, consumer trace, rejected alternatives, and supersession rules required by the decision gate.
- Fix or decision: Reopen the step, preserve its original closure history, create accepted ADR-0003, strengthen exact characterization, and route newly verified ambiguities to a separate remediation step without changing runtime behavior.
- Proof: `TR-08-v1` is indexed and consumer-traced; targeted tests pass 80/80, the safe suite passes 1,023 with 22 skipped, repository gates pass, and independent code and Claude Sonnet reviews approved the corrected record.
- Reuse rule: Do not close a human-gated product, numerical, data, or report decision until the durable accepted artifact exists and its approved behavior, limitations, effective version, consumers, and supersession process are all reviewable from the repository.
- Supersedes / related: Extends the roadmap Definition of Done and applies to all future ADR-backed human approval gates.

### LES-024 — Additive provenance migrations must prove legacy silence in production

- Date / roadmap step: 2026-07-18 / `TR-09`
- Context: Confidence provenance required an append-only assessment table and nullable current fields while thousands of historic evidence rows lacked reproducible clocks or policy stages.
- Observed: A schema-only success would not prove that the release avoided inventing provenance, and the production branch did not enforce safe migrations.
- Cause: Additive DDL statements commit independently on the provider, while legacy rows can look valid even when new nullable/default fields have been written unexpectedly.
- Fix or decision: Take and verify a restorable backup, fingerprint the reviewed SQL, apply each statement once in order, then prove schema shape, indexes, counts, null legacy provenance, zero backfilled assessments, and pointer/key integrity before application deployment.
- Proof: Migration 0049 applied all eight statements after backup `jqb2igl1ebgl`; production retained 1,755 evidence rows and 368 runs with zero assessments, null legacy provenance, and zero orphan/pointer/duplicate-key violations.
- Reuse rule: For provenance migrations, record both structural success and the absence of fabricated historical state; after any partial DDL failure, inspect the exact live schema and apply only verified missing statements.
- Supersedes / related: Extends `LES-017` and `LES-020`; applies to all append-only evidence and audit-schema migrations.

### LES-025 — Text contracts do not certify rendered artifacts

- Date / roadmap step: 2026-07-18 / `TR-10`
- Context: MIYAR's report tests mainly asserted HTML strings or that DOCX output was a readable ZIP, while client artifacts pass through browser-print PDF and office rendering.
- Observed: Structural and text tests missed object-coercion output, footer-only pages, English fragments in Arabic reports, and document-root locale drift.
- Cause: Tests did not exercise each production-compatible renderer, remove repeated page furniture when detecting blank pages, or require per-exporter Arabic smoke coverage.
- Fix or decision: Add typed stress fixtures, canonical production render-input builders, Playwright browser printing, LibreOffice DOCX conversion, Poppler inspection, furniture-stripped blank-page checks, and Arabic smoke artifacts for every exporter.
- Proof: The fifth budgeted matrix generated and checked 23/23 artifacts, and visual inspection found and drove fixes for issues that unit tests had not exposed. The separately authorized sixth post-fix cycle then passed 23/23 artifacts and 83/83 inspected pages; see `LES-026` for the distinct authenticated UI gate.
- Reuse rule: Always certify the real output path and inspect every page. Any post-render copy or layout change invalidates visual PASS and requires another render; when the iteration budget is exhausted, stop at an explicit human gate instead of silently extending it.
- Supersedes / related: Extends `LES-021` from application themes to HTML, browser-PDF, and DOCX report artifacts.

### LES-026 — Artifact harnesses and authenticated UI certification catch different failures

- Date / roadmap step: 2026-07-18 / `TR-10`
- Context: The production-compatible render harness had certified every generated HTML/PDF/DOCX page, while report controls still needed verification inside the authenticated application shell.
- Observed: The artifact matrix was clean, but the synthetic signed-in browser path exposed successful authentication returning to the public homepage, missing project-specific routes, a project page crash on an optional ROI label, a legacy comparison URL without project context, and a Room Render card wired to the hero-image action.
- Cause: Engine-level artifact generation does not exercise application routing, optional presentation data, or the exact UI mutation selected by each control.
- Fix or decision: Keep artifact and authenticated UI certification as separate gates; use a fail-closed loopback-only synthetic environment, repair route/action wiring and fail-soft display boundaries, then recheck for new browser errors. Never bypass a browser safety policy that reserves generated download/new-page actions for a human.
- Proof: The sixth artifact cycle passes 23/23 artifacts and 83/83 pages; authenticated selectors/previews/routes and public shares pass after the fixes; the final review's focused contracts pass 55/55, the safe suite passes 1,113/22, TypeScript and build pass, and the reloaded Design Studio emits no new browser errors.
- Reuse rule: A clean rendered artifact does not prove that users can reach or invoke it correctly. Certify the application shell separately, with synthetic authenticated data and explicit human gates for interactions the approved automation surface will not perform.
- Supersedes / related: Extends `LES-025` and the tenant-safe environment guidance that remains owned by `TR-12`.

### LES-027 — Source context does not calibrate an unrelated deterministic guideline

- Date / roadmap step: 2026-07-18 / `TR-11`
- Context: MIYAR space recommendations use deterministic ratio guidelines while the same view may also show an area's DLD transaction count.
- Observed: Copy described the ratio comparison and scenario coefficient as transaction-backed or DLD-calibrated even though the DLD sale value did not participate in those calculations.
- Cause: Co-locating official observations with an internal guideline was mistaken for numerical provenance and causal validation.
- Fix or decision: Label the deterministic rule as a MIYAR ratio guideline, expose positive DLD counts only as separate area context, and state that the context does not calibrate or validate a sale uplift.
- Proof: Share, scoring, project-insight, space-evidence, design-brief, DOCX, and customer-copy contracts reject the prior causal wording; focused suites and independent review pass without changing numerical logic.
- Reuse rule: A source displayed beside a calculation is not the calculation's provenance. Claim calibration, backing, prediction, or causality only when the versioned calculation contract actually consumes and validates that evidence.
- Supersedes / related: Extends the numerical-authority and provenance boundaries in `AGENTS.md` and `TR-09`.

### LES-028 — Rejected per-key traffic must not consume a shared anonymous quota

- Date / roadmap step: 2026-07-18 / `TR-11`
- Context: The public evidence snapshot needs both per-address and global process-local rate ceilings without requiring authentication.
- Observed: Committing the global quota before checking the per-address ceiling allowed repeated rejected calls from one address to consume capacity for unrelated visitors.
- Cause: The two rate-limit decisions were treated as sequential mutations instead of one atomic admission decision.
- Fix or decision: Inspect both bounded buckets first and append to both only after both ceilings accept the request; trust forwarded addresses only under explicit proxy configuration.
- Proof: The router test accepts 60 calls from one address, rejects 540 more without consuming the shared quota, and still accepts a second address; the safe suite and independent security review pass.
- Reuse rule: Multi-bucket anonymous limiting must make one non-consuming admission decision before mutating any bucket, and must keep process memory bounded.
- Supersedes / related: Applies to all future unauthenticated read-only endpoints and complements public-share privacy controls.

### LES-029 — Database safety must bind both the launch environment and the final target

- Date / roadmap step: 2026-07-18 / `TR-12`
- Context: Ordinary tests and local commands inherited whichever `DATABASE_URL` dotenv or the parent shell supplied, while multiple scripts opened MySQL directly.
- Observed: Blanking the URL manually prevented the historical test connection, but an unset value could be restored by dotenv; an early cached decision could also become stale if `process.env.DATABASE_URL` changed before pool creation.
- Cause: Environment loading, runtime intent, operation authority, and final connection construction were separate implicit decisions with no shared fail-closed contract.
- Fix or decision: Capture safety controls before dotenv, ignore dotenv attempts to set them, explicitly blank ordinary-test `DATABASE_URL`, bind remote acknowledgement to an exact operation and normalized target, remove it from the live environment, and re-evaluate the current target immediately before every pool/connection. Inventory direct constructors and the canonical wrapper in CI.
- Proof: Hostile dotenv and parent-environment tests, current-target mutation tests, pool/direct-connection denial tests, a 106-entrypoint audit with zero findings, hostile full suite 1,206/22, bounded startup exit evidence, and disposable MySQL 19/19 all pass; independent security and Claude Opus reviews approve.
- Reuse rule: Never treat a profile name, `NODE_ENV`, an earlier URL check, or a technical acknowledgement as connection authority. Enforce intent at launch, operation boundaries, and the final socket construction site.
- Supersedes / related: Closes `KF-008` and extends `LES-002` and `LES-011`.

### LES-030 — Critical-workflow certification must join real boundaries, not concatenate isolated claims

- Date / roadmap step: 2026-07-18 / `TR-13`
- Context: MIYAR had broad unit, router, artifact, and runtime coverage, but no single clean lifecycle proved that one project could cross every critical boundary with the same reconciled values and tenant rules.
- Observed: Early draft evidence could look complete while using independent fixtures, a mocked parity claim, or a report value that had not been traced back through stored room/allocation/material rows.
- Cause: Passing component tests were being aggregated as if they represented one ordered journey, while cleanup, runtime state reset, source provenance, process-output secret scans, and exact cross-surface numerical identity were separate unproven assumptions.
- Fix or decision: Use one versioned synthetic contract and disposable database; execute project, Grade A/B parser coverage, Grade C deterministic MQI, both briefs, stored report, share, public read, and revoke in order; reset state before each real application factory; reconcile formulas and costs at source; scan all durable/process evidence; and fail the run if cleanup or post-cleanup absence proof fails.
- Proof: `pnpm certify:workflow` passes with matching Node/serverless fingerprints and reconciliations, a clean serial Node browser journey, nine inspected report pages, no secret-bearing durable output, and confirmed disposable-database absence. The hostile ordinary suite and all repository gates remain green.
- Reuse rule: An end-to-end certification may cite isolated tests as supporting evidence, but its PASS gate must itself traverse the real boundaries in dependency order, carry one versioned identity across them, and prove both cleanup and absence of sensitive residue.
- Supersedes / related: Extends `LES-025`, `LES-026`, `LES-028`, and `LES-029`; `SC-05` retains future runtime capability and observability architecture.

### LES-031 — Router extraction needs an immutable semantic contract, not only a route list

- Date / roadmap step: 2026-07-19 / `SC-01`
- Context: The design router combined 63 tenant-sensitive, globally governed, admin, and public procedures in one file, and the existing authorization inventory described only the current checkout.
- Observed: A flat runtime name/kind snapshot could miss a changed validator, handler, middleware chain, or access primitive; splitting files also made the source auditor derive incorrect namespaces unless module ownership was explicit.
- Cause: Current-state inventories and public route names prove discoverability, not semantic equivalence to the pre-refactor boundary.
- Fix or decision: Capture the monolith once as an immutable AST/runtime/middleware baseline; compare every complete initializer and authorization classification; assert reference-identical flat composition and unique ownership; give each bounded router an explicit canonical audit namespace.
- Proof: All 63 initializers, operations, primitives, classifications, and middleware chains match; the composed router owns each procedure exactly once; authorization remains 338/0; focused, full, real-MySQL, workflow, build, and independent-review gates pass.
- Reuse rule: Before moving a security-sensitive router, capture a semantic pre-change baseline and keep it executable in the ordinary test suite. Update both the contract file list and audit namespace registry whenever a bounded module is added or renamed.
- Supersedes / related: Extends `LES-014` and `LES-030`; applies to future router, controller, resolver, and API-boundary decompositions.

### LES-032 — Client performance must be governed by reachable production closures

- Date / roadmap step: 2026-07-19 / `SC-04`
- Context: MIYAR already lazy-loaded pages, yet the authenticated shell statically imported an optional assistant whose Markdown renderer pulled a large Streamdown core into every protected route.
- Observed: The entry alone was a misleading measure: it was 137,910 gzip bytes while the authenticated dashboard's static closure was 450,808 gzip bytes. Hashed filenames and Vite's generic warning could not identify route ownership or prevent chunk-sharding games.
- Cause: Page-level lazy loading did not isolate optional components mounted inside the shared shell, and CI had no source-owned production-manifest contract.
- Fix or decision: Measure actual raw/gzip artifacts through stable Vite manifest source/name selectors; traverse static imports and CSS once; enforce entry, route, per-chunk, forbidden-static, and required-dynamic budgets; load the assistant only when opened, rich Markdown only when rendered, and report content only when previewed. Keep any supported heavy-renderer exception reasoned, bounded, and expiring.
- Proof: The dashboard closure is 220,257 gzip bytes (approximately 51% lower); all eight versioned closures and both local/Vercel roots pass; six evaluator tests fail the intended regressions; the guarded browser proves before/after module loading and desktop/mobile-width layout; full tests, build, audits, cleanup, and independent review pass.
- Reuse rule: Do not judge client performance from the entry chunk, hashed filenames, or chunk count alone. Govern the static production closure a user actually reaches, verify optional interaction edges, and pair per-chunk limits with route totals so renaming or sharding cannot manufacture a pass.
- Supersedes / related: Extends `LES-030`; `SC-05` owns runtime observability rather than client delivery budgets.

### LES-033 — Production artifact commands must own their build mode

- Date / roadmap step: 2026-07-19 / `SC-04` release
- Context: Hosted CI exports `NODE_ENV=test` for unit safety and then invokes the same `pnpm build` command used for production artifacts.
- Observed: Vite respected the hostile parent value and selected development/test dependency paths, increasing entry gzip from approximately 138 KB to 200 KB and causing every route budget to fail even though the local default build passed.
- Cause: The production build command relied on ambient environment state instead of explicitly selecting the artifact profile it claimed to produce.
- Fix or decision: Make the Vite production-build subprocess set `NODE_ENV=production`; retain the hostile parent for the surrounding CI job and keep every measured budget unchanged.
- Proof: `NODE_ENV=test pnpm build` first reproduced the hosted failure, then passed with the fix at the original 138,121-byte entry and all eight unchanged route ceilings. PR and canonical-main hosted CI, Vercel preview, and exact-SHA production deployment passed.
- Reuse rule: A command that claims to build a production artifact must select production mode itself. Test safety belongs at the test/database boundary; ambient test variables must not silently redefine release artifacts.
- Supersedes / related: Extends `LES-029` and `LES-032`.

### LES-034 — Exact source coordinates must survive the parser boundary

- Date / roadmap step: 2026-07-19 / `DI-01`
- Context: DXF coordinates become numerical authority only after deterministic normalization into checked integer micrometres.
- Observed: Parsing a decimal coordinate into a JavaScript `number` before validation could hide a value just above the 1e9 source limit and could move a value across the half-micrometre rounding boundary.
- Cause: The parser reconstructed decimal text from an already rounded binary floating-point value, so validation and half-away-from-zero conversion no longer operated on source evidence.
- Fix or decision: Preserve and validate exact DXF coordinate lexemes, expand supported exponent notation deterministically, then convert once to `BigInt` micrometres. Reject non-planar coordinates rather than flattening Z.
- Proof: Boundary regressions cover limit bypass, opposite rounding outcomes, exponent forms, nonzero/mixed Z, and deterministic metre/millimetre scaling; the focused geometry/CAD suite passes 55/55.
- Reuse rule: When exact decimal text determines a safety limit, fingerprint, price, quantity, or tolerance result, never pass through binary floating point before validation and canonical conversion.
- Supersedes / related: Extends the deterministic numerical-authority invariant in `AGENTS.md`.

### LES-035 — A schema push does not verify a checked-in migration

- Date / roadmap step: 2026-07-19 / `DI-01`
- Context: DI-01 adds ten tenant-owned tables and expands the accepted geometry domain to areas requiring 19 integer digits.
- Observed: A guarded MySQL suite could pass after `drizzle-kit push` even if migration `0051` itself was missing, stale, or unable to recreate the tested schema.
- Cause: Schema synchronization validated the current TypeScript shape but bypassed the release artifact and its migration journal.
- Fix or decision: Recreate an explicitly named disposable loopback database, run the checked-in migration chain, execute tenant/CAS/domain/compatibility tests, rehearse logical restore, bind the relevant migration/engine/router/UI hashes into evidence, and drop the database afterward.
- Proof: `pnpm test:authorization:mysql` applies migrations to a fresh database, passes 24/24 tests including 64-character identity, 19-digit area, stale replay, review deselection, and restore, then verifies cleanup.
- Reuse rule: Migration acceptance must execute the exact checked-in migration artifact on a fresh safe target; schema push/introspection may supplement but cannot replace that gate.
- Supersedes / related: Extends `LES-029` and `LES-030`.

### LES-036 — Reconciliation reads must stay pure; aggregate refresh belongs to explicit mutations

- Date / roadmap step: 2026-07-19 / `DI-01`
- Context: The legacy space-program read route recalculated room totals and silently wrote `projects.totalFitoutArea`, masking mutation paths that did not refresh the aggregate themselves.
- Observed: Removing the write-on-read correctly restored query purity but revealed that editing a room's `sqm` could leave the legacy aggregate stale until another room mutation occurred.
- Cause: Aggregate consistency depended on a later read side effect rather than the mutation that changed its inputs.
- Fix or decision: Keep `getForProject` read-only. After a successful `sqm` edit, explicitly recompute and write the fit-out aggregate through the existing organization- and authority-aware transactional mutation path; non-area edits do not trigger it.
- Proof: A regression starts with divergent stored and room totals, proves the read performs no write, then proves an area edit persists first and writes the recomputed 15 m² aggregate. Focused tests, the 1,349/22 safe suite, disposable MySQL, audits, build, and independent re-review pass.
- Reuse rule: A reconciliation query may report drift but must never repair it. Every authoritative aggregate refresh must be owned by the explicit mutation that changed its inputs and must recheck authorization/authority at the final write.
- Supersedes / related: Extends the DI-01 compatibility bridge and `LES-030`.

### LES-037 — Authority checks must guard the final derived write

- Date / roadmap step: 2026-07-19 / `DI-01`
- Context: A legacy room mutation recalculates project fit-out area while an administrator can accept canonical geometry concurrently.
- Observed: A route-level authority check could pass, then canonical review could commit before the final aggregate update, allowing a legacy-derived value to land after the authority transition.
- Cause: The room mutation and final project aggregate update used different authorization moments; the aggregate called a generic tenant update rather than the transactionally locked geometry-authority boundary.
- Fix or decision: Route every legacy-derived project area update through `updateProjectWithLegacyGeometryAuthorityForOrg`, which locks the project and authority rows in the same order as canonical review and rejects the final write when canonical wins.
- Proof: A unit regression simulates canonical review winning after route entry; a disposable-MySQL concurrency test queues review and legacy aggregation behind the same project lock, proves review commits first, and proves the aggregate returns `canonical`. Guarded MySQL passes 25/25 with cleanup and current evidence hashes.
- Reuse rule: An early permission or authority check is advisory under concurrency. Every authoritative or derived write must repeat the relevant ownership/version/authority condition inside the final transaction.
- Supersedes / related: Extends `LES-030` and `LES-036`.

### LES-038 — Independent authority must be proven by separate immutable actions

- Date / roadmap step: 2026-07-20 / `BR-02`
- Context: The canonical brief workflow requires independent review, approval, condition resolution, and issue withdrawal authority.
- Observed: Early API shapes allowed a resolver or issuer to name an outcome or independent approver in their own request, which could make separation of duties self-attested rather than evidenced.
- Cause: A single convenient command combined proposal/submission and independent acceptance while the schema claimed an append-only authority history.
- Fix or decision: Model proposal, submission, review, approval, resolution, and withdrawal as separate immutable actor events; later transitions reference the exact prior event and revalidate the independent functional assignment in the final transaction.
- Proof: `BR-02-v1` defines staged finding/condition/applicability/withdrawal operations, exact issue references, and gate-specific Reviewer/Approver acceptance; independent engineering and Claude Opus reviews return `APPROVED`.
- Reuse rule: Never accept a caller-supplied user ID, role label, or outcome as proof of independent authority. Require a separate immutable action by the authorized actor and bind the final transition to that exact event.
- Supersedes / related: Extends `LES-001`, `LES-014`, and `LES-037`; applies to approvals, waivers, compliance findings, releases, and destructive-operation confirmations.

### LES-039 — Readiness display and workflow mutation must share one section DTO

- Date / roadmap step: 2026-07-21 / `BR-03`
- Context: The governed workspace rendered readiness from one query and executed post-draft actions using a separately fetched section binding.
- Observed: A section displayed `Drafted`, yet evidence/review actions reported that no revision existed because `getBriefSection` returned raw `sectionRevisionId` while the client contract consumed `revisionId`.
- Cause: Two server read paths serialized the same canonical binding differently, and static UI/API tests did not execute the authenticated ordered browser transition.
- Fix or decision: Normalize canonical IDs and expose the bound `revisionId` consistently from both section/version reads; retain the real author → evidence → independent review → approval browser gate.
- Proof: The corrected DTO passes targeted 36/36, guarded MySQL 30/30, TypeScript/build/audits, and the authenticated ordered browser journey; Claude Opus independently approved the diff.
- Reuse rule: When multiple queries feed one state machine UI, they must share one typed DTO or aggregate query, and acceptance must execute at least one real ordered transition using each returned identifier.
- Supersedes / related: Extends `LES-038`; `BR-04` owns the typed `brief.getStudio` aggregate that removes this class of client-side joining.

### LES-040 — Governed reference lineage must be resolved by the server

- Date / roadmap step: 2026-07-21 / `BR-04`
- Context: A structured brief revision may cite evidence whose version, observation date, authority, and fingerprint affect readiness and later issue claims.
- Observed: Accepting caller-supplied dependency metadata would let a client forge lineage even if the referenced record ID were valid.
- Cause: A convenient API shape treated evidence identity and authoritative evidence metadata as the same client-owned payload.
- Fix or decision: The client submits only an opaque governed evidence ID, rule, and relevance. The router authorizes the record and derives its exact version, date, fingerprint, authority, and server-resolved marker; persistence rejects any dependency without that proof.
- Proof: Router runtime/contract tests, cross-project and foreign-organization concealment, guarded MySQL, authorization audit, and Claude Opus review pass.
- Reuse rule: Clients may select governed records but must never attest their authority, version, freshness, fingerprint, or tenant scope. Resolve and bind those facts at the final server boundary.
- Supersedes / related: Extends `LES-001`, `LES-014`, and `LES-038`.

### LES-041 — Expensive security tests need one bounded cryptographic behavior each

- Date / roadmap step: 2026-07-21 / `BR-04`
- Context: The safe aggregate suite runs cost-12 bcrypt behavior alongside more than one thousand other tests.
- Observed: A combined registration-and-login test repeatedly crossed the five-second boundary under suite load; its uncancelled completion then polluted the following audit assertion, while the same file passed alone.
- Cause: Two expensive bcrypt operations and two behavior contracts shared one test timeout and mock lifecycle.
- Fix or decision: Keep registration, fixed-hash successful login, rejected login, and legacy hash upgrade as separate tests. Preserve cost and assertions; do not hide the defect by increasing the timeout.
- Proof: The focused auth suite passes 4/4 and the final safe aggregate suite passes 1,424 with 22 skipped.
- Reuse rule: Split expensive cryptographic workflows by behavior and use deterministic valid fixtures where the test is not specifically proving hash creation.
- Supersedes / related: Reaffirms the earlier bcrypt timing lesson recorded for BR-03 certification.

### LES-042 — Governed overrides must be validated at the persistence boundary

- Date / roadmap step: 2026-07-21 / `BR-05`
- Context: Tenant typology overrides are structurally valid JSON but may still reference an unknown room, duplicate a stable rule ID, contradict the base pack, or be replayed by a different actor.
- Observed: Router-only validation lets internal callers persist an override that can never resolve; organization-wide idempotency without actor identity can replay another actor's attributed operation.
- Fix or decision: Validate the exact pinned built-in and merged deterministic result before persistence, revalidate exact fingerprints at resolution, and include actor identity in the canonical idempotency request fingerprint.
- Proof: Guarded disposable MySQL passes 34/34 including invalid-override rejection and cross-actor replay denial; final independent review returned `PASS`.
- Reuse rule: A governed record is not valid merely because its JSON schema parses. Validate the complete authoritative merge at the final write boundary, and bind an idempotency replay to actor, operation, target, and canonical request.

### LES-043 — An official URL is evidence identity, not regulatory authority

- Date / roadmap step: 2026-07-21 / `BR-06`
- Context: Existing ingestion already collected official UAE market and material evidence, while typology packs need exact Dubai regulatory meaning.
- Observed: Reusing an official-source label or a current web page as a rule would lose document edition, clause scope, effective interval, permitted retention, and professional interpretation.
- Cause: Acquisition provenance, source authenticity, temporal applicability, and rule approval are distinct governance decisions that a general evidence record cannot safely collapse.
- Fix or decision: Store regulatory documents in a separate version/capture/clause/relation/assertion model; treat every fetch and AI extraction as a candidate; require exact source fingerprints, locators, temporal resolution, five source assertions, and a separate four-discipline platform release envelope.
- Proof: Regulatory source-integrity, temporal, promotion-negative, privacy, and disposable-MySQL tests pass; production source-authority and pack-release registries remain empty.
- Reuse rule: Never convert an official host, scraper result, or authenticity review directly into a compliance rule. Bind exact immutable source evidence first, then require separately authorized interpretation and release.
- Supersedes / related: Extends `LES-030`, `LES-036`, `LES-038`, and `LES-040`.

### LES-044 — Security policy belongs to the registered regulatory source, not the fetch call

- Date / roadmap step: 2026-07-21 / `BR-06`
- Context: Regulatory retrieval must fail closed across redirects, SSRF, robots, licensing, MIME, size, rate, and timeout boundaries.
- Observed: A per-call URL or policy override would let a caller bypass a trustworthy catalogue entry even if the underlying HTTP implementation were hardened.
- Cause: Transport controls alone do not prove that the requested host, document identity, terms decision, and retention permission were the ones approved by governance.
- Fix or decision: Construct the fetcher from an immutable registered-source map and accept only a source key at retrieval time; use direct pinned HTTPS, exact-host redirects, total deadlines, bounded retries, IPv4/IPv6 private-network rejection, and immutable SHA-256 receipts.
- Proof: Twelve connector-security tests plus catalogue, authorization, TypeScript, full-suite, and generated-serverless verification pass.
- Reuse rule: High-trust acquisition APIs must resolve policy from server-owned immutable registration. Never let request payloads supply the URL, host allowlist, terms status, or retention permission that authorizes their own fetch.
- Supersedes / related: Extends `LES-001`, `LES-014`, and `LES-043`.

### LES-045 — Check-then-act on a shared timestamp is not a rate limit

- Date / roadmap step: 2026-07-22 / `BR-06`
- Context: The regulatory fetcher spaced requests to official government hosts by storing the last request time per host and sleeping for the remainder of the interval.
- Observed: Sequential tests passed, but five concurrent acquisitions with a 1,000 ms interval reached the host at offsets `1005/2005/2005/2006/2006 ms` — four requests inside a single millisecond, a 1,001 ms spread where 4,000 ms was required.
- Cause: The handler read the stored timestamp, then `await`ed, then wrote it. Every concurrent caller observed the same pre-sleep value, computed the same delay, and resumed together; the slot was never reserved across the yield point.
- Fix or decision: Serialize competing acquisitions per host on an independently enqueued promise chain, reserve the next slot inside the exclusive section, fail closed with `TIMEOUT` when the reserved slot lies beyond the operation deadline instead of sleeping into a certain expiry, and release the gate in `finally` so failure, timeout, and cancellation all free the next waiter.
- Proof: Four new gate tests plus the original probe now produce offsets `5007/6009/7009/8010/9011 ms` and a 4,004 ms spread; all thirteen pre-existing fetcher security tests pass unchanged.
- Reuse rule: A limiter whose state is read before an `await` and written after it is not a limiter. Reserve the slot before yielding, and prove it with a concurrent test — a sequential test cannot observe this class of defect.
- Supersedes / related: Extends `LES-044`.

### LES-046 — A hash-pinned evidence contract must be regenerated by the change that edits a hashed file

- Date / roadmap step: 2026-07-22 / `BR-06`
- Context: `pnpm audit:authorization` trusts `.agent/state/TR03H_MYSQL_EVIDENCE.json`, which pins SHA-256 hashes for more than seventy source, test, migration, and script files.
- Observed: A one-line CI timeout change to `scripts/run-guarded-mysql-tests.ts` left its recorded hash stale, and that single mismatch invalidated the whole evidence document — 25 findings, one stale hash plus 24 cascading "integration evidence status drift" rows on unrelated procedures.
- Cause: The hashed file and its evidence document are separate artifacts with no enforcement linking them, so an otherwise correct change silently invalidated an unrelated mandatory check and surfaced only on the next full audit, after the merge.
- Fix or decision: Regenerate evidence exclusively through `pnpm test:authorization:mysql` against a disposable loopback-only target, never by hand-editing a hash or timestamp, and run regeneration last so no pinned file changes afterward. `pnpm check:mysql-evidence` now names drifted pinned files directly, needs no database, and runs in under a second, so the cause is visible before a merge instead of as a cascade after one.
- Proof: The regenerated document matches the actual file hash and the audit returns 389 procedures with zero remediation rows; the disposable database was dropped and its container removed. The guard reports 73 pinned files current, exits 1 naming the exact file when a pinned file is perturbed, and returns to 0 once it is restored.
- Reuse rule: When a check pins file hashes, the hash list is part of the change surface. Before merging, confirm whether an edited file is pinned and regenerate through the approved workflow in the same change. A cascade of unrelated findings usually has one upstream cause — fix that, not the symptoms, and give the cause its own fast check.
- Supersedes / related: Related to `LES-045`.

### LES-047 — Re-run end-to-end certifications when an approved authority change lands, and never discard captured child output

- Date / roadmap step: 2026-07-23 / `KF-019` (TR-13 × DI-01)
- Context: TR-13's browser journey certifies the critical workflow through real HTTP routes on one UI-created project. Owner-approved DI-01 canonical-first made every fresh project start with canonical geometry authority, refusing legacy space-programme writes and failing MQI closed pending finish-scope mapping.
- Observed: `pnpm certify:workflow` failed at `serial-node-browser-journey` with `spaceProgram.generate must succeed` on untouched canonical main while all earlier stages passed; the journey app-server output was piped only into an in-memory secret scan, so the deterministic 409 refusal was invisible from evidence. A separate home→login `auth.me` abort intermittently failed the journey before the critical test ran.
- Cause: DI-01's closure gate list did not include the TR-13 workflow certification, so the certification contract silently pinned superseded product behavior; independently, the harness captured but discarded the only stream that could explain a journey failure.
- Fix or decision: Certification stages that capture process output must persist a sanitized copy in the evidence directory — redacted with the same patterns the secret scan enforces so redacted text cannot re-match — and print a sanitized tail on failure. Expected refusals are asserted through an explicit error-envelope helper, and the journey now certifies the approved canonical-first contract including its approved negatives (legacy 409 CONFLICT, MQI 412 fail-closed).
- Proof: With observability in place the root cause was one server stack line in the persisted log; after the contract update, two consecutive `pnpm certify:workflow` runs PASS with strict cleanup and matching provenance on the same commit lineage that previously failed.
- Reuse rule: When an approved change moves runtime authority or default resource state, list every end-to-end certification touching that surface in the change's closure gates and re-run it in the same change. Never let a harness capture-and-discard child output — persist it sanitized, or the first divergence becomes undiagnosable.
- Supersedes / related: Related to `LES-046` (evidence artifacts are part of the change surface).

### LES-048 — A gate result read through a pipe is not a gate result

- Date / roadmap step: 2026-07-23 / `EV-00`
- Context: Phase gates were run as `command 2>&1 | tail -N` with the exit status echoed afterwards, in a zsh worktree shell.
- Observed: Twice in one session a failing gate reported success: a baseline `pnpm check` "passed" while `tsc` was actually missing (`node_modules` absent), and a failing `pnpm certify:workflow` surfaced as exit 0 because `$?` captured `tail`'s status, not the command's. The false green survived until a later step contradicted it.
- Cause: In a pipeline, `$?` reflects the last stage; truncating output with `tail` also discarded the failure text that would have contradicted the assumed pass.
- Fix or decision: Capture each gate's own exit code before any pipe (`cmd > log 2>&1; code=$?`), keep the complete log on disk, and treat a "pass" whose full output was never persisted as unverified. Batch batteries now run through a step wrapper that records per-step exits.
- Proof: The re-run with per-step exit capture exposed the real `certify:workflow` failure and the design-contract drift that the piped run had hidden; both were then fixed or attributed with evidence.
- Reuse rule: Never assert a verification gate from a piped command's `$?` or a truncated tail. Persist the full log and the command's own exit status, and re-verify any earlier "pass" produced without them.
- Supersedes / related: Extends `LES-004`; complements `LES-047`'s persisted-output rule.

### LES-049 — Attribute a broad-gate failure at the untouched base before treating it as a regression

- Date / roadmap step: 2026-07-23 / `EV-00`
- Context: `pnpm certify:workflow` failed at the TR-13 browser journey (`spaceProgram.generate must succeed`) during the Phase 3 gate, after cost-path changes that plausibly touched adjacent surfaces.
- Observed: The same command failed identically in a detached read-only worktree at the untouched canonical base commit, proving the failure pre-dated the change set; every stage before the browser journey passed on both trees. The harness's secret-scan design pipes and discards the journey server output, so the underlying 500 was not observable from evidence.
- Cause: Broad end-to-end gates depend on environment and canonical-main state; without a base-commit reproduction, a pre-existing failure is indistinguishable from a regression, and an artifact-discarding harness hides the data needed to tell.
- Fix or decision: Reproduce the failing gate at the exact base commit in a disposable worktree before diagnosing the diff; record the pre-existing failure (`KF-019`) with both reproductions and hand root-causing to a bounded follow-up; require the eventual fix to make the journey's server errors observable in evidence.
- Proof: Base commit `8cd7e0a` and the EV-00 tree fail at the same assertion with the same passing prefix stages; `KF-019` records commands, environment, and exit criterion, and the remediation continued under the documented pre-existing-failure provision of the Definition of Done.
- Reuse rule: When a broad certification fails after your change, run it once at the untouched base before touching the diff. If it fails there too, record it as a known failure with both reproductions instead of absorbing it into your change; never claim the gate as green either way.
- Supersedes / related: Extends `LES-030` and `LES-048`; the failure it attributed was later closed by the `KF-019` remediation recorded in `LES-047`.

### LES-050 — "Unreachable" is a symptom, not a diagnosis: check TLS and DNS before declaring a source dead or migrated

- Date / roadmap step: 2026-07-23 / `EV-01b`
- Context: The `EV-01` source packet recorded `dubaipulse.gov.ae` as `ROBOTS_UNAVAILABLE`, inferred the portal "has migrated to `data.dubai`", and recommended repointing the `dubai-pulse-materials` and `dld-transactions` Grade-A connectors at that domain.
- Observed: `www.dubaipulse.gov.ae` resolves (91.73.143.12) and completes a TLS 1.2 handshake presenting a DigiCert certificate for `CN=dubaipulse.gov.ae`, `O=Government of Dubai` — with `Verify return code: 10 (certificate has expired)`. The proposed replacement hosts `data.dubai.gov.ae` and `www.data.gov.ae` do not resolve at all. The site was never retired; the gate was reporting a certificate failure, and the recommended repair would have pointed two Grade-A connectors at a non-existent host.
- Cause: The acquisition gate collapses every pre-fetch failure into one verdict code, and a plausible migration story was accepted without a transport-layer check. A robots verdict cannot distinguish "disallowed", "DNS gone", "certificate expired", and "WAF refusal", but the remediation for each is completely different.
- Fix or decision: Record the failure as a dated external incident on the registry row with the exact `openssl s_client` verdict, keep the URL, deactivate pending renewal, and pin the diagnosis with a test asserting the note says *certificate* and not *migration*. Never relax certificate verification to "fix" an expired-certificate source — that converts an availability problem into a trust problem.
- Proof: `openssl s_client -connect www.dubaipulse.gov.ae:443` returns verify code 10 with a Government of Dubai subject; `dig +short data.dubai.gov.ae` and `dig +short www.data.gov.ae` both return empty; `registry-consistency.test.ts` ("records the Dubai Pulse outage as an expired certificate, not a migration") fails if the wrong story is written back.
- Reuse rule: Before declaring a source dead, moved, or bot-walled, separate the layers — DNS resolves? TLS validates? HTTP status? robots verdict? Write the layer that actually failed into the registry note. A migration claim needs the destination host to resolve before it may be acted on.
- Supersedes / related: Corrects a conclusion in `docs/artifacts/EV-01_SOURCE_CANDIDATE_PACKET.md`; complements `LES-049` (attribute before you remediate).

### LES-051 — Running a typecheck inside a git worktree can shadow a real node package

- Date / roadmap step: 2026-07-23 / `EV-01b`
- Context: The DB-free suite failed on `server/routers/design.contract.test.ts` with `ERR_MODULE_NOT_FOUND: Cannot find package '<worktree>/node_modules/typescript/index.js'`, after the rest of the tree was green.
- Observed: The worktree's `node_modules/` contained exactly two entries — `.vite/` and a `typescript/` directory holding only `tsbuildinfo`. The stub directory shadowed the parent checkout's real `typescript` package, so any test spawning a script that imports `typescript` failed. Deleting the stub restored the test with no code change.
- Cause: `tsconfig.json` sets `tsBuildInfoFile: "./node_modules/typescript/tsbuildinfo"`. In a worktree with no `node_modules` of its own, the first `tsc`/`pnpm check` run creates that path, and Node's resolver then treats the incomplete directory as the package.
- Fix or decision: Treat a bare `node_modules/typescript` containing only `tsbuildinfo` as a build artifact and remove it before running suites that spawn child scripts. Attribute the failure to the environment rather than the diff.
- Proof: `ls node_modules/typescript` showed `tsbuildinfo` alone; `rm -rf node_modules/typescript` turned `design.contract.test.ts` from failing to 4/4 passing with no source change, and the full suite then reported 1,646 passed / 0 failed.
- Reuse rule: In a worktree, a module-resolution failure naming a package under the worktree's own `node_modules` is an artifact of an incremental-build cache path, not a dependency problem. Check what the directory actually contains before installing anything or blaming the change.
- Supersedes / related: Complements `LES-048` (a gate result read through a pipe is not a gate result) — both are false signals from the harness rather than the code.
