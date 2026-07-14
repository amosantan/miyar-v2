# Current Task

Only one active long-running task may be recorded here. Short single-turn work does not need persistence. Completed task history belongs in Git and concise entries in `WORKLOG.md`.

- ID: REPO-ORGANIZATION-2026-07-14
- Title: Organize repository structure and remove generated clutter
- Status: PASS
- Owner: Codex
- Started: 2026-07-14
- Risk: Medium
- Selected loop: `docs/loops/feature.md`
- Approval gates: Preserve user content; do not publish without explicit authorization

## Goal

Create a professional, navigable repository layout in which canonical files, active agent resources, archived evidence, business artifacts, source code, and generated/local files have clear homes.

## Non-Goals

- Do not redesign application modules or change runtime behavior.
- Do not alter the content of user-authored binary documents.
- Do not include secrets, build outputs, editor state, or temporary files in Git.

## Acceptance Criteria

- [x] Root contains only canonical repository files and required tool configuration.
- [x] Historical material lives under `docs/archive/` and is non-authoritative.
- [x] Business documents are grouped under `docs/artifacts/` by purpose.
- [x] Active and historical agent resources are separated.
- [x] Generated/local clutter is removed or ignored without losing user content.
- [x] All active path references and documentation links are updated.
- [x] Relevant structural, type/build, and diff checks are recorded.

## Plan

- [x] Inventory tracked, untracked, ignored, generated, and historical files.
- [x] Move files into the target structure while preserving content.
- [x] Update documentation, configuration, ignore rules, and references.
- [x] Validate repository structure and application tooling.
- [x] Record the terminal state and remaining risks.

## Evidence

- Baseline: Application checks are already red as recorded in `KNOWN_FAILURES.md`; root mixes archives, binary artifacts, build outputs, editor metadata, and temporary files.
- Changed files: Root/archive/agent relocations; `server/serverless/index.ts`; data import paths; repository maps, archive/artifact policies, ignore rules, state, and generated `api/index.js`.
- Commands: Inventory/reference scans; Prettier check; active Markdown link checker; secret-like pattern scan; `pnpm build`; `pnpm check`; `pnpm test`; structural assertions; `git diff HEAD --check`.
- Manual/artifact verification: Root, `docs/`, and `.agent/` trees inspected; all six Office artifacts preserved in categorized ignored folders; PlanetScale binary preserved under ignored `.local/bin/`; active legacy-path scan returned no matches.
- Remaining risks: `pnpm check` remains red and `pnpm test` retains the recorded 9 failures. User-owned migration `0044` changes remain untouched. The generated API bundle remains committed because current deployment configuration targets `api/index.js`.

## Attempts and Recovery

| Attempt | Hypothesis                                                                                             | Action                                                     | Evidence                                                                      | Result |
| ------: | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
|       1 | Root clutter is primarily archival/generated rather than application architecture                      | Classify and relocate without changing runtime directories | Root/reference inventory                                                      | PASS   |
|       2 | Moving the serverless source under `server/` can preserve deployment behavior through the build target | Update source imports and build command; rebuild bundle    | `pnpm build` exit 0                                                           | PASS   |
|       3 | Existing red gates should reproduce without new path-related failures                                  | Run type-check and full test suite                         | Same recorded TypeScript groups and 9 test failures; no moved-path regression | PASS   |

## Next Action

No further action for this task. Review the diff before any commit; address recorded application failures in separate bugfix loops.
