const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateEnv } = require('../config/env');

describe('Phase 1: Startup Environment Validation', () => {
  test('passes validation with correct configuration', () => {
    const validEnv = {
      NODE_ENV: 'development',
      PORT: '4000',
      SESSION_SECRET: 'test-session-secret-with-plenty-of-bytes-for-entropy',
      DATABASE_PATH: './database/lsp.db',
      SESSION_DATABASE_PATH: './database/sessions.db',
      UPLOAD_DIR: './uploads',
      SETUP_TOKEN: 'setup-token-value',
    };

    const config = validateEnv(validEnv);
    assert.equal(config.NODE_ENV, 'development');
    assert.equal(config.PORT, 4000);
    assert.equal(config.SESSION_SECRET, validEnv.SESSION_SECRET);
  });

  test('fails if SESSION_SECRET is missing', () => {
    const invalidEnv = {
      NODE_ENV: 'development',
      PORT: '4000',
    };

    assert.throws(() => validateEnv(invalidEnv), /SESSION_SECRET is required/);
  });

  test('fails if SESSION_SECRET is less than 32 bytes in production', () => {
    const invalidEnv = {
      NODE_ENV: 'production',
      PORT: '4000',
      SESSION_SECRET: 'short-secret',
    };

    assert.throws(() => validateEnv(invalidEnv), /at least 32 bytes long/);
  });

  test('fails if NODE_ENV is invalid', () => {
    const invalidEnv = {
      NODE_ENV: 'invalid_env',
      PORT: '4000',
      SESSION_SECRET: '32-bytes-long-secret-key-entropy-123',
    };

    assert.throws(() => validateEnv(invalidEnv), /Invalid NODE_ENV/);
  });

  test('fails if PORT is invalid', () => {
    const invalidEnv = {
      NODE_ENV: 'development',
      PORT: '99999',
      SESSION_SECRET: '32-bytes-long-secret-key-entropy-123',
    };

    assert.throws(() => validateEnv(invalidEnv), /Invalid PORT/);
  });
});
