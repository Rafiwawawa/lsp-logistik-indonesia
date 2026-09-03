const fs = require('fs');
const path = require('path');
const { getDB, initDB } = require('./db');

/**
 * Migration runner for LSP Logistik Indonesia.
 * Reads migrations sequentially from database/migrations/
 * Tracks applied migrations in schema_migrations table.
 *
 * @param {import('better-sqlite3').Database} [targetDb] Optional DB instance
 * @returns {Array<{version: number, name: string, status: string}>}
 */
function runMigrations(targetDb) {
  const db = targetDb || getDB();
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  const results = [];

  for (const file of files) {
    const match = file.match(/^(\d+)[-_](.+)\.sql$/);
    if (!match) {
      console.warn(`[Migrate] Skipping invalid migration filename: ${file}`);
      continue;
    }

    const version = parseInt(match[1], 10);
    const name = match[2];

    if (appliedVersions.has(version)) {
      results.push({ version, name, file, status: 'already_applied' });
      continue;
    }

    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute migration in transaction
    const executeMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      `).run(version, file);
    });

    try {
      executeMigration();
      results.push({ version, name, file, status: 'applied' });
      console.log(`[Migrate] Applied: ${file}`);
    } catch (err) {
      console.error(`[Migrate] Failed to apply ${file}:`, err);
      throw err;
    }
  }

  return results;
}

// Allow direct execution via node database/migrate.js
if (require.main === module) {
  require('dotenv').config();
  try {
    initDB();
    const results = runMigrations();
    const applied = results.filter(r => r.status === 'applied');
    if (applied.length === 0) {
      console.log('✅ Migrations are already up to date.');
    } else {
      console.log(`✅ Successfully applied ${applied.length} migration(s).`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

module.exports = { runMigrations };
