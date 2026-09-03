const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const { clearAllSessions } = require('../database/sessionStore');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { setupLimiter, loginLimiter } = require('../middleware/rateLimiter');
const {
  safeCompare,
  generateCsrfToken,
  validatePassword,
  normalizeUsername,
  hashPassword,
  verifyPassword,
} = require('../utils/security');
const { logActivity } = require('../utils/logger');

/**
 * GET /api/auth/setup-status
 * Checks whether initial admin account setup is required.
 */
router.get('/setup-status', (req, res) => {
  const db = getDB();
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM admins').get();
  const setupRequired = (countRow ? countRow.cnt : 0) === 0;

  return res.json({
    success: true,
    data: {
      setupRequired,
    },
  });
});

/**
 * POST /api/auth/setup
 * Initial admin account creation.
 * Protected by X-Setup-Token header and rate limiting.
 * Permanently locked once the first admin account is created.
 */
router.post('/setup', setupLimiter, async (req, res, next) => {
  try {
    const db = getDB();

    // 1. Check if admin already exists
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM admins').get();
    if (countRow && countRow.cnt > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SETUP_LOCKED',
          message: 'Setup administrator telah selesai dan saat ini dikunci permanen.',
        },
      });
    }

    // 2. Validate setup token via safe constant-time comparison
    const token = req.headers['x-setup-token'] || req.body?.setup_token;
    const expectedToken = process.env.SETUP_TOKEN;

    if (!token || !expectedToken || !safeCompare(token, expectedToken)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_SETUP_TOKEN',
          message: 'Setup token tidak valid atau tidak disertakan.',
        },
      });
    }

    // 3. Validate and normalize username
    const usernameValidation = normalizeUsername(req.body?.username);
    if (!usernameValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: usernameValidation.message,
        },
      });
    }

    // 4. Validate password policy (12-72 UTF-8 bytes)
    const passwordValidation = validatePassword(req.body?.password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: passwordValidation.message,
        },
      });
    }

    // 5. Hash password and insert admin
    const passwordHash = await hashPassword(req.body.password);
    const stmt = db.prepare(`
      INSERT INTO admins (username, password_hash, created_at, updated_at)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `);
    const result = stmt.run(usernameValidation.normalized, passwordHash);

    // 6. Record activity log
    logActivity(db, {
      action: 'SETUP_COMPLETED',
      entityType: 'admin',
      entityId: result.lastInsertRowid,
      metadata: { username: usernameValidation.normalized },
      req,
    });

    return res.status(201).json({
      success: true,
      data: {
        message: 'Administrator berhasil didaftarkan. Silakan login.',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/csrf-token
 * Generates and stores synchronizer CSRF token in current session.
 */
router.get('/csrf-token', (req, res) => {
  if (!req.session) {
    return res.status(500).json({
      success: false,
      error: { code: 'SESSION_ERROR', message: 'Session store tidak aktif.' },
    });
  }

  if (!req.session.csrfSecret) {
    req.session.csrfSecret = generateCsrfToken();
  }

  return res.json({
    success: true,
    data: {
      csrfToken: req.session.csrfSecret,
    },
  });
});

/**
 * POST /api/auth/login
 * Authenticates administrator, defends against session fixation via regenerate,
 * and sets authenticated session timestamp.
 */
router.post('/login', loginLimiter, csrfProtection, async (req, res, next) => {
  try {
    const db = getDB();
    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawUsername || !rawPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Username atau password salah.',
        },
      });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE username = ? COLLATE NOCASE').get(rawUsername);

    if (!admin || !(await verifyPassword(rawPassword, admin.password_hash))) {
      logActivity(db, {
        action: 'LOGIN_FAILED',
        entityType: 'admin',
        metadata: { attemptedUsername: rawUsername },
        req,
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Username atau password salah.',
        },
      });
    }

    // Regenerate session to prevent session fixation and invalidate pre-login CSRF token
    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }

      req.session.adminId = admin.id;
      req.session.username = admin.username;
      req.session.authenticatedAt = Date.now();
      req.session.csrfSecret = null; // Forces fetching a new CSRF token for the authenticated session

      logActivity(db, {
        action: 'LOGIN_SUCCESS',
        entityType: 'admin',
        entityId: admin.id,
        metadata: { username: admin.username },
        req,
      });

      return res.json({
        success: true,
        data: {
          message: 'Login berhasil.',
          admin: {
            id: admin.id,
            username: admin.username,
          },
        },
      });
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated admin information.
 */
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    success: true,
    data: {
      admin: {
        id: req.session.adminId,
        username: req.session.username,
      },
    },
  });
});

/**
 * POST /api/auth/logout
 * Destroys active session and clears auth cookie.
 */
router.post('/logout', requireAuth, csrfProtection, (req, res, next) => {
  const db = getDB();
  const adminId = req.session.adminId;
  const username = req.session.username;

  logActivity(db, {
    action: 'LOGOUT',
    entityType: 'admin',
    entityId: adminId,
    metadata: { username },
    req,
  });

  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? '__Host-lsp_session' : 'lsp_session';

  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie(cookieName, { path: '/' });
    return res.json({
      success: true,
      data: {
        message: 'Logout berhasil.',
      },
    });
  });
});

/**
 * POST /api/auth/change-password
 * Changes admin password and invalidates ALL active sessions in sessions.db.
 */
router.post('/change-password', requireAuth, csrfProtection, async (req, res, next) => {
  try {
    const db = getDB();
    const adminId = req.session.adminId;
    const { currentPassword, newPassword } = req.body || {};

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Admin tidak ditemukan.' },
      });
    }

    if (!(await verifyPassword(currentPassword, admin.password_hash))) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Password saat ini tidak sesuai.',
        },
      });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: passwordValidation.message,
        },
      });
    }

    const newHash = await hashPassword(newPassword);

    db.prepare(`
      UPDATE admins
      SET password_hash = ?,
          password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(newHash, adminId);

    // Invalidate ALL sessions across all devices
    clearAllSessions();

    logActivity(db, {
      action: 'PASSWORD_CHANGED',
      entityType: 'admin',
      entityId: adminId,
      metadata: { username: admin.username },
      req,
    });

    const isProd = process.env.NODE_ENV === 'production';
    const cookieName = isProd ? '__Host-lsp_session' : 'lsp_session';

    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie(cookieName, { path: '/' });
      return res.json({
        success: true,
        data: {
          message: 'Password berhasil diubah. Seluruh sesi aktif telah di-reset.',
        },
      });
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
