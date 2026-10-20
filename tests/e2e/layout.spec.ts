import { photoCount } from '../photo-catalog.ts';
import { test, expect } from '@playwright/test';
import { socialLinks as configuredSocialLinks } from '../../src/data/social-links.ts';

const viewports = [
  { name:'desktop', width:1440, height:900, bodyRatio:0.7, fontSize:16, thumbnailHeight:180 },
  { name:'mobile', width:390, height:844, bodyRatio:0.9, fontSize:14, thumbnailHeight:112 },
];

for (const viewport of viewports) {
  for (const route of ['/fotografia/', '/cv/']) {
    test(`${route} is readable and fits the ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width:viewport.width, height:viewport.height });
      await page.emulateMedia({ reducedMotion:'reduce' });
      await page.addInitScript(() => { Math.random = () => 0; });
      await page.route(url => url.protocol === 'https:', async request => {
        const url = new URL(request.request().url());
        if (url.hostname === 'lh3.googleusercontent.com') {
          const seed = [...url.pathname].reduce((sum, character) => sum + character.charCodeAt(0), 0);
          const width = url.href.endsWith('=w800') ? 600 : [400, 600, 800][seed % 3];
          return request.fulfill({
            contentType:'image/svg+xml',
            body:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="400"/>`,
          });
        }
        if (request.request().resourceType() === 'image') {
          return request.fulfill({
            contentType:'image/svg+xml',
            body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
          });
        }
        return request.abort();
      });

      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('font-size', `${viewport.fontSize}px`);
      const body = await page.locator('body').boundingBox();
      expect(body!.width).toBeCloseTo(viewport.width * viewport.bodyRatio, 0);
      await expect(page.getByRole('navigation', { name:'Secciones' })).toBeVisible();

      if (route === '/fotografia/') {
        const thumbnails = page.locator('.flexbin button');
        await expect(thumbnails).toHaveCount(photoCount);
        await expect(page.locator('#venta')).toHaveCSS('font-size', `${viewport.fontSize * 0.75}px`);
        await expect(page.locator('#venta')).toHaveCSS('text-align', 'center');
        await expect(thumbnails.first()).toHaveCSS('height', `${viewport.thumbnailHeight}px`);
        for (const thumbnail of await thumbnails.all()) {
          await thumbnail.scrollIntoViewIfNeeded();
          await expect.poll(() => thumbnail.locator('img').evaluate(image => {
            const photo = image as HTMLImageElement;
            return photo.complete && photo.naturalWidth > 0;
          })).toBe(true);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        const featured = await page.locator('.galeria').boundingBox();
        expect(featured!.height).toBeCloseTo(featured!.width * 0.667, 0);
        await expect(page.locator('.galeria img')).toBeVisible();
      } else {
        await expect(page.locator('.cv h1')).toBeVisible();
        await expect(page.locator('.cv h1')).toHaveCSS('font-size', `${viewport.fontSize * 3}px`);
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      const socialLinks = page.locator('#rrss a');
      await expect(socialLinks).toHaveCount(configuredSocialLinks.length);
      const bounds = await socialLinks.evaluateAll(links => links.map(link => {
        const { left, right, top, bottom } = link.getBoundingClientRect();
        return { left, right, top, bottom };
      }));
      for (const link of bounds) {
        expect(link.left).toBeGreaterThanOrEqual(0);
        expect(link.top).toBeGreaterThanOrEqual(0);
        expect(link.right).toBeLessThanOrEqual(viewport.width);
        expect(link.bottom).toBeLessThanOrEqual(viewport.height);
      }
    });
  }
}
