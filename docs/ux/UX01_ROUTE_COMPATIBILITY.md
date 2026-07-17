# UX-01 Route Compatibility

The workflow-first interface changes discovery, not authorization or URL support. Existing links remain registered while the new shell presents fewer primary destinations.

## Canonical workflow destinations

| Workflow | Canonical destination | Contextual legacy destinations |
| --- | --- | --- |
| Overview | `/dashboard` | `/alerts` |
| Projects | `/projects` | `/results`, `/scenarios`, project specialist routes |
| Portfolio | `/portfolio` | `/reports`, `/risk-heatmap`, `/bias-insights`, `/simulations`, `/customer-success` |
| Market | `/market-intel/dld-insights` | `/market-intel/competitors` |
| Administration | `/admin` | All existing `/admin/*` and admin-only `/market-intel/*` routes |

## Project workspace

The canonical project URL is `/projects/:id?section=<section>&view=<view>`.

| Section | Views and compatible specialist routes |
| --- | --- |
| Decision | Overview, explainability, risk, five-lens, ROI, intelligence, predictive; `/projects/:id/explainability`, `/projects/:id/outcomes` |
| Design | Assets, space programme, material cost; `/projects/:id/brief`, `/projects/:id/design-studio`, `/projects/:id/design-advisor`, `/projects/:id/brief-editor`, `/projects/:id/space-planner`, `/projects/:id/verify-areas` |
| Evidence | Evidence library; `/projects/:id/evidence` |
| Deliverables | Reports and approved sharing; `/projects/:id/investor-summary`, `/reports` |
| Settings | Project input review within the workspace |

`/projects/:id/evidence`, `/projects/:id/explainability`, and `/projects/:id/space-planner` are compatibility redirects to their canonical workspace section/view. They preserve the project ID and unrelated query parameters; the canonical destination retains the existing authentication and organization-resource guard.

`/projects/:id/collaboration` and the other specialist routes remain supported contextual workflows because their complete functionality has not yet moved into the workspace. They retain their existing route guards and organization-resource authorization.

No additional compatibility route may be contracted until the corresponding capability exists in the workspace and removal is separately approved.
