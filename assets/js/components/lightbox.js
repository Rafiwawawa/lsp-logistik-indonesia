/* ==========================================================================
   LIGHTBOX MODAL PREVIEW HANDLER WITH COUNTER & FILTER SUPPORT
   ========================================================================== */

function initLightbox() {
  const lightboxModal = document.querySelector('#lightboxModal');
  if (!lightboxModal) return;

  const lightboxImg = lightboxModal.querySelector('.lightbox-img');
  const lightboxCaption = lightboxModal.querySelector('.lightbox-caption');
  const closeBtn = lightboxModal.querySelector('.lightbox-close');
  const prevBtn = lightboxModal.querySelector('.lightbox-prev');
  const nextBtn = lightboxModal.querySelector('.lightbox-next');

  let activeItems = [];
  let currentIndex = 0;

  const getVisibleItems = () => {
    const allItems = Array.from(document.querySelectorAll('.gallery-item, [data-lightbox]'));
    return allItems.filter(item => {
      const style = window.getComputedStyle(item);
      return style.display !== 'none' && style.opacity !== '0';
    });
  };

  const openLightbox = (index) => {
    activeItems = getVisibleItems();
    if (!activeItems.length) return;

    if (index < 0) index = activeItems.length - 1;
    if (index >= activeItems.length) index = 0;
    currentIndex = index;

    const item = activeItems[currentIndex];
    const imgSrc = item.getAttribute('data-src') || item.querySelector('img')?.src;
    const title = item.getAttribute('data-caption') || item.querySelector('.gallery-item-title')?.textContent || 'Dokumentasi LSP IND';

    if (lightboxImg) lightboxImg.src = imgSrc;
    if (lightboxCaption) {
      lightboxCaption.innerHTML = `<span style="opacity:0.8; font-size:0.85rem; margin-right:0.5rem;">[${currentIndex + 1} / ${activeItems.length}]</span> <strong>${title}</strong>`;
    }
    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightboxModal.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.bindLightboxItems = () => {
    const allItems = document.querySelectorAll('.gallery-item, [data-lightbox]');
    allItems.forEach((item) => {
      item.onclick = (e) => {
        e.preventDefault();
        activeItems = getVisibleItems();
        const visibleIndex = activeItems.indexOf(item);
        if (visibleIndex !== -1) {
          openLightbox(visibleIndex);
        } else {
          openLightbox(0);
        }
      };
    });
  };

  if (closeBtn) closeBtn.onclick = closeLightbox;

  if (prevBtn) {
    prevBtn.onclick = () => openLightbox(currentIndex - 1);
  }

  if (nextBtn) {
    nextBtn.onclick = () => openLightbox(currentIndex + 1);
  }

  lightboxModal.onclick = (e) => {
    if (e.target === lightboxModal) closeLightbox();
  };

  document.addEventListener('keydown', (e) => {
    if (!lightboxModal.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevBtn?.click();
    if (e.key === 'ArrowRight') nextBtn?.click();
  });

  window.bindLightboxItems();
}

document.addEventListener('DOMContentLoaded', initLightbox);

