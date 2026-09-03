const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const xss = require('xss');
const { getDB, saveDB } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'documents'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for documents
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Hanya file dokumen (pdf, doc, xls) yang diizinkan'));
  }
});

// GET /api/dokumen - public
router.get('/', (req, res) => {
  const db = getDB();
  const { kategori } = req.query;
  let query = 'SELECT id, nama, filename, kategori, ukuran, dibuat FROM dokumen';
  const params = [];
  if (kategori) {
    query += ' WHERE kategori = ?';
    params.push(kategori);
  }
  query += ' ORDER BY dibuat DESC';

  const result = db.exec(query, params);
  const rows = result.length > 0 ? result[0].values.map(r => ({
    id: r[0], nama: r[1], filename: r[2], url: `/uploads/documents/${r[2]}`,
    kategori: r[3], ukuran: r[4], dibuat: r[5]
  })) : [];
  res.json({ success: true, data: rows });
});

// POST /api/dokumen - admin only
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File dokumen diperlukan' });
  }
  const { nama, kategori } = req.body;
  if (!nama) {
    return res.status(400).json({ error: 'Nama dokumen diperlukan' });
  }

  const ukuran = (req.file.size / 1024).toFixed(0) + ' KB';
  const db = getDB();
  try {
    db.run('INSERT INTO dokumen (nama, filename, kategori, ukuran) VALUES (?, ?, ?, ?)',
      [xss(nama), req.file.filename, kategori || 'Umum', ukuran]);
    db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['UPLOAD_DOKUMEN', xss(nama)]);
    saveDB();
    res.json({ success: true, filename: req.file.filename, url: `/uploads/documents/${req.file.filename}` });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menyimpan data dokumen' });
  }
});

// DELETE /api/dokumen/:id - admin only
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const result = db.exec('SELECT filename FROM dokumen WHERE id = ?', [req.params.id]);
  if (!result.length) {
    return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  }

  const filename = result[0].values[0][0];
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'uploads', 'documents', filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.run('DELETE FROM dokumen WHERE id = ?', [req.params.id]);
  db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['HAPUS_DOKUMEN', `ID: ${req.params.id}`]);
  saveDB();
  res.json({ success: true });
});

module.exports = router;
