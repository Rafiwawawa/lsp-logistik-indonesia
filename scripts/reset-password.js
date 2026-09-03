require('dotenv').config();
const readline = require('readline');
const { getDB, initDB } = require('../database/db');
const { clearAllSessions, initSessionStore } = require('../database/sessionStore');
const { validatePassword, hashPassword, normalizeUsername } = require('../utils/security');
const { logActivity } = require('../utils/logger');

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function askHiddenPassword(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.stdin;
    process.stdout.write(query);

    // Mute stdout during password typing
    const oldWrite = process.stdout.write;
    process.stdout.write = () => {};

    rl.question('', (password) => {
      process.stdout.write = oldWrite;
      process.stdout.write('\n');
      rl.close();
      resolve(password);
    });
  });
}

async function main() {
  console.log('\n=== LSP Logistik Indonesia — Admin Password Reset CLI ===\n');

  initDB();
  initSessionStore();
  const db = getDB();

  const admins = db.prepare('SELECT id, username FROM admins ORDER BY id ASC').all();
  if (admins.length === 0) {
    console.error('❌ Belum ada akun administrator yang terdaftar di database.');
    console.log('   Silakan lakukan initial setup terlebih dahulu via /admin/setup.');
    process.exit(1);
  }

  let targetAdmin = admins[0];

  if (admins.length > 1) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Daftar administrator:');
    admins.forEach((a, i) => console.log(`  ${i + 1}. ${a.username} (ID: ${a.id})`));
    const answer = await askQuestion(rl, '\nPilih nomor admin atau ketik username: ');
    rl.close();

    const idx = parseInt(answer, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= admins.length) {
      targetAdmin = admins[idx - 1];
    } else {
      const found = admins.find(a => a.username.toLowerCase() === answer.trim().toLowerCase());
      if (found) {
        targetAdmin = found;
      } else {
        console.error('❌ Administrator tidak ditemukan.');
        process.exit(1);
      }
    }
  }

  console.log(`Mengubah password untuk akun: [${targetAdmin.username}]`);

  const newPassword = await askHiddenPassword('Masukkan password baru (min 12 karakter): ');
  const confirmPassword = await askHiddenPassword('Konfirmasi password baru: ');

  if (newPassword !== confirmPassword) {
    console.error('❌ Konfirmasi password tidak cocok.');
    process.exit(1);
  }

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    console.error(`❌ Password tidak valid: ${validation.message}`);
    process.exit(1);
  }

  const newHash = await hashPassword(newPassword);

  db.prepare(`
    UPDATE admins
    SET password_hash = ?,
        password_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(newHash, targetAdmin.id);

  // Invalidate ALL sessions across all devices
  clearAllSessions();

  logActivity(db, {
    action: 'PASSWORD_RESET',
    entityType: 'admin',
    entityId: targetAdmin.id,
    metadata: { username: targetAdmin.username, method: 'CLI' },
  });

  console.log('\n✅ Password berhasil diubah.');
  console.log('🔒 Seluruh sesi aktif di database telah di-reset untuk keamanan.');
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Terjadi kesalahan:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
