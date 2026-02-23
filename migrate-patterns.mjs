import mysql from 'mysql2/promise';

async function run() {
  const url = process.env.DATABASE_URL || '';
  const connection = await mysql.createConnection(url);

  try {
    console.log('Creating decision_patterns...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS decision_patterns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category ENUM('risk_indicator', 'success_driver', 'cost_anomaly') NOT NULL,
        conditions JSON NOT NULL,
        matchCount INT NOT NULL DEFAULT 0,
        reliabilityScore DECIMAL(5, 2) NOT NULL DEFAULT '0.00',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating project_pattern_matches...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS project_pattern_matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        projectId INT NOT NULL,
        patternId INT NOT NULL,
        matchedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        confidence DECIMAL(5, 2) NOT NULL DEFAULT '1.00',
        contextSnapshot JSON
      )
    `);

    console.log('Success!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await connection.end();
  }
}

run();
