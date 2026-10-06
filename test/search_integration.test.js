const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('global search uses published CMS news and links by slug', async () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../assets/js/components/search.js'),
    'utf8'
  );
  const requests = [];
  const context = {
    window: {},
    document: { addEventListener() {} },
    fetch: async url => {
      requests.push(url);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              judul: 'Berita terbaru dari CMS',
              slug: 'berita-terbaru-123',
              kategori: 'Berita',
              ringkasan: 'Kegiatan sertifikasi terbaru',
              status: 'terbit',
            },
            {
              judul: 'Draf rahasia',
              slug: 'draf-rahasia-123',
              kategori: 'Berita',
              status: 'draft',
            },
          ],
        }),
      };
    },
    console,
  };

  vm.runInNewContext(source, context);
  await context.window.loadLspSearchData();

  assert.deepEqual(requests, ['/api/berita?limit=100&offset=0']);
  const results = context.window.performLspSearch('berita terbaru');
  assert.equal(results.length, 1);
  assert.equal(results[0].url, '/pages/detail-berita.html?slug=berita-terbaru-123');
  assert.equal(context.window.performLspSearch('draf rahasia').length, 0);
  assert.equal(context.window.performLspSearch('Manfaat Sertifikasi Bagi Perusahaan').length, 0);
});
