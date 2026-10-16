import { test, expect } from '@playwright/test';

test('search page filters Berita and Artikel together and preserves other categories', async ({ page }) => {
  await page.route('**/api/berita?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: [
        { judul: 'Kabar Sertifikasi', slug: 'kabar-sertifikasi', kategori: 'Berita', status: 'terbit' },
        { judul: 'Panduan Sertifikasi', slug: 'panduan-sertifikasi', kategori: 'Artikel', status: 'terbit' },
      ],
    }),
  }));

  await page.goto('/pages/search.html');
  const results = page.locator('#searchResultsList article');

  await expect(results).toHaveCount(5);
  await page.locator('#searchFilterPills [data-filter="konten"]').click();
  await expect(results).toHaveCount(2);
  await expect(results.locator('.badge')).toHaveText(['Berita', 'Artikel']);

  for (const category of ['Skema Sertifikasi', 'Profil', 'FAQ']) {
    await page.locator(`#searchFilterPills [data-filter="${category}"]`).click();
    await expect(results).toHaveCount(1);
    await expect(results.locator('.badge')).toHaveText([category]);
  }

  await page.locator('#searchFilterPills [data-filter="all"]').click();
  await expect(results).toHaveCount(5);
});

test('modal keeps static results available after article API failure without repeated requests', async ({ page }) => {
  let apiRequests = 0;
  await page.route('**/api/berita?**', route => {
    apiRequests += 1;
    return route.fulfill({ status: 503, body: 'Unavailable' });
  });

  await page.goto('/pages/search.html');
  await expect(page.locator('#searchResultsList article')).toHaveCount(3);
  await page.locator('.search-trigger-btn').click();

  const input = page.locator('#searchModal input');
  const result = page.locator('#searchModal .search-result-item');
  for (const [query, category] of [
    ['Profil', 'Profil'],
    ['FAQ', 'FAQ'],
    ['Supervisor', 'Skema Sertifikasi'],
  ]) {
    await input.fill(query);
    await expect(result).toHaveCount(1);
    await expect(result).toContainText(category);
  }

  expect(apiRequests).toBe(1);
});

test('modal returns static results when the article API exceeds its timeout', async ({ page }) => {
  test.setTimeout(15000);
  const apiTimeoutMs = 5000;
  let apiRequests = 0;
  let finishDelayedResponse;
  const delayedResponseFinished = new Promise(resolve => {
    finishDelayedResponse = resolve;
  });

  await page.route('**/api/berita?**', async route => {
    apiRequests += 1;
    await new Promise(resolve => setTimeout(resolve, apiTimeoutMs + 1000));
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    } catch {
      // The browser should have cancelled this delayed request at the client timeout.
    } finally {
      finishDelayedResponse();
    }
  });

  await page.goto('/pages/search.html');
  await expect.poll(() => apiRequests).toBe(1);
  await page.locator('.search-trigger-btn').click();

  const input = page.locator('#searchModal input');
  await input.fill('Profil');
  const result = page.locator('#searchModal .search-result-item');
  await expect(result).toHaveCount(1, { timeout: 7000 });
  await expect(result).toContainText('Profil');

  expect(apiRequests).toBe(1);
  await delayedResponseFinished;
});
