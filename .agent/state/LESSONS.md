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
