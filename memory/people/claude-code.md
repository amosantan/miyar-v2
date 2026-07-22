---
title: Claude Code
description: This agent's role on MIYAR, its memory obligations, and the mechanisms that enforce them.
tags:
  - type/person
  - domain/memory
  - project/miyar
  - status/active
  - source/repo
type: person
updated: 2026-07-22
---

# Claude Code

**Role:** Coding agent on MIYAR, working alongside [[memory/people/codex|Codex]].
**Governed by:** `AGENTS.md` (canonical) via `CLAUDE.md` (Claude-specific adapter only).

## Memory obligations

1. **At session start** — read `AGENTS.md`, `docs/PROJECT_STATE.md`, `.agent/state/KNOWN_FAILURES.md`,
   `.agent/state/ROADMAP.md`, `.agent/state/LESSONS.md`, then [[memory/README|the memory hot cache]].
   Use scoped `obsidian-miyar` recall before making a change, to surface prior decisions and lessons.
2. **During the session** — when a new term, person, domain fact, research finding, or decision appears,
   write it to its canonical home immediately. Do not defer everything to the close.
3. **At session end** — the `SessionEnd` hook records the objective facts automatically. Run
   `/miyar-memory` for the interpretive part when the session produced anything worth remembering.

## Enforcement mechanisms

| Mechanism | Kind | What it does |
| --- | --- | --- |
| `.claude/hooks/session-start.sh` | `SessionStart` | Writes the session marker; prints a recall banner |
| `.claude/hooks/session-end.sh` | `SessionEnd` | Appends **objective** facts to today's journal |
| `.claude/hooks/session-end.sh --precompact` | `PreCompact` | Same, before context is compacted away |
| `.claude/skills/miyar-memory/SKILL.md` | `/miyar-memory` | The interpretive session-close cascade |

The hook/skill split is deliberate: **the hook is dumb, objective, and unskippable; the skill is
interpretive and deliberate.** The hook must never write narrative and must never block a session.

## Standing constraints

- `memory/` is context, never authority. Deterministic TypeScript remains the numerical authority
  (Product Invariants, `AGENTS.md`).
- Never copy a canonical fact into `memory/`; link to it. See the anti-drift table in
  [[memory/README|the hot cache]].
- Never claim a command passed unless it was run in the current checkout.
- Treat all pre-existing modified and untracked files as user-owned.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **People:** [[memory/people/amro|Amro]], [[memory/people/codex|Codex]]
- **Related:** [[memory/context/obsidian-recall-discipline|Recall Discipline]]
