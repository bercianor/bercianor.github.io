import { readFile } from 'node:fs/promises';
import { siteConfig } from '../../config/site.ts';
import { photoCatalogPath, validatePhotoCatalog } from './catalog.ts';
import type { PhotoProvider, PortfolioPhoto } from './types.ts';

export class JsonPhotoProvider implements PhotoProvider {
  private readonly path: string | URL;

  constructor(path: string | URL = photoCatalogPath) {
    this.path = path;
  }

  async getPhotos(collectionId: string): Promise<readonly PortfolioPhoto[]> {
    if (collectionId !== 'portfolio') return [];
    try {
      const catalog = validatePhotoCatalog(JSON.parse(await readFile(this.path, 'utf8')));
      if (catalog.albumUrl !== siteConfig.photos.albumUrl) throw new Error('Photo album configuration changed.');
      return catalog.photos.map((photo, order) => ({
        id: photo.id,
        fullUrl: `${photo.url.replace(/=[^/]*$/, '')}=w800`,
        thumbnailUrl: `${photo.url.replace(/=[^/]*$/, '')}=w300`,
        alt: '',
        order,
        width: photo.width,
        height: photo.height,
      }));
    } catch (cause) {
      throw new Error('Photo catalog unavailable or invalid. Run pnpm run photos:sync.', { cause });
    }
  }
}
