# Local Development Runbook

## Purpose

Set up and run MIYAR locally without exposing secrets, mutating the wrong database, or confusing environment failures with product defects. Ordinary local checks and tests are database-free unless a guarded disposable-database workflow is deliberately selected.

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

### Profiles and database targets

- `MIYAR_RUNTIME_PROFILE`: process/deployment execution profile. Omit it for the safe `local` default, use `test` for test commands, `preview` only for an approved preview deployment, and `production` only in the deployment environment. Safety controls are captured before dotenv and values placed in `.env` are ignored; do not infer the profile from a database hostname or `NODE_ENV`.
- `DATABASE_URL`: loopback or disposable local database only for local application workflows. A local server still uses its configured target for ordinary API requests.
- `TEST_DATABASE_URL`: separately named disposable target for guarded database-integration commands only; it is never a fallback for `pnpm test`.
- `JWT_SECRET`: unique development secret
- `PORT`: optional; defaults to 3000

Loopback URL examples are provided in `.env.example`. That file contains placeholders only. It must not contain `MIYAR_RUNTIME_PROFILE`, a shared URL, credential, remote-database approval binding, or managed-preview target binding.

### Profile matrix

| Profile | Intended use | Database posture | Workers |
| --- | --- | --- | --- |
| `local` | Developer application workflow | Loopback/disposable target only; remote target fails closed | Disabled unless an approved isolated workflow explicitly opts in |
| `test` | Unit and integration verification | Ordinary tests are database-free; guarded integration names a disposable `TEST_DATABASE_URL` | Disabled |
| `preview` | Approved preview deployment | Deployment-provided, explicitly identified target only | Disabled by default; enable only with approved operational scope |
| `production` | Production deployment | Deployment secret-manager target only | Enabled according to production operational configuration |

Trusted production automatically authorizes only application serving and scheduled ingestion. Manual migration, reset, seed, backfill, or import commands still require an exact command-scoped target binding and the applicable human approval. A managed preview binding authorizes application serving only; preview ingestion and other mutation commands remain separately bound and gated.

Never select `preview` or `production` merely to bypass a local safety guard.

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

1. Inspect the selected `MIYAR_RUNTIME_PROFILE`, database host, and database/branch name without printing credentials.
2. Confirm that local/test targets are loopback or disposable. A profile label never makes a remote target safe.
3. Check the current Git branch and worktree.
4. Identify untracked migrations or exports and preserve them.

### Remote/shared database exception

Do not place remote approval in `.env`, `.env.example`, shell startup files, scripts, or source control. A remote/shared database can be contacted only when all of the following are true:

1. A named human has authorized the exact target and operation.
2. The invoking command deliberately selects the applicable profile.
3. The binding is supplied only to that command as `MIYAR_DATABASE_APPROVAL=sorted-operation-list@host:port/database`, for example `MIYAR_DATABASE_APPROVAL=serve+ingest@dev.example:3306/miyar_dev <approved-command>`. The approved operation list and target must exactly match the command and remote target.
4. The operation's own human gates are satisfied; remote acknowledgement does not authorize a migration, seed/reset, backfill, worker run, or production write.

Do not copy the example binding into a persistent environment file. It is an acknowledgement of one approved operation/target pair, not a credential or broad permission. An optional `MIYAR_DEPLOYMENT_DATABASE_TARGET=host:port/database` binding is reserved for an approved managed preview deployment; it too must be supplied outside `.env` and requires infrastructure approval.

## Start the Application

```bash
pnpm dev
```

The server prefers `PORT` and searches nearby ports if occupied. Use the logged URL rather than assuming port 3000. Before authenticated or data-mutating browser work, verify the selected profile and target again.

Background ingestion, learning, and alert workers are disabled outside production by default. Do not set `ENABLE_BACKGROUND_JOBS=true` in `.env`; use it only for an approved isolated workflow and never against a shared target without separate authorization.

## Baseline Checks

For a fresh task, choose the smallest relevant baseline:

```bash
pnpm check
pnpm vitest run path/to/relevant.test.ts
pnpm test
pnpm build
```

`pnpm test` is the DB-free test path. Do not provide `DATABASE_URL`, `TEST_DATABASE_URL`, remote approval, or worker opt-in to ordinary tests. Current known repository failures are documented in `.agent/state/KNOWN_FAILURES.md`. Reproduce them; do not report the suite as green.

### Guarded database integration

Use the repository's guarded MySQL command only with an isolated, disposable `TEST_DATABASE_URL`; it rejects a caller-provided application `DATABASE_URL`. Confirm the target identity before invoking it and preserve its cleanup/recovery evidence. This integration path is distinct from the DB-free suite.

```bash
TEST_DATABASE_URL="mysql://...@127.0.0.1:3306/miyar_test" pnpm test:authorization:mysql
```

The URL above is a shape-only example. Never paste shared credentials into a terminal history, task record, or issue.

## Database Changes

Do not run migration, seed, reset, import, or backfill commands until target identity is confirmed. Loopback is not a waiver: destructive or shared-target operations require the approval gates in `AGENTS.md` and the applicable runbook. Follow `docs/runbooks/database-migration.md`.

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
