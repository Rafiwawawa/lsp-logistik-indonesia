document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('q') || '';
  const searchHeader = document.getElementById('searchPageHeader');
  const searchSubheader = document.getElementById('searchPageSubheader');
  const searchInput = document.getElementById('pageSearchInput');
  const searchBtn = document.getElementById('pageSearchBtn');
  const resultsList = document.getElementById('searchResultsList');
  const filterPills = document.querySelectorAll('#searchFilterPills .gallery-filter-btn');

  if (searchInput) searchInput.value = queryParam;

  let currentCategory = 'all';

  function sanitizeUrl(rawUrl) {
    const url = String(rawUrl ?? '').trim();
    if (!url) return '';
    if (/^(?:javascript|data|vbscript|file):/i.test(url)) {
      return '';
    }
    if (url.startsWith('//')) {
      return '';
    }
    try {
      const base = window.location ? window.location.href : 'http://localhost';
      const parsed = new URL(url, base);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return url;
      }
    } catch {
      return '';
    }
    return '';
  }

  function renderResults(q, category = 'all') {
    const query = q.trim();
    if (searchHeader) {
      searchHeader.textContent = query ? `Hasil Pencarian: "${query}"` : 'Semua Hasil Pencarian';
    }

    let allResults = query
      ? (typeof window.performLspSearch === 'function' ? window.performLspSearch(query) : [])
      : (window.LSP_SEARCH_DATA || []);

    if (category !== 'all') {
      allResults = allResults.filter(item => category === 'konten'
        ? item.category === 'Berita' || item.category === 'Artikel'
        : item.category === category);
    }

    if (searchSubheader) {
      searchSubheader.textContent = `Ditemukan ${allResults.length} item yang sesuai dengan kriteria.`;
    }

    if (!resultsList) return;

    if (typeof resultsList.replaceChildren === 'function') {
      resultsList.replaceChildren();
    } else {
      resultsList.textContent = '';
    }

    if (allResults.length === 0) {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'padding: 2.5rem; text-align: center;';

      const icon = document.createElement('div');
      icon.style.cssText = 'font-size: 3rem; margin-bottom: 1rem;';
      icon.textContent = '🔍';

      const title = document.createElement('h3');
      title.textContent = 'Hasil Tidak Ditemukan';

      const desc = document.createElement('p');
      desc.style.cssText = 'color: var(--color-text-muted); margin-bottom: 1.5rem;';
      desc.textContent = 'Coba gunakan kata kunci lain seperti "Collecting", "BNSP", "SKKNI", "APL-01", atau "Asperindo".';

      const backLink = document.createElement('a');
      backLink.href = '../index.html';
      backLink.className = 'btn btn-primary btn-sm';
      backLink.style.cssText = 'background: var(--color-secondary); border-color: var(--color-secondary);';
      backLink.textContent = 'Kembali ke Beranda';

      card.append(icon, title, desc, backLink);
      resultsList.appendChild(card);
      return;
    }

    allResults.forEach(item => {
      const article = document.createElement('article');
      article.className = 'card hover-lift';
      article.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';

      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

      const badge = document.createElement('span');
      badge.className = 'badge badge-info';
      badge.textContent = item.category || '';

      const badgeSource = document.createElement('span');
      badgeSource.style.cssText = 'font-size: 0.75rem; color: var(--color-text-light);';
      badgeSource.textContent = 'LSP Logistik Indonesia Official';

      metaRow.append(badge, badgeSource);

      const safeUrl = sanitizeUrl(item.url);
      const heading = document.createElement('h3');
      heading.style.cssText = 'margin: 0.25rem 0;';

      if (safeUrl) {
        const titleLink = document.createElement('a');
        titleLink.href = safeUrl;
        titleLink.textContent = item.title || '';
        heading.appendChild(titleLink);
      } else {
        const titleSpan = document.createElement('span');
        titleSpan.textContent = item.title || '';
        heading.appendChild(titleSpan);
      }

      const paragraph = document.createElement('p');
      paragraph.style.cssText = 'font-size: 0.9rem; color: var(--color-text-muted); margin: 0; line-height: 1.5;';
      paragraph.textContent = item.desc || '';

      const footer = document.createElement('div');
      footer.style.cssText = 'margin-top: 0.5rem;';

      if (safeUrl) {
        const detailLink = document.createElement('a');
        detailLink.href = safeUrl;
        detailLink.className = 'btn btn-secondary btn-sm';
        detailLink.style.cssText = 'font-size: 0.8rem;';
        detailLink.textContent = 'Lihat Detail →';
        footer.appendChild(detailLink);
      }

      article.append(metaRow, heading, paragraph, footer);
      resultsList.appendChild(article);
    });
  }

  // Load search data including published CMS articles before initial render
  if (typeof window.loadLspSearchData === 'function') {
    try {
      await window.loadLspSearchData();
    } catch (error) {
      console.error('[Search page data]', error);
    }
  }

  renderResults(queryParam, currentCategory);

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-filter') || 'all';
      renderResults(searchInput ? searchInput.value : queryParam, currentCategory);
    });
  });

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const val = searchInput.value;
      const newUrl = window.location.pathname + '?q=' + encodeURIComponent(val);
      window.history.pushState({ path: newUrl }, '', newUrl);
      renderResults(val, currentCategory);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchBtn.click();
      }
    });
  }
});
