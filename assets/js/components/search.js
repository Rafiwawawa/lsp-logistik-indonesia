/* ==========================================================================
   SEARCH OVERLAY MODAL & GLOBAL SEARCH ENGINE
   LSP IND Logistik Indonesia
   ========================================================================== */

window.LSP_SEARCH_DATA = [
  // 1 Skema Sertifikasi Resmi
  {
    id: 'skema-1',
    title: 'Skema Sertifikasi Supervisor Gudang dan Distribusi',
    category: 'Skema Sertifikasi',
    desc: 'Skema operasional fisik (7 Unit Kompetensi): Stock take & cycle count, pergerakan barang, pengeluaran barang, pemberangkatan/penarikan barang, pengaturan kendaraan, dokumen pengiriman/retur, dan pengendalian mutu persediaan.',
    url: 'layanan.html',
    tags: ['supervisor', 'gudang', 'distribusi', 'skkni', 'skkk', 'stock take', 'cycle count', 'pergerakan barang', 'pengeluaran barang', 'retur', 'kendaraan']
  },

  // Berita & Informasi Resmi PDF
  {
    id: 'berita-1',
    title: 'Profil LSP Logistik Indonesia (P3) Didirikan Oleh Asosiasi Logistik Indonesia (ALI)',
    category: 'Berita',
    desc: 'LSP Logistik Indonesia (P3) terlisensi BNSP No. BNSP-LSP-093-ID & SK Perpanjangan KEP.1757/BNSP/IX/2022 mendukung pengakuan kompetensi nasional.',
    url: 'detail-berita.html?id=1',
    tags: ['ali', 'asosiasi logistik indonesia', 'bnsp-lsp-093-id', 'p3', 'lisensi']
  },
  {
    id: 'berita-2',
    title: 'Manfaat Sertifikasi Bagi Perusahaan, Atasan, Dan Peserta Logistik',
    category: 'Berita',
    desc: 'Penjelasan manfaat sertifikasi profesi logistik dalam meningkatkan standar kualifikasi, jenjang karier, dan penempatan personil kerja.',
    url: 'detail-berita.html?id=2',
    tags: ['manfaat', 'sertifikasi', 'perusahaan', 'peserta', 'karier']
  },
  {
    id: 'berita-3',
    title: 'Struktur Organisasi LSP Logistik Indonesia Pimpinan Ir. Mahendra Rianto, CSLP',
    category: 'Berita',
    desc: 'Susunan pengarah, direktur, sekretaris, komite skema, manajer sertifikasi, dan manajer mutu LSP Logistik Indonesia.',
    url: 'detail-berita.html?id=3',
    tags: ['mahendra rianto', 'organisasi', 'direktur', 'manajer mutu', 'komite skema']
  },

  // Dokumen
  {
    id: 'doc-1',
    title: 'Formulir Permohonan Sertifikasi APL-01 LSP LOGISTIK INDONESIA',
    category: 'Dokumen',
    desc: 'Formulir pendaftaran resmi permohonan sertifikasi kompetensi (APL-01) format PDF interaktif.',
    url: 'dokumen.html#apl-01',
    tags: ['apl-01', 'formulir', 'pendaftaran', 'unduh', 'pdf']
  },
  {
    id: 'doc-2',
    title: 'Formulir Asesmen Mandiri APL-02 Logistik',
    category: 'Dokumen',
    desc: 'Lembar asesmen mandiri bukti portofolio kerja asesi sesuai unit kompetensi SKKNI.',
    url: 'dokumen.html#apl-02',
    tags: ['apl-02', 'asesmen mandiri', 'portofolio', 'pdf']
  },
  {
    id: 'doc-3',
    title: 'Salinan SKKNI No. 354 Tahun 2014 Sektor Pos dan Logistik',
    category: 'Dokumen',
    desc: 'Dokumen standar kompetensi kerja nasional Indonesia resmi Keputusan Kementerian Ketenagakerjaan.',
    url: 'dokumen.html#skkni-354',
    tags: ['skkni', 'regulasi', 'kepmennaker', 'pdf']
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

window.performLspSearch = function(query) {
  if (!query || query.trim() === '') return [];
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
  const rootPath = isSubfolder ? '../' : './';
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
  return str.replace(/[&<>'"]/g, 
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
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      const results = window.performLspSearch(q);

      if (!q.trim()) {
        resultsContainer.innerHTML = '';
        return;
      }

      if (results.length === 0) {
        resultsContainer.innerHTML = `
          <div style="padding: 1rem; text-align: center; color: var(--color-text-muted); font-size: 0.9rem; background: var(--color-surface); border-radius: var(--radius-md);">
            Tidak ada hasil untuk "<strong>${escapeHTML(q)}</strong>". Tekan Enter untuk mencari lebih lanjut.
          </div>
        `;
      } else {
        resultsContainer.innerHTML = results.slice(0, 5).map(item => {
          let itemUrl = item.url;
          if (!isSubfolder && itemUrl.startsWith('detail-berita')) {
            itemUrl = 'pages/' + itemUrl;
          } else if (!isSubfolder && !itemUrl.startsWith('pages/') && !itemUrl.startsWith('../')) {
            itemUrl = 'pages/' + itemUrl;
          } else if (isSubfolder && itemUrl === 'profil.html') {
            itemUrl = 'profil.html';
          }
          return `
            <a href="${itemUrl}" class="search-result-item" style="display: block; padding: 0.75rem 1rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); text-decoration: none; transition: transform 0.2s, border-color 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <span style="font-weight: 600; color: var(--color-text-main); font-size: 0.95rem;">${item.title}</span>
                <span style="font-size: 0.75rem; background: var(--color-secondary-soft); color: var(--color-secondary); padding: 0.15rem 0.5rem; border-radius: 99px; font-weight: 600;">${item.category}</span>
              </div>
              <p style="font-size: 0.825rem; color: var(--color-text-muted); margin: 0; line-height: 1.4;">${item.desc}</p>
            </a>
          `;
        }).join('');
      }
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

