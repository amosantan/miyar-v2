# MIYAR V2.8 Design Enablement Layer — Implementation Report

**Version**: 2.8.0  
**Date**: 19 February 2026  
**Build Environment**: Manus Sandbox (Ubuntu 22.04, Node 22, React 19, Tailwind 4, tRPC 11)  
**Live URL**: `https://3000-i3xi5l4yy0tagbjgurr4f-3853865a.sg1.manus.computer`

---

## 1. What Was Built

The V2.8 Design Enablement Layer transforms MIYAR from an analytics-only platform into a **design-phase operating tool** for small-to-mid developers who lack in-house interior teams. It adds six integrated capabilities that produce concrete, downloadable artifacts at every step.

### Feature Map by Phase

| Phase | Feature | Status | Artifacts Produced |
|-------|---------|--------|--------------------|
| **1** | Evidence Vault | **Done** | Uploaded files stored in S3 with metadata, linked to evaluations/reports/scenarios |
| **1** | Asset Permissions & Audit | **Done** | Admin-only deletion, full audit log entries for every upload/delete/link action |
| **2** | Design Brief Builder | **Done** | 7-section structured brief generated deterministically from MIYAR variables |
| **2** | Brief Versioning | **Done** | Version history with incrementing version numbers per project |
| **3** | Visual Studio (nano banana) | **Done** | AI-generated mood boards, material boards, marketing hero images via `generateImage` API |
| **3** | Prompt Template System | **Done** | 5 admin-editable templates with `{{variable}}` interpolation, stored in DB |
| **3** | Prompt Governance | **Done** | Full `prompt_json` stored per generation for auditability |
| **4** | Materials Library | **Done** | 18 seeded materials with cost bands, lead times, suppliers, tier/category classification |
| **4** | Board Composer | **Done** | Material boards with itemized RFQ-ready lists, cost estimates, and benchmark version linking |
| **4** | Material Recommendations | **Done** | Tier-based material suggestions from catalog |
| **5** | Executive Decision Pack | **Done** | Updated to include Evidence Vault references + ROI + 5-Lens sections |
| **5** | Design Brief + RFQ Pack | **Done** | Report type `design_brief_rfq` with brief, materials list, procurement notes, visuals |
| **5** | Marketing Pre-Launch Pack | **Done** | Report type `marketing_prelaunch` with positioning, mood images, differentiators, disclaimers |
| **6** | Approval Gates | **Done** | 4-state workflow: Draft → Review → Approved RFQ → Approved Marketing |
| **6** | Commenting System | **Done** | Comments on briefs, boards, visuals, and general project-level |
| **6** | Decision Rationale | **Done** | Required rationale text when changing approval state, logged to audit trail |

### Cumulative Codebase Metrics

| Metric | Value |
|--------|-------|
| Total custom files | 130 |
| Total lines of code | 25,192 |
| Database tables | 24 |
| Test files | 4 |
| Test cases | 81 (all passing) |
| TypeScript errors | 0 |
| V2.8-specific new files | 12 |
| V2.8-specific new LOC | 3,112 |
| tRPC procedures (design router) | 31 |
| Seeded materials | 18 |
| Seeded prompt templates | 5 |

---

## 2. Exact User Workflow Walkthrough

### Workflow A: Evidence Upload → Design Brief → Visual Generation → Board → RFQ Pack

**Step 1 — Navigate to Project**

The user logs in and clicks a project from the Dashboard or Projects list. The sidebar now shows a **"Design Enablement"** section with five contextual links: Evidence Vault, Design Brief, Visual Studio, Board Composer, and Collaboration.

**Step 2 — Upload Evidence (Evidence Vault)**

Click **Evidence Vault** in the sidebar. The page shows category filter tabs (All, Brief, Brand, Budget, Competitor, Inspiration, Material, Sales, Legal, Mood Image, Material Board, Marketing Hero, Generated, Other). Click **Upload Asset**, select a file (PDF, DOCX, XLSX, JPG, PNG), choose a category, add tags and notes, set client visibility, and submit. The file uploads to S3 and appears in the vault with metadata. An audit log entry is created automatically.

**Step 3 — Generate Design Brief**

Click **Design Brief** in the sidebar. Click **Generate Brief**. The system deterministically generates a 7-section brief from the project's MIYAR evaluation scores:

1. **Identity** — Project name, typology, tier, style, location
2. **Style & Mood** — Style family, mood keywords, color palette, texture direction, spatial feel
3. **Materials** — Material level (1–5), recommended categories, quality expectations, sustainability notes
4. **Budget** — Total budget cap, cost per sqm, flexibility rating, contingency allocation, must-not-break constraints
5. **Procurement** — Lead time constraints, complexity flags, regional availability, risk items, recommended strategy
6. **Deliverables** — Checklist of what designers must produce (mood boards, material schedules, 3D renders, etc.)
7. **Summary** — Full brief overview

Each tab displays its section. Click **Regenerate** to create a new version (version number increments).

**Step 4 — Generate Visuals (Visual Studio)**

Click **Visual Studio** in the sidebar. Select a visual type (Mood Board, Material Board, or Marketing Hero) from the dropdown. Optionally select a prompt template or write a custom prompt. Click **Generate**. The system:

1. Resolves the prompt template by interpolating project variables (`{{typology}}`, `{{tier}}`, `{{style}}`, `{{location}}`, etc.)
2. Calls the `generateImage` API with the resolved prompt
3. Stores the generated image as a project asset in S3
4. Creates a `generated_visuals` record with full `prompt_json` for auditability

The generated image appears in the gallery, filterable by type (Mood, Material, Hero).

**Step 5 — Compose Material Board (Board Composer)**

Click **Board Composer** in the sidebar. Click **New Board** to create a board. The system recommends materials from the catalog based on the project's tier. Add materials from the catalog, specify quantities and units. The board detail panel shows:

- Material cards with cost ranges, lead times, and suppliers
- **Board Summary** with total cost estimate (low/high range) and RFQ-ready line items
- Option to generate a board visual via nano banana

**Step 6 — Generate Developer-Ready Packs (Reports)**

Navigate to the project's **Reports** tab. Three V2.8 pack types are available:

1. **Executive Decision Pack** — Updated with Evidence Vault references, ROI narrative, and 5-Lens framework
2. **Design Brief + RFQ Pack** — Includes the full design brief, room list, materials list with costs, procurement notes, and attached visuals
3. **Marketing Pre-Launch Pack** — 1–2 page positioning statement, mood images, key differentiators, and "concept only" disclaimers

Each pack generates as a branded PDF uploaded to CloudFront CDN, watermarked with MIYAR attribution, and versioned with the benchmark version used.

**Step 7 — Approve & Collaborate**

Click **Collaboration** in the sidebar. The left panel shows the **Approval Gate** with a 4-state workflow:

- **Draft** → **Review** → **Approved for RFQ** → **Approved for Marketing**

Select a new state, provide a rationale (required), and save. The state change is logged to the audit trail. The right panel shows a **Comments** section where team members can comment on specific entities (briefs, boards, visuals) or post general project comments.

### Workflow B: Admin — Manage Materials & Prompt Templates

**Step 1 — Materials Library** (`/admin/materials`)

The admin sees all 18 seeded materials in a 3-column grid. Each card shows name, category tag, tier tag, cost range (AED), lead time, supplier, and notes. The admin can:

- **Add Material** — Fill in all fields including cost band, lead time, supplier, and regional availability
- **Search** — Filter by name
- **Filter** — By category (tile, stone, wood, metal, fabric, glass, paint, etc.) and tier (economy through ultra_luxury)

**Step 2 — Prompt Templates** (`/admin/prompt-templates`)

The admin sees 5 seeded templates with full prompt text and `{{variable}}` chips. The admin can:

- **Create** new templates with name, type (mood/material_board/hero), template text, and variable list
- **Edit** existing templates
- **Toggle active/inactive** per template
- **Filter** by type (All, Mood, Material Board, Hero)

---

## 3. Database Schema Diff (V2.8 New Tables)

### New Tables (9 tables added)

**`project_assets`** — Evidence Vault storage

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| projectId | int NOT NULL | FK to projects |
| filename | varchar(512) | Original filename |
| mimeType | varchar(128) | MIME type |
| sizeBytes | int | File size |
| storagePath | text | S3 key |
| storageUrl | text | CDN URL |
| checksum | varchar(128) | File integrity |
| uploadedBy | int | FK to users |
| category | enum(brief, brand, budget, competitor, inspiration, material, sales, legal, mood_image, material_board, marketing_hero, generated, other) | 13 categories |
| tags | json | Flexible tagging |
| notes | text | User notes |
| isClientVisible | boolean DEFAULT true | Permission control |
| uploadedAt | timestamp | |

**`asset_links`** — Evidence traceability

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| assetId | int NOT NULL | FK to project_assets |
| linkType | enum(evaluation, report, scenario, board) | What the asset is linked to |
| linkId | int NOT NULL | ID of the linked entity |
| createdAt | timestamp | |

**`design_briefs`** — Structured design briefs

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| projectId | int NOT NULL | FK to projects |
| scenarioId | int | Optional scenario context |
| version | int DEFAULT 1 | Brief version number |
| projectIdentity | json | Section 1 data |
| positioningStatement | text | Section 2 narrative |
| styleMood | json | Section 3 data |
| materialGuidance | json | Section 4 data |
| budgetGuardrails | json | Section 5 data |
| procurementConstraints | json | Section 6 data |
| deliverablesChecklist | json | Section 7 data |
| createdBy | int | FK to users |
| createdAt, updatedAt | timestamp | |

**`generated_visuals`** — AI-generated images

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| projectId | int NOT NULL | FK to projects |
| scenarioId | int | Optional scenario context |
| type | enum(mood, material_board, hero) | Visual type |
| promptJson | json | Full prompt for auditability |
| modelVersion | varchar(64) DEFAULT 'nano-banana-v1' | Model tracking |
| imageAssetId | int | FK to project_assets |
| status | enum(pending, generating, completed, failed) | Generation state |
| errorMessage | text | Error details if failed |
| createdBy | int | FK to users |
| createdAt | timestamp | |

**`material_boards`** — Composed material boards

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| projectId | int NOT NULL | FK to projects |
| scenarioId | int | Optional scenario context |
| boardName | varchar(255) | Board title |
| boardJson | json | Board configuration |
| boardImageAssetId | int | FK to project_assets |
| benchmarkVersionId | int | FK to benchmark_versions |
| createdBy | int | FK to users |
| createdAt, updatedAt | timestamp | |

**`materials_catalog`** — Material/FF&E library

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| name | varchar(255) | Material name |
| category | enum(tile, stone, wood, metal, fabric, glass, paint, wallpaper, lighting, furniture, fixture, accessory, other) | 13 categories |
| tier | enum(economy, mid, premium, luxury, ultra_luxury) | 5 tiers |
| typicalCostLow | decimal(10,2) | Cost range low |
| typicalCostHigh | decimal(10,2) | Cost range high |
| costUnit | varchar(32) DEFAULT 'AED/sqm' | Unit of measure |
| leadTimeDays | int | Lead time in days |
| leadTimeBand | enum(short, medium, long, critical) | Lead time classification |
| regionAvailability | json | Available regions |
| supplierName | varchar(255) | Supplier name |
| supplierContact | varchar(255) | Contact info |
| supplierUrl | text | Supplier website |
| imageUrl | text | Material image |
| notes | text | Additional notes |
| isActive | boolean DEFAULT true | Active flag |
| createdBy | int | FK to users |
| createdAt, updatedAt | timestamp | |

**`materials_to_boards`** — Join table for board composition

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| boardId | int NOT NULL | FK to material_boards |
| materialId | int NOT NULL | FK to materials_catalog |
| quantity | decimal(10,2) | Amount needed |
| unitOfMeasure | varchar(32) | Unit (sqm, piece, m, etc.) |
| notes | text | Line-item notes |
| createdAt | timestamp | |

**`prompt_templates`** — Admin-editable AI prompt templates

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| name | varchar(255) | Template name |
| type | enum(mood, material_board, hero) | Visual type |
| templateText | text | Prompt with `{{variables}}` |
| variables | json | List of variable names |
| isActive | boolean DEFAULT true | Active toggle |
| createdBy | int | FK to users |
| createdAt, updatedAt | timestamp | |

**`comments`** — Collaboration comments

| Column | Type | Notes |
|--------|------|-------|
| id | int AUTO_INCREMENT PK | |
| projectId | int NOT NULL | FK to projects |
| entityType | enum(design_brief, material_board, visual, general) | What is being commented on |
| entityId | int | Specific entity ID |
| userId | int NOT NULL | FK to users |
| content | text | Comment text |
| createdAt | timestamp | |

### Altered Tables

| Table | Change |
|-------|--------|
| `projects` | Added `approvalState` enum(draft, review, approved_rfq, approved_marketing) DEFAULT 'draft' |
| `report_instances` | Extended `reportType` enum with: design_brief_rfq, marketing_prelaunch |

---

## 4. API Endpoints (tRPC Procedures)

All V2.8 procedures are under the `design` router, accessible at `/api/trpc/design.*`.

### Evidence Vault (6 procedures)

| Procedure | Auth | Method | Input | Output |
|-----------|------|--------|-------|--------|
| `design.listAssets` | Protected | Query | `{ projectId, category? }` | Array of asset records |
| `design.uploadAsset` | Protected | Mutation | `{ projectId, filename, mimeType, base64Data, category, tags?, notes?, isClientVisible? }` | Created asset record |
| `design.deleteAsset` | Protected | Mutation | `{ assetId }` | Success boolean (admin-only enforced) |
| `design.updateAsset` | Protected | Mutation | `{ assetId, category?, tags?, notes?, isClientVisible? }` | Updated asset record |
| `design.linkAsset` | Protected | Mutation | `{ assetId, linkType, linkId }` | Created link record |
| `design.getAssetLinks` | Protected | Query | `{ assetId }` | Array of link records |

### Design Brief (4 procedures)

| Procedure | Auth | Method | Input | Output |
|-----------|------|--------|-------|--------|
| `design.generateBrief` | Protected | Mutation | `{ projectId, scenarioId? }` | Full brief with 7 sections |
| `design.listBriefs` | Protected | Query | `{ projectId }` | Array of brief records |
| `design.getBrief` | Protected | Query | `{ briefId }` | Single brief record |
| `design.getLatestBrief` | Protected | Query | `{ projectId }` | Latest version brief |

### Visual Generation (2 procedures)

| Procedure | Auth | Method | Input | Output |
|-----------|------|--------|-------|--------|
| `design.generateVisual` | Protected | Mutation | `{ projectId, type, scenarioId?, customPrompt?, templateId? }` | Generated visual record with image URL |
| `design.listVisuals` | Protected | Query | `{ projectId, type? }` | Array of visual records |

### Board Composer (8 procedures)

| Procedure | Auth | Method | Input | Output |
|-----------|------|--------|-------|--------|
| `design.createBoard` | Protected | Mutation | `{ projectId, boardName, scenarioId?, materialIds? }` | Created board record |
| `design.listBoards` | Protected | Query | `{ projectId }` | Array of board records |
| `design.getBoard` | Protected | Query | `{ boardId }` | Board with materials |
| `design.addMaterialToBoard` | Protected | Mutation | `{ boardId, materialId, quantity?, unitOfMeasure?, notes? }` | Created join record |
| `design.removeMaterialFromBoard` | Protected | Mutation | `{ boardId, materialId }` | Success boolean |
| `design.deleteBoard` | Protected | Mutation | `{ boardId }` | Success boolean |
| `design.boardSummary` | Protected | Query | `{ boardId }` | Cost summary + RFQ line items |
| `design.recommendMaterials` | Protected | Query | `{ tier, category? }` | Filtered materials from catalog |

### Materials Catalog (5 procedures)

| Procedure | Auth | Method | Input | Output |
|-----------|------|--------|-------|--------|
| `design.listMaterials` | Protected | Query | `{ category?, tier?, search? }` | Array of material records |
| `design.getMaterial` | Protected | Query | `{ materialId }` | Single material record |
| `design.createMaterial` | **Admin** | Mutation | `{ name, category, tier, typicalCostLow?, ... }` | Created material |
| `design.updateMaterial` | **Admin** | Mutation | `{ id, name?, typicalCostLow?, ... }` | Updated material |
| `design.deleteMaterial` | **Admin** | Mutation | `{ id }` | Success boolean |

### Prompt Templates (3 procedures)

| Procedure | Auth | Method | Input | Output |
|-----------|------|--------|-------|--------|
| `design.listPromptTemplates` | Protected | Query | `{ type? }` | Array of template records |
| `design.createPromptTemplate` | **Admin** | Mutation | `{ name, type, templateText, variables }` | Created template |
| `design.updatePromptTemplate` | **Admin** | Mutation | `{ id, name?, templateText?, variables?, isActive? }` | Updated template |

### Collaboration (3 procedures)

| Procedure | Auth | Method | Input | Output |
|-----------|------|--------|-------|--------|
| `design.addComment` | Protected | Mutation | `{ projectId, entityType, entityId?, content }` | Created comment |
| `design.listComments` | Protected | Query | `{ projectId, entityType?, entityId? }` | Array of comments |
| `design.updateApprovalState` | Protected | Mutation | `{ projectId, approvalState, rationale }` | Updated project |

**Total: 31 procedures** (26 protected, 5 admin-only)

---

## 5. nano banana Prompt Templates

Prompt templates are stored in the `prompt_templates` database table and are fully admin-editable through the **Admin → Prompt Templates** page (`/admin/prompt-templates`).

### Template Structure

Each template contains:

- **name**: Human-readable identifier (e.g., "Luxury Mood Board")
- **type**: One of `mood`, `material_board`, or `hero`
- **templateText**: The prompt string with `{{variable}}` placeholders
- **variables**: JSON array of variable names used in the template
- **isActive**: Boolean toggle (inactive templates are hidden from the Visual Studio dropdown)

### Seeded Templates (5)

**1. Luxury Mood Board** (type: `mood`)

```
Create a sophisticated interior design mood board for a {{typology}} project
in {{location}}. Style: {{style}}, Market tier: {{tier}}. Materials: premium
{{materialLevel}} finishes. The mood should convey exclusivity, warmth, and
refined taste. Include natural materials, soft lighting, and curated art pieces.
```

Variables: `typology`, `location`, `style`, `tier`, `materialLevel`

**2. Contemporary Material Board** (type: `material_board`)

```
Generate a detailed material board showing {{materialCount}} key materials for
a {{tier}} {{typology}} project. Style direction: {{style}}. Focus on textures,
color harmony, and material pairings. Show marble, wood, metal, and fabric
swatches arranged in a professional grid layout.
```

Variables: `materialCount`, `tier`, `typology`, `style`

**3. Marketing Hero Image** (type: `hero`)

```
Create a photorealistic marketing hero image for a {{tier}} {{typology}}
development in {{location}}. Show a stunning interior living space with
{{style}} design aesthetic. Natural light streaming through floor-to-ceiling
windows. High-end finishes and furniture. Aspirational lifestyle photography style.
```

Variables: `tier`, `typology`, `location`, `style`

**4. Minimalist Mood** (type: `mood`)

```
Design a minimalist interior mood board for a {{typology}} space. Clean lines,
neutral palette with {{accentColor}} accents. Japanese-inspired simplicity meets
{{location}} luxury. Material level: {{materialLevel}}/5.
```

Variables: `typology`, `accentColor`, `location`, `materialLevel`

**5. Industrial Chic Mood** (type: `mood`)

```
Create an industrial-chic mood board for a {{typology}} loft conversion. Exposed
concrete, steel beams, reclaimed wood. Market tier: {{tier}}. Balance raw
industrial elements with {{style}} comfort and warmth.
```

Variables: `typology`, `tier`, `style`

### Variable Resolution

When a user clicks "Generate" in Visual Studio, the system:

1. Loads the selected template from the database
2. Resolves variables from the project's evaluation data (typology, tier, style, location, materialLevel from des02MaterialLevel score)
3. Stores the resolved prompt as `prompt_json` in the `generated_visuals` record
4. Passes the resolved prompt to the `generateImage` API

Admins can create unlimited additional templates, edit existing ones, and toggle them active/inactive without code changes.

---

## 6. Export Packs

Three developer-ready pack types are available from the Reports tab, each generating a branded PDF uploaded to CloudFront CDN.

### Pack 1: Executive Decision Pack

Updated from V2 to include Evidence Vault references, ROI narrative with 5 quantified drivers, and the 5-Lens Defensibility Framework. Contains: cover page, executive summary, scoring breakdown, 5-Lens analysis, ROI impact, risk assessment, and evidence references.

### Pack 2: Design Brief + RFQ Pack

New in V2.8. Contains: full 7-section design brief, room list with specifications, materials list with cost ranges and suppliers, procurement constraints and lead times, attached mood/material visuals, and RFQ-ready line items from the Board Composer.

### Pack 3: Marketing Pre-Launch Pack

New in V2.8. Contains: positioning statement, mood images, key differentiators, target segment profile, pricing guidance, and "concept only — subject to detailed design" disclaimers.

All packs include:

- MIYAR watermark and framework attribution
- Benchmark version ID used in evaluation
- Logic version tracking
- Generation timestamp

---

## 7. Known Limitations & Intentionally Deferred

### Known Limitations

| Item | Description | Severity |
|------|-------------|----------|
| PDF/DOCX preview thumbnails | Evidence Vault does not auto-generate preview thumbnails for uploaded PDFs/DOCX files; only images show previews | Low |
| Visual generation latency | nano banana image generation takes 5–20 seconds; no real-time progress indicator beyond "Generating..." status | Low |
| Board visual generation | Board Composer does not auto-generate a composite board image; user must manually trigger via Visual Studio | Medium |
| DOCX export | Design Brief exports as PDF only; DOCX export is not yet implemented | Medium |
| Shareable links | Report packs are downloadable PDFs but do not yet have role-gated shareable link functionality | Medium |
| Google Drive delivery | Webhook dispatch is built but Google Drive auto-upload requires user credentials not yet configured | Low |

### Intentionally Deferred

| Item | Rationale |
|------|-----------|
| Supplier management module | Placeholder fields exist in materials_catalog; full supplier CRM is out of scope for V2.8 |
| Real-time collaboration (WebSocket) | Comments use polling; real-time co-editing deferred to V3 |
| AI-assisted brief editing | Brief generation is deterministic; LLM-assisted editing deferred to V3 |
| Multi-language support | All outputs are English; Arabic/multilingual deferred |
| Paid add-on gating | Marketing Hero is flagged as "optional paid add-on" in the prompt but no payment gate is implemented |
| Version diffing UI | Brief versions are stored but side-by-side diff view is deferred |

---

## 8. Tests Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `server/auth.logout.test.ts` | 1 | Auth logout flow |
| `server/engines/scoring.test.ts` | 37 | V1 scoring engine: normalization, dimension scoring, composite calculation, edge cases |
| `server/engines/v2.test.ts` | 26 | V2 engines: ROI computation, 5-Lens framework, intelligence features, scenario templates, portfolio analytics |
| `server/engines/v28.test.ts` | 17 | V2.8 engines: design brief generation (7 sections), board composer (cost estimation, RFQ lines, material recommendations), visual prompt building |
| **Total** | **81** | **All passing** |

### V2.8 Test Details (17 tests)

The V2.8 test suite (`v28.test.ts`) covers:

- **Design Brief Generator** (7 tests): Project identity extraction, positioning statement generation, style/mood keywords, material guidance by tier, budget guardrails with contingency, procurement constraints with complexity flags, deliverables checklist completeness
- **Board Composer** (6 tests): Cost estimation with low/high ranges, RFQ line item generation with all fields, empty board handling, material recommendation by tier, material recommendation by category, combined tier+category filtering
- **Visual Prompt Builder** (4 tests): Template variable resolution, custom prompt passthrough, default prompt generation without template, prompt JSON structure for auditability

---

## 9. Deployment Details

### Live Environment

| Property | Value |
|----------|-------|
| URL | `https://3000-i3xi5l4yy0tagbjgurr4f-3853865a.sg1.manus.computer` |
| Stack | React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM |
| Database | TiDB (MySQL-compatible) |
| File Storage | S3 via `storagePut` helper |
| CDN | CloudFront (automatic via S3 upload) |
| Auth | Manus OAuth with JWT session cookies |
| Image Generation | Built-in `generateImage` API (nano banana) |

### How to Run Locally

```bash
# Clone the project
gh repo clone miyar-v2

# Install dependencies
pnpm install

# Set environment variables (see server/_core/env.ts for full list)
# DATABASE_URL, JWT_SECRET, VITE_APP_ID, OAUTH_SERVER_URL, etc.

# Generate migrations (if schema changed)
pnpm drizzle-kit generate

# Run tests
pnpm test

# Start dev server
pnpm dev
```

### Database Migrations

V2.8 added migration `0006_rare_colossus.sql` which creates 9 new tables and alters 2 existing tables. Apply with:

```sql
-- Run the migration SQL via webdev_execute_sql or mysql client
-- See drizzle/0006_rare_colossus.sql for full DDL
```

---

## 10. Admin Instructions

### Managing Prompt Templates

Navigate to **Admin → Prompt Templates** (`/admin/prompt-templates`).

- **Create**: Click "New Template", fill in name, select type (mood/material_board/hero), write the template text with `{{variable}}` placeholders, and list the variables as a comma-separated list.
- **Edit**: Click the edit icon on any template card to modify the text or variables.
- **Toggle**: Use the active/inactive switch on each card. Inactive templates are hidden from the Visual Studio dropdown but preserved in the database.
- **Filter**: Use the type tabs (All, Mood, Material Board, Hero) to find templates quickly.

### Managing Materials Library

Navigate to **Admin → Materials Library** (`/admin/materials`).

- **Add**: Click "Add Material", fill in name, category (13 options), tier (5 options), cost range (low/high in AED), cost unit, lead time (days + band), supplier info, and notes.
- **Search**: Use the search bar to filter by name.
- **Filter**: Use the Category and Tier dropdowns to narrow the view.
- **Edit/Delete**: Available on each material card (admin-only).

### Managing Watermark Settings

Watermarking is currently always-on for generated reports. The watermark appears as a footer attribution: "Generated by MIYAR Decision Intelligence Platform — Proprietary Framework". To toggle watermarking, modify the `generatePdfHtml` function in `server/engines/pdf-report.ts`.

### Role Permissions

| Action | Admin | User |
|--------|-------|------|
| Upload assets | Yes | Yes |
| Delete assets | Yes | No (enforced in router) |
| Create/edit materials | Yes | No |
| Create/edit prompt templates | Yes | No |
| Generate briefs | Yes | Yes |
| Generate visuals | Yes | Yes |
| Create boards | Yes | Yes |
| Change approval state | Yes | Yes |
| Add comments | Yes | Yes |
| View audit logs | Yes | No |

### Approval Workflow

Projects follow a 4-state approval workflow:

1. **Draft** — Initial state, project is being configured
2. **Review** — Project evaluation is complete, pending stakeholder review
3. **Approved for RFQ** — Design brief and material boards are approved for procurement
4. **Approved for Marketing** — Marketing pre-launch pack is approved for distribution

State changes require a rationale text and are logged to the audit trail. Any authenticated user can change the state (governance enforcement is at the organizational level).

---

## Appendix: File Structure (V2.8 Additions)

```
server/
  engines/
    design-brief.ts      (293 LOC) — 7-section brief generator
    visual-gen.ts         (88 LOC)  — nano banana prompt builder + image generation
    board-composer.ts     (159 LOC) — Cost estimation, RFQ lines, material recommendations
    v28.test.ts           (236 LOC) — 17 V2.8 engine tests
  routers/
    design.ts             (607 LOC) — 31 tRPC procedures for all V2.8 features

client/src/pages/
    EvidenceVault.tsx      (212 LOC) — File upload, category filters, asset management
    DesignBrief.tsx        (381 LOC) — 7-tab brief viewer with generate/regenerate
    VisualStudio.tsx       (214 LOC) — Type/template selectors, gallery with filters
    BoardComposer.tsx      (379 LOC) — Split-panel board editor with material cards
    Collaboration.tsx      (203 LOC) — Approval gates + commenting system
  admin/
    MaterialsLibrary.tsx   (195 LOC) — 3-column grid with search/filter
    PromptTemplates.tsx    (145 LOC) — Template cards with variable chips

drizzle/
    0006_rare_colossus.sql — 9 new tables, 2 altered tables
    schema.ts              — 24 total tables
```
