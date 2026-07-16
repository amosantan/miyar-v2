# Organization-Resource Authorization Contract

## Purpose

This contract defines the reusable server-side authorization boundary for organization-owned projects and resources. It complements the router inventory in `RESOURCE_AUTHORIZATION_INVENTORY.md`; the inventory identifies paths, while this contract defines how later remediation must authorize them.

Authentication establishes identity. `orgProcedure` additionally establishes a non-null organization context. Neither one authorizes a caller-supplied project or resource ID.

## Authenticated Resource Resolution

Authorization helpers live under `server/_core/` and accept dependency-injected lookup functions:

| Ownership shape                     | Helper                                | Successful result                            |
| ----------------------------------- | ------------------------------------- | -------------------------------------------- |
| Project                             | `requireProjectForOrg`                | Project                                      |
| Resource → project                  | `requireProjectResourceForOrg`        | Resource and project                         |
| Child → parent → project            | `requireNestedProjectResourceForOrg`  | Child, parent, and project                   |
| Resource → organization             | `requireOrgResourceForOrg`            | Resource                                     |
| Resource → project and organization | `requireProjectOrgResourceForOrg`     | Resource and project after both claims agree |
| Ordered resource IDs                | `requireProjectResourceBatchForOrg`   | Ordered complete result                      |
| Type and ID                         | `createPolymorphicResourceAuthorizer` | Discriminated authorized result              |

Routers must finish authorization before invoking storage, AI, report generation, database mutation, or other downstream side effects. Returned parent records should be reused rather than fetched again without scope.

Batch authorization is an all-or-nothing authorization decision. It preserves input order and duplicates and returns no partial result when an item fails. It is not a database transaction; callers remain responsible for transactional writes after authorization succeeds.

## Failure Contract

Missing, cross-organization, legacy-null, orphaned, inconsistent-parent, and unsupported polymorphic resources are concealed with a stable `TRPCError` using `NOT_FOUND`.

- Do not include resource IDs, organization IDs, ownership details, table names, tokens, full records, or stack traces in the response or authorization logs.
- Do not translate legacy `userId` ownership into organization access.
- A required nullable organization field is fail-closed: null is unauthorized, not global or public.
- Infrastructure and lookup failures that are not authorization `NOT_FOUND` errors remain operational errors; authorization helpers do not hide them as missing resources.
- Equivalent authorization failures follow the same resolver contract without deliberately distinguishable response behavior. Constant-time database resolution is not claimed.

## Polymorphic Targets

Polymorphic types require a closed, typed resolver registry:

- Build production registries in the core authorization layer for a named domain.
- Copy and freeze the registry at construction.
- Validate the input type before dispatch.
- Never accept a caller- or router-supplied resolver map.
- Never treat an unknown type as global; reject it with the standard missing-resource contract.

TR-03 and TR-04 own the production registries because they own the relevant design, evidence, tag, comment, and asset-link policies.

## Public Shares

Public token access is separate from authenticated organization access. `requireActivePublicShare` authorizes:

```text
token -> AI design brief -> project
```

A share is active only when:

- the token resolves to a brief;
- expiry exists and is strictly later than the current UTC time;
- the brief and project both have non-null organization owners;
- `brief.orgId === project.orgId`.

An expiry equal to the current time is expired. Missing, expired, invalid-date, null-expiry, orphaned, null-owner, and mismatched-owner shares use one `NOT_FOUND` response.

The helper authorizes the token chain only. A public router must separately remain query-only, minimize its response, exclude confidential/internal fields, support revocation, and avoid logging token values. TR-03 owns that router adoption and verification.

## Testing Contract

Every resource-family adoption requires:

- unauthenticated and organization-less cases at the procedure boundary;
- same-organization success;
- cross-organization, missing, legacy-null, orphan, and inconsistent ownership cases;
- proof that downstream work does not begin after rejection;
- two-organization synthetic fixtures with no shared/external database access;
- the same observable error contract for missing and unauthorized resources.

Public-share adoption additionally requires active, expired, exact-boundary, null-expiry, invalid, revoked, missing-project, and organization-mismatch cases plus response-minimization and read-only assertions.

## Roadmap Adoption

- `TR-03`: design assets, briefs, boards, visuals, comments, floor plans, and public shares.
- `TR-04`: remaining project, child, organization, polymorphic, and governed-global paths.
- `TR-05`: organization-isolated learning, evidence, comparison, and prediction data.

The authorization inventory remains open until those steps replace unsafe router paths and update their classifications with passing negative-path evidence.
