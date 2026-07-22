# Current Task

- ID: EV-00
- Roadmap step: `EV-00`
- Title: Cost-path truthfulness remediation (audit F1–F13 + KF-013)
- Status: NEEDS_HUMAN (implementation complete and verified locally; merge, shared migrations, and named sign-offs remain)
- Owner: Claude Code
- Started: 2026-07-23
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2/.claude/worktrees/cost-path-audit-material-library-2bb482`
- Branch: `claude/cost-path-audit-material-library-2bb482`
- Base: canonical `origin/main` commit `8cd7e0a`
- Classification: Data-truthfulness / ingestion / report remediation (P0)
- Risk: provenance mislabelling in issued documents, benchmark keying changes, tenant-safe public-upsert invariants (KF-017 closure), pinned-hash MySQL evidence (LES-046), and preservation of the TR-09/TR-11/TR-13 contract tests.
- Retry budget: three evidence-based attempts per failure class.
- Human gates: shared/production migration application (0056–0058) and production reseeding (material library provenance backfill-free defaults; source_registry slugs); cost-consultant approval for tier-ladder value changes and the proposed `libraryTiersForMkt01Tier` mapping; PR merge and deployment; KF-019 diagnosis owns the pre-existing certify:workflow browser-journey failure.

## Goal

Fix all thirteen findings of the 2026-07-23 source-to-output cost-path audit plus open `KF-013`, under the four owner decisions recorded in ADR-0009 and ADR-0010.

## Acceptance Criteria

- [x] Phase 1 — ADR-0009/ADR-0010 accepted and indexed; `tier-policy.ts` (v1 values verbatim) and `robots-policy.ts` (RFC 9309, fail-closed) with passing tests; label-derived `market-verified` stamping removed from `rfq-generator.ts`. (Commit `8a91472`)
- [x] Phase 2 — robots asserted before every provider including proxies; Bayut/PropertyFinder/SCAD-PDF bypasses removed; regression tests prove no provider runs on denial. (Commit `8a91472`)
- [x] Phase 3 — additive provenance columns on `material_library` (migration 0056); seed upsert keyed on unique `product_code`; MQI unpriced-allocation semantics match reconciliation; basis labels render in reconciliation output, PDF, DOCX, and client MQI card without forbidden public-claim strings. (Commit `7661f78`)
- [x] Phase 4 — RFQ `pricingSource` derives from row provenance; `insertRfqLineItemsForOrg` replaces the prior batch per (project, brief, org) in one transaction with guarded-MySQL proof; finish-schedule/RFQ call sites receive material_library-shaped rows; `PricingAnalytics.pricingSource` narrowed and `detailedBudget.costBasis` exposed; `KF-013` closed. (Commit `9592d7a`)
- [x] Phase 5 — evidence `finishLevel` set deterministically via tier-policy with model output demoted to `modelSuggestedFinishLevel` (migration 0057); per-item categories from static connectors; `CATEGORY_MAP` no longer pools material costs into floors; proposals stamped `benchmark-key-v2` with legacy keys served unchanged; `minEvidenceCount` aligned to the reject threshold; drifted v15 test replaced by real-function coverage. (Commit `a5efbc4`)
- [x] Phase 6 — registry rows resolved by id or slug (migration 0058) so `lastSuccessfulFetch`/`consecutiveFailures`/`sourceRegistryId` are truthfully recorded on both scheduled paths, proven on real MySQL; dead sources deactivated; URLs repaired; Graniti UAE connector registered and its robots.txt verified `ROBOTS_ALLOWED` under the strict gate. (Commit `6f1e119`)
- [x] Final — full gate battery green with per-step exit codes; `certify:workflow` documented as pre-existing-failed on canonical main (`KF-019`, reproduced at untouched base `8cd7e0a`); state files updated.

## Non-Goals

- Changing any tier-ladder threshold value, seed AED price, scoring weight, or financial assumption (cost-consultant gate).
- Implementing the `EV-01` evidence/price model or merging the material tables (`EV-03`).
- Applying migrations to shared/production databases, reseeding production, merging, or deploying without explicit authorization.
- Modifying the regulatory acquisition path.

## Baseline

- Fresh `pnpm install --frozen-lockfile`; `pnpm check` PASS at `8cd7e0a` (the first piped baseline was a false green — see LES-047).
- Targeted policy suites 51/51 at Phase 1.

## Final Verification Evidence (2026-07-23, commit `6f1e119`)

- `DATABASE_URL='' pnpm test`: PASS, 1,567 tests with 22 skipped (120 files).
- `pnpm test:authorization:mysql` (disposable loopback DB on the local MySQL server): PASS, 9 files / 46 tests, including migrations 0056–0058 forward application, the RFQ replace-contract proofs, and the EV-00 registry-linkage integration proof; TR03H evidence regenerated through the approved workflow; `pnpm check:mysql-evidence` current.
- `pnpm audit:authorization`: 389 procedures, 0 remediation rows (inventory re-rendered from live code; no classification changed).
- `pnpm audit:database-safety`: 123 entrypoints, 2 allowlisted, 0 findings.
- `pnpm check` and `pnpm build` (with regenerated tracked serverless bundle): PASS.
- `pnpm certify:workflow`: FAILS at `serial-node-browser-journey` (`spaceProgram.generate must succeed`) — reproduced identically at untouched canonical base `8cd7e0a`, so pre-existing; recorded as `KF-019` with a spawned diagnosis task. All certification stages before the browser journey pass on this tree, including the report render/inspect stage covering the Phase 3 changes.
- Live robots probe: `granitiuae.com` → `ROBOTS_ALLOWED` under `ingestion-robots-v1`.

## Next Action

Human gates: review/merge the EV-00 draft PR; separately authorize shared/production application of migrations 0056–0058 and the production seeder runs (material library provenance, source_registry slugs); obtain cost-consultant sign-off for the proposed `libraryTiersForMkt01Tier` v2 mapping (v1 ships behavior-preserving); pursue `KF-019` via its spawned diagnosis task.
