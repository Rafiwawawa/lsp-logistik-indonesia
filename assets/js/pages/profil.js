document.addEventListener('DOMContentLoaded', function () {
  const filterBtns = document.querySelectorAll('#bodBocFilters [data-bod-filter]');
  const cards = document.querySelectorAll('#bodGrid .bod-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const filter = this.getAttribute('data-bod-filter');

      // Update active button styling
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'var(--color-surface)';
        b.style.color = 'var(--color-text-main)';
      });
      this.classList.add('active');
      this.style.background = 'var(--color-primary)';
      this.style.color = '#FFF';

      // Filter cards
      cards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.style.display = 'flex';
          card.style.animation = 'fadeInUp 0.35s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
});
