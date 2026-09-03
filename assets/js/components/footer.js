/* ==========================================================================
   FOOTER COMPONENT INJECTOR
   LSP IND Logistik Indonesia - Centralized Footer Component
   ========================================================================== */

(function () {
  function renderFooter() {
    const footerContainer = document.querySelector('.site-footer');
    if (!footerContainer) return;

    // Detect if current page is in a subfolder (e.g. /pages/)
    const isSubfolder = window.location.pathname.includes('/pages/');
    const rootPath = isSubfolder ? '../' : './';
    const pagesPath = isSubfolder ? '' : 'pages/';

    footerContainer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-about">
            <div class="header-logo">
              <img src="${rootPath}assets/img/logo-ilcc.jpg" alt="ILCC Logo" class="logo-img" style="height: 60px;">
            </div>
            <p style="margin-top: 1rem;">
              LSP Logistik Indonesia (P3) didirikan oleh <strong>Asosiasi Logistik Indonesia (ALI)</strong>. Terlisensi resmi BNSP No. <strong>BNSP-LSP-093-ID</strong> tanggal 28 Desember 2012, SK Perpanjangan No. <strong>KEP.1757/BNSP/IX/2022</strong>.
            </p>
          </div>

          <div>
            <h4 class="footer-col-title">Navigasi Utama</h4>
            <ul class="footer-links">
              <li><a href="${rootPath}index.html">&rarr; Beranda</a></li>
              <li><a href="${pagesPath}profil.html">&rarr; Profil LSP Logistik</a></li>
              <li><a href="${pagesPath}layanan.html">&rarr; Skema Sertifikasi</a></li>
              <li><a href="${pagesPath}berita.html">&rarr; Informasi Terbaru</a></li>
              <li><a href="${pagesPath}faq.html">&rarr; FAQ</a></li>
              <li><a href="${pagesPath}kontak.html">&rarr; Kontak Sekretariat</a></li>
            </ul>
          </div>

          <div>
            <h4 class="footer-col-title">Skema Sertifikasi</h4>
            <ul class="footer-links">
              <li><a href="${pagesPath}layanan.html">&rarr; Supervisor Gudang dan Distribusi</a></li>
            </ul>
          </div>

          <div>
            <h4 class="footer-col-title">Sekretariat LSP Logistik</h4>
            <div class="footer-contact-info">
              <div class="footer-contact-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                <span>Sekretariat Asosiasi Logistik Indonesia, Gedung 1 Lt. 7 Kementerian Perdagangan RI, Jl. M.I. Ridwan Rais No. 5 Jakarta Pusat</span>
              </div>
              <div class="footer-contact-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <span>lsp.logistikindonesia@gmail.com</span>
              </div>
              <div class="footer-contact-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                <span>0812-8877-1150 (Layanan Asesi)</span>
              </div>
            </div>

            <!-- Footer Peta Google Maps -->
            <div style="margin-top: 0.85rem; border-radius: var(--radius-md); overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15);">
              <iframe src="https://maps.google.com/maps?q=Kementerian+Perdagangan+RI,+Jl.+M.I.+Ridwan+Rais+No.+5,+Jakarta+Pusat&t=&z=15&ie=UTF8&iwloc=B&output=embed" width="100%" height="140" style="border:0;" allowfullscreen="" loading="lazy" title="Peta Google Maps Sekretariat ALI Kemendag RI"></iframe>
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <div>&copy; 2026 LSP Logistik Indonesia. Seluruh Hak Cipta Dilindungi.</div>
        </div>
      </div>
    `;
  }

  // Execute footer rendering on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFooter);
  } else {
    renderFooter();
  }
})();
