# Current Task

- ID: SC-01
- Roadmap step: `SC-01`
- Title: Split the design router by bounded domain
- Status: PASS
- Owner: Codex
- Started: 2026-07-19
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-sc01`
- Branch: `codex/sc-01-split-design-router`
- Base: exact commit `1169fed5e9036bd754cfcb79a7619933515d7f00` plus the copied, reviewed, uncommitted TR-13 candidate state
- Classification: API / architecture refactor
- Risk: High — the current design router is a large authorization boundary with public-share and tenant-sensitive procedures
- Selected loop: Feature/refactor loop with API, authorization, workflow, and independent-review gates
- Retry budget: Maximum 3 evidence-based attempts per unchanged failure class; every retry must use a new hypothesis
- Resource budget: One isolated worktree, bounded static inventory, focused router contracts, ordinary DB-free suite, and guarded TR-13 workflow only when a disposable loopback database is available
- Human gates: Breaking public contract, schema/migration, dependency, scoring/financial/compliance change, Git publication, shared database/configuration, preview, or deployment remain separately gated

## Goal

Split `server/routers/design.ts` into small domain-owned router modules while preserving the existing composed `design.*` public API, authorization behavior, validation, response shapes, and deterministic product behavior.

## Plain-English Problem

The design router currently mixes many unrelated jobs—assets, briefs, boards and visuals, materials, collaboration, market context, and public sharing—in one very large file. That makes ownership unclear and increases the chance that a safe change in one area accidentally weakens authorization or breaks another area. SC-01 changes the internal file boundaries, not the product contract.

## Acceptance Criteria

- [x] Every existing `design.*` procedure name remains present exactly once with the same query/mutation kind, input contract, authorization class, output contract, and public/private boundary.
- [x] Asset, brief, board/visual, material/procurement, collaboration, market-context, and sharing procedures live in bounded modules with clear ownership.
- [x] `server/routers/design.ts` becomes a small compatibility composition boundary rather than a second implementation copy.
- [x] Shared schemas/helpers are extracted only when they are genuinely shared; no circular import or cross-domain ownership ambiguity is introduced.
- [x] Public shares remain read-only, token-gated, expiry-aware, rate-limited, concealed, privacy-header protected, and free of token-bearing authenticated reads/logs/evidence.
- [x] Admin/member/viewer/foreign-organization authorization behavior remains unchanged, including project/resource ownership concealment.
- [x] No schema, migration, dependency, feature, numerical formula, scoring weight, financial assumption, compliance policy, route rename, or response-shape change occurs.
- [x] A generated contract inventory/snapshot proves exact pre/post procedure parity and rejects duplicates, omissions, kind drift, or authorization-class drift.
- [x] Focused router/authorization/share tests, TypeScript, ordinary DB-free full suite, authorization audit, database-safety audit, build and tracked serverless freshness, diff review, and independent security/architecture reviews pass.
- [x] TR-13 critical sharing/runtime workflow passes against disposable loopback MySQL with strict cleanup.
- [x] Roadmap, current task, worklog, lessons, architecture/project state, and known failures change only where verified reality changes.

## Non-Goals

- No public API cleanup or procedure renaming.
- No new capability, UI redesign, engine rewrite, database helper rewrite, schema work, migration, or data operation.
- No unification of structured briefs, AI-advisor briefs, and stored reports.
- No runtime capability/observability design owned by `SC-05`.
- No commit, stage, push, pull request, merge, preview, or deployment without separate authorization.

## Architecture Assumptions

- Compatibility composition may use router record merging only if tRPC procedure identity and middleware chains remain intact.
- Authorization procedures remain attached to each procedure at definition time; composition must not wrap or weaken them.
- Domain modules may depend on stable shared authorization/database/engine helpers, but must not depend on the compatibility composition module.
- TR-13 is the stacked behavioral baseline even though Git publication remains gated.

## Execution Plan

- [x] Create and verify a fresh SC-01 worktree before task edits.
- [x] Stack the exact reviewed TR-13 working-tree candidate without modifying or committing its source worktree.
- [x] Inventory procedures, helpers, imports, dependency clusters, and current public contract.
- [x] Design bounded module ownership and add a failing/exact contract-parity guard.
- [x] Extract domains incrementally with focused verification after each coherent group.
- [x] Run complete static, unit, authorization, audit, build, workflow, diff, and independent-review gates.
- [x] Close SC-01 with exact evidence and no unexplained artifacts.

## Completion Evidence

- Fresh worktree created first at `/Users/amrosaleh/Maiyar/miyar-v2-sc01` on `codex/sc-01-split-design-router` from exact commit `1169fed5e9036bd754cfcb79a7619933515d7f00`.
- The reviewed TR-13 working-tree state was copied into SC-01 while the original `/Users/amrosaleh/Maiyar/miyar-v2-tr13` remained unchanged and uncommitted.
- The live monolith contained 63 procedures: 29 queries and 34 mutations. Eight bounded routers now own each procedure exactly once; the compatibility facade is 21 lines and retains flat `design.*` paths.
- The immutable pre-split baseline fingerprints every initializer, access primitive, authorization classification, runtime operation, and middleware chain; its default checker and the runtime owner-identity test pass.
- Focused authorization/share/privacy/source contracts pass 98 tests; the ordinary DB-free suite passes 1,257 with 22 skipped; `pnpm check`, authorization inventory 338/0, database-safety 112/2/0, build, byte-stable serverless regeneration, and `git diff --check` pass.
- Guarded disposable-MySQL verification passes 21 configured tests, including all 19 design-authorization cases. `pnpm certify:workflow` passes real MySQL, Node/serverless parity, report rendering, serial browser, secret-scan, revocation/concealment, and strict cleanup gates; both disposable containers were removed.
- Independent GPT-5.6 Sol security and GPT-5.6 Terra architecture reviews returned `APPROVED_NO_OBJECTION`. Claude Opus review is recorded with the final closure evidence.
- No known failure was opened; the first optional authorization-harness attempt failed only because its documented pre-created database prerequisite was absent, then passed after creating the bounded disposable database.

## Next Action

SC-01 is locally closed at `PASS`. Begin only the roadmap's next executable step in a fresh worktree; Git publication and every shared/production action remain separately gated.
