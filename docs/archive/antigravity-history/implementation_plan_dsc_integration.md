# DSC Official Price Data Integration Plan

Integrate official Dubai Statistics Center (DSC) construction material price benchmarks into the Miyar platform. This provides a high-reliability baseline for core building materials.

## Background

The file `Dsc_Average_Construction_Material_Prices_*.csv` contains historical data (2011-2024) for:
- Cement (Normal, Sulphate Resistant, White)
- Aggregates (3/4, 3/8, 3/16)
- Sand (White, Black, Red)
- Blocks (Hollow, Solid)
- Concrete (Ready Mix)
- Steel Bars (6-8mm, 10-25mm)
- Steel Mesh (BRC 6mm, 7mm, 8mm)

## Proposed Changes

### [Component Name] Data Integration

#### [NEW] [import-dsc-benchmarks.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/scripts/import-dsc-benchmarks.ts)
- A script to parse the DSC CSV and import the most recent (Q3 2024) data points into:
    1. **Evidence Vault**: As high-authority (Grade A) evidence records.
    2. **Benchmark Data**: As baseline market prices for core construction.

### [Component Name] Data Mapping

| DSC Item | Miyar Category | Unit | Spec Class |
|----------|----------------|------|------------|
| Cement Portland | Shell & Core | bag | Cement |
| Steel Bars | Shell & Core | ton | Reinforcement |
| Concrete Ready Mix | Shell & Core | cum | Concrete |
| Hollow Blocks | Shell & Core | piece | Masonry |

## Verification Plan

### Automated Verification
- Run `scripts/import-dsc-benchmarks.ts`.
- Verify new records in `evidence_records` with `publisher = 'Dubai Statistics Center'`.

### Manual Verification
1. Open the [Evidence Vault](http://localhost:3000/market-intel/evidence) and filter by "Dubai Statistics Center".
2. Verify that price trends for core materials like Steel and Cement are correctly captured from the Q3 2024 data.
