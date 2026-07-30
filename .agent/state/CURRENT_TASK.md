# Current Task

- ID: EV-02R
- Roadmap step: `EV-02R`
- Title: Evidence and approval remediation for 43 unresolved material rows
- Status: PASS
- Owner: Codex
- Started: 2026-07-30
- Base: canonical `origin/main` at `52d02b649795a3862cc4b4da505a2aced7742f8e`
- Worktree: `/Users/amrosaleh/Maiyar/miyar-v2-ev02-unresolved-remediation`
- Branch: `codex/ev02-unresolved-remediation`
- Classification: Critical — production evidence, governed pricing, and data backfill
- Dependencies: `EV-02` and `EV-03` (`CLOSED`)

## Goal

Produce an evidence-backed decision package for the exact 43 EV-02 unresolved
`material_library` rows, obtain explicit row-level approval or rejection, and
backfill only approved governed facts without changing legacy prices or treating
missing information as zero.

## Acceptance Criteria

- [x] A reader-only production inventory reproduces exactly 43 rows: 37
      `unknown_unit_basis` and six `incomplete_price_range`, bound to the
      original EV-02 manifest and a deterministic source-row fingerprint.
- [x] Every packet row includes the complete legacy source row, current
      product link, reason, usage/financial impact, and either a proposed
      canonical product/specification/scope/geography/effective date or an
      explicit reason that no material mapping applies, plus evidence
      references/digests, required approver, and decision state.
- [x] Unit basis is accepted only from authoritative supplier, manufacturer,
      or official-statistics evidence. Product names, categories, typical
      units, neighboring rows, and AI output are never sufficient proof; no
      unresolved unit was promoted.
- [x] An incomplete legacy range is never repaired by copying the present bound
      or inventing a spread. It requires a new complete governed benchmark or
      quote with independent provenance; all six remain `needs_evidence`.
- [x] The recorded human decision is bound to the exact inventory digest,
      applies only the 24 approved rejections, leaves the other 19
      `needs_evidence`, and carries zero governed writes.
- [x] No backfill is executable because the approved governed-write set is
      empty. The decision recorder fails closed on packet drift and emits an
      owner-only, digest-bound decision artifact.
- [x] No governed write occurred. The original legacy material rows remain
      unchanged; rejection preserves the source row while making it ineligible.
- [x] Rejected and unproven rows remain explicit insufficiencies; no missing
      value becomes AED 0 and no ambiguous mapping enters scoring, RFQ, report,
      or issued totals.
- [x] Targeted tests, TypeScript, authorization/database-safety audits, full
      DB-free suite, build, comparison/reconciliation coverage, complete diff
      review, and independent MIYAR Sol review pass. Production-shape
      apply/recovery is not applicable to an empty write set. Three bounded
      Claude attempts returned no verdict; the owner explicitly approved
      closure with that limitation recorded.
- [x] Production backfill and application deployment are not applicable because
      this disposition creates no governed facts and changes no runtime
      application behavior. Git publication/merge is separately authorized.

## Non-Goals

- Do not change pricing policy, scoring weights, benchmark thresholds, or the
  EV-03 resolver ranking.
- Do not infer evidence from the old seed file or from generic market norms.
- Do not mutate or delete legacy material rows.
- Do not approve a row merely because another style/tier row looks similar.
- Do not block EV-04 permanently; this owner-directed remediation temporarily
  precedes it.

## Human Gates

- Row-level decision: Amro Saleh accepted the Data owner and
  Decision-model/Product roles and approved the 24 recommended rejections on
  2026-07-30. The remaining 19 explicitly stay `needs_evidence`; no governed
  mapping or value is approved.
- Shared/production backfill: authorized in principle by the 2026-07-30
  instruction, but executable only for rows whose exact packet entries receive
  explicit approval and after recovery evidence passes.
- Git publication, merge, and deployment remain governed by the repository
  release gate and the exact reviewed diff.

## Execution Controls

- Retry budget: three evidence-based attempts per failure class.
- Provider, research, test, build, migration, and backfill operations require
  explicit timeouts.
- Production discovery is reader-only and writes only owner-mode local
  artifacts outside the repository.
- Stop immediately for source ambiguity, tenant leakage, credential exposure,
  target drift, changed row fingerprints, or a production result outside the
  approved packet.

## Next Action

EV-02R is closed. Start EV-04 in a fresh worktree. The 19 residual rows remain
insufficient and may be reconsidered only through a future evidence-backed
packet: six exact supplier quotes or approved non-retail benchmarks, the raw
official-statistics source with digest for nine rows, and a separately approved
unit-contract decision for four per-m³/per-tonne rows.

## Handover evidence

- Reader-only production inventory passed once for the exact governed target:
  43 rows, 37 unknown-unit and six incomplete-range, packet SHA-256
  `6c2e244d3fb5f6d8d53e253c3b7a767ed9f8d0cc1a18d4db22c79240a50271ce`.
- The row-level packet recommends 24 non-material rejections, six
  quote-required tile decisions, nine unit-proven but source-digest-gated
  mappings, and four unsupported-unit decisions. No row is approved.
- Amro Saleh accepted the Data and Decision-model/Product owner roles and
  approved the 24 rejection decisions. The resulting owner-only decision
  packet contains 24 rejected, 19 `needs_evidence`, zero approved, and SHA-256
  `662c3933f10d651e77ac9b233bf8c021311feee25d49b560bd258c80c9f84160`.
- Focused tests pass 28/28; DB-free suite passes 1,819 with 22 skipped;
  TypeScript, strict script compilation, material-price authority 16 paths,
  authorization 390/0, database safety 142/2/0, production build and bundle
  budgets, and diff hygiene pass.
- Independent MIYAR review of the final decision-recording diff returned
  `APPROVED / NO OBJECTION` after its stale observation-metadata finding was
  corrected. Claude was invoked three bounded times during packet preparation
  but returned no usable verdict (one provider 529 and two tool-schema 400
  responses).
- Owner approval on 2026-07-30 closes EV-02R with 24 rejected, 19 residual
  `needs_evidence`, zero approved mappings, and zero production writes.
