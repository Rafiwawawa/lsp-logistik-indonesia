/* =========================================================
   LSP LOGISTIK INDONESIA — ADMIN PANEL
   ========================================================= */

let csrfToken = null;
let toastTimer = null;

let beritaCache = [];
let pengurusCache = [];
let galeriCache = [];
let selectedGaleriFile = null;

/* =========================================================
   UTILITIES
   ========================================================= */

function escHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getErrorMessage(data, fallback = 'Terjadi kesalahan.') {
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

function getDataArray(response, keys = []) {
  const data = response?.data;

  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function mediaUrl(value, category) {
  if (!value) return '';

  if (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:')
  ) {
    return value;
  }

  if (value.startsWith(`${category}/`)) {
    return `/media/images/${value}`;
  }

  return value;
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.add('hidden');

  const hasOpenModal = [...document.querySelectorAll('.modal-overlay')]
    .some(item => !item.classList.contains('hidden'));

  if (!hasOpenModal) {
    document.body.style.overflow = '';
  }
}

function validateImage(file) {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('File harus berupa JPG, PNG, atau WebP.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran gambar maksimal 5 MB.');
  }

  return true;
}

function previewFile(file, wrapperId, imageId) {
  validateImage(file);

  const wrapper = document.getElementById(wrapperId);
  const image = document.getElementById(imageId);

  if (!wrapper || !image) return;

  const url = URL.createObjectURL(file);

  image.src = url;
  wrapper.classList.remove('hidden');

  image.onload = () => URL.revokeObjectURL(url);
}

function showExistingImage(url, wrapperId, imageId) {
  const wrapper = document.getElementById(wrapperId);
  const image = document.getElementById(imageId);

  if (!wrapper || !image) return;

  if (!url) {
    image.removeAttribute('src');
    wrapper.classList.add('hidden');
    return;
  }

  image.src = url;
  wrapper.classList.remove('hidden');
}

function setButtonLoading(button, loading, loadingText = 'Memproses...') {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

/* =========================================================
   AUTH + CSRF
   ========================================================= */

async function getCsrfToken(force = false) {
  if (csrfToken && !force) return csrfToken;

  const response = await fetch(`/api/auth/csrf-token?t=${Date.now()}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, 'Gagal menyiapkan token keamanan.')
    );
  }

  csrfToken = data?.data?.csrfToken || data?.csrfToken;

  if (!csrfToken) {
    throw new Error('Token CSRF tidak tersedia.');
  }

  return csrfToken;
}

async function apiFetch(url, options = {}, retryCsrf = true) {
  const method = (options.method || 'GET').toUpperCase();
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (mutating) {
    headers.set('X-CSRF-Token', await getCsrfToken(true));
  }

  let response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (response.status === 401) {
    window.location.replace('/admin/login.html');
    throw new Error('Sesi administrator telah berakhir.');
  }

  if (response.status === 403 && mutating && retryCsrf) {
    csrfToken = null;
    headers.set('X-CSRF-Token', await getCsrfToken(true));

    response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  }

  const data = await parseResponse(response);

  if (!response.ok || data?.success === false) {
    const error = new Error(
      getErrorMessage(
        data,
        `Request gagal (HTTP ${response.status}).`
      )
    );

    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function ensureAuthenticated() {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) {
    window.location.replace('/admin/login.html');
    return false;
  }

  const data = await parseResponse(response);

  const username =
    data?.data?.username ||
    data?.data?.admin?.username ||
    data?.username ||
    null;

  const authenticated =
    data?.authenticated === true ||
    data?.data?.authenticated === true ||
    Boolean(username);

  if (!authenticated) {
    window.location.replace('/admin/login.html');
    return false;
  }

  const usernameElement = document.getElementById('adminUsername');
  const avatarElement = document.getElementById('adminAvatar');

  if (usernameElement && username) {
    usernameElement.textContent = username;
  }

  if (avatarElement && username) {
    avatarElement.textContent = username.charAt(0).toUpperCase();
  }

  return true;
}

/* =========================================================
   NAVIGATION
   ========================================================= */

const sectionTitles = {
  dashboard: 'Dashboard',
  berita: 'Berita & Artikel',
  pengurus: 'Data Pengurus',
  galeri: 'Galeri Foto',
  settings: 'Pengaturan',
};

async function switchSection(name, updateHash = true) {
  if (!sectionTitles[name]) name = 'dashboard';

  document.querySelectorAll('.section').forEach(section => {
    section.classList.add('hidden');
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  document.getElementById(`sec-${name}`)?.classList.remove('hidden');
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active');

  const pageTitle = document.getElementById('pageTitle');

  if (pageTitle) {
    pageTitle.textContent = sectionTitles[name];
  }

  if (updateHash && location.hash !== `#${name}`) {
    history.replaceState(null, '', `#${name}`);
  }

  document.getElementById('sidebar')?.classList.remove('open');

  if (name === 'dashboard') await loadDashboard();
  if (name === 'berita') await loadBerita();
  if (name === 'pengurus') await loadPengurus();
  if (name === 'galeri') await loadGaleri();
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {
  const beritaStat = document.getElementById('stat-berita');
  const galeriStat = document.getElementById('stat-galeri');
  const pengurusStat = document.getElementById('stat-pengurus');

  if (beritaStat) beritaStat.textContent = '—';
  if (galeriStat) galeriStat.textContent = '—';
  if (pengurusStat) pengurusStat.textContent = '—';

  try {
    const [beritaResponse, galeriResponse, pengurusResponse] =
      await Promise.all([
        apiFetch('/api/berita?scope=admin&limit=100'),
        apiFetch('/api/galeri'),
        apiFetch('/api/pengurus'),
      ]);

    beritaCache = getDataArray(beritaResponse, ['berita']);
    galeriCache = getDataArray(galeriResponse, ['galeri']);
    pengurusCache = getDataArray(pengurusResponse, ['pengurus']);

    beritaStat.textContent = beritaCache.length;
    galeriStat.textContent = galeriCache.length;
    pengurusStat.textContent = pengurusCache.length;
  } catch (error) {
    console.error('[Dashboard]', error);
    showToast('Gagal memuat statistik dashboard.', 'error');
  }
}

/* =========================================================
   BERITA
   ========================================================= */

function renderBerita() {
  const tbody = document.getElementById('berita-tbody');

  if (!tbody) return;

  if (!beritaCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="loading-row">
          Belum ada berita atau artikel.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = beritaCache.map(item => {
    const date = item.published_at || item.created_at || '';
    const status = item.status || 'draft';

    return `
      <tr>
        <td style="max-width:320px;">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">
            ${escHtml(item.judul)}
          </div>
        </td>

        <td>${escHtml(item.kategori || 'Berita')}</td>

        <td>${escHtml(formatDate(date))}</td>

        <td>
          <span class="badge badge-${escHtml(status)}">
            ${escHtml(status)}
          </span>
        </td>

        <td>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
            <button
              type="button"
              class="btn-edit"
              data-action="edit-berita"
              data-id="${item.id}"
            >
              Edit
            </button>

            <button
              type="button"
              class="btn-danger"
              data-action="delete-berita"
              data-id="${item.id}"
            >
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadBerita() {
  const tbody = document.getElementById('berita-tbody');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="loading-row">Memuat data...</td>
      </tr>
    `;
  }

  try {
    const response = await apiFetch('/api/berita?scope=admin&limit=100');

    beritaCache = getDataArray(response, ['berita']);
    renderBerita();
  } catch (error) {
    console.error('[Berita]', error);

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="loading-row">
            Gagal memuat data berita dan artikel.
          </td>
        </tr>
      `;
    }
  }
}

function resetBeritaForm() {
  const form = document.getElementById('beritaForm');

  form?.reset();

  document.getElementById('berita-id').value = '';
  document.getElementById('berita-modal-title').textContent = 'Tambah Konten';
  document.getElementById('berita-submit-btn').textContent = 'Simpan Konten';
  document.getElementById('berita-kategori').value = 'Berita';
  document.getElementById('berita-status').value = 'draft';

  showExistingImage(
    '',
    'berita-preview',
    'berita-preview-img'
  );
}

function ensureCategoryOption(select, value) {
  if (!select || !value) return;

  const exists = [...select.options]
    .some(option => option.value === value);

  if (!exists) {
    select.add(new Option(value, value));
  }

  select.value = value;
}

function editBerita(id) {
  const article = beritaCache.find(
    item => Number(item.id) === Number(id)
  );

  if (!article) {
    showToast('Data berita atau artikel tidak ditemukan.', 'error');
    return;
  }

  document.getElementById('berita-id').value = article.id;
  document.getElementById('berita-judul').value = article.judul || '';
  document.getElementById('berita-ringkasan').value = article.ringkasan || '';
  document.getElementById('berita-isi').value = article.isi || '';
  document.getElementById('berita-status').value = article.status || 'draft';

  const categorySelect = document.getElementById('berita-kategori');
  categorySelect.value = article.kategori === 'Artikel' ? 'Artikel' : 'Berita';

  document.getElementById('berita-thumbnail').value = '';
  document.getElementById('berita-modal-title').textContent = 'Edit Konten';
  document.getElementById('berita-submit-btn').textContent = 'Simpan Perubahan';

  const thumbnail = mediaUrl(
    article.thumbnail_url || article.thumbnail,
    'berita'
  );

  showExistingImage(
    thumbnail,
    'berita-preview',
    'berita-preview-img'
  );

  openModal('modal-berita-form');
}

async function deleteBerita(id) {
  const article = beritaCache.find(
    item => Number(item.id) === Number(id)
  );

  const title = article?.judul || 'konten ini';

  if (!confirm(`Hapus "${title}"?\n\nTindakan ini tidak dapat dibatalkan.`)) {
    return;
  }

  try {
    await apiFetch(`/api/berita/${id}`, {
      method: 'DELETE',
    });

    showToast('Konten berhasil dihapus.');

    await Promise.all([
      loadBerita(),
      loadDashboard(),
    ]);
  } catch (error) {
    console.error('[Delete Berita]', error);
    showToast(error.message, 'error');
  }
}

/* =========================================================
   PENGURUS
   ========================================================= */

function renderPengurus() {
  const grid = document.getElementById('pengurus-grid');

  if (!grid) return;

  if (!pengurusCache.length) {
    grid.innerHTML = `
      <div class="loading-row">
        Belum ada data pengurus.
      </div>
    `;
    return;
  }

  grid.innerHTML = pengurusCache.map(item => {
    const photo = mediaUrl(
      item.foto_url || item.foto,
      'pengurus'
    );

    const initial = escHtml(
      (item.nama || '?').charAt(0).toUpperCase()
    );

    return `
      <article class="pengurus-card">
        <div class="pengurus-avatar">
          ${
            photo
              ? `<img src="${escHtml(photo)}" alt="${escHtml(item.foto_alt || item.nama || 'Foto pengurus')}">`
              : initial
          }
        </div>

        <div class="pengurus-info">
          <div class="pengurus-jabatan">
            ${escHtml(item.jabatan)}
          </div>

          <div class="pengurus-nama">
            ${escHtml(item.nama)}
          </div>

          ${
            item.gelar
              ? `<div class="pengurus-gelar">${escHtml(item.gelar)}</div>`
              : ''
          }

          ${
            item.bio
              ? `<div class="pengurus-bio">${escHtml(item.bio)}</div>`
              : ''
          }

          <button
            type="button"
            class="btn-edit"
            data-action="edit-pengurus"
            data-id="${item.id}"
            style="margin-top:.75rem;"
          >
            Edit Data
          </button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadPengurus() {
  const grid = document.getElementById('pengurus-grid');

  if (grid) {
    grid.innerHTML = `
      <div class="loading-row">
        Memuat data pengurus...
      </div>
    `;
  }

  try {
    const response = await apiFetch('/api/pengurus');

    pengurusCache = getDataArray(response, ['pengurus']);
    renderPengurus();
  } catch (error) {
    console.error('[Pengurus]', error);

    if (grid) {
      grid.innerHTML = `
        <div class="loading-row">
          Gagal memuat data pengurus.
        </div>
      `;
    }
  }
}

function editPengurus(id) {
  const item = pengurusCache.find(
    pengurus => Number(pengurus.id) === Number(id)
  );

  if (!item) {
    showToast('Data pengurus tidak ditemukan.', 'error');
    return;
  }

  document.getElementById('pengurus-id').value = item.id;
  document.getElementById('pengurus-jabatan').value = item.jabatan || '';
  document.getElementById('pengurus-nama').value = item.nama || '';
  document.getElementById('pengurus-gelar').value = item.gelar || '';
  document.getElementById('pengurus-bio').value = item.bio || '';
  document.getElementById('pengurus-foto-alt').value = item.foto_alt || '';
  document.getElementById('pengurus-urutan').value = item.urutan ?? 0;
  document.getElementById('pengurus-foto-file').value = '';

  const photo = mediaUrl(
    item.foto_url || item.foto,
    'pengurus'
  );

  showExistingImage(
    photo,
    'pengurus-preview',
    'pengurus-preview-img'
  );

  openModal('modal-pengurus-form');
}

/* =========================================================
   GALERI
   ========================================================= */

function renderGaleri() {
  const grid = document.getElementById('galeri-grid');

  if (!grid) return;

  if (!galeriCache.length) {
    grid.innerHTML = `
      <div class="loading-row" style="grid-column:1/-1;">
        Belum ada foto di galeri.
      </div>
    `;
    return;
  }

  grid.innerHTML = galeriCache.map(item => {
    const image = mediaUrl(
      item.url ||
      item.image_url ||
      item.foto_url ||
      item.image_path,
      'galeri'
    );

    return `
      <article class="galeri-item">
        ${
          image
            ? `<img class="galeri-thumb" src="${escHtml(image)}" alt="${escHtml(item.alt_text || item.judul || 'Foto galeri')}">`
            : `<div class="galeri-thumb-placeholder">Tidak ada gambar</div>`
        }

        <div class="galeri-info">
          <span
            class="galeri-title"
            title="${escHtml(item.judul)}"
          >
            ${escHtml(item.judul)}
          </span>

          <button
            type="button"
            class="btn-danger"
            data-action="delete-galeri"
            data-id="${item.id}"
            aria-label="Hapus foto"
          >
            Hapus
          </button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadGaleri() {
  const grid = document.getElementById('galeri-grid');

  if (grid) {
    grid.innerHTML = `
      <div class="loading-row" style="grid-column:1/-1;">
        Memuat galeri...
      </div>
    `;
  }

  try {
    const response = await apiFetch('/api/galeri');

    galeriCache = getDataArray(response, ['galeri']);
    renderGaleri();
  } catch (error) {
    console.error('[Galeri]', error);

    if (grid) {
      grid.innerHTML = `
        <div class="loading-row" style="grid-column:1/-1;">
          Gagal memuat galeri.
        </div>
      `;
    }
  }
}

function resetGaleriForm() {
  document.getElementById('galeriForm')?.reset();

  selectedGaleriFile = null;

  showExistingImage(
    '',
    'galeri-preview',
    'galeri-preview-img'
  );

  document.getElementById('galeri-drop-zone')
    ?.classList.remove('drag-over');
}

async function deleteGaleri(id) {
  if (!confirm('Hapus foto ini dari galeri?')) return;

  try {
    await apiFetch(`/api/galeri/${id}`, {
      method: 'DELETE',
    });

    showToast('Foto berhasil dihapus.');

    await Promise.all([
      loadGaleri(),
      loadDashboard(),
    ]);
  } catch (error) {
    console.error('[Delete Galeri]', error);
    showToast(error.message, 'error');
  }
}

/* =========================================================
   EVENTS — NAVIGATION
   ========================================================= */

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', event => {
    event.preventDefault();
    switchSection(item.dataset.section);
  });
});

window.addEventListener('hashchange', () => {
  const section = location.hash.replace('#', '');

  if (sectionTitles[section]) {
    switchSection(section, false);
  }
});

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

document.addEventListener('click', event => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');

  if (
    window.innerWidth <= 768 &&
    sidebar?.classList.contains('open') &&
    !sidebar.contains(event.target) &&
    !toggle?.contains(event.target)
  ) {
    sidebar.classList.remove('open');
  }
});

/* =========================================================
   EVENTS — MODALS
   ========================================================= */

document.querySelectorAll('[data-close-modal]').forEach(button => {
  button.addEventListener('click', () => {
    closeModal(button.dataset.closeModal);
  });
});

document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal(modal.id);
    }
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;

  document.querySelectorAll('.modal-overlay:not(.hidden)')
    .forEach(modal => closeModal(modal.id));
});

/* =========================================================
   EVENTS — QUICK ACTIONS
   ========================================================= */

document.getElementById('quickAddBerita')?.addEventListener('click', async () => {
  await switchSection('berita');
  resetBeritaForm();
  openModal('modal-berita-form');
});

document.getElementById('quickAddGaleri')?.addEventListener('click', async () => {
  await switchSection('galeri');
  resetGaleriForm();
  openModal('modal-galeri-form');
});

document.getElementById('quickEditPengurus')?.addEventListener('click', async () => {
  await switchSection('pengurus');
});

document.getElementById('btnNewBerita')?.addEventListener('click', () => {
  resetBeritaForm();
  openModal('modal-berita-form');
});

document.getElementById('btnNewGaleri')?.addEventListener('click', () => {
  resetGaleriForm();
  openModal('modal-galeri-form');
});

/* =========================================================
   EVENTS — BERITA
   ========================================================= */

document.getElementById('berita-tbody')?.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');

  if (!button) return;

  const id = Number(button.dataset.id);

  if (button.dataset.action === 'edit-berita') {
    editBerita(id);
  }

  if (button.dataset.action === 'delete-berita') {
    deleteBerita(id);
  }
});

document.getElementById('berita-thumbnail')?.addEventListener('change', event => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    previewFile(
      file,
      'berita-preview',
      'berita-preview-img'
    );
  } catch (error) {
    event.target.value = '';
    showToast(error.message, 'error');
  }
});

document.getElementById('beritaForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const id = document.getElementById('berita-id').value;
  const button = document.getElementById('berita-submit-btn');
  const thumbnail = document.getElementById('berita-thumbnail').files?.[0];

  try {
    if (thumbnail) validateImage(thumbnail);

    const judul = document.getElementById('berita-judul').value.trim();
    const isi = document.getElementById('berita-isi').value.trim();
    const kategori = document.getElementById('berita-kategori').value;
    const status = document.getElementById('berita-status').value;

    if (!judul || !isi) {
      throw new Error('Judul dan isi konten wajib diisi.');
    }

    if (!['Berita', 'Artikel'].includes(kategori)) {
      throw new Error('Jenis konten harus Berita atau Artikel.');
    }

    const formData = new FormData();

    formData.append('judul', judul);

    formData.append(
      'ringkasan',
      document.getElementById('berita-ringkasan').value.trim()
    );

    formData.append('isi', isi);

    formData.append('kategori', kategori);

    formData.append('status', status);

    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    setButtonLoading(button, true, 'Menyimpan...');

    await apiFetch(
      id ? `/api/berita/${id}` : '/api/berita',
      {
        method: id ? 'PUT' : 'POST',
        body: formData,
      }
    );

    showToast(
      id
        ? 'Konten berhasil diperbarui.'
        : 'Konten berhasil dibuat.'
    );

    closeModal('modal-berita-form');

    await Promise.all([
      loadBerita(),
      loadDashboard(),
    ]);
  } catch (error) {
    console.error('[Save Berita]', error);
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

/* =========================================================
   EVENTS — PENGURUS
   ========================================================= */

document.getElementById('pengurus-grid')?.addEventListener('click', event => {
  const button = event.target.closest('[data-action="edit-pengurus"]');

  if (!button) return;

  editPengurus(Number(button.dataset.id));
});

document.getElementById('pengurus-foto-file')?.addEventListener('change', event => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    previewFile(
      file,
      'pengurus-preview',
      'pengurus-preview-img'
    );
  } catch (error) {
    event.target.value = '';
    showToast(error.message, 'error');
  }
});

document.getElementById('pengurusForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const id = document.getElementById('pengurus-id').value;
  const button = document.getElementById('pengurus-submit-btn');
  const photo = document.getElementById('pengurus-foto-file').files?.[0];

  if (!id) {
    showToast('ID pengurus tidak ditemukan.', 'error');
    return;
  }

  try {
    if (photo) validateImage(photo);

    const formData = new FormData();

    formData.append(
      'jabatan',
      document.getElementById('pengurus-jabatan').value.trim()
    );

    formData.append(
      'nama',
      document.getElementById('pengurus-nama').value.trim()
    );

    formData.append(
      'gelar',
      document.getElementById('pengurus-gelar').value.trim()
    );

    formData.append(
      'bio',
      document.getElementById('pengurus-bio').value.trim()
    );

    formData.append(
      'foto_alt',
      document.getElementById('pengurus-foto-alt').value.trim()
    );

    formData.append(
      'urutan',
      document.getElementById('pengurus-urutan').value || '0'
    );

    if (photo) {
      formData.append('foto', photo);
    }

    setButtonLoading(button, true, 'Menyimpan...');

    await apiFetch(`/api/pengurus/${id}`, {
      method: 'PUT',
      body: formData,
    });

    showToast('Data pengurus berhasil diperbarui.');
    closeModal('modal-pengurus-form');

    await Promise.all([
      loadPengurus(),
      loadDashboard(),
    ]);
  } catch (error) {
    console.error('[Save Pengurus]', error);
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

/* =========================================================
   EVENTS — GALERI
   ========================================================= */

document.getElementById('galeri-grid')?.addEventListener('click', event => {
  const button = event.target.closest('[data-action="delete-galeri"]');

  if (!button) return;

  deleteGaleri(Number(button.dataset.id));
});

const galleryDropZone = document.getElementById('galeri-drop-zone');
const galleryFileInput = document.getElementById('galeri-file');

galleryDropZone?.addEventListener('click', () => {
  galleryFileInput?.click();
});

galleryDropZone?.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    galleryFileInput?.click();
  }
});

galleryFileInput?.addEventListener('change', event => {
  const file = event.target.files?.[0];

  if (!file) {
    selectedGaleriFile = null;
    return;
  }

  try {
    validateImage(file);
    selectedGaleriFile = file;

    previewFile(
      file,
      'galeri-preview',
      'galeri-preview-img'
    );
  } catch (error) {
    selectedGaleriFile = null;
    event.target.value = '';
    showToast(error.message, 'error');
  }
});

['dragenter', 'dragover'].forEach(eventName => {
  galleryDropZone?.addEventListener(eventName, event => {
    event.preventDefault();
    galleryDropZone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  galleryDropZone?.addEventListener(eventName, event => {
    event.preventDefault();

    galleryDropZone.classList.remove('drag-over');

    if (eventName !== 'drop') return;

    const file = event.dataTransfer?.files?.[0];

    if (!file) return;

    try {
      validateImage(file);
      selectedGaleriFile = file;

      previewFile(
        file,
        'galeri-preview',
        'galeri-preview-img'
      );
    } catch (error) {
      selectedGaleriFile = null;
      showToast(error.message, 'error');
    }
  });
});

document.getElementById('galeriForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const button = document.getElementById('galeri-submit-btn');
  const file =
    selectedGaleriFile ||
    galleryFileInput?.files?.[0];

  if (!file) {
    showToast('Pilih foto terlebih dahulu.', 'error');
    return;
  }

  try {
    validateImage(file);

    const formData = new FormData();

    formData.append(
      'judul',
      document.getElementById('galeri-judul').value.trim()
    );

    formData.append(
      'caption',
      document.getElementById('galeri-caption').value.trim()
    );

    formData.append(
      'alt_text',
      document.getElementById('galeri-alt').value.trim()
    );

    formData.append(
      'kategori',
      document.getElementById('galeri-kategori').value
    );

    formData.append('foto', file);

    setButtonLoading(button, true, 'Mengupload...');

    await apiFetch('/api/galeri', {
      method: 'POST',
      body: formData,
    });

    showToast('Foto berhasil ditambahkan ke galeri.');

    closeModal('modal-galeri-form');
    resetGaleriForm();

    await Promise.all([
      loadGaleri(),
      loadDashboard(),
    ]);
  } catch (error) {
    console.error('[Upload Galeri]', error);
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

/* =========================================================
   SETTINGS
   ========================================================= */

document.getElementById('changePasswordForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const currentPassword = document.getElementById('currentPw').value;
  const newPassword = document.getElementById('newPw').value;
  const confirmPassword = document.getElementById('confirmPw').value;
  const message = document.getElementById('pwMsg');
  const button = document.getElementById('changePasswordSubmit');

  message.className = 'form-msg';
  message.textContent = '';

  if (newPassword !== confirmPassword) {
    message.className = 'form-msg error';
    message.textContent = 'Konfirmasi password baru tidak cocok.';
    return;
  }

  const passwordBytes = new TextEncoder().encode(newPassword).length;

  if (passwordBytes < 12 || passwordBytes > 72) {
    message.className = 'form-msg error';
    message.textContent = 'Password harus berukuran 12–72 byte UTF-8.';
    return;
  }

  try {
    setButtonLoading(button, true, 'Menyimpan...');

    await apiFetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    message.className = 'form-msg success';
    message.textContent = 'Password berhasil diubah. Silakan login kembali.';

    form.reset();
    csrfToken = null;

    setTimeout(() => {
      window.location.replace('/admin/login.html');
    }, 1200);
  } catch (error) {
    console.error('[Change Password]', error);

    message.className = 'form-msg error';
    message.textContent = error.message;
  } finally {
    setButtonLoading(button, false);
  }
});

/* =========================================================
   LOGOUT
   ========================================================= */

document.getElementById('btnLogout')?.addEventListener('click', async () => {
  if (!confirm('Keluar dari panel administrator?')) return;

  try {
    await apiFetch('/api/auth/logout', {
      method: 'POST',
    });

    csrfToken = null;
    window.location.replace('/admin/login.html');
  } catch (error) {
    console.error('[Logout]', error);
    showToast(error.message, 'error');
  }
});

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdmin() {
  try {
    const authenticated = await ensureAuthenticated();

    if (!authenticated) return;

    try {
      await getCsrfToken();
    } catch (error) {
      console.error('[CSRF Init]', error);
      showToast('Gagal menyiapkan sesi keamanan.', 'error');
    }

    const requestedSection = location.hash.replace('#', '');
    const initialSection = sectionTitles[requestedSection]
      ? requestedSection
      : 'dashboard';

    await switchSection(initialSection, true);
  } catch (error) {
    console.error('[Admin Init]', error);
  }
}

initializeAdmin();