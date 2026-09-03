/* ==========================================================================
   GENERIC MODAL CONTROLLER HANDLER
   ========================================================================== */

function initModals() {
  const modalTriggers = document.querySelectorAll('[data-modal]');

  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = trigger.getAttribute('data-modal');
      const targetModal = document.querySelector(targetId);

      if (targetModal) {
        targetModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  const closeButtons = document.querySelectorAll('.modal-close, [data-close-modal]');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const activeModal = btn.closest('.modal-backdrop');
      if (activeModal) {
        activeModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initModals);
