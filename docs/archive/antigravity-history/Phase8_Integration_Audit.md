# Phase 8 — Full Integration Audit Report

> **Verdict: ✅ FULLY INTEGRATED.** Every Phase 8 feature is built on top of the existing foundation and is wired end-to-end from database schema → ingestion → engines → routers → UI.

---

## Integration Map (12 Files Traced)

```mermaid
graph TD
    A["PDF Catalogues<br/>(SCAD, Cosentino, RAK)"] -->|pdf-parse + Gemini| B["scad-pdf-connector.ts"]
    B -->|evidenceRecords table| C["evidence-to-materials.ts"]
    C -->|writes embodiedCarbon,<br/>maintenanceFactor,<br/>brandStandardApproval| D["materialsCatalog<br/>(schema.ts L751-753)"]
    D -->|vendor-matching.ts| E["recommendMaterials<br/>(design.ts L778)"]
    D -->|BoardComposer.tsx| F["User builds Material Board"]
    F -->|materialsToBoards join| G["project.ts evaluate<br/>(L338-364)"]
    G -->|boardMaterialsCost<br/>boardMaintenanceVariance| H["normalization.ts<br/>(L147-161)"]
    H -->|overrides expectedCost| I["budgetFit calculation"]
    I --> J["scoring.ts FF Score<br/>(computeFinancialFeasibility)"]
    G -->|P7 penalty check| K["scoring.ts P7<br/>BOARD_BUDGET_BREACH<br/>(L200-214)"]
    G -->|predictive.ts<br/>(L172-203)| L["scenario-projection.ts<br/>baseCostPerSqm override<br/>(L92)"]
    E -->|filters by<br/>brandStandardConstraints| M["Vendor Matching Engine<br/>(vendor-matching.ts)"]
```

---

## Layer-by-Layer Proof

### 1. Database Schema (`drizzle/schema.ts`)

| Field | Table | Line | Type | Purpose |
|-------|-------|------|------|---------|
| `embodiedCarbon` | `materialsCatalog` | L751 | `decimal(10,4)` | kgCO₂e per unit — carbon footprint |
| `maintenanceFactor` | `materialsCatalog` | L752 | `decimal(6,4)` | OPEX multiplier (0.02–0.15) |
| `brandStandardApproval` | `materialsCatalog` | L753 | `enum(open_market, approved_vendor, preferred_brand)` | Vendor compliance tier |

These are **stored alongside** the existing `typicalCostLow`, `typicalCostHigh`, `tier`, `leadTimeDays` fields that were already in the foundation.

### 2. Shared Types (`shared/miyar-types.ts` L94-96)

```typescript
// Phase 8: Board overrides
boardMaterialsCost?: number;
boardMaintenanceVariance?: number;
```

These fields are part of `ProjectInputs`, which means they flow through **every single engine** that accepts project inputs: scoring, normalization, predictive, sensitivity, bias detection.

### 3. Data Ingestion Pipeline

| File | What It Does | Phase 8 Fields Used |
|------|-------------|-------------------|
| [scad-pdf-connector.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/ingestion/connectors/scad-pdf-connector.ts) | Downloads SCAD PDFs → `pdf-parse` → Gemini extraction → `evidenceRecords` | Source of raw price data |
| [evidence-to-materials.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/ingestion/evidence-to-materials.ts) L167-181, L227-229 | Converts evidence → `materialsCatalog` entries | `maintenanceFactor`, `embodiedCarbon`, `brandStandardApproval` |

**Key logic** (L173-181): Known brands (Cosentino, RAK, Grohe, Kohler, etc.) are auto-tagged as `preferred_brand`. Luxury-tier unknowns get `approved_vendor`. Everything else is `open_market`.

### 4. Vendor Matching Engine

[vendor-matching.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/procurement/vendor-matching.ts) — Reads the project's `brandStandardConstraints` from the `projects` table and filters the full `materialsCatalog`:

| Constraint | Allowed Materials |
|-----------|------------------|
| `strict_vendor_list` | Only `preferred_brand` |
| `moderate_guidelines` | `approved_vendor` + `preferred_brand` |
| `open_market` / `none` | Everything |

Sorting: `preferred_brand` first → `approved_vendor` → `open_market`, then by lowest `embodiedCarbon` (greenest wins ties).

### 5. Scoring Engine Integration

| Component | File | Lines | What Phase 8 Changed |
|-----------|------|-------|---------------------|
| **Budget Fit Override** | [normalization.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/normalization.ts) | L147-154 | If `boardMaterialsCost > 0`, `expectedCost` is **completely replaced** by board total ÷ area |
| **Execution Resilience Drain** | [normalization.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/normalization.ts) | L156-161 | `boardMaintenanceVariance` reduces `executionResilience` by up to 0.2 |
| **FF Score** | [scoring.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/scoring.ts) | L37-53 | `budgetFit` (now board-adjusted) feeds directly into FF at weight 0.45 |
| **P7 Penalty** | [scoring.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/scoring.ts) | L200-214 | Board cost > 110% of budget cap → **-15 points + BOARD_BUDGET_BREACH flag** |
| **Conditional Action** | [scoring.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/scoring.ts) | L271-279 | Recommends swapping premium vendor items or increasing budget cap |

### 6. Predictive Engine Integration

| Component | File | Lines | What Phase 8 Changed |
|-----------|------|-------|---------------------|
| **Board Override** | [scenario-projection.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/predictive/scenario-projection.ts) | L28-31, L92 | `boardMaterialsCost` replaces `baseCostPerSqm` as the projection baseline |
| **Router Fetch** | [predictive.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/predictive.ts) | L172-203 | Fetches boards, loops materials, calculates total cost + maintenance variance |

### 7. Router Integration (3 Procedures)

| Procedure | File | Lines | Board Data Injected? |
|-----------|------|-------|--------------------|
| `evaluate` | [project.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/project.ts) | L338-364 | ✅ Fetches boards, sums costs, sets `inputs.boardMaterialsCost` |
| `applyScenarioTemplate` | [project.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/project.ts) | L726-731 | ✅ Same board fetch logic |
| `runCustomScenario` | [project.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/project.ts) | L788-793 | ✅ Same board fetch logic |
| `recommendMaterials` | [design.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/design.ts) | L778-796 | ✅ Calls `matchVendorsForProject` |

### 8. UI Integration (`BoardComposer.tsx`)

New badges displayed per material tile:
- 🏷️ **Brand Standard Approval** badge (L373-377)
- 🌿 **Embodied Carbon** in kgCO₂e (L385-388)  
- 🔧 **Maintenance Factor** OPEX indicator (L389-392)

### 9. Admin API (`design.ts` L813-866)

`createMaterial` and `updateMaterial` both accept `embodiedCarbon`, `maintenanceFactor`, and `brandStandardApproval` as validated Zod inputs — meaning admins can manually set these values too, not just the ingestion pipeline.

---

## Data Hierarchy Confirmation

```
DLD Open Data (Layer 1) → Sets macroeconomic ceiling
         ↓ overridden by
Historical Benchmarks (Layer 2) → Statistical averages
         ↓ overridden by
Material Board Costs (Layer 3 — Phase 8) → Absolute physical truth
```

When a board exists, **Layers 1 and 2 are bypassed** in both the Scoring Engine and the Predictive Engine.

---

## Conclusion

Phase 8 is not isolated. It is **deeply embedded** into the same `ProjectInputs` → `normalizeInputs()` → `evaluate()` pipeline that every prior phase uses. The foundation (schema, types, engines, routers, UI) remains unified.
