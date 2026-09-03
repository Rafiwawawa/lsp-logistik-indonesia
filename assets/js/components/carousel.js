/* ==========================================================================
   PARTNER CAROUSEL AUTO-LOOPING HANDLER
   ========================================================================== */

function initCarousel() {
  const container = document.querySelector('.carousel-container');
  if (!container) return;

  const track = container.querySelector('.carousel-track');
  if (!track) return;

  // Duplicate partner items to guarantee infinite seamless marquee loop
  const items = Array.from(track.children);
  items.forEach(item => {
    const clone = item.cloneNode(true);
    track.appendChild(clone);
  });
}

document.addEventListener('DOMContentLoaded', initCarousel);
