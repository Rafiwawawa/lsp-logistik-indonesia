/* ==========================================================================
   Header & Navigation
   LSP Logistik Indonesia
   ========================================================================== */

(function () {
  const routes = {
    home: '/',
    profil: '/pages/profil.html',
    layanan: '/pages/layanan.html',
    berita: '/pages/berita.html',
    galeri: '/pages/galeri.html',
    faq: '/pages/faq.html',
    kontak: '/pages/kontak.html',
  };

  function initHeader() {
    const siteHeader = document.getElementById('mainHeader');
    if (!siteHeader) return;

    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || '';

    const isHome = path === '/' || currentPage === 'index.html';
    const isProfil = currentPage.includes('profil');
    const isLayanan = currentPage.includes('layanan');
    const isBerita =
      currentPage.includes('berita') ||
      currentPage.includes('kategori') ||
      currentPage.includes('search') ||
      currentPage.includes('pengumuman');
    const isFaq = currentPage.includes('faq');
    const isKontak = currentPage.includes('kontak');

    // Normalize old links like index.html / ../index.html to /
    document.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href');

      if (href && /^(?:\.\/|\.\.\/)?index\.html$/.test(href)) {
        link.setAttribute('href', routes.home);
      }
    });

    // Remove legacy top bar
    siteHeader.querySelector('.top-bar')?.remove();

    // Render header when the page only provides an empty component container
    if (!siteHeader.innerHTML.trim()) {
      siteHeader.innerHTML = `
        <div class="container header-main">
          <a href="${routes.home}" class="header-logo">
            <img src="/assets/img/logo-ilcc.jpg" alt="ILCC Logo" class="logo-img">
          </a>

          <nav aria-label="Main Navigation">
            <ul class="nav-menu">
              <li class="nav-item">
                <a href="${routes.home}" class="nav-link ${isHome ? 'active' : ''}">Beranda</a>
              </li>

              <li class="nav-item">
                <a href="${routes.profil}" class="nav-link ${isProfil ? 'active' : ''}">Tentang Kami</a>
              </li>

              <li class="nav-item">
                <a href="${routes.layanan}" class="nav-link ${isLayanan ? 'active' : ''}">Skema Sertifikasi</a>
              </li>

              <li class="nav-item">
                <a href="${routes.berita}" class="nav-link ${isBerita ? 'active' : ''}">
                  Informasi Terbaru
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 9l-7 7-7-7"></path>
                  </svg>
                </a>

                <ul class="dropdown-menu">
                  <li class="dropdown-item">
                    <a href="${routes.berita}">📰 Berita &amp; Artikel</a>
                  </li>
                  <li class="dropdown-item">
                    <a href="${routes.galeri}">🖼️ Galeri Media</a>
                  </li>
                </ul>
              </li>

              <li class="nav-item">
                <a href="${routes.faq}" class="nav-link ${isFaq ? 'active' : ''}">FAQ</a>
              </li>

              <li class="nav-item">
                <a href="${routes.kontak}" class="nav-link ${isKontak ? 'active' : ''}">Kontak</a>
              </li>
            </ul>
          </nav>

          <div class="header-actions">
            <button class="action-btn search-trigger-btn" title="Cari (Tekan /)" aria-label="Buka Pencarian">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>

            <button class="action-btn" id="themeToggleBtn" title="Ganti Mode Gelap/Terang" aria-label="Toggle Theme">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
              </svg>
            </button>

            <a href="https://wa.me/6281288771150" target="_blank" rel="noopener noreferrer"
              class="btn btn-primary btn-sm"
              style="margin-left: 0.5rem; background: var(--color-secondary); border-color: var(--color-secondary);">
              Konsultasi
            </a>

            <div class="hamburger-btn" aria-label="Toggle Mobile Menu">
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
            </div>
          </div>
        </div>
      `;
    }

    initMobileNavigation(siteHeader);
    initStickyHeader(siteHeader);
    initThemeToggle();
  }

  function initMobileNavigation(siteHeader) {
    let overlay = document.querySelector('.mobile-nav-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'mobile-nav-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="mobile-nav-drawer">
        <div class="mobile-nav-header">
          <a href="${routes.home}" class="header-logo">
            <img src="/assets/img/logo-ilcc.jpg" alt="ILCC Logo" class="logo-img" style="height: 48px;">
          </a>
          <button class="modal-close mobile-nav-close" aria-label="Tutup menu">&times;</button>
        </div>

        <ul class="mobile-nav-menu">
          <li class="mobile-nav-item"><a href="${routes.home}">Beranda</a></li>
          <li class="mobile-nav-item"><a href="${routes.profil}">Profil LSP Logistik</a></li>
          <li class="mobile-nav-item"><a href="${routes.layanan}">Skema Sertifikasi</a></li>
          <li class="mobile-nav-item"><a href="${routes.berita}">Informasi Terbaru</a></li>
          <li class="mobile-nav-item"><a href="${routes.galeri}">Galeri Media</a></li>
          <li class="mobile-nav-item"><a href="${routes.faq}">FAQ</a></li>
          <li class="mobile-nav-item"><a href="${routes.kontak}">Kontak Kami</a></li>
        </ul>
      </div>
    `;

    const hamburger = siteHeader.querySelector('.hamburger-btn');
    const closeButton = overlay.querySelector('.mobile-nav-close');

    hamburger?.addEventListener('click', () => {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    closeButton?.addEventListener('click', closeMobileNavigation);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeMobileNavigation();
      }
    });

    overlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMobileNavigation);
    });

    function closeMobileNavigation() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function initStickyHeader(siteHeader) {
    function updateHeader() {
      siteHeader.classList.toggle('scrolled', window.scrollY > 20);
    }

    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }

  function initThemeToggle() {
    const button = document.getElementById('themeToggleBtn');
    if (!button) return;

    const savedTheme = localStorage.getItem('lsp_theme') || 'light';

    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(button, savedTheme);

    button.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('lsp_theme', next);

      updateThemeIcon(button, next);

      if (window.showToast) {
        window.showToast(
          `Mode ${next === 'dark' ? 'Gelap' : 'Terang'} Diaktifkan`,
          'info'
        );
      }
    });
  }

  function updateThemeIcon(button, theme) {
    if (theme === 'dark') {
      button.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
      `;

      button.setAttribute('title', 'Ganti Mode Terang');
      return;
    }

    button.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
      </svg>
    `;

    button.setAttribute('title', 'Ganti Mode Gelap');
  }

  // Hidden admin access: Ctrl + Shift + ]
  document.addEventListener('keydown', event => {
    const adminShortcut =
      event.ctrlKey &&
      event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      event.code === 'BracketRight';

    if (!adminShortcut || event.repeat) return;

    event.preventDefault();
    window.location.assign('/admin/index.html');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }
})();