const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 Hours

/**
 * Middleware ensuring request is authenticated as an administrator.
 * Enforces:
 * 1. Active session with adminId
 * 2. Absolute 12-hour session lifetime (using req.session.authenticatedAt)
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.',
      },
    });
  }

  // Check absolute lifetime (12h since login)
  if (req.session.authenticatedAt) {
    const elapsed = Date.now() - req.session.authenticatedAt;
    if (elapsed > ABSOLUTE_TIMEOUT_MS) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Sesi telah berakhir (batas maksimum 12 jam). Silakan login kembali.',
        },
      });
    }
  }

  next();
}

module.exports = {
  requireAuth,
  ABSOLUTE_TIMEOUT_MS,
};
