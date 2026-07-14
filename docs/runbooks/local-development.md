# Local Development Runbook

## Purpose

Set up and run MIYAR locally without exposing secrets, mutating the wrong database, or confusing environment failures with product defects.

## Prerequisites

- Git
- Node.js 20 or a repository-compatible current version
- `pnpm` compatible with the `packageManager` declaration
- Access to a development database for database-backed workflows
- Optional development credentials for the integrations being tested

## Initial Setup

```bash
git status --short
pnpm install --frozen-lockfile
cp .env.example .env
```

Populate `.env` with development-only values. Confirm `.env` is ignored before adding credentials.

### Minimum configuration

- `DATABASE_URL`: development database only
- `JWT_SECRET`: unique development secret
- `PORT`: optional; defaults to 3000

### Feature-specific configuration

- `GEMINI_API_KEY`: AI extraction, narratives, recommendations, and related tests
- `OPENAI_API_KEY`: optional voice transcription
- AWS variables: upload and generated-asset flows
- `GOOGLE_MAPS_API_KEY`: location/geocoding features
- Email provider key: notification delivery
- Scraping provider credentials: ingestion fallbacks

Do not use production credentials for routine local development.

## Verify Environment Identity

Before database or ingestion work:

1. Inspect the database host and database/branch name without printing credentials.
2. Confirm it is disposable or explicitly approved for development.
3. Check the current Git branch and worktree.
4. Identify untracked migrations or exports and preserve them.

## Start the Application

```bash
pnpm dev
```

The server prefers `PORT` and searches nearby ports if occupied. Use the logged URL rather than assuming port 3000.

## Baseline Checks

For a fresh task, choose the smallest relevant baseline:

```bash
pnpm check
pnpm vitest run path/to/relevant.test.ts
pnpm test
pnpm build
```

Current known repository failures are documented in `.agent/state/KNOWN_FAILURES.md`. Reproduce them; do not report the suite as green.

## Database Changes

Do not run migration commands until target identity is confirmed. Follow `docs/runbooks/database-migration.md`.

## Useful Inspection Commands

```bash
git branch --show-current
git status --short
git log -5 --oneline
rg --files client/src server shared drizzle
```

Use `rg` for repository search. Avoid commands that rewrite or delete unrelated files.

## Troubleshooting

### Database connection failure

- Confirm the development branch/host exists and is awake.
- Verify SSL/provider requirements.
- Do not change application query logic to work around a credential or sleeping-branch failure.

### Missing AI key

- Confirm whether the workflow truly requires AI.
- Deterministic engines and their tests should remain runnable without an AI key.
- AI-dependent tests must declare prerequisites or use bounded mocks/fixtures.

### Port conflict

- Read the server log for the selected port.
- Stop an unintended stale development server when safe.

### TypeScript or test failures

- Compare against `.agent/state/KNOWN_FAILURES.md`.
- Reproduce with a targeted command.
- Follow `docs/loops/bugfix.md`; do not add broad suppressions.

### Build succeeds while checks fail

A build does not override red type/test gates. Record each gate independently.

## Shutdown and Cleanup

- Stop development processes normally.
- Do not delete user-owned untracked files.
- Remove only artifacts created by the current task and understood to be disposable.
- Never commit `.env`, generated credentials, local database exports, lock files from office applications, or transient Vite/Vitest timestamp files.

## Handover

For multi-session work, update `.agent/state/CURRENT_TASK.md` and append one concise row to `.agent/state/WORKLOG.md` with commands, terminal state, unresolved risks, and next action.
