# Historical Documentation Archive Policy

## Purpose

MIYAR has extensive phase reports, implementation plans, browser scratchpads, technical blueprints, and handover documents. They preserve valuable design history but often describe different commits, paths, test counts, database counts, providers, or roadmap states.

This directory contains historical build, phase, progress, and version reports after the repository organization migration.

## Existing Historical Collections

- `docs/archive/historical-reports/`: dated/versioned build, phase, progress, and version reports.
- `docs/archive/antigravity-history/`: imported implementation plans, reports, scratchpads, historical blueprints, task files, and supporting research.
- `.agent/archive/`: superseded phase prompts, rules, and workflows.
- Git history: authoritative record of file changes and commits.

## Authority Rule

Historical documents are non-authoritative by default.

They may be used to understand intent, previous implementation, rationale, fixtures, and past verification. They must not override:

1. Current user request and safety policy
2. `AGENTS.md`
3. Active task and selected current loop
4. Live code, configuration, schema, Git state, and command output
5. `docs/PROJECT_STATE.md`
6. Current product, architecture, security, roadmap, and runbooks

## Required Treatment

When using a historical claim:

- Identify the document date/version/commit when available.
- Verify paths and symbols still exist.
- Re-run commands rather than trusting recorded pass counts.
- Treat completed checklists as past evidence only.
- Revalidate database provider, schema count, and migration instructions.
- Never copy credentials, local absolute paths, or production data from scratchpads.
- Resolve conflicts in favor of current evidence.

## New Archive Entries

A completed phase/release report should include:

- Date and commit
- Scope and user outcome
- Files/contracts changed
- Migration and compatibility impact
- Commands and actual results
- Artifact/browser evidence
- Known limitations and open failures
- Links to ADRs and follow-up work

It should clearly state:

```text
Historical snapshot: accurate only for the recorded commit/environment.
Verify against docs/PROJECT_STATE.md and the live repository before use.
```

## Migration Record

The 2026-07-14 organization migration:

1. Moved root `antigravity-history/` to `docs/archive/antigravity-history/` with Git history preserved.
2. Consolidated `docs/reports/` into this directory.
3. Moved completed agent material to `.agent/archive/`.
4. Updated active repository references to the new canonical archive paths.
5. Left historical file contents unchanged; old internal paths are snapshot evidence, not active links.

## Retention

- Preserve accepted ADRs and release/incident evidence.
- Remove empty scratchpads, duplicates, or local artifacts only after owner review.
- Do not retain secrets or personal/production data merely because a file is historical.
- Use Git rather than multiple copied “final” documents for version history.
