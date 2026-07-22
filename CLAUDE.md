@AGENTS.md

# Claude Code Adapter

`AGENTS.md` is the shared canonical contract. Do not duplicate project facts here.

## Claude-Specific Behavior

- Use plan mode before high-risk, cross-layer, schema, authentication, scoring, or migration changes.
- Use `/memory` to confirm this file and `AGENTS.md` were loaded when instructions appear inconsistent.
- Store path-specific Claude rules in `.claude/rules/`; keep multi-step reusable work in skills or `docs/loops/`.
- Treat Claude auto-memory as local convenience, never as repository authority.
- Read `.agent/state/ROADMAP.md` and `.agent/state/LESSONS.md` before planning roadmap work; use the single `Next executable step` unless the user explicitly reprioritizes.
- Follow `docs/runbooks/roadmap-execution.md` so Codex and Claude Code update step status, completion evidence, handover, and lessons identically.
- Use hooks for mechanical enforcement; prose instructions are not an enforcement boundary.
- At handover, update repository state files only when verified facts changed.

## Second Memory (Claude-Specific Mechanics)

The contract is in `AGENTS.md`; the shared procedure is `docs/runbooks/memory-sync.md`. Only the Claude-specific mechanics belong here.

- `.claude/hooks/session-start.sh` (`SessionStart`) stamps `.claude/state/session_start.txt` and prints a live recall banner. Nothing in that banner is hardcoded; changing state is read at run time.
- `.claude/hooks/session-end.sh` (`SessionEnd`, and `PreCompact` with `--precompact`) appends objective facts only to `memory/journal/<today>.md`. It never interprets, never blocks, and writes nothing when nothing happened.
- Run `/miyar-memory` at session close for the interpretive pass. The hook records what happened; the skill records what it meant.
- Recall through the `obsidian-miyar` lens is read-only in intent: search scoped with `pathPrefix` or `excludePaths`, then write only to canonical markdown homes. The lens sees the main checkout, so branch work in `.claude/worktrees/` is invisible until merged.
