import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as db from '../server/db';
import { getDb } from '../server/db';
import { sourceRegistry, competitorEntities, competitorProjects, evidenceRecords, materialsCatalog } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

const BACKUP_DIR = '/Users/amrosaleh/Downloads/miyar-v2-csv-backup';
const ADMIN_ID = 1;

// Simple CSV parser for quoted fields
function parseCsvLine(line: string) {
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/^"|"$/g, '').trim());
}

async function importSourceRegistry() {
    const csvPath = path.join(BACKUP_DIR, 'source_registry.csv');
    if (!fs.existsSync(csvPath)) return new Map<number, number>();

    console.log(`\n📂 Processing source_registry.csv...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    let importedCount = 0;
    let skippedCount = 0;
    const historicalToNewId = new Map<number, number>();
    const seenUrls = new Map<string, number>();

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length < 3) continue;

        const histId = parseInt(row[0]);
        const name = row[1];
        const url = row[2];
        const sourceType = row[3] as any;
        const reliabilityDefault = row[4] as any;
        const region = row[6];

        if (!url) continue;

        if (seenUrls.has(url)) {
            historicalToNewId.set(histId, seenUrls.get(url)!);
            skippedCount++;
            continue;
        }

        try {
            const ormDb = await getDb();
            const result = await ormDb.insert(sourceRegistry).values({
                name,
                url,
                sourceType,
                reliabilityDefault: reliabilityDefault || 'C',
                region: region || 'Global',
                isActive: true,
                addedBy: ADMIN_ID
            }).onDuplicateKeyUpdate({ set: { name } });

            // For PlanetScale/Vitess sometimes insertId is not returned on duplicate, 
            // but here we are primarily doing first-time recovery.
            const newId = (result as any)[0].insertId ? Number((result as any)[0].insertId) : 0;
            if (newId) {
                historicalToNewId.set(histId, newId);
                seenUrls.set(url, newId);
                importedCount++;
            }
        } catch (e) {
            console.error(`  ❌ Failed to import source: ${name}`, e);
        }
    }
    console.log(`  ✅ Imported: ${importedCount}, Skipped: ${skippedCount}`);
    return historicalToNewId;
}

async function importCompetitorEntities() {
    const csvPath = path.join(BACKUP_DIR, 'competitor_entities.csv');
    if (!fs.existsSync(csvPath)) return new Map<number, number>();

    console.log(`\n📂 Processing competitor_entities.csv...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    let importedCount = 0;
    let skippedCount = 0;
    const historicalToNewId = new Map<number, number>();
    const seenNames = new Map<string, number>();

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length < 2) continue;

        const histId = parseInt(row[0]);
        const name = row[1];
        const hq = row[2];
        const segmentValue = row[3];
        const website = row[4];

        if (seenNames.has(name)) {
            historicalToNewId.set(histId, seenNames.get(name)!);
            skippedCount++;
            continue;
        }

        try {
            const ormDb = await getDb();
            const result = await ormDb.insert(competitorEntities).values({
                name,
                headquarters: hq,
                segmentFocus: (segmentValue || 'mixed') as any,
                website,
                createdBy: ADMIN_ID
            });
            const newId = Number((result as any)[0].insertId);
            historicalToNewId.set(histId, newId);
            seenNames.set(name, newId);
            importedCount++;
        } catch (e) {
            console.error(`  ❌ Failed to import competitor: ${name}`, e);
        }
    }
    console.log(`  ✅ Imported: ${importedCount}, Skipped: ${skippedCount}`);
    return historicalToNewId;
}

async function importCompetitorProjects(competitorMap: Map<number, number>) {
    const csvPath = path.join(BACKUP_DIR, 'competitor_projects.csv');
    if (!fs.existsSync(csvPath)) return new Map<number, number>();

    console.log(`\n📂 Processing competitor_projects.csv...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    let importedCount = 0;
    let skippedCount = 0;
    const historicalToNewId = new Map<number, number>();

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length < 3) continue;

        const histId = parseInt(row[0]);
        const histCompId = parseInt(row[1]);
        const projectName = row[2];
        const location = row[3];
        const segment = row[4] as any;
        const assetType = row[5] as any;

        const newCompId = competitorMap.get(histCompId);
        if (!newCompId) {
            skippedCount++;
            continue;
        }

        try {
            const ormDb = await getDb();
            const result = await ormDb.insert(competitorProjects).values({
                competitorId: newCompId,
                projectName,
                location,
                segment,
                assetType,
                createdBy: ADMIN_ID
            });
            const newId = Number((result as any)[0].insertId);
            historicalToNewId.set(histId, newId);
            importedCount++;
        } catch (e) {
            console.error(`  ❌ Failed to import project: ${projectName}`, e);
        }
    }
    console.log(`  ✅ Imported: ${importedCount}, Skipped: ${skippedCount}`);
    return historicalToNewId;
}

async function importMaterialsCatalog() {
    const csvPath = path.join(BACKUP_DIR, 'materials_catalog.csv');
    if (!fs.existsSync(csvPath)) return;

    console.log(`\n📂 Processing materials_catalog.csv...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length < 3) continue;

        const name = row[1];
        const category = row[2] as any;
        const tier = row[3] as any;
        const typicalCostLow = row[4];
        const typicalCostHigh = row[5];
        const costUnit = row[6];
        const leadTimeDays = row[7] ? parseInt(row[7]) : null;
        const supplierName = row[10];

        try {
            const ormDb = await getDb();
            await ormDb.insert(materialsCatalog).values({
                name,
                category,
                tier,
                typicalCostLow,
                typicalCostHigh,
                costUnit,
                leadTimeDays,
                supplierName,
                isActive: true,
                createdBy: ADMIN_ID
            }).onDuplicateKeyUpdate({ set: { supplierName } });
            importedCount++;
        } catch (e) {
            console.error(`  ❌ Failed to import material: ${name}`, e);
        }
    }
    console.log(`  ✅ Imported: ${importedCount}`);
}

async function importEvidenceRecords(sourceMap: Map<number, number>, projectMap: Map<number, number>) {
    const csvPath = path.join(BACKUP_DIR, 'evidence_records.csv');
    if (!fs.existsSync(csvPath)) return;

    console.log(`\n📂 Processing evidence_records.csv...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    let importedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length < 10) continue;

        const recordId = row[1];
        const histProjId = parseInt(row[2]);
        const histSourceId = parseInt(row[3]);
        const category = row[4] as any;
        const itemName = row[5];
        const specClass = row[6];
        const priceTypical = row[8];
        const unit = row[10];
        const sourceUrl = row[15];
        const publisher = row[16];
        const reliabilityGrade = row[18] as any;
        const title = row[25];

        const newSourceId = sourceMap.get(histSourceId);
        const newProjId = projectMap.get(histProjId);

        try {
            const ormDb = await getDb();
            await ormDb.insert(evidenceRecords).values({
                recordId,
                category,
                itemName,
                specClass,
                priceTypical,
                unit,
                sourceUrl,
                publisher,
                reliabilityGrade: reliabilityGrade || 'C',
                title,
                evidencePhase: 'concept',
                createdBy: ADMIN_ID,
                createdAt: new Date()
            }).onDuplicateKeyUpdate({ set: { itemName } });
            importedCount++;
        } catch (e) {
            console.error(`  ❌ Failed to import evidence record: ${recordId}`, e);
        }
    }
    console.log(`  ✅ Imported: ${importedCount}, Skipped: ${skippedCount}`);
}

async function main() {
    process.stdout.write('🚀 Starting CSV Data Recovery...\n');

    // 1. Foundation: Sources & Competitors
    const sourceMap = await importSourceRegistry();
    const competitorMap = await importCompetitorEntities();

    // 2. Mid-level: Projects & Materials
    const projectMap = await importCompetitorProjects(competitorMap);
    await importMaterialsCatalog();

    // 3. Leaf: Evidence Records
    await importEvidenceRecords(sourceMap, projectMap);

    console.log('\n🏁 Full CSV Recovery Sweep complete.');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
