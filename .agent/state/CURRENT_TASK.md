# Current Task

- ID: TR-10
- Roadmap step: `TR-10`
- Title: Certify report integrity and visual rendering
- Status: PASS
- Owner: Codex
- Started: 2026-07-18
- Branch: `codex/tr-10-report-certification`
- Base: `18da870d37f9181b75bfa7f0f8aa1f9480b456f9` (`origin/main`)
- Risk: High report, localization, output-security, tenant-access, and additive-schema change
- Selected loops: Report and visual QA, feature, schema migration, security, and browser verification
- Retry budget: Maximum 5 complete render-QA iterations by default, one owner-authorized sixth post-fix iteration, and 3 evidence-based attempts per unchanged failure class
- Resource budget: One isolated worktree, one additive migration, one bilingual catalog, one all-export fixture matrix, and one independent final-review cycle
- Human gates: Bilingual issued copy, release actions, and the explicit waiver of the browser-policy-blocked generated download/print clicks were approved by the task owner on 2026-07-18

## Goal

Prove that every supported MIYAR report and export is data-correct, tenant-safe, output-safe, bilingual, reproducible within one render, and visually usable in its final HTML, browser-print PDF, DOCX, inline-preview, or public-share form.

## Approved Product Decisions

- Certify every current user-facing exporter, not only design-brief and full-report HTML.
- Add explicit English/Arabic export selection, defaulted from the current UI locale; legacy callers default to English.
- Preserve current English branding, calculations, thresholds, financial policy, and disclaimer meaning.
- Permit faithful Arabic translations and narrow truthful identity, evidence, assumption, and disclaimer repairs.
- Repair expiring stored report links with a stable storage key and freshly signed organization-authorized reads.
- Material Board Annex remains mandatory only for design-brief HTML and full-report HTML under ADR-0003.

## Acceptance Criteria

- [x] TR-09 is closed on canonical main and a fresh TR-10 worktree/branch exists from exact base `18da870` without touching dirty sibling worktrees.
- [x] Every export API accepts validated `en`/`ar` locale input with backward-compatible English default, and every export control exposes an explicit selector initialized from the current UI locale.
- [x] Every HTML/DOCX output uses one internally consistent per-render document ID, UTC generation time, locale, renderer identity, and available model/benchmark/logic labels without claiming BR-07 immutable cross-format identity.
- [x] The approved render-input fingerprint is deterministic, truthfully labelled, embedded only in the artifact, and neither persisted as a structured report field nor exposed through an API.
- [x] Dynamic report data is escaped through shared text/attribute/URL boundaries; autonomous markdown is escape-first allowlisted; hostile HTML, URL, bidi, and formula-like fixture content remains inert and literal.
- [x] English and fully localized Arabic fixed copy, RTL/bidi layout, Arabic-capable fonts, and DOCX RTL properties pass deterministic content and visual checks.
- [x] Existing investor/ROI fallback inputs are clearly labelled assumptions without changing any value or formula; exact Arabic legal and financial wording is approved before PASS.
- [x] Material Board Annex remains present only in design-brief/full-report HTML and retains no-board, empty, complete, partial, and unresolvable states.
- [x] Additive migration 0050 (or the next verified unused ordinal) adds nullable `report_instances.storageKey`; authorized reads mint fresh URLs, storage keys never leak, legacy file URLs remain read-only fallback, and no backfill is performed.
- [x] Synthetic complete, partial, empty, large-number, Arabic/mixed-direction, long-content, board-heavy, failed-asset, and hostile-input fixtures cover all exporters through a documented pairwise matrix.
- [x] The real HTML-to-PDF and DOCX-to-PDF paths render successfully; every generated page is inspected with zero clipping, overlap, overflow, blank pages, broken required assets, or unreadable Arabic.
- [x] Same-organization report access succeeds; cross-organization/missing resources fail before generation, storage, or signing; public shares remain token-gated, read-only, expiry-aware, concealed, no-store, and noindex in both locales.
- [x] **HUMAN UI-CLICK GATE:** All automated, artifact, browser, and independent-review gates pass; the task owner explicitly waived the remaining generated download/print UI clicks on 2026-07-18.
- [x] Durable state and the report-QA runbook record only verified evidence; no customer artifacts, signed URLs, bulk renders, or unexplained files remain.

## Output Families

- Project validation summary, design brief, full report, and autonomous design brief HTML plus browser-print PDF.
- Design-brief DOCX.
- Investor, material-board, scenario-comparison, and portfolio HTML plus browser-print PDF.
- Stored-report inline preview and print fallback.
- Public read-only ShareView.

## Non-Goals

- No `report_snapshots` table, immutable-at-issue guarantee, cross-format hash equality, or shared snapshot DTO.
- No Material Board Annex in DOCX, validation, autonomous, investor, board, scenario, or portfolio outputs.
- No scoring, pricing, threshold, premium, financial-formula, compliance-policy, or evidence-authority change.
- No production dependency addition for markdown or sanitization.
- No legacy report-key backfill, shared database operation, release, or external publication without separate authorization.

## Recovery

- The application remains compatible with report rows whose `storageKey` is null by retaining the existing `fileUrl` fallback.
- The additive storage-key column remains in place on application rollback; no existing report row is rewritten.
- Any tenant-boundary, output-execution, numerical, financial-interpretation, or irreversible data risk stops work immediately.

## Execution Plan

- [x] Establish the frozen-install and targeted report/share baseline.
- [x] Implement per-render identity, safe output utilities, bilingual catalogs, and all exporter adoption.
- [x] Implement additive storage-key persistence and authorization-scoped fresh signing.
- [x] Implement synthetic fixtures, output audit, and real render-certification harness.
- [x] Run targeted, full, migration, browser, every-page artifact, and independent-review gates; record the owner waiver for the browser-policy-blocked generated download/print clicks.
- [x] Close durable state from verified evidence.

## Verified Evidence

- Targeted report, router, storage, migration, DOCX, localization, and share suites pass 156/156.
- The release-candidate `DATABASE_URL='' pnpm test` passes 1,114 tests with 22 skipped; `pnpm check`, `pnpm tsx scripts/audit-report-output.ts`, `pnpm audit:authorization` (336/336, zero remediation), and `pnpm build` pass.
- Disposable MySQL 8 proves migration 0050 forward application, nullable legacy compatibility, stable-key update, application rollback compatibility, and column rollback without altering legacy report data. Production migration 0050 was subsequently applied after backup `q0zq6eqznlcq`; all 29 report rows remained and the new nullable `TEXT` column has zero backfilled values.
- The owner-authorized sixth post-fix render iteration generated and checked 23/23 HTML/browser-PDF/DOCX artifacts through production-compatible paths. All 83/83 pages were inspected at readable resolution with no remaining artifact defect.
- A fail-closed, loopback-only synthetic MySQL/application environment exercised login plus authenticated English/Arabic selectors and previews across project reports, stored reports, design brief, material boards, investor summary, scenario comparison, portfolio, and public shares. It exposed and drove fixes for successful authentication returning to the public homepage, missing project-specific routes, a fail-hard optional ROI label, a duplicate/misdirected room-render card, and the unsafe legacy project-less comparison URL. Rechecks show login reaches `/dashboard` and no new browser errors.
- Valid and invalid public shares have identical authorization outcomes in English and Arabic, correct root locale/direction and privacy metadata, and the valid English document geometry is 1280/1280 with all card bounds inside the viewport. The browser safety layer rejected generated download/new-page actions and explicitly forbade bypassing that policy; the task owner explicitly waived those remaining UI clicks.
- The independent high-reasoning security/integration reviewer and Claude Opus returned `APPROVED` for the implementation boundaries and final reviewed diff.
- PR #12 merged as canonical-main commit `55917a145a87c218c34457e054850326fc1e1a1a`; hosted main CI run `29641839449` passed, Vercel target `8A9iDiHwfT3wnXsYXFwqQWLtpPB2` completed, and three production root/login/health/tenant/share observations passed.

## Human Gate

- Resolved 2026-07-18: The product/report owner approved the exact bilingual legal and financial wording in `docs/artifacts/TR-10_BILINGUAL_COPY_MATRIX.md`.
- Resolved 2026-07-18: The task owner authorized one sixth post-fix render-certification cycle after the original five-iteration budget was exhausted.
- Resolved 2026-07-18: The task owner authorized a safe synthetic authenticated local environment for the complete English/Arabic browser workflow matrix.
- Resolved 2026-07-18: The task owner explicitly authorized commit, push, merge, shared database migration, and deployment.
- Resolved 2026-07-18: The task owner explicitly waived the remaining TR-10 generated download/print UI-click gate.

## Next Action

TR-10 and its production release are complete. Begin `TR-12`, the sole dependency-valid next executable roadmap step, in a fresh worktree when authorized.
