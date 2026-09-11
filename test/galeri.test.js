const {
  test,
  describe,
  beforeEach,
  afterEach,
} = require('node:test');

const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const {
  createTestEnvironment,
} = require('./helpers/setup');

describe('Phase 4: Galeri API', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  async function createPng() {
    return sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: {
          r: 20,
          g: 120,
          b: 200,
        },
      },
    })
      .png()
      .toBuffer();
  }

  async function getCsrfToken(agent) {
    const res = await agent
      .get('/api/auth/csrf-token')
      .expect(200);

    return res.body.data.csrfToken;
  }

  async function createAuthenticatedAgent() {
    const agent = request.agent(env.app);

    await agent
      .post('/api/auth/setup')
      .set(
        'X-Setup-Token',
        process.env.SETUP_TOKEN
      )
      .send({
        username: 'admin',
        password: 'ValidPassword123!',
      })
      .expect(201);

    const csrfToken =
      await getCsrfToken(agent);

    await agent
      .post('/api/auth/login')
      .set(
        'X-CSRF-Token',
        csrfToken
      )
      .send({
        username: 'admin',
        password: 'ValidPassword123!',
      })
      .expect(200);

    return agent;
  }

  async function uploadGaleri(
    agent,
    {
      buffer,
      filename = 'foto.png',
      judul = 'Foto Test',
      caption = 'Caption Test',
      altText = 'Alt Test',
      kategori = 'Kegiatan',
    } = {}
  ) {
    const csrfToken =
      await getCsrfToken(agent);

    return agent
      .post('/api/galeri')
      .set(
        'X-CSRF-Token',
        csrfToken
      )
      .field('judul', judul)
      .field('caption', caption)
      .field('alt_text', altText)
      .field('kategori', kategori)
      .attach(
        'foto',
        buffer,
        { filename }
      );
  }

  test(
    'GET /api/galeri is public and initially empty',
    async () => {
      const res = await request(env.app)
        .get('/api/galeri')
        .expect(200);

      assert.equal(
        res.body.success,
        true
      );

      assert.deepEqual(
        res.body.data,
        []
      );
    }
  );

  test(
    'POST /api/galeri requires authentication',
    async () => {
      const agent =
        request.agent(env.app);

      const csrfToken =
        await getCsrfToken(agent);

      const image =
        await createPng();

      await agent
        .post('/api/galeri')
        .set(
          'X-CSRF-Token',
          csrfToken
        )
        .field(
          'judul',
          'Unauthorized'
        )
        .attach(
          'foto',
          image,
          {
            filename:
              'unauthorized.png',
          }
        )
        .expect(401);

      const row =
        env.db.prepare(`
          SELECT COUNT(*) AS count
          FROM galeri
        `).get();

      assert.equal(
        row.count,
        0
      );
    }
  );

  test(
    'POST creates galeri row, image, and activity log',
    async () => {
      const agent =
        await createAuthenticatedAgent();

      const image =
        await createPng();

      const res =
        await uploadGaleri(
          agent,
          {
            buffer: image,
          }
        );

      assert.equal(
        res.status,
        201
      );

      assert.equal(
        res.body.success,
        true
      );

      assert.equal(
        res.body.data.judul,
        'Foto Test'
      );

      assert.equal(
        res.body.data.kategori,
        'Kegiatan'
      );

      assert.match(
        res.body.data.image_path,
        /^galeri\/[0-9a-f-]{36}\.png$/i
      );

      assert.equal(
        res.body.data.url,
        `/media/images/${res.body.data.image_path}`
      );

      const row =
        env.db.prepare(`
          SELECT *
          FROM galeri
          WHERE id = ?
        `).get(
          res.body.data.id
        );

      assert.ok(row);

      const filename =
        path.basename(
          row.image_path
        );

      const imageFile =
        path.join(
          env.tempDir,
          'uploads',
          'galeri',
          filename
        );

      assert.equal(
        fs.existsSync(imageFile),
        true
      );

      const log =
        env.db.prepare(`
          SELECT *
          FROM activity_logs
          WHERE action = ?
            AND entity_type = ?
            AND entity_id = ?
        `).get(
          'GALERI_CREATE',
          'galeri',
          String(row.id)
        );

      assert.ok(log);
    }
  );

  test(
    'POST rejects invalid image without orphan data',
    async () => {
      const agent =
        await createAuthenticatedAgent();

      const invalid =
        Buffer.from(
          'not-a-real-image'
        );

      const res =
        await uploadGaleri(
          agent,
          {
            buffer: invalid,
            filename: 'fake.png',
          }
        );

      assert.ok(
        res.status >= 400 &&
        res.status < 500
      );

      const row =
        env.db.prepare(`
          SELECT COUNT(*) AS count
          FROM galeri
        `).get();

      assert.equal(
        row.count,
        0
      );

      const uploadDir =
        path.join(
          env.tempDir,
          'uploads',
          'galeri'
        );

      const files =
        fs.existsSync(uploadDir)
          ? fs.readdirSync(uploadDir)
          : [];

      assert.deepEqual(
        files,
        []
      );
    }
  );

  test(
    'DELETE nonexistent galeri returns 404',
    async () => {
      const agent =
        await createAuthenticatedAgent();

      const csrfToken =
        await getCsrfToken(agent);

      const res = await agent
        .delete('/api/galeri/999999')
        .set(
          'X-CSRF-Token',
          csrfToken
        )
        .expect(404);

      assert.equal(
        res.body.success,
        false
      );

      assert.equal(
        res.body.error.code,
        'GALERI_NOT_FOUND'
      );
    }
  );

  test(
    'DELETE removes row, image, and creates activity log',
    async () => {
      const agent =
        await createAuthenticatedAgent();

      const image =
        await createPng();

      const createRes =
        await uploadGaleri(
          agent,
          {
            buffer: image,
          }
        );

      assert.equal(
        createRes.status,
        201
      );

      const id =
        createRes.body.data.id;

      const filename =
        path.basename(
          createRes.body.data.image_path
        );

      const imageFile =
        path.join(
          env.tempDir,
          'uploads',
          'galeri',
          filename
        );

      assert.equal(
        fs.existsSync(imageFile),
        true
      );

      const csrfToken =
        await getCsrfToken(agent);

      await agent
        .delete(
          `/api/galeri/${id}`
        )
        .set(
          'X-CSRF-Token',
          csrfToken
        )
        .expect(200);

      const row =
        env.db.prepare(`
          SELECT id
          FROM galeri
          WHERE id = ?
        `).get(id);

      assert.equal(
        row,
        undefined
      );

      assert.equal(
        fs.existsSync(imageFile),
        false
      );

      const log =
        env.db.prepare(`
          SELECT *
          FROM activity_logs
          WHERE action = ?
            AND entity_type = ?
            AND entity_id = ?
        `).get(
          'GALERI_DELETE',
          'galeri',
          String(id)
        );

      assert.ok(log);
    }
  );

  test(
    'database failure during POST removes uploaded image',
    async () => {
      const agent =
        await createAuthenticatedAgent();

      const image =
        await createPng();

      env.db.exec(
        'DROP TABLE galeri'
      );

      const res =
        await uploadGaleri(
          agent,
          {
            buffer: image,
          }
        );

      assert.equal(
        res.status,
        500
      );

      const uploadDir =
        path.join(
          env.tempDir,
          'uploads',
          'galeri'
        );

      const files =
        fs.existsSync(uploadDir)
          ? fs.readdirSync(uploadDir)
          : [];

      assert.deepEqual(
        files,
        []
      );
    }
  );
});