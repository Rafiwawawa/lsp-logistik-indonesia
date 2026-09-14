const express = require('express');
const fs = require('fs');
const crypto = require('crypto');

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

const upload =
  createMulterForCategory('berita');

const ALLOWED_STATUS = new Set([
  'draft',
  'terbit',
]);

function isAdmin(req) {
  return Boolean(
    req.session &&
    req.session.adminId
  );
}

function slugify(text) {
  const base = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const suffix = crypto
    .randomUUID()
    .slice(0, 8);

  return `${
    base || 'artikel'
  }-${suffix}`;
}

function buildBeritaResponse(row) {
  return {
    id: row.id,
    judul: row.judul,
    slug: row.slug,
    isi: row.isi,
    ringkasan: row.ringkasan,
    kategori: row.kategori,
    thumbnail: row.thumbnail,

    thumbnail_url:
      row.thumbnail &&
      row.thumbnail.startsWith(
        'berita/'
      )
        ? `/media/images/${row.thumbnail}`
        : row.thumbnail,

    status: row.status,
    published_at:
      row.published_at,
    created_at:
      row.created_at,
    updated_at:
      row.updated_at,
  };
}

/**
 * GET /api/berita
 *
 * Public:
 * only published articles.
 *
 * Admin:
 * can see drafts and filter by status.
 */
router.get(
  '/',
  (req, res, next) => {
    try {
      const db = getDB();

      const kategori =
        typeof req.query.kategori ===
        'string'
          ? req.query.kategori.trim()
          : '';

      const requestedStatus =
        typeof req.query.status ===
        'string'
          ? req.query.status.trim()
          : '';

      let limit =
        Number.parseInt(
          req.query.limit,
          10
        );

      let offset =
        Number.parseInt(
          req.query.offset,
          10
        );

      if (
        !Number.isInteger(limit) ||
        limit <= 0
      ) {
        limit = 10;
      }

      if (limit > 100) {
        limit = 100;
      }

      if (
        !Number.isInteger(offset) ||
        offset < 0
      ) {
        offset = 0;
      }

      const conditions = [];
      const params = [];

      if (!isAdmin(req)) {
        conditions.push(
          "status = 'terbit'"
        );
      } else if (
        requestedStatus
      ) {
        if (
          !ALLOWED_STATUS.has(
            requestedStatus
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,
              error: {
                code:
                  'INVALID_STATUS',
                message:
                  'Status berita tidak valid.',
              },
            });
        }

        conditions.push(
          'status = ?'
        );

        params.push(
          requestedStatus
        );
      }

      if (kategori) {
        conditions.push(
          'kategori = ?'
        );

        params.push(kategori);
      }

      let sql = `
        SELECT
          id,
          judul,
          slug,
          isi,
          ringkasan,
          kategori,
          thumbnail,
          status,
          published_at,
          created_at,
          updated_at
        FROM berita
      `;

      if (
        conditions.length > 0
      ) {
        sql +=
          ` WHERE ${conditions.join(
            ' AND '
          )}`;
      }

      sql += `
        ORDER BY
          COALESCE(
            published_at,
            created_at
          ) DESC,
          id DESC
        LIMIT ?
        OFFSET ?
      `;

      params.push(
        limit,
        offset
      );

      const rows = db
        .prepare(sql)
        .all(...params);

      return res.json({
        success: true,
        data: rows.map(
          buildBeritaResponse
        ),
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/berita/:slug
 */
router.get(
  '/:slug',
  (req, res, next) => {
    try {
      const db = getDB();

      const row = db
        .prepare(`
          SELECT
            id,
            judul,
            slug,
            isi,
            ringkasan,
            kategori,
            thumbnail,
            status,
            published_at,
            created_at,
            updated_at
          FROM berita
          WHERE slug = ?
        `)
        .get(req.params.slug);

      if (
        !row ||
        (
          row.status !== 'terbit' &&
          !isAdmin(req)
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,
            error: {
              code:
                'BERITA_NOT_FOUND',
              message:
                'Artikel tidak ditemukan.',
            },
          });
      }

      return res.json({
        success: true,
        data:
          buildBeritaResponse(row),
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/berita
 *
 * Admin only.
 * Thumbnail is optional.
 */
router.post(
  '/',
  requireAuth,
  upload.single('thumbnail'),
  async (req, res, next) => {
    const judul =
      sanitizeText(
        req.body.judul
      );

    const isi =
      sanitizeText(
        req.body.isi
      );

    const ringkasan =
      sanitizeText(
        req.body.ringkasan
      );

    const kategori =
      sanitizeText(
        req.body.kategori,
        'Berita'
      ) || 'Berita';

    const status =
      sanitizeText(
        req.body.status,
        'draft'
      ) || 'draft';

    if (!judul || !isi) {
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
              'Judul dan isi wajib diisi.',
          },
        });
    }

    if (
      !ALLOWED_STATUS.has(status)
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
              'INVALID_STATUS',
            message:
              'Status berita tidak valid.',
          },
        });
    }

    try {
      let thumbnail = null;

      if (req.file) {
        await processImage(
          req.file.path
        );

        thumbnail =
          `berita/${req.file.filename}`;
      }

      const db = getDB();

      const slug =
        slugify(judul);

      const publishedAt =
        status === 'terbit'
          ? new Date().toISOString()
          : null;

      const insertBerita =
        db.prepare(`
          INSERT INTO berita (
            judul,
            slug,
            isi,
            ringkasan,
            kategori,
            thumbnail,
            status,
            published_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?
          )
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

      const getBeritaById =
        db.prepare(`
          SELECT
            id,
            judul,
            slug,
            isi,
            ringkasan,
            kategori,
            thumbnail,
            status,
            published_at,
            created_at,
            updated_at
          FROM berita
          WHERE id = ?
        `);

      const createBerita =
        db.transaction(() => {
          const result =
            insertBerita.run(
              judul,
              slug,
              isi,
              ringkasan || null,
              kategori,
              thumbnail,
              status,
              publishedAt
            );

          const id = Number(
            result.lastInsertRowid
          );

          insertLog.run(
            'BERITA_CREATE',
            'berita',
            String(id),
            JSON.stringify({
              judul,
              slug,
              status,
            }),
            req.ip || null
          );

          const row =
            getBeritaById.get(id);

          if (!row) {
            throw new Error(
              'Failed to retrieve created berita row'
            );
          }

          return row;
        });

      const row =
        createBerita();

      return res
        .status(201)
        .json({
          success: true,
          data:
            buildBeritaResponse(row),
        });
    } catch (error) {
      if (req.file) {
        await fs.promises
          .unlink(req.file.path)
          .catch(() => {});
      }

      return next(error);
    }
  }
);

/**
 * PUT /api/berita/:id
 *
 * Admin only.
 */
router.put(
  '/:id',
  requireAuth,
  upload.single('thumbnail'),
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
              'ID berita tidak valid.',
          },
        });
    }

    try {
      const db = getDB();

      const existing = db
        .prepare(`
          SELECT *
          FROM berita
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
                'BERITA_NOT_FOUND',
              message:
                'Artikel tidak ditemukan.',
            },
          });
      }

      const judul =
        req.body.judul !== undefined
          ? sanitizeText(
              req.body.judul
            )
          : existing.judul;

      const isi =
        req.body.isi !== undefined
          ? sanitizeText(
              req.body.isi
            )
          : existing.isi;

      const ringkasan =
        req.body.ringkasan !==
        undefined
          ? sanitizeText(
              req.body.ringkasan
            )
          : existing.ringkasan;

      const kategori =
        req.body.kategori !==
        undefined
          ? sanitizeText(
              req.body.kategori
            )
          : existing.kategori;

      const status =
        req.body.status !== undefined
          ? sanitizeText(
              req.body.status
            )
          : existing.status;

      if (!judul || !isi) {
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
                'Judul dan isi wajib diisi.',
            },
          });
      }

      if (
        !ALLOWED_STATUS.has(status)
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
                'INVALID_STATUS',
              message:
                'Status berita tidak valid.',
            },
          });
      }

      let newThumbnail =
        existing.thumbnail;

      if (req.file) {
        await processImage(
          req.file.path
        );

        newThumbnail =
          `berita/${req.file.filename}`;
      }

      const publishedAt =
        status === 'terbit'
          ? (
              existing.published_at ||
              new Date().toISOString()
            )
          : null;

      const updateBerita =
        db.prepare(`
          UPDATE berita
          SET
            judul = ?,
            isi = ?,
            ringkasan = ?,
            kategori = ?,
            thumbnail = ?,
            status = ?,
            published_at = ?,
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

      const getBeritaById =
        db.prepare(`
          SELECT
            id,
            judul,
            slug,
            isi,
            ringkasan,
            kategori,
            thumbnail,
            status,
            published_at,
            created_at,
            updated_at
          FROM berita
          WHERE id = ?
        `);

      const updateTransaction =
        db.transaction(() => {
          updateBerita.run(
            judul,
            isi,
            ringkasan || null,
            kategori || 'Berita',
            newThumbnail,
            status,
            publishedAt,
            id
          );

          insertLog.run(
            'BERITA_UPDATE',
            'berita',
            String(id),
            JSON.stringify({
              judul,
              status,
            }),
            req.ip || null
          );

          const row =
            getBeritaById.get(id);

          if (!row) {
            throw new Error(
              'Failed to retrieve updated berita row'
            );
          }

          return row;
        });

      const row =
        updateTransaction();

      if (
        req.file &&
        existing.thumbnail &&
        existing.thumbnail !==
          newThumbnail
      ) {
        await removeManagedImage(
          'berita',
          existing.thumbnail
        );
      }

      return res.json({
        success: true,
        data:
          buildBeritaResponse(row),
      });
    } catch (error) {
      if (req.file) {
        await fs.promises
          .unlink(req.file.path)
          .catch(() => {});
      }

      return next(error);
    }
  }
);

/**
 * DELETE /api/berita/:id
 *
 * Admin only.
 */
router.delete(
  '/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: {
              code:
                'INVALID_ID',
              message:
                'ID berita tidak valid.',
            },
          });
      }

      const db = getDB();

      const existing = db
        .prepare(`
          SELECT
            id,
            judul,
            slug,
            thumbnail
          FROM berita
          WHERE id = ?
        `)
        .get(id);

      if (!existing) {
        return res
          .status(404)
          .json({
            success: false,
            error: {
              code:
                'BERITA_NOT_FOUND',
              message:
                'Artikel tidak ditemukan.',
            },
          });
      }

      const deleteBerita =
        db.prepare(`
          DELETE FROM berita
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

      const removeBerita =
        db.transaction(() => {
          deleteBerita.run(id);

          insertLog.run(
            'BERITA_DELETE',
            'berita',
            String(id),
            JSON.stringify({
              judul:
                existing.judul,
              slug:
                existing.slug,
            }),
            req.ip || null
          );
        });

      removeBerita();

      await removeManagedImage(
        'berita',
        existing.thumbnail
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