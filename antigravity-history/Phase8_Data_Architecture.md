# Phase 8: Data Architecture & Analytics Impact

Phase 8 fundamentally shifts MIYAR from a **top-down heuristic estimator** into a **bottom-up procurement intelligence engine**. 

Here is a deep dive into how real-world data is collected, parsed, and injected into the core calculations of any given project.

---

## 1. How Phase 8 Affects Analytics & Project Calculations

Prior to Phase 8, the scoring and analytical engines relied on statistical averages. Now, they defer to hard, physical realities whenever a user maps a Material Board to their project.

*   **Financial Feasibility (FF) Overridden:** In `scoring.ts` and `normalization.ts`, the `budgetFit` calculation originally compared the user's budget against an AI/Benchmark expected cost. Now, if a tied material board exists, the expected cost is **completely overridden** by the exact sum of the items on that board (`boardMaterialsCost`).
*   **Severe "Reality Check" Penalties:** A new penalty (`P7: BOARD_BUDGET_BREACH`) was introduced to the logic registry. If the hard cost of the selected vendor materials exceeds the user's stated budget cap by more than 10%, the project is slapped with a severe -15 point penalty and a red flag. The engine stops guessing and says, "The physical things you picked are explicitly too expensive."
*   **Execution Resilience & OPEX:** The predictive engine now calculates a `boardMaintenanceVariance` footprint. High-maintenance materials (e.g., natural marble over porcelain) carry strict OPEX multipliers. This variance now directly drains the generic **Execution Resilience** score, forcing users to balance premium aesthetics with long-term operational viability.
*   **Vendor Constraints (Design Suitability):** If a user selects specific `brandStandardConstraints` (e.g., Marriott vs. Emaar standards), the `vendor-matching.ts` system enforces strict filters. Selecting non-compliant materials hurts the Design Suitability (DS) score and blocks vendor approval recommendations.

---

## 2. The Data Hierarchy (DLD vs. Benchmarks vs. Catalogues)

Information across the database operates in a strict "confidence hierarchy." Phase 8 introduces the highest level of confidence.

1.  **Layer 1: DLD Open Data (The Foundation)**
    *   This sets the macroeconomic baseline capability of an area. E.g., The engine looks at DLD transactions to know Business Bay luxury apartments sell for ~3,000 AED/sqft. It uses this to cap what the realistic fit-out budget *should* be.
2.  **Layer 2: Historical Benchmarks (The Average)**
    *   Stored in `benchmarkData`, these are MIYAR's compiled historical averages for Typology + Tier (e.g., Luxury Residential usually costs X AED/sqm). This is used when a project is in the very early "idea" phase.
3.  **Layer 3: Material Catalogues (The Absolute Truth — Phase 8)**
    *   Stored in `materialsCatalog`. Once a user moves to Execution and builds a board, Layers 1 and 2 are bypassed. The AI stops saying "A luxury floor *should* cost 500 AED/sqm" and starts saying "You picked Cosentino Dekton, which *exactly* costs 1,200 AED/sqm."

---

## 3. How Prices and Catalogues Are Sourced & Added

Data doesn't magically appear in the database; it is actively hunted by the MIYAR Ingestion Pipeline (`server/engines/ingestion/`).

*   **The Connectors:** We use specialized "Source Connectors" (e.g., `scad-pdf-connector.ts`). These target known data hubs—such as the Statistics Centre Abu Dhabi (SCAD) or direct supplier drops.
*   **Evidence Records:** Instead of blindly trusting a new price, the system creates an `EvidenceRecord`. This acts as an audit trail. It logs the price, the source URL, the date, and assigns a "Reliability Grade" (A, B, C).
*   **The Sync Engine:** A secondary job (`syncEvidenceToMaterials` inside `evidence-to-materials.ts`) sweeps through the database. It looks at all recent `EvidenceRecords` for "Portland Cement" or "Calacatta Quartz", takes the median verified price, and updates the permanent `materialsCatalog`, thereby adjusting the `typicalCostLow` and `typicalCostHigh` for the entire app globally.

---

## 4. Extracting Information from PDF Catalogues

Most of the construction industry runs on messy, unstructured PDF catalogues. MIYAR relies on a heavily prompted AI extraction loop to solve this.

1.  **Buffer Parsing (`pdf-parse`):** 
    *   The connector downloads the supplier PDF locally and uses a raw buffer parser. This rips all the text out of the document, stripping away images and formatting, leaving behind a massive string of raw textual data (often 10,000+ characters).
2.  **Strict LLM Injection (Gemini Flash):**
    *   This raw text is sent to the Gemini AI via `invokeLLM`, but under extreme constraints. The system prompt (`EXTRACTION_PROMPT`) explicitly commands the LLM to act *only* as a structured data extraction engine. 
3.  **JSON Schema Enforcement:**
    *   The prompt forces Gemini to return a strict JSON array containing exactly: `materialName`, `category`, `priceAed`, and `unit`. Crucially, a rule is hardcoded into the prompt: *"Only real data from the PDF — do NOT invent values."*
4.  **Database Mapping:**
    *   The structured JSON array is returned to the server. The code filters out corrupt items, normalizes the names, attaches the source URL as proof, and writes them into the database as fresh evidence records. This raw evidence is what eventually trickles down to power the analytics and scoring penalties mentioned in Section 1.
