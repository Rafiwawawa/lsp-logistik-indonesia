const express = require('express');
const fs = require('fs');

const { getDB } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const {
  createMulterForCategory,
  processImage,
} = require('../middleware/imageProcessor');
const {
  sanitizeText,
  removeManagedImage,
} = require('../utils/apiHelpers');

const router = express.Router();

const upload = createMulterForCategory('galeri');

/**
 * Convert database row into API response format.
 */
function buildGaleriResponse(row) {
  return {
    id: row.id,
    judul: row.judul,
    caption: row.caption,
    alt_text: row.alt_text,
    image_path: row.image_path,
    kategori: row.kategori,
    created_at: row.created_at,
    updated_at: row.updated_at,

    // Public secure image URL.
    url: `/media/images/${row.image_path}`,
  };
}

/**
 * GET /api/galeri
 *
 * Public endpoint.
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDB();

    const rows = db
      .prepare(`
        SELECT
          id,
          judul,
          caption,
          alt_text,
          image_path,
          kategori,
          created_at,
          updated_at
        FROM galeri
        ORDER BY created_at DESC, id DESC
      `)
      .all();

    return res.json({
      success: true,
      data: rows.map(buildGaleriResponse),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/galeri
 *
 * Admin only.
 * Uploads and processes a new gallery image.
 */
router.post(
  '/',
  requireAuth,
  upload.single('foto'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'IMAGE_REQUIRED',
          message: 'File gambar diperlukan.',
        },
      });
    }

    const judul =
      sanitizeText(req.body.judul);

    const caption =
      sanitizeText(req.body.caption);

    const altText =
      sanitizeText(req.body.alt_text);

    const kategori =
      sanitizeText(
        req.body.kategori,
        'Umum'
      ) || 'Umum';

    /*
     * Multer has already written the file.
     * Remove it if form validation fails.
     */
    if (!judul) {
      await fs.promises
        .unlink(req.file.path)
        .catch(() => {});

      return res.status(400).json({
        success: false,
        error: {
          code: 'TITLE_REQUIRED',
          message: 'Judul gambar diperlukan.',
        },
      });
    }

    try {
      /*
       * Phase 3 secure image processing:
       * - magic-byte validation
       * - decode validation
       * - dimension validation
       * - reject unsupported/animated images
       * - auto orientation
       * - re-encode
       * - strip metadata
       */
      await processImage(req.file.path);

      const db = getDB();

      /*
       * Store only a logical relative path.
       */
      const imagePath =
        `galeri/${req.file.filename}`;

      const insertGaleri = db.prepare(`
        INSERT INTO galeri (
          judul,
          caption,
          alt_text,
          image_path,
          kategori
        )
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertLog = db.prepare(`
        INSERT INTO activity_logs (
          action,
          entity_type,
          entity_id,
          metadata,
          ip_address
        )
        VALUES (?, ?, ?, ?, ?)
      `);

      const getGaleriById = db.prepare(`
        SELECT
          id,
          judul,
          caption,
          alt_text,
          image_path,
          kategori,
          created_at,
          updated_at
        FROM galeri
        WHERE id = ?
      `);

      /*
       * Galeri row + activity log +
       * result lookup are atomic.
       */
      const createGaleri =
        db.transaction(() => {
          const result =
            insertGaleri.run(
              judul,
              caption || null,
              altText,
              imagePath,
              kategori
            );

          const id = Number(
            result.lastInsertRowid
          );

          insertLog.run(
            'GALERI_CREATE',
            'galeri',
            String(id),
            JSON.stringify({
              judul,
              image_path: imagePath,
            }),
            req.ip || null
          );

          const row =
            getGaleriById.get(id);

          if (!row) {
            throw new Error(
              'Failed to retrieve created galeri row'
            );
          }

          return row;
        });

      const row = createGaleri();

      return res.status(201).json({
        success: true,
        data: buildGaleriResponse(row),
      });
    } catch (error) {
      /*
       * Image processing or DB failure:
       * remove newly uploaded file.
       */
      await fs.promises
        .unlink(req.file.path)
        .catch(() => {});

      return next(error);
    }
  }
);

/**
 * DELETE /api/galeri/:id
 *
 * Admin only.
 */
router.delete(
  '/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const id = Number(
        req.params.id
      );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message:
              'ID galeri tidak valid.',
          },
        });
      }

      const db = getDB();

      const row = db
        .prepare(`
          SELECT
            id,
            judul,
            image_path
          FROM galeri
          WHERE id = ?
        `)
        .get(id);

      if (!row) {
        return res.status(404).json({
          success: false,
          error: {
            code:
              'GALERI_NOT_FOUND',
            message:
              'Foto tidak ditemukan.',
          },
        });
      }

      const deleteGaleri =
        db.prepare(`
          DELETE FROM galeri
          WHERE id = ?
        `);

      const insertLog =
        db.prepare(`
          INSERT INTO activity_logs (
            action,
            entity_type,
            entity_id,
            metadata,
            ip_address
          )
          VALUES (?, ?, ?, ?, ?)
        `);

      /*
       * Database deletion and activity
       * logging happen atomically.
       */
      const removeGaleri =
        db.transaction(() => {
          deleteGaleri.run(id);

          insertLog.run(
            'GALERI_DELETE',
            'galeri',
            String(id),
            JSON.stringify({
              judul: row.judul,
              image_path:
                row.image_path,
            }),
            req.ip || null
          );
        });

      /*
       * Commit DB operation before
       * removing physical image.
       */
      removeGaleri();

      /*
       * Shared helper handles:
       * - category validation
       * - path boundary protection
       * - ENOENT
       */
      await removeManagedImage(
        'galeri',
        row.image_path
      );

      return res.json({
        success: true,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;