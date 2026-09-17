const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');
const { hashPassword } = require('../utils/security');

describe('Security Phase 2A: Rate Limiting & Fail-Closed Session Hardening', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('public GET limiter eventually returns 429', async () => {
    for (let i = 0; i < 120; i++) {
      await request(env.app)
        .get('/api/berita')
        .set('X-Test-Ratelimit', '1')
        .expect(200);
    }

    const res = await request(env.app)
      .get('/api/berita')
      .set('X-Test-Ratelimit', '1')
      .expect(429);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  test('media limiter eventually returns 429', async () => {
    for (let i = 0; i < 300; i++) {
      await request(env.app)
        .get('/media/images/berita/sample.jpg')
        .set('X-Test-Ratelimit', '1');
    }

    const res = await request(env.app)
      .get('/media/images/berita/sample.jpg')
      .set('X-Test-Ratelimit', '1')
      .expect(429);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  test('authenticated admin mutation limiter eventually returns 429', async () => {
    const hash = await hashPassword('AdminPassword2026!');
    env.db.prepare("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)").run(hash);

    const agent = request.agent(env.app);
    const csrfRes = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfRes.body.data.csrfToken)
      .send({ username: 'admin', password: 'AdminPassword2026!' })
      .expect(200);

    const authCsrfRes = await agent.get('/api/auth/csrf-token');
    const authCsrf = authCsrfRes.body.data.csrfToken;

    for (let i = 0; i < 60; i++) {
      await agent
        .delete('/api/berita/99999')
        .set('X-Test-Ratelimit', '1')
        .set('X-CSRF-Token', authCsrf);
    }

    const res = await agent
      .delete('/api/berita/99999')
      .set('X-Test-Ratelimit', '1')
      .set('X-CSRF-Token', authCsrf)
      .expect(429);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  test('anonymous mutation remains 401 and does not become 429', async () => {
    for (let i = 0; i < 65; i++) {
      const res = await request(env.app)
        .delete('/api/berita/1')
        .set('X-Test-Ratelimit', '1')
        .expect(401);

      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    }
  });

  test('session with missing authenticatedAt is rejected', async () => {
    const hash = await hashPassword('AdminPassword2026!');
    env.db.prepare("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)").run(hash);

    const agent = request.agent(env.app);
    const csrfRes = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfRes.body.data.csrfToken)
      .send({ username: 'admin', password: 'AdminPassword2026!' })
      .expect(200);

    // Corrupt session: remove authenticatedAt
    const sessionRow = env.sessionDb.prepare("SELECT sid, sess FROM sessions WHERE sess LIKE '%adminId%' LIMIT 1").get();
    assert.ok(sessionRow, 'Active session record should exist');
    const parsedSess = JSON.parse(sessionRow.sess);
    delete parsedSess.authenticatedAt;
    env.sessionDb.prepare('UPDATE sessions SET sess = ? WHERE sid = ?').run(JSON.stringify(parsedSess), sessionRow.sid);

    const res = await agent
      .delete('/api/berita/1')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'SESSION_EXPIRED');
  });

  test('session with future authenticatedAt is rejected', async () => {
    const hash = await hashPassword('AdminPassword2026!');
    env.db.prepare("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)").run(hash);

    const agent = request.agent(env.app);
    const csrfRes = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfRes.body.data.csrfToken)
      .send({ username: 'admin', password: 'AdminPassword2026!' })
      .expect(200);

    // Corrupt session: set authenticatedAt in the future (+1 hour)
    const sessionRow = env.sessionDb.prepare("SELECT sid, sess FROM sessions WHERE sess LIKE '%adminId%' LIMIT 1").get();
    assert.ok(sessionRow, 'Active session record should exist');
    const parsedSess = JSON.parse(sessionRow.sess);
    parsedSess.authenticatedAt = Date.now() + (60 * 60 * 1000);
    env.sessionDb.prepare('UPDATE sessions SET sess = ? WHERE sid = ?').run(JSON.stringify(parsedSess), sessionRow.sid);

    const res = await agent
      .delete('/api/berita/1')
      .expect(401);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'SESSION_EXPIRED');
  });

  test('expired admin session is redirected away from protected /admin pages', async () => {
    const hash = await hashPassword('AdminPassword2026!');
    env.db.prepare("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)").run(hash);

    const agent = request.agent(env.app);
    const csrfRes = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfRes.body.data.csrfToken)
      .send({ username: 'admin', password: 'AdminPassword2026!' })
      .expect(200);

    // Corrupt session: expire session (12h + 1m ago)
    const sessionRow = env.sessionDb.prepare("SELECT sid, sess FROM sessions WHERE sess LIKE '%adminId%' LIMIT 1").get();
    assert.ok(sessionRow, 'Active session record should exist');
    const parsedSess = JSON.parse(sessionRow.sess);
    parsedSess.authenticatedAt = Date.now() - (12 * 60 * 60 * 1000 + 60000);
    env.sessionDb.prepare('UPDATE sessions SET sess = ? WHERE sid = ?').run(JSON.stringify(parsedSess), sessionRow.sid);

    const res = await agent
      .get('/admin/index.html')
      .expect(302);

    assert.equal(res.headers.location, '/admin/login.html');
  });

  test('anonymous ?scope=admin receives public results without drafts', async () => {
    env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, status)
      VALUES ('Draft News', 'draft-news', 'Draft Content', 'draft')
    `).run();
    env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, status)
      VALUES ('Published News', 'published-news', 'Published Content', 'terbit')
    `).run();

    const res = await request(env.app)
      .get('/api/berita?scope=admin')
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].slug, 'published-news');
  });
});
