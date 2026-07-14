# ADR-0002: Deterministic Code Owns Authoritative Numerical Decisions

- Status: Accepted
- Date: 2026-07-14
- Deciders: Product and engineering
- Technical area: Decision intelligence and AI architecture
- Supersedes: none

## Context

MIYAR combines generative AI with high-consequence real-estate design, cost, market, risk, sustainability, and investment outputs. LLMs are useful for interpreting unstructured inputs, suggesting design direction, extracting evidence, and generating narrative. They are probabilistic and can produce unsupported or inconsistent numbers.

MIYAR users may present outputs to boards, partners, lenders, designers, and procurement teams. Authoritative scores, quantities, prices, grades, ranges, and financial calculations therefore require reproducible methods, versioned inputs, traceable evidence, and testable behavior.

## Decision

Authoritative numerical and policy decisions are implemented in deterministic, versioned TypeScript and governed data:

- Scoring, normalization, weights, thresholds, penalties, and decision status
- Surface areas, quantities, allocations reconciliation, and totals
- Material pricing and cost aggregation
- ROI, yield, premium, risk, sustainability, and predictive calculations
- Confidence/reliability formulas and benchmark promotion rules
- Compliance checklist result logic

LLMs may:

- Extract structured proposals from text, images, PDFs, voice, and web content
- Suggest design, room, material, or allocation direction
- Generate narrative explanations and summaries
- Synthesize trends with source context
- Produce visual prompts or images

LLM output is validated, qualified, and reviewable. It may supply proposed inputs to deterministic engines, but it does not become the final authority.

## Consequences

### Positive

- Results are reproducible and testable.
- Historical evaluations can retain logic and benchmark identity.
- Model-provider changes do not silently alter financial/scoring behavior.
- Evidence and human overrides remain visible.
- AI failure can degrade assisted features without corrupting core calculations.

### Negative and Trade-offs

- More explicit engine and policy code must be maintained.
- Novel qualitative signals require a deliberate mapping before numerical use.
- LLM suggestions need schemas, confidence, and human review UX.
- Deterministic models can still encode bad assumptions and require calibration.

### Risks and Mitigations

- Risk: a narrative invents a number. Mitigation: narratives receive authoritative calculated values and prompts prohibit unsupported figures; outputs are checked.
- Risk: AI suggestion is mistaken for approved input. Mitigation: label suggestion state and require user acceptance for material fields.
- Risk: deterministic logic becomes hardcoded and ungoverned. Mitigation: version logic/benchmarks, use registries where designed, add fixtures and approval gates.
- Risk: duplicated calculation in UI/report diverges. Mitigation: calculate server-side and reconcile outputs in report tests.

## Alternatives Considered

### Allow LLMs to calculate and score directly

Rejected because results would be difficult to reproduce, audit, regress, and defend.

### Remove AI entirely

Rejected because multimodal extraction, design synthesis, narrative, and visual assistance provide substantial user value when bounded appropriately.

### Accept model-generated numbers with confidence labels

Rejected for authoritative outputs. Confidence labels do not make unsupported calculations reproducible or source-grounded.

## Verification

- Calculation call paths contain no model invocation.
- Numerical engines have deterministic fixtures and boundary tests.
- LLM output schemas exclude authoritative fields or treat them as non-authoritative proposals.
- UI distinguishes suggested, accepted, overridden, synthetic, stale, and insufficient values.
- Reports reconcile values to deterministic source results.
- Logic/benchmark/model identity is retained where material.

## Migration and Rollback

Any existing model-generated numerical authority should be replaced with deterministic logic or clearly labelled non-authoritative suggestion. A change to this boundary requires a new ADR, product/security review, and regression/decision-impact evidence.

## References

- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/VERIFICATION.md`
- `.agent/rules/coding-conventions.md`
