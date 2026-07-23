# ADR-0010: Ingestion robots and fetch posture

- Status: Accepted
- Date: 2026-07-23
- Deciders: Amro Saleh (product owner)
- Technical area: Market/material ingestion acquisition
- Supersedes: none

## Context

The market/material connector chain tried five third-party rendering proxies (Firecrawl, ScrapingAnt, ScrapingDog, Apify, ParseHub) before its native fetch, and only the native fetch consulted robots.txt — permissively at three separate points: a non-OK robots response produced an empty allow-all ruleset, the verdict accepted `isAllowed(...) !== false`, and any thrown error returned `true` with a `// fail open` comment. Two connectors (Bayut, PropertyFinder) overrode `fetch()` to call Firecrawl unconditionally, and the SCAD PDF connector fetched raw URLs directly, so in any deployment with a proxy key configured, robots.txt was effectively never consulted.

This contradicted `docs/SECURITY.md` ("Respect source authorization, robots/terms requirements") and diverged from the regulatory acquisition path, which was deliberately built strict (explicit allow, fail closed on unavailable robots, no proxies). The audit's live probe also observed Bayut redirecting to a captcha challenge — an operator saying no by other means.

## Decision

1. `server/engines/ingestion/robots-policy.ts` (`ingestion-robots-v1`) is the single robots authority for market/material acquisition.
2. robots.txt is evaluated for the target URL BEFORE any provider runs — including every third-party proxy — and each provider helper re-asserts the policy defensively so no subclass override or direct helper call can bypass it. A per-origin TTL cache bounds robots traffic.
3. Semantics follow RFC 9309: HTTP 4xx (except 429) on robots.txt is "unavailable" per §2.3.1.3 and imposes no restrictions; HTTP 429/5xx, network errors, and timeouts fail closed after one bounded retry; a fetch proceeds only on `isAllowed(...) === true`.
3a. **Amended 2026-07-23 after production evidence.** A 200 response is parsed whatever content type it declares, and a transiently unavailable robots.txt is retried once before failing closed. The first production run under this ADR blocked five sources, of which four were false negatives against Tier-A official hosts: `rics.org` serves a valid robots.txt as `text/html`, while `dsc.gov.ae` and `scad.gov.ae` serve valid `text/plain` and were lost to a transient fetch failure with no retry. RFC 9309 does not require rejecting a mislabelled robots.txt, and a body carrying no valid directives parses to the same empty allow-all ruleset the RFC prescribes for "unavailable". Only genuinely unreachable hosts (such as `dubaipulse.gov.ae` at the time of that run) now fail closed. An established verdict — parsed rules or an RFC 9309 allow-all — is never retried, so a disallow can never be retried into an allow.
4. No connector may override `fetch()` to bypass the gate. The Bayut and PropertyFinder overrides are removed; the SCAD PDF connector's raw fetches are gated.
5. A robots denial is a recorded fetch failure (HTTP 403-shaped result naming the policy code) visible in connector health; it must not be silently retried through another provider.
6. The regulatory document fetcher is unchanged — it remains stricter (no proxies at all) and keeps its own registered-source policy.

## Consequences

### Positive

- Acquisition behavior matches the published security posture and the terms expectations of source operators.
- The permissive/strict divergence between the market and regulatory paths becomes a recorded decision instead of drift.

### Negative and trade-offs

- Evidence volume drops for origins that disallow crawling or whose robots.txt is unreachable; some registered sources may never be fetchable. This reduction is intended and visible in connector health rather than hidden.

### Risks and mitigations

- Risk: a flapping origin (intermittent 5xx robots) intermittently denies fetches. Mitigation: denial states are cached per TTL and surface in `lastScrapedStatus`/connector health for operator review.
- Risk: future connectors reintroduce bypasses. Mitigation: defensive per-provider assertion plus a regression test that Bayut/PropertyFinder own no `fetch` override.

## Alternatives Considered

### Central check, fail-open when robots.txt is unreachable

Removes the proxy bypass but preserves silent permissiveness exactly where operators cannot answer. Rejected: an unknown robots state is not consent.

### Document the permissive posture without code change

Rejected: it would codify a contradiction with `docs/SECURITY.md` and with how the regulatory path already behaves.

## Verification

- `server/engines/ingestion/robots-policy.test.ts` covers allow/deny/4xx/429/5xx/network-error/content-type/TTL/per-origin behavior.
- `server/engines/ingestion/connector-robots.test.ts` proves a denial returns before any provider runs and that Bayut/PropertyFinder no longer define `fetch` overrides.

## Migration and Rollback

Behavior-only change (no schema). Rollback is a revert of the connector-chain commits; the policy module itself is inert when unused. Supersession requires a new ADR.

## References

- Source-to-output ingestion audit (session artifact `07357419`, 2026-07-23), finding F9
- RFC 9309 §2.3.1.3
- `docs/SECURITY.md` — ingestion source-authorization requirements
- `server/engines/ingestion/robots-policy.ts`, `server/engines/ingestion/connector.ts`, `server/engines/ingestion/connectors/index.ts`, `server/engines/ingestion/connectors/scad-pdf-connector.ts`, `server/engines/ingestion/regulatory-document-fetcher.ts`
