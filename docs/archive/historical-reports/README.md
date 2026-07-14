# Historical Documentation Archive Policy

## Purpose

MIYAR has extensive phase reports, implementation plans, browser scratchpads, technical blueprints, and handover documents. They preserve valuable design history but often describe different commits, paths, test counts, database counts, providers, or roadmap states.

This directory establishes the archive policy without moving legacy files and breaking existing references.

## Existing Historical Collections

- `docs/reports/`: dated/versioned build and phase reality reports.
- `antigravity-history/`: implementation plans, reports, scratchpads, historical blueprints, task files, and supporting research.
- `.agent/prompts/` and older `.agent/workflows/`: phase-specific execution material; current only when explicitly selected and revalidated.
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

## Migration Policy

Legacy files may be physically moved into this directory only in a dedicated documentation migration that:

1. Builds a path/reference inventory.
2. Updates internal links and tooling references.
3. Preserves Git history or provides an index mapping old to new paths.
4. Scans for credentials and sensitive data.
5. Verifies active agent instructions no longer import them implicitly.

Until then, their current locations are intentional compatibility archives.

## Retention

- Preserve accepted ADRs and release/incident evidence.
- Remove empty scratchpads, duplicates, or local artifacts only after owner review.
- Do not retain secrets or personal/production data merely because a file is historical.
- Use Git rather than multiple copied “final” documents for version history.
