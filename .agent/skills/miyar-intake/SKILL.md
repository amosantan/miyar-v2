# MIYAR Skill: Intelligent Project Intake

## What This Skill Covers
Domain knowledge for building and extending the Phase 10A Intelligent Project Intake system. Use this when working on any intake-related engine, router, or frontend component.

---

## The Mental Model

The intake system is a TRANSLATION LAYER, not a scoring system.

```
Developer (natural expression)
    → Assets: images, PDFs, voice, URLs, chat
    ↓
Intake Engines (translation)
    → Gemini analyzes each asset type
    → intent-mapper combines all signals
    ↓
FormSuggestions (structured output)
    → confidence + reasoning per field
    ↓
ProjectForm.tsx (existing, unchanged)
    → developer reviews + approves
    ↓
Scoring Engine (existing, unchanged)
    → same deterministic score
```

Gemini's role: understand and translate. The scoring engine's role: score. Never mix these.

---

## ProjectInputs Field Mapping Guide

When Gemini signals map to form fields, use these rules:

### Visual Signals → des01Style
- Clean lines, white/grey palette, minimal ornament → "Modern"
- Mixed materials, current trends → "Contemporary"
- Near-empty, monochrome, void spaces → "Minimal"
- Ornate, symmetrical, heritage elements → "Classic"
- Arabic geometric + modern base, mashrabiya, East-West blend → "Fusion"

### Visual Signals → mkt01Tier
- Calacatta/Statuario marble, Paonazzo, Onyx, custom brass, Gessi/Axor fixtures → "Ultra-luxury"
- Natural stone, Porcelain large format, Grohe/Hansgrohe, premium joinery → "Luxury"
- Porcelain mid-range, standard stone, Ideal Standard, quality laminate → "Upper-mid"
- Ceramic tiles, standard fittings, painted walls, basic laminate → "Mid"

### Visual Signals → des02MaterialLevel (1-5)
- 5: Ultra-luxury materials (marble, brass, custom millwork, imported fixtures)
- 4: Luxury materials (natural stone, premium brands, quality custom joinery)
- 3: Quality mid-range (good porcelain, standard branded fittings, decent finishes)
- 2: Basic quality (ceramic tiles, standard local materials, minimal customization)
- 1: Bare minimum / shell & core

### Spatial Signals → des03Complexity (1-5)
- 5: Double height, curved walls, custom everything, integrated technology
- 4: High ceilings, feature walls, custom joinery, some curves
- 3: Standard layout, quality finishes, some bespoke elements
- 2: Simple layout, mostly off-the-shelf
- 1: Basic rectangular spaces, no custom elements

### Supplier URL Signals → exe01SupplyChain + materialSourcing
- European suppliers provided (Porcelanosa, Fendi, Minotti, Hansgrohe) → exe01SupplyChain: 4-5, materialSourcing: "European"
- RAK Ceramics, local UAE suppliers → exe01SupplyChain: 3-4, materialSourcing: "Local"
- Mix of sources → materialSourcing: "Global Mix"
- Asian suppliers (Chinese, Indian manufacturers) → materialSourcing: "Asian"

### Location Mentions → ctx04Location
- Downtown Dubai, Dubai Marina, DIFC, Palm Jumeirah, City Walk, JBR, Jumeirah Bay → "Prime"
- JVC, Al Barsha, Mirdif, Dubai Hills (non-core), Deira, Bur Dubai → "Secondary"
- Dubai South, Dubailand, Arjan, International City, new master-planned areas → "Emerging"
- Abu Dhabi: Saadiyat, Al Reem, Al Maryah, Corniche → "Prime"
- Abu Dhabi: Al Khalidiyah, Khalifa City, Al Reef → "Secondary"

### Arabic Terms → English Fields
- فيلا / Villa → Residential typology
- شقق / Apartments → Residential typology
- تشطيب فاخر / Luxury finish → des02MaterialLevel: 4-5
- ميزانية محدودة / Limited budget → fin02Flexibility: 1-2
- داون تاون / Downtown → ctx04Location: "Prime"
- مرسى دبي / Dubai Marina → ctx04Location: "Prime"
- بر دبي / ديرة → ctx04Location: "Secondary"
- العملاء المستهدفون من الثروات / HNWI target → targetDemographic: "HNWI"
- بيع على الخارطة / Off-plan → salesStrategy: "Sell Off-Plan"

---

## Confidence Calibration Rules

ALWAYS apply these when building or debugging intent-mapper:

| Evidence Type | Max Confidence |
|---|---|
| Developer explicitly stated exact value | 1.0 |
| Developer stated in general terms (e.g. "luxury project") | 0.85 |
| Multiple images all pointing same direction | 0.80 |
| Single strong image signal | 0.70 |
| Single weak image signal | 0.55 |
| Inference from typology/location without direct signal | 0.45 |
| Guess with no evidence | DO NOT include — put in missingCritical |

Fields that ALWAYS require explicit developer input (never infer):
- `fin01BudgetCap` — must be a stated number
- `ctx03Gfa` — must come from floor plan or explicit statement
- `city` — must be explicitly mentioned

---

## Common Mistakes to Avoid

### 1. Conflating market tier with style
Style (des01Style) and tier (mkt01Tier) are independent. A Modern-style project can be Mid or Ultra-luxury. Don't auto-set tier to "Luxury" just because images look nice.

### 2. Filling slider fields with extreme values
Sliders (1-5) should cluster around 2-4 for most projects. Only assign 1 or 5 when there's overwhelming evidence. Most UAE developers operate in the 3-4 range.

### 3. Using AI analysis to override explicit developer statements
If developer says "budget is 1.5M AED" but images look like they'll need 3M, STILL set fin01BudgetCap: 1500000. The conflict should be flagged in a risk message, not silently "corrected."

### 4. Running intent-mapper too early
Don't call intent-mapper with only 1 asset. Wait until either: 2+ assets uploaded, or developer sends a substantive message (>20 words). Otherwise the output will be mostly missingCritical.

### 5. Storing audio in the database
Never store audio data in `intake_conversations`. Store only the transcript text. Audio file stays on S3.

---

## Gemini Model and API Notes

- Model: `gemini-2.5-flash` (from ENV: `process.env.GEMINI_MODEL`)
- Image input: pass as `ImageContent` with `image_url`. The llm.ts layer automatically fetches and converts to base64 inlineData for Gemini.
- Audio input: pass as `FileContent` with appropriate MIME type. Currently llm.ts passes as text reference — if audio transcription doesn't work via this path, transcribe first using a dedicated call.
- Structured output: always use `outputSchema` parameter when you need reliable JSON from intake engines. Never try to parse free-text JSON from Gemini.
- Rate limits: Free tier = 15 requests/min. The intake system can make multiple Gemini calls per upload. Add basic debouncing on the frontend to avoid hammering the API.

---

## DB Queries Reference

Key queries for intake:

```typescript
// Get all assets for a project (org-scoped)
await db.select()
  .from(projectAssets)
  .where(and(eq(projectAssets.projectId, projectId), eq(projectAssets.orgId, orgId)));

// Get conversation history (ordered)
await db.select()
  .from(intakeConversations)
  .where(and(eq(intakeConversations.projectId, projectId), eq(intakeConversations.orgId, orgId)))
  .orderBy(intakeConversations.createdAt);

// Upsert suggestion (update if field already exists for project)
// Use drizzle's .onConflictDoUpdate() pattern
```

---

## Integration Points with Existing Systems

### Phase 9 Floor Plan Analyzer
When a PDF or image is uploaded and categorized as 'floor_plan':
- `document-analyzer.ts` calls `analyzeFloorPlanImage()` from `floor-plan-analyzer.ts`
- Result populates `ctx03Gfa` (totalAreaSqm) in form suggestions
- Result populates `spaceEfficiencyScore` in form suggestions (Phase 9 field)
- This replaces manual entry — one of the highest-value automations

### DLD Analytics (AI Assist)
When `ai-assist.ts` handles location-related fields:
- Call `computeAreaPriceStats(areaName, city)` to get median sale/rent prices
- Use this data in reasoning: "JBR median is 2,100 AED/sqm — that's Luxury tier"
- Call `computeMarketPosition()` for competitor density context
- Never block on DLD calls if they fail — gracefully degrade to generic reasoning

### Existing Upload System
- `server/upload.ts` handles presigned S3 URLs
- Use the same upload flow as the existing Evidence Vault (Phase 4) and Design Studio (Phase 8)
- After upload completes: trigger analysis async (don't await in the upload response)

---

## Testing Patterns

```typescript
// Mock Gemini for deterministic tests
vi.mock('../../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          detectedStyle: 'Modern',
          detectedTier: 'Luxury',
          detectedMaterials: [{ name: 'marble', category: 'flooring', estimatedTier: 'ultra', confidence: 0.9 }],
          rawDescription: 'A modern luxury interior with marble flooring'
        })
      }
    }]
  })
}));

// Test confidence calibration
expect(result.confidence['mkt01Tier']).toBeGreaterThan(0.7); // strong image signal
expect(result.missingCritical).toContain('fin01BudgetCap'); // no budget stated
expect(result.values.fin01BudgetCap).toBeUndefined(); // must not be set
```
