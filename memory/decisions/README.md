---
title: Decision Index
description: Navigable index of MIYAR decisions. Points at canonical ADRs and records the rationale that ADRs do not capture.
tags:
  - type/decision
  - domain/memory
  - project/miyar
  - status/active
type: index
updated: 2026-07-22
---

# Decision Index

> **This file is an index, not an authority.** Architecture decisions live in `docs/decisions/` as ADRs.
> Roadmap-step decisions live in `.agent/state/ROADMAP.md` and `.agent/state/LESSONS.md`.
> Never restate an ADR's content here — link to it.
>
> What this file *does* own: the **rejected alternatives and the reasoning** that a terse ADR or a closed
> roadmap step does not preserve, plus decisions that are not architectural enough to warrant an ADR.

## Canonical ADRs

| ADR | Subject |
| --- | --- |
| [ADR-0001](../../docs/decisions/ADR-0001-canonical-agent-documentation.md) | Canonical agent documentation |
| [ADR-0002](../../docs/decisions/ADR-0002-deterministic-decision-authority.md) | Deterministic decision authority |

See `docs/decisions/README.md` for the ADR process.

## Entry format

For decisions recorded here rather than as an ADR:

```markdown
### YYYY-MM-DD — <Decision>
- **Context:**
- **Decision:**
- **Rejected alternatives:** and why
- **Consequences:**
- **Evidence:**
- **Related:** roadmap step, ADR, or lesson ID
```

---

## Entries

### 2026-07-22 — Second memory is a git-tracked tree with an Obsidian recall lens

- **Context:** The repository already declares that "repository state is the durable memory"
  (`docs/runbooks/roadmap-execution.md`). But nothing owned terminology, people, domain knowledge,
  research provenance, or session narrative — exactly the context that is lost between sessions.
  Codex must be able to read whatever is built, and it has no Obsidian MCP.
- **Decision:** Create a git-tracked `memory/` tree as the canonical home for *only* the classes of
  knowledge the repository does not already own, and expose the repository through an `obsidian-miyar`
  mcpvault server used purely as a **read/search lens**. Enforce the session-close write with a
  `SessionEnd`/`PreCompact` hook, complemented by a `/miyar-memory` skill for the interpretive part.
- **Rejected alternatives:**
  - *A standalone vault outside the repository* — cleanest isolation, but Codex cannot read it, which
    breaks the core requirement that both agents share one memory.
  - *A curated `memory/`-only vault scope* — 100% signal and impossible to misuse, but the lens would lose
    recall over `docs/` (184 real knowledge files), the ADRs, `LESSONS.md`, and `PROJECT_STATE.md`. The
    scoping rules recover the signal at lower cost than the lost reach.
  - *Prose-only instruction to "update memory at session end"* — rejected on Amro's standing directive
    that drift-prone obligations must be enforced mechanically, and on `CLAUDE.md`'s own rule that prose
    is not an enforcement boundary.
  - *A nightly scheduled sync* — considered and deferred, not rejected. In-session capture is more
    accurate; a nightly transcript scan remains available as a later backstop layer.
- **Consequences:** Recall requires discipline — every search must be scoped. The lens sees only the main
  checkout, so branch work in a worktree is invisible until merged. Codex gets the contract but not the
  hook, and that asymmetry is documented rather than hidden.
- **Evidence:** live `get_vault_stats` — 654 indexed notes, 193 canonical, 438 (67%) worktree
  duplicates, 0 from `node_modules`; unscoped probe returned the same document at ranks 1–3 from three
  checkouts, while the scoped probe returned 6/6 canonical hits; 6/6 `.venv` control search in the
  Trading vault; prior art in `Trading/.claude/rules/06-mcp-toolkit.md`. Recorded in
  [[memory/research/README|Research Index]].
- **Related:** [[memory/context/obsidian-recall-discipline|Recall Discipline]]

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Related:** [[memory/research/README|Research Index]], [[memory/projects/miyar|MIYAR]]
