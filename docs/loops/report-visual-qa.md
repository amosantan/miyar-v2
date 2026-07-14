---
id: loop-report-visual-qa
version: 1
owner: product-and-engineering
risk: high
max_iterations: 5
---

# Report and Visual QA Loop

## Goal and Non-Goals

Prove both data correctness and rendered usability for web, PDF, DOCX, material-board, share, and generated-visual outputs across representative and stress fixtures.

## Trigger

Creation/change of a report, investor summary, design brief, export, shared view, material board, chart, generated image, or print layout.

## Required Context and Inputs

- Product/report contract and approved design references
- API/engine source values and deterministic fixtures
- Report renderer/templates, sharing/access rules, brand/disclaimer requirements
- `docs/VERIFICATION.md`, `docs/SECURITY.md`, and relevant ADRs

## Scope

Data reconciliation, required sections, rendering, accessibility, access control, final artifact inspection, and failure/empty/stress states.

## Non-Goals

- Approving business numbers from appearance alone
- Approving layout from HTML/string assertions alone
- Using production/customer data as a fixture
- Publishing or sharing externally without authorization

## Permissions and Safety Constraints

- Screen/API/report values reconcile to deterministic sources.
- Evidence, assumptions, qualifiers, disclaimer, document ID, and reproducibility remain present.
- Public output exposes only intended read-only data.
- Passing the data contract does not imply passing the rendering contract, or vice versa.

## Preconditions

- [ ] Required sections, order, source fields, and conditional visibility defined.
- [ ] Typical, minimal/partial, empty, large, long-text, large-number, and failed-asset fixtures available.
- [ ] Mobile/desktop and Arabic/bidirectional fixtures included when in scope.
- [ ] Final production generation path is available.

## Human Approval Gates

Require approval for changing mandatory sections/disclaimers, publishing/sharing, client branding, legal/compliance language, financial interpretation, or production artifact replacement.

## Execution Steps

1. Define data and rendering contracts independently.
2. Build deterministic fixtures with exact expected totals.
3. Assert required data, evidence, access, identity, and qualifiers.
4. Generate through the real output path.
5. Render and inspect every page/screen at readable resolution.
6. Classify failures as data, template, renderer, asset, font, browser, access, or fixture.
7. Fix causal layer, regenerate from scratch, and independently review final artifact.

## Verification Ladder

- Targeted report/component tests
- `pnpm check`, relevant `pnpm test`, and `pnpm build`
- Playwright/browser checks for shared/web views
- Production-path PDF/DOCX generation and page rendering
- Independent total reconciliation and visual inspection checklist
- Access tests for valid, invalid, expired, revoked, and cross-project tokens where supported

## Acceptance Criteria

- [ ] Data and rendering contracts both pass.
- [ ] Required evidence, identity, qualifiers, and disclaimers exist.
- [ ] Typical, partial/empty, and stress fixtures pass.
- [ ] Every page/view was rendered and inspected.
- [ ] No critical clipping, overlap, overflow, blank pages, unreadable chart, or broken required image.
- [ ] Responsive/access/error behavior passes.
- [ ] Output exposes no internal or cross-tenant data.

## Failure Classification

Source-data mismatch, template omission, pagination/layout, renderer/font, asset availability, chart/accessibility, public-access scope, localization, or fixture defect.

## Recovery and Rollback

- Data mismatch: repair upstream calculation/contract; do not cosmetically patch report.
- Layout failure: reduce at template/style layer and regenerate all stress fixtures.
- Asset failure: safe placeholder/fallback without broken confidential URL.
- Contract ambiguity: `NEEDS_HUMAN` before removing required content.
- Renderer/environment mismatch: reproduce in production-equivalent renderer.

## Retry Policy

Maximum 5 iterations and 3 attempts per unchanged rendering/data failure class. Each iteration regenerates the artifact. Exhaustion becomes `BLOCKED`.

## Resource Budget

- Maximum loop iterations: 5.
- Set task-specific time, tool-call, cost, and environment limits before execution.
- Stop at the first exhausted hard limit and transition to `BLOCKED` or `NEEDS_HUMAN`.

## Terminal States

- `PASS`: data reconciliation and rendered inspection meet criteria.
- `FAILED`: artifact remains incorrect, unsafe, or unusable.
- `BLOCKED`: renderer/asset/environment/retry limitation prevents proof.
- `NEEDS_HUMAN`: report contract, branding, disclaimer, or publication decision required.
- `CANCELLED`: output change withdrawn.

## Required Evidence

- Fixture IDs and expected totals
- Changed files and diff
- Commands/generation path
- Artifact paths/screenshots and pages/viewports inspected
- Data reconciliation and access results
- Accessibility/localization observations
- Remaining limitations and approvals

## Persistent State Updates

Record task/worklog evidence, update report contract/architecture/ADR when durable requirements change, and add known renderer failures only after reproduction. Never store customer artifacts or expiring URLs in Markdown.
