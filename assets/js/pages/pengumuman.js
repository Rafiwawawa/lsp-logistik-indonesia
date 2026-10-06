document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('announcementModal');
  const modalTitle = document.getElementById('announcementModalTitle');
  const modalNo = document.getElementById('announcementModalNo');
  const modalDate = document.getElementById('announcementModalDate');
  const modalContent = document.getElementById('announcementModalContent');
  const modalToastBtn = document.getElementById('announcementModalToastBtn');

  document.querySelectorAll('.open-announcement-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modalTitle.textContent = btn.getAttribute('data-title');
      modalNo.textContent = 'Nomor: ' + btn.getAttribute('data-no');
      modalDate.textContent = 'Diterbitkan: ' + btn.getAttribute('data-date');
      modalContent.textContent = btn.getAttribute('data-content');

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  if (modalToastBtn) {
    modalToastBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      if (window.showToast) {
        window.showToast('Pengumuman telah dibaca dan dikonfirmasi.', 'info');
      }
    });
  }
});
