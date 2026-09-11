const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTestEnvironment } = require('./helpers/setup');
const { quickCheck } = require('../database/check');
const { runMigrations } = require('../database/migrate');

describe('Phase 1: Database & Schema Validation', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('applies all required SQLite pragmas correctly', () => {
    const fk = env.db.pragma('foreign_keys', { simple: true });
    const jm = env.db.pragma('journal_mode', { simple: true });
    const bt = env.db.pragma('busy_timeout', { simple: true });
    const sync = env.db.pragma('synchronous', { simple: true });

    assert.equal(fk, 1, 'foreign_keys should be ON (1)');
    assert.equal(jm.toLowerCase(), 'wal', 'journal_mode should be wal');
    assert.equal(bt, 5000, 'busy_timeout should be 5000');
    assert.equal(sync, 1, 'synchronous should be NORMAL (1)');
  });

  test('creates all required schema tables and migrations tracking', () => {
    const tables = env.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map(r => r.name);

    const expectedTables = [
      'schema_migrations',
      'admins',
      'berita',
      'pengurus',
      'galeri',
      'activity_logs',
    ];

    for (const tbl of expectedTables) {
      assert.ok(tables.includes(tbl), `Table ${tbl} should exist in database`);
    }

    assert.ok(!tables.includes('dokumen'), 'Table dokumen should NOT exist in database after migration 002');

    const migration1 = env.db.prepare('SELECT * FROM schema_migrations WHERE version = 1').get();
    assert.ok(migration1, 'Migration 1 should be recorded');
    assert.match(migration1.applied_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const migration2 = env.db.prepare('SELECT * FROM schema_migrations WHERE version = 2').get();
    assert.ok(migration2, 'Migration 2 should be recorded');
    assert.match(migration2.applied_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('verifies source_key column and UNIQUE semantics (allows multiple NULLs)', () => {
    // 1. Insert multiple records with source_key = NULL (admin created)
    const insertAdmin = env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, source_key)
      VALUES (?, ?, ?, NULL)
    `);

    insertAdmin.run('Admin Berita 1', 'admin-berita-1', 'Konten 1');
    insertAdmin.run('Admin Berita 2', 'admin-berita-2', 'Konten 2');

    const countNull = env.db.prepare('SELECT COUNT(*) as cnt FROM berita WHERE source_key IS NULL').get();
    assert.equal(countNull.cnt, 2, 'Multiple NULL source_key values should be allowed');

    // 2. Insert seeded record with non-null source_key
    const insertSeed = env.db.prepare(`
      INSERT INTO berita (judul, slug, isi, source_key)
      VALUES (?, ?, ?, ?)
    `);

    insertSeed.run('Seed Berita', 'seed-berita', 'Konten', 'legacy-berita-1');

    // 3. Duplicate non-null source_key should throw UNIQUE constraint error
    assert.throws(() => {
      insertSeed.run('Duplicate Seed', 'seed-berita-2', 'Konten', 'legacy-berita-1');
    }, /UNIQUE constraint failed/);
  });

  test('verifies admins username has COLLATE NOCASE (case-insensitive uniqueness)', () => {
    const insertAdmin = env.db.prepare(`
      INSERT INTO admins (username, password_hash)
      VALUES (?, ?)
    `);

    insertAdmin.run('admin', 'dummy_hash_1');

    assert.throws(() => {
      insertAdmin.run('Admin', 'dummy_hash_2');
    }, /UNIQUE constraint failed/);

    assert.throws(() => {
      insertAdmin.run('ADMIN', 'dummy_hash_3');
    }, /UNIQUE constraint failed/);
  });

  test('verifies timestamps use ISO-8601 UTC extended format', () => {
    const insert = env.db.prepare(`
      INSERT INTO berita (judul, slug, isi)
      VALUES ('Test Judul', 'test-slug', 'Isi artikel')
    `);
    const res = insert.run();

    const row = env.db.prepare('SELECT created_at, updated_at FROM berita WHERE id = ?').get(res.lastInsertRowid);
    assert.match(row.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.match(row.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('migration runner is idempotent', () => {
    const resultsSecondRun = runMigrations(env.db);
    const applied = resultsSecondRun.filter(r => r.status === 'applied');
    assert.equal(applied.length, 0, 'Second migration run should apply 0 migrations');
  });

  test('PRAGMA quick_check passes with "ok"', () => {
    assert.doesNotThrow(() => {
      const result = quickCheck(env.db);
      assert.equal(result, true);
    });
  });
});
