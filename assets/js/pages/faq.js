document.addEventListener('DOMContentLoaded', () => {
  const filterPills = document.querySelectorAll('#faqFilterPills .faq-pill-btn');
  const faqItems = document.querySelectorAll('#faqAccordionGroup .accordion-item');
  const searchInput = document.getElementById('faqSearchInput');
  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');
  const visibleCountEl = document.getElementById('faqVisibleCount');
  const totalCountEl = document.getElementById('faqTotalCount');
  const activeCatLabelEl = document.getElementById('faqActiveCategoryLabel');
  const noResultsEl = document.getElementById('faqNoResults');
  const btnResetSearch = document.getElementById('btnResetSearch');

  const categoryNames = {
    'all': 'Semua Kategori',
    'umum': 'Informasi Umum',
    'pendaftaran': 'Pendaftaran & APL-02',
    'bukti': 'Bukti Kompetensi (VATM)',
    'pelaksanaan': 'Pelaksanaan Uji di TUK',
    'prinsip': 'Prinsip Asesmen & Keputusan'
  };

  // Counts follow the questions actually present on the page.
  filterPills.forEach(pill => {
    const category = pill.dataset.filter;
    const count = [...faqItems].filter(item =>
      category === 'all' || item.dataset.category === category
    ).length;
    const badge = pill.querySelector('.faq-pill-count');
    if (badge) badge.textContent = count;
  });

  function filterFaq() {
    const activePill = document.querySelector('#faqFilterPills .faq-pill-btn.active');
    const category = activePill ? activePill.getAttribute('data-filter') : 'all';
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let visibleCount = 0;
    let categoryCount = 0;

    faqItems.forEach(item => {
      const cat = item.getAttribute('data-category');
      const question = (item.getAttribute('data-question') || '').toLowerCase();
      const bodyText = item.querySelector('.accordion-body')?.textContent.toLowerCase() || '';

      const matchesCategory = (category === 'all' || cat === category);
      const matchesQuery = (!q || question.includes(q) || bodyText.includes(q));

      if (matchesCategory) categoryCount++;

      if (matchesCategory && matchesQuery) {
        item.style.display = 'block';
        visibleCount++;
      } else {
        item.style.display = 'none';
        item.classList.remove('active');
      }
    });

    // Update Counter and Status
    if (visibleCountEl) visibleCountEl.textContent = visibleCount;
    if (totalCountEl) totalCountEl.textContent = categoryCount;
    if (activeCatLabelEl) activeCatLabelEl.textContent = categoryNames[category] || 'Semua Kategori';

    // Show/Hide No Results Box
    if (noResultsEl) {
      noResultsEl.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  // Filter Pill Clicks
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterFaq();
    });
  });

  // Search Input
  if (searchInput) {
    searchInput.addEventListener('input', filterFaq);
  }

  // Reset Search
  if (btnResetSearch) {
    btnResetSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      const allPill = document.querySelector('#faqFilterPills [data-filter="all"]');
      if (allPill) {
        filterPills.forEach(p => p.classList.remove('active'));
        allPill.classList.add('active');
      }
      filterFaq();
    });
  }

  // Expand All
  if (btnExpandAll) {
    btnExpandAll.addEventListener('click', () => {
      faqItems.forEach(item => {
        if (item.style.display !== 'none') item.classList.add('active');
      });
    });
  }

  // Collapse All
  if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
      faqItems.forEach(item => item.classList.remove('active'));
    });
  }

  // Initial filter run
  filterFaq();
});
