---
name: miyar-plan-orchestrator
description: >
  Plan and orchestrate complex MIYAR work with bounded subagents. Use for
  cross-layer changes, authorization or tenant isolation, data or schema work,
  deterministic scoring, reports, releases, or independent investigations that
  benefit from parallel evidence gathering. Start in Codex Plan Mode when it is
  available; do not use for trivial isolated fixes or simple questions.
---

# MIYAR Plan Orchestrator

Run complex MIYAR work as a plan-first, evidence-led workflow. Keep the root
agent responsible for decisions, integration, writes, and verification.

## Plan gate

1. Ask the user to activate Plan Mode with `/plan` or Shift+Tab when it is not
   already active. A skill cannot switch the client mode itself.
2. Until the plan is complete, perform only read-only discovery. State the
   goal, acceptance criteria, invariants, risks, approval gates, and relevant
   verification.
3. Publish a decision-complete `<proposed_plan>` and wait for implementation
   authority. Do not treat a roadmap item as authority to implement unrelated
   work.

Use the existing MIYAR loop and state files. Read the matching domain skill
after classifying the work; do not duplicate its domain rules here.

## Classify and route

Classify by the highest applicable class. Dispatch only independent,
non-overlapping work. Cap workers at `min(3, available slots after the root)`.

| Class | Typical work | Dispatch |
| --- | --- | --- |
| Low | Explain, docs, isolated trivial fix | Root only. |
| Medium | Isolated UI or implementation work | One `miyar-scout` for bounded evidence or review. |
| High | Engine, API, data, report, cross-layer work | One Terra scout plus one Sol review; root integrates. |
| Critical | Schema, release, tenant isolation, security, scoring, regulatory, irreversible work | Up to three bounded workers. Require a Sol review and stop at any human approval gate. |

Use `miyar-scout` (`gpt-5.6-terra`, medium reasoning) for read-heavy codebase
mapping, focused test/log evidence, and tightly bounded mechanical work. Keep
it read-only unless the root assigns an exclusive write area. Use
`miyar-reviewer` (`gpt-5.6-sol`, high reasoning) for architecture, contracts,
tenant isolation, deterministic scoring, provenance, and verification review.

Do not require Luna. Use it only if the current runtime explicitly exposes it
and its role is still appropriate. If Sol is unavailable for high or critical
work, do not substitute an unreviewed Terra result for the required review.

## Dispatch rules

- Give every worker a bounded question, relevant paths, non-goals, timeout, and
  requested evidence summary.
- Keep scouts and reviewers independent; do not pass the root diagnosis or
  expected answer into an independent review.
- Allow only one writer for a file area. Serialize dependent writes and let the
  root agent integrate every result.
- Preserve user-owned changes. Never delegate production writes, migrations,
  deployment, external messages, or other human-gated actions.
- Require workers to report concise conclusions with paths, commands, and
  remaining uncertainty rather than raw logs.

## Integrate and verify

1. Reconcile worker evidence against MIYAR product invariants and the user
   request. The root agent makes final decisions; an LLM never becomes
   numerical authority.
2. Implement the smallest coherent change, then run the proportional
   verification ladder in `docs/VERIFICATION.md`.
3. For high and critical work, obtain an independent Sol review after tests and
   before declaring success.
4. Reclassify each failure before retrying. Use at most three evidence-based
   attempts per failure class; stop as `BLOCKED` or `NEEDS_HUMAN` when required.
5. Review the complete diff, preserve unrelated changes, and update durable
   state only when verified facts changed.
