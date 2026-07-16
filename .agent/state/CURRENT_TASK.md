# Current Task

- ID: TR-02
- Roadmap step: `TR-02`
- Title: Canonical organization-resource authorization layer
- Status: PASS
- Owner: Codex
- Reviewer: Claude Code plan review (`APPROVED_WITH_CHANGES`); final security-focused diff review required
- Started: 2026-07-16
- Risk: High API/security
- Selected loop: `LOOP_ENGINEERING.md`
- Retry budget: 3 evidence-based attempts per failure class
- Resource budget: one reusable authorization layer, isolated fixtures/tests, security contract documentation, and scoped TR-01/TR-02 commit; no production-router remediation
- Approval gates: deny legacy-null ownership; stop as `NEEDS_HUMAN` before any exception, schema/migration change, production deployment, protected-branch merge, global/admin policy, pooled learning, scoring, financial, or compliance change

## Goal

Provide typed, dependency-injected organization authorization primitives for projects, direct and nested project resources, direct organization resources, project-and-organization records, batches, polymorphic targets, and expiring public shares so later router remediation does not reimplement ownership logic.

## Non-Goals

- Do not import the new TR-02 helpers from or otherwise modify production routers.
- Do not remediate the `TR-03`, `TR-04`, or `TR-05` inventory rows.
- Do not change schema, migrations, dependencies, scoring, financial assumptions, compliance policy, global/admin governance, or pooled-learning policy.
- Do not connect to or intentionally read/write a shared database.
- Do not modify or include migration `0044`, its snapshot, or its journal changes.
- Do not include unrelated client-performance, runtime-safety, generated-bundle, or pre-existing router changes in the scoped commit.

## Acceptance Criteria

- [x] Existing `requireProjectForOrg` API and error contract remain compatible.
- [x] Typed direct-child, nested-child, direct-org, project-and-org, ordered batch, and closed-registry polymorphic helpers are implemented.
- [x] Missing, cross-org, legacy-null, orphaned, inconsistent, and unsupported resources fail with the same resource-safe `NOT_FOUND` contract.
- [x] Batch authorization preserves order and duplicates, returns no partial result, and completes before downstream effects.
- [x] Public-share authorization is separate from authenticated access and requires a non-null future UTC expiry plus consistent non-null brief/project ownership.
- [x] Synthetic fixtures cover unauthenticated, no-org, two-org, third-party/orphan, legacy-null, inconsistent-parent, and public-share states.
- [x] Unit and test-router contract suites pass without initializing the real database.
- [x] Authorization contract documentation is linked from security and architecture documentation.
- [x] No production router contains a TR-02 helper import or behavior change.
- [x] Authorization audit passes; formatting passes; full type/test/build gates are reported honestly with no regression.
- [x] Security diff review finds no ID, ownership, table, token, stack, or full-record leakage.
- [x] Roadmap, task, worklog, lessons, known failures, and project state are updated only from verified evidence.
- [x] Scoped TR-01/TR-02 commit boundary is recorded; preview deploy is prohibited unless mandatory repository gates all exit zero.

## Commit Allowlist

Only task-proven hunks under these paths may be staged:

- `.agent/state/CURRENT_TASK.md`
- `.agent/state/KNOWN_FAILURES.md`
- `.agent/state/LESSONS.md`
- `.agent/state/ROADMAP.md`
- `.agent/state/WORKLOG.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_STATE.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`
- `docs/audits/MIYAR_PRODUCT_TECH_AUDIT_2026-07-15.md`
- `docs/audits/MIYAR_PRODUCT_TECH_AUDIT_2026-07-15.html`
- `docs/runbooks/roadmap-execution.md`
- `docs/security/`
- `package.json`
- `scripts/audit-resource-authorization.ts`
- `server/_core/project-access.ts`
- `server/_core/project-access.test.ts`
- new TR-02 authorization, fixture, test, and contract files under `server/_core/` and `server/test-utils/`

Explicitly excluded:

- `api/index.js`
- `client/src/App.tsx`
- `drizzle/0044_last_the_executioner.sql`
- `drizzle/meta/0044_snapshot.json`
- `drizzle/meta/_journal.json`
- `server/_core/index.ts`
- `server/_core/runtime-safety.ts`
- `server/_core/runtime-safety.test.ts`
- `server/routers/learning.ts`
- every unrelated or unproven user-owned hunk

## Plan

- [x] Activate TR-02 and record scope, gates, and commit allowlist.
- [x] Implement canonical authenticated and public-share authorization helpers.
- [x] Add reusable fixtures, unit tests, router contract tests, and documentation.
- [x] Run targeted and repository verification plus security diff review.
- [x] Close TR-02 and promote TR-03 from verified evidence.
- [ ] Stage the allowlist, commit, push, and conditionally deploy a Vercel preview.

## Baseline Evidence

- Branch: `codex/loop-engineering-architecture` at `a15424b` plus existing uncommitted work.
- `pnpm vitest run server/_core/project-access.test.ts`: PASS, 4/4.
- `pnpm audit:authorization`: last recorded PASS, 327 procedures and 140 remediation rows.
- `pnpm check`: recorded red baseline with 52 diagnostics; changed-file regression comparison required.
- `pnpm test`: recorded 809 passed, 9 failed, 22 skipped; ordinary invocation is not database-hermetic.
- `pnpm build`: last recorded PASS.
- Claude Code reviewed the implementation/release plan and returned `APPROVED_WITH_CHANGES`; the final plan incorporates its public-share, batch-boundary, legacy-null, leakage-review, commit-isolation, and preview-gate corrections.
- `.vercel/project.json` exists and is ignored; no installed `vercel` executable was found.

## Attempts and Recovery

| Attempt | Hypothesis                                                                             | Action                              | Evidence                                                                                                                         | Result                                                                                                    |
| ------: | -------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
|       1 | The first public-share failure represented an authorization defect                     | Inspected the failed orphan fixture | The helper default parameter replaced explicit `undefined` with the organization-A project                                       | Corrected the test harness; the implementation contract was unchanged                                     |
|       2 | Generic project lookup types matched the existing helper signature                     | Ran `pnpm check`                    | One TR-02 diagnostic showed the project lookup allowed synchronous results while `requireProjectForOrg` requires an async lookup | Narrowed the project lookup type; TR-02 diagnostics returned to zero                                      |
|       3 | Removing `DATABASE_URL` from the command environment prevents dotenv from restoring it | Ran `env -u DATABASE_URL pnpm test` | `dotenv/config` loaded the local value and the logout test attempted a remote audit insert                                       | Established `DATABASE_URL=''` as the safe invocation and reproduced the suite with no external connection |
|       4 | The TypeScript evidence summary command could store its exit in `status` under zsh     | Ran the diagnostic-count command    | zsh rejected its read-only `status` variable                                                                                     | Re-ran with `exit_code`; confirmed 52 baseline diagnostics and zero TR-02 diagnostics                     |

## Completion Evidence

- `pnpm vitest run server/_core/project-access.test.ts server/_core/resource-access.test.ts server/_core/public-share-access.test.ts server/_core/resource-access.router.test.ts`: PASS, 49/49.
- `pnpm audit:authorization`: PASS, 327 procedures and 140 remediation rows.
- Targeted Prettier check: PASS.
- `pnpm check`: FAIL with the same 52 recorded diagnostics; zero diagnostics reference TR-02 production or fixture files.
- `DATABASE_URL='' pnpm test`: FAIL with the same nine known failures; 849 passed and 22 skipped, including all new TR-02 tests; no database connection attempt.
- `pnpm build`: PASS for client, Node server, and serverless bundle.
- Production-router search found no TR-02 helper import.
- Security review found no logging in authorization helpers and no error response containing IDs, ownership details, tokens, table names, or stacks.
- Public-share router adoption remains deliberately deferred to `TR-03`.

## Next Action

Stage only the recorded TR-01/TR-02 allowlist, review the staged diff, commit, and push. Do not deploy a preview because mandatory type/test gates are red. Then start `TR-03`.
