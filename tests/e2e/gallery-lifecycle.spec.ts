import { test, expect, chromium } from '@playwright/test';
import { siteConfig } from '../../src/config/site.ts';

test('native cached navigation preserves manual selection and working controls', async ({}, testInfo) => {
  const browser = await chromium.launch({
    // Native BFCache restoration needs full Chromium, not the default headless shell.
    ...testInfo.project.use.launchOptions,
    channel: 'chromium',
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  });
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    context = await browser.newContext();
    await context.route(url => url.protocol === 'https:', async route => {
      if (route.request().resourceType() !== 'image') return route.abort();
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"/>',
      });
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.addEventListener('pageshow', event => {
        document.documentElement.dataset.cached = String(event.persisted);
      });
    });
    const galleryPath = siteConfig.home === 'photography' ? '/' : '/fotografia/';
    await page.goto('http://127.0.0.1:4321' + galleryPath);
    const buttons = page.locator('[data-photo-index]');
    await buttons.nth(4).click();
    await expect(buttons.nth(4)).toHaveAttribute('aria-pressed', 'true');
    await page.goto('http://127.0.0.1:4321/politica_cookies/');
    await page.goBack({ waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveAttribute('data-cached', 'true');
    await expect(buttons.nth(4)).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(6100);
    await expect(buttons.nth(4)).toHaveAttribute('aria-pressed', 'true');
    await buttons.nth(7).click();
    await expect(buttons.nth(7)).toHaveAttribute('aria-pressed', 'true');
  } finally {
    try {
      await context?.close();
    } finally {
      await browser.close();
    }
  }
});
