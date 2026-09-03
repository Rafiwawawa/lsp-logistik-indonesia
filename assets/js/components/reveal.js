/* ==========================================================================
   SCROLL REVEAL ANIMATIONS, RIPPLE EFFECT & BACK TO TOP BUTTON
   ========================================================================== */

function initRevealEffects() {
  // 1. Ripple Effect on Buttons
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function (e) {
      const x = e.clientX - e.target.getBoundingClientRect().left;
      const y = e.clientY - e.target.getBoundingClientRect().top;

      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      this.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });
  });

  // 2. Back to Top Button
  const backToTopBtn = document.querySelector('#backToTopBtn');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTopBtn.classList.add('active');
      } else {
        backToTopBtn.classList.remove('active');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 3. Scroll Reveal Observer
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (revealElements.length) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealElements.forEach(el => revealObserver.observe(el));
  }
}

document.addEventListener('DOMContentLoaded', initRevealEffects);
