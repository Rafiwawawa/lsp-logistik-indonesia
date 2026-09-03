/* ==========================================================================
   DYNAMIC HERO SLIDER COMPONENT
   Interactive Slider with Autoplay, Manual Controls, Dot Pagination & Touch Swipe
   ========================================================================== */

class HeroSlider {
  constructor(containerSelector = '.hero-slider-section') {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;

    this.track = this.container.querySelector('.hero-slider-track');
    this.slides = Array.from(this.container.querySelectorAll('.hero-slide'));
    this.prevBtn = this.container.querySelector('.hero-slider-prev');
    this.nextBtn = this.container.querySelector('.hero-slider-next');
    this.dotsContainer = this.container.querySelector('.hero-slider-dots');
    
    if (!this.track || this.slides.length === 0) return;

    this.currentIndex = 0;
    this.totalSlides = this.slides.length;
    this.autoplayInterval = null;
    this.autoplayDelay = 6000; // 6 seconds per slide
    this.isHovered = false;

    // Touch swipe variables
    this.touchStartX = 0;
    this.touchEndX = 0;

    this.init();
  }

  init() {
    this.createDots();
    this.updateSlide(0);
    this.bindEvents();
    this.startAutoplay();
  }

  createDots() {
    if (!this.dotsContainer) return;
    this.dotsContainer.innerHTML = '';
    this.dots = [];

    this.slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = `hero-dot ${index === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Go to hero slide ${index + 1}`);
      dot.addEventListener('click', () => {
        this.goToSlide(index);
        this.resetAutoplay();
      });
      this.dotsContainer.appendChild(dot);
      this.dots.push(dot);
    });
  }

  updateSlide(index) {
    if (index < 0) index = this.totalSlides - 1;
    if (index >= this.totalSlides) index = 0;

    this.currentIndex = index;

    // Slide track transform
    this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;

    // Update active class on slides
    this.slides.forEach((slide, idx) => {
      if (idx === this.currentIndex) {
        slide.classList.add('active');
        slide.setAttribute('aria-hidden', 'false');
      } else {
        slide.classList.remove('active');
        slide.setAttribute('aria-hidden', 'true');
      }
    });

    // Update dot indicators
    if (this.dots && this.dots.length > 0) {
      this.dots.forEach((dot, idx) => {
        if (idx === this.currentIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }
  }

  nextSlide() {
    this.updateSlide(this.currentIndex + 1);
  }

  prevSlide() {
    this.updateSlide(this.currentIndex - 1);
  }

  goToSlide(index) {
    this.updateSlide(index);
  }

  startAutoplay() {
    this.stopAutoplay();
    this.autoplayInterval = setInterval(() => {
      if (!this.isHovered) {
        this.nextSlide();
      }
    }, this.autoplayDelay);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }

  resetAutoplay() {
    this.stopAutoplay();
    this.startAutoplay();
  }

  bindEvents() {
    // Button controls
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        this.prevSlide();
        this.resetAutoplay();
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        this.nextSlide();
        this.resetAutoplay();
      });
    }

    // Pause on hover
    this.container.addEventListener('mouseenter', () => {
      this.isHovered = true;
    });

    this.container.addEventListener('mouseleave', () => {
      this.isHovered = false;
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const rect = this.container.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) {
        if (e.key === 'ArrowLeft') {
          this.prevSlide();
          this.resetAutoplay();
        } else if (e.key === 'ArrowRight') {
          this.nextSlide();
          this.resetAutoplay();
        }
      }
    });

    // Touch Swipe gestures for mobile
    this.container.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    }, { passive: true });
  }

  handleSwipe() {
    const swipeThreshold = 40;
    if (this.touchStartX - this.touchEndX > swipeThreshold) {
      this.nextSlide();
      this.resetAutoplay();
    } else if (this.touchEndX - this.touchStartX > swipeThreshold) {
      this.prevSlide();
      this.resetAutoplay();
    }
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.heroSlider = new HeroSlider('.hero-slider-section');
});
