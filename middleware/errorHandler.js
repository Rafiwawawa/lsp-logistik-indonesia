/**
 * Centralized error handler middleware.
 * Formats errors consistently using JSON envelope for API routes:
 * { "success": false, "error": { "code": "...", "message": "..." } }
 *
 * Prevents leaking stack traces, SQL queries, or internals in production.
 */
function errorHandler(err, req, res, next) {
  const isApi = req.path.startsWith('/api') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
  const isPayloadTooLarge =
    err.type === 'entity.too.large' ||
    err.code === 'LIMIT_FILE_SIZE';

  const statusCode =
    err.statusCode ||
    err.status ||
    (isPayloadTooLarge ? 413 : 500);

  // Log error details internally (redacted from secrets)
  if (statusCode >= 500) {
    console.error(`[Error] [${req.method}] ${req.originalUrl}:`, err.message || err);
    if (process.env.NODE_ENV !== 'production' && err.stack) {
      console.error(err.stack);
    }
  }

  if (isApi) {
    let errorCode = err.code || 'INTERNAL_ERROR';
    let errorMessage = err.message || 'Terjadi kesalahan pada server.';

    if (statusCode === 413) {
      errorCode = 'PAYLOAD_TOO_LARGE';
      errorMessage = 'Ukuran payload melebihi batas yang diizinkan.';
    } else if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
      errorCode = 'INTERNAL_ERROR';
      errorMessage = 'Terjadi kesalahan pada server.';
    }

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    });
  }

  // Non-API fallback
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).send(
    process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan internal pada server.'
      : `Internal Server Error: ${err.message}`
  );
}

/**
 * 404 Not Found middleware.
 */
function notFoundHandler(req, res) {
  const isApi = req.path.startsWith('/api') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

  if (isApi) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint tidak ditemukan.',
      },
    });
  }

  const path = require('path');
  const notFoundPage = path.join(__dirname, '..', 'pages', '404.html');
  const fs = require('fs');
  if (fs.existsSync(notFoundPage)) {
    return res.status(404).sendFile(notFoundPage);
  }
  res.status(404).send('Halaman tidak ditemukan (404)');
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
