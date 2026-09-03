/* ==========================================================================
   MAIN SCRIPT INITIALIZER
   LSP Professional Organization Web Application
   ========================================================================== */

console.log('LSP Professional Organization Web Application Initialized.');

document.addEventListener('DOMContentLoaded', () => {
  // Global form submission interceptor for interactive feedback
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (window.showToast) {
        window.showToast('Terima kasih! Pesan/Permohonan Anda berhasil terkirim.', 'success');
      }
      form.reset();
    });
  });
});
