# MIYAR

MIYAR is a UAE-focused design-decision intelligence platform for real-estate developers, investors, and design teams. It converts early project information into defensible scoring, space programmes, material quantities, cost intelligence, market comparisons, risk analysis, and board-ready reports.

## Product Outcomes

MIYAR helps a team answer:

- Is the project strategically and financially viable?
- Is the design aligned with its market, typology, location, and tier?
- What spaces and surfaces are in scope for fit-out?
- Which materials are appropriate, what quantities are required, and what will they cost?
- Which evidence supports each benchmark and recommendation?
- How do scenarios compare on cost, risk, sustainability, and return?
- Can the result be shared as a credible investor or design deliverable?

See [Product](docs/PRODUCT.md) for users, boundaries, and product principles.

## Architecture at a Glance

```text
React client
    -> tRPC client
        -> Express/tRPC routers
            -> deterministic and AI-assisted engines
                -> Drizzle data-access layer
                    -> MySQL-compatible database

External services:
Gemini | optional OpenAI transcription | AWS S3 | Google Maps | source ingestion
```

The frontend is a React 19 and TypeScript application built with Vite. The backend is Express with tRPC. Drizzle ORM defines and accesses a MySQL-compatible schema. Deterministic engines own scores, quantities, costs, risk, sustainability, and financial calculations; LLMs are restricted to extraction, suggestions, narratives, and visual direction.

See [Architecture](docs/ARCHITECTURE.md) for the full system map.

## Repository Layout

| Path | Purpose |
|---|---|
| `client/src/` | React pages, components, hooks, contexts, and client utilities |
| `server/routers/` | Authenticated tRPC API surface |
| `server/engines/` | Scoring, intelligence, design, prediction, ingestion, reporting, and learning |
| `server/db.ts` | Database access helpers |
| `drizzle/schema.ts` | Canonical database schema |
| `shared/` | Shared types, constants, and errors |
| `scripts/` | Imports, migrations, backfills, and seeding |
| `docs/` | Current product, architecture, operations, loops, and decisions |
| `.agent/skills/` | Domain instructions loaded on demand |
| `.agent/state/` | Current task, known failures, and handover log |
| `antigravity-history/` | Historical evidence; not current authority |

## Prerequisites

- Node.js 20 or a compatible current version
- `pnpm` matching the repository package-manager declaration
- A MySQL-compatible database for database-backed features
- Service credentials only for the integrations being exercised

## Setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Populate `.env` with development-only credentials. Never commit `.env`, service keys, production exports, or customer data.

The application defaults to `http://localhost:3000`. If that port is busy, the development server searches nearby ports; use the server log as the authoritative URL.

For detailed setup and troubleshooting, see the [local-development runbook](docs/runbooks/local-development.md).

## Standard Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the development server with Vite integration |
| `pnpm check` | Run TypeScript without emitting files |
| `pnpm test` | Run the complete Vitest suite |
| `pnpm vitest run <file>` | Run a targeted test file |
| `pnpm build` | Build client, Node server, and serverless API bundle |
| `pnpm db:push` | Generate and apply Drizzle migrations to the configured target |
| `pnpm format` | Format the repository with Prettier |

Do not apply migrations to a shared environment without explicit authorization. Follow the [database migration runbook](docs/runbooks/database-migration.md).

## Current Health

Repository health changes frequently and must not be copied into multiple files. The canonical observed state is [Project State](docs/PROJECT_STATE.md), and reproduced unresolved failures are tracked in [.agent/state/KNOWN_FAILURES.md](.agent/state/KNOWN_FAILURES.md).

## Engineering Workflow

All coding agents and contributors follow:

1. [AGENTS.md](AGENTS.md) — canonical engineering contract.
2. [Loop Engineering](LOOP_ENGINEERING.md) — task lifecycle and terminal states.
3. The appropriate specialized loop under `docs/loops/`.
4. [Verification](docs/VERIFICATION.md) — evidence and Definition of Done.
5. Operational runbooks for migrations, deployments, rollbacks, and incidents.

Claude Code loads [CLAUDE.md](CLAUDE.md), which imports `AGENTS.md`. Gemini loads [GEMINI.md](GEMINI.md), which points to the same canonical contract.

Contributor workflow is defined in [CONTRIBUTING.md](CONTRIBUTING.md), notable changes in [CHANGELOG.md](CHANGELOG.md), and role-based responsibility and approvals in [Ownership](docs/OWNERSHIP.md).

## Documentation Authority

Current authority is deliberately separated:

- Permanent agent rules: `AGENTS.md`
- Product definition: `docs/PRODUCT.md`
- Current architecture: `docs/ARCHITECTURE.md`
- Current verified facts: `docs/PROJECT_STATE.md`
- Current/future priorities: `docs/ROADMAP.md`
- Security and data handling: `docs/SECURITY.md`
- Ownership and approval roles: `docs/OWNERSHIP.md`
- Active long-running task: `.agent/state/CURRENT_TASK.md`
- Historical evidence: Git, `docs/reports/`, and `antigravity-history/`

Historical reports may contain old paths, commands, test counts, or roadmap states. They must be verified against the current checkout before use.

## Security

Read [Security](docs/SECURITY.md) before changing authentication, authorization, public sharing, uploads, ingestion, AI integrations, secrets, or database behavior. Suspected security incidents follow the [incident-response runbook](docs/runbooks/incident-response.md).

## Deployment

Deployment is human-gated. Follow the [deployment](docs/runbooks/deployment.md), [release](docs/runbooks/release.md), and [rollback](docs/runbooks/rollback.md) runbooks. A passing local build alone does not authorize a production release.
