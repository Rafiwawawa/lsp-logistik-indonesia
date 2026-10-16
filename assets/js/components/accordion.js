/* ==========================================================================
   ACCORDION JAVASCRIPT HANDLER
   ========================================================================== */

function initAccordions() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const group = item.parentElement;

      // Search and "Buka Semua" can leave several answers open.
      // A manual click restores the one-answer-at-a-time behavior.
      group.querySelectorAll('.accordion-item.active').forEach(activeItem => {
        if (activeItem !== item) activeItem.classList.remove('active');
      });

      item.classList.toggle('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', initAccordions);
