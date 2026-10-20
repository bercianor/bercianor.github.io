import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile, symlink, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const photoCount = JSON.parse(await readFile(join(root, 'src/data/photos.generated.json'), 'utf8')).photos.length;
await mkdir(join(root, 'test-results'), { recursive: true });
const scratch = await mkdtemp(join(root, 'test-results/bercianor-home-'));
let server;
let browser;
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Expected exactly one config marker: ${before}`);
  return source.replace(before, after);
}
function withSetting(source, key, value) {
  const marker = source.match(new RegExp(`${key}: '[^']*'`))?.[0];
  assert.ok(marker, `Missing configuration setting: ${key}`);
  return replaceOnce(source, marker, `${key}: '${value}'`);
}
async function assertCvPdf(page) {
  const button = page.getByRole('link', { name: 'Descargar CV en PDF' });
  assert.equal(await button.getAttribute('href'), '/cv.pdf');
  assert.equal(await button.getAttribute('download'), 'cv_ruben_berciano.pdf');
  const response = await page.request.get(new URL('/cv.pdf', page.url()).href);
  assert.equal(response.status(), 200);
  assert.match(response.headers()['content-type'], /application\/pdf/);
  const pdf = await response.body();
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const extracted = spawnSync('pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' });
  if (extracted.error) throw extracted.error;
  assert.equal(extracted.status, 0, extracted.stderr);
  assert.equal(extracted.stderr, '');
  const normalize = text => text.normalize('NFKC').replace(/\s+/g, '');
  const text = normalize(extracted.stdout);
  for (const block of await page.locator('.cv h1, .cv h2, .cv h3, .cv p, .cv li').allTextContents()) {
    assert.ok(text.includes(normalize(block)), `PDF contains rendered CV text: ${block}`);
  }
}
function build(label) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], {
    cwd: scratch, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  console.log(`=== ${label}: exit=${result.status} signal=${result.signal} ===`);
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  assert.equal(result.signal, null, `${label} terminated by signal`);
  return result;
}
try {
  for (const path of ['src', 'public', 'scripts', 'astro.config.ts', 'tsconfig.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
    await cp(join(root, path), join(scratch, path), { recursive: true });
  }
  await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');
  const configPath = join(scratch, 'src/config/site.ts');
  const original = await readFile(configPath, 'utf8');
  const cv = withSetting(withSetting(original, 'home', 'cv'), 'cv', 'cv_advo.md');
  await writeFile(configPath, cv);
  // This contract route exists only in the disposable copy, never in production.
  await writeFile(join(scratch, 'src/pages/provider-contract.astro'), `---
import Gallery from '../components/photography/Gallery.astro';
import type { PhotoProvider, PortfolioPhoto } from '../services/photos/types';
const photos: PortfolioPhoto[] = [1, 2].map((number, order) => ({
  id: 'mock-' + number, order, alt: 'Mock photo ' + number,
  fullUrl: 'https://example.invalid/full-' + number + '.svg',
  thumbnailUrl: 'https://example.invalid/thumb-' + number + '.svg',
}));
const mock: PhotoProvider = { async getPhotos(collectionId) {
  if (collectionId !== 'test') throw new Error('Unexpected collection');
  return photos;
} };
---
<Gallery photos={await mock.getPhotos('test')} />
`);
  assert.equal(build('home=cv').status, 0);
  const contractHtml = await readFile(join(scratch, 'dist/provider-contract/index.html'), 'utf8');
  assert.equal([...contractHtml.matchAll(/data-photo-index=/g)].length, 2);
  for (const number of [1, 2]) {
    assert.ok(contractHtml.includes(`data-full-url="https://example.invalid/full-${number}.svg"`));
    assert.ok(contractHtml.includes(`src="https://example.invalid/thumb-${number}.svg"`));
  }

  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(scratch, 'dist', '.' + pathname, ...(pathname.endsWith('/') ? ['index.html'] : []));
      assert.ok(path.startsWith(join(scratch, 'dist') + '/'));
      const content = await readFile(path);
      response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf' }[extname(path)] || 'application/octet-stream');
      response.end(content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  for (const path of ['/', '/cv/', '/fotografia/']) {
    const navigations = [];
    const record = frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); };
    page.on('framenavigated', record);
    const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 5000 });
    assert.equal(response.status(), 200);
    const canonicalPath = path === '/cv/' ? '/' : path;
    await page.waitForURL(base + canonicalPath);
    assert.equal(page.url(), base + canonicalPath);
    if (path === '/cv/') {
      const alias = await page.request.get(base + path);
      assert.equal(alias.status(), 200);
      assert.match(await alias.text(), /http-equiv="refresh" content="0;url=\/"/);
    } else {
      assert.deepEqual(navigations, [base + path], 'Canonical pages render directly');
    }
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://bercianor.es' + canonicalPath);
    assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).length > 30);
    assert.equal(await page.locator('nav a[aria-current="page"]').getAttribute('href'), canonicalPath);
    if (path === '/fotografia/') {
      assert.equal(await page.locator('[data-photo-index]').count(), photoCount);
      assert.equal(await page.locator('[data-featured]').count(), 1);
    } else {
      assert.equal(await page.locator('.cv h1').textContent(), 'Rubén Berciano');
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://bercianor.es/');
      assert.ok((await page.locator('.cv h2').allTextContents()).includes('Competencias clave'));
      assert.equal(await page.getByText('Disponibilidad geográfica:', { exact: true }).isVisible(), true);
      await assertCvPdf(page);
    }
    page.off('framenavigated', record);
  }
  const sitemap = await readFile(join(scratch, 'dist/sitemap.xml'), 'utf8');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), [
    'https://bercianor.es/', 'https://bercianor.es/fotografia/', 'https://bercianor.es/politica_cookies/',
  ]);
  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    const noJsPage = await noJsContext.newPage();
    await noJsPage.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
    await noJsPage.goto(base + '/cv/');
    await noJsPage.waitForURL(base + '/');
    assert.equal(await noJsPage.locator('.cv h1').textContent(), 'Rubén Berciano');
  } finally {
    await noJsContext.close();
  }
  await page.unroute('**/*');
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base + '/')) return route.continue();
    if (url.startsWith('https://example.invalid/')) return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><rect width="30" height="20" fill="gray"/></svg>',
    });
    return route.abort();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const contractResponse = await page.goto(base + '/provider-contract/', { waitUntil: 'networkidle', timeout: 5000 });
  assert.equal(contractResponse.status(), 200);
  assert.equal(await page.locator('[data-photo-index]').count(), 2);
  await page.locator('[data-photo-index="1"]').click();
  await page.waitForFunction(() => document.querySelector('[data-featured]')?.getAttribute('src') === 'https://example.invalid/full-2.svg');
  assert.equal(await page.locator('[data-photo-index="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-photo-index="0"]').getAttribute('aria-pressed'), 'false');
  console.log('PASS: RF09 typed mock provider renders two photos and browser selection works');
  const newCv = `cv_devel_${randomUUID()}.md`;
  await writeFile(join(scratch, 'src/content/cv', newCv), '# Development CV\n\nRemote availability.\n\n## Development profile\n\nA **new document** discovered without registering it.\n\n- Development experience\n');
  const cvFiles = (await readdir(join(scratch, 'src/content/cv'))).filter(filename => filename.endsWith('.md'));
  for (const [filename, heading] of [
    ['cv_maestro.md', 'Proyecto tecnológico'],
    [newCv, 'Development profile'],
  ]) {
    await writeFile(configPath, withSetting(cv, 'cv', filename));
    assert.equal(build(`CV=${filename}`).status, 0);
    for (const path of ['/', '/cv/']) {
      await page.goto(base + path, { waitUntil: 'networkidle', timeout: 5000 });
      await page.waitForURL(base + '/');
      assert.ok((await page.locator('.cv h2').allTextContents()).includes(heading));
      if (filename === 'cv_maestro.md') {
        assert.equal(await page.getByText('Ubicación y movilidad laboral:', { exact: true }).isVisible(), true);
      }
      await assertCvPdf(page);
    }
    for (const filename of cvFiles) {
      const response = await page.request.get(`${base}/cv/${filename.slice(0, -3)}.pdf`);
      assert.equal(response.status(), 200, `PDF generated for ${filename}`);
      assert.match(response.headers()['content-type'], /application\/pdf/);
      const pdf = await response.body();
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    }
  }
  assert.equal((await page.request.get(base + '/cv.pdf')).status(), 200);
  console.log('PASS: selected Markdown on CV/home; automatic discovery; matching selected and variant PDFs');
  await browser.close();
  browser = undefined;
  for (const [label, config, id] of [
    ['invalid home', withSetting(original, 'home', 'missing'), 'missing'],
    ['disabled CV home', replaceOnce(cv, "label: 'CV', enabled: true", "label: 'CV', enabled: false"), 'cv'],
  ]) {
    await writeFile(configPath, config);
    const result = build(label);
    assert.notEqual(result.status, 0);
    assert.ok((result.stdout + result.stderr).includes(`Invalid home section: ${id}. Choose an implemented, enabled section.`));
  }
  await writeFile(configPath, withSetting(original, 'cv', 'cv_missing.md'));
  const missingCv = build('missing CV document');
  assert.notEqual(missingCv.status, 0);
  assert.ok((missingCv.stdout + missingCv.stderr).includes('Unknown CV document: cv_missing.md'));
  assert.equal(await readFile(join(root, 'src/config/site.ts'), 'utf8'), original, 'Real configuration unchanged');
  console.log('PASS: alternate CV home, canonical routes, and invalid/disabled build rejection');
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
