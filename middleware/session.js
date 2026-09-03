const session = require('express-session');
const { getSessionStore } = require('../database/sessionStore');

/**
 * Creates express-session middleware configured with SQLite persistent store,
 * dual-timeout settings (2h idle rolling), and security cookie policies.
 *
 * @param {object} [options]
 * @param {any} [options.store] Optional custom store for testing
 * @returns {import('express').RequestHandler}
 */
function createSessionMiddleware(options = {}) {
  const store = options.store || getSessionStore();
  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Host-lsp_session' : 'lsp_session';

  return session({
    name: cookieName,
    secret: process.env.SESSION_SECRET || 'dev-secret-key-at-least-32-bytes-long',
    store: store,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Renews cookie expiration on every active request (2h idle timeout)
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 2 * 60 * 60 * 1000, // 2 Hours
    },
  });
}

module.exports = { createSessionMiddleware };
