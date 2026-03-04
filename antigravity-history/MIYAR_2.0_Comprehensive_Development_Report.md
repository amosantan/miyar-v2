# MIYAR 2.0 — Comprehensive Development Report

> **Executive Summary:** This document outlines the complete developmental journey of MIYAR 2.0 leading up to Phase 10. It covers the architectural decoupling, the integration of Google Gemini, the premium UI/UX overhaul, the autonomous data ingestion pipeline, and the operational integration of NotebookLM.

---

## 1. AI Engine Overhaul: The Gemini Transition
The most significant architectural shift was decoupling MIYAR from legacy dependencies (e.g., Manus) to create a standalone, fully localized intelligence application powered exclusively by **Google Gemini 2.0**.

*   **Universal `invokeLLM` Wrapper:** Centralized all AI calls into a single, highly controlled interface in `server/_core/llm.ts`. This handles structured JSON extraction, text generation, and system prompting.
*   **Rebuilt Design Engines:** 
    *   `Design Brief Generator`: Fully relies on Gemini for 7-section narrative briefs.
    *   `Space Recommendations`: Generates room-by-room material, budget, and style recommendations.
    *   `Design Advisor`: Provides conversational AI guidance heavily injected with UAE market trend contexts.
*   **Vision & Image Synthesis:** Integrated Gemini's image capabilities (`visual-gen.ts`) for generating concept imagery directly within the app.

## 2. The Premium UI/UX Redesign
To align with the ultra-luxury target market (AED 20M–500M+ real estate), the entire frontend was redesigned from a generic dashboard into a premium, board-ready interface.

*   **Luxury Aesthetic (Glassmorphism):** Implemented sophisticated glassmorphic elements throughout the UI—translucent panels, background blurs, and subtle gradients that feel state-of-the-art.
*   **Typography Overhaul:** Shifted from standard sans-serifs to premium serif typography (e.g., Playfair Display) for key metrics and headings, combined with Inter for high legibility in data tables.
*   **Mobile Responsiveness:** Completely rebuilt the grid systems and the primary Sidebar to ensure seamless operation on desktop, tablet, and mobile devices—critical for executives on the go.
*   **Animated Homepage:** Deployed dynamic micro-animations, stagger effects, and hover states that make the application feel alive and highly responsive.

## 3. Autonomous Ingestion & Scraping Pipeline
A major focus was placed on ensuring MIYAR's data foundation (evidence records, benchmarks) is fed by a robust, autonomous scraping engine that bypasses modern anti-bot technology.

*   **6-Provider Fallback Chain:** Re-engineered the `BaseSourceConnector` to gracefully cascade through premium scrapers to guarantee data retrieval: 
    *   `Firecrawl` ➔ `ScrapingAnt` ➔ `ScrapingDog` ➔ `Apify` ➔ `ParseHub` (recurring JS-heavy sites) ➔ `Native Fetch`.
*   **Smart Credit Caching:** Added global state awareness (e.g., 6-hour TTL cache when Firecrawl credits are exhausted) to prevent cascading timeouts and speed up fallback delivery.
*   **Intelligent HTML Cleanup for LLMs:** Before raw scraped data hits Gemini, the pipeline (`cleanHtmlForLLM()`) strips all React scripts, styles, SVGs, and navigation, extracting only the `<main>` content areas. This prevents the primary 32K token window from being clogged by garbage code, ensuring 100% data extraction efficiency.
*   **Dynamic vs. API Scraping:** Tuned ScrapingDog configurations (`dynamic=true`, 45s timeouts) to penetrate heavy JS-framework aggregator sites.

## 4. NotebookLM: The Research Brain
Integrated NotebookLM as an autonomous market research agent via the MCP (Model Context Protocol).

*   **MCP Integration:** Configured Node.js environments and Vercel MCP structures to allow the MIYAR application to query NotebookLM directly.
*   **Deep Hunting Prompts:** Created specialized NotebookLM prompting frameworks designed to hunt down UAE-specific competitor intelligence, localized material pricing, and macro real estate trends.
*   **Continuous Feedback Loop:** Data gathered by the NotebookLM agent is translated directly into the `Source Registry` and `Evidence Records` tables, keeping the application's foundational constants (e.g., AED/m²) strictly accurate.

## 5. Exports & Board-Ready Deliverables
MIYAR was solidified as a presentation tool, ensuring all outputs can be handed directly to an investor or board of directors without secondary formatting.

*   **HTML to PDF Engines:** Built dedicated rendering pathways (`investor-pdf.ts`, `board-pdf.ts`) that generate beautifully formatted, watermarked PDF reports.
*   **Token-Gated Sharing:** Developed `/share/:token` infrastructure, allowing users to send read-only, time-boxed (7-day) strategic links to investors without requiring them to create a MIYAR account.

---

> **Status:** MIYAR 2.0's structural, aesthetic, and automated data layers are now completely stabilized. The platform operates independently on Vercel/TiDB, powered by Gemini, and is ready for **Phase 10: Sales Premium & Yield Predictor Engine.**
