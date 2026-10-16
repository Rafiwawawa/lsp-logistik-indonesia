/* ==========================================================================
   SEARCH OVERLAY MODAL & GLOBAL SEARCH ENGINE
   LSP IND Logistik Indonesia
   ========================================================================== */

const LSP_STATIC_SEARCH_DATA = [
  // 1 Skema Sertifikasi Resmi
  {
    id: 'skema-1',
    title: 'Skema Sertifikasi Supervisor Gudang dan Distribusi',
    category: 'Skema Sertifikasi',
    desc: 'Skema operasional fisik (7 Unit Kompetensi): Stock take & cycle count, pergerakan barang, pengeluaran barang, pemberangkatan/penarikan barang, pengaturan kendaraan, dokumen pengiriman/retur, dan pengendalian mutu persediaan.',
    url: 'layanan.html',
    tags: ['supervisor', 'gudang', 'distribusi', 'skkni', 'skkk', 'stock take', 'cycle count', 'pergerakan barang', 'pengeluaran barang', 'retur', 'kendaraan']
  },

  // Profil & FAQ
  {
    id: 'profil-1',
    title: 'Profil LSP LOGISTIK INDONESIA & Legalitas BNSP',
    category: 'Profil',
    desc: 'Informasi latar belakang pendirian oleh Asosiasi Logistik Indonesia (ALI), visi misi, dan struktur organisasi LSP P3.',
    url: 'profil.html',
    tags: ['profil', 'visi misi', 'legalitas', 'bnsp', 'ali']
  },
  {
    id: 'faq-1',
    title: 'Pertanyaan yang Sering Diajukan (FAQ) Asesmen & Sertifikasi LSP Logistik Indonesia',
    category: 'FAQ',
    desc: 'Panduan lengkap asesmen berbasis kompetensi, pengisian APL-01 & APL-02, persyaratan bukti VATM, metode uji, TUK, dan penerbitan sertifikat BNSP.',
    url: 'faq.html',
    tags: ['faq', 'asesi', 'asesor', 'asesmen mandiri', 'apl-01', 'apl-02', 'vatm', 'bukti valid', 'portofolio', 'tuk', 'sertifikat', 'bnsp']
  }
];

window.LSP_SEARCH_DATA = LSP_STATIC_SEARCH_DATA;
window.LSP_SEARCH_ERROR = false;
let searchDataPromise;
const LSP_SEARCH_API_TIMEOUT_MS = 5000;

window.loadLspSearchData = function() {
  // Keep the settled promise on failure too, so each keystroke cannot retry the API.
  if (searchDataPromise) return searchDataPromise;

  searchDataPromise = (async () => {
    const articles = [];
    const limit = 100;

    try {
      for (let offset = 0; ; offset += limit) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LSP_SEARCH_API_TIMEOUT_MS);

        try {
          const response = await fetch(`/api/berita?limit=${limit}&offset=${offset}`, {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const payload = await response.json();
          if (!payload.success || !Array.isArray(payload.data)) {
            throw new Error('Format data berita tidak valid.');
          }

          articles.push(...payload.data);
          if (payload.data.length < limit) break;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      window.LSP_SEARCH_DATA = [
        ...LSP_STATIC_SEARCH_DATA,
        ...articles.filter(item => item.slug && item.status === 'terbit').map(item => ({
          title: item.judul || '',
          category: item.kategori === 'Artikel' ? 'Artikel' : 'Berita',
          desc: String(item.ringkasan || item.isi || '').replace(/\s+/g, ' ').slice(0, 180),
          url: `/pages/detail-berita.html?slug=${encodeURIComponent(item.slug)}`,
          tags: [],
        })),
      ];
      window.LSP_SEARCH_ERROR = false;
    } catch (error) {
      console.error('[Search data]', error);
      window.LSP_SEARCH_ERROR = true;
    }

    return window.LSP_SEARCH_DATA;
  })();

  return searchDataPromise;
};

window.performLspSearch = function(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  
  return window.LSP_SEARCH_DATA.filter(item => {
    return item.title.toLowerCase().includes(q) ||
           item.desc.toLowerCase().includes(q) ||
           item.category.toLowerCase().includes(q) ||
           item.tags.some(tag => tag.toLowerCase().includes(q));
  });
};

function initSearchModal() {
  const searchBtns = document.querySelectorAll('.search-trigger-btn');
  const searchModal = document.querySelector('#searchModal');
  if (!searchModal) return;

  const closeBtn = searchModal.querySelector('.modal-close');
  const searchInput = searchModal.querySelector('input');
  const modalBody = searchModal.querySelector('.modal-body');

  // Detect path relative to pages/
  const isSubfolder = window.location.pathname.includes('/pages/');
  const pagesPath = isSubfolder ? '' : 'pages/';

  // Create container for live search results if missing
  let resultsContainer = searchModal.querySelector('.search-modal-results');
  if (!resultsContainer && modalBody) {
    resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-modal-results';
    resultsContainer.style.cssText = 'margin-top: 1rem; max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;';
    modalBody.appendChild(resultsContainer);
  }

  const openSearch = () => {
    searchModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 150);
    }
  };

  const closeSearch = () => {
    searchModal.classList.remove('active');
    document.body.style.overflow = '';
  };

  searchBtns.forEach(btn => btn.addEventListener('click', openSearch));
  if (closeBtn) closeBtn.addEventListener('click', closeSearch);

  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) closeSearch();
  });

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Live search inside modal
  if (searchInput && resultsContainer) {
    const renderModalResults = () => {
      const q = searchInput.value.trim();
      const results = window.performLspSearch(q);

      if (!q) {
        resultsContainer.innerHTML = '';
        return;
      }

      if (q.length < 2) {
        resultsContainer.textContent = 'Ketik minimal 2 karakter untuk mencari.';
        return;
      }

      if (results.length === 0) {
        if (window.LSP_SEARCH_ERROR) {
          resultsContainer.textContent = 'Berita belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.';
          return;
        }
        resultsContainer.innerHTML = `
          <div style="padding: 1rem; text-align: center; color: var(--color-text-muted); font-size: 0.9rem; background: var(--color-surface); border-radius: var(--radius-md);">
            Tidak ada hasil untuk "<strong>${escapeHTML(q)}</strong>".
          </div>
        `;
      } else {
        resultsContainer.innerHTML = results.slice(0, 5).map(item => {
          const itemUrl = item.url.startsWith('/') ? item.url : `/pages/${item.url}`;
          return `
            <a href="${escapeHTML(itemUrl)}" class="search-result-item" style="display: block; padding: 0.75rem 1rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); text-decoration: none; transition: transform 0.2s, border-color 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <span style="font-weight: 600; color: var(--color-text-main); font-size: 0.95rem;">${escapeHTML(item.title)}</span>
                <span style="font-size: 0.75rem; background: var(--color-secondary-soft); color: var(--color-secondary); padding: 0.15rem 0.5rem; border-radius: 99px; font-weight: 600;">${escapeHTML(item.category)}</span>
              </div>
              <p style="font-size: 0.825rem; color: var(--color-text-muted); margin: 0; line-height: 1.4;">${escapeHTML(item.desc)}</p>
            </a>
          `;
        }).join('');
      }
    };

    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim().length < 2) {
        renderModalResults();
        return;
      }
      resultsContainer.textContent = 'Memuat hasil pencarian...';
      window.loadLspSearchData().then(renderModalResults);
    });

    // Handle Enter key inside searchInput to open search.html
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          const searchPageUrl = pagesPath + 'search.html?q=' + encodeURIComponent(query);
          window.location.href = searchPageUrl;
        }
      }
    });
  }

  // Global Keyboard Shortcut: '/' to open search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && searchModal.classList.contains('active')) {
      closeSearch();
    }
  });
}

document.addEventListener('DOMContentLoaded', initSearchModal);
