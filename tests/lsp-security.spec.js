// @ts-check
/**
 * LSP Logistik Indonesia — Browser & API Security Tests
 *
 * Uses isolated test data and sends requests, including rejected POSTs.
 * No login with real credentials or file uploads.
 * All checks are derived from the actual implementation in app.js,
 * middleware/, and api/. No endpoint behaviour is assumed without reading code.
 *
 * Runs against the local Express server configured by Playwright baseURL.
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Section 1 — HTTP Security Headers
//
// Source of truth: app.js helmet() configuration (lines 17-52).
// Expected headers from helmet with those directives:
//   content-security-policy  ✓  (configured explicitly)
//   x-content-type-options   ✓  (helmet default: nosniff)
//   x-frame-options          ✓  (helmet default: SAMEORIGIN)
//                               Note: frameAncestors:'none' in CSP supersedes this,
//                               but helmet still sets the legacy header.
//   x-xss-protection         ✓  (helmet default: 0 – disables browser heuristics)
//   referrer-policy          ✓  (helmet default)
//   cross-origin-opener-policy ✓ (helmet default)
// ---------------------------------------------------------------------------

test.describe('Security Headers', () => {
  /** @type {Record<string, string>} */
  let headers = {};

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/');
    headers = res.headers();
  });

  test('Content-Security-Policy is present', () => {
    expect(headers['content-security-policy'],
      'CSP header must be set by helmet').toBeTruthy();
  });

  test('CSP script-src does not allow unsafe-inline or unsafe-eval', () => {
    const csp = headers['content-security-policy'] ?? '';
    // Extract script-src directive
    const match = csp.match(/script-src\s+([^;]+)/);
    const values = match ? match[1] : '';
    expect(values).not.toContain("'unsafe-inline'");
    expect(values).not.toContain("'unsafe-eval'");
  });

  test('CSP script-src-attr is none', () => {
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain("script-src-attr 'none'");
  });

  test('CSP frame-ancestors is none', () => {
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test('CSP connect-src restricts to self', () => {
    const csp = headers['content-security-policy'] ?? '';
    const match = csp.match(/connect-src\s+([^;]+)/);
    const values = match ? match[1].trim() : '';
    // Must include 'self' and must NOT include a wildcard
    expect(values).toContain("'self'");
    expect(values).not.toContain('*');
  });

  test('X-Content-Type-Options is nosniff', () => {
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('X-Frame-Options is set (legacy clickjacking defence)', () => {
    // helmet sets SAMEORIGIN; CSP frame-ancestors:'none' is the primary control
    expect(headers['x-frame-options']).toBeTruthy();
  });

  test('Referrer-Policy is set', () => {
    expect(headers['referrer-policy']).toBeTruthy();
  });

  test('Cross-Origin-Opener-Policy is set', () => {
    expect(headers['cross-origin-opener-policy']).toBeTruthy();
  });

  test('Server header does not disclose Express/Node version', () => {
    const server = headers['server'] ?? '';
    expect(server.toLowerCase()).not.toContain('express');
    // helmet removes X-Powered-By; also confirm that directly
    expect(headers['x-powered-by']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Section 2 — Unauthenticated Access to Protected Admin UI
//
// Source: app.js lines 106-125.
// /admin routes other than /login, /login.html, /setup, /setup.html, and
// /assets/* redirect to /admin/login.html (302) for unauthenticated requests.
// We verify /admin/index (the CMS dashboard) is NOT directly accessible.
// ---------------------------------------------------------------------------

test.describe('Admin UI access control', () => {
  test('unauthenticated GET /admin redirects to login (not 200)', async ({ request }) => {
    // Allow redirect to happen but confirm the final page is not the dashboard
    const res = await request.get('/admin', { maxRedirects: 0 });
    // The middleware issues a 302 redirect
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toMatch(/login/i);
  });

  test('unauthenticated GET /admin/index stays outside dashboard', async ({ page, request }) => {
    const res = await request.get('/admin/index', { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()['location'] ?? '').toMatch(/\/admin\/login(?:\.html)?(?:[?#]|$)/i);

    const response = await page.goto('/admin/index');
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toMatch(/^\/admin\/(?:login|setup)(?:\.html)?$/i);
    expect((await page.title()).toLowerCase()).not.toContain('dashboard');
  });

  test('unauthenticated GET /admin/index.html redirects to login', async ({ request }) => {
    const res = await request.get('/admin/index.html', { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toMatch(/login/i);
  });

  test('/admin/login page is publicly accessible (200)', async ({ request }) => {
    // login and setup are explicitly whitelisted in app.js
    const res = await request.get('/admin/login');
    expect(res.status()).toBe(200);
  });

  test('/admin/login or setup page does not expose stack traces or secret values', async ({ page }) => {
    await page.goto('/admin/login');
    const bodyText = await page.locator('body').innerText();

    expect(bodyText).not.toMatch(/at\s+\w+\s+\(.*\.js:\d+:\d+\)/);
    expect(bodyText).not.toContain('lsp-playwright-only-session-secret');
    expect(bodyText).not.toContain('lsp-playwright-only-setup-token');
    expect(bodyText).not.toMatch(/lsp-playwright-[^\\/\s]+[\\/](?:lsp|sessions)\.db/i);
    expect(bodyText).not.toMatch(/sqlite_error|SqliteError/i);
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Protected API Endpoints Reject Unauthenticated Requests
//
// Source: api/auth.js.
// GET /api/auth/me requires requireAuth → returns 401 when no session.
// POST /api/auth/logout requires requireAuth → returns 401.
// POST /api/auth/change-password requires requireAuth → returns 401.
// ---------------------------------------------------------------------------

test.describe('Auth API — unauthenticated rejection', () => {
  test('GET /api/auth/me returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    // Must not leak admin data
    expect(body.data).toBeUndefined();
  });

  test('POST /api/auth/logout returns 401 without session (not 200)', async ({ request }) => {
    // We send no CSRF token and no session; requireAuth fires first → 401
    const res = await request.post('/api/auth/logout', {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/auth/change-password returns 401 without session', async ({ request }) => {
    const res = await request.post('/api/auth/change-password', {
      headers: { 'Content-Type': 'application/json' },
      data: { currentPassword: 'test', newPassword: 'test123456789' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('/api/admin/* returns 401 without session', async ({ request }) => {
    // /api/admin is guarded by requireAuth in app.js line 91
    const res = await request.get('/api/admin/anything');
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Protection on Mutating Auth Endpoints
//
// Source: api/auth.js — login uses csrfProtection; setup uses X-Setup-Token.
// Requests missing the applicable token must return 403.
// ---------------------------------------------------------------------------

test.describe('Auth mutation protections', () => {
  test('POST /api/auth/login without CSRF token returns 403', async ({ request }) => {
    // No session cookie, no X-CSRF-Token header
    const res = await request.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: { username: 'admin', password: 'password' },
    });
    // csrfProtection fires before credential check → 403
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('CSRF_ERROR');
  });

  test('POST /api/auth/setup rejects an invalid X-Setup-Token while setup is open', async ({ request }) => {
    const setupStatus = await request.get('/api/auth/setup-status');
    expect(setupStatus.status()).toBe(200);
    expect((await setupStatus.json()).data.setupRequired).toBe(true);

    const res = await request.post('/api/auth/setup', {
      headers: { 'Content-Type': 'application/json', 'X-Setup-Token': 'invalid-playwright-token' },
      data: { username: 'hacker', password: 'hacked12345678' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_SETUP_TOKEN');
  });
});

// ---------------------------------------------------------------------------
// Section 5 — Sensitive Files Must Not Be Accessible Over HTTP
//
// Express only serves:
//   /assets  → ./assets
//   /pages   → ./pages
//   /admin   → ./admin  (with auth guard)
//   /media   → uploads via serveImage middleware
// Files in the repo root (e.g. .env, database/*.db) are not under any
// static-serving path, so they must return 404 (or 400/403).
// ---------------------------------------------------------------------------

test.describe('Sensitive file access prevention', () => {
  const BLOCKED_PATHS = [
    '/.env',
    '/.env.example',
    '/database/lsp.db',
    '/database/sessions.db',
    '/database/lsp.db-wal',
    '/package.json',
    '/package-lock.json',
    '/server.js',
    '/app.js',
    '/middleware/auth.js',
    '/middleware/session.js',
    '/config/env.js',
    '/node_modules/express/package.json',
  ];

  for (const filePath of BLOCKED_PATHS) {
    test(`GET ${filePath} is not served publicly`, async ({ request }) => {
      const res = await request.get(filePath);
      // Must not return 200 (OK) — 400, 403, 404 are all acceptable
      expect([400, 403, 404], `${filePath} must not be publicly accessible`).toContain(res.status());
    });
  }
});

// ---------------------------------------------------------------------------
// Section 6 — Media Endpoint Path-Traversal and Category Validation
//
// Source: middleware/serveImage.js.
// ALLOWED_CATEGORIES = ['berita', 'pengurus', 'galeri']
// FILENAME_REGEX = UUID v4 + allowed extension only
// ---------------------------------------------------------------------------

test.describe('Media endpoint — input validation', () => {
  test('encoded traversal in filename returns 400', async ({ request }) => {
    const res = await request.get('/media/images/berita/..%2F..%2Fetc%2Fpasswd');
    expect(res.status()).toBe(400);
  });

  test('non-UUID filename returns 400', async ({ request }) => {
    const res = await request.get('/media/images/berita/not-a-uuid.jpg');
    expect(res.status()).toBe(400);
  });

  test('non-existent UUID file returns 404', async ({ request }) => {
    // Valid category + valid UUID format, but file does not exist
    const res = await request.get(
      '/media/images/berita/00000000-0000-4000-8000-000000000000.jpg'
    );
    expect(res.status()).toBe(404);
  });

  test('unknown category returns 400', async ({ request }) => {
    const res = await request.get(
      '/media/images/uploads/00000000-0000-4000-8000-000000000000.jpg'
    );
    expect(res.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Section 7 — Public API Does Not Leak Draft Content
//
// Source: api/berita.js — GET /api/berita without scope=admin
// filters to status='terbit' only. Draft items must not appear.
// We can only assert the structure; we cannot assume any content exists
// in the local test database.
// ---------------------------------------------------------------------------

test.describe('Public API — no draft data leakage', () => {
  test('GET /api/berita returns only terbit items (no draft in response)', async ({ request }) => {
    const res = await request.get('/api/berita');
    // 200 (content exists) or 404 (no content yet) are both acceptable
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.success).toBe(true);
      const items = body.data ?? [];
      for (const item of items) {
        expect(item.status, `Draft item leaked: ${item.id}`).toBe('terbit');
      }
    } else {
      // Empty database — nothing to assert; not a failure
      expect([404, 200]).toContain(res.status());
    }
  });

  test('GET /api/berita does not expose password_hash or internal fields', async ({ request }) => {
    const res = await request.get('/api/berita');
    if (res.status() === 200) {
      const body = await res.json();
      const items = body.data ?? [];
      for (const item of items) {
        expect(item).not.toHaveProperty('password_hash');
        expect(item).not.toHaveProperty('admin_id');
      }
    }
    // If empty DB (404/empty), pass silently
  });

  test('GET /api/auth/setup-status does not reveal admin username or password', async ({ request }) => {
    const res = await request.get('/api/auth/setup-status');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Only allowed key under data is setupRequired (boolean)
    expect(typeof body.data.setupRequired).toBe('boolean');
    expect(body.data).not.toHaveProperty('username');
    expect(body.data).not.toHaveProperty('password');
    expect(body.data).not.toHaveProperty('password_hash');
  });

  test('GET /api/auth/csrf-token returns a token and nothing else sensitive', async ({ request }) => {
    const res = await request.get('/api/auth/csrf-token');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.csrfToken).toBe('string');
    expect(body.data.csrfToken.length).toBeGreaterThan(0);
    // Must not accidentally include session secret or other config values
    expect(body.data).not.toHaveProperty('sessionSecret');
    expect(body.data).not.toHaveProperty('adminId');
  });
});

// ---------------------------------------------------------------------------
// Section 8 — 404 and Error Responses Do Not Leak Internals
//
// Source: middleware/errorHandler.js.
// In development mode, stack traces may appear in the server console but
// must NOT be returned in HTTP responses.
// notFoundHandler returns JSON for /api/* and 404.html for page routes.
// ---------------------------------------------------------------------------

test.describe('Error responses — no internal leakage', () => {
  test('GET /api/nonexistent returns structured 404, not a stack trace', async ({ request }) => {
    const res = await request.get('/api/nonexistent-endpoint-xyz');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
    // Must not contain file paths or stack frames
    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toMatch(/at\s+\w+\s+\(/);
    expect(bodyText).not.toMatch(/node_modules/);
  });

  test('GET /nonexistent-page returns 404, not 200 or a stack trace', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    expect(response?.status()).toBe(404);
    const bodyText = await page.locator('body').innerText();
    // No Node.js stack frames in page body
    expect(bodyText).not.toMatch(/at\s+\w+\s+\(.*\.js:\d+:\d+\)/);
    expect(bodyText).not.toMatch(/SESSION_SECRET|DATABASE_PATH/i);
  });
});
