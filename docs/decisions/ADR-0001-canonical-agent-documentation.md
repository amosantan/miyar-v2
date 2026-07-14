# ADR-0001: Canonical Cross-Agent Documentation and State Separation

- Status: Accepted
- Date: 2026-07-14
- Deciders: Repository owner and engineering agents
- Technical area: Engineering operations and agent governance
- Supersedes: Legacy multi-file “chain of truth” practice

## Context

MIYAR accumulated several instruction, progress, phase, memory, workflow, and reality-report documents across different coding tools. Multiple files called themselves the single source of truth and duplicated changing facts such as active phase, table count, test count, and type-check status.

The duplicated state drifted. Historical reports correctly described earlier commits but were easy for a new agent session to interpret as current. Codex expects `AGENTS.md`; Claude Code expects `CLAUDE.md`; Gemini-oriented tooling used `GEMINI.md`. Without a shared contract, each tool could receive different project rules.

Long-running agent work also needs separate treatment for permanent rules, current facts, active task state, and history. Combining them in one large memory file consumes context and encourages stale completion claims.

## Decision

MIYAR uses the following authority model:

1. `AGENTS.md` is the canonical cross-agent engineering contract.
2. `CLAUDE.md` imports `AGENTS.md` and contains only Claude-specific behavior.
3. `GEMINI.md` is a thin adapter pointing Gemini tools to the same contract.
4. `LOOP_ENGINEERING.md` defines the shared lifecycle, verification, recovery, persistence, and terminal states.
5. `docs/PROJECT_STATE.md` owns verified changing repository facts.
6. `.agent/state/CURRENT_TASK.md` owns one active long-running task.
7. `.agent/state/KNOWN_FAILURES.md` owns reproduced unresolved failures.
8. `.agent/state/WORKLOG.md` contains concise multi-session handovers.
9. Git and historical reports retain past evidence but do not override live code or current state.

Changing statistics must not be copied into permanent instruction files. More specific domain instructions live in skills, loops, and runbooks and load only when relevant.

## Consequences

### Positive

- Codex, Claude, and Gemini receive one shared behavioral contract.
- Current facts have one owner and can be reverified.
- Historical documentation remains useful without controlling current work.
- Root instructions remain concise enough for consistent adherence.
- Long-running work has explicit state and handover artifacts.
- Contradictions have a defined resolution order.

### Negative and Trade-offs

- Contributors must learn the authority map.
- Legacy documents still contain stale claims and require archive awareness.
- Some tool-specific capabilities still need small adapters.
- State files require disciplined evidence-based updates.

### Risks and Mitigations

- Risk: adapters duplicate project facts. Mitigation: adapters may contain tool behavior only and must link to `AGENTS.md`.
- Risk: project state becomes stale. Mitigation: include observation date/commit and require live verification for high-risk work.
- Risk: historical paths remain discoverable. Mitigation: archive policy and precedence rules explicitly make them non-authoritative.
- Risk: prose rules are ignored. Mitigation: move mechanical requirements into CI/hooks when feasible.

## Alternatives Considered

### Keep `GEMINI.md` as the universal master file

Rejected because it is not the native root instruction surface for Codex or Claude Code and had grown into a mixture of permanent rules and changing phase state.

### Duplicate identical rules in three tool files

Rejected because manual synchronization recreates the original drift problem.

### One enormous all-purpose Markdown file

Rejected because it reduces instruction adherence, loads irrelevant detail, and conflates rules, operations, product, state, and history.

## Verification

- `AGENTS.md` exists and remains the canonical contract.
- The first line of `CLAUDE.md` imports `@AGENTS.md`.
- `GEMINI.md` points to `AGENTS.md` without duplicating the product encyclopedia.
- Canonical paths resolve.
- Changing health counts occur in `docs/PROJECT_STATE.md`, not adapters.
- Legacy reports are labelled non-authoritative by the archive policy.

## Migration and Rollback

Legacy instruction files remain in Git for historical context but defer to `AGENTS.md`. If another agent platform is added, create a thin adapter rather than a second canonical contract. Superseding this model requires a new ADR and a migration plan that prevents duplicated authority.

## References

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `LOOP_ENGINEERING.md`
- `docs/PROJECT_STATE.md`
- `.agent/state/`
