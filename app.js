const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { getDB } = require('./database/db');
const { createSessionMiddleware } = require('./middleware/session');
const { requireAuth } = require('./middleware/auth');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

/**
 * Creates and configures Express application.
 *
 * @param {object} [options]
 * @param {import('better-sqlite3').Database} [options.db] Optional custom database
 * @param {any} [options.sessionStore] Optional custom session store
 * @returns {import('express').Express}
 */
function createApp(options = {}) {
  const app = express();
  const db = options.db || getDB();

  // ─── Security Headers (Helmet) ─────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // ─── Request Body Limits ───────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Persistent Session Middleware ─────────────────────────────────────────
  app.use(createSessionMiddleware({ store: options.sessionStore }));

  // ─── Health Check Endpoint ─────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    try {
      const activeDb = options.db || getDB();
      const check = activeDb.prepare('SELECT 1 as alive').get();
      if (check && check.alive === 1) {
        return res.status(200).json({ status: 'ok' });
      }
      return res.status(503).json({ status: 'error', message: 'Database check failed' });
    } catch (err) {
      return res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
  });

  // ─── API Routes ─────────────────────────────────────────────────────────────
  app.use('/api/auth', require('./api/auth'));
  app.use('/api/galeri', require('./api/galeri'));
  app.use('/api/berita', require('./api/berita'));

  // Admin API boundary guard (Phase 2 placeholder for Phase 4 admin routes)
  app.use('/api/admin', requireAuth);

  // Serve uploaded images safely
  app.get('/media/images/:category/:filename', require('./middleware/serveImage'));

  // ─── Admin UI Guard & Static Routing ───────────────────────────────────────
  app.get('/admin/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'setup.html'));
  });

  app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'login.html'));
  });

  // Protected Admin Static UI: Redirect to login if not authenticated
  app.use('/admin', (req, res, next) => {
    const isPublicAdminRoute =
      req.path === '/login.html' ||
      req.path === '/login' ||
      req.path === '/setup.html' ||
      req.path === '/setup' ||
      req.path.startsWith('/assets/');

    if (isPublicAdminRoute) {
      return next();
    }

    if (!req.session || !req.session.adminId) {
      return res.redirect('/admin/login.html');
    }

    next();
  });

  app.use('/admin', express.static(path.join(__dirname, 'admin'), {
    extensions: ['html'],
  }));

  // ─── Explicit Public Static File Serving ───────────────────────────────────
  app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '1d',
    etag: true,
  }));

  app.use('/pages', express.static(path.join(__dirname, 'pages'), {
    extensions: ['html'],
    etag: true,
  }));

  // Root index.html
  app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  // ─── 404 & Centralized Error Handlers ──────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
