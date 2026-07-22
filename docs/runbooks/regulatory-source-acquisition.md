# Runbook — Regulatory Source Acquisition and Pack Release

Scope: what to run, in what order, once a human has recorded source-policy decisions in
`docs/artifacts/BR-06_SOURCE_POLICY_DECISION_RECORD.md`.

This runbook **starts after** the licensing/retention decision. It cannot be used to make
that decision, and following it does not create any approval. BR-06 remains `NEEDS_HUMAN`
until stage 5 completes for a given pack.

Related: `docs/VERIFICATION.md`, `docs/runbooks/local-development.md`,
`docs/runbooks/roadmap-execution.md`, `.agent/state/LESSONS.md` (`LES-043`–`LES-046`).

---

## Stage gates

Strictly ordered. Each stage fails closed if the one above it is incomplete.

| Stage | Gate | Who | Automatable |
| --- | --- | --- | --- |
| 1 | Source-policy decisions recorded | Platform/legal owner | No |
| 2 | Exact artifact captured with a receipt | Engineer | Yes |
| 3 | Five source assertions recorded per version | Named platform admin | No |
| 4 | Clause candidates extracted | Engineer (candidates only) | Partly |
| 5 | Four professional approvals in a release envelope | Four named reviewers | No |
| 6 | Production registry populated | Engineer, after stage 5 | Yes, via reviewed code change |

---

## Stage 1 — Record source-policy decisions (human)

Complete section 2 of the decision record. Then reflect each decision in
`shared/regulatory-sources.ts` for the affected source: `retentionPolicy`,
`licensingStatus`, and where applicable `coverageStatus`.

That edit is a reviewed code change, not a runtime toggle. There is deliberately no admin
endpoint that flips a source to permitted.

Reminder — two gates must agree. `buildRegisteredRegulatorySource` requires both the
reviewer's acquisition policy flag **and** the catalogue registration to be permissive, so
editing only one leaves the source fail-closed. That is intended.

## Stage 2 — Capture the exact artifact

Only after stage 1. The fetcher refuses everything else: `assertSourcePolicy` throws
`TERMS_NOT_APPROVED`, `RETENTION_NOT_APPROVED`, or `LICENSING_NOT_APPROVED` before any
network call.

Build the fetcher through the single supported path so the immutable registry is snapshotted
correctly:

```
createDubaiRegulatoryDocumentFetcher({ policies, discoveredDocuments, reviewedDiscoveredDocuments })
```

- Pass a **source key** — never a URL, host allowlist, or policy object. Callers select
  from server-owned registration; they never supply the policy that authorizes their own
  fetch (`LES-044`).
- A landing page is not an artifact. Promote an exact child document with
  `registerDiscoveredRegulatoryDocument`; it inherits only the parent's host allowlist and
  stays `pending_review` until separately reviewed.
- Retrieval is direct-only to the authority's own host. There is no proxy or reader
  fallback, and adding one is out of contract.

The returned receipt is the capture evidence: `sha256`, `statusCode`, `mimeType`,
`byteLength`, `etag`, `lastModified`, `fetchedAt`, `parserVersion`, `redirectCount`,
`requestedUrl`, `finalUrl`. Persist it with `recordRegulatoryCapture`.

Store a `storageReference` **only** when the source's `retentionPolicy` is
`artifact_permitted`. The database refuses it otherwise with `DENIED` — do not work around
that by writing the reference elsewhere.

### Acquisition behaviour you can rely on

- Requests to one official host are serialized and each reserves its rate slot before
  waiting, so concurrent captures cannot burst at a government host (`LES-045`). Different
  approved hosts run independently.
- A reserved slot beyond the operation deadline fails closed with `TIMEOUT` rather than
  sleeping into expiry.
- Robots policy must **explicitly** allow the path; unreachable robots is
  `ROBOTS_UNAVAILABLE`, not permission.
- Redirects may not leave the approved host. Private/reserved IPs are rejected and DNS
  answers are pinned into the socket.
- Defaults: 20 MB max, 3 redirects, 3 attempts, 15 s per request, 45 s per operation, 1 s
  per-host spacing. Raise them deliberately, never to force a stubborn fetch through.

### If a capture changes or disappears

Neither implies repeal. A changed body records `changed_candidate`; a missing page records
`disappeared_candidate`. Both mark existing asserted versions `stale`, which blocks new use
while preserving history. Out-of-order captures are rejected outright with `CONFLICT` —
quarantine and investigate rather than retrying until one lands.

Only a recorded relation (`amends` / `supersedes` / `suspends` / `revokes` / `clarifies`)
plus current assertions can end a version's authority.

## Stage 3 — Record the five source assertions (human)

Per version, through `regulatorySources.assertVersion` (platform admin only):
`document_identity`, `authenticity`, `temporal_status`, `jurisdiction`, `permitted_use`.

The database stamps the acting user id. Do not record an assertion on another person's
behalf; the identity is the point of the record. A version becomes `asserted` only when all
five are accepted and current, and expiry is evaluated at the requested basis instant.

## Stage 4 — Extract clause candidates

Attach candidates to a version with `recordRegulatoryCapture`, each carrying `clauseKey`,
`locator`, `pageLocator`, `candidateSummary`, and an honest `extractionMethod`. Mark AI
assistance as `ai_extracted_candidate` — never as `deterministic`.

Everything lands as `candidate`. Extraction may be assisted; interpretation may not be.
A summary restates what a clause says; it never concludes what a project must do.

## Stage 5 — Obtain professional approvals (human)

Build the envelope from section 6 of the decision record. Four approvals, four disciplines,
four distinct named reviewers, none of whom authored the pack, bound to an exact pack
version and content fingerprint.

`assertTypologyPackV2Release` rejects a malformed or stale envelope automatically, but
passing that check is not approval — it only proves the record is well-formed. The approval
is the named human signature it carries.

## Stage 6 — Populate the production registry

Only after stage 5, and only as a reviewed code change: add the release to
`CHECKED_IN_TYPOLOGY_PACK_V2_RELEASES` and the compiled authority to
`CHECKED_IN_REGULATORY_SOURCE_AUTHORITIES` in `server/engines/typology-pack-v2.ts`.

Both are `Object.freeze([])` today and there is deliberately no runtime path that appends to
them. `resolveProductionTypologyPackV2` still refreshes temporal state from the database at
the requested basis date, so a checked-in release cannot outlive a changed capture,
withdrawn assertion, or new clause relation.

---

## Verification

Run before opening a pull request. All are read-only except `build`.

```bash
pnpm check
pnpm check:mysql-evidence
pnpm audit:authorization
pnpm audit:database-safety
DATABASE_URL='' pnpm test
pnpm build
git diff --check
```

Focused acquisition and pack suites:

```bash
DATABASE_URL='' pnpm vitest run server/engines/ingestion/regulatory-document-fetcher.test.ts server/engines/ingestion/dubai-regulatory-connectors.test.ts server/engines/ingestion/regulatory-sources-catalogue.test.ts server/engines/regulatory-source-resolution.test.ts server/engines/typology-pack-v2.test.ts server/routers/regulatory-sources.authorization.test.ts
```

### Disposable MySQL and the evidence contract

`.agent/state/TR03H_MYSQL_EVIDENCE.json` pins a SHA-256 for 73 files. **Editing any pinned
file without regenerating the evidence breaks `pnpm audit:authorization`**, and it does so
with a confusing cascade of drift rows on unrelated procedures — exactly the BR-06
regression recorded in `LES-046`.

`pnpm check:mysql-evidence` names the drifted files directly, needs no database, and runs in
under a second. Run it before pushing.

To regenerate, use only the guarded workflow against an isolated disposable target, and run
it **last**, after every other change in the commit:

```bash
TEST_DATABASE_URL="mysql://root:<password>@127.0.0.1:<port>/miyar_auth_test_<scope>" pnpm test:authorization:mysql
```

The runner refuses a caller-supplied `DATABASE_URL`, accepts only `localhost`/`127.0.0.1`,
requires the database name to begin with `miyar_auth_test`, and drops the database in a
`finally` block. Prefer a loopback-only container:

```bash
docker run -d --name miyar-mysql-<scope> -p 127.0.0.1:33306:3306 -e MYSQL_ROOT_PASSWORD=<disposable> mysql:8.0
```

Remove it and confirm the database is gone when finished. Never point this at a shared or
production database, and never hand-edit a hash or timestamp — the document is generated,
and an edited hash records a run that did not happen.

---

## Standing prohibitions

- No approval is created by a successful fetch, a green suite, a merged pull request, or any
  document in `docs/artifacts/`.
- No shared or production migration from this runbook. Migration `0055` is verified only
  against disposable targets.
- Candidate packs stay out of runtime, tenant, public, and share projections.
- Tenant administrators cannot release platform packs, and tenant overrides are additive
  only — they may add a cited requirement but never remove, replace, or weaken a released
  regulatory datum.
- Hospitality packs stay blocked while current DET classification criteria are uncaptured.
  DDA, Trakhees/PCFC, DIFC, and Dubai South fail closed until approved overlays exist.
