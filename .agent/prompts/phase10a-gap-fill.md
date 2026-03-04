# Phase 10A Gap-Fill — Antigravity Prompt

## Context

Phase 10A Intelligent Project Intake is **partially built**. Before starting, read:
- `PHASE_10A_INTELLIGENT_INTAKE_SPEC.md` (root of project) — full spec
- `server/engines/intake/ai-intake-engine.ts` — ALREADY BUILT, do NOT rebuild
- `server/routers/intake.ts` — ALREADY BUILT, do NOT rebuild
- `client/src/pages/ProjectNew.tsx` — ALREADY BUILT, do NOT rebuild
- `drizzle/schema.ts` — understand existing `projectAssets` mysqlTable before adding
- `server/engines/ingestion/connector.ts` — has `fetchBasic()` method to scrape URLs

## What Is Already Working

- ✅ `processIntakeAssets()` in `ai-intake-engine.ts` — full multimodal Gemini engine
- ✅ `suggestSectionFields()` in `ai-intake-engine.ts` — section-level AI assist
- ✅ `intakeRouter` in `server/routers/intake.ts` — 6 procedures, registered in routers.ts
- ✅ `project_assets` mysqlTable in `drizzle/schema.ts`
- ✅ `ProjectNew.tsx` — drag-drop upload, URL input, voice recording, review phase, pre-fills form
- ✅ `AiSectionAssist` in `ProjectForm.tsx` — section-level AI suggestions with confidence
- ✅ Both intake and salesPremium routers registered in `server/routers.ts`

## What Still Needs Building (5 Gaps)

---

### GAP 1 — URL Scraping Before Gemini Analysis

**Problem:** When a developer pastes a supplier URL (e.g. porcelanosa.com, minotti.com), the URL is added to assets with `textContent: undefined`. The engine passes the raw URL to Gemini, but Gemini can't reliably fetch external pages. The result is weak analysis of supplier content.

**Fix:** Add a `scrapeUrl` tRPC procedure to `server/routers/intake.ts` that:
1. Uses `BaseSourceConnector.fetchBasic()` from `server/engines/ingestion/connector.ts`
2. Extracts the raw text (strip HTML tags, limit to 8000 chars)
3. Returns `{ textContent: string; title: string; domain: string }`

Then update `handleAddUrl` in `client/src/pages/ProjectNew.tsx`:
- After adding URL to assets, call `trpc.intake.scrapeUrl.mutate({ url })` immediately
- Show a "Fetching..." badge on the URL asset while loading
- On success, update the asset's `textContent` field with the scraped text
- On failure (network error, CORS, 403), just leave textContent undefined — don't block the flow

**New procedure signature to add to `server/routers/intake.ts`:**
```typescript
scrapeUrl: orgProcedure
  .input(z.object({ url: z.string().url() }))
  .mutation(async ({ input }) => {
    // instantiate a minimal connector with just the URL, call fetchBasic()
    // return { textContent, title, domain }
  })
```

**Important:** Do NOT use the full `CrawlingConnector` (that's for multi-page crawls). Use a direct `fetchBasic()` call on `BaseSourceConnector`. Extend it minimally or instantiate a simple subclass.

---

### GAP 2 — Three-Card Path Selector on Entry

**Problem:** `ProjectNew.tsx` shows a `mode` toggle (intake / form) as a small header button. The spec requires a proper entry screen with three distinct paths before the developer starts.

**Fix:** Add a new UI state `phase: "select" | "upload" | "analyzing" | "review"` (add "select" as the initial phase).

When `phase === "select"`, render a full-screen three-card selector **before** showing the intake canvas or form:

```
┌─────────────────────────────────────────────────────────────────┐
│        How would you like to create this project?               │
│                                                                 │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │  🤖 AI-Guided    │ │  👤 Expert Mode  │ │  ⚡ Quick Brief  ││
│  │                  │ │                  │ │                  ││
│  │ Upload images,   │ │ Jump straight to │ │ Paste a paragraph││
│  │ PDFs, URLs,      │ │ the 7-step form. │ │ or record a voice││
│  │ voice notes.     │ │ AI Assist on     │ │ note. Get ~70%   ││
│  │ MIYAR fills the  │ │ each section.    │ │ filled in 60     ││
│  │ form for you.    │ │                  │ │ seconds.         ││
│  │                  │ │                  │ │                  ││
│  │   [Start →]      │ │   [Start →]      │ │   [Start →]      ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

- **AI-Guided** card → sets `mode = "intake"`, `phase = "upload"`
- **Expert Mode** card → sets `mode = "form"`, renders `<ProjectForm />` directly (existing behavior)
- **Quick Brief** card → sets `mode = "intake"`, `phase = "upload"`, AND sets a `quickMode` boolean that:
  - Hides the drag-drop zone (only shows text area + voice record)
  - Shows a single large textarea: "Describe your project (location, style, budget, typology...)"
  - Voice record button beside it
  - Single "Analyze" button

**Styling notes:** Use the existing dark card style from the app. Cards should have hover state (scale up slightly, border highlight). This replaces the existing small "Switch to form" toggle buttons — remove those once the path selector is in place.

---

### GAP 3 — Conversational Chat in Intake Canvas

**Problem:** The intake canvas has no back-and-forth conversation. Developers often want to type additional context ("btw the client wants a rooftop pool" or "material budget is separate from civil works") after uploading assets. Currently there's no way to do this.

**Fix:** Add a chat panel to `ProjectNew.tsx` below the drop zone (when `mode === "intake"` and `phase === "upload"`):

**UI additions:**
```
[Existing drop zone and URL bar]
─────────────────────────────
💬 Add Context (optional)
┌─────────────────────────────────────────────────────┐
│ Type any details about the project...               │
│                                                     │
│                                            [Send →] │
└─────────────────────────────────────────────────────┘
Previous messages appear above as bubbles (user messages right, optional)
```

**Implementation:**
- Add `chatMessages: Array<{ role: "user" | "assistant"; text: string; timestamp: Date }>` to component state
- On send: push message to `chatMessages`, then immediately call `trpc.intake.chat.mutate({ projectId, message, assets })`
- The response appends an assistant reply to `chatMessages`
- Chat messages are passed to `handleAnalyze()` as a concatenated `freeformDescription` when the developer clicks "Analyze"

**New tRPC procedure to add to `server/routers/intake.ts`:**
```typescript
chat: orgProcedure
  .input(z.object({
    message: z.string(),
    projectId: z.number().optional(),
    previousMessages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      text: z.string(),
    })).default([]),
  }))
  .mutation(async ({ input }): Promise<{ reply: string }> => {
    // Call invokeLLM with a simple conversational system prompt:
    // "You are MIYAR, a UAE real estate design intelligence assistant.
    //  The developer is describing a new project. Respond in 2-3 sentences max.
    //  Acknowledge what you understood, note if anything critical is missing
    //  (budget, location, typology, GFA), and encourage them to proceed to analysis."
    // Pass previousMessages as conversation history
    // Return { reply }
  })
```

**Important:** This chat does NOT persist to DB (no intake_conversations table required now). Messages exist only in component state during intake session. They are flushed into `freeformDescription` when `processAssets` is called.

---

### GAP 4 — Per-Field Confidence Indicators on ProjectForm

**Problem:** When `initialData` pre-fills form fields from AI analysis, the developer has no visual cue about which fields were AI-filled and how confident the AI was. They currently have to read the confidence accordion in the review screen and then find the matching field in the form.

**Fix:** Two changes:

**A) Extend the `initialData` prop on `ProjectForm.tsx`:**
Currently `initialData?: Partial<FormData>`. Change to also accept:
```typescript
initialData?: Partial<FormData>;
fieldConfidence?: Record<string, number>; // field name → confidence 0-1
fieldReasoning?: Record<string, string>;  // field name → reasoning text
```

**B) Visual indicators on pre-filled fields:**
For any field whose name appears in `fieldConfidence`:
- Wrap the field's label element in a relative container
- Add a small colored dot or border indicator to the right of the label:
  - `confidence >= 0.8` → `🟢` (or a small emerald dot) + tooltip shows reasoning
  - `confidence >= 0.5` → `🟡` (amber dot) + tooltip shows reasoning
  - `confidence < 0.5` → `🔴` (red dot) + tooltip explains low confidence
- Tooltip: use the existing shadcn `Tooltip` + `TooltipContent` pattern already in the codebase

**C) Update `ProjectNew.tsx` to pass field-level data:**
The `IntakeResult` from `processIntakeAssets()` returns `suggestedInputs` and `fieldConfidence`. After review, when navigating to `ProjectForm`, pass:
```typescript
fieldConfidence={result.fieldConfidence}
fieldReasoning={result.fieldReasoning}
```

**Scope:** Only implement on the most important fields (the ones with high developer confusion potential):
- `mkt01Tier`, `des01Style`, `des02MaterialLevel`, `des03Complexity`, `ctx04Location`, `fin01BudgetCap`, `ctx03Gfa`
- Skip implementing on every single field — it's enough to do the 7 most impactful

---

### GAP 5 — Assets Tab on ProjectDetail Page

**Problem:** After a developer creates a project via the AI intake flow, the uploaded images, PDFs, and voice notes are stored in `project_assets` table but are completely invisible in the project detail view. The developer has no way to see what assets informed the scoring.

**Fix:** Add an "Assets" tab to `ProjectDetail.tsx` (add after the "Evidence" tab in the `TabsList`).

**Tab content:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Intake Assets                               [+ Add Assets]     │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                          │
│  │ img  │ │ img  │ │ PDF  │ │ URL  │                          │
│  │      │ │      │ │ icon │ │ icon │                          │
│  └──────┘ └──────┘ └──────┘ └──────┘                          │
│  filename  filename  filename  domain                           │
│  Analyzed  Analyzed  Analyzed  Analyzed                        │
│                                                                 │
│  [Click any asset → shows modal with AI analysis summary]       │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Use `trpc.intake.listAssets.useQuery({ projectId })` — this procedure already exists
- For images: show thumbnail using `storageUrl`
- For PDFs/audio/URL: show appropriate icon (FileText / FileAudio / Globe from lucide-react)
- Show filename + `assetType` badge
- Show "Analyzed" or "Pending" badge based on `aiExtractionResult !== null`
- Click → open a shadcn `Dialog` showing:
  - Asset filename + type + size
  - `aiExtractionResult` formatted (if present): show as a simple JSON-prettified card or key-value list
  - Which form fields it contributed to (`aiContributions` array)
- "[+ Add Assets]" button → navigates to `ProjectNew` in a mode that allows adding more assets to an existing project (pass `projectId` as query param)

---

## Build Order

Do these in order (each builds on the previous):

1. **GAP 1** (URL scraping) — server side only, no frontend deps
2. **GAP 2** (Three-card path selector) — frontend only, no server deps
3. **GAP 3** (Chat) — server + frontend, needs GAP 1 complete first
4. **GAP 4** (Confidence indicators) — frontend only, modify existing ProjectForm
5. **GAP 5** (Assets tab) — frontend only, uses existing `listAssets` procedure

---

## Critical Rules — Do NOT Break These

1. **NEVER modify `shared/miyar-types.ts` → `ProjectInputs`** — it's the source of truth for scoring
2. **NEVER change the scoring engine** — `calculateProjectScore()` and all its sub-calculators are deterministic and must stay untouched
3. **NEVER store voice/audio in the DB** — transcripts only, audio stays on S3
4. **NEVER auto-fill `fin01BudgetCap`, `ctx03Gfa`, or `city`** without explicit developer input
5. **All new tRPC procedures must use `orgProcedure`** — never `publicProcedure` or `protectedProcedure`
6. **Run existing tests after each gap** — `pnpm test` — zero regressions allowed

---

## Acceptance Criteria

After all 5 gaps are filled:
- [ ] Pasting a Porcelanosa.com URL into intake → Gemini receives extracted text content, not just the URL
- [ ] New project creation shows 3-card selector before anything else
- [ ] Developer can type "btw client wants rooftop terrace" in chat and it gets included in analysis
- [ ] Pre-filled form fields show green/amber/red dots next to field labels with reasoning tooltip
- [ ] ProjectDetail "Assets" tab shows all uploaded intake assets with AI analysis summaries
- [ ] All existing tests pass (zero regressions)
