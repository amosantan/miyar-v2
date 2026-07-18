import mysql from "mysql2/promise";
import process from "node:process";
import { initializeDatabaseSafety } from "../server/_core/database-safety";

initializeDatabaseSafety("migrate", { loadDotenv: true });

const apply = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is required");

const url = new URL(connectionString);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl:
    process.env.DATABASE_SSL_DISABLED === "1"
      ? undefined
      : { rejectUnauthorized: true },
});

const seedPatternNames = [
  "High Complexity + Low Execution Readiness",
  "Excellent Delivery + Premium Materials",
  "Financial Friction + Poor Data Quality",
  "Rushed Delivery Risk",
  "Balanced Fundamentals Core",
];

try {
  const [evidenceRows] = await connection.query(`
    select count(*) as count
    from evidence_records
    where orgId is not null
      and corpusScope = 'legacy_unscoped'
  `);
  const [seedRows] = await connection.query(
    `
      select count(*) as count
      from decision_patterns
      where name in (${seedPatternNames.map(() => "?").join(", ")})
        and corpusScope = 'legacy_unscoped'
    `,
    seedPatternNames
  );

  const evidenceCount = Number(
    (evidenceRows as Array<{ count: number }>)[0]?.count ?? 0
  );
  const seedPatternCount = Number(
    (seedRows as Array<{ count: number }>)[0]?.count ?? 0
  );

  if (!apply) {
    console.log(
      JSON.stringify({
        status: "DRY_RUN",
        evidenceRowsToClassify: evidenceCount,
        seedPatternsToClassify: seedPatternCount,
        nullOwnedEvidencePromoted: 0,
        applyCommandRequiresExplicitFlag: "--apply",
      })
    );
  } else {
    await connection.beginTransaction();
    try {
      await connection.query(`
        update evidence_records
        set corpusScope = 'organization',
            corpusPolicyVersion = 'org-public-v1'
        where orgId is not null
          and corpusScope = 'legacy_unscoped'
      `);
      await connection.query(
        `
          update decision_patterns
          set corpusScope = 'platform_public',
              corpusPolicyVersion = 'seed-v1'
          where name in (${seedPatternNames.map(() => "?").join(", ")})
            and corpusScope = 'legacy_unscoped'
        `,
        seedPatternNames
      );
      await connection.commit();
      console.log(
        JSON.stringify({
          status: "PASS",
          evidenceRowsClassified: evidenceCount,
          seedPatternsClassified: seedPatternCount,
          nullOwnedEvidencePromoted: 0,
        })
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  await connection.end();
}
