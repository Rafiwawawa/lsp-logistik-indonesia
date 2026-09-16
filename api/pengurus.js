const express = require('express');
const fs = require('fs');

const { getDB } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

const {
  createMulterForCategory,
  processImage,
} = require('../middleware/imageProcessor');

const {
  sanitizeText,
  removeManagedImage,
} = require('../utils/apiHelpers');

const router = express.Router();

const upload =
  createMulterForCategory('pengurus');

/**
 * Convert DB row into public API format.
 */
function buildPengurusResponse(row) {
  return {
    id: row.id,
    jabatan: row.jabatan,
    nama: row.nama,
    gelar: row.gelar,
    foto: row.foto,

    foto_url:
      row.foto &&
      row.foto.startsWith('pengurus/')
        ? `/media/images/${row.foto}`
        : row.foto,

    foto_alt: row.foto_alt,
    bio: row.bio,
    urutan: row.urutan,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * GET /api/pengurus
 *
 * Public endpoint.
 */
router.get(
  '/',
  (req, res, next) => {
    try {
      const db = getDB();

      const rows = db
        .prepare(`
          SELECT
            id,
            jabatan,
            nama,
            gelar,
            foto,
            foto_alt,
            bio,
            urutan,
            created_at,
            updated_at
          FROM pengurus
          ORDER BY
            urutan ASC,
            id ASC
        `)
        .all();

      return res.json({
        success: true,
        data: rows.map(
          buildPengurusResponse
        ),
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PUT /api/pengurus/:id
 *
 * Admin only.
 *
 * Photo upload is optional.
 * Existing photo is retained if no
 * replacement photo is uploaded.
 */
router.put(
  '/:id',
  requireAuth,
  csrfProtection,
  upload.single('foto'),
  async (req, res, next) => {
    const id =
      Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      if (req.file) {
        await fs.promises
          .unlink(req.file.path)
          .catch(() => {});
      }

      return res
        .status(400)
        .json({
          success: false,
          error: {
            code: 'INVALID_ID',
            message:
              'ID pengurus tidak valid.',
          },
        });
    }

    try {
      const db = getDB();

      const existing = db
        .prepare(`
          SELECT
            id,
            jabatan,
            nama,
            gelar,
            foto,
            foto_alt,
            bio,
            urutan,
            created_at,
            updated_at
          FROM pengurus
          WHERE id = ?
        `)
        .get(id);

      if (!existing) {
        if (req.file) {
          await fs.promises
            .unlink(req.file.path)
            .catch(() => {});
        }

        return res
          .status(404)
          .json({
            success: false,
            error: {
              code:
                'PENGURUS_NOT_FOUND',
              message:
                'Data pengurus tidak ditemukan.',
            },
          });
      }

      const jabatan =
        req.body.jabatan !== undefined
          ? sanitizeText(
              req.body.jabatan
            )
          : existing.jabatan;

      const nama =
        req.body.nama !== undefined
          ? sanitizeText(
              req.body.nama
            )
          : existing.nama;

      const gelar =
        req.body.gelar !== undefined
          ? sanitizeText(
              req.body.gelar
            )
          : existing.gelar;

      const fotoAlt =
        req.body.foto_alt !== undefined
          ? sanitizeText(
              req.body.foto_alt
            )
          : existing.foto_alt;

      const bio =
        req.body.bio !== undefined
          ? sanitizeText(
              req.body.bio
            )
          : existing.bio;

      let urutan =
        existing.urutan;

      if (
        req.body.urutan !== undefined
      ) {
        urutan =
          Number(req.body.urutan);

        if (
          !Number.isInteger(urutan) ||
          urutan < 0
        ) {
          if (req.file) {
            await fs.promises
              .unlink(req.file.path)
              .catch(() => {});
          }

          return res
            .status(400)
            .json({
              success: false,
              error: {
                code:
                  'INVALID_ORDER',
                message:
                  'Urutan pengurus tidak valid.',
              },
            });
        }
      }

      if (!jabatan || !nama) {
        if (req.file) {
          await fs.promises
            .unlink(req.file.path)
            .catch(() => {});
        }

        return res
          .status(400)
          .json({
            success: false,
            error: {
              code:
                'REQUIRED_FIELDS_MISSING',
              message:
                'Jabatan dan nama wajib diisi.',
            },
          });
      }

      let newFoto =
        existing.foto;

      /*
       * Process replacement image
       * only when new photo exists.
       */
      if (req.file) {
        await processImage(
          req.file.path
        );

        newFoto =
          `pengurus/${req.file.filename}`;
      }

      const updatePengurus =
        db.prepare(`
          UPDATE pengurus
          SET
            jabatan = ?,
            nama = ?,
            gelar = ?,
            foto = ?,
            foto_alt = ?,
            bio = ?,
            urutan = ?,
            updated_at = strftime(
              '%Y-%m-%dT%H:%M:%fZ',
              'now'
            )
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
          VALUES (
            ?, ?, ?, ?, ?
          )
        `);

      const getPengurusById =
        db.prepare(`
          SELECT
            id,
            jabatan,
            nama,
            gelar,
            foto,
            foto_alt,
            bio,
            urutan,
            created_at,
            updated_at
          FROM pengurus
          WHERE id = ?
        `);

      const updateTransaction =
        db.transaction(() => {
          updatePengurus.run(
            jabatan,
            nama,
            gelar || null,
            newFoto,
            fotoAlt || '',
            bio || null,
            urutan,
            id
          );

          insertLog.run(
            'PENGURUS_UPDATE',
            'pengurus',
            String(id),
            JSON.stringify({
              nama,
              jabatan,
              urutan,
            }),
            req.ip || null
          );

          const row =
            getPengurusById.get(id);

          if (!row) {
            throw new Error(
              'Failed to retrieve updated pengurus row'
            );
          }

          return row;
        });

      const row =
        updateTransaction();

      /*
       * Delete old photo only after
       * database transaction succeeds.
       */
      if (
        req.file &&
        existing.foto &&
        existing.foto !== newFoto
      ) {
        await removeManagedImage(
          'pengurus',
          existing.foto
        );
      }

      return res.json({
        success: true,
        data:
          buildPengurusResponse(row),
      });
    } catch (error) {
      /*
       * Processing/database failure:
       * remove newly uploaded image.
       *
       * Existing image remains intact.
       */
      if (req.file) {
        await fs.promises
          .unlink(req.file.path)
          .catch(() => {});
      }

      return next(error);
    }
  }
);

module.exports = router;