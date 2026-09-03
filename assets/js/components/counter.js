/* ==========================================================================
   ANIMATED STATISTICAL COUNTER HANDLER
   ========================================================================== */

function initCounters() {
  const counters = document.querySelectorAll('.stat-number[data-target]');
  if (!counters.length) return;

  const animateCounter = (counter) => {
    const target = +counter.getAttribute('data-target');
    const prefix = counter.getAttribute('data-prefix') || '';
    const suffix = counter.getAttribute('data-suffix') || '';
    const duration = 2000; // ms
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = target / steps;

    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        counter.innerText = prefix + target.toLocaleString('id-ID') + suffix;
        clearInterval(timer);
      } else {
        counter.innerText = prefix + Math.floor(current).toLocaleString('id-ID') + suffix;
      }
    }, stepTime);
  };

  // IntersectionObserver to trigger animation when section enters viewport
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(counter => observer.observe(counter));
}

document.addEventListener('DOMContentLoaded', initCounters);
