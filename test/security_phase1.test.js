/**
 * test/security_phase1.test.js
 *
 * Phase 1 Security A — regression tests.
 *
 * Covers:
 *   TASK 1 — CSRF enforcement on all CMS mutation endpoints
 *   TASK 2 — Admin draft scope requires full valid session
 *   TASK 3 — Multer hardening: valid upload still works; multipart limits enforced
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const sharp = require('sharp');

const { createTestEnvironment } = require('./helpers/setup');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createPng() {
  return sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 30, g: 100, b: 200 } },
  })
    .png()
    .toBuffer();
}

async function getCsrfToken(agent) {
  const res = await agent.get('/api/auth/csrf-token').expect(200);
  return res.body.data.csrfToken;
}

/**
 * Creates a fully authenticated agent (setup → login).
 * Returns the agent + the CSRF token valid for the authenticated session.
 */
async function createAuthenticatedAgent(env) {
  const agent = request.agent(env.app);

  await agent
    .post('/api/auth/setup')
    .set('X-Setup-Token', process.env.SETUP_TOKEN)
    .send({ username: 'admin', password: 'ValidPassword123!' })
    .expect(201);

  const csrfToken = await getCsrfToken(agent);

  await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ username: 'admin', password: 'ValidPassword123!' })
    .expect(200);

  return { agent, csrfToken: await getCsrfToken(agent) };
}

/**
 * Seed a published berita row directly into the DB; returns its slug.
 */
function seedTerbitBerita(db, slug = 'test-berita') {
  db.prepare(`
    INSERT INTO berita (judul, slug, isi, kategori, status, published_at)
    VALUES ('Test', ?, 'Isi test', 'Berita', 'terbit', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(slug);
  return slug;
}

/**
 * Seed a draft berita row directly into the DB; returns its slug.
 */
function seedDraftBerita(db, slug = 'draft-berita') {
  db.prepare(`
    INSERT INTO berita (judul, slug, isi, kategori, status)
    VALUES ('Draft', ?, 'Isi draft', 'Berita', 'draft')
  `).run(slug);
  return slug;
}

/**
 * Seed a pengurus row; returns its id.
 */
function seedPengurus(db) {
  const result = db
    .prepare(`INSERT INTO pengurus (jabatan, nama, urutan) VALUES ('Ketua', 'Budi', 1)`)
    .run();
  return Number(result.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// TASK 1 — CSRF enforcement
// ---------------------------------------------------------------------------

describe('Phase 1-A: CSRF enforcement on CMS mutations', () => {
  let env;

  beforeEach(() => { env = createTestEnvironment(); });
  afterEach(() => { env.cleanup(); });

  // ---- Berita ---------------------------------------------------------------

  test('POST /api/berita without CSRF → 403', async () => {
    const { agent } = await createAuthenticatedAgent(env);
    const res = await agent
      .post('/api/berita')
      .field('judul', 'Test')
      .field('isi', 'Isi')
      // no X-CSRF-Token header
      .expect(403);
    assert.equal(res.body.error.code, 'CSRF_ERROR');
  });

  test('POST /api/berita with invalid CSRF → 403', async () => {
    const { agent } = await createAuthenticatedAgent(env);
    const res = await agent
      .post('/api/berita')
      .set('X-CSRF-Token', 'totally-wrong-token')
      .field('judul', 'Test')
      .field('isi', 'Isi')
      .expect(403);
    assert.equal(res.body.error.code, 'CSRF_ERROR');
  });

  test('POST /api/berita with valid CSRF → succeeds (201)', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(env);
    const res = await agent
      .post('/api/berita')
      .set('X-CSRF-Token', csrfToken)
      .field('judul', 'Berita Valid CSRF')
      .field('isi', 'Isi berita cukup.')
      .field('kategori', 'Berita')
      .field('status', 'draft')
      .expect(201);
    assert.ok(res.body.success);
  });

  test('PUT /api/berita/:id without CSRF → 403', async () => {
    const { agent } = await createAuthenticatedAgent(env);
    const slug = seedTerbitBerita(env.db, 'put-csrf-test');
    const row = env.db.prepare('SELECT id FROM berita WHERE slug = ?').get(slug);
    await agent
      .put(`/api/berita/${row.id}`)
      // no CSRF
      .field('judul', 'Updated')
      .field('isi', 'Updated isi')
      .expect(403);
  });

  test('DELETE /api/berita/:id without CSRF → 403', async () => {
    const { agent } = await createAuthenticatedAgent(env);
    const slug = seedTerbitBerita(env.db, 'del-csrf-test');
    const row = env.db.prepare('SELECT id FROM berita WHERE slug = ?').get(slug);
    await agent
      .delete(`/api/berita/${row.id}`)
      // no CSRF
      .expect(403);
  });

  // ---- Galeri ---------------------------------------------------------------

  test('POST /api/galeri without CSRF → 403', async () => {
    const { agent } = await createAuthenticatedAgent(env);
    const buf = await createPng();
    const res = await agent
      .post('/api/galeri')
      // no CSRF
      .field('judul', 'Foto Test')
      .attach('foto', buf, { filename: 'test.png' })
      .expect(403);
    assert.equal(res.body.error.code, 'CSRF_ERROR');
  });

  test('POST /api/galeri with valid CSRF → succeeds (201)', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(env);
    const buf = await createPng();
    const res = await agent
      .post('/api/galeri')
      .set('X-CSRF-Token', csrfToken)
      .field('judul', 'Foto CSRF Valid')
      .attach('foto', buf, { filename: 'test.png' })
      .expect(201);
    assert.ok(res.body.success);
  });

  test('DELETE /api/galeri/:id without CSRF → 403', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(env);
    // Upload first
    const buf = await createPng();
    const createRes = await agent
      .post('/api/galeri')
      .set('X-CSRF-Token', csrfToken)
      .field('judul', 'Del Test')
      .attach('foto', buf, { filename: 'del.png' })
      .expect(201);
    const id = createRes.body.data.id;

    // Delete without CSRF
    await agent.delete(`/api/galeri/${id}`).expect(403);
  });

  // ---- Pengurus -------------------------------------------------------------

  test('PUT /api/pengurus/:id without CSRF → 403', async () => {
    const { agent } = await createAuthenticatedAgent(env);
    const id = seedPengurus(env.db);
    await agent
      .put(`/api/pengurus/${id}`)
      // no CSRF
      .field('jabatan', 'Wakil')
      .field('nama', 'Sari')
      .expect(403);
  });

  test('PUT /api/pengurus/:id with valid CSRF → succeeds (200)', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(env);
    const id = seedPengurus(env.db);
    const res = await agent
      .put(`/api/pengurus/${id}`)
      .set('X-CSRF-Token', csrfToken)
      .field('jabatan', 'Wakil')
      .field('nama', 'Sari Updated')
      .expect(200);
    assert.ok(res.body.success);
  });

  // ---- Unauthenticated requests still get 401 (not 403) --------------------

  test('POST /api/berita unauthenticated → 401 (not CSRF 403)', async () => {
    const res = await request(env.app)
      .post('/api/berita')
      .field('judul', 'Anon')
      .field('isi', 'Anon')
      .expect(401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// TASK 2 — Admin draft scope security
// ---------------------------------------------------------------------------

describe('Phase 1-B: Admin draft scope validation', () => {
  let env;

  beforeEach(() => { env = createTestEnvironment(); });
  afterEach(() => { env.cleanup(); });

  test('anonymous ?scope=admin does NOT see draft articles', async () => {
    seedDraftBerita(env.db, 'anon-draft');
    const res = await request(env.app)
      .get('/api/berita?scope=admin')
      .expect(200);
    const drafts = res.body.data.filter(b => b.status === 'draft');
    assert.equal(drafts.length, 0, 'Anonymous must not see drafts');
  });

  test('anonymous ?scope=admin cannot fetch draft by slug', async () => {
    seedDraftBerita(env.db, 'anon-draft-slug');
    await request(env.app)
      .get('/api/berita/anon-draft-slug?scope=admin')
      .expect(404);
  });

  test('authenticated admin + ?scope=admin sees draft articles', async () => {
    seedDraftBerita(env.db, 'admin-draft');
    const { agent, csrfToken } = await createAuthenticatedAgent(env);

    // Suppress lint: csrfToken already consumed in createAuthenticatedAgent
    void csrfToken;

    const res = await agent
      .get('/api/berita?scope=admin')
      .expect(200);
    const drafts = res.body.data.filter(b => b.status === 'draft');
    assert.ok(drafts.length > 0, 'Authenticated admin must see drafts');
  });

  test('authenticated admin + ?scope=admin can fetch draft by slug', async () => {
    seedDraftBerita(env.db, 'admin-draft-slug');
    const { agent } = await createAuthenticatedAgent(env);
    const res = await agent
      .get('/api/berita/admin-draft-slug?scope=admin')
      .expect(200);
    assert.equal(res.body.data.status, 'draft');
  });

  test('expired admin session → ?scope=admin does NOT see drafts', async () => {
    seedDraftBerita(env.db, 'expired-draft');
    const { agent } = await createAuthenticatedAgent(env);

    // Back-date authenticatedAt to simulate 13-hour-old session
    const sid = await new Promise((resolve) => {
      // Read the sid from the session cookie
      agent.jar.getCookies('http://127.0.0.1').then
        ? resolve(null)     // not relevant; manipulate DB directly
        : resolve(null);
    });
    void sid;

    // Directly manipulate session store to expire the session
    // We can't easily expire it without access to the session ID,
    // so we simulate expiry by directly querying and altering authenticatedAt.
    // Instead: use the DB to set authenticatedAt 13 hours ago for all sessions.
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
    env.sessionDb
      .prepare("UPDATE sessions SET sess = json_set(sess, '$.authenticatedAt', ?) WHERE 1=1")
      .run(thirteenHoursAgo);

    const res = await agent
      .get('/api/berita?scope=admin')
      .expect(200);
    const drafts = res.body.data.filter(b => b.status === 'draft');
    assert.equal(drafts.length, 0, 'Expired session must not see drafts');
  });

  test('public GET /api/berita without scope shows only terbit', async () => {
    seedDraftBerita(env.db, 'pub-draft');
    seedTerbitBerita(env.db, 'pub-terbit');
    const res = await request(env.app).get('/api/berita').expect(200);
    const allDraft = res.body.data.every(b => b.status === 'terbit');
    assert.ok(allDraft, 'Public endpoint must only return terbit');
  });
});

// ---------------------------------------------------------------------------
// TASK 3 — Multer multipart limits
// ---------------------------------------------------------------------------

describe('Phase 1-C: Multer multipart limits', () => {
  let env;

  beforeEach(() => { env = createTestEnvironment(); });
  afterEach(() => { env.cleanup(); });

  test('valid 100x100 PNG upload still works after hardening', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(env);
    const buf = await createPng();

    const res = await agent
      .post('/api/galeri')
      .set('X-CSRF-Token', csrfToken)
      .field('judul', 'Multer limit test')
      .attach('foto', buf, { filename: 'ok.png' })
      .expect(201);

    assert.ok(res.body.success);
  });

  test('file exceeding 5 MiB is rejected with 413', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent(env);

    const bigBuf = Buffer.alloc(5 * 1024 * 1024 + 1, 0xab);

    const res = await agent
      .post('/api/galeri')
      .set('X-CSRF-Token', csrfToken)
      .field('judul', 'Too big')
      .attach('foto', bigBuf, { filename: 'big.png' })
      .expect(413);

    assert.equal(res.status, 413);
  });
});