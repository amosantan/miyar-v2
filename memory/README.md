---
title: MIYAR Second Memory — Hot Cache and Index
description: Entry point to MIYAR's second memory. Read this first; drill into deep notes only when needed.
tags:
  - type/index
  - domain/memory
  - project/miyar
  - status/active
type: index
updated: 2026-07-22
---

# MIYAR Second Memory — Hot Cache & Index

> **Read this file first.** It is the hot cache: enough to work from, with links into the deep notes and
> the canonical repository files. Do not load the whole tree — drill down only when a question needs it.

## What this is (and is not)

The second memory is a **git-tracked `memory/` tree** plus the **`obsidian-miyar` recall lens** over it.

- It is **context**, never authority. Deterministic TypeScript remains the numerical authority.
- It is **not** a separate store. Recall through the lens; write only to canonical markdown homes.
- It is plain markdown so [[memory/people/codex|Codex]] can read it with ordinary file tools.

## 🔑 The anti-drift rule

**`memory/` owns only what the repository does not already own. Everything else is a pointer.**
A copied fact drifts, and a drifted fact lies.

| Knowledge | Canonical home | `memory/` role |
| --- | --- | --- |
| Durable rules | `AGENTS.md` | pointer |
| Ordered steps and status | `.agent/state/ROADMAP.md` | pointer |
| The one active task | `.agent/state/CURRENT_TASK.md` | pointer |
| Verified repository facts | `docs/PROJECT_STATE.md` | pointer |
| Reproduced failures | `.agent/state/KNOWN_FAILURES.md` | pointer |
| Durable lessons | `.agent/state/LESSONS.md` | pointer |
| Architecture decisions | `docs/decisions/` | index + rationale |
| **Terms and acronyms** | — | **canonical →** [[memory/glossary\|glossary]] |
| **People and directives** | — | **canonical →** [[memory/people/amro\|people/]] |
| **UAE domain knowledge** | — | **canonical →** [[memory/domain/README\|domain/]] |
| **Research provenance** | — | **canonical →** [[memory/research/README\|research/]] |
| **Session narrative** | — | **canonical →** [[memory/journal/README\|journal/]] |

## Index

| Note | Holds |
| --- | --- |
| [[memory/glossary\|glossary]] | Decoder ring: roadmap ID families, MQI, DLD/RERA/SREC/PDPL, process terms |
| [[memory/TAG_TAXONOMY\|TAG_TAXONOMY]] | The closed tag list every memory note must use |
| [[memory/projects/miyar\|projects/miyar]] | What MIYAR actually is + the identity correction |
| [[memory/people/amro\|people/amro]] | Working style and standing directives |
| [[memory/people/claude-code\|people/claude-code]] | This agent's memory obligations and mechanisms |
| [[memory/people/codex\|people/codex]] | What Codex can and cannot do here |
| [[memory/context/obsidian-recall-discipline\|context/obsidian-recall-discipline]] | **How to search without drowning in noise** |
| [[memory/context/mcp-toolkit\|context/mcp-toolkit]] | Relevant MCP servers, and known-stale ones |
| [[memory/domain/README\|domain/]] | UAE market and regulatory knowledge |
| [[memory/research/README\|research/]] | External research provenance with sources |
| [[memory/decisions/README\|decisions/]] | Decision index + rejected alternatives |
| [[memory/journal/README\|journal/]] | Per-session record |

## Quick decode

| Term | Meaning |
| --- | --- |
| **MIYAR** | UAE design-decision intelligence platform (**not** an academic business plan — see [[memory/projects/miyar\|project note]]) |
| **MQI** | Material Quantity Intelligence |
| **Typology pack** | Governed per-typology bundle of UAE assumptions and regulatory sources |
| **DLD / RERA / SREC** | Dubai Land Department / its regulatory arm / Sharjah's registration department |
| **PDPL** | UAE Personal Data Protection Law (Federal Decree-Law No. 45/2021) |
| **TR / BR / EV / SC / DI / EX / UX / RM** | Roadmap step families → [[memory/glossary\|glossary]] |

## Recall: always scope your search

The vault root is the repository root, so **an unscoped search is broken**. Measured against the live
server on 2026-07-22: of 654 indexed notes, only **193 are canonical** — **438 (67%) are stale
`.claude/worktrees/` duplicates** that look legitimate and outrank the original. mcpvault skips
`node_modules` but honours nothing else, `.gitignore` included.

- **Targeted:** `pathPrefix: "memory"` · `".agent/state"` · `"docs"` · `"docs/decisions"`
- **Broad:** `excludePaths: [".claude/worktrees", "node_modules", "dist", "drizzle", "client", "server", "shared", "tests", "e2e", "scripts", "api", "patches"]`

Full rules and the measurements behind them: [[memory/context/obsidian-recall-discipline|Recall Discipline]].

## Session protocol

**At start** — read `AGENTS.md`, `docs/PROJECT_STATE.md`, `.agent/state/KNOWN_FAILURES.md`,
`.agent/state/ROADMAP.md`, `.agent/state/LESSONS.md`, then this file. Run a scoped recall before changing
anything.

**During** — when a new term, person, domain fact, research finding, or decision appears, write it to its
canonical home immediately.

**At close** — the `SessionEnd` hook records objective facts automatically. Run `/miyar-memory` for the
interpretive pass. Full procedure: `docs/runbooks/memory-sync.md`.

## Never put in here

Secrets, credentials, tokens, production data, or confidential SANZEN/CEO material. **This tree is
git-tracked.**

---

## Linked notes

- **Contract:** `AGENTS.md` · `docs/runbooks/memory-sync.md` · `docs/runbooks/roadmap-execution.md`
- **People:** [[memory/people/amro|Amro]], [[memory/people/claude-code|Claude Code]], [[memory/people/codex|Codex]]
- **Project:** [[memory/projects/miyar|MIYAR]]
