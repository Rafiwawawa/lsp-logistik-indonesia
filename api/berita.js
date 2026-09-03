const express = require('express');
const xss = require('xss');
const { getDB, saveDB } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Helper: generate slug from title
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    + '-' + Date.now();
}

// GET /api/berita - public (list published articles)
router.get('/', (req, res) => {
  const db = getDB();
  const { kategori, status, limit = 10, offset = 0 } = req.query;

  let query = 'SELECT id, judul, slug, ringkasan, kategori, thumbnail, status, tanggal FROM berita';
  const params = [];
  const conditions = [];

  // Public only sees published, admin can see all
  if (!req.session || !req.session.isAdmin) {
    conditions.push("status = 'terbit'");
  } else if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (kategori) {
    conditions.push('kategori = ?');
    params.push(kategori);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY tanggal DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  try {
    const result = db.exec(query, params);
    const rows = result.length > 0 ? result[0].values.map(r => ({
      id: r[0], judul: r[1], slug: r[2], ringkasan: r[3],
      kategori: r[4], thumbnail: r[5], status: r[6], tanggal: r[7]
    })) : [];
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/berita/:slug - public
router.get('/:slug', (req, res) => {
  const db = getDB();
  const result = db.exec('SELECT * FROM berita WHERE slug = ?', [req.params.slug]);
  if (!result.length || !result[0].values.length) {
    return res.status(404).json({ error: 'Artikel tidak ditemukan' });
  }
  const cols = result[0].columns;
  const vals = result[0].values[0];
  const row = {};
  cols.forEach((c, i) => row[c] = vals[i]);

  if (row.status !== 'terbit' && (!req.session || !req.session.isAdmin)) {
    return res.status(404).json({ error: 'Artikel tidak ditemukan' });
  }
  res.json({ success: true, data: row });
});

// POST /api/berita - admin only
router.post('/', requireAuth, (req, res) => {
  const { judul, isi, ringkasan, kategori, thumbnail, status, tanggal } = req.body;
  if (!judul || !isi) {
    return res.status(400).json({ error: 'Judul dan isi wajib diisi' });
  }

  const db = getDB();
  const slug = slugify(judul);
  const cleanIsi = xss(isi);
  const cleanJudul = xss(judul);
  const today = tanggal || new Date().toISOString().split('T')[0];

  try {
    db.run(
      'INSERT INTO berita (judul, slug, isi, ringkasan, kategori, thumbnail, status, tanggal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [cleanJudul, slug, cleanIsi, xss(ringkasan || ''), kategori || 'Berita', thumbnail || null, status || 'draft', today]
    );
    const idResult = db.exec('SELECT last_insert_rowid() as id');
    const id = idResult[0].values[0][0];
    db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['BUAT_BERITA', `Artikel: ${cleanJudul}`]);
    saveDB();
    res.json({ success: true, id, slug });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menyimpan artikel: ' + e.message });
  }
});

// PUT /api/berita/:id - admin only
router.put('/:id', requireAuth, (req, res) => {
  const { judul, isi, ringkasan, kategori, thumbnail, status, tanggal } = req.body;
  const db = getDB();

  try {
    db.run(
      'UPDATE berita SET judul=?, isi=?, ringkasan=?, kategori=?, thumbnail=?, status=?, tanggal=?, diperbarui=datetime(\'now\') WHERE id=?',
      [xss(judul), xss(isi), xss(ringkasan || ''), kategori, thumbnail || null, status, tanggal, req.params.id]
    );
    db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['EDIT_BERITA', `ID: ${req.params.id}`]);
    saveDB();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal memperbarui artikel' });
  }
});

// DELETE /api/berita/:id - admin only
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDB();
  db.run('DELETE FROM berita WHERE id = ?', [req.params.id]);
  db.run("INSERT INTO activity_log (aksi, detail) VALUES (?, ?)", ['HAPUS_BERITA', `ID: ${req.params.id}`]);
  saveDB();
  res.json({ success: true });
});

module.exports = router;
