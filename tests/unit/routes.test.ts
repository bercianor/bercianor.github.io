import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../../scripts/check-routes.mjs', import.meta.url));
const required = [
  'index.html', 'fotografia/index.html', 'cv/index.html',
  'politica_cookies/index.html', '404.html', 'CNAME', 'robots.txt',
  'sitemap.xml', '.well-known/nostr.json', 'keybase.txt',
  'static/images/firma.png', 'static/files/bercianor.pub.asc',
];

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result[`${entry.name}/`] = 'directory';
      for (const [name, content] of Object.entries(await snapshot(path))) {
        result[`${entry.name}/${name}`] = content;
      }
    } else {
      result[entry.name] = (await readFile(path)).toString('base64');
    }
  }
  return result;
}

async function check(
  reference: string,
  extras: Record<string, string>,
  valid: boolean,
  directories: string[] = [],
  requiredDirectory?: string,
) {
  await mkdir('test-results', { recursive: true });
  const cwd = await mkdtemp(join(process.cwd(), 'test-results/route-validator-'));
  const dist = join(cwd, 'dist');
  try {
    const contents: Record<string, string> = Object.fromEntries(required.map(path => [path, '']));
    contents.CNAME = 'bercianor.es\n';
    contents['cv/index.html'] = `<a href="${reference}">link</a>`;
    Object.assign(contents, extras);
    for (const [path, content] of Object.entries(contents)) {
      if (path === requiredDirectory) continue;
      await mkdir(dirname(join(dist, path)), { recursive: true });
      await writeFile(join(dist, path), content);
    }
    for (const path of [...directories, ...(requiredDirectory ? [requiredDirectory] : [])]) {
      await mkdir(join(dist, path), { recursive: true });
    }
    const before = await snapshot(dist);
    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.deepEqual(await snapshot(dist), before, 'validation must not change input files');
    if (valid) {
      const ignored = /^(https:\/\/elsewhere\.example|mailto:|#)/.test(reference);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `PASS: 12 required outputs and ${ignored ? 0 : 1} internal link/asset references\n`);
      assert.equal(result.stderr, '');
    } else {
      assert.equal(result.status, 1, result.stdout);
      assert.equal(result.stdout, '');
      const diagnostic = requiredDirectory
        ? `Required output is not a file: ${requiredDirectory}`
        : `${join(dist, 'cv/index.html')}: broken href ${reference}`;
      assert.ok(result.stderr.includes(diagnostic), result.stderr);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test('required robots.txt must be a file, not an empty directory', async () => {
  await check('#section', {}, false, [], 'robots.txt');
});

test('nested relative references cannot borrow an asset from the output root', async () => {
  await check('static/ok.txt', { 'static/ok.txt': 'root only' }, false);
});

test('directories without an index are broken targets', async () => {
  await check('/empty-target', {}, false, ['empty-target']);
});

test('missing exact files cannot borrow an html-suffixed neighbor', async () => {
  await check('/missing.txt', { 'missing.txt.html': 'not the requested file' }, false);
});

for (const [name, reference, extras] of [
  ['root-relative file', '/static/ok.txt', { 'static/ok.txt': 'ok' }],
  ['nested relative file', 'static/ok.txt', { 'cv/static/ok.txt': 'ok' }],
  ['parent-relative file', '../static/ok.txt', { 'static/ok.txt': 'ok' }],
  ['directory index', '/target', { 'target/index.html': '' }],
  ['trailing-slash directory index', '/target/', { 'target/index.html': '' }],
  ['same-origin absolute URL', 'https://bercianor.es/static/ok.txt', { 'static/ok.txt': 'ok' }],
  ['decoded filename', '/static/a%20b.txt', { 'static/a b.txt': 'ok' }],
  ['external URL', 'https://elsewhere.example/missing', {}],
  ['mail URL', 'mailto:hello@example.com', {}],
  ['fragment', '#section', {}],
] as const) {
  test(`accepts ${name}`, async () => {
    await check(reference, extras, true);
  });
}
