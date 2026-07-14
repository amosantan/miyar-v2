---
description: Run the test suite and verify all tests pass
---
# Run Tests

> Canonical verification policy: `docs/VERIFICATION.md`. Never trust a recorded count without running the current checkout.

1. Inspect `.agent/state/KNOWN_FAILURES.md` and the task's affected test area.
2. Run the smallest relevant targeted test first: `pnpm vitest run <test-file>`.
3. Run `pnpm check` for TypeScript changes.
4. Run `pnpm test` when shared behavior or the full regression gate is required.
5. Run `pnpm build` when production bundling/contracts may be affected.
6. Report exact exit results, failures, skips, and environment limitations.
7. Reproduce any claimed pre-existing failure; keep the full gate red until it actually passes.
8. Update `docs/PROJECT_STATE.md` and `.agent/state/KNOWN_FAILURES.md` only from direct evidence.
