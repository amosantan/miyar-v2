---
description: Run the test suite and verify all tests pass
---
# Run Tests
1. Run `pnpm test` from the project root
2. Confirm results against baseline: 800 pass / 830 total (8 pre-existing fail, 22 skip) as of MIYAR 3.0 Phase B
3. Pre-existing failures are documented in `PROGRESS.md` — do not investigate these, they are known
4. Any NEW failures introduced by your change must be resolved before proceeding
5. After completing any phase, record the new total in `PROGRESS.md`, `miyar-memory.md`, and `coding-conventions.md` — it becomes the next baseline
