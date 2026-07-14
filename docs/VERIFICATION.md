# MIYAR Verification and Definition of Done

## Verification Principle

Repository evidence—not confidence, progress checkboxes, historical reports, or target test counts—determines completion.

Verification must be objective, relevant, repeatable, proportional to risk, and honest about failures.

## Universal Gates

Every change requires:

1. Acceptance criteria mapped to evidence.
2. Relevant targeted verification.
3. Review of the complete diff.
4. No unexplained scope, files, or generated artifacts.
5. Disclosure of unresolved failures and environment limitations.
6. Required human approvals before irreversible or external actions.

## Verification Ladder

| Level | Name | Evidence |
|---:|---|---|
| L0 | Inspection | Paths, imports, schema, configuration, Git diff |
| L1 | Static | TypeScript, formatting, linting, schema validation |
| L2 | Unit | Pure functions, boundaries, deterministic fixtures |
| L3 | Integration | Routers, database, authorization, engine composition |
| L4 | Build | Production bundles and packaging |
| L5 | Workflow | Browser/API end-to-end user journey |
| L6 | Artifact | Rendered PDF, DOCX, image, export, or screenshot |
| L7 | Operational | Migration, deployment, monitoring, recovery |
| L8 | Independent | Separate reviewer, adversarial test, authorized approval |

## Change Matrix

| Change class | Minimum required evidence |
|---|---|
| Documentation | Referenced-path, command, link, authority, and consistency checks |
| TypeScript behavior | `pnpm check`, targeted tests, diff review |
| Shared engine | Targeted tests, full relevant regression, type-check, build, deterministic fixture review |
| Router/API | Validation, authentication/authorization, negative paths, type-check, tests, build |
| Client UI | Type-check, build, browser workflow, responsive/empty/error states, console review |
| Schema | Migration generation, SQL review, safe apply, integrity, compatibility, recovery plan |
| Ingestion/data | Dry run, idempotency, provenance, quality, counts, partial-failure behavior |
| Report/artifact | Data assertions plus render and visual inspection |
| Release | All applicable gates, approval, health/smoke checks, rollback readiness |

## Domain Requirements

### Scoring, economics, risk, and prediction

- Fixed fixtures with reviewed expected outputs.
- Boundary, zero, missing, large, and adverse inputs.
- Monotonicity or invariants where the model requires them.
- No LLM call in authoritative numerical calculation.
- Stored logic and benchmark versions.
- Explainability reconciles to the result.
- Old-versus-new comparison for policy changes.

### Materials and quantity intelligence

- Allocations reconcile to 100% within an explicit tolerance.
- Units and surface formulas are deterministic.
- Costs retain min/mid/max semantics and currency/unit.
- Missing price data yields labelled fallback or insufficiency.
- Locked/manual allocations are not silently overwritten.
- Space-program fit-out scope is respected.

### Authentication, organizations, and public sharing

- Unauthenticated access is rejected where required.
- Cross-organization reads/writes are rejected.
- Admin role boundaries are tested.
- Public tokens are scoped, expiring, and read-only.
- Responses do not leak hidden organization/project fields.

### Ingestion and market intelligence

- Source identity, URL, capture time, method, and reliability retained.
- Confidence/reliability formula is explicit and tested.
- Duplicate runs are idempotent or safely deduplicated.
- Redirects, timeouts, empty content, parse errors, and provider failure are covered.
- Evidence does not become an authoritative benchmark without the intended gate.

### Reports and visual outputs

- Required sections, numbers, evidence, disclaimers, and document IDs exist.
- Data agrees with source screens/APIs.
- Cover, headings, tables, pagination, overflow, fonts, images, and empty states are inspected.
- Public-share access and expiry match the report contract.
- Large and partial fixtures are included.

## Baseline and Pre-Existing Failures

A task may demonstrate no regression while the repository remains red only when:

- Failures were reproduced before or independently of the change.
- The changed behavior has passing targeted evidence.
- The failure set does not increase or materially change.
- Final reporting says the full gate is still failing.
- Every unresolved failure is recorded in `.agent/state/KNOWN_FAILURES.md` with an exit criterion.

Never describe a failing suite as passing because its failures are “known.”

## Flaky Tests

A flaky label requires repeated evidence. Record:

- Repetition count and pass/fail distribution
- Random seed, time dependency, network dependency, and environment
- Owner and expiry
- Replacement verification while quarantined

Skipping or retrying silently is not a fix.

## Definition of Done

A task is `PASS` only when:

- Every acceptance criterion has objective evidence.
- Applicable verification levels pass.
- Important failure paths are covered.
- The diff contains only intentional scope.
- Security, tenant, data, and numerical integrity were reviewed.
- User-facing behavior was directly exercised where applicable.
- Schema/data changes have recovery evidence.
- Durable architectural changes have an ADR or updated architecture documentation.
- Current state and known failures reflect verified reality.
- Required human gates are satisfied.
- The next engineer can continue without hidden context.

Code written, tests added, a progress box checked, or a target count reached is not sufficient on its own.
