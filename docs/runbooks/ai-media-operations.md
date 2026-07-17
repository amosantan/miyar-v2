# AI and Multimodal Media Operations

## Purpose

This runbook covers customer-facing AI/media failures: upload finalization, Gemini multimodal analysis, Gemini Files API preparation, and generated images. It does not authorize production changes by itself.

## Safety model

The browser uploads to a short-lived signed S3 `PUT` URL. The server is the sole authority that finalizes an asset: it reads the private object, validates its bytes, derives canonical metadata and a SHA-256 checksum, then persists the asset. No client URL, object key, MIME label, size, or asset type is trusted as an authority.

Only validated media may enter `server/_core/llm.ts`. Small images can be sent inline. PDFs, audio, video, and larger images use Gemini's temporary Files API, which is polled to a fixed deadline and deleted in `finally`.

## Customer-visible error taxonomy

| Code | Retryable | Customer meaning |
|---|---:|---|
| `MEDIA_INVALID` | No | The file is damaged or does not match its declared format. |
| `MEDIA_UNSUPPORTED` | No | The file type is not supported. |
| `MEDIA_TOO_LARGE` | No | The file exceeds the supported 50 MB limit. |
| `MEDIA_UNAVAILABLE` | Yes | The server could not retrieve the validated object. |
| `PROVIDER_REJECTED_INPUT` | No | The provider could not process this valid submission. |
| `PROVIDER_RATE_LIMITED` | Yes | The provider is temporarily busy. |
| `PROVIDER_UNAVAILABLE` | Yes | The provider is temporarily unavailable. |
| `PROVIDER_UNAUTHORIZED` | No | Provider credentials or permission are unavailable. |
| `PROVIDER_TIMEOUT` | Yes | The provider is still processing the file or exceeded its deadline. |
| `PROVIDER_INVALID_RESPONSE` | No | Provider output was empty or did not match the expected schema. |
| `CONTENT_BLOCKED` | No | The provider declined the supplied content. |

Every error shown to a customer includes a correlation/reference ID. Do not ask a customer to send the provider body or screenshot containing secrets.

## Triage and correlation lookup

1. Obtain the reference ID, approximate time, project, and affected workflow from the customer.
2. Search restricted structured logs/Sentry by `correlationId`; access is limited to approved operators.
3. Confirm the operation name, stable code, provider HTTP status (if present), byte size, canonical MIME type, and cleanup outcome. Do not copy provider bodies, temporary file URLs, signed URLs, or keys into tickets.
4. Check whether the issue is one object, one organization, or a provider-wide pattern. Preserve the object for investigation only within approved retention/access rules.
5. Give the customer the safe code-appropriate next step: replace invalid media, retry a temporary failure, or contact support with the reference ID.

## Retry and outage handling

- The service has a request deadline and makes at most two retries only for network failures, HTTP 429, and HTTP 5xx conditions.
- Never retry malformed/unsupported media, 400-class rejected input, credential failures, or blocked content automatically.
- During an outage, leave the uploaded asset available to its authorized project but do not mark it successfully analysed. Return the safe retryable state, monitor provider status, and use a small synthetic canary after recovery.
- Never switch to an unreviewed provider, relax validation, or replay customer content into another system during an outage.

## Cleanup and recovery

- If finalization fails validation or persistence is explicitly rejected, attempt S3 object cleanup through the existing bounded compensation helper. Investigate cleanup telemetry rather than blindly deleting prefixes.
- Gemini provider files are temporary and deletion is attempted in `finally`; failed deletion is telemetry-only because Gemini also applies temporary retention. Record a recurring cleanup failure with provider status and correlation ID.
- Do not manually delete production objects, change bucket lifecycle/CORS, or replay failed customer media without the corresponding human approval and retention review.

## Production S3 CORS gate

This repository does not mutate production bucket configuration. Before enabling direct browser upload in production, an approved operator must configure the production bucket so that:

- the only allowed origin is `https://miyar.dev`;
- the only direct method is `PUT` (plus any required browser preflight method);
- allowed headers are limited to `Content-Type` and AWS signed-request headers;
- objects remain private and public ACL/policy access is disabled;
- the server-only finalization step remains mandatory.

Record the approver, bucket/environment, exact policy, test result, and rollback owner in the release evidence.

## Synthetic release canary (human-approved)

Use disposable, non-customer PNG/JPEG/WebP, PDF, MP3/WAV/M4A/OGG/WebM audio, and MP4/WebM video fixtures. Verify signed upload, server finalization, canonical metadata/checksum, intended AI operation, safe failed-file display, and temporary-file cleanup. Test a corrupt image separately and verify it fails with `MEDIA_INVALID` without reaching the provider. Remove disposable assets under the approved retention process.
