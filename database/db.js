const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let dbInstance = null;
let currentDbPath = null;

/**
 * Configure and return a SQLite database instance using better-sqlite3.
 * Applies required SQLite pragmas according to implementation_plan.md:
 * - foreign_keys = ON
 * - journal_mode = WAL
 * - busy_timeout = 5000
 * - synchronous = NORMAL
 *
 * @param {string} [customPath] Optional custom database file path (e.g. for testing)
 * @returns {import('better-sqlite3').Database}
 */
function initDB(customPath) {
  const dbPath = customPath || process.env.DATABASE_PATH || path.join(__dirname, 'lsp.db');

  if (dbInstance && currentDbPath === dbPath) {
    return dbInstance;
  }

  if (dbInstance) {
    closeDB();
  }

  // Ensure directory exists if not memory database
  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(dbPath);
  currentDbPath = dbPath;

  // Apply pragmas as specified in architecture plan §5.1
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

/**
 * Get active database instance or initialize default.
 * @returns {import('better-sqlite3').Database}
 */
function getDB() {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

/**
 * Close active database connection safely.
 */
function closeDB() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (err) {
      console.error('Error closing database:', err.message);
    }
    dbInstance = null;
    currentDbPath = null;
  }
}

/**
 * Generates an ISO-8601 extended UTC timestamp string with milliseconds.
 * Format: YYYY-MM-DDTHH:mm:ss.sssZ (matching strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
 * @returns {string}
 */
function nowUTC() {
  return new Date().toISOString();
}

module.exports = {
  initDB,
  getDB,
  closeDB,
  nowUTC,
};
