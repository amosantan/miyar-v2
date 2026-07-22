---
title: Obsidian Recall Discipline — obsidian-miyar
description: How to search the MIYAR vault without drowning in node_modules and worktree duplicates. Mandatory scoping rules.
tags:
  - type/reference
  - domain/memory
  - project/miyar
  - status/active
  - source/repo
type: reference
updated: 2026-07-22
---

# Obsidian Recall Discipline — `obsidian-miyar`

> **The one-line rule:** the vault root is the repository root, so **an unscoped `search_notes` is
> broken**. Always scope. Recall through the lens; write only to canonical markdown homes.

## Why this exists (measured against the live server, 2026-07-22)

`get_vault_stats` on `obsidian-miyar` reports **654 notes / 575 folders / 33 MB**, against 2,770 `.md`
files on disk. Composition of what is actually indexed:

| Set | Notes | Share of index |
| --- | --- | --- |
| **Canonical — main checkout** | **193** | **30%** |
| Stale `.claude/worktrees/` duplicates | 438 | **67%** |
| `node_modules/` | 0 — not indexed | 0% |

**The worktree duplicates are the real threat, not dependency noise.** They are near-identical copies of
the canonical files, so they look legitimate and they outrank the original. Verified live: an unscoped
search returned `MIYAR_Technical_Blueprint_07_…` at ranks 1, 2 **and** 3 — the same document from the
main checkout and both worktrees. A separate unscoped query returned the same `CURRENT_TASK.md` twice
from two different worktrees.

### What mcpvault actually skips

- It **does** skip `node_modules` by default. Probed with an MIT-licence query that would match hundreds
  of `node_modules` files; zero were returned.
- It does **not** honour `.gitignore` generally. In the Trading vault, `.venv/lib/python3.13/site-packages/`
  is fully indexed — a `license copyright` query returned 6/6 hits from it.
- It does **not** skip `.claude/worktrees/`, even though that path is git-excluded here.

So: assume a narrow built-in skip list (`node_modules`) and **nothing else**. Any other directory you do
not want ranked must be excluded by you, at query time.

> **Correction, 2026-07-22.** This note originally claimed ~93% of the index was `node_modules` plus
> worktree copies, and that mcpvault "does not respect `.gitignore`" without qualification. Both were
> written from disk counts *before* the server was live. Measuring the running server disproved the
> `node_modules` half. The corrected figures are above. Recorded rather than silently overwritten, per the
> correction discipline in `docs/runbooks/memory-sync.md`.

This is the same class of failure the SentinelTrader vault hit and documented in
`/Users/amrosaleh/Projects/Trading/.claude/rules/06-mcp-toolkit.md`. MIYAR inherits the rule rather than
re-learning it.

## How to search

**Targeted recall — preferred.** Use `pathPrefix`:

| `pathPrefix` | Reaches |
| --- | --- |
| `memory` | This second memory: glossary, people, domain, research, decisions, journal |
| `.agent/state` | Roadmap, current task, lessons, known failures, worklog |
| `docs` | Architecture, product, verification, security, runbooks, specs, decisions |
| `docs/decisions` | ADRs only |

**Broad recall — when you genuinely do not know where a fact lives.** Use `excludePaths`:

```
[".claude/worktrees", "node_modules", "dist", "drizzle",
 "client", "server", "shared", "tests", "e2e", "scripts", "api", "patches"]
```

`.claude/worktrees` is first because it is the entry that actually matters — it strips the 67% of the
index that is stale duplicates. `node_modules` is belt-and-braces: mcpvault already skips it here, but
keeping it costs nothing and protects the list if that default ever changes.

**Never** issue a `search_notes` with neither `pathPrefix` nor `excludePaths`. If you catch yourself
reading a result path containing `.claude/worktrees/`, the search was wrong — re-scope and run it again
rather than reading the hit.

## Lens guardrail (No-Duplication)

`obsidian-miyar` is a **read/search lens over git-tracked memory — not a separate store.**

- Recall through the lens freely.
- **Write only to canonical markdown homes** (`memory/`, `.agent/state/`, `docs/`).
- Never create an Obsidian-only note that duplicates a fact owned by a canonical file. It will drift out
  of sync and then actively mislead a future session.

## Health checks

- **Negative control:** an unscoped search for a common repository phrase *should* return the same
  document more than once from different `.claude/worktrees/` paths. If it does not, either the worktrees
  are gone or the vault is not indexing what you think it is.
- **Positive control:** the same query with the `excludePaths` list above should return only
  main-checkout paths — zero `.claude/worktrees` hits. Verified 2026-07-22: 6/6 clean hits
  (`docs/PRODUCT.md`, `docs/audits/…`, `.agent/state/ROADMAP.md`).
- **Orphan check:** every file in `memory/` should be reachable by a wikilink from
  [[memory/README|Memory Hot Cache]]. Orphans never enter an agent's context.

## Server definition

Configured in `~/Library/Application Support/Claude/claude_desktop_config.json` (machine-local, not in
this repository):

```json
"obsidian-miyar": {
  "command": "/opt/homebrew/bin/npx",
  "args": ["-y", "@bitbonsai/mcpvault@latest", "/Users/amrosaleh/Maiyar/miyar-v2"]
}
```

The vault points at the **main checkout**, not at a worktree. Work done on a branch inside
`.claude/worktrees/` is not visible to the lens until it is merged — this is intentional.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Related:** [[memory/context/mcp-toolkit|MCP Toolkit]], [[memory/glossary|Glossary]]
