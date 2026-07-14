@AGENTS.md

# Claude Code Adapter

`AGENTS.md` is the shared canonical contract. Do not duplicate project facts here.

## Claude-Specific Behavior

- Use plan mode before high-risk, cross-layer, schema, authentication, scoring, or migration changes.
- Use `/memory` to confirm this file and `AGENTS.md` were loaded when instructions appear inconsistent.
- Store path-specific Claude rules in `.claude/rules/`; keep multi-step reusable work in skills or `docs/loops/`.
- Treat Claude auto-memory as local convenience, never as repository authority.
- Use hooks for mechanical enforcement; prose instructions are not an enforcement boundary.
- At handover, update repository state files only when verified facts changed.
