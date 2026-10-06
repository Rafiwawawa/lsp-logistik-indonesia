document.addEventListener('DOMContentLoaded', () => {
  // 1. TUK Location Switcher
  const tukPills = document.querySelectorAll('#tukLocationPills .gallery-filter-btn');
  const tukTitle = document.getElementById('tukTitle');
  const tukAddress = document.getElementById('tukAddress');
  const tukPhone = document.getElementById('tukPhone');

  const TUK_DATA = {
    sembada: {
      title: 'Sembada Pratama - School of Supply Chain',
      address: 'Sekretariat LSP Logistik Indonesia (P3), Sembada Pratama Indonesia',
      phone: '0812-8877-1150 (Hotline Sekretariat)'
    },
    ali: {
      title: 'Sekretariat Asosiasi Logistik Indonesia (ALI)',
      address: 'Gedung Asosiasi Logistik Indonesia, Jakarta',
      phone: '+62 812-9876-5432 (Layanan Sertifikasi ALI)'
    },
    regional: {
      title: 'Jaringan Tempat Uji Kompetensi (TUK) Regional',
      address: 'TUK Terverifikasi di Jakarta, Bandung, Surabaya, Medan, dan Makassar',
      phone: '+62 856-1122-3344 (Layanan TUK Regional)'
    }
  };

  tukPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tukPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const key = pill.getAttribute('data-tuk');
      const data = TUK_DATA[key];

      if (data) {
        tukTitle.textContent = data.title;
        tukAddress.textContent = data.address;
        tukPhone.textContent = data.phone;
      }
    });
  });

  // 2. Compose an email in the visitor's mail application.
  const contactForm = document.getElementById('contactForm');
  const btnDirectWa = document.getElementById('btnDirectWa');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const phone = document.getElementById('contactPhone').value.trim();
      const subject = document.getElementById('contactSubject').value;
      const message = document.getElementById('contactMessage').value.trim();
      const body = `Nama: ${name}\nEmail: ${email}\nWhatsApp: ${phone}\n\n${message}`;
      const mailto = `mailto:lsp.logistikindonesia@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      if (window.showToast) {
        window.showToast('Draf email disiapkan. Tekan Kirim di aplikasi email Anda.', 'info');
      }
      window.location.href = mailto;
    });
  }

  // 3. Direct WA Launcher
  if (btnDirectWa) {
    btnDirectWa.addEventListener('click', () => {
      const name = document.getElementById('contactName').value || 'Calon Asesi';
      const subject = document.getElementById('contactSubject').value;
      const msg = document.getElementById('contactMessage').value || 'Saya ingin bertanya mengenai permohonan sertifikasi LSP Logistik Indonesia.';

      const waText = encodeURIComponent(`Halo Sekretariat LSP LOGISTIK INDONESIA,\nSaya ${name}.\nTopik: ${subject}\nPesan: ${msg}`);
      window.open(`https://wa.me/6281288771150?text=${waText}`, '_blank');
    });
  }
});
