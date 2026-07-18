# Report Certification Runbook

## Purpose

Certify MIYAR report data, tenant boundaries, issued copy, and final HTML/PDF/DOCX rendering using synthetic fixtures and the production-compatible generation paths.

## Safety boundaries

- Use synthetic fixture data only. Do not render customer or production records.
- Write bulk HTML, PDF, DOCX, text, and page images only under the ignored `tmp/tr10-report-qa/` directory.
- Never record signed URLs, storage credentials, or storage keys in manifests or Markdown.
- Do not apply migrations to a shared database without separate approval.
- Arabic disclaimer, legal, identity, and financial-qualifier copy requires product/report-owner approval of `docs/artifacts/TR-10_BILINGUAL_COPY_MATRIX.md` before release certification can be `PASS`. Catalog version `tr10-report-copy-v1` was approved by the task's product/report owner on 2026-07-18.
- Any change to an approved catalog row creates a new catalog version (for example `tr10-report-copy-v2`) and requires a new product/report-owner approval; do not silently reapprove or mutate v1.
- The render-input fingerprint is for debugging documented render inputs. It is not an immutable issued snapshot, cross-format identity, or evidence-chain hash.

## Preconditions

1. Install exactly the lockfile dependencies with `pnpm install --frozen-lockfile`.
2. Confirm Chromium, LibreOffice, `pdfinfo`, `pdftotext`, and `pdftoppm` are available.
3. Confirm the relevant report, authorization, storage, locale, and migration tests pass.
4. Use no more than five complete visual-QA iterations and three attempts per unchanged failure class. Any additional full iteration requires explicit owner approval recorded in the active task; TR-10 received approval for one sixth post-fix cycle on 2026-07-18.

## Certification command

Run:

```bash
pnpm certify:reports
```

The command regenerates synthetic artifacts through real report engines, uses Chromium for browser-print PDFs, uses the production DOCX engine plus LibreOffice for DOCX rendering, rasterizes every page with Poppler, and writes `tmp/tr10-report-qa/manifest.json`.

The manifest must record fixture, surface, output, page count, automated checks, inspected page names, and terminal status. It must contain no signed URLs or customer content.

## Automated contract checks

Every exporter must pass:

- locale and document direction;
- one consistent document ID and UTC timestamp per artifact;
- artifact, renderer, model, benchmark, and logic labels when available;
- deterministic render-input fingerprint behavior;
- required evidence, assumptions, qualifiers, disclaimer, and identity;
- exact fixture totals and source values;
- finite numbers only;
- escaped dynamic content and governed HTTP/HTTPS evidence links only;
- Material Board Annex presence only in design-brief and full-report HTML;
- no horizontal overflow, broken required assets, missing Arabic text, or footer-only/blank pages.

## Page inspection

Inspect every PNG listed by the manifest at readable resolution. Check covers, headings, tables, pagination, fonts, Arabic RTL order, mixed-direction values, images, footers, page numbers, long text, large figures, and material-board states.

Classify each defect before changing code:

- source data;
- template/localization;
- renderer/font;
- asset;
- authorization/access;
- fixture;
- contract ambiguity.

Regenerate the full matrix after each causal fix. A text-only assertion cannot close a visual defect.

## Verification ladder

```bash
pnpm tsx scripts/audit-report-output.ts
pnpm check
pnpm audit:authorization
DATABASE_URL='' pnpm test
pnpm build
pnpm certify:reports
```

Also run the targeted report, router, storage, migration, DOCX, localization, and public-share suites. Verify migration `0050` forward application, nullable legacy-row compatibility, integrity, and application rollback against disposable MySQL only.

Browser verification covers every export selector and supported preview/download/print/share path in English and Arabic. When authenticated local data is unavailable, record the exact blocked interactive paths and retain router/component evidence; do not connect to or mutate a shared database merely to make browser checks green.

If the approved browser-control surface rejects a generated download, print, popup, or new-page action under its safety policy, do not bypass it with a second automation surface or indirect execution. Record the exact control as a human UI-click gate and retain the production-path artifact evidence separately.

## Closure and cleanup

1. Obtain an independent read-only review of security, tenant isolation, financial qualifiers, Annex boundaries, migration behavior, and BR-07 non-goals.
2. Resolve every required review correction.
3. Obtain product/report-owner approval for exact issued Arabic/legal/financial copy.
4. Remove `tmp/tr10-report-qa/` after review or leave it ignored for the current local handoff; never commit rendered binaries.
5. Update the active task, roadmap, worklog, verified project state, and proven lessons together.

Release, commit, push, pull request, merge, shared migration, deployment, and production artifact replacement remain separate human-gated actions.
