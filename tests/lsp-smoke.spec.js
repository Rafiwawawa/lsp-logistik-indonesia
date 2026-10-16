// @ts-check
/**
 * LSP Logistik Indonesia — Browser Smoke Tests
 *
 * Read-only. No login, no mutations, no form submissions.
 * Runs against the local Express server on http://localhost:4000.
 * Third-party resource failures (Google Maps, fonts, WhatsApp CDN, etc.)
 * are tolerated; only first-party failures are treated as bugs.
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * True if the request URL is served by our own Express server (port 4000).
 * @param {{ url: () => string }} req
 */
function isFirstParty(req) {
  try {
    const url = new URL(req.url());
    return url.hostname === 'localhost' && url.port === '4000';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Homepage smoke tests
// ---------------------------------------------------------------------------

test.describe('Homepage', () => {
  /** @type {string[]} */
  let jsErrors;
  /** @type {{ url: string; status: number }[]} */
  let firstPartyFailures;

  test.beforeEach(async ({ page }) => {
    jsErrors = [];
    firstPartyFailures = [];

    // Collect uncaught JS errors from the page runtime.
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });

    // Collect first-party network failures (hard failures — no HTTP response).
    page.on('requestfailed', (req) => {
      if (isFirstParty(req)) {
        firstPartyFailures.push({
          url: req.url(),
          status: 0,
        });
      }
    });

    // Collect first-party HTTP error responses (4xx / 5xx).
    page.on('response', (res) => {
      if (isFirstParty(res.request()) && res.status() >= 400) {
        firstPartyFailures.push({ url: res.url(), status: res.status() });
      }
    });
  });

  test('HTTP 200 and correct page title', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'Homepage should return HTTP 200').toBe(200);

    await expect(page).toHaveTitle(/LSP LOGISTIK INDONESIA/i);
  });

  test('main h1 heading is visible and mentions the certification scheme', async ({ page }) => {
    await page.goto('/');

    // The hero h1 contains "Supervisor" and "Gudang" (split across child elements).
    const h1 = page.locator('h1.hero-headline');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Supervisor');
    await expect(h1).toContainText('Gudang');
  });

  test('no JavaScript runtime errors on homepage load', async ({ page }) => {
    await page.goto('/');
    // Allow time for deferred/async scripts to settle.
    await page.waitForLoadState('networkidle');
    expect(jsErrors, `Unexpected JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
  });

  test('no first-party resource failures on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Exclude /api/* routes that legitimately return 404 when the SQLite DB has
    // no content yet (e.g. /api/berita on a freshly migrated database).
    const unexpectedFailures = firstPartyFailures.filter(
      (f) => !(f.url.includes('/api/') && f.status === 404),
    );

    expect(
      unexpectedFailures,
      `First-party failures: ${JSON.stringify(unexpectedFailures, null, 2)}`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

test('/health endpoint returns { status: "ok" }', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.status).toBe('ok');
});

// ---------------------------------------------------------------------------
// Key public pages — basic reachability
// ---------------------------------------------------------------------------

const PUBLIC_PAGES = [
  { path: '/pages/profil.html', titlePattern: /LSP LOGISTIK INDONESIA/i },
  { path: '/pages/layanan.html', titlePattern: /LSP LOGISTIK INDONESIA/i },
  { path: '/pages/berita.html', titlePattern: /LSP LOGISTIK INDONESIA/i },
  { path: '/pages/kontak.html', titlePattern: /LSP LOGISTIK INDONESIA/i },
];

for (const { path, titlePattern } of PUBLIC_PAGES) {
  test(`page ${path} is reachable and has LSP title`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should return HTTP 200`).toBe(200);
    await expect(page).toHaveTitle(titlePattern);
  });
}

// ---------------------------------------------------------------------------
// CSP smoke — no blocked first-party scripts on homepage
// ---------------------------------------------------------------------------

test('no CSP violations for first-party scripts on homepage', async ({ page }) => {
  /** @type {string[]} */
  const cspViolations = [];

  // CSP violations surface as console errors containing the directive name.
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      msg.text().toLowerCase().includes('content security policy')
    ) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(
    cspViolations,
    `Unexpected CSP violations: ${cspViolations.join('; ')}`,
  ).toHaveLength(0);
});
