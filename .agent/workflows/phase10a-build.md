# Phase 10A Build Workflow — Intelligent Project Intake

## Pre-flight Checklist
- [ ] Read `PHASE_10A_INTELLIGENT_INTAKE_SPEC.md` in project root (full spec with Gemini prompts)
- [ ] Read `server/_core/llm.ts` — understand `invokeLLM()` and how image/audio/file inputs work
- [ ] Read `server/upload.ts` — understand existing S3 upload flow
- [ ] Read `server/engines/design/floor-plan-analyzer.ts` — reuse, do NOT rebuild
- [ ] Read `server/engines/ingestion/crawler.ts` — reuse, do NOT rebuild
- [ ] Read `shared/miyar-types.ts` — ProjectInputs has 50+ fields, understand every one
- [ ] Run existing tests to confirm baseline: `pnpm test` → must pass before starting

---

## Step 1: Schema + DB (MUST do first)

Add three new tables to `server/db/schema.ts`:
- `project_assets`
- `intake_conversations`
- `intake_form_suggestions`

Exact Drizzle schema code is in `PHASE_10A_INTELLIGENT_INTAKE_SPEC.md` → "Drizzle Schema Code" section.

After schema: run `drizzle-kit push` to apply migrations.

Then add DB helper functions (wherever other db helpers live, e.g. `server/db/queries.ts` or inline):
- `createProjectAsset(data)` → inserts row, returns new asset
- `getProjectAssets(projectId, orgId)` → returns all assets for a project
- `updateAssetAnalysis(assetId, analysis, extractedData)` → stores Gemini result
- `createIntakeMessage(data)` → inserts conversation turn
- `getIntakeConversations(projectId, orgId)` → returns full conversation history
- `upsertFormSuggestion(projectId, fieldName, value, confidence, reasoning, sourceAssets)` → insert or update
- `getFormSuggestions(projectId)` → returns all suggestions for a project
- `markSuggestionAccepted(projectId, fieldName)` → sets accepted=true

---

## Step 2: Analyzers (can be built in parallel)

### vision-analyzer.ts
- Location: `server/engines/intake/vision-analyzer.ts`
- Uses `invokeLLM()` with `ImageContent` type (image_url → Gemini fetches and converts to base64 internally)
- System prompt: in spec → "System Prompt: vision-analyzer.ts"
- Output schema: `VisionAnalysis` interface defined in spec
- Use `outputSchema` parameter in `invokeLLM()` for structured JSON output

### document-analyzer.ts
- Location: `server/engines/intake/document-analyzer.ts`
- For floor plans: call existing `analyzeFloorPlanImage()` from `floor-plan-analyzer.ts`
- For PDFs with text: call existing pdf extraction, then pass text to Gemini
- For supplier catalogs (PDF): extract text → Gemini with supplier-focused prompt

### url-analyzer.ts
- Location: `server/engines/intake/url-analyzer.ts`
- Use existing crawler to fetch page HTML/text
- Pass extracted text to Gemini with prompt from spec → "System Prompt: url-analyzer.ts"
- Handle images found on supplier pages — pass top 3 to vision-analyzer for visual confirmation

### voice-processor.ts
- Location: `server/engines/intake/voice-processor.ts`
- Use `FileContent` type in `invokeLLM()` (already in llm.ts: supports "audio/mpeg", "audio/wav", "audio/mp4")
- Single Gemini call: transcribe + extract project intent simultaneously
- Must handle Arabic input — mention Arabic explicitly in the prompt

### ai-assist.ts
- Location: `server/engines/intake/ai-assist.ts`
- Takes field name + current form values → returns suggestion with reasoning
- For market fields (mkt01Tier, ctx04Location): call `computeAreaPriceStats()` from `dld-analytics.ts` to get live DLD data for reasoning
- System prompt: in spec → "System Prompt: ai-assist.ts"

---

## Step 3: Core Engine

### asset-manager.ts
- Location: `server/engines/intake/asset-manager.ts`
- Dispatch table by MIME type:
  - `image/*` → `analyzeImage()` from vision-analyzer
  - `application/pdf` → `analyzeDocument()` from document-analyzer
  - `audio/*` → `processVoice()` from voice-processor
  - `text/plain` with URL format → `analyzeUrl()` from url-analyzer
- After analysis: update `project_assets.aiAnalysis` with result
- Run analysis asynchronously after upload (don't block the response)

### intent-mapper.ts ⭐ MOST CRITICAL
- Location: `server/engines/intake/intent-mapper.ts`
- Collects all asset analyses + conversation history
- Builds mega-prompt (see spec: "System Prompt: intent-mapper.ts") — this is long and precise, copy it exactly
- Uses `outputSchema` with `FORM_SUGGESTIONS_SCHEMA` (see spec: "OutputSchema for intent-mapper.ts")
- Handles conflict detection: if signals contradict, low confidence + conflict noted in reasoning
- Returns `FormSuggestions` with values, confidence, reasoning, missingCritical, summary
- CRITICAL RULES from spec:
  - Never fill `fin01BudgetCap` without explicit number
  - Never fill `ctx03Gfa` without floor plan data or explicit statement
  - Never fill `city` without explicit mention
  - Confidence < 0.3 → put in missingCritical, not in values

---

## Step 4: Router

### intake.ts
- Location: `server/routers/intake.ts`
- Use `orgProcedure` for all procedures (same as `economics.ts`, `bias.ts`, etc.)
- 8 procedures: `uploadAsset`, `addUrl`, `processVoice`, `chat`, `generateSuggestions`, `getFieldAssist`, `getProjectAssets`, `acceptSuggestions`
- Register in main router index (wherever `economicsRouter`, `biasRouter` etc. are added)

---

## Step 5: Frontend

### AssetGallery.tsx (build first — standalone)
- Location: `client/src/components/AssetGallery.tsx`
- Grid of uploaded assets
- Shows thumbnail for images, icon for PDFs/audio/URLs
- Shows analysis status badge: "Analyzing..." / "✓ Analyzed" / "Failed"
- Click to expand: shows full AI analysis + which form fields it informed

### AiAssistButton.tsx (standalone)
- Location: `client/src/components/AiAssistButton.tsx`
- Small sparkle icon button
- Click → popover with question input
- On submit: calls `trpc.intake.getFieldAssist.mutate()`
- Shows suggested value + reasoning + "Apply" button
- Apply → calls parent's form state setter

### IntakeCanvas.tsx
- Location: `client/src/components/IntakeCanvas.tsx`
- Layout: left panel (60%) with drop zone + URL bar + chat, right panel (40%) with AssetGallery + form progress
- Drop zone: accept image/*, application/pdf, audio/*, .dwg
- URL bar: paste → calls `trpc.intake.addUrl.mutate()`
- Chat: text input + voice record button → calls `trpc.intake.chat.mutate()`
- After each asset/message: calls `trpc.intake.generateSuggestions.mutate()` → updates right panel preview
- Form progress: shows per-section fill % using confidence thresholds
- "Show me the form" button: navigates to ProjectForm with suggestions in state

### Modify ProjectForm.tsx
- Add path selector BEFORE step 1 (three cards: AI-guided, Expert, Quick brief)
- Add `AiAssistButton` next to each section header
- Accept optional `intakeSuggestions: FormSuggestions` prop
- When suggestions prop present: pre-fill form fields + show confidence indicators
  - Green border = confidence ≥ 0.8
  - Amber border + tooltip = confidence 0.5–0.79 (tooltip shows reasoning)
  - Red/empty = < 0.5 or missingCritical
- Expert path: skip IntakeCanvas, go straight to step 1 (unchanged behavior)

---

## Step 6: Tests

File: `server/engines/intake/intake.test.ts`

Minimum 20 tests:
1. vision-analyzer: mock Gemini → correct VisionAnalysis structure returned
2. vision-analyzer: Italian marble image → detectedTier "Ultra-luxury"
3. vision-analyzer: basic tile image → detectedTier "Mid"
4. document-analyzer: floor plan PDF → floorPlanData.totalAreaSqm populated
5. document-analyzer: supplier catalog → supplierData.materials populated
6. url-analyzer: supplier URL → urlType "supplier", materials extracted
7. url-analyzer: Emaar project URL → urlType "competitor_project"
8. voice-processor: English audio → transcript + intent extracted
9. voice-processor: Arabic project description → maps to correct English fields
10. intent-mapper: mood board (Modern, Luxury) + "200sqm JBR" chat → correct mkt01Tier + ctx04Location
11. intent-mapper: conflicting signals (Ultra-luxury images + "tight budget" chat) → confidence < 0.6 on mkt01Tier
12. intent-mapper: no budget mentioned → fin01BudgetCap in missingCritical
13. intent-mapper: "budget is 2 million AED" → fin01BudgetCap: 2000000, confidence > 0.9
14. intent-mapper: minimal input (1 image only) → >50% fields in missingCritical
15. ai-assist: field "mkt01Tier" + JBR context → response includes DLD data in reasoning
16. ai-assist: field "fin01BudgetCap" → response suggests value range based on tier + area
17. asset-manager: image MIME type → triggers vision-analyzer
18. asset-manager: audio MIME type → triggers voice-processor
19. intake router: uploadAsset → asset created in DB with orgId scoping
20. intake router: generateSuggestions → returns FormSuggestions with all required keys

---

## Post-Build Checklist
- [ ] All 3 paths create a project successfully
- [ ] Uploaded assets visible in project after creation
- [ ] AI suggestions show confidence + reasoning on all pre-filled fields
- [ ] fin01BudgetCap NOT filled when budget not explicitly stated
- [ ] Expert path: straight to form, no intake canvas shown
- [ ] AI Assist on any field returns reasoning within 3 seconds
- [ ] Arabic voice input maps correctly to English form fields
- [ ] Scoring engine output identical for AI-filled vs manually-filled with same values
- [ ] All existing tests pass (zero regressions)
- [ ] 20+ new intake tests pass
- [ ] Write `V10A_PHASE_REALITY_REPORT.md` summarizing what was built
