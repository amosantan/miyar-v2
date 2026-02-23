import mysql from 'mysql2/promise';

const NEW_SOURCES = [
    { name: "Danube Home", url: "https://danubehome.com/ae/en", type: "supplier_catalog", region: "UAE" },
    { name: "Milano by Danube", url: "https://milanobathrooms.com", type: "manufacturer_catalog", region: "UAE" },
    { name: "Sanipex Group", url: "https://sanipexgroup.com/ae", type: "supplier_catalog", region: "UAE" },
    { name: "Kludi UAE", url: "https://www.kludi.com", type: "manufacturer_catalog", region: "UAE" },
    { name: "Grohe Middle East", url: "https://www.grohe-middleeast.com", type: "manufacturer_catalog", region: "UAE" },
    { name: "Sika UAE", url: "https://are.sika.com", type: "manufacturer_catalog", region: "UAE" },
    { name: "Jotun Paints UAE", url: "https://www.jotun.com/me-en", type: "manufacturer_catalog", region: "UAE" },
    { name: "National Paints", url: "https://www.nationalpaints.com", type: "manufacturer_catalog", region: "UAE" },
    { name: "Caparol UAE", url: "https://www.caparolarabia.com", type: "manufacturer_catalog", region: "UAE" },
    { name: "ACE Hardware UAE", url: "https://www.aceuae.com", type: "retailer_listing", region: "UAE" },
    { name: "Speedex Tools", url: "https://speedextools.com", type: "retailer_listing", region: "UAE" },
    { name: "BuildMart", url: "https://buildmart.ae", type: "retailer_listing", region: "UAE" },
    { name: "Home Centre", url: "https://www.homecentre.com/ae/en/", type: "retailer_listing", region: "UAE" },
    { name: "Aldar Properties", url: "https://www.aldar.com", type: "developer_brochure", region: "Abu Dhabi" },
    { name: "Sobha Realty", url: "https://www.sobharealty.com", type: "developer_brochure", region: "Dubai" },
    { name: "Danube Properties", url: "https://danubeproperties.ae", type: "developer_brochure", region: "Dubai" },
    { name: "Meraas", url: "https://www.meraas.com", type: "developer_brochure", region: "Dubai" },
    { name: "Dubai Properties", url: "https://www.dp.ae", type: "developer_brochure", region: "Dubai" },
    { name: "Deyaar", url: "https://www.deyaar.ae", type: "developer_brochure", region: "Dubai" },
    { name: "Azizi Developments", url: "https://azizidevelopments.com", type: "developer_brochure", region: "Dubai" },
    { name: "MAG Property Development", url: "https://mag.ae", type: "developer_brochure", region: "Dubai" },
    { name: "Select Group", url: "https://select-group.ae", type: "developer_brochure", region: "Dubai" },
    { name: "Omniyat", url: "https://www.omniyat.com", type: "developer_brochure", region: "Dubai" },
    { name: "Tejari", url: "https://tejari.com", type: "procurement_portal", region: "UAE" },
    { name: "Dubai Trade", url: "https://www.dubaitrade.ae", type: "procurement_portal", region: "Dubai" },
    { name: "Abu Dhabi SME Hub", url: "https://www.adsmehub.ae", type: "procurement_portal", region: "Abu Dhabi" },
    { name: "ProTenders", url: "https://protenders.com", type: "industry_report", region: "UAE" },
    { name: "BNC Network", url: "https://www.bncnetwork.net", type: "industry_report", region: "UAE" },
    { name: "MEED Projects", url: "https://gulf.meed.com", type: "industry_report", region: "GCC" },
    { name: "CBRE UAE", url: "https://www.cbre.ae", type: "industry_report", region: "UAE" },
    { name: "Knight Frank Middle East", url: "https://www.knightfrank.ae", type: "industry_report", region: "UAE" },
    { name: "Savills Middle East", url: "https://www.savills.me", type: "industry_report", region: "UAE" },
    { name: "Dubai Municipality Tenders", url: "https://www.dm.gov.ae", type: "government_tender", region: "Dubai" },
    { name: "RTA Tenders", url: "https://www.rta.ae", type: "government_tender", region: "Dubai" },
    { name: "DEWA Tenders", url: "https://www.dewa.gov.ae", type: "government_tender", region: "Dubai" },
    { name: "PropertyFinder UAE", url: "https://www.propertyfinder.ae", type: "aggregator", region: "UAE" },
    { name: "Bayut", url: "https://www.bayut.com", type: "aggregator", region: "UAE" },
    { name: "Houza", url: "https://houza.com", type: "aggregator", region: "UAE" }
];

async function run() {
    const url = process.env.DATABASE_URL || '';
    const connection = await mysql.createConnection(url);

    try {
        const defaultSchedule = "0 6 * * 1"; // Monday 6am
        let inserted = 0;

        for (const src of NEW_SOURCES) {
            // Check if exists
            const [rows] = await connection.execute(
                'SELECT id FROM source_registry WHERE name = ? OR url = ? LIMIT 1',
                [src.name, src.url]
            );

            if (rows.length === 0) {
                await connection.execute(
                    `INSERT INTO source_registry 
            (name, url, sourceType, reliabilityDefault, isWhitelisted, region, scrapeMethod, scrapeSchedule, isActive, lastScrapedStatus, lastRecordCount, consecutiveFailures, requestDelayMs) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [src.name, src.url, src.type, 'B', 1, src.region, 'html_llm', defaultSchedule, 1, 'never', 0, 0, 2000]
                );
                inserted++;
                console.log(`Inserted ${src.name}`);
            } else {
                console.log(`Skipping ${src.name} - already exists`);
            }
        }

        console.log(`Successfully processed ${NEW_SOURCES.length} sources. Inserted ${inserted} new sources.`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

run();
