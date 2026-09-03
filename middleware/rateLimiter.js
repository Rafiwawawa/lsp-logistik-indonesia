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

module.exports = {
  setupLimiter,
  loginLimiter,
};
