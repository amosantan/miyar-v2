# ADR-0004: Render-Input Fingerprint for Report Diagnostics

- Status: Accepted
- Date: 2026-07-18
- Deciders: MIYAR engineering
- Technical area: Report integrity and rendering

## Context

Reports are assembled from project data, deterministic calculations, evidence, and version labels. A rendered artifact needs a compact diagnostic aid that makes it possible to tell whether two renders received equivalent documented inputs. This aid must not be presented as an immutable issued snapshot or a cryptographic evidence chain.

## Decision

Each report renderer may create an internal render context with a document ID, UTC generation timestamp, locale, artifact version, renderer version, and available model, benchmark, and logic version labels. The context computes a SHA-256 **render-input fingerprint** from a canonical serialization with sorted object keys.

The canonical fingerprint input field list is:

1. Report type and requested locale.
2. Project identifier and display identity used by the artifact.
3. The report's deterministic input snapshot.
4. Deterministic score, sensitivity, ROI, board, scenario, portfolio, or brief values actually rendered.
5. Evidence reference labels and governed source URLs actually rendered.
6. The available model, benchmark, logic, artifact, and renderer version labels.

The fingerprint is embedded in the generated artifact for debugging only. It must not appear in structured API responses, public-share tokens or authorization inputs, separately persisted fields, or `report_instances`; it does not introduce a snapshot table and does not claim cross-format equality. A separately generated HTML, PDF, or DOCX artifact may have a distinct document ID and fingerprint context.

## Consequences

- Identical canonical inputs yield the same fingerprint; a changed represented input yields a different fingerprint.
- The document ID and timestamp identify one render, but are deliberately excluded from the fingerprint so they do not defeat diagnostic comparison.
- The fingerprint detects differences in the listed inputs only. It does not prove issuance immutability, evidence provenance, template equivalence, storage integrity, or legal admissibility.
- Renderers must label the value exactly as “Render-input fingerprint” and must not call it an “evidence trace”, “cryptographic evidence trace”, or immutable snapshot.

## Alternatives Considered

### Immutable report snapshot table

Deferred to BR-07. This certification task does not add a snapshot persistence architecture.

### Hashing arbitrary serializer output

Rejected because object key order and non-finite numeric values would make the result ambiguous or unreliable.

## Verification

- Unit tests prove stable output for reordered keys, different output for changed inputs, locale validation, and rejection of non-finite values.
- Integration/render tests verify the label is embedded in each applicable artifact without becoming an API or database field.
