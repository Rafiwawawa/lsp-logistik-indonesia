const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const session = require('express-session');
const createSqliteStore = require('better-sqlite3-session-store');

const SqliteStore = createSqliteStore(session);

let sessionDbInstance = null;
let sessionStoreInstance = null;
let currentSessionDbPath = null;

/**
 * Initializes and returns SQLite session database connection and store.
 * Applies WAL mode and pragmas.
 *
 * @param {string} [customPath] Optional custom database file path
 * @returns {{ sessionDb: import('better-sqlite3').Database, sessionStore: any }}
 */
function initSessionStore(customPath) {
  const dbPath = customPath || process.env.SESSION_DATABASE_PATH || path.join(__dirname, 'sessions.db');

  if (sessionDbInstance && currentSessionDbPath === dbPath) {
    return { sessionDb: sessionDbInstance, sessionStore: sessionStoreInstance };
  }

  if (sessionDbInstance) {
    closeSessionDB();
  }

  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  sessionDbInstance = new Database(dbPath);
  currentSessionDbPath = dbPath;

  sessionDbInstance.pragma('journal_mode = WAL');
  sessionDbInstance.pragma('busy_timeout = 5000');
  sessionDbInstance.pragma('synchronous = NORMAL');

  sessionStoreInstance = new SqliteStore({
    client: sessionDbInstance,
    expired: {
      clear: process.env.NODE_ENV !== 'test',
      intervalMs: 15 * 60 * 1000, // Clear expired sessions every 15 minutes in non-test mode
    },
  });

  return { sessionDb: sessionDbInstance, sessionStore: sessionStoreInstance };
}

/**
 * Gets active session database instance.
 */
function getSessionDB() {
  if (!sessionDbInstance) {
    initSessionStore();
  }
  return sessionDbInstance;
}

/**
 * Gets active express-session store.
 */
function getSessionStore() {
  if (!sessionStoreInstance) {
    initSessionStore();
  }
  return sessionStoreInstance;
}

/**
 * Clears/invalidates ALL sessions in sessions.db.
 * Used during password change, admin password reset CLI, or security reset.
 *
 * @param {import('better-sqlite3').Database} [targetDb]
 */
function clearAllSessions(targetDb) {
  const db = targetDb || getSessionDB();
  try {
    // SqliteStore uses 'sessions' table by default
    db.prepare('DELETE FROM sessions').run();
  } catch (err) {
    // If sessions table hasn't been created yet, ignore error
    if (!err.message.includes('no such table')) {
      console.error('[SessionStore] Error clearing sessions:', err.message);
    }
  }
}

/**
 * Closes the session database cleanly.
 */
function closeSessionDB() {
  if (sessionDbInstance) {
    try {
      sessionDbInstance.close();
    } catch (err) {
      console.error('[SessionStore] Error closing sessions DB:', err.message);
    }
    sessionDbInstance = null;
    sessionStoreInstance = null;
    currentSessionDbPath = null;
  }
}

module.exports = {
  initSessionStore,
  getSessionDB,
  getSessionStore,
  clearAllSessions,
  closeSessionDB,
};
