const express = require('express');
const path = require('path');
const xss = require('xss');
const { getDB, saveDB } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/pengurus - public
router.get('/', (req, res) => {
  const db = getDB();
  const result = db.exec('SELECT id, jabatan, nama, gelar, foto, bio, urutan FROM pengurus ORDER BY urutan ASC');
  const rows = result.length > 0 ? result[0].values.map(r => ({
    id: r[0], jabatan: r[1], nama: r[2], gelar: r[3], foto: r[4], bio: r[5], urutan: r[6]
  })) : [];
  res.json({ success: true, data: rows });
});

// PUT /api/pengurus/:id - admin only
router.put('/:id', requireAuth, (req, res) => {
  const { jabatan, nama, gelar, bio, foto } = req.body;
  const db = getDB();

  try {
    db.run(
      'UPDATE pengurus SET jabatan=?, nama=?, gelar=?, bio=?, foto=? WHERE id=?',
      [xss(jabatan), xss(nama), xss(gelar || ''), xss(bio || ''), foto || null, req.params.id]
    );
    db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['EDIT_PENGURUS', `ID: ${req.params.id} - ${xss(nama)}`]);
    saveDB();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal memperbarui data pengurus' });
  }
});

module.exports = router;
