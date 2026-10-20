import { photoCount } from '../photo-catalog.ts';
import { test, expect } from '@playwright/test';

test('CSP blocks injected scripts while the gallery and styles work', async ({ page }) => {
  await page.route('https://lh3.googleusercontent.com/**', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"/>',
  }));
  await page.goto('/');
  const executed = await page.evaluate(async () => {
    document.documentElement.dataset.injected = 'blocked';
    const script = document.createElement('script');
    script.textContent = "document.documentElement.dataset.injected = 'executed'";
    document.head.append(script);
    await new Promise(resolve => setTimeout(resolve, 50));
    return document.documentElement.dataset.injected;
  });
  expect(executed).toBe('blocked');
  await expect(page.locator('.flexbin button')).toHaveCount(photoCount);
  await page.locator('.flexbin button').nth(2).click();
  await expect(page.locator('.flexbin button').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('.galeria img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).marginTop)).toBe('60px');
});

test('document image requests omit the outgoing Referer', async ({ page }) => {
  let referer: string | undefined;
  const requested = new Promise<void>(resolve => {
    page.route('https://lh3.googleusercontent.com/**', async route => {
      referer = (await route.request().allHeaders()).referer;
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
      resolve();
    });
  });
  await page.goto('/cv/');
  await page.evaluate(() => {
    const image = new Image();
    image.src = 'https://lh3.googleusercontent.com/security-referrer-test';
    document.body.append(image);
  });
  await requested;
  expect(referer).toBeUndefined();
});

test('shared pages declare CSP and referrer protection', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  for (const path of ['/', '/cv/', '/politica_cookies/', '/404.html']) {
    await page.goto(path);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'self'/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  }
});
