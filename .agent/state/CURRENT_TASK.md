# Current Task

- ID: TR-07
- Roadmap step: `TR-07`
- Title: Re-audit and harden the unambiguous test baseline
- Status: PASS
- Owner: Codex
- Started: 2026-07-17
- Closed: 2026-07-17
- Released: 2026-07-17
- Branch: `codex/tr-07-test-baseline`
- Base: `a5e0b94088af01e0b89d3380d1db90f5d9ad1db5` (`origin/main` after fetch)
- Risk: Medium test-harness/authentication isolation; no runtime product behavior
- Selected loop: Defect loop from `LOOP_ENGINEERING.md`
- Retry budget: 3 evidence-based attempts per failure class
- Resource budget: One bounded test-harness increment and repository verification pass
- Approval gates: Initial implementation performed no release action; the user separately authorized final smoke, commit, push, canonical-main merge, and production deployment on 2026-07-17

## Goal

Re-certify and harden the repaired TR-07 authentication and space-test harnesses so they are deterministic, type-checked, isolated from real audit/database side effects, and demonstrably fail when the historical harness defects are reintroduced.

## Acceptance Criteria

- [x] A fresh worktree and `codex/tr-07-test-baseline` branch were created before task mutation; the original dirty checkout remains untouched.
- [x] UX-01 was removed from `ACTIVE` without claiming its unavailable authenticated production smoke; TR-07 was the only active roadmap step during execution.
- [x] Authentication tests use deterministic schema-derived user fixtures and a type-checked mock for the exact database exports consumed by the router.
- [x] Authentication and logout tests mock the audit boundary and verify successful/rejected/unauthenticated audit behavior without initializing a real database.
- [x] Space normalization tests retain static ESM imports and typed `ProjectInputs` fixtures without changing numerical behavior.
- [x] Temporary mutation proofs demonstrate the missing `getDb`, rejected audit boundary, and CommonJS import failures; no mutation-only edit remains.
- [x] Targeted, surrounding, safe full-suite, TypeScript, authorization-audit, build, and diff checks pass with no external database attempt.
- [x] Roadmap, worklog, known failures, lessons, and project state reflect only verified evidence; `KF-008` remains open.

## Implemented Scope

- `server/auth.test.ts` now uses full schema-derived `User` fixtures, deterministic identifiers and timestamps, and a database mock checked with `satisfies Pick<typeof import("./db"), ...>`.
- Authentication registration, successful login, rejected login, and legacy-password upgrade explicitly assert their audit and database-isolation contracts.
- `server/auth.logout.test.ts` now mocks `auditLog`, uses a schema-derived authenticated user, and proves authenticated versus unauthenticated audit behavior while preserving cookie assertions.
- `server/engines/v9-space.test.ts` required no permanent edit: its static ESM `normalizeInputs` import and typed `ProjectInputs` fixtures already match the intended contract.
- No production source, schema, API, authorization, scoring, financial, normalization, or report behavior changed.

## Causal Proof

| Temporary mutation | Expected failure observed | Restored proof |
| --- | --- | --- |
| Removed `getDb` from the typed auth database mock | Vitest failed with `No "getDb" export is defined` | Clean auth rerun passed |
| Made the isolated audit mock reject | Registration, legacy login, and authenticated logout failed with the mutation sentinel; rejected login and unauthenticated logout did not | Clean auth/logout rerun passed |
| Reintroduced CommonJS `require("./normalization")` | Both affected ESM space cases failed with `Cannot find module './normalization'` | Clean space rerun passed |

No mutation sentinel, CommonJS normalization import, or missing mock export remains in the final diff.

## Verification Evidence

- Targeted and surrounding: `DATABASE_URL='' pnpm vitest run server/auth.test.ts server/auth.logout.test.ts server/engines/v9-space.test.ts server/engines/scoring.test.ts` — 4 files, 49 tests passed.
- Safe full suite: `DATABASE_URL='' pnpm test` — 57 files passed and 1 skipped; 1,021 tests passed and 22 skipped; no auth/logout database warning or external database attempt occurred.
- TypeScript: `pnpm check` — passed with zero diagnostics.
- Authorization inventory: `pnpm audit:authorization` — 335 procedures, zero remediation rows.
- Production bundles: `pnpm build` — client, Node, and serverless builds passed.
- Scope: `git diff --check` passed; the build produced no tracked artifact diff; the original checkout's pre-existing modified and untracked files were unchanged.

## Attempts and Recovery

| Attempt | Hypothesis | Action | Evidence | Result |
| ---: | --- | --- | --- | --- |
| 1 | The full suite and production build could safely share CPU during verification | Ran safe full Vitest and the build concurrently | The auth test's three bcrypt operations exceeded Vitest's five-second timeout; late completion added an audit call during the next test | Reclassified as verification contention and reran the suite alone |
| 2 | Removing build contention would keep the combined success/rejection auth test under five seconds | Ran the safe full suite alone | Three cost-12 bcrypt operations again crossed the timeout and the late audit call contaminated the next assertion | Split rejected-password behavior into a focused test with a fixed valid bcrypt fixture; did not increase the timeout |
| 3 | Bounded cases would preserve every assertion without cross-test spill | Reran targeted, surrounding, and safe full suites | 49/49 surrounding and 1,021/22 safe full-suite results passed with no database attempt | PASS |

## Residual Risk and Next Step

- `KF-008` remains open. TR-07 proves auth-specific isolation, but ordinary test commands still lack the systemic fail-closed database profile owned by `TR-12`.
- UX-01 remains `NEEDS_HUMAN` because no authenticated production browser session was available for independent smoke re-verification; its merged PR, Vercel status, public root, and health endpoint were independently verified.
- `TR-10` is the next dependency-valid roadmap step and remains `READY`.

## Production Release Closeout

- Candidate commit: `15d29c5f5d7baa240fd79976d04dfb2254219415` (`test(auth): harden TR-07 baseline isolation`).
- Canonical merge: PR `#5` merged the pinned candidate into `main` as `85f98db305e5fe983a9ab578f6d129592fa6cfc7` at `2026-07-17T18:39:05Z`.
- Deployment: Vercel target `FTnLtBnDYeRkqu5rYeKiKrAowRuU` completed successfully for the exact merge commit at `2026-07-17T18:40:01Z`.
- Pre-deploy evidence: clean frozen install; TypeScript; safe full suite with 1,021 passed and 22 skipped; 335/0 authorization audit; client, Node, and serverless builds; diff check; rendered public homepage; root/health 200; unauthenticated project 401; invalid share 404 with privacy headers.
- Post-deploy evidence: the homepage rendered after deployment; root and health returned 200; unauthenticated project access returned 401; invalid share returned concealed 404 with `private, no-store` and `noindex, nofollow, noarchive`; three additional health observations remained 200.
- CI limitation: GitHub Actions run `29604504677` created both configured jobs with zero steps because the owner account remains billing-locked (`KF-014`). The user-authorized release used the passing clean local gates plus the successful Vercel hosted build/deployment; the underlying failure remains open.
- Rollback target: prior canonical production line `a5e0b94088af01e0b89d3380d1db90f5d9ad1db5`. No schema, data, configuration, dependency, or runtime application change accompanied this release.
- Authenticated production smoke was not possible because neither available browser had a signed-in MIYAR session. This does not alter the test-only release result and remains recorded under the existing UX-01 human gate.
