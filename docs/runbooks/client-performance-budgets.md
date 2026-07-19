# Client Performance Budgets

## Purpose

This runbook keeps MIYAR's first load and ordinary routes from silently accumulating optional client code. The gate measures production output, verifies intended lazy-import relationships, and fails CI when a route or chunk exceeds its owned budget.

## Source of truth

- `client/bundle-budgets.json` owns thresholds, route selectors, forbidden static dependencies, dynamic boundaries, and temporary exceptions.
- `.vite/manifest.json` below the active client artifact root is generated evidence from the current Vite production build. The versioned roots are `dist/public/` locally and `dist/` on Vercel.
- `scripts/check-client-bundle-budget.ts` resolves stable source/name selectors through that manifest and measures built bytes.
- `tmp/client-bundle-budget/report.json` is ignored local evidence. It records the budget-config and manifest hashes, entry and route totals, largest chunks, every applied exception with measured bytes/ceilings/reason/expiry, dynamic edges, failures, and terminal status.

Do not use content-hashed filenames in the budget configuration. Do not use `manualChunks`, raise a warning threshold, or rename a chunk merely to make the gate green; those actions do not reduce what a user downloads.

## Commands

Run the complete production packaging gate:

```bash
pnpm build
```

To inspect only the client graph while iterating:

```bash
pnpm exec vite build
pnpm check:bundle-budgets
```

The checker requires a fresh manifest and built files. Missing or unreadable artifacts fail closed. Its evaluator tests are:

```bash
pnpm vitest run server/_core/client-bundle-budget.test.ts
```

## What is measured

- Entry JavaScript and entry CSS have separate gzip ceilings.
- Each named route is the unique static closure of its entry/page selectors, including imported JavaScript and CSS once.
- Every JavaScript artifact has default raw and gzip ceilings.
- Forbidden static selectors prove optional features have not leaked back into ordinary routes.
- Required dynamic edges prove the assistant, rich Markdown renderer, portfolio briefing, and report preview still split at their intended interaction boundaries.

The current Markdown renderer exception preserves supported Markdown, math, Mermaid diagrams, and syntax highlighting. It is allowed only behind verified dynamic boundaries and expires on the date in the budget file. Expiry is a mandatory review point, not an automatic increase.

## Changing a budget

1. Build the unchanged base and save the non-secret report values.
2. Identify the owning import path from the manifest; measure the affected entry and route closures.
3. Prefer removing an eager import or adding an interaction-level boundary when the feature is optional.
4. Run the relevant desktop/mobile browser journey and open the deferred feature, proving both the before-interaction absence and after-interaction load.
5. Change a threshold only for measured, supported behavior. Keep headroom bounded and explain any exception with an owner, raw/gzip ceilings, and expiry.
6. Run the evaluator tests, TypeScript, ordinary tests, full build, tracked serverless-bundle freshness, and diff checks.

Adding a dependency, removing supported rendering, changing public behavior, or modifying production delivery infrastructure requires its own task and approval; a bundle-budget edit does not authorize it.

## Failure triage

- **Missing selector:** the Vite graph or source owner changed. Update the selector only after confirming the same intended ownership.
- **Missing dynamic boundary:** an optional module became eager or moved. Restore the boundary and verify interaction behavior.
- **Route over budget:** inspect the route's file list in the report and trace the largest newly reachable imports.
- **Chunk over budget:** determine whether the chunk contains unrelated features that can be separated. An exception is the last bounded option and must expire.
- **Missing build artifact:** rerun the production client build; never treat stale output as evidence.

The generic Vite large-chunk warning may remain for a legitimately deferred governed renderer. The repository budget report is the authoritative pass/fail gate because it accounts for ownership, reachability, raw size, gzip size, and exception expiry.
