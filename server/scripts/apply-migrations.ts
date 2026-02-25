import "dotenv/config";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

async function run() {
    const db = await getDb();
    const queries = [
        `CREATE TABLE IF NOT EXISTS \`design_trends\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`trendName\` varchar(255) NOT NULL,
        \`trendCategory\` enum('style','material','color','layout','technology','sustainability','other') NOT NULL,
        \`confidenceLevel\` enum('emerging','established','declining') NOT NULL DEFAULT 'emerging',
        \`sourceUrl\` text,
        \`sourceRegistryId\` int,
        \`description\` text,
        \`relatedMaterials\` json,
        \`styleClassification\` varchar(128),
        \`region\` varchar(64) DEFAULT 'UAE',
        \`firstSeenAt\` timestamp NOT NULL DEFAULT (now()),
        \`lastSeenAt\` timestamp NOT NULL DEFAULT (now()),
        \`mentionCount\` int NOT NULL DEFAULT 1,
        \`runId\` varchar(64),
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`design_trends_id\` PRIMARY KEY(\`id\`)
    );`,
        `ALTER TABLE \`generated_visuals\` MODIFY COLUMN \`type\` enum('mood','mood_board','material_board','room_render','kitchen_render','bathroom_render','color_palette','hero') NOT NULL;`,
        `ALTER TABLE \`projects\` MODIFY COLUMN \`ctx01Typology\` enum('Residential','Mixed-use','Hospitality','Office','Villa','Gated Community','Villa Development') DEFAULT 'Residential';`,
        `ALTER TABLE \`evidence_records\` ADD \`finishLevel\` enum('basic','standard','premium','luxury','ultra_luxury');`,
        `ALTER TABLE \`evidence_records\` ADD \`designStyle\` varchar(255);`,
        `ALTER TABLE \`evidence_records\` ADD \`brandsMentioned\` json;`,
        `ALTER TABLE \`evidence_records\` ADD \`materialSpec\` text;`,
        `ALTER TABLE \`evidence_records\` ADD \`intelligenceType\` enum('material_price','finish_specification','design_trend','market_statistic','competitor_positioning','regulation') DEFAULT 'material_price';`,
        `ALTER TABLE \`projects\` ADD \`unitMix\` json;`,
        `ALTER TABLE \`projects\` ADD \`villaSpaces\` json;`,
        `ALTER TABLE \`projects\` ADD \`developerGuidelines\` json;`,
        `ALTER TABLE \`project_insights\` MODIFY COLUMN \`insightType\` enum('cost_pressure','market_opportunity','competitor_alert','trend_signal','positioning_gap','style_shift','brand_dominance','spec_inflation') NOT NULL;`
    ];

    for (const query of queries) {
        try {
            console.log(`Executing: ${query.substring(0, 50).replace(/\n/g, ' ')}...`);
            await db.execute(sql.raw(query));
            console.log("Success.");
        } catch (err: any) {
            if (err.message.includes('Duplicate column name')) {
                console.log("Column already exists, skipping...");
            } else {
                console.error("Failed:", err.message);
            }
        }
    }
    process.exit(0);
}

run();
