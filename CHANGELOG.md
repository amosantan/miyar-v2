# Changelog

Notable user-facing, architectural, operational, security, data, and compatibility changes are recorded here using `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` categories. Dates use `YYYY-MM-DD`.

Do not fabricate historical releases. Older phase evidence remains in `docs/reports/`, `antigravity-history/`, and Git history.

## Unreleased

### Added

- Canonical `AGENTS.md` contract shared by Codex, Claude Code, and Gemini adapters.
- Closed-loop lifecycle with trigger, scope, verification, retry, recovery, approval, evidence, and terminal-state contracts.
- Human onboarding, product, architecture, roadmap, project-state, verification, security, ownership, contribution, and Definition-of-Done documentation.
- Feature, bug-fix, schema-migration, ingestion, report/visual-QA, and release loops.
- Local-development, database-migration, deployment, rollback, release, incident-response, and ingestion-recovery runbooks.
- ADR policy and initial decisions for documentation authority and deterministic decision logic.
- Canonical active-task, known-failure, and worklog state.
- Historical documentation archive policy.

### Changed

- `CLAUDE.md` imports `AGENTS.md` rather than duplicating project rules.
- `GEMINI.md` is a thin adapter instead of a competing project encyclopedia.
- Legacy guidance defers to current repository evidence and canonical state.
- Documentation authority is separated into durable rules, current facts, roadmap, task state, and history.
- CI uses pnpm and the repository lockfile, provides the correct JWT test variable, and treats type-check, test, and build failures as mandatory failures.

### Fixed

- Removed competing active “single source of truth” claims.
- Replaced stale canonical health claims with directly observed results and exit criteria.

### Security

- Added explicit tenant, secret, upload, public-sharing, ingestion/SSRF, AI prompt-injection, CI/CD, and incident-response requirements.

## Historical Releases

Overlapping historical phase/version reports have not been rewritten here. Consult `docs/VERSION_HISTORY.md`, `docs/reports/`, `antigravity-history/`, and Git log as commit-specific evidence rather than current state.
