# ADR-0012: Governed paint quantity and pack policy

- Status: Accepted
- Date: 2026-07-29
- Deciders: Amro Saleh (material-quantity and numerical-policy owner)
- Technical area: Material quantity intelligence, paint specifications, purchasing quantities, and provenance
- Extends: ADR-0011 (evidence and price-observation model)

## Context

EV-03 makes the EV-02 resolver the only material-price authority. Paint needs
one additional deterministic input before a per-litre price can become a cost:
coverage per coat, coat count, application waste, and available supplier pack
sizes. Raw scraped text and AI output are not approved numerical authority.

Manufacturer guidance uses the same core pattern: calculate surface area,
multiply the work by the number of coats, and divide by the product's stated
coverage. Product pages also publish product-specific coverage, which is why a
reviewed technical-data profile may override the conservative fallback.

## Decision

1. Canonical paint quantity is litres:

   `litres = wall area m² × coats ÷ coverage m²/L/coat × (1 + waste)`

2. The owner-approved fallback is 10 m²/L per coat, two coats, and 10%
   application waste. Its policy version is `ev03-paint-quantity-v1`.

3. A product-specific profile overrides the fallback only when all of the
   following are present and valid: canonical product and specification,
   positive coverage, positive whole-number coat count, waste within the
   accepted deterministic bounds, actual positive pack sizes, effective date,
   policy version, source-document URL and digest, approved status, reviewer,
   and review time.

4. Pending, rejected, expired/superseded, malformed, raw-scraped, or
   AI-generated profiles cannot enter a calculation. Invalid approved data
   fails closed as `paint_coverage_invalid`; it does not silently fall back.

5. The quantity snapshot records whether the governed profile or fallback was
   used and records coverage, coats, waste, profile/version, source digest, and
   resolver clock. Reports expose only presentation-safe provenance.

6. Purchasing rounds litres up only to a combination of actual supplier pack
   sizes from the approved profile. No generic "gallon" conversion or assumed
   pack size is permitted. Where actual packs are unavailable, MIYAR may state
   the litres required but cannot claim a purchasable pack count.

## Consequences

- Paint cost is reproducible from an explicit quantity policy and an EV-02
  governed per-litre value.
- Product technical data can improve accuracy without allowing scraped or
  generated content to become numerical authority.
- The fallback may over- or under-estimate a particular coating; the output is
  explicitly labelled as a fallback assumption.
- Invalid approved data produces insufficiency, which can block an issued
  aggregate until corrected.

## Alternatives considered

- **Treat paint prices as AED/m².** Rejected because it hides product coverage,
  coats, and waste and cannot reconcile to supplier packs.
- **Use a generic gallon.** Rejected because pack sizes vary and the term is
  ambiguous across suppliers.
- **Let scraped TDS values calculate immediately.** Rejected because extraction
  is a proposal, not numerical approval.

## Verification

- Deterministic tests cover fallback litres, approved-profile override, invalid
  profiles, effective dates, waste/coat bounds, and exact pack rounding.
- MQI and reports must use the same snapshotted inputs and explicit `asOf`.
- Public/report DTO tests prove source digests and tenant/commercial metadata do
  not leak.

## Migration and rollback

Migration 0062 adds `paint_coverage_profiles` without modifying existing
material prices. No profile is authoritative until explicitly approved.
Rollback removes only EV-03 profile and snapshot fields after dependency and
write-fingerprint checks. The code fallback remains the approved minimum policy.

## References

- [Dulux: How much paint do you need?](https://www.dulux.co.uk/en/expert-help/how-much-paint-do-you-need)
- [Dulux Matt product coverage example](https://www.dulux.co.uk/en/products/dulux-matt?t=Online+Paint+Tester)
- ADR-0002 — Deterministic decision authority
- ADR-0011 — Evidence and price-observation model
