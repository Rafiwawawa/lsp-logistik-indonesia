const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');
const { hashPassword } = require('../utils/security');

describe('Phase 2: Synchronizer Token CSRF Protection', () => {
  let env;

  beforeEach(async () => {
    env = createTestEnvironment();
    // Seed admin
    const hash = await hashPassword('AdminPassword2026!');
    env.db.prepare("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)").run(hash);
  });

  afterEach(() => {
    env.cleanup();
  });

  test('rejects mutating request with missing X-CSRF-Token header (403)', async () => {
    const agent = request.agent(env.app);
    // Initialize session
    await agent.get('/api/auth/csrf-token');

    const res = await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'AdminPassword2026!' })
      .expect(403);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CSRF_ERROR');
  });

  test('rejects mutating request with invalid X-CSRF-Token (403)', async () => {
    const agent = request.agent(env.app);
    await agent.get('/api/auth/csrf-token');

    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', 'invalid-token-12345')
      .send({ username: 'admin', password: 'AdminPassword2026!' })
      .expect(403);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CSRF_ERROR');
  });

  test('pre-login CSRF token becomes INVALID for authenticated session after login regeneration', async () => {
    const agent = request.agent(env.app);

    // 1. Fetch pre-login CSRF token
    const preLoginCsrfRes = await agent.get('/api/auth/csrf-token').expect(200);
    const preLoginToken = preLoginCsrfRes.body.data.csrfToken;
    assert.ok(preLoginToken);

    // 2. Perform login using pre-login CSRF token
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', preLoginToken)
      .send({ username: 'admin', password: 'AdminPassword2026!' })
      .expect(200);

    // 3. Attempt to use old pre-login CSRF token on authenticated mutating endpoint (logout)
    const failedLogoutRes = await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', preLoginToken)
      .expect(403);

    assert.equal(failedLogoutRes.body.success, false);
    assert.equal(failedLogoutRes.body.error.code, 'CSRF_ERROR');

    // 4. Fetch new CSRF token for the authenticated session
    const postLoginCsrfRes = await agent.get('/api/auth/csrf-token').expect(200);
    const postLoginToken = postLoginCsrfRes.body.data.csrfToken;
    assert.notEqual(postLoginToken, preLoginToken);

    // 5. Using new token succeeds
    const successLogoutRes = await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', postLoginToken)
      .expect(200);

    assert.equal(successLogoutRes.body.success, true);
  });

  test('arbitrary length or malformed CSRF tokens do not cause HTTP 500 error', async () => {
    const agent = request.agent(env.app);
    await agent.get('/api/auth/csrf-token');

    const weirdTokens = [
      '',
      'a',
      'a'.repeat(10000),
      '!@#$%^&*()_+{}[]:;"\'<>,.?/\\|~`',
      'null',
      'undefined',
    ];

    for (const token of weirdTokens) {
      const res = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', token)
        .send({ username: 'admin', password: 'AdminPassword2026!' });

      assert.equal(res.status, 403, `Token "${token.substring(0, 10)}" should return 403, got ${res.status}`);
      assert.equal(res.body.error.code, 'CSRF_ERROR');
    }
  });
});
