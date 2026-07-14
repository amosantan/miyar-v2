# Scraping Pipeline Overhaul — Walkthrough

**Commits:** `8279629` (Market Intelligence Engine V2) → `79f0e66` (Scraping pipeline overhaul)

---

## What Was Fixed

### 1. Fallback Chain Was Broken → Fixed ✅
`DynamicConnector` bypassed ScrapingDog/ScrapingAnt/Apify entirely — it only tried Firecrawl → native fetch. Now uses `super.fetch()` which runs the full 6-provider chain.

### 2. Firecrawl Credit Exhaustion → Cached ✅
When Firecrawl returns "Insufficient credits", it's now cached for 6 hours. Subsequent requests skip Firecrawl instantly instead of wasting 2-3s on a doomed API call.

### 3. ScrapingAnt Promoted to #2 ✅
Audit proved ScrapingAnt is the most reliable provider (3/5 sources). Chain order is now:
**Firecrawl → ScrapingAnt → ScrapingDog → Apify → ParseHub → Native**

### 4. HTML Cleanup for LLM ✅
Added `cleanHtmlForLLM()` that strips scripts/styles/nav/footer/header/aside, focuses on `<main>`/`<article>` content areas, and converts to clean text. Snippet size increased from 16K → 32K chars.

| Source | Before cleanup | After cleanup |
|--------|---------------|---------------|
| Dezeen | 452,890 chars raw HTML | 5,260 chars clean text → LLM |
| CID Magazine | 350,489 chars raw HTML | 3,523 chars clean text → LLM |
| JLL MENA | 675,133 chars raw HTML | 8,846 chars clean text → LLM |

### 5. ParseHub Integration ✅
Added as fallback #5. Requires pre-configured project templates (created via ParseHub app). API key `toJLiLaOHvXq` added to `.env` and Vercel.

### 6. ScrapingDog Config ✅
Added `dynamic=true` for JS-rendered pages and increased timeout from 30s → 45s.

---

## Remaining Issue: Index Pages Don't Have Data

The 3 trade publications (Dezeen, CID, JLL) **fetch and clean successfully**, but the LLM correctly returns 0 items because these are **index/listing pages** — they only contain article titles and thumbnails, not actual market data.

The real data is in their **sub-pages**:
- Dezeen: 154 article links found
- CID Magazine: 73 article links found
- JLL MENA: 28 report links found

**Next step:** Enable multi-page crawling with `depth=1` for `trade_publication` and `industry_report` sources. This will follow article links and extract data from actual articles, which should yield dozens of evidence records per source.

---

## Files Changed

| File | Changes |
|------|---------|
| [connector.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/ingestion/connector.ts) | Firecrawl credit cache, fetchWithFirecrawl throws, ScrapingDog config, ParseHub method, reordered chain |
| [dynamic.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/ingestion/connectors/dynamic.ts) | `cleanHtmlForLLM()`, 32K snippet, `super.fetch()` in crawl loop |
| [scrape-audit.ts](file:///Users/amrosaleh/Maiyar/miyar-v2/server/engines/ingestion/scrape-audit.ts) | New audit tool for testing scraping pipeline |
