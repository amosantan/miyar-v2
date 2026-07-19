# ADR-0005: Prioritize DI-01 as a staged planning increment

- Status: Accepted
- Date: 2026-07-19
- Deciders: Product owner (priority); Codex (scope capture)
- Technical area: Roadmap sequencing and design-intelligence architecture
- Supersedes: The `SC-05` next-step pointer only; it does not cancel `SC-05`, `DI-00`, `BR-02`, or `BR-05`

## Context

The committed roadmap at `fff8899` names `SC-05` as next and does not yet contain the uncommitted broader DI programme. A separate user-owned roadmap draft defines DI-01 but originally depends on open DI-00, BR-02, and BR-05 steps and on professional/schema approvals. On 2026-07-19 the product owner explicitly selected DI-01 as the single next executable step.

Priority does not make the unmet decisions safe. DI-01 can begin with read-only inventory, frozen fixtures, an ADR/contract, compatibility and migration design, and an approval package. Schema generation, runtime behavior, migration, relabeling, and consumer cutover remain gated.

## Decision

Activate DI-01 only as the bounded planning increment recorded in `.agent/state/CURRENT_TASK.md` and `docs/specs/DI-01_CANONICAL_GEOMETRY_PLAN.md`.

Absorb only geometry-specific calculation/source vocabulary, version/stale bindings, and neutral room/level/zone hooks needed to make the plan coherent. Defer all broader DI-00 calculation governance, BR-02 brief architecture, and BR-05 typology-pack behavior.

Unless the named professional, product, schema, security, and migration owners approve the decision package, the planning increment ends `NEEDS_HUMAN`; it does not proceed to implementation and cannot close DI-01 as `PASS`.

## Consequences

### Positive

- Work can begin on the highest-priority geometry problem without pretending its dependencies are closed.
- Schema, formula, legacy, and tenant decisions remain explicit and reviewable.
- Later DI work has a stable identity/measurement foundation to approve rather than hidden implementation choices.

### Negative and trade-offs

- The roadmap temporarily executes an architecture tranche before the original dependency chain.
- DI-01 cannot ship runtime value until multiple owners approve its contract and rollout.
- The uncommitted broader DI roadmap still needs separate review and canonical integration.

### Risks and mitigations

- Scope drift into BR/DI work is mitigated by the absorbed/deferred table and stop conditions.
- A planning document may be mistaken for approval; every artifact must retain `Proposed` status until accepted.
- Duplicate roadmap edits across worktrees require careful later reconciliation; neither user-owned worktree may be overwritten.

## Alternatives Considered

### Keep SC-05 next

Rejected by the product owner's explicit reprioritization; SC-05 remains intact and human-gated.

### Complete DI-00, BR-02, and BR-05 first

Architecturally clean but inconsistent with the selected priority and blocked on wider product decisions. Their non-geometry scope remains deferred.

### Implement DI-01 immediately

Rejected because measurement, tolerance, schema, migration, legacy, and professional decisions are not approved.

## Verification

- The roadmap and current task contain exactly one active/next DI-01 pointer.
- No production TypeScript, schema, migration, or runtime file changes in the planning increment.
- Independent Codex-agent and Claude reviews challenge the dependency re-scope and record dispositions.
- The planning increment ends `NEEDS_HUMAN` unless every named gate is explicitly approved.

## Migration and Rollback

This ADR makes no database or runtime change. Reprioritization can be superseded by a new decision and roadmap update. The isolated branch can be abandoned without affecting `origin/main` or the separate user-owned roadmap worktree.

## References

- `.agent/state/CURRENT_TASK.md`
- `.agent/state/ROADMAP.md`
- `docs/specs/DI-01_CANONICAL_GEOMETRY_PLAN.md`
- `docs/runbooks/roadmap-execution.md`
