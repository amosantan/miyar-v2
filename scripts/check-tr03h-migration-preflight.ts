import mysql from "mysql2/promise";
import process from "node:process";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const url = new URL(connectionString);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: process.env.DATABASE_SSL_DISABLED === "1" ? undefined : { rejectUnauthorized: true },
});

try {
  const [migration0044Rows] = await connection.query(`
    select
      (select count(*) from information_schema.tables
        where table_schema = database() and table_name = 'amenity_sub_spaces') as amenityTable,
      (select count(*) from information_schema.tables
        where table_schema = database() and table_name = 'space_program_rooms') as roomsTable,
      (select count(*) from information_schema.columns
        where table_schema = database()
          and table_name = 'report_instances'
          and column_name = 'reportType'
          and column_type like '%autonomous_design_brief%') as reportEnum
  `);
  const migration0044 = (migration0044Rows as Array<{
    amenityTable: number;
    roomsTable: number;
    reportEnum: number;
  }>)[0];
  if (
    Number(migration0044.amenityTable) !== 1 ||
    Number(migration0044.roomsTable) !== 1 ||
    Number(migration0044.reportEnum) !== 1
  ) {
    console.error(JSON.stringify({
      status: "NEEDS_HUMAN",
      reason: "migration_0044_absent_or_partial",
    }));
    await connection.end();
    process.exit(2);
  }

  const [membershipDuplicates] = await connection.query(`
    select orgId, userId, count(*) as duplicateCount
    from organization_members
    group by orgId, userId
    having count(*) > 1
  `);
  const [shareDuplicates] = await connection.query(`
    select share_token, count(*) as duplicateCount
    from ai_design_briefs
    where share_token is not null
    group by share_token
    having count(*) > 1
  `);

  const membershipCount = (membershipDuplicates as unknown[]).length;
  const shareCount = (shareDuplicates as unknown[]).length;
  if (membershipCount || shareCount) {
    console.error(JSON.stringify({
      status: "NEEDS_HUMAN",
      duplicateMembershipPairs: membershipCount,
      duplicateShareTokens: shareCount,
    }));
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify({
      status: "PASS",
      duplicateMembershipPairs: 0,
      duplicateShareTokens: 0,
      advisoryOnly: true,
      migrationUniqueIndexResultIsAuthoritative: true,
    }));
  }
} finally {
  await connection.end();
}
