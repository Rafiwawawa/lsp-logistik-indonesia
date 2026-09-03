const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');
const { validatePassword, normalizeUsername, hashPassword } = require('../utils/security');

describe('Phase 2: Authentication System', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  // ─── Setup Wizard Tests ───────────────────────────────────────────────────
  describe('Initial Admin Setup', () => {
    test('GET /api/auth/setup-status returns setupRequired: true initially', async () => {
      const res = await request(env.app)
        .get('/api/auth/setup-status')
        .expect(200);

      assert.equal(res.body.success, true);
      assert.equal(res.body.data.setupRequired, true);
    });

    test('POST /api/auth/setup fails if X-Setup-Token is missing or wrong', async () => {
      // Missing token
      const res1 = await request(env.app)
        .post('/api/auth/setup')
        .send({ username: 'admin', password: 'Password123456!' })
        .expect(403);

      assert.equal(res1.body.success, false);
      assert.equal(res1.body.error.code, 'INVALID_SETUP_TOKEN');

      // Wrong token
      const res2 = await request(env.app)
        .post('/api/auth/setup')
        .set('X-Setup-Token', 'wrong-token')
        .send({ username: 'admin', password: 'Password123456!' })
        .expect(403);

      assert.equal(res2.body.success, false);
      assert.equal(res2.body.error.code, 'INVALID_SETUP_TOKEN');
    });

    test('POST /api/auth/setup succeeds with valid token, username, and password', async () => {
      const res = await request(env.app)
        .post('/api/auth/setup')
        .set('X-Setup-Token', process.env.SETUP_TOKEN)
        .send({ username: 'SuperAdmin', password: 'ValidPassword123!' })
        .expect(201);

      assert.equal(res.body.success, true);

      // Verify admin was created in DB with lowercase username
      const admin = env.db.prepare('SELECT * FROM admins WHERE username = ?').get('superadmin');
      assert.ok(admin, 'Admin should exist in DB normalized to lowercase');

      // Verify setup-status is now false
      const statusRes = await request(env.app)
        .get('/api/auth/setup-status')
        .expect(200);
      assert.equal(statusRes.body.data.setupRequired, false);
    });

    test('POST /api/auth/setup is permanently locked after first admin exists', async () => {
      // 1. Create first admin
      await request(env.app)
        .post('/api/auth/setup')
        .set('X-Setup-Token', process.env.SETUP_TOKEN)
        .send({ username: 'admin1', password: 'Password123456!' })
        .expect(201);

      // 2. Attempt second setup with valid token
      const res = await request(env.app)
        .post('/api/auth/setup')
        .set('X-Setup-Token', process.env.SETUP_TOKEN)
        .send({ username: 'admin2', password: 'Password123456!' })
        .expect(403);

      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'SETUP_LOCKED');
    });
  });

  // ─── Username & Password Policies ─────────────────────────────────────────
  describe('Username & Password Policy Enforcement', () => {
    test('enforces password boundaries (11 bytes rejected, 12 accepted, 72 accepted, 73 rejected)', () => {
      assert.equal(validatePassword('12345678901').valid, false, '11 bytes should be invalid');
      assert.equal(validatePassword('123456789012').valid, true, '12 bytes should be valid');

      const pass72 = 'a'.repeat(72);
      assert.equal(validatePassword(pass72).valid, true, '72 bytes should be valid');

      const pass73 = 'a'.repeat(73);
      assert.equal(validatePassword(pass73).valid, false, '73 bytes should be invalid');

      // UTF-8 multibyte boundary check
      const multiByteChar = '€'; // 3 bytes in UTF-8
      const fourChars = multiByteChar.repeat(4); // 12 bytes
      assert.equal(validatePassword(fourChars).valid, true, '12 bytes UTF-8 should be valid');
    });

    test('enforces username normalization and allowed characters', () => {
      const res1 = normalizeUsername('  Admin_User.01-test  ');
      assert.equal(res1.valid, true);
      assert.equal(res1.normalized, 'admin_user.01-test');

      const resShort = normalizeUsername('ab');
      assert.equal(resShort.valid, false);

      const resInvalidChars = normalizeUsername('admin@user!');
      assert.equal(resInvalidChars.valid, false);
    });
  });

  // ─── Login & Session Tests ────────────────────────────────────────────────
  describe('Login & Session Management', () => {
    beforeEach(async () => {
      // Seed one admin
      const hash = await hashPassword('AdminPassword2026!');
      env.db.prepare(`
        INSERT INTO admins (username, password_hash)
        VALUES ('admin', ?)
      `).run(hash);
    });

    test('returns generic login error for wrong password or nonexistent user', async () => {
      // 1. Get pre-login CSRF token
      const agent = request.agent(env.app);
      const csrfRes = await agent.get('/api/auth/csrf-token').expect(200);
      const csrfToken = csrfRes.body.data.csrfToken;

      // 2. Nonexistent user
      const res1 = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrfToken)
        .send({ username: 'nonexistent', password: 'AdminPassword2026!' })
        .expect(401);

      assert.equal(res1.body.success, false);
      assert.equal(res1.body.error.message, 'Username atau password salah.');

      // 3. Existing user, wrong password
      const res2 = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrfToken)
        .send({ username: 'admin', password: 'WrongPassword123!' })
        .expect(401);

      assert.equal(res2.body.success, false);
      assert.equal(res2.body.error.message, 'Username atau password salah.');
      assert.equal(res1.body.error.message, res2.body.error.message);
    });

    test('login succeeds, regenerates session, and grants access to /api/auth/me', async () => {
      const agent = request.agent(env.app);

      // Get pre-login CSRF token
      const csrfRes = await agent.get('/api/auth/csrf-token').expect(200);
      const preLoginCsrf = csrfRes.body.data.csrfToken;

      // Login with case-insensitive username
      const loginRes = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', preLoginCsrf)
        .send({ username: 'ADMIN', password: 'AdminPassword2026!' })
        .expect(200);

      assert.equal(loginRes.body.success, true);
      assert.equal(loginRes.body.data.admin.username, 'admin');

      // Verify authenticated session via /api/auth/me
      const meRes = await agent.get('/api/auth/me').expect(200);
      assert.equal(meRes.body.success, true);
      assert.equal(meRes.body.data.admin.username, 'admin');
    });

    test('unauthenticated request to /api/admin is rejected with 401', async () => {
      const res = await request(env.app)
        .get('/api/admin/some-resource')
        .expect(401);

      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    test('logout destroys session and invalidates access to /api/auth/me', async () => {
      const agent = request.agent(env.app);

      // 1. Login
      const csrfRes = await agent.get('/api/auth/csrf-token');
      await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrfRes.body.data.csrfToken)
        .send({ username: 'admin', password: 'AdminPassword2026!' })
        .expect(200);

      // 2. Fetch authenticated CSRF token
      const authCsrfRes = await agent.get('/api/auth/csrf-token');
      const authCsrf = authCsrfRes.body.data.csrfToken;

      // 3. Logout
      await agent
        .post('/api/auth/logout')
        .set('X-CSRF-Token', authCsrf)
        .expect(200);

      // 4. Verify /api/auth/me is now 401
      await agent.get('/api/auth/me').expect(401);
    });

    test('password change invalidates ALL active sessions', async () => {
      const agent1 = request.agent(env.app);
      const agent2 = request.agent(env.app);

      // Device 1 logs in
      const csrf1 = (await agent1.get('/api/auth/csrf-token')).body.data.csrfToken;
      await agent1.post('/api/auth/login').set('X-CSRF-Token', csrf1).send({ username: 'admin', password: 'AdminPassword2026!' }).expect(200);

      // Device 2 logs in
      const csrf2 = (await agent2.get('/api/auth/csrf-token')).body.data.csrfToken;
      await agent2.post('/api/auth/login').set('X-CSRF-Token', csrf2).send({ username: 'admin', password: 'AdminPassword2026!' }).expect(200);

      // Device 1 changes password
      const authCsrf1 = (await agent1.get('/api/auth/csrf-token')).body.data.csrfToken;
      const changeRes = await agent1
        .post('/api/auth/change-password')
        .set('X-CSRF-Token', authCsrf1)
        .send({ currentPassword: 'AdminPassword2026!', newPassword: 'NewSecurePassword2026!' })
        .expect(200);

      assert.equal(changeRes.body.success, true);

      // Device 2 session is now invalid (401)
      await agent2.get('/api/auth/me').expect(401);

      // Login with new password succeeds
      const csrfNew = (await agent1.get('/api/auth/csrf-token')).body.data.csrfToken;
      await agent1.post('/api/auth/login').set('X-CSRF-Token', csrfNew).send({ username: 'admin', password: 'NewSecurePassword2026!' }).expect(200);
    });
  });

  // ─── Dual Session Timeout Tests ───────────────────────────────────────────
  describe('Dual Session Timeout (Absolute 12h & Idle 2h)', () => {
    test('enforces absolute 12-hour session lifetime', async () => {
      const hash = await hashPassword('AdminPassword2026!');
      env.db.prepare("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)").run(hash);

      const agent = request.agent(env.app);
      const csrfRes = await agent.get('/api/auth/csrf-token');
      await agent.post('/api/auth/login').set('X-CSRF-Token', csrfRes.body.data.csrfToken).send({ username: 'admin', password: 'AdminPassword2026!' }).expect(200);

      // Normal request succeeds
      await agent.get('/api/auth/me').expect(200);

      // Simulate 12 hours + 1 minute elapsed by updating session table directly in sessions.db
      const sessionRow = env.sessionDb.prepare("SELECT sid, sess FROM sessions WHERE sess LIKE '%adminId%' LIMIT 1").get();
      assert.ok(sessionRow, 'Authenticated session record should exist in sessions.db');

      const parsedSess = JSON.parse(sessionRow.sess);
      parsedSess.authenticatedAt = Date.now() - (12 * 60 * 60 * 1000 + 60000); // 12h + 1m ago
      env.sessionDb.prepare('UPDATE sessions SET sess = ? WHERE sid = ?').run(JSON.stringify(parsedSess), sessionRow.sid);

      // Request after 12h should be rejected with SESSION_EXPIRED
      const expiredRes = await agent.get('/api/auth/me').expect(401);
      assert.equal(expiredRes.body.error.code, 'SESSION_EXPIRED');
    });
  });
});
