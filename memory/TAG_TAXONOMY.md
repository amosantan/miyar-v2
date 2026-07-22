---
title: Tag Taxonomy — MIYAR Second Memory
description: Closed tag list for memory/ frontmatter. Every memory note carries 2-4 tags from these categories.
tags:
  - type/reference
  - domain/memory
  - status/active
type: reference
updated: 2026-07-22
---

# Tag Taxonomy — MIYAR Second Memory

> **Purpose:** A *closed* tag list. Inconsistent tags are the main cause of unusable recall, so do not
> invent a tag that is not listed here. If a genuinely new category is needed, add it to this file in
> the same change that first uses it.

Every file in `memory/` carries YAML frontmatter with `title`, `description`, `tags`, `type`, `updated`,
and 2–4 tags drawn from the categories below.

## `type/` — what kind of note is this?

| Tag | Use for |
| --- | --- |
| `type/index` | Hot cache and index files (`README.md`) |
| `type/reference` | Stable reference material (taxonomy, toolkit, recall discipline) |
| `type/glossary` | The decoder ring |
| `type/person` | A person or agent profile |
| `type/project` | A project profile |
| `type/domain` | Domain and market knowledge (UAE, regulatory, cost) |
| `type/research` | External research provenance |
| `type/decision` | Decision pointers and rationale |
| `type/journal` | Per-session journal entries |

## `domain/` — subject area

| Tag | Use for |
| --- | --- |
| `domain/memory` | The memory system itself |
| `domain/scoring` | Scoring, weights, explainability |
| `domain/materials` | Materials, MQI, surface areas, cost |
| `domain/evidence` | Evidence, provenance, price observations |
| `domain/brief` | Design brief, studio, typology packs |
| `domain/intake` | Project intake and multimodal analysis |
| `domain/ingestion` | Connectors, corpus, refresh pipelines |
| `domain/analytics` | Analytics and prediction |
| `domain/regulatory` | UAE regulation — DLD, RERA, SREC, PDPL |
| `domain/market` | UAE market conditions and benchmarks |
| `domain/tenancy` | Organization isolation and authorization |
| `domain/infrastructure` | Build, CI, database, deployment |
| `domain/reporting` | Reports, snapshots, share views |

## `status/` — current state

| Tag | Use for |
| --- | --- |
| `status/active` | Current and in use |
| `status/superseded` | Replaced; kept for history, links to successor |
| `status/archived` | Historical only, do not treat as authority |
| `status/unverified` | Recorded but not yet confirmed against live evidence |

## `project/` — which project

| Tag | Use for |
| --- | --- |
| `project/miyar` | MIYAR design-decision intelligence platform |
| `project/sanzen` | SANZEN Real Estate |
| `project/sentineltrader` | SentinelTrader trading system |

## `source/` — where the knowledge came from

| Tag | Use for |
| --- | --- |
| `source/repo` | Derived from this repository's own files or Git history |
| `source/web` | External web research (must carry a URL) |
| `source/user` | Stated directly by Amro |
| `source/session` | Observed during a working session |

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Related:** [[memory/glossary|Glossary]], [[memory/context/obsidian-recall-discipline|Recall Discipline]]
