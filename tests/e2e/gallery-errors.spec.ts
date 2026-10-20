import { test, expect } from '@playwright/test';

test('same failed photo retries, keeps an honest error and recovers on load', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  let attempts = 0;
  let recover = false;
  await page.route(url => url.protocol === 'https:', async route => {
    if (route.request().url().endsWith('=w800')) {
      attempts++;
      if (!recover) return route.abort('failed');
    }
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"/>' });
  });
  await page.goto('/fotografia/');
  const status = page.locator('[data-gallery-status]');
  const message = 'No se ha podido cargar esta fotografía. Puedes seleccionar otra.';
  await expect(status).toHaveText(message);
  const before = attempts;
  await page.locator('[data-photo-index]').first().click();
  await expect.poll(() => attempts).toBeGreaterThan(before);
  await expect(status).toHaveText(message);
  recover = true;
  await page.locator('[data-photo-index]').first().click();
  await expect(page.locator('[data-featured]')).toHaveJSProperty('naturalWidth', 600);
  await expect(status).toBeEmpty();
  await expect(page.locator('[data-photo-index]').first()).toHaveAttribute('aria-pressed', 'true');
});

test('remote failure reports an error and manual selection recovers', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  let firstFull = true;
  await page.route('https://lh3.googleusercontent.com/**', async route => {
    if (route.request().url().endsWith('=w800') && firstFull) {
      firstFull = false;
      return route.abort('failed');
    }
    return route.fulfill({ contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"/>' });
  });
  await page.goto('/fotografia/');
  await expect(page.getByRole('status')).toHaveText('No se ha podido cargar esta fotografía. Puedes seleccionar otra.');
  await page.locator('.flexbin button').nth(1).click();
  await expect(page.locator('.flexbin button').nth(1)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[role="status"]')).toBeEmpty();
  await expect(page.locator('[role="status"]')).not.toBeVisible();
  await expect(page.locator('.galeria img')).toBeVisible();
});
