const rateLimit = require('express-rate-limit');

// Setup rate limiter: max 3 attempts per 15 minutes
const setupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak percobaan setup. Silakan coba lagi dalam 15 menit.',
    },
  },
});

// Login rate limiter: max 5 attempts per 15 minutes
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.',
    },
  },
});

/**
 * Setup limiter wrapper: active in production/development,
 * bypassable in general test suites unless explicitly requested via X-Test-Ratelimit header.
 */
const setupLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) {
    return next();
  }
  return setupRateLimiter(req, res, next);
};

/**
 * Login limiter wrapper: active in production/development,
 * bypassable in general test suites unless explicitly requested via X-Test-Ratelimit header.
 */
const loginLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) {
    return next();
  }
  return loginRateLimiter(req, res, next);
};

// Public API rate limiter: max 120 GET/HEAD requests per minute per IP
const publicApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'GET' && req.method !== 'HEAD',
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak permintaan API. Silakan coba lagi dalam 1 menit.',
    },
  },
});

const publicApiLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) {
    return next();
  }
  return publicApiRateLimiter(req, res, next);
};

// Media rate limiter: max 300 GET/HEAD requests per minute per IP
const mediaRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'GET' && req.method !== 'HEAD',
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak permintaan media. Silakan coba lagi dalam 1 menit.',
    },
  },
});

const mediaLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) {
    return next();
  }
  return mediaRateLimiter(req, res, next);
};

// Admin mutation rate limiter: max 60 mutation requests per 15 minutes per admin/IP
const adminMutationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method),
  keyGenerator: (req) => {
    const adminId = req.session?.adminId ? `admin_${req.session.adminId}` : 'anon';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `${adminId}_${ip}`;
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Terlalu banyak operasi perubahan data admin. Silakan coba lagi dalam 15 menit.',
    },
  },
});

const adminMutationLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) {
    return next();
  }
  return adminMutationRateLimiter(req, res, next);
};

module.exports = {
  setupLimiter,
  loginLimiter,
  publicApiLimiter,
  mediaLimiter,
  adminMutationLimiter,
};
