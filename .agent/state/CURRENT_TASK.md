# Current Task

- ID: EV-00
- Roadmap step: `EV-00`
- Title: Cost-path truthfulness remediation (audit F1–F13 + KF-013)
- Status: ACTIVE
- Owner: Claude Code
- Started: 2026-07-23
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2/.claude/worktrees/cost-path-audit-material-library-2bb482`
- Branch: `claude/cost-path-audit-material-library-2bb482`
- Base: canonical `origin/main` commit `8cd7e0a`
- Classification: Data-truthfulness / ingestion / report remediation (P0)
- Risk: provenance mislabelling in issued documents, benchmark keying changes, tenant-safe public-upsert invariants (KF-017 closure), pinned-hash MySQL evidence (LES-046), and preservation of the TR-09/TR-11/TR-13 contract tests.
- Retry budget: three evidence-based attempts per failure class.
- Human gates: shared/production migration application (0056–0058) and reseeding; cost-consultant approval for tier-ladder value changes and the proposed `libraryTiersForMkt01Tier` mapping; commit/push/merge/deploy per repository policy.

## Goal

Fix all thirteen findings of the 2026-07-23 source-to-output cost-path audit plus open `KF-013`, under the four owner decisions recorded in ADR-0009 and ADR-0010: `material_library` stays authoritative with labelled-assumption provenance; robots.txt is enforced strictly before every acquisition provider; finish/tier classification is deterministic and versioned; RFQ idempotency, registry pruning, a Graniti connector, and DOCX/client basis-label parity are in scope.

## Acceptance Criteria

- [x] Phase 1 — ADR-0009/ADR-0010 accepted and indexed; `tier-policy.ts` (v1 values verbatim) and `robots-policy.ts` (RFC 9309, fail-closed) with passing tests; label-derived `market-verified` stamping removed from `rfq-generator.ts`.
- [ ] Phase 2 — robots asserted before every provider including proxies; Bayut/PropertyFinder/SCAD-PDF bypasses removed; regression tests prove no provider runs on denial.
- [ ] Phase 3 — additive provenance columns on `material_library`; seed upsert keyed on unique `product_code`; MQI unpriced-allocation semantics match reconciliation; basis labels render in reconciliation output, PDF, DOCX, and client MQI card without forbidden public-claim strings.
- [ ] Phase 4 — RFQ `pricingSource` derives from row provenance; `insertRfqLineItemsForOrg` replaces the prior batch per (project, brief, org) in one transaction with guarded-MySQL proof; finish-schedule/RFQ call sites receive material_library-shaped rows; `PricingAnalytics.pricingSource` narrowed and cost basis exposed; `KF-013` closed.
- [ ] Phase 5 — evidence `finishLevel` set deterministically via tier-policy with model output demoted to `modelSuggestedFinishLevel`; per-item categories from static connectors; `CATEGORY_MAP` no longer pools material costs into floors; proposals stamped `benchmark-key-v2` with legacy keys served unchanged; `minEvidenceCount` aligned to the reject threshold; drifted v15 test replaced by real-function coverage.
- [ ] Phase 6 — registry rows resolved by id or slug so `lastSuccessfulFetch`/`consecutiveFailures`/`sourceRegistryId` are truthfully recorded on both scheduled paths; dead sources deactivated; URLs repaired; Graniti UAE connector registered under the strict robots gate.
- [ ] Final — full gate battery green; functional disposable-MySQL proof; artifact grep clean of forbidden strings; state files updated.

## Non-Goals

- Changing any tier-ladder threshold value, seed AED price, scoring weight, or financial assumption (cost-consultant gate).
- Implementing the `EV-01` evidence/price model or merging the material tables (`EV-03`).
- Applying migrations to shared/production databases, reseeding production, committing, pushing, merging, or deploying without explicit authorization.
- Modifying the regulatory acquisition path.

## Baseline

- Fresh `pnpm install --frozen-lockfile` in this worktree (node_modules was absent; the first background `pnpm check` failed on missing `tsc` and its exit status was masked by a pipe — recorded so the false green is not trusted).
- `pnpm check`: PASS (exit 0) at `8cd7e0a` plus Phase-1 files.
- `DATABASE_URL='' pnpm vitest run server/engines/tier-policy.test.ts server/engines/ingestion/robots-policy.test.ts`: PASS, 51/51.

## Next Action

Execute Phase 2 (strict robots enforcement in `connector.ts`, bypass removals, `connector-robots.test.ts`), then run the phase gate (`pnpm check`, targeted vitest, `DATABASE_URL='' pnpm test`, `pnpm audit:database-safety`, `pnpm build`).
