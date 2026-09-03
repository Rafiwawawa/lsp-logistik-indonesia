/* ─── Admin Panel JavaScript ─────────────────────────────────────── */

// ─── Auth Guard ────────────────────────────────────────────────────
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/admin/login.html';
    }
  } catch (e) {
    window.location.href = '/admin/login.html';
  }
})();

// ─── Navigation ─────────────────────────────────────────────────────
function switchSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`sec-${name}`).classList.remove('hidden');
  document.querySelector(`[data-section="${name}"]`).classList.add('active');
  document.getElementById('pageTitle').textContent = {
    dashboard: 'Dashboard',
    berita: 'Berita & Artikel',
    pengurus: 'Data Pengurus',
    galeri: 'Galeri Foto',
    dokumen: 'Dokumen',
    settings: 'Pengaturan'
  }[name] || name;

  // Lazy load data
  if (name === 'dashboard') loadDashboard();
  if (name === 'berita') loadBerita();
  if (name === 'pengurus') loadPengurus();
  if (name === 'galeri') loadGaleri();
  if (name === 'dokumen') loadDokumen();

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchSection(item.dataset.section);
  });
});

document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Close sidebar on overlay click (mobile)
document.addEventListener('click', e => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (window.innerWidth <= 768 && sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) && !toggle.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ─── Toast ──────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Modal ──────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// ─── Logout ─────────────────────────────────────────────────────────
document.getElementById('btnLogout').addEventListener('click', async () => {
  if (!confirm('Keluar dari panel admin?')) return;
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/admin/login.html';
});

// ─── Dashboard ──────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [b, g, d] = await Promise.all([
      fetch('/api/berita?limit=100', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/galeri', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/dokumen', { credentials: 'include' }).then(r => r.json()),
    ]);
    document.getElementById('stat-berita').textContent = b.data?.length ?? 0;
    document.getElementById('stat-galeri').textContent = g.data?.length ?? 0;
    document.getElementById('stat-dokumen').textContent = d.data?.length ?? 0;
  } catch (e) {}
}

// ─── BERITA ─────────────────────────────────────────────────────────
async function loadBerita() {
  const tbody = document.getElementById('berita-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Memuat data...</td></tr>';
  try {
    const res = await fetch('/api/berita?limit=100', { credentials: 'include' });
    const { data } = await res.json();

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Belum ada artikel. Buat yang pertama!</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(b => `
      <tr>
        <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(b.judul)}</td>
        <td>${escHtml(b.kategori)}</td>
        <td>${b.tanggal}</td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button class="btn-edit" onclick="editBerita(${b.id})">Edit</button>
          <button class="btn-danger" onclick="deleteBerita(${b.id}, '${escHtml(b.judul).replace(/'/g, "\\'")}')">Hapus</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Gagal memuat data.</td></tr>';
  }
}

function resetBeritaForm() {
  document.getElementById('berita-id').value = '';
  document.getElementById('berita-modal-title').textContent = 'Artikel Baru';
  document.getElementById('berita-submit-btn').textContent = 'Simpan Artikel';
  document.getElementById('beritaForm').reset();
  document.getElementById('berita-tanggal').value = new Date().toISOString().split('T')[0];
}

async function editBerita(id) {
  try {
    const res = await fetch(`/api/berita`, { credentials: 'include' });
    const { data } = await res.json();
    const b = data.find(x => x.id === id);
    if (!b) return;

    // Fetch full article for isi
    const fullRes = await fetch(`/api/berita/${b.slug}`, { credentials: 'include' });
    const full = await fullRes.json();
    const article = full.data;

    document.getElementById('berita-id').value = id;
    document.getElementById('berita-judul').value = article.judul;
    document.getElementById('berita-ringkasan').value = article.ringkasan || '';
    document.getElementById('berita-isi').value = article.isi;
    document.getElementById('berita-kategori').value = article.kategori;
    document.getElementById('berita-tanggal').value = article.tanggal;
    document.getElementById('berita-status').value = article.status;
    document.getElementById('berita-modal-title').textContent = 'Edit Artikel';
    document.getElementById('berita-submit-btn').textContent = 'Perbarui Artikel';
    openModal('modal-berita-form');
  } catch (e) {
    showToast('Gagal memuat data artikel', 'error');
  }
}

async function deleteBerita(id, judul) {
  if (!confirm(`Hapus artikel "${judul}"?\nTindakan ini tidak dapat dibatalkan.`)) return;
  try {
    const res = await fetch(`/api/berita/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) { showToast('Artikel berhasil dihapus'); loadBerita(); }
    else showToast(data.error || 'Gagal menghapus', 'error');
  } catch (e) {
    showToast('Gagal menghapus artikel', 'error');
  }
}

document.getElementById('beritaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('berita-id').value;
  const payload = {
    judul: document.getElementById('berita-judul').value,
    ringkasan: document.getElementById('berita-ringkasan').value,
    isi: document.getElementById('berita-isi').value,
    kategori: document.getElementById('berita-kategori').value,
    tanggal: document.getElementById('berita-tanggal').value,
    status: document.getElementById('berita-status').value,
  };

  const btn = document.getElementById('berita-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const url = id ? `/api/berita/${id}` : '/api/berita';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(id ? 'Artikel berhasil diperbarui!' : 'Artikel berhasil disimpan!');
      closeModal('modal-berita-form');
      loadBerita();
      loadDashboard();
    } else {
      showToast(data.error || 'Gagal menyimpan', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = id ? 'Perbarui Artikel' : 'Simpan Artikel';
  }
});

// ─── PENGURUS ────────────────────────────────────────────────────────
async function loadPengurus() {
  const grid = document.getElementById('pengurus-grid');
  grid.innerHTML = '<div class="loading-row">Memuat data pengurus...</div>';
  try {
    const res = await fetch('/api/pengurus', { credentials: 'include' });
    const { data } = await res.json();
    grid.innerHTML = data.map(p => `
      <div class="pengurus-card">
        <div class="pengurus-avatar">
          ${p.foto ? `<img src="${p.foto}" alt="${escHtml(p.nama)}">` : p.nama.charAt(0)}
        </div>
        <div class="pengurus-info">
          <div class="pengurus-jabatan">${escHtml(p.jabatan)}</div>
          <div class="pengurus-nama">${escHtml(p.nama)}</div>
          ${p.gelar ? `<div class="pengurus-gelar">${escHtml(p.gelar)}</div>` : ''}
          ${p.bio ? `<div class="pengurus-bio">${escHtml(p.bio)}</div>` : ''}
          <button class="btn-edit" style="margin-top:0.75rem;" onclick="editPengurus(${p.id}, '${escHtml(p.jabatan)}', '${escHtml(p.nama)}', '${escHtml(p.gelar||'')}', '${escHtml(p.bio||'')}', '${p.foto||''}')">
            Edit Data
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<div class="loading-row">Gagal memuat data pengurus.</div>';
  }
}

function editPengurus(id, jabatan, nama, gelar, bio, foto) {
  document.getElementById('pengurus-id').value = id;
  document.getElementById('pengurus-jabatan').value = jabatan;
  document.getElementById('pengurus-nama').value = nama;
  document.getElementById('pengurus-gelar').value = gelar;
  document.getElementById('pengurus-bio').value = bio;
  document.getElementById('pengurus-foto').value = foto;
  openModal('modal-pengurus-form');
}

document.getElementById('pengurusForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('pengurus-id').value;
  const payload = {
    jabatan: document.getElementById('pengurus-jabatan').value,
    nama: document.getElementById('pengurus-nama').value,
    gelar: document.getElementById('pengurus-gelar').value,
    bio: document.getElementById('pengurus-bio').value,
    foto: document.getElementById('pengurus-foto').value,
  };
  try {
    const res = await fetch(`/api/pengurus/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Data pengurus berhasil diperbarui!');
      closeModal('modal-pengurus-form');
      loadPengurus();
    } else {
      showToast(data.error || 'Gagal memperbarui', 'error');
    }
  } catch (e) {
    showToast('Terjadi kesalahan', 'error');
  }
});

// ─── GALERI ──────────────────────────────────────────────────────────
async function loadGaleri() {
  const grid = document.getElementById('galeri-grid');
  grid.innerHTML = '<div class="loading-row" style="grid-column:1/-1">Memuat galeri...</div>';
  try {
    const res = await fetch('/api/galeri', { credentials: 'include' });
    const { data } = await res.json();
    if (!data || data.length === 0) {
      grid.innerHTML = '<div class="loading-row" style="grid-column:1/-1">Belum ada foto di galeri. Upload foto pertama!</div>';
      return;
    }
    grid.innerHTML = data.map(g => `
      <div class="galeri-item">
        <img class="galeri-thumb" src="${g.url}" alt="${escHtml(g.judul)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="galeri-thumb-placeholder" style="display:none">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="32" height="32"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/></svg>
        </div>
        <div class="galeri-info">
          <span class="galeri-title" title="${escHtml(g.judul)}">${escHtml(g.judul)}</span>
          <button class="btn-danger" onclick="deleteGaleri(${g.id})">✕</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<div class="loading-row" style="grid-column:1/-1">Gagal memuat galeri.</div>';
  }
}

// Upload zone click
document.getElementById('galeri-drop-zone').addEventListener('click', () => {
  document.getElementById('galeri-file').click();
});

document.getElementById('galeri-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('galeri-preview-img').src = ev.target.result;
      document.getElementById('galeri-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

// Drag & drop
['dragenter','dragover'].forEach(evt => {
  document.getElementById('galeri-drop-zone').addEventListener(evt, e => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  });
});
['dragleave','drop'].forEach(evt => {
  document.getElementById('galeri-drop-zone').addEventListener(evt, e => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (evt === 'drop') {
      const file = e.dataTransfer.files[0];
      document.getElementById('galeri-file').files = e.dataTransfer.files;
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          document.getElementById('galeri-preview-img').src = ev.target.result;
          document.getElementById('galeri-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    }
  });
});

document.getElementById('galeriForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('judul', document.getElementById('galeri-judul').value);
  fd.append('kategori', document.getElementById('galeri-kategori').value);
  fd.append('foto', document.getElementById('galeri-file').files[0]);

  try {
    const res = await fetch('/api/galeri', { method: 'POST', credentials: 'include', body: fd });
    const data = await res.json();
    if (data.success) {
      showToast('Foto berhasil diupload!');
      closeModal('modal-galeri-form');
      document.getElementById('galeriForm').reset();
      document.getElementById('galeri-preview').style.display = 'none';
      loadGaleri();
      loadDashboard();
    } else {
      showToast(data.error || 'Gagal upload', 'error');
    }
  } catch (e) {
    showToast('Terjadi kesalahan', 'error');
  }
});

async function deleteGaleri(id) {
  if (!confirm('Hapus foto ini dari galeri?')) return;
  try {
    const res = await fetch(`/api/galeri/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) { showToast('Foto berhasil dihapus'); loadGaleri(); loadDashboard(); }
    else showToast(data.error || 'Gagal menghapus', 'error');
  } catch (e) {
    showToast('Terjadi kesalahan', 'error');
  }
}

// ─── DOKUMEN ─────────────────────────────────────────────────────────
async function loadDokumen() {
  const tbody = document.getElementById('dokumen-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Memuat data...</td></tr>';
  try {
    const res = await fetch('/api/dokumen', { credentials: 'include' });
    const { data } = await res.json();
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Belum ada dokumen. Upload dokumen pertama!</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(d => `
      <tr>
        <td>
          <a href="${d.url}" target="_blank" style="color:#58a6ff; text-decoration:none;">
            📄 ${escHtml(d.nama)}
          </a>
        </td>
        <td>${escHtml(d.kategori)}</td>
        <td>${d.ukuran || '—'}</td>
        <td>${d.dibuat ? d.dibuat.split(' ')[0] : '—'}</td>
        <td><button class="btn-danger" onclick="deleteDokumen(${d.id}, '${escHtml(d.nama).replace(/'/g, "\\'")}')">Hapus</button></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Gagal memuat data.</td></tr>';
  }
}

// Upload zone for dokumen
document.getElementById('dokumen-drop-zone').addEventListener('click', () => {
  document.getElementById('dokumen-file').click();
});

document.getElementById('dokumen-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    document.getElementById('dokumen-filename').textContent = `📎 ${file.name}`;
  }
});

document.getElementById('dokumenForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('nama', document.getElementById('dokumen-nama').value);
  fd.append('kategori', document.getElementById('dokumen-kategori').value);
  fd.append('file', document.getElementById('dokumen-file').files[0]);

  try {
    const res = await fetch('/api/dokumen', { method: 'POST', credentials: 'include', body: fd });
    const data = await res.json();
    if (data.success) {
      showToast('Dokumen berhasil diupload!');
      closeModal('modal-dokumen-form');
      document.getElementById('dokumenForm').reset();
      document.getElementById('dokumen-filename').textContent = '';
      loadDokumen();
      loadDashboard();
    } else {
      showToast(data.error || 'Gagal upload', 'error');
    }
  } catch (e) {
    showToast('Terjadi kesalahan', 'error');
  }
});

async function deleteDokumen(id, nama) {
  if (!confirm(`Hapus dokumen "${nama}"?`)) return;
  try {
    const res = await fetch(`/api/dokumen/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json();
    if (data.success) { showToast('Dokumen berhasil dihapus'); loadDokumen(); loadDashboard(); }
    else showToast(data.error || 'Gagal menghapus', 'error');
  } catch (e) {
    showToast('Terjadi kesalahan', 'error');
  }
}

// ─── SETTINGS ────────────────────────────────────────────────────────
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPw = document.getElementById('currentPw').value;
  const newPw = document.getElementById('newPw').value;
  const confirmPw = document.getElementById('confirmPw').value;
  const msg = document.getElementById('pwMsg');

  msg.className = 'form-msg';

  if (newPw !== confirmPw) {
    msg.className = 'form-msg error';
    msg.textContent = 'Password baru dan konfirmasi tidak cocok.';
    return;
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
    });
    const data = await res.json();
    if (data.success) {
      msg.className = 'form-msg success';
      msg.textContent = '✅ Password berhasil diubah! Harap ingat password baru Anda.';
      document.getElementById('changePasswordForm').reset();
    } else {
      msg.className = 'form-msg error';
      msg.textContent = data.error || 'Gagal mengubah password.';
    }
  } catch (e) {
    msg.className = 'form-msg error';
    msg.textContent = 'Terjadi kesalahan.';
  }
});

// ─── Utils ───────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Initial Load ────────────────────────────────────────────────────
loadDashboard();
// Set today's date as default for new berita
document.getElementById('berita-tanggal').value = new Date().toISOString().split('T')[0];
