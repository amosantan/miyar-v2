# Data Health Audit — Why Most Tables Show Null/Zero

## Database Summary

| Table | Row Count | Has Real Data? | Root Cause |
|-------|-----------|----------------|------------|
| `evidence_records` | **1,493** | ✅ Yes — real material prices (AED/sqm) | **This is your richest table** |
| `trend_snapshots` | **192** | ⚠️ Partial — has values but `percentChange` is NULL | Only ~2 ingestion runs; needs a previous snapshot to compute delta |
| `benchmark_data` | **53** | ✅ Yes — synthetic but complete cost data | UI was reading wrong column names (fixed ✅) |
| `competitor_entities` | **4** | ❌ Placeholder | Seeded with "Properties" / "Entity" — no real developer names |
| `competitor_projects` | **94** | ❌ Placeholder | All have `totalUnits: null`, `priceIndicators: null`, `materialCues: null` |
| `trend_tags` | **0** | ❌ Empty | User hasn't created any manual tags |
| `project_outcomes` | **0** | ❌ Empty | Expected — no projects completed yet (Post-Mortem just built) |
| `benchmark_learning` | **0** | ❌ Empty | Depends on project_outcomes being populated |

---

## Root Causes (5 Issues)

### 1. Competitor Data is Placeholder (94 projects, no real intel)

The `competitor_entities` and `competitor_projects` tables were seeded with placeholder data:

```
competitor_entities: "Properties", "Entity" (generic names)
competitor_projects: projectName="Tower"/"Villa", totalUnits=NULL, priceIndicators=NULL
```

**Market share = 0.0%** because `totalUnits` is null for every project. **HHI = 0.0000** because there's no sales data.

> **Fix**: These need real UAE developer data — Emaar, DAMAC, Sobha, Nakheel, etc. with actual project details, unit counts, and pricing.

---

### 2. Trend Snapshots: `percentChange` is NULL

192 snapshots exist but `percentChange` and `previousMA` are both NULL. This is because the trend engine calculates `percentChange = (currentMA - previousMA) / previousMA` — but there's only been **~2 ingestion runs**, and both produced similar data.

The trend UI shows "— —" because it reads `percentChange`, which is null.

> **Fix**: Run more ingestion cycles with fresh evidence data. After 3+ runs with price variations, `percentChange` will populate automatically.

---

### 3. UI Field Name Mismatches (Benchmarks — Fixed ✅)

The Benchmarks page was reading `b.tier`, `b.avgCostPerSqft`, `b.avgScore`, `b.sampleSize` — but the actual DB columns are `marketTier`, `costPerSqftMid`, etc. This was fixed in commit `de6e994`.

---

### 4. Cost Forecast — Actually Working ✅

This is the one section with real data because it reads directly from `evidence_records` (1,493 rows of real material pricing). The P15/P50/P85/P95 values are computed from this evidence.

The "— —" in the Trend and 6mo Adj P50 columns is expected — these depend on `trend_snapshots.percentChange` being populated (see #2).

---

### 5. Benchmark Learning — Expected Empty

Shows 0 outcomes because no project post-mortems have been submitted yet. This is exactly what the Post-Mortem system we just built is for.

---

## What Needs Real Data

```mermaid
graph TD
    A[Evidence Records 1,493 ✅] --> B[Cost Forecasting ✅]
    A --> C[Trend Detection]
    C -->|needs 3+ runs| D[Trend Snapshots]
    D -->|percentChange| E[Market Trends UI]
    D -->|6mo projection| F[Cost Forecast Trend column]
    
    G[Real Competitor Data ❌] --> H[Competitor Landscape]
    G --> I[Market Position Map]
    G --> J[HHI / Market Share]
    
    K[Project Post-Mortems ❌] --> L[Benchmark Learning]
    K --> M[Outcome Comparisons]
    K --> N[Self-Correcting Evidence]
    
    style A fill:#22c55e,color:#fff
    style B fill:#22c55e,color:#fff
    style G fill:#ef4444,color:#fff
    style K fill:#f59e0b,color:#fff
```

## Recommended Next Steps

1. **Seed real competitor data** — populate `competitor_entities` with real UAE developers + `competitor_projects` with actual projects, units, and pricing
2. **Run 2-3 more ingestion cycles** — each run with updated evidence prices will populate `percentChange` in trend snapshots
3. **Create trend tags** — manual UI action to classify market signals
4. **Submit first post-mortem** — once a project is completed, use the new `submitPostMortem` API
