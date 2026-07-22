@AGENTS.md

# Claude Code Adapter

`AGENTS.md` is the shared canonical contract. Do not duplicate project facts here.

## Claude-Specific Behavior

- For complex cross-layer, authorization, data/schema, scoring, report, release, or independently investigable work, load `.agent/skills/miyar-plan-orchestrator/SKILL.md` and start in Plan Mode when available. Otherwise follow its read-only plan gate before editing.
- Use `/memory` to confirm this file and `AGENTS.md` were loaded when instructions appear inconsistent.
- Store path-specific Claude rules in `.claude/rules/`; keep multi-step reusable work in skills or `docs/loops/`.
- Treat Claude auto-memory as local convenience, never as repository authority.
- Read `.agent/state/ROADMAP.md` and `.agent/state/LESSONS.md` before planning roadmap work; use the single `Next executable step` unless the user explicitly reprioritizes.
- Follow `docs/runbooks/roadmap-execution.md` so Codex and Claude Code update step status, completion evidence, handover, and lessons identically.
- Use hooks for mechanical enforcement; prose instructions are not an enforcement boundary.
- At handover, update repository state files only when verified facts changed.
