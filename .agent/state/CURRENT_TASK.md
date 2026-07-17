# Current Task

- ID: UX-01
- Roadmap step: `UX-01`
- Title: Release the warm architectural UX to production
- Status: ACTIVE
- Owner: Codex
- Started: 2026-07-17
- Branch: `codex/miyar-ux-redesign`
- Base: `ae2cfed`
- Prior production application commit: `1f8c97d288ce97315664229049db3db38ec65bb2`
- Risk: Critical release with additive production schema, protected-branch integration, route compatibility, and user-facing deployment
- Selected loops: Release decision loop and schema migration loop
- Retry budget: 3 evidence-based preflight attempts per failure class; no automatic retry after a failed production migration or deployment
- Resource budget: One user-authorized production release window
- Approver: User authorization in the active Codex task on 2026-07-17

## Goal

Publish UX-01 as an exact, reproducible production release: replace safely removable specialist implementations with compatibility redirects, apply additive migration 0048, commit and push the verified branch, integrate it into canonical main, deploy the exact commit, and certify the live application.

## Compatibility Decision

- Existing bookmarks must not become 404s.
- Route removal means removing redundant page implementations only where the same capability already exists in the four-section workspace.
- Removed implementations remain compatibility aliases that preserve project ID and query parameters.
- Specialist workflows not yet represented inside the workspace remain registered.

## Acceptance Criteria

- [x] `/projects/:id/evidence`, `/projects/:id/explainability`, and `/projects/:id/space-planner` redirect to the corresponding workspace section/view without losing existing query parameters.
- [x] Every other supported project and admin route remains available and authorized.
- [x] Migration 0048 is confirmed additive/backward compatible, a production recovery point is recorded, and the column shape/default/nullability is verified after apply.
- [x] The release diff is reviewed and all mandatory local gates remain green.
- [ ] The scoped files are staged, committed, pushed, and integrated into canonical `main` without discarding unrelated history.
- [ ] Production deploys the exact integrated commit and reports `READY`.
- [ ] Health, unauthenticated authorization, invalid-share privacy, authenticated homepage/dashboard/project/admin/theme/RTL, and readiness smoke checks pass.
- [ ] Release identity, migration evidence, deployment ID, rollback position, and residual risks are recorded.

## Non-Goals

- Removing specialist routes whose functionality is not yet represented in the workspace.
- Changing scoring, financial, prediction, tenant-isolation, public-share, evidence, or report contracts.
- Destructive schema rollback; migration 0048 remains in place if application rollback is needed.

## Rollback

- Application rollback target: prior known-good production commit `1f8c97d288ce97315664229049db3db38ec65bb2`.
- Migration 0048 is nullable and additive; leave it in place during application rollback.
- Stop and transfer to incident handling for authentication, tenant-isolation, data-integrity, or critical workflow regressions.

## Next Action

Commit and push the immutable release candidate, integrate it into canonical main, deploy that exact application commit, and run production certification.

## Migration Evidence

- Target: production `miyar-v2` on Vitess 8.0.42, explicitly authorized by the user.
- Preflight: migration 0047 marker present; `inputProvenance` absent; 11 project rows.
- Recovery snapshot: encrypted AES-256-GCM affected-table snapshot outside the repository, 11 rows, decryption verified, SHA-256 `913e526c6dc68e5f793a65ce2e6b40793930224d2719f98ede3251f97f2324ef`.
- Applied: `0048_youthful_morlocks` from `2026-07-17T14:00:13.395Z` to `2026-07-17T14:00:14.591Z`.
- Integrity: project count remained 11; `inputProvenance` is nullable JSON with no default at ordinal 73; all 11 legacy projects remain null and therefore use the explicit legacy-compatibility policy.
- Recovery: leave the additive nullable column in place and redeploy prior application commit `1f8c97d288ce97315664229049db3db38ec65bb2` if application rollback is required.
