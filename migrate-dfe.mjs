import mysql from 'mysql2/promise';

async function run() {
    const url = process.env.DATABASE_URL || '';
    const connection = await mysql.createConnection(url);

    try {
        console.log('Creating price_change_events...');
        await connection.execute(`
            CREATE TABLE \`price_change_events\` (
                \`id\` int AUTO_INCREMENT NOT NULL,
                \`itemName\` varchar(255) NOT NULL,
                \`category\` varchar(255) NOT NULL,
                \`sourceId\` int NOT NULL,
                \`previousPrice\` decimal(12,2) NOT NULL,
                \`newPrice\` decimal(12,2) NOT NULL,
                \`changePct\` decimal(10,6) NOT NULL,
                \`changeDirection\` enum('increased','decreased') NOT NULL,
                \`severity\` enum('significant','notable','minor','none') NOT NULL,
                \`detectedAt\` timestamp NOT NULL DEFAULT (now()),
                CONSTRAINT \`price_change_events_id\` PRIMARY KEY(\`id\`)
            );
        `);

        console.log('Altering source_registry config fields...');
        const queries = [
            "ALTER TABLE `source_registry` ADD `scrapeConfig` json;",
            "ALTER TABLE `source_registry` ADD `scrapeSchedule` varchar(64);",
            "ALTER TABLE `source_registry` ADD `scrapeMethod` enum('html_llm','html_rules','json_api','rss_feed','csv_upload','email_forward') DEFAULT 'html_llm' NOT NULL;",
            "ALTER TABLE `source_registry` ADD `scrapeHeaders` json;",
            "ALTER TABLE `source_registry` ADD `extractionHints` text;",
            "ALTER TABLE `source_registry` ADD `priceFieldMapping` json;",
            "ALTER TABLE `source_registry` ADD `lastScrapedAt` timestamp;",
            "ALTER TABLE `source_registry` ADD `lastScrapedStatus` enum('success','partial','failed','never') DEFAULT 'never' NOT NULL;",
            "ALTER TABLE `source_registry` ADD `lastRecordCount` int DEFAULT 0 NOT NULL;",
            "ALTER TABLE `source_registry` ADD `consecutiveFailures` int DEFAULT 0 NOT NULL;",
            "ALTER TABLE `source_registry` ADD `requestDelayMs` int DEFAULT 2000 NOT NULL;"
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await connection.execute(query);
        }

        console.log('Success!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

run();
