---
title: Codex
description: The other coding agent on MIYAR. What it reads, what it cannot do, and how it participates in the second memory.
tags:
  - type/person
  - domain/memory
  - project/miyar
  - status/active
  - source/repo
type: person
updated: 2026-07-22
---

# Codex

**Role:** Coding agent working this repository alongside Claude Code.
**Governed by:** `AGENTS.md` directly (it is the canonical contract; `CLAUDE.md` is only Claude's adapter).

## Configuration in this repository

Codex subagents are defined in `.codex/agents/`:

| Agent | Sandbox | Purpose |
| --- | --- | --- |
| `miyar-scout` | `read-only` | Bounded discovery, evidence gathering, focused mechanical work |
| `miyar-reviewer` | — | Review |

`miyar-scout` is explicitly instructed to preserve tenant isolation, deterministic scoring, and
provenance rules, and not to modify user-owned work.

## What Codex can and cannot do with the second memory

| Capability | Codex | Claude Code |
| --- | --- | --- |
| Read `memory/` (git-tracked) | ✅ | ✅ |
| Write `memory/` | ✅ | ✅ |
| Follow the session-close protocol | ✅ (documented step) | ✅ |
| Obsidian recall lens (`obsidian-miyar`) | ❌ no MCP | ✅ |
| Mechanical hook enforcement | ❌ | ✅ `SessionEnd` / `PreCompact` |

**This asymmetry is deliberate and must stay honest.** Codex gets the *contract*; Claude Code
additionally gets the *mechanism*. For Codex, the session-close write is a protocol step in
`docs/runbooks/memory-sync.md`, not something the harness can enforce.

Because Codex has no recall lens, `memory/` must remain **plain, git-tracked markdown reachable by
ordinary file reads and grep**. Never make the second memory depend on Obsidian-only features
(graph, plugins, Bases, canvas) for its meaning.

## Interoperability rules

- Both agents write to the **same** canonical homes. There is no Codex memory and Claude memory.
- Handover happens through `.agent/state/` and `memory/journal/`, not through chat history.
- `AGENTS.md` is where any rule affecting both agents belongs.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **People:** [[memory/people/amro|Amro]], [[memory/people/claude-code|Claude Code]]
- **Related:** [[memory/glossary|Glossary]]
