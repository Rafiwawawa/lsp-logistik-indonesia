const os = require('os');
const fs = require('fs');
const path = require('path');
const { initDB, closeDB } = require('../../database/db');
const { initSessionStore, closeSessionDB } = require('../../database/sessionStore');
const { runMigrations } = require('../../database/migrate');
const { createApp } = require('../../app');

/**
 * Creates an isolated test environment in OS temporary directory.
 * Never uses project directory database or uploads.
 * Refuses destructive operations if NODE_ENV !== 'test'.
 */
function createTestEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-bytes-long-for-testing';
  process.env.SETUP_TOKEN = 'test-setup-token-secret-12345';

  const tempPrefix = path.join(os.tmpdir(), 'lsp-test-');
  const tempDir = fs.mkdtempSync(tempPrefix);

  const dbPath = path.join(tempDir, 'lsp.test.db');
  const sessionDbPath = path.join(tempDir, 'sessions.test.db');
  const uploadDir = path.join(tempDir, 'uploads');

  fs.mkdirSync(uploadDir, { recursive: true });

  process.env.DATABASE_PATH = dbPath;
  process.env.SESSION_DATABASE_PATH = sessionDbPath;
  process.env.UPLOAD_DIR = uploadDir;

  const db = initDB(dbPath);
  runMigrations(db);

  const { sessionDb, sessionStore } = initSessionStore(sessionDbPath);

  const app = createApp({ db, sessionStore });

  function cleanup() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Refusing to cleanup when NODE_ENV !== test');
    }
    closeSessionDB();
    closeDB();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore temp directory deletion errors on Windows if file handle release has a micro delay
    }
  }

  return {
    tempDir,
    dbPath,
    sessionDbPath,
    db,
    sessionDb,
    sessionStore,
    app,
    cleanup,
  };
}

module.exports = { createTestEnvironment };
