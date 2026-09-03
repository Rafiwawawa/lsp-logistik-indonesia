const { getDB, initDB } = require('./db');

/**
 * Executes PRAGMA quick_check on the active SQLite database.
 * Returns true if integrity check passed ('ok'), throws or returns false otherwise.
 *
 * @param {import('better-sqlite3').Database} [targetDb] Optional DB instance
 * @returns {boolean}
 */
function quickCheck(targetDb) {
  const db = targetDb || getDB();
  const row = db.prepare('PRAGMA quick_check;').get();
  const result = row ? (row.quick_check || Object.values(row)[0]) : null;

  if (result === 'ok') {
    return true;
  }
  throw new Error(`Integrity check failed: ${JSON.stringify(row)}`);
}

if (require.main === module) {
  require('dotenv').config();
  try {
    initDB();
    quickCheck();
    console.log('✅ SQLite PRAGMA quick_check: ok');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database quick_check error:', err.message);
    process.exit(1);
  }
}

module.exports = { quickCheck };
