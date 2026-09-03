-- 1. Metadata Migrasi Skema
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. Administrator (Single Admin MVP)
CREATE TABLE IF NOT EXISTS admins (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash       TEXT NOT NULL,
    password_changed_at TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. Berita & Artikel
CREATE TABLE IF NOT EXISTS berita (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    judul        TEXT NOT NULL,
    slug         TEXT UNIQUE NOT NULL,
    isi          TEXT NOT NULL,
    ringkasan    TEXT,
    kategori     TEXT NOT NULL DEFAULT 'Berita',
    thumbnail    TEXT,
    status       TEXT CHECK(status IN ('draft','terbit')) NOT NULL DEFAULT 'draft',
    published_at TEXT,
    source_key   TEXT UNIQUE,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_berita_status_pub ON berita(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_berita_kategori   ON berita(kategori);

-- 4. Pengurus Organisasi
CREATE TABLE IF NOT EXISTS pengurus (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    jabatan    TEXT NOT NULL,
    nama       TEXT NOT NULL,
    gelar      TEXT,
    foto       TEXT,
    foto_alt   TEXT,
    bio        TEXT,
    urutan     INTEGER NOT NULL DEFAULT 0,
    source_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pengurus_urutan ON pengurus(urutan ASC);

-- 5. Galeri Media
CREATE TABLE IF NOT EXISTS galeri (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    judul      TEXT NOT NULL,
    caption    TEXT,
    alt_text   TEXT NOT NULL DEFAULT '',
    image_path TEXT NOT NULL,
    kategori   TEXT NOT NULL DEFAULT 'Umum',
    source_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_galeri_kategori ON galeri(kategori);

-- 6. Dokumen Unduhan
CREATE TABLE IF NOT EXISTS dokumen (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nama              TEXT NOT NULL,
    kategori          TEXT NOT NULL DEFAULT 'Umum',
    file_path         TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size         INTEGER NOT NULL,
    source_key        TEXT UNIQUE,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 7. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    metadata    TEXT,
    ip_address  TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);
