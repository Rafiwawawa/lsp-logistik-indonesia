/* ==========================================================================
   ACCORDION JAVASCRIPT HANDLER
   ========================================================================== */

function initAccordions() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const group = item.parentElement;

      // Close other items in the same group if single-open behavior is preferred
      const activeItem = group.querySelector('.accordion-item.active');
      if (activeItem && activeItem !== item) {
        activeItem.classList.remove('active');
      }

      item.classList.toggle('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', initAccordions);
