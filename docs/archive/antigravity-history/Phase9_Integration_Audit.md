# Phase 9 — Integration Audit 🔍

## Honest Status: What's ACTUALLY Connected

### ✅ Working Connections

| Phase 9 Feature | Connected To | How |
|-----------------|-------------|-----|
| `buildSpaceProgram()` | **AI Design Advisor** | `ai-design-advisor.ts` calls it to generate room budgets → feeds AI recommendations |
| `buildSpaceProgram()` | **Project Evaluation** | `project.ts` router (L915) uses it during evaluation to compute fitout budgets |
| `floorPlanAnalysis` → `space-program.ts` | **AI Advisor** | When floor plan is analyzed, `buildSpaceProgram` auto-prefers AI-extracted ratios over templates |
| `uploadFloorPlan` | **SpacePlanner page** | Upload → store → link → analyze flow works end-to-end |
| `analyzeFloorPlan` | **SpacePlanner page** | Gemini Vision extraction → room table → stored on project |
| `getSpaceBenchmark` | **SpacePlanner page** | DLD-backed recommendations display correctly |
| Space Planner button | **ProjectDetail header** | Navigation button is visible in project header |

### ❌ Disconnected — Real Gaps

| Gap | What's Missing | Impact |
|-----|---------------|--------|
| **1. Scoring Engine** | `scoring.ts` has zero references to `floorPlanAnalysis` or space efficiency | DS score (Design Suitability) doesn't reward/penalize space allocation quality |
| **2. Design Brief** | `design-brief.ts` doesn't call `buildSpaceProgram` or reference floor plan data | The 7-section AI brief doesn't mention room ratios or space optimization |
| **3. Investor Summary** | `InvestorSummary.tsx` has no space efficiency section | Investors don't see space optimization data — major missed opportunity |
| **4. Design Studio UI** | `DesignStudio.tsx` doesn't call `generateRoomRender` | The new room-specific render engine exists but has no UI to trigger it |
| **5. Brief Editor** | `BriefEditor.tsx` doesn't show space benchmark data | Budget calculator doesn't use DLD space benchmarks for per-room cost guidance |
| **6. Platform Alerts** | No autonomous alert fires when space ratios deviate critically | System should warn about critical space deviations like it warns about price shocks |

---

## Enhancement Recommendations

### 🔴 Priority 1 — Must Wire (Core Value Gaps)

#### 1A. Scoring Engine: DS Dimension Should Include Space Efficiency
**Current:** DS score only uses style, material level, complexity, experience, sustainability
**Should:** Include `overallEfficiencyScore` from `benchmarkSpaceRatios` as a sub-factor
**Effect:** Projects with analyzed floor plans get a more accurate Design Suitability score

#### 1B. Design Brief: Include Space Program Section
**Current:** Brief has 7 sections but none reference actual room ratios
**Should:** Add an 8th section "Space Allocation Analysis" that feeds AI-extracted room data + DLD benchmarks into the brief narrative
**Effect:** Board-ready briefs include defensible space planning data

#### 1C. Investor Summary: Space Efficiency Card
**Current:** Shows budget, ROI, style — no space data
**Should:** Add a "Space Optimization" section showing efficiency score, top recommendations, and financial impact
**Effect:** Investors see that space planning is data-backed, not guesswork

---

### 🟡 Priority 2 — High Impact Enhancements

#### 2A. Design Studio: Room-Specific Render UI
**Current:** Design Studio generates whole-project renders
**Should:** Add "Per-Room Render" tab that uses `generateRoomRender` with board materials
**Effect:** Renders match exact materials from the material board for specific rooms

#### 2B. Brief Editor: Space-Aware Budget Guidance
**Current:** Budget calculator uses static benchmark rates
**Should:** Show DLD-optimal room allocation percentages alongside current budget split
**Effect:** User sees "Kitchen at 6% (optimal: 9%)" to guide reallocation

#### 2C. Platform Alerts: Space Deviation Warnings
**Current:** Alerts fire for price shocks, benchmark drift, project risk
**Should:** Fire alert when floor plan analysis shows critical deviations (>2x tolerance)
**Effect:** Developer is proactively warned before committing to a suboptimal layout

---

### 🟢 Priority 3 — Polish & UX

#### 3A. Floor Plan Upload in Project Creation Wizard
**Current:** Upload only available after project creation in SpacePlanner
**Should:** Add optional upload step in ProjectForm.tsx wizard
**Effect:** Floor plan data available from day one

#### 3B. Navigation: Add Space Planner to sidebar
**Current:** Only accessible via project detail header button
**Should:** Add to sidebar under "Design Enablement" group (alongside AI Design Advisor, Evidence Vault, Design Brief)
**Effect:** Easier discovery

#### 3C. Space Planner: Before/After Comparison
**Current:** Shows current ratios vs benchmarks
**Should:** Allow saving snapshots and comparing layout iterations
**Effect:** Developer can track improvement across design revisions

---

## Summary Verdict

> **Phase 9 backend is solid — the engines work.** The main gap is that the rest of the app doesn't *consume* the new data yet. The floor plan analyzer produces excellent room-level intel, but only the SpacePlanner page and AI Design Advisor use it. The scoring engine, design brief, investor summary, and Design Studio are still operating as if Phase 9 doesn't exist.
>
> **Fixing Priority 1 items (scoring + brief + investor summary) is the fastest way to make Phase 9 feel integrated.** These are relatively small wiring changes — the hard work (engines, router procedures) is already done.
