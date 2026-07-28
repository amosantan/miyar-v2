# Memory Sync Runbook

## Purpose

This runbook tells Codex, Claude Code, and human engineers how to use and maintain MIYAR's **second
memory** — the git-tracked `memory/` tree and the `obsidian-miyar` recall lens over it — without letting
it drift out of agreement with canonical repository state.

It complements `docs/runbooks/roadmap-execution.md`. That runbook governs execution state; this one
governs the durable context around it.

## What the second memory is

| | |
| --- | --- |
| **Is** | A curated, git-tracked `memory/` tree, plus a read/search lens over the repository |
| **Is not** | A separate store, a replacement for repository state, or any kind of authority |

Repository state remains the durable memory. The second memory adds the classes of knowledge the
repository never had a home for: terminology, people and directives, UAE domain knowledge, external
research provenance, and session narrative.

`memory/` is plain markdown so that **both** agents can read it with ordinary file tools. Nothing in it
may depend on Obsidian-only features for its meaning.

## The anti-drift rule

**`memory/` owns only what the repository does not already own. Everything else is a pointer.**

| Knowledge | Canonical home | `memory/` role |
| --- | --- | --- |
| Durable rules | `AGENTS.md` | pointer |
| Ordered steps and status | `.agent/state/ROADMAP.md` | pointer |
| One active bounded task | `.agent/state/CURRENT_TASK.md` | pointer |
| Verified repository facts | `docs/PROJECT_STATE.md` | pointer |
| Reproduced unresolved failures | `.agent/state/KNOWN_FAILURES.md` | pointer |
| Durable reusable learning | `.agent/state/LESSONS.md` | pointer |
| Completed handovers | `.agent/state/WORKLOG.md` | pointer |
| Architecture decisions | `docs/decisions/` | index + rationale |
| Permanent detailed history | Git commits | pointer |
| **Terms, acronyms, shorthand** | `memory/glossary.md` | **canonical** |
| **People, directives, working style** | `memory/people/` | **canonical** |
| **UAE market and regulatory knowledge** | `memory/domain/` | **canonical** |
| **External research provenance** | `memory/research/` | **canonical** |
| **Decision rationale and rejected alternatives** | `memory/decisions/README.md` | **canonical** |
| **Session narrative** | `memory/journal/` | **canonical** |

Never copy a fact from a canonical file into `memory/`. A copied fact drifts, and a drifted fact lies.

## Start of session

1. Complete the Start-of-Task Protocol in `AGENTS.md` first — it takes precedence.
2. Read `memory/README.md` (the hot cache and index).
3. Before changing anything, run a **scoped** recall for prior decisions, lessons, and domain facts.

### Recall discipline — mandatory

The vault root is the repository root, so **an unscoped search is broken.** Measured against the live
`obsidian-miyar` server on 2026-07-22: of **654 indexed notes only 193 are canonical**, while **438 (67%)
are stale `.claude/worktrees/` duplicates**. Those duplicates are the real hazard — they are
near-identical to the canonical files, so they look legitimate and outrank the original. An unscoped
probe returned the same document at ranks 1, 2 and 3 from three different checkouts.

mcpvault skips `node_modules` by default but honours nothing else — `.gitignore` included, and
`.claude/worktrees/` specifically is **not** skipped.

- **Targeted (preferred):** `pathPrefix: "memory"` · `".agent/state"` · `"docs"` · `"docs/decisions"`
- **Broad:** `excludePaths: [".claude/worktrees", "node_modules", "dist", "drizzle", "client", "server", "shared", "tests", "e2e", "scripts", "api", "patches"]`

If a returned path contains `.claude/worktrees/`, the search was wrong — re-scope and re-run rather than
reading the hit.

Agents without the Obsidian MCP (including Codex) use ordinary file reads and `grep` over the same
directories. The knowledge is identical; only the retrieval mechanism differs.

## During the session

When a new term, directive, domain fact, research finding, or decision rationale appears, write it to its
canonical home **at that moment**. In-session capture is more accurate than reconstruction at the end.

## End of session

### Claude Code

1. The `SessionEnd` hook fires automatically and appends an **objective** record — branch, commits, files
   touched — to `memory/journal/<today>.md`. It writes nothing when nothing happened, and never blocks.
   `PreCompact` fires the same hook so long sessions are recorded before their context is compacted away.
2. Run `/miyar-memory` for the interpretive pass: route each learning to its canonical home, update
   `updated:` frontmatter, keep the hot cache current.

### Codex

Codex has **no** Obsidian MCP and **no** hook. This asymmetry is real and is not papered over:

| | Codex | Claude Code |
| --- | --- | --- |
| Read/write `memory/` | ✅ | ✅ |
| Recall lens | ❌ (use `grep`) | ✅ |
| Mechanical session-end record | ❌ | ✅ |

For Codex the session-close is a **protocol step, not a mechanism**. Before ending material work:

1. Append a narrative entry to `memory/journal/<today>.md` covering what was done, decided, and learned.
2. Route learnings using the anti-drift table above.
3. Update `.agent/state/` per `docs/runbooks/roadmap-execution.md`.

## Maintenance

Periodically, or whenever recall feels wrong:

- **Orphan check** — every file in `memory/` must be reachable by a wikilink from `memory/README.md`.
  An orphan never enters an agent's context.
- **Duplication check** — grep `memory/` for sentences lifted from `docs/PROJECT_STATE.md`,
  `.agent/state/LESSONS.md`, or `.agent/state/ROADMAP.md`. Replace any hit with a pointer.
- **Hot cache size** — `memory/README.md` is a cache, not a log. Keep it near 150 lines.
- **Tag hygiene** — every note carries 2–4 tags from `memory/TAG_TAXONOMY.md` and nothing else.
- **Correction discipline** — when a recorded fact is found to be false, correct it *and* record that it
  was wrong and where it came from, so it cannot quietly return.

## Constraints

- `memory/` is **git-tracked**. Never place secrets, credentials, tokens, production data, or
  confidential SANZEN/CEO material in it.
- `memory/` is context, never authority. Deterministic TypeScript remains the numerical authority per the
  Product Invariants in `AGENTS.md`.
- The recall lens points at the **main checkout**. Work on a branch inside `.claude/worktrees/` is not
  visible to it until merged.
- Machine-local MCP configuration is not in this repository and is not portable. Verify a server is
  actually connected before relying on it.

## Related

- `AGENTS.md` — Second Memory section (canonical contract)
- `docs/runbooks/roadmap-execution.md` — execution state and handover
- `memory/README.md` — hot cache and index
- `memory/context/obsidian-recall-discipline.md` — full recall rules and the measurements behind them
