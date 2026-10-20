import { fetchImageUrls } from '@marcus5914/google-photos-album-image-url-fetch';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { siteConfig } from '../src/config/site.ts';
import { photoCatalogPath, validatePhotoCatalog } from '../src/services/photos/catalog.ts';

type AlbumItem = { uid: string; url: string; width: number; height: number; isVideo: boolean };
type AlbumFetcher = (url: string) => Promise<readonly AlbumItem[] | null>;

export async function syncPhotoCatalog(
  albumUrl: string,
  output: string | URL = photoCatalogPath,
  fetchImages: AlbumFetcher = url => fetchImageUrls(url, AbortSignal.timeout(30_000)),
): Promise<number> {
  const items = await fetchImages(albumUrl);
  if (!Array.isArray(items) || !items.length) throw new Error('Google Photos album returned no photographs.');
  const catalog = validatePhotoCatalog({
    albumUrl,
    photos: items.filter(item => item.isVideo === false).map(item => ({
      id: item.uid, url: item.url, width: item.width, height: item.height,
    })),
  });
  const path = output instanceof URL ? fileURLToPath(output) : output;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  return catalog.photos.length;
}

if (import.meta.main) {
  try {
    const count = await syncPhotoCatalog(siteConfig.photos.albumUrl);
    console.log(`Photo catalog generated: ${count} photographs.`);
  } catch (error) {
    console.error('Photo catalog generation failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
