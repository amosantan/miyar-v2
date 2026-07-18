# TR-13 Critical Workflow Certification

## Purpose

This runbook defines the safe, reproducible certification for MIYAR's current project-to-public-share journey. It uses only versioned synthetic fixtures and a disposable loopback MySQL database. A run is `PASS` only when the ordered real-MySQL journey, real Node/serverless application matrix, stored-report render, same-project browser journey, and verified cleanup all pass.

## Safety contract

- Invoke only `pnpm certify:workflow`; it requires `TEST_DATABASE_URL` and rejects any caller-provided `DATABASE_URL`.
- The target must be MySQL on `localhost`, `127.0.0.1`, or `::1`, and its database name must begin `miyar_test_tr13_`.
- The runner rejects ambient browser base URLs, ports, worker configuration, and synthetic-session configuration. It supplies one serial test profile, disables background workers, and owns a dedicated loopback port.
- The lifecycle is serial: recreate the validated disposable database, apply the schema, run the ordered real-MySQL router journey, reset fixtures and exercise the real Node and serverless application factories, render and inspect the matching sanitized stored report, seed synthetic login identities, run the Node browser journey, then drop the database in `finally`. Cleanup failure makes the run fail.
- Outputs belong only in ignored `tmp/tr13-workflow-certification/`. The manifest records no URLs, credentials, cookies, share tokens, screenshots, or raw traces.
- Do not connect to a shared/preview/production database, apply a shared migration, or treat this local run as deployment evidence.

## Preconditions

1. Install the locked dependencies and Playwright Chromium locally.
2. Start a disposable local MySQL service that can create and drop a database whose name begins `miyar_test_tr13_`.
3. Provide `TEST_DATABASE_URL` for that disposable target in the invoking shell only. Do not put it in source control, a report, or a manifest.
4. Confirm no server is using the dedicated test port. The runner refuses ambient port reuse rather than attaching to a running app.

## Command

```bash
pnpm certify:workflow
```

The versioned fixture is the canonical source for two organizations; admin, member, viewer, and foreign users; the project/model/benchmark/logic versions; explicit input provenance; governed evidence; material-library prices; deterministic numerical expectations; both brief contracts; and stored-report expectations. The MySQL slice carries one project through Grade A/B parser coverage, the real Grade-C no-provider MQI path, both brief routers, real `full_report` persistence, public-share creation/resolution/revocation, role/tenant negatives, and deterministic reconciliation.

The generated stored-report HTML is scanned for secret-like markers, written only under `tmp/`, browser-printed to PDF, and rasterized with Poppler for human inspection. Its manifest records only non-secret IDs, version identities, hashes, reconciled values, security results, and cleanup status.

The runner seeds fixed synthetic login identities before Playwright. The browser slice carries its one newly created project through confirmation, evaluation, Grade-C MQI, the two brief/report surfaces, public sharing/revocation, mobile read-only access, and member/viewer/foreign authorization negatives. Concealed `404` responses are accepted only inside an explicit expected window; every other failed request, page/console error, or horizontal overflow fails the journey. It does not invoke a live provider: representative Grade A/B allocation parsing and AI-advisor narrative use Vitest-only `invokeLLM` mocks. Do not call this a live-AI certification.

## Required journey and negatives

The fixture contract names login, organization, project, evaluation, space programme, MQI, two brief variants, a `stored_report`, public share, and revocation. Required negatives include unauthenticated rejection, member/viewer role limits, foreign-organization concealment, concealed invalid/expired/revoked/never-issued shares, read-only public access, and absence of token-bearing durable/process output.

### Two brief contracts

- `design.generateBrief` is the structured, deterministic-engine brief contract. It must preserve source values, evidence/provenance labels, technical specification/RFQ content, and disclaimer.
- `designAdvisor.generateDesignBrief` is the AI-advisor, shareable brief contract. It may produce narrative direction but cannot become numerical authority or silently replace explicit developer inputs. The public link exposes this AI-advisor brief only.
- `project.generateReport` is a separate stored-report contract.

Certify these separately: an AI-advisor narrative or public link is not proof of the structured brief or stored-report contract.

## Node and serverless coverage

The runtime matrix resets fixture state before each profile and sends the critical HTTP/API/security workflow through the existing `createNodeApplication` and `createServerlessApplication` factories backed by the disposable MySQL database. It uses the real `appRouter`, application middleware, route handlers, and organization authorization, with only the existing synthetic authenticated-context test seam and a Vitest-only serve-bootstrap safety shim. It compares report render-input fingerprints, reconciled values, active public contracts, concealed bodies, and privacy headers between profiles.

The browser application journey runs against Node because Node owns the application shell. Static/Vite serving, SSE, API documentation, request/performance logging, and schedulers are intentionally Node-only today. This certification records that difference; it does not add a public capability API or claim serverless worker/scheduler parity. `SC-05` owns future runtime capability and observability architecture.

## Evidence and closure

Review `tmp/tr13-workflow-certification/manifest.json`, every rasterized report page, and the generated Playwright JSON only locally. Recompute provenance by running the full harness after the final source, test, and durable-document edits. The durable synthetic-only result belongs in `docs/artifacts/certifications/TR-13_CRITICAL_WORKFLOW_CERTIFICATION.md`. Never copy credentials, cookies, share tokens, full share URLs, raw traces, or customer data into that record.

The runner writes `PASS` only after validating integration, runtime parity, render, browser, process/artifact secret scans, and cleanup, then independently confirming that the disposable database no longer exists. Any lifecycle, evidence, provenance, or cleanup failure produces `FAILED`; a prior successful run never overrides the latest failure.
