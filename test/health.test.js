const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');

describe('Phase 1: Health Check Endpoint', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('GET /health returns 200 with status ok when database is healthy', async () => {
    const res = await request(env.app)
      .get('/health')
      .expect(200);

    assert.equal(res.body.status, 'ok');
  });

  test('GET /health returns 503 when database is unavailable', async () => {
    // Intentionally close database to simulate failure
    env.db.close();

    const res = await request(env.app)
      .get('/health')
      .expect(503);

    assert.equal(res.body.status, 'error');
    assert.equal(res.body.message, 'Database unavailable');
  });
});
