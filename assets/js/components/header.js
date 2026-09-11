/* ==========================================================================
   HEADER & NAVIGATION COMPONENT & INTERACTIVE LOGIC
   LSP IND Logistik Indonesia - Dynamic Component Renderer & Interactivity
   ========================================================================== */

(function () {
  function initHeader() {
    const siteHeader = document.getElementById('mainHeader');
    if (!siteHeader) return;

    // Detect if current page is in a subfolder (e.g. /pages/)
    const path = window.location.pathname;
    const isSubfolder = path.includes('/pages/');
    
    const rootPath = isSubfolder ? '../' : './';
    const pagesPath = isSubfolder ? '' : 'pages/';

    // Get current filename to set active menu item
    const currentPage = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    const isHome = currentPage === 'index.html' || currentPage === '';
    const isProfil = currentPage.includes('profil');
    const isLayanan = currentPage.includes('layanan');
    const isBerita = currentPage.includes('berita') || currentPage.includes('kategori') || currentPage.includes('search') || currentPage.includes('pengumuman');
    const isFaq = currentPage.includes('faq');
    const isKontak = currentPage.includes('kontak');

    // 1. Remove top bar element if present in static HTML
    const existingTopBar = siteHeader.querySelector('.top-bar');
    if (existingTopBar) {
      existingTopBar.remove();
    }

    // 2. Inject HTML markup if siteHeader is empty or needs component rendering
    if (siteHeader.children.length === 0 || siteHeader.innerHTML.trim() === '') {
      siteHeader.innerHTML = `
        <!-- Main Navbar -->
        <div class="container header-main">
          <a href="${rootPath}index.html" class="header-logo">
            <img src="${rootPath}assets/img/logo-ilcc.jpg" alt="ILCC Logo" class="logo-img">
          </a>

          <!-- Desktop Nav -->
          <nav aria-label="Main Navigation">
            <ul class="nav-menu">
              <li class="nav-item"><a href="${rootPath}index.html" class="nav-link ${isHome ? 'active' : ''}">Beranda</a></li>
              <li class="nav-item"><a href="${pagesPath}profil.html" class="nav-link ${isProfil ? 'active' : ''}">Tentang Kami</a></li>
              <li class="nav-item"><a href="${pagesPath}layanan.html" class="nav-link ${isLayanan ? 'active' : ''}">Skema Sertifikasi</a></li>
              <li class="nav-item">
                <a href="${pagesPath}berita.html" class="nav-link ${isBerita ? 'active' : ''}">
                  Informasi Terbaru
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </a>
                <ul class="dropdown-menu">
                  <li class="dropdown-item"><a href="${pagesPath}berita.html">📰 Berita &amp; Artikel</a></li>
                  <li class="dropdown-item"><a href="${pagesPath}galeri.html">🖼️ Galeri Media</a></li>
                </ul>
              </li>
              <li class="nav-item"><a href="${pagesPath}faq.html" class="nav-link ${isFaq ? 'active' : ''}">FAQ</a></li>
              <li class="nav-item"><a href="${pagesPath}kontak.html" class="nav-link ${isKontak ? 'active' : ''}">Kontak</a></li>
            </ul>
          </nav>

          <!-- Action Buttons -->
          <div class="header-actions">
            <button class="action-btn search-trigger-btn" title="Cari (Tekan /)" aria-label="Buka Pencarian">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </button>

            <button class="action-btn" id="themeToggleBtn" title="Ganti Mode Gelap/Terang" aria-label="Toggle Theme">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            </button>

            <a href="https://wa.me/6281288771150" target="_blank" class="btn btn-primary btn-sm" style="margin-left: 0.5rem; background: var(--color-secondary); border-color: var(--color-secondary);">Konsultasi</a>

            <div class="hamburger-btn" aria-label="Toggle Mobile Menu">
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
            </div>
          </div>
        </div>
      `;
    }

    // 2. Ensure Offcanvas Mobile Drawer Exists
    let drawerOverlay = document.querySelector('.mobile-nav-overlay');
    if (!drawerOverlay) {
      drawerOverlay = document.createElement('div');
      drawerOverlay.className = 'mobile-nav-overlay';
      document.body.appendChild(drawerOverlay);
    }

    drawerOverlay.innerHTML = `
      <div class="mobile-nav-drawer">
        <div class="mobile-nav-header">
          <a href="${rootPath}index.html" class="header-logo">
            <img src="${rootPath}assets/img/logo-ilcc.jpg" alt="ILCC Logo" class="logo-img" style="height: 48px;">
          </a>
          <button class="modal-close mobile-nav-close">&times;</button>
        </div>
        <ul class="mobile-nav-menu">
          <li class="mobile-nav-item"><a href="${rootPath}index.html">Beranda</a></li>
          <li class="mobile-nav-item"><a href="${pagesPath}profil.html">Profil LSP Logistik</a></li>
          <li class="mobile-nav-item"><a href="${pagesPath}layanan.html">Skema Sertifikasi</a></li>
          <li class="mobile-nav-item"><a href="${pagesPath}berita.html">Informasi Terbaru</a></li>
          <li class="mobile-nav-item"><a href="${pagesPath}galeri.html">Galeri Media</a></li>
          <li class="mobile-nav-item"><a href="${pagesPath}faq.html">FAQ</a></li>
          <li class="mobile-nav-item"><a href="${pagesPath}kontak.html">Kontak Kami</a></li>
        </ul>
      </div>
    `;

    // 3. Attach Sticky Glassmorphism Header Scroll Listener
    function handleHeaderScroll() {
      if (window.scrollY > 20) {
        siteHeader.classList.add('scrolled');
      } else {
        siteHeader.classList.remove('scrolled');
      }
    }
    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    handleHeaderScroll();

    // 4. Attach Theme Toggle System
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      const savedTheme = localStorage.getItem('lsp_theme') || 'light';
      
      document.documentElement.setAttribute('data-theme', savedTheme);
      updateThemeIcon(themeToggleBtn, savedTheme);

      themeToggleBtn.addEventListener('click', function () {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('lsp_theme', newTheme);
        updateThemeIcon(themeToggleBtn, newTheme);

        if (window.showToast) {
          window.showToast(`Mode ${newTheme === 'dark' ? 'Gelap' : 'Terang'} Diaktifkan`, 'info');
        }
      });
    }

    // 5. Attach Mobile Drawer Events
    const hamburgerBtn = siteHeader.querySelector('.hamburger-btn');
    const closeBtn = drawerOverlay.querySelector('.mobile-nav-close');

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', function () {
        drawerOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        drawerOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    drawerOverlay.addEventListener('click', function (e) {
      if (e.target === drawerOverlay) {
        drawerOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    drawerOverlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        drawerOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  function updateThemeIcon(btn, theme) {
    if (!btn) return;
    if (theme === 'dark') {
      btn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
      btn.setAttribute('title', 'Ganti Mode Terang');
    } else {
      btn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
      btn.setAttribute('title', 'Ganti Mode Gelap');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }
})();

