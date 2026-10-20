import { resolve } from 'node:path';

export interface PhotoCatalog {
  albumUrl: string;
  photos: { id: string; url: string; width: number; height: number }[];
}

export const photoCatalogPath = resolve('src/data/photos.generated.json');

export function validatePhotoCatalog(value: unknown): PhotoCatalog {
  const catalog = value as PhotoCatalog | null;
  if (!catalog || typeof catalog.albumUrl !== 'string' || !Array.isArray(catalog.photos) || !catalog.photos.length) {
    throw new Error('Photo catalog must contain an album URL and photographs.');
  }
  const ids = new Set<string>();
  for (const photo of catalog.photos) {
    if (!photo || typeof photo.id !== 'string' || !photo.id.trim() || ids.has(photo.id)
      || typeof photo.url !== 'string'
      || !Number.isInteger(photo.width) || photo.width <= 0
      || !Number.isInteger(photo.height) || photo.height <= 0) {
      throw new Error('Photo catalog contains invalid or duplicate photographs.');
    }
    const url = new URL(photo.url);
    if (url.origin !== 'https://lh3.googleusercontent.com' || url.username || url.password) {
      throw new Error('Photo catalog contains an unsupported image URL.');
    }
    ids.add(photo.id);
  }
  return catalog;
}
