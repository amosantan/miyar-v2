# Contributing to MIYAR

## Start Here

Read `AGENTS.md`, `README.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STATE.md`, `docs/VERIFICATION.md`, `docs/SECURITY.md`, and the relevant loop/runbook before changing the repository. Historical reports are not current instructions unless explicitly selected and reverified.

## Development Setup

Follow `docs/runbooks/local-development.md`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Use development-only credentials and databases. Never commit `.env`, tokens, production exports, customer data, office lock files, or generated local artifacts.

## Select the Correct Loop

| Work | Loop |
|---|---|
| New behavior | `docs/loops/feature.md` |
| Defect or failing check | `docs/loops/bugfix.md` |
| Schema/data-shape change | `docs/loops/schema-migration.md` |
| Source/connector/data refresh | `docs/loops/ingestion.md` |
| Report, PDF, DOCX, share, visual | `docs/loops/report-visual-qa.md` |
| Shared/production release | `docs/loops/release.md` |

Persist long-running work in `.agent/state/CURRENT_TASK.md`.

## Branch and Worktree Practice

- Inspect Git branch, status, diff, and recent history first.
- Preserve unrelated modifications and untracked files.
- Use a scoped review branch for material work.
- Do not push directly to protected branches without explicit authorization.
- Do not stage, commit, push, merge, deploy, migrate, or publish unless authorized.
- Never use destructive cleanup/reset commands on user work.

## Change Design

- Start from the observable user or operational outcome.
- Define non-goals and testable acceptance criteria.
- Reuse established architecture and contracts.
- Keep authoritative calculations deterministic.
- Enforce authentication, authorization, validation, and tenancy server-side.
- Preserve provenance, units, qualifiers, and version identity.
- Avoid unrelated refactors.
- Create an ADR for durable architecture decisions.

## Code Conventions

- TypeScript is strict; avoid unbounded `any` in domain contracts.
- New API inputs use explicit validation.
- Database access uses established helpers and organization scope.
- Schema definitions live in `drizzle/schema.ts`.
- Shared cross-layer types live under `shared/`.
- Client code does not duplicate authoritative server calculations.
- LLM output is validated, qualified, and never numerical authority.
- Tests should prove behavior and catch the old defect/absence when practical.

## Verification

Use `docs/VERIFICATION.md`:

```bash
pnpm check
pnpm vitest run <affected-test-file>
pnpm test
pnpm build
```

UI work needs browser verification. Reports need final rendering inspection. Schema work needs safe-target integrity and recovery evidence. Ingestion needs quality, provenance, idempotency, and partial-failure evidence.

Never use `|| true` on mandatory gates, weaken tests solely to get green output, call a failing suite successful, or update state from expectation instead of evidence.

## Commit and Review Expectations

A reviewable change includes the problem/outcome, scope/non-goals, changed contracts, actual verification results, browser/artifact/migration evidence, security/tenant/data/numerical considerations, known failures, remaining risks, approvals, and rollout/rollback notes.

Use concise conventional commit types such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `data:`, or `chore:`. Describe verified behavior rather than only a phase number.

## Review Checklist

- [ ] Request and acceptance criteria are satisfied.
- [ ] Diff contains no unrelated/user-owned files.
- [ ] Contracts and compatibility are intentional.
- [ ] Authentication/authorization and tenant scope are correct.
- [ ] Numerical/data/provenance behavior is defensible.
- [ ] Error, empty, invalid, and insufficient states exist.
- [ ] Tests catch meaningful regression.
- [ ] Applicable checks and artifacts were directly verified.
- [ ] Secrets/customer data are absent.
- [ ] ADR/docs/runbooks/state changed only where reality changed.

## Security and Documentation

Do not disclose exploitable details or secrets publicly. Follow `docs/SECURITY.md` and `docs/runbooks/incident-response.md`.

One fact has one owner: permanent rules in `AGENTS.md`; verified changing facts in `docs/PROJECT_STATE.md`; priorities in `docs/ROADMAP.md`; active state under `.agent/state/`; completed/history in Git, `CHANGELOG.md`, release records, or archives.
