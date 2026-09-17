require('dotenv').config();
const { validateEnv } = require('./config/env');
const { initDB, closeDB } = require('./database/db');
const { initSessionStore, closeSessionDB } = require('./database/sessionStore');
const { runMigrations } = require('./database/migrate');
const { createApp } = require('./app');
const path = require('path');

// 1. Startup Environment Validation (Fail-Fast)
try {
  validateEnv();
} catch (err) {
  console.error('❌ Startup validation failed:\n' + err.message);
  process.exit(1);
}

// 2. Initialize Database and Run Pending Migrations
let db;
let sessionStore;
try {
  db = initDB();
  console.log('✅ SQLite connected with WAL mode & foreign keys enabled.');
  const migrationResults = runMigrations(db);
  const appliedCount = migrationResults.filter(r => r.status === 'applied').length;
  if (appliedCount > 0) {
    console.log(`✅ Applied ${appliedCount} database migration(s).`);
  }

  const sessionInit = initSessionStore();
  sessionStore = sessionInit.sessionStore;
  console.log('✅ SQLite persistent session store initialized.');
} catch (err) {
  console.error('❌ Database initialization failed:', err.message);
  process.exit(1);
}

// 3. Create Express App
const app = createApp({ db, sessionStore });
const PORT = process.env.PORT || 4000;

// 4. Start Server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 LSP Logistik Server running at http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health\n`);
});

// Configure HTTP timeouts (Node 22+ compatible)
server.requestTimeout = 180000;
server.headersTimeout = 30000;
server.keepAliveTimeout = 5000;

// 5. Graceful Shutdown Handler
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  server.close((err) => {
    if (err) {
      console.error('Error closing HTTP server:', err.message);
      process.exit(1);
    }
    console.log('HTTP server closed.');

    try {
      closeSessionDB();
      console.log('Session database connection closed safely.');
      closeDB();
      console.log('Main database connection closed safely.');
      process.exit(0);
    } catch (dbErr) {
      console.error('Error closing database:', dbErr.message);
      process.exit(1);
    }
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { server, app };
