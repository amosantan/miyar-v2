---
name: miyar-memory
description: >
  Run the MIYAR session-close memory cascade: harvest what actually happened this
  session, then route each learning to its correct canonical home in one pass.
  Trigger on: "/miyar-memory", "close the session", "update memory", "we're done
  for today", "log what we learned", "session close", "save this to memory",
  "remember this". Also triggers proactively when a decision was made, a term was
  introduced, a domain fact was established, or research was done and no memory
  file has been updated yet.
---

# MIYAR Memory Cascade

## Why this exists

The `SessionEnd` hook already records the **objective** footprint — branch, commits, files touched.
It cannot record what any of it *meant*. That is this skill's job.

Splitting the two is deliberate: the hook is dumb, unskippable, and never wrong; this skill is
interpretive and deliberate. Neither substitutes for the other.

**Governing rule — the anti-drift rule.** `memory/` owns only what the repository does not already own.
Everything else is a pointer. Never copy a canonical fact into `memory/`; a copied fact drifts, and a
drifted fact lies. The routing table below is the whole skill — get the destination right and the rest
is bookkeeping.

---

## Step 0 — Harvest context

Do **not** ask Amro for anything derivable. Read, in order, stopping when you have enough:

```
1. git log --oneline <session-start-sha>..HEAD   — what landed
2. git status --porcelain                        — what is still open
3. memory/journal/<today>.md                     — the hook's objective record
4. .agent/state/CURRENT_TASK.md                  — what we were supposed to be doing
5. .agent/state/ROADMAP.md                       — next executable step; did it move?
6. The conversation itself                       — decisions, terms, corrections, directives
```

The session-start SHA is in `.claude/state/session_start.txt` if the session has not ended yet.

---

## Step 1 — Route each learning to its canonical home

For every candidate learning, pick exactly one destination. **When a canonical repo file owns it, write
there — not into `memory/`.**

| What you learned | Canonical destination |
| --- | --- |
| A reusable engineering lesson with evidence | `.agent/state/LESSONS.md` (append-only, `LES-###` template) |
| A reproduced, still-unresolved failure | `.agent/state/KNOWN_FAILURES.md` |
| Roadmap step status changed / closed | `.agent/state/ROADMAP.md` + `.agent/state/CURRENT_TASK.md` |
| A completed handover worth carrying | `.agent/state/WORKLOG.md` |
| A newly *verified* repository fact | `docs/PROJECT_STATE.md` (with date/commit observed) |
| An architecture decision | New ADR in `docs/decisions/` |
| **A term, acronym, or shorthand** | **`memory/glossary.md`** |
| **A directive or working-style fact about Amro** | **`memory/people/amro.md`** |
| **A UAE market/regulatory fact (with a source)** | **`memory/domain/README.md`** |
| **External research, with URLs** | **`memory/research/README.md`** |
| **A decision's rejected alternatives / rationale** | **`memory/decisions/README.md`** |
| **What happened, narratively** | **`memory/journal/<today>.md`** (above the machine record) |

If a learning fits two rows, it belongs in the **repo-canonical** one, and `memory/` may hold a pointer.

### Do not record

- Anything numerical that feeds a calculation — deterministic TypeScript owns that.
- Secrets, credentials, tokens, production data, confidential SANZEN/CEO material. `memory/` is git-tracked.
- Transient counts, statuses, or "tests currently passing" restated into `memory/`.
- A claim you did not verify in the current checkout.

---

## Step 2 — Ask only what you could not derive

Ask Amro at most these, and skip any you already answered from Step 0:

1. What did we complete that is worth remembering?
2. Anything decided that I should record — and what did we reject?
3. What is the next priority?
4. Any new term, or any correction to something I had recorded wrongly?

Keep it short. He is direct and does not want a questionnaire.

---

## Step 3 — Write

- Update the frontmatter `updated:` field on every file you touch.
- Use only tags from `memory/TAG_TAXONOMY.md`. Do not invent a tag; if one is genuinely missing, add it
  to the taxonomy in the same change.
- Add wikilinks so nothing becomes an orphan — every memory note must be reachable from
  `memory/README.md`.
- Refresh the hot cache in `memory/README.md` **only** if a top-level term, person, or pointer changed.
  It is a cache, not a log; keep it under ~150 lines.
- Journal narrative goes **above** the `⟨auto⟩ Machine Session Record` block. Never edit that block.

---

## Step 4 — Report

Show Amro a short summary: which files changed, and what each now records. Then state plainly whether
anything was deliberately **not** recorded, and why.

Do **not** commit unless the task authorises it (`AGENTS.md` — Git and Worktree Rules). If committing is
in scope, keep the memory update in its own scoped commit describing verified behaviour.

---

## Correcting a wrong memory

If you find a recorded fact that is false — as happened with the "MIYAR is an academic project"
misdescription — do not silently overwrite it. Correct it **and** record that it was wrong and where it
came from, so it cannot quietly return. See the identity correction in `memory/projects/miyar.md` for
the pattern.
