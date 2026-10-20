import { test, expect } from '@playwright/test';

test('a pending replacement stays faded until its image is ready', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => { Math.random = () => 0; });
  let delayedUrl: string | undefined;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const pending = new Promise<void>(resolve => { requested = resolve; });
  await page.route(url => url.protocol === 'https:', async route => {
    if (route.request().url() === delayedUrl) {
      requested();
      await held;
    }
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="green"/></svg>',
    });
  });
  try {
    await page.goto('/fotografia/');
    const image = page.locator('[data-featured]');
    await expect(image).toHaveJSProperty('naturalWidth', 600);
    const next = page.locator('[data-photo-index="1"]');
    delayedUrl = (await next.getAttribute('data-full-url'))!;
    await next.click();
    await pending;
    const maximumOpacity = await image.evaluate(async image => {
      const container = image.parentElement!;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const end = performance.now() + 300;
      let maximum = 0;
      await new Promise<void>(resolve => {
        const sample = () => {
          maximum = Math.max(maximum, Number(getComputedStyle(container).opacity));
          if (performance.now() >= end) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      return maximum;
    });
    expect(maximumOpacity).toBeLessThanOrEqual(0.01);
    release();
    await expect(image).toHaveAttribute('src', delayedUrl);
    await expect(image).toHaveJSProperty('naturalWidth', 600);
    await expect(image.locator('..')).toHaveCSS('opacity', '1');
    await expect(next).toHaveAttribute('aria-pressed', 'true');
  } finally {
    release();
  }
});
