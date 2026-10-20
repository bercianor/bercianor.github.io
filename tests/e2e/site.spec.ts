import { photoCount } from '../photo-catalog.ts';
import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { socialLinks } from '../../src/data/social-links.ts';
import { siteConfig, sectionMetadata } from '../../src/config/site.ts';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  // Functional checks are isolated from remote image availability.
  await page.route(url => url.protocol === 'https:', route => new URL(route.request().url()).hostname === 'lh3.googleusercontent.com'
    ? route.fulfill({ contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"/>' })
    : route.abort());
});

test('gallery controls name their position independently from empty image alternatives', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const buttons = page.locator('[data-photo-index]');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    await expect(buttons.nth(index)).toHaveAccessibleName(`Mostrar fotografía ${index + 1} de ${count}`);
    await expect(buttons.nth(index).locator('img')).toHaveAttribute('alt', '');
  }
  await expect(page.locator('[data-featured]')).toHaveAttribute('alt', '');
  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-featured]')).toHaveAttribute('alt', '');
});

test('social icons load as local SVG images', async ({ page }) => {
  await page.goto('/cv/');
  const images = page.locator('#rrss img');
  await expect(images).toHaveCount(socialLinks.length);
  for (const image of await images.all()) {
    const src = (await image.getAttribute('src'))!;
    expect(src).toMatch(/^\/static\/images\/social\/[^/]+\.svg$/);
    const response = await page.request.get(src);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    await image.evaluate(element => (element as HTMLImageElement).decode());
    expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});

test('GPG link serves the provided public key', async ({ page }) => {
  await page.goto('/cv/');
  const link = page.getByRole('link', { name: 'GPG', exact: true });
  await expect(link).toHaveAttribute('href', '/static/files/bercianor.pub.asc');
  const response = await page.request.get((await link.getAttribute('href'))!);
  expect(response.status()).toBe(200);
  expect(await response.body()).toEqual(await readFile(new URL('../../public/static/files/bercianor.pub.asc', import.meta.url)));
});

test('stable routes, canonical metadata and shared links', async ({ page }) => {
  for (const path of ['/', '/fotografia/', '/cv/', '/politica_cookies/', '/404.html']) {
    const response = await page.goto(path);
    expect([200, 404]).toContain(response!.status());
    await expect(page.locator('header img')).toHaveAttribute('src', '/static/images/firma.png');
    await expect(page.locator('#rrss a')).toHaveCount(socialLinks.length);
    const homePath = sectionMetadata.find(section => section.id === siteConfig.home)!.path;
    const canonicalPath = path === '/' || path === homePath ? '/' : path;
    await expect(page).toHaveURL('http://127.0.0.1:4321' + canonicalPath);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://bercianor.es' + canonicalPath);
    await expect(page.getByRole('link', { name: 'Fotografía', exact:true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'CV', exact:true }).first()).toBeVisible();
  }
});

test('404 page explains the error and offers a working return to home', async ({ page }) => {
  await page.goto('/404.html');
  const content = page.locator('main');

  await expect(content.getByRole('heading', { level:1 })).toHaveText('404');
  await expect(content.getByText('No hemos podido encontrar la página que buscas.', { exact:true })).toBeVisible();
  await content.getByRole('link', { name:'Volver a la portada' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4321/');
  await expect(page.locator('main')).toBeVisible();
});

test('SEO metadata describes each indexable page without changing its content', async ({ page }) => {
  const home = sectionMetadata.find(section => section.id === siteConfig.home)!;
  const descriptions = new Set<string>();
  for (const section of sectionMetadata.filter(section => section.enabled)) {
    await page.goto(section.id === home.id ? '/' : section.path);
    await expect(page).toHaveTitle(new RegExp('Rubén Berciano'));
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description!.length).toBeGreaterThan(30);
    descriptions.add(description!);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute('href', section.id === home.id ? '/' : section.path);
  }
  expect(descriptions.size).toBe(sectionMetadata.filter(section => section.enabled).length);
  await page.goto('/politica_cookies/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /cookies/);
});

test('home alias redirects immediately to the canonical root without JavaScript', async ({ browser, request }) => {
  const home = sectionMetadata.find(section => section.id === siteConfig.home)!;
  const response = await request.get(home.path);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toMatch(/http-equiv="refresh" content="0;url=\/"/);
  expect(html).toContain('href="https://bercianor.es/"');
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.route('https://**/*', route => route.abort());
    await page.goto('http://127.0.0.1:4321' + home.path);
    await expect(page).toHaveURL('http://127.0.0.1:4321/');
    await expect(page.locator('main')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('sitemap lists the canonical root and the sections not selected as home', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/(?:application|text)\/xml/);
  const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  expect(urls).toEqual([
    'https://bercianor.es/',
    ...sectionMetadata.filter(section => section.enabled && section.id !== siteConfig.home)
      .map(section => 'https://bercianor.es' + section.path),
    'https://bercianor.es/politica_cookies/',
  ]);
});

test('home renders configured section without a browser redirect', async ({ page }) => {
  await page.goto('/');
  expect(new URL(page.url()).pathname).toBe('/');
  if (siteConfig.home === 'cv') await expect(page.locator('.cv')).toBeVisible();
  else await expect(page.locator('.flexbin button')).toHaveCount(photoCount);
  await page.goto('/fotografia/');
  await expect(page.locator('.flexbin button')).toHaveCount(photoCount);
  await page.goto('/cv/');
  await expect(page.locator('.cv')).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`manual selection aligns the photo and stops autoplay at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await page.goto('/fotografia/');
    const buttons = page.locator('.flexbin button');
    await expect(buttons).toHaveCount(photoCount);
    await buttons.nth(8).click();
    await page.clock.runFor(1100);
    const featured = page.locator('.galeria img');
    const selectedSrc = await featured.getAttribute('src');
    await expect(buttons.nth(8)).toHaveAttribute('aria-pressed', 'true');
    expect((await featured.boundingBox())!.y).toBeCloseTo(8, 0);
    await page.clock.runFor(15000);
    await expect(featured).toHaveAttribute('src', selectedSrc!);
    await buttons.nth(2).focus();
    await page.keyboard.press('Enter');
    await page.clock.runFor(1100);
    await expect(buttons.nth(2)).toHaveAttribute('aria-pressed', 'true');
    expect((await featured.boundingBox())!.y).toBeCloseTo(8, 0);
  });
}

test('reduced motion keeps a useful static image until keyboard selection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/fotografia/');
  const image = page.locator('.galeria img');
  const source = await image.getAttribute('src');
  expect(source).toContain('=w800');
  await page.clock.runFor(15000);
  await expect(image).toHaveAttribute('src', source!);
  const button = page.locator('.flexbin button').nth(4);
  await button.focus();
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
});

test('public identity resources and indexing files are served', async ({ request }) => {
  for (const path of ['/robots.txt','/sitemap.xml','/.well-known/nostr.json','/keybase.txt','/static/files/bercianor.pub.asc']) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
  }
});

test('NIP-05 serves a JSON document with a names property', async ({ request }) => {
  const response = await request.get('/.well-known/nostr.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toHaveProperty('names');
});

test('configured CV renders Markdown', async ({ page }) => {
  await page.goto('/cv/');
  const content = page.locator('.cv');
  await expect(content).toBeVisible();
  const blocks = await content.locator('h1, h2, h3, p, li').allTextContents();
  expect(blocks.length).toBeGreaterThan(0);
  const response = await page.request.get('/cv.pdf');
  expect(response.status()).toBe(200);
  const extracted = spawnSync('pdftotext', ['-', '-'], { input: await response.body(), encoding: 'utf8' });
  expect(extracted.error).toBeUndefined();
  expect(extracted.status).toBe(0);
  expect(extracted.stderr).toBe('');
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, '');
  for (const block of blocks) expect(normalize(extracted.stdout)).toContain(normalize(block));
});

test('selected CV downloads as cv_ruben_berciano.pdf', async ({ page }) => {
  await page.goto('/cv/');
  const button = page.getByRole('link', { name: 'Descargar CV en PDF' });
  await expect(button).toHaveAttribute('href', '/cv.pdf');
  await expect(button).toHaveAttribute('download', 'cv_ruben_berciano.pdf');
  const pending = page.waitForEvent('download');
  await button.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('cv_ruben_berciano.pdf');
  expect(await download.failure()).toBeNull();
});

test('every discovered CV has a PDF', async ({ request }) => {
  const files = (await readdir(new URL('../../src/content/cv/', import.meta.url))).filter(filename => filename.endsWith('.md'));
  expect(files.length).toBeGreaterThan(0);
  const selected = await request.get('/cv.pdf');
  expect(selected.status()).toBe(200);
  expect(selected.headers()['content-type']).toContain('application/pdf');
  expect((await selected.body()).subarray(0, 5).toString()).toBe('%PDF-');
  for (const filename of files) {
    const response = await request.get(`/cv/${encodeURIComponent(filename.slice(0, -3))}.pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }
});

test('cookie policy explains own storage and external image requests', async ({ page }) => {
  await page.goto('/politica_cookies/');
  const content = page.locator('main');

  await expect(content.getByRole('heading', { level:1 })).toHaveText('Política de Cookies');
  await expect(content.locator('p').first()).toHaveText(
    'Esta web no utiliza cookies propias ni herramientas de analítica o seguimiento.',
  );
  await expect(content.getByRole('heading', { level:2 })).toHaveText([
    'Cookies propias', 'Imágenes y servicios externos', 'Enlaces a otras plataformas',
    'Cómo gestionar las cookies', 'Contacto',
  ]);
  await expect(content).toContainText('almacenamiento local');
  await expect(content).toContainText('lh3.googleusercontent.com');
  await expect(content).toContainText('dirección IP');
  await expect(content).toContainText('dependen de cada proveedor');
  await expect(content).toContainText('ajustes de privacidad de tu navegador');
  await expect(content.getByRole('link', { name:'ruben@bercianor.es' }))
    .toHaveAttribute('href', 'mailto:ruben@bercianor.es');
  const headingIds = await content.locator('h1,h2').evaluateAll(headings => headings.map(heading => heading.id));
  expect(headingIds.every(id => id.length > 0)).toBe(true);
  expect(new Set(headingIds).size).toBe(headingIds.length);
});

test('CV and legal content are readable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled:false });
  const page = await context.newPage();
  await page.route(url => url.protocol === 'https:', route => route.abort());
  for (const route of ['/cv/', '/politica_cookies/']) {
    await page.goto('http://127.0.0.1:4321' + route);
    await expect(page.locator('main')).toBeVisible();
    if (route === '/cv/') {
      await expect(page.locator('.cv')).toBeVisible();
      await expect(page.locator('.cv h1')).toBeVisible();
    } else {
      expect((await page.locator('main').innerText()).length).toBeGreaterThan(500);
    }
  }
  await context.close();
});
