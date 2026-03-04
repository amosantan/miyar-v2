# Phase 10A: Intelligent Project Intake

## What This Phase Does

Replaces the rigid 7-step form-first project creation with a flexible intake system where developers can express their vision naturally (images, voice, chat, files, URLs) and MIYAR auto-populates the existing ProjectInputs form. The form remains the source of truth — the intake just changes how it gets filled.

---

## Three User Paths (Same Destination)

### Path 1: "Talk to MIYAR" (AI-Guided)
New or busy developer. Opens a blank canvas. Uploads mood boards, floor plans, supplier catalogs. Pastes URLs. Types or speaks their vision. MIYAR analyzes everything → auto-fills the 7-step form → developer reviews and submits.

### Path 2: "I Know What I Want" (Expert)
Experienced developer. Goes straight to the existing 7-step wizard. Fills it manually. BUT every form section has an "AI Assist" button — developer can ask MIYAR for help on any specific field without leaving the form.

### Path 3: "Quick Brief + Refine" (Hybrid)
Developer records a voice note or types a paragraph. MIYAR fills 60-70% of the form. Developer completes the rest manually. Most common real-world path.

**ALL THREE PATHS** end at the same existing ProjectForm.tsx wizard, which feeds into the existing scoring engine unchanged.

---

## Database Schema Additions

### Table: `project_assets`
Stores every file, URL, and voice clip uploaded during intake. These persist permanently on the project for use by design briefs, reports, and investor summaries.

```
project_assets
├── id              (serial, PK)
├── projectId       (integer, FK → projects.id, NOT NULL)
├── orgId           (integer, FK → organizations.id, NOT NULL)
├── assetType       (text: 'image' | 'pdf' | 'dwg' | 'url' | 'voice' | 'text')
├── category        (text: 'mood_board' | 'floor_plan' | 'supplier_catalog' | 'reference_project' | 'material_sample' | 'voice_brief' | 'text_brief' | 'supplier_url' | 'competitor_url' | 'other')
├── fileName        (text, nullable — original file name)
├── fileUrl         (text — S3 URL for files, or raw URL for web links)
├── mimeType        (text, nullable)
├── fileSizeBytes   (integer, nullable)
├── aiAnalysis      (jsonb, nullable — Gemini's analysis of this asset)
├── extractedData   (jsonb, nullable — structured data pulled from asset: materials, prices, styles, etc.)
├── createdAt       (timestamp, default now)
└── updatedAt       (timestamp, default now)
```

### Table: `intake_conversations`
Stores chat/voice conversation history during project intake.

```
intake_conversations
├── id              (serial, PK)
├── projectId       (integer, FK → projects.id, NOT NULL)
├── orgId           (integer, FK → organizations.id, NOT NULL)
├── role            (text: 'user' | 'assistant')
├── contentType     (text: 'text' | 'voice_transcript')
├── content         (text — the message or transcript)
├── attachedAssetIds (jsonb, nullable — array of project_asset IDs referenced in this message)
├── createdAt       (timestamp, default now)
```

### Table: `intake_form_suggestions`
Stores the AI's suggested form values with confidence and reasoning so the developer can see WHY AI chose each value.

```
intake_form_suggestions
├── id              (serial, PK)
├── projectId       (integer, FK → projects.id, NOT NULL)
├── fieldName       (text — exact key from ProjectInputs, e.g. 'mkt01Tier')
├── suggestedValue  (text — the value AI suggests)
├── confidence      (real — 0.0 to 1.0)
├── reasoning       (text — why AI chose this value, shown to developer)
├── sourceAssetIds  (jsonb — which project_assets informed this suggestion)
├── accepted        (boolean, default false — did developer accept this suggestion?)
├── createdAt       (timestamp, default now)
```

---

## New Engine Files

All new files go under `server/engines/intake/`

### 1. `server/engines/intake/vision-analyzer.ts`

**Purpose:** Analyzes uploaded images (mood boards, material photos, reference interiors) via Gemini Vision.

**Input:** Image URL (S3) or base64
**Output:** Structured JSON:

```typescript
interface VisionAnalysis {
  detectedStyle: DesignStyle | null;         // "Modern", "Contemporary", "Minimal", etc.
  detectedTier: MarketTier | null;           // "Mid", "Luxury", "Ultra-luxury"
  detectedMaterials: Array<{
    name: string;                             // "marble flooring", "oak veneer"
    category: string;                         // "flooring", "wall_finish", "joinery"
    estimatedTier: "affordable" | "mid" | "premium" | "ultra";
    confidence: number;
  }>;
  detectedColors: string[];                   // hex codes
  spatialFeatures: {
    roomType?: string;                        // "living", "bedroom", "lobby"
    ceilingHeight?: "standard" | "double" | "high";
    naturalLight?: "low" | "moderate" | "abundant";
  };
  overallMood: string;                        // "warm minimalist", "opulent classical"
  rawDescription: string;                     // Gemini's natural language description
}
```

**How it works:**
- Uses existing `invokeLLM()` from `server/_core/llm.ts`
- Already supports `ImageContent` type (image_url → base64 inlineData)
- Gemini system prompt must be very specific: "You are analyzing an interior design reference image for a UAE property development platform. Extract..."
- Must use `outputSchema` (structured JSON output) to get reliable field mapping
- One call per image, results stored in `project_assets.aiAnalysis`

**Wiring:**
- Import `invokeLLM` from `../../_core/llm`
- Import types from `../../../shared/miyar-types` for DesignStyle, MarketTier
- Export `analyzeImage(imageUrl: string): Promise<VisionAnalysis>`

---

### 2. `server/engines/intake/document-analyzer.ts`

**Purpose:** Analyzes uploaded PDFs and documents (floor plans, supplier catalogs, spec sheets).

**Input:** PDF URL (S3) or file buffer
**Output:** Structured JSON:

```typescript
interface DocumentAnalysis {
  documentType: 'floor_plan' | 'supplier_catalog' | 'spec_sheet' | 'proposal' | 'other';
  floorPlanData?: {
    totalAreaSqm: number | null;
    roomCount: number | null;
    rooms: Array<{ name: string; areaSqm: number | null }>;
  };
  supplierData?: {
    supplierName: string;
    materials: Array<{
      name: string;
      category: string;
      pricePerUnit: number | null;
      currency: string;
      origin: string;                        // "Local", "European", "Asian"
    }>;
    brandTier: "affordable" | "mid" | "premium" | "ultra";
  };
  extractedText: string;                      // raw text for reference
}
```

**How it works:**
- For floor plans: leverage existing `server/engines/design/floor-plan-analyzer.ts` (Phase 9) — it already does Gemini Vision analysis of floor plans
- For PDFs with text: use existing `server/engines/pdf-extraction.ts` to extract text, then pass to Gemini for structured analysis
- For supplier catalogs: Gemini extracts material names, prices, origins

**Wiring:**
- Import `analyzeFloorPlanImage` from `../design/floor-plan-analyzer` (already exists)
- Import `extractTextFromPdf` from `../pdf-extraction` (already exists)
- Import `invokeLLM` from `../../_core/llm`
- Export `analyzeDocument(fileUrl: string, mimeType: string): Promise<DocumentAnalysis>`

---

### 3. `server/engines/intake/url-analyzer.ts`

**Purpose:** Scrapes and analyzes URLs (supplier websites, competitor project pages, mood board links).

**Input:** URL string
**Output:** Structured JSON:

```typescript
interface UrlAnalysis {
  urlType: 'supplier' | 'competitor_project' | 'mood_board' | 'property_listing' | 'other';
  supplierInfo?: {
    name: string;
    materials: Array<{ name: string; category: string; priceRange?: string }>;
    origin: string;                           // "UAE Local", "European", "Asian"
    tier: "affordable" | "mid" | "premium" | "ultra";
  };
  competitorInfo?: {
    developerName: string;
    projectName: string;
    area?: string;                            // "Dubai Marina", "Downtown", etc.
    tier?: MarketTier;
    style?: DesignStyle;
  };
  extractedContent: string;                   // raw extracted text
  images: string[];                           // image URLs found on the page
}
```

**How it works:**
- Use existing `server/engines/ingestion/crawler.ts` (V2 ingestion) — it already does HTTP scraping with retry, robots.txt, CAPTCHA detection
- Pass extracted HTML/text to Gemini for structured analysis
- For supplier URLs: extract product names, prices, material categories
- For competitor URLs: extract project details, style, tier

**Wiring:**
- Import crawler utilities from `../ingestion/crawler`
- Import `invokeLLM` from `../../_core/llm`
- Export `analyzeUrl(url: string): Promise<UrlAnalysis>`

**IMPORTANT: Respect the existing ingestion boundaries.** The crawler already handles rate limiting, robots.txt, CAPTCHA detection. Do NOT build a separate scraping system.

---

### 4. `server/engines/intake/voice-processor.ts`

**Purpose:** Processes voice input into text, then analyzes the text for project intent.

**Input:** Audio file URL (S3) or base64
**Output:**

```typescript
interface VoiceProcessResult {
  transcript: string;                         // raw transcription
  language: string;                           // "en", "ar" — developers may speak Arabic
  projectIntent: {
    mentionedStyle?: string;
    mentionedBudget?: { amount: number; currency: string };
    mentionedArea?: { sqm: number };
    mentionedLocation?: string;
    mentionedMaterials?: string[];
    mentionedSuppliers?: string[];
    mentionedTimeline?: string;
    mentionedTargetMarket?: string;
    rawSummary: string;                       // natural language summary of what developer wants
  };
}
```

**How it works:**
- The DFE report mentions Whisper proxy already exists for voice processing
- If Whisper isn't available: Gemini 2.5 Flash supports audio input natively via `FileContent` type (already in llm.ts: `"audio/mpeg" | "audio/wav" | "audio/mp4"`)
- Transcribe → then pass transcript to Gemini for intent extraction
- Arabic support is critical for UAE market

**Wiring:**
- Import `invokeLLM` from `../../_core/llm` (supports FileContent with audio MIME types)
- Export `processVoice(audioUrl: string, mimeType: string): Promise<VoiceProcessResult>`

---

### 5. `server/engines/intake/intent-mapper.ts` ⭐ THE CORE ENGINE

**Purpose:** Takes ALL analyzed assets + conversation history → produces a complete ProjectInputs suggestion with confidence scores per field.

**This is the brain of the entire intake system.**

**Input:**

```typescript
interface IntakeContext {
  assets: Array<{
    assetType: string;
    analysis: VisionAnalysis | DocumentAnalysis | UrlAnalysis | VoiceProcessResult;
  }>;
  conversations: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  existingValues?: Partial<ProjectInputs>;    // any fields developer already filled manually
}
```

**Output:**

```typescript
interface FormSuggestions {
  values: Partial<ProjectInputs>;             // suggested field values
  confidence: Record<string, number>;         // 0-1 per field key
  reasoning: Record<string, string>;          // explanation per field
  sourceAssets: Record<string, number[]>;     // which asset IDs informed each field
  missingCritical: string[];                  // fields that CANNOT be inferred — developer must fill
  summary: string;                            // natural language: "Based on your uploads, I understand you're planning..."
}
```

**How it works:**
- Collects all analyzed data from assets and conversations
- Builds a mega-prompt for Gemini with:
  1. The full ProjectInputs schema with descriptions of each field and valid values
  2. All analyzed asset data
  3. All conversation history
  4. Any existing form values
- Uses `outputSchema` for structured JSON response
- Must handle conflicts (e.g., mood board shows "Ultra-luxury" but developer said "budget is limited") — resolve by flagging low confidence and explaining the conflict in reasoning

**Critical Gemini Prompt Design:**
The system prompt must contain:
- Every ProjectInputs field with its type, valid values, and what it means in UAE real estate context
- Explicit instruction: "Do NOT guess financial fields (fin01BudgetCap) unless the developer explicitly stated a budget. Mark them as missingCritical."
- Explicit instruction: "For slider fields (1-5 scale), provide reasoning for the exact number chosen"
- The mapping between visual cues and form values. Example: "If images show Italian marble, natural stone, brass fixtures → des02MaterialLevel: 4 or 5, materialSourcing: 'European'"

**Wiring:**
- Import all analysis types from other intake engines
- Import `ProjectInputs` and all type unions from `../../../shared/miyar-types`
- Import `invokeLLM` from `../../_core/llm`
- Export `mapIntentToForm(context: IntakeContext): Promise<FormSuggestions>`

---

### 6. `server/engines/intake/ai-assist.ts`

**Purpose:** Provides contextual AI help on a SPECIFIC form field or section. Used when expert developers want help on one field without running the full intake.

**Input:**

```typescript
interface AiAssistRequest {
  fieldName: string;                          // e.g. "fin03ShockTolerance"
  fieldSection: string;                       // "financial", "design", "market", etc.
  currentValues: Partial<ProjectInputs>;      // what's already filled
  projectAssets: ProjectAsset[];              // any uploaded assets
  question?: string;                          // optional developer question: "What should shock tolerance be for JBR area?"
}
```

**Output:**

```typescript
interface AiAssistResponse {
  suggestedValue: any;                        // the recommended value
  reasoning: string;                          // why — referencing DLD data, market conditions, uploaded assets
  alternatives: Array<{ value: any; reason: string }>;  // other reasonable options
  marketContext?: string;                     // relevant DLD/market data for this field
}
```

**How it works:**
- Focused Gemini call with just the relevant field context
- Should pull DLD data when relevant (e.g., for market tier, competitor density, location)
- Uses existing `dld-analytics.ts` functions: `computeAreaPriceStats()`, `computeMarketPosition()`

**Wiring:**
- Import `invokeLLM` from `../../_core/llm`
- Import DLD functions from `../dld-analytics` where relevant
- Import `ProjectInputs` types from shared
- Export `getFieldAssist(request: AiAssistRequest): Promise<AiAssistResponse>`

---

### 7. `server/engines/intake/asset-manager.ts`

**Purpose:** Handles file upload to S3, creates project_asset records, triggers analysis.

**How it works:**
- Uses existing `server/upload.ts` (S3 presigned URL upload — already exists from V2)
- After upload: creates `project_assets` row
- Triggers appropriate analyzer based on MIME type:
  - `image/*` → `vision-analyzer.ts`
  - `application/pdf` → `document-analyzer.ts`
  - `audio/*` → `voice-processor.ts`
  - URL string → `url-analyzer.ts`
- Stores analysis result back in `project_assets.aiAnalysis`

**Wiring:**
- Import upload utilities from `../../upload`
- Import all analyzer functions from the other intake engines
- Import DB operations for `project_assets` table
- Export `uploadAndAnalyze(projectId, orgId, file, assetType, category): Promise<ProjectAsset>`
- Export `analyzeUrlAsset(projectId, orgId, url, category): Promise<ProjectAsset>`

---

## New Router

### `server/routers/intake.ts`

New tRPC router with these procedures:

```typescript
// All procedures use orgProcedure (authenticated + org-scoped)

intake.uploadAsset        // Upload file → S3 → create asset → trigger analysis → return asset with analysis
intake.addUrl             // Submit URL → scrape → analyze → create asset → return
intake.processVoice       // Upload audio → transcribe → analyze intent → create asset → return
intake.chat               // Send text message → store in intake_conversations → if enough context, return updated suggestions
intake.generateSuggestions // THE MAIN CALL: take all project assets + conversations → run intent-mapper → return FormSuggestions
intake.getFieldAssist     // Contextual AI help on a specific form field
intake.getProjectAssets   // List all assets for a project
intake.deleteAsset        // Remove an asset
intake.acceptSuggestions  // Developer approves AI suggestions → update project with accepted values
```

**Wiring:**
- Create `server/routers/intake.ts`
- Import and use `orgProcedure` from the existing tRPC setup (same as all other routers)
- Register in the main router index (wherever other routers like `economics`, `bias`, etc. are registered)

---

## Frontend Changes

### New Component: `IntakeCanvas.tsx`

**Location:** `client/src/components/IntakeCanvas.tsx`

This is the main AI-guided intake interface. It appears BEFORE the form wizard for Path 1 and Path 3.

**Layout:**
- Left panel (60%): Upload zone + chat
  - Drag-and-drop area at top for files (images, PDFs, DWG)
  - URL input bar: "Paste a supplier or reference URL"
  - Chat interface below: text input + voice record button
  - Shows conversation history with MIYAR
- Right panel (40%): Asset gallery + live form preview
  - Thumbnails of all uploaded assets with AI analysis status (analyzing... / done)
  - Live preview of which form fields have been filled so far
  - Confidence indicators: green (high), amber (medium), red (guessing)
  - "Missing" section: fields MIYAR can't infer, developer must provide

**Key interactions:**
- Every upload triggers analysis immediately (optimistic UI — show thumbnail with spinner)
- After each upload/message, auto-regenerate form suggestions if enough context exists
- "I'm done — show me the form" button → opens ProjectForm.tsx pre-filled with suggestions
- Voice record button: hold to record, release to send → audio uploaded → transcribed → added to chat

**Wiring:**
- Uses tRPC hooks: `trpc.intake.uploadAsset.useMutation()`, `trpc.intake.chat.useMutation()`, etc.
- Uses existing S3 upload flow from `client/src/lib/upload.ts` or wherever the current upload logic lives
- Reuse existing UI components: Card, Button, Input from shadcn/ui

---

### New Component: `AiAssistButton.tsx`

**Location:** `client/src/components/AiAssistButton.tsx`

Small button that appears next to each form section (or individual fields) in ProjectForm.tsx.

**Behavior:**
- Click → opens a small popover/drawer
- Shows: "Ask MIYAR about this field"
- Text input for developer question
- When submitted: calls `trpc.intake.getFieldAssist`
- Shows: suggested value + reasoning + market context
- "Apply" button → sets the form field to the suggested value

**Wiring:**
- Import into `ProjectForm.tsx`
- Place next to each section header (Context, Strategy, Market, Financial, Design, Execution)
- Pass current form values and field name as props

---

### Modify: `ProjectForm.tsx` (1630 lines currently)

**Changes needed:**

1. **Add path selector at the very beginning** (before Step 1):
   - "How would you like to create this project?"
   - Option A: "Let MIYAR help me" → opens IntakeCanvas
   - Option B: "I'll fill it myself" → goes to current Step 1
   - Option C: "Quick brief" → shows a text area + voice button, then pre-fills form

2. **Add AiAssistButton to each section header** — small sparkle/AI icon next to "Context", "Strategy", etc.

3. **Pre-fill support** — if coming from IntakeCanvas, form fields arrive pre-filled with confidence indicators:
   - Green border = high confidence (>0.8)
   - Amber border = medium confidence (0.5-0.8), with tooltip showing AI reasoning
   - Red border = low confidence (<0.5), developer should review
   - Empty = AI couldn't infer, developer must fill

4. **Asset gallery in review step** — Step 7 (Review) should show uploaded assets (mood boards, floor plans) so developer can see what informed the AI suggestions.

---

### New Component: `AssetGallery.tsx`

**Location:** `client/src/components/AssetGallery.tsx`

Displays uploaded project assets as a visual grid. Used in:
- IntakeCanvas (right panel)
- ProjectForm Step 7 (Review)
- ProjectDetail page (new "Project Assets" tab — persistent access to uploaded materials)

**For each asset shows:**
- Thumbnail (image) or icon (PDF/audio/URL)
- Asset category badge
- AI analysis status
- Click to expand: full analysis, extracted data, which form fields it influenced

---

### Modify: Project Detail Page

Add a new "Assets" tab alongside existing tabs (Overview, Design Brief, etc.) that shows the AssetGallery for that project. This makes uploaded mood boards, floor plans, and supplier info accessible throughout the project lifecycle — not just during intake.

---

## How Everything Connects (Data Flow)

```
Developer uploads image
    → client calls intake.uploadAsset
    → server uploads to S3 via existing upload.ts
    → server creates project_assets row
    → server calls vision-analyzer.ts (Gemini Vision)
    → analysis result stored in project_assets.aiAnalysis
    → client receives asset with analysis

Developer types "I want a luxury modern apartment in JBR, 200sqm, budget around 800k AED"
    → client calls intake.chat
    → server stores in intake_conversations
    → server calls intent-mapper.ts with all assets + conversations
    → intent-mapper builds mega-prompt with all context
    → Gemini returns structured FormSuggestions
    → server stores suggestions in intake_form_suggestions
    → client updates live form preview with new suggestions

Developer clicks "I'm done — show me the form"
    → ProjectForm opens pre-filled with accepted suggestions
    → confidence indicators show on each field
    → developer reviews, adjusts, submits
    → existing scoring engine runs exactly as before
    → project_assets remain linked to project permanently
```

---

## Existing Files to Reuse (DO NOT Rebuild)

| Existing File | What It Provides | Used By |
|---|---|---|
| `server/_core/llm.ts` | `invokeLLM()` with image, audio, PDF support + Gemini translation layer | All intake analyzers |
| `server/upload.ts` | S3 presigned URL upload (AWS SDK) | asset-manager.ts |
| `server/engines/design/floor-plan-analyzer.ts` | Floor plan Gemini Vision analysis | document-analyzer.ts |
| `server/engines/pdf-extraction.ts` | PDF text extraction | document-analyzer.ts |
| `server/engines/ingestion/crawler.ts` | HTTP scraping with retry, robots.txt, CAPTCHA detection | url-analyzer.ts |
| `server/engines/dld-analytics.ts` | `computeAreaPriceStats()`, `computeMarketPosition()`, `computeYield()` | ai-assist.ts, intent-mapper.ts |
| `shared/miyar-types.ts` | All ProjectInputs types and valid values | intent-mapper.ts |

---

## Critical Design Rules

### 1. LLM Boundary (MIYAR's Core Rule)
Gemini is used ONLY for:
- Understanding images, voice, documents, URLs (analysis/extraction)
- Mapping developer intent to form fields (translation)
- Generating reasoning text (explanation)

Gemini NEVER:
- Produces scores, weights, or numerical calculations
- Overrides the deterministic scoring engine
- Makes financial predictions

The intake system's job is to FILL THE FORM. The scoring engine's job is to SCORE THE FORM. These remain completely separate.

### 2. Confidence Transparency
Every AI-suggested value MUST have:
- A confidence score (0-1)
- A reasoning string ("Based on your mood board showing Calacatta marble and brass fixtures, this suggests Ultra-luxury tier")
- Source asset references (which uploads informed this)

NEVER auto-fill a field silently. Developer must always be able to see WHY.

### 3. Critical Fields Never Auto-Filled Without Explicit Input
These fields should ONLY be filled if the developer explicitly stated the value (in chat, voice, or document):
- `fin01BudgetCap` — never guess a budget
- `ctx03Gfa` — unless extracted from a floor plan
- `city` — unless explicitly mentioned

If Gemini can't determine these with >0.9 confidence, they go in `missingCritical` and the developer sees a clear prompt to fill them.

### 4. Arabic Language Support
UAE developers may speak Arabic, especially in voice notes. The voice processor and chat system must handle Arabic input and still map correctly to the English-language form fields.

### 5. Asset Permanence
Uploaded assets are NOT temporary. They persist on the project and become part of the evidence base. The design brief generator, investor summary, and reports should eventually be able to reference these assets (e.g., "Developer-provided mood board" as an appendix in the design brief). This is future wiring but the data model must support it from day one.

---

## Test Requirements

### Unit Tests (`server/engines/intake/intake.test.ts`)

1. **Vision Analyzer**: Mock Gemini response → verify VisionAnalysis output structure
2. **Document Analyzer**: Mock PDF extraction + Gemini → verify DocumentAnalysis for floor plan and supplier catalog
3. **URL Analyzer**: Mock crawler + Gemini → verify UrlAnalysis for supplier and competitor URLs
4. **Intent Mapper** (most critical):
   - Given mood board analysis (Modern, Luxury) + chat ("200sqm in JBR") → verify correct ProjectInputs mapping
   - Given conflicting signals (Ultra-luxury images + "budget is limited" chat) → verify low confidence + conflict flagged
   - Given minimal input (just one image) → verify only high-confidence fields filled, rest in missingCritical
   - Given expert input (all fields stated in chat) → verify >0.9 confidence on all fields
5. **AI Assist**: Given field "mkt01Tier" + current values with location=JBR → verify response includes DLD market data
6. **Asset Manager**: Mock S3 upload → verify project_assets row created → verify correct analyzer triggered by MIME type

### Integration Tests

7. **Full intake flow**: Upload image + send chat + generate suggestions → verify FormSuggestions contain values from both sources
8. **tRPC router**: Verify all 8 procedures respond correctly with auth/org scoping

---

## Build Sequence for Antigravity

### Step 1: Schema + DB (do first, everything depends on this)
- Add `project_assets`, `intake_conversations`, `intake_form_suggestions` tables to Drizzle schema
- Run `drizzle-kit push`
- Add DB helper functions: `createProjectAsset()`, `getProjectAssets()`, `createIntakeMessage()`, `getIntakeConversations()`, `upsertFormSuggestion()`, `getFormSuggestions()`

### Step 2: Analyzers (can be built in parallel)
- `vision-analyzer.ts` — depends only on llm.ts
- `document-analyzer.ts` — depends on llm.ts + floor-plan-analyzer + pdf-extraction
- `url-analyzer.ts` — depends on llm.ts + crawler
- `voice-processor.ts` — depends on llm.ts
- `ai-assist.ts` — depends on llm.ts + dld-analytics

### Step 3: Core Engine
- `intent-mapper.ts` — depends on all analyzers (needs their output types)
- `asset-manager.ts` — depends on analyzers + upload.ts + DB functions

### Step 4: Router
- `intake.ts` router — depends on all engines
- Register in main router index

### Step 5: Frontend
- `AssetGallery.tsx` — standalone component
- `AiAssistButton.tsx` — standalone component
- `IntakeCanvas.tsx` — depends on AssetGallery + tRPC hooks
- Modify `ProjectForm.tsx` — add path selector + AiAssist buttons + pre-fill support + confidence indicators

### Step 6: Tests + Integration
- Write all unit tests
- Run full test suite — existing tests must still pass
- Test with real images and voice

---

## Post-Build Verification Checklist

- [ ] All 3 paths work: AI-guided creates a project, Expert creates a project, Hybrid creates a project
- [ ] Uploaded assets persist after project creation (check project_assets table)
- [ ] AI suggestions show confidence + reasoning on every field
- [ ] Critical fields (budget, GFA, city) never auto-filled without explicit input
- [ ] Existing scoring engine produces identical scores whether form was AI-filled or manually filled
- [ ] Arabic voice input transcribes correctly and maps to English form fields
- [ ] Supplier URLs scrape successfully and extract material/pricing data
- [ ] Floor plan upload triggers Phase 9 floor-plan-analyzer and fills space fields
- [ ] AiAssist on market fields pulls DLD data in reasoning
- [ ] All existing tests still pass (zero regressions)
- [ ] New test suite: minimum 20 tests covering all analyzers + intent mapper + router

---

## Gemini Prompt Engineering — The Critical Details

This section defines the exact prompt design for each Gemini call. Getting these right is the difference between the intake being magical and being useless. Antigravity must follow these precisely.

---

### System Prompt: `vision-analyzer.ts`

```
You are an expert UAE interior design and real estate analyst embedded inside MIYAR, a design decision intelligence platform for Dubai and Abu Dhabi property developers.

You are analyzing a reference image submitted by a property developer. Your job is to extract structured design intelligence from this image.

UAE MARKET CONTEXT:
- Market tiers: Mid (150-350 AED/sqm fitout), Upper-mid (250-500 AED/sqm), Luxury (400-850 AED/sqm), Ultra-luxury (650-1400 AED/sqm)
- Material signals for tier: Calacatta/Statuario marble + brass = Ultra-luxury. Porcelain tiles + chrome = Mid. Natural stone + matte black = Luxury. Laminate + standard finishes = Mid.
- Design styles: Modern (clean lines, minimal ornament), Contemporary (current trends, mixed materials), Minimal (near-empty, monochrome), Classic (ornate, symmetrical, heritage references), Fusion (East-meets-West, Arabic geometric with modern base)
- UAE-specific markers: Mashrabiya screens, Arabic geometric patterns, gold/brass accents = Classic or Fusion. High ceilings, double height spaces = Luxury/Ultra-luxury intent.

Extract the following and return as valid JSON matching this exact schema:
[INSERT VisionAnalysis interface here]

RULES:
- If you cannot determine a value with reasonable confidence, return null — never fabricate
- For detectedTier: only set if the image clearly signals a market segment
- For detectedMaterials: only list materials you can visually identify with confidence, not assumptions
- rawDescription must be 2-3 sentences describing the image as if explaining to a developer what you see
```

---

### System Prompt: `url-analyzer.ts`

```
You are analyzing a web page submitted by a UAE property developer. This page is either a supplier website, a competitor project listing, or a design reference.

Your job is to extract structured commercial intelligence. The developer will use this to inform their project decisions.

SUPPLIER DETECTION: If the page sells construction materials, fitout products, furniture, or finishes — it is a supplier. Extract product names, price ranges, material categories, and country of origin.

COMPETITOR DETECTION: If the page is about a property development project in UAE — extract developer name, project name, area/location, apparent market tier, and design style.

UAE SUPPLIER TIER REFERENCE:
- Ultra: Porcelanosa, Fendi Casa, Minotti, Gessi, Duravit Starck, Miele integrated, Gaggenau
- Luxury: RAK Ceramics premium line, Grohe Allure, Hansgrohe Axor, Nobia kitchens, Bosch Series 8
- Mid: RAK Ceramics standard, Ideal Standard, IKEA professional, local joinery suppliers
- Affordable: Local UAE suppliers, generic brands, direct-import Asian products

Extract and return as valid JSON matching the UrlAnalysis schema.

RULES:
- Return urlType: 'other' if the page does not clearly match supplier or competitor
- Never fabricate prices — only extract what is explicitly stated on the page
- For origin: classify as 'UAE Local', 'European', 'Asian', 'American', or 'Global Mix'
```

---

### System Prompt: `intent-mapper.ts` — THE MOST CRITICAL PROMPT

This prompt is what turns raw multimodal data into a filled form. It must be engineered extremely carefully.

```
You are the intelligence core of MIYAR, a design decision platform for UAE property developers. You have been given a collection of evidence about a developer's project — uploaded images, analyzed documents, scraped URLs, and conversation messages.

Your job is to map this evidence to a structured project form. This form feeds a deterministic scoring engine — accuracy matters enormously. Wrong values produce misleading scores.

---

THE FORM FIELDS YOU MUST FILL:

CONTEXT FIELDS (these affect everything):
- ctx01Typology: "Residential" | "Mixed-use" | "Hospitality" | "Office" — what type of building
- ctx02Scale: "Small" | "Medium" | "Large" — Small <1000sqm, Medium 1000-5000sqm, Large >5000sqm
- ctx03Gfa: number (sqm) — gross floor area. ONLY fill if explicitly stated or extracted from floor plan document
- ctx04Location: "Prime" | "Secondary" | "Emerging" — Prime = Downtown/Marina/DIFC/Palm. Secondary = JVC/Al Barsha/Mirdif. Emerging = new areas/suburbs
- ctx05Horizon: "0-12m" | "12-24m" | "24-36m" | "36m+" — delivery timeline
- city: "Dubai" | "Abu Dhabi" — ONLY fill if explicitly stated
- sustainCertTarget: sustainability certification target (e.g. "LEED Gold", "Estidama 2 Pearl")

STRATEGY FIELDS (1-5 scale, 3=medium):
- str01BrandClarity: How clear and defined is the developer's brand identity? 1=no brand, 5=iconic brand
- str02Differentiation: How unique is this project vs competitors? Look for USP signals
- str03BuyerMaturity: How sophisticated are the target buyers? HNWI/institutional = 5, first-time buyers = 1-2

MARKET FIELDS:
- mkt01Tier: "Mid" | "Upper-mid" | "Luxury" | "Ultra-luxury" — the target market tier. Most reliable signal is material/finish level shown in images
- mkt02Competitor: 1-5 — competitive intensity in the area. Saturated area = 5, greenfield = 1
- mkt03Trend: 1-5 — how well aligned is the project with current UAE market trends

FINANCIAL FIELDS:
- fin01BudgetCap: number (AED total budget) — CRITICAL: ONLY fill if developer explicitly states a budget figure. Do NOT infer from images or tier
- fin02Flexibility: 1-5 — budget flexibility. "Fixed budget" = 1-2, "Can stretch" = 3-4, "Open" = 5
- fin03ShockTolerance: 1-5 — ability to absorb cost shocks. Institutional developer = 4-5, first project = 1-2
- fin04SalesPremium: 1-5 — expected premium vs area median. Ultra-luxury branded = 5, standard mid = 2

DESIGN FIELDS:
- des01Style: "Modern" | "Contemporary" | "Minimal" | "Classic" | "Fusion" | "Other" — PRIMARY signal from mood board images
- des02MaterialLevel: 1-5 — 1=basic finishes, 3=quality mid-range, 5=ultra-luxury materials. Calibrate against UAE tier reference
- des03Complexity: 1-5 — design and execution complexity. Double-height spaces, curved walls, custom joinery = 4-5
- des04Experience: 1-5 — how experiential/immersive is the design intent? Basic functional = 1, full sensory design = 5
- des05Sustainability: 1-5 — sustainability ambition level

EXECUTION FIELDS:
- exe01SupplyChain: 1-5 — supply chain readiness. Established supplier relationships (from URLs provided) = 4-5
- exe02Contractor: 1-5 — contractor quality and readiness
- exe03Approvals: 1-5 — regulatory approval complexity
- exe04QaMaturity: 1-5 — quality assurance process maturity

V5 ANALYTICS FIELDS (optional but fill if inferable):
- developerType: "Master Developer" | "Private/Boutique" | "Institutional Investor"
- targetDemographic: "HNWI" | "Families" | "Young Professionals" | "Investors"
- salesStrategy: "Sell Off-Plan" | "Sell on Completion" | "Build-to-Rent"
- handoverCondition: "Shell & Core" | "Category A" | "Category B" | "Fully Furnished"
- materialSourcing: "Local" | "European" | "Asian" | "Global Mix" — infer from supplier URLs provided
- procurementStrategy: "Turnkey" | "Traditional" | "Construction Management"
- targetValueAdd: "Max Capital Appreciation" | "Max Rental Yield" | "Balanced Return" | "Brand Flagship / Trophy"

---

EVIDENCE PROVIDED:
[INSERT: list of all analyzed assets with their extracted data]
[INSERT: full conversation history]
[INSERT: any existing form values already set by developer]

---

MAPPING RULES — FOLLOW EXACTLY:

1. FINANCIAL FIELDS: Never fill fin01BudgetCap unless the developer stated a specific number. "I have a big budget" is NOT a number. "Budget is 3 million AED" → fin01BudgetCap: 3000000.

2. CONFLICT RESOLUTION: If images suggest Ultra-luxury but developer said "tight budget" → fill mkt01Tier: "Luxury" with confidence 0.5, reasoning explaining the conflict. Do NOT silently pick one side.

3. CONFIDENCE CALIBRATION:
   - 0.9-1.0: Developer explicitly stated this value
   - 0.7-0.9: Strong visual/contextual evidence from multiple sources
   - 0.5-0.7: Reasonable inference from one source
   - 0.3-0.5: Weak signal, developer should confirm
   - Below 0.3: Do not include in suggestions — put in missingCritical instead

4. ARABIC INPUT: Developer may have communicated in Arabic. Map Arabic terms correctly: فيلا = Villa (Residential), تشطيب فاخر = Luxury finish, داون تاون = Downtown Dubai (Prime), مرسى دبي = Dubai Marina (Prime), بر دبي/ديرة = Deira/Bur Dubai (Secondary).

5. SUPPLIER URL SIGNALS: If developer provided supplier URLs, use them for exe01SupplyChain (established relationships = higher score) and materialSourcing (European suppliers = "European", RAK Ceramics/local = "Local").

6. FLOOR PLAN SIGNALS: If a floor plan was analyzed, use extracted GFA for ctx03Gfa and room count/type for ctx01Typology confirmation.

7. NEVER fill fields you have no evidence for. A short 30-second voice note cannot fill all 50 fields. Only fill what the evidence supports.

Return as valid JSON matching the FormSuggestions schema exactly.
```

---

### System Prompt: `ai-assist.ts`

```
You are MIYAR's field assistant. A UAE property developer is filling out a project evaluation form and needs help with a specific field.

FIELD REQUESTED: [fieldName]
FIELD DESCRIPTION: [description of what this field means]
VALID VALUES: [list of valid values or range]
CURRENT PROJECT CONTEXT: [key already-filled fields]
DLD MARKET DATA: [relevant DLD stats for this field if available]
DEVELOPER QUESTION: [optional free-text question]

Your job is to recommend the best value for this field given the project context, with clear reasoning grounded in UAE market data.

RULES:
- Reference specific UAE locations, developer names, or market data when relevant
- If the developer asked a specific question, answer it directly first
- Always give 2-3 alternatives, not just one answer
- Keep reasoning under 3 sentences — developers are busy
- If DLD data is provided, cite specific numbers ("JBR area median is 2,100 AED/sqm — that puts this project in Luxury tier")
```

---

### OutputSchema for `intent-mapper.ts`

This is what Gemini must return — passed as `outputSchema` to `invokeLLM()`:

```typescript
const FORM_SUGGESTIONS_SCHEMA = {
  name: "form_suggestions",
  schema: {
    type: "object",
    properties: {
      values: {
        type: "object",
        description: "Suggested ProjectInputs values — only include fields with confidence >= 0.3"
      },
      confidence: {
        type: "object",
        description: "Confidence score 0-1 for each suggested field key"
      },
      reasoning: {
        type: "object",
        description: "1-2 sentence reasoning for each suggested field key"
      },
      sourceAssets: {
        type: "object",
        description: "Array of asset indices that informed each field"
      },
      missingCritical: {
        type: "array",
        items: { type: "string" },
        description: "Field keys that are required but cannot be inferred — developer must fill"
      },
      summary: {
        type: "string",
        description: "2-3 sentence natural language summary of what MIYAR understands about this project"
      }
    },
    required: ["values", "confidence", "reasoning", "missingCritical", "summary"]
  }
};
```

---

## Conversational Chat Flow

The chat interface in IntakeCanvas is not a generic chatbot. It has a specific job: extract project data through natural conversation. Here is how the conversation should flow:

### Turn 1 (MIYAR opens):
"Tell me about your project — what are you building, where, and who is it for? You can also upload images, floor plans, or supplier catalogs at any time."

### After first upload (image):
MIYAR responds with what it sees: "I can see you're referencing a [Modern/Luxury/etc] aesthetic — [brief description]. Does this reflect the style direction for your project?"

### After first message from developer:
MIYAR identifies what it learned and what's still missing: "Based on what you've shared, I understand this is a [typology] project in [location] targeting [market tier]. I still need to understand your budget and delivery timeline. Can you share those?"

### After sufficient context (>4 filled fields):
MIYAR proactively offers: "I have enough to pre-fill your project form. Want me to show you what I've got so far?"

### Missing critical fields:
MIYAR asks directly: "Before I hand you the form, I need two things I can't infer: your total fitout budget (in AED), and your target delivery date. What are those?"

---

## Frontend UX Details — IntakeCanvas.tsx

### Path Selector Screen (shows before form step 1)

Three cards side by side:

Card 1 — "Let MIYAR help me"
- Icon: sparkle/AI
- Text: "Upload mood boards, floor plans, or supplier catalogs. Talk or type your vision. MIYAR fills your form."
- CTA: "Start with AI →"

Card 2 — "I know what I want"
- Icon: form/list
- Text: "Go straight to the form. Fill it yourself. AI assist available on every section."
- CTA: "Open Form →"

Card 3 — "Quick brief"
- Icon: microphone + pencil
- Text: "Describe your project in a voice note or a paragraph. MIYAR fills what it can."
- CTA: "Start Brief →"

### IntakeCanvas Layout

Header: Project name input (simple text field, can be changed later)

Left panel (60% width):
```
┌─────────────────────────────────────────────┐
│  Drop files here or click to upload          │
│  Images • PDFs • DWG • Audio                 │
│  or paste a URL: [___________________] [Add] │
└─────────────────────────────────────────────┘
│ MIYAR: Tell me about your project...         │
│ [developer message]                          │
│ MIYAR: [response]                            │
│ ...                                          │
│ ┌──────────────────────────────────────────┐ │
│ │ 🎤 Hold to speak   |  Type here...  Send │ │
│ └──────────────────────────────────────────┘ │
```

Right panel (40% width):
```
┌────────────────────────────────────────────┐
│ ASSETS (3)                                  │
│ [img] [img] [pdf]                           │
│  ✓     ✓    analyzing...                   │
├────────────────────────────────────────────┤
│ FORM PREVIEW                               │
│ ● Context      4/5 filled  ████████░       │
│ ● Strategy     2/3 filled  ██████░░░       │
│ ● Market       3/3 filled  █████████       │
│ ● Financial    ⚠ Budget missing            │
│ ● Design       5/5 filled  █████████       │
│ ● Execution    2/5 filled  ████░░░░░       │
├────────────────────────────────────────────┤
│ MISSING (needs your input):                │
│ • Total budget (AED)                       │
│ • Delivery timeline                        │
├────────────────────────────────────────────┤
│ [  Show me the pre-filled form  →  ]       │
└────────────────────────────────────────────┘
```

### Confidence Indicators in ProjectForm.tsx

When the form opens pre-filled from IntakeCanvas, each field shows its confidence state:

- Green dot + solid border = confidence ≥ 0.8: "AI is confident — review if you want"
- Amber dot + dashed border = confidence 0.5–0.79: hovering shows AI reasoning in tooltip
- Red dot + empty field = confidence < 0.5 or missingCritical: "AI couldn't determine this — please fill"

The reasoning tooltip on hover (for amber fields) shows exactly one sentence: e.g., "Based on your mood board showing Calacatta marble and double-height ceilings, MIYAR suggests Ultra-luxury. Confirm or adjust."

---

## Drizzle Schema Code

Exact schema additions to add to `server/db/schema.ts`:

```typescript
// ─── Phase 10A: Project Assets ───────────────────────────────────────────────
export const projectAssets = pgTable("project_assets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  assetType: text("asset_type").notNull(), // 'image' | 'pdf' | 'dwg' | 'url' | 'voice' | 'text'
  category: text("category").notNull(),    // 'mood_board' | 'floor_plan' | 'supplier_catalog' | etc
  fileName: text("file_name"),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
  aiAnalysis: jsonb("ai_analysis"),
  extractedData: jsonb("extracted_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Phase 10A: Intake Conversations ─────────────────────────────────────────
export const intakeConversations = pgTable("intake_conversations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  role: text("role").notNull(),            // 'user' | 'assistant'
  contentType: text("content_type").notNull(), // 'text' | 'voice_transcript'
  content: text("content").notNull(),
  attachedAssetIds: jsonb("attached_asset_ids"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Phase 10A: Intake Form Suggestions ──────────────────────────────────────
export const intakeFormSuggestions = pgTable("intake_form_suggestions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  suggestedValue: text("suggested_value").notNull(),
  confidence: real("confidence").notNull(),
  reasoning: text("reasoning").notNull(),
  sourceAssetIds: jsonb("source_asset_ids"),
  accepted: boolean("accepted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Note: Use `pgTable` and match the import pattern already in the schema file. Check whether the project uses `pgTable` or `mysqlTable` — it's TiDB (mysql2) so use whatever the existing tables use.

---

## Things Antigravity Must NOT Do

1. Do NOT create a new scoring engine or modify `scoring.ts`, `five-lens.ts`, or any existing engine file. The intake system feeds data INTO the existing engines, it does not replace them.

2. Do NOT add new fields to `ProjectInputs` in `shared/miyar-types.ts` for this phase. The intake works with what's already there.

3. Do NOT make the intake mandatory. Path 2 (Expert) must still allow going straight to the form with zero AI interaction.

4. Do NOT use streaming for the main `generateSuggestions` call. Use a standard awaited call — streaming adds complexity with no benefit here since we need the full structured output before rendering.

5. Do NOT call the DLD database from inside the vision/document analyzers. DLD calls happen only in `ai-assist.ts` and `intent-mapper.ts` where market context is needed.

6. Do NOT store raw audio files in the database. Audio is uploaded to S3, transcribed, and only the transcript is stored in `intake_conversations`.

7. Do NOT build voice recording as a native browser MediaRecorder implementation from scratch. Use a simple file upload (accept="audio/*") as fallback if a voice recording library isn't already available in the project.

---

## Phase 10A Success Criteria

This phase is done when:

1. A developer can open a new project, upload 3 mood board images and a floor plan PDF, type "I want a luxury residential project in JBR, targeting HNWIs, aiming for off-plan sales", and receive a pre-filled form with >70% of fields filled at ≥0.7 confidence.

2. An expert developer can still skip all AI and go straight to the 7-step form exactly as it works today.

3. On any form field, an expert can click "AI Assist", type a question, and receive a relevant answer referencing DLD data within 3 seconds.

4. All uploaded assets (images, PDFs, URLs) are permanently stored on the project and visible in a project assets gallery.

5. The scoring engine produces the same result for an AI-filled form and a manually-filled form with identical values.

6. Zero regressions in the existing test suite.
