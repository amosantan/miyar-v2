---
title: MIYAR Glossary — Decoder Ring
description: Every term, acronym, roadmap ID family, and shorthand used in MIYAR. Canonical home for terminology.
tags:
  - type/glossary
  - domain/memory
  - project/miyar
  - status/active
type: glossary
updated: 2026-07-22
---

# MIYAR Glossary — Decoder Ring

> **This file is canonical.** Terminology has no other home in the repository, so definitions live here
> rather than as pointers. If a term appears in a session and is not here, add it.
>
> Terms whose *authority* lives elsewhere (a roadmap step's status, a verified count) are defined here
> only in the stable sense — never copy changing status into this file.

## Roadmap step ID families

Steps live in `.agent/state/ROADMAP.md`. That file owns their **status**; this table owns only what the
prefix *means*.

| Prefix | Family | Concern |
| --- | --- | --- |
| `RM-` | Roadmap meta | The persistent Codex/Claude Code roadmap mechanism itself |
| `TR-` | Trust & remediation | Tenant isolation, authorization, baseline test/contract repair, DB safety |
| `UX-` | Experience | Developer journey and the warm architectural interface |
| `BR-` | Brief | Issued design brief, guided studio, typology packs, AI quality gate |
| `DI-` | Dimensional | Canonical room, geometry, and measurement foundation |
| `EV-` | Evidence | Evidence & price-observation model, DLD pipeline, RFQ, refresh SLA |
| `SC-` | Scale | Router splitting, design records, performance budgets, PDPL, packaging |
| `EX-` | Exploratory | Research-grade work — premium/yield calibration, generative variants |

Suffix letters denote a split of an existing step (`TR-03H` = hardening follow-on to `TR-03`;
`BR-04B`…`BR-04E` = staged parts of `BR-04`).

## Product and domain terms

| Term | Meaning |
| --- | --- |
| **MIYAR** | The UAE design-decision intelligence platform in this repository. Converts project intent into scoring, market intelligence, space programmes, material quantities, costs, risks, and board-ready outputs. Not to be confused with the unrelated academic project of the same name — see [[memory/projects/miyar\|MIYAR project note]]. |
| **MQI** | **Material Quantity Intelligence.** Surface-area-driven material quantity and cost calculation. Prices come from `material_library.priceAedMin/Max`. |
| **Material library** | Primary pricing source for MQI (`material_library`). Client-facing market prices. |
| **Material constants** | `material_constants` — scientific constants (carbon intensity, density). Used for sustainability scoring, **never** for client-facing pricing. |
| **Material allocations** | `material_allocations` table — MQI's per-element splits. Separate from `finish_schedule_items`. |
| **Finish schedule** | Assigns exactly one material per element; used by the design brief. MQI layers splits on top. |
| **Space programme** | Room-by-room programme produced by `buildSpaceProgram(project)`. MQI consumes the same room list. |
| **Typology pack** | A governed, per-typology bundle of UAE assumptions and regulatory sources used to drive briefs. Framework in `BR-05`; Dubai packs validated in `BR-06`. |
| **Issued design brief** | The versioned, readiness-gated brief product contract (`BR-01`…`BR-03`). |
| **Design brief studio** | The guided authoring experience for briefs (`BR-04` family). |
| **Explainability** | The requirement that a score can be traced to its contributing inputs and weights. |
| **Provenance** | The requirement that every material cost, benchmark, and investment claim exposes its source or is clearly labelled an assumption. |
| **Insufficiency** | The explicit state where evidence coverage or freshness fails the SLA, so a claim must not be asserted. |

## UAE / regulatory acronyms

| Acronym | Meaning |
| --- | --- |
| **AED** | UAE dirham. The platform's default currency. |
| **DLD** | Dubai Land Department. Source of governed market data (`EV-05`). |
| **RERA** | Real Estate Regulatory Agency (Dubai, under DLD). |
| **SREC** | Sharjah Real Estate Registration Department. |
| **PDPL** | UAE Personal Data Protection Law (Federal Decree-Law No. 45/2021). Retention and data-subject workflows in `SC-06`. |
| **GFA** | Gross Floor Area. |
| **BOQ** | Bill of Quantities. |
| **RFQ** | Request For Quotation. Structured comparison and substitutions in `EV-06`. |
| **SLA** | Service Level Agreement — here, evidence coverage and freshness thresholds. |
| **BIM / IFC** | Building Information Modelling / Industry Foundation Classes. Handoff piloted in `SC-08`. |

## Engineering and process terms

| Term | Meaning |
| --- | --- |
| **Canonical file** | The single authoritative home for a class of fact. See the anti-drift table in [[memory/README\|Memory Hot Cache]]. |
| **Second memory** | This `memory/` tree plus the `obsidian-miyar` recall lens. Context only — never numerical or product authority. |
| **Recall lens** | Read/search access to memory via the Obsidian MCP. Never a separate store. See [[memory/context/obsidian-recall-discipline\|Recall Discipline]]. |
| **Anti-drift rule** | `memory/` owns only what the repo does not already own; everything else is a pointer. A copied fact drifts and then lies. |
| **Loop** | A repeatable task lifecycle under `docs/loops/`, classified via `LOOP_ENGINEERING.md`. |
| **Terminal state** | One of `PASS`, `FAILED`, `BLOCKED`, `NEEDS_HUMAN`, `CANCELLED`. |
| **NEEDS_HUMAN** | A named human decision or approval is required before implementation may continue. |
| **Retry budget** | Default 3 evidence-based attempts per failure class before stopping as `BLOCKED`. |
| **Worktree** | A parallel checkout under `.claude/worktrees/`. Excluded from recall — its copies are stale duplicates. |

## Tooling shorthand

| Term | Meaning |
| --- | --- |
| **mcpvault** | `@bitbonsai/mcpvault` — headless, file-based Obsidian MCP server. No Obsidian.app required. |
| **obsidian-miyar** | The MCP server exposing this repository as a recall lens. |
| **Codex** | The other coding agent working this repository. Governed by `AGENTS.md`; has no Obsidian MCP. |
| **Claude Code** | This agent. Governed by `AGENTS.md` via `CLAUDE.md`; additionally gets mechanical hook enforcement. |

---

## Linked notes

- **Index:** [[memory/README|Memory Hot Cache]]
- **Project:** [[memory/projects/miyar|MIYAR]]
- **Related:** [[memory/TAG_TAXONOMY|Tag Taxonomy]], [[memory/context/obsidian-recall-discipline|Recall Discipline]]
