const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Compares two tokens in constant-time using SHA-256 digests.
 * Safe against arbitrary length inputs, null, and undefined without throwing errors or HTTP 500.
 *
 * @param {string} a Input token
 * @param {string} b Expected token
 * @returns {boolean}
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) {
    return false;
  }
  const h1 = crypto.createHash('sha256').update(a).digest();
  const h2 = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(h1, h2);
}

/**
 * Generates a cryptographically secure random token (64 hex characters).
 * @returns {string}
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates password policy:
 * - 12 to 72 UTF-8 bytes (explicit byte length check for bcrypt limit)
 * - Allows spaces, does not trim silently
 *
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password harus berupa string.' };
  }
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength < 12) {
    return { valid: false, message: 'Password minimal 12 karakter/byte.' };
  }
  if (byteLength > 72) {
    return { valid: false, message: 'Password maksimal 72 byte UTF-8.' };
  }
  return { valid: true };
}

/**
 * Normalizes and validates username:
 * - 3 to 50 characters
 * - Trim and lowercase
 * - Allowed chars: a-z, 0-9, ., _, -
 *
 * @param {string} username
 * @returns {{ valid: boolean, normalized?: string, message?: string }}
 */
function normalizeUsername(username) {
  if (typeof username !== 'string') {
    return { valid: false, message: 'Username harus berupa string.' };
  }
  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 50) {
    return { valid: false, message: 'Username harus berukuran 3 hingga 50 karakter.' };
  }
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    return { valid: false, message: 'Username hanya boleh mengandung huruf kecil, angka, titik, underscore, dan tanda minus.' };
  }
  return { valid: true, normalized };
}

/**
 * Hashes password using bcrypt with cost factor 12.
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Verifies plain password against bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

module.exports = {
  safeCompare,
  generateCsrfToken,
  validatePassword,
  normalizeUsername,
  hashPassword,
  verifyPassword,
};
