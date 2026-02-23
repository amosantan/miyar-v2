import mysql from 'mysql2/promise';

async function run() {
    const url = process.env.DATABASE_URL || '';
    if (!url) {
        console.error("DATABASE_URL must be defined");
        process.exit(1);
    }
    const connection = await mysql.createConnection(url);

    try {
        console.log('Creating platform_alerts table...');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`platform_alerts\` (
                \`id\` int AUTO_INCREMENT NOT NULL,
                \`alertType\` enum('price_shock','project_at_risk','accuracy_degraded','pattern_warning','benchmark_drift','market_opportunity') NOT NULL,
                \`severity\` enum('critical','high','medium','info') NOT NULL,
                \`title\` varchar(255) NOT NULL,
                \`body\` text NOT NULL,
                \`affectedProjectIds\` json,
                \`affectedCategories\` json,
                \`triggerData\` json,
                \`suggestedAction\` text NOT NULL,
                \`status\` enum('active','acknowledged','resolved','expired') NOT NULL DEFAULT 'active',
                \`acknowledgedBy\` int,
                \`acknowledgedAt\` timestamp,
                \`expiresAt\` timestamp NOT NULL,
                \`createdAt\` timestamp NOT NULL DEFAULT (now()),
                CONSTRAINT \`platform_alerts_id\` PRIMARY KEY(\`id\`)
            );
        `);

        console.log('Table platform_alerts created successfully.');

    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

run();
