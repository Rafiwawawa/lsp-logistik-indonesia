const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');

describe('Phase 2: Rate Limiting Enforcement', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('setup endpoint enforces rate limit after 3 attempts', async () => {
    for (let i = 0; i < 3; i++) {
      await request(env.app)
        .post('/api/auth/setup')
        .set('X-Test-Ratelimit', '1')
        .set('X-Setup-Token', 'wrong-token')
        .send({ username: 'admin', password: 'Password123456!' })
        .expect(403);
    }

    // 4th attempt should be rate limited (429)
    const rateLimitedRes = await request(env.app)
      .post('/api/auth/setup')
      .set('X-Test-Ratelimit', '1')
      .set('X-Setup-Token', 'wrong-token')
      .send({ username: 'admin', password: 'Password123456!' })
      .expect(429);

    assert.equal(rateLimitedRes.body.success, false);
    assert.equal(rateLimitedRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  test('login endpoint enforces rate limit after 5 attempts', async () => {
    const agent = request.agent(env.app);
    const csrfRes = await agent.get('/api/auth/csrf-token');
    const csrf = csrfRes.body.data.csrfToken;

    for (let i = 0; i < 5; i++) {
      await agent
        .post('/api/auth/login')
        .set('X-Test-Ratelimit', '1')
        .set('X-CSRF-Token', csrf)
        .send({ username: 'nonexistent', password: 'WrongPassword123!' })
        .expect(401);
    }

    // 6th attempt should be rate limited (429)
    const rateLimitedRes = await agent
      .post('/api/auth/login')
      .set('X-Test-Ratelimit', '1')
      .set('X-CSRF-Token', csrf)
      .send({ username: 'nonexistent', password: 'WrongPassword123!' })
      .expect(429);

    assert.equal(rateLimitedRes.body.success, false);
    assert.equal(rateLimitedRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });
});
