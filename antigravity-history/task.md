# UX Overhaul — Task Tracker

## P0 — Navigation Restructuring
- [x] Simplify sidebar: ~49 items → ~10 for clients
- [x] Move market-intel internal pages to admin-only sidebar
- [x] Gate 8 market-intel routes as `AdminOnly` in `App.tsx`
- [x] Keep DLD Insights + Competitors as client-accessible
- [x] Update `activeMenuItem` lookup
- [x] Verify in browser — confirmed working

## P0 — Fix Broken Pages & Dashboard
- [x] Fix Dashboard quick actions (was pointing to admin pages)
- [x] Remove hardcoded dummy chart from project rows
- [x] Review Competitors page — functional, data-dependent
- [x] Add error boundary for project pages

## P1 — Mobile Responsiveness
- [x] Enhanced mobile CSS: tabs scroll, dialog fullwidth, badge wrap
- [x] Form field stacking on mobile
- [x] Flex container wrapping
- [x] Card padding reduction

## P2 — Polish
- [x] Create reusable `PageHeader` component with breadcrumbs
- [x] Apply `PageHeader` to key pages (Dashboard, Projects, Scenarios, Portfolio, DLD, Competitors)
- [x] Create reusable `PageSkeleton` loading component
- [x] Add error boundary wrapper for project sub-pages
- [x] Standardize page titles and descriptions (Results, Alerts, ScenarioComparison)
