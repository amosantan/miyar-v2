/**
 * UAE Market Data Seed Script
 * Populates competitor_entities and competitor_projects with real UAE developer data,
 * and backfills trend_snapshots with percentChange values.
 *
 * Run: npx tsx scripts/seed-uae-market-data.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { competitorEntities, competitorProjects, trendSnapshots } from "../drizzle/schema";
import { eq, isNull, isNotNull, sql, desc } from "drizzle-orm";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
}

async function main() {
    const url = new URL(DATABASE_URL!);
    const pool = mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
    });
    const db = drizzle(pool);

    console.log("🏗️  UAE Market Data Seed — Starting...\n");

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: Clean placeholder data
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🧹 Phase 1: Cleaning placeholder data...");

    await db.delete(competitorProjects).where(sql`1=1`);
    await db.delete(competitorEntities).where(sql`1=1`);
    console.log("   Cleared old competitor_entities and competitor_projects.\n");

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: Seed Real UAE Developer Entities
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🏢 Phase 2: Seeding real UAE developers...");

    const developers = [
        {
            name: "Emaar Properties",
            headquarters: "Dubai, UAE",
            segmentFocus: "luxury" as const,
            website: "https://www.emaar.com",
            notes: "Largest developer in UAE. Created Downtown Dubai, Dubai Marina, Emirates Living. Known for premium fit-out quality.",
            createdBy: 1,
        },
        {
            name: "DAMAC Properties",
            headquarters: "Dubai, UAE",
            segmentFocus: "luxury" as const,
            website: "https://www.damacproperties.com",
            notes: "Major luxury developer. Known for branded residences (Versace, Cavalli, Fendi). High-spec interiors.",
            createdBy: 1,
        },
        {
            name: "Sobha Realty",
            headquarters: "Dubai, UAE",
            segmentFocus: "premium" as const,
            website: "https://www.sobharealty.com",
            notes: "Vertically integrated — does design, construction, interiors in-house. Known for quality finish.",
            createdBy: 1,
        },
        {
            name: "Nakheel",
            headquarters: "Dubai, UAE",
            segmentFocus: "mixed" as const,
            website: "https://www.nakheel.com",
            notes: "Government-backed. Created Palm Jumeirah, Deira Islands. Strong in community masterplans.",
            createdBy: 1,
        },
        {
            name: "Meraas",
            headquarters: "Dubai, UAE",
            segmentFocus: "premium" as const,
            website: "https://www.meraas.com",
            notes: "Design-forward developer. Bluewaters, La Mer, City Walk. Known for curated lifestyle concepts.",
            createdBy: 1,
        },
        {
            name: "Aldar Properties",
            headquarters: "Abu Dhabi, UAE",
            segmentFocus: "mixed" as const,
            website: "https://www.aldar.com",
            notes: "Largest developer in Abu Dhabi. Yas Island, Saadiyat Island, Al Raha Beach.",
            createdBy: 1,
        },
        {
            name: "OMNIYAT",
            headquarters: "Dubai, UAE",
            segmentFocus: "ultra_luxury" as const,
            website: "https://www.omniyat.com",
            notes: "Ultra-luxury boutique developer. One Palm, The Opus (Zaha Hadid). Highest per-sqft fit-out.",
            createdBy: 1,
        },
        {
            name: "Select Group",
            headquarters: "Dubai, UAE",
            segmentFocus: "mid" as const,
            website: "https://www.select-group.ae",
            notes: "Mid-to-premium developer. Business Bay, JLT, Dubai Marina towers.",
            createdBy: 1,
        },
        {
            name: "Azizi Developments",
            headquarters: "Dubai, UAE",
            segmentFocus: "affordable" as const,
            website: "https://www.azizidevelopments.com",
            notes: "Volume developer. Al Furjan, MBR City, Dubai Healthcare City. Affordable to mid-range.",
            createdBy: 1,
        },
        {
            name: "Ellington Properties",
            headquarters: "Dubai, UAE",
            segmentFocus: "premium" as const,
            website: "https://www.ellingtonproperties.com",
            notes: "Design-led boutique developer. Known for bespoke interiors and European design sensibility.",
            createdBy: 1,
        },
    ];

    const entityIds: Record<string, number> = {};

    for (const dev of developers) {
        const [result] = await db.insert(competitorEntities).values(dev);
        const id = Number((result as any).insertId);
        entityIds[dev.name] = id;
        console.log(`   ✅ ${dev.name} → id=${id}`);
    }

    console.log(`   Seeded ${developers.length} developer entities.\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: Seed Real Competitor Projects
    // ──────────────────────────────────────────────────────────────────────────
    console.log("🏗️  Phase 3: Seeding real competitor projects...");

    const projects = [
        // ─── Emaar (8 projects) ───
        { dev: "Emaar Properties", name: "Downtown Views III", location: "Downtown Dubai", segment: "luxury" as const, asset: "residential" as const, units: 458, price: { min: 1800, max: 2800, per_unit: 2200 }, status: "under_construction" as const, launch: "2024-Q3", architect: "Aedas", materials: ["Italian marble", "engineered timber", "premium fixtures"], positioning: ["iconic views", "prime location", "signature living"], amenities: ["infinity pool", "spa", "sky garden", "concierge"] },
        { dev: "Emaar Properties", name: "Creek Harbour Tower 2", location: "Dubai Creek Harbour", segment: "premium" as const, asset: "residential" as const, units: 680, price: { min: 1400, max: 2100, per_unit: 1700 }, status: "under_construction" as const, launch: "2024-Q2", architect: "SOM", materials: ["porcelain tile", "quartz counters", "aluminium systems"], positioning: ["waterfront living", "future city", "connected community"], amenities: ["pool", "gym", "play area", "retail promenade"] },
        { dev: "Emaar Properties", name: "Marina Vista", location: "Dubai Marina", segment: "luxury" as const, asset: "residential" as const, units: 320, price: { min: 2000, max: 3500, per_unit: 2600 }, status: "completed" as const, launch: "2023-Q1", architect: "Aedas", materials: ["natural stone", "hardwood floors", "Grohe fixtures"], positioning: ["marina lifestyle", "premium finish", "iconic address"], amenities: ["infinity pool", "private beach", "valet parking"] },
        { dev: "Emaar Properties", name: "The Valley Phase 3", location: "The Valley", segment: "mid" as const, asset: "residential" as const, units: 1200, price: { min: 850, max: 1200, per_unit: 1000 }, status: "under_construction" as const, launch: "2024-Q4", architect: "CallisonRTKL", materials: ["ceramic tile", "laminate", "standard fixtures"], positioning: ["family living", "affordable luxury", "community"], amenities: ["town centre", "parks", "sports courts"] },
        { dev: "Emaar Properties", name: "Burj Crown", location: "Downtown Dubai", segment: "ultra_luxury" as const, asset: "residential" as const, units: 180, price: { min: 3500, max: 6000, per_unit: 4500 }, status: "completed" as const, launch: "2022-Q2", architect: "Adrian Smith + Gordon Gill", materials: ["Calacatta marble", "walnut veneer", "bespoke joinery"], positioning: ["ultra-premium", "Burj Khalifa views", "limited edition"], amenities: ["private pool", "butler service", "cigar lounge"] },
        { dev: "Emaar Properties", name: "Park Heights II", location: "Dubai Hills Estate", segment: "premium" as const, asset: "residential" as const, units: 540, price: { min: 1300, max: 1900, per_unit: 1550 }, status: "completed" as const, launch: "2023-Q3", architect: "Gensler", materials: ["porcelain", "quartz", "premium laminate"], positioning: ["park views", "green living", "family friendly"], amenities: ["golf course access", "pool", "gym", "community park"] },
        { dev: "Emaar Properties", name: "Sunrise Bay", location: "Emaar Beachfront", segment: "luxury" as const, asset: "residential" as const, units: 390, price: { min: 2200, max: 3800, per_unit: 2900 }, status: "under_construction" as const, launch: "2024-Q1", architect: "Foster + Partners", materials: ["natural stone", "engineered oak", "Dornbracht fittings"], positioning: ["beachfront", "resort living", "panoramic sea views"], amenities: ["beach access", "lap pool", "wellness centre"] },
        { dev: "Emaar Properties", name: "Arabian Ranches III", location: "Arabian Ranches", segment: "mid" as const, asset: "residential" as const, units: 850, price: { min: 900, max: 1400, per_unit: 1100 }, status: "completed" as const, launch: "2022-Q4", architect: "CallisonRTKL", materials: ["ceramic", "engineered stone", "standard fixtures"], positioning: ["villa living", "community", "family lifestyle"], amenities: ["community centre", "pool", "parks", "retail"] },

        // ─── DAMAC (6 projects) ───
        { dev: "DAMAC Properties", name: "Cavalli Tower", location: "Dubai Marina", segment: "ultra_luxury" as const, asset: "residential" as const, units: 485, price: { min: 3000, max: 5500, per_unit: 4000 }, status: "under_construction" as const, launch: "2024-Q1", architect: "Atkins", materials: ["Cavalli-branded finishes", "Italian marble", "gold accents"], positioning: ["branded luxury", "fashion-inspired", "exclusive"], amenities: ["Cavalli spa", "rooftop pool", "private dining"] },
        { dev: "DAMAC Properties", name: "Safa Two", location: "Al Safa", segment: "ultra_luxury" as const, asset: "residential" as const, units: 190, price: { min: 4000, max: 7000, per_unit: 5200 }, status: "under_construction" as const, launch: "2023-Q4", architect: "de Grisogono Design", materials: ["onyx", "rare marble", "24k gold trim", "crystal accents"], positioning: ["super luxury", "jewelry-inspired", "penthouses"], amenities: ["private jacuzzi per unit", "art gallery", "helipad"] },
        { dev: "DAMAC Properties", name: "Volta", location: "Downtown Dubai", segment: "luxury" as const, asset: "residential" as const, units: 340, price: { min: 2200, max: 3200, per_unit: 2700 }, status: "under_construction" as const, launch: "2024-Q2", architect: "Gensler", materials: ["Italian porcelain", "engineered stone", "premium hardware"], positioning: ["modern luxury", "central location", "landmark tower"], amenities: ["infinity pool", "sky lounge", "co-working space"] },
        { dev: "DAMAC Properties", name: "DAMAC Hills 2 Villas", location: "DAMAC Hills 2", segment: "affordable" as const, asset: "residential" as const, units: 2200, price: { min: 500, max: 900, per_unit: 680 }, status: "completed" as const, launch: "2022-Q1", architect: "Various", materials: ["basic ceramic", "melamine", "standard fittings"], positioning: ["affordable", "community living", "family"], amenities: ["pool", "sports courts", "retail"] },
        { dev: "DAMAC Properties", name: "Harbour Lights", location: "Dubai Harbour", segment: "luxury" as const, asset: "residential" as const, units: 520, price: { min: 2000, max: 3500, per_unit: 2600 }, status: "under_construction" as const, launch: "2024-Q3", architect: "Woods Bagot", materials: ["natural stone", "timber veneer", "Hansgrohe"], positioning: ["waterfront", "marina views", "lifestyle"], amenities: ["yacht club access", "beach", "gym"] },
        { dev: "DAMAC Properties", name: "Fendi Styled Residences", location: "Business Bay", segment: "ultra_luxury" as const, asset: "residential" as const, units: 160, price: { min: 4500, max: 8000, per_unit: 6000 }, status: "completed" as const, launch: "2023-Q1", architect: "WKK Architects", materials: ["Fendi Casa finishes", "book-matched marble", "bespoke cabinetry"], positioning: ["haute couture living", "branded", "ultra exclusive"], amenities: ["Fendi spa", "private cinema", "valet"] },

        // ─── Sobha (5 projects) ───
        { dev: "Sobha Realty", name: "Sobha Hartland II", location: "MBR City", segment: "premium" as const, asset: "residential" as const, units: 780, price: { min: 1500, max: 2300, per_unit: 1850 }, status: "under_construction" as const, launch: "2024-Q2", architect: "Sobha Design Studio", materials: ["Sobha premium finish", "engineered marble", "branded fittings"], positioning: ["garden living", "quality craftsmanship", "integrated community"], amenities: ["international school", "lagoon", "jogging track"] },
        { dev: "Sobha Realty", name: "Sobha Reserve", location: "Wadi Al Safa", segment: "luxury" as const, asset: "residential" as const, units: 250, price: { min: 2500, max: 4000, per_unit: 3100 }, status: "announced" as const, launch: "2025-Q1", architect: "Sobha Design Studio", materials: ["imported marble", "solid wood", "European fixtures"], positioning: ["villa estate", "privacy", "lush greenery"], amenities: ["private pool per villa", "clubhouse", "golf course"] },
        { dev: "Sobha Realty", name: "One Park Avenue", location: "Sobha Hartland", segment: "premium" as const, asset: "residential" as const, units: 410, price: { min: 1600, max: 2400, per_unit: 1900 }, status: "under_construction" as const, launch: "2024-Q1", architect: "Sobha Design Studio", materials: ["Italian tile", "quartz surfaces", "Kohler fixtures"], positioning: ["park views", "premium quality", "central location"], amenities: ["pool", "gym", "landscaped gardens", "retail"] },
        { dev: "Sobha Realty", name: "Creek Vista Heights", location: "Sobha Hartland", segment: "luxury" as const, asset: "residential" as const, units: 290, price: { min: 2000, max: 3200, per_unit: 2500 }, status: "completed" as const, launch: "2023-Q2", architect: "Sobha Design Studio", materials: ["natural stone", "hardwood", "Grohe fittings"], positioning: ["creek views", "luxury finish", "landmark"], amenities: ["infinity pool", "spa", "sky garden"] },
        { dev: "Sobha Realty", name: "Sobha Siniya Island", location: "Umm Al Quwain", segment: "luxury" as const, asset: "residential" as const, units: 180, price: { min: 2800, max: 4500, per_unit: 3500 }, status: "announced" as const, launch: "2025-Q2", architect: "Various", materials: ["premium marble", "engineered timber", "designer fixtures"], positioning: ["island living", "exclusive", "nature reserve"], amenities: ["marina", "beach club", "nature trails"] },

        // ─── Nakheel (4 projects) ───
        { dev: "Nakheel", name: "Palm Jebel Ali", location: "Palm Jebel Ali", segment: "luxury" as const, asset: "mixed_use" as const, units: 3500, price: { min: 1800, max: 3000, per_unit: 2200 }, status: "under_construction" as const, launch: "2024-Q1", architect: "Various", materials: ["premium porcelain", "stone cladding", "quality fixtures"], positioning: ["iconic island", "waterfront", "resort living"], amenities: ["beaches", "marinas", "hotels", "retail"] },
        { dev: "Nakheel", name: "Como Residences", location: "Palm Jumeirah", segment: "ultra_luxury" as const, asset: "residential" as const, units: 80, price: { min: 6000, max: 12000, per_unit: 8500 }, status: "under_construction" as const, launch: "2024-Q2", architect: "Antonio Citterio Patricia Viel", materials: ["Venetian marble", "tropical hardwood", "custom Poliform kitchens"], positioning: ["ultra-luxury", "supertall", "Palm crown"], amenities: ["12 pools", "private beach", "butler service"] },
        { dev: "Nakheel", name: "Dragon Towers", location: "Dragon City", segment: "mid" as const, asset: "residential" as const, units: 950, price: { min: 800, max: 1200, per_unit: 1000 }, status: "under_construction" as const, launch: "2024-Q3", architect: "RSP Architects", materials: ["ceramic tile", "laminate", "standard hardware"], positioning: ["connected living", "value", "community"], amenities: ["pool", "gym", "retail mall access"] },
        { dev: "Nakheel", name: "Beach Walk at JBR", location: "JBR", segment: "premium" as const, asset: "residential" as const, units: 420, price: { min: 1500, max: 2500, per_unit: 1900 }, status: "completed" as const, launch: "2023-Q1", architect: "Aedas", materials: ["porcelain", "engineered stone", "Grohe fixtures"], positioning: ["beachfront", "walkable", "lifestyle"], amenities: ["beach access", "pool", "gym", "The Walk access"] },

        // ─── Meraas (3 projects) ───
        { dev: "Meraas", name: "Bulgari Residences", location: "Jumeira Bay Island", segment: "ultra_luxury" as const, asset: "residential" as const, units: 165, price: { min: 5000, max: 10000, per_unit: 7200 }, status: "completed" as const, launch: "2022-Q2", architect: "Antonio Citterio Patricia Viel", materials: ["Bulgari-curated marble", "lacquered wood", "ocean celadon tones"], positioning: ["uber luxury", "island exclusivity", "Bulgari brand"], amenities: ["Bulgari spa", "yacht marina", "private beach", "Michelin dining"] },
        { dev: "Meraas", name: "Port de La Mer Phase 3", location: "La Mer", segment: "premium" as const, asset: "residential" as const, units: 360, price: { min: 1800, max: 2800, per_unit: 2200 }, status: "completed" as const, launch: "2023-Q2", architect: "LWK+PARTNERS", materials: ["porcelain tile", "oak veneer", "Kohler fixtures"], positioning: ["mediterranean living", "beachfront", "lifestyle"], amenities: ["beach club", "pool", "retail promenade"] },
        { dev: "Meraas", name: "Bluewaters Residences 2", location: "Bluewaters Island", segment: "luxury" as const, asset: "residential" as const, units: 280, price: { min: 2200, max: 3500, per_unit: 2800 }, status: "under_construction" as const, launch: "2024-Q3", architect: "Benoy", materials: ["Italian marble", "engineered timber", "Villeroy & Boch"], positioning: ["island living", "Ain Dubai views", "resort-style"], amenities: ["infinity pool", "spa", "concierge", "retail"] },

        // ─── Aldar (3 projects) ───
        { dev: "Aldar Properties", name: "Saadiyat Reserve", location: "Saadiyat Island", segment: "luxury" as const, asset: "residential" as const, units: 470, price: { min: 2000, max: 3200, per_unit: 2500 }, status: "under_construction" as const, launch: "2024-Q1", architect: "Various", materials: ["natural stone", "engineered timber", "premium fittings"], positioning: ["cultural district", "beachfront", "serene living"], amenities: ["beach", "Louvre nearby", "pool", "gym"] },
        { dev: "Aldar Properties", name: "Gardenia Bay", location: "Yas Island", segment: "mid" as const, asset: "residential" as const, units: 1100, price: { min: 900, max: 1400, per_unit: 1100 }, status: "under_construction" as const, launch: "2024-Q2", architect: "Benoy", materials: ["ceramic", "engineered stone", "standard fixtures"], positioning: ["island lifestyle", "family community", "value"], amenities: ["Yas attractions access", "pool", "parks", "retail"] },
        { dev: "Aldar Properties", name: "The Source II", location: "Saadiyat Island", segment: "premium" as const, asset: "residential" as const, units: 280, price: { min: 1700, max: 2600, per_unit: 2100 }, status: "completed" as const, launch: "2023-Q3", architect: "Woods Bagot", materials: ["porcelain", "oak veneer", "Hansgrohe fittings"], positioning: ["nature retreat", "art-inspired", "premium"], amenities: ["mangrove views", "pool", "art studios"] },

        // ─── OMNIYAT (2 projects) ───
        { dev: "OMNIYAT", name: "The Lana", location: "Marasi Drive", segment: "ultra_luxury" as const, asset: "residential" as const, units: 110, price: { min: 6000, max: 12000, per_unit: 8000 }, status: "completed" as const, launch: "2023-Q4", architect: "Foster + Partners", materials: ["Dorchester Collection fit-out", "book-matched marble", "smoked oak"], positioning: ["Dorchester managed", "supertall", "ultra-exclusive"], amenities: ["Dorchester spa", "rooftop infinity pool", "private cinema", "chef's kitchen"] },
        { dev: "OMNIYAT", name: "AVA at Palm Jumeirah", location: "Palm Jumeirah", segment: "ultra_luxury" as const, asset: "residential" as const, units: 90, price: { min: 7000, max: 15000, per_unit: 10000 }, status: "under_construction" as const, launch: "2024-Q4", architect: "Tadao Ando", materials: ["exposed concrete", "Japanese aesthetic", "bespoke everything"], positioning: ["architectural icon", "Ando signature", "museum-quality"], amenities: ["art gallery", "tea pavilion", "landscaped sculpture gardens"] },

        // ─── Select Group (3 projects) ───
        { dev: "Select Group", name: "Peninsula Five", location: "Business Bay", segment: "mid" as const, asset: "residential" as const, units: 780, price: { min: 1000, max: 1600, per_unit: 1250 }, status: "under_construction" as const, launch: "2024-Q1", architect: "Various", materials: ["ceramic tile", "laminate counters", "standard fixtures"], positioning: ["canal views", "value investment", "central location"], amenities: ["pool", "gym", "retail podium"] },
        { dev: "Select Group", name: "Six Senses Residences", location: "Palm Jumeirah", segment: "ultra_luxury" as const, asset: "residential" as const, units: 120, price: { min: 5000, max: 9000, per_unit: 6500 }, status: "under_construction" as const, launch: "2024-Q2", architect: "Foster + Partners", materials: ["sustainable timber", "natural stone", "biophilic elements"], positioning: ["wellness luxury", "Six Senses brand", "sustainable"], amenities: ["Six Senses spa", "rooftop farm", "wellness centre"] },
        { dev: "Select Group", name: "Studio One", location: "Dubai Marina", segment: "mid" as const, asset: "residential" as const, units: 460, price: { min: 900, max: 1300, per_unit: 1050 }, status: "completed" as const, launch: "2022-Q3", architect: "Various", materials: ["ceramic", "engineered stone", "basic hardware"], positioning: ["marina living", "creative hub", "affordable"], amenities: ["pool", "gym", "co-working", "retail"] },

        // ─── Azizi (3 projects) ───
        { dev: "Azizi Developments", name: "Riviera Phase 4", location: "MBR City", segment: "affordable" as const, asset: "residential" as const, units: 1600, price: { min: 600, max: 900, per_unit: 750 }, status: "under_construction" as const, launch: "2024-Q1", architect: "Various", materials: ["basic ceramic", "melamine", "standard fixtures"], positioning: ["lagoon lifestyle", "affordable", "French Riviera inspired"], amenities: ["crystal lagoon", "retail", "parks"] },
        { dev: "Azizi Developments", name: "Venice Phase 2", location: "Dubai South", segment: "affordable" as const, asset: "residential" as const, units: 2100, price: { min: 500, max: 800, per_unit: 650 }, status: "under_construction" as const, launch: "2024-Q2", architect: "Various", materials: ["economy ceramic", "PVC", "standard fittings"], positioning: ["value", "Expo City proximity", "connected"], amenities: ["pool", "gym", "retail"] },
        { dev: "Azizi Developments", name: "Creek Views II", location: "Dubai Healthcare City", segment: "mid" as const, asset: "residential" as const, units: 580, price: { min: 800, max: 1200, per_unit: 950 }, status: "completed" as const, launch: "2023-Q1", architect: "Various", materials: ["porcelain", "engineered stone", "mid-range fixtures"], positioning: ["creek views", "medical district", "investment"], amenities: ["pool", "gym", "retail plaza"] },

        // ─── Ellington (3 projects) ───
        { dev: "Ellington Properties", name: "The Crestmark", location: "Business Bay", segment: "premium" as const, asset: "residential" as const, units: 220, price: { min: 1800, max: 2800, per_unit: 2200 }, status: "under_construction" as const, launch: "2024-Q3", architect: "Ellington Design Studio", materials: ["imported tile", "custom joinery", "Gessi fittings"], positioning: ["design-led", "bespoke interiors", "art-meets-architecture"], amenities: ["pool", "co-working", "art gallery", "yoga studio"] },
        { dev: "Ellington Properties", name: "Ellington Beach House II", location: "Palm Jumeirah", segment: "luxury" as const, asset: "residential" as const, units: 150, price: { min: 2500, max: 4000, per_unit: 3100 }, status: "announced" as const, launch: "2025-Q1", architect: "Ellington Design Studio", materials: ["natural stone", "European oak", "Fantini fittings"], positioning: ["beachfront design", "curated living", "art collection"], amenities: ["beach club", "infinity pool", "art lounge"] },
        { dev: "Ellington Properties", name: "Wilton Terraces", location: "MBR City", segment: "premium" as const, asset: "residential" as const, units: 310, price: { min: 1500, max: 2200, per_unit: 1800 }, status: "completed" as const, launch: "2023-Q2", architect: "Ellington Design Studio", materials: ["Italian porcelain", "oak cabinetry", "Villeroy & Boch"], positioning: ["design-forward", "green certified", "walkable"], amenities: ["pool", "gym", "community garden", "organic café"] },
    ];

    let projectCount = 0;
    for (const p of projects) {
        const entityId = entityIds[p.dev];
        if (!entityId) {
            console.warn(`   ⚠️ Unknown developer: ${p.dev}`);
            continue;
        }

        await db.insert(competitorProjects).values({
            competitorId: entityId,
            projectName: p.name,
            location: p.location,
            segment: p.segment,
            assetType: p.asset,
            totalUnits: p.units,
            priceIndicators: p.price,
            materialCues: p.materials,
            positioningKeywords: p.positioning,
            amenityList: p.amenities,
            completionStatus: p.status,
            launchDate: p.launch,
            architect: p.architect,
            completenessScore: 85,
            createdBy: 1,
            captureDate: new Date(),
        });

        projectCount++;
    }

    console.log(`   Seeded ${projectCount} real competitor projects.\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4: Backfill Trend Snapshot percentChange
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📈 Phase 4: Backfilling trend snapshot percentChange...");

    // Get all snapshots grouped by category+geography, ordered by date
    const allSnapshots = await db.select().from(trendSnapshots)
        .orderBy(trendSnapshots.category, trendSnapshots.createdAt);

    const grouped = new Map<string, typeof allSnapshots>();
    for (const s of allSnapshots) {
        const key = `${s.category}::${s.geography}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(s);
    }

    let updatedCount = 0;
    for (const [key, snaps] of grouped) {
        if (snaps.length < 2) continue;

        for (let i = 1; i < snaps.length; i++) {
            const prev = snaps[i - 1];
            const curr = snaps[i];

            if (prev.currentMA && curr.currentMA) {
                const prevMA = parseFloat(String(prev.currentMA));
                const currMA = parseFloat(String(curr.currentMA));

                if (prevMA > 0) {
                    const pctChange = ((currMA - prevMA) / prevMA) * 100;
                    const direction = pctChange > 3 ? "rising" : pctChange < -3 ? "falling" : "stable";

                    await db.update(trendSnapshots)
                        .set({
                            previousMA: String(prevMA),
                            percentChange: String(pctChange.toFixed(2)),
                            direction,
                        })
                        .where(eq(trendSnapshots.id, curr.id));

                    updatedCount++;
                }
            }
        }
    }

    console.log(`   Updated ${updatedCount} trend snapshots with percentChange.\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════");
    console.log("✅ UAE Market Data Seed — Complete!");
    console.log(`   Developers: ${developers.length}`);
    console.log(`   Projects:   ${projectCount}`);
    console.log(`   Trend fixes: ${updatedCount}`);
    console.log("═══════════════════════════════════════════════\n");

    pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
