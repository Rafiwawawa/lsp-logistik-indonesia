(() => {
  const state = {
    items: [],
    category: 'all',
    query: '',
  };

  const grid = document.getElementById('newsGrid');
  const empty = document.getElementById('newsEmpty');
  const status = document.getElementById('newsResultStatus');
  const searchInput = document.getElementById('newsSearchInput');
  const resetButton = document.getElementById('btnResetNewsFilter');
  const categoryButtons = [...document.querySelectorAll('.news-pill-btn')];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'Tanggal belum tersedia';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function excerpt(item) {
    const source = (item.ringkasan || item.isi || '').trim();
    return source || 'Baca informasi selengkapnya mengenai publikasi ini.';
  }

  function renderCounts() {
    document.getElementById('countAll').textContent = state.items.length;
    document.getElementById('countBerita').textContent =
      state.items.filter(item => item.kategori === 'Berita').length;
    document.getElementById('countArtikel').textContent =
      state.items.filter(item => item.kategori === 'Artikel').length;
  }

  function getFilteredItems() {
    const query = state.query.toLowerCase();

    return state.items.filter(item => {
      const matchesCategory =
        state.category === 'all' || item.kategori === state.category;

      const searchable = [
        item.judul,
        item.ringkasan,
        item.isi,
      ].join(' ').toLowerCase();

      return matchesCategory && (!query || searchable.includes(query));
    });
  }

  function renderThumbnail(item) {
    if (item.thumbnail_url) {
      return `
        <div class="news-thumb">
          <img src="${escapeHtml(item.thumbnail_url)}" alt="${escapeHtml(item.judul)}" loading="lazy">
          <span class="news-type-badge">${escapeHtml(item.kategori)}</span>
        </div>
      `;
    }

    return `
      <div class="news-thumb news-thumb-placeholder">
        <img src="/assets/img/logo-ilcc.jpg" alt="" aria-hidden="true">
        <span class="news-type-badge">${escapeHtml(item.kategori)}</span>
      </div>
    `;
  }

  function render() {
    const items = getFilteredItems();

    empty.classList.toggle('show', items.length === 0);
    status.textContent = `Menampilkan ${items.length} dari ${state.items.length} konten`;

    if (!items.length) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = items.map(item => {
      const detailUrl = `/pages/detail-berita.html?slug=${encodeURIComponent(item.slug)}`;

      return `
        <article class="news-card card hover-lift">
          ${renderThumbnail(item)}

          <div class="news-content">
            <div class="news-meta">
              <span>${escapeHtml(formatDate(item.published_at || item.created_at))}</span>
              <span class="news-meta-dot">•</span>
              <span>LSP Logistik Indonesia</span>
            </div>

            <h3 class="news-title">
              <a href="${detailUrl}">${escapeHtml(item.judul)}</a>
            </h3>

            <p class="news-excerpt">${escapeHtml(excerpt(item))}</p>

            <div class="news-footer">
              <a href="${detailUrl}" class="news-read-more">
                Baca Selengkapnya
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function syncUrl() {
    const params = new URLSearchParams();

    if (state.category !== 'all') params.set('cat', state.category);
    if (state.query) params.set('q', state.query);

    const query = params.toString();
    history.replaceState(null, '', query ? `${location.pathname}?${query}` : location.pathname);
  }

  function setCategory(category) {
    state.category = category;

    categoryButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.cat === category);
    });

    syncUrl();
    render();
  }

  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      setCategory(button.dataset.cat);
    });
  });

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim();
    syncUrl();
    render();
  });

  resetButton.addEventListener('click', () => {
    state.category = 'all';
    state.query = '';
    searchInput.value = '';

    categoryButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.cat === 'all');
    });

    syncUrl();
    render();
    searchInput.focus();
  });

  async function loadContent() {
    try {
      const response = await fetch('/api/berita?limit=100', {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || !data.success || !Array.isArray(data.data)) {
        throw new Error(data?.error?.message || 'Gagal memuat konten.');
      }

      state.items = data.data;
      renderCounts();

      const params = new URLSearchParams(location.search);
      const initialCategory = params.get('cat');
      const initialQuery = params.get('q');

      if (initialQuery) {
        state.query = initialQuery;
        searchInput.value = initialQuery;
      }

      if (['Berita', 'Artikel'].includes(initialCategory)) {
        state.category = initialCategory;
      }

      categoryButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.cat === state.category);
      });

      render();
    } catch (error) {
      console.error('[Berita Page]', error);
      status.textContent = 'Konten gagal dimuat';
      grid.innerHTML = `
        <div class="news-loading-card">
          Berita dan artikel belum dapat dimuat. Silakan coba kembali.
        </div>
      `;
    }
  }

  loadContent();
})();
