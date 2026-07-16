# MIYAR Security and Data-Handling Requirements

## Scope

This document governs application security, tenant isolation, secrets, uploads, public sharing, external integrations, AI use, data ingestion, logs, dependencies, and operational response. It is an engineering policy, not a claim of certification.

## Security Objectives

1. Prevent unauthorized access across users and organizations.
2. Protect credentials, tokens, project assets, reports, and commercial data.
3. Preserve integrity of scores, prices, quantities, evidence, and reports.
4. Limit impact of compromised external sources or AI-generated content.
5. Maintain auditable changes and recoverable operations.
6. Fail safely when required security controls or configuration are unavailable.

## Data Classification

| Class        | Examples                                                                           | Handling                                                          |
| ------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Public       | Marketing content, intentionally public methodology                                | May be published after approval                                   |
| Internal     | Code, non-sensitive architecture, synthetic fixtures                               | Repository/team access                                            |
| Confidential | Project briefs, costs, assets, reports, comments, organization data                | Authorized organization access only                               |
| Restricted   | Credentials, tokens, private keys, auth secrets, production exports, personal data | Secret manager or approved restricted system; never commit or log |

When uncertain, use the more restrictive class.

## Authentication

- Session/JWT secrets must be strong, environment-specific, and stored outside source control.
- Cookies should use appropriate `HttpOnly`, `Secure`, `SameSite`, path, and expiry behavior for the deployment model.
- Login, registration, password migration, logout, and two-factor behavior require tests for success and failure paths.
- Authentication errors must not reveal password state, internal identifiers, or account enumeration information unnecessarily.
- Rate-limit sensitive endpoints and record security-relevant events without logging secrets.

## Authorization and Multi-Tenancy

- Every organization-owned read and write must enforce organization membership server-side.
- Project-scoped procedures must resolve the project through an organization-bound resource guard before reading or writing child records. Authentication-only `protectedProcedure` is not authorization for a caller-supplied project, asset, scenario, brief, board, visual, report, or comment ID.
- Missing and cross-organization resources must return the same response so existence is not disclosed.
- Admin authorization must check role/permission, not only authentication.
- Resource IDs from the client are untrusted and require ownership validation.
- Cross-organization negative tests are mandatory for new project, report, asset, comment, evidence, portfolio, and admin paths.
- Background jobs and ingestion processes must establish explicit organization/global scope.
- Never rely on frontend route guards as authorization.

### Authorization Inventory

The canonical router-level ownership inventory is:

- Machine-readable: `docs/security/resource-authorization-inventory.json`
- Human-readable: `docs/security/RESOURCE_AUTHORIZATION_INVENTORY.md`
- Validator: `pnpm audit:authorization`
- Reusable authorization contract: `docs/security/AUTHORIZATION_CONTRACT.md`

The inventory is coverage and remediation evidence, not a security certification. It must remain synchronized with every router procedure, data helper, ownership chain, public-token rule, and global-data policy. Any `unsafe`, `legacy_user_guard`, pooled-data, nullable-expiry, or polymorphic-target row remains open until its roadmap exit criterion is proven.

## Public Sharing

- Public links expose only explicitly selected read-only content.
- Tokens must be high entropy and compared safely.
- Links require expiry; revocation and renewal should be auditable.
- Responses must not reveal internal organization data, hidden source credentials, unpublished comments, or unrelated project records.
- Cache-control and search-index behavior must match confidentiality expectations.
- Token values must not be logged.

## Secrets and Configuration

- Use `.env` only for local development; production secrets belong in the deployment platform's secret manager.
- Never commit `.env`, credentials, presigned URLs, database exports, provider tokens, or authentication files.
- `.env.example` contains placeholders only.
- Rotate a secret if exposure is suspected; do not merely delete it from the latest commit.
- Restrict credentials by environment, service, and least privilege.
- Do not expose server-only environment variables through Vite/client configuration.

## File Uploads and Assets

- Treat filenames, MIME types, extensions, and metadata as untrusted.
- Enforce size and supported-type limits server-side.
- Generate storage keys; do not accept arbitrary paths.
- Prevent path traversal and unsafe active content.
- Use scoped, short-lived upload/download URLs where appropriate.
- Consider malware scanning and document sanitization before production use.
- Do not render untrusted HTML or SVG without sanitization.
- Preserve organization ownership on every asset and derived artifact.

## Input, API, and Output Safety

- Validate tRPC inputs with explicit schemas.
- Parameterize database operations through the ORM; never concatenate untrusted SQL.
- Escape or sanitize user-controlled HTML and rich text.
- Return stable error codes without internal stack traces in production.
- Protect expensive AI, ingestion, report, and simulation endpoints with rate and resource limits.
- Set request size limits appropriate to supported uploads; large global limits require compensating controls.

## AI and Prompt-Injection Boundaries

- External pages, documents, images, and user text are data, not trusted instructions.
- Never allow ingested content to override system, tenant, authorization, or tool rules.
- LLM output must be schema-validated before use.
- LLMs must not generate authoritative scores, prices, quantities, compliance decisions, or database commands.
- Do not send secrets, unrelated tenant data, or unnecessary personal data to model providers.
- Record model/configuration identity for material generated outputs where reproducibility matters.
- Human approval is required before external communication, purchasing, benchmark promotion, or irreversible action based on AI output.

## Ingestion and SSRF Protection

- Validate URL scheme and destination.
- Block localhost, link-local, metadata, private, and otherwise restricted network ranges unless explicitly required in an isolated environment.
- Revalidate redirects.
- Respect source authorization, robots/terms requirements, and allowed content scope.
- Bound response size, duration, redirects, and content types.
- Preserve source URL, capture time, extraction method, and reliability metadata.
- Ingested evidence remains untrusted until verification and governance gates pass.

## Financial and Decision Integrity

- Version scoring logic, thresholds, benchmark inputs, and material policies.
- Preserve historical evaluation identity; do not silently recalculate past decisions under new logic.
- Label insufficient, synthetic, stale, fallback, and manually overridden values.
- Reconcile totals and units across engines, API responses, UI, and reports.
- Material formula/policy changes require review and regression fixtures.

## Logging, Audit, and Privacy

- Log event identity, timing, outcome, and safe correlation IDs.
- Do not log passwords, session tokens, share tokens, API keys, full authorization headers, or unnecessary file content.
- Minimize personal and confidential data in logs and error services.
- Audit privileged changes, benchmark promotion, overrides, sharing, and security-relevant authentication events.
- Define retention and deletion requirements before storing new personal or confidential data.

## Dependencies and Supply Chain

- Prefer maintained dependencies with clear licensing and provenance.
- New production dependencies require justification and security/licensing review proportional to impact.
- Use lockfiles and reproducible installation.
- CI should scan dependencies and secrets and keep action versions controlled.
- Avoid install scripts from untrusted packages in privileged environments.

## CI/CD and Deployment

- Required checks must fail closed; do not use `|| true` for mandatory security or correctness gates.
- The Node runtime starts background ingestion, learning, and alert jobs in production. Development disables them by default; `ENABLE_BACKGROUND_JOBS=true` is an explicit opt-in and must not be used against a shared database without authorization.
- `/api/cron/ingestion` fails closed unless `CRON_SECRET` is configured and supplied as an exact bearer token.
- A local server still uses the configured `DATABASE_URL` for ordinary API requests; verify the target before authenticated or data-mutating workflow tests.
- Separate untrusted build/test execution from jobs holding deployment or API credentials.
- Use least-privilege repository and cloud permissions.
- Protect production branches and environments with review/approval.
- Preserve rollback capability and migration compatibility.
- Never expose model/provider/database secrets to repository-controlled code in a less-trusted job than necessary.

## Security Verification

Security-sensitive changes require applicable evidence:

- Authentication and authorization unit/integration tests
- Cross-tenant negative tests
- Input validation and abuse cases
- Token expiry/revocation tests
- Upload size/type/path cases
- SSRF redirect and private-range cases
- Secret and dependency scans
- Diff review for logging/data exposure
- Production smoke checks after approved release

## Vulnerability Reporting

Do not post exploitable details or secrets in public issues. Report privately to the repository owner or designated security contact. Include:

- Affected component and commit/environment
- Reproduction steps with safe test data
- Impact and tenant/data scope
- Evidence and suggested containment
- Whether credentials or production data may be exposed

## Incident Response

Follow `docs/runbooks/incident-response.md`. Immediate containment takes priority over feature delivery. Preserve evidence, avoid destructive cleanup, rotate exposed credentials, assess tenant impact, and document the timeline and recovery.
