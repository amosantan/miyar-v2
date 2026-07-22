---
title: MIYAR
description: Authoritative identity note for the MIYAR platform. Corrects the long-standing "academic project" misdescription.
tags:
  - type/project
  - project/miyar
  - status/active
  - source/repo
type: project
updated: 2026-07-22
---

# MIYAR

**What it is:** A **UAE design-decision intelligence platform** for real-estate developers, investors,
and design teams. It converts project intent into defensible scoring, market intelligence, space
programmes, material quantities, costs, risks, and board-ready outputs.

**Repository:** `/Users/amrosaleh/Maiyar/miyar-v2`
**Owner:** [[memory/people/amro|Amro Saleh]]
**Agents:** [[memory/people/claude-code|Claude Code]], [[memory/people/codex|Codex]]

## ⚠️ Identity correction

Cross-project notes in the SentinelTrader vault described MIYAR as *"an academic project — postgraduate
business plan and pitch deck"* with deliverables like a rubric gap check and examiner Q&A prep. **That is
wrong for this repository.** Recorded here explicitly so the misdescription cannot quietly return:

| | |
| --- | --- |
| ❌ Stale description | Academic postgraduate business plan + pitch deck; lower priority; manual-trigger rubric tasks |
| ✅ Actual | Production UAE design-decision intelligence platform: React client, tRPC routers, domain engines, MySQL/Drizzle schema |

Sources of the stale claim, corrected on 2026-07-22:
`Trading/memory/projects/miyar.md`, `Trading/memory/people/amro.md`, `Trading/memory/TAG_TAXONOMY.md`.

## Where the authoritative facts live

This note deliberately contains **no** changing state. Follow the pointers — do not copy their contents
back into `memory/`.

| Question | Canonical file |
| --- | --- |
| What are the rules? | `AGENTS.md` |
| What is the product and its boundaries? | `docs/PRODUCT.md` |
| How is it built? | `docs/ARCHITECTURE.md` |
| What is true right now? | `docs/PROJECT_STATE.md` |
| What is the ordered plan and next step? | `.agent/state/ROADMAP.md` |
| What is being worked on? | `.agent/state/CURRENT_TASK.md` |
| What is known broken? | `.agent/state/KNOWN_FAILURES.md` |
| What have we learned? | `.agent/state/LESSONS.md` |
| What was decided and why? | `docs/decisions/` |

## Non-negotiable product invariants

Summarised from `AGENTS.md` because they constrain every memory entry. `AGENTS.md` remains authoritative.

- Numerical scoring, pricing, aggregation, thresholds, quantities, and grades stay **deterministic
  TypeScript**. LLMs may extract, translate, suggest, and generate narrative — they must **never** become
  numerical authority. **This applies to the second memory too: `memory/` is context, never a number source.**
- UAE context is the default: AED, local sources, local regulation.
- Every material cost, benchmark, and investment claim exposes provenance or is clearly labelled an assumption.
- Organization-scoped data uses the established authorization boundary. Tenant isolation is never weakened.
- Explicit developer inputs are never silently overwritten by AI suggestions.

## Work families

Roadmap steps are grouped by ID prefix — `TR`, `BR`, `EV`, `SC`, `DI`, `EX`, `UX`, `RM`. See
[[memory/glossary|the glossary]] for what each family means. Status lives only in `.agent/state/ROADMAP.md`.

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **People:** [[memory/people/amro|Amro]]
- **Domain:** [[memory/domain/README|Domain Knowledge]]
- **Related:** [[memory/glossary|Glossary]], [[memory/decisions/README|Decision Index]]
