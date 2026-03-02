# MIYAR V8 — Design Intelligence Layer Implementation Plan

## Goal Description
Transform the existing numerical "Design Brief" into a fully realized, professional interior architecture brief. This document will feature a deterministic color palette, material finishes, room-by-room programming with fit-out budget allocations, and automatically generated compliance checklists and RFQ documents. All quantities, material selections, and costs will run through pure deterministic functions, ensuring strict adherence to the LLM Boundary rules.

## Proposed Changes

### 1. Database & Seed Data
#### [MODIFY] `server/db/schema.ts`
Add 5 new tables with explicit `organizationId` isolation mappings:
- `materialLibrary`
- `finishScheduleItems`
- `projectColorPalettes`
- `rfqLineItems`
- `dmComplianceChecklists`

#### [NEW] `server/db/seed-material-library.mjs`
A script containing the 30+ provided minimal viable library seed items spanning paints, tiles, sanitaryware, etc.

#### [NEW] `server/engines/design/palette-seeds.ts`
Export JSON dictionaries containing the 4 palette definitions (`warm_minimalism`, `cool_minimalism`, `arabesque_warmth`, `classic_marble`) with exact hex codes matching the provided RAL references.

### 2. Design Intelligence Core Engines
All new engines belong to `server/engines/design/`.

#### [NEW] `server/engines/design/vocabulary.ts`
Exports `buildDesignVocabulary()`. Translates abstract inputs into human-readable strings (e.g. `fin01BudgetCap < 200` equals "affordable" tier). 

#### [NEW] `server/engines/design/space-program.ts`
Exports `buildSpaceProgram()`. Automatically creates room dictionaries based on `ctx01Typology` mapping to budget percentages. Calculates `.totalFitoutBudgetAed` securely based on `GFA * Cap * 10.764 * 0.35` multiplier.

#### [NEW] `server/engines/design/finish-schedule.ts`
Exports `buildFinishSchedule()`. Intersects Room Grades (A/B/C) with Material Tiers to automatically select library components for floor, wall, and ceiling items per room.

#### [NEW] `server/engines/design/color-palette.ts`
Exports `buildColorPalette()`. Extracts a deterministic palette seed and invokes the LLM (`invokeLLM()`) strictly for a 3-sentence stylistic rationale narrative.

#### [NEW] `server/engines/design/rfq-generator.ts`
Exports `buildRFQPack()`. Groups up finish schedules and applies rates mapped to room footprints, compiling into competitive bidding formats.

#### [NEW] `server/engines/design/dm-compliance.ts`
Exports `buildDMChecklist()`. Emits DM/DDA checklists deterministically keyed to the project typology and sustainability metrics.

### 3. Assembling the Document
#### [MODIFY] `server/engines/autonomous/document-generator.ts`
Refactor Gemini brief generator to only construct 3 specific textual narrative paragraphs (Style narrative, Material Rationale, Color Story) rather than wholesale rewriting the brief structure.

#### [MODIFY] `server/engines/pdf-report.ts`
Overhaul `generateDesignBriefHTML()` into a 9-page layout matching professional Dubai interior architectures: Project Snapshot, Palette, Finish Schedule, Material Legend, Space Program, Compliance Checklist, and RFQ Pack. All metric identifiers and numeric variable codes removed from UI output.

#### [MODIFY] `server/routers/design.ts`
Map the `generateBrief` TRPC endpoint to synchronously sequence the above execution graph, storing resulting objects in the newly migrated database structures, compiling the PDF, persisting to S3, and applying an audit trail hook.

## Verification Plan
### Automated Tests
Produce 29+ test files encompassing standard unit tests enforcing the rule mapping thresholds described above. Attain +700 function pass milestone. Prevent regressions on the 628 function legacy suite.

### Output Verification
Generate an end-to-end report against a local `Miyar` test project (e.g., Al Wasl Residences, Mid-scale). Snapshot the resultant design brief to ensure formatting and contents exactly conform to the provided 9-page blueprint and absent of any debug variables.
