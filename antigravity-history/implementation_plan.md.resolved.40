# UX Overhaul — From Admin Dashboard to Client Product

## Problem

The app currently has **64 pages** across 5 sidebar sections, all visible to all users. It feels like a developer admin panel, not a premium product for UAE real estate professionals. Specific issues:

1. **Information overload** — 49 sidebar links visible at once, no guidance
2. **Internal tools exposed** — Intel Audit Log, Trend Tags, Ingestion Monitor, Benchmark Health visible to clients
3. **Broken/empty pages** — Competitor Analytics shows names only, Analytics Intelligence empty, projects for other devs show errors
4. **No user journey** — first-time user has no idea what to do
5. **Mobile broken** — many pages overflow or truncate on mobile

---

## Workstream 1: Navigation Restructuring (Role-Based Gating)

### Current State

| Section | Items | Visible To | Problem |
|---------|-------|-----------|---------|
| Main | 3 | All | ✅ OK |
| Analysis | 11 | All | ❌ 6 items are advanced/niche, overwhelming |
| Design | 7 | All (project context) | ⚠️ OK but verbose labels |
| Market Intelligence | 10 | All | ❌ 7 items are internal/admin tools |
| Admin | 18 | Admin only | ✅ Already gated |

### Proposed Structure — Client View (non-admin)

```
📊 Dashboard
📁 Projects
  ➕ New Project

── Project Tools (contextual, only when viewing a project) ──
  🎯 Results & Scoring
  📝 Design Brief
  🎨 Design Studio
  💡 AI Advisor
  📈 Investor Summary
  📋 Reports

── Market ──
  🏙️ DLD Area Insights
  🏢 Competitor Overview

── Account ──
  🔔 Alerts
  ⚙️ Settings (future)
```

**That's ~12 sidebar items** vs the current ~49. Massive simplification.

### What Gets Hidden (Admin-Only / Removed from Sidebar)

#### Move to Admin-Only (route + sidebar):
| Page | Reason |
|------|--------|
| Intel Audit Log | Internal diagnostic tool |
| Trend Tags | Internal data labeling |
| Ingestion Monitor | Backend infrastructure |
| Data Health | Internal QA tool |
| Connector Health | Infrastructure monitoring |
| Source Registry | Internal data curation |
| Evidence Vault (MI) | Admin data management |
| Benchmark Proposals | Internal workflow |
| Analytics Intelligence | Empty/broken, admin tool |
| Benchmark Learning/Dashboard | Admin ML tools |

#### Consolidate into parent pages (remove from sidebar):
| Page | Merge Into |
|------|-----------|
| Scenario Templates | Scenarios page (as a tab) |
| Scenario Comparison | Scenarios page (as a tab) |
| Evidence Vault (project) | Project Detail tabs |
| Explainability | Project Detail / Results |
| Outcomes | Project Detail / Results |
| Collaboration | Project Detail tabs |
| BriefEditor | Design Brief (as edit mode) |
| Space Planner | Design Studio (as tab) |
| Area Verification | Design Studio (as tab) |
| Board Composer | Design Studio (as tab) |
| Visual Studio | Design Studio (already part of it) |

#### Remove from sidebar entirely (keep routes but not nav):
| Page | Reason |
|------|--------|
| Component Showcase | Dev-only demo page |
| Methodology | Public marketing page, not dashboard |
| Simulations | Advanced feature, bury under scenarios |
| Customer Success | Not functional / placeholder |
| Sustainability | Niche, accessible from project |
| Bias Insights | Advanced, accessible from project |
| Risk Heatmap | Advanced, accessible from results |
| Portfolio | Consolidate into Dashboard |

---

## Workstream 2: Guided User Journey

### New User Onboarding
When a user creates their **first project**, show a step indicator:

```
Step 1: Create Project (fill form)  →  
Step 2: Evaluate (run scoring)  →  
Step 3: Design Brief (generate AI brief)  →  
Step 4: Investor Summary (view & share)
```

### Dashboard Redesign
The Dashboard becomes the **command center** with:
- **Active projects** with status badges (Draft → Evaluated → Brief Ready → Shared)
- **Quick actions**: "Create Project", "View Latest Brief", "Share with Investor"
- **Recent activity** feed
- **MIYAR Score overview** for evaluated projects
- Remove raw metric tiles that mean nothing without context

### Empty States
Every page that requires data should show a helpful empty state:
- "No projects yet — Start by creating your first project →"
- "No evaluation results — Evaluate your project to see scoring →"
- Not empty technical error messages

---

## Workstream 3: Fix Broken/Empty Pages

| Page | Issue | Fix |
|------|-------|-----|
| Competitor Analytics | Shows names, no useful data | Show score, market share, project count — or hide if no data with "Coming soon" card |
| Analytics Intelligence | Empty, no data displayed | Move to admin-only; for client view, show insights inline on Dashboard |
| Projects list | Shows other devs' projects → error | Filter by `orgId`/`userId` — already partially done, but fix error boundary |
| Results page | Requires project selection but no context | Auto-select latest project, or show project picker |
| Reports page | Same issue | Same fix |

---

## Workstream 4: Mobile Responsiveness

### Priority Fixes
1. **Sidebar** — should auto-collapse on mobile (already handled via `useIsMobile`)
2. **Tables** — wrap in horizontal scroll containers
3. **Charts/graphs** — responsive width, stack on mobile
4. **Forms** — full-width inputs on mobile, larger touch targets
5. **Project Detail tabs** — horizontal scrollable tab bar, not wrapping
6. **Cards** — stack vertically, remove multi-column grids on small screens

### Approach
Add responsive utility classes globally rather than fixing page-by-page. Key patterns:
- `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for card grids
- `overflow-x-auto` for tables
- `flex-col md:flex-row` for horizontal layouts

---

## Workstream 5: Polish & Professional Feel

1. **Page headers** — consistent pattern: title + subtitle + primary action button
2. **Loading states** — skeleton loaders instead of blank pages
3. **Error boundaries** — friendly error cards with "Go back" / "Try again" instead of "Unexpected error"
4. **Consistent terminology** — "Evaluation" not "Scoring", "Design Intelligence" not "Design Enablement"
5. **Breadcrumbs** — show context: `Projects > Al Wasl Tower > Design Brief`

---

## Implementation Priority

| Priority | Workstream | Impact | Effort |
|----------|-----------|--------|--------|
| 🔴 P0 | Navigation restructuring (sidebar + routing) | Instant clarity | Medium |
| 🔴 P0 | Hide broken pages (Competitors, Analytics) | Stops embarrassment | Small |
| 🟡 P1 | Dashboard redesign with guided journey | First-time UX | Medium |
| 🟡 P1 | Mobile responsiveness | Usability | Medium |
| 🟢 P2 | Empty states + error boundaries | Polish | Small |
| 🟢 P2 | Page consolidation (merge subpages) | Reduced surface | Large |

---

## Verification Plan

### Manual Testing (Browser)
1. Log in as **non-admin user** → verify only ~12 sidebar items visible
2. Log in as **admin user** → verify full sidebar with admin section
3. Navigate to any hidden route as non-admin → verify redirect to 404 or dashboard
4. Create a new project → verify guided step indicator works
5. Open app on mobile viewport (375px) → verify sidebar collapses, content is readable, no horizontal overflow
6. Click "Competitors" → verify it shows meaningful data or a graceful "Coming soon" state
7. View projects list → verify no "other developer" projects appear, no "unexpected error"
8. Navigate project: Detail → Brief → Studio → Investor Summary → verify smooth flow

> [!IMPORTANT]
> **This plan does NOT modify or execute anything.** Review the approach and tell me which workstreams to prioritize, or if you'd like changes to the proposed navigation structure.
