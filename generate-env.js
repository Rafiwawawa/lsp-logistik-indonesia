const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Generate session secret
const sessionSecret = crypto.randomBytes(64).toString('hex');

// Hash default password
const defaultPassword = 'LSPLogistik2026!';
const hash = bcrypt.hashSync(defaultPassword, 12);

console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`PORT=4000`);
console.log(`NODE_ENV=development`);
