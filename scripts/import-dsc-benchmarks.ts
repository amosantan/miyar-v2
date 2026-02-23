import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as db from '../server/db';

async function main() {
    const csvPath = '/Users/amrosaleh/Downloads/db-backup/Dsc_Average_Construction_Material_Prices_2025-03-06_09-55-00.csv';

    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found at ${csvPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    const headers = lines[0].replace(/"/g, '').split(',');

    // Headers: materialsar,materialsen,quantityar,quantityen,quarterar,quarteren,yearar,yearen,average_pricesar,average_pricesen
    // Index: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9

    console.log(`📊 Processing DSC CSV (${lines.length} lines)...`);

    const targetYear = "2024";
    const targetQuarter = "Q3";
    const now = new Date();

    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parser for quoted fields
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches) continue;

        const row = matches.map(m => m.replace(/^"|"$/g, ''));

        const materialEn = row[1];
        const quarterEn = row[5];
        const yearEn = row[7];
        const priceEn = row[9];

        if (yearEn === targetYear && quarterEn === targetQuarter) {
            // Map category
            let category: "floors" | "walls" | "ceilings" | "joinery" | "lighting" | "sanitary" | "kitchen" | "hardware" | "ffe" | "other" = "other";
            let specClass = "Core Construction";
            let unit = "unit";

            if (materialEn.toLowerCase().includes('cement')) {
                category = "walls";
                specClass = "Cementitious";
                unit = "bag";
            } else if (materialEn.toLowerCase().includes('steel')) {
                category = "other";
                specClass = "Reinforcement";
                unit = "ton";
            } else if (materialEn.toLowerCase().includes('concrete')) {
                category = "other";
                specClass = "Concrete";
                unit = "cum";
            } else if (materialEn.toLowerCase().includes('hollow') || materialEn.toLowerCase().includes('solid')) {
                category = "walls";
                specClass = "Masonry";
                unit = "piece";
            } else if (materialEn.toLowerCase().includes('aggreates') || materialEn.toLowerCase().includes('sand')) {
                category = "other";
                specClass = "Aggregates";
                unit = "load";
            }

            const recordId = `MYR-DSC-2024-${importedCount.toString().padStart(4, '0')}`;

            try {
                await db.createEvidenceRecord({
                    recordId,
                    category,
                    itemName: materialEn,
                    specClass,
                    priceTypical: priceEn,
                    unit,
                    publisher: "Dubai Statistics Center",
                    captureDate: now,
                    reliabilityGrade: "A",
                    confidenceScore: 95,
                    sourceUrl: "https://www.dsc.gov.ae",
                    title: `DSC Average Construction Material Prices ${targetQuarter} ${targetYear}`,
                    evidencePhase: "construction",
                    createdBy: 1, // System
                });
                importedCount++;
                console.log(`  ✅ Imported: ${materialEn} (${priceEn} AED)`);
            } catch (e) {
                console.error(`  ❌ Failed to import ${materialEn}:`, e);
            }
        }
    }

    console.log(`\n✅ DSC Ingestion complete. Imported ${importedCount} official benchmarks for Q3 2024.`);
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
