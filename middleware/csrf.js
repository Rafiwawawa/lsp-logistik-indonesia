const { safeCompare } = require('../utils/security');

/**
 * Synchronizer Token CSRF protection middleware.
 * Validates X-CSRF-Token header against req.session.csrfSecret for mutating HTTP methods.
 */
function csrfProtection(req, res, next) {
  // Safe methods are exempt
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionSecret = req.session ? req.session.csrfSecret : null;
  const token = req.headers['x-csrf-token'] || (req.body && req.body._csrf);

  if (!sessionSecret || !token || !safeCompare(token, sessionSecret)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_ERROR',
        message: 'Token CSRF tidak valid atau kedaluwarsa.',
      },
    });
  }

  next();
}

module.exports = { csrfProtection };
