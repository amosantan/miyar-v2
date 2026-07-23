/**
 * MIYAR Phase 3 — UAE Source Seeder
 *
 * Seeds the source_registry table with 20+ real UAE supplier, competitor,
 * and trend sources for automated market intelligence scraping.
 *
 * Usage: npx tsx server/engines/ingestion/seeds/uae-sources.ts
 */
import { getDb } from "../../../db";
import { sourceRegistry } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { initializeDatabaseSafety } from "../../../_core/database-safety";

// ─── Source Definitions ─────────────────────────────────────────

interface SourceSeed {
    name: string;
    /**
     * ADR-0009/EV-00: stable connector key. Sources with a static connector
     * class use its sourceId verbatim so the orchestrator can resolve their
     * registry row; others get a unique kebab slug for the dynamic path.
     */
    slug: string;
    url: string;
    sourceType: "supplier_catalog" | "manufacturer_catalog" | "developer_brochure" | "industry_report" |
    "government_tender" | "procurement_portal" | "trade_publication" | "retailer_listing" | "aggregator" | "other";
    reliabilityDefault: "A" | "B" | "C";
    region: string;
    scrapeMethod: "html_llm" | "html_rules" | "json_api" | "rss_feed" | "csv_upload" | "email_forward";
    scrapeSchedule: string; // cron expression
    extractionHints: string;
    notes: string;
    requestDelayMs: number;
    /** EV-00: dead or retired sources are deactivated, never deleted. */
    isActive?: boolean;
    /**
     * EV-01b: e-commerce platform. Set together with `scrapeMethod: "json_api"`
     * to route a source through the deterministic (non-LLM) connector family.
     */
    platform?: "shopify" | "woocommerce" | "magento" | "none";
    /**
     * EV-01b: BR-06 source-terms decision. Seeds never write `approved` —
     * robots permission is a technical signal, not a commercial licence, and
     * only a human may record acceptance.
     */
    termsDecision?: "pending" | "approved" | "rejected";
    /** EV-01b: what kind of price this source publishes. */
    priceClass?:
    | "retail_listed"
    | "trade_quoted"
    | "official_statistic"
    | "consultancy_benchmark"
    | "unknown";
}

export const UAE_SOURCES: SourceSeed[] = [
    // ── Supplier Catalogs ─────────────────────────────────────────
    {
        name: "Graniti UAE",
        slug: "graniti-uae",
        url: "https://www.granitiuae.com/",
        sourceType: "supplier_catalog",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 1", // Monday 7 AM UTC
        extractionHints: "Extract product names, material types (tiles, marble, granite, sanitary ware, outdoor furniture), prices in AED, dimensions. Product pages use Elementor tabs with categories: Bathroom, Washroom, Tiles, Slabs, Outdoor, Mosaics. Look for product cards with prices.",
        notes: "Major UAE tile/sanitary supplier with Sheikh Zayed Road showroom. Has sub-pages per category.",
        requestDelayMs: 3000,
    },
    {
        name: "RAK Ceramics UAE",
        slug: "rak-ceramics-uae",
        // EV-01b repair: the corporate site publishes no prices. The online
        // shop on a different subdomain does — verified 2026-07-23, Magento
        // `data-price-amount` attributes present on the tiles listing.
        url: "https://onlineshop.rakceramics.com/ae_en/tiles.html",
        sourceType: "manufacturer_catalog",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "json_api",
        platform: "magento",
        termsDecision: "pending",
        priceClass: "retail_listed",
        scrapeSchedule: "0 0 7 * * 1",
        extractionHints: "Deterministic Magento extraction: data-price-amount, data-product-sku, product-item-link. No LLM on the numeric path.",
        notes: "UAE-based manufacturer. Repointed 2026-07-23 (EV-01b) from the corporate site (no prices) to the online shop. Consumer retail listing prices, not trade rates — reliability C, priceClass retail_listed. Inactive until a BR-06 terms decision is recorded.",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "Porcelanosa UAE",
        slug: "porcelanosa-uae",
        url: "https://www.porcelanosa.com/ae/",
        sourceType: "manufacturer_catalog",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 8 * * 1",
        extractionHints: "Extract product lines for tiles, bathroom fixtures, kitchens. Look for prices in AED, product dimensions, material type (porcelain, ceramic, natural stone). Premium brand — prices indicate upper-mid to luxury tier.",
        notes: "Spanish premium manufacturer with UAE presence.",
        requestDelayMs: 2000,
    },
    {
        name: "Hafele UAE",
        slug: "hafele-uae",
        url: "https://www.hafele.ae/en/",
        sourceType: "supplier_catalog",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 3", // Wednesday 7 AM
        extractionHints: "Extract hardware products: handles, hinges, drawer systems, kitchen fittings, wardrobe accessories. Look for product codes, prices in AED, categories. Focus on kitchen and bathroom hardware for interior design benchmarks.",
        notes: "German hardware manufacturer with UAE distribution. Deactivated 2026-07-23 (EV-01b): the EV-00 URL repair to hafele.ae/en/ is itself a 404, and the base domain returns HTTP 403 to automated requests. Deactivation, not another repair.",
        requestDelayMs: 2000,
        isActive: false,
    },
    {
        name: "GEMS Building Materials",
        slug: "gems-building-materials",
        url: "https://www.gems-bm.com/",
        sourceType: "supplier_catalog",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 1",
        extractionHints: "Extract building material products, prices in AED, categories (tiles, marble, granite, plumbing, electrical). Focus on unit prices per sqm/sqft/piece.",
        notes: "UAE building materials supplier. Deactivated 2026-07-23 (EV-00): gems-bm.com no longer resolves (NXDOMAIN in the cost-path audit probe).",
        requestDelayMs: 2000,
        isActive: false,
    },
    {
        name: "Dragon Mart Dubai",
        slug: "dragon-mart-dubai",
        url: "https://www.dragonmart.ae/",
        sourceType: "retailer_listing",
        reliabilityDefault: "B",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 1",
        extractionHints: "Extract products from building materials, home improvement, lighting categories. Look for wholesale and retail prices in AED. Dragon Mart is value-oriented — prices indicate budget to standard tier.",
        notes: "Largest trading hub in UAE. Budget to mid-range materials.",
        requestDelayMs: 3000,
    },
    {
        name: "Danube Home",
        slug: "danube-home",
        url: "https://www.danubehome.com/uae/",
        sourceType: "retailer_listing",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 8 * * 2", // Tuesday
        extractionHints: "Extract furniture, bathroom fixtures, kitchen products, lighting, flooring. Look for product prices in AED, dimensions, categories. Danube is mid-range — indicates standard to upper-mid pricing tiers.",
        notes: "Major UAE home furnishing retailer with online catalog.",
        requestDelayMs: 2000,
    },
    {
        name: "IKEA UAE",
        slug: "ikea-uae",
        url: "https://www.ikea.com/ae/en/",
        sourceType: "retailer_listing",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 8 * * 3",
        extractionHints: "Extract kitchen systems (METOD/KNOXHULT), bathroom (GODMORGON/HEMNES), wardrobes (PAX), lighting prices in AED. IKEA represents the standard-tier benchmark for FF&E.",
        notes: "Global budget-to-mid furniture brand. Standard FF&E benchmark.",
        requestDelayMs: 3000,
    },
    {
        name: "ACE Hardware UAE",
        slug: "ace-hardware-uae",
        url: "https://www.aceuae.com/",
        sourceType: "retailer_listing",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 9 * * 3",
        extractionHints: "Extract hardware, paint, plumbing, electrical products with AED prices. Focus on building materials, tools, home improvement categories for construction cost benchmarks.",
        notes: "Hardware retail chain in UAE.",
        requestDelayMs: 2000,
    },
    {
        name: "Pan Marble Dubai",
        slug: "pan-marble-dubai",
        url: "https://www.pansidubai.com/",
        sourceType: "supplier_catalog",
        reliabilityDefault: "B",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 5", // Friday (monthly effective)
        extractionHints: "Extract marble and natural stone products: travertine, granite, onyx, limestone. Look for AED prices per sqm/sqft, slab dimensions, stone origin. Premium material supplier.",
        notes: "Major marble/natural stone supplier in Dubai. Deactivated 2026-07-23 (EV-00): pansidubai.com no longer resolves (NXDOMAIN in the cost-path audit probe).",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "Homes R Us UAE",
        slug: "homes-r-us-uae",
        url: "https://www.homecentre.com/ae/en",
        sourceType: "retailer_listing",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 8 * * 5",
        extractionHints: "Extract furniture, soft furnishings, décor, lighting products with AED prices. Focus on living room, bedroom, dining categories for FF&E cost benchmarks.",
        notes: "Home Centre by Landmark Group. Mid-range FF&E.",
        requestDelayMs: 2000,
    },

    // ── Developer Brochures (Competitor Intelligence) ─────────────
    {
        name: "Emaar Properties",
        slug: "emaar-properties",
        url: "https://www.emaar.com/en/our-communities",
        sourceType: "developer_brochure",
        reliabilityDefault: "A",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract project names, locations, unit types, starting prices in AED, design themes, amenities, handover dates. Emaar is Dubai's premier developer — ultra-luxury to premium tier. Look for community pages with project cards.",
        notes: "Dubai's largest developer. Projects: Downtown, Dubai Hills, Creek Harbour.",
        requestDelayMs: 3000,
    },
    {
        name: "DAMAC Properties",
        slug: "damac-properties",
        url: "https://www.damacproperties.com/en/properties",
        sourceType: "developer_brochure",
        reliabilityDefault: "A",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 2",
        extractionHints: "Extract project names, pricing in AED, design partnerships (Versace, Cavalli, etc.), finishing specifications, unit sizes. DAMAC focuses on luxury branded residences.",
        notes: "Luxury developer known for branded residences.",
        requestDelayMs: 3000,
    },
    {
        name: "Aldar Properties",
        slug: "aldar-properties",
        url: "https://www.aldar.com/en/explore/businesses/aldar-development/residential",
        sourceType: "developer_brochure",
        reliabilityDefault: "A",
        region: "Abu Dhabi",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 3",
        extractionHints: "Extract project names, locations in Abu Dhabi, unit types, prices in AED, design tier. Aldar is Abu Dhabi's premium developer — focus on Saadiyat Island, Yas Island, Reem Island projects.",
        notes: "Abu Dhabi's largest developer.",
        requestDelayMs: 3000,
    },
    {
        name: "Sobha Realty",
        slug: "sobha-realty",
        url: "https://www.sobharealty.com/projects/",
        sourceType: "developer_brochure",
        reliabilityDefault: "B",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 4",
        extractionHints: "Extract project names, finishing quality descriptions (Sobha is known for high-quality finishes), material specifications, prices per sqft. Focus on design quality and material mentions.",
        notes: "Known for superior construction quality and finishes.",
        requestDelayMs: 3000,
    },
    {
        name: "Ellington Properties",
        slug: "ellington-properties",
        url: "https://www.ellingtongroup.com/",
        sourceType: "developer_brochure",
        reliabilityDefault: "B",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 4",
        extractionHints: "Extract project names, design philosophy descriptions, material brands mentioned, interior design style keywords. Ellington is design-focused — extract any references to specific materials, finishes, or design partners.",
        notes: "Design-focused boutique developer.",
        requestDelayMs: 3000,
    },

    // ── Industry Reports & Trends ─────────────────────────────────
    {
        name: "CBRE UAE Research",
        slug: "cbre-uae-research",
        url: "https://www.cbre.ae/en/insights",
        sourceType: "industry_report",
        reliabilityDefault: "A",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract report titles, publication dates, key metrics (average rents, sales prices, vacancy rates, supply pipeline). Focus on residential and commercial real estate market data for UAE/Dubai/Abu Dhabi.",
        notes: "Tier-1 real estate research. Grade A source.",
        requestDelayMs: 2000,
    },
    {
        name: "Knight Frank UAE",
        slug: "knight-frank-uae",
        url: "https://www.knightfrank.ae/research",
        sourceType: "industry_report",
        reliabilityDefault: "A",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 2",
        extractionHints: "Extract research report summaries, market indicators (prime residential prices, transaction volumes), forecast data. Focus on Dubai and Abu Dhabi residential market insights.",
        notes: "Tier-1 property consultancy research.",
        requestDelayMs: 2000,
    },
    {
        name: "JLL MENA Research",
        slug: "jll-mena-research",
        url: "https://www.jll.ae/en/trends-and-insights",
        sourceType: "industry_report",
        reliabilityDefault: "A",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 2",
        extractionHints: "Extract market reports, property clock positions, rent/sales trends, construction costs. JLL publishes quarterly UAE property market overviews with concrete data points.",
        notes: "Top-tier real estate advisory.",
        requestDelayMs: 2000,
    },
    {
        name: "Commercial Interior Design Magazine",
        slug: "commercial-interior-design-mag",
        url: "https://www.commercialinteriordesign.com/",
        sourceType: "trade_publication",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 8 * * 1",
        extractionHints: "Extract article titles about UAE/Dubai interior design projects, trend mentions (biophilic, minimalist, japandi, etc.), material brand mentions, designer names, project descriptions. Focus on residential projects.",
        notes: "Leading Middle East interior design publication.",
        requestDelayMs: 2000,
    },
    {
        name: "Dezeen UAE/Dubai",
        slug: "dezeen-uae-dubai",
        url: "https://www.dezeen.com/tag/dubai/",
        sourceType: "trade_publication",
        reliabilityDefault: "C",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 9 * * 1",
        extractionHints: "Extract project names, architects/designers, design descriptions, material innovations mentioned. Focus on residential interior design trends relevant to Dubai market.",
        notes: "Global architecture/design publication, Dubai tag.",
        requestDelayMs: 2000,
    },
    {
        name: "ArchDaily UAE",
        slug: "archdaily-uae",
        url: "https://www.archdaily.com/tag/united-arab-emirates",
        sourceType: "trade_publication",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 9 * * 3",
        extractionHints: "Extract featured projects in UAE, design trends, material specifications mentioned, architectural styles. Focus on residential and hospitality interiors for trend detection.",
        notes: "Major architecture publication.",
        requestDelayMs: 2000,
    },

    // ── Live Property Listing Aggregators (V5) ───────────────────
    {
        name: "Bayut Property Listings",
        slug: "bayut-listings",
        url: "https://www.bayut.com/for-sale/property/dubai/",
        sourceType: "aggregator",
        reliabilityDefault: "B",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1,4",  // Monday + Thursday 6 AM
        extractionHints: "Extract property listings: project name, location/area, price in AED, property type (apartment/villa/townhouse), bedrooms, size in sqft, developer name. Compute price per sqft where possible. Focus on new/off-plan listings for market positioning data.",
        notes: "Largest UAE property portal (part of Dubizzle/EMPG group). JS-rendered — requires Firecrawl.",
        requestDelayMs: 3000,
    },
    {
        name: "PropertyFinder Listings",
        slug: "propertyfinder-listings",
        url: "https://www.propertyfinder.ae/en/buy/dubai/",
        sourceType: "aggregator",
        reliabilityDefault: "B",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 7 * * 2,5",  // Tuesday + Friday 7 AM
        extractionHints: "Extract property listings: project/building name, area, asking price in AED, property type, bedrooms, size sqft, agent/developer. Focus on listed prices for market intelligence and pricing trends.",
        notes: "Top UAE property search portal. JS-rendered — requires Firecrawl.",
        requestDelayMs: 3000,
    },

    // ── EV-00 (2026-07-23): registry rows for the static connectors that had
    // none, so the scheduled cron path can resolve health/freshness by slug ──
    {
        name: "Nakheel Properties",
        slug: "nakheel-properties",
        url: "https://www.nakheel.com/en/",
        sourceType: "developer_brochure",
        reliabilityDefault: "A",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract development/project names, finish descriptions, material brands, quality tier language from Nakheel project pages.",
        notes: "Major Dubai master developer. Static connector: nakheel-properties.",
        requestDelayMs: 2000,
    },
    {
        name: "RICS Market Reports",
        slug: "rics-market-reports",
        url: "https://www.rics.org/news-insights/research-and-insights/",
        sourceType: "industry_report",
        reliabilityDefault: "A",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract construction cost statistics, market survey findings, and UAE/MENA indices with periods.",
        notes: "Professional-body research. Static connector: rics-market-reports.",
        requestDelayMs: 2000,
    },
    {
        name: "Dubai Statistics Center",
        slug: "dubai-statistics-center",
        url: "https://www.dsc.gov.ae/en-us/Themes/Pages/default.aspx",
        sourceType: "government_tender",
        reliabilityDefault: "A",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract official Dubai construction and price statistics with reporting periods.",
        notes: "Official statistics portal. Static connector: dubai-statistics-center.",
        requestDelayMs: 2000,
    },
    {
        name: "Dubai Pulse — Material Prices",
        slug: "dubai-pulse-materials",
        url: "https://www.dubaipulse.gov.ae/data/dsc_average-construction-material-prices/dsc_average_construction_material_prices-open",
        sourceType: "government_tender",
        reliabilityDefault: "A",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract average construction material prices in AED with material names, units, and periods from the open dataset.",
        priceClass: "official_statistic",
        notes: "Official Dubai Pulse open dataset. Static connector: dubai-pulse-materials. EV-01b incident 2026-07-23: the domain is NOT retired — www.dubaipulse.gov.ae resolves (91.73.143.12) and serves TLS 1.2 with a DigiCert certificate for CN=dubaipulse.gov.ae, Government of Dubai, but the certificate has EXPIRED (openssl verify return code 10), which is why the robots gate reports ROBOTS_UNAVAILABLE. Do NOT repoint to data.dubai — neither data.dubai.gov.ae nor www.data.gov.ae resolves. Do NOT relax certificate verification. Deactivated pending the certificate being renewed; re-check quarterly.",
        requestDelayMs: 2000,
        isActive: false,
    },
    {
        name: "SCAD Abu Dhabi Publications",
        slug: "scad-abu-dhabi",
        url: "https://www.scad.gov.ae/en/pages/GeneralPublications.aspx",
        sourceType: "government_tender",
        reliabilityDefault: "A",
        region: "Abu Dhabi",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract building material price index publications and statistics with periods.",
        notes: "Statistics Centre Abu Dhabi publications page. Static connector: scad-abu-dhabi.",
        requestDelayMs: 2000,
    },
    {
        name: "SCAD Material Price PDFs",
        slug: "scad-pdf-materials",
        url: "https://www.scad.gov.ae/en/pages/GeneralPublications.aspx",
        sourceType: "government_tender",
        reliabilityDefault: "A",
        region: "Abu Dhabi",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract material price tables from SCAD construction cost PDFs (names, AED prices, units, indices, quarters).",
        notes: "PDF variant of the SCAD publications source (same URL, distinct connector). Static connector: scad-pdf-materials.",
        requestDelayMs: 2000,
    },
    {
        name: "DLD Transactions (Dubai Pulse)",
        slug: "dld-transactions",
        url: "https://www.dubaipulse.gov.ae/data/dld_transactions/dld_transactions-open",
        sourceType: "government_tender",
        reliabilityDefault: "A",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract Dubai Land Department transaction statistics with areas, values in AED, and periods from the open dataset.",
        priceClass: "official_statistic",
        notes: "Official DLD open dataset. Static connector: dld-transactions. EV-01b incident 2026-07-23: shares the expired dubaipulse.gov.ae TLS certificate documented on dubai-pulse-materials. Same disposition — deactivated pending certificate renewal, no domain repoint, no certificate-verification bypass.",
        requestDelayMs: 2000,
        isActive: false,
    },
    {
        name: "Savills ME Research",
        slug: "savills-me-research",
        url: "https://www.savills.me/insight-and-opinion/",
        sourceType: "industry_report",
        reliabilityDefault: "A",
        region: "UAE",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract UAE market research findings, cost benchmarks, and statistics with periods.",
        notes: "Consultancy research library. Static connector: savills-me-research.",
        requestDelayMs: 2000,
    },
    {
        name: "Property Monitor Dubai",
        slug: "property-monitor-dubai",
        url: "https://www.propertymonitor.ae/market-reports",
        sourceType: "industry_report",
        reliabilityDefault: "B",
        region: "Dubai",
        scrapeMethod: "html_llm",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract Dubai market report statistics, price indices, and transaction summaries with periods.",
        notes: "Market analytics reports. Static connector: property-monitor-dubai.",
        requestDelayMs: 2000,
    },

    // ── EV-01b: verified AED price sources ────────────────────────
    // Every row below was probed live on 2026-07-23 through MIYAR's own robots
    // gate and confirmed to publish real AED prices in server-side responses.
    // All are seeded INACTIVE with termsDecision "pending": a robots allow is a
    // technical signal, not a commercial licence, and BR-06 requires a recorded
    // human terms decision before any of them acquires anything.
    //
    // The retail rows are reliability C and priceClass "retail_listed" — these
    // are consumer shelf prices, not trade rates. The proposal generator will
    // not publish a benchmark keyed only on them.
    {
        name: "Tile King",
        slug: "tile-king",
        url: "https://www.tileking.ae/collections/floor-tiles",
        sourceType: "retailer_listing",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "json_api",
        platform: "shopify",
        termsDecision: "pending",
        priceClass: "retail_listed",
        scrapeSchedule: "0 0 7 * * 2",
        extractionHints: "Shopify products.json. Deterministic: variants[].price, variants[].sku, product_type, updated_at. No LLM.",
        notes: "Verified 2026-07-23: robots Allow: /; products.json returns priced variants with sku, product_type, published_at, updated_at. Open question before any of its data influences a benchmark — whether the listed price is per piece, per box, or per sqm. The deterministic basis parser returns `unknown` for titles that carry only dimensions, which is the honest answer and blocks benchmark keying until resolved.",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "The Hardware Stop",
        slug: "the-hardware-stop",
        url: "https://thehardwarestop.com/",
        sourceType: "retailer_listing",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "json_api",
        platform: "woocommerce",
        termsDecision: "pending",
        priceClass: "retail_listed",
        scrapeSchedule: "0 0 7 * * 2",
        extractionHints: "WooCommerce Store API. Deterministic: prices.price decoded with prices.currency_minor_unit, categories[], sku. Currency asserted AED. No LLM.",
        notes: "Verified 2026-07-23: /wp-json/wc/store/v1/products returns HTTP 200 JSON with x-wp-total 5234, AED prices in minor units with an explicit currency_minor_unit, and a 100+ category taxonomy (Paints 3546, Home Hardware 417, Fasteners/Fixings 358, Electrical & Lighting 168, Building & Construction Supplies 160, Plumbing & Sanitary 63, Sheets & Boards 41). robots.txt disallows only /wp-admin/, /cart/, /checkout/ for a generic agent; named blocks are AhrefsBot, SemrushBot, Bingbot, Baiduspider, PetalBot. Largest verified structured AED catalogue found, and the only one reaching hardware, fixings and boards.",
        requestDelayMs: 2000,
        isActive: false,
    },
    {
        name: "Homesmiths",
        slug: "homesmiths-ae",
        url: "https://www.homesmiths.ae/collections/all",
        sourceType: "retailer_listing",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "json_api",
        platform: "shopify",
        termsDecision: "pending",
        priceClass: "retail_listed",
        scrapeSchedule: "0 0 8 * * 2",
        extractionHints: "Shopify products.json. Deterministic: variants[].price, updated_at. Weak category signal — product_type is empty on this store, so most items map to the ffe/other buckets.",
        notes: "Verified 2026-07-23: products.json returns application/json with AED prices and updated_at. Homeware and FF&E rather than construction materials; lower value than the other two Shopify/Woo sources but genuine, dated AED observations.",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "Danube Home",
        slug: "danube-home-tiles",
        url: "https://www.danubehome.com/ae/en/c/tiles-and-bricks",
        sourceType: "retailer_listing",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "html_llm",
        termsDecision: "pending",
        priceClass: "retail_listed",
        scrapeSchedule: "0 0 8 * * 2",
        extractionHints: "Server-rendered category listing. Extract product names, AED prices, and units. Broadest category span of the verified sources: floors, walls, sanitary, FF&E.",
        notes: "Verified 2026-07-23: category page ALLOWED by the robots gate, 84 real AED prices across 12 units, server-rendered (no JS rendering proxy needed). Distinct from the legacy `danube-home` row, which points at the site root where no prices are listed. No structured endpoint was found, so this stays on the LLM path until one is.",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "Fepy",
        slug: "fepy-sanitary",
        url: "https://www.fepy.com/sanitary-ware-supplies",
        sourceType: "retailer_listing",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "html_llm",
        termsDecision: "pending",
        priceClass: "retail_listed",
        scrapeSchedule: "0 0 8 * * 3",
        extractionHints: "React server-side rendered listing; no JS execution required. Extract sanitaryware product names, AED prices, and units.",
        notes: "Verified 2026-07-23: ALLOWED by the robots gate, 41 real AED prices over roughly 567 catalogue items. Closes the sanitary category. Its WooCommerce Store API path returns 403, so this stays on the LLM path.",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "ACE UAE",
        slug: "ace-uae-paints",
        url: "https://www.aceuae.com/en/category/paints-supplies/paints",
        sourceType: "retailer_listing",
        reliabilityDefault: "C",
        region: "UAE",
        scrapeMethod: "html_llm",
        termsDecision: "pending",
        priceClass: "retail_listed",
        scrapeSchedule: "0 0 8 * * 3",
        extractionHints: "Extract paint and hardware product names, AED prices, and pack volumes. Volume in the title (e.g. 3.6L) resolves the per-litre basis deterministically.",
        notes: "Verified 2026-07-23: robots grants explicit Allow for /en/category/ and /en/products/; 20 real AED prices across 4 units on the paints category. Contributes walls (paint) and hardware. Distinct from the legacy `ace-hardware-uae` root row.",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "Stonehaven Cost Index",
        slug: "stonehaven-cost-index",
        url: "https://www.stonehaven.ae/cost-index",
        sourceType: "industry_report",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        termsDecision: "pending",
        priceClass: "consultancy_benchmark",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract weekly GCC construction cost index material prices in AED with units and the issue date. Also links the free UAE Construction Cost Benchmarking Report PDF.",
        notes: "Verified 2026-07-23: robots Allow: /; /cost-index returns HTTP 200; the free UAE_Benchmark_Report_2025.pdf returns HTTP 200 at 1,680,582 bytes. RICS-regulated cost management. This refutes the EV-01 packet's 'no free fit-out cost benchmark proved extractable' negative result — one exists and is reachable.",
        requestDelayMs: 3000,
        isActive: false,
    },
    {
        name: "Turner & Townsend UAE Market Intelligence",
        slug: "turner-townsend-uae-mi",
        url: "https://marketintelligence.turnerandtownsend.com/uaemi-2025/construction-cost-performance",
        sourceType: "industry_report",
        reliabilityDefault: "B",
        region: "UAE",
        scrapeMethod: "html_llm",
        termsDecision: "pending",
        priceClass: "consultancy_benchmark",
        scrapeSchedule: "0 0 6 * * 1",
        extractionHints: "Extract construction cost rates in AED per square metre by asset type, split by Dubai and Abu Dhabi, with the publication year.",
        notes: "Verified 2026-07-23: free HTML publishing AED/m2 by asset type for Dubai and Abu Dhabi (5-star hotel 10,500; high-rise residential 5,500; A-grade CBD office 6,200). Scope caveat that must survive into any use: these are total construction costs whose fit-out and MEP inclusions are not stated, so they are not a fit-out rate without a stated basis.",
        requestDelayMs: 3000,
        isActive: false,
    },
];

// ─── Seeder Function ────────────────────────────────────────────

export async function seedUAESources(): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    initializeDatabaseSafety("seed", { loadDotenv: true });
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let created = 0;
    let updated = 0;
    const skipped = 0;
    const errors: string[] = [];

    for (const source of UAE_SOURCES) {
        try {
            // ADR-0009/EV-00: upsert keyed on the stable slug. Legacy rows
            // (seeded before the slug column existed) are adopted by URL once
            // and receive their slug; re-runs then update in place instead of
            // duplicating or skipping stale data.
            const bySlug = await db
                .select({ id: sourceRegistry.id })
                .from(sourceRegistry)
                .where(eq(sourceRegistry.slug, source.slug))
                .limit(1);

            let targetId = bySlug[0]?.id;
            if (targetId === undefined) {
                const legacyByUrl = await db
                    .select({ id: sourceRegistry.id, slug: sourceRegistry.slug })
                    .from(sourceRegistry)
                    .where(eq(sourceRegistry.url, source.url))
                    .limit(1);
                if (legacyByUrl[0] && legacyByUrl[0].slug === null) {
                    targetId = legacyByUrl[0].id;
                }
            }

            const seedValues = {
                name: source.name,
                slug: source.slug,
                url: source.url,
                sourceType: source.sourceType,
                reliabilityDefault: source.reliabilityDefault,
                isWhitelisted: true,
                region: source.region,
                notes: source.notes,
                isActive: source.isActive ?? true,
                scrapeMethod: source.scrapeMethod,
                scrapeSchedule: source.scrapeSchedule,
                extractionHints: source.extractionHints,
                requestDelayMs: source.requestDelayMs,
                // EV-01b: acquisition configuration — safe to reconcile on every
                // run because it describes how a source is read, not whether it
                // may be read.
                platform: source.platform ?? null,
                priceClass: source.priceClass ?? "unknown",
            };

            if (targetId !== undefined) {
                // EV-01b: `termsDecision` is deliberately NOT in the update set.
                // It records a human's BR-06 decision, and a seeder re-run must
                // never revert an approval back to "pending" — that would either
                // silently disable a permitted source or, worse on a future edit,
                // silently re-enable one.
                await db.update(sourceRegistry)
                    .set(seedValues)
                    .where(eq(sourceRegistry.id, targetId));
                console.log(`[Seeder] 🔁 Updated source "${source.name}" (id=${targetId}, slug=${source.slug})`);
                updated++;
            } else {
                await db.insert(sourceRegistry).values({
                    ...seedValues,
                    // On first insert only. Seeds never write "approved".
                    termsDecision: source.termsDecision ?? "pending",
                    lastScrapedStatus: "never",
                    lastRecordCount: 0,
                    consecutiveFailures: 0,
                });
                console.log(`[Seeder] ✅ Created source: "${source.name}" (slug=${source.slug})`);
                created++;
            }
        } catch (err) {
            const msg = `Failed to seed "${source.name}": ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[Seeder] ❌ ${msg}`);
            errors.push(msg);
        }
    }

    console.log(`\n[Seeder] Done: ${created} created, ${updated} updated, ${errors.length} errors`);
    return { created, updated, skipped, errors };
}

// ─── Run if executed directly ───────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("uae-sources.ts")) {
    seedUAESources()
        .then(({ created, skipped, errors }) => {
            console.log(`\nSeeder complete: ${created} sources created, ${skipped} skipped`);
            if (errors.length) console.error("Errors:", errors);
            process.exit(errors.length > 0 ? 1 : 0);
        })
        .catch((err) => {
            console.error("Seeder failed:", err);
            process.exit(1);
        });
}
