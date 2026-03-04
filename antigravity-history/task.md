# Phase 10A Gap-Fill

## GAP 1 — URL Scraping Before Gemini Analysis
- [x] Add `scrapeUrl` tRPC procedure to `server/routers/intake.ts`
- [x] Update `handleAddUrl` in `client/src/pages/ProjectNew.tsx` to handle scraping
- [x] Update URL asset `textContent` field with scraped text

## GAP 2 — Three-Card Path Selector on Entry
- [x] Add `phase: "select" | "upload" | "analyzing" | "review"` state to `ProjectNew.tsx`
- [x] Create entry screen (`phase === "select"`) with 3 cards
- [x] Wire card clicks: Expert -> `mode="form"`, AI/Quick -> `mode="intake", phase="upload"`
- [x] Implement Quick Brief mode logic (conditionally hide drag/drop & URL on upload screen)s
- [ ] Remove old "Switch to form" toggle button

## GAP 3 — Conversational Chat in Intake Canvas
- [x] Create `chat` tRPC procedure in `server/routers/intake.ts` using MIYAR Chat Prompt
- [x] Call `invokeLLM` with history context
- [x] In `ProjectNew.tsx`, add `messages` state and chat UI widget for conversational mode
- [x] Aggregate chat messages into `freeformDescription` before calling `processAssets`cription` on "Analyze"

## GAP 4 — Per-Field Confidence Indicators on ProjectForm
- [x] Extend `initialData` prop type on `ProjectForm.tsx` to include `fieldConfidence` and `fieldReasoning`
- [x] Pass these from `ProjectNew.tsx` when rendering `<ProjectForm />`
- [x] In `ProjectForm.tsx`, display a small tooltip or badge next to fields that were AI-populated (check if `fieldConfidence[fieldName]` exists)y, ctx04Location, fin01BudgetCap, ctx03Gfa)
- [ ] Pass `fieldConfidence` and `fieldReasoning` from `ProjectNew.tsx` to `ProjectForm.tsx`

## GAP 5 — Assets Tab on ProjectDetail Page
- [x] Create `Assets` tab within `ProjectDetail.tsx` (next to Overview, Evaluation, etc.)
- [x] Render a grid/list of `project_assets` filtering by `projectId`
- [x] Build an Asset Modal that opens on click:
  - left side: Original file preview
  - right side: `extracted_information` JSON viewers`
