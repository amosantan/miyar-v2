# Current Task

- ID: SC-04
- Roadmap step: `SC-04`
- Title: Enforce client performance budgets
- Status: PASS
- Owner: Codex
- Started: 2026-07-19
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-sc04`
- Branch: `codex/sc-04-client-performance-budgets`
- Base: exact canonical-main commit `a319d47b77771665c9add390a2befd5a883a7dbb`
- Classification: Client performance / build tooling
- Risk: Medium — import-boundary changes can break lazy routes or move too much code into the application entry
- Selected loop: Feature loop with build-contract, desktop/mobile browser, and independent-review gates
- Retry budget: Maximum 3 evidence-based attempts per unchanged failure class; every retry must use a new hypothesis
- Resource budget: One isolated worktree; one baseline bundle analysis, targeted iterations, one full verification pass, bounded hosted CI/preview, exact-SHA deployment, and production smoke after explicit release authorization
- Human gates: The user cleared commit, push, protected merge, exact-SHA production deployment, and bounded production smoke on 2026-07-19. New dependency, public-contract break, schema/migration, scoring/financial/compliance change, or shared configuration remained gated and did not occur.

## Goal

Make MIYAR's client bundle size measurable and CI-enforced, then isolate heavy optional tooling so first-load and ordinary-route users do not download it before they need it.

## Plain-English Problem

MIYAR already lazy-loads pages, but multiple deferred pages still converge on a very large shared JavaScript chunk. A user can therefore avoid the code on the landing page yet still download a broad toolset when opening an unrelated authenticated route. There is also no automated size gate, so future changes can silently reverse the earlier performance improvement.

## Acceptance Criteria

- [x] A clean production build emits a deterministic machine-readable bundle manifest with raw and gzip sizes and stable entry/route ownership.
- [x] The initial entry remains below the audit-approved absolute ceiling of 300 KB gzip and is protected against material regression from the verified SC-04 baseline.
- [x] Heavy Markdown, diagram, spreadsheet/document, and report tooling is isolated behind component or route boundaries where live import evidence shows it is optional.
- [x] No single deferred shared chunk retains the historical approximately 911 KB raw bottleneck without an explicit evidence-backed exception.
- [x] CI runs the bundle-budget check after the production build and fails on missing artifacts, entry regression, route-budget regression, or an unapproved oversized chunk.
- [x] Budget thresholds and ownership are versioned in the repository; the checker has deterministic passing and failing tests.
- [x] The exact browser matrix passes: desktop public Home/Login and critical admin journey; desktop assistant/Markdown deferral; mobile-width public share plus authenticated dashboard/assistant/project/reports and deferred inline-report preview; no unexpected route, console, request, layout, or accessibility regression.
- [x] `pnpm check`, targeted tests, hostile-parent ordinary `pnpm test`, `pnpm build`, tracked `api/index.js` freshness, and `git diff --check` pass.
- [x] No schema, migration, dependency, API, authorization, numerical formula, scoring weight, financial assumption, compliance policy, or production configuration changes.
- [x] Roadmap, current task, worklog, lessons, architecture/project state, and known failures change only where verified reality changes.

## Non-Goals

- No feature rewrite, visual redesign, server/API optimization, caching policy, service worker, CDN change, or runtime observability work owned by `SC-05`.
- No removal of supported Markdown, diagrams, reports, document export, or spreadsheet functionality.
- No weakening of minification, source behavior, tests, or browser coverage to obtain smaller output.
- No commit, push, pull request, merge, preview, or deployment without separate authorization.

## Architecture Assumptions

- Route-level `React.lazy` remains the primary page boundary; component-level dynamic imports are added only for optional heavy subfeatures.
- Bundle budgets measure production output from Vite, not development-server behavior.
- The audit's `<300 KB gzip` entry target is the absolute ceiling; the live baseline will define a tighter regression ratchet before implementation.
- Chunk names are content-derived and unstable, so enforcement must use manifest ownership/import relationships rather than hard-coded hashed filenames.

## Execution Plan

- [x] Create and verify a fresh SC-04 worktree from exact current `main`.
- [x] Install the frozen dependency graph and capture the clean baseline bundle graph and sizes.
- [x] Trace heavy modules to import sites and define the smallest split/budget contract.
- [x] Add deterministic bundle-manifest and budget-check tooling with fixture tests.
- [x] Isolate optional heavy client features and verify targeted routes after each split.
- [x] Run complete static, unit, build, browser, diff, and independent-review gates.
- [x] Close SC-04 with exact evidence and select one dependency-valid successor.

## Current Evidence

- At activation, the canonical roadmap marked `SC-04` as the sole next executable step with no human gate.
- Audit evidence records an earlier entry reduction from 936.86 KB gzip to 199.24 KB gzip, with a remaining deferred shared chunk of approximately 911 KB raw.
- At activation, `vite.config.ts` had no manifest, explicit chunk policy, or bundle-budget enforcement.
- At activation, CI ran `pnpm build` without inspecting client artifact sizes.
- At activation, `App.tsx` already lazy-loaded pages and the authenticated shell, so the implementation was driven by the live build graph rather than historical assumptions.
- Baseline build: entry JavaScript 450,708 raw / 137,910 gzip bytes; authenticated dashboard static closure 1,468,678 raw / 450,808 gzip bytes; shared Streamdown core 883,043 raw / 265,941 gzip bytes.
- Attempt 1: the checker implementation passed TypeScript and the live bundle budget, but its test was placed outside Vitest's configured `server/**/*.test.ts` discovery boundary. The next hypothesis is to keep the production script under `scripts/` and move only its pure test into `server/_core/`.
- Attempt 2: Vitest discovered the moved test, but a mechanical edit left a literal `\\n` token in the fixture configuration. The checker and TypeScript still passed; the next hypothesis is the single malformed test line, not the evaluator or production configuration.
- Frozen dependency installation passed without a lockfile change. The current client graph contains neither `docx` nor `xlsx`; no unsupported dependency removal or artificial chunk naming is needed.
- Post-split production evidence passes: entry JavaScript is approximately 138 KB gzip; public home/login/share closures are 175/181/178 KB gzip; authenticated dashboard/project/reports closures are 220/400/226 KB gzip; the pre-briefing portfolio closure is 325 KB gzip; and the assistant-with-Markdown closure is 491 KB gzip.
- The authenticated dashboard static closure fell from 450,808 to 220,257 gzip bytes (approximately 51%). `Streamdown` remains supported behind the assistant/portfolio interaction boundary. Its approximately 883 KB raw / 267 KB gzip renderer artifact has one reasoned, bounded exception expiring 2026-10-31.
- The evaluator's five passing tests prove cyclic closure handling, successful budgets, entry/chunk/route/static-edge failures, missing artifacts, and mandatory non-expired exception reasons. TypeScript passes after the browser contract extension.
- The artifact-root selector adds a sixth passing checker test and proves local `dist/public/` and Vercel `dist/` parity. Both client build profiles pass the same budgets; full `pnpm build` passes and regenerates byte-stable `api/index.js`.
- Browser attempt 1 failed because the assertion recognized only production `/assets/` URLs while the governed journey uses Vite source-module URLs. The corrected evidence matches stable module ownership in both profiles.
- Browser attempt 2 reached the report preview but local storage correctly supplied a `data:` URL and exercised the iframe path. A disposable-test-only, organization-verified helper converts the browser-created synthetic report to the already supported inline shape; no production fixture switch was added.
- Browser attempt 3 passed the entire guarded certification. The final post-review rerun additionally passed desktop public Home/Login and a mobile-width assistant interaction. The manifest records deferred assistant, Markdown, and report-renderer loading; authenticated dashboard/project/reports mobile-width views with no overflow; zero unexpected console/page/request/HTTP errors; Node/serverless security parity; secret scans; stable dirty-tree provenance; and successful cleanup with the disposable database absent.
- Final broad verification: ordinary database-free suite 1,264 passed / 22 skipped; authorization inventory 338/338 with zero remediation; database-safety inventory 112 entrypoints, two exact generated-bundle exceptions, zero findings; `pnpm check`, local/Vercel budgets, `pnpm build`, serverless freshness, and diff checks pass.
- Independent GPT-5.6 Sol high-reasoning review found no code, security, budget, Vite-parity, lazy-boundary, accessibility, CI, or privacy objection after the browser-matrix and state wording corrections.
- The review's evidence-quality recommendation is also incorporated: the generated report now hashes its budget configuration and explains every applied exception with stable selector, resolved artifact, measured raw/gzip bytes, ceilings, reason, and expiry.
- Release candidate commits `9458212` and `8fe98ea` merged through PR `#20` as exact canonical-main SHA `1bad9d666d71a0b010a27433ca196c842b4e546f`. The second commit forces Vite's production profile because hosted CI's global `NODE_ENV=test` correctly reproduced and rejected a development-mode client bundle; no budget was relaxed.
- PR and canonical-main hosted CI passed `lint-and-test` and `mysql-authorization`; Vercel preview and production builds passed. Production deployment `dpl_EfNS4qwEXLRXHPNKPi6isHG41BuE` is `READY` and identifies exact merge SHA `1bad9d6`.
- Production smoke passed authenticated dashboard/session access, stored-report lazy preview, temporary admin share creation, public share/API 200 with privacy headers, project-wide revocation, and byte-identical revoked/never-issued concealed 404 bodies and headers. The temporary URL was cleared from browser memory, clipboard, and local temporary files.
- Production inspection also reproduced malformed labels in a February 2026 legacy stored report (`undefined` and `[object Object]`). It predates and is not caused by the lazy-loading release; `KF-018` records the separate compatibility defect and objective exit criterion.

## Next Action

SC-04 is released and closed. `SC-05` is next but remains `NEEDS_HUMAN` pending runtime-topology, SLO/alert ownership, and monitoring-cost decisions; `KF-018` needs a separately scoped legacy-report compatibility fix.
