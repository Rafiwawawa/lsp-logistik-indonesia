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
    AbortController,
    setTimeout,
    clearTimeout,
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

function createMockElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    children: [],
    style: {},
    className: '',
    textContent: '',
    attributes: {},
    setAttribute(name, val) { this.attributes[name] = val; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...children) {
      for (const child of children) {
        this.children.push(child);
      }
    },
    replaceChildren(...children) {
      this.children = [...children];
      this.textContent = '';
    },
    addEventListener() {},
  };
}

test('dedicated search page loads CMS news before rendering search results', async () => {
  const searchSource = fs.readFileSync(
    path.join(__dirname, '../assets/js/components/search.js'),
    'utf8'
  );
  const searchPageSource = fs.readFileSync(
    path.join(__dirname, '../assets/js/pages/search-page.js'),
    'utf8'
  );

  const elements = {
    searchPageHeader: createMockElement('h1'),
    searchPageSubheader: createMockElement('p'),
    pageSearchInput: createMockElement('input'),
    pageSearchBtn: createMockElement('button'),
    searchResultsList: createMockElement('div'),
  };

  let domContentLoadedHandler = null;
  const requests = [];

  const context = {
    window: {
      location: {
        search: '?q=kegiatan+sertifikasi',
        pathname: '/pages/search.html',
        href: 'http://localhost/pages/search.html?q=kegiatan+sertifikasi',
      },
      history: { pushState() {} },
    },
    document: {
      addEventListener(event, handler) {
        if (event === 'DOMContentLoaded') {
          domContentLoadedHandler = handler;
        }
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelectorAll() {
        return [];
      },
      createElement(tag) {
        return createMockElement(tag);
      },
    },
    URLSearchParams,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async url => {
      requests.push(url);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              judul: 'Kegiatan Sertifikasi Logistik Nasional',
              slug: 'kegiatan-sertifikasi-nasional',
              kategori: 'Berita',
              ringkasan: 'Pelaksanaan asesmen di seluruh Tempat Uji Kompetensi',
              status: 'terbit',
            },
          ],
        }),
      };
    },
    console,
  };

  context.window.window = context.window;
  context.window.document = context.document;

  vm.runInNewContext(searchSource, context);
  vm.runInNewContext(searchPageSource, context);

  assert.ok(domContentLoadedHandler, 'DOMContentLoaded listener should be registered');
  await domContentLoadedHandler();

  assert.ok(requests.length > 0, 'loadLspSearchData should fetch /api/berita during search page init');
  assert.equal(elements.searchResultsList.children.length, 1);

  const article = elements.searchResultsList.children[0];
  const heading = article.children[1];
  const titleLink = heading.children[0];
  assert.equal(titleLink.textContent, 'Kegiatan Sertifikasi Logistik Nasional');
  assert.equal(titleLink.href, '/pages/detail-berita.html?slug=kegiatan-sertifikasi-nasional');
});

test('dedicated search page uses safe DOM rendering and rejects unsafe URL schemes', async () => {
  const searchPageSource = fs.readFileSync(
    path.join(__dirname, '../assets/js/pages/search-page.js'),
    'utf8'
  );

  const elements = {
    searchPageHeader: createMockElement('h1'),
    searchPageSubheader: createMockElement('p'),
    pageSearchInput: createMockElement('input'),
    pageSearchBtn: createMockElement('button'),
    searchResultsList: createMockElement('div'),
  };

  let domContentLoadedHandler = null;

  const maliciousPayload = {
    title: '<img src=x onerror=alert(1)> Injected Title',
    category: '<b>XSS</b>',
    desc: 'Unsafe <script>alert("xss")</script> body',
    url: 'javascript:alert(document.cookie)',
  };

  const context = {
    window: {
      location: {
        search: '?q=xss',
        pathname: '/pages/search.html',
        href: 'http://localhost/pages/search.html?q=xss',
      },
      history: { pushState() {} },
      performLspSearch: () => [maliciousPayload],
      loadLspSearchData: async () => {},
    },
    document: {
      addEventListener(event, handler) {
        if (event === 'DOMContentLoaded') {
          domContentLoadedHandler = handler;
        }
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelectorAll() {
        return [];
      },
      createElement(tag) {
        return createMockElement(tag);
      },
    },
    URLSearchParams,
    URL,
    console,
  };

  context.window.window = context.window;
  context.window.document = context.document;

  vm.runInNewContext(searchPageSource, context);
  assert.ok(domContentLoadedHandler);
  await domContentLoadedHandler();

  const resultsList = elements.searchResultsList;
  assert.equal(resultsList.children.length, 1);
  const article = resultsList.children[0];

  const metaRow = article.children[0];
  const badge = metaRow.children[0];
  assert.equal(badge.textContent, '<b>XSS</b>');

  const heading = article.children[1];
  const titleEl = heading.children[0];
  assert.equal(titleEl.tagName, 'SPAN');
  assert.equal(titleEl.textContent, '<img src=x onerror=alert(1)> Injected Title');
  assert.equal(titleEl.attributes.href, undefined, 'Unsafe javascript: scheme must not create clickable hyperlink');

  const desc = article.children[2];
  assert.equal(desc.textContent, 'Unsafe <script>alert("xss")</script> body');

  const footer = article.children[3];
  assert.equal(footer.children.length, 0, 'Unsafe destination must not create misleading detail button');
});

test('search page handles CMS data-loading failure gracefully with safe fallback', async () => {
  const searchPageSource = fs.readFileSync(
    path.join(__dirname, '../assets/js/pages/search-page.js'),
    'utf8'
  );

  const elements = {
    searchPageHeader: createMockElement('h1'),
    searchPageSubheader: createMockElement('p'),
    pageSearchInput: createMockElement('input'),
    pageSearchBtn: createMockElement('button'),
    searchResultsList: createMockElement('div'),
  };

  let domContentLoadedHandler = null;

  const context = {
    window: {
      location: {
        search: '?q=nonexistent',
        pathname: '/pages/search.html',
        href: 'http://localhost/pages/search.html?q=nonexistent',
      },
      history: { pushState() {} },
      performLspSearch: () => [],
      loadLspSearchData: async () => {
        throw new Error('Database/network unavailable');
      },
    },
    document: {
      addEventListener(event, handler) {
        if (event === 'DOMContentLoaded') {
          domContentLoadedHandler = handler;
        }
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelectorAll() {
        return [];
      },
      createElement(tag) {
        return createMockElement(tag);
      },
    },
    URLSearchParams,
    URL,
    console: { error() {}, log() {} },
  };

  context.window.window = context.window;
  context.window.document = context.document;

  vm.runInNewContext(searchPageSource, context);
  assert.ok(domContentLoadedHandler);

  await assert.doesNotReject(async () => {
    await domContentLoadedHandler();
  });

  const resultsList = elements.searchResultsList;
  assert.equal(resultsList.children.length, 1);
  const card = resultsList.children[0];
  assert.equal(card.className, 'card');

  const cardTitle = card.children[1];
  assert.equal(cardTitle.textContent, 'Hasil Tidak Ditemukan');
  const backLink = card.children[3];
  assert.equal(backLink.textContent, 'Kembali ke Beranda');
  assert.equal(backLink.href, '../index.html');
});
