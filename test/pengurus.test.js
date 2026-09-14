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

describe('Phase 4: Pengurus API', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  async function createPng(
    r = 30,
    g = 120,
    b = 200
  ) {
    return sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: {
          r,
          g,
          b,
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

  function insertPengurus({
    jabatan = 'Ketua',
    nama = 'Budi Santoso',
    gelar = 'S.Kom.',
    foto = null,
    fotoAlt = 'Foto Budi Santoso',
    bio = 'Bio pengurus',
    urutan = 1,
  } = {}) {
    const result = env.db
      .prepare(`
        INSERT INTO pengurus (
          jabatan,
          nama,
          gelar,
          foto,
          foto_alt,
          bio,
          urutan
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        jabatan,
        nama,
        gelar,
        foto,
        fotoAlt,
        bio,
        urutan
      );

    return Number(
      result.lastInsertRowid
    );
  }

  function getPengurusUploadDir() {
    return path.join(
      env.tempDir,
      'uploads',
      'pengurus'
    );
  }

  async function createStoredPhoto(
    filename = 'old-photo.png'
  ) {
    const uploadDir =
      getPengurusUploadDir();

    fs.mkdirSync(
      uploadDir,
      { recursive: true }
    );

    const buffer =
      await createPng(
        180,
        40,
        40
      );

    const filePath =
      path.join(
        uploadDir,
        filename
      );

    fs.writeFileSync(
      filePath,
      buffer
    );

    return {
      filePath,
      logicalPath:
        `pengurus/${filename}`,
    };
  }

  async function updatePengurus(
    agent,
    id,
    {
      jabatan,
      nama,
      gelar,
      fotoAlt,
      bio,
      urutan,
      foto,
      filename = 'pengurus.png',
    } = {}
  ) {
    const csrfToken =
      await getCsrfToken(agent);

    let req = agent
      .put(
        `/api/pengurus/${id}`
      )
      .set(
        'X-CSRF-Token',
        csrfToken
      );

    if (jabatan !== undefined) {
      req = req.field(
        'jabatan',
        jabatan
      );
    }

    if (nama !== undefined) {
      req = req.field(
        'nama',
        nama
      );
    }

    if (gelar !== undefined) {
      req = req.field(
        'gelar',
        gelar
      );
    }

    if (fotoAlt !== undefined) {
      req = req.field(
        'foto_alt',
        fotoAlt
      );
    }

    if (bio !== undefined) {
      req = req.field(
        'bio',
        bio
      );
    }

    if (urutan !== undefined) {
      req = req.field(
        'urutan',
        String(urutan)
      );
    }

    if (foto) {
      req = req.attach(
        'foto',
        foto,
        { filename }
      );
    }

    return req;
  }

  test(
    'GET /api/pengurus is public and ordered by urutan',
    async () => {
      insertPengurus({
        nama: 'Pengurus Kedua',
        jabatan: 'Sekretaris',
        urutan: 2,
      });

      insertPengurus({
        nama: 'Pengurus Pertama',
        jabatan: 'Ketua',
        urutan: 1,
      });

      const res =
        await request(env.app)
          .get('/api/pengurus')
          .expect(200);

      assert.equal(
        res.body.success,
        true
      );

      assert.equal(
        res.body.data.length,
        2
      );

      assert.equal(
        res.body.data[0].nama,
        'Pengurus Pertama'
      );

      assert.equal(
        res.body.data[1].nama,
        'Pengurus Kedua'
      );
    }
  );

  test(
    'PUT /api/pengurus/:id requires authentication',
    async () => {
      const id =
        insertPengurus();

      const agent =
        request.agent(env.app);

      const csrfToken =
        await getCsrfToken(agent);

      await agent
        .put(
          `/api/pengurus/${id}`
        )
        .set(
          'X-CSRF-Token',
          csrfToken
        )
        .field(
          'nama',
          'Tidak Diizinkan'
        )
        .expect(401);

      const row =
        env.db.prepare(`
          SELECT nama
          FROM pengurus
          WHERE id = ?
        `).get(id);

      assert.equal(
        row.nama,
        'Budi Santoso'
      );
    }
  );

  test(
    'PUT updates pengurus without changing existing photo',
    async () => {
      const oldPhoto =
        await createStoredPhoto(
          'existing.png'
        );

      const id =
        insertPengurus({
          foto:
            oldPhoto.logicalPath,
        });

      const agent =
        await createAuthenticatedAgent();

      const res =
        await updatePengurus(
          agent,
          id,
          {
            jabatan:
              'Ketua Umum',
            nama:
              'Budi Santoso Baru',
            gelar:
              'S.Kom., M.Kom.',
            fotoAlt:
              'Foto Ketua Umum',
            bio:
              'Bio diperbarui',
            urutan: 3,
          }
        );

      assert.equal(
        res.status,
        200
      );

      assert.equal(
        res.body.success,
        true
      );

      assert.equal(
        res.body.data.nama,
        'Budi Santoso Baru'
      );

      assert.equal(
        res.body.data.jabatan,
        'Ketua Umum'
      );

      assert.equal(
        res.body.data.urutan,
        3
      );

      assert.equal(
        res.body.data.foto,
        oldPhoto.logicalPath
      );

      assert.equal(
        fs.existsSync(
          oldPhoto.filePath
        ),
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
          'PENGURUS_UPDATE',
          'pengurus',
          String(id)
        );

      assert.ok(log);
    }
  );

  test(
    'PUT replaces photo and removes old managed photo',
    async () => {
      const oldPhoto =
        await createStoredPhoto(
          'old.png'
        );

      const id =
        insertPengurus({
          foto:
            oldPhoto.logicalPath,
        });

      const agent =
        await createAuthenticatedAgent();

      const newImage =
        await createPng(
          20,
          200,
          50
        );

      const res =
        await updatePengurus(
          agent,
          id,
          {
            nama:
              'Budi Foto Baru',
            fotoAlt:
              'Foto baru',
            foto: newImage,
            filename:
              'replacement.png',
          }
        );

      assert.equal(
        res.status,
        200
      );

      assert.equal(
        res.body.success,
        true
      );

      assert.match(
        res.body.data.foto,
        /^pengurus\/[0-9a-f-]{36}\.png$/i
      );

      assert.equal(
        res.body.data.foto_url,
        `/media/images/${res.body.data.foto}`
      );

      assert.notEqual(
        res.body.data.foto,
        oldPhoto.logicalPath
      );

      assert.equal(
        fs.existsSync(
          oldPhoto.filePath
        ),
        false
      );

      const newFile =
        path.join(
          getPengurusUploadDir(),
          path.basename(
            res.body.data.foto
          )
        );

      assert.equal(
        fs.existsSync(newFile),
        true
      );

      const row =
        env.db.prepare(`
          SELECT foto
          FROM pengurus
          WHERE id = ?
        `).get(id);

      assert.equal(
        row.foto,
        res.body.data.foto
      );
    }
  );

  test(
    'PUT rejects invalid image and keeps old photo untouched',
    async () => {
      const oldPhoto =
        await createStoredPhoto(
          'keep-me.png'
        );

      const id =
        insertPengurus({
          foto:
            oldPhoto.logicalPath,
        });

      const agent =
        await createAuthenticatedAgent();

      const invalid =
        Buffer.from(
          'not-a-real-image'
        );

      const res =
        await updatePengurus(
          agent,
          id,
          {
            foto: invalid,
            filename:
              'fake.png',
          }
        );

      assert.ok(
        res.status >= 400 &&
        res.status < 500
      );

      const row =
        env.db.prepare(`
          SELECT foto
          FROM pengurus
          WHERE id = ?
        `).get(id);

      assert.equal(
        row.foto,
        oldPhoto.logicalPath
      );

      assert.equal(
        fs.existsSync(
          oldPhoto.filePath
        ),
        true
      );

      const files =
        fs.readdirSync(
          getPengurusUploadDir()
        );

      assert.deepEqual(
        files,
        ['keep-me.png']
      );
    }
  );

  test(
    'PUT rejects invalid urutan without changing data',
    async () => {
      const id =
        insertPengurus({
          urutan: 2,
        });

      const agent =
        await createAuthenticatedAgent();

      const res =
        await updatePengurus(
          agent,
          id,
          {
            urutan: -1,
          }
        );

      assert.equal(
        res.status,
        400
      );

      assert.equal(
        res.body.error.code,
        'INVALID_ORDER'
      );

      const row =
        env.db.prepare(`
          SELECT urutan
          FROM pengurus
          WHERE id = ?
        `).get(id);

      assert.equal(
        row.urutan,
        2
      );
    }
  );

  test(
    'PUT returns 404 for nonexistent pengurus',
    async () => {
      const agent =
        await createAuthenticatedAgent();

      const res =
        await updatePengurus(
          agent,
          999999,
          {
            nama:
              'Tidak Ada',
          }
        );

      assert.equal(
        res.status,
        404
      );

      assert.equal(
        res.body.error.code,
        'PENGURUS_NOT_FOUND'
      );
    }
  );

  test(
    'database failure removes new upload and keeps old photo',
    async () => {
      const oldPhoto =
        await createStoredPhoto(
          'original.png'
        );

      const id =
        insertPengurus({
          foto:
            oldPhoto.logicalPath,
        });

      const agent =
        await createAuthenticatedAgent();

      const replacement =
        await createPng(
          100,
          200,
          20
        );

      /*
       * Force DB failure after image
       * processing by removing the
       * activity_logs table.
       */
      env.db.exec(
        'DROP TABLE activity_logs'
      );

      const res =
        await updatePengurus(
          agent,
          id,
          {
            nama:
              'Harus Rollback',
            foto:
              replacement,
            filename:
              'new.png',
          }
        );

      assert.equal(
        res.status,
        500
      );

      const row =
        env.db.prepare(`
          SELECT
            nama,
            foto
          FROM pengurus
          WHERE id = ?
        `).get(id);

      assert.equal(
        row.nama,
        'Budi Santoso'
      );

      assert.equal(
        row.foto,
        oldPhoto.logicalPath
      );

      assert.equal(
        fs.existsSync(
          oldPhoto.filePath
        ),
        true
      );

      const files =
        fs.readdirSync(
          getPengurusUploadDir()
        );

      assert.deepEqual(
        files,
        ['original.png']
      );
    }
  );
});