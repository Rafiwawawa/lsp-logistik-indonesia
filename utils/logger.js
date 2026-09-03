const { getDB, nowUTC } = require('../database/db');

// List of forbidden keys that must never be stored in activity logs or logged
const REDACTED_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'setup_token',
  'x-setup-token',
  'x-csrf-token',
  'cookie',
  'set-cookie',
  'session_secret',
  'csrfsecret',
]);

/**
 * Recursively sanitizes objects to redact any sensitive information before logging.
 *
 * @param {any} obj
 * @returns {any}
 */
function redactObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  const cleaned = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      cleaned[key] = redactObject(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/**
 * Records an activity log entry to the activity_logs table.
 *
 * @param {import('better-sqlite3').Database} [targetDb] Database instance
 * @param {object} params
 * @param {string} params.action Action identifier (e.g. LOGIN_SUCCESS, PASSWORD_CHANGED)
 * @param {string} [params.entityType] Entity category (e.g. admin)
 * @param {string} [params.entityId] Entity ID (e.g. admin id)
 * @param {object|string} [params.metadata] Additional metadata (will be JSON serialized & redacted)
 * @param {import('express').Request} [params.req] Optional Express request for IP address extraction
 */
function logActivity(targetDb, { action, entityType = null, entityId = null, metadata = null, req = null }) {
  try {
    const db = targetDb || getDB();
    let ip = null;

    if (req) {
      ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;
      if (typeof ip === 'string' && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
      }
    }

    let metaString = null;
    if (metadata) {
      const sanitized = typeof metadata === 'object' ? redactObject(metadata) : metadata;
      metaString = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    }

    const stmt = db.prepare(`
      INSERT INTO activity_logs (action, entity_type, entity_id, metadata, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `);

    stmt.run(action, entityType, entityId ? String(entityId) : null, metaString, ip);
  } catch (err) {
    console.error('[ActivityLog] Failed to record log:', err.message);
  }
}

module.exports = {
  logActivity,
  redactObject,
};
