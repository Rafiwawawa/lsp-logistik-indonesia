// test/phase3_image.test.js
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const {
  createMulterForCategory,
  processImage,
} = require('../middleware/imageProcessor');

const serveImage = require('../middleware/serveImage');
const { errorHandler } = require('../middleware/errorHandler');

const uploadDir = path.resolve(
  __dirname,
  '..',
  'uploads',
  'galeri'
);

async function createImage(format) {
  const base = sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: {
        r: 255,
        g: 0,
        b: 0,
      },
    },
  });

  if (format === 'jpeg') return base.jpeg().toBuffer();
  if (format === 'png') return base.png().toBuffer();
  if (format === 'webp') return base.webp().toBuffer();

  return base.toBuffer();
}

function createPhase3App() {
  const app = express();

  const upload = createMulterForCategory('galeri');

  app.post(
    '/api/test-image-upload',
    upload.single('foto'),
    async (req, res, next) => {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'IMAGE_REQUIRED',
            message: 'File gambar diperlukan',
          },
        });
      }

      try {
        await processImage(req.file.path);

        return res.json({
          success: true,
          filename: req.file.filename,
          url: `/media/images/galeri/${req.file.filename}`,
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  app.get(
    '/media/images/:category/:filename',
    serveImage
  );

  app.use(errorHandler);

  return app;
}

describe('Phase 3: Secure Image Pipeline', () => {
  let app;
  let filesBefore;

  beforeEach(() => {
    fs.mkdirSync(uploadDir, {
      recursive: true,
    });

    filesBefore = new Set(
      fs.readdirSync(uploadDir)
    );

    app = createPhase3App();
  });

  afterEach(() => {
    if (!fs.existsSync(uploadDir)) {
      return;
    }

    const currentFiles = fs.readdirSync(uploadDir);

    for (const filename of currentFiles) {
      if (!filesBefore.has(filename)) {
        try {
          fs.unlinkSync(
            path.join(uploadDir, filename)
          );
        } catch {
          // Cleanup must not hide test failures.
        }
      }
    }
  });

  async function uploadRequest(
    buffer,
    filename
  ) {
    return request(app)
      .post('/api/test-image-upload')
      .attach('foto', buffer, {
        filename,
      });
  }

  async function uploadSuccess(
    buffer,
    filename
  ) {
    const res = await uploadRequest(
      buffer,
      filename
    );

    assert.equal(
      res.status,
      200,
      `Expected successful upload, got ${res.status}: ${JSON.stringify(res.body)}`
    );

    assert.equal(res.body.success, true);
    assert.ok(res.body.filename);
    assert.ok(res.body.url);

    return res;
  }

  function assertRejected(res) {
    assert.ok(
      res.status >= 400 &&
        res.status < 500,
      `Expected controlled 4xx rejection, got ${res.status}: ${JSON.stringify(res.body)}`
    );
  }

  test('accepts valid JPEG', async () => {
    const buffer =
      await createImage('jpeg');

    const res = await uploadSuccess(
      buffer,
      'valid.jpg'
    );

    await request(app)
      .get(res.body.url)
      .expect(200);
  });

  test('accepts valid PNG', async () => {
    const buffer =
      await createImage('png');

    await uploadSuccess(
      buffer,
      'valid.png'
    );
  });

  test('accepts valid static WebP', async () => {
    const buffer =
      await createImage('webp');

    await uploadSuccess(
      buffer,
      'valid.webp'
    );
  });

  test('rejects fake extension with wrong magic bytes', async () => {
    const buffer =
      Buffer.from('not-an-image');

    const res = await uploadRequest(
      buffer,
      'fake.jpg'
    );

    assertRejected(res);
  });

  test('rejects corrupted image', async () => {
    const valid =
      await createImage('png');

    const corrupted =
      valid.subarray(
        0,
        Math.min(32, valid.length)
      );

    const res = await uploadRequest(
      corrupted,
      'corrupt.png'
    );

    assertRejected(res);
  });

  test('rejects SVG masquerading as PNG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    );

    const res = await uploadRequest(
      svg,
      'image.png'
    );

    assertRejected(res);
  });

  test('rejects oversized >5MiB', async () => {
    const oversized = Buffer.alloc(
      5 * 1024 * 1024 + 1
    );

    const res = await uploadRequest(
      oversized,
      'oversized.jpg'
    );

    assert.equal(res.status, 413);
  });

  test('rejects excessive pixel dimensions', async () => {
    const hugeImage = await sharp({
      create: {
        width: 7000,
        height: 7000,
        channels: 3,
        background: {
          r: 0,
          g: 0,
          b: 255,
        },
      },
    })
      .png()
      .toBuffer();

    const res = await uploadRequest(
      hugeImage,
      'huge.png'
    );

    assertRejected(res);
  });

  test('rejects animated or malformed WebP payload', async () => {
    const malformedWebP = Buffer.from(
      'RIFF\x1A\x00\x00\x00WEBPVP8X\x0E\x00\x00\x00ANMF',
      'binary'
    );

    const res = await uploadRequest(
      malformedWebP,
      'animated.webp'
    );

    assertRejected(res);
  });

  test('prevents invalid category and path traversal', async () => {
    const buffer =
      await createImage('png');

    const res = await uploadSuccess(
      buffer,
      'traversal.png'
    );

    const filename =
      res.body.filename;

    await request(app)
      .get(
        `/media/images/invalid/${filename}`
      )
      .expect(400);

    const traversal = await request(app)
      .get(
        `/media/images/galeri/%2e%2e%2f${filename}`
      );

    assert.notEqual(
      traversal.status,
      200
    );
  });

  test('stores filename as UUID', async () => {
    const buffer =
      await createImage('png');

    const res = await uploadSuccess(
      buffer,
      'foto.png'
    );

    const uuidFilenamePattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

    assert.match(
      res.body.filename,
      uuidFilenamePattern
    );

    assert.notEqual(
      res.body.filename,
      'foto.png'
    );
  });

  test('does not leave orphan file after processing failure', async () => {
    const before = new Set(
      fs.readdirSync(uploadDir)
    );

    const valid =
      await createImage('png');

    const corrupted =
      valid.subarray(
        0,
        Math.min(32, valid.length)
      );

    const res = await uploadRequest(
      corrupted,
      'orphan.png'
    );

    assertRejected(res);

    const after =
      fs.readdirSync(uploadDir);

    const newFiles =
      after.filter(
        (filename) =>
          !before.has(filename)
      );

    assert.deepEqual(
      newFiles,
      []
    );
  });
});