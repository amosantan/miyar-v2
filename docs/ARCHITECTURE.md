# MIYAR System Architecture

## Scope and Authority

This document describes the current intended architecture. Verify implementation details against the live checkout before high-risk changes. Architectural decisions that materially change these boundaries require an ADR under `docs/decisions/`.

## System Context

```text
Project users and administrators
        |
        v
React web application
        |
        v
tRPC over Express (/api/trpc)
        |
        +---------------------+
        |                     |
        v                     v
Domain routers          Core platform services
        |                auth, audit, rate limit,
        |                notifications, storage
        v
Domain engines
        |
        +----------+-----------+------------+
        |          |           |            |
        v          v           v            v
Deterministic   AI-assisted   Ingestion   Report/artifact
calculation     extraction    pipelines    generation
        |          |           |            |
        +----------+-----------+------------+
                           |
                           v
                  Database access layer
                           |
                           v
                 MySQL-compatible database
```

## Deployment Topology

The repository supports two backend entry patterns:

- `server/_core/index.ts`: full Node/Express server, Vite integration in development, static serving in production, scheduled services, SSE, cron endpoint, and tRPC.
- `server/serverless/index.ts`: serverless Express/tRPC source entry compiled to `api/index.js` for Vercel-style deployment.

The client builds from `client/` through Vite. Generated output goes to `dist/`, with paths adjusted for the deployment environment.

## Frontend

### Technology

- React 19 and TypeScript
- Vite
- Wouter routing
- TanStack React Query and tRPC client
- Tailwind CSS and shadcn/Radix components
- Recharts for analytical visualizations
- React Hook Form and Zod-based validation where implemented

### Organization

- `client/src/App.tsx`: route registry and route guards.
- Pages and the authenticated dashboard shell are loaded at route boundaries so specialist design, administration, and visualization dependencies do not block public/login startup.
- `client/src/pages/`: project, scenario, report, portfolio, market-intelligence, sustainability, customer-success, and administration views.
- `client/src/components/`: reusable product and domain components.
- `client/src/components/ui/`: shared UI primitives.
- `client/src/lib/trpc.ts`: API client integration.
- `client/src/contexts/`: application context such as theming.

### Frontend Boundaries

- The client renders and orchestrates interaction; it must not become authoritative for scoring, cost, quantity, access control, or benchmark governance.
- Server authorization must be enforced even when routes are visually guarded.
- Sensitive organization data must never be embedded into public bundles or public share responses.
- User-facing numerical displays must retain units, currency, assumptions, and insufficient-data states.
- New top-level routes must remain lazily imported unless a measured startup requirement justifies eager loading.

## API and Router Layer

`server/routers.ts` composes the tRPC application router. Domain routers cover system/auth, projects, scenarios, administration, design, market intelligence, ingestion, analytics, prediction, learning, autonomy, organizations, economics, bias, portfolio, sustainability, intake, material quantities, and space programmes.

### Router Responsibilities

- Authenticate and authorize.
- Validate input.
- Establish organization/project ownership.
- Invoke domain/data functions.
- Shape stable response contracts.
- Write audit evidence where required.

Routers should not contain large calculation engines or duplicate database logic.

## Core Platform Services

`server/_core/` contains cross-cutting infrastructure:

- Context and tRPC procedures
- Authentication, OAuth, cookies, and two-factor support
- Environment access
- LLM and image-generation clients
- Voice transcription
- Logging, error capture, auditing, and rate limiting
- Notifications and server-sent events
- API documentation and Vite/static integration

Core services must fail explicitly when required configuration is unavailable. Optional integrations must expose degraded states without corrupting primary deterministic flows.

## Domain Engine Architecture

### Deterministic decision engines

Scoring, normalization, five-lens analysis, pricing, material quantities, scenario calculations, ROI, risk, sustainability, predictive distributions, and analytics are implemented as deterministic TypeScript where possible.

Properties:

- Typed inputs and outputs
- Version-aware logic and benchmarks
- Pure or mostly pure calculation functions
- Fixture-driven tests
- Explicit fallbacks and confidence states
- No LLM authority over numerical results

### AI-assisted engines

Gemini-backed functions support:

- Unstructured/multimodal intake extraction
- Design recommendations and narratives
- Material-allocation suggestions
- Trend and evidence synthesis
- Supplier-page extraction
- Visual direction and image generation

AI outputs are proposals or content. Validate structure, preserve provenance, handle parse failure, and keep numerical decisions in deterministic code.

### AI media-operation boundary

Customer-facing media reaches an AI provider only through the server-owned media boundary in `server/_core/`. The browser receives a short-lived signed S3 `PUT` URL, then the server reads the uploaded object, validates its actual bytes, derives MIME type/size/SHA-256 checksum, and only then persists it or sends it to a provider. Client MIME labels, sizes, object paths, URLs, and asset-type labels are never authoritative.

PNG, JPEG, and WebP are decoded with Sharp and bounded by byte and pixel limits. PDFs are checked with the PDF parser; audio and video require matching supported container signatures. Invalid, unsupported, empty, unavailable, and oversized media stops before an AI call. Validated larger images and PDFs/audio/video use Gemini's temporary Files API; the boundary polls only to its fixed deadline and attempts provider-file cleanup in `finally`.

`server/_core/ai-operation.ts` defines the shared failure taxonomy, retryability, safe customer message, and correlation ID. Provider details are structured telemetry only. Customer surfaces receive a safe MIYAR message and reference ID, never a provider response, stack trace, key, temporary URL, or raw exception. Architecture-contract tests keep direct Gemini REST usage confined to the shared operation boundary and prohibit designated customer surfaces from rendering raw operation errors.

### Ingestion and intelligence

The ingestion subsystem contains connectors, crawling, extraction, normalization, verification, change detection, orchestration, scheduling, health, and audit behavior.

The intended flow is:

```text
Source registry
 -> connector/crawler
 -> raw capture and audit
 -> extraction
 -> normalization
 -> quality/reliability checks
 -> evidence records
 -> governed proposal
 -> approved benchmark/intelligence
```

No ingestion failure should silently produce authoritative data.

### Learning and adaptation

Outcome comparison, accuracy ledgers, calibration suggestions, pattern extraction, and weight analysis create governed recommendations. They must not silently rewrite published scoring logic or historical evaluations.

## Data Architecture

### Canonical schema

`drizzle/schema.ts` defines the application schema with Drizzle `mysqlTable` declarations. Migration SQL and metadata live under `drizzle/`.

Major data domains include:

- Users, organizations, membership, and invitations
- Projects, assets, scenarios, scores, intelligence, reports, and outcomes
- Benchmarks, versions, categories, sources, evidence, proposals, and snapshots
- Competitors, trends, ingestion runs, connector health, and alerts
- Materials, boards, finish schedules, allocations, suppliers, and visuals
- Space programmes and amenity sub-spaces
- Prediction, simulation, risk, bias, sustainability, ROI, and portfolio data
- Audit, overrides, logic registry, prompts, models, and learning records
- DLD project, transaction, rent, and area benchmark data

### Data rules

- Every organization-owned query enforces organization scope.
- Versioned results retain the logic/benchmark identity used at calculation time.
- Source-derived data retains capture, provenance, reliability, and freshness metadata.
- JSON fields require stable typed contracts at the application boundary.
- Financial values must define currency and unit.
- Schema changes follow `docs/runbooks/database-migration.md`.

## Authentication and Authorization

Authentication uses server-issued session/JWT behavior with cookie handling. Organization membership scopes protected data. Public sharing uses separate token-based read-only access.

Security invariants:

- Client route guards are not authorization.
- Project access checks include organization ownership.
- Project, child-resource, organization-resource, and public-share resolution follows `docs/security/AUTHORIZATION_CONTRACT.md`.
- Admin procedures enforce role, not only authentication.
- Public share tokens are high entropy, scoped, expiring, and revocable where supported.
- Authentication and authorization changes require negative-path and cross-tenant tests.

## Reports and Artifacts

Report engines generate HTML/PDF-oriented content, DOCX documents, material boards, investor outputs, and other artifacts. S3 may store uploaded or generated assets.

Artifact generation has two validation dimensions:

1. Data correctness: required sections, values, evidence, identity, and disclaimers.
2. Rendering correctness: pagination, overflow, tables, images, branding, and print behavior.

Follow `docs/loops/report-visual-qa.md`.

## External Integrations

| Integration                  | Purpose                                          | Failure posture                                           |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| Gemini                       | Extraction, narratives, recommendations, visuals | Validate/parse; expose unavailable state; never fabricate |
| OpenAI                       | Optional voice transcription                     | Feature degrades when absent                              |
| AWS S3                       | Asset and generated-output storage               | Preserve access scope; handle upload failure              |
| Google Maps                  | Geocoding/location support                       | Optional/degraded behavior                                |
| Firecrawl and source tooling | Web ingestion                                    | Audit source and fallback; respect constraints            |
| Email provider               | Notifications                                    | Best-effort where appropriate; observable failure         |
| DLD/other data sources       | Market intelligence                              | Preserve provenance, freshness, and governance            |

## Observability and Operations

The server includes structured logging, error capture hooks, audit logs, connector health, ingestion runs, notifications, performance monitoring, and scheduled processes. Operational work follows:

- `docs/runbooks/deployment.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/incident-response.md`

Do not log secrets, full tokens, credentials, or unnecessary customer payloads.

## Testing Architecture

- Vitest unit and integration tests under `server/`.
- Playwright end-to-end tests under `e2e/`.
- Pure calculation engines should use deterministic fixtures.
- Report tests need rendered artifact inspection in addition to string assertions.
- Current health is recorded in `docs/PROJECT_STATE.md`; never infer it from historical reports.

## Architectural Change Rules

Create an ADR when changing:

- Deterministic-versus-AI authority boundaries
- Authentication or tenancy model
- Primary data store or schema/migration strategy
- Public API compatibility policy
- Ingestion governance or benchmark promotion
- Deployment topology
- Report authority/reproducibility model
- Canonical documentation/state architecture

Use `docs/decisions/README.md` and the existing ADR format.
