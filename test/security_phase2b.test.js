const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { createTestEnvironment } = require('./helpers/setup');

function parseCspDirectives(cspHeader) {
  const directives = {};
  if (!cspHeader) return directives;

  cspHeader.split(';').forEach(directive => {
    const trimmed = directive.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    const name = parts[0];
    const values = parts.slice(1);
    directives[name] = values;
  });

  return directives;
}

function findHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        results = results.concat(findHtmlFiles(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Security Phase 2B: Strict CSP & Inline Script Extraction', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('CSP header enforces strict script-src and script-src-attr', async () => {
    const res = await request(env.app).get('/').expect(200);
    const cspHeader = res.headers['content-security-policy'];
    assert.ok(cspHeader, 'Content-Security-Policy header should be present');

    const directives = parseCspDirectives(cspHeader);

    // script-src checks
    const scriptSrc = directives['script-src'] || [];
    assert.ok(scriptSrc.includes("'self'"), "script-src must include 'self'");
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), "script-src must not include 'unsafe-inline'");
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), "script-src must not include 'unsafe-eval'");

    // script-src-attr check
    const scriptSrcAttr = directives['script-src-attr'] || [];
    assert.ok(scriptSrcAttr.includes("'none'"), "script-src-attr must include 'none'");

    // style-src checks
    const styleSrc = directives['style-src'] || [];
    assert.ok(styleSrc.includes("'unsafe-inline'"), "style-src must continue to allow 'unsafe-inline'");
  });

  test('HTML files contain no executable inline scripts, inline event handlers, or javascript: URLs', () => {
    const rootDir = path.resolve(__dirname, '..');
    const targetHtmlFiles = [
      path.join(rootDir, 'index.html'),
      ...findHtmlFiles(path.join(rootDir, 'admin')),
      ...findHtmlFiles(path.join(rootDir, 'pages')),
    ];

    assert.ok(targetHtmlFiles.length > 0, 'Should find HTML files to inspect');

    const inlineEventAttrRegex = /<[^>]+\s(on[a-z]+)\s*=/i;
    const javascriptUrlRegex = /(href|src)\s*=\s*["']\s*javascript:/i;
    const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

    for (const filePath of targetHtmlFiles) {
      const relativePath = path.relative(rootDir, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      // 1. Check for inline event attributes
      const eventMatch = inlineEventAttrRegex.exec(content);
      assert.equal(
        eventMatch,
        null,
        `File ${relativePath} contains forbidden inline event attribute: ${eventMatch?.[1]}`
      );

      // 2. Check for javascript: URLs
      const jsUrlMatch = javascriptUrlRegex.exec(content);
      assert.equal(
        jsUrlMatch,
        null,
        `File ${relativePath} contains forbidden javascript: URL`
      );

      // 3. Inspect script tags
      let match;
      while ((match = scriptTagRegex.exec(content)) !== null) {
        const attributes = match[1];
        const scriptBody = match[2].trim();

        const hasSrc = /\bsrc\s*=/i.test(attributes);
        const isJsonLd = /\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes);

        if (!hasSrc && !isJsonLd && scriptBody.length > 0) {
          assert.fail(
            `File ${relativePath} contains forbidden executable inline script: ${scriptBody.slice(0, 100)}...`
          );
        }
      }
    }
  });

  test('All nine externalized JavaScript files are served successfully (200)', async () => {
    const externalScripts = [
      '/admin/assets/setup.js',
      '/assets/js/pages/pengumuman.js',
      '/assets/js/pages/kontak.js',
      '/assets/js/pages/detail-berita.js',
      '/assets/js/pages/profil.js',
      '/assets/js/pages/layanan.js',
      '/assets/js/pages/search-page.js',
      '/assets/js/pages/faq.js',
      '/assets/js/pages/berita.js',
    ];

    for (const scriptPath of externalScripts) {
      const res = await request(env.app).get(scriptPath).expect(200);
      assert.ok(res.text.length > 0, `Script ${scriptPath} should return non-empty content`);
    }
  });
});
