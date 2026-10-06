(() => {
  const loading = document.getElementById('articleLoading');
  const content = document.getElementById('articleContent');
  const related = document.getElementById('relatedArticles');

  function formatDate(value) {
    if (!value) return 'Tanggal belum tersedia';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function renderBody(text) {
    const container = document.getElementById('articleBody');
    container.replaceChildren();

    const blocks = String(text || '')
      .split(/\n\s*\n/)
      .map(block => block.trim())
      .filter(Boolean);

    if (!blocks.length) {
      const paragraph = document.createElement('p');
      paragraph.textContent = 'Isi konten belum tersedia.';
      container.appendChild(paragraph);
      return;
    }

    blocks.forEach(block => {
      const paragraph = document.createElement('p');
      const lines = block.split('\n');

      lines.forEach((line, index) => {
        if (index > 0) paragraph.appendChild(document.createElement('br'));
        paragraph.appendChild(document.createTextNode(line));
      });

      container.appendChild(paragraph);
    });
  }

  function showError(message) {
    loading.textContent = message;
    loading.style.display = 'block';
    content.style.display = 'none';
  }

  async function loadRelated(current) {
    try {
      const response = await fetch('/api/berita?limit=6', {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data.data)) {
        throw new Error('Gagal memuat konten terkait.');
      }

      const items = data.data
        .filter(item => item.slug !== current.slug)
        .sort((a, b) => Number(b.kategori === current.kategori) - Number(a.kategori === current.kategori))
        .slice(0, 3);

      if (!items.length) {
        related.innerHTML = '<span style="font-size:.85rem; color:var(--color-text-muted);">Belum ada konten terkait.</span>';
        return;
      }

      related.replaceChildren();

      items.forEach(item => {
        const link = document.createElement('a');
        link.href = `/pages/detail-berita.html?slug=${encodeURIComponent(item.slug)}`;
        link.textContent = `${item.judul} →`;
        link.style.cssText =
          'text-decoration:none; color:var(--color-text-main); font-weight:600; font-size:.85rem;';
        related.appendChild(link);
      });
    } catch (error) {
      console.error('[Related Articles]', error);
      related.textContent = 'Konten terkait belum dapat dimuat.';
    }
  }

  async function loadArticle() {
    const slug = new URLSearchParams(window.location.search).get('slug');

    if (!slug) {
      showError('Konten tidak ditemukan. Silakan kembali ke halaman Berita & Artikel.');
      return;
    }

    try {
      const response = await fetch(`/api/berita/${encodeURIComponent(slug)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data?.error?.message || 'Konten tidak ditemukan.');
      }

      const article = data.data;

      document.title = `${article.judul} - LSP Logistik Indonesia`;
      document.getElementById('articleBreadcrumb').textContent = article.judul;
      document.getElementById('articleTitle').textContent = article.judul;
      document.getElementById('articleDate').textContent =
        `📅 ${formatDate(article.published_at || article.created_at)}`;
      document.getElementById('articleCategory').textContent =
        `🏷️ ${article.kategori}`;

      const image = document.getElementById('articleImage');
      if (article.thumbnail_url) {
        image.src = article.thumbnail_url;
        image.alt = article.judul;
        image.style.display = 'block';
      }

      renderBody(article.isi);

      loading.style.display = 'none';
      content.style.display = 'block';

      document.getElementById('btnShareCopy').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          window.showToast?.('Tautan berhasil disalin.', 'success');
        } catch {
          window.showToast?.('Tautan belum dapat disalin.', 'error');
        }
      });

      document.getElementById('btnShareWa').addEventListener('click', () => {
        const text = encodeURIComponent(
          `Baca ${article.kategori.toLowerCase()}: ${article.judul}\n${window.location.href}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
      });

      loadRelated(article);
    } catch (error) {
      console.error('[Article Detail]', error);
      showError(error.message || 'Konten tidak ditemukan.');
    }
  }

  loadArticle();
})();
