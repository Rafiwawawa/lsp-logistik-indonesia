const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');

describe('Phase 1: Centralized Error Handling & Body Limits', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('returns 413 Payload Too Large when request body exceeds 1MB', async () => {
    // Generate payload larger than 1MB
    const largeString = 'a'.repeat(1024 * 1024 + 100);

    const res = await request(env.app)
      .post('/api/some-endpoint')
      .set('Content-Type', 'application/json')
      .send({ data: largeString });

    assert.equal(res.status, 413);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  test('returns consistent JSON 404 for unknown /api/* endpoints', async () => {
    const res = await request(env.app)
      .get('/api/unknown-endpoint')
      .expect(404);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.equal(res.body.error.message, 'Endpoint tidak ditemukan.');
  });
});
