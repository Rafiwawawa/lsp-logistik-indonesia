document.addEventListener('DOMContentLoaded', () => {
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

  function renderResults(q, category = 'all') {
    const query = q.trim();
    searchHeader.textContent = query ? `Hasil Pencarian: "${query}"` : 'Semua Hasil Pencarian';
    let allResults = query ? window.performLspSearch(query) : window.LSP_SEARCH_DATA;
    if (category !== 'all') {
      allResults = allResults.filter(item => item.category === category);
    }

    searchSubheader.textContent = `Ditemukan ${allResults.length} item yang sesuai dengan kriteria.`;

    if (allResults.length === 0) {
      resultsList.innerHTML = `
        <div class="card" style="padding: 2.5rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
          <h3>Hasil Tidak Ditemukan</h3>
          <p style="color: var(--color-text-muted); margin-bottom: 1.5rem;">Coba gunakan kata kunci lain seperti "Collecting", "BNSP", "SKKNI", "APL-01", atau "Asperindo".</p>
          <a href="../index.html" class="btn btn-primary btn-sm" style="background: var(--color-secondary); border-color: var(--color-secondary);">Kembali ke Beranda</a>
        </div>
      `;
      return;
    }

    resultsList.innerHTML = allResults.map(item => `
      <article class="card hover-lift" style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="badge badge-info">${item.category}</span>
          <span style="font-size: 0.75rem; color: var(--color-text-light);">LSP Logistik Indonesia Official</span>
        </div>
        <h3 style="margin: 0.25rem 0;"><a href="${item.url}">${item.title}</a></h3>
        <p style="font-size: 0.9rem; color: var(--color-text-muted); margin: 0; line-height: 1.5;">${item.desc}</p>
        <div style="margin-top: 0.5rem;">
          <a href="${item.url}" class="btn btn-secondary btn-sm" style="font-size: 0.8rem;">Lihat Detail &rarr;</a>
        </div>
      </article>
    `).join('');
  }

  renderResults(queryParam, currentCategory);

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-filter');
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
