const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');

describe('Phase 1: Static File Serving Restrictions', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('refuses access to sensitive project files (404)', async () => {
    const sensitivePaths = [
      '/.env',
      '/.env.example',
      '/server.js',
      '/app.js',
      '/package.json',
      '/package-lock.json',
      '/database/lsp.db',
      '/database/db.js',
      '/database/migrations/001_initial_schema.sql',
      '/middleware/errorHandler.js',
    ];

    for (const p of sensitivePaths) {
      const res = await request(env.app).get(p);
      assert.equal(res.status, 404, `Access to ${p} should return 404, got ${res.status}`);
    }
  });

  test('serves public website pages and assets correctly', async () => {
    // Root index.html
    const rootRes = await request(env.app).get('/').expect(200);
    assert.ok(rootRes.text.length > 0);

    // CSS asset
    await request(env.app).get('/assets/css/main.css').expect(200);

    // HTML subpage
    await request(env.app).get('/pages/berita.html').expect(200);
  });
});
