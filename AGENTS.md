# MIYAR Agent Contract

This is the canonical repository instruction file for coding agents. It governs Codex directly and Claude Code through `CLAUDE.md`.

## Mission

MIYAR is a UAE design-decision intelligence platform for real-estate developers, investors, and design teams. It converts project intent into defensible scoring, market intelligence, space programmes, material quantities, costs, risks, and board-ready outputs.

Optimize for correctness, evidence, tenant safety, and reproducibility before speed.

## Instruction Precedence

When instructions or facts conflict, use this order:

1. Runtime safety policies and the user's current request.
2. This `AGENTS.md` and any more specific nested `AGENTS.md`.
3. The active task file in `.agent/state/CURRENT_TASK.md`.
4. The selected loop under `docs/loops/`.
5. Live code, configuration, database schema, Git state, and command output.
6. `docs/PROJECT_STATE.md` and `.agent/state/KNOWN_FAILURES.md`.
7. Current product and architecture documentation.
8. Historical material under `docs/archive/` and `.agent/archive/`.

Never trust recorded test counts, table counts, phase status, or build status without verifying them from the current checkout. Live commands and code override historical documentation.

## Product Invariants

- Numerical scoring, pricing, aggregation, thresholds, quantities, and grades must remain deterministic TypeScript.
- LLMs may extract, translate, suggest, and generate narrative or visual direction; they must not become numerical authority.
- UAE context is the default: AED, local sources, local regulations, and local market conditions.
- Every material cost, benchmark, and investment claim must expose provenance or a clearly labelled assumption.
- Organization-scoped data must use the established organization authorization boundary. Never weaken tenant isolation.
- Explicit developer inputs must not be silently overwritten by AI suggestions.
- Scoring logic changes require regression coverage and explainability checks.
- Public share views must remain read-only, token-gated, and expiry-aware.
- Reports must retain document identity, disclaimer, reproducibility, and evidence information.

## Authoritative Documentation Map

- Product purpose and boundaries: `docs/PRODUCT.md`
- Current system architecture: `docs/ARCHITECTURE.md`
- Current/future priorities: `docs/ROADMAP.md`
- Dependency-ordered execution ledger: `.agent/state/ROADMAP.md`
- Verified changing facts: `docs/PROJECT_STATE.md`
- Verification and Definition of Done: `docs/VERIFICATION.md`
- Security and data handling: `docs/SECURITY.md`
- Ownership and approval roles: `docs/OWNERSHIP.md`
- Durable decisions: `docs/decisions/`
- Task loops: `docs/loops/`
- Operational procedures: `docs/runbooks/`

## Architecture Boundaries

- `client/src/` renders and orchestrates interaction; it does not own authoritative calculations or authorization.
- `server/routers/` authenticates, authorizes, validates, and coordinates; large calculations belong in engines.
- `server/engines/` owns domain behavior, with deterministic code separated from AI assistance.
- `server/db.ts` and established data helpers own database access; `drizzle/schema.ts` owns schema shape.
- `shared/` owns cross-layer contracts and constants.

## Repository Map

- `client/src/`: React application, pages, components, hooks, and browser behavior.
- `server/routers/`: tRPC API boundary.
- `server/engines/`: deterministic, AI-assisted, predictive, design, ingestion, and reporting engines.
- `server/db.ts`: database access helpers.
- `drizzle/schema.ts`: canonical MySQL-compatible schema.
- `shared/`: shared types and constants.
- `scripts/`: migrations, imports, backfills, and seed operations.
- `.agent/skills/`: domain-specific reference instructions; load only when relevant.
- `docs/loops/`: repeatable task loops.
- `docs/runbooks/`: operational procedures.
- `.agent/state/`: current task, reproduced failures, and concise handovers.
- `.agent/state/ROADMAP.md`: canonical step order, status, dependencies, gates, and next executable step.
- `.agent/state/LESSONS.md`: append-only reusable lessons proven during execution.
- `docs/PROJECT_STATE.md`: canonical verified repository facts.
- `docs/archive/`: historical evidence only; never use as current authority.
- `docs/artifacts/`: approved project briefs, reports, and business artifacts; verify sensitivity before committing.

## Standard Commands

Use the package manager declared by the repository: `pnpm`.

- Install: `pnpm install --frozen-lockfile`
- Develop: `pnpm dev`
- Type-check: `pnpm check`
- Test: `pnpm test`
- Targeted test: `pnpm vitest run <test-file>`
- Build: `pnpm build`
- Generate and apply migrations: `pnpm db:push`

Do not claim a command passes unless it was run successfully in the current checkout. Never convert a failing mandatory check into a warning to obtain a green result.

## Start-of-Task Protocol

1. Read `AGENTS.md`, `docs/PROJECT_STATE.md`, `.agent/state/KNOWN_FAILURES.md`, `.agent/state/ROADMAP.md`, and `.agent/state/LESSONS.md`.
2. Inspect `git status`, the current branch, recent commits, and relevant code.
3. Classify the task using `LOOP_ENGINEERING.md`.
4. Select the single next executable roadmap step and create a bounded task in `.agent/state/CURRENT_TASK.md` when work spans multiple steps or sessions.
5. Read only the relevant domain skill, loop, runbook, and specification.
6. Establish a baseline with the smallest relevant verification command.
7. Record assumptions that could affect architecture, data, security, or product behavior.

Do not overwrite, discard, or reformat unrelated user changes.

## Change Protocol

- Make the smallest coherent change that satisfies the acceptance criteria.
- Preserve public contracts unless the task explicitly authorizes a breaking change.
- Add or update tests for behavior changes.
- Do not weaken tests, delete assertions, or add broad ignores without an explicit documented reason.
- New tRPC inputs must be validated. Organization data must use the established protected procedure.
- Database access belongs in established data-access helpers, not ad hoc client or route code.
- Schema changes require a generated migration, forward verification, and a rollback or restore plan.
- Avoid unrelated refactors during fixes.
- Never commit secrets, credentials, production data, temporary exports, or machine-local artifacts.

## Git and Worktree Rules

- Inspect branch, status, diff, and recent history before editing.
- Treat all existing modified and untracked files as user-owned unless proven otherwise.
- Never discard changes with destructive Git commands without explicit authorization.
- Use a review branch for material work; do not push directly to a protected branch unless explicitly requested and permitted.
- Do not stage, commit, push, merge, deploy, or open a pull request unless the task authorizes that action.
- Keep commits scoped and describe verified behavior, not aspirational completion.

## Verification and Definition of Done

Use `docs/VERIFICATION.md`. A task is `PASS` only when:

- Every acceptance criterion has objective evidence.
- Relevant targeted tests pass.
- Required broader checks pass, or pre-existing failures are reproduced and documented without regression.
- The diff has been reviewed for correctness, security, tenant isolation, and unintended scope.
- User-facing changes have appropriate browser, visual, or report-render verification.
- Data and schema changes have integrity and recovery evidence.
- Documentation and current-state records changed only where reality changed.
- The worktree contains no unexplained agent-created artifacts.

Writing code, updating a checkbox, or reaching a test-count target is not completion.

## Human Approval Gates

Stop with `NEEDS_HUMAN` unless the user's task clearly authorizes the action:

- Production deployment, rollback, or infrastructure mutation.
- Applying migrations or writes to shared/production databases.
- Destructive data operations or secret/key rotation.
- Changing scoring weights, decision thresholds, financial assumptions, or compliance policy.
- Adding a production dependency with material security, licensing, or cost impact.
- Breaking API/schema changes or deletion of supported behavior.
- Sending external messages, publishing reports, merging, or pushing directly to protected branches.

Local migration generation, tests, builds, and reversible implementation work are allowed when in scope.

## Loop Control

- Default implementation retry budget: 3 evidence-based attempts per failure class.
- Every network, provider, ingestion, migration, build, and long-running command needs an explicit or tool-bounded timeout; no operation may retry indefinitely.
- Define a task time/resource budget when work is scheduled or autonomous, and stop with evidence when it is exhausted.
- After each failed attempt, update the hypothesis; do not repeat the same change unchanged.
- If the same blocker persists after 3 attempts, stop as `BLOCKED` with evidence and the smallest requested decision.
- Stop immediately for possible data loss, secret exposure, tenant-boundary risk, or ambiguous irreversible action.
- Terminal states are `PASS`, `FAILED`, `BLOCKED`, `NEEDS_HUMAN`, or `CANCELLED`.

## State and Handover

- `.agent/state/CURRENT_TASK.md`: one active task, its acceptance criteria, status, and next action.
- `.agent/state/ROADMAP.md`: canonical ordered steps, dependencies, human gates, status, and exactly one next executable step.
- `docs/PROJECT_STATE.md`: verified repository facts and the date/commit at which they were observed.
- `.agent/state/KNOWN_FAILURES.md`: reproducible failures with evidence, owner/status, and exit criterion.
- `.agent/state/LESSONS.md`: append-only proven issues, causes, fixes, evidence, and reuse rules.
- `.agent/state/WORKLOG.md`: concise append-only handover entries for material multi-session work.
- Git history remains the authoritative change timeline.

Do not duplicate changing statistics across instruction files. Update one canonical state file and link to it.

Use `docs/runbooks/roadmap-execution.md` to start, close, block, or hand over roadmap steps. A completed step must update the roadmap, current task, worklog, and any proven lessons in the same verified change.

## Domain Routing

Before specialized work, read the matching skill:

- Materials, MQI, surface areas: `.agent/skills/miyar-materials/SKILL.md`
- Scoring and explainability: `.agent/skills/miyar-scoring/SKILL.md`
- Intake and multimodal analysis: `.agent/skills/miyar-intake/SKILL.md`
- Ingestion and connectors: `.agent/skills/miyar-ingestion/SKILL.md`
- Analytics: `.agent/skills/miyar-analytics/SKILL.md`
- Sales premium and yield: `.agent/skills/miyar-sales-premium/SKILL.md`

Use `LOOP_ENGINEERING.md` for the complete lifecycle and `docs/loops/LOOP_TEMPLATE.md` for new repeatable loops.

## Historical Document Policy

- `docs/archive/` and `.agent/archive/` contain historical reports, completed phase prompts, old workflows, and imported evidence.
- Never treat their paths, commands, providers, counts, checklist status, or roadmap statements as current without re-verification.
- Historical content cannot override `AGENTS.md`, current documents, or live repository evidence.
- Follow `docs/archive/historical-reports/README.md` before moving, deleting, or relying on archived material.
