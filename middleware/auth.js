const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 Hours

/**
 * Validates whether the request carries an active, non-expired administrator session.
 *
 * Rules:
 * 1. session.adminId must exist
 * 2. session.authenticatedAt must be a finite number
 * 3. authenticatedAt cannot be in the future (fail-closed)
 * 4. elapsed time (Date.now() - authenticatedAt) cannot exceed ABSOLUTE_TIMEOUT_MS
 *
 * Returns { valid: true } or { valid: false, reason: 'UNAUTHORIZED' | 'SESSION_EXPIRED' }
 */
function isValidAdminSession(req) {
  if (!req?.session?.adminId) {
    return { valid: false, reason: 'UNAUTHORIZED' };
  }

  const authenticatedAt = req.session.authenticatedAt;
  const now = Date.now();

  if (
    typeof authenticatedAt !== 'number' ||
    !Number.isFinite(authenticatedAt) ||
    authenticatedAt > now ||
    (now - authenticatedAt) > ABSOLUTE_TIMEOUT_MS
  ) {
    return { valid: false, reason: 'SESSION_EXPIRED' };
  }

  return { valid: true };
}

/**
 * Middleware ensuring request is authenticated as an administrator.
 * Enforces:
 * 1. Active session with adminId
 * 2. Fail-closed authenticatedAt validation and absolute 12-hour lifetime
 */
function requireAuth(req, res, next) {
  const sessionCheck = isValidAdminSession(req);

  if (sessionCheck.valid) {
    return next();
  }

  if (sessionCheck.reason === 'SESSION_EXPIRED') {
    if (req.session && typeof req.session.destroy === 'function') {
      req.session.destroy(() => {});
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Sesi telah berakhir (batas maksimum 12 jam). Silakan login kembali.',
      },
    });
  }

  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.',
    },
  });
}

module.exports = {
  requireAuth,
  isValidAdminSession,
  ABSOLUTE_TIMEOUT_MS,
};
