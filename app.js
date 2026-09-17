const express = require('express');
const helmet = require('helmet');
const path = require('path');

const { getDB } = require('./database/db');
const { createSessionMiddleware } = require('./middleware/session');
const { requireAuth, isValidAdminSession } = require('./middleware/auth');
const { publicApiLimiter, mediaLimiter } = require('./middleware/rateLimiter');
const serveImage = require('./middleware/serveImage');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp(options = {}) {
  const app = express();
  const db = options.db || getDB();

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://images.unsplash.com',
        ],
        frameSrc: [
          "'self'",
          'https://maps.google.com',
          'https://www.google.com',
        ],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Request body limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Session
  app.use(createSessionMiddleware({
    store: options.sessionStore,
  }));

  // Health check
  app.get('/health', (req, res) => {
    try {
      const check = db.prepare('SELECT 1 AS alive').get();

      if (check?.alive === 1) {
        return res.status(200).json({ status: 'ok' });
      }

      return res.status(503).json({
        status: 'error',
        message: 'Database check failed',
      });
    } catch {
      return res.status(503).json({
        status: 'error',
        message: 'Database unavailable',
      });
    }
  });

  // API
  app.use('/api/auth', require('./api/auth'));
  app.use('/api/berita', publicApiLimiter, require('./api/berita'));
  app.use('/api/galeri', publicApiLimiter, require('./api/galeri'));
  app.use('/api/pengurus', publicApiLimiter, require('./api/pengurus'));

  // Reserved protected admin API boundary
  app.use('/api/admin', requireAuth);

  // Uploaded images
  app.get('/media/images/:category/:filename', mediaLimiter, serveImage);

  // Public admin pages
  app.get('/admin/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'setup.html'));
  });

  app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'login.html'));
  });

  // Protect admin UI except login/setup/assets
  app.use('/admin', (req, res, next) => {
    const publicRoute =
      req.path === '/login' ||
      req.path === '/login.html' ||
      req.path === '/setup' ||
      req.path === '/setup.html' ||
      req.path.startsWith('/assets/');

    if (publicRoute) return next();

    const sessionCheck = isValidAdminSession(req);
    if (!sessionCheck.valid) {
      if (req.session && typeof req.session.destroy === 'function') {
        req.session.destroy(() => {});
      }
      return res.redirect('/admin/login.html');
    }

    next();
  });

  app.use('/admin', express.static(path.join(__dirname, 'admin'), {
    extensions: ['html'],
    etag: true,
  }));

  // Public static resources
  app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '1d',
    etag: true,
  }));

  app.use('/pages', express.static(path.join(__dirname, 'pages'), {
    extensions: ['html'],
    etag: true,
  }));

  // Homepage
  const homepage = path.join(__dirname, 'index.html');

  app.get('/', (req, res) => {
    res.sendFile(homepage);
  });

  // Normalize old homepage links.
  // Example: /index.html -> /
  app.get('/index.html', (req, res) => {
    res.redirect(302, '/');
  });

  // Error handlers must stay last
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };