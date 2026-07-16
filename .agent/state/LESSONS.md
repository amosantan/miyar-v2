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
