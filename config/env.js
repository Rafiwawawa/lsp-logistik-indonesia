const path = require('path');
const fs = require('fs');

/**
 * Validates environment variables at application startup.
 * Throws an error or exits if any required configuration is missing or insecure.
 * Ensures fail-fast behavior before server binds or initializes.
 *
 * @param {object} [customEnv] Optional env object for testing
 * @param {boolean} [isSetupCompleted] Optional indicator whether admin exists
 * @returns {object} validated config object
 */
function validateEnv(customEnv = process.env, isSetupCompleted = false) {
  const errors = [];

  const nodeEnv = customEnv.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV "${nodeEnv}". Must be development, test, or production.`);
  }

  const port = parseInt(customEnv.PORT || '4000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT "${customEnv.PORT}". Must be a valid TCP port (1-65535).`);
  }

  // SESSION_SECRET validation
  const sessionSecret = customEnv.SESSION_SECRET;
  if (!sessionSecret) {
    errors.push('SESSION_SECRET is required.');
  } else if (nodeEnv === 'production' && Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    errors.push('SESSION_SECRET must be at least 32 bytes long in production.');
  }

  const databasePath = customEnv.DATABASE_PATH || path.join(__dirname, '..', 'database', 'lsp.db');
  const sessionDatabasePath = customEnv.SESSION_DATABASE_PATH || path.join(__dirname, '..', 'database', 'sessions.db');
  const uploadDir = customEnv.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

  // SETUP_TOKEN validation
  // Required only when admin setup is not yet completed and not in test mode
  if (!isSetupCompleted && !customEnv.SETUP_TOKEN && nodeEnv === 'production') {
    errors.push('SETUP_TOKEN is required before initial admin setup is completed.');
  }

  if (errors.length > 0) {
    const errorMsg = `Environment Configuration Error:\n- ${errors.join('\n- ')}`;
    throw new Error(errorMsg);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    SESSION_SECRET: sessionSecret,
    DATABASE_PATH: databasePath,
    SESSION_DATABASE_PATH: sessionDatabasePath,
    UPLOAD_DIR: uploadDir,
    SETUP_TOKEN: customEnv.SETUP_TOKEN,
  };
}

module.exports = { validateEnv };
