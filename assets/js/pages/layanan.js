document.addEventListener('DOMContentLoaded', () => {
  // 1. Category Filter Pills
  const filterPills = document.querySelectorAll('#schemeFilterPills .gallery-filter-btn');
  const schemeCards = document.querySelectorAll('#schemeGrid .service-card');

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.getAttribute('data-filter');

      schemeCards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // 2. Scheme Detail Modal
  const detailModal = document.getElementById('schemeDetailModal');
  const detailTitle = document.getElementById('modalSchemeTitle');
  const detailSkkni = document.getElementById('modalSchemeSkkni');
  const detailUnitsList = document.getElementById('modalSchemeUnitsList');
  const detailPrereq = document.getElementById('modalSchemePrereq');
  const detailRegisterBtn = document.getElementById('modalSchemeRegisterBtn');

  let currentSelectedScheme = '';

  document.querySelectorAll('.open-scheme-detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const title = btn.getAttribute('data-title');
      const skkni = btn.getAttribute('data-skkni');
      const units = btn.getAttribute('data-units').split('|');
      const prereq = btn.getAttribute('data-prereq');

      currentSelectedScheme = title;
      detailTitle.textContent = 'Skema Sertifikasi: ' + title;
      detailSkkni.textContent = skkni;
      detailPrereq.textContent = prereq;
      detailUnitsList.innerHTML = units.map(u => `<li>${u}</li>`).join('');

      detailModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });
});
