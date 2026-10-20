import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteConfig } from '../../src/config/site.ts';
import { JsonPhotoProvider } from '../../src/services/photos/index.ts';
import { syncPhotoCatalog } from '../../scripts/sync-photos.ts';

const albumUrl = 'https://photos.app.goo.gl/kG3kw3SFNUTg9WBQ8';
const items = [
  { uid: 'second', url: 'https://lh3.googleusercontent.com/second', width: 600, height: 400, isVideo: false },
  { uid: 'video', url: 'https://lh3.googleusercontent.com/video', width: 600, height: 400, isVideo: true },
  { uid: 'first', url: 'https://lh3.googleusercontent.com/first', width: 400, height: 600, isVideo: false },
];

async function isolated(run: (output: string) => Promise<void>) {
  await mkdir(new URL('../../test-results/', import.meta.url), { recursive: true });
  const directory = await mkdtemp(fileURLToPath(new URL('../../test-results/photos-', import.meta.url)));
  try { await run(join(directory, 'catalog.json')); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('site configuration selects the shared photo album', () => {
  assert.equal(siteConfig.photos.albumUrl, albumUrl);
});

test('album synchronization writes an ordered photo snapshot consumed without network requests', async () => {
  await isolated(async output => {
    let requests = 0;
    const count = await syncPhotoCatalog(albumUrl, output, async url => {
      requests++;
      assert.equal(url, albumUrl);
      return items;
    });
    assert.equal(count, 2);
    assert.equal(requests, 1);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), {
      albumUrl,
      photos: items.filter(item => !item.isVideo).map(item => ({
        id: item.uid, url: item.url, width: item.width, height: item.height,
      })),
    });
    const provider = new JsonPhotoProvider(output);
    const expected = items.filter(item => !item.isVideo).map((item, order) => ({
      id: item.uid, fullUrl: `${item.url}=w800`, thumbnailUrl: `${item.url}=w300`,
      alt: '', order, width: item.width, height: item.height,
    }));
    assert.deepEqual(await provider.getPhotos('portfolio'), expected);
    assert.deepEqual(await provider.getPhotos('unknown'), []);
    assert.deepEqual(await provider.getPhotos('portfolio'), expected);
    assert.equal(requests, 1);
  });
});

test('failed or invalid album extraction preserves the previous snapshot', async () => {
  await isolated(async output => {
    const previous = '{"previous":"snapshot"}\n';
    for (const result of [null, [], [items[1]], [{ ...items[0], url: 'http://example.com/photo' }],
      [{ ...items[0], width: 0 }], [items[0], items[0]]]) {
      await writeFile(output, previous);
      await assert.rejects(syncPhotoCatalog(albumUrl, output, async () => result));
      assert.equal(await readFile(output, 'utf8'), previous);
    }
    await assert.rejects(syncPhotoCatalog(albumUrl, output, async () => { throw new Error('Network unavailable'); }),
      /Network unavailable/);
    assert.equal(await readFile(output, 'utf8'), previous);
  });
});

test('provider rejects missing, invalid or mismatched snapshots with an actionable error', async () => {
  await isolated(async output => {
    const provider = new JsonPhotoProvider(output);
    await assert.rejects(provider.getPhotos('portfolio'), /photos:sync/);
    for (const content of ['broken JSON', JSON.stringify({
      albumUrl: 'https://photos.app.goo.gl/another',
      photos: [{ id: 'photo', url: items[0]!.url, width: 600, height: 400 }],
    })]) {
      await writeFile(output, content);
      await assert.rejects(provider.getPhotos('portfolio'), /photos:sync/);
    }
  });
});
