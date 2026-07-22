---
title: Journal
description: Per-session record. Objective facts appended automatically by the SessionEnd hook; narrative added by the agent.
tags:
  - type/journal
  - domain/memory
  - project/miyar
  - status/active
type: index
updated: 2026-07-22
---

# Journal

One file per day: `memory/journal/YYYY-MM-DD.md` (UTC).

## Two kinds of content, never mixed

| Section | Written by | Content |
| --- | --- | --- |
| **Session narrative** | The agent, during or at close of session | What was attempted, what was decided, what was learned, what is next |
| **Machine record** | `.claude/hooks/session-end.sh` | Objective facts only — branch, commits, files touched, timestamps |

The hook writes **objective facts only**. It never interprets, never summarises, and never blocks a
session. If nothing objectively happened, it writes nothing — an empty session leaves no footprint and
produces no noise.

The narrative sits **above** the machine record in the same file. The hook appends; it never rewrites what
the agent wrote.

## Why both

The machine record survives an agent that forgets, crashes, or has its context compacted away. The
narrative carries the meaning the machine record cannot infer. Neither alone is sufficient.

`PreCompact` fires the same hook so that a long session's work is recorded *before* the context that
produced it is discarded, and the marker advances so the final `SessionEnd` does not duplicate it.

## Rules

- The journal is a **record**, not an authority. A decision only counts once it reaches
  [[memory/decisions/README|the decision index]] or an ADR; a lesson only counts once it reaches
  `.agent/state/LESSONS.md`.
- Never put secrets, credentials, tokens, or confidential SANZEN material here — this tree is git-tracked.
- Do not hand-edit the machine record blocks.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Related:** [[memory/decisions/README|Decision Index]], [[memory/people/claude-code|Claude Code]]
