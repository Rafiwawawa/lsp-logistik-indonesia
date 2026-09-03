const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const xss = require('xss');
const { getDB, saveDB } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'images'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Hanya file gambar (jpg, png, webp) yang diizinkan'));
  }
});

// GET /api/galeri - public
router.get('/', (req, res) => {
  const db = getDB();
  const result = db.exec('SELECT id, judul, filename, kategori, dibuat FROM galeri ORDER BY dibuat DESC');
  const rows = result.length > 0 ? result[0].values.map(r => ({
    id: r[0], judul: r[1], filename: r[2], url: `/uploads/images/${r[2]}`, kategori: r[3], dibuat: r[4]
  })) : [];
  res.json({ success: true, data: rows });
});

// POST /api/galeri - admin only
router.post('/', requireAuth, upload.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File gambar diperlukan' });
  }
  const { judul, kategori } = req.body;
  if (!judul) {
    return res.status(400).json({ error: 'Judul gambar diperlukan' });
  }

  const db = getDB();
  try {
    db.run('INSERT INTO galeri (judul, filename, kategori) VALUES (?, ?, ?)',
      [xss(judul), req.file.filename, kategori || 'Umum']);
    db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['UPLOAD_GALERI', xss(judul)]);
    saveDB();
    res.json({ success: true, filename: req.file.filename, url: `/uploads/images/${req.file.filename}` });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menyimpan data galeri' });
  }
});

// DELETE /api/galeri/:id - admin only
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const result = db.exec('SELECT filename FROM galeri WHERE id = ?', [req.params.id]);
  if (!result.length) {
    return res.status(404).json({ error: 'Foto tidak ditemukan' });
  }

  const filename = result[0].values[0][0];
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'uploads', 'images', filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.run('DELETE FROM galeri WHERE id = ?', [req.params.id]);
  db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['HAPUS_GALERI', `ID: ${req.params.id}`]);
  saveDB();
  res.json({ success: true });
});

module.exports = router;
