const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const { createTestEnvironment } = require('./helpers/setup');

describe('Phase 4: Berita API', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  async function createPng(r = 30, g = 120, b = 200) {
    return sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r, g, b },
      },
    }).png().toBuffer();
  }

  async function getCsrfToken(agent) {
    const res = await agent.get('/api/auth/csrf-token').expect(200);
    return res.body.data.csrfToken;
  }

  async function createAuthenticatedAgent() {
    const agent = request.agent(env.app);

    await agent
      .post('/api/auth/setup')
      .set('X-Setup-Token', process.env.SETUP_TOKEN)
      .send({
        username: 'admin',
        password: 'ValidPassword123!',
      })
      .expect(201);

    const csrfToken = await getCsrfToken(agent);

    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({
        username: 'admin',
        password: 'ValidPassword123!',
      })
      .expect(200);

    return agent;
  }

  async function createBerita(agent, {
    judul = 'Berita Test',
    isi = 'Isi berita test.',
    ringkasan = 'Ringkasan test.',
    kategori = 'Berita',
    status = 'draft',
    thumbnail = null,
    filename = 'thumbnail.png',
  } = {}) {
    const csrfToken = await getCsrfToken(agent);

    let req = agent
      .post('/api/berita')
      .set('X-CSRF-Token', csrfToken)
      .field('judul', judul)
      .field('isi', isi)
      .field('ringkasan', ringkasan)
      .field('kategori', kategori)
      .field('status', status);

    if (thumbnail) {
      req = req.attach('thumbnail', thumbnail, { filename });
    }

    return req;
  }

  test('public only sees published content', async () => {
    env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, kategori, status, published_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'Published',
      'published-test',
      'Published body',
      'Berita',
      'terbit',
      new Date().toISOString()
    );

    env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, kategori, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'Draft',
      'draft-test',
      'Draft body',
      'Artikel',
      'draft'
    );

    const listRes = await request(env.app)
      .get('/api/berita')
      .expect(200);

    assert.equal(listRes.body.success, true);
    assert.equal(listRes.body.data.length, 1);
    assert.equal(listRes.body.data[0].slug, 'published-test');

    await request(env.app)
      .get('/api/berita/draft-test')
      .expect(404);

    const publishedRes = await request(env.app)
      .get('/api/berita/published-test')
      .expect(200);

    assert.equal(publishedRes.body.data.status, 'terbit');
  });

  test('admin scope can see drafts and published content', async () => {
    const agent = await createAuthenticatedAgent();

    env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, kategori, status)
      VALUES (?, ?, ?, ?, ?)
    `).run('Draft', 'draft-admin', 'Draft body', 'Artikel', 'draft');

    env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, kategori, status, published_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'Published',
      'published-admin',
      'Published body',
      'Berita',
      'terbit',
      new Date().toISOString()
    );

    const publicScope = await agent
      .get('/api/berita')
      .expect(200);

    assert.equal(publicScope.body.data.length, 1);

    const adminScope = await agent
      .get('/api/berita?scope=admin')
      .expect(200);

    assert.equal(adminScope.body.data.length, 2);

    await agent
      .get('/api/berita/draft-admin')
      .expect(404);

    const draftDetail = await agent
      .get('/api/berita/draft-admin?scope=admin')
      .expect(200);

    assert.equal(draftDetail.body.data.status, 'draft');
  });

  test('public can filter content by Berita or Artikel', async () => {
    const publishedAt = new Date().toISOString();

    const insert = env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, kategori, status, published_at)
      VALUES (?, ?, ?, ?, 'terbit', ?)
    `);

    insert.run('Berita A', 'berita-a', 'Isi', 'Berita', publishedAt);
    insert.run('Artikel A', 'artikel-a', 'Isi', 'Artikel', publishedAt);

    const beritaRes = await request(env.app)
      .get('/api/berita?kategori=Berita')
      .expect(200);

    assert.equal(beritaRes.body.data.length, 1);
    assert.equal(beritaRes.body.data[0].kategori, 'Berita');

    const artikelRes = await request(env.app)
      .get('/api/berita?kategori=Artikel')
      .expect(200);

    assert.equal(artikelRes.body.data.length, 1);
    assert.equal(artikelRes.body.data[0].kategori, 'Artikel');
  });

  test('POST /api/berita requires authentication', async () => {
    const agent = request.agent(env.app);
    const csrfToken = await getCsrfToken(agent);
    const image = await createPng();

    await agent
      .post('/api/berita')
      .set('X-CSRF-Token', csrfToken)
      .field('judul', 'Unauthorized')
      .field('isi', 'Unauthorized body')
      .field('kategori', 'Berita')
      .attach('thumbnail', image, { filename: 'unauthorized.png' })
      .expect(401);

    const count = env.db.prepare('SELECT COUNT(*) AS count FROM berita').get();
    assert.equal(count.count, 0);
  });

  test('POST creates published Berita, thumbnail, and activity log', async () => {
    const agent = await createAuthenticatedAgent();
    const image = await createPng();

    const res = await createBerita(agent, {
      kategori: 'Berita',
      status: 'terbit',
      thumbnail: image,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.judul, 'Berita Test');
    assert.equal(res.body.data.kategori, 'Berita');
    assert.equal(res.body.data.status, 'terbit');
    assert.ok(res.body.data.published_at);
    assert.match(res.body.data.thumbnail, /^berita\/[0-9a-f-]{36}\.png$/i);
    assert.equal(
      res.body.data.thumbnail_url,
      `/media/images/${res.body.data.thumbnail}`
    );

    const row = env.db.prepare('SELECT * FROM berita WHERE id = ?')
      .get(res.body.data.id);

    assert.ok(row);

    const imagePath = path.join(
      env.tempDir,
      'uploads',
      'berita',
      path.basename(row.thumbnail)
    );

    assert.equal(fs.existsSync(imagePath), true);

    const log = env.db.prepare(`
      SELECT *
      FROM activity_logs
      WHERE action = ? AND entity_type = ? AND entity_id = ?
    `).get('BERITA_CREATE', 'berita', String(row.id));

    assert.ok(log);
  });

  test('POST can create Artikel', async () => {
    const agent = await createAuthenticatedAgent();

    const res = await createBerita(agent, {
      judul: 'Artikel Edukasi',
      isi: 'Isi artikel edukasi.',
      kategori: 'Artikel',
      status: 'terbit',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.kategori, 'Artikel');
    assert.equal(res.body.data.status, 'terbit');
  });

  test('POST rejects category outside Berita or Artikel', async () => {
    const agent = await createAuthenticatedAgent();

    const res = await createBerita(agent, {
      kategori: 'Pengumuman',
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_CATEGORY');

    const count = env.db.prepare('SELECT COUNT(*) AS count FROM berita').get();
    assert.equal(count.count, 0);
  });

  test('POST rejects invalid thumbnail without orphan data', async () => {
    const agent = await createAuthenticatedAgent();
    const invalid = Buffer.from('not-a-real-image');

    const res = await createBerita(agent, {
      thumbnail: invalid,
      filename: 'fake.png',
    });

    assert.ok(res.status >= 400 && res.status < 500);

    const count = env.db.prepare('SELECT COUNT(*) AS count FROM berita').get();
    assert.equal(count.count, 0);

    const uploadDir = path.join(env.tempDir, 'uploads', 'berita');
    const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];

    assert.deepEqual(files, []);
  });

  test('PUT updates content, keeps slug, replaces thumbnail, and logs update', async () => {
    const agent = await createAuthenticatedAgent();
    const firstImage = await createPng(200, 30, 30);

    const createRes = await createBerita(agent, {
      kategori: 'Berita',
      thumbnail: firstImage,
    });

    assert.equal(createRes.status, 201);

    const id = createRes.body.data.id;
    const oldSlug = createRes.body.data.slug;
    const oldThumbnail = createRes.body.data.thumbnail;

    const oldFile = path.join(
      env.tempDir,
      'uploads',
      'berita',
      path.basename(oldThumbnail)
    );

    assert.equal(fs.existsSync(oldFile), true);

    const secondImage = await createPng(20, 200, 50);
    const csrfToken = await getCsrfToken(agent);

    const updateRes = await agent
      .put(`/api/berita/${id}`)
      .set('X-CSRF-Token', csrfToken)
      .field('judul', 'Judul Baru')
      .field('kategori', 'Artikel')
      .field('status', 'terbit')
      .attach('thumbnail', secondImage, { filename: 'replacement.png' });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.judul, 'Judul Baru');
    assert.equal(updateRes.body.data.slug, oldSlug);
    assert.equal(updateRes.body.data.kategori, 'Artikel');
    assert.equal(updateRes.body.data.status, 'terbit');
    assert.ok(updateRes.body.data.published_at);
    assert.notEqual(updateRes.body.data.thumbnail, oldThumbnail);
    assert.equal(fs.existsSync(oldFile), false);

    const newFile = path.join(
      env.tempDir,
      'uploads',
      'berita',
      path.basename(updateRes.body.data.thumbnail)
    );

    assert.equal(fs.existsSync(newFile), true);

    const log = env.db.prepare(`
      SELECT *
      FROM activity_logs
      WHERE action = ? AND entity_type = ? AND entity_id = ?
    `).get('BERITA_UPDATE', 'berita', String(id));

    assert.ok(log);
  });

  test('DELETE removes content, thumbnail, and records activity log', async () => {
    const agent = await createAuthenticatedAgent();
    const image = await createPng();

    const createRes = await createBerita(agent, { thumbnail: image });
    assert.equal(createRes.status, 201);

    const id = createRes.body.data.id;
    const imageFile = path.join(
      env.tempDir,
      'uploads',
      'berita',
      path.basename(createRes.body.data.thumbnail)
    );

    assert.equal(fs.existsSync(imageFile), true);

    const csrfToken = await getCsrfToken(agent);

    await agent
      .delete(`/api/berita/${id}`)
      .set('X-CSRF-Token', csrfToken)
      .expect(200);

    const row = env.db.prepare('SELECT id FROM berita WHERE id = ?').get(id);
    assert.equal(row, undefined);
    assert.equal(fs.existsSync(imageFile), false);

    const log = env.db.prepare(`
      SELECT *
      FROM activity_logs
      WHERE action = ? AND entity_type = ? AND entity_id = ?
    `).get('BERITA_DELETE', 'berita', String(id));

    assert.ok(log);
  });

  test('database failure during POST removes uploaded thumbnail', async () => {
    const agent = await createAuthenticatedAgent();
    const image = await createPng();

    env.db.exec('DROP TABLE berita');

    const res = await createBerita(agent, { thumbnail: image });
    assert.equal(res.status, 500);

    const uploadDir = path.join(env.tempDir, 'uploads', 'berita');
    const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];

    assert.deepEqual(files, []);
  });
});
