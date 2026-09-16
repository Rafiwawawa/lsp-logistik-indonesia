/**
 * generate-env.js
 *
 * Generates randomised secrets/tokens for initial .env configuration.
 * Run once: node generate-env.js >> .env
 *
 * This script intentionally does NOT generate or output any admin passwords.
 * The first admin account is created via POST /api/auth/setup (interactive).
 */
const crypto = require('crypto');

// 512-bit session secret (hex)
const sessionSecret = crypto.randomBytes(64).toString('hex');

// 256-bit setup token (hex) – used once to bootstrap the first admin account
const setupToken = crypto.randomBytes(32).toString('hex');

console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`SETUP_TOKEN=${setupToken}`);
console.log(`PORT=4000`);
console.log(`NODE_ENV=development`);
