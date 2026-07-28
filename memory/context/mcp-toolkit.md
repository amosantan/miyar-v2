---
title: MCP Toolkit — MIYAR
description: Which MCP servers are relevant to MIYAR work, what each is for, and known-stale entries to avoid.
tags:
  - type/reference
  - domain/infrastructure
  - project/miyar
  - status/active
  - source/repo
type: reference
updated: 2026-07-22
---

# MCP Toolkit — MIYAR

> Machine-local configuration lives in `~/Library/Application Support/Claude/claude_desktop_config.json`.
> That file is **not** in this repository and is not portable — treat this note as a description of intent,
> and verify against the live tool list before relying on any server.

## Relevant to MIYAR

| Server | Purpose | Notes |
| --- | --- | --- |
| **obsidian-miyar** | Recall lens over this repository's memory | mcpvault, headless. Vault root = repo root → **always scope**. See [[memory/context/obsidian-recall-discipline\|Recall Discipline]]. |
| **obsidian-trading** | Recall lens over the SentinelTrader vault | Cross-project context only. Same scoping discipline applies. |
| **obsidian-ceo-daily** | SANZEN CEO vault | Confidential business material. **Do not copy its contents into this repository** — `memory/` is git-tracked. |
| **firecrawl** | Web search, scrape, extract | Primary web research tool. Record findings in [[memory/research/README\|Research Index]] with URLs. |

## Known-stale entries

- **`obsidian-rest-trading`** — still present in the machine-local config, but the SentinelTrader rules
  record it as **removed on 2026-07-04**: it depends on the Obsidian desktop app running a REST plugin on
  `127.0.0.1:27123`, so it is dead whenever the app is closed, and it duplicates mcpvault. Do not attempt
  to use it. Flagged for removal; left in place pending Amro's decision.

## Discipline

- Verify a server is actually connected before planning around it. A name in a config file is not a
  working capability.
- Servers requiring interactive OAuth cannot be authorised from a non-interactive session.
- Never copy credentials, tokens, or confidential vault content into `memory/` — this tree is
  git-tracked. See the Local Credential Convention in `AGENTS.md`.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Related:** [[memory/context/obsidian-recall-discipline|Recall Discipline]], [[memory/projects/miyar|MIYAR]]
