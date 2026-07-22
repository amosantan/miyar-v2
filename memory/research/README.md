---
title: Research Index
description: Provenance register for external research. Every entry carries date, topic, source URL, key finding, and a value rating.
tags:
  - type/research
  - domain/memory
  - project/miyar
  - status/active
type: index
updated: 2026-07-22
---

# Research Index

> **This file is canonical.** External research provenance has no other home in the repository.
> Its purpose is to stop the same question being researched twice, and to make every borrowed idea
> traceable to a source.

## Entry format

```markdown
### YYYY-MM-DD — <Topic>
- **Question:**
- **Sources:** URLs (required)
- **Key finding:**
- **Applied to:** file or decision it changed
- **Value:** high | medium | low
```

**Rule:** an entry without a source URL is not research, it is an assumption — record it as such.

---

## Entries

### 2026-07-22 — Obsidian as a second memory for AI agents

- **Question:** How should a persistent, cross-session "second memory" be structured for an agent working
  a software repository, and what makes such systems fail?
- **Sources:**
  - [Obsidian + Claude Code: The Second Brain That Makes AI Agents Actually Useful](https://pasqualepillitteri.it/en/news/962/obsidian-claude-code-second-brain-persistent-memory)
  - [claude-obsidian — self-organizing AI second brain (GitHub)](https://github.com/AgriciDaniel/claude-obsidian)
  - [Karpathy's LLM Wiki pattern](https://www.mindstudio.ai/blog/karpathy-llm-wiki-pattern-cut-claude-token-usage-95-percent)
  - [AI Agent Memory: Karpathy LLM Wiki and agentmemory in practice](https://akitaonrails.com/en/2026/05/18/ai-agent-memory-karpathy-llm-wiki-agentmemory/)
  - [How to Build Your AI Second Brain Using Obsidian + Claude Code](https://noahvnct.substack.com/p/how-to-build-your-ai-second-brain)
  - [Your Second Brain Is a Graveyard. Make It Agent Memory.](https://www.decodingai.com/p/llm-wiki-agent-memory)
- **Key finding:** Three convergent patterns.
  1. **Progressive disclosure** (Karpathy LLM Wiki): a small hot cache → an index → drill-down pages.
     Agents should never load the whole corpus; recall cost must stay flat as the corpus grows.
  2. **MECE structure with a closed tag list**: ~7 top-level folders maximum, consistent YAML
     frontmatter. Over-granular structures and free-form tags are the common failure mode.
  3. **Explicit session rituals**: an opening protocol that restores context and a closing protocol that
     captures what happened. Without a closing ritual the corpus silently stops growing.
  Also: plain markdown keeps the memory portable across agents (Claude, Codex, Gemini) — a direct
  requirement here, since Codex must read the same memory.
- **Applied to:** the `memory/` structure, [[memory/TAG_TAXONOMY|the tag taxonomy]], the hot cache in
  [[memory/README|README]], and the session-close design.
- **Value:** high

### 2026-07-22 — Repo-root vault noise (measured)

- **Question:** Can an Obsidian MCP vault safely point at a software repository root?
- **Sources:** Direct measurement of this repository and of `/Users/amrosaleh/Projects/Trading`;
  prior art in `/Users/amrosaleh/Projects/Trading/.claude/rules/06-mcp-toolkit.md`.
- **Key finding:** Yes, **but only with enforced scoping.** Live `get_vault_stats` reports 654 indexed
  notes: **193 canonical, 438 (67%) stale `.claude/worktrees/` duplicates, 0 from `node_modules`.**
  mcpvault skips `node_modules` by default but honours nothing else — `.venv` is fully indexed in the
  Trading vault (6/6 control hits), and `.claude/worktrees/` is not skipped despite being git-excluded.
  The worktree duplicates are the real hazard: an unscoped probe returned the *same* document at ranks
  1, 2 and 3 from three checkouts. Scoped with `excludePaths`, the same query returned 6/6 canonical hits.
  The SentinelTrader vault hit this same wall and answered it with "recall discipline" plus a
  no-duplication guardrail.
- **Applied to:** [[memory/context/obsidian-recall-discipline|Recall Discipline]] and the mandatory
  `excludePaths` list.
- **Value:** high
- **Correction:** an earlier draft of this entry (written from disk counts, before the server was live)
  claimed ~93% noise driven by `node_modules`. Measuring the running server disproved it. Kept visible
  rather than overwritten — see the correction discipline in `docs/runbooks/memory-sync.md`.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Related:** [[memory/domain/README|Domain Knowledge]], [[memory/decisions/README|Decision Index]]
