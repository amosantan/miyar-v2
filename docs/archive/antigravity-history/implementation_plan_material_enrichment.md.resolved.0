# Material Data Enrichment Plan

Enhance the Miyar V2 database with high-quality, real-world material data and price benchmarks sourced from the UAE market (Dubai/Abu Dhabi) for 2024-2025.

## Proposed Changes

### [Component Name] Data Enrichment

#### [NEW] [seed-enrichment.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/routers/seed-enrichment.ts)
- Create a new router or script to batch insert the following high-quality materials and evidence records.

---

### [Component Name] New Material Catalog Items

| Item Name | Category | Tier | Est. Cost (AED/sqm) | Lead Time | Supplier |
|-----------|----------|------|--------------------|-----------|----------|
| Statuario Marble Natural | stone | ultra_luxury | 3,200 - 4,500 | 90 days | Sanipex / Arifeen |
| Calacatta Oro Natural | stone | luxury | 675 - 950 | 75 days | Sanipex |
| Calacatta Gold Porcelain Big Slab | tile | premium | 550 - 825 | 30 days | Tile King |
| Statuario Porcelain 120x120 | tile | mid | 90 - 130 | 14 days | Tilesman |
| European Oak Herringbone | wood | premium | 315 - 450 | 45 days | Floors Dubai |
| American Walnut Herringbone | wood | luxury | 380 - 550 | 60 days | Floors Dubai |
| Jotun Fenomastic Wonderwall | paint | mid | 75 - 85 (per L) | 2 days | Jotun / ACE |
| RAK Bianco Vena High Glossy | tile | mid | 45 - 65 | 7 days | RAK Ceramics |

---

### [Component Name] New Evidence Vault Records (Price Benchmarks)

| Record ID | Item | Price (Typical) | Source |
|-----------|------|-----------------|--------|
| MYR-EV-2024-001 | Statuario A Slab 12mm | 880 AED/sqm | [Sanipex Group](https://www.sanipexgroup.com) |
| MYR-EV-2024-002 | Oak Distressed Engineered | 275 AED/sqm | [Floors Dubai](https://www.floorsdubai.com) |
| MYR-EV-2024-003 | RAK 30x60 Bianco Vena | 29 AED/sqm | [Plaza Middle East](https://plazamiddleeast.com) |
| MYR-EV-2024-004 | American Walnut 3-Strip | 295 AED/sqm | [Floors Dubai](https://www.floorsdubai.com) |
| MYR-EV-2024-005 | Jotun Fenomastic White 4L | 190 AED | [Noon / Jotun](https://www.noon.com) |

## Verification Plan

### Automated Verification
- Run the seeding script.
- Verify counts in `materials_catalog` and `evidence_records` tables via PlanetScale MCP.

### Manual Verification
1. Open the [Material Library](http://localhost:3000/admin/materials) and verify the new luxury and premium items appear with correct images (generated) and prices.
2. Open the [Evidence Vault](http://localhost:3000/market-intel/evidence) and verify the new price benchmark records are correctly categorized and linked to sources.
