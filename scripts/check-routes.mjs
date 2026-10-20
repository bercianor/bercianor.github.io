import { readFile, access, readdir, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist');
const required = [
  'index.html', 'fotografia/index.html', 'cv/index.html',
  'politica_cookies/index.html', '404.html',
  'CNAME', 'robots.txt', 'sitemap.xml', '.well-known/nostr.json', 'keybase.txt',
  'static/images/firma.png', 'static/files/bercianor.pub.asc',
];
for (const path of required) {
  const target = resolve(root, path);
  await access(target);
  assert.ok((await stat(target)).isFile(), `Required output is not a file: ${path}`);
}
assert.equal((await readFile(resolve(root, 'CNAME'), 'utf8')).trim(), 'bercianor.es');

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]))).flat();
}

const outputs = await files(root);
let checked = 0;
for (const file of outputs.filter(path => path.endsWith('.html'))) {
  const html = await readFile(file, 'utf8');
  const documentPath = relative(root, file).split(sep).map(encodeURIComponent).join('/');
  const documentUrl = new URL(documentPath, 'https://bercianor.es/');
  for (const [, attr, raw] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
    const url = new URL(raw.replaceAll('&amp;', '&'), documentUrl);
    if (url.origin !== 'https://bercianor.es' || raw.startsWith('#')) continue;
    const path = decodeURIComponent(url.pathname);
    const target = resolve(root, '.' + path);
    assert.ok(target.startsWith(root + '/') || target === root, `Invalid local URL: ${raw}`);
    const candidates = path.endsWith('/') ? [resolve(target, 'index.html')] : [target, resolve(target, 'index.html')];
    const found = await Promise.all(candidates.map(path => stat(path).then(info => info.isFile(), () => false)));
    assert.ok(found.some(Boolean), `${file}: broken ${attr} ${raw}`);
    checked++;
  }
}
console.log(`PASS: ${required.length} required outputs and ${checked} internal link/asset references`);
